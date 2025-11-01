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
      const hasCartToken = response.includes("[LINK_CHECKOUT_WITH_TOKEN]")
      const hasProfileToken = response.includes("[LINK_PROFILE_WITH_TOKEN]")
      const hasOrdersToken = response.includes("[LINK_ORDERS_WITH_TOKEN]")
      const hasCatalogToken = response.includes("[LINK_CATALOG]")

      if (
        !hasCartToken &&
        !hasProfileToken &&
        !hasOrdersToken &&
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

          replacedResponse = replacedResponse.replace(
            /\[LINK_CHECKOUT_WITH_TOKEN\]/g,
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

          replacedResponse = replacedResponse.replace(
            /\[LINK_PROFILE_WITH_TOKEN\]/g,
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

      // Handle orders token
      if (hasOrdersToken) {
        try {
          const {
            SecureTokenService,
          } = require("../../application/services/secure-token.service")
          const secureTokenService = new SecureTokenService()

          const ordersToken = await secureTokenService.createToken(
            "orders",
            workspaceId,
            { customerId, workspaceId },
            undefined, // Uses TOKEN_EXPIRATION from env
            undefined,
            undefined,
            undefined,
            customerId
          )

          // If caller provided an orderCode, put it in the path: /orders-public/{orderCode}?token=...
          const orderCodeParam = (params as any).orderCode || undefined
          let ordersLink: string
          if (
            orderCodeParam &&
            typeof orderCodeParam === "string" &&
            orderCodeParam.trim() !== ""
          ) {
            const safeCode = encodeURIComponent(orderCodeParam.trim())
            ordersLink = `${config.frontendUrl}/orders-public/${safeCode}?token=${ordersToken}`
          } else {
            ordersLink = `${config.frontendUrl}/orders-public?token=${ordersToken}`
          }

          // Use centralized link generator
          const finalOrdersLink = await linkGeneratorService.generateOrdersLink(
            ordersToken,
            workspaceId,
            orderCodeParam
          )

          replacedResponse = replacedResponse.replace(
            /\[LINK_ORDERS_WITH_TOKEN\]/g,
            finalOrdersLink
          )
        } catch (error) {
          logger.error("❌ Error generating orders link:", error)
          replacedResponse = replacedResponse.replace(
            /\[LINK_ORDERS_WITH_TOKEN\]/g,
            "Link degli ordini non disponibile"
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

          replacedResponse = replacedResponse.replace(
            /\[LINK_CATALOG\]/g,
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
