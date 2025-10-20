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
  private baseUrl: string

  constructor() {
    this.secureTokenService = new SecureTokenService()
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
      // Use centralized link generator for consistent URL shortening
      const {
        linkGeneratorService,
      } = require("../application/services/link-generator.service")

      let linkUrl: string = await linkGeneratorService.generateOrdersLink(
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
      // Use centralized link generator for consistent URL shortening
      const {
        linkGeneratorService,
      } = require("../application/services/link-generator.service")

      const linkUrl = await linkGeneratorService.generateCheckoutLink(
        token,
        request.workspaceId
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
      return {
        success: true,
        message:
          result.message ||
          "Certo, verrà contattato il prima possibile dal nostro operatore.",
        timestamp: new Date().toISOString(),
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

        // Trova il prodotto per ProductCode
        const product = await prisma.products.findFirst({
          where: {
            ProductCode: request.productCode,
            workspaceId: request.workspaceId,
            isActive: true,
          },
        })

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
        const {
          linkGeneratorService,
        } = require("../application/services/link-generator.service")
        const cartUrl = await linkGeneratorService.generateCheckoutLink(
          token,
          request.workspaceId
        )

        await prisma.$disconnect()

        return {
          success: true,
          message: `✅ Ho aggiunto ${request.quantity} x "${product.name}" al carrello!\n\n🛒 [LINK_CHECKOUT_WITH_TOKEN]\n\n⏰ Link valido per {{TOKEN_DURATION}}`,
          productName: product.name,
          quantity: request.quantity,
          cartCode: cart.id,
          cartUrl: cartUrl,
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
}
