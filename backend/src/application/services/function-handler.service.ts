import { PrismaClient } from "@prisma/client"
// import { getAllProducts } from "../../chatbot/calling-functions/getAllProducts" // REMOVED - file no longer exists
import { MessageRepository } from "../../repositories/message.repository"
import logger from "../../utils/logger"
import { PriceCalculationService } from "./price-calculation.service"
import { TokenService } from "./token.service"

interface FunctionCallResult {
  data: any
  functionName: string
}

// 🆕 DISAMBIGUATION SYSTEM INTERFACES
interface DisambiguationSession {
  sessionId: string
  customerId: string
  workspaceId: string
  query: string // Query originale "aggiungi vino al carrello"
  action: "add" | "remove" // Azione richiesta
  productQuery: string // "vino"
  quantity: number // 1
  products: ProductOption[] // Prodotti trovati 🔧 RENAMED
  expiresAt: Date // Scade dopo 5 minuti
  createdAt: number // Timestamp creazione
  lastActivity: number // Ultimo accesso
  userQuery: string // Query utente originale
}

interface ProductOption {
  id: string
  name: string
  price: number
  stock: number
  productCode: string
  index: number
  // 🆕 ADDITIONAL FIELDS FOR DISAMBIGUATION
  category?: string
  description?: string
  optionNumber: number
  icon: string
}

interface ParsedProduct {
  name: string
  quantity: number
  modifiers?: string[] // "grande", "piccolo", "bio"
}

interface DisambiguationResult {
  success: boolean
  action: "resolved" | "expired" | "cancelled"
  selectedProduct?: ProductOption
  error?: string
}

/**
 * Service per gestire le chiamate di funzione dal function router
 */
export class FunctionHandlerService {
  private prisma: PrismaClient
  private callingFunctionsService: any

  /**
   * Handle get order status request
   */
  private async handleGetOrderStatus(
    phoneNumber: string,
    workspaceId: string,
    customerId: string,
    orderId?: string
  ): Promise<any> {
    try {
      console.log(
        `🔍 FunctionHandler: Getting order status for customer ${customerId}, orderId: ${orderId}`
      )

      // Find customer
      const customer = await this.prisma.customers.findFirst({
        where: {
          phone: phoneNumber,
          workspaceId: workspaceId,
        },
      })

      if (!customer) {
        return {
          success: false,
          response:
            "Mi dispiace, non riesco a trovare il tuo account. Contatta il nostro supporto per assistenza.",
          error: "Customer not found",
        }
      }

      // Get orders for this customer
      const orders = await this.prisma.orders.findMany({
        where: {
          customerId: customer.id,
          workspaceId: workspaceId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5, // Last 5 orders
        select: {
          id: true,
          orderCode: true,
          status: true,
          totalAmount: true,
          createdAt: true,
        },
      })

      if (orders.length === 0) {
        return {
          success: true,
          response:
            "Non hai ancora effettuato ordini. Quando farai il tuo primo ordine, potrai controllarne lo stato qui!",
          orders: [],
        }
      }

      // Format orders for display
      const ordersList = orders
        .map(
          (order) =>
            `📦 Ordine ${order.orderCode} - ${order.status} - €${order.totalAmount} (${order.createdAt.toLocaleDateString("it-IT")})`
        )
        .join("\n")

      return {
        success: true,
        response: `Ecco i tuoi ordini recenti:\n\n${ordersList}\n\nPer maggiori dettagli su un ordine specifico, fammi sapere il codice ordine!`,
        orders: orders,
      }
    } catch (error) {
      console.error("❌ Error getting order status:", error)
      return {
        success: false,
        response:
          "Mi dispiace, si è verificato un errore nel recuperare i tuoi ordini. Riprova più tardi o contatta il supporto.",
        error: error.message,
      }
    }
  }

  /**
   * 🎯 TASK: Clean up orphaned cart items (items with missing products)
   */
  private async cleanupOrphanedCartItems(workspaceId: string): Promise<void> {
    try {
      // Find cart items that reference non-existent products
      const orphanedItems = await this.prisma.cartItems.findMany({
        where: {
          cart: {
            workspaceId: workspaceId,
          },
          product: null,
        },
        include: {
          cart: true,
        },
      })

      if (orphanedItems.length > 0) {
        console.warn(
          `🧹 Found ${orphanedItems.length} orphaned cart items in workspace ${workspaceId}`
        )

        // Delete orphaned items
        await this.prisma.cartItems.deleteMany({
          where: {
            id: {
              in: orphanedItems.map((item) => item.id),
            },
          },
        })

        console.log(`🧹 Cleaned up ${orphanedItems.length} orphaned cart items`)
      }
    } catch (error) {
      console.error("❌ Error cleaning up orphaned cart items:", error)
    }
  }
  private messageRepository: MessageRepository
  private tokenService: TokenService
  private priceCalculationService: PriceCalculationService

  // 🆕 DISAMBIGUATION SESSION MANAGEMENT
  private disambiguationSessions: Map<string, DisambiguationSession> = new Map()
  private readonly SESSION_TTL = 5 * 60 * 1000 // 5 minuti in millisecondi

  constructor() {
    this.prisma = new PrismaClient()
    this.messageRepository = new MessageRepository()
    this.tokenService = new TokenService()
    this.priceCalculationService = new PriceCalculationService(this.prisma)
    this.callingFunctionsService =
      require("../../services/calling-functions.service").default

    // Auto-cleanup sessioni scadute ogni ora
    setInterval(() => this.cleanExpiredSessions(), 60 * 60 * 1000)
  }

  /**
   * Gestisce una chiamata di funzione in base al nome e ai parametri
   * @param functionName Nome della funzione da chiamare
   * @param params Parametri per la funzione
   * @param customer Informazioni sul cliente
   * @param workspaceId ID del workspace
   * @param phoneNumber Numero di telefono del cliente
   * @returns Risultato della chiamata di funzione
   */
  async handleFunctionCall(
    functionName: string,
    params: any,
    customer: any,
    workspaceId: string,
    phoneNumber: string
  ): Promise<FunctionCallResult> {
    logger.info(
      `🎯 FunctionHandlerService: Chiamata ricevuta per ${functionName}`,
      {
        functionName,
        params,
        customerId: customer?.id,
        workspaceId,
        phoneNumber,
      }
    )

    try {
      console.log(
        "🔧 [DEBUG] Entering switch statement for functionName:",
        functionName
      )
      switch (functionName) {
        // 🛒 CART OPERATIONS - REMOVED (now handled via web link)

        // 📦 PRODUCT OPERATIONS - GetAllProducts REMOVED (redundant with {{PRODUCTS}} in prompt)

        // 🚚 SHIPMENT TRACKING
        case "getShipmentTrackingLink":
          return {
            data: await this.handleGetShipmentTrackingLink(
              params,
              customer,
              workspaceId
            ),
            functionName,
          }

        // 🛒 CART LINK
        case "GetCartLink":
          return {
            data: await this.handleGetCartLink(customer, workspaceId),
            functionName,
          }

        case "get_all_categories":
          return {
            functionName,
            data: null, // No data needed for this function
          }

        case "get_order_status":
          return {
            data: await this.handleGetOrderStatus(
              phoneNumber,
              workspaceId,
              customer?.id,
              params.order_id
            ),
            functionName,
          }

        case "search_products":
          return {
            data: await this.searchProducts(params.query, workspaceId),
            functionName,
          }

        // 🔗 ORDER LINK
        case "GetLinkOrderByCode":
          return {
            data: await this.handleGetLinkOrderByCode(
              params,
              customer,
              workspaceId
            ),
            functionName,
          }

        // 🚚 ORDER OPERATIONS & 🛒 CART OPERATIONS (REMOVED)
        // case 'confirm_order':
        //   return {
        //         ...params
        //       }),
        //       functionName
        //     }

        // 📄 DOCUMENTATION & FAQ
        case "search_documents":
          return {
            data: await this.searchDocuments(params.query, workspaceId),
            functionName,
          }

        case "get_faq_info":
          return {
            data: await this.getFaqInfo(params.question, workspaceId),
            functionName,
          }

        //  CONTACT OPERATOR
        case "ContactOperator":
          return {
            data: await this.handleContactOperator(
              params,
              customer,
              workspaceId
            ),
            functionName,
          }

        // 🎯 DEFAULT CASE
        default:
          logger.warn(`⚠️ Funzione non riconosciuta: ${functionName}`)
          return {
            data: {
              success: false,
              error: `Funzione ${functionName} non supportata`,
              supportedFunctions: [
                "confirm_order",
                "generateCartLink",
                "get_all_products",
                "get_all_categories",
                "search_products",
                "search_documents",
                "get_faq_info",
                "ContactOperator",
              ],
            },
            functionName,
          }
      }
    } catch (error) {
      console.error("❌ [DEBUG] Error in handleFunctionCall:", error)
      console.error("❌ [DEBUG] Error stack:", error.stack)
      logger.error(
        `❌ Errore in handleFunctionCall per ${functionName}:`,
        error
      )
      return {
        data: {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Errore interno del server",
          errorType: "internal_error",
        },
        functionName,
      }
    }
  }

  // =============================================================================
  // 🛒 CART LINK METHODS
  // =============================================================================

  /**
   * Gestisce la richiesta di link al carrello
   */
  async handleGetCartLink(customer: any, workspaceId: string): Promise<any> {
    try {
      console.log("🔧 FunctionHandlerService: handleGetCartLink called")

      // Import the CallingFunctionsService
      const {
        CallingFunctionsService,
      } = require("../../services/calling-functions.service")
      const callingFunctionsService = new CallingFunctionsService()

      // Call the getCartLink function
      const result = await callingFunctionsService.getCartLink({
        customerId: customer?.id || "",
        workspaceId: workspaceId,
      })

      console.log("🔧 FunctionHandlerService: getCartLink result:", result)

      return result
    } catch (error) {
      console.error(
        "❌ FunctionHandlerService: Error in handleGetCartLink:",
        error
      )
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Errore interno del server",
        errorType: "internal_error",
      }
    }
  }

  // =============================================================================
  // 🔗 ORDER LINK METHODS
  // =============================================================================

  /**
   * Gestisce la richiesta di link ordine intelligente
   */
  async handleGetLinkOrderByCode(
    params: any,
    customer: any,
    workspaceId: string
  ): Promise<any> {
    try {
      console.log(
        "🔧 FunctionHandlerService: handleGetLinkOrderByCode called with:",
        params
      )

      // Import the GetLinkOrderByCode function
      const {
        GetLinkOrderByCode,
      } = require("../../domain/calling-functions/GetLinkOrderByCode")

      // Call the GetLinkOrderByCode function
      const result = await GetLinkOrderByCode({
        customerId: customer?.id || "",
        workspaceId: workspaceId,
        orderCode: params.orderCode || undefined,
        documentType: params.documentType || "order",
        language: params.language || "it",
      })

      console.log(
        "🔧 FunctionHandlerService: GetLinkOrderByCode result:",
        result
      )

      return result
    } catch (error) {
      console.error(
        "❌ FunctionHandlerService: Error in handleGetLinkOrderByCode:",
        error
      )
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Errore interno del server",
        errorType: "internal_error",
      }
    }
  }

  // =============================================================================
  // 🚚 SHIPMENT TRACKING METHODS
  // =============================================================================

  /**
   * Gestisce la richiesta di tracking della spedizione
   */
  async handleGetShipmentTrackingLink(
    params: any,
    customer: any,
    workspaceId: string
  ): Promise<any> {
    try {
      console.log(
        "🔧 FunctionHandlerService: handleGetShipmentTrackingLink called with:",
        params
      )

      // Import the CallingFunctionsService
      const {
        CallingFunctionsService,
      } = require("../../services/calling-functions.service")
      const callingFunctionsService = new CallingFunctionsService()

      // Call the getShipmentTrackingLink function
      const result = await callingFunctionsService.getShipmentTrackingLink({
        customerId: customer?.id || "",
        workspaceId: workspaceId,
        orderCode: params.order_code || undefined,
      })

      console.log(
        "🔧 FunctionHandlerService: getShipmentTrackingLink result:",
        result
      )

      return result
    } catch (error) {
      console.error(
        "❌ FunctionHandlerService: Error in handleGetShipmentTrackingLink:",
        error
      )
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Errore interno del server",
        errorType: "internal_error",
      }
    }
  }

  // =============================================================================
  // 🛒 CART METHODS
  // =============================================================================

  /**
   * Aggiunge un prodotto al carrello (versione semplice)
   */

  /**
   * Rimuove un prodotto dal carrello
   */
  async searchProducts(query: string, workspaceId: string): Promise<any> {
    try {
      const products = await this.prisma.products.findMany({
        where: {
          workspaceId,
          isActive: true,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 10,
      })

      return {
        success: true,
        products: products.map((product) => ({
          id: product.id,
          name: product.name,
          price: product.price,
          description: product.description,
          stock: product.stock,
          productCode: product.ProductCode,
        })),
        query,
        totalFound: products.length,
      }
    } catch (error) {
      logger.error("❌ Errore in searchProducts:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore interno",
      }
    }
  }

  // =============================================================================
  // 📄 DOCUMENTATION METHODS
  // =============================================================================

  /**
   * Cerca nei documenti
   */
  async searchDocuments(query: string, workspaceId: string): Promise<any> {
    logger.warn("⚠️  searchDocuments called but RAG feature is disabled")
    return {
      success: false,
      error: "RAG/Documents feature not available",
      results: [],
    }
  }

  /**
   * Ottiene informazioni FAQ
   */
  async getFaqInfo(question: string, workspaceId: string): Promise<any> {
    try {
      const faqs = await this.prisma.fAQ.findMany({
        where: {
          workspaceId,
          isActive: true, // ✅ Only return active FAQs
          OR: [
            { question: { contains: question, mode: "insensitive" } },
            { answer: { contains: question, mode: "insensitive" } },
          ],
        },
        take: 5,
      })

      return {
        success: true,
        faqs: faqs.map((faq) => ({
          id: faq.id,
          question: faq.question,
          answer: faq.answer,
        })),
        query: question,
      }
    } catch (error) {
      logger.error("❌ Errore in getFaqInfo:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore interno",
      }
    }
  }

  // =============================================================================
  // 🧹 UTILITY METHODS
  // =============================================================================

  /**
   * Pulisce le sessioni di disambiguazione scadute
   */
  private cleanExpiredSessions(): void {
    const now = Date.now()
    for (const [sessionId, session] of this.disambiguationSessions.entries()) {
      if (now - session.lastActivity > this.SESSION_TTL) {
        this.disambiguationSessions.delete(sessionId)
        logger.info(`🧹 Sessione scaduta rimossa: ${sessionId}`)
      }
    }
  }

  /**
   * Genera un saluto basato sull'ora del giorno
   */
  getTimeBasedGreeting(language: string = "it"): string {
    const hour = new Date().getHours()

    if (language === "en") {
      if (hour < 12) return "Good morning!"
      if (hour < 18) return "Good afternoon!"
      return "Good evening!"
    }

    // Default italiano
    if (hour < 12) return "Buongiorno!"
    if (hour < 18) return "Buon pomeriggio!"
    return "Buonasera!"
  }

  /**
   * Calcola il prezzo personalizzato per il cliente
   */
  async calculateCustomerPrice(
    basePrice: number,
    customerId: string | null = null
  ): Promise<number> {
    if (!customerId) {
      return basePrice
    }

    try {
      const customer = await this.prisma.customers.findUnique({
        where: { id: customerId },
      })

      if (!customer) {
        logger.warn(`⚠️ Cliente non trovato: ${customerId}`)
        return basePrice
      }

      // Applica eventuali sconti personalizzati
      const discountPercent = customer.discount || 0
      return basePrice * (1 - discountPercent / 100)
    } catch (error) {
      logger.error("❌ Errore nel calcolo prezzo cliente:", error)
      return basePrice
    }
  }

  /**
   * Handle contact operator request
   */
  async handleContactOperator(
    params: any,
    customer: any,
    workspaceId: string
  ): Promise<any> {
    try {
      console.log("🔧 FunctionHandlerService: handleContactOperator called")

      // Import the CallingFunctionsService
      const {
        CallingFunctionsService,
      } = require("../../services/calling-functions.service")
      const callingFunctionsService = new CallingFunctionsService()

      // Call the ContactOperator function with required phoneNumber parameter
      const result = await callingFunctionsService.ContactOperator({
        message: params.message || "",
        phoneNumber: customer?.phone || "", // Ora usiamo phoneNumber
        customerId: customer?.id || "",
        workspaceId: workspaceId,
      })

      console.log("🔧 ContactOperator result:", result)
      return result
    } catch (error) {
      console.error("❌ Error in handleContactOperator:", error)
      return {
        success: false,
        error: error.message || "Error contacting operator",
        message: "Errore nel contattare l'operatore",
      }
    }
  }

  /**
   * Ottiene l'icona del prodotto
   */
  getProductIcon(productType: any): string {
    // Implementazione base
    return "📦"
  }
}
