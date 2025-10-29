/**
 * LLMRouterService (NEW - Function Calling Architecture)
 *
 * Main orchestration service for multi-agent system with OpenRouter Function Calling.
 *
 * Flow:
 * 1. FAQ Check (fast path)
 * 2. Load conversation history (last 10 minutes)
 * 3. Call Router LLM with functions definitions
 * 4. Loop: Execute functions → Return to LLM (max 5 iterations)
 * 5. Final response → SafetyTranslationAgent
 * 6. Save all messages to conversation_messages
 *
 * @architecture Clean Architecture with Dependency Injection
 * @critical ALWAYS pass final response through SafetyTranslationAgent
 */

import { AgentType, PrismaClient } from "@prisma/client"
import axios from "axios"
import { SafetyTranslationAgent } from "../application/agents/SafetyTranslationAgent"
import { getFunctionsForAPI } from "../config/agent-functions"
import { AgentConfigRepository } from "../repositories/agent-config.repository"
import { FAQRepository } from "../repositories/faq.repository"
import logger from "../utils/logger"
import { AgentLoggerService } from "./agent-logger.service"
import { ConversationManager } from "./conversation-manager.service"
import { FunctionExecutor } from "./function-executor.service"

export interface RouteMessageParams {
  workspaceId: string
  customerId: string
  conversationId: string
  messageId: string
  message: string
  customerLanguage?: string
  customerName?: string
}

export interface RouteMessageResponse {
  response: string
  agentUsed: AgentType
  confidence: number
  tokensUsed: number
  executionTimeMs: number
  wasFAQ: boolean
  faqId?: string
  debugInfo?: DebugInfoSteps // 🔧 NEW: Debug information with execution chain
}

// 🔧 NEW: Debug Info Structure for Message Flow
export interface DebugInfoSteps {
  steps: DebugStep[]
  totalTokens: number
  totalCost: number
  timestamp: string
}

export interface DebugStep {
  type: "router" | "function_call" | "function_result" | "safety" | "sub_agent"
  agent?: string
  model?: string
  temperature?: number
  timestamp: string
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  // 🔧 NEW: Explicit INPUT and OUTPUT for each step
  input?: {
    userMessage?: string
    conversationHistory?: any[]
    functionResult?: any
    textToValidate?: string
    previousResponse?: string
    functionName?: string
    arguments?: any
  }
  output?: {
    decision?: string
    functionCall?: string
    textResponse?: string
    translatedText?: string
    safe?: boolean
    result?: any
    executionTimeMs?: number
  }
  // For router steps
  intent?: string
  functionCallDecision?: string
  // For function call steps
  functionName?: string
  functionArguments?: any
  // For function result steps
  functionResult?: any
  // For safety steps
  safe?: boolean
  language?: string
  blocked?: boolean
  blockedReason?: string
}

interface FAQCheckResult {
  matched: boolean
  faqId?: string
  faqQuestion?: string
  faqAnswer?: string
  confidence?: number
}

export class LLMRouterService {
  private agentConfigRepo: AgentConfigRepository
  private faqRepo: FAQRepository
  private loggerService: AgentLoggerService
  private conversationManager: ConversationManager
  private functionExecutor: FunctionExecutor
  private safetyAgent: SafetyTranslationAgent
  private openRouterApiKey: string
  private openRouterBaseUrl = "https://openrouter.ai/api/v1"
  private maxFunctionIterations = 5

  constructor(private prisma: PrismaClient) {
    this.agentConfigRepo = new AgentConfigRepository(prisma)
    this.faqRepo = new FAQRepository(prisma)
    this.loggerService = new AgentLoggerService(prisma)
    this.conversationManager = new ConversationManager(prisma, 10) // 10 minutes window
    this.functionExecutor = new FunctionExecutor(prisma)
    this.safetyAgent = new SafetyTranslationAgent(prisma)

    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""
    if (!this.openRouterApiKey) {
      logger.warn("⚠️ OPENROUTER_API_KEY not set - LLM calls will fail")
    }

    logger.info("✅ LLMRouterService initialized with Function Calling support")
  }

  /**
   * Main entry point - Route message through multi-agent system
   */
  async routeMessage(
    params: RouteMessageParams
  ): Promise<RouteMessageResponse> {
    const startTime = Date.now()
    let totalTokens = 0

    try {
      logger.info("🎯 Routing message", {
        workspaceId: params.workspaceId,
        customerId: params.customerId,
        conversationId: params.conversationId,
      })

      // STEP 1: FAQ Check (fast path - no LLM needed)
      logger.info("Step 1: FAQ Check")
      const faqResult = await this.checkFAQ(params.workspaceId, params.message)

      if (faqResult.matched && faqResult.confidence! > 0.75) {
        const executionTimeMs = Date.now() - startTime

        // Log FAQ response
        await this.loggerService.logAgentInteraction({
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          conversationId: params.conversationId,
          messageId: params.messageId,
          step: 0,
          agentType: "ROUTER",
          agentAction: "FAQ_MATCH",
          inputMessage: params.message,
          agentPrompt: "FAQ database lookup",
          llmModel: "N/A",
          llmResponse: JSON.stringify(faqResult),
          confidence: faqResult.confidence,
          reasoning: `Matched FAQ: ${faqResult.faqQuestion}`,
          tokensUsed: 0,
          executionTimeMs,
        })

        // FAQ found - apply Safety Layer before returning
        const safeResponse = await this.safetyAgent.process({
          workspaceId: params.workspaceId,
          response: faqResult.faqAnswer!,
          targetLanguage: params.customerLanguage || "it",
          customerName: params.customerName,
        })

        if (!safeResponse.safe) {
          logger.warn("⚠️ FAQ response blocked by safety layer", {
            reason: safeResponse.blockedReason,
          })
        }

        return {
          response: safeResponse.translatedText,
          agentUsed: "ROUTER",
          confidence: faqResult.confidence!,
          tokensUsed: safeResponse.tokensUsed || 0,
          executionTimeMs,
          wasFAQ: true,
          faqId: faqResult.faqId,
        }
      }

      // STEP 2: Load conversation history
      logger.info("Step 2: Loading conversation history")
      const conversationHistory = await this.conversationManager.loadHistory(
        params.workspaceId,
        params.conversationId
      )

      // STEP 3: Save user message
      await this.conversationManager.saveUserMessage({
        workspaceId: params.workspaceId,
        customerId: params.customerId,
        conversationId: params.conversationId,
        content: params.message,
      })

      // STEP 4: Get Router Agent config
      const routerAgent = await this.agentConfigRepo.findByType(
        params.workspaceId,
        "ROUTER"
      )

      if (!routerAgent) {
        throw new Error(
          `Router agent not configured for workspace ${params.workspaceId}`
        )
      }

      // STEP 5: Function Calling Loop
      logger.info("Step 3: Starting Function Calling loop")
      const result = await this.functionCallingLoop({
        routerAgent,
        conversationHistory,
        userMessage: params.message,
        params,
      })

      totalTokens = result.tokensUsed

      // 🔧 NEW: Collect debug steps from function calling loop
      const debugSteps = result.debugSteps || []

      // STEP 6: Apply Safety & Translation Layer
      logger.info("Step 4: Applying Safety & Translation Layer")
      const safetyTimestamp = new Date().toISOString()
      const safeResponse = await this.safetyAgent.process({
        workspaceId: params.workspaceId,
        response: result.response,
        targetLanguage: params.customerLanguage || "it",
        customerName: params.customerName,
      })

      totalTokens += safeResponse.tokensUsed || 0

      // 🔧 NEW: Capture Safety & Translation step with INPUT and OUTPUT
      debugSteps.push({
        type: "safety",
        agent: "Safety & Translation Agent",
        model: routerAgent.model, // Uses same model as router
        temperature: 0.2, // Safety agent uses lower temperature
        timestamp: safetyTimestamp,
        tokenUsage: safeResponse.tokensUsed
          ? {
              promptTokens: 0,
              completionTokens: safeResponse.tokensUsed,
              totalTokens: safeResponse.tokensUsed,
            }
          : undefined,
        input: {
          textToValidate: result.response,
          previousResponse: "Router generated response",
        },
        output: {
          safe: safeResponse.safe,
          translatedText: safeResponse.translatedText,
          decision: safeResponse.safe ? "approved" : "blocked",
        },
        safe: safeResponse.safe,
        language: params.customerLanguage || "it",
        blocked: !safeResponse.safe,
        blockedReason: safeResponse.blockedReason,
      })

      if (!safeResponse.safe) {
        logger.warn("⚠️ Response blocked by safety layer", {
          reason: safeResponse.blockedReason,
        })
      }

      // STEP 7: Save final assistant message
      await this.conversationManager.saveAssistantMessage({
        workspaceId: params.workspaceId,
        customerId: params.customerId,
        conversationId: params.conversationId,
        content: safeResponse.translatedText,
        agentType: "ROUTER",
        tokensUsed: totalTokens,
      })

      const executionTimeMs = Date.now() - startTime

      logger.info("✅ Message routed successfully", {
        executionTimeMs,
        totalTokens,
        iterations: result.iterations,
      })

      // 🔧 NEW: Calculate total cost (OpenRouter pricing)
      const costPerMillionTokens = 0.15 // GPT-4o-mini average cost
      const totalCost = (totalTokens / 1_000_000) * costPerMillionTokens

      return {
        response: safeResponse.translatedText,
        agentUsed: result.agentUsed || "ROUTER",
        confidence: result.confidence || 0.9,
        tokensUsed: totalTokens,
        executionTimeMs,
        wasFAQ: false,
        debugInfo: {
          steps: debugSteps,
          totalTokens,
          totalCost,
          timestamp: new Date().toISOString(),
        },
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime

      logger.error("❌ Error routing message", error)

      // Log error
      await this.loggerService.logAgentInteraction({
        workspaceId: params.workspaceId,
        customerId: params.customerId,
        conversationId: params.conversationId,
        messageId: params.messageId,
        step: 0,
        agentType: "ROUTER",
        agentAction: "ERROR",
        inputMessage: params.message,
        agentPrompt: "Error occurred",
        llmModel: "N/A",
        llmResponse: "",
        executionTimeMs,
        hasError: true,
        errorMessage: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }

  /**
   * Function Calling Loop
   *
   * Iteratively calls Router LLM with function results until:
   * - LLM returns text response (no function_call)
   * - Max iterations reached
   */
  private async functionCallingLoop(options: {
    routerAgent: any
    conversationHistory: any[]
    userMessage: string
    params: RouteMessageParams
  }): Promise<{
    response: string
    tokensUsed: number
    iterations: number
    agentUsed?: AgentType
    confidence?: number
    debugSteps: DebugStep[] // 🔧 NEW: Captured execution steps
  }> {
    const { routerAgent, conversationHistory, userMessage, params } = options

    let messages = [
      { role: "system" as const, content: routerAgent.systemPrompt },
      ...conversationHistory,
      { role: "user" as const, content: userMessage },
    ]

    let totalTokens = 0
    let iterations = 0
    let agentUsed: AgentType = "ROUTER"

    // 🔧 NEW: Track execution steps for debug timeline
    const debugSteps: DebugStep[] = []

    // Loop until max iterations or final response
    while (iterations < this.maxFunctionIterations) {
      iterations++

      logger.info(
        `Function Calling iteration ${iterations}/${this.maxFunctionIterations}`
      )

      // Call Router LLM with functions
      const routerCallTimestamp = new Date().toISOString()
      const llmResponse = await this.callRouterLLM({
        model: routerAgent.model,
        messages,
        temperature: routerAgent.temperature,
        maxTokens: routerAgent.maxTokens,
      })

      totalTokens += llmResponse.tokensUsed

      // 🔧 IMPROVED: Capture Router Agent step with REAL INPUT and OUTPUT
      const routerStep: DebugStep = {
        type: "router",
        agent: "Router Agent",
        model: routerAgent.model,
        temperature: routerAgent.temperature,
        timestamp: routerCallTimestamp,
        tokenUsage: {
          promptTokens: 0,
          completionTokens: llmResponse.tokensUsed,
          totalTokens: llmResponse.tokensUsed,
        },
        input: {
          userMessage, // Always include current user message
          conversationHistory, // Include conversation history from last 5 minutes
          functionResult:
            iterations > 1 ? messages[messages.length - 1]?.content : undefined,
        },
        output: {
          decision: llmResponse.function_call
            ? "call_function"
            : "text_response",
          functionCall: llmResponse.function_call?.name,
          textResponse: !llmResponse.function_call
            ? llmResponse.content
            : undefined,
        },
        functionCallDecision: llmResponse.function_call?.name || "no_function",
        // 🔧 NEW: Include function call details INSIDE router step
        functionName: llmResponse.function_call?.name,
        functionArguments: llmResponse.function_call
          ? JSON.parse(llmResponse.function_call.arguments || "{}")
          : undefined,
      }

      debugSteps.push(routerStep)

      // Check if LLM wants to call a function
      if (llmResponse.function_call) {
        const functionName = llmResponse.function_call.name
        const functionArgs = JSON.parse(
          llmResponse.function_call.arguments || "{}"
        )

        logger.info(`⚙️ LLM requested function: ${functionName}`, {
          args: functionArgs,
        })

        // Save function call
        await this.conversationManager.saveFunctionCall({
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          conversationId: params.conversationId,
          content: JSON.stringify(functionArgs),
          functionName,
          functionArguments: functionArgs,
          agentType: "ROUTER",
        })

        // Execute function
        const functionExecutionStart = Date.now()
        const functionResult = await this.functionExecutor.execute(
          functionName,
          functionArgs,
          {
            workspaceId: params.workspaceId,
            customerId: params.customerId,
            customerName: params.customerName,
            customerLanguage: params.customerLanguage,
          }
        )
        const functionExecutionTime = Date.now() - functionExecutionStart

        // 🔧 Determine which sub-agent was used
        const lowerFunctionName = functionName.toLowerCase()
        let subAgentName = "UNKNOWN"

        if (
          lowerFunctionName.includes("search") ||
          lowerFunctionName.includes("product")
        )
          subAgentName = "Product Search Agent"
        else if (lowerFunctionName.includes("cart"))
          subAgentName = "Cart Management Agent"
        else if (lowerFunctionName.includes("order"))
          subAgentName = "Order Tracking Agent"
        else if (lowerFunctionName.includes("support"))
          subAgentName = "Customer Support Agent"

        // 🆕 ADD SUB-AGENT STEP TO DEBUG INFO
        debugSteps.push({
          type: "sub_agent",
          agent: subAgentName,
          timestamp: new Date().toISOString(),
          input: {
            functionName,
            arguments: functionArgs,
          },
          output: {
            result: functionResult,
            executionTimeMs: functionExecutionTime,
          },
        })

        // 🔧 NEW: Add function result to the Router step we just created
        routerStep.functionResult = functionResult

        // Save function result
        await this.conversationManager.saveFunctionResult({
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          conversationId: params.conversationId,
          content: JSON.stringify(functionResult),
          functionName,
          result: functionResult,
          agentType: functionName.includes("search")
            ? "PRODUCT_SEARCH"
            : "CART_MANAGEMENT",
        })

        // Add function result to messages for next LLM call
        messages.push({
          role: "function" as const,
          name: functionName,
          content: JSON.stringify(functionResult),
        })

        // Determine agent used
        if (functionName.includes("search")) agentUsed = "PRODUCT_SEARCH"
        else if (functionName.includes("cart") || functionName.includes("Cart"))
          agentUsed = "CART_MANAGEMENT"
        else if (
          functionName.includes("order") ||
          functionName.includes("Order")
        )
          agentUsed = "ORDER_TRACKING"
        else if (functionName.includes("support"))
          agentUsed = "CUSTOMER_SUPPORT"

        // Continue loop to get next LLM response
        continue
      }

      // No function_call - LLM returned final text response
      logger.info("✅ LLM returned final response (no function call)")
      return {
        response:
          llmResponse.content || "Sorry, I couldn't process that request.",
        tokensUsed: totalTokens,
        iterations,
        agentUsed,
        confidence: 0.9,
        debugSteps, // 🔧 NEW: Return captured steps
      }
    }

    // Max iterations reached
    logger.warn("⚠️ Max function calling iterations reached")
    return {
      response:
        "I'm processing your request, but it's taking longer than expected. Can you try rephrasing?",
      tokensUsed: totalTokens,
      iterations,
      agentUsed,
      confidence: 0.5,
      debugSteps, // 🔧 NEW: Return captured steps
    }
  }

  /**
   * Call Router LLM with OpenRouter API
   */
  private async callRouterLLM(options: {
    model: string
    messages: any[]
    temperature: number
    maxTokens: number
  }): Promise<{
    content?: string
    function_call?: { name: string; arguments: string }
    tokensUsed: number
  }> {
    try {
      const response = await axios.post(
        `${this.openRouterBaseUrl}/chat/completions`,
        {
          model: options.model,
          messages: options.messages,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          tools: getFunctionsForAPI(), // Add functions from config
        },
        {
          headers: {
            Authorization: `Bearer ${this.openRouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.FRONTEND_URL || "https://shopme.ai",
            "X-Title": "ShopME Multi-Agent Router",
          },
          timeout: 30000,
        }
      )

      const choice = response.data.choices[0]
      const tokensUsed = response.data.usage?.total_tokens || 0

      return {
        content: choice.message.content,
        function_call: choice.message.tool_calls?.[0]?.function,
        tokensUsed,
      }
    } catch (error) {
      logger.error("❌ Error calling Router LLM", error)
      throw error
    }
  }

  /**
   * Check FAQ database for matches
   */
  private async checkFAQ(
    workspaceId: string,
    message: string
  ): Promise<FAQCheckResult> {
    try {
      const faqs = await this.faqRepo.searchByKeywords(workspaceId, message, 3)

      if (faqs.length === 0) {
        return { matched: false }
      }

      const bestMatch = faqs[0]

      // Calculate confidence
      const messageLower = message.toLowerCase()
      let matchCount = 0
      let totalKeywords = 0

      if (bestMatch.keywords && Array.isArray(bestMatch.keywords)) {
        totalKeywords = bestMatch.keywords.length
        for (const keyword of bestMatch.keywords) {
          if (messageLower.includes(keyword.toLowerCase())) {
            matchCount++
          }
        }
      }

      const confidence = totalKeywords > 0 ? matchCount / totalKeywords : 0

      logger.info(
        `FAQ match: "${bestMatch.question}" (confidence: ${confidence.toFixed(2)})`
      )

      return {
        matched: confidence > 0.5,
        faqId: bestMatch.id,
        faqQuestion: bestMatch.question,
        faqAnswer: bestMatch.answer,
        confidence,
      }
    } catch (error) {
      logger.error("Error checking FAQ:", error)
      return { matched: false }
    }
  }
}
