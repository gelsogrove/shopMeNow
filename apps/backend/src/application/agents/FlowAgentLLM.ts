/**
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
    const tools = await this.buildTools(flowIds, availableFunctions, isRouterMode, ctx.workspaceId)

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
        output = "No problem! Let's start over. 😊 Are you having an issue with a washer or a dryer?"
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

          // Extract locale and machineType — from fnArgs (explicit) or conversation history (fallback)
          const localeFromArgs = (fnArgs.locale as string) || undefined
          const machineTypeFromArgs = (fnArgs.machineType as string) || undefined
          const localeFromHistory = localeFromArgs || this.extractFromHistory(history, "locale")
          const machineTypeFromHistory = machineTypeFromArgs || this.extractFromHistory(history, "machineType")

          // Persist gathered info into gatherState for future turns
          chatContext.gatherState = {
            locale: localeFromHistory || chatContext.gatherState?.locale,
            machineType: machineTypeFromHistory || chatContext.gatherState?.machineType,
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

    // Router gather retry tracking — increment retryCount ONLY when:
    //   (a) gather mode has already started (at least one piece of info collected), AND
    //   (b) the user made no new progress this turn.
    // FAQ / greeting / general chat must NEVER count as failed retries, otherwise the bot
    // escalates to operator during normal conversations that don't involve a machine problem.
    if (ctx.flowKey === "router" && toolCalls.length === 0) {
      const prev = chatContext.gatherState ?? { retryCount: 0 }

      // Detect info from history + current message (cumulative on purpose — any sign of
      // gather progress is enough to (a) mark gather mode as started and (b) reset retry).
      const historyWithCurrent: Message[] = [...history, { role: "user", content: ctx.message }]
      const detectedLocale = this.extractFromHistory(historyWithCurrent, "locale")
      const detectedMachineType = this.extractFromHistory(historyWithCurrent, "machineType")
      const numericMatch = ctx.message.trim().match(/^(\d{1,2})$/)
      // Only treat a bare number as machineNumber if gather mode is already active for this
      // conversation. Avoids "5" during an FAQ (e.g. hours, prices) being misread as a machine id.
      const gatherAlreadyStarted = !!(prev.locale || prev.machineType || prev.machineNumber)
      const detectedMachineNumber = numericMatch && gatherAlreadyStarted
        ? numericMatch[1]
        : prev.machineNumber

      const progressed =
        (!!detectedLocale && detectedLocale !== prev.locale) ||
        (!!detectedMachineType && detectedMachineType !== prev.machineType) ||
        (!!detectedMachineNumber && detectedMachineNumber !== prev.machineNumber)

      const gatherModeActive = gatherAlreadyStarted || progressed

      if (progressed) {
        chatContext.gatherState = {
          locale: detectedLocale ?? prev.locale,
          machineType: detectedMachineType ?? prev.machineType,
          machineNumber: detectedMachineNumber ?? prev.machineNumber,
          retryCount: 0,
        }
        logger.info("📍 FlowAgentLLM: gather progress — retry reset", {
          gatherState: chatContext.gatherState,
        })
      } else if (!gatherModeActive) {
        // Not in gather mode (greeting, FAQ, small talk) — do not touch retry counter
        logger.info("💬 FlowAgentLLM: non-gather turn — retry counter untouched")
      } else {
        const currentRetry = prev.retryCount ?? 0
        chatContext.gatherState = {
          ...prev,
          retryCount: currentRetry + 1,
        }
        logger.info("⚠️ FlowAgentLLM: no gather progress — retry incremented", {
          retryCount: chatContext.gatherState.retryCount,
        })
        if (chatContext.gatherState.retryCount >= 3) {
          logger.info("🚨 FlowAgentLLM: gatherState retryCount >= 3 → escalating to operator")
          shouldCallOperator = true
          functionCalls.push({ name: "contactOperator", arguments: { reason: "Max gather retries exceeded" }, result: "deferred_to_strategy" })
        }
      }
    }

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
   * Extracts locale or machineType from conversation history as fallback
   * when the LLM didn't include them in the tool call arguments.
   */
  private extractFromHistory(history: Message[], field: "locale" | "machineType"): string | undefined {
    const locales = ["goya", "pineda", "l'escala", "lescala", "alemanya", "hortes"]
    const washerPatterns = ["lavatrice", "washer", "lavadora", "washing machine"]
    const dryerPatterns = ["asciugatrice", "dryer", "secadora", "drying machine"]

    // Scan user messages newest-first so a self-correction ("wait, actually the dryer")
    // wins over an earlier mention. Within a single message, honor positional order —
    // whichever keyword appears LATER in the text is the user's final intent.
    const userMessages = history
      .filter((m) => m.role === "user")
      .map((m) => (m.content as string).toLowerCase())

    for (let i = userMessages.length - 1; i >= 0; i--) {
      const text = userMessages[i]

      if (field === "locale") {
        let bestLocale: string | undefined
        let bestIdx = -1
        for (const l of locales) {
          const idx = text.lastIndexOf(l)
          if (idx > bestIdx) {
            bestIdx = idx
            bestLocale = l
          }
        }
        if (bestLocale) return bestLocale.replace("lescala", "l'escala")
      }

      if (field === "machineType") {
        const washerIdx = Math.max(...washerPatterns.map((p) => text.lastIndexOf(p)))
        const dryerIdx = Math.max(...dryerPatterns.map((p) => text.lastIndexOf(p)))
        if (washerIdx < 0 && dryerIdx < 0) continue
        return washerIdx > dryerIdx ? "lavatrice" : "asciugatrice"
      }
    }
    return undefined
  }

  private async buildTools(
    flowIds: string[],
    availableFunctions: string[],
    isRouterMode: boolean,
    workspaceId: string
  ): Promise<Array<Record<string, unknown>>> {
    const tools: Array<Record<string, unknown>> = []

    if (isRouterMode) {
      // Router mode: one DELEGATE_TO_FLOW tool per sub-LLM calling function
      const delegateFns = await this.callingFunctionRepo.findFlowDelegateFunctions(
        workspaceId,
        availableFunctions
      )

      for (const fn of delegateFns) {
        // Use custom parameters schema if provided, otherwise default to machineNumber
        const parametersSchema = fn.parameters ?? {
          type: "object",
          properties: {
            machineNumber: {
              type: "string",
              description: "Machine number found on the label (e.g. '42').",
            },
            locale: {
              type: "string",
              description: "Laundry location name (e.g. 'Goya', 'Pineda', 'L\\'Escala', 'Alemanya', 'Hortes').",
            },
            machineType: {
              type: "string",
              description: "Machine type: 'lavatrice' or 'asciugatrice'.",
            },
          },
          required: ["machineNumber"],
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
            "Start a troubleshooting flow for a specific machine problem. " +
            "Call this when the customer describes a symptom that matches a known flow. " +
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
            "Reset the session and clear the machine assignment when the customer made a mistake " +
            "(wrong machine type, wrong number) or wants to start over from the beginning.",
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
