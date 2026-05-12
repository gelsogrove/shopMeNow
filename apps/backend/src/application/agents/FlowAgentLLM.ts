/**
 * @deprecated F50 — Andrea 2026-05-13
 *
 * Visual Flow Builder deprecated. Caused unacceptable latency in production
 * (1 LLM call per node = compounding wait time for the customer). Replaced
 * by code-based custom chatbot modules at `apps/backend/custom-<name>/`
 * (e.g. custom-ecolaundry).
 *
 * This service is no longer wired into the active runtime routing for new
 * workspaces (customChatbotId is the new contract). Kept for compatibility
 * with any legacy workspace still on channelMode=FLOW without customChatbotId.
 * A console.warn is emitted on every invocation to surface lingering usage
 * in production logs — once logs show zero hits over a window, it can be
 * physically removed in a dedicated cleanup session.
 *
 * --------------------------------------------------------------------
 * FlowAgentLLM
 *
 * ✅ SPECIALIST AGENT for ChannelMode.FLOW workspaces.
 *
 * Used by:
 * - FlowWorkspaceStrategy when NO active flowState (user has not selected a flow yet)
 *
 * Responsibilities:
 * 1. Load FlowNodeConfig from DB (systemPrompt, model, temperature, flows, availableFunctions)
 * 2. Build tools dynamically from config.flows keys (never hardcoded)
 * 3. Call LLM via OpenRouter with dynamic tools
 * 4. Handle tool_call "startFlow" → FlowEngineService.startFlow()
 * 5. Handle tool_call "contactOperator" → contactOperator() (only if availableFunctions includes it)
 * 6. Return { output, context, tokensUsed, functionCalls, executionTimeMs }
 *
 * Architecture:
 * - Own LLM instance (OpenRouter, model from FlowNodeConfig)
 * - systemPrompt from FlowNodeConfig (DB) — never from AgentConfig or hardcoded
 * - tools built server-side from DB data — customer cannot inject tool names
 * - WorkspaceId isolation enforced on every DB query
 * - History scoped to (customerId, workspaceId) via ConversationManager
 *
 * Tool enum rationale (Security):
 * - The `startFlow` tool has `flowId.enum = Object.keys(config.flows)`
 * - This means the LLM can ONLY start flows that exist in this workspace's config
 * - A malicious customer cannot inject a flowId not in the enum (LLM validation)
 *
 * Flow:
 * 1. FlowWorkspaceStrategy calls FlowAgentLLM.handleQuery(ctx)
 * 2. Load FlowNodeConfig (throws if not found — never silent fallback)
 * 3. Load conversation history
 * 4. Build tools from config
 * 5. Call LLM
 * 6a. tool_call "startFlow" → FlowEngineService.startFlow() → returns step_0 prompt directly
 * 6b. tool_call "contactOperator" → contactOperator()
 * 6c. no tool_call → return LLM text (FAQ, general info about machine)
 *
 * @critical NEVER call hardcoded prompts — ALL prompts come from FlowNodeConfig.systemPrompt in DB
 * @critical NEVER call LLMService — this agent has its own direct OpenRouter call
 */

import { PrismaClient } from "@echatbot/database"
import axios from "axios"
import { withOpenRouterRetry } from "../../utils/llm-retry"
import { FlowNodeConfigRepository } from "../../repositories/flow-node-config.repository"
import { WorkspaceCallingFunctionRepository } from "../../repositories/workspace-calling-function.repository"
import { ConversationManager, Message } from "../../services/conversation-manager.service"
import { FlowEngineService } from "../services/flow-engine.service"
import { contactOperator } from "../../domain/calling-functions/contactOperator"
import { ChatContext, FlowMap } from "../../types/flow.types"
import { PromptVariableBuilder } from "../services/prompt-variable-builder.service"
import { PromptProcessorService } from "../../services/prompt-processor.service"
import logger from "../../utils/logger"

export interface FlowAgentContext {
  workspaceId: string
  customerId: string
  conversationId: string
  flowKey: string
  message: string
  /** Current ChatSession.context — updated in place and returned */
  chatContext: ChatContext
  customerName?: string
  customerLanguage?: string
  /** Optional customer phone for contactOperator */
  customerPhone?: string
}

export interface FlowAgentResponse {
  success: boolean
  output: string
  /** Updated ChatSession.context (may contain new flowState after startFlow) */
  chatContext: ChatContext
  tokensUsed: number
  executionTimeMs: number
  functionCalls: Array<{
    name: string
    arguments: Record<string, unknown>
    result: unknown
  }>
  shouldCallOperator: boolean
  operatorCallResult?: unknown
}

export class FlowAgentLLM {
  private flowNodeConfigRepo: FlowNodeConfigRepository
  private callingFunctionRepo: WorkspaceCallingFunctionRepository
  private conversationManager: ConversationManager
  private openRouterApiKey: string
  private openRouterBaseUrl: string
  private promptProcessor: PromptProcessorService

  constructor(private prisma: PrismaClient) {
    // F50 deprecation telemetry — every instantiation is logged so we can
    // confirm zero production hits before physical removal.
    logger.warn("[DEPRECATED F50] FlowAgentLLM instantiated. Visual Flow Builder is deprecated; this workspace should migrate to a custom chatbot module (apps/backend/custom-<name>/).")
    this.flowNodeConfigRepo = new FlowNodeConfigRepository(prisma)
    this.callingFunctionRepo = new WorkspaceCallingFunctionRepository(prisma)
    this.conversationManager = new ConversationManager(prisma)
    this.promptProcessor = new PromptProcessorService()
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""
    this.openRouterBaseUrl = "https://openrouter.ai/api/v1"

    if (!this.openRouterApiKey) {
      throw new Error("OPENROUTER_API_KEY is required for FlowAgentLLM")
    }
  }

  async handleQuery(ctx: FlowAgentContext): Promise<FlowAgentResponse> {
    const startTime = Date.now()

    logger.info("🤖 FlowAgentLLM: processing query", {
      workspaceId: ctx.workspaceId,
      customerId: ctx.customerId,
      flowKey: ctx.flowKey,
      message: ctx.message.substring(0, 100),
    })

    // ── STEP 1: Load FlowNodeConfig from DB ──────────────────────────────────
    const flowConfig = await this.flowNodeConfigRepo.findByFlowKey(ctx.workspaceId, ctx.flowKey)
    if (!flowConfig) {
      throw new Error(
        `FlowAgentLLM: FlowNodeConfig not found for flowKey="${ctx.flowKey}" in workspace "${ctx.workspaceId}"`
      )
    }

    const flows = flowConfig.flows as unknown as FlowMap
    const availableFunctions = (flowConfig.availableFunctions as string[]) ?? []
    const model = flowConfig.model ?? "openai/gpt-4o-mini"
    const temperature = flowConfig.temperature ?? 0.3
    const maxTokens = flowConfig.maxTokens ?? 2048
    const rawSystemPrompt = flowConfig.systemPrompt ?? ""

    // ── STEP 1b: Inject workspace variables ({{faqs}}, {{chatbotName}}, etc.) ──
    const [workspace, customer, faqs] = await Promise.all([
      this.prisma.workspace.findUnique({ where: { id: ctx.workspaceId } }),
      this.prisma.customers.findFirst({
        where: { id: ctx.customerId, workspaceId: ctx.workspaceId },
        include: { sales: true },
      }),
      this.prisma.fAQ.findMany({
        where: { workspaceId: ctx.workspaceId, isActive: true },
        select: { question: true, answer: true },
      }),
    ])

    const faqsFormatted = faqs.length > 0
      ? faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")
      : ""

    const promptVariables = PromptVariableBuilder.build(
      customer,
      workspace,
      { faqs: faqsFormatted },
      { channel: "whatsapp" },
      { includeDynamicContent: true, skipValidation: true }
    )

    const systemPrompt = this.promptProcessor.processWithVariables(rawSystemPrompt, promptVariables)

    // ── STEP 2: Load conversation history ────────────────────────────────────
    const history: Message[] = await this.conversationManager.loadHistory(
      ctx.workspaceId,
      ctx.conversationId
    )

    // ── STEP 3: Build tools dynamically ──────────────────────────────────────
    // Tool enum comes from DB flows keys — server-side, tamper-proof
    const flowIds = Object.keys(flows)
    const isRouterMode = ctx.flowKey === "router"

    // ── STEP 3b: Filter availableFunctions by workspace settings ─────────────
    // Same pattern as ECOMMERCE llm-router.service.ts lines 1265-1280.
    // Workspace flags command the ENTIRE pipeline (UI + LLM algorithm).
    let filteredAvailableFunctions = this.filterByWorkspaceSettings(availableFunctions, workspace)

    // ── STEP 3c: Strip resetSession when there is nothing to reset ────────────
    // If no flow is active and no gather progress, the LLM should NOT have
    // resetSession as a tool — otherwise it tends to call it on greetings / FAQs.
    const hasContextToReset =
      !!ctx.chatContext.flowKey ||
      !!ctx.chatContext.flowState ||
      !!ctx.chatContext.gatherState
    if (!hasContextToReset) {
      filteredAvailableFunctions = filteredAvailableFunctions.filter((f) => f !== "resetSession")
    }

    const tools = await this.buildTools(flowIds, filteredAvailableFunctions, isRouterMode, ctx.workspaceId, workspace)

    // ── STEP 4: Build messages — inject gatherState context for router ──────
    let enrichedSystemPrompt = systemPrompt
    if (ctx.flowKey === "router" && ctx.chatContext.gatherState) {
      const gs = ctx.chatContext.gatherState
      const gathered: string[] = []
      if (gs.locale) gathered.push(`Location: ${gs.locale}`)
      if (gs.machineType) gathered.push(`Machine type: ${gs.machineType}`)
      if (gs.machineNumber) gathered.push(`Machine number: ${gs.machineNumber}`)
      if (gathered.length > 0) {
        enrichedSystemPrompt += `\n\n## ALREADY COLLECTED (do NOT ask again)\n${gathered.join("\n")}`
      }
    }

    const messages = [
      { role: "system" as const, content: enrichedSystemPrompt },
      ...history,
      { role: "user" as const, content: ctx.message },
    ]

    const llmResponse = await withOpenRouterRetry(() =>
      axios.post(
        `${this.openRouterBaseUrl}/chat/completions`,
        {
          model,
          messages,
          tools: tools.length > 0 ? tools : undefined,
          // Router mode: force tool call after history has >= 4 messages (type + number collected)
          // Otherwise use "auto" to allow FAQ answers without forcing a tool call
          tool_choice: tools.length > 0
            ? (isRouterMode && history.length >= 4 ? "required" : "auto")
            : undefined,
          temperature,
          max_tokens: maxTokens,
        },
        {
          headers: {
            Authorization: `Bearer ${this.openRouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://echatbot.ai",
            "X-Title": "eChatbot FlowAgent",
          },
        }
      )
    )

    const tokensUsed = llmResponse.data.usage?.total_tokens ?? 0
    const choice = llmResponse.data.choices?.[0]
    const functionCalls: FlowAgentResponse["functionCalls"] = []

    let output = choice?.message?.content ?? ""
    let chatContext = { ...ctx.chatContext }
    let shouldCallOperator = false
    let operatorCallResult: unknown

    // ── STEP 5: Handle tool_call ──────────────────────────────────────────────
    const toolCalls = choice?.message?.tool_calls ?? []

    for (const toolCall of toolCalls) {
      const fnName: string = toolCall.function?.name ?? ""
      let fnArgs: Record<string, unknown> = {}

      try {
        fnArgs = JSON.parse(toolCall.function?.arguments ?? "{}")
      } catch {
        logger.warn("FlowAgentLLM: failed to parse tool_call arguments", { toolCall })
      }

      if (fnName === "startFlow") {
        // ── 5a. startFlow ─────────────────────────────────────────────────────
        const flowId = String(fnArgs.flowId ?? "")
        logger.info("🔀 FlowAgentLLM: tool_call startFlow", { flowId })

        const engine = new FlowEngineService(flows)
        const result = engine.startFlow(flowId, chatContext)
        chatContext = result.context
        // step_0 prompt IS the response — no second LLM call needed
        output = result.responseText

        functionCalls.push({ name: "startFlow", arguments: fnArgs, result: { flowId } })
      } else if (fnName === "contactOperator") {
        // ── 5b. contactOperator ───────────────────────────────────────────────
        logger.info("📞 FlowAgentLLM: tool_call contactOperator")
        shouldCallOperator = true
        // Actual contactOperator() call is deferred to strategy (needs full workspace object)
        functionCalls.push({ name: "contactOperator", arguments: fnArgs, result: "deferred_to_strategy" })
      } else if (fnName === "resetSession") {
        // ── 5b2. resetSession — clear machine assignment and flow state ────────
        logger.info("🔄 FlowAgentLLM: tool_call resetSession")
        delete chatContext.flowKey
        delete chatContext.flowNumber
        delete chatContext.flowState
        delete chatContext.gatherState
        // Generic message — no business-specific text. The Router LLM will produce
        // a contextual follow-up on the next turn (context is now empty → PATH C).
        output = ""
        functionCalls.push({ name: "resetSession", arguments: fnArgs, result: "context_cleared" })
      } else {
        // ── 5c. DELEGATE_TO_FLOW — Router delegating to a sub-LLM ────────────
        // Check if this tool name matches a Flow DELEGATE_TO_AGENT calling function
        const delegateFn = await this.callingFunctionRepo.findByName(ctx.workspaceId, fnName)

        if (delegateFn && delegateFn.executionType === "DELEGATE_TO_AGENT" && delegateFn.attachedFlowKey) {
          // ── 5c-i. DELEGATE_TO_FLOW — delegate to another FlowNodeConfig sub-LLM ──
          const targetFlowKey = delegateFn.attachedFlowKey
          const machineNumber = String(fnArgs.machineNumber ?? "")

          logger.info("🔑 FlowAgentLLM: DELEGATE_TO_FLOW", { fnName, targetFlowKey, machineNumber })

          // Update chatContext — strategy will immediately invoke sub-LLM this turn
          chatContext.flowKey = targetFlowKey
          chatContext.flowNumber = machineNumber

          // Extract locale and machineType from fnArgs only — LLM is responsible for extraction,
          // no hardcoded keyword patterns (rule #14)
          const localeFromArgs = this.extractFromArgs(fnArgs, "locale")
          const machineTypeFromArgs = this.extractFromArgs(fnArgs, "machineType")

          // Persist gathered info into gatherState for future turns
          chatContext.gatherState = {
            locale: localeFromArgs || chatContext.gatherState?.locale,
            machineType: machineTypeFromArgs || chatContext.gatherState?.machineType,
            machineNumber: machineNumber || chatContext.gatherState?.machineNumber,
            retryCount: 0,
          }

          logger.info("📍 FlowAgentLLM: gatherState saved", { gatherState: chatContext.gatherState })

          functionCalls.push({
            name: fnName,
            arguments: fnArgs,
            result: {
              type: "DELEGATE_TO_FLOW",
              attachedFlowKey: targetFlowKey,
              machineNumber,
            },
          })
        } else if (delegateFn && delegateFn.executionType === "DELEGATE_TO_AGENT" && delegateFn.attachedLlm) {
          // ── 5c-ii. DELEGATE_TO_AGENT_LLM — delegate to a peer AgentConfig agent ──
          // e.g. CUSTOMER_SUPPORT, PROFILE_MANAGEMENT
          const agentType = delegateFn.attachedLlm // e.g. "CUSTOMER_SUPPORT"
          const query = String(fnArgs.query ?? ctx.message)

          logger.info("🤝 FlowAgentLLM: DELEGATE_TO_AGENT_LLM", { fnName, agentType, query })

          functionCalls.push({
            name: fnName,
            arguments: fnArgs,
            result: {
              type: "DELEGATE_TO_AGENT_LLM",
              agentType,
              query,
            },
          })
        } else {
          logger.warn("FlowAgentLLM: unknown tool_call", { fnName })
        }
      }
    }

    // If no tool_call and LLM returned text → plain FAQ/info answer
    if (toolCalls.length === 0 && !output) {
      output = "I'm here to help. Please describe your issue."
    }

    // Escalation policy (aligned with docs/ecolaundry/flows/flow1-router.md):
    //   Escalation happens ONLY via:
    //   (1) LLM calls `contactOperator` tool — user asks for human / is frustrated / ambiguous case
    //   (2) Flow sub-node with action: "escalate" (handled by FlowEngineService) — alarm in flow
    //   (3) Well-defined Playbook triggers (angry, contradictions, unknown error, manual activation,
    //       compensation, fraud, camera/AJAX incidents, dataphone overcharges)
    // Retry-based auto-escalation was removed: it fired on normal FAQ/greeting turns and
    // is not documented in the Playbook.

    const executionTimeMs = Date.now() - startTime

    logger.info("✅ FlowAgentLLM: completed", {
      workspaceId: ctx.workspaceId,
      tokensUsed,
      executionTimeMs,
      toolCallCount: toolCalls.length,
      shouldCallOperator,
    })

    return {
      success: true,
      output,
      chatContext,
      tokensUsed,
      executionTimeMs,
      functionCalls,
      shouldCallOperator,
      operatorCallResult,
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Build OpenAI-compatible tool definitions dynamically from DB config.
   *
   * Router mode (flowKey === "router"):
   *   Loads DELEGATE_TO_AGENT calling functions with attachedFlowKey from DB.
   *   Builds one tool per sub-LLM. Replaces the old assignMachine tool.
   *
   * Sub-LLM mode (any other flowKey):
   *   Builds startFlow tool using flow IDs from the FlowNodeConfig.
   *
   * Security: tool names and enums come from DB only — customer cannot inject arbitrary values.
   */
  /**
   * Extract a value from tool_call arguments.
   * The LLM is responsible for extracting locale/machineType from conversation —
   * NO hardcoded keyword patterns here (rule #14: no includes("string")).
   * If the LLM didn't provide a value in fnArgs, return undefined.
   */
  private extractFromArgs(fnArgs: Record<string, unknown>, field: string): string | undefined {
    const value = fnArgs[field]
    return typeof value === "string" && value.trim() ? value.trim() : undefined
  }

  /**
   * Filter availableFunctions based on workspace boolean flags.
   * If a workspace setting is false, the corresponding CF is removed from the list.
   * This enforces that workspace settings command the ENTIRE system — not just the UI.
   */
  filterByWorkspaceSettings(
    availableFunctions: string[],
    workspace: Record<string, unknown> | null
  ): string[] {
    if (!workspace) return availableFunctions

    return availableFunctions.filter(fnName => {
      // hasHumanSupport = false → remove contactOperator + customerSupportAgent
      if (fnName === "contactOperator" && workspace.hasHumanSupport === false) return false
      if (fnName === "customerSupportAgent" && workspace.hasHumanSupport === false) return false
      // needRegistration = false → remove profileManagementAgent + manageNotifications
      if (fnName === "profileManagementAgent" && workspace.needRegistration === false) return false
      if (fnName === "manageNotifications" && workspace.needRegistration === false) return false
      // hasProductCatalog = false → remove productSearchAgent
      if (fnName === "productSearchAgent" && workspace.hasProductCatalog === false) return false
      // hasCart = false → remove cartManagementAgent
      if (fnName === "cartManagementAgent" && workspace.hasCart === false) return false
      // hasOrderTracking = false → remove orderTrackingAgent
      if (fnName === "orderTrackingAgent" && workspace.hasOrderTracking === false) return false
      // enableCalendarBooking = false → remove appointment CFs
      if (workspace.enableCalendarBooking === false && [
        "listAvailableSlots", "bookAppointment", "cancelAppointment",
        "rescheduleAppointment", "getCustomerAppointments"
      ].includes(fnName)) return false
      return true
    })
  }

  private async buildTools(
    flowIds: string[],
    availableFunctions: string[],
    isRouterMode: boolean,
    workspaceId: string,
    workspace?: Record<string, unknown> | null
  ): Promise<Array<Record<string, unknown>>> {
    const tools: Array<Record<string, unknown>> = []

    if (isRouterMode) {
      // Router mode: one DELEGATE_TO_FLOW tool per sub-LLM calling function
      const delegateFns = await this.callingFunctionRepo.findFlowDelegateFunctions(
        workspaceId,
        availableFunctions
      )

      for (const fn of delegateFns) {
        // Use custom parameters schema from DB — NO hardcoded fallback.
        // Each CallingFunction MUST define its own parameters in the DB.
        // If missing, use a minimal generic schema.
        const parametersSchema = fn.parameters ?? {
          type: "object",
          properties: {},
          required: [],
        }

        tools.push({
          type: "function",
          function: {
            name: fn.functionName,
            description:
              fn.description ??
              `Delegate to the ${fn.attachedFlowKey} specialist agent after collecting the machine number.`,
            parameters: parametersSchema,
          },
        })
      }
    } else if (flowIds.length > 0) {
      // Sub-LLM mode: startFlow tool constrained to this config's flow IDs
      tools.push({
        type: "function",
        function: {
          name: "startFlow",
          description:
            "Start a guided flow for a specific problem or topic. " +
            "Call this when the customer describes an issue that matches a known flow. " +
            "Do NOT call this if the customer is asking a general question.",
          parameters: {
            type: "object",
            properties: {
              flowId: {
                type: "string",
                enum: flowIds,
                description: "The flow ID to start. Must match one of the configured flow keys.",
              },
            },
            required: ["flowId"],
          },
        },
      })
    }

    if (availableFunctions.includes("contactOperator")) {
      tools.push({
        type: "function",
        function: {
          name: "contactOperator",
          description:
            "Contact a human operator when the issue cannot be resolved by the flow, " +
            "or when the customer explicitly requests human assistance.",
          parameters: {
            type: "object",
            properties: {
              reason: {
                type: "string",
                description: "Brief reason for escalating to operator.",
              },
            },
            required: [],
          },
        },
      })
    }

    if (availableFunctions.includes("resetSession")) {
      tools.push({
        type: "function",
        function: {
          name: "resetSession",
          description:
            "Reset the session and clear all gathered context when the customer made a mistake " +
            "or wants to start over from the beginning.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      })
    }

    return tools
  }
}
