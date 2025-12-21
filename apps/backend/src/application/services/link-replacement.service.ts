/**
 * Link Replacement Service
 *
 * Application Service Layer - Clean Architecture
 *
 * Handles replacement of token placeholders with actual generated links.
 * Supports cart, profile, orders, tracking, and checkout links with URL shortening.
 *
 * This is a utility service, NOT a calling function for LLM.
 */

import logger from "../../utils/logger"

import { linkGeneratorService } from "./link-generator.service"
import { SecureTokenService } from "./secure-token.service"

export interface ReplaceLinkWithTokenParams {
  response: string
  linkType?: "cart" | "profile" | "orders" | "tracking" | "checkout" | "auto"
  context?: "offers" | "services" | "auto"
  orderCode?: string
}

export interface ReplaceLinkWithTokenResult {
  success: boolean
  response?: string
  error?: string
  linkType?: string
  generatedLink?: string
}

/**
 * Service for replacing token placeholders in text with actual secure links
 */
export class LinkReplacementService {
  private secureTokenService: SecureTokenService

  constructor() {
    this.secureTokenService = new SecureTokenService()
  }

  /**
   * Replace token placeholders in response text with actual links
   *
   * @param params - Parameters including response text and optional link type
   * @param customerId - Customer ID for token generation
   * @param workspaceId - Workspace ID for token generation
   * @returns Result with replaced response text
   */
  async replaceTokens(
    params: ReplaceLinkWithTokenParams,
    customerId: string,
    workspaceId: string
  ): Promise<ReplaceLinkWithTokenResult> {
    try {
      logger.info("🔧 ReplaceLinkWithToken: Called with params:", {
        response: params.response.substring(0, 100),
        customerId,
        workspaceId,
      })
      let { response, linkType = "auto", context = "auto" } = params

      if (!customerId || !workspaceId) {
        return { success: false, response }
      }

      // 🚨 NORMALIZE WRONG TOKENS - LLM sometimes writes wrong patterns
      // Convert all wrong variations to correct token format
      const wrongProfilePatterns = [
        /\[link profilo\]/gi,
        /\[link profile\]/gi,
        /\[profilo link\]/gi,
        /\[profile link\]/gi,
        /link profilo/gi,
        /link profile/gi,
      ]
      wrongProfilePatterns.forEach(pattern => {
        if (pattern.test(response)) {
          logger.warn(`⚠️ Found wrong token pattern, normalizing to [LINK_PROFILE_WITH_TOKEN]`)
          response = response.replace(pattern, "[LINK_PROFILE_WITH_TOKEN]")
        }
      })

      const wrongCartPatterns = [
        /\[link carrello\]/gi,
        /\[link cart\]/gi,
        /\[carrello link\]/gi,
        /\[cart link\]/gi,
        /link carrello/gi,
        /link cart/gi,
      ]
      wrongCartPatterns.forEach(pattern => {
        if (pattern.test(response)) {
          logger.warn(`⚠️ Found wrong cart token pattern, normalizing to [LINK_CHECKOUT_WITH_TOKEN]`)
          response = response.replace(pattern, "[LINK_CHECKOUT_WITH_TOKEN]")
        }
      })

      // Active tokens only (deprecated tokens removed)
      // Support both plain [TOKEN] and Markdown (TOKEN) formats
      const hasCartToken = response.includes("LINK_CHECKOUT_WITH_TOKEN")
      const hasProfileToken = response.includes("LINK_PROFILE_WITH_TOKEN")
      const hasRegistrationToken = response.includes(
        "LINK_REGISTRATION_WITH_TOKEN"
      )
      const hasOrderToken = response.includes("LINK_ORDER_WITH_TOKEN")
      if (
        !hasCartToken &&
        !hasOrderToken &&
        !hasRegistrationToken &&
        !hasProfileToken
      ) {
        return {
          success: false,
          error: "Response does not contain any replaceable tokens",
        }
      }

      if (!customerId || !workspaceId) {
        return {
          success: false,
          error: "Missing customerId or workspaceId",
        }
      }

      let replacedResponse = response

      // Handle cart token
      if (hasCartToken) {
        try {
          const {
            SecureTokenService,
          } = require("../../application/services/secure-token.service")
          const secureTokenService = new SecureTokenService()

          const cartToken = await secureTokenService.createToken(
            "cart",
            workspaceId,
            { customerId, workspaceId },
            undefined, // Uses TOKEN_EXPIRATION from env
            undefined,
            undefined,
            undefined,
            customerId
          )

          // Use centralized link generator for cart (which is actually checkout)
          const finalCartLink = await linkGeneratorService.generateCheckoutLink(
            cartToken,
            workspaceId
          )

          // Smart replace: handle multiple formats
          // 1. Markdown with square brackets + trailing punctuation: [text]([LINK_CHECKOUT_WITH_TOKEN]).
          replacedResponse = replacedResponse.replace(
            /\[([^\]]+)\]\(\[LINK_CHECKOUT_WITH_TOKEN\]\)([\.!?,;:]?)/g,
            (match, text, punctuation) =>
              `[${text}](${finalCartLink})${punctuation}`
          )

          // 2. Markdown WITHOUT square brackets + trailing punctuation: [text](LINK_CHECKOUT_WITH_TOKEN).
          replacedResponse = replacedResponse.replace(
            /\[([^\]]+)\]\(LINK_CHECKOUT_WITH_TOKEN\)([\.!?,;:]?)/g,
            (match, text, punctuation) =>
              `[${text}](${finalCartLink})${punctuation}`
          )

          // 3. Plain token with optional punctuation: [LINK_CHECKOUT_WITH_TOKEN]
          replacedResponse = replacedResponse.replace(
            /\[LINK_CHECKOUT_WITH_TOKEN\]([\)\.]?[\.!?,]?)/g,
            (match, suffix) => {
              const cleanSuffix = suffix.replace(/\)/g, "")
              return cleanSuffix
                ? `${finalCartLink}${cleanSuffix}`
                : finalCartLink
            }
          )

          // 4. Bare token: LINK_CHECKOUT_WITH_TOKEN
          replacedResponse = replacedResponse.replace(
            /LINK_CHECKOUT_WITH_TOKEN/g,
            finalCartLink
          )
        } catch (error) {
          logger.error("❌ Error generating cart link:", error)
          replacedResponse = replacedResponse.replace(
            /\[LINK_CHECKOUT_WITH_TOKEN\]/g,
            "Link del carrello non disponibile"
          )
        }
      }

      // Handle profile token
      if (hasProfileToken) {
        try {
          const {
            SecureTokenService,
          } = require("../../application/services/secure-token.service")
          const secureTokenService = new SecureTokenService()

          const profileToken = await secureTokenService.createToken(
            "profile",
            workspaceId,
            { customerId, workspaceId },
            undefined, // Uses TOKEN_EXPIRATION from env
            undefined,
            undefined,
            undefined,
            customerId
          )

          // Use centralized link generator
          const finalProfileLink =
            await linkGeneratorService.generateProfileLink(
              profileToken,
              workspaceId
            )

          // Smart replace: handle multiple formats
          // 1. Markdown with square brackets + trailing punctuation: [text]([LINK_PROFILE_WITH_TOKEN]).
          replacedResponse = replacedResponse.replace(
            /\[([^\]]+)\]\(\[LINK_PROFILE_WITH_TOKEN\]\)([\.!?,;:]?)/g,
            (match, text, punctuation) =>
              `[${text}](${finalProfileLink})${punctuation}`
          )

          // 2. Markdown WITHOUT square brackets + trailing punctuation: [text](LINK_PROFILE_WITH_TOKEN).
          replacedResponse = replacedResponse.replace(
            /\[([^\]]+)\]\(LINK_PROFILE_WITH_TOKEN\)([\.!?,;:]?)/g,
            (match, text, punctuation) =>
              `[${text}](${finalProfileLink})${punctuation}`
          )

          // 3. Plain token with optional punctuation: [LINK_PROFILE_WITH_TOKEN]
          replacedResponse = replacedResponse.replace(
            /\[LINK_PROFILE_WITH_TOKEN\]([\)\.]?[\.!?,]?)/g,
            (match, suffix) => {
              const cleanSuffix = suffix.replace(/\)/g, "")
              return cleanSuffix
                ? `${finalProfileLink}${cleanSuffix}`
                : finalProfileLink
            }
          )

          // 4. Bare token: LINK_PROFILE_WITH_TOKEN
          replacedResponse = replacedResponse.replace(
            /LINK_PROFILE_WITH_TOKEN/g,
            finalProfileLink
          )
        } catch (error) {
          logger.error("❌ Error generating profile link:", error)
          replacedResponse = replacedResponse.replace(
            /\[LINK_PROFILE_WITH_TOKEN\]/g,
            "Link del profilo non disponibile"
          )
        }
      }

      // Handle registration token
      if (hasRegistrationToken) {
        try {
          const {
            SecureTokenService,
          } = require("../../application/services/secure-token.service")
          const secureTokenService = new SecureTokenService()

          const registrationToken = await secureTokenService.createToken(
            "registration",
            workspaceId,
            { customerId, workspaceId },
            undefined,
            undefined,
            undefined,
            undefined,
            customerId
          )

          const finalRegistrationLink =
            await linkGeneratorService.generateRegistrationLink(
              registrationToken,
              workspaceId
            )

          replacedResponse = replacedResponse.replace(
            /\[([^\]]+)\]\(\[LINK_REGISTRATION_WITH_TOKEN\]\)([\.!?,;:]?)/g,
            (match, text, punctuation) =>
              `[${text}](${finalRegistrationLink})${punctuation}`
          )

          replacedResponse = replacedResponse.replace(
            /\[([^\]]+)\]\(LINK_REGISTRATION_WITH_TOKEN\)([\.!?,;:]?)/g,
            (match, text, punctuation) =>
              `[${text}](${finalRegistrationLink})${punctuation}`
          )

          replacedResponse = replacedResponse.replace(
            /\[LINK_REGISTRATION_WITH_TOKEN\]([\)\.]?[\.!?,]?)/g,
            (match, suffix) => {
              const cleanSuffix = suffix.replace(/\)/g, "")
              return cleanSuffix
                ? `${finalRegistrationLink}${cleanSuffix}`
                : finalRegistrationLink
            }
          )

          replacedResponse = replacedResponse.replace(
            /LINK_REGISTRATION_WITH_TOKEN/g,
            finalRegistrationLink
          )
        } catch (error) {
          logger.error("❌ Error generating registration link:", error)
          replacedResponse = replacedResponse.replace(
            /\[LINK_REGISTRATION_WITH_TOKEN\]/g,
            "Link di registrazione non disponibile"
          )
        }
      }

      // Handle order token
      if (hasOrderToken) {
        try {
          const {
            SecureTokenService,
          } = require("../../application/services/secure-token.service")
          const secureTokenService = new SecureTokenService()

          const orderToken = await secureTokenService.createToken(
            "orders",
            workspaceId,
            { customerId, workspaceId },
            undefined,
            undefined,
            undefined,
            undefined,
            customerId
          )

          const finalOrderLink = await linkGeneratorService.generateOrdersLink(
            orderToken,
            workspaceId,
            params.orderCode
          )

          replacedResponse = replacedResponse.replace(
            /\[([^\]]+)\]\(\[LINK_ORDER_WITH_TOKEN\]\)([\.!?,;:]?)/g,
            (match, text, punctuation) =>
              `[${text}](${finalOrderLink})${punctuation}`
          )

          replacedResponse = replacedResponse.replace(
            /\[([^\]]+)\]\(LINK_ORDER_WITH_TOKEN\)([\.!?,;:]?)/g,
            (match, text, punctuation) =>
              `[${text}](${finalOrderLink})${punctuation}`
          )

          replacedResponse = replacedResponse.replace(
            /\[LINK_ORDER_WITH_TOKEN\]([\)\.]?[\.!?,]?)/g,
            (match, suffix) => {
              const cleanSuffix = suffix.replace(/\)/g, "")
              return cleanSuffix
                ? `${finalOrderLink}${cleanSuffix}`
                : finalOrderLink
            }
          )

          replacedResponse = replacedResponse.replace(
            /LINK_ORDER_WITH_TOKEN/g,
            finalOrderLink
          )
        } catch (error) {
          logger.error("❌ Error generating order link:", error)
          replacedResponse = replacedResponse.replace(
            /\[LINK_ORDER_WITH_TOKEN\]/g,
            "Link ordine non disponibile"
          )
        }
      }

      // Handle catalog token (static PDF link with URL shortening)
      // Catalog token no longer supported

      // 🧹 CLEANUP: Remove any LLM-invented URLs (example.com, placeholder URLs)
      // The LLM sometimes generates fake URLs alongside our tokens
      // Pattern matches: (https://example.com/...) or similar invented URLs
      replacedResponse = replacedResponse.replace(
        /\(https?:\/\/example\.com[^\s\)]*\)/gi,
        ""
      )
      // Also clean up any orphaned markdown link syntax with example.com
      replacedResponse = replacedResponse.replace(
        /\[([^\]]*)\]\(https?:\/\/example\.com[^\)]*\)/gi,
        "$1"
      )
      // Clean up double spaces that may result from cleanup
      replacedResponse = replacedResponse.replace(/\s{2,}/g, " ").trim()

      return {
        success: true,
        response: replacedResponse,
        linkType: linkType,
      }
    } catch (error) {
      logger.error("❌ LinkReplacementService error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}

// Export singleton instance for backward compatibility
export const linkReplacementService = new LinkReplacementService()

// Export legacy function name for gradual migration
export async function ReplaceLinkWithToken(
  params: ReplaceLinkWithTokenParams,
  customerId: string,
  workspaceId: string
): Promise<ReplaceLinkWithTokenResult> {
  return linkReplacementService.replaceTokens(params, customerId, workspaceId)
}
