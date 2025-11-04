/**
 * LLMRouterService - Multi-Agent System with Specialist Agents
 *
 * ✅ CLEAN ARCHITECTURE: Each LLM has its own responsibility, NEVER mixed!
 *
 * Architecture:
 * 1. Router LLM → Delegates to Specialist Agents (NEVER executes directly)
 * 2. Specialist Agents (with OWN LLM) → Execute specific tasks
 *    - ProductSearchAgentLLM: Product search/filtering
 *    - CartManagementAgentLLM: Cart operations
 *    - OrderTrackingAgentLLM: Order tracking/history
 *    - CustomerSupportAgentLLM: FAQ/support tickets
 * 3. SafetyTranslationAgent → Validates and translates to customer language
 * 4. LinkReplacementService → Replaces [LINK_xxx] tokens with real URLs
 *
 * Flow:
 * 1. FAQ Check (fast path - skip LLM if FAQ match found)
 * 2. Load conversation history (last 10 minutes)
 * 3. Call Router LLM with delegation functions
 * 4. Router delegates → Specialist Agent (with OWN LLM + prompt from DB)
 * 5. Specialist Agent returns English response with [LINK_xxx] tokens
 * 6. Router processes specialist response
 * 7. Final response → SafetyTranslationAgent (translation + safety check)
 * 8. LinkReplacementService → Replace tokens with secure URLs
 * 9. Save all messages to conversation_messages
 *
 * Security:
 * - ALL queries filtered by workspaceId (multi-tenant isolation)
 * - Each specialist loads its own prompt from database (agentConfig table)
 * - NO hardcoded prompts or data
 * - NO mixing of responsibilities between LLMs
 *
 * @architecture Clean Architecture with Dependency Injection
 * @critical NEVER call LLMService - it's the old monolithic system
 * @critical ALWAYS use Specialist Agents with their OWN LLM
 * @critical ALWAYS pass final response through SafetyTranslationAgent
 */

import { AgentType, PrismaClient } from "@prisma/client"
import axios from "axios"
import { CartManagementAgentLLM } from "../application/agents/CartManagementAgentLLM"
import { CustomerSupportAgentLLM } from "../application/agents/CustomerSupportAgentLLM"
import { OrderTrackingAgentLLM } from "../application/agents/OrderTrackingAgentLLM"
import { ProductSearchAgentLLM } from "../application/agents/ProductSearchAgentLLM"
import { SafetyTranslationAgent } from "../application/agents/SafetyTranslationAgent"
import { LinkReplacementService } from "../application/services/link-replacement.service"
import { getFunctionsForRouter } from "../config/agent-functions"
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
  executionTimeMs: number // ✅ Total execution time for entire flow
  timestamp: string
}

export interface DebugStep {
  type:
    | "router"
    | "function_call"
    | "function_result"
    | "safety"
    | "sub_agent"
    | "token-replacement" // NEW: Token replacement step
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
    // Token replacement specific
    responseWithTokens?: string
    tokensDetected?: string[]
    // Sub-agent delegation specific
    delegatedFrom?: string
    functionCalled?: string
    parameters?: any
    internalFunctionCalls?: any[]
  }
  output?: {
    decision?: string
    functionCall?: string
    textResponse?: string
    translatedText?: string
    safe?: boolean
    result?: any
    executionTimeMs?: number
    // Token replacement specific
    message?: string
    process?: string
    // Sub-agent specific
    responseText?: string
    language?: string
    containsTokens?: boolean
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
  // 🆕 For sub-agent delegation tracking
  isSubAgent?: boolean
  parentAgent?: string
  subAgentType?: string
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
  private linkReplacementService: LinkReplacementService
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
    this.linkReplacementService = new LinkReplacementService()

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

      // STEP 4.5: Load customer data and dynamic content for Router prompt
      logger.info("Step 4.5: Loading customer data and dynamic content")
      const customer = await this.prisma.customers.findUnique({
        where: { id: params.customerId },
        include: { sales: true },
      })

      if (!customer) {
        throw new Error(`Customer ${params.customerId} not found`)
      }

      const workspace = await this.prisma.workspace.findUnique({
        where: { id: params.workspaceId },
      })

      const messageRepo =
        new (require("../repositories/message.repository").MessageRepository)()

      const [categories, offers, products, services, faqs, lastOrder] =
        await Promise.all([
          messageRepo.getActiveCategories(params.workspaceId),
          messageRepo.getActiveOffers(params.workspaceId),
          messageRepo.getActiveProducts(
            params.workspaceId,
            customer.discount || 0
          ),
          messageRepo.getActiveServices(params.workspaceId),
          messageRepo.getActiveFaqs(params.workspaceId),
          this.prisma.orders.findFirst({
            where: { customerId: customer.id },
            orderBy: { createdAt: "desc" },
            select: { orderCode: true },
          }),
        ])

      // Helper function to get language display name
      const getLanguageDisplayName = (
        languageCode: string | null | undefined
      ): string => {
        if (!languageCode || languageCode.trim() === "") {
          return "ITALIANO"
        }
        const languageMap: Record<string, string> = {
          it: "ITALIANO",
          en: "ENGLISH",
          es: "ESPAÑOL",
          pt: "PORTUGUÊS",
          IT: "ITALIANO",
          ENG: "ENGLISH",
          ESP: "ESPAÑOL",
          PRT: "PORTUGUÊS",
        }
        return languageMap[languageCode] || "ITALIANO"
      }

      // Build customerData object with all variables
      const customerData = {
        nameUser: customer.name || "",
        discountUser: customer.discount || 0,
        companyName: customer.company || "",
        lastordercode: lastOrder?.orderCode || "",
        languageUser: getLanguageDisplayName(
          customer.language || workspace?.language || "it"
        ),
        agentName: customer.sales
          ? `${customer.sales.firstName} ${customer.sales.lastName}`.trim()
          : "Non assegnato",
        agentPhone: customer.sales?.phone || "N/A",
        agentEmail: customer.sales?.email || "N/A",
        push_notifications_consent: customer.push_notifications_consent,
      }

      logger.info("📦 Customer data and dynamic content loaded for Router", {
        nameUser: customerData.nameUser,
        discount: customerData.discountUser,
        hasProducts: !!products,
        hasCategories: !!categories,
        hasOffers: !!offers,
        hasServices: !!services,
        hasFAQs: !!faqs,
      })

      // Process Router prompt with variable replacement
      const PromptProcessorService =
        require("./prompt-processor.service").PromptProcessorService
      const promptProcessor = new PromptProcessorService()

      const processedRouterPrompt = await promptProcessor.preProcessPrompt(
        routerAgent.systemPrompt,
        params.workspaceId,
        customerData,
        {
          faqs: faqs || "",
          products: products || "",
          categories: categories || "",
          services: services || "",
          offers: offers || "",
        },
        workspace?.url
      )

      logger.info("✅ Router prompt processed with variables replaced")

      // Create processed router agent with replaced prompt
      const processedRouterAgent = {
        ...routerAgent,
        systemPrompt: processedRouterPrompt,
      }

      // STEP 5: Function Calling Loop
      logger.info("Step 3: Starting Function Calling loop")
      const result = await this.functionCallingLoop({
        routerAgent: processedRouterAgent,
        conversationHistory,
        userMessage: params.message,
        params,
      })

      totalTokens = result.tokensUsed

      // 🔧 NEW: Collect debug steps from function calling loop
      const debugSteps = result.debugSteps || []

      // STEP 5.5: Token Replacement (if any tokens were replaced)
      // Extract link replacement info from last agent step (if present)
      const lastAgentStep = debugSteps.find(
        (step) =>
          step.type !== "router" &&
          step.type !== "safety" &&
          step.type !== "token-replacement"
      )

      // Check if response contains any token placeholders that will be replaced
      const hasTokens =
        result.response.includes("[LINK_") ||
        result.response.includes("_TOKEN]")

      // STEP 4: Replace tokens BEFORE Safety & Translation
      // This ensures Safety agent receives actual URLs, not tokens
      logger.info("Step 4: Replacing tokens in response (BEFORE Safety)")
      const linkReplacementTimestamp = new Date().toISOString()

      let responseWithLinks = result.response

      // Detect tokens in multiple formats:
      // - [LINK_XXX] (plain)
      // - (LINK_XXX) (Markdown without square brackets)
      // - [text](LINK_XXX)
      // - [text]([LINK_XXX])
      const tokensDetected = [
        ...(result.response.match(/\[LINK_[A-Z_]+\]/g) || []),
        ...(result.response.match(/\(LINK_[A-Z_]+\)/g) || []),
        ...(result.response.match(/\[[^\]]+\]\(LINK_[A-Z_]+\)/g) || []),
      ]

      // Remove duplicates
      const uniqueTokens = [...new Set(tokensDetected)]

      if (uniqueTokens.length > 0) {
        logger.info(
          `🔗 Found ${uniqueTokens.length} tokens to replace:`,
          uniqueTokens
        )
        logger.info(`🔗 Input to linkReplacementService:`, {
          response: result.response.substring(0, 200),
          customerId: params.customerId,
          workspaceId: params.workspaceId,
        })

        // ========================================================================
        // CRITICAL: ORDER CODE DETECTION LOGIC
        // ========================================================================
        // This logic determines the correct URL format for order links:
        //
        // 1️⃣ SINGLE ORDER (1 code detected):
        //    Response: "Your order ORD-048 is ready!"
        //    Link: /orders-public/ORD-048-2025-9?token=xxx
        //    → Includes orderCode in URL path for direct order view
        //
        // 2️⃣ MULTIPLE ORDERS (2+ codes detected):
        //    Response: "Your last 3 orders: ORD-048, ORD-044, ORD-040..."
        //    Link: /orders-public?token=xxx
        //    → NO orderCode in path, shows customer's full order list
        //
        // 3️⃣ NO ORDERS (0 codes detected):
        //    Response: "Click here to see your order history"
        //    Link: /orders-public?token=xxx
        //    → NO orderCode in path, shows full order list
        //
        // WHY THIS MATTERS:
        // - Specific link (/orders-public/ORD-XXX) opens single order detail
        // - General link (/orders-public) shows paginated list of ALL orders
        // - Wrong format causes 404 or shows wrong data
        //
        // REGEX: /ORD-[0-9-]+/g matches format "ORD-048-2025-9"
        // ========================================================================

        const orderCodes = result.response.match(/ORD-[0-9-]+/g) || []

        // ⚠️ CRITICAL DECISION: Only use specific link if EXACTLY ONE order code
        const orderCode = orderCodes.length === 1 ? orderCodes[0] : undefined

        logger.info(
          `🔗 Detected ${orderCodes.length} order code(s):`,
          orderCodes
        )
        logger.info(
          `🔗 Using orderCode for link:`,
          orderCode || "NONE (general list link)"
        )

        const linkResult = await this.linkReplacementService.replaceTokens(
          {
            response: result.response,
            orderCode, // Only set if single order, otherwise undefined → general link
          },
          params.customerId,
          params.workspaceId
        )

        logger.info(`🔗 Link replacement result:`, {
          success: linkResult.success,
          hasResponse: !!linkResult.response,
          responsePreview: linkResult.response?.substring(0, 200),
          error: linkResult.error,
        })

        if (linkResult.success && linkResult.response) {
          responseWithLinks = linkResult.response
          logger.info("✅ Link replacement successful - URLs replaced!")
        } else {
          logger.warn("⚠️ Link replacement failed:", {
            success: linkResult.success,
            error: linkResult.error,
            willUseOriginal: true,
          })
        }

        // 🔧 ADD DEBUG STEP: Link Replacement
        debugSteps.push({
          type: "token-replacement",
          agent: "Link Replacement Service",
          model: "N/A", // Not an LLM
          temperature: 0,
          timestamp: linkReplacementTimestamp,
          tokenUsage: undefined,
          input: {
            responseWithTokens: result.response,
            tokensDetected: uniqueTokens,
          },
          output: {
            message: linkResult.response || result.response,
            process: `Replaced ${linkResult.success ? uniqueTokens.length : 0} token(s) - JWT generation + URL creation`,
          },
        })
      } else {
        logger.info(
          "ℹ️ No tokens found in response - skipping link replacement"
        )
      }

      // STEP 4.5: Replace {{TOKEN_DURATION}} variable
      const tokenDuration = this.formatTokenDuration(
        process.env.TOKEN_EXPIRATION || "1h"
      )
      responseWithLinks = responseWithLinks.replace(
        /\{\{TOKEN_DURATION\}\}/g,
        tokenDuration
      )
      logger.info(`✅ Replaced {{TOKEN_DURATION}} with: ${tokenDuration}`)

      // STEP 5: Apply Safety & Translation Layer
      // Now processes the response WITH actual URLs (not tokens)
      logger.info("Step 5: Applying Safety & Translation Layer")
      const safetyTimestamp = new Date().toISOString()
      const safeResponse = await this.safetyAgent.process({
        workspaceId: params.workspaceId,
        response: responseWithLinks, // ✅ Pass response with links already replaced
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
          textToValidate: responseWithLinks, // ✅ Input now has actual URLs
          previousResponse: "Router generated response (with links replaced)",
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

      // STEP 5.5: Clean up punctuation attached to URLs (Safety may add punctuation)
      // Example: "http://localhost:3000/s/xyz." → "http://localhost:3000/s/xyz ."
      // Example: "http://localhost:3000/s/xyz)." → "http://localhost:3000/s/xyz ."
      let finalCleanResponse = safeResponse.translatedText

      // Regex to find URLs ending with short paths (like /s/xxx) followed by punctuation
      // This avoids matching domain dots like "localhost:3000"
      const urlWithPunctuationRegex =
        /(https?:\/\/[^\s]+\/[a-zA-Z0-9_-]+)([\.!?,;:\)]+)(\s|$)/g

      const urlMatches = finalCleanResponse.match(urlWithPunctuationRegex)
      if (urlMatches && urlMatches.length > 0) {
        logger.info(`🧹 Cleaning punctuation from ${urlMatches.length} URL(s)`)

        finalCleanResponse = finalCleanResponse.replace(
          urlWithPunctuationRegex,
          (match, url, punctuation, trailing) => {
            // Remove closing parenthesis from punctuation if present (artifact from Markdown)
            const cleanPunct = punctuation.replace(/\)/g, "")
            if (!cleanPunct) {
              // If only ) was there, just return URL with trailing
              return `${url}${trailing}`
            }
            // Move punctuation after the URL with a space
            logger.debug(
              `Cleaned: "${url}${punctuation}" → "${url}${trailing}${cleanPunct}"`
            )
            return `${url}${trailing}${cleanPunct}`
          }
        )
      }

      // STEP 6: Save final assistant message (with links replaced and translation applied)
      await this.conversationManager.saveAssistantMessage({
        workspaceId: params.workspaceId,
        customerId: params.customerId,
        conversationId: params.conversationId,
        content: finalCleanResponse, // ✅ Final response with links + translation + cleanup
        agentType: "ROUTER",
        tokensUsed: totalTokens,
      })

      const executionTimeMs = Date.now() - startTime

      logger.info("✅ Message routed successfully", {
        executionTimeMs,
        totalTokens,
        iterations: result.iterations,
        linksReplaced: tokensDetected.length,
        safetyApproved: safeResponse.safe,
        urlsCleaned: finalCleanResponse !== safeResponse.translatedText,
      })

      // 🔧 NEW: Calculate total cost (OpenRouter pricing)
      const costPerMillionTokens = 0.15 // GPT-4o-mini average cost
      const totalCost = (totalTokens / 1_000_000) * costPerMillionTokens

      return {
        response: finalCleanResponse, // ✅ Return final clean response (links + translation + punctuation fix)
        agentUsed: result.agentUsed || "ROUTER",
        confidence: result.confidence || 0.9,
        tokensUsed: totalTokens,
        executionTimeMs,
        wasFAQ: false,
        debugInfo: {
          steps: debugSteps,
          totalTokens,
          totalCost,
          executionTimeMs, // ✅ Add executionTimeMs to debugInfo for frontend
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

      // 🔧 Pass generic error message through Safety/Translation layer
      const errorResponse = await this.safetyAgent.process({
        workspaceId: params.workspaceId,
        response: "System error - please try again",
        targetLanguage: params.customerLanguage,
        customerName: params.customerName,
      })

      return {
        response: errorResponse.translatedText,
        tokensUsed: 0,
        executionTimeMs,
        agentUsed: "ROUTER" as AgentType,
        confidence: 0,
        wasFAQ: false,
        debugInfo: {
          steps: [],
          totalTokens: 0,
          totalCost: 0,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        },
      }
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

        // 🎯 DEBUG: Log function result structure
        logger.info("🔍 Function result structure:", {
          hasData: !!functionResult.data,
          hasDelegateTo: !!functionResult.data?.delegateTo,
          functionResult: JSON.stringify(functionResult),
        })

        // 🎯 CHECK IF THIS IS A DELEGATION REQUEST
        if (functionResult.data?.delegateTo) {
          const delegationTarget = functionResult.data.delegateTo
          const delegationQuery = functionResult.data.query

          logger.info(`🔀 Delegation detected to: ${delegationTarget}`, {
            query: delegationQuery,
          })

          // Get customer full info with sales agent
          const customer = await this.prisma.customers.findUnique({
            where: { id: params.customerId },
            include: {
              sales: true,
            },
          })

          if (!customer) {
            throw new Error(`Customer not found: ${params.customerId}`)
          }

          // Get workspace info
          const workspace = await this.prisma.workspace.findUnique({
            where: { id: params.workspaceId },
          })

          if (!workspace) {
            throw new Error(`Workspace not found: ${params.workspaceId}`)
          }

          // Get catalog data for sub-agent
          const customerDiscount = customer.discount || 0
          const messageRepo =
            new (require("../repositories/message.repository").MessageRepository)()

          const [categories, offers, products, lastOrder] = await Promise.all([
            messageRepo.getActiveCategories(params.workspaceId),
            messageRepo.getActiveOffers(params.workspaceId),
            messageRepo.getActiveProducts(params.workspaceId, customerDiscount),
            this.prisma.orders.findFirst({
              where: { customerId: customer.id },
              orderBy: { createdAt: "desc" },
              select: { orderCode: true },
            }),
          ])

          // Helper function to get language display name
          const getLanguageDisplayName = (
            languageCode: string | null | undefined
          ): string => {
            if (!languageCode || languageCode.trim() === "") {
              return "ITALIANO"
            }
            const languageMap: Record<string, string> = {
              it: "ITALIANO",
              en: "ENGLISH",
              es: "ESPAÑOL",
              pt: "PORTUGUÊS",
              IT: "ITALIANO",
              ENG: "ENGLISH",
              ESP: "ESPAÑOL",
              PRT: "PORTUGUÊS",
            }
            return languageMap[languageCode] || "ITALIANO"
          }

          // Build customerData object with all variables
          const customerData = {
            nameUser: customer.name || "",
            discountUser: customer.discount || 0,
            companyName: customer.company || "",
            lastordercode: lastOrder?.orderCode || "",
            languageUser: getLanguageDisplayName(
              customer.language || workspace.language || "it"
            ),
            agentName: customer.sales
              ? `${customer.sales.firstName} ${customer.sales.lastName}`.trim()
              : "Non assegnato",
            agentPhone: customer.sales?.phone || "N/A",
            agentEmail: customer.sales?.email || "N/A",
            PRODUCTS: products || "",
            CATEGORIES: categories || "",
            OFFERS: offers || "",
          }

          logger.info("📦 Customer data prepared for sub-agent", {
            nameUser: customerData.nameUser,
            discount: customerData.discountUser,
            hasProducts: !!products,
            hasCategories: !!categories,
            hasOffers: !!offers,
            productsLength: products?.length || 0,
          })

          // ✅ CALL SPECIALIST AGENTS with OWN LLM (NO LLMService!)
          // Each specialist has its own LLM instance and system prompt from database
          let subAgentResponse: any

          switch (delegationTarget) {
            case "PRODUCT_SEARCH": {
              const productSearchAgent = new ProductSearchAgentLLM(this.prisma)
              subAgentResponse = await productSearchAgent.handleQuery({
                workspaceId: params.workspaceId,
                customerId: params.customerId,
                customerName: params.customerName,
                customerLanguage: params.customerLanguage,
                query: delegationQuery,
              })
              break
            }
            case "CART_MANAGEMENT": {
              const cartManagementAgent = new CartManagementAgentLLM(
                this.prisma
              )
              subAgentResponse = await cartManagementAgent.handleQuery({
                workspaceId: params.workspaceId,
                customerId: params.customerId,
                customerName: params.customerName,
                customerLanguage: params.customerLanguage,
                query: delegationQuery,
              })
              break
            }
            case "ORDER_TRACKING": {
              const orderTrackingAgent = new OrderTrackingAgentLLM(this.prisma)
              subAgentResponse = await orderTrackingAgent.handleQuery({
                workspaceId: params.workspaceId,
                customerId: params.customerId,
                customerName: params.customerName,
                customerLanguage: params.customerLanguage,
                query: delegationQuery,
                lastOrderCode: customerData.lastordercode, // ✅ Pass last order code
              })
              break
            }
            case "CUSTOMER_SUPPORT": {
              const customerSupportAgent = new CustomerSupportAgentLLM(
                this.prisma
              )
              subAgentResponse = await customerSupportAgent.handleQuery({
                workspaceId: params.workspaceId,
                customerId: params.customerId,
                customerName: params.customerName,
                customerLanguage: params.customerLanguage,
                query: delegationQuery,
              })
              break
            }
            default:
              throw new Error(`Unknown delegation target: ${delegationTarget}`)
          }

          // Extract response from specialist agent
          // Specialist agents return: { success, output, tokensUsed, executionTimeMs, functionCalls }
          logger.info("🔍 Specialist agent response structure:", {
            success: subAgentResponse.success,
            hasOutput: !!subAgentResponse.output,
            outputLength: subAgentResponse.output?.length || 0,
            tokensUsed: subAgentResponse.tokensUsed,
            executionTimeMs: subAgentResponse.executionTimeMs,
            functionCallsCount: subAgentResponse.functionCalls?.length || 0,
            outputPreview: subAgentResponse.output?.substring(0, 200),
          })

          // Check if specialist agent failed
          if (!subAgentResponse.success) {
            throw new Error(
              `Specialist agent ${delegationTarget} failed: ${subAgentResponse.output}`
            )
          }

          const subAgentFinalResponse = subAgentResponse.output || ""

          logger.info("✅ Specialist agent delegation completed", {
            delegationTarget,
            responseLength: subAgentFinalResponse.length,
            tokensUsed: subAgentResponse.tokensUsed,
            executionTimeMs: subAgentResponse.executionTimeMs,
            responsePreview: subAgentFinalResponse.substring(0, 200),
          })

          // 🆕 CREATE DEBUG STEP FOR SPECIALIST AGENT
          // Specialist agent returns { success, output, tokensUsed, executionTimeMs, functionCalls }

          // 🔧 Extract function calls from specialist agent response
          const subAgentFunctionCalls = subAgentResponse.functionCalls || []
          let subAgentDebugInfo = subAgentResponse.debugInfo
          if (typeof subAgentDebugInfo === "string") {
            try {
              subAgentDebugInfo = JSON.parse(subAgentDebugInfo)
              logger.info("🔍 Parsed sub-agent debugInfo from JSON string")
            } catch (error) {
              logger.error("❌ Failed to parse sub-agent debugInfo:", error)
              subAgentDebugInfo = null
            }
          }

          // 🆕 CREATE DEBUG STEP: Show Router → Specialist Agent delegation with clear INPUT/OUTPUT
          logger.info("🔍 Creating specialist agent debug step", {
            delegationTarget,
            delegationQuery: delegationQuery.substring(0, 50),
            hasDebugInfo: !!subAgentDebugInfo,
            currentDebugStepsCount: debugSteps.length,
          })

          // � CLEAR DEBUG STEP: Show what Router delegated and what Sub-Agent returned
          debugSteps.push({
            type: "sub_agent",
            agent: `${delegationTarget} Agent`,
            timestamp: new Date().toISOString(),
            input: {
              delegatedFrom: "ROUTER",
              functionCalled: delegationTarget,
              parameters: {
                query: delegationQuery,
              },
              // Show internal function calls from specialist agent
              internalFunctionCalls: subAgentFunctionCalls,
            },
            output: {
              responseText: subAgentFinalResponse,
              language: "en", // Specialist agents ALWAYS respond in English
              containsTokens: subAgentFinalResponse.includes("[LINK_"),
              executionTimeMs: subAgentResponse.executionTimeMs,
            },
            tokenUsage: {
              promptTokens: 0,
              completionTokens: subAgentResponse.tokensUsed,
              totalTokens: subAgentResponse.tokensUsed,
            },
            isSubAgent: true,
            parentAgent: "ROUTER",
            subAgentType: delegationTarget,
          })

          logger.info("✅ Specialist agent debug step created", {
            totalDebugSteps: debugSteps.length,
            responseLength: subAgentFinalResponse.length,
            tokensUsed: subAgentResponse.tokensUsed,
            hasTokens: subAgentFinalResponse.includes("[LINK_"),
          })

          // 🔄 CRITICAL: Add specialist agent response to messages and CONTINUE to Router
          // Router LLM will receive this as function result and process it
          messages.push({
            role: "function" as const,
            name: functionName,
            content: subAgentFinalResponse, // Specialist agent's English response
          })

          // Track which agent was used
          agentUsed = delegationTarget

          // Update total tokens (from specialist agent response)
          totalTokens += subAgentResponse.tokensUsed || 0

          logger.info(
            "🔄 Specialist agent response added, continuing to Router for processing",
            {
              agentUsed: delegationTarget,
              responseLength: subAgentFinalResponse.length,
              tokensUsed: subAgentResponse.tokensUsed,
              hasTokens: subAgentFinalResponse.includes("[LINK_"),
              nextIteration: iterations + 1,
            }
          )

          // CONTINUE loop - Router LLM will process specialist agent response
          continue
        }

        // 🔧 OLD PATH: Direct function execution (DEPRECATED - should use delegation instead)
        // This path is for backward compatibility with old function calls
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
          // 🔀 Router has ONLY delegation functions (call sub-agents)
          // Router orchestrates, sub-agents execute business functions
          tools: getFunctionsForRouter(), // Only: callProductSearchAgent, callCartManagementAgent, etc.
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

  /**
   * Format token duration for display in messages
   * @param duration - Duration string (e.g., "1h", "30m", "2h")
   * @returns Formatted duration (e.g., "1 ora", "30 minuti", "2 ore")
   */
  private formatTokenDuration(duration: string): string {
    const match = duration.match(/^(\d+)([hm])$/)
    if (!match) return "1 ora" // Fallback

    const value = parseInt(match[1], 10)
    const unit = match[2]

    if (unit === "h") {
      return value === 1 ? "1 ora" : `${value} ore`
    } else if (unit === "m") {
      return value === 1 ? "1 minuto" : `${value} minuti`
    }

    return "1 ora" // Fallback
  }
}
