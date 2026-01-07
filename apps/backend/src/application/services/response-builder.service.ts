/**
 * Response Builder Service (T005)
 * Builds structured response objects before LLMFormatter processing
 */

import logger from "../../utils/logger"
import {
  Intent,
  LoadedData,
  RoutingWorkspaceConfig,
} from "../../domain/entities/routing.entity"

export interface StructuredResponse {
  type: string
  data: Record<string, any>
  template?: string
  metadata?: Record<string, any>
}

export class ResponseBuilderService {
  async buildSimpleResponse(
    intent: Intent,
    workspaceConfig: RoutingWorkspaceConfig,
    loadedData: LoadedData
  ): Promise<StructuredResponse> {
    logger.info("[ResponseBuilder] Building simple response", {
      intentType: intent.type,
    })

    switch (intent.type) {
      case "SHOW_PRODUCTS":
        return {
          type: "PRODUCTS_LIST",
          data: {
            products: loadedData.products || [],
            count: (loadedData.products || []).length,
          },
          template: "products_carousel",
        }

      case "ADD_TO_CART":
        return {
          type: "CART_UPDATE",
          data: {
            message: "Prodotto aggiunto al carrello",
          },
          template: "cart_success",
        }

      case "VIEW_CART":
        return {
          type: "CART_CONTENTS",
          data: {
            message: "Ecco il tuo carrello",
          },
          template: "cart_view",
        }

      case "REPEAT_ORDER":
        return {
          type: "ORDER_REPEAT",
          data: {
            message: "Ripeto il tuo ultimo ordine",
          },
          template: "order_repeat",
        }

      case "CONTINUE_CHECKOUT":
        return {
          type: "CHECKOUT_FLOW",
          data: {
            message: "Procediamo al pagamento",
          },
          template: "checkout_start",
        }

      default:
        return {
          type: "UNKNOWN",
          data: {
            message: "Non ho capito, puoi riprovare?",
          },
        }
    }
  }

  async buildErrorResponse(error: string): Promise<StructuredResponse> {
    logger.warn("[ResponseBuilder] Building error response", { error })

    return {
      type: "ERROR",
      data: {
        message: "Scusa, qualcosa è andato storto. Riprova più tardi.",
        error: error,
      },
    }
  }
}
