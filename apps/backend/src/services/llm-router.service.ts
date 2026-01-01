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

import { AgentType, PrismaClient } from "@echatbot/database"
import axios from "axios"
import { CartManagementAgentLLM } from "../application/agents/CartManagementAgentLLM"
import { CustomerSupportAgentLLM } from "../application/agents/CustomerSupportAgentLLM"
import { OrderTrackingAgentLLM } from "../application/agents/OrderTrackingAgentLLM"
import { ProductSearchAgentLLM } from "../application/agents/ProductSearchAgentLLM"
import { ProfileManagementAgentLLM } from "../application/agents/ProfileManagementAgentLLM"
import { SafetyTranslationAgent } from "../application/agents/SafetyTranslationAgent"
import { TranslationAgent } from "../application/agents/TranslationAgent"
import { ConversationHistoryLayer } from "../application/layers/ConversationHistoryLayer"
import type { TechnicalResponseType, ActiveOffer, ConversationMessage } from "../application/layers/conversation-history-layer.types"
import { LinkReplacementService } from "../application/services/link-replacement.service"
import { PromptBuilderService } from "../application/services/prompt-builder"
import { PromptVariableBuilder } from "../application/services/prompt-variable-builder.service"
import { TemplateLoaderService } from "../application/services/template-loader.service"
import { getFunctionsForRouter } from "../config/agent-functions"
import { AgentConfigRepository } from "../repositories/agent-config.repository"
import { FAQRepository } from "../repositories/faq.repository"
import { SearchConversationRepository } from "../repositories/searchConversation.repository"
import { PromptVariables } from "../types/prompt-variables.types"
import logger from "../utils/logger"
import { AgentLoggerService } from "./agent-logger.service"
import { ConversationManager } from "./conversation-manager.service"
import { FunctionExecutor } from "./function-executor.service"
import { messagePreprocessorService, PreprocessResult } from "./message-preprocessor.service" // 🆕 FASE 2: Deterministic preprocessing
import { OptionsMappingService } from "../application/chat-engine/options-mapping.service" // 🆕 For pendingAction ADD_TO_CART
import { PromptProcessorService } from "./prompt-processor.service" // 🆕 Feature 124: Customer variables replacement
import { SecurityService } from "./security.service"
import { getSystemContextService, SystemContextService } from "./system-context.service" // 🆕 System Context for hidden SKU mappings
import { websocketService } from "./websocket.service"
import type { AgentOptionMapping } from "../types/option-mapping.types"

// NOTE: Runtime uses per-call scoped values; this declaration satisfies TS where
// option mappings are built inside async flows.
let explicitOptionMapping: AgentOptionMapping | null = null

export interface RouteMessageParams {
  workspaceId: string
  customerId: string
  conversationId: string
  messageId: string
  message: string
  customerLanguage?: string
  customerName?: string
  isSystemMessage?: boolean // 🆕 Feature 127: If true, skip Router/SubLLM and go direct to Safety+Translation
  conversationHistory?: Array<{ role: string; content: string }>
  customerDiscount?: number
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
  isBlocked?: boolean // 🆕 Feature 126: P1 flag - webhook should NOT send message if true
  selectedProduct?: { // 🆕 For pendingAction ADD_TO_CART handoff from ProductSearchAgentLLM
    sku: string
    name: string
    itemType: string
  } | null
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
    | "humanization" // 🆕 Conversation History Layer
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
    // Translation specific
    targetLanguage?: string
    systemPrompt?: string
    // 🆕 Humanization specific
    technicalResponse?: string
    isFirstMessage?: boolean
    hasOffers?: boolean
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
    // 🆕 Humanization specific
    humanizedText?: string
    addedGreeting?: boolean
    suggestedOffers?: boolean
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
  isNested?: boolean // 🆕 For nested/indented sub-agents (e.g., QueryAnalyzer under ProductSearch)
  parentAgent?: string
  subAgentType?: string
  systemPrompt?: string // 🆕 Processed system prompt for debugging (with variables replaced)
}

export class LLMRouterService {
  private agentConfigRepo: AgentConfigRepository
  private faqRepo: FAQRepository
  private loggerService: AgentLoggerService
  private conversationManager: ConversationManager
  private functionExecutor: FunctionExecutor
  private linkReplacementService: LinkReplacementService
  private searchConversationRepo: SearchConversationRepository
  private promptProcessor: PromptProcessorService // 🆕 Feature 124: Customer variables replacement
  private promptBuilder: PromptBuilderService // 🆕 Dynamic prompt generation from templates
  private templateLoader: TemplateLoaderService // 🆕 Load templates from files
  private safetyAgent: SafetyTranslationAgent // Used for specific flows (welcome, queue)
  private translationAgent: TranslationAgent // Main translation layer (IT → target language)
  private conversationHistoryLayer: ConversationHistoryLayer // 🆕 Humanization layer (saluti, contesto, offerte)
  private systemContextService: SystemContextService // 🆕 System Context for hidden SKU mappings
  private optionsMappingService: OptionsMappingService // 🆕 For pendingAction ADD_TO_CART
  private openRouterApiKey: string
  private openRouterBaseUrl = "https://openrouter.ai/api/v1"
  private maxFunctionIterations = 8 // FR-13: Increased from 5 to support repeat order confirmation flow (6-7 iterations needed)

  constructor(private prisma: PrismaClient) {
    this.agentConfigRepo = new AgentConfigRepository(prisma)
    this.faqRepo = new FAQRepository(prisma)
    this.loggerService = new AgentLoggerService(prisma)
    this.conversationManager = new ConversationManager(prisma, 10) // 10 minutes window
    this.functionExecutor = new FunctionExecutor(prisma)
    this.safetyAgent = new SafetyTranslationAgent(prisma)
    this.translationAgent = new TranslationAgent(prisma) // 🆕 Feature 181: Translation layer in routing
    this.conversationHistoryLayer = new ConversationHistoryLayer(prisma) // 🆕 Humanization layer
    this.linkReplacementService = new LinkReplacementService()
    this.searchConversationRepo = new SearchConversationRepository()
    this.promptProcessor = new PromptProcessorService() // 🆕 Feature 124: Inject for variable replacement
    this.promptBuilder = new PromptBuilderService(prisma) // 🆕 Dynamic prompt generation
    this.templateLoader = TemplateLoaderService.getInstance(prisma) // 🆕 Load templates from files
    this.systemContextService = getSystemContextService(prisma) // 🆕 System Context for SKU mappings
    this.optionsMappingService = new OptionsMappingService(prisma) // 🆕 For pendingAction ADD_TO_CART

    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""
    if (!this.openRouterApiKey) {
      logger.warn("⚠️ OPENROUTER_API_KEY not set - LLM calls will fail")
    }

    logger.info("✅ LLMRouterService initialized with Function Calling support")
  }

  /**
   * 🆕 Feature 126: Check if customer is blocked (P1 - Security Layer)
   *
   * This is the HIGHEST priority check - runs BEFORE any LLM processing.
   * Blocked customers get 410 Gone response with ZERO LLM tokens used.
   *
   * @param customerId - Customer ID to check
   * @param workspaceId - Workspace ID for isolation
   * @returns true if customer is blocked, false otherwise
   */
  private async checkBlockedUser(customerId: string, workspaceId: string): Promise<boolean> {
    const customer = await this.prisma.customers.findFirst({
      where: { id: customerId, workspaceId }, // 🔒 Workspace isolation
      select: { isBlacklisted: true, name: true },
    })

    if (customer?.isBlacklisted) {
      logger.warn("🚫 P1: Blocked customer attempted to send message", {
        customerId,
        customerName: customer.name,
      })
      return true
    }

    return false
  }

  /**
   * 🆕 Feature 126: Check if workspace chatbot is disabled (P2 - Maintenance Mode)
   *
   * When channelStatus = false, chatbot is DISABLED → return WIP message.
   * This is second priority check (after blocked user check).
   *
   * @param workspaceId - Workspace ID to check
   * @returns true if chatbot is disabled, false if active
   */
  private async getChannelDisabled(workspaceId: string): Promise<boolean> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { channelStatus: true, name: true },
    })

    // channelStatus = true → Chatbot ATTIVO (normale)
    // channelStatus = false → Chatbot DISATTIVO (manda WIP)
    if (workspace?.channelStatus === false) {
      logger.info("🚧 P2: Workspace chatbot disabled (maintenance mode)", {
        workspaceId,
        workspaceName: workspace.name,
      })
      return true
    }

    return false
  }

  /**
   * Retrieve customer discount (percentage) with workspace isolation
   */
  private async getCustomerDiscountPercent(
    workspaceId: string,
    customerId: string
  ): Promise<number> {
    try {
      const customer = await this.prisma.customers.findFirst({
        where: { id: customerId, workspaceId },
        select: { discount: true },
      })
      return customer?.discount || 0
    } catch (error) {
      logger.warn("Could not fetch customer discount", {
        workspaceId,
        customerId,
        error: error instanceof Error ? error.message : String(error),
      })
      return 0
    }
  }

  /**
   * Main entry point - Route message through multi-agent system
   */
  async routeMessage(
    params: RouteMessageParams
  ): Promise<RouteMessageResponse> {
    const startTime = Date.now()
    let totalTokens = 0
    let customerDiscount = 0
    let explicitOptionMapping: AgentOptionMapping | null = null

    try {
      customerDiscount = await this.getCustomerDiscountPercent(
        params.workspaceId,
        params.customerId
      )

      logger.info("🎯 Routing message", {
        workspaceId: params.workspaceId,
        customerId: params.customerId,
        conversationId: params.conversationId,
        isSystemMessage: params.isSystemMessage || false,
        customerDiscount,
      })

      // 🆕 Feature 127: SYSTEM MESSAGE FAST-PATH
      // If isSystemMessage=true, skip Router/SubLLM and go DIRECTLY to Safety+Translation
      if (params.isSystemMessage) {
        logger.info(
          "🚀 SYSTEM MESSAGE FAST-PATH: Skipping Router/SubLLM, going direct to Safety+Translation"
        )
        logger.info("📍 FAST-PATH STEP 1: Calling SafetyTranslationAgent")
        logger.info("📍 FAST-PATH STEP 1 INPUT:", {
          workspaceId: params.workspaceId,
          message: params.message,
          targetLanguage: params.customerLanguage || "it",
          customerName: params.customerName,
        })

        const debugSteps: DebugStep[] = []

        // 🆕 Step 0: Add SYSTEM_NOTIFICATION source step to timeline
        debugSteps.push({
          type: "router", // Use "router" type to show as system action
          agent: "🤖 System Notification (Admin Triggered)",
          model: "N/A",
          temperature: 0,
          timestamp: new Date().toISOString(),
          input: {
            // 🔥 DON'T use "userMessage" - that makes it show as "Customer"
            textToValidate: "Chatbot reactivation notification",
            previousResponse: `Admin enabled chatbot → Send: "${params.message}"`,
          },
          output: {
            decision: "forward_to_safety_translation",
            message: params.message,
          },
          tokenUsage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
        })

        // Step 1: Translate with Safety & Translation Agent
        const safetyResult = await this.safetyAgent.process({
          workspaceId: params.workspaceId,
          response: params.message, // Message in Italian (base language)
          targetLanguage: params.customerLanguage || "it",
          customerName: params.customerName,
        })

        totalTokens += safetyResult.tokensUsed || 0

        logger.info(
          "✅ FAST-PATH STEP 1 SUCCESS: SafetyTranslationAgent completed"
        )
        logger.info("📊 FAST-PATH STEP 1 OUTPUT:", {
          translatedText: safetyResult.translatedText,
          safe: safetyResult.safe,
          tokensUsed: safetyResult.tokensUsed,
        })

        debugSteps.push({
          type: "safety",
          agent: "SafetyTranslationAgent",
          timestamp: new Date().toISOString(),
          input: {
            textToValidate: params.message,
          },
          output: {
            translatedText: safetyResult.translatedText,
            safe: safetyResult.safe,
          },
          tokenUsage: {
            promptTokens: 0,
            completionTokens: safetyResult.tokensUsed || 0,
            totalTokens: safetyResult.tokensUsed || 0,
          },
          safe: safetyResult.safe,
        })

        logger.info(
          "📍 FAST-PATH STEP 2: Saving assistant message to conversation history"
        )
        logger.info("📍 FAST-PATH STEP 2 INPUT:", {
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          conversationId: params.conversationId,
          content: safetyResult.translatedText,
          agentType: "SYSTEM_NOTIFICATION",
          tokensUsed: totalTokens,
        })

        // Step 2: Save as assistant message in history
        await this.conversationManager.saveAssistantMessage({
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          conversationId: params.conversationId,
          content: safetyResult.translatedText,
          agentType: "SYSTEM_NOTIFICATION" as AgentType,
          tokensUsed: totalTokens,
          debugInfo: {
            steps: debugSteps,
            totalTokens,
            totalCost: 0,
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          },
        })

        logger.info(
          "✅ FAST-PATH STEP 2 SUCCESS: Message saved to conversation history"
        )

        // Step 3: Return response (will be queued for WhatsApp)
        const executionTimeMs = Date.now() - startTime

        logger.info(
          "📍 FAST-PATH STEP 3: Returning response (TODO: WhatsApp queue)"
        )
        logger.info(
          `✅ FAST-PATH COMPLETE: SYSTEM MESSAGE completed in ${executionTimeMs}ms (${totalTokens} tokens)`
        )

        return {
          response: safetyResult.translatedText,
          agentUsed: "SYSTEM_NOTIFICATION" as AgentType,
          confidence: 1.0,
          tokensUsed: totalTokens,
          executionTimeMs,
          wasFAQ: false,
          debugInfo: {
            steps: debugSteps,
            totalTokens,
            totalCost: 0,
            executionTimeMs,
            timestamp: new Date().toISOString(),
          },
        }
      }

      // 🆕 SECURITY GATE: Check for malicious patterns FIRST (Constitution Rule 9)
      // This runs BEFORE P1/P2/P3 to block SQL injection, XSS, etc.
      const securityCheck = await SecurityService.checkMessage(
        params.message,
        params.customerId,
        params.workspaceId
      )

      if (!securityCheck.isSafe) {
        const executionTimeMs = Date.now() - startTime

        logger.error("🚨 SECURITY GATE: Malicious pattern detected", {
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          threatType: securityCheck.threatType,
          detectedPattern: securityCheck.detectedPattern,
          severity: securityCheck.severity,
          executionTimeMs,
        })

        // 🔍 Build debug steps for security gate flow
        const securityDebugSteps: DebugStep[] = [
          {
            type: "router",
            agent: "🚨 Security Gate",
            model: "N/A",
            temperature: 0,
            timestamp: new Date().toISOString(),
            input: {
              userMessage: params.message,
            },
            output: {
              decision: "malicious_pattern_detected",
              threatType: securityCheck.threatType,
              severity: securityCheck.severity,
            },
            tokenUsage: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            },
          },
        ]

        // Save user message (INBOUND) - for audit trail
        await this.conversationManager.saveUserMessage({
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          conversationId: params.conversationId,
          content: params.message,
        })

        // 🆕 Apply SafetyTranslationAgent to security message (TASK16: No bypasses)
        const securitySafetyResult = await this.safetyAgent.process({
          workspaceId: params.workspaceId,
          response: securityCheck.message || "Security alert",
          targetLanguage: params.customerLanguage || "it",
          customerName: params.customerName,
        })

        const translatedSecurityMessage = securitySafetyResult.translatedText

        // 🔍 Add safety/translation step to timeline
        securityDebugSteps.push({
          type: "safety",
          agent: "SafetyTranslationAgent",
          model: "openai/gpt-4o-mini",
          temperature: 0.2,
          timestamp: new Date().toISOString(),
          input: {
            textToValidate: securityCheck.message || "Security alert",
            targetLanguage: params.customerLanguage || "it",
          },
          output: {
            translatedText: translatedSecurityMessage,
            safe: true,
          },
          tokenUsage: {
            promptTokens: 0,
            completionTokens: securitySafetyResult.tokensUsed || 0,
            totalTokens: securitySafetyResult.tokensUsed || 0,
          },
        })

        // Save generic security warning (OUTBOUND) with translated message and debugInfo
        await this.conversationManager.saveAssistantMessage({
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          conversationId: params.conversationId,
          content: translatedSecurityMessage,
          agentType: "ROUTER" as AgentType,
          debugInfo: {
            steps: securityDebugSteps,
            totalTokens: securitySafetyResult.tokensUsed || 0,
            totalCost: 0,
            executionTimeMs,
            timestamp: new Date().toISOString(),
          },
        })

        // Return translated security message (don't reveal detection details)
        return {
          response: translatedSecurityMessage,
          agentUsed: "ROUTER" as AgentType,
          confidence: 1.0,
          tokensUsed: securitySafetyResult.tokensUsed || 0,
          executionTimeMs,
          wasFAQ: false,
          isBlocked: false,
        }
      }

      // 🆕 Feature 126: PRIORITY CHECKS (P1 → P2) - Run AFTER security gate
      // These checks save tokens by bypassing expensive LLM calls when not needed

      // P1: Check if customer is blocked (SECURITY - HIGHEST PRIORITY after threats)
      const isBlocked = await this.checkBlockedUser(params.customerId, params.workspaceId)
      if (isBlocked) {
        const executionTimeMs = Date.now() - startTime

        logger.warn("🚫 P1: Blocked customer - NO response, NO DB save", {
          customerId: params.customerId,
          executionTimeMs,
        })

        // 🚫 CRITICAL: DO NOT SAVE ANYTHING - blocked user is completely ignored
        // Return 410 Gone immediately - webhook will NOT send message
        return {
          response: "",
          agentUsed: "ROUTER" as AgentType,
          confidence: 1.0,
          tokensUsed: 0,
          executionTimeMs,
          wasFAQ: false,
          isBlocked: true, // 🚫 Flag for webhook to NOT send message
        }
      }

      // P2: Check if workspace chatbot is disabled (MAINTENANCE MODE)
      const isChannelDisabled = await this.getChannelDisabled(
        params.workspaceId
      )
      if (isChannelDisabled) {
        const executionTimeMs = Date.now() - startTime

        // Get WIP message from workspace settings
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: params.workspaceId },
          select: { wipMessage: true },
        })

        const wipMessages = (workspace?.wipMessage as any) || {}
        const wipMessage =
          wipMessages[params.customerLanguage?.toLowerCase() || "en"] ||
          wipMessages.en ||
          "Work in progress. Please contact us later."

        logger.info("🚧 P2: Sending WIP message (chatbot disabled)", {
          workspaceId: params.workspaceId,
          language: params.customerLanguage,
          executionTimeMs,
        })

        // 🔍 Build debug steps for WIP message flow
        const wipDebugSteps: DebugStep[] = [
          {
            type: "router",
            agent: "🚧 Maintenance Mode",
            model: "N/A",
            temperature: 0,
            timestamp: new Date().toISOString(),
            input: {
              userMessage: params.message,
            },
            output: {
              decision: "chatbot_disabled",
              message: "Sending WIP message",
            },
            tokenUsage: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            },
          },
        ]

        // 🆕 Apply SafetyTranslationAgent to WIP message (TASK16: No bypasses)
        // Even WIP messages should be translated to customer's language
        const wipSafetyResult = await this.safetyAgent.process({
          workspaceId: params.workspaceId,
          response: wipMessage,
          targetLanguage: params.customerLanguage || "it",
          customerName: params.customerName,
        })

        const translatedWipMessage = wipSafetyResult.translatedText

        // 🔍 Add safety/translation step to timeline
        wipDebugSteps.push({
          type: "safety",
          agent: "SafetyTranslationAgent",
          model: "openai/gpt-4o-mini",
          temperature: 0.2,
          timestamp: new Date().toISOString(),
          input: {
            textToValidate: wipMessage,
            targetLanguage: params.customerLanguage || "it",
          },
          output: {
            translatedText: translatedWipMessage,
            safe: true,
          },
          tokenUsage: {
            promptTokens: 0,
            completionTokens: wipSafetyResult.tokensUsed || 0,
            totalTokens: wipSafetyResult.tokensUsed || 0,
          },
        })

        // Save user message (INBOUND)
        await this.conversationManager.saveUserMessage({
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          conversationId: params.conversationId,
          content: params.message,
        })

        // Save WIP response (OUTBOUND) with translated message and debugInfo
        await this.conversationManager.saveAssistantMessage({
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          conversationId: params.conversationId,
          content: translatedWipMessage,
          debugInfo: {
            steps: wipDebugSteps,
            totalTokens: wipSafetyResult.tokensUsed || 0,
            totalCost: 0,
            executionTimeMs,
            timestamp: new Date().toISOString(),
          },
        })

        return {
          response: translatedWipMessage,
          agentUsed: "ROUTER" as AgentType,
          confidence: 1.0,
          tokensUsed: wipSafetyResult.tokensUsed || 0,
          executionTimeMs,
          wasFAQ: false,
        }
      }

      // ✅ Priority checks passed - proceeding to normal LLM router flow

      // ❌ REMOVED: FAQ Pre-check (lines 209-320)
      // WHY: FAQ check bypassed Router LLM → Router lost decision control
      // NEW APPROACH: Router LLM decides FIRST, then can delegate to FAQ agent if needed
      // TODO: Implement FAQ as delegatable function for Router to call

      // STEP 2: Load conversation history
      logger.info("Step 2: Loading conversation history")
      const conversationHistoryRaw = await this.conversationManager.loadHistory(
        params.workspaceId,
        params.conversationId
      )

      // 🚦 If the current message is clearly asking for catalog/categories/products,
      // drop prior history to avoid misrouting into identity flows when an old
      // "Identità non configurata" was the last assistant message.
      const msgLower = (params.message || "").toLowerCase()
      const isCatalogIntent = /catalog|categ|prodott/.test(msgLower)
      const conversationHistory = isCatalogIntent ? [] : conversationHistoryRaw

      // STEP 2.5: Load last option mapping to normalize short replies (numbers / yes-no)
      const conversationState = await this.prisma.searchConversations.findUnique({
        where: { sessionId: params.conversationId },
        select: { metadata: true },
      })

      const lastOptionsMapping =
        (conversationState?.metadata as any)?.lastOptionsMapping || null

      // 🔍 DEBUG: Log loaded mapping
      logger.info("📋 [OptionMapping] Loaded mapping for preprocessing", {
        conversationId: params.conversationId,
        hasMapping: !!lastOptionsMapping,
        mappingType: lastOptionsMapping?.type,
        optionsCount: lastOptionsMapping?.options?.length,
        listType: lastOptionsMapping?.listType,
      })

      // 🆕 FASE 2: Use MessagePreprocessorService for DETERMINISTIC parsing
      // This extracts numbers, confirmations, and resolves them to actual values
      const preprocessResult = messagePreprocessorService.process(
        params.message,
        lastOptionsMapping
      )

      // Log preprocessing result for debugging
      if (preprocessResult.isShortInput) {
        logger.info("🔍 [Preprocessor] Short input detected", {
          originalMessage: params.message,
          inputType: preprocessResult.inputType,
          extractedNumber: preprocessResult.extractedNumber,
        })
      }

      // Use enriched message (has context like "User selected category 'Formaggi'")
      const normalizedUserMessage = preprocessResult.enrichedMessage

      // ❌ REMOVED: State-based pre-routing (auto-delegation to activeAgent)
      // WHY: Too complex, causes routing issues when topic changes
      // NEW APPROACH: ALWAYS go through Router LLM - it decides whether to reset or delegate

      // ❌ REMOVED: Save user message (line 279-284)
      // WHY: Saved TOO EARLY - before LLM processing
      // If LLM fails → orphan INBOUND message in DB without response
      // MOVED TO: After safety layer (with OUTBOUND save) for atomic operation

      // STEP 4: Load Router template from files
      const routerSystemPrompt = await this.templateLoader.loadAndRenderTemplate(
        "ROUTER",
        params.workspaceId
      )

      logger.info("📋 Loaded ROUTER template from files", {
        promptLength: routerSystemPrompt.length,
      })

      // STEP 4.5: Load customer data and dynamic content for Router prompt
      logger.info("Step 4.5: Loading customer data and dynamic content")
      const customer = await this.prisma.customers.findFirst({
        where: { id: params.customerId, workspaceId: params.workspaceId }, // 🔒 Workspace isolation
        include: { sales: true },
      })

      if (!customer) {
        throw new Error(`Customer ${params.customerId} not found in workspace ${params.workspaceId}`)
      }

      const workspace = await this.prisma.workspace.findUnique({
        where: { id: params.workspaceId },
        select: {
          id: true,
          name: true,
          url: true,
          language: true,
          // 🆕 Feature 199: Channel Configuration fields
          toneOfVoice: true,
          botIdentityResponse: true,
          hasHumanSupport: true,
          humanSupportInstructions: true,
          operatorContactMethod: true,
          operatorWhatsappNumber: true,
          hasSalesAgents: true,
          notificationEmail: true,
          allowedExternalLinks: true, // 🆕 Security: allowed domains for links
          sellsProductsAndServices: true, // 🆕 Dynamic function routing
          address: true, // 🆕 Location info for "where are you?" questions
          customAiRules: true, // 🆕 Custom AI rules that override defaults
        },
      })

      const messageRepo =
        new (require("../repositories/message.repository").MessageRepository)()

      const directIntentIndexPromise = this.getDirectIntentIndex(params.workspaceId)

      const [categories, offers, products, services, faqs, lastOrder, directIntentIndex] =
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
          directIntentIndexPromise,
        ])

      // If the user explicitly mentions a known product or category (e.g., "mozzarella" or "salumi"),
      // normalize the message to point the Router directly to that entity instead of regrouping.
      const directIntent = this.detectDirectIntent(
        params.message,
        directIntentIndex.products,
        directIntentIndex.categories
      )
      const userMessageForRouter = directIntent || normalizedUserMessage
      const conversationHistoryForRouter = directIntent ? [] : conversationHistory

      // 🆕 BUILD PROMPT VARIABLES using centralized builder (SINGLE SOURCE OF TRUTH)
      // This replaces the old manual customerData construction
      const promptVariables = PromptVariableBuilder.build(
        customer,
        workspace,
        {
          products,
          categories,
          services,
          offers,
          faqs,
        },
        {
          lastOrderCode: lastOrder?.orderCode || undefined,
        }
      )

      // 🔒 BACKWARD COMPATIBILITY: Build legacy customerData object from PromptVariables
      // This is passed to sub-agents until they are migrated to use PromptVariables directly
      const customerData = {
        nameUser: promptVariables.customerName,
        email: promptVariables.customerEmail,
        phone: promptVariables.customerPhone,
        discountUser: promptVariables.customerDiscount,
        companyName: promptVariables.companyName,
        lastordercode: promptVariables.lastOrderCode || "",
        languageUser: promptVariables.languageUser,
        agentName: promptVariables.agentName,
        agentPhone: promptVariables.agentPhone,
        agentEmail: promptVariables.agentEmail,
        push_notifications_consent: promptVariables.pushNotificationsConsent,
        botIdentityResponse: promptVariables.botIdentityResponse,
        adminEmail: promptVariables.adminEmail || "", // 🆕 For support/escalation
      }

      logger.info("📦 PromptVariables built for Router and sub-agents:", {
        companyName: promptVariables.companyName,
        customerName: promptVariables.customerName,
        hasBotIdentity: !!promptVariables.botIdentityResponse,
        hasProducts: !!promptVariables.products,
        hasCategories: !!promptVariables.categories,
      })

      // 🆕 DYNAMIC PROMPT GENERATION: Try PromptBuilder first, fallback to old system
      let processedRouterPrompt: string
      try {
        // Try new PromptBuilder system (templates from filesystem)
        const builtPrompt = await this.promptBuilder.build("ROUTER", {
          workspaceId: params.workspaceId,
          customerId: params.customerId,
        })
        processedRouterPrompt = builtPrompt.content
        logger.info("✅ Router prompt generated via PromptBuilder", {
          sellsProductsAndServices: builtPrompt.variables.sellsProductsAndServices,
          promptLength: processedRouterPrompt.length,
        })
      } catch (promptBuilderError) {
        // Fallback: Use old system with agentConfig.systemPrompt from DB
        logger.warn("⚠️ PromptBuilder failed, falling back to agentConfig.systemPrompt", {
          error: promptBuilderError instanceof Error ? promptBuilderError.message : String(promptBuilderError),
        })

        // Process Router prompt with variable replacement (old system)
        const PromptProcessorService =
          require("./prompt-processor.service").PromptProcessorService
        const promptProcessor = new PromptProcessorService()

        // 🔒 CRITICAL: Router MUST NOT have product/category data (Principle VIII Rule #4, #6)
        // Products/Categories ONLY for ProductSearchAgent - prevents hallucination & context contamination
        try {
          processedRouterPrompt = await promptProcessor.preProcessPrompt(
            routerSystemPrompt,
            params.workspaceId,
            customerData,
            {
              faqs: faqs || "",
              services: services || "",
              offers: offers || "",
              // ❌ NO products - Router delegates to ProductSearchAgent
              // ❌ NO categories - Router delegates to ProductSearchAgent
            },
            workspace?.url,
            // 🆕 Feature 199: Pass workspace config for dynamic prompt variables
            {
              sellsProductsAndServices: workspace?.sellsProductsAndServices ?? true, // 🆕 E-commerce toggle
              toneOfVoice: workspace?.toneOfVoice || "friendly",
              botIdentityResponse: workspace?.botIdentityResponse || undefined,
              hasHumanSupport: workspace?.hasHumanSupport ?? true,
              humanSupportInstructions: workspace?.humanSupportInstructions || undefined,
              operatorContactMethod: workspace?.operatorContactMethod || "email",
              operatorWhatsappNumber: workspace?.operatorWhatsappNumber || undefined,
              hasSalesAgents: workspace?.hasSalesAgents ?? false,
              adminEmail: workspace?.notificationEmail || undefined,
              allowedExternalLinks: workspace?.allowedExternalLinks || [], // 🆕 Security: allowed domains
              address: workspace?.address || undefined, // 🆕 Physical address
              customAiRules: workspace?.customAiRules || undefined, // 🆕 Custom AI rules
            }
          )
        } catch (error: any) {
          // Handle PromptValidationError (duplicate variables)
          if (error.name === "PromptValidationError") {
            logger.error(`[Router] Prompt validation failed: ${error.message}`)
            throw new Error(
              `Invalid Router prompt configuration: ${error.message}. Please contact system administrator.`
            )
          }
          // Re-throw other errors
          throw error
        }
      }

      logger.info(
        "✅ Router prompt processed with variables replaced (no products/categories)"
      )

      // 🆕 STEP 4.9: Add System Context (hidden SKU mappings, cart summary, etc.)
      const systemContextJson = await this.systemContextService.formatForSystemMessage(
        params.workspaceId,
        params.customerId
      )
      if (systemContextJson) {
        processedRouterPrompt += systemContextJson
        logger.info("📋 [SystemContext] Added to Router prompt", {
          contextLength: systemContextJson.length,
          contextPreview: systemContextJson.substring(0, 500),
        })
      } else {
        logger.info("📋 [SystemContext] No context available for this conversation")
      }

      // Create processed router agent with replaced prompt and default config
      const processedRouterAgent = {
        systemPrompt: processedRouterPrompt,
        model: "gpt-4o-mini", // 🆕 Default Router model
        temperature: 0, // Deterministic routing to avoid mis-mapping numeric selections
        maxTokens: 2000, // 🆕 Default max tokens
      }

      // STEP 5: Function Calling Loop
      logger.info("Step 3: Starting Function Calling loop")
      const result = await this.functionCallingLoop({
        routerAgent: processedRouterAgent,
        conversationHistory: conversationHistoryForRouter,
        userMessage: userMessageForRouter,
        params,
        customerDiscount,
        sellsProductsAndServices: workspace?.sellsProductsAndServices ?? true,
        preprocessResult, // 🆕 FASE 2: Pass for deterministic fast-path delegation
      })

      totalTokens = result.tokensUsed

      // 🔧 NEW: Collect debug steps from function calling loop
      const debugSteps = result.debugSteps || []

      // 🔧 CRITICAL FIX: Build debugInfo IMMEDIATELY after functionCallingLoop
      // This ensures it exists even if later steps fail
      const executionTimeMs = Date.now() - startTime
      const costPerMillionTokens = 0.15
      const totalCost = (totalTokens / 1_000_000) * costPerMillionTokens

      let debugInfo: DebugInfoSteps = {
        steps: debugSteps,
        totalTokens,
        totalCost,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      }

      logger.info("🔧 DEBUG: debugInfo constructed early", {
        stepsCount: debugInfo.steps.length,
        totalTokens: debugInfo.totalTokens,
      })

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
        // FIXED: Push to debugInfo.steps (not debugSteps) because debugInfo was already constructed
        debugInfo.steps.push({
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

      // 🆕 STEP 4.6: Replace customer-specific variables (Feature 124)
      // CRITICAL FIX: Variables from calling functions (RepeatOrder.ts, ResetCart.ts)
      // were not being replaced in LLM responses, showing {{discountUser}} to customers
      // This fixes Constitution Principle I violation (no hardcoded values)
      //
      // CENTRALIZED REPLACEMENT: replaceCustomerVariables() is the SINGLE SOURCE OF TRUTH
      // for ALL variable replacements (prompts AND responses)
      //
      // @see specs/124-customer-variables-replacement/spec.md FR-1, FR-2, FR-3
      // @see MULTI_AGENT_FLOW.md Step 4.6
      // 🔴 DEBUG: Log workspace values BEFORE building customerVarsData
      logger.info("🔍 STEP 4.6 DEBUG: Workspace config before variable replacement", {
        workspaceId: params.workspaceId,
        notificationEmail: workspace?.notificationEmail || "(empty)",
        botIdentityResponse: workspace?.botIdentityResponse ? workspace.botIdentityResponse.substring(0, 50) + "..." : "(empty)",
        name: workspace?.name || "(empty)",
        responseBeforeReplacement: responseWithLinks.substring(0, 200),
        hasAdminEmail: responseWithLinks.includes("{{adminEmail}}"),
        hasBotIdentity: responseWithLinks.includes("{{botIdentityResponse}}"),
      })

      const customerVarsData = {
        nome: params.customerName,
        email: customer.email,
        phone: customer.phone,
        discountUser: customer.discount || 0,
        agentName: customer.sales
          ? `${customer.sales.firstName} ${customer.sales.lastName}`.trim()
          : "Non assegnato",
        agentPhone: customer.sales?.phone || "N/A",
        agentEmail: customer.sales?.email || "N/A",
        companyName: workspace?.name || "L'Altra Italia", // ✅ FIX: Changed from customer.company to workspace.name
        languageUser: this.getLanguageDisplayName(
          customer.language || workspace?.language || "it"
        ),
        lastordercode: lastOrder?.orderCode || "",
        channelName: workspace?.name || "Shop",
        adminEmail: workspace?.notificationEmail || "support@echatbot.ai", // 🆕 For support/escalation links
        botIdentityResponse: workspace?.botIdentityResponse || "Virtual Assistant", // 🆕 For identity answers
      }

      // 🔴 DEBUG: Log customerVarsData BEFORE replacement
      logger.info("🔍 STEP 4.6 DEBUG: customerVarsData ready for replacement", {
        adminEmail: customerVarsData.adminEmail,
        botIdentityResponse: customerVarsData.botIdentityResponse ? customerVarsData.botIdentityResponse.substring(0, 50) + "..." : "(empty)",
        companyName: customerVarsData.companyName,
      })

      responseWithLinks = this.promptProcessor.replaceCustomerVariables(
        responseWithLinks,
        customerVarsData
      )

      // 🔴 DEBUG: Log response AFTER replacement to verify variables were replaced
      logger.info("🔍 STEP 4.6 DEBUG: Response AFTER replaceCustomerVariables", {
        stillHasAdminEmail: responseWithLinks.includes("{{adminEmail}}"),
        stillHasBotIdentity: responseWithLinks.includes("{{botIdentityResponse}}"),
        responseAfterReplacement: responseWithLinks.substring(0, 200),
      })

      logger.info("✅ Replaced customer variables in response", {
        nameUser: customerVarsData.nome,
        discountUser: customerVarsData.discountUser,
        agentName: customerVarsData.agentName,
        companyName: customerVarsData.companyName,
        adminEmail: customerVarsData.adminEmail,
        botIdentityResponse: customerVarsData.botIdentityResponse ? customerVarsData.botIdentityResponse.substring(0, 50) + "..." : "(empty)",
        hasEmail: !!customerVarsData.email,
        hasPhone: !!customerVarsData.phone,
        hasLastOrder: !!customerVarsData.lastordercode,
        responseLength: responseWithLinks.length,
        responsePreview: responseWithLinks.substring(0, 150),
      })

      // STEP 4.7: Apply Conversation History Layer (🆕 Humanization)
      // Transforms technical response into human, contextual message
      logger.info("Step 4.7: Applying Conversation History Layer")
      
      // Map agentUsed to TechnicalResponseType
      const responseTypeMap: Record<string, TechnicalResponseType> = {
        PRODUCT_SEARCH: "PRODUCT_LIST",
        CART_MANAGEMENT: "CART_STATUS",
        ORDER_TRACKING: "ORDER_LIST",
        CUSTOMER_SUPPORT: "FAQ_ANSWER",
        PROFILE_MANAGEMENT: "PROFILE",
        ROUTER: "GENERIC",
      }
      const technicalResponseType = responseTypeMap[result.agentUsed || "ROUTER"] || "GENERIC"
      
      // 🎯 Determine MINDSET based on response type
      // SALES: When customer is exploring products/categories → push towards purchase
      // SUPPORT: When customer needs help/info → empathy and clarity
      const salesTypes: TechnicalResponseType[] = [
        "PRODUCT_LIST", "PRODUCT_DETAIL", "CATEGORY_LIST", 
        "CART_STATUS", "CART_UPDATED", "CART_EMPTY", 
        "CHECKOUT", "ORDER_CONFIRMED"
      ]
      const supportTypes: TechnicalResponseType[] = [
        "FAQ_ANSWER", "SUPPORT_REQUEST", "PROFILE", "ORDER_LIST"
      ]
      
      let conversationMindset: "SALES" | "SUPPORT" | "NEUTRAL" = "NEUTRAL"
      if (salesTypes.includes(technicalResponseType)) {
        conversationMindset = "SALES"
      } else if (supportTypes.includes(technicalResponseType)) {
        conversationMindset = "SUPPORT"
      }
      
      logger.info(`🎯 Mindset determined: ${conversationMindset} (response type: ${technicalResponseType})`)
      
      // 📚 Load FAQs for context
      let workspaceFaqs: Array<{ question: string; answer: string; category?: string }> = []
      try {
        const faqRecords = await this.prisma.fAQ.findMany({
          where: {
            workspaceId: params.workspaceId,
            isActive: true,
          },
          select: {
            question: true,
            answer: true,
            category: true,
          },
          take: 10, // Limit to 10 most relevant FAQs to save tokens
          orderBy: { order: "asc" },
        })
        workspaceFaqs = faqRecords.map(faq => ({
          question: faq.question,
          answer: faq.answer,
          category: faq.category || undefined,
        }))
        logger.info(`📚 Loaded ${workspaceFaqs.length} FAQs for humanization context`)
      } catch (faqError) {
        logger.warn("⚠️ Failed to load FAQs for humanization, continuing without:", faqError)
      }
      
      // Build conversation history for the layer
      const historyForLayer: ConversationMessage[] = conversationHistory.map((msg: any) => ({
        role: msg.role === "user" ? "customer" : "assistant",
        content: msg.content,
        timestamp: new Date(),
      }))
      
      // Parse offers into ActiveOffer format (offers is a string, need to check if it's parseable)
      const activeOffers: ActiveOffer[] = []
      // Note: offers from DB is a formatted string, we'd need structured data
      // For now, keep empty - can enhance later with actual offer objects
      
      // Determine if this is the first message
      const isFirstMessage = conversationHistory.length === 0
      
      const humanizedResult = await this.conversationHistoryLayer.process({
        workspaceId: params.workspaceId,
        customerId: params.customerId,
        customerName: params.customerName || "Cliente",
        conversationHistory: historyForLayer,
        currentQuestion: params.message,
        technicalResponse: {
          type: technicalResponseType,
          rawMessage: responseWithLinks,
          optionsMapping: explicitOptionMapping || undefined,
        },
        botIdentity: {
          name: workspace?.name || "Assistente",
          personality: workspace?.botIdentityResponse || null,
        },
        customAiRules: workspace?.customAiRules || null,
        activeOffers,
        faqs: workspaceFaqs, // 📚 Pass FAQs for context
        mindset: conversationMindset, // 🎯 Pass mindset (SALES/SUPPORT/NEUTRAL)
        hasSalesAgents: workspace?.hasSalesAgents ?? false,
        isFirstMessage,
        lastAgentUsed: result.agentUsed || "ROUTER",
        customerLanguage: params.customerLanguage || "it",
      })
      
      // Use humanized message for translation
      const messageForTranslation = humanizedResult.message
      const humanizationTokens = humanizedResult.metadata.tokensUsed || 0
      totalTokens += humanizationTokens
      
      // Add Humanization debug step
      debugInfo.steps.push({
        type: "humanization",
        agent: "Conversation History Layer",
        model: humanizedResult.metadata.model,
        temperature: 0.7,
        timestamp: new Date().toISOString(),
        input: {
          technicalResponse: responseWithLinks.substring(0, 200),
          isFirstMessage,
          hasOffers: activeOffers.length > 0,
        },
        output: {
          humanizedText: humanizedResult.message.substring(0, 200),
          addedGreeting: humanizedResult.metadata.addedGreeting,
          suggestedOffers: humanizedResult.metadata.suggestedOffers,
        },
        tokenUsage: {
          promptTokens: 0,
          completionTokens: humanizationTokens,
          totalTokens: humanizationTokens,
        },
      })

      // STEP 5: Apply Translation Layer (🆕 Feature 181: Security moved to WhatsApp Queue only)
      logger.info("Step 5: Applying Translation Layer")
      const translationResult = await this.translationAgent.process({
        workspaceId: params.workspaceId,
        message: messageForTranslation,
        targetLanguage: params.customerLanguage || "it",
        customerName: params.customerName,
      })

      const finalResponse = translationResult.message
      const translationTokens = translationResult.tokensUsed || 0

      totalTokens += translationTokens

      // Add Translation debug step
      const translationTimestamp = new Date().toISOString()
      debugInfo.steps.push({
        type: "safety", // Use safety type for translation (post-processing)
        agent: "Translation Agent",
        model: translationResult.model || "openai/gpt-4o-mini",
        temperature: 0.1,
        timestamp: translationTimestamp,
        systemPrompt: translationResult.systemPrompt || "Translate the following message to the target language while preserving: emojis, formatting, links, and technical terms.",
        input: {
          previousResponse: responseWithLinks.substring(0, 200) + (responseWithLinks.length > 200 ? '...' : ''),
          targetLanguage: params.customerLanguage || "it",
        },
        output: {
          translatedText: translationResult.message,
          decision: "translated",
          executionTimeMs: translationResult.executionTimeMs,
        },
        tokenUsage: {
          promptTokens: 0,
          completionTokens: translationTokens,
          totalTokens: translationTokens,
        },
      })

      // STEP 5.5: Clean up punctuation attached to URLs (Safety may add punctuation)
      // Example: "http://localhost:3000/s/xyz." → "http://localhost:3000/s/xyz ."
      // Example: "http://localhost:3000/s/xyz)." → "http://localhost:3000/s/xyz ."
      let finalCleanResponse = finalResponse

      // 🆕 STEP 5.5.1: Remove SKU tags (they're for system use only, not customer-visible)
      // Remove [SKU:xxx] and [SKUS:xxx,yyy] tags
      finalCleanResponse = finalCleanResponse
        .replace(/\s*\[SKU:[A-Z0-9-]+\]/gi, '')
        .replace(/\s*\[SKUS?:[A-Z0-9-,]+\]/gi, '')
      
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

      logger.info("✅ Message routed successfully", {
        executionTimeMs: Date.now() - startTime,
        totalTokens,
        iterations: result.iterations,
        linksReplaced: tokensDetected.length,
        translated: true,
        urlsCleaned: finalCleanResponse !== finalResponse,
      })

      // ⚠️ CRITICAL LOG - Verify we reach this point
      logger.error("🔴🔴🔴 CHECKPOINT BEFORE SAVE - THIS LOG MUST APPEAR!!!")

      // debugInfo already constructed earlier (line 529)
      // Just update with final execution time
      debugInfo.executionTimeMs = Date.now() - startTime
      debugInfo.totalTokens = totalTokens

      // 🔧 CRITICAL DEBUG: Log debugInfo before return
      logger.info("🔍 BEFORE RETURN - debugInfo status:", {
        exists: !!debugInfo,
        stepsCount: debugInfo?.steps?.length || 0,
        hasRouterStep:
          debugInfo?.steps?.some((s) => s.type === "router") || false,
        hasSafetyStep:
          debugInfo?.steps?.some((s) => s.type === "safety") || false,
      })

      // 🔧 CRITICAL: Log FULL debugInfo object before saving
      logger.info(
        "🔍 FULL debugInfo before save:",
        JSON.stringify(debugInfo, null, 2)
      )

      // Save messages
      logger.info(
        "🚨🚨🚨 ABOUT TO SAVE MESSAGES - THIS SHOULD APPEAR IN LOGS!!!",
        {
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          conversationId: params.conversationId,
          messageContent: params.message.substring(0, 50),
        }
      )

      // STEP 6a: Save user message (INBOUND) - MOVED HERE from line 279
      // WHY: Save AFTER LLM processing succeeds, TOGETHER with assistant response
      // This ensures atomic operation: either BOTH messages saved, or NEITHER
      await this.conversationManager.saveUserMessage({
        workspaceId: params.workspaceId,
        customerId: params.customerId,
        conversationId: params.conversationId,
        content: params.message,
      })

      // STEP 6b: Save final assistant message (OUTBOUND) (with links replaced and translation applied)
      await this.conversationManager.saveAssistantMessage({
        workspaceId: params.workspaceId,
        customerId: params.customerId,
        conversationId: params.conversationId,
        content: finalCleanResponse, // ✅ Final response with links + translation + cleanup
        agentType: "ROUTER",
        tokensUsed: totalTokens,
        debugInfo: debugInfo, // ✅ Save complete debug information for message flow tracking
      })

      // STEP 6c: Update last options mapping for next-turn numeric/yes-no selections
      logger.info("📋 [OptionMapping] Calling updateOptionMappingMetadata (main routeMessage path)", {
        conversationId: params.conversationId,
        responseLength: finalCleanResponse.length,
      })
      await this.updateOptionMappingMetadata({
        workspaceId: params.workspaceId,
        conversationId: params.conversationId,
        customerId: params.customerId,
        responseText: finalCleanResponse,
        explicitMapping: explicitOptionMapping,
      })
      explicitOptionMapping = null

      // ❌ TODO #1: MISSING - WhatsApp Queue Emission
      // CRITICAL: Messages are saved in DB but NEVER sent via WhatsApp!
      // REQUIRED:
      // 1. Create WhatsAppQueueService (backend/src/services/whatsapp-queue.service.ts)
      // 2. Implement queue.enqueue({ customerId, message, workspaceId })
      // 3. Create worker to process queue and send via WhatsApp API
      // 4. Add error handling and retry logic
      //
      // TEMPORARY WORKAROUND: Webhook controller handles sending directly
      // (see whatsapp-webhook.controller.ts line 183+ with messageSendingService)
      //
      // UNCOMMENT WHEN WhatsAppQueueService IS IMPLEMENTED:
      // await whatsappQueueService.enqueue({
      //   customerId: params.customerId,
      //   message: finalCleanResponse,
      //   workspaceId: params.workspaceId,
      //   customerPhone: customer.phone,
      //   customerLanguage: params.customerLanguage
      // })

      // FASE 5: State Reset - Handled by Router's RESET_ACTIVE_AGENT function
      // No more hardcoded checks for "✅", "completat", "fatto"
      // Router LLM decides when to reset context based on topic change

      return {
        response: finalCleanResponse, // ✅ Return final clean response (links + translation + punctuation fix)
        agentUsed: result.agentUsed || "ROUTER",
        confidence: result.confidence || 0.9,
        tokensUsed: totalTokens,
        executionTimeMs,
        wasFAQ: false,
        debugInfo: debugInfo, // ✅ Return same debugInfo object that was saved
        selectedProduct: result.selectedProduct, // 🆕 For pendingAction ADD_TO_CART handoff to chat-engine
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime

      logger.error("❌ Error routing message", error)

      // 🔧 BUILD DEBUG STEPS FOR ERROR CASE
      const errorDebugSteps: DebugStep[] = [
        {
          type: "router",
          agent: "Router Agent",
          model: "N/A",
          temperature: 0.3,
          timestamp: new Date().toISOString(),
          input: {
            userMessage: params.message,
          },
          output: {
            message: error instanceof Error ? error.message : String(error),
          },
          tokenUsage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
        },
      ]

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
      const safetyTimestamp = new Date().toISOString()
      const errorResponse = await this.safetyAgent.process({
        workspaceId: params.workspaceId,
        response: "System error - please try again",
        targetLanguage: params.customerLanguage,
        customerName: params.customerName,
      })

      // 🔧 ADD SAFETY STEP TO DEBUG
      errorDebugSteps.push({
        type: "safety",
        agent: "Safety & Translation Agent",
        model: "openai/gpt-4o-mini",
        temperature: 0.2,
        timestamp: safetyTimestamp,
        systemPrompt: errorResponse.systemPrompt, // ✅ Add processed system prompt
        tokenUsage: errorResponse.tokensUsed
          ? {
              promptTokens: 0,
              completionTokens: errorResponse.tokensUsed,
              totalTokens: errorResponse.tokensUsed,
            }
          : undefined,
        input: {
          textToValidate: "System error - please try again",
          previousResponse: "Error fallback message",
        },
        output: {
          safe: errorResponse.safe,
          translatedText: errorResponse.translatedText,
          decision: "error_translation",
        },
        safe: errorResponse.safe,
        language: params.customerLanguage || "it",
      })

      return {
        response: errorResponse.translatedText,
        tokensUsed: errorResponse.tokensUsed || 0,
        executionTimeMs,
        agentUsed: "ROUTER" as AgentType,
        confidence: 0,
        wasFAQ: false,
        debugInfo: {
          steps: errorDebugSteps, // ✅ Now includes Router error + Safety translation
          totalTokens: errorResponse.tokensUsed || 0,
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
   *
   * 🆕 FASE 2: If preprocessResult has forceDelegationTarget, skip Router LLM
   * and delegate directly to the specified sub-agent.
   */
  private async functionCallingLoop(options: {
    routerAgent: any
    conversationHistory: any[]
    userMessage: string
    params: RouteMessageParams
    customerDiscount: number
    sellsProductsAndServices: boolean
    preprocessResult?: PreprocessResult // 🆕 FASE 2: Deterministic delegation
  }): Promise<{
    response: string
    tokensUsed: number
    iterations: number
    agentUsed?: AgentType
    confidence?: number
    debugSteps: DebugStep[] // 🔧 NEW: Captured execution steps
    selectedProduct?: { sku: string; name: string; itemType: string } | null // 🆕 For pendingAction ADD_TO_CART
  }> {
    const {
      routerAgent,
      conversationHistory,
      userMessage,
      params,
      customerDiscount,
      sellsProductsAndServices,
      preprocessResult,
    } = options

    let messages = [
      { role: "system" as const, content: routerAgent.systemPrompt },
      ...conversationHistory,
      { role: "user" as const, content: userMessage },
    ]

    let totalTokens = 0
    let iterations = 0
    let agentUsed: AgentType = "ROUTER"
    
    // 🆕 Track selected product from ProductSearchAgentLLM for pendingAction
    let selectedProductFromAgent: { sku: string; name: string; itemType: string } | null = null

    // 🔧 NEW: Track execution steps for debug timeline
    const debugSteps: DebugStep[] = []

    // 🆕 NOTE: FAST-PATH removed - LLM now handles all selections using conversation history
    // The preprocessor enriches the message with hints, and LLM understands context

    // Loop until max iterations or final response
    while (iterations < this.maxFunctionIterations) {
      iterations++

      logger.info(
        `Function Calling iteration ${iterations}/${this.maxFunctionIterations}`
      )

      // 🔧 DEBUG: Log what we're sending to the LLM
      logger.info("🔍 DEBUG - Messages sent to Router LLM:", {
        systemPromptPreview: messages[0]?.content?.substring(0, 500),
        conversationHistoryCount: messages.length - 2, // minus system and user
            userMessagePreview: messages[messages.length - 1]?.content?.substring(0, 500) || "",
        userMessage: messages[messages.length - 1]?.content,
      })

      // Call Router LLM with functions
      const routerCallTimestamp = new Date().toISOString()
      const routerCallStart = Date.now()
      const llmResponse = await this.callRouterLLM({
        model: routerAgent.model,
        messages,
        temperature: routerAgent.temperature,
        maxTokens: routerAgent.maxTokens,
        sellsProductsAndServices, // 🆕 Dynamic function routing
      })
      const routerCallDuration = Date.now() - routerCallStart

      totalTokens += llmResponse.tokensUsed

      // 🔧 IMPROVED: Capture Router Agent step with REAL INPUT and OUTPUT
      // 🔧 DEBUG: Log LLM decision
      logger.info("🔍 DEBUG - LLM Response:", {
        hasFunction: !!llmResponse.function_call,
        functionName: llmResponse.function_call?.name,
        functionArgs: llmResponse.function_call?.arguments,
        textResponse: llmResponse.content?.substring(0, 100),
      })

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
          executionTimeMs: routerCallDuration, // 🆕 Duration of Router LLM call
        },
        systemPrompt: routerAgent.systemPrompt, // 🆕 Include processed Router prompt for debugging (variables already replaced)
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

        // 🔄 CRITICAL: Handle RESET_ACTIVE_AGENT immediately
        if (functionName === "RESET_ACTIVE_AGENT") {
          logger.info(
            `🔄 Context Reset requested by Router: ${functionArgs.reason}`
          )

          // Reset activeAgent in database
          await this.prisma.searchConversations.updateMany({
            where: { sessionId: params.conversationId },
            data: { activeAgent: null } as any,
          })

          logger.info(
            `✅ activeAgent reset for session ${params.conversationId}`
          )

          // Continue to next iteration - Router will re-route with clean context
          continue
        }

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
            customerDiscount: customerDiscount, // 💰 Pass customer discount for cart price calculations
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
          const customer = await this.prisma.customers.findFirst({
            where: { id: params.customerId, workspaceId: params.workspaceId }, // 🔐 Workspace isolation
            include: {
              sales: true,
            },
          })

          if (!customer) {
            throw new Error(`Customer not found: ${params.customerId} in workspace ${params.workspaceId}`)
          }

          // Get workspace info
          const workspace = await this.prisma.workspace.findUnique({
            where: { id: params.workspaceId },
          })

          if (!workspace) {
            throw new Error(`Workspace not found: ${params.workspaceId}`)
          }

          // Get catalog data for sub-agent
          const customerDiscountForCatalog = customer.discount || 0
          const messageRepo =
            new (require("../repositories/message.repository").MessageRepository)()

          const [categories, offers, products, lastOrder] = await Promise.all([
            messageRepo.getActiveCategories(params.workspaceId),
            messageRepo.getActiveOffers(params.workspaceId),
            messageRepo.getActiveProducts(
              params.workspaceId,
              customerDiscountForCatalog
            ),
            this.prisma.orders.findFirst({
              where: { customerId: customer.id },
              orderBy: { createdAt: "desc" },
              select: { orderCode: true },
            }),
          ])

          // 🆕 BUILD PROMPT VARIABLES using centralized builder (for delegation)
          const delegationPromptVariables = PromptVariableBuilder.build(
            customer,
            workspace,
            {
              products,
              categories,
              offers,
            },
            {
              lastOrderCode: lastOrder?.orderCode || undefined,
            }
          )

          // 🔒 BACKWARD COMPATIBILITY: Build legacy customerData object
          const customerData = {
            nameUser: delegationPromptVariables.customerName,
            email: delegationPromptVariables.customerEmail,
            phone: delegationPromptVariables.customerPhone,
            discountUser: customerDiscountForCatalog,
            companyName: delegationPromptVariables.companyName,
            lastordercode: delegationPromptVariables.lastOrderCode || "",
            languageUser: delegationPromptVariables.languageUser,
            agentName: delegationPromptVariables.agentName,
            agentPhone: delegationPromptVariables.agentPhone,
            agentEmail: delegationPromptVariables.agentEmail,
            botIdentityResponse: delegationPromptVariables.botIdentityResponse,
            PRODUCTS: products || "",
            CATEGORIES: categories || "",
            OFFERS: offers || "",
          }

          logger.info("📦 PromptVariables built for sub-agent delegation:", {
            companyName: delegationPromptVariables.companyName,
            customerName: delegationPromptVariables.customerName,
            hasBotIdentity: !!delegationPromptVariables.botIdentityResponse,
            hasProducts: !!products,
          })

          // FASE 4: Update activeAgent state BEFORE delegation
          logger.info(
            `📝 Updating activeAgent state: ${delegationTarget} for session ${params.conversationId}`
          )

          // 🔍 Check current activeAgent to detect context switch
          const currentConversation =
            await this.prisma.searchConversations.findUnique({
              where: { sessionId: params.conversationId },
            })

          const previousAgent = (currentConversation as any)?.activeAgent
          const isLeavingProductSearch =
            previousAgent === "PRODUCT_SEARCH" &&
            delegationTarget !== "PRODUCT_SEARCH"

          // 🆕 ADD ROUTER CONTEXT INTERPRETATION STEP (if short response detected)
          const isShortResponse = userMessage.trim().length <= 5
          const shortResponsePatterns = /^(si|sì|no|ok|yes|1|2|3|4|5|6|7|8|9)$/i

          if (
            isShortResponse &&
            shortResponsePatterns.test(userMessage.trim())
          ) {
            // Extract context from conversation history
            const recentMessages = conversationHistory
              .filter((msg: any) => msg.role !== "system")
              .slice(-3)

            const lastAssistantMessage = recentMessages
              .reverse()
              .find((msg: any) => msg.role === "assistant")

            debugSteps.push({
              type: "router_context" as any,
              agent: "Router Agent - Context Interpretation",
              model: routerAgent.model,
              temperature: routerAgent.temperature,
              timestamp: new Date().toISOString(),
              input: {
                userMessage: userMessage.trim(),
                conversationHistory: recentMessages,
              },
              output: {
                decision: `Contextualized: ${delegationQuery.substring(0, 100)}...`,
                message: `Pattern: ${
                  lastAssistantMessage?.content?.includes("Vuoi")
                    ? "Confirmation"
                    : lastAssistantMessage?.content?.match(/\d+\)/)
                      ? "List selection"
                      : "Short response"
                } | Switch: ${
                  previousAgent && previousAgent !== delegationTarget
                    ? `${previousAgent} → ${delegationTarget}`
                    : "No switch"
                }`,
              },
              tokenUsage: {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
              },
            } as any)

            logger.info(
              "✅ Router Context Interpretation step added to timeline",
              {
                userMessage: userMessage.trim(),
                contextualizedMessage: delegationQuery,
                agentSwitch: previousAgent !== delegationTarget,
              }
            )
          }

          // 🧹 RESET filteredProducts when leaving PRODUCT_SEARCH context
          let updatedMetadata: any = currentConversation?.metadata || {}
          if (isLeavingProductSearch) {
            const cachedCount =
              (updatedMetadata as any)?.filteredProducts?.length || 0
            logger.info(
              `🧹 RESET: Leaving PRODUCT_SEARCH → ${delegationTarget}`,
              {
                previousAgent,
                newAgent: delegationTarget,
                cachedProducts: cachedCount,
                query: params.message,
              }
            )
            updatedMetadata = {
              ...(updatedMetadata as any),
              filteredProducts: null, // Clear filtered list
              lastSearch: null, // Clear last search metadata
              // Keep selectedSku if user confirmed a product
            }
          }

          await this.prisma.searchConversations.upsert({
            where: { sessionId: params.conversationId },
            create: {
              sessionId: params.conversationId,
              workspaceId: params.workspaceId,
              customerId: params.customerId,
              activeAgent: delegationTarget,
              metadata: updatedMetadata,
              expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min TTL
            } as any, // VSCode Prisma type cache
            update: {
              activeAgent: delegationTarget,
              metadata: updatedMetadata,
              expiresAt: new Date(Date.now() + 10 * 60 * 1000), // Reset TTL
            } as any,
          })

          // ✅ CALL SPECIALIST AGENTS with OWN LLM (NO LLMService!)
          // Each specialist has its own LLM instance and system prompt from database
          let subAgentResponse: any

          switch (delegationTarget) {
            case "PRODUCT_SEARCH": {
              // � ADD DELEGATION DEBUG STEP (Router → Product)
              debugSteps.push({
                type: "delegation" as any,
                timestamp: new Date().toISOString(),
                fromAgent: "ROUTER",
                toAgent: "PRODUCT_SEARCH",
                reason: "Router detected product/catalog inquiry",
                delegationQuery: params.message,
                detectedPattern:
                  functionName === "PRODUCT_SEARCH"
                    ? "Direct function call"
                    : "Intent classification",
              } as any)

              logger.info("✅ Added delegation debug step (Router → Product)", {
                toAgent: "PRODUCT_SEARCH",
              })

              // �🔒 PRE-CHECK: Verify products exist before delegating
              // Prevents LLM from inventing non-existent products
              const queryLower = params.message.toLowerCase()
              // ✅ ALWAYS delegate to ProductSearchAgentLLM - let LLM decide what to show
              const productSearchAgent = new ProductSearchAgentLLM(this.prisma)

              logger.info("🔵 ROUTER delegating to ProductSearchAgentLLM", {
                originalMessage: params.message,
                delegationQuery: delegationQuery,
              })

              subAgentResponse = await productSearchAgent.handleQuery({
                workspaceId: params.workspaceId,
                customerId: params.customerId,
                customerName: params.customerName,
                customerLanguage: params.customerLanguage,
                query: delegationQuery, // ✅ USE ROUTER'S CONTEXTUALIZED QUERY (e.g., "Mostra dettagli del PRODOTTO Gorgonzola")
                sessionId: `${params.workspaceId}-${params.customerId}`, // ✅ FIX: Use workspace+customer as session key for memory
                customerData, // 🔧 OPTIMIZATION: Pass pre-loaded data to avoid duplicate DB queries
              })
              if (subAgentResponse?.optionMapping) {
                explicitOptionMapping = subAgentResponse.optionMapping
              }
              // 🆕 Capture selectedProduct for pendingAction ADD_TO_CART handoff
              if (subAgentResponse?.selectedProduct) {
                selectedProductFromAgent = subAgentResponse.selectedProduct
                logger.info("📦 [Router] Captured selectedProduct from ProductSearchAgentLLM", {
                  sku: selectedProductFromAgent.sku,
                  name: selectedProductFromAgent.name,
                })
                
                // 🆕 Set pendingAction ADD_TO_CART for "SI" confirmation handling
                await this.optionsMappingService.setPendingAction({
                  workspaceId: params.workspaceId,
                  conversationId: params.conversationId,
                  pendingAction: {
                    type: "ADD_TO_CART",
                    productId: selectedProductFromAgent.sku,
                    productName: selectedProductFromAgent.name,
                    quantity: 1,
                    itemType: (selectedProductFromAgent.itemType || "PRODUCT") as "PRODUCT" | "SERVICE",
                  },
                })
                logger.info("🛒 [Router] Set pendingAction ADD_TO_CART for product detail confirmation", {
                  productId: selectedProductFromAgent.sku,
                  productName: selectedProductFromAgent.name,
                  conversationId: params.conversationId,
                })
              }
              break
            }
            case "CART_MANAGEMENT": {
              // 🔗 ADD DELEGATION DEBUG STEP (Router → Cart)
              debugSteps.push({
                type: "delegation" as any,
                timestamp: new Date().toISOString(),
                fromAgent: "ROUTER",
                toAgent: "CART_MANAGEMENT",
                reason: "Router detected cart operation",
                delegationQuery: delegationQuery,
                detectedPattern:
                  functionName === "CART_MANAGEMENT"
                    ? "Direct function call"
                    : "Intent classification",
              } as any)

              logger.info("✅ Added delegation debug step (Router → Cart)", {
                toAgent: "CART_MANAGEMENT",
              })

              const cartManagementAgent = new CartManagementAgentLLM(
                this.prisma
              )

              // Extract last 3 messages for context (excluding system prompt)
              const recentHistory = conversationHistory
                .filter((msg: any) => msg.role !== "system")
                .slice(-3) // Last 3 messages

              // 🔧 Feature 123: Load product search memory for selectedSku
              const sessionId = `${params.workspaceId}-${params.customerId}`
              const searchMemory =
                await this.searchConversationRepo.findBySessionId(
                  sessionId,
                  params.workspaceId
                )

              const selectedSku =
                searchMemory?.metadata?.selectedSku

              if (selectedSku) {
                logger.info(`📦 Found selectedSku in search memory`, {
                  selectedSku,
                  productName: searchMemory?.metadata?.productName,
                })
              } else {
                logger.warn(`⚠️ No selectedSku in search memory`, {
                  hasSearchMemory: !!searchMemory,
                  metadata: searchMemory?.metadata,
                })
              }

              logger.info(`📜 Passing conversation history to CartManagement`, {
                historyLength: recentHistory.length,
                messages: recentHistory.map((m: any) => ({
                  role: m.role,
                  contentPreview: m.content?.substring(0, 50),
                })),
              })

              subAgentResponse = await cartManagementAgent.handleQuery({
                workspaceId: params.workspaceId,
                customerId: params.customerId,
                customerName: params.customerName,
                customerLanguage: params.customerLanguage,
                customerDiscount, // 🔧 Pass discount for price calculations
                query: delegationQuery,
                conversationHistory: recentHistory, // ✅ Pass conversation context
                selectedSku, // 🔧 Feature 123: Pass product code from search memory
                customerData, // 🔧 OPTIMIZATION: Pass pre-loaded data to avoid duplicate DB queries
              })
              if (subAgentResponse?.optionMapping) {
                explicitOptionMapping = subAgentResponse.optionMapping
              }
              break
            }
            case "ORDER_TRACKING": {
              // 🔗 ADD DELEGATION DEBUG STEP (Router → Orders)
              debugSteps.push({
                type: "delegation" as any,
                timestamp: new Date().toISOString(),
                fromAgent: "ROUTER",
                toAgent: "ORDER_TRACKING",
                reason: "Router detected order inquiry",
                delegationQuery: delegationQuery,
                detectedPattern:
                  functionName === "ORDER_TRACKING"
                    ? "Direct function call"
                    : "Intent classification",
              } as any)

              logger.info("✅ Added delegation debug step (Router → Orders)", {
                toAgent: "ORDER_TRACKING",
              })

              const orderTrackingAgent = new OrderTrackingAgentLLM(this.prisma)
              subAgentResponse = await orderTrackingAgent.handleQuery({
                workspaceId: params.workspaceId,
                customerId: params.customerId,
                customerName: params.customerName,
                customerLanguage: params.customerLanguage,
                query: delegationQuery,
                lastOrderCode: customerData.lastordercode, // ✅ Pass last order code
                customerData, // 🔧 OPTIMIZATION: Pass pre-loaded data to avoid duplicate DB queries
              })
              if (subAgentResponse?.optionMapping) {
                explicitOptionMapping = subAgentResponse.optionMapping
              }
              break
            }
            case "CUSTOMER_SUPPORT": {
              // 🔗 ADD DELEGATION DEBUG STEP (Router → Support)
              debugSteps.push({
                type: "delegation" as any,
                timestamp: new Date().toISOString(),
                fromAgent: "ROUTER",
                toAgent: "CUSTOMER_SUPPORT",
                reason: "Router detected support inquiry",
                delegationQuery: delegationQuery,
                detectedPattern:
                  functionName === "CUSTOMER_SUPPORT"
                    ? "Direct function call"
                    : "Intent classification",
              } as any)

              logger.info("✅ Added delegation debug step (Router → Support)", {
                toAgent: "CUSTOMER_SUPPORT",
              })

              const customerSupportAgent = new CustomerSupportAgentLLM(
                this.prisma
              )
              subAgentResponse = await customerSupportAgent.handleQuery({
                workspaceId: params.workspaceId,
                customerId: params.customerId,
                customerName: params.customerName,
                customerLanguage: params.customerLanguage,
                query: delegationQuery,
                customerData, // 🔧 OPTIMIZATION: Pass pre-loaded data to avoid duplicate DB queries
              })
              if (subAgentResponse?.optionMapping) {
                explicitOptionMapping = subAgentResponse.optionMapping
              }

              // 📧 ADD CUSTOMER SUPPORT AGENT DEBUG STEP
              debugSteps.push({
                type: "customer_support" as any,
                agent: "Customer Support Agent",
                model: "gpt-4o-mini",
                temperature: 0.7,
                timestamp: new Date().toISOString(),
                input: {
                  userMessage: delegationQuery,
                  customerLanguage: params.customerLanguage || "en"
                },
                output: {
                  decision: "support_assistance_provided",
                  message: subAgentResponse.output,
                  functionCalls: subAgentResponse.functionCalls || []
                },
                tokensUsed: subAgentResponse.tokensUsed || 0,
                executionTimeMs: subAgentResponse.executionTimeMs || 0,
                containsTokens: false
              } as any)

              // 📧 CHECK: If contactSupport was called, add Summary Agent debug step
              if (subAgentResponse.functionCalls?.some(fc => fc.name === "contactSupport")) {
                logger.info("📧 contactSupport detected - adding Summary Agent debug step")
                
                // 📧 Extract real data from ContactOperator function call result
                const contactFunctionCall = subAgentResponse.functionCalls?.find(fc => fc.name === "contactSupport")
                const contactResult = contactFunctionCall?.result || {}
                
                // 📧 Use real conversation messages and generated summary
                const realMessages = contactResult.conversationMessages || []
                const realSummary = contactResult.generatedSummary || "No summary available"
                
                debugSteps.push({
                  type: "summary_agent" as any,
                  agent: "Summary Agent",
                  model: "gpt-4o-mini",
                  temperature: 0.2,
                  timestamp: new Date().toISOString(),
                  input: {
                    userMessage: "Conversation messages for summary generation",
                    conversationMessages: realMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n'),
                    messageCount: realMessages.length
                  },
                  output: {
                    decision: "summary_generated",
                    message: realSummary,
                    emailSent: contactResult.summaryEmailSent || false,
                    ticketId: contactResult.ticketId
                  },
                  tokensUsed: 500, // Estimated, could be tracked from SummaryAgent
                  executionTimeMs: 2000, // Estimated
                  containsTokens: false
                } as any)
                
                logger.info("✅ Added Summary Agent debug step with real data to timeline")
              }
              
              break
            }
            case "PROFILE_MANAGEMENT": {
              // 🔗 ADD DELEGATION DEBUG STEP (Router → Profile)
              debugSteps.push({
                type: "delegation" as any,
                timestamp: new Date().toISOString(),
                fromAgent: "ROUTER",
                toAgent: "PROFILE_MANAGEMENT",
                reason: "Router detected profile/notification inquiry",
                delegationQuery: delegationQuery,
                detectedPattern:
                  functionName === "PROFILE_MANAGEMENT"
                    ? "Direct function call"
                    : "Intent classification",
              } as any)

              logger.info("✅ Added delegation debug step (Router → Profile)", {
                toAgent: "PROFILE_MANAGEMENT",
              })

              const profileManagementAgent = new ProfileManagementAgentLLM(
                this.prisma
              )

              // Extract last 3 messages for context (excluding system prompt)
              const recentHistory = conversationHistory
                .filter((msg: any) => msg.role !== "system")
                .slice(-3) // Last 3 messages

              logger.info(
                `📜 Passing conversation history to ProfileManagement`,
                {
                  historyLength: recentHistory.length,
                  messages: recentHistory.map((m: any) => ({
                    role: m.role,
                    contentPreview: m.content?.substring(0, 50),
                  })),
                }
              )

              subAgentResponse = await profileManagementAgent.handleQuery({
                workspaceId: params.workspaceId,
                customerId: params.customerId,
                customerName: params.customerName,
                customerLanguage: params.customerLanguage,
                query: delegationQuery,
                conversationHistory: recentHistory, // ✅ Pass conversation context
              })
              if (subAgentResponse?.optionMapping) {
                explicitOptionMapping = subAgentResponse.optionMapping
              }
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

          // 🔍 EXTRACT QUERY ANALYZER CALLS (if Product and Services Agent)
          // NOTE: searchProducts removed - no more QueryAnalyzer calls
          const queryAnalyzerCalls: any[] = []

          // 📊 MAIN DEBUG STEP: Show what Router delegated and what Sub-Agent returned
          debugSteps.push({
            type: "sub_agent",
            agent: `${delegationTarget} Agent`,
            model: subAgentResponse.model, // 🆕 Include model used by sub-agent
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
            systemPrompt: subAgentResponse.systemPrompt, // 🆕 Include processed system prompt for debugging
            isSubAgent: true,
            parentAgent: "ROUTER",
            subAgentType: delegationTarget,
          })

          // 🔬 ADD NESTED QUERY ANALYZER STEPS (indented under Product Search)
          if (queryAnalyzerCalls.length > 0) {
            queryAnalyzerCalls.forEach((qaStep) => {
              debugSteps.push(qaStep)
            })
            logger.info(
              `✅ Added ${queryAnalyzerCalls.length} nested QueryAnalyzer step(s)`
            )
          }

          logger.info("✅ Specialist agent debug step created", {
            totalDebugSteps: debugSteps.length,
            responseLength: subAgentFinalResponse.length,
            tokensUsed: subAgentResponse.tokensUsed,
            hasTokens: subAgentFinalResponse.includes("[LINK_"),
            hasNestedQueryAnalyzer: queryAnalyzerCalls.length > 0,
          })

          // � CHECK IF PRODUCT AND SERVICES AGENT IS REQUESTING CART DELEGATION
          // Pattern: "🛒 DELEGATE_TO_CART: add [PRODUCT_NAME]"
          if (
            delegationTarget === "PRODUCT_SEARCH" &&
            subAgentFinalResponse.includes("🛒 DELEGATE_TO_CART:")
          ) {
            const cartDelegationMatch = subAgentFinalResponse.match(
              /🛒 DELEGATE_TO_CART:\s*(.+)/i
            )

            if (cartDelegationMatch) {
              const cartQuery = cartDelegationMatch[1].trim()

              logger.info("🛒 ProductSearch requested cart delegation", {
                cartQuery,
                originalResponse: subAgentFinalResponse,
              })

              // Extract recent conversation history FIRST
              const recentHistory = conversationHistory
                .filter((msg: any) => msg.role !== "system")
                .slice(-3)

              // 🔗 ADD DELEGATION DEBUG STEP (shows Product → Cart handoff)
              debugSteps.push({
                type: "delegation" as any,
                timestamp: new Date().toISOString(),
                fromAgent: "PRODUCT_SEARCH",
                toAgent: "CART_MANAGEMENT",
                reason: "Product agent detected user wants to add item to cart",
                delegationQuery: cartQuery,
                contextFromHistory: recentHistory
                  .map((msg: any) => `${msg.role}: ${msg.content}`)
                  .join("\n"),
                detectedPattern:
                  "🛒 DELEGATE_TO_CART: pattern in Product response",
              } as any)

              logger.info("✅ Added delegation debug step (Product → Cart)", {
                fromAgent: "PRODUCT_SEARCH",
                toAgent: "CART_MANAGEMENT",
                delegationQuery: cartQuery,
              })

              // Call Cart Management Agent with the extracted query
              const cartManagementAgent = new CartManagementAgentLLM(
                this.prisma
              )

              const cartResponse = await cartManagementAgent.handleQuery({
                workspaceId: params.workspaceId,
                customerId: params.customerId,
                customerName: params.customerName,
                customerLanguage: params.customerLanguage,
                customerDiscount, // 🔧 Pass discount for price calculations
                query: `CONFIRMED: ${cartQuery}`, // Add CONFIRMED prefix
                conversationHistory: recentHistory,
              })

              logger.info("✅ Cart delegation completed", {
                cartResponseLength: cartResponse.output?.length || 0,
                success: cartResponse.success,
              })

              // Update response to cart result
              messages.push({
                role: "function" as const,
                name: functionName,
                content: cartResponse.output || "Cart operation completed",
              })

              agentUsed = "CART_MANAGEMENT" as AgentType
              totalTokens += cartResponse.tokensUsed || 0

              // Add cart agent debug step
              debugSteps.push({
                type: "sub_agent",
                agent: "Cart Management Agent",
                timestamp: new Date().toISOString(),
                input: {
                  delegatedFrom: "PRODUCT_SEARCH",
                  functionCalled: "CART_MANAGEMENT",
                  parameters: {
                    query: cartQuery,
                  },
                },
                output: {
                  responseText: cartResponse.output || "",
                  language: "en",
                  containsTokens: false,
                  executionTimeMs: cartResponse.executionTimeMs || 0,
                },
                tokenUsage: {
                  promptTokens: 0,
                  completionTokens: cartResponse.tokensUsed || 0,
                  totalTokens: cartResponse.tokensUsed || 0,
                },
                isSubAgent: true,
                parentAgent: "PRODUCT_SEARCH",
                subAgentType: "CART_MANAGEMENT",
              })

              logger.info("🔄 Cart response added, continuing to Router", {
                nextIteration: iterations + 1,
              })

              continue
            }
          }

          // ✅ DIRECT EXIT - Trust specialist agent response
          // If prompts are well-written, LLM responds correctly!
          // No validation needed - just return specialist agent response
          logger.info(
            "✅ Specialist agent completed, returning response directly",
            {
              agent: delegationTarget,
              responseLength: subAgentFinalResponse.length,
              directToSafety: true,
            }
          )

          // Track which agent was used
          agentUsed = delegationTarget

          // Update total tokens (from specialist agent response only)
          totalTokens += subAgentResponse.tokensUsed || 0

          // 🆕 UPDATE OPTIONS MAPPING for next-turn numeric/yes-no handling
          // CRITICAL: This was missing and caused FAST-PATH to fail!
          logger.info("📋 [OptionMapping] Updating mapping after sub-agent delegation", {
            conversationId: params.conversationId,
            delegationTarget,
            responseLength: subAgentFinalResponse.length,
          })
          await this.updateOptionMappingMetadata({
            workspaceId: params.workspaceId,
            conversationId: params.conversationId,
            customerId: params.customerId,
            responseText: subAgentFinalResponse,
            explicitMapping: subAgentResponse.optionMapping,
          })
          explicitOptionMapping = null

          logger.info(
            "🔍 DEBUG: Exiting functionCallingLoop with specialist response",
            {
              debugStepsCount: debugSteps.length,
              response: subAgentFinalResponse.substring(0, 100),
              finalAgentUsed: agentUsed,
            }
          )

          // ⬅️ EXIT LOOP - Return directly with sub-agent response
          // Proceed to Safety & Translation layer
          return {
            response: subAgentFinalResponse,
            tokensUsed: totalTokens,
            iterations,
            agentUsed,
            confidence: 0.9,
            debugSteps, // Contains: Router → SubAgent
            selectedProduct: selectedProductFromAgent, // 🆕 For pendingAction ADD_TO_CART
          }
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
          subAgentName = "Product and Services Agent"
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

      // 🧹 CRITICAL FIX: Remove JSON function call echoes from LLM response
      // Sometimes LLM includes previous function calls in final response
      // Examples: {"query":"6"}, {"query":"CONFIRMED: add Peperoni"}
      let cleanedResponse =
        llmResponse.content || "Sorry, I couldn't process that request."

      // Remove JSON objects that look like function arguments
      cleanedResponse = cleanedResponse.replace(/\{"query":[^}]+\}/g, "").trim()
      cleanedResponse = cleanedResponse
        .replace(/\{[^}]*"query"[^}]*\}/g, "")
        .trim()

      // Remove any remaining standalone JSON objects
      cleanedResponse = cleanedResponse.replace(/^\{[^}]+\}\s*/gm, "").trim()

      if (cleanedResponse !== llmResponse.content) {
        logger.info("🧹 Cleaned function call echoes from response", {
          original: llmResponse.content?.substring(0, 150),
          cleaned: cleanedResponse.substring(0, 150),
        })
      }

      logger.info(
        "🔍 DEBUG: About to return from functionCallingLoop with debugSteps",
        {
          debugStepsCount: debugSteps.length,
          debugStepsPreview: debugSteps.map((s) => ({
            type: s.type,
            agent: s.agent,
          })),
          response: cleanedResponse.substring(0, 100),
        }
      )
      return {
        response: cleanedResponse,
        tokensUsed: totalTokens,
        iterations,
        agentUsed,
        confidence: 0.9,
        debugSteps, // 🔧 NEW: Return captured steps
        selectedProduct: selectedProductFromAgent, // 🆕 For pendingAction ADD_TO_CART
      }
    }

    // Max iterations reached
    logger.warn("⚠️ Max function calling iterations reached")
    logger.info("🔍 DEBUG: Max iterations - returning with debugSteps", {
      debugStepsCount: debugSteps.length,
    })
    return {
      response:
        "I'm processing your request, but it's taking longer than expected. Can you try rephrasing?",
      tokensUsed: totalTokens,
      iterations,
      agentUsed,
      confidence: 0.5,
      debugSteps, // 🔧 NEW: Return captured steps
      selectedProduct: selectedProductFromAgent, // 🆕 For pendingAction ADD_TO_CART
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
    sellsProductsAndServices?: boolean // 🆕 Dynamic function routing
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
          // 🆕 Dynamic: If sellsProductsAndServices=false, exclude e-commerce agents
          tools: getFunctionsForRouter({ 
            sellsProductsAndServices: options.sellsProductsAndServices ?? true 
          }),
          tool_choice: "required", // FORCE model to always call a function
        },
        {
          headers: {
            Authorization: `Bearer ${this.openRouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.FRONTEND_URL || "https://echatbot.ai",
            "X-Title": "eChatbot Multi-Agent Router",
          },
          timeout: 60000, // Increased from 30s to 60s for complex queries like "prodotti DOP"
        }
      )

      const choice = response.data.choices[0]
      const tokensUsed = response.data.usage?.total_tokens || 0

      // 🔍 DEBUG: Log raw LLM response to see what OpenRouter returns
      logger.info("🔍 RAW OpenRouter Response:", {
        hasContent: !!choice.message.content,
        contentPreview: choice.message.content?.substring(0, 100),
        hasToolCalls: !!choice.message.tool_calls,
        toolCallsCount: choice.message.tool_calls?.length || 0,
        toolCallName: choice.message.tool_calls?.[0]?.function?.name,
        toolCallArgs: choice.message.tool_calls?.[0]?.function?.arguments,
        finishReason: choice.finish_reason,
      })

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
   * Handle delegation handoff from one agent to another
  private async delegateToActiveAgent(options: {
    activeAgent: string
    query: string
    params: RouteMessageParams
    conversationHistory: any[]
  }): Promise<RouteMessageResponse> {
    const startTime = Date.now()
    const { activeAgent, query, params, conversationHistory } = options

    try {
      logger.info(`🎯 Delegating to ${activeAgent} (auto-delegation)`, {
        query,
        sessionId: params.conversationId,
      })

      // Get specialist agent instance
      const specialist = await this.getSpecialistAgent(
        activeAgent as AgentType,
        params.workspaceId
      )

      // Call specialist directly with handleQuery method
      const specialistResponse = await specialist.handleQuery({
        workspaceId: params.workspaceId,
        customerId: params.customerId,
        sessionId: params.conversationId,
        query,
        customerName: params.customerName,
        customerLanguage: params.customerLanguage || "it",
      })

      // Check for delegation handoff pattern
      if (specialistResponse.output.includes("🛒 DELEGATE_TO_CART:")) {
        return await this.handleDelegationHandoff(specialistResponse, options)
      }

      // 🔗 STEP 1: Replace [LINK_xxx] tokens with real URLs BEFORE translation
      logger.info("🔗 Applying LinkReplacementService to specialist response")

      let responseWithLinks = specialistResponse.output
      const linkResult = await this.linkReplacementService.replaceTokens(
        {
          response: specialistResponse.output,
        },
        params.customerId,
        params.workspaceId
      )

      if (linkResult.success && linkResult.response) {
        responseWithLinks = linkResult.response
        logger.info(
          "✅ Link replacement successful - URLs replaced before translation"
        )
      } else {
        logger.warn("⚠️ Link replacement failed:", linkResult.error)
      }

      // 🔒 STEP 2: Apply Safety & Translation Layer to response with links
      const safeResponse = await this.safetyAgent.process({
        workspaceId: params.workspaceId,
        response: responseWithLinks, // ✅ Use response with replaced links
        targetLanguage: params.customerLanguage || "it",
        customerName: params.customerName,
      })

      if (!safeResponse.safe) {
        logger.warn("⚠️ Response blocked by safety layer", {
          reason: safeResponse.blockedReason,
        })
      }

      const finalResponse = safeResponse.translatedText
      const executionTimeMs = Date.now() - startTime

      // Save messages BEFORE returning (same as main flow)
      logger.info("Saving messages for auto-delegation flow")

      // Save user message (INBOUND)
      await this.conversationManager.saveUserMessage({
        workspaceId: params.workspaceId,
        customerId: params.customerId,
        conversationId: params.conversationId,
        content: params.message,
      })

      // Save assistant message (OUTBOUND) with debugInfo
      // ✅ Include ALL 4 steps: Router → Specialist → Router receives → Safety

      // 🔍 DEBUG: Log systemPrompt status
      logger.error("🔍🔍🔍 DEBUG: specialistResponse.systemPrompt", {
        exists: !!specialistResponse.systemPrompt,
        length: specialistResponse.systemPrompt?.length || 0,
        preview:
          specialistResponse.systemPrompt?.substring(0, 150) || "❌ MISSING",
      })

      const routerDelegateTimestamp = new Date().toISOString()
      const specialistTimestamp = new Date().toISOString()
      const routerReceiveTimestamp = new Date().toISOString()
      const safetyTimestamp = new Date().toISOString()

      const debugInfo: DebugInfoSteps = {
        steps: [
          // Step 1: Router decides to delegate
          {
            type: "router",
            agent: "LLM Router",
            model: "N/A",
            temperature: 0,
            timestamp: routerDelegateTimestamp,
            input: {
              userMessage: query,
            },
            output: {
              decision: `Auto-delegate to ${activeAgent}`,
            },
            tokenUsage: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            },
          },
          // Step 2: Specialist (sub-agent) executes query with LLM call
          {
            type: "sub_agent",
            agent: activeAgent,
            model: "openai/gpt-4o-mini",
            temperature: 0.7,
            timestamp: specialistTimestamp,
            tokenUsage: {
              promptTokens: 0,
              completionTokens: specialistResponse.tokensUsed || 0,
              totalTokens: specialistResponse.tokensUsed || 0,
            },
            input: {
              delegatedFrom: "LLM Router",
              userMessage: query,
            },
            output: {
              textResponse: specialistResponse.output,
            },
            systemPrompt: specialistResponse.systemPrompt, // 🆕 Include processed system prompt for debugging
            isSubAgent: true, // ✅ Flag for frontend filtering
          } as any,
          // Step 3: Router receives response from specialist
          {
            type: "router",
            agent: "LLM Router",
            model: "N/A",
            temperature: 0,
            timestamp: routerReceiveTimestamp,
            input: {
              specialistResponse:
                specialistResponse.output.substring(0, 100) + "...",
            },
            output: {
              decision:
                "Response received from specialist - proceed to Safety layer",
            },
            tokenUsage: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            },
          },
          // Step 4: Safety validates and translates with LLM call
          {
            type: "safety",
            agent: "Safety & Translation Agent",
            model: "openai/gpt-4o-mini",
            temperature: 0.2,
            timestamp: safetyTimestamp,
            systemPrompt: safeResponse.systemPrompt, // ✅ Add processed system prompt
            tokenUsage: safeResponse.tokensUsed
              ? {
                  promptTokens: 0,
                  completionTokens: safeResponse.tokensUsed,
                  totalTokens: safeResponse.tokensUsed,
                }
              : undefined,
            input: {
              textToValidate: specialistResponse.output,
              previousResponse: `${activeAgent} response`,
            },
            output: {
              safe: safeResponse.safe,
              translatedText: finalResponse,
              decision: safeResponse.safe ? "approved" : "blocked",
            },
            safe: safeResponse.safe,
            language: params.customerLanguage || "it",
            blocked: !safeResponse.safe,
            blockedReason: safeResponse.blockedReason,
          },
        ],
        totalTokens:
          (specialistResponse.tokensUsed || 0) + (safeResponse.tokensUsed || 0),
        totalCost: 0,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      }

      await this.conversationManager.saveAssistantMessage({
        workspaceId: params.workspaceId,
        customerId: params.customerId,
        conversationId: params.conversationId,
        content: finalResponse,
        agentType: activeAgent as AgentType,
        tokensUsed: specialistResponse.tokensUsed || 0,
        debugInfo: debugInfo,
      })

      // Update last options mapping for next user turn (numeric / yes-no handling)
      logger.info("📋 [OptionMapping] Calling updateOptionMappingMetadata (handleWithActiveAgent path)", {
        conversationId: params.conversationId,
        responseLength: finalResponse.length,
      })
      await this.updateOptionMappingMetadata({
        workspaceId: params.workspaceId,
        conversationId: params.conversationId,
        customerId: params.customerId,
        responseText: finalResponse,
        explicitMapping: explicitOptionMapping,
      })
      explicitOptionMapping = null

      // 🔔 CRITICAL: Notify WebSocket clients of new message
      websocketService.notifyNewMessage(params.workspaceId, {
        id: Date.now().toString(), // Temporary ID (real ID from DB not returned)
        sessionId: params.conversationId,
        content: finalResponse,
        sender: "agent",
        timestamp: new Date().toISOString(),
        workspaceId: params.workspaceId,
      })

      // � CRITICAL: Also notify chat list update (for last message preview)
      websocketService.notifyChatUpdated(params.workspaceId, {
        sessionId: params.conversationId,
        lastMessage: finalResponse.substring(0, 100), // Preview text
        lastMessageAt: new Date().toISOString(),
        customerId: params.customerId,
      })

      logger.info(
        `[LLM-ROUTER] 🔔 WebSocket notifications sent (new-message + chat-updated)`
      )

      // �🔄 State Reset - Handled by Router's RESET_ACTIVE_AGENT function
      // No more hardcoded checks - Router LLM decides when to reset

      return {
        response: finalResponse,
        agentUsed: activeAgent as AgentType,
        tokensUsed: specialistResponse.tokensUsed || 0,
        executionTimeMs,
        confidence: 1.0, // Auto-delegation has high confidence
        wasFAQ: false,
      }
    } catch (error) {
      logger.error(`❌ Error delegating to ${activeAgent}:`, error)
      throw error
    }
  }

  /**
   * Handle delegation handoff from one agent to another
   * Example: ProductSearch → "🛒 DELEGATE_TO_CART: add" → Cart
   *
   * CRITICAL: ALWAYS reads product code from metadata.selectedSku,
   * NEVER trusts LLM-generated code in response (can be stale/wrong)
   */
  private async handleDelegationHandoff(
    response: any,
    options: {
      activeAgent: string
      query: string
      params: RouteMessageParams
      conversationHistory: any[]
    }
  ): Promise<RouteMessageResponse> {
    const startTime = Date.now()

    try {
      const customerDiscount = options.params.customerDiscount || 0
      // � ALWAYS read product code from metadata (source of truth)
      // ProductSearchAgent saves selectedSku after user picks from list
      const conversation = await this.prisma.searchConversations.findUnique({
        where: { sessionId: options.params.conversationId },
        select: { metadata: true },
      })

      const metadata = conversation?.metadata as any
      const selectedSku = metadata?.selectedSku

      if (!selectedSku) {
        logger.error(
          "❌ No selectedSku in metadata for cart delegation"
        )
        throw new Error(
          "Product code not found - user must select product first"
        )
      }

      const cartQuery = `add ${selectedSku}`
      logger.info(
        `🔀 HANDOFF: ${options.activeAgent} → CART_MANAGEMENT (product: ${selectedSku})`
      )

      // Update activeAgent in SearchConversations
      await this.prisma.searchConversations.update({
        where: { sessionId: options.params.conversationId },
        data: {
          activeAgent: "CART_MANAGEMENT",
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // Reset TTL
        } as any, // VSCode Prisma type cache - field exists in runtime
      })

      // Clear last options mapping because cart handoff should not reuse previous list context
      await this.updateOptionMappingMetadata({
        workspaceId: options.params.workspaceId,
        conversationId: options.params.conversationId,
        customerId: options.params.customerId,
        responseText: "",
        forceClear: true,
      })

      // Get Cart agent
      const cartAgent = await this.getSpecialistAgent(
        "CART_MANAGEMENT",
        options.params.workspaceId
      )

      // Delegate to Cart with extracted command
      const cartResponse = await cartAgent.handleQuery({
        workspaceId: options.params.workspaceId,
        customerId: options.params.customerId,
        sessionId: options.params.conversationId,
        query: cartQuery,
        customerName: options.params.customerName,
        customerLanguage: options.params.customerLanguage || "it",
        customerDiscount,
      })

      // Apply Safety & Translation
      const safeResponse = await this.safetyAgent.process({
        workspaceId: options.params.workspaceId,
        response: cartResponse.output,
        targetLanguage: options.params.customerLanguage || "it",
        customerName: options.params.customerName,
      })

      const executionTimeMs = Date.now() - startTime

      return {
        response: safeResponse.translatedText,
        agentUsed: "CART_MANAGEMENT",
        tokensUsed: cartResponse.tokensUsed || 0,
        executionTimeMs,
        confidence: 1.0, // Delegation handoff has high confidence
        wasFAQ: false,
      }
    } catch (error) {
      logger.error("❌ Error handling delegation handoff:", error)
      throw error
    }
  }

  // ✅ REMOVED: normalizeUserMessageWithMapping()
  // Replaced by MessagePreprocessorService (FASE 2)
  // The new service provides deterministic parsing + FAST-PATH delegation

  /**
   * Persist mapping between displayed options and their labels for next-turn selection
   */
  private async updateOptionMappingMetadata(options: {
    workspaceId: string
    conversationId: string
    customerId?: string
    responseText: string
    forceClear?: boolean
    explicitMapping?: AgentOptionMapping | null
  }): Promise<void> {
    const {
      workspaceId,
      conversationId,
      responseText,
      customerId,
      explicitMapping,
      forceClear,
    } = options

    let mapping: any = null
    const shouldUseExplicit =
      !!explicitMapping &&
      (explicitMapping.options?.length ||
        explicitMapping.type === "binary")

    if (!forceClear && shouldUseExplicit) {
      mapping = {
        type: explicitMapping?.type || "numbered",
        listType: explicitMapping?.listType,
        options: explicitMapping?.options?.map((opt) => ({
          number: opt.number,
          label: opt.label,
          count: opt.count,
          skus: opt.skus,
          id: opt.id,
          metadata: opt.metadata,
        })),
      }
    } else if (!forceClear) {
      mapping = this.extractOptionMapping(responseText)
    }

    // 🔍 DEBUG: Log mapping extraction
    logger.info("📋 [OptionMapping] Extracting mapping from response", {
      conversationId,
      responsePreview: responseText?.substring(0, 200),
      extractedMapping: mapping
        ? {
            type: mapping.type,
            optionsCount: mapping.options?.length,
            listType: mapping.listType,
            fromExplicit: shouldUseExplicit,
          }
        : null,
    })

    const existing = await this.prisma.searchConversations.findUnique({
      where: { sessionId: conversationId },
    })

    const currentMetadata = (existing as any)?.metadata || {}
    const existingMapping = currentMetadata.lastOptionsMapping || {}
    const resolvedCurrentOrderCode =
      explicitMapping && "currentOrderCode" in explicitMapping
        ? explicitMapping.currentOrderCode
        : existingMapping?.currentOrderCode
    const updatedMetadata = {
      ...currentMetadata,
      lastOptionsMapping: mapping
        ? {
            ...mapping,
            currentOrderCode: resolvedCurrentOrderCode,
          }
        : null,
    }

    // Keep activeAgent/state; only adjust metadata
    await this.prisma.searchConversations.upsert({
      where: { sessionId: conversationId },
      create: {
        sessionId: conversationId,
        workspaceId,
        customerId: (existing as any)?.customerId || customerId || "",
        metadata: updatedMetadata,
        activeAgent: (existing as any)?.activeAgent || null,
        expiresAt:
          (existing as any)?.expiresAt || new Date(Date.now() + 10 * 60 * 1000),
      } as any,
      update: {
        metadata: updatedMetadata,
      } as any,
    })
  }

  /**
   * Extract mapping from assistant response: numbered lists or yes/no prompts
   */
  private extractOptionMapping(responseText: string): any | null {
    if (!responseText) return null

    const lines = responseText.split(/\r?\n/)
    const options: Array<{ number: number; label: string; count?: number }> = []
    for (const line of lines) {
      const match = line.match(/^\s*(\d+)[\.|\)]\s*(.+)$/)
      if (match) {
        const number = parseInt(match[1], 10)
        const label = match[2].trim()
        if (!Number.isNaN(number) && label) {
          const countMatch = label.match(/\((\d+)\s*(prodotti|items)\)/i)
          const parsedCount = countMatch ? parseInt(countMatch[1], 10) : undefined
          options.push({ number, label, count: parsedCount })
        }
      }
    }

    if (options.length >= 2) {
      const lowerFull = responseText.toLowerCase()
      const hasPrice = /€|euro/i.test(responseText)
      const hasGroupCue = /quale\s+gruppo|gruppi?\b/i.test(lowerFull)
      const hasCategoryCue = /categorie|catalogo/i.test(lowerFull)

      let listType: "categories" | "groups" | "products" | undefined
      if (hasPrice) listType = "products"
      else if (hasGroupCue) listType = "groups"
      else if (hasCategoryCue) listType = "categories"

      return {
        type: "numbered",
        options: options.slice(0, 30),
        listType,
      }
    }

    const lower = responseText.toLowerCase()
    const hasYesNo = /\b(sì|si|yes|no|ok|va bene|okay)\b/i.test(lower)
    if (hasYesNo) {
      return { type: "binary", options: ["yes", "no", "ok"] }
    }

    return null
  }

  /**
   * 🆕 FASE 2: Execute fast-path delegation (bypasses Router LLM)
   *
   * When MessagePreprocessorService detects a deterministic selection (number, confirmation),
   * this method executes the delegation DIRECTLY to the sub-agent without calling Router LLM.
   *
   * Benefits:
   * - 100% accurate selection (no LLM interpretation errors)
   * - Faster response (saves ~500ms Router LLM call)
   * - Lower cost (no Router tokens)
   */
  /**
   * Build a minimal index of products and categories for direct intent detection.
   * Uses workspace isolation and only selects identifiers needed for matching.
   */
  private async getDirectIntentIndex(workspaceId: string): Promise<{
    products: Array<{ name?: string; sku?: string }>
    categories: Array<{ name?: string }>
  }> {
    try {
      const [productIndex, categoryIndex] = await Promise.all([
        this.prisma.products.findMany({
          where: { workspaceId, isActive: true },
          select: { name: true, sku: true },
        }),
        this.prisma.categories.findMany({
          where: { workspaceId, isActive: true },
          select: { name: true },
        }),
      ])

      return { products: productIndex, categories: categoryIndex }
    } catch (error) {
      logger.warn("⚠️ Failed to build direct intent index", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
      return { products: [], categories: [] }
    }
  }

  /**
   * Detect explicit product or category mentions in free-text messages to avoid regrouping loops.
   */
  private detectDirectIntent(
    message: string,
    products: any[],
    categories: any[]
  ): string | null {
    if (!message) return null

    const normalizedMessage = this.normalizeForMatch(message)
    if (!normalizedMessage || normalizedMessage.length < 3) return null

    const matchedProducts: Array<{ name?: string; token?: string }> = []
    const matchedCategories: Array<{ name?: string }> = []

    // 1) Check products first (higher specificity)
    for (const product of products || []) {
      const productName = product?.name || product?.sku
      const productSku = product?.sku || product?.code
      const normalizedName = this.normalizeForMatch(productName)
      const normalizedSku = this.normalizeForMatch(productSku)

      const nameTokens = normalizedName
        ? normalizedName.split(/\s+/).filter((t) => t.length >= 4)
        : []

      const tokenHit = nameTokens.find((t) => normalizedMessage.includes(t))

      if (
        (normalizedName && normalizedMessage.includes(normalizedName)) ||
        (normalizedName && normalizedName.includes(normalizedMessage)) ||
        (normalizedSku && normalizedMessage.includes(normalizedSku)) ||
        tokenHit
      ) {
        matchedProducts.push({ name: productName, token: tokenHit || normalizedName })
      }
    }

    // 2) Check categories (fallback)
    for (const category of categories || []) {
      const categoryName = category?.name
      const normalizedCategory = this.normalizeForMatch(categoryName)

      const categoryTokens = normalizedCategory
        ? normalizedCategory.split(/\s+/).filter((t) => t.length >= 4)
        : []
      const tokenHit = categoryTokens.find((t) => normalizedMessage.includes(t))

      if (
        (normalizedCategory && normalizedMessage.includes(normalizedCategory)) ||
        (normalizedCategory && normalizedCategory.includes(normalizedMessage)) ||
        tokenHit
      ) {
        matchedCategories.push({ name: categoryName })
      }
    }

    // Decide best direct intent
    if (matchedProducts.length === 1) {
      const only = matchedProducts[0]
      return `User is asking about product "${only.name}". Show product details and ask if they want to add to cart.`
    }

    if (matchedProducts.length >= 2) {
      const sampleNames = matchedProducts
        .map((m) => m.name)
        .filter(Boolean)
        .slice(0, 3)
      const keyword = matchedProducts.find((m) => m.token)?.token || normalizedMessage
      return `User is asking about products related to "${keyword}" (e.g., ${sampleNames.join(", ")}). Filter products whose name contains that keyword. Apply count rules on this subset: 1-2 → show details + ask add-to-cart; 3-5 → numbered list with prices + ask selection; 6+ → create 2-4 meaningful groups, and if grouping would yield a single bucket, list all items instead (never show a single group). Stay within matched products, do not reset to full catalog.`
    }

    if (matchedCategories.length >= 1) {
      const categoryName = matchedCategories[0].name
      return `User wants to see category "${categoryName}". Show products or sub-groups for this category. If the category has 6+ items, create 2-4 groups; if grouping would produce only one bucket, list all items with numbers instead (never show a single group). If you cannot confidently form 2+ groups, fall back to listing all items with prices and ask for a selection.`
    }

    return null
  }

  /**
   * Lowercase + accent/diacritic stripping for reliable substring comparisons.
   */
  private normalizeForMatch(text?: string): string {
    if (!text || typeof text !== "string") return ""
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
  }

  /**
   * Get specialist agent instance by type
   */
  private async getSpecialistAgent(
    agentType: AgentType,
    workspaceId: string
  ): Promise<any> {
    switch (agentType) {
      case "PRODUCT_SEARCH":
        return new ProductSearchAgentLLM(this.prisma)

      case "CART_MANAGEMENT":
        return new CartManagementAgentLLM(this.prisma)

      case "ORDER_TRACKING":
        return new OrderTrackingAgentLLM(this.prisma)

      case "CUSTOMER_SUPPORT":
        return new CustomerSupportAgentLLM(this.prisma)

      default:
        throw new Error(`Unknown agent type: ${agentType}`)
    }
  }

  /**
   * Get human-readable language display name from language code
   * @param languageCode - Language code (e.g., "it", "en", "IT", "ENG")
   * @returns Language display name (e.g., "ITALIANO", "ENGLISH")
   * @example
   * getLanguageDisplayName("it") => "ITALIANO"
   * getLanguageDisplayName("ENG") => "ENGLISH"
   * getLanguageDisplayName("") => "ITALIANO" (default)
   */
  private getLanguageDisplayName(
    languageCode: string | null | undefined
  ): string {
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
