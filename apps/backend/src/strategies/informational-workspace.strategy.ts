/**
 * InformationalWorkspaceStrategy
 * 
 * Routing strategy for informational workspaces (sellsProductsAndServices=false).
 * 
 * Behavior:
 * - ALWAYS routes to CUSTOMER_SUPPORT agent
 * - CUSTOMER_SUPPORT agent has FAQ system enabled
 * - No product catalog, cart, or order functionality
 * - Simple routing: Customer question → FAQ/Support agent
 * 
 * Use Case:
 * - Knowledge base chatbots
 * - FAQ/support bots
 * - Informational websites without e-commerce
 * 
 * @architecture Strategy Pattern implementation
 * @critical FAQ system MUST work with this strategy
 */

import { AgentType, PrismaClient, Workspace } from "@echatbot/database"
import logger from "../utils/logger"
import { CustomerSupportAgentLLM } from "../application/agents/CustomerSupportAgentLLM"
import { LinkReplacementService } from "../application/services/link-replacement.service"
import { SafetyTranslationAgent } from "../application/agents/SafetyTranslationAgent"
import type { RoutingContext, RoutingResult, RoutingStrategy } from "./routing-strategy.interface"

export class InformationalWorkspaceStrategy implements RoutingStrategy {
  private linkReplacementService: LinkReplacementService
  private safetyAgent: SafetyTranslationAgent

  constructor(private prisma: PrismaClient) {
    this.linkReplacementService = new LinkReplacementService()
    this.safetyAgent = new SafetyTranslationAgent(prisma)
  }

  /**
   * This strategy handles informational workspaces
   */
  canHandle(workspace: Workspace): boolean {
    return workspace.sellsProductsAndServices === false
  }

  /**
   * Route ALL messages to CUSTOMER_SUPPORT agent
   * CUSTOMER_SUPPORT has FAQ system enabled
   */
  async route(context: RoutingContext, workspace: Workspace): Promise<RoutingResult> {
    const startTime = Date.now()

    logger.info("📚 InformationalWorkspaceStrategy - Routing to CUSTOMER_SUPPORT", {
      workspaceId: context.workspaceId,
      customerId: context.customerId,
      message: context.message.substring(0, 50) + "...",
    })

    try {
      // Load customer data for agent context
      const customerData = await this.prisma.customers.findFirst({
        where: {
          id: context.customerId,
          workspaceId: context.workspaceId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          language: true,
        },
      })

      if (!customerData) {
        throw new Error(`Customer not found: ${context.customerId}`)
      }

      // Create CUSTOMER_SUPPORT agent
      const customerSupportAgent = new CustomerSupportAgentLLM(this.prisma)

      // Execute agent query
      const agentResponse = await customerSupportAgent.handleQuery({
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        customerName: context.customerName || customerData.name,
        customerLanguage: context.customerLanguage || customerData.language || "it",
        query: context.message,
        customerData: {
          nameUser: customerData.name,
          name: customerData.name,
          email: customerData.email || "",
          isActive: customerData.isActive || false,
          discountUser: 0,
          companyName: workspace.name,
          lastordercode: "",
          languageUser: customerData.language || "it",
          agentName: "",
          agentPhone: "",
          agentEmail: "",
        },
      })

      const executionTime = Date.now() - startTime

      logger.info("✅ InformationalWorkspaceStrategy - CUSTOMER_SUPPORT completed", {
        workspaceId: context.workspaceId,
        tokensUsed: agentResponse.tokensUsed || 0,
        executionTimeMs: executionTime,
      })

      // � STEP 1: Link Replacement ([LINK_*] tokens → actual URLs)
      logger.debug("🔗 Replacing [LINK_*] tokens in informational response")
      const linkReplacedResponse = await this.linkReplacementService.replaceTokens(
        { response: agentResponse.output },
        context.customerId,
        context.workspaceId
      )

      // 🔒 STEP 2: Safety + Translation (to customer's language)
      logger.debug("🔒 Translating informational response with SafetyTranslationAgent")
      const safetyResult = await this.safetyAgent.process({
        workspaceId: context.workspaceId,
        response: linkReplacedResponse.response || agentResponse.output,
        targetLanguage: customerData.language || "it",
        customerName: customerData.name,
      })

      // Final response after filters
      const finalResponse =
        safetyResult.safe && safetyResult.translatedText
          ? safetyResult.translatedText
          : linkReplacedResponse.response || agentResponse.output

      // Build debug steps for timeline
      const debugSteps: any[] = [
        {
          type: "router",
          agent: "Router (Informational Workspace)",
          model: "N/A",
          temperature: 0,
          timestamp: new Date().toISOString(),
          input: {
            userMessage: context.message,
            workspaceType: "informational",
          },
          output: {
            decision: "CUSTOMER_SUPPORT",
            message: "Informational workspace → Always route to FAQ/Support",
          },
          tokenUsage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
        },
        {
          type: "customer_support",
          agent: "Customer Support Agent",
          model: "gpt-4o-mini",
          temperature: 0.7,
          timestamp: new Date().toISOString(),
          input: {
            userMessage: context.message,
            customerLanguage: context.customerLanguage || "it",
          },
          output: {
            decision: "support_assistance_provided",
            message: agentResponse.output,
            functionCalls: agentResponse.functionCalls || [],
          },
          tokensUsed: agentResponse.tokensUsed || 0,
          executionTimeMs: agentResponse.executionTimeMs || 0,
          containsTokens: false,
        },
      ]

      return {
        response: finalResponse, // ✅ NOW with Safety + LinkReplacement + Translation
        agentType: "CUSTOMER_SUPPORT" as AgentType,
        debugSteps,
        totalTokens:
          (agentResponse.tokensUsed || 0) + (safetyResult.tokensUsed || 0),
        conversationId: context.conversationId,
      }

    } catch (error) {
      const executionTime = Date.now() - startTime
      logger.error("❌ InformationalWorkspaceStrategy - Error", {
        workspaceId: context.workspaceId,
        error: error.message,
        executionTimeMs: executionTime,
      })
      throw error
    }
  }
}
