/**
 * MessageCatalogRepository - Catalog data formatting for LLM prompts
 *
 * Extracted from MessageRepository (God class split).
 * Contains all methods that format products, services, FAQs, offers,
 * categories for prompt injection and data access.
 *
 * @architecture Clean Architecture - Repository Layer
 */
import {
  prisma,
  OrderStatus,
  PrismaClient,
} from "@echatbot/database"
import logger from "../utils/logger"
import { getCurrencySymbol } from "../utils/currency"

/**
 * Apply Unicode strikethrough to text
 * Example: "$6.80" → "$̶6̶.̶8̶0̶"
 * Uses combining long stroke overlay (U+0336)
 */
function applyStrikethrough(text: string): string {
  return text
    .split("")
    .map((char) => char + "\u0336")
    .join("")
}

export class MessageCatalogRepository {
  private prisma: PrismaClient

  constructor() {
    this.prisma = prisma
  }

  /**
   * Recupera le FAQ attive dal database.
   * @param workspaceId L'ID del workspace.
   * @returns Una stringa con le FAQ formattate.
   */
  async getActiveFaqs(workspaceId: string): Promise<string> {
    try {
      const faqs = await this.prisma.fAQ.findMany({
        where: {
          workspaceId: workspaceId,
          isActive: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      })

      if (faqs.length === 0) {
        return "" // Nessuna FAQ attiva
      }

      // Formatta le FAQ come stringa per il prompt
      const formattedFaqs = faqs
        .map((faq) => `D: ${faq.question}\nR: ${faq.answer}`)
        .join("\n\n")

      return `\n\n${formattedFaqs}`
    } catch (error) {
      logger.error("Error fetching active FAQs:", error)
      return "" // In caso di errore, restituisce una stringa vuota
    }
  }

  /**
   * Recupera i servizi attivi dal database e li formatta per il prompt.
   * @param workspaceId L'ID del workspace.
   * @param customerIsActive If false, hides prices (Feature 174 - Rule #4)
   * @returns Una stringa con i servizi formattati in lista numerata.
   */
  async getActiveServices(
    workspaceId: string,
    customerIsActive: boolean = true // 🔒 Feature 174: Control price visibility
  ): Promise<string> {
    try {
      logger.info("🔍 getActiveServices called", { workspaceId, customerIsActive })
      
      const services = await this.prisma.services.findMany({
        where: {
          workspaceId: workspaceId,
          isActive: true,
        },
        orderBy: {
          name: "asc",
        },
      })

      logger.info("🔍 getActiveServices result", { 
        workspaceId, 
        servicesFound: services.length,
        serviceNames: services.map(s => s.name)
      })

      if (services.length === 0) {
        return "" // Nessun servizio attivo
      }

      // Formatta i servizi come lista numerata con tutti i dettagli
      // ✅ Feature 191: Include serviceCode for LLM internal use (not shown to user)
      // LLM uses getServiceDetails(serviceCode) to get internal code for cart operations
      const formattedServices = services
        .map((service, index) => {
          // 🔒 Feature 174: Hide prices for non-registered customers (Rule #4)
          let priceSection = ''
          if (customerIsActive) {
            // Registered customer: show price
            const price = service.price
              ? `${getCurrencySymbol(service.currency || "EUR")}${service.price.toFixed(2)}`
              : "Prezzo da definire"
            priceSection = ` - ${price}`
          } else {
            // Non-registered customer: hide price, show registration prompt
            priceSection = ` | 💳 Registrati per vedere i prezzi: [LINK_REGISTRATION]`
          }
          
          const description = service.description || "Servizio disponibile"

          return [
            `${index + 1}. [${service.code}] **${service.name}**${priceSection}`,
            `   📝 Descrizione: ${description}`,
            `   ⏰ Disponibilità: Sempre disponibile`,
          ].join("\n")
        })
        .join("\n\n")

      return `\n\n${formattedServices}`
    } catch (error) {
      logger.error("Error fetching active services:", error)
      return "" // In caso di errore, restituisce una stringa vuota
    }
  }

  /**
   * Recupera i prodotti attivi dal database e li formatta per il prompt.
   * @param workspaceId L'ID del workspace.
   * @param customerDiscount Sconto del customer (opzionale)
   * @returns Una stringa con i prodotti formattati.
   */
  async getActiveProducts(
    workspaceId: string,
    customerDiscount: number = 0,
    customerIsActive: boolean = true // 🔒 Feature 174: Control price visibility
  ): Promise<string> {
    try {
      const products = await this.prisma.products.findMany({
        where: {
          workspaceId: workspaceId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          description: true,
          formato: true,
          stock: true,
          link: true,
          productCertifications: {
            select: {
              certification: {
                select: {
                  name: true,
                },
              },
            },
          },
          characteristics: {
            select: {
              name: true,
              value: true,
            },
          },
          region: true,
          type: true,
          category: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          category: {
            name: "asc",
          },
        },
      })

      if (products.length === 0) {
        return ""
      }

      // Calcola i prezzi con sconti
      const { PriceCalculationService } = await import(
        "../application/services/price-calculation.service"
      )
      const priceService = new PriceCalculationService(this.prisma)
      const productIds = products.map((p) => p.id)
      const priceResult = await priceService.calculatePricesWithDiscounts(
        workspaceId,
        productIds,
        customerDiscount
      )
      const priceMap = new Map(priceResult.products.map((p) => [p.id, p]))

      // Raggruppa i prodotti per categoria con prezzi scontati
      const productsByCategory = products.reduce(
        (acc, product) => {
          const categoryName = product.category?.name || "Senza Categoria"
          const priceData = priceMap.get(product.id)
          if (!acc[categoryName]) {
            acc[categoryName] = []
          }
          acc[categoryName].push({
            ...product,
            originalPrice: priceData?.originalPrice || product.price,
            finalPrice: priceData?.finalPrice || product.price,
            hasDiscount: (priceData?.appliedDiscount || 0) > 0,
            description: product.description,
          })
          return acc
        },
        {} as Record<string, any[]>
      )

      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { currency: true },
      })
      const currencySymbol = getCurrencySymbol(workspace?.currency || "EUR")

      // Formatta l'output con prezzi scontati - versione compatta per evitare troncamento
      let formattedProducts = ""

      for (const categoryName in productsByCategory) {
        const productList = productsByCategory[categoryName]
        formattedProducts += `\n**${categoryName.toUpperCase()}** (${productList.length} prodotti)\n`

        const productsToShow = productList

        productsToShow.forEach((p) => {
          const formatoStr = p.formato ? ` ${p.formato}` : ""
          
          // 🔒 Feature 174: Hide prices for non-registered customers
          let priceSection = ''
          if (customerIsActive) {
            const finalPrice = Number(p.finalPrice).toFixed(2)
            priceSection = ` - ${currencySymbol}${finalPrice}`
          }
          
          formattedProducts += `• [${p.sku}] ${p.name}${formatoStr}${priceSection}\n`
          
          if (p.link) {
            formattedProducts += `  🔗 Link: ${p.link}\n`
          }
          
          if (p.description) {
            formattedProducts += `  📝 Descrizione: ${p.description}\n`
          }
          
          if (p.characteristics && p.characteristics.length > 0) {
            const charsList = p.characteristics
              .map(c => `${c.name}: ${c.value}`)
              .join(", ")
            formattedProducts += `  🏷️ Caratteristiche: ${charsList}\n`
          }
          
          formattedProducts += "\n"
        })
        formattedProducts += "\n"
      }

      // ✅ Feature 123 - C1: Token count monitoring
      const tokenCount = Math.ceil(formattedProducts.length / 4)
      const tokenLimit = 50000

      logger.info(`📊 {{PRODUCTS}} token estimation`, {
        workspaceId,
        productsCount: products.length,
        charactersCount: formattedProducts.length,
        estimatedTokens: tokenCount,
        tokenLimit,
        utilizationPercent: ((tokenCount / tokenLimit) * 100).toFixed(1),
      })

      if (tokenCount > tokenLimit) {
        logger.warn(
          `⚠️ {{PRODUCTS}} exceeds recommended token limit: ${tokenCount} tokens (limit: ${tokenLimit})`,
          {
            workspaceId,
            productsCount: products.length,
            recommendation:
              "Consider implementing pagination or reducing product count",
          }
        )
      } else if (tokenCount > tokenLimit * 0.8) {
        logger.info(
          `ℹ️ {{PRODUCTS}} approaching token limit: ${tokenCount} tokens (80%+ of ${tokenLimit})`,
          {
            workspaceId,
            productsCount: products.length,
          }
        )
      }

      return formattedProducts
    } catch (error) {
      logger.error("Error fetching active products:", error)
      return ""
    }
  }

  /**
   * Recupera le categorie attive dal database e le formatta per il prompt.
   * Il Translation Layer tradurrà automaticamente nella lingua del cliente.
   * @param workspaceId L'ID del workspace.
   * @returns Una stringa con le categorie formattate in italiano (lingua base).
   */
  async getActiveCategories(workspaceId: string): Promise<string> {
    try {
      const categories = await this.prisma.categories.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: {
          name: "asc",
        },
        include: {
          _count: {
            select: {
              products: {
                where: {
                  isActive: true,
                },
              },
            },
          },
        },
      })

      if (categories.length === 0) return ""

      const formattedCategories = categories
        .map((category, index) => {
          const name = category.name || "Categoria"
          const description = category.description || ""
          const productCount = category._count.products

          const shortDesc = description
            .split(/[.,;]/)[0]
            .substring(0, 80)
            .trim()

          return `${index + 1}. **${name}** (${productCount} prodotti) - ${shortDesc || "Prodotti disponibili"}`
        })
        .join("\n")

      return `\n${formattedCategories}\n`
    } catch (error) {
      logger.error("Error fetching active categories:", error)
      return ""
    }
  }

  /**
   * Recupera le offerte attive dal database e le formatta per il prompt.
   * Il Translation Layer tradurrà automaticamente nella lingua del cliente.
   * @param workspaceId L'ID del workspace.
   * @returns Una stringa con le offerte formattate in italiano (lingua base).
   */
  async getActiveOffers(workspaceId: string): Promise<string> {
    try {
      const now = new Date()

      // Offers expire based on dates only - isActive flag is ignored
      const offers = await this.prisma.offers.findMany({
        where: {
          workspaceId,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: {
          category: true,
        },
        orderBy: {
          discountPercent: "desc",
        },
      })

      if (offers.length === 0) {
        return "" // Nessuna offerta attiva
      }

      const formattedOffers = offers
        .map((offer) => {
          const categoryName = offer.category?.name || "Generale"
          return `Sconto di questo mese: ${offer.discountPercent}% sulla categoria ${categoryName}`
        })
        .join(" • ")

      return `\n${formattedOffers}\n`
    } catch (error) {
      logger.error("Error fetching active offers:", error)
      return "" // In caso di errore, restituisce una stringa vuota
    }
  }

  /**
   * Get all products
   * @param workspaceId Workspace ID to filter by
   * @returns List of products
   */
  async getProducts(workspaceId: string) {
    try {
      if (!workspaceId) {
        logger.error("getProducts: workspaceId is required")
        throw new Error("workspaceId is mandatory for product retrieval")
      }
      const products = await this.prisma.products.findMany({
        where: { workspaceId },
        orderBy: { name: "asc" },
      })
      return products
    } catch (error) {
      logger.error("Error getting products:", error)
      return []
    }
  }

  /**
   * Get all services
   * @param workspaceId Workspace ID to filter by
   * @returns List of services
   */
  async getServices(workspaceId: string) {
    try {
      if (!workspaceId) {
        logger.error("getServices: workspaceId is required")
        throw new Error("workspaceId is mandatory for service retrieval")
      }
      const services = await this.prisma.services.findMany({
        where: { workspaceId },
        orderBy: { name: "asc" },
      })
      return services
    } catch (error) {
      logger.error("Error getting services:", error)
      return []
    }
  }

  /**
   * Get all events
   * @param workspaceId Workspace ID to filter by
   * @returns List of events
   */
  async getEvents(workspaceId?: string) {
    try {
      // Events functionality has been removed from the system
      logger.info("Events functionality has been removed from the system")
      return []
    } catch (error) {
      logger.error("Error getting events:", error)
      return []
    }
  }

  /**
   * Find services with filtering (public method for LangChain)
   */
  public async findServices(
    workspaceId: string,
    options?: {
      category?: string
      limit?: number
      isActive?: boolean
    }
  ) {
    try {
      const whereClause: any = {
        workspaceId,
        isActive: options?.isActive ?? true,
      }

      if (options?.category) {
        whereClause.category = options.category
      }

      return await this.prisma.services.findMany({
        where: whereClause,
        take: options?.limit || 10,
        orderBy: { name: "asc" },
      })
    } catch (error) {
      logger.error("Error finding services:", error)
      return []
    }
  }

  /**
   * Find FAQs with filtering (public method for LangChain)
   */
  public async findFAQs(
    workspaceId: string,
    options?: {
      topic?: string
      limit?: number
      isActive?: boolean
    }
  ) {
    try {
      const whereClause: any = {
        workspaceId,
        isActive: options?.isActive ?? true,
      }

      if (options?.topic) {
        whereClause.OR = [
          { question: { contains: options.topic, mode: "insensitive" } },
          { answer: { contains: options.topic, mode: "insensitive" } },
        ]
      }

      return await this.prisma.fAQ.findMany({
        where: whereClause,
        take: options?.limit || 5,
        orderBy: { createdAt: "desc" },
      })
    } catch (error) {
      logger.error("Error finding FAQs:", error)
      return []
    }
  }

  /**
   * Find offers with filtering (public method for LangChain)
   */
  public async findOffers(
    workspaceId: string,
    options?: {
      category?: string
      limit?: number
      isActive?: boolean
    }
  ) {
    try {
      const now = new Date()
      const whereClause: any = {
        workspaceId,
        isActive: options?.isActive ?? true,
        startDate: { lte: now },
        endDate: { gte: now },
      }

      if (options?.category) {
        whereClause.category = { name: options.category }
      }

      return await this.prisma.offers.findMany({
        where: whereClause,
        include: { category: true },
        take: options?.limit || 10,
        orderBy: { discountPercent: "desc" },
      })
    } catch (error) {
      logger.error("Error finding offers:", error)
      return []
    }
  }

  /**
   * Create order (public method for LangChain)
   */
  public async createOrder(data: {
    customerId: string
    workspaceId: string
    status?: OrderStatus
    totalAmount?: number
  }) {
    try {
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
      let orderCode = ""
      for (let i = 0; i < 5; i++) {
        orderCode += letters.charAt(Math.floor(Math.random() * letters.length))
      }

      return await this.prisma.orders.create({
        data: {
          orderCode: orderCode,
          customerId: data.customerId,
          workspaceId: data.workspaceId,
          status: data.status || OrderStatus.PENDING,
          totalAmount: data.totalAmount || 0,
        },
      })
    } catch (error) {
      logger.error("Error creating order:", error)
      throw new Error("Failed to create order")
    }
  }

  /**
   * Debug function to count active and expired links
   */
  async getLinkCounts(workspaceId: string) {
    try {
      const now = new Date()

      const activeLinksCount = await this.prisma.shortUrls.count({
        where: {
          workspaceId,
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
      })

      const expiredLinksCount = await this.prisma.shortUrls.count({
        where: {
          workspaceId,
          expiresAt: { lt: now },
        },
      })

      const activeTokensCount = await this.prisma.secureToken.count({
        where: {
          workspaceId,
          expiresAt: { gt: now },
        },
      })

      const expiredTokensCount = await this.prisma.secureToken.count({
        where: {
          workspaceId,
          expiresAt: { lt: now },
        },
      })

      return {
        shortUrls: {
          active: activeLinksCount,
          expired: expiredLinksCount,
        },
        secureTokens: {
          active: activeTokensCount,
          expired: expiredTokensCount,
        },
      }
    } catch (error) {
      logger.error("Error getting link counts:", error)
      return {
        shortUrls: { active: 0, expired: 0 },
        secureTokens: { active: 0, expired: 0 },
      }
    }
  }
}
