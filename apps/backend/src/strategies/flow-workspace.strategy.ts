/**
 * FlowWorkspaceStrategy
 *
 * Routing strategy for FLOW workspaces (channelMode=FLOW).
 *
 * 3-path routing:
 *   1. Active flowState → FlowEngineService.handleMessage() (0 LLM tokens, deterministic)
 *   2. flowKey set but no active flow → FlowAgentLLM.handleQuery() (Sub-LLM for machine)
 *   3. No flowKey → Router FlowAgentLLM (flowKey="router") gathers machine info, calls assignMachine()
 *
 * Post-processing on ALL paths:
 *   - ConversationHistoryLayer (humanize response)
 *   - TranslationAgent (translate response to customer language)
 *   - SecurityAgent (widget only)
 *   - contactOperator() if shouldCallOperator
 *
 * Use Case:
 * - Guided troubleshooting bots (washing machines, dryers, etc.)
 * - Step-by-step decision tree chatbots
 *
 * @architecture Strategy Pattern implementation
 */

import { AgentType, ChannelMode, PrismaClient, Workspace } from "@echatbot/database"
import logger from "../utils/logger"
import { FlowAgentLLM } from "../application/agents/FlowAgentLLM"
import { FlowEngineService } from "../application/services/flow-engine.service"
import { FlowNodeConfigRepository } from "../repositories/flow-node-config.repository"
import { LinkReplacementService } from "../application/services/link-replacement.service"
import { TranslationAgent } from "../application/agents/TranslationAgent"
import { SecurityAgent, type SecurityResult } from "../application/agents/SecurityAgent"
import { ConversationHistoryLayer } from "../application/layers/ConversationHistoryLayer"
import { ConversationManager } from "../services/conversation-manager.service"
import { contactOperator } from "../domain/calling-functions/contactOperator"
import { CustomerSupportAgentLLM } from "../application/agents/CustomerSupportAgentLLM"
import { ProfileManagementAgentLLM } from "../application/agents/ProfileManagementAgentLLM"
import { PromptBuilderService } from "../application/services/prompt-builder/prompt-builder.service"
import { ChatContext, FlowMap } from "../types/flow.types"
import type { RoutingContext, RoutingResult, RoutingStrategy } from "./routing-strategy.interface"

export class FlowWorkspaceStrategy implements RoutingStrategy {
  private linkReplacementService: LinkReplacementService
  private conversationHistoryLayer: ConversationHistoryLayer
  private translationAgent: TranslationAgent
  private securityAgent: SecurityAgent
  private flowNodeConfigRepo: FlowNodeConfigRepository
  private conversationManager: ConversationManager

  constructor(private prisma: PrismaClient) {
    this.linkReplacementService = new LinkReplacementService()
    this.conversationHistoryLayer = new ConversationHistoryLayer(prisma)
    this.translationAgent = new TranslationAgent(prisma)
    this.securityAgent = new SecurityAgent(prisma)
    this.flowNodeConfigRepo = new FlowNodeConfigRepository(prisma)
    this.conversationManager = new ConversationManager(prisma)
  }

  /**
   * This strategy handles flow workspaces
   */
  canHandle(workspace: Workspace): boolean {
    return workspace.channelMode === ChannelMode.FLOW
  }

  /**
   * 🆕 E0b - Check if session has expired after operator escalation
   *
   * When a customer is escalated to an operator, we set `ChatSession.escalatedAt`.
   * If the customer returns after `workspace.sessionResetTimeout` seconds,
   * we reset the flow state and allow them to restart the conversation.
   *
   * Reset Logic for FLOW:
   * - Clear flowState and flowKey from context
   * - Clear escalatedAt timestamp
   * - Customer can start fresh flow
   *
   * @param context - Current routing context
   * @param workspace - Workspace configuration
   * @returns true if session was reset, false otherwise
   */
  private async checkAndResetExpiredSession(
    context: RoutingContext,
    workspace: Workspace
  ): Promise<boolean> {
    // If sessionResetTimeout = 0 → "Never" auto-reset
    if (workspace.sessionResetTimeout === 0) {
      return false
    }

    // Find active chat session
    const chatSession = await this.prisma.chatSession.findFirst({
      where: {
        customerId: context.customerId,
        status: "active",
      },
      orderBy: { createdAt: "desc" },
    })

    // No session or not escalated → no reset needed
    if (!chatSession || !chatSession.escalatedAt) {
      return false
    }

    // Calculate time since escalation
    const now = new Date()
    const escalatedAt = new Date(chatSession.escalatedAt)
    const elapsedSeconds = Math.floor((now.getTime() - escalatedAt.getTime()) / 1000)

    // If timeout not exceeded → no reset
    if (elapsedSeconds < workspace.sessionResetTimeout) {
      logger.info(`⏰ E0b - Session NOT expired (${elapsedSeconds}s / ${workspace.sessionResetTimeout}s)`, {
        sessionId: chatSession.id,
        customerId: context.customerId,
      })
      return false
    }

    // 🔄 TIMEOUT EXCEEDED - Reset flow state
    logger.info(`🔄 E0b - Session EXPIRED - Resetting flow state (${elapsedSeconds}s > ${workspace.sessionResetTimeout}s)`, {
      sessionId: chatSession.id,
      customerId: context.customerId,
    })

    // Parse current context
    const currentContext = chatSession.context ? (chatSession.context as any) : {}

    // Clear flow-specific state
    delete currentContext.flowState
    delete currentContext.flowKey
    delete currentContext.flowNumber

    // Update session - clear flow state and escalatedAt
    await this.prisma.chatSession.update({
      where: { id: chatSession.id },
      data: {
        context: currentContext,
        escalatedAt: null,
      },
    })

    logger.info("✅ E0b - Flow state reset complete", {
      sessionId: chatSession.id,
      customerId: context.customerId,
    })

    return true
  }

  /**
   * Route message through the 4-path flow pipeline:
   *   Path A: QR code → load config, save context, return welcome
   *   Path B: Active flow → FlowEngineService (deterministic, 0 LLM tokens)
   *   Path C: flowKey set, no active flow → FlowAgentLLM Sub-LLM (startFlow / contactOp / text)
   *   Path D: No flowKey → Router FlowAgentLLM gathers locale/machine-type/number → assignMachine()
   */
  async route(context: RoutingContext, workspace: Workspace): Promise<RoutingResult> {
    const startTime = Date.now()

    logger.info("🔄 FlowWorkspaceStrategy - Route start", {
      workspaceId: context.workspaceId,
      customerId: context.customerId,
      message: context.message.substring(0, 50) + "...",
    })

    // 🆕 E0b - Check for expired session timeout and reset if needed
    await this.checkAndResetExpiredSession(context, workspace)

    try {
      // Load customer data
      const customerData = await this.prisma.customers.findFirst({
        where: {
          id: context.customerId,
          workspaceId: context.workspaceId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          isActive: true,
          language: true,
        },
      })

      if (!customerData) {
        throw new Error(`Customer not found: ${context.customerId}`)
      }

      // Load ChatSession context
      const chatSession = await this.prisma.chatSession.findFirst({
        where: {
          customerId: context.customerId,
          status: "active",
        },
        orderBy: { createdAt: "desc" },
      })

      let chatContext: ChatContext = chatSession?.context
        ? (chatSession.context as unknown as ChatContext)
        : {}

      let responseText = ""
      let tokensUsed = 0
      let executionTimeMs = 0
      let shouldCallOperator = false
      const debugSteps: any[] = []
      const functionCalls: any[] = []

      // ─── PATH A: Active flowState → FlowEngineService (deterministic) ──
      if (chatContext.flowState?.flowStatus === "ACTIVE" && chatContext.flowKey) {
        logger.info("⚙️ FlowWorkspaceStrategy - Active flow → FlowEngineService", {
          flowId: chatContext.flowState.flowId,
          currentNodeId: chatContext.flowState.currentNodeId,
        })

        const flowConfig = await this.flowNodeConfigRepo.findByFlowKey(
          context.workspaceId,
          chatContext.flowKey
        )
        if (!flowConfig) {
          throw new Error(`FlowNodeConfig disappeared for flowKey="${chatContext.flowKey}"`)
        }

        const flows = flowConfig.flows as unknown as FlowMap
        const engine = new FlowEngineService(flows)
        const result = engine.handleMessage(context.message, chatContext)

        responseText = result.responseText
        chatContext = { ...chatContext } // flowState updated in-place by engine
        shouldCallOperator = result.shouldCallOperator

        debugSteps.push({
          type: "flow-engine",
          agent: "FlowEngineService",
          timestamp: new Date().toISOString(),
          input: { userMessage: context.message, currentNodeId: chatContext.flowState?.currentNodeId },
          output: {
            responseText: result.responseText,
            nextNodeId: result.nextNodeId,
            flowStatus: result.flowStatus,
            shouldCallOperator: result.shouldCallOperator,
          },
          tokensUsed: 0,
          executionTimeMs: Date.now() - startTime,
        })
      }
      // ─── PATH B: No active flow → FlowAgentLLM (LLM call) ─────────────
      else if (chatContext.flowKey) {
        logger.info("🤖 FlowWorkspaceStrategy - No active flow → FlowAgentLLM", {
          flowKey: chatContext.flowKey,
        })

        const flowAgent = new FlowAgentLLM(this.prisma)
        const agentResult = await flowAgent.handleQuery({
          workspaceId: context.workspaceId,
          customerId: context.customerId,
          conversationId: context.conversationId || "",
          flowKey: chatContext.flowKey,
          message: context.message,
          chatContext,
          customerName: context.customerName || customerData.name,
          customerLanguage: context.customerLanguage || customerData.language || "en",
          customerPhone: customerData.phone || undefined,
        })

        responseText = agentResult.output
        chatContext = agentResult.chatContext
        tokensUsed = agentResult.tokensUsed
        executionTimeMs = agentResult.executionTimeMs
        shouldCallOperator = agentResult.shouldCallOperator
        functionCalls.push(...agentResult.functionCalls)

        debugSteps.push({
          type: "flow-agent",
          agent: "FlowAgentLLM",
          model: "from-config",
          timestamp: new Date().toISOString(),
          input: { userMessage: context.message, flowKey: chatContext.flowKey },
          output: {
            message: agentResult.output,
            functionCalls: agentResult.functionCalls,
            shouldCallOperator: agentResult.shouldCallOperator,
          },
          tokensUsed: agentResult.tokensUsed,
          executionTimeMs: agentResult.executionTimeMs,
        })
      }
      // ─── PATH C: No flowKey → Router FlowAgentLLM ──────────────────────
      else {
        logger.info("🎯 FlowWorkspaceStrategy - PATH C: No flowKey → Router LLM", {
          customerId: context.customerId,
        })

        const routerConfig = await this.flowNodeConfigRepo.findByFlowKey(
          context.workspaceId,
          "router"
        )

        if (!routerConfig) {
          // Fallback: workspace has no 'router' FlowNodeConfig configured
          logger.warn("FlowWorkspaceStrategy PATH D: no 'router' FlowNodeConfig found, using fallback", {
            workspaceId: context.workspaceId,
          })
          responseText = "Hello! I'm here to help. How can I assist you today?"
        } else {
          const flowAgent = new FlowAgentLLM(this.prisma)
          const agentResult = await flowAgent.handleQuery({
            workspaceId: context.workspaceId,
            customerId: context.customerId,
            conversationId: context.conversationId || "",
            flowKey: "router",
            message: context.message,
            chatContext,
            customerName: context.customerName || customerData.name,
            customerLanguage: context.customerLanguage || customerData.language || "en",
            customerPhone: customerData.phone || undefined,
          })

          responseText = agentResult.output
          chatContext = agentResult.chatContext // may now have flowKey if DELEGATE_TO_FLOW was called
          tokensUsed = agentResult.tokensUsed
          executionTimeMs = agentResult.executionTimeMs
          shouldCallOperator = agentResult.shouldCallOperator
          functionCalls.push(...agentResult.functionCalls)

          // ── Detect DELEGATE_TO_FLOW: Router delegated to a sub-LLM ──────────
          // If the Router called a DELEGATE_TO_AGENT function pointing to a FlowNodeConfig,
          // immediately invoke the sub-LLM in the same turn (no extra round-trip for customer).
          const delegateCall = agentResult.functionCalls.find(
            (fc) => fc.result && (fc.result as any).type === "DELEGATE_TO_FLOW"
          )
          if (delegateCall) {
            const { attachedFlowKey, machineNumber } = delegateCall.result as {
              type: string
              attachedFlowKey: string
              machineNumber: string
            }

            logger.info("🔀 FlowWorkspaceStrategy - DELEGATE_TO_FLOW detected, invoking sub-LLM", {
              attachedFlowKey,
              machineNumber,
            })

            // chatContext already updated by FlowAgentLLM (flowKey + flowNumber set)
            const subLlmAgent = new FlowAgentLLM(this.prisma)
            const subResult = await subLlmAgent.handleQuery({
              workspaceId: context.workspaceId,
              customerId: context.customerId,
              conversationId: context.conversationId || "",
              flowKey: attachedFlowKey,
              message: context.message,
              chatContext,
              customerName: context.customerName || customerData.name,
              customerLanguage: context.customerLanguage || customerData.language || "en",
              customerPhone: customerData.phone || undefined,
            })

            responseText = subResult.output
            chatContext = subResult.chatContext
            tokensUsed += subResult.tokensUsed
            executionTimeMs += subResult.executionTimeMs
            shouldCallOperator = shouldCallOperator || subResult.shouldCallOperator
            functionCalls.push(...subResult.functionCalls)

            debugSteps.push({
              type: "flow-agent",
              agent: "FlowAgentLLM-SubLLM",
              model: "from-config",
              timestamp: new Date().toISOString(),
              input: { userMessage: context.message, flowKey: attachedFlowKey, machineNumber },
              output: {
                message: subResult.output,
                functionCalls: subResult.functionCalls,
                shouldCallOperator: subResult.shouldCallOperator,
              },
              tokensUsed: subResult.tokensUsed,
              executionTimeMs: subResult.executionTimeMs,
            })
          }

          // ── Detect DELEGATE_TO_AGENT_LLM: Router delegated to a peer agent ──
          // e.g. customerSupportAgent → CustomerSupportAgentLLM
          //      profileManagementAgent → ProfileManagementAgentLLM
          const agentDelegateCall = agentResult.functionCalls.find(
            (fc) => fc.result && (fc.result as any).type === "DELEGATE_TO_AGENT_LLM"
          )
          if (agentDelegateCall) {
            const { agentType, query } = agentDelegateCall.result as {
              type: string
              agentType: string
              query: string
            }

            logger.info("🤝 FlowWorkspaceStrategy - DELEGATE_TO_AGENT_LLM detected", {
              agentType,
              query: query.substring(0, 60),
            })

            try {
              if (agentType === "CUSTOMER_SUPPORT") {
                const csAgent = new CustomerSupportAgentLLM(this.prisma)
                const csResult = await csAgent.handleQuery({
                  workspaceId: context.workspaceId,
                  customerId: context.customerId,
                  customerName: context.customerName || customerData.name,
                  customerLanguage: context.customerLanguage || customerData.language || "en",
                  channel: context.channel,
                  query,
                })
                responseText = csResult.output
                tokensUsed += csResult.tokensUsed
                debugSteps.push({
                  type: "flow-agent",
                  agent: "CustomerSupportAgentLLM",
                  timestamp: new Date().toISOString(),
                  input: { query },
                  output: { message: csResult.output },
                  tokensUsed: csResult.tokensUsed,
                  executionTimeMs: csResult.executionTimeMs,
                })
              } else if (agentType === "PROFILE_MANAGEMENT") {
                const promptBuilder = new PromptBuilderService(this.prisma)
                const pmAgent = new ProfileManagementAgentLLM(this.prisma, promptBuilder)
                const pmResult = await pmAgent.handleQuery({
                  workspaceId: context.workspaceId,
                  customerId: context.customerId,
                  customerName: context.customerName || customerData.name,
                  customerLanguage: context.customerLanguage || customerData.language || "en",
                  channel: context.channel,
                  query,
                })
                responseText = pmResult.output
                tokensUsed += pmResult.tokensUsed
                debugSteps.push({
                  type: "flow-agent",
                  agent: "ProfileManagementAgentLLM",
                  timestamp: new Date().toISOString(),
                  input: { query },
                  output: { message: pmResult.output },
                  tokensUsed: pmResult.tokensUsed,
                  executionTimeMs: pmResult.executionTimeMs,
                })
              } else {
                logger.warn("FlowWorkspaceStrategy: unsupported agentType for delegation", { agentType })
              }
            } catch (delegateError: any) {
              logger.error("❌ FlowWorkspaceStrategy: peer agent delegation failed", {
                agentType,
                error: delegateError.message,
              })
            }
          }
        }

        debugSteps.push({
          type: "flow-agent",
          agent: "RouterFlowAgentLLM",
          timestamp: new Date().toISOString(),
          input: { message: context.message },
          output: { responseText },
          tokensUsed,
          executionTimeMs,
        })
      }

      // ─── STEP: Save updated context to ChatSession ──────────────────────
      if (chatSession) {
        await this.prisma.chatSession.update({
          where: { id: chatSession.id },
          data: { context: chatContext as any },
        })
      }

      // ─── STEP: Contact operator if requested ────────────────────────────
      if (shouldCallOperator) {
        try {
          await contactOperator({
            phoneNumber: customerData.phone || "",
            workspaceId: context.workspaceId,
            customerId: context.customerId,
            reason: "Flow escalation",
            channel: context.channel,
          })
          logger.info("📞 FlowWorkspaceStrategy - contactOperator() executed")
        } catch (opError: any) {
          logger.error("❌ FlowWorkspaceStrategy - contactOperator() failed:", opError)
        }
      }

      // ─── STEP: Link replacement ─────────────────────────────────────────
      const linkResult = await this.linkReplacementService.replaceTokens(
        { response: responseText },
        context.customerId,
        context.workspaceId
      )
      responseText = linkResult.response || responseText

      // Capture pre-humanization response for history — the ConversationHistoryLayer
      // rewrites responseText which loses question structure needed by FlowAgentLLM
      const preHumanizationResponse = responseText

      // ─── STEP: Conversation History (humanize response) ─────────────────
      try {
        const historyResult = await this.conversationHistoryLayer.process({
          workspaceId: context.workspaceId,
          customerId: context.customerId,
          customerName: context.customerName || "",
          currentQuestion: context.message,
          technicalResponse: {
            type: "GENERIC",
            rawMessage: responseText,
          },
          botIdentity: {
            name: workspace.chatbotName || "Bot",
            personality: null,
          },
          customAiRules: null,
          companyName: workspace.name || "",
          hasSalesAgents: workspace.hasSalesAgents || false,
          conversationHistory: [],
          activeOffers: [],
          faqs: [],
          mindset: "NEUTRAL",
          lastAgentUsed: "FLOW",
          customerLanguage: context.customerLanguage || customerData.language || "en",
          isFirstMessage: false,
        })
        responseText = historyResult.message || responseText
        tokensUsed += historyResult.metadata?.tokensUsed || 0

        debugSteps.push({
          type: "humanization",
          agent: "ConversationHistoryLayer",
          timestamp: new Date().toISOString(),
          input: { rawResponse: responseText.substring(0, 100) },
          output: { humanizedResponse: historyResult.message?.substring(0, 100) },
          tokensUsed: historyResult.metadata?.tokensUsed || 0,
          executionTimeMs: historyResult.metadata?.executionTimeMs || 0,
        })
      } catch (historyError: any) {
        logger.warn("⚠️ ConversationHistoryLayer failed, using raw response:", historyError.message)
      }

      // ─── STEP: Translation ──────────────────────────────────────────────
      const targetLang = context.customerLanguage || customerData.language || "en"
      const translationResult = await this.translationAgent.process({
        workspaceId: context.workspaceId,
        message: responseText,
        targetLanguage: targetLang,
        customerName: customerData.name,
        customerId: customerData.id,
        channel: context.channel,
      })

      let finalResponse = translationResult.message
      tokensUsed += translationResult.tokensUsed || 0
      let securityResult: SecurityResult | null = null

      debugSteps.push({
        type: "safety",
        agent: "Translation Layer",
        timestamp: new Date().toISOString(),
        input: { previousResponse: responseText, targetLanguage: targetLang },
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

      // ─── STEP: Security (widget only) ───────────────────────────────────
      if (context.channel === "widget") {
        securityResult = await this.securityAgent.process({
          workspaceId: context.workspaceId,
          message: finalResponse,
          customerName: customerData.name,
          customerId: customerData.id,
        })
        finalResponse = securityResult.message || finalResponse
        tokensUsed += securityResult.tokensUsed || 0

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

      // ─── STEP: Save conversation history ───────────────────────────────
      // Save responseText (pre-humanization) so FlowAgentLLM sees its original
      // questions in history — humanized versions lose the question structure
      // and cause the LLM to lose context on what it was waiting for.
      if (context.conversationId) {
        try {
          await this.conversationManager.saveUserAndAssistantAtomic({
            workspaceId: context.workspaceId,
            customerId: context.customerId,
            conversationId: context.conversationId,
            userContent: context.message,
            assistantContent: preHumanizationResponse,
          })
        } catch (saveError: any) {
          logger.warn("⚠️ FlowWorkspaceStrategy - Failed to save history:", saveError.message)
        }
      }

      return {
        response: finalResponse,
        agentType: "ROUTER" as AgentType, // FLOW workspace: FlowAgentLLM acts as router
        debugSteps,
        totalTokens: tokensUsed,
        conversationId: context.conversationId,
      }
    } catch (error: any) {
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
