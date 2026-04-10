import { prisma, PrismaClient } from "@echatbot/database"
// import { getAllProducts } from "../../chatbot/calling-functions/getAllProducts" // REMOVED - file no longer exists
import { MessageRepository } from "../../repositories/message.repository"
import logger from "../../utils/logger"
import { linkGeneratorService } from "./link-generator.service"
import { PriceCalculationService } from "./price-calculation.service"
import { SecureTokenService } from "./secure-token.service"

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
  sku: string
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
      logger.info(
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
      logger.error("❌ Error getting order status:", error)
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
        logger.warn(
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

        logger.info(`🧹 Cleaned up ${orphanedItems.length} orphaned cart items`)
      }
    } catch (error) {
      logger.error("❌ Error cleaning up orphaned cart items:", error)
    }
  }
  private messageRepository: MessageRepository
  private secureTokenService: SecureTokenService
  private priceCalculationService: PriceCalculationService

  // 🆕 DISAMBIGUATION SESSION MANAGEMENT
  private disambiguationSessions: Map<string, DisambiguationSession> = new Map()
  private readonly SESSION_TTL = 5 * 60 * 1000 // 5 minuti in millisecondi

  constructor() {
    this.prisma = prisma
    this.messageRepository = new MessageRepository()
    this.secureTokenService = new SecureTokenService()
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
      logger.info(
        "🔧 [DEBUG] Entering switch statement for functionName:",
        functionName
      )
      switch (functionName) {
        // 🛒 CART OPERATIONS - REMOVED (now handled via web link)

        // 📦 PRODUCT OPERATIONS - GetAllProducts REMOVED (redundant with {{PRODUCTS}} in prompt)

        //  CART LINK
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
        case "getLinkOrderByCode":
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
        case "contactOperator":
          return {
            data: await this.handleContactOperator(
              params,
              customer,
              workspaceId
            ),
            functionName,
          }

        // 🛒 ADD PRODUCT TO CART
        case "addProduct":
          return {
            data: await this.handleAddProduct(params, customer, workspaceId),
            functionName,
          }

        // 🔄 REPEAT ORDER
        case "repeatOrder":
          return {
            data: await this.handleRepeatOrder(params, customer, workspaceId),
            functionName,
          }

        // 📋 GET ORDER DETAILS (Full order info from DB)
        case "getOrderDetails":
          return {
            data: await this.handleGetOrderDetails(
              params,
              customer,
              workspaceId
            ),
            functionName,
          }

        // 🔍 SEARCH PRODUCT (Background Analytics Tracking)
        case "searchProduct":
          return {
            data: await this.handleSearchProduct(params, customer, workspaceId),
            functionName,
          }

        // 📅 APPOINTMENT BOOKING
        case "listAvailableSlots":
          return {
            data: await this.handleListAvailableSlots(params, customer, workspaceId),
            functionName,
          }

        case "bookAppointment":
          return {
            data: await this.handleBookAppointment(params, customer, workspaceId),
            functionName,
          }

        case "cancelAppointment":
          return {
            data: await this.handleCancelAppointment(params, customer, workspaceId),
            functionName,
          }

        case "rescheduleAppointment":
          return {
            data: await this.handleRescheduleAppointment(params, customer, workspaceId),
            functionName,
          }

        case "getCustomerAppointments":
          return {
            data: await this.handleGetCustomerAppointments(params, customer, workspaceId),
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
                "contactOperator",
                "addProduct",
                "repeatOrder",
                "searchProduct",
                "listAvailableSlots",
                "bookAppointment",
                "cancelAppointment",
                "rescheduleAppointment",
                "getCustomerAppointments",
              ],
            },
            functionName,
          }
      }
    } catch (error) {
      logger.error("❌ [DEBUG] Error in handleFunctionCall:", error)
      logger.error("❌ [DEBUG] Error stack:", error.stack)
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
      logger.info("🔧 FunctionHandlerService: handleGetCartLink called")
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

      logger.info("🔧 FunctionHandlerService: getCartLink result:", result)
      return result
    } catch (error) {
      logger.error(
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
      logger.info(
        "🔧 FunctionHandlerService: handleGetLinkOrderByCode called with:",
        params
      )

      // Import the getLinkOrderByCode function
      const {
        getLinkOrderByCode,
      } = require("../../domain/calling-functions/getLinkOrderByCode")

      // Call the getLinkOrderByCode function
      const result = await getLinkOrderByCode({
        customerId: customer?.id || "",
        workspaceId: workspaceId,
        orderCode: params.orderCode || undefined,
        documentType: params.documentType || "order",
        language: params.language || "en",
      })

      logger.info(
        "🔧 FunctionHandlerService: getLinkOrderByCode result:",
        result
      )

      return result
    } catch (error) {
      logger.error(
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

  /**
   * 📋 Gestisce la richiesta di dettagli completi di un ordine
   * Ritorna: codice, stato, data, totale, lista prodotti, documenti disponibili
   */
  async handleGetOrderDetails(
    params: any,
    customer: any,
    workspaceId: string
  ): Promise<any> {
    try {
      logger.info(
        "📋 FunctionHandlerService: handleGetOrderDetails called with:",
        { params, customerId: customer?.id, workspaceId }
      )

      const orderCode = params.orderCode

      if (!orderCode) {
        return {
          success: false,
          error: "Codice ordine non specificato",
          errorType: "missing_order_code",
        }
      }

      if (!customer?.id) {
        return {
          success: false,
          error: "Cliente non trovato",
          errorType: "customer_not_found",
        }
      }

      // Query order with full details
      const order = await this.prisma.orders.findFirst({
        where: {
          orderCode: orderCode,
          workspaceId: workspaceId,
          customerId: customer.id, // Security: customer can only see own orders
        },
        include: {
          customer: {
            select: {
              name: true,
              email: true,
              phone: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  name: true,
                  sku: true,
                },
              },
              service: {
                select: {
                  name: true,
                  code: true, // Services use 'code', not 'serviceCode'
                },
              },
            },
          },
        },
      })

      if (!order) {
        return {
          success: false,
          error: `Ordine ${orderCode} non trovato`,
          errorType: "order_not_found",
        }
      }

      // Map order items from relation (items are OrderItems with product/service relations)
      const orderItems = order.items.map((item, idx) => {
        // Get name from product or service relation
        const itemName = item.product?.name || item.service?.name || "Prodotto"
        const itemCode = item.product?.sku || item.service?.code || null
        
        return {
          index: idx + 1,
          name: itemName,
          quantity: item.quantity || 1,
          price: item.unitPrice || 0,
          totalPrice: item.totalPrice || (item.quantity || 1) * (item.unitPrice || 0),
          sku: itemCode,
          type: item.itemType || "PRODUCT",
        }
      })

      // Calculate status emoji
      const statusEmojis: Record<string, string> = {
        PENDING: "⏳",
        CONFIRMED: "✅",
        PROCESSING: "🔄",
        SHIPPED: "🚚",
        DELIVERED: "📦",
        CANCELLED: "❌",
      }

      // Check for available documents (invoice, credit note)
      const documents: { type: string; label: string; available: boolean }[] = []

      // Invoice is always available for confirmed+ orders
      if (["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status)) {
        documents.push({
          type: "invoice",
          label: "Fattura",
          available: true,
        })
      }

      // Credit note only if exists (check if order has related credit notes)
      const creditNote = await this.prisma.orders.findFirst({
        where: {
          workspaceId: workspaceId,
          customerId: customer.id,
          notes: {
            contains: `NOTA_CREDITO_${order.orderCode}`,
          },
        },
      })

      if (creditNote) {
        documents.push({
          type: "credit_note",
          label: "Nota di Credito",
          available: true,
        })
      }

      // 🔗 Generate secure link to order detail page
      let orderDetailLink = ""
      try {
        const secureTokenService = new SecureTokenService()
        const orderToken = await secureTokenService.createToken(
          "orders",
          workspaceId,
          { customerId: customer.id, workspaceId, orderCode: order.orderCode },
          "1h", // Valid for 1 hour
          undefined,
          customer.phone,
          undefined,
          customer.id
        )
        orderDetailLink = await linkGeneratorService.generateOrdersLink(
          orderToken,
          workspaceId,
          order.orderCode
        )
        logger.info(`📋 Generated order detail link: ${orderDetailLink}`)
      } catch (linkError) {
        logger.error("❌ Error generating order detail link:", linkError)
      }

      const result = {
        success: true,
        order: {
          orderCode: order.orderCode,
          status: order.status,
          statusEmoji: statusEmojis[order.status] || "📦",
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          totalAmount: order.totalAmount,
          subtotalAmount: order.totalAmount - (order.shippingAmount || 0) - (order.taxAmount || 0) + (order.discountAmount || 0),
          shippingAmount: order.shippingAmount || 0,
          taxAmount: order.taxAmount || 0,
          discountAmount: order.discountAmount || 0,
          items: orderItems, // Use mapped items
          itemsCount: orderItems.length,
          trackingNumber: order.trackingNumber || null,
          shippingAddress: order.shippingAddress || null,
          notes: order.notes || null,
          documents: documents,
          orderDetailLink: orderDetailLink, // 🆕 Link to order detail page
        },
        customer: {
          name: order.customer?.name || "Cliente",
        },
      }

      logger.info("📋 FunctionHandlerService: getOrderDetails result:", {
        orderCode: result.order.orderCode,
        itemsCount: result.order.itemsCount,
        totalAmount: result.order.totalAmount,
        documentsCount: result.order.documents.length,
        hasDetailLink: !!orderDetailLink,
      })

      return result
    } catch (error) {
      logger.error(
        "❌ FunctionHandlerService: Error in handleGetOrderDetails:",
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
          sku: product.sku,
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
      logger.info("🔧 FunctionHandlerService: handleContactOperator called")
      // Import the CallingFunctionsService
      const {
        CallingFunctionsService,
      } = require("../../services/calling-functions.service")
      const callingFunctionsService = new CallingFunctionsService()

      // Call the contactOperator function with required phoneNumber parameter
      const result = await callingFunctionsService.contactOperator({
        message: params.message || "",
        phoneNumber: customer?.phone || "", // Ora usiamo phoneNumber
        customerId: customer?.id || "",
        workspaceId: workspaceId,
      })

      logger.info("🔧 contactOperator result:", result)
      return result
    } catch (error) {
      logger.error("❌ Error in handleContactOperator:", error)
      return {
        success: false,
        error: error.message || "Error contacting operator",
        message: "Errore nel contattare l'operatore",
      }
    }
  }

  /**
   * Aggiungi prodotto al carrello
   */
  async handleAddProduct(
    params: any,
    customer: any,
    workspaceId: string
  ): Promise<any> {
    try {
      logger.info(
        "🛒 FunctionHandlerService: handleAddProduct called with:",
        params
      )

      // Validazione parametri
      if (!params.sku || !customer?.id) {
        logger.error("❌ Missing sku or customerId")
        return {
          success: false,
          error: "Parametri richiesti mancanti",
          message: "Impossibile aggiungere il prodotto. Parametri incompleti.",
        }
      }

      // Import the calling function
      const {
        addProduct,
      } = require("../../domain/calling-functions/addProduct")

      const result = await addProduct({
        customerId: customer.id,
        workspaceId: workspaceId,
        sku: params.sku,
        quantity: params.quantity || 1,
        notes: params.notes,
      })

      logger.info("✅ addProduct result:", result)
      return result
    } catch (error) {
      logger.error("❌ Error in handleAddProduct:", error)
      return {
        success: false,
        error: error.message || "Error adding product",
        message: "Impossibile aggiungere il prodotto al carrello.",
      }
    }
  }

  /**
   * Ripeti l'ultimo ordine
   */
  async handleRepeatOrder(
    params: any,
    customer: any,
    workspaceId: string
  ): Promise<any> {
    try {
      logger.info(
        "🔄 FunctionHandlerService: handleRepeatOrder called with:",
        params
      )

      if (!customer?.id) {
        logger.error("❌ Missing customerId")
        return {
          success: false,
          error: "Cliente non trovato",
          message: "Impossibile ripetere l'ordine. Cliente non identificato.",
        }
      }

      // Import the calling function
      const {
        repeatOrder,
      } = require("../../domain/calling-functions/repeatOrder")

      const result = await repeatOrder({
        customerId: customer.id,
        workspaceId: workspaceId,
        orderCode: params.orderCode,
      })

      logger.info("✅ repeatOrder result:", result)
      return result
    } catch (error) {
      logger.error("❌ Error in handleRepeatOrder:", error)
      return {
        success: false,
        error: error.message || "Error repeating order",
        message: "Impossibile ripetere l'ordine.",
      }
    }
  }

  /**
   * 🔍 Handle searchProduct - Background analytics tracking
   * Registers product searches without interrupting LLM response
   */
  async handleSearchProduct(
    params: any,
    customer: any,
    workspaceId: string
  ): Promise<any> {
    try {
      logger.info(
        "🔍 FunctionHandlerService: handleSearchProduct called with:",
        params
      )

      if (!customer?.id) {
        logger.error("❌ Missing customerId")
        return {
          success: false,
          error: "Cliente non trovato",
          message: "Impossibile registrare la ricerca.",
        }
      }

      if (!params.productName) {
        logger.error("❌ Missing productName")
        return {
          success: false,
          error: "Nome prodotto non fornito",
          message: "Impossibile registrare la ricerca.",
        }
      }

      // Import the calling function
      const {
        searchProduct,
      } = require("../../domain/calling-functions/searchProduct")

      const result = await searchProduct({
        customerId: customer.id,
        workspaceId: workspaceId,
        productName: params.productName,
      })

      logger.info("✅ searchProduct result:", result)
      return result
    } catch (error) {
      logger.error("❌ Error in handleSearchProduct:", error)
      return {
        success: false,
        error: error.message || "Error registering search",
        message: "Impossibile registrare la ricerca.",
      }
    }
  }

  // ============================================
  // APPOINTMENT BOOKING HANDLERS
  // ============================================

  private async handleListAvailableSlots(
    params: Record<string, any>,
    customer: any,
    workspaceId: string
  ) {
    try {
      const {
        listAvailableSlots,
      } = require("../../domain/calling-functions/listAvailableSlots")

      return await listAvailableSlots({
        workspaceId,
        customerId: customer.id,
        appointmentTypeId: params.appointmentTypeId,
        daysAhead: params.daysAhead,
        targetDate: params.targetDate,
      })
    } catch (error) {
      logger.error("❌ Error in handleListAvailableSlots:", error)
      return {
        success: false,
        error: error.message || "Error listing available slots",
        message: "Impossibile recuperare gli slot disponibili.",
      }
    }
  }

  private async handleBookAppointment(
    params: Record<string, any>,
    customer: any,
    workspaceId: string
  ) {
    try {
      const {
        bookAppointment,
      } = require("../../domain/calling-functions/bookAppointment")

      return await bookAppointment({
        workspaceId,
        customerId: customer.id,
        appointmentTypeId: params.appointmentTypeId,
        startTime: params.startTime,
        customerNotes: params.customerNotes,
        channel: params.channel,
      })
    } catch (error) {
      logger.error("❌ Error in handleBookAppointment:", error)
      return {
        success: false,
        error: error.message || "Error booking appointment",
        message: "Impossibile prenotare l'appuntamento.",
      }
    }
  }

  private async handleCancelAppointment(
    params: Record<string, any>,
    customer: any,
    workspaceId: string
  ) {
    try {
      const {
        cancelAppointment,
      } = require("../../domain/calling-functions/cancelAppointment")

      return await cancelAppointment({
        workspaceId,
        customerId: customer.id,
        appointmentId: params.appointmentId,
        reason: params.reason,
      })
    } catch (error) {
      logger.error("❌ Error in handleCancelAppointment:", error)
      return {
        success: false,
        error: error.message || "Error cancelling appointment",
        message: "Impossibile annullare l'appuntamento.",
      }
    }
  }

  private async handleGetCustomerAppointments(
    params: Record<string, any>,
    customer: any,
    workspaceId: string
  ) {
    try {
      const {
        getCustomerAppointments,
      } = require("../../domain/calling-functions/getCustomerAppointments")

      return await getCustomerAppointments({
        workspaceId,
        customerId: customer.id,
      })
    } catch (error) {
      logger.error("❌ Error in handleGetCustomerAppointments:", error)
      return {
        success: false,
        error: error.message || "Error getting appointments",
        message: "Impossibile recuperare gli appuntamenti.",
      }
    }
  }

  private async handleRescheduleAppointment(
    params: Record<string, any>,
    customer: any,
    workspaceId: string
  ) {
    try {
      const {
        rescheduleAppointment,
      } = require("../../domain/calling-functions/rescheduleAppointment")

      return await rescheduleAppointment({
        workspaceId,
        customerId: customer.id,
        appointmentId: params.appointmentId,
        newStartTime: params.newStartTime,
        reason: params.reason,
      })
    } catch (error) {
      logger.error("❌ Error in handleRescheduleAppointment:", error)
      return {
        success: false,
        error: error.message || "Error rescheduling appointment",
        message: "Failed to reschedule appointment.",
      }
    }
  }
}
