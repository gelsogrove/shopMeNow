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

      const hasCartToken = response.includes("[LINK_CHECKOUT_WITH_TOKEN]")
      const hasProfileToken = response.includes("[LINK_PROFILE_WITH_TOKEN]")
      const hasOrdersToken = response.includes("[LINK_ORDERS_WITH_TOKEN]")
      const hasTrackingToken = response.includes("[LINK_TRACKING_WITH_TOKEN]")
      const hasCheckoutToken = response.includes("[LINK_CHECKOUT_WITH_TOKEN]")
      const hasCatalogToken = response.includes("[LINK_CATALOG]")
      const hasUserDiscountToken = response.includes("[USER_DISCOUNT]")
      const hasListOffersToken = response.includes("[LIST_OFFERS]")
      const hasListActiveOffersToken = response.includes("[LIST_ACTIVE_OFFERS]")
      // [LIST_ALL_PRODUCTS] is handled by GetAllProducts() in FormatterService, not here
      const hasListServicesToken = response.includes("[LIST_SERVICES]")
      const hasListCategoriesToken = response.includes("[LIST_CATEGORIES]")

      if (
        !hasCartToken &&
        !hasProfileToken &&
        !hasOrdersToken &&
        !hasTrackingToken &&
        !hasCheckoutToken &&
        !hasCatalogToken &&
        !hasUserDiscountToken &&
        !hasListOffersToken &&
        !hasListActiveOffersToken &&
        !hasListServicesToken &&
        !hasListCategoriesToken
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

      // Handle tracking token
      if (hasTrackingToken) {
        try {
          const {
            SecureTokenService,
          } = require("../../application/services/secure-token.service")
          const secureTokenService = new SecureTokenService()

          const trackingToken = await secureTokenService.createToken(
            "orders",
            workspaceId,
            { customerId, workspaceId },
            undefined, // Uses TOKEN_EXPIRATION from env
            undefined,
            undefined,
            undefined,
            customerId
          )

          // Use centralized link generator
          const finalTrackingLink =
            await linkGeneratorService.generateTrackingLink(
              trackingToken,
              workspaceId
            )

          replacedResponse = replacedResponse.replace(
            /\[LINK_TRACKING_WITH_TOKEN\]/g,
            finalTrackingLink
          )
        } catch (error) {
          logger.error("❌ Error generating tracking link:", error)
          replacedResponse = replacedResponse.replace(
            /\[LINK_TRACKING_WITH_TOKEN\]/g,
            "Link di tracking non disponibile"
          )
        }
      }

      // Handle checkout token
      if (hasCheckoutToken) {
        try {
          const {
            SecureTokenService,
          } = require("../../application/services/secure-token.service")
          const secureTokenService = new SecureTokenService()

          const checkoutToken = await secureTokenService.createToken(
            "checkout",
            workspaceId,
            { customerId, workspaceId },
            undefined, // Uses TOKEN_EXPIRATION from env
            undefined,
            undefined,
            undefined,
            customerId
          )

          // Use centralized link generator
          const finalCheckoutLink =
            await linkGeneratorService.generateCheckoutLink(
              checkoutToken,
              workspaceId
            )

          replacedResponse = replacedResponse.replace(
            /\[LINK_CHECKOUT_WITH_TOKEN\]/g,
            finalCheckoutLink
          )
        } catch (error) {
          logger.error("❌ Error generating checkout link:", error)
          replacedResponse = replacedResponse.replace(
            /\[LINK_CHECKOUT_WITH_TOKEN\]/g,
            "Link di checkout non disponibile"
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

      // Handle discount, offers, services and categories tokens (LIST_ALL_PRODUCTS handled by GetAllProducts in FormatterService)
      if (
        hasUserDiscountToken ||
        hasListOffersToken ||
        hasListActiveOffersToken ||
        hasListServicesToken ||
        hasListCategoriesToken
      ) {
        let userDiscount = "0%"
        if (hasUserDiscountToken) {
          try {
            const { PrismaClient } = require("@prisma/client")
            const prisma = new PrismaClient()

            const customer = await prisma.customers.findFirst({
              where: {
                id: customerId,
                workspaceId: workspaceId,
              },
              select: {
                id: true,
                name: true,
                discount: true,
              },
            })

            if (customer && customer.discount > 0) {
              userDiscount = `${customer.discount}%`
            } else {
              userDiscount = "0%"
            }

            await prisma.$disconnect()
          } catch (error) {
            logger.error("❌ Error getting customer discount:", error)
            userDiscount = "0%"
          }
        }

        let listOffers = "Nessuna offerta attiva al momento"
        let listActiveOffers = "Nessuna offerta attiva al momento"
        // listAllProducts removed - handled by GetAllProducts in FormatterService
        let listServices = "Nessun servizio disponibile al momento"
        let listCategories = "Nessuna categoria disponibile al momento"

        if (hasListCategoriesToken) {
          try {
            const { PrismaClient } = require("@prisma/client")
            const prisma = new PrismaClient()

            const categories = await prisma.categories.findMany({
              where: {
                workspaceId: workspaceId,
              },
              select: {
                name: true,
                description: true,
              },
              take: 10,
            })

            if (categories.length > 0) {
              listCategories = categories
                .map(
                  (category) =>
                    `• ${category.name}${category.description ? ` - ${category.description}` : ""}`
                )
                .join("\n")
            } else {
              listCategories = "Nessuna categoria disponibile al momento"
            }

            await prisma.$disconnect()
          } catch (error) {
            logger.error("❌ Error getting categories:", error)
            listCategories = "Nessuna categoria disponibile al momento"
          }
        }

        if (hasListServicesToken) {
          try {
            const { PrismaClient } = require("@prisma/client")
            const prisma = new PrismaClient()

            const services = await prisma.services.findMany({
              where: {
                workspaceId: workspaceId,
              },
              select: {
                name: true,
                description: true,
                price: true,
                currency: true,
              },
              take: 5,
            })

            if (services.length > 0) {
              listServices = services
                .map(
                  (service) =>
                    `• ${service.name}: ${service.price} ${service.currency} - ${service.description}`
                )
                .join("\n")
            } else {
              listServices = "Nessun servizio disponibile al momento"
            }

            await prisma.$disconnect()
          } catch (error) {
            logger.error("❌ Error getting services:", error)
            listServices = "Nessun servizio disponibile al momento"
          }
        }

        // [LIST_ALL_PRODUCTS] token removed - handled by GetAllProducts in FormatterService

        if (hasListActiveOffersToken) {
          try {
            const { PrismaClient } = require("@prisma/client")
            const prisma = new PrismaClient()

            // Get active offers
            const activeOffers = await prisma.offers.findMany({
              where: {
                workspaceId: workspaceId,
                isActive: true,
                startDate: { lte: new Date() },
                endDate: { gte: new Date() },
              },
              select: {
                name: true,
                description: true,
                discountPercent: true,
              },
              take: 5,
            })

            if (activeOffers.length > 0) {
              listActiveOffers = activeOffers
                .map(
                  (offer) =>
                    `• ${offer.name}: ${offer.discountPercent}% di sconto - ${offer.description}`
                )
                .join("\n")
            } else {
              listActiveOffers = "Nessuna offerta attiva al momento"
            }

            await prisma.$disconnect()
          } catch (error) {
            logger.error("❌ Error getting active offers:", error)
            listActiveOffers = "Nessuna offerta attiva al momento"
          }
        }

        if (hasListOffersToken) {
          try {
            const { PrismaClient } = require("@prisma/client")
            const prisma = new PrismaClient()

            // Get offers (default behavior)
            const activeOffers = await prisma.offers.findMany({
              where: {
                workspaceId: workspaceId,
                isActive: true,
                startDate: { lte: new Date() },
                endDate: { gte: new Date() },
              },
              select: {
                name: true,
                description: true,
                discountPercent: true,
              },
              take: 3,
            })

            if (activeOffers.length > 0) {
              listOffers = activeOffers
                .map((offer) => `• ${offer.name}`)
                .join("\n")
            } else {
              listOffers = "Nessuna offerta attiva al momento"
            }

            await prisma.$disconnect()
          } catch (error) {
            logger.error("❌ Error getting data:", error)
            listOffers =
              context === "services"
                ? "Nessun servizio disponibile al momento"
                : "Nessuna offerta attiva al momento"
          }
        }

        replacedResponse = replacedResponse
          .replace(/\[USER_DISCOUNT\]/g, userDiscount)
          .replace(/\[LIST_OFFERS\]/g, listOffers)
          .replace(/\[LIST_ACTIVE_OFFERS\]/g, listActiveOffers)
          // [LIST_ALL_PRODUCTS] handled by GetAllProducts in FormatterService
          .replace(/\[LIST_SERVICES\]/g, listServices)
          .replace(/\[LIST_CATEGORIES\]/g, listCategories)
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
