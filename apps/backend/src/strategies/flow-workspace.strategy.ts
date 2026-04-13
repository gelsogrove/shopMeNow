/**
 * FlowWorkspaceStrategy
 *
 * Routing strategy for flow workspaces (channelMode=FLOW).
 *
 * Behavior:
 * - Currently identical to InformationalWorkspaceStrategy
 * - Routes to INFO_AGENT with FAQ system
 * - Will be enhanced later with guided step-by-step flow logic
 *
 * Use Case:
 * - Guided troubleshooting bots
 * - Step-by-step onboarding flows
 * - Decision tree chatbots
 *
 * @architecture Strategy Pattern implementation
 */

import { AgentType, ChannelMode, PrismaClient, Workspace } from "@echatbot/database"
import logger from "../utils/logger"
import { CustomerSupportAgentLLM } from "../application/agents/CustomerSupportAgentLLM"
import { LinkReplacementService } from "../application/services/link-replacement.service"
import { TranslationAgent } from "../application/agents/TranslationAgent"
import { SecurityAgent, type SecurityResult } from "../application/agents/SecurityAgent"
import type { RoutingContext, RoutingResult, RoutingStrategy } from "./routing-strategy.interface"

export class FlowWorkspaceStrategy implements RoutingStrategy {
  private linkReplacementService: LinkReplacementService
  private translationAgent: TranslationAgent
  private securityAgent: SecurityAgent

  constructor(private prisma: PrismaClient) {
    this.linkReplacementService = new LinkReplacementService()
    this.translationAgent = new TranslationAgent(prisma)
    this.securityAgent = new SecurityAgent(prisma)
  }

  /**
   * This strategy handles flow workspaces
   */
  canHandle(workspace: Workspace): boolean {
    return workspace.channelMode === ChannelMode.FLOW
  }

  /**
   * Route ALL messages to INFO_AGENT (placeholder — will be replaced with flow logic later)
   */
  async route(context: RoutingContext, workspace: Workspace): Promise<RoutingResult> {
    const startTime = Date.now()

    logger.info("🔄 FlowWorkspaceStrategy - Routing to Flow Agent", {
      workspaceId: context.workspaceId,
      customerId: context.customerId,
      message: context.message.substring(0, 50) + "...",
    })

    try {
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

      const customerSupportAgent = new CustomerSupportAgentLLM(this.prisma)

      const agentResponse = await customerSupportAgent.handleQuery({
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        customerName: context.customerName || customerData.name,
        customerLanguage: context.customerLanguage || customerData.language || "en",
        query: context.message,
        customerData: {
          nameUser: customerData.name,
          name: customerData.name,
          email: customerData.email || "",
          isActive: customerData.isActive || false,
          discountUser: 0,
          companyName: workspace.name,
          lastordercode: "",
          languageUser: customerData.language || "en",
          agentName: "",
          agentPhone: "",
          agentEmail: "",
        },
      })

      const executionTime = Date.now() - startTime

      logger.info("✅ FlowWorkspaceStrategy - Flow Agent completed", {
        workspaceId: context.workspaceId,
        tokensUsed: agentResponse.tokensUsed || 0,
        executionTimeMs: executionTime,
      })

      // STEP 1: Link Replacement
      const linkReplacedResponse = await this.linkReplacementService.replaceTokens(
        { response: agentResponse.output },
        context.customerId,
        context.workspaceId
      )

      // STEP 2: Translation Layer
      const translationInput = linkReplacedResponse.response || agentResponse.output
      const translationResult = await this.translationAgent.process({
        workspaceId: context.workspaceId,
        message: translationInput,
        targetLanguage: customerData.language || "en",
        customerName: customerData.name,
        customerId: customerData.id,
        channel: context.channel,
      })

      let finalResponse = translationResult.message
      let securityResult: SecurityResult | null = null

      // STEP 3: Security Layer (widget only)
      if (context.channel === "widget") {
        securityResult = await this.securityAgent.process({
          workspaceId: context.workspaceId,
          message: finalResponse,
          customerName: customerData.name,
          customerId: customerData.id,
        })
        finalResponse = securityResult.message || finalResponse
      }

      const debugSteps: any[] = [
        {
          type: "sub_agent",
          agent: "Flow Agent",
          model: "gpt-4o-mini",
          temperature: 0.7,
          timestamp: new Date().toISOString(),
          input: {
            userMessage: context.message,
            customerLanguage: context.customerLanguage || "en",
          },
          output: {
            message: agentResponse.output,
            functionCalls: agentResponse.functionCalls || [],
          },
          tokensUsed: agentResponse.tokensUsed || 0,
          executionTimeMs: agentResponse.executionTimeMs || 0,
          containsTokens: false,
        },
        {
          type: "safety",
          agent: "Translation Layer",
          timestamp: new Date().toISOString(),
          input: {
            previousResponse: translationInput,
            targetLanguage: customerData.language || "en",
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
        },
      ]

      if (context.channel === "widget" && securityResult) {
        debugSteps.push({
          type: "safety",
          agent: "Widget Security Layer",
          timestamp: new Date().toISOString(),
          input: { textToValidate: translationResult.message },
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
        response: finalResponse,
        agentType: "INFO_AGENT" as AgentType,
        debugSteps,
        totalTokens:
          (agentResponse.tokensUsed || 0) +
          (translationResult.tokensUsed || 0) +
          (securityResult?.tokensUsed || 0),
        conversationId: context.conversationId,
      }

    } catch (error) {
      const executionTime = Date.now() - startTime
      logger.error("❌ FlowWorkspaceStrategy - Error", {
        workspaceId: context.workspaceId,
        error: error.message,
        executionTimeMs: executionTime,
      })
      throw error
    }
  }
}
