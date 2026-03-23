/**
 * ProductSearchAgent
 *
 * Specialist agent for product search and discovery.
 *
 * Responsibilities:
 * - Parse customer search queries (keywords, filters, intent)
 * - Search products by category, name, description
 * - Apply filters: price range, allergeni, certificazioni
 * - Format results with images, prices, availability
 * - Handle multilanguage (it/es/en/pt)
 *
 * Flow:
 * 1. Receive context from Router Agent (keywords, filters, language)
 * 2. Search ProductRepository with filters
 * 3. Format results for customer language
 * 4. Return product list with "add to cart" prompts
 *
 * Example Queries:
 * - "cerco formaggi italiani" → Search category "Formaggi"
 * - "productos sin lactosa bajo 20 euros" → Filter by allergen + price
 * - "show me organic vegetables" → Filter by certification + category
 */

import { PrismaClient } from "@echatbot/database"
import { ProductRepository } from "../../repositories/product.repository"
import logger from "../../utils/logger"

export interface ProductSearchContext {
  // From Router Agent
  detectedLanguage: string // it, es, en, pt
  keywords: string[] // ["formaggi", "italiani"]
  filters?: {
    category?: string
    minPrice?: number
    maxPrice?: number
    allergens?: string[] // ["lactose-free", "gluten-free"]
    certifications?: string[] // ["organic", "dop", "igp"]
  }
  urgency?: "low" | "medium" | "high"
}

export interface ProductSearchResult {
  success: boolean
  products: Array<{
    id: string
    name: string
    description: string
    price: number
    currency: string
    category: string
    imageUrl?: string
    available: boolean
    allergens?: string[]
    certifications?: string[]
  }>
  totalFound: number
  message: string // Human-readable response in customer language
}

export class ProductSearchAgent {
  private productRepo: ProductRepository
  private prisma: PrismaClient // ✅ Add prisma for price calculation

  constructor(prisma: PrismaClient) {
    this.prisma = prisma // ✅ Store prisma instance
    this.productRepo = new ProductRepository()
  }

  /**
   * Main entry point: Search products based on context
   *
   * @param workspaceId - Workspace ID (security filter)
   * @param context - Search context from Router Agent
   * @returns Formatted product results
   */
  async search(
    workspaceId: string,
    context: ProductSearchContext,
    customerId?: string // ✅ Optional customerId for discount calculation
  ): Promise<ProductSearchResult> {
    try {
      logger.info(
        `ProductSearchAgent: Searching products for workspace ${workspaceId}, language: ${context.detectedLanguage}`
      )

      // Use ProductRepository instead of direct Prisma access (Clean Architecture)
      const products = await this.productRepo.searchProducts(workspaceId, {
        keywords: context.keywords,
        categoryId: context.filters?.category,
        minPrice: context.filters?.minPrice,
        maxPrice: context.filters?.maxPrice,
        allergens: context.filters?.allergens,
        certifications: context.filters?.certifications,
        limit: 20,
      })

      logger.info(`ProductSearchAgent: Found ${products.length} products`)

      // Format results for customer language WITH DISCOUNT PRICES
      const formattedProducts = await this.formatProducts(
        products,
        context.detectedLanguage,
        workspaceId,
        customerId // ✅ Pass customerId for price calculation
      )

      // Generate human-readable message
      const message = this.generateMessage(
        formattedProducts.length,
        context.detectedLanguage,
        context.keywords
      )

      return {
        success: true,
        products: formattedProducts,
        totalFound: formattedProducts.length,
        message,
      }
    } catch (error) {
      logger.error("ProductSearchAgent error:", error)
      return {
        success: false,
        products: [],
        totalFound: 0,
        message: this.getErrorMessage(context.detectedLanguage),
      }
    }
  }

  /**
   * Format products for customer language WITH DISCOUNT CALCULATION
   */
  private async formatProducts(
    products: any[],
    language: string,
    workspaceId: string,
    customerId?: string
  ) {
    // 💰 STEP 1: Calculate discounted prices if customerId provided
    let priceMap = new Map<
      string,
      { originalPrice: number; finalPrice: number }
    >()

    if (customerId) {
      try {
        // Get customer discount
        const customer = await this.prisma.customers.findUnique({
          where: { id: customerId },
          select: { discount: true },
        })

        const customerDiscount = customer?.discount || 0

        // Calculate prices with discounts
        const { PriceCalculationService } = await import(
          "../services/price-calculation.service"
        )
        const priceService = new PriceCalculationService(this.prisma)
        const productIds = products.map((p) => p.id)
        const priceResult = await priceService.calculatePricesWithDiscounts(
          workspaceId,
          productIds,
          customerDiscount
        )

        // Build price map
        priceMap = new Map(
          priceResult.products.map((p) => [
            p.id,
            { originalPrice: p.originalPrice, finalPrice: p.finalPrice },
          ])
        )

        logger.info(
          `💰 Calculated discounted prices for ${priceMap.size} products`,
          {
            customerDiscount,
          }
        )
      } catch (error) {
        logger.error("Error calculating discounted prices:", error)
        // Continue without discounts
      }
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { currency: true },
    })
    const workspaceCurrency = workspace?.currency || "EUR"

    // STEP 2: Format products with prices
    return products.map((product) => {
      const priceData = priceMap.get(product.id)
      const originalPrice = priceData?.originalPrice || product.price
      const finalPrice = priceData?.finalPrice || product.price

      return {
        id: product.id,
        code: product.sku, // ✅ Include product code
        name: product.name,
        description: product.description || "",
        price: finalPrice, // ✅ Use discounted price
        originalPrice: originalPrice, // ✅ Include original price for comparison
        hasDiscount: originalPrice !== finalPrice, // ✅ Flag if discount applied
        currency: workspaceCurrency,
        category: product.category?.name || "Uncategorized",
        imageUrl: product.image || undefined,
        available: product.stock > 0,
        stock: product.stock || 0, // ✅ Include stock quantity
        allergens: product.allergens || [],
        certifications: product.certifications || [],
      }
    })
  }

  /**
   * Generate human-readable response message
   */
  private generateMessage(
    productCount: number,
    language: string,
    keywords?: string[]
  ): string {
    const keywordStr = keywords ? keywords.join(", ") : ""

    const messages: Record<string, Record<string, string>> = {
      it: {
        found: `Ho trovato ${productCount} ${productCount === 1 ? "prodotto" : "prodotti"}${keywordStr ? ` per "${keywordStr}"` : ""}. Quale ti interessa?`,
        notFound: `Mi dispiace, non ho trovato prodotti${keywordStr ? ` per "${keywordStr}"` : ""}. Vuoi provare con altri termini di ricerca?`,
      },
      es: {
        found: `Encontré ${productCount} ${productCount === 1 ? "producto" : "productos"}${keywordStr ? ` para "${keywordStr}"` : ""}. ¿Cuál te interesa?`,
        notFound: `Lo siento, no encontré productos${keywordStr ? ` para "${keywordStr}"` : ""}. ¿Quieres intentar con otros términos?`,
      },
      en: {
        found: `I found ${productCount} ${productCount === 1 ? "product" : "products"}${keywordStr ? ` for "${keywordStr}"` : ""}. Which one interests you?`,
        notFound: `Sorry, I didn't find any products${keywordStr ? ` for "${keywordStr}"` : ""}. Want to try different search terms?`,
      },
      pt: {
        found: `Encontrei ${productCount} ${productCount === 1 ? "produto" : "produtos"}${keywordStr ? ` para "${keywordStr}"` : ""}. Qual você gostaria?`,
        notFound: `Desculpe, não encontrei produtos${keywordStr ? ` para "${keywordStr}"` : ""}. Quer tentar outros termos?`,
      },
    }

    const lang = messages[language] || messages.it
    return productCount > 0 ? lang.found : lang.notFound
  }

  /**
   * Get error message in customer language
   */
  private getErrorMessage(language: string): string {
    const messages: Record<string, string> = {
      it: "Si è verificato un errore durante la ricerca. Riprova tra poco.",
      es: "Ocurrió un error durante la búsqueda. Inténtalo de nuevo pronto.",
      en: "An error occurred during search. Please try again soon.",
      pt: "Ocorreu um erro durante a pesquisa. Tente novamente em breve.",
    }
    return messages[language] || messages.it
  }
}
