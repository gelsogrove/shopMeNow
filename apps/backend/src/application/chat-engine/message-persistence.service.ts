/**
 * Message Persistence Service
 *
 * Handles saving user/assistant messages to conversation history,
 * WebSocket notifications, and enrichment data loading.
 */

import { PrismaClient } from "@echatbot/database"
import logger from "../../utils/logger"
import { ConversationManager } from "../../services/conversation-manager.service"
import { TranslationAgent } from "../agents/TranslationAgent"
import { EnrichmentOptions } from "../response-builder"

export class MessagePersistenceService {
  private conversationManager: ConversationManager
  private translationAgent: TranslationAgent

  constructor(private prisma: PrismaClient) {
    this.conversationManager = new ConversationManager(prisma)
    this.translationAgent = new TranslationAgent(prisma)
  }

  /**
   * Save messages to conversation history
   * Returns assistant message ID for potential translation updates
   */
  async saveMessages(
    workspaceId: string,
    customerId: string,
    conversationId: string,
    userMessage: string,
    assistantMessage: string,
    agentType?: string,
    tokensUsed?: number,
    debugInfo?: any
  ): Promise<{ assistantMessageId?: string }> {
    try {
      // Save user message FIRST
      await this.conversationManager.saveUserMessage({
        workspaceId,
        customerId,
        conversationId,
        content: userMessage,
      })

      // WebSocket: Notify admin dashboard about new customer message
      try {
        const { websocketService } = await import("../../services/websocket.service")
        websocketService.notifyNewMessage(workspaceId, {
          id: `user-${Date.now()}`,
          sessionId: conversationId,
          content: userMessage,
          sender: "customer",
          timestamp: new Date().toISOString(),
          workspaceId,
        })
      } catch (wsError) {
        logger.warn("[WebSocket] Failed to notify new customer message from ChatEngine:", wsError)
      }

      // Create minimal debugInfo if not provided (for FAST-PATH responses)
      const finalDebugInfo = debugInfo || {
        loadedDataType: "FAST_PATH",
        responseType: "FAST_PATH",
        llmUsed: false,
        steps: [{
          type: "router",
          agent: "⚡ Fast Path",
          timestamp: new Date().toISOString(),
          input: { textContent: userMessage.substring(0, 100) },
          output: { textContent: "Response generated via optimized path" },
          duration: 0,
        }],
        totalTokens: tokensUsed || 0,
        totalCost: 0,
        executionTimeMs: 0,
      }

      // Save assistant response with debugInfo for timeline
      const assistantMessageId = await this.conversationManager.saveAssistantMessage({
        workspaceId,
        customerId,
        conversationId,
        content: assistantMessage,
        agentType,
        tokensUsed,
        debugInfo: finalDebugInfo,
      })

      // WebSocket: Notify admin dashboard about assistant response
      try {
        const { websocketService } = await import("../../services/websocket.service")
        websocketService.notifyNewMessage(workspaceId, {
          id: assistantMessageId || `assistant-${Date.now()}`,
          sessionId: conversationId,
          content: assistantMessage,
          sender: "assistant",
          timestamp: new Date().toISOString(),
          workspaceId,
        })
      } catch (wsError) {
        logger.warn("[WebSocket] Failed to notify new assistant message from ChatEngine:", wsError)
      }

      logger.debug("💾 [ChatEngine] Messages saved to history (user + assistant)", {
        hasDebugInfo: true,
        debugStepsCount: finalDebugInfo?.steps?.length || 0,
        wasFastPath: !debugInfo,
        assistantMessageId,
      })

      return { assistantMessageId }
    } catch (error) {
      logger.error("❌ [ChatEngine] Failed to save messages", { error })
      return {}
    }
  }

  /**
   * Build enrichment options for contextual responses
   */
  async buildEnrichmentOptions(
    workspaceId: string,
    customerId: string,
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
  ): Promise<EnrichmentOptions> {
    const enrichmentOptions: EnrichmentOptions = {
      conversationHistory,
      enableClarifyingQuestions: true,
      enableSuggestions: true,
      enablePersonalization: true,
    }

    try {
      const orderStats = await this.prisma.orders.groupBy({
        by: ["customerId"],
        where: {
          customerId,
          workspaceId,
          deletedAt: null,
        },
        _count: { id: true },
        _max: { createdAt: true },
      })

      const customerOrderCount = orderStats[0]?._count.id || 0
      const lastOrderDate = orderStats[0]?._max.createdAt

      let frequentProducts: Array<{ sku: string; name: string; orderCount: number }> = []
      if (customerOrderCount > 0) {
        const frequentProductsRaw = await this.prisma.orderItems.groupBy({
          by: ["productId"],
          where: {
            order: {
              customerId,
              workspaceId,
              deletedAt: null,
            },
          },
          _count: { productId: true },
          orderBy: { _count: { productId: "desc" } },
          take: 5,
        })

        if (frequentProductsRaw.length > 0) {
          const productIds = frequentProductsRaw.map(p => p.productId).filter(Boolean) as string[]
          const products = await this.prisma.products.findMany({
            where: { id: { in: productIds }, isActive: true },
            select: { id: true, sku: true, name: true },
          })

          frequentProducts = frequentProductsRaw
            .map(fp => {
              const product = products.find(p => p.id === fp.productId)
              return product ? {
                sku: product.sku,
                name: product.name,
                orderCount: fp._count.productId,
              } : null
            })
            .filter(Boolean) as Array<{ sku: string; name: string; orderCount: number }>
        }
      }

      enrichmentOptions.customerProfile = {
        isReturningCustomer: customerOrderCount > 0,
        totalOrders: customerOrderCount,
        lastOrderDate: lastOrderDate || undefined,
        frequentProducts: frequentProducts.length > 0 ? frequentProducts : undefined,
      }

      logger.debug("✨ [ChatEngine] Enrichment options built", {
        isReturningCustomer: customerOrderCount > 0,
        totalOrders: customerOrderCount,
        frequentProductsCount: frequentProducts.length,
        historyLength: conversationHistory.length,
      })
    } catch (error) {
      logger.warn("⚠️ [ChatEngine] Could not load enrichment data", { error })
    }

    return enrichmentOptions
  }

  /**
   * Get error message in customer's language
   */
  getErrorMessageByLanguage(language?: string): string {
    const errorMessages: Record<string, string> = {
      it: "Mi scusi, si è verificato un errore. Può riprovare?",
      en: "Sorry, something went wrong. Please try again.",
      es: "Lo siento, algo salió mal. Por favor, inténtelo de nuevo.",
      pt: "Desculpe, algo deu errado. Por favor, tente novamente.",
      fr: "Désolé, quelque chose s'est mal passé. Veuillez réessayer.",
      de: "Entschuldigung, etwas ist schief gelaufen. Bitte versuchen Sie es erneut.",
    }

    return errorMessages[language?.toLowerCase() || "en"] || errorMessages.en
  }

  /**
   * Translate error message through TranslationAgent
   */
  async translateErrorMessage(
    errorMessage: string,
    workspaceId: string,
    targetLanguage: string = "en",
    customerName?: string
  ): Promise<string> {
    try {
      if (!targetLanguage || targetLanguage.toLowerCase() === "en") {
        return errorMessage
      }

      logger.info("[ChatEngine] 🌍 Translating error message", {
        originalLength: errorMessage.length,
        targetLanguage,
      })

      const translated = await this.translationAgent.process({
        workspaceId,
        message: errorMessage,
        targetLanguage: targetLanguage || "en",
        customerName,
      })

      if (translated && translated.message) {
        logger.info("[ChatEngine] ✅ Error message translated successfully")
        return translated.message
      }

      logger.warn("[ChatEngine] ⚠️ TranslationAgent returned null/empty, using fallback")
      return errorMessage
    } catch (translationError) {
      logger.warn("[ChatEngine] ⚠️ Error message translation failed, using fallback", {
        error: translationError instanceof Error ? translationError.message : String(translationError),
        targetLanguage,
      })
      return errorMessage
    }
  }
}
