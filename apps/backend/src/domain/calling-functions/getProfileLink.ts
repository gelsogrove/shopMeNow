/**
 * getProfileLink - LLM-Callable Function
 *
 * Generates a secure, time-limited link for customer to view and edit their profile.
 * Similar to registration link but requires authentication token.
 *
 * Features:
 * - Secure token with expiration (24 hours default)
 * - URL shortening for WhatsApp
 * - Customer can edit: name, email, phone, company, push notification consent
 * - Token validates customerId + workspaceId
 *
 * Use cases:
 * - "Voglio modificare i miei dati"
 * - "Come cambio il mio indirizzo email?"
 * - "Dove posso aggiornare il mio profilo?"
 *
 * @see docs/architecture/link-tokens.md - Profile link with secure token
 */

import logger from "../../utils/logger"
import { prisma } from "@echatbot/database"

export interface GetProfileLinkRequest {
  customerId: string
  workspaceId: string
  expirationHours?: number // Default: 24h
}

export interface GetProfileLinkResult {
  success: boolean
  profileLink?: string
  shortLink?: string
  expiresAt?: string
  message: string
  error?: string
}

/**
 * Generate secure profile edit link for customer
 *
 * @param request - Request with customerId and workspaceId
 * @returns Result with profile link (long + short) and expiration
 */
export async function getProfileLink(
  request: GetProfileLinkRequest
): Promise<GetProfileLinkResult> {
  try {
    logger.info("🔗 getProfileLink called", {
      customerId: request.customerId,
      workspaceId: request.workspaceId,
      expirationHours: request.expirationHours || 24,
    })

    // 1. Validate customer exists
    const customer = await prisma.customers.findFirst({
      where: {
        id: request.customerId,
        workspaceId: request.workspaceId,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    if (!customer) {
      logger.error("❌ Customer not found for getProfileLink", {
        customerId: request.customerId,
        workspaceId: request.workspaceId,
      })
      return {
        success: false,
        message: "Customer not found or workspace mismatch.",
        error: "Customer not found",
      }
    }

    // 2. Generate secure token
    const { SecureTokenService } = require("../../application/services/secure-token.service")
    const secureTokenService = new SecureTokenService()

    const expirationHours = request.expirationHours || 24
    const token = await secureTokenService.createToken(
      "profile", // Token type for profile editing
      request.workspaceId,
      {
        customerId: request.customerId,
        customerName: customer.name,
        customerEmail: customer.email,
      },
      `${expirationHours}h`, // Expiration: 24h default
      undefined, // userId (not needed for customer profile)
      undefined, // phoneNumber (already in customer record)
      undefined, // ipAddress (optional)
      request.customerId // customerId
    )

    // 3. Get workspace URL
    const { workspaceService } = require("../../services/workspace.service")
    const { url: workspaceUrl } = await workspaceService.getWorkspaceURLWithRegistration(
      request.workspaceId
    )

    // 4. Generate full profile URL
    // 🚨 CRITICAL: Use /customer-profile (public page with token), NOT /profile (auth required)
    const baseUrl = workspaceUrl || process.env.FRONTEND_URL || "https://www.echatbot.ai"
    const profileUrl = `${baseUrl}/customer-profile?token=${token}`

    logger.info("✅ Profile URL generated", {
      customerId: request.customerId,
      url: profileUrl,
      expiresInHours: expirationHours,
    })

    // 5. Try to create short URL (fallback to long if fails)
    let shortLink: string | undefined

    try {
      const { UrlShortenerService } = require("../../application/services/url-shortener.service")
      const urlShortenerService = new UrlShortenerService()

      shortLink = (await urlShortenerService.createShortUrl(
        profileUrl,
        request.workspaceId,
        new Date(Date.now() + (expirationHours * 60 * 60 * 1000)) // Pass Date object as 3rd arg
      )).shortUrl

      logger.info("✅ Short URL created", {
        customerId: request.customerId,
        shortLink,
      })
    } catch (shortenerError) {
      logger.warn("⚠️ URL shortener failed, using long URL", {
        error: shortenerError,
      })
      shortLink = profileUrl // Fallback to long URL
    }

    // 6. Calculate expiration timestamp
    const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000).toISOString()

    return {
      success: true,
      profileLink: profileUrl,
      shortLink: shortLink || profileUrl,
      expiresAt,
      message: `[LINK_PROFILE_WITH_TOKEN]`, // Token replaced by LinkReplacementService
    }
  } catch (error) {
    logger.error("❌ getProfileLink failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      customerId: request.customerId,
      workspaceId: request.workspaceId,
    })

    return {
      success: false,
      message: "Failed to generate profile link. Please try again.",
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
