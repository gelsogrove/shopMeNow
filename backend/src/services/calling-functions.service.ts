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

export interface GetAllProductsRequest {
  workspaceId: string
  customerId: string
}

export interface GetOrdersListLinkRequest {
  customerId: string
  workspaceId: string
  orderCode?: string
}

export interface GetShipmentTrackingLinkRequest {
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

    console.error(`❌ ${context} error:`, error)

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
    console.log(`✅ ${context} response:`, data)

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
      console.log("🔧 Calling getServices with:", request)

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

      console.log("✅ Services found:", services.length)

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
      console.error("❌ Error in getServices:", error)
      return this.createErrorResponse(error, "getServices") as ServicesResponse
    }
  }

  public async getOrdersListLink(
    request: GetOrdersListLinkRequest
  ): Promise<TokenResponse> {
    try {
      console.log("🔧 Calling getOrdersListLink with:", request)

      console.log("🔧 SecureTokenService instance:", !!this.secureTokenService)

      // If orderCode is specified, validate it exists in database
      if (request.orderCode) {
        try {
          console.log(
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
            console.log("❌ Order not found in database:", request.orderCode)
            return {
              success: false,
              error: `Ordine non trovato`,
              message: `Ordine non trovato`,
              timestamp: new Date().toISOString(),
            } as TokenResponse
          }

          console.log("✅ Order found in database:", request.orderCode)
        } catch (dbError) {
          console.log("❌ Database error while checking order:", dbError)
          return {
            success: false,
            error: `Ordine non trovato`,
            message: `Ordine non trovato`,
            timestamp: new Date().toISOString(),
          } as TokenResponse
        }
      }

      console.log("🔧 About to create token...")
      const token = await this.secureTokenService.createToken(
        "orders",
        request.workspaceId,
        { customerId: request.customerId },
        "1h",
        undefined,
        undefined,
        undefined,
        request.customerId
      )
      console.log("🔧 Token created successfully:", token)

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
      console.log("🔧 Calling getCartLink with:", request)

      console.log("🔧 About to create token...")
      const token = await this.secureTokenService.createToken(
        "cart",
        request.workspaceId,
        { customerId: request.customerId },
        "1h",
        undefined,
        undefined,
        undefined,
        request.customerId
      )
      console.log("🔧 Token created successfully:", token)

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
      console.log("🔧 Calling getProfileLink with:", request)

      console.log("🔧 About to create token...")
      const token = await this.secureTokenService.createToken(
        "profile",
        request.workspaceId,
        { customerId: request.customerId },
        "1h",
        undefined,
        undefined,
        undefined,
        request.customerId
      )
      console.log("🔧 Token created successfully:", token)

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
      console.log("🔧 Calling ContactOperator with:", request)

      // Import the ContactOperator function
      const {
        ContactOperator,
      } = require("../domain/calling-functions/ContactOperator")

      const result = await ContactOperator({
        phoneNumber: request.phoneNumber, // 🎯 CORRETTO: phoneNumber invece di phone
        workspaceId: request.workspaceId,
        customerId: request.customerId, // 🎯 AGGIUNTO: customerId se disponibile
      })

      console.log("✅ ContactOperator result:", result)

      return {
        success: true,
        message:
          result.message ||
          "Certo, verrà contattato il prima possibile dal nostro operatore.",
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error("❌ Error in contactOperator:", error)
      return {
        success: false,
        message:
          "Si è verificato un errore nel contattare l'operatore. Riprova più tardi.",
        timestamp: new Date().toISOString(),
      }
    }
  }

  public async getShipmentTrackingLink(
    request: GetShipmentTrackingLinkRequest
  ): Promise<TokenResponse> {
    try {
      console.log("🔧 Calling getShipmentTrackingLink with:", request)

      // Import the GetShipmentTrackingLink function
      const {
        GetShipmentTrackingLink,
      } = require("../domain/calling-functions/GetShipmentTrackingLink")

      // Call the GetShipmentTrackingLink function
      const result = await GetShipmentTrackingLink({
        customerId: request.customerId,
        workspaceId: request.workspaceId,
        orderCode: request.orderCode || undefined,
      })

      console.log("✅ GetShipmentTrackingLink result:", result)

      return result
    } catch (error) {
      console.error("❌ Error in getShipmentTrackingLink:", error)
      return this.createErrorResponse(
        error,
        "getShipmentTrackingLink"
      ) as TokenResponse
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
      console.log("🔧 Calling replaceLinkWithToken with:", {
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
}
