import { PrismaClient } from "@prisma/client"
import { workspaceService } from "../../services/workspace.service"
import logger from "../../utils/logger"

const prisma = new PrismaClient()

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
    try {
      let shortCode: string
      let attempts = 0
      const maxAttempts = 10

      // Generate unique short code
      do {
        shortCode = this.generateShortCode()
        attempts++

        if (attempts > maxAttempts) {
          throw new Error("Could not generate unique short code")
        }

        // Check if code already exists
        const existing = await prisma.shortUrls.findFirst({
          where: { shortCode },
        })

        if (!existing) break
      } while (true)

      // Default expiration: 1 hour from now
      const defaultExpiration = new Date()
      defaultExpiration.setHours(defaultExpiration.getHours() + 1)

      // Create short URL record
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

      // Get workspace base URL
      const baseUrl = await workspaceService.getWorkspaceURL(workspaceId)
      const shortUrl = `${baseUrl}/s/${shortCode}`

      logger.info(
        `📎 Short URL created: ${shortUrl} → ${originalUrl.substring(0, 50)}...`
      )

      return { shortCode, shortUrl }
    } catch (error) {
      logger.error("❌ Error creating short URL:", error)
      throw new Error("Failed to create short URL")
    }
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
