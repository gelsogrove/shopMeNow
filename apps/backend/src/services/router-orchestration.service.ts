/**
 * @deprecated Consolidated into UnifiedRoutingService + Handler Pattern
 * See: apps/backend/src/application/services/unified-routing.service.ts
 * See: apps/backend/src/application/chat-engine/handlers/
 * 
 * Do not use in new code. This service will be removed in next major version.
 * 
 * RouterOrchestrationService (DEPRECATED)
 * 
 * Decides routing strategy based on workspace configuration.
 * Replaces direct IntentParser calls in ChatEngine.
 * 
 * Strategy Selection:
 * - Informational workspaces (sellsProductsAndServices=false) → Always INFO_AGENT
 * - E-commerce workspaces (sellsProductsAndServices=true) → Full Router LLM
 * 
 * This service is the entry point for ALL message routing decisions.
 * 
 * @architecture Clean Architecture with Strategy Pattern
 * @critical ALWAYS filter by workspaceId (multi-tenant security)
 */

import { PrismaClient, Workspace } from "@echatbot/database"
import logger from "../utils/logger"
import { InformationalWorkspaceStrategy } from "../strategies/informational-workspace.strategy"
import { EcommerceWorkspaceStrategy } from "../strategies/ecommerce-workspace.strategy"
import type { RoutingContext, RoutingResult, RoutingStrategy } from "../strategies/routing-strategy.interface"

/**
 * @deprecated Use UnifiedRoutingService instead
 */
export class RouterOrchestrationService {
  private strategies: RoutingStrategy[]

  constructor(private prisma: PrismaClient) {
    // Initialize all available strategies
    this.strategies = [
      new InformationalWorkspaceStrategy(prisma),
      new EcommerceWorkspaceStrategy(prisma),
    ]
  }

  /**
   * Route message using appropriate strategy based on workspace configuration
   * @deprecated Use UnifiedRoutingService.detectIntent() + selectRoutingPath() instead
   */
  async route(context: RoutingContext): Promise<RoutingResult> {
    const startTime = Date.now()

    try {
      // Load workspace configuration
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: context.workspaceId },
      })

      if (!workspace) {
        throw new Error(`Workspace not found: ${context.workspaceId}`)
      }

      // Select appropriate strategy
      const strategy = this.selectStrategy(workspace)

      logger.info("🎯 RouterOrchestrationService - Strategy selected", {
        workspaceId: context.workspaceId,
        sellsProductsAndServices: workspace.sellsProductsAndServices,
        strategyName: strategy.constructor.name,
      })

      // Execute routing with selected strategy
      let result = await strategy.route(context, workspace)

      // 🔧 FIX: Replace [LINK_REGISTRATION] token with actual registration link
      if (result.response.includes("[LINK_REGISTRATION]")) {
        try {
          // Load customer to get phone number and registration status
          const customer = await this.prisma.customers.findFirst({
            where: {
              id: context.customerId,
              workspaceId: context.workspaceId,
            },
            select: { phone: true, isActive: true },
          })

          if (customer?.phone && !customer.isActive) {
            const registrationLink = await this.generateRegistrationLink(
              customer.phone,
              context.workspaceId
            )
            result.response = result.response.replace(/\[LINK_REGISTRATION\]/g, registrationLink)
            logger.info("🔗 [RouterOrchestration] Replaced [LINK_REGISTRATION] with actual link for non-registered user")
          } else if (customer?.isActive) {
            // User is already registered, remove placeholder
            result.response = result.response.replace(/\[LINK_REGISTRATION\]/g, "")
            logger.info("🔗 [RouterOrchestration] Removed [LINK_REGISTRATION] for registered user")
          }
        } catch (error) {
          logger.error("❌ [RouterOrchestration] Error replacing registration link:", error)
          // Keep [LINK_REGISTRATION] token if generation fails
        }
      }

      const executionTime = Date.now() - startTime
      logger.info("✅ RouterOrchestrationService - Routing complete", {
        workspaceId: context.workspaceId,
        agentType: result.agentType,
        totalTokens: result.totalTokens || 0,
        executionTimeMs: executionTime,
        hadRegistrationLink: result.response.includes("http"),
      })

      return result

    } catch (error) {
      const executionTime = Date.now() - startTime
      logger.error("❌ RouterOrchestrationService - Routing failed", {
        workspaceId: context.workspaceId,
        error: error.message,
        executionTimeMs: executionTime,
      })
      throw error
    }
  }

  /**
   * Select routing strategy based on workspace configuration
   */
  private selectStrategy(workspace: Workspace): RoutingStrategy {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(workspace)) {
        return strategy
      }
    }

    // Default fallback: E-commerce strategy
    logger.warn("⚠️ No strategy matched workspace, using E-commerce fallback", {
      workspaceId: workspace.id,
      sellsProductsAndServices: workspace.sellsProductsAndServices,
    })
    return new EcommerceWorkspaceStrategy(this.prisma)
  }

  /**
   * Generate registration link for customer
   * Uses centralized LinkGeneratorService with support for custom registrationPage
   */
  private async generateRegistrationLink(
    phone: string,
    workspaceId: string
  ): Promise<string> {
    try {
      // Import services
      const { TokenService } = require("../application/services/token.service")
      const { LinkGeneratorService } = require("../application/services/link-generator.service")
      const { workspaceService } = require("./workspace.service")

      // Create registration token
      const tokenService = new TokenService()
      const token = await tokenService.createRegistrationToken(phone, workspaceId)

      // Get workspace URL and custom registration page (if configured)
      const { url: workspaceUrl, registrationPage } =
        await workspaceService.getWorkspaceURLWithRegistration(workspaceId)

      // Use centralized link generator service
      const linkGeneratorService = new LinkGeneratorService()
      const registrationLink = await linkGeneratorService.generateRegistrationLink(
        token,
        workspaceUrl,
        workspaceId,
        registrationPage // Pass custom registration page if configured
      )

      logger.info(`📎 [RouterOrchestration] Created registration link: ${registrationLink}`)
      return registrationLink
    } catch (error) {
      logger.error("❌ [RouterOrchestration] Error generating registration link:", error)
      throw error
    }
  }
}
