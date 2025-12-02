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

import { config } from "../../config"
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
      const { response, linkType = "auto", context = "auto" } = params

      if (!customerId || !workspaceId) {
        return { success: false, response }
      }

      // Active tokens only (deprecated tokens removed)
      // Support both plain [TOKEN] and Markdown (TOKEN) formats
      const hasCartToken = response.includes("LINK_CHECKOUT_WITH_TOKEN")
      const hasCartConfirmToken = response.includes("LINK_CHECKOUT_CONFIRM")
      const hasProfileToken = response.includes("LINK_PROFILE_WITH_TOKEN")
      const hasCatalogToken = response.includes("LINK_CATALOG")

      if (
        !hasCartToken &&
        !hasCartConfirmToken &&
        !hasProfileToken &&
        !hasCatalogToken
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

      // Handle cart confirm token (checkout with step=confirm parameter)
      if (hasCartConfirmToken) {
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

          // Generate checkout link with step=confirm parameter
          // Note: step parameter expects number (1 or 2), not string
          // TODO: Clarify if "confirm" should be step 3 or remove parameter
          const finalCartConfirmLink =
            await linkGeneratorService.generateCheckoutLink(
              cartToken,
              workspaceId
              // Removed "confirm" parameter - generateCheckoutLink expects number (1 or 2)
            )

          // Smart replace: handle multiple formats (same as LINK_CHECKOUT_WITH_TOKEN)
          // 1. Markdown with square brackets
          replacedResponse = replacedResponse.replace(
            /\[([^\]]+)\]\(\[LINK_CHECKOUT_CONFIRM\]\)([\.!?,;:]?)/g,
            (match, text, punctuation) =>
              `[${text}](${finalCartConfirmLink})${punctuation}`
          )

          // 2. Markdown WITHOUT square brackets
          replacedResponse = replacedResponse.replace(
            /\[([^\]]+)\]\(LINK_CHECKOUT_CONFIRM\)([\.!?,;:]?)/g,
            (match, text, punctuation) =>
              `[${text}](${finalCartConfirmLink})${punctuation}`
          )

          // 3. Plain token with optional punctuation
          replacedResponse = replacedResponse.replace(
            /\[LINK_CHECKOUT_CONFIRM\]([\)\.]?[\.!?,]?)/g,
            (match, suffix) => {
              const cleanSuffix = suffix.replace(/\)/g, "")
              return cleanSuffix
                ? `${finalCartConfirmLink}${cleanSuffix}`
                : finalCartConfirmLink
            }
          )

          // 4. Bare token
          replacedResponse = replacedResponse.replace(
            /LINK_CHECKOUT_CONFIRM/g,
            finalCartConfirmLink
          )
        } catch (error) {
          logger.error("❌ Error generating cart confirm link:", error)
          replacedResponse = replacedResponse.replace(
            /\[LINK_CHECKOUT_CONFIRM\]/g,
            "Link di conferma non disponibile"
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

      // Handle catalog token (static PDF link with URL shortening)
      if (hasCatalogToken) {
        try {
          const catalogUrl =
            "https://laltrait.com/wp-content/uploads/LAltra-Italia-Catalogo-Agosto-2024-v2.pdf"

          // Use centralized link generator to create short URL for catalog
          const finalCatalogLink = await linkGeneratorService.generateShortLink(
            catalogUrl,
            workspaceId
          )

          // Smart replace: handle multiple formats
          // 1. Markdown with square brackets + trailing punctuation: [text]([LINK_CATALOG]).
          replacedResponse = replacedResponse.replace(
            /\[([^\]]+)\]\(\[LINK_CATALOG\]\)([\.!?,;:]?)/g,
            (match, text, punctuation) =>
              `[${text}](${finalCatalogLink})${punctuation}`
          )

          // 2. Markdown WITHOUT square brackets + trailing punctuation: [text](LINK_CATALOG).
          replacedResponse = replacedResponse.replace(
            /\[([^\]]+)\]\(LINK_CATALOG\)([\.!?,;:]?)/g,
            (match, text, punctuation) =>
              `[${text}](${finalCatalogLink})${punctuation}`
          )

          // 3. Plain token with optional punctuation: [LINK_CATALOG]
          replacedResponse = replacedResponse.replace(
            /\[LINK_CATALOG\]([\)\.]?[\.!?,]?)/g,
            (match, suffix) => {
              const cleanSuffix = suffix.replace(/\)/g, "")
              return cleanSuffix
                ? `${finalCatalogLink}${cleanSuffix}`
                : finalCatalogLink
            }
          )

          // 4. Bare token: LINK_CATALOG
          replacedResponse = replacedResponse.replace(
            /LINK_CATALOG/g,
            finalCatalogLink
          )
        } catch (error) {
          logger.error("❌ Error generating catalog link:", error)
          replacedResponse = replacedResponse.replace(
            /\[LINK_CATALOG\]/g,
            "https://laltrait.com/wp-content/uploads/LAltra-Italia-Catalogo-Agosto-2024-v2.pdf"
          )
        }
      }

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
