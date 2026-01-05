/**
 * EcommerceWorkspaceStrategy
 * 
 * Routing strategy for e-commerce workspaces (sellsProductsAndServices=true).
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

import { AgentType, PrismaClient, Workspace } from "@echatbot/database"
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
    return workspace.sellsProductsAndServices === true
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
