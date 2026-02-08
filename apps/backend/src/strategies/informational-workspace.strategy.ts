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
import { TranslationAgent } from "../application/agents/TranslationAgent"
import { SecurityAgent, type SecurityResult } from "../application/agents/SecurityAgent"
import type { RoutingContext, RoutingResult, RoutingStrategy } from "./routing-strategy.interface"

export class InformationalWorkspaceStrategy implements RoutingStrategy {
  private linkReplacementService: LinkReplacementService
  private translationAgent: TranslationAgent
  private securityAgent: SecurityAgent

  constructor(private prisma: PrismaClient) {
    this.linkReplacementService = new LinkReplacementService()
    this.translationAgent = new TranslationAgent(prisma)
    this.securityAgent = new SecurityAgent(prisma)
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

    logger.info("📚 InformationalWorkspaceStrategy - Routing to Info Agent", {
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

      logger.info("✅ InformationalWorkspaceStrategy - Info Agent completed", {
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

      // 🌍 STEP 2: Translation Layer (ALWAYS)
      const translationInput =
        linkReplacedResponse.response || agentResponse.output
      const translationResult = await this.translationAgent.process({
        workspaceId: context.workspaceId,
        message: translationInput,
        targetLanguage: customerData.language || "it",
        customerName: customerData.name,
        customerId: customerData.id,
        channel: context.channel,
      })

      let finalResponse = translationResult.message
      let securityResult: SecurityResult | null = null

      // 🛡️ STEP 3: Widget Security Layer (Widget only)
      if (context.channel === "widget") {
        logger.debug("🛡️ Applying Widget Security Layer (Widget)")
        securityResult = await this.securityAgent.process({
          workspaceId: context.workspaceId,
          message: finalResponse,
          customerName: customerData.name,
          customerId: customerData.id,
        })
        finalResponse = securityResult.message || finalResponse
      } else {
        logger.info("⏭️ Skipping Widget Security (WhatsApp - scheduler handles it)")
      }

      // Build debug steps for timeline
      const debugSteps: any[] = [
        {
          type: "sub_agent",
          agent: "Info Agent",
          model: "gpt-4o-mini",
          temperature: 0.7,
          timestamp: new Date().toISOString(),
          input: {
            userMessage: context.message,
            customerLanguage: context.customerLanguage || "it",
          },
          output: {
            message: agentResponse.output,
            functionCalls: agentResponse.functionCalls || [],
          },
          tokensUsed: agentResponse.tokensUsed || 0,
          executionTimeMs: agentResponse.executionTimeMs || 0,
          containsTokens: false,
        },
      ]

      if (context.channel === "widget") {
        debugSteps.push({
          type: "safety",
          agent: "Translation Layer",
          timestamp: new Date().toISOString(),
          input: {
            previousResponse: translationInput,
            targetLanguage: customerData.language || "it",
          },
          output: {
            translatedText: translationResult.message,
            decision: translationResult.translated ? "translated" : "passthrough",
            executionTimeMs: translationResult.executionTimeMs,
          },
          tokenUsage: {
            promptTokens: 0,
            completionTokens: translationResult.tokensUsed || 0,
            totalTokens: translationResult.tokensUsed || 0,
          },
        })
      } else {
        debugSteps.push({
          type: "safety",
          agent: "Translation Layer",
          timestamp: new Date().toISOString(),
          input: {
            previousResponse: translationInput,
            targetLanguage: customerData.language || "it",
          },
          output: {
            translatedText: translationResult.message,
            decision: translationResult.translated ? "translated" : "passthrough",
            executionTimeMs: translationResult.executionTimeMs,
          },
          tokenUsage: {
            promptTokens: 0,
            completionTokens: translationResult.tokensUsed || 0,
            totalTokens: translationResult.tokensUsed || 0,
          },
        })
      }

      if (context.channel === "widget" && securityResult) {
        debugSteps.push({
          type: "safety",
          agent: "Widget Security Layer",
          timestamp: new Date().toISOString(),
          input: {
            textToValidate: translationResult.message,
          },
          output: {
            textResponse: finalResponse,
            safe: securityResult.safe,
            decision: securityResult.safe ? "approved" : "blocked",
          },
          tokenUsage: {
            promptTokens: 0,
            completionTokens: securityResult.tokensUsed || 0,
            totalTokens: securityResult.tokensUsed || 0,
          },
          safe: securityResult.safe,
          blocked: !securityResult.safe,
          blockedReason: securityResult.blockedReason,
        })
      }

      return {
        response: finalResponse, // ✅ NOW with LinkReplacement + Translation (+ Widget Security if widget)
        agentType: "CUSTOMER_SUPPORT" as AgentType,
        debugSteps,
        totalTokens:
          (agentResponse.tokensUsed || 0) +
          (translationResult.tokensUsed || 0) +
          (securityResult?.tokensUsed || 0),
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
