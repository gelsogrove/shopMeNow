/**
 * Simple Intent Handler (T008)
 * Handles pattern/keyword matched intents deterministically
 */

import logger from "../../../utils/logger"
import { Intent, HandlerResult } from "../../../domain/entities/routing.entity"
import { SimpleIntentHandlerContext } from "../../../domain/entities/handler-context.entity"
import { IntentHandler } from "../../../domain/interfaces/intent-handler.interface"

export class SimpleIntentHandler implements IntentHandler<SimpleIntentHandlerContext> {
  /**
   * Handle simple/deterministic intents
   */
  async handle(
    intent: Intent,
    context: SimpleIntentHandlerContext
  ): Promise<HandlerResult> {
    logger.info("[SimpleIntentHandler] Processing intent", {
      type: intent.type,
      customerId: context.customerId,
    })

    try {
      const response = this.buildResponse(intent, context)

      return {
        message: response.message || "Risposta elaborata",
        agentUsed: "SIMPLE",
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        conversationId: context.conversationId,
        confidence: intent.confidence,
        metadata: {
          intentType: intent.type,
          source: intent.source,
        },
      }
    } catch (error) {
      logger.error("[SimpleIntentHandler] Error processing intent", error)
      throw error
    }
  }

  /**
   * Build response based on intent type
   */
  private buildResponse(intent: Intent, context: SimpleIntentHandlerContext): any {
    switch (intent.type) {
      case "SHOW_PRODUCTS":
        return {
          message: `Ecco i nostri ${(context.loadedData.products || []).length} prodotti`,
          products: context.loadedData.products || [],
        }
      case "ADD_TO_CART":
        return { message: "Prodotto aggiunto al carrello" }
      case "VIEW_CART":
        return { message: "Ecco il tuo carrello" }
      case "REPEAT_ORDER":
        return { message: "Ripeto il tuo ultimo ordine" }
      case "CONTINUE_CHECKOUT":
        return { message: "Procediamo al pagamento" }
      default:
        return { message: "Non riesco a elaborare questa richiesta" }
    }
  }
}
