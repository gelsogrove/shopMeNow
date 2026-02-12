import { prisma } from "@echatbot/database"
import { config } from "../../config"
import logger from "../../utils/logger"

// prisma imported

/**
 * URL Shortener Service
 * Creates short URLs like /s/abc123 that redirect to long token-based URLs
 */
export class UrlShortenerService {
  /**
   * Generate a short code (6 characters, URL-safe)
   */
  private generateShortCode(): string {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let result = ""
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  /**
   * Create a short URL for a long token-based URL
   * @param originalUrl The full URL with token (e.g., /checkout?token=...)
   * @param workspaceId Workspace ID for isolation
   * @param expiresAt When the short URL should expire (optional)
   */
  async createShortUrl(
    originalUrl: string,
    workspaceId: string,
    expiresAt?: Date
  ): Promise<{ shortCode: string; shortUrl: string }> {
    const maxRetries = 3

    for (let retry = 0; retry < maxRetries; retry++) {
      try {
        const shortCode = this.generateShortCode()

        // Default expiration: 1 hour from now
        const defaultExpiration = new Date()
        defaultExpiration.setHours(defaultExpiration.getHours() + 1)

        // Create short URL record directly (single DB call)
        // If unique constraint violation on shortCode, retry with new code
        await prisma.shortUrls.create({
          data: {
            shortCode,
            originalUrl,
            workspaceId,
            expiresAt: expiresAt || defaultExpiration,
            clicks: 0,
            isActive: true,
          },
        })

        // 🔧 FIX: Use frontendUrl instead of appUrl for short links
        // This ensures links use echatbot.ai instead of Heroku domain
        // The /s/:shortCode route is served by the backend but uses frontend domain
        const baseUrl = config.frontendUrl.replace(/\/$/, "")
        const shortUrl = `${baseUrl}/s/${shortCode}`

        logger.info(
          `📎 Short URL created: ${shortUrl} → ${originalUrl.substring(0, 50)}...`
        )

        return { shortCode, shortUrl }
      } catch (error: any) {
        // P2002 = Unique constraint violation (shortCode collision) → retry with new code
        if (error?.code === "P2002" && retry < maxRetries - 1) {
          logger.info(`🔄 Short code collision, retrying (${retry + 1}/${maxRetries})`)
          continue
        }

        // Log detailed error for diagnosis (Heroku Prisma issues)
        logger.error("❌ Error creating short URL:", {
          retry: retry + 1,
          maxRetries,
          errorCode: error?.code,
          errorMessage: error?.message,
          originalUrl: originalUrl.substring(0, 80),
          workspaceId,
        })

        if (retry >= maxRetries - 1) {
          throw new Error(`Failed to create short URL after ${maxRetries} attempts: ${error?.message || "Unknown error"}`)
        }

        // Small delay before retry for transient errors
        await new Promise(resolve => setTimeout(resolve, 200 * (retry + 1)))
      }
    }

    throw new Error("Failed to create short URL: exhausted retries")
  }

  /**
   * Resolve a short URL to its original URL
   * @param shortCode The short code (e.g., "abc123")
   */
  async resolveShortUrl(shortCode: string): Promise<{
    success: boolean
    originalUrl?: string
    expired?: boolean
    notFound?: boolean
  }> {
    try {
      const shortUrl = await prisma.shortUrls.findFirst({
        where: {
          shortCode,
          isActive: true,
        },
      })

      if (!shortUrl) {
        return { success: false, notFound: true }
      }

      // Check if expired
      if (shortUrl.expiresAt && shortUrl.expiresAt < new Date()) {
        return { success: false, expired: true }
      }

      // Increment click counter
      await prisma.shortUrls.update({
        where: { id: shortUrl.id },
        data: {
          clicks: { increment: 1 },
          lastAccessedAt: new Date(),
        },
      })

      logger.info(
        `📎 Short URL resolved: /s/${shortCode} → ${shortUrl.originalUrl.substring(0, 50)}... (clicks: ${shortUrl.clicks + 1})`
      )

      return {
        success: true,
        originalUrl: shortUrl.originalUrl,
      }
    } catch (error) {
      logger.error("❌ Error resolving short URL:", error)
      return { success: false }
    }
  }

  /**
   * Get statistics for a short URL
   */
  async getShortUrlStats(shortCode: string): Promise<{
    clicks: number
    createdAt: Date
    expiresAt: Date | null
    isActive: boolean
  } | null> {
    try {
      const shortUrl = await prisma.shortUrls.findFirst({
        where: { shortCode },
        select: {
          clicks: true,
          createdAt: true,
          expiresAt: true,
          isActive: true,
        },
      })

      return shortUrl
    } catch (error) {
      logger.error("❌ Error getting short URL stats:", error)
      return null
    }
  }

  /**
   * Clean up expired short URLs
   */
  async cleanupExpiredUrls(): Promise<number> {
    try {
      const result = await prisma.shortUrls.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      })

      if (result.count > 0) {
        logger.info(`🧹 Cleaned up ${result.count} expired short URLs`)
      }

      return result.count
    } catch (error) {
      logger.error("❌ Error cleaning up expired URLs:", error)
      return 0
    }
  }

  /**
   * Clean up old short URLs that are older than 1 hour
   * This runs automatically on each URL access to keep the database clean
   */
  async cleanupOldUrls(): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago

      const result = await prisma.shortUrls.deleteMany({
        where: {
          OR: [
            // Delete expired URLs
            {
              expiresAt: {
                lt: new Date(),
              },
            },
            // Delete URLs older than 1 hour (regardless of expiry)
            {
              createdAt: {
                lt: oneHourAgo,
              },
            },
          ],
        },
      })

      if (result.count > 0) {
        logger.info(
          `🧹 Auto-cleanup: removed ${result.count} old short URLs (>1h or expired)`
        )
      }

      return result.count
    } catch (error) {
      logger.error("❌ Error in auto-cleanup of old URLs:", error)
      return 0
    }
  }
}

export const urlShortenerService = new UrlShortenerService()
