import { LinkGeneratorService } from "../application/services/link-generator.service"
import { ReplaceLinkWithToken } from "../application/services/link-replacement.service"
import { SecureTokenService } from "../application/services/secure-token.service"
import {
  ErrorResponse,
  GetCartLinkRequest,
  ServicesResponse,
  StandardResponse,
  SuccessResponse,
  TokenResponse,
} from "../types/whatsapp.types"
import logger from "../utils/logger"

export interface GetAllProductsRequest {
  workspaceId: string
  customerId: string
}

export interface GetOrdersListLinkRequest {
  customerId: string
  workspaceId: string
  orderCode?: string
}

export class CallingFunctionsService {
  private secureTokenService: SecureTokenService
  private linkGeneratorService: LinkGeneratorService
  private baseUrl: string

  constructor(linkGeneratorService?: LinkGeneratorService) {
    this.secureTokenService = new SecureTokenService()
    this.linkGeneratorService =
      linkGeneratorService || new LinkGeneratorService()
    this.baseUrl = "http://localhost:3001/api/internal"
  }

  private createErrorResponse(error: any, context: string): ErrorResponse {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred"
    const details = error.response?.data?.message || errorMessage

    logger.error(`❌ ${context} error:`, error)
    return {
      success: false,
      error: errorMessage,
      message: `Unable to ${context.toLowerCase()}. Please try again later.`,
      details: details,
      timestamp: new Date().toISOString(),
    }
  }

  private createSuccessResponse<T>(
    data: T,
    context: string
  ): SuccessResponse<T> {
    logger.info(`✅ ${context} response:`, data)
    return {
      success: true,
      data: data,
      timestamp: new Date().toISOString(),
    }
  }

  public async getServices(
    request: GetAllProductsRequest
  ): Promise<ServicesResponse> {
    try {
      logger.info("🔧 Calling getServices with:", request)
      // Direct database query with Prisma for complete services list
      const { PrismaClient } = require("@prisma/client")
      const prisma = new PrismaClient()

      // Get all services, ordered by name alphabetically
      const services = await prisma.services.findMany({
        where: {
          workspaceId: request.workspaceId,
          isActive: true,
        },
        orderBy: { name: "asc" },
      })

      await prisma.$disconnect()

      if (!services || services.length === 0) {
        return {
          success: false,
          error: "Nessun servizio disponibile",
          message: "Nessun servizio disponibile",
          timestamp: new Date().toISOString(),
        } as ServicesResponse
      }

      logger.info("✅ Services found:", services.length)
      return {
        success: true,
        data: {
          services: services.map((service) => ({
            code: service.code,
            name: service.name,
            description: service.description,
            price: service.price,
            unit: service.unit,
          })),
          totalServices: services.length,
        },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      logger.error("❌ Error in getServices:", error)
      return this.createErrorResponse(error, "getServices") as ServicesResponse
    }
  }

  public async getOrdersListLink(
    request: GetOrdersListLinkRequest
  ): Promise<TokenResponse> {
    try {
      logger.info("🔧 Calling getOrdersListLink with:", request)
      logger.info("🔧 SecureTokenService instance:", !!this.secureTokenService)
      // If orderCode is specified, validate it exists in database
      if (request.orderCode) {
        try {
          logger.info(
            "🔍 Checking if order exists in database:",
            request.orderCode
          )

          // Import Prisma client
          const { PrismaClient } = require("@prisma/client")
          const prisma = new PrismaClient()

          // Query the database for the order
          const order = await prisma.orders.findFirst({
            where: {
              orderCode: request.orderCode,
              workspaceId: request.workspaceId,
            },
          })

          await prisma.$disconnect()

          if (!order) {
            logger.info("❌ Order not found in database:", request.orderCode)
            return {
              success: false,
              error: `Ordine non trovato`,
              message: `Ordine non trovato`,
              timestamp: new Date().toISOString(),
            } as TokenResponse
          }

          logger.info("✅ Order found in database:", request.orderCode)
        } catch (dbError) {
          logger.info("❌ Database error while checking order:", dbError)
          return {
            success: false,
            error: `Ordine non trovato`,
            message: `Ordine non trovato`,
            timestamp: new Date().toISOString(),
          } as TokenResponse
        }
      }

      logger.info("🔧 About to create token...")
      const token = await this.secureTokenService.createToken(
        "orders",
        request.workspaceId,
        { customerId: request.customerId },
        undefined, // Uses TOKEN_EXPIRATION from env
        undefined,
        undefined,
        undefined,
        request.customerId
      )
      logger.info("🔧 Token created successfully:", token)

      // Use the injected linkGeneratorService instance
      const linkUrl = await this.linkGeneratorService.generateOrdersLink(
        token,
        request.workspaceId,
        request.orderCode
      )

      return {
        success: true,
        token: token,
        linkUrl: linkUrl,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        action: "orders",
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return this.createErrorResponse(
        error,
        "getOrdersListLink"
      ) as TokenResponse
    }
  }

  public async getCartLink(
    request: GetCartLinkRequest
  ): Promise<TokenResponse> {
    try {
      logger.info("🔧 Calling getCartLink with:", request)
      logger.info("🔧 About to create token...")
      const token = await this.secureTokenService.createToken(
        "cart",
        request.workspaceId,
        { customerId: request.customerId },
        undefined, // Uses TOKEN_EXPIRATION from env
        undefined,
        undefined,
        undefined,
        request.customerId
      )
      logger.info("🔧 Token created successfully:", token)

      // Use the injected linkGeneratorService instance
      // FR-13: Pass step parameter to generateCheckoutLink
      const linkUrl = await this.linkGeneratorService.generateCheckoutLink(
        token,
        request.workspaceId,
        request.step // Pass step parameter (undefined if not provided)
      )

      return {
        success: true,
        token: token,
        linkUrl: linkUrl,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        action: "cart",
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return this.createErrorResponse(error, "getCartLink") as TokenResponse
    }
  }

  public async getProfileLink(
    request: GetCartLinkRequest
  ): Promise<TokenResponse> {
    try {
      logger.info("🔧 Calling getProfileLink with:", request)
      logger.info("🔧 About to create token...")
      const token = await this.secureTokenService.createToken(
        "profile",
        request.workspaceId,
        { customerId: request.customerId },
        undefined, // Uses TOKEN_EXPIRATION from env
        undefined,
        undefined,
        undefined,
        request.customerId
      )
      logger.info("🔧 Token created successfully:", token)
      // Use centralized link generator for consistent URL shortening
      const {
        linkGeneratorService,
      } = require("../application/services/link-generator.service")

      const linkUrl = await linkGeneratorService.generateProfileLink(
        token,
        request.workspaceId
      )

      return {
        success: true,
        token: token,
        linkUrl: linkUrl,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        action: "profile",
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return this.createErrorResponse(error, "getProfileLink") as TokenResponse
    }
  }

  public async contactOperator(request: {
    customerId: string
    workspaceId: string
    phoneNumber: string
  }): Promise<StandardResponse> {
    try {
      logger.info("🔧 Calling ContactOperator with:", request)
      // Import the ContactOperator function
      const {
        ContactOperator,
      } = require("../domain/calling-functions/ContactOperator")

      const result = await ContactOperator({
        phoneNumber: request.phoneNumber, // 🎯 CORRETTO: phoneNumber invece di phone
        workspaceId: request.workspaceId,
        customerId: request.customerId, // 🎯 AGGIUNTO: customerId se disponibile
      })

      logger.info("✅ ContactOperator result:", result)
      
      // 📧 Se il Summary Agent è stato eseguito, loggalo per il debug timeline
      if (result.summaryAgentExecuted) {
        logger.info("📧 Summary Agent executed successfully for email notification", {
          ticketId: result.ticketId,
          emailSent: result.summaryEmailSent,
          timestamp: result.timestamp
        })
      }
      
      return {
        success: true,
        message:
          result.message ||
          "Certo, verrà contattato il prima possibile dal nostro operatore.",
        timestamp: new Date().toISOString(),
        // 🔧 Passa le informazioni del Summary Agent per il debug
        summaryAgentExecuted: result.summaryAgentExecuted,
        summaryEmailSent: result.summaryEmailSent,
        ticketId: result.ticketId
      }
    } catch (error) {
      logger.error("❌ Error in contactOperator:", error)
      return {
        success: false,
        message:
          "Si è verificato un errore nel contattare l'operatore. Riprova più tardi.",
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Manage push notification subscription (SUBSCRIBE/UNSUBSCRIBE)
   * Priority: 4.5 (between addProduct and searchProduct)
   * @param request - Request with action, customerId, workspaceId
   * @returns StandardResponse with confirmation message
   */
  public async manageNotifications(request: {
    action: "SUBSCRIBE" | "UNSUBSCRIBE"
    customerId: string
    workspaceId: string
  }): Promise<StandardResponse> {
    try {
      logger.info("🔔 Calling ManageNotifications with:", request)

      // Import the ManageNotifications function
      const {
        ManageNotifications,
      } = require("../domain/calling-functions/ManageNotifications")

      const result = await ManageNotifications({
        action: request.action,
        customerId: request.customerId,
        workspaceId: request.workspaceId,
      })

      logger.info("✅ ManageNotifications result:", result)

      return {
        success: result.success,
        message: result.message,
        timestamp: new Date().toISOString(),
        data: {
          action: result.action,
          currentStatus: result.currentStatus,
        },
      }
    } catch (error) {
      logger.error("❌ Error in manageNotifications:", error)
      return {
        success: false,
        message:
          "An error occurred while updating your notification preferences. Please try again later.",
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Delegate to Product and Services Agent
   * This triggers a sub-agent call in the LLM orchestration layer
   */
  public async productSearchAgent(request: {
    query: string
    customerId: string
    workspaceId: string
  }): Promise<StandardResponse> {
    try {
      logger.info("🔍 Router delegating to Product and Services Agent:", request)

      // This function is called by Router Agent to delegate to Product and Services Agent
      // The actual delegation happens in llm-router.service.ts
      // We return a signal that tells the router to call the sub-agent
      return {
        success: true,
        message: `DELEGATE_TO_AGENT:PRODUCT_SEARCH:${request.query}`,
        timestamp: new Date().toISOString(),
        data: {
          agentType: "PRODUCT_SEARCH",
          query: request.query,
        },
      }
    } catch (error) {
      logger.error("❌ Error in productSearchAgent:", error)
      return {
        success: false,
        message: "Error delegating to Product and Services Agent",
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Delegate to Cart Management Agent
   * This triggers a sub-agent call in the LLM orchestration layer
   */
  public async cartManagementAgent(request: {
    query: string
    customerId: string
    workspaceId: string
  }): Promise<StandardResponse> {
    try {
      logger.info("🛒 Router delegating to Cart Management Agent:", request)

      return {
        success: true,
        message: `DELEGATE_TO_AGENT:CART_MANAGEMENT:${request.query}`,
        timestamp: new Date().toISOString(),
        data: {
          agentType: "CART_MANAGEMENT",
          query: request.query,
        },
      }
    } catch (error) {
      logger.error("❌ Error in cartManagementAgent:", error)
      return {
        success: false,
        message: "Error delegating to Cart Management Agent",
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Delegate to Order Tracking Agent
   * This triggers a sub-agent call in the LLM orchestration layer
   */
  public async orderTrackingAgent(request: {
    query: string
    customerId: string
    workspaceId: string
  }): Promise<StandardResponse> {
    try {
      logger.info("📦 Router delegating to Order Tracking Agent:", request)

      return {
        success: true,
        message: `DELEGATE_TO_AGENT:ORDER_TRACKING:${request.query}`,
        timestamp: new Date().toISOString(),
        data: {
          agentType: "ORDER_TRACKING",
          query: request.query,
        },
      }
    } catch (error) {
      logger.error("❌ Error in orderTrackingAgent:", error)
      return {
        success: false,
        message: "Error delegating to Order Tracking Agent",
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Delegate to Customer Support Agent
   * This triggers a sub-agent call in the LLM orchestration layer
   */
  public async customerSupportAgent(request: {
    query: string
    customerId: string
    workspaceId: string
  }): Promise<StandardResponse> {
    try {
      logger.info("💬 Router delegating to Customer Support Agent:", request)

      return {
        success: true,
        message: `DELEGATE_TO_AGENT:CUSTOMER_SUPPORT:${request.query}`,
        timestamp: new Date().toISOString(),
        data: {
          agentType: "CUSTOMER_SUPPORT",
          query: request.query,
        },
      }
    } catch (error) {
      logger.error("❌ Error in customerSupportAgent:", error)
      return {
        success: false,
        message: "Error delegating to Customer Support Agent",
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Replace [LINK_WITH_TOKEN] with generated link
   */
  public async replaceLinkWithToken(
    response: string,
    linkType: string = "auto",
    customerId: string,
    workspaceId: string
  ): Promise<StandardResponse> {
    try {
      logger.info("🔧 Calling replaceLinkWithToken with:", {
        response,
        linkType,
        customerId,
        workspaceId,
      })

      const result = await ReplaceLinkWithToken(
        { response, linkType: linkType as any },
        customerId,
        workspaceId
      )

      if (result.success) {
        return {
          success: true,
          message: result.response || response,
          timestamp: new Date().toISOString(),
        }
      } else {
        return {
          success: false,
          error: result.error || "Failed to replace link token",
          message: response, // Return original response if replacement fails
          timestamp: new Date().toISOString(),
        }
      }
    } catch (error) {
      return this.createErrorResponse(
        error,
        "replaceLinkWithToken"
      ) as StandardResponse
    }
  }

  /**
   * Aggiungi prodotto al carrello
   */
  public async addProductToCart(request: {
    customerId: string
    workspaceId: string
    productCode: string
    quantity: number
    notes?: string
  }): Promise<any> {
    try {
      logger.info("🛒 Calling addProductToCart with:", request)
      const { PrismaClient } = require("@prisma/client")
      const prisma = new PrismaClient()

      try {
        // Trova il cliente
        const customer = await prisma.customers.findFirst({
          where: {
            id: request.customerId,
            workspaceId: request.workspaceId,
          },
        })

        if (!customer) {
          logger.error("❌ Customer not found in addProductToCart")
          return {
            success: false,
            error: "Cliente non trovato",
            message: "Non riesco a trovare il tuo account.",
            timestamp: new Date().toISOString(),
          }
        }

        // Trova il prodotto per productCode o per nome (fallback)
        // Prima prova con productCode esatto
        let product = await prisma.products.findFirst({
          where: {
            productCode: request.productCode,
            workspaceId: request.workspaceId,
            isActive: true,
          },
        })

        // Se non trovato per ProductCode, cerca per nome (case-insensitive)
        if (!product) {
          logger.info(
            `🔍 ProductCode not found, searching by name: ${request.productCode}`
          )
          product = await prisma.products.findFirst({
            where: {
              name: {
                contains: request.productCode,
                mode: "insensitive",
              },
              workspaceId: request.workspaceId,
              isActive: true,
            },
          })
        }

        if (!product) {
          logger.error("❌ Product not found:", request.productCode)
          return {
            success: false,
            error: "Prodotto non trovato",
            message: `Il prodotto "${request.productCode}" non è disponibile.`,
            timestamp: new Date().toISOString(),
          }
        }

        // Verifica stock disponibile
        if (product.stock < request.quantity) {
          logger.error(
            `❌ Insufficient stock for product ${request.productCode}. Available: ${product.stock}, Requested: ${request.quantity}`
          )
          return {
            success: false,
            error: "Stock insufficiente",
            message: `Purtroppo disponibili solo ${product.stock} unità di "${product.name}".`,
            timestamp: new Date().toISOString(),
          }
        }

        // Trova o crea il carrello del cliente
        let cart = await prisma.carts.findFirst({
          where: {
            customerId: request.customerId,
            workspaceId: request.workspaceId,
          },
        })

        if (!cart) {
          cart = await prisma.carts.create({
            data: {
              customerId: request.customerId,
              workspaceId: request.workspaceId,
            },
          })
          logger.info("✅ Created new cart for customer:", request.customerId)
        }

        // Controlla se il prodotto è già nel carrello
        const existingCartItem = await prisma.cartItems.findFirst({
          where: {
            cartId: cart.id,
            productId: product.id,
          },
        })

        if (existingCartItem) {
          // Se esiste già, aggiorna la quantità
          await prisma.cartItems.update({
            where: { id: existingCartItem.id },
            data: {
              quantity: existingCartItem.quantity + request.quantity,
            },
          })
          logger.info(
            "✅ Updated existing cart item for product:",
            request.productCode
          )
        } else {
          // Altrimenti, crea un nuovo item
          await prisma.cartItems.create({
            data: {
              cartId: cart.id,
              productId: product.id,
              quantity: request.quantity,
              itemType: "PRODUCT",
              notes: request.notes || "",
            },
          })
          logger.info("✅ Added product to cart:", request.productCode)
        }

        // Genera token per accesso al carrello
        const token = await this.secureTokenService.createToken(
          "cart",
          request.workspaceId,
          { customerId: request.customerId },
          undefined,
          undefined,
          undefined,
          undefined,
          request.customerId
        )

        // Genera short URL del carrello
        // FR-13: AddProduct always uses step=2 (skip cart review, go to address)
        const {
          linkGeneratorService,
        } = require("../application/services/link-generator.service")
        const cartUrl = await linkGeneratorService.generateCheckoutLink(
          token,
          request.workspaceId,
          2 // FR-13: Skip cart review step
        )

        await prisma.$disconnect()

        // 🔧 IMPORTANTE: Non usare placeholder nel message - usa il cartUrl REALE
        // L'AI deve vedere il link diretto, non [LINK_CHECKOUT_WITH_TOKEN]
        return {
          success: true,
          message: `✅ Ho aggiunto ${request.quantity} x "${product.name}" al carrello!\n\n🛒 Vedi il tuo carrello: ${cartUrl}\n\n⏰ Link valido per 15 minuti`,
          productName: product.name,
          quantity: request.quantity,
          cartCode: cart.id,
          cartUrl: cartUrl, // ✅ L'AI deve usare QUESTO campo per costruire la risposta
          token: token,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error("❌ Error in addProductToCart database operations:", error)
        await prisma.$disconnect()
        throw error
      }
    } catch (error) {
      logger.error("❌ Error in addProductToCart:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore interno",
        message: "Impossibile aggiungere il prodotto al carrello.",
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Aggiungi servizio al carrello
   * Feature 123 - M1: AddService support
   */
  public async addServiceToCart(request: {
    customerId: string
    workspaceId: string
    serviceCode: string
    quantity: number
    notes?: string
  }): Promise<any> {
    try {
      logger.info("🛠️ Calling addServiceToCart with:", request)
      const { PrismaClient } = require("@prisma/client")
      const prisma = new PrismaClient()

      try {
        // Trova il cliente
        const customer = await prisma.customers.findFirst({
          where: {
            id: request.customerId,
            workspaceId: request.workspaceId,
          },
        })

        if (!customer) {
          logger.error("❌ Customer not found in addServiceToCart")
          return {
            success: false,
            error: "Cliente non trovato",
            message: "Non riesco a trovare il tuo account.",
            timestamp: new Date().toISOString(),
          }
        }

        // Trova il servizio per serviceCode o per nome (fallback)
        let service = await prisma.services.findFirst({
          where: {
            code: request.serviceCode,
            workspaceId: request.workspaceId,
            isActive: true,
          },
        })

        // Se non trovato per code, cerca per nome (case-insensitive)
        if (!service) {
          logger.info(
            `🔍 ServiceCode not found, searching by name: ${request.serviceCode}`
          )
          service = await prisma.services.findFirst({
            where: {
              name: {
                contains: request.serviceCode,
                mode: "insensitive",
              },
              workspaceId: request.workspaceId,
              isActive: true,
            },
          })
        }

        if (!service) {
          logger.error("❌ Service not found:", request.serviceCode)
          return {
            success: false,
            error: "Servizio non trovato",
            message: `Il servizio "${request.serviceCode}" non è disponibile.`,
            timestamp: new Date().toISOString(),
          }
        }

        // Trova o crea il carrello del cliente
        let cart = await prisma.carts.findFirst({
          where: {
            customerId: request.customerId,
            workspaceId: request.workspaceId,
          },
        })

        if (!cart) {
          cart = await prisma.carts.create({
            data: {
              customerId: request.customerId,
              workspaceId: request.workspaceId,
            },
          })
          logger.info("✅ Created new cart for customer:", request.customerId)
        }

        // Controlla se il servizio è già nel carrello
        const existingCartItem = await prisma.cartItems.findFirst({
          where: {
            cartId: cart.id,
            serviceId: service.id,
          },
        })

        if (existingCartItem) {
          // Se esiste già, aggiorna la quantità
          await prisma.cartItems.update({
            where: { id: existingCartItem.id },
            data: {
              quantity: existingCartItem.quantity + request.quantity,
            },
          })
          logger.info(
            "✅ Updated existing cart item for service:",
            request.serviceCode
          )
        } else {
          // Altrimenti, crea un nuovo item
          await prisma.cartItems.create({
            data: {
              cartId: cart.id,
              serviceId: service.id,
              quantity: request.quantity,
              itemType: "SERVICE",
              notes: request.notes || "",
            },
          })
          logger.info("✅ Added service to cart:", request.serviceCode)
        }

        // Genera token per accesso al carrello
        const token = await this.secureTokenService.createToken(
          "cart",
          request.workspaceId,
          { customerId: request.customerId },
          undefined,
          undefined,
          undefined,
          undefined,
          request.customerId
        )

        // Genera short URL del carrello
        const {
          linkGeneratorService,
        } = require("../application/services/link-generator.service")
        const cartUrl = await linkGeneratorService.generateCheckoutLink(
          token,
          request.workspaceId,
          2 // Skip cart review step
        )

        await prisma.$disconnect()

        return {
          success: true,
          message: `✅ Ho aggiunto ${request.quantity} x "${service.name}" al carrello!\n\n🛒 Vedi il tuo carrello: ${cartUrl}\n\n⏰ Link valido per 15 minuti`,
          serviceName: service.name,
          quantity: request.quantity,
          cartCode: cart.id,
          cartUrl: cartUrl,
          token: token,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error("❌ Error in addServiceToCart database operations:", error)
        await prisma.$disconnect()
        throw error
      }
    } catch (error) {
      logger.error("❌ Error in addServiceToCart:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore interno",
        message: "Impossibile aggiungere il servizio al carrello.",
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Registra ricerca prodotto per analytics
   */
  public async searchProduct(request: {
    customerId: string
    workspaceId: string
    productName: string
  }): Promise<any> {
    try {
      logger.info("🔍 Calling searchProduct with:", request)
      // Import the SearchProduct function
      const {
        SearchProduct,
      } = require("../domain/calling-functions/SearchProduct")

      const result = await SearchProduct({
        customerId: request.customerId,
        workspaceId: request.workspaceId,
        productName: request.productName,
      })

      logger.info("✅ SearchProduct result:", result)
      return {
        success: true,
        message: result.message || "Ricerca registrata per analytics",
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      logger.error("❌ Error in searchProduct:", error)
      return {
        success: false,
        message: "Errore nel registrare la ricerca.",
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Get specific order details by order ID or code
   */
  public async getOrder(request: {
    customerId: string
    workspaceId: string
    orderId: string
  }): Promise<any> {
    try {
      logger.info("📦 Calling getOrder with:", request)
      const { getOrder } = require("../domain/calling-functions/GetOrder")

      const result = await getOrder({
        customerId: request.customerId,
        workspaceId: request.workspaceId,
        orderId: request.orderId,
      })

      logger.info("✅ GetOrder result:", result)
      return result
    } catch (error) {
      logger.error("❌ Error in getOrder:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Errore nel recupero dell'ordine.",
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Track order shipment status
   */
  public async trackOrder(request: {
    customerId: string
    workspaceId: string
    orderId: string
  }): Promise<any> {
    try {
      logger.info("📍 Calling trackOrder with:", request)
      const { trackOrder } = require("../domain/calling-functions/TrackOrder")

      const result = await trackOrder({
        customerId: request.customerId,
        workspaceId: request.workspaceId,
        orderId: request.orderId,
      })

      logger.info("✅ TrackOrder result:", result)
      return result
    } catch (error) {
      logger.error("❌ Error in trackOrder:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Errore nel tracking dell'ordine.",
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Send invoice PDF via email
   */
  public async sendInvoice(request: {
    customerId: string
    workspaceId: string
    orderId: string
    email?: string
  }): Promise<any> {
    try {
      logger.info("📧 Calling sendInvoice with:", request)
      const { sendInvoice } = require("../domain/calling-functions/SendInvoice")

      const result = await sendInvoice({
        customerId: request.customerId,
        workspaceId: request.workspaceId,
        orderId: request.orderId,
        email: request.email,
      })

      logger.info("✅ SendInvoice result:", result)
      return result
    } catch (error) {
      logger.error("❌ Error in sendInvoice:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Errore nell'invio della fattura.",
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Send security alert email to workspace admins
   */
  public async sendAlertEmail(request: {
    workspaceId: string
    customerId: string
    alertType: string
    messageContent: string
    severity: string
    additionalInfo?: string
  }): Promise<any> {
    try {
      logger.warn("🚨 Calling sendAlertEmail with:", request)
      const {
        sendAlertEmail,
      } = require("../domain/calling-functions/SendAlertEmail")

      const result = await sendAlertEmail({
        workspaceId: request.workspaceId,
        customerId: request.customerId,
        alertType: request.alertType as any,
        messageContent: request.messageContent,
        severity: request.severity as any,
        additionalInfo: request.additionalInfo,
      })

      logger.warn("✅ SendAlertEmail result:", result)
      return result
    } catch (error) {
      logger.error("❌ Error in sendAlertEmail:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Errore nell'invio dell'alert.",
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * 📊 Save product search for analytics (statistics tracking)
   *
   * Called AUTOMATICALLY by ProductSearchAgent every time a user searches for products.
   * Tracks all search attempts (successful or not) for analytics purposes.
   *
   * Data retention: 6 months (cleaned up by scheduler cron job)
   *
   * @param request - Search details with workspaceId, customerId, query
   * @returns Success confirmation
   */
  public async searchProductForStatistics(request: {
    workspaceId: string
    customerId: string
    query: string
  }): Promise<StandardResponse> {
    try {
      const { workspaceId, customerId, query } = request

      logger.info("📊 Saving product search for statistics", {
        workspaceId,
        customerId,
        query: query.substring(0, 50), // Limit log size
      })

      const { PrismaClient } = require("@prisma/client")
      const prisma = new PrismaClient()

      try {
        await prisma.productSearch.create({
          data: {
            workspaceId,
            customerId,
            query: query.trim(),
          },
        })

        logger.info("✅ Product search saved successfully", {
          workspaceId,
          query: query.substring(0, 30),
        })

        return {
          success: true,
          message: `Ricerca "${query.substring(0, 30)}..." registrata per statistiche`,
          timestamp: new Date().toISOString(),
        }
      } finally {
        await prisma.$disconnect()
      }
    } catch (error) {
      logger.error("❌ Error saving product search statistics:", error)

      // Non bloccare il flusso principale - statistiche sono opzionali
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Errore nel salvataggio statistiche (non critico)",
        timestamp: new Date().toISOString(),
      }
    }
  }
}
