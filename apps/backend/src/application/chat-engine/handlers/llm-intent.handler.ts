/**
 * LLM Intent Handler (T009)
 * Delegates unknown intents to LLMRouterService
 */

import logger from "../../../utils/logger"
import { Intent, HandlerResult } from "../../../domain/entities/routing.entity"
import { LLMIntentHandlerContext } from "../../../domain/entities/handler-context.entity"
import { IntentHandler } from "../../../domain/interfaces/intent-handler.interface"

export class LLMIntentHandler implements IntentHandler<LLMIntentHandlerContext> {
  constructor(private llmRouterService?: any) {}

  /**
   * Delegate to LLMRouter for specialist processing
   */
  async handle(
    intent: Intent,
    context: LLMIntentHandlerContext
  ): Promise<HandlerResult> {
    logger.info("[LLMIntentHandler] Delegating to LLMRouter", {
      type: intent.type,
      customerId: context.customerId,
    })

    if (!this.llmRouterService) {
      throw new Error("LLMRouterService not injected")
    }

    try {
      // Delegate to LLMRouter for specialist agents
      const result = await this.llmRouterService.routeMessage({
        message: context.message,
        customerId: context.customerId,
        conversationId: context.conversationId,
        workspaceId: context.workspaceId,
        conversationHistory: context.conversationHistory,
      })

      logger.info("[LLMIntentHandler] Response from LLMRouter", {
        agentUsed: result.agentUsed,
      })

      return {
        message: result.message,
        agentUsed: "LLM",
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        conversationId: context.conversationId,
        confidence: intent.confidence,
        metadata: {
          intentType: intent.type,
          source: "LLM",
          delegatedAgent: result.agentUsed,
        },
      }
    } catch (error) {
      logger.error("[LLMIntentHandler] Error delegating to LLMRouter", error)
      throw error
    }
  }
}
