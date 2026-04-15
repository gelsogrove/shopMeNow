/**
 * EcommerceWorkspaceStrategy
 * 
 * Routing strategy for e-commerce workspaces (channelMode=ECOMMERCE).
 * 
 * Behavior:
 * - Uses FULL Router LLM with all delegation functions
 * - Can route to: PRODUCT_SEARCH, CART_MANAGEMENT, ORDER_TRACKING, CUSTOMER_SUPPORT, PROFILE_MANAGEMENT
 * - Supports product catalog, cart operations, order tracking, FAQ, notifications
 * - Complete multi-agent system with function calling
 * 
 * Use Case:
 * - E-commerce platforms
 * - Online stores with product catalog
 * - Full shopping experience (browse → cart → checkout → tracking)
 * 
 * @architecture Strategy Pattern implementation
 * @critical Uses existing LLMRouterService.routeMessage() logic
 */

import { AgentType, ChannelMode, PrismaClient, Workspace } from "@echatbot/database"
import logger from "../utils/logger"
import { LLMRouterService } from "../services/llm-router.service"
import type { RoutingContext, RoutingResult, RoutingStrategy } from "./routing-strategy.interface"

export class EcommerceWorkspaceStrategy implements RoutingStrategy {
  private llmRouterService: LLMRouterService

  constructor(private prisma: PrismaClient) {
    this.llmRouterService = new LLMRouterService(prisma)
  }

  /**
   * This strategy handles e-commerce workspaces
   */
  canHandle(workspace: Workspace): boolean {
    return workspace.channelMode === ChannelMode.ECOMMERCE
  }

  /**
   * Check if escalated session has expired and reset if needed
   * E0b - Session Reset Timeout (cross-cutting feature)
   */
  private async checkAndResetExpiredSession(
    context: RoutingContext,
    workspace: Workspace
  ): Promise<void> {
    if (!context.sessionId) {
      return
    }

    // Load chat session
    const chatSession = await this.prisma.chatSession.findUnique({
      where: { id: context.sessionId },
    })

    if (!chatSession || !chatSession.escalatedAt) {
      return // Not escalated, no reset needed
    }

    // Calculate time since escalation
    const now = new Date()
    const timeSinceEscalation = (now.getTime() - chatSession.escalatedAt.getTime()) / 1000 // seconds

    // Check if timeout exceeded
    if (timeSinceEscalation <= workspace.sessionResetTimeout) {
      return // Still within timeout, no reset needed
    }

    logger.info("🔄 E0b - Session reset triggered (escalation timeout exceeded)", {
      workspaceId: workspace.id,
      sessionId: chatSession.id,
      customerId: chatSession.customerId,
      escalatedAt: chatSession.escalatedAt,
      timeoutSeconds: workspace.sessionResetTimeout,
      timeSinceEscalation,
    })

    // ECOMMERCE reset: clear cart + context + escalatedAt
    await this.prisma.$transaction(async (tx) => {
      // 1. Clear cart
      await tx.carts.deleteMany({
        where: {
          customerId: chatSession.customerId,
          workspaceId: workspace.id,
        },
      })

      // 2. Clear context and escalatedAt
      await tx.chatSession.update({
        where: { id: chatSession.id },
        data: {
          context: {},
          escalatedAt: null,
        },
      })
    })

    logger.info("✅ E0b - Session reset completed (cart + context cleared)", {
      workspaceId: workspace.id,
      sessionId: chatSession.id,
    })
  }

  /**
   * Use full Router LLM with all delegation logic
   * Router decides which specialist agent to call based on user intent
   */
  async route(context: RoutingContext, workspace: Workspace): Promise<RoutingResult> {
    const startTime = Date.now()

    logger.info("🛍️ EcommerceWorkspaceStrategy - Using full Router LLM", {
      workspaceId: context.workspaceId,
      customerId: context.customerId,
      message: context.message.substring(0, 50) + "...",
    })

    // E0b - Check and reset expired escalation session
    await this.checkAndResetExpiredSession(context, workspace)

    try {
      // Call existing LLMRouterService.routeMessage() with full delegation logic
      const routerResponse = await this.llmRouterService.routeMessage({
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        conversationId: context.conversationId || `conv_${Date.now()}`,
        messageId: `msg_${Date.now()}`,
        message: context.message,
        customerLanguage: context.customerLanguage,
        customerName: context.customerName,
        isSystemMessage: context.isSystemMessage,
        conversationHistory: [],
      })

      const executionTime = Date.now() - startTime

      logger.info("✅ EcommerceWorkspaceStrategy - Router LLM completed", {
        workspaceId: context.workspaceId,
        agentUsed: routerResponse.agentUsed,
        tokensUsed: routerResponse.tokensUsed,
        executionTimeMs: executionTime,
      })

      // Convert LLMRouter response to RoutingResult format
      return {
        response: routerResponse.response,
        agentType: routerResponse.agentUsed,
        debugSteps: routerResponse.debugInfo?.steps || [],
        totalTokens: routerResponse.tokensUsed,
        conversationId: context.conversationId,
        action: routerResponse.selectedProduct ? {
          type: "ADD_TO_CART",
          product: routerResponse.selectedProduct,
        } : undefined,
      }

    } catch (error) {
      const executionTime = Date.now() - startTime
      logger.error("❌ EcommerceWorkspaceStrategy - Error", {
        workspaceId: context.workspaceId,
        error: error.message,
        executionTimeMs: executionTime,
      })
      throw error
    }
  }
}
