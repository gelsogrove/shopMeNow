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
import axios from "axios"
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

    if (!chatSession) {
      return false
    }

    // Use last activity timestamp: prefer escalatedAt if set, otherwise updatedAt
    // This covers BOTH cases:
    //   - Customer escalated to operator → returns next day → reset
    //   - Customer completed/resolved a flow → returns next day → reset
    const now = new Date()
    const lastActivityAt = chatSession.escalatedAt
      ? new Date(chatSession.escalatedAt)
      : new Date(chatSession.updatedAt)

    const elapsedSeconds = Math.floor((now.getTime() - lastActivityAt.getTime()) / 1000)

    // Check if there's any flow state to reset
    const hasFlowState = chatSession.context &&
      ((chatSession.context as any).flowKey ||
       (chatSession.context as any).flowState ||
       (chatSession.context as any).gatherState)

    if (!hasFlowState && !chatSession.escalatedAt) {
      return false
    }

    // If timeout not exceeded → no reset
    if (elapsedSeconds < workspace.sessionResetTimeout) {
      logger.info(`⏰ E0b - Session NOT expired (${elapsedSeconds}s / ${workspace.sessionResetTimeout}s)`, {
        sessionId: chatSession.id,
        customerId: context.customerId,
        lastActivityAt,
      })
      return false
    }

    // 🔄 TIMEOUT EXCEEDED - Reset flow state
    logger.info(`🔄 E0b - Session EXPIRED - Resetting flow state (${elapsedSeconds}s > ${workspace.sessionResetTimeout}s)`, {
      sessionId: chatSession.id,
      customerId: context.customerId,
      lastActivityAt,
      hadEscalation: !!chatSession.escalatedAt,
    })

    // Parse current context
    const currentContext = chatSession.context ? (chatSession.context as any) : {}

    // Clear flow-specific state
    delete currentContext.flowState
    delete currentContext.flowKey
    delete currentContext.flowNumber
    delete currentContext.gatherState

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

    // 🛠️ DebugFlow: when debugMode=true, process normally but append debug trace to response
    // (Previously returned WIP message — now FLOW workspaces process with debug info appended)
    const isDebugFlow = !context.isPlayground && workspace.debugMode === true
    if (isDebugFlow) {
      logger.info("🛠️ FlowWorkspaceStrategy - DebugFlow active, processing with debug trace", {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
      })
    }

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

      // ─── PATH 0: Flow already ESCALATED → operator handling active, ignore new messages ──
      if (chatContext.flowState?.flowStatus === "ESCALATED") {
        logger.info("⚠️ FlowWorkspaceStrategy - Flow already ESCALATED, operator handling active")
        const escalatedMsg = workspace.humanSupportInstructions
          ? workspace.humanSupportInstructions
              .replace("{{nameUser}}", customerData.name || "")
              .replace("{{agentEmail}}", workspace.operatorEmail || "")
          : "An operator will assist you shortly. Please wait."
        return {
          response: escalatedMsg,
          agentType: "OPERATOR" as AgentType,
          debugSteps: [],
          totalTokens: 0,
          conversationId: context.conversationId,
        }
      }

      // ─── FIX 2: Resume PAUSED flow on next user message ─────────────────
      if (chatContext.flowState?.flowStatus === "PAUSED" && chatContext.flowKey) {
        logger.info("▶️ FlowWorkspaceStrategy - Resuming PAUSED flow → back to ACTIVE")
        chatContext.flowState.flowStatus = "ACTIVE"
      }

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

        shouldCallOperator = result.shouldCallOperator

        // ── DebugFlow: capture engine debug data for PATH A ───────────────
        if (result.debug) {
          debugSteps.push({
            type: "flow-engine",
            agent: "FlowEngineService",
            timestamp: new Date().toISOString(),
            input: {
              userMessage: context.message,
              previousNodeId: result.debug.previousNodeId,
            },
            output: {
              classification: result.debug.classification,
              normalizedInput: result.debug.normalizedInput,
              transitionKey: result.debug.transitionKey,
              nextNodeId: result.nextNodeId,
              nodeType: result.debug.nodeType,
              flowStatus: result.flowStatus,
              shouldCallOperator: result.shouldCallOperator,
              interruptCount: result.debug.interruptCount,
            },
            tokensUsed: 0,
            executionTimeMs: Date.now() - startTime,
          })
        }

        // ─── Substitute {{customerName}} in static node prompts ─────────────
        // Only replace when customer has a name (registered customers).
        // Unregistered customers → strip the placeholder + surrounding ", " or " " cleanly.
        if (customerData.name) {
          responseText = result.responseText.replace(/\{\{customerName\}\}/g, customerData.name)
        } else {
          responseText = result.responseText
            .replace(/,\s*\{\{customerName\}\}/g, "")   // ", {{customerName}}" → ""
            .replace(/\s*\{\{customerName\}\}[!,.]?/g, "") // " {{customerName}}!" → ""
        }

        // ─── FIX 3: INTERRUPT_FAQ → answer via FlowAgentLLM, then append resume prompt ──
        if (result.isFaqInterrupt && chatContext.flowKey) {
          logger.info("🟣 FlowWorkspaceStrategy - INTERRUPT_FAQ: answering FAQ via FlowAgentLLM")
          try {
            const faqAgent = new FlowAgentLLM(this.prisma)
            const faqResult = await faqAgent.handleQuery({
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
            // Combine: FAQ answer + resume prompt (onInterruptFallback)
            responseText = faqResult.output
              ? `${faqResult.output}\n\n${result.responseText}`
              : result.responseText
            tokensUsed += faqResult.tokensUsed
          } catch (faqErr: any) {
            logger.warn("⚠️ FlowWorkspaceStrategy - FAQ answer failed, using fallback:", faqErr.message)
            responseText = result.responseText
          }
        }
        // ── FIX 4: isAmbiguousChoice → LLM classification for free-text CHOICE ──
        else if (result.isAmbiguousChoice && result.choiceTransitionDescriptions && result.ambiguousInput) {
          logger.info("🔮 FlowWorkspaceStrategy - isAmbiguousChoice: classifying via LLM", {
            ambiguousInput: result.ambiguousInput.substring(0, 80),
            options: Object.keys(result.choiceTransitionDescriptions),
          })

          try {
            const classifiedKey = await this.classifyChoiceViaLLM(
              result.ambiguousInput,
              result.choiceTransitionDescriptions,
              flowConfig.model || "openai/gpt-4o-mini"
            )

            if (classifiedKey) {
              logger.info("✅ FlowWorkspaceStrategy - LLM classified choice", {
                classifiedKey,
                input: result.ambiguousInput.substring(0, 50),
              })

              // Re-feed the classified key to engine (bypasses classifier)
              const reclassifiedResult = engine.applyClassifiedTransition(classifiedKey, chatContext)
              responseText = reclassifiedResult.responseText
              shouldCallOperator = reclassifiedResult.shouldCallOperator

              // Append debug step for classification
              debugSteps.push({
                type: "choice-classification",
                agent: "LLM-ChoiceClassifier",
                timestamp: new Date().toISOString(),
                input: {
                  ambiguousInput: result.ambiguousInput,
                  options: result.choiceTransitionDescriptions,
                },
                output: {
                  classifiedKey,
                  nextNodeId: reclassifiedResult.nextNodeId,
                  flowStatus: reclassifiedResult.flowStatus,
                },
                tokensUsed: 0, // minimal tokens — counted separately
              })
            } else {
              // LLM couldn't classify → use original fallback
              logger.warn("⚠️ FlowWorkspaceStrategy - LLM classification returned NONE, using fallback")
              responseText = result.responseText
            }
          } catch (classifyError: any) {
            logger.warn("⚠️ FlowWorkspaceStrategy - Choice classification failed, using fallback:", classifyError.message)
            responseText = result.responseText
          }
        } else {
          responseText = result.responseText
        }

        chatContext = { ...chatContext } // flowState updated in-place by engine
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

      // ─── STEP: Contact operator if requested (gated by workspace.hasHumanSupport) ──
      if (shouldCallOperator && workspace.hasHumanSupport !== false) {
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
      } else if (shouldCallOperator && workspace.hasHumanSupport === false) {
        logger.warn("⚠️ FlowWorkspaceStrategy - contactOperator skipped: workspace.hasHumanSupport=false")
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

      // ─── STEP: Conversation History (humanize response) — DISABLED for FLOW ──
      // Flow node prompts are precisely crafted step-by-step questions that
      // must not be rewritten — humanization destroys the guided conversation structure.

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
            agentType: "ROUTER",
            tokensUsed: tokensUsed,
            debugInfo: debugSteps.length > 0 ? { steps: debugSteps, totalTokens: tokensUsed, executionTimeMs: Date.now() - startTime } : undefined,
          })
        } catch (saveError: any) {
          logger.warn("⚠️ FlowWorkspaceStrategy - Failed to save history:", saveError.message)
        }
      }

      // ─── STEP: DebugFlow — append debug trace when debugMode=true ─────
      if (isDebugFlow && debugSteps.length > 0) {
        const debugTrace = this.buildDebugTrace(debugSteps, chatContext, tokensUsed, Date.now() - startTime)
        finalResponse = `${finalResponse}\n\n${debugTrace}`
        logger.info("🛠️ FlowWorkspaceStrategy - DebugFlow trace appended to response")
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
        customerId: context.customerId,
        error: error.message,
        stack: error.stack,
        executionTimeMs: executionTime,
      })

      // ─── ERROR RECOVERY: Save error to DB + notify operator via email ───
      try {
        const errorDebugInfo = {
          error: true,
          errorMessage: error.message,
          errorStack: error.stack?.substring(0, 500),
          executionTimeMs: executionTime,
          timestamp: new Date().toISOString(),
          source: "FlowWorkspaceStrategy",
          flowKey: "unknown",
          message: context.message?.substring(0, 200),
        }

        // Save user message + error assistant message atomically
        await this.conversationManager.saveUserAndAssistantAtomic({
          workspaceId: context.workspaceId,
          customerId: context.customerId,
          conversationId: context.conversationId || "",
          userContent: context.message,
          assistantContent: "⚠️ An unexpected error occurred. The operator has been notified.",
          agentType: "ROUTER",
          tokensUsed: 0,
          debugInfo: errorDebugInfo,
        })

        // Send error notification email to workspace operator + CC echatbot
        const operatorEmail = workspace.operatorEmail
        if (operatorEmail) {
          const { EmailService } = await import("../application/services/email.service")
          const emailService = new EmailService()
          const errorSubject = `🚨 FLOW Error - ${workspace.name || context.workspaceId}`
          const errorBody = [
            `<h2>🚨 Flow Pipeline Error</h2>`,
            `<p><strong>Workspace:</strong> ${workspace.name || context.workspaceId}</p>`,
            `<p><strong>Customer ID:</strong> ${context.customerId}</p>`,
            `<p><strong>Customer Message:</strong> ${context.message?.substring(0, 200)}</p>`,
            `<p><strong>Flow:</strong> N/A</p>`,
            `<p><strong>Error:</strong> <code>${error.message}</code></p>`,
            `<p><strong>Time:</strong> ${new Date().toLocaleString("it-IT")}</p>`,
            `<p><strong>Duration:</strong> ${executionTime}ms</p>`,
            `<hr/>`,
            `<p style="font-size:12px;color:#666;">Stack trace (first 500 chars):<br/><pre>${error.stack?.substring(0, 500)}</pre></p>`,
          ].join("\n")

          await emailService.sendMail({
            type: "agent",
            to: operatorEmail,
            subject: errorSubject,
            body: errorBody,
            cc: "echatbotai@gmail.com",
            workspaceId: context.workspaceId,
          })
          logger.info("📧 FlowWorkspaceStrategy - Error notification email sent", {
            to: operatorEmail,
            cc: "echatbotai@gmail.com",
          })
        } else {
          logger.warn("⚠️ FlowWorkspaceStrategy - No operatorEmail configured, cannot send error notification")
        }
      } catch (recoveryError: any) {
        // Recovery itself failed — log but don't mask original error
        logger.error("❌ FlowWorkspaceStrategy - Error recovery failed", {
          originalError: error.message,
          recoveryError: recoveryError.message,
        })
      }

      // Return fallback response instead of throwing (customer gets a message)
      return {
        response: "⚠️ An unexpected error occurred. The operator has been notified and will assist you shortly.",
        agentType: "ROUTER" as AgentType,
        debugSteps: [],
        totalTokens: 0,
        conversationId: context.conversationId,
      }
    }
  }

  /**
   * Lightweight LLM call to classify free-text input against CHOICE node transition descriptions.
   * Returns the matching transition key or null if no match.
   */
  private async classifyChoiceViaLLM(
    userInput: string,
    descriptions: Record<string, string>,
    model: string
  ): Promise<string | null> {
    const optionsList = Object.entries(descriptions)
      .map(([key, desc]) => `- "${key}": ${desc}`)
      .join("\n")

    const prompt = `The customer said: "${userInput}"

Which category best matches? Reply with ONLY the key (the word in quotes). Nothing else.

Options:
${optionsList}

If none clearly matches, reply: NONE`

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      logger.warn("⚠️ classifyChoiceViaLLM - No OPENROUTER_API_KEY, cannot classify")
      return null
    }

    const startTime = Date.now()
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 20,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    )

    const answer = response.data?.choices?.[0]?.message?.content?.trim().toLowerCase()
    const elapsed = Date.now() - startTime
    logger.info("🔮 classifyChoiceViaLLM result", { answer, elapsed, model })

    if (!answer || answer === "none") return null

    // Exact match first
    if (descriptions[answer]) return answer

    // Partial match: check if the answer contains a valid key
    for (const key of Object.keys(descriptions)) {
      if (answer.includes(key)) return key
    }

    return null
  }

  /**
   * Build a compact debug trace string for DebugFlow.
   * Appended to the WhatsApp response when workspace.debugMode=true.
   */
  private buildDebugTrace(
    debugSteps: any[],
    chatContext: any,
    tokensUsed: number,
    totalTimeMs: number,
  ): string {
    const lines: string[] = []
    lines.push("─── 🛠️ DEBUG TRACE ───")
    lines.push(`Flow: ${chatContext.flowKey || "none"} | Node: ${chatContext.currentNodeId || "none"} | Status: ${chatContext.flowStatus || "none"}`)
    lines.push(`Tokens: ${tokensUsed} | Time: ${totalTimeMs}ms`)
    lines.push("")

    for (let i = 0; i < debugSteps.length; i++) {
      const step = debugSteps[i]
      const prefix = `[${i + 1}] ${step.type || step.agent || "step"}`

      if (step.type === "flow-engine") {
        const o = step.output || {}
        lines.push(`${prefix}: ${o.classification || "?"} → node=${o.nextNodeId || "?"} (key=${o.transitionKey || "auto"})`)
        if (o.interruptCount) lines.push(`   interrupts: ${o.interruptCount}`)
      } else if (step.type === "flow-agent") {
        const fns = step.output?.functionCalls?.length || 0
        lines.push(`${prefix}: ${step.tokensUsed || 0}tok ${step.executionTimeMs || 0}ms${fns > 0 ? ` | ${fns} fn calls` : ""}`)
        if (step.output?.functionCalls) {
          for (const fc of step.output.functionCalls) {
            const name = typeof fc === "string" ? fc : fc?.name || "?"
            lines.push(`   → ${name}`)
          }
        }
      } else if (step.type === "function_call" || step.type === "function_result") {
        const name = step.output?.functionCall?.name || step.agent || "?"
        lines.push(`${prefix}: ${name}`)
      } else {
        lines.push(`${prefix}: ${step.executionTimeMs || 0}ms`)
      }
    }

    lines.push("─── END DEBUG ───")
    return lines.join("\n")
  }
}
