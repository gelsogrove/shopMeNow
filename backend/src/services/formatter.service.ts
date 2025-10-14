/**
 * Formatter Service
 *
 * Simple service with one method that formats responses to Markdown
 */

import { config } from "../config"

export class FormatterService {
  // Cache for translated category names
  private static categoryTranslationCache: Map<string, string> = new Map()

  /**
   * Replaces tokens in the input text with real data from the database
   *
   * NOTE: formatToMarkdown was removed - not needed because LLM already returns markdown
   * NOTE: getCategoryEmoji was removed - categories already have emoji in their description
   */
  static async replaceTokens(
    text: string,
    question: string,
    nameUser: string,
    discount: number,
    customerId: string,
    workspaceId: string,
    language: string
  ): Promise<string> {
    let result = text

    // Handle [LIST_CATEGORIES] token
    if (result.includes("[LIST_CATEGORIES]")) {
      try {
        const {
          CategoryService,
        } = require("../application/services/category.service")
        const categoryService = new CategoryService()
        const categories = await categoryService.getAllForWorkspace(workspaceId)

        if (categories?.length > 0) {
          const translationService =
            new (require("./translation.service").TranslationService)()

          const translatedNames = await Promise.all(
            categories.map(async (category) => {
              const cacheKey = `${workspaceId}:${language}:${category.id}`
              if (this.categoryTranslationCache.has(cacheKey)) {
                return {
                  id: category.id,
                  name: this.categoryTranslationCache.get(cacheKey)!,
                }
              }

              try {
                const translated = await translationService.translateToLanguage(
                  category.name,
                  language
                )
                this.categoryTranslationCache.set(cacheKey, translated)
                return { id: category.id, name: translated }
              } catch (e) {
                return { id: category.id, name: category.name }
              }
            })
          )

          const categoriesList = categories
            .map((category) => {
              const translated =
                translatedNames.find((t: any) => t.id === category.id)?.name ||
                category.name
              // Emoji già inclusa nella descrizione della categoria (vedi seed.ts)
              return `- **${translated}**`
            })
            .join("\n")

          result = result.replace("[LIST_CATEGORIES]", categoriesList)
        }
      } catch (error) {
        console.error("❌ Error replacing [LIST_CATEGORIES]:", error.message)
      }
    }

    // Handle [USER_DISCOUNT] token
    if (result.includes("[USER_DISCOUNT]")) {
      if (discount > 0) {
        result = result.replace("[USER_DISCOUNT]", `${discount}%`)
      } else {
        result = result.replace(
          "[USER_DISCOUNT]",
          "Nessuno sconto attivo al momento 🙏"
        )
      }
    }

    // Handle [LINK_ORDERS_WITH_TOKEN] token
    if (result.includes("[LINK_ORDERS_WITH_TOKEN]")) {
      try {
        const {
          SecureTokenService,
        } = require("../application/services/secure-token.service")
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

        const ordersLink = `${config.frontendUrl}/orders-public?token=${ordersToken}`
        result = result.replace("[LINK_ORDERS_WITH_TOKEN]", ordersLink)
      } catch (error) {
        console.error(
          "❌ Error replacing [LINK_ORDERS_WITH_TOKEN]:",
          error.message
        )
      }
    }

    // Handle [LIST_ALL_PRODUCTS] token - UPDATED: Use prompt data instead of CF
    if (result.includes("[LIST_ALL_PRODUCTS]")) {
      try {
        const {
          MessageRepository,
        } = require("../repositories/message.repository")
        const { PrismaClient } = require("@prisma/client")
        const prisma = new PrismaClient()
        const messageRepo = new MessageRepository(prisma)

        // Get customer discount for price calculation
        const customerDiscount = customerId
          ? (
              await prisma.customers.findUnique({
                where: { id: customerId },
                select: { discount: true },
              })
            )?.discount || 0
          : 0

        const productsData = await messageRepo.getActiveProducts(
          workspaceId,
          customerDiscount
        )

        if (productsData) {
          result = result.replace(/\[LIST_ALL_PRODUCTS\]/g, productsData)
        } else {
          // Always in Italian - Translation Layer will translate
          const fallback = "Nessun prodotto disponibile al momento"
          result = result.replace(/\[LIST_ALL_PRODUCTS\]/g, fallback)
        }
      } catch (error) {
        console.error("❌ Error replacing [LIST_ALL_PRODUCTS]:", error.message)
        // Always in Italian - Translation Layer will translate
        const fallback = "Nessun prodotto disponibile al momento"
        result = result.replace(/\[LIST_ALL_PRODUCTS\]/g, fallback)
      }
    }

    // Handle other tokens using ReplaceLinkWithToken
    const hasOtherTokens = [
      "[LIST_SERVICES]",
      "[LIST_OFFERS]",
      "[LIST_ACTIVE_OFFERS]",
      "[LINK_PROFILE_WITH_TOKEN]",
      "[LINK_CHECKOUT_WITH_TOKEN]",
      "[LINK_TRACKING_WITH_TOKEN]",
    ].some((token) => result.includes(token))

    if (hasOtherTokens) {
      try {
        const {
          ReplaceLinkWithToken,
        } = require("../application/services/link-replacement.service")

        let detectedOrderCode: string | undefined = undefined
        try {
          const parsedResp = JSON.parse(result)
          if (parsedResp?.orderCode) {
            detectedOrderCode = parsedResp.orderCode
          }
        } catch (e) {
          // Not JSON, ignore
        }

        const replaceResult = await ReplaceLinkWithToken(
          { response: result, orderCode: detectedOrderCode },
          customerId,
          workspaceId
        )

        if (replaceResult.success && replaceResult.response) {
          result = replaceResult.response
        }
      } catch (error) {
        console.error("❌ Error replacing other tokens:", error.message)
      }
    }

    return result
  }
}
