import { Request, Response } from "express"
import { urlShortenerService } from "../../../application/services/url-shortener.service"
import { config } from "../../../config"
import logger from "../../../utils/logger"

/**
 * Short URL Controller
 * Handles redirection from short URLs to original URLs
 */
export class ShortUrlController {
  /**
   * Redirect from short URL to original URL
   * GET /s/:shortCode
   */
  async redirect(req: Request, res: Response): Promise<void> {
    try {
      const { shortCode } = req.params

      if (!shortCode) {
        res.status(400).json({
          success: false,
          error: "Short code is required",
        })
        return
      }

      // Auto-cleanup old URLs (>1 hour) on each request
      // This runs asynchronously without blocking the redirect
      urlShortenerService.cleanupOldUrls().catch((error) => {
        logger.error("❌ Error in background cleanup:", error)
      })

      logger.info(`📎 Resolving short URL: /s/${shortCode}`)

      const result = await urlShortenerService.resolveShortUrl(shortCode)

      if (!result.success) {
        if (result.notFound) {
          // Redirect to not found page instead of returning JSON
          logger.info(`📎 Short URL not found, redirecting to 404 page`)
          res.redirect(302, `${config.frontendUrl}/not-found`)
        } else if (result.expired) {
          // Redirect to expired page instead of returning JSON
          logger.info(`📎 Short URL expired, redirecting to expired page`)
          res.redirect(302, `${config.frontendUrl}/expired`)
        } else {
          res.status(500).json({
            success: false,
            error: "Failed to resolve short URL",
          })
        }
        return
      }

      // Check if URL is a PDF file
      const isPdf = result.originalUrl!.toLowerCase().endsWith('.pdf')
      
      if (isPdf) {
        // For PDF files, return HTML that opens in new window/tab
        logger.info(`📎 PDF detected, opening in new window: ${result.originalUrl}`)
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Opening PDF...</title>
            <script>
              // Open PDF in new window/tab and close redirect page
              window.open('${result.originalUrl}', '_blank');
              // Redirect current page to a confirmation or close
              setTimeout(() => {
                document.body.innerHTML = '<div style="font-family: Arial; text-align: center; margin-top: 50px;"><h2>PDF aperto in una nuova finestra</h2><p>Puoi chiudere questa scheda.</p></div>';
              }, 100);
            </script>
          </head>
          <body>
            <div style="font-family: Arial; text-align: center; margin-top: 50px;">
              <h2>Apertura PDF in corso...</h2>
              <p>Se il PDF non si apre automaticamente, <a href="${result.originalUrl}" target="_blank">clicca qui</a>.</p>
            </div>
          </body>
          </html>
        `)
      } else {
        // For non-PDF URLs, use standard redirect
        logger.info(`📎 Redirecting to: ${result.originalUrl}`)
        res.redirect(302, result.originalUrl!)
      }
    } catch (error) {
      logger.error("❌ Error in short URL redirect:", error)
      res.status(500).json({
        success: false,
        error: "Internal server error",
      })
    }
  }

  /**
   * Get short URL statistics
   * GET /api/short-urls/:shortCode/stats
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const { shortCode } = req.params

      if (!shortCode) {
        res.status(400).json({
          success: false,
          error: "Short code is required",
        })
        return
      }

      const stats = await urlShortenerService.getShortUrlStats(shortCode)

      if (!stats) {
        res.status(404).json({
          success: false,
          error: "Short URL not found",
        })
        return
      }

      res.json({
        success: true,
        stats,
      })
    } catch (error) {
      logger.error("❌ Error getting short URL stats:", error)
      res.status(500).json({
        success: false,
        error: "Internal server error",
      })
    }
  }
}

export const shortUrlController = new ShortUrlController()
