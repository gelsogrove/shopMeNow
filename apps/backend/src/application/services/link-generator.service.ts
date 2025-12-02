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
   */
  async generateRegistrationLink(
    token: string,
    workspaceUrl: string,
    workspaceId: string
  ): Promise<string> {
    const originalUrl = `${workspaceUrl.replace(/\/$/, "")}/registration?token=${token}`
    return this.generateShortLink(originalUrl, workspaceId, "registration")
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
