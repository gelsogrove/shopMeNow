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
   * Uses custom registrationPage URL if provided, otherwise falls back to default /registration path
   * @param token - JWT registration token
   * @param workspaceUrl - Base workspace URL (e.g., https://mystore.com)
   * @param workspaceId - Workspace ID for short URL generation
   * @param customRegistrationPage - Optional: Custom registration page URL from workspace.registrationPage
   */
  async generateRegistrationLink(
    token: string,
    workspaceUrl: string,
    workspaceId: string,
    customRegistrationPage?: string | null
  ): Promise<string> {
    let originalUrl: string

    if (customRegistrationPage && customRegistrationPage.trim() !== "") {
      // Use custom registration page URL
      // If it's a full URL (starts with http), use it directly with token appended
      // If it's a relative path, append it to workspaceUrl
      const customUrl = customRegistrationPage.trim()
      if (customUrl.startsWith("http://") || customUrl.startsWith("https://")) {
        // Full URL - append token as query parameter
        const separator = customUrl.includes("?") ? "&" : "?"
        originalUrl = `${customUrl}${separator}token=${token}`
      } else {
        // Relative path - combine with workspaceUrl
        const basePath = customUrl.startsWith("/") ? customUrl : `/${customUrl}`
        originalUrl = `${workspaceUrl.replace(/\/$/, "")}${basePath}?token=${token}`
      }
      logger.info(`📎 Using custom registration page: ${originalUrl}`)
    } else {
      // Default registration path
      originalUrl = `${workspaceUrl.replace(/\/$/, "")}/registration?token=${token}`
    }

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
