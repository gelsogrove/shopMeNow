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
      const isPdf = result.originalUrl!.toLowerCase().endsWith(".pdf")

      if (isPdf) {
        // For PDF files, return HTML that opens in new window/tab
        logger.info(
          `📎 PDF detected, opening in new window: ${result.originalUrl}`
        )
        // ✅ SECURITY FIX: Use safe DOM manipulation instead of innerHTML
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Opening PDF...</title>
            <script>
              // Open PDF in new window/tab
              const pdfUrl = ${JSON.stringify(result.originalUrl)};
              window.open(pdfUrl, '_blank');
              
              // Show confirmation message using safe DOM methods
              setTimeout(() => {
                // Clear body safely
                while (document.body.firstChild) {
                  document.body.removeChild(document.body.firstChild);
                }
                
                // Create elements safely (no innerHTML)
                const container = document.createElement('div');
                container.style.cssText = 'font-family: Arial; text-align: center; margin-top: 50px';
                
                const title = document.createElement('h2');
                title.textContent = 'PDF aperto in una nuova finestra';
                
                const message = document.createElement('p');
                message.textContent = 'Puoi chiudere questa scheda.';
                
                container.appendChild(title);
                container.appendChild(message);
                document.body.appendChild(container);
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
        // For non-PDF URLs, do direct HTTP 302 redirect (most reliable)
        // This ensures the redirect works on FIRST click without any SPA/JS issues
        logger.info(`📎 HTTP 302 redirect to: ${result.originalUrl}`)
        
        const targetUrl = result.originalUrl!
        res.redirect(302, targetUrl)
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
   * Resolve short URL and return JSON instead of redirect
   * GET /s/:shortCode/resolve
   * Used by frontend SPA to get the original URL without browser redirect issues
   */
  async resolve(req: Request, res: Response): Promise<void> {
    try {
      const { shortCode } = req.params

      if (!shortCode) {
        res.status(400).json({
          success: false,
          error: "Short code is required",
        })
        return
      }

      logger.info(`📎 Resolving short URL (JSON): /s/${shortCode}`)

      const result = await urlShortenerService.resolveShortUrl(shortCode)

      if (!result.success) {
        if (result.notFound) {
          res.status(404).json({
            success: false,
            error: "Short URL not found",
            notFound: true,
          })
        } else if (result.expired) {
          res.status(410).json({
            success: false,
            error: "Short URL has expired",
            expired: true,
          })
        } else {
          res.status(500).json({
            success: false,
            error: "Failed to resolve short URL",
          })
        }
        return
      }

      // Return the original URL as JSON
      res.json({
        success: true,
        originalUrl: result.originalUrl,
      })
    } catch (error) {
      logger.error("❌ Error resolving short URL (JSON):", error)
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
