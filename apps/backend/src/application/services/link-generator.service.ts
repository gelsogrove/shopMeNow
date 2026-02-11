import { config } from "../../config"
import logger from "../../utils/logger"
import { UrlShortenerService } from "./url-shortener.service"

/**
 * Centralized Link Generator Service
 * Ensures ALL links use URL shortener consistently
 */
export class LinkGeneratorService {
  private urlShortenerService: UrlShortenerService

  constructor() {
    this.urlShortenerService = new UrlShortenerService()
  }

  /**
   * Generate a short URL for any link type
   * This is the SINGLE source of truth for link generation
   */
  async generateShortLink(
    originalUrl: string,
    workspaceId: string,
    linkType: string = "generic"
  ): Promise<string> {
    try {
      // Create short URL - now returns full URL from workspace.url
      const shortResult = await this.urlShortenerService.createShortUrl(
        originalUrl,
        workspaceId
      )

      // shortResult.shortUrl already contains the full URL (e.g., http://localhost:3000/s/abc123)
      const shortUrl = shortResult.shortUrl

      logger.info(
        `📎 Created short ${linkType} link: ${shortUrl} → ${originalUrl}`
      )
      return shortUrl
    } catch (error) {
      logger.warn(
        `⚠️ Failed to create short URL for ${linkType}, using long URL:`,
        error
      )
      return originalUrl // Fallback to original URL
    }
  }

  /**
   * Generate checkout/cart link with token
   * @param token JWT token for checkout
   * @param workspaceId Workspace ID
   * @param step Optional step parameter (1 or 2) - FR-13 Repeat Order
   */
  async generateCheckoutLink(
    token: string,
    workspaceId: string,
    step?: number
  ): Promise<string> {
    // Validate step parameter if provided
    if (step !== undefined && (step < 1 || step > 2)) {
      throw new Error("Invalid step parameter: must be 1 or 2")
    }

    let originalUrl = `${config.frontendUrl}/cart?token=${token}`
    if (step) {
      originalUrl += `&step=${step}`
    }
    return this.generateShortLink(originalUrl, workspaceId, "cart")
  }

  /**
   * Generate orders link (general or specific)
   */
  async generateOrdersLink(
    token: string,
    workspaceId: string,
    orderCode?: string
  ): Promise<string> {
    let originalUrl: string

    if (orderCode && orderCode.trim() !== "") {
      const safeCode = encodeURIComponent(orderCode.trim())
      originalUrl = `${config.frontendUrl}/orders-public/${safeCode}?token=${token}`
    } else {
      originalUrl = `${config.frontendUrl}/orders-public?token=${token}`
    }

    return this.generateShortLink(originalUrl, workspaceId, "orders")
  }

  /**
   * Generate profile link with token
   */
  async generateProfileLink(
    token: string,
    workspaceId: string
  ): Promise<string> {
    const originalUrl = `${config.frontendUrl}/customer-profile?token=${token}`
    return this.generateShortLink(originalUrl, workspaceId, "profile")
  }

  /**
   * Generate tracking link with token
   * NOTE: Tracking uses orders-public page, not a separate tracking page
   */
  async generateTrackingLink(
    token: string,
    workspaceId: string
  ): Promise<string> {
    const originalUrl = `${config.frontendUrl}/orders-public?token=${token}`
    return this.generateShortLink(originalUrl, workspaceId, "tracking")
  }

  /**
   * Generate invoice link with token
   */
  async generateInvoiceLink(
    token: string,
    workspaceId: string
  ): Promise<string> {
    const originalUrl = `${config.frontendUrl}/invoice-public?token=${token}`
    return this.generateShortLink(originalUrl, workspaceId, "invoice")
  }

  /**
   * Generate registration link with token
   * Uses custom registrationPage URL if provided, otherwise falls back to default /registration/:workspaceId path
   * @param token - JWT registration token
   * @param workspaceUrl - Base workspace URL (legacy/custom use cases)
   * @param workspaceId - Workspace ID for short URL generation
   * @param customRegistrationPage - Optional: Custom registration page URL from workspace.registrationPage
   */
  async generateRegistrationLink(
    token: string,
    workspaceUrl: string,
    workspaceIdOrSlug: string, // Can be either ID or slug
    customRegistrationPage?: string | null
  ): Promise<string> {
    // 🔧 FIX: Load workspace to get REAL ID (not slug)
    // workspaceIdOrSlug might be a slug, we need the actual ID for the URL
    const { PrismaClient } = require("@prisma/client")
    const prisma = new PrismaClient()
    
    try {
      const workspace = await prisma.workspace.findFirst({
        where: {
          OR: [
            { id: workspaceIdOrSlug },
            { slug: workspaceIdOrSlug },
          ],
        },
        select: { id: true },
      })
      
      if (!workspace) {
        logger.error(`❌ Workspace not found: ${workspaceIdOrSlug}`)
        throw new Error(`Workspace not found: ${workspaceIdOrSlug}`)
      }
      
      const workspaceId = workspace.id // Use REAL ID, not slug
      
      // 🚨 CRITICAL FIX: Use workspace URL (custom domain), NOT global frontend URL
      // workspaceUrl is the actual domain (e.g., www.echatbot.ai), not Heroku internal URL
      const baseUrl = (workspaceUrl || config.frontendUrl).replace(/\/$/, "")
      let originalUrl: string

      if (customRegistrationPage && customRegistrationPage.trim() !== "") {
        // Use custom registration page URL
        // If it's a full URL (starts with http), use it directly
        // If it's a relative path, append it to the workspace base URL
        const customUrl = customRegistrationPage
          .trim()
          .replace(/\{workspaceId\}/g, workspaceId)

        if (customUrl.startsWith("http://") || customUrl.startsWith("https://")) {
          originalUrl = customUrl
        } else {
          const basePath = customUrl.startsWith("/") ? customUrl : `/${customUrl}`
          originalUrl = `${baseUrl}${basePath}`
        }
        logger.info(`📎 Using custom registration page: ${originalUrl}`)
      } else {
        // Default registration path (hosted on workspace domain)
        // ✅ NOW ALWAYS USES REAL ID, NOT SLUG
        const safeWorkspaceId = encodeURIComponent(workspaceId)
        originalUrl = `${baseUrl}/registration/${safeWorkspaceId}`
      }

      // Ensure token is attached once
      if (!/[?&]token=/.test(originalUrl)) {
        const separator = originalUrl.includes("?") ? "&" : "?"
        originalUrl = `${originalUrl}${separator}token=${token}`
      }

      // 🔧 FIX: Registration links should last 7 days, not 1 hour
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // 7 days from now

      return this.generateShortLinkWithExpiry(originalUrl, workspaceId, "registration", expiresAt)
    } finally {
      await prisma.$disconnect()
    }
  }

  /**
   * Generate a short link with custom expiration
   */
  private async generateShortLinkWithExpiry(
    originalUrl: string,
    workspaceId: string,
    linkType: string,
    expiresAt: Date
  ): Promise<string> {
    try {
      const shortResult = await this.urlShortenerService.createShortUrl(
        originalUrl,
        workspaceId,
        expiresAt
      )

      const shortUrl = shortResult.shortUrl

      logger.info(
        `📎 Created short ${linkType} link (expires: ${expiresAt.toISOString()}): ${shortUrl} → ${originalUrl}`
      )
      return shortUrl
    } catch (error) {
      logger.warn(
        `⚠️ Failed to create short URL for ${linkType}, using long URL:`,
        error
      )
      return originalUrl
    }
  }

  /**
   * Generate tracking link for specific order
   */
  async generateShipmentTrackingLink(
    baseUrl: string,
    orderCode: string,
    token: string,
    workspaceId: string
  ): Promise<string> {
    const originalUrl = `${baseUrl}/orders-public/${orderCode}?token=${token}`
    return this.generateShortLink(originalUrl, workspaceId, "shipment-tracking")
  }
}

// Export singleton instance
export const linkGeneratorService = new LinkGeneratorService()
