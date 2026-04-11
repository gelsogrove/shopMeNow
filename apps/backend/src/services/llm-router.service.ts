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
 * 3. Translation Layer → Translates to customer language
 * 4. LinkReplacementService → Replaces [LINK_xxx] tokens with real URLs
 *
 * Flow:
 * 1. FAQ Check (fast path - skip LLM if FAQ match found)
 * 2. Load conversation history (last 10 minutes)
 * 3. Call Router LLM with delegation functions
 * 4. Router delegates → Specialist Agent (with OWN LLM + prompt from DB)
 * 5. Specialist Agent returns English response with [LINK_xxx] tokens
 * 6. Router processes specialist response
 * 7. Final response → Translation Layer (always) + Security Layer
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
 * @critical ALWAYS pass final response through Translation Layer
 */

import { AgentType, PrismaClient } from "@echatbot/database"
import axios from "axios"
import { withOpenRouterRetry } from "../utils/llm-retry"
import { CartManagementAgentLLM } from "../application/agents/CartManagementAgentLLM"
import { CustomerSupportAgentLLM } from "../application/agents/CustomerSupportAgentLLM"
import { OrderTrackingAgentLLM } from "../application/agents/OrderTrackingAgentLLM"
import { ProductSearchAgentLLM } from "../application/agents/ProductSearchAgentLLM"
import { ProfileManagementAgentLLM } from "../application/agents/ProfileManagementAgentLLM"
import { TranslationAgent } from "../application/agents/TranslationAgent"
import { SecurityAgent, type SecurityResult } from "../application/agents/SecurityAgent"
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
import { WorkspaceCallingFunctionRepository } from "../repositories/workspace-calling-function.repository"
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
  channel?: string // 🚫 WIDGET FIX: Channel type (widget, whatsapp, etc.)
  registrationPromptLevel?: number // 🆕 Progressive registration invitation (0=none, 1=gentle, 2=insistent, 3=warning)
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
  // Widget-specific actions (e.g., open profile modal)
  action?: {
    type: "open_profile_modal" | "open_link"
    customerId?: string
    link?: string
  }
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
  private static verifiedChangeLanguageWorkspaces = new Set<string>()
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
  private securityAgent: SecurityAgent // Widget-only security layer
  private translationAgent: TranslationAgent // Main translation layer (IT → target language)
  private conversationHistoryLayer: ConversationHistoryLayer // 🆕 Humanization layer (saluti, contesto, offerte)
  private systemContextService: SystemContextService // 🆕 System Context for hidden SKU mappings
  private optionsMappingService: OptionsMappingService // 🆕 For pendingAction ADD_TO_CART
  private callingFunctionRepo: WorkspaceCallingFunctionRepository // 🆕 Dynamic functions from DB
  private openRouterApiKey: string
  private openRouterBaseUrl = "https://openrouter.ai/api/v1"
  private maxFunctionIterations = 8 // FR-13: Increased from 5 to support repeat order confirmation flow (6-7 iterations needed)

  constructor(private prisma: PrismaClient) {
    this.agentConfigRepo = new AgentConfigRepository(prisma)
    this.faqRepo = new FAQRepository(prisma)
    this.loggerService = new AgentLoggerService(prisma)
    this.conversationManager = new ConversationManager(prisma, 10) // 10 minutes window
    this.functionExecutor = new FunctionExecutor(prisma)
    this.securityAgent = new SecurityAgent(prisma)
    this.translationAgent = new TranslationAgent(prisma) // 🆕 Feature 181: Translation layer in routing
    this.conversationHistoryLayer = new ConversationHistoryLayer(prisma) // 🆕 Humanization layer
    this.linkReplacementService = new LinkReplacementService()
    this.searchConversationRepo = new SearchConversationRepository()
    this.promptProcessor = new PromptProcessorService() // 🆕 Feature 124: Inject for variable replacement
    this.promptBuilder = new PromptBuilderService(prisma) // 🆕 Dynamic prompt generation
    this.templateLoader = TemplateLoaderService.getInstance(prisma) // 🆕 Load templates from files
    this.systemContextService = getSystemContextService(prisma) // 🆕 System Context for SKU mappings
    this.optionsMappingService = new OptionsMappingService(prisma) // 🆕 For pendingAction ADD_TO_CART
    this.callingFunctionRepo = new WorkspaceCallingFunctionRepository(prisma) // 🆕 Dynamic functions from DB

    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""
    if (!this.openRouterApiKey) {
      logger.warn("⚠️ OPENROUTER_API_KEY not set - LLM calls will fail")
    }

    logger.info("✅ LLMRouterService initialized with Function Calling support")
  }

  /**
   * Check if Widget Security Layer should be applied based on channel
   *
   * - WIDGET: Apply SecurityAgent after Translation
   * - WHATSAPP: Skip (scheduler handles security before send)
   */
  private shouldApplyWidgetSecurity(channel?: string): boolean {
    const shouldApply = channel === "widget"

    logger.debug("🔒 Widget Security check", {
      channel: channel || "undefined",
      shouldApply,
      reason: shouldApply
        ? "Widget channel - no scheduler"
        : "WhatsApp/other - scheduler handles safety",
    })

    return shouldApply
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
   * 🆕 Feature 126: Check if workspace is in debug mode (P2 - Maintenance Mode)
   *
   * When debugMode = true, chatbot is in TEST MODE → return WIP message.
   * This is second priority check (after blocked user check).
   *
   * @param workspaceId - Workspace ID to check
   * @returns true if debug mode is active, false otherwise
   */
  private async getChannelDisabled(workspaceId: string): Promise<boolean> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { debugMode: true, name: true },
    })

    // debugMode = false → Chatbot ATTIVO (produzione)
    // debugMode = true → Chatbot in DEBUG (manda WIP, queue ferma)
    if (workspace?.debugMode === true) {
      logger.info("🐛 P2: Workspace in debug mode (test mode - WIP message)", {
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
    let customerIsActive = false // 🔒 Registration status for function-level guard

    // 🔒 DEBUG: ALWAYS log router entry with message
    logger.info("🔥 ROUTER ENTRY DEBUG:", {
      message: params.message,
      customerId: params.customerId,
      workspaceId: params.workspaceId
    })
    let explicitOptionMapping: AgentOptionMapping | null = null
    let workspace: any = null // 🛍️ Workspace config for sellsProductsAndServices check

    try {
      // 🛍️ Load workspace config (for sellsProductsAndServices check)
      workspace = await this.prisma.workspace.findUnique({
        where: { id: params.workspaceId },
      })

      if (!workspace) {
        throw new Error(`Workspace not found: ${params.workspaceId}`)
      }

      customerDiscount = await this.getCustomerDiscountPercent(
        params.workspaceId,
        params.customerId
      )

      // 🔒 Feature 174: Get customer registration status for function-level guard
      const customerForGuard = await this.prisma.customers.findFirst({
        where: { id: params.customerId, workspaceId: params.workspaceId },
        select: { isActive: true },
      })
      customerIsActive = customerForGuard?.isActive ?? false

      logger.info("🎯 Routing message", {
        workspaceId: params.workspaceId,
        customerId: params.customerId,
        conversationId: params.conversationId,
        isSystemMessage: params.isSystemMessage || false,
        customerDiscount,
        customerIsActive, // 🔒 Feature 174
        sellsProductsAndServices: workspace.sellsProductsAndServices, // 🛍️ Feature 174
      })

      // 🆕 Feature 127: SYSTEM MESSAGE FAST-PATH
      // If isSystemMessage=true, skip Router/SubLLM and go DIRECTLY to Safety+Translation
      if (params.isSystemMessage) {
        logger.info(
          "🚀 SYSTEM MESSAGE FAST-PATH: Skipping Router/SubLLM, going direct to Safety+Translation"
        )
        logger.info("📍 FAST-PATH STEP 1: Applying Translation Layer")
        logger.info("📍 FAST-PATH STEP 1 INPUT:", {
          workspaceId: params.workspaceId,
          message: params.message,
          targetLanguage: params.customerLanguage || "en",
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

        const targetLanguage = params.customerLanguage || "en"
        logger.info("🌍 Applying Translation Layer", {
          customerLanguage: params.customerLanguage,
          targetLanguage,
          workspaceId: params.workspaceId,
          messageLength: params.message.length,
        })

        const translationResult = await this.translationAgent.process({
          workspaceId: params.workspaceId,
          message: params.message,
          targetLanguage,
          customerName: params.customerName,
          customerId: params.customerId,
          channel: params.channel,
        })

        totalTokens += translationResult.tokensUsed || 0

        let finalMessage = translationResult.message

        debugSteps.push({
          type: "safety",
          agent: "Translation Layer",
          timestamp: new Date().toISOString(),
          systemPrompt: translationResult.systemPrompt,
          input: {
            previousResponse: params.message,
            targetLanguage,
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

        let securityResult: SecurityResult | null = null

        if (this.shouldApplyWidgetSecurity(params.channel)) {
          const securityInput = finalMessage
          securityResult = await this.securityAgent.process({
            workspaceId: params.workspaceId,
            message: securityInput,
            customerName: params.customerName,
            customerId: params.customerId,
          })

          totalTokens += securityResult.tokensUsed || 0
          finalMessage = securityResult.message || securityInput

          debugSteps.push({
            type: "safety",
            agent: "Widget Security Layer",
            timestamp: new Date().toISOString(),
            systemPrompt: securityResult.systemPrompt,
            input: {
              textToValidate: securityInput,
            },
            output: {
              translatedText: finalMessage,
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
        } else {
          logger.info("⏭️ Skipping Widget Security (WhatsApp - scheduler handles it)")
        }

        logger.info(
          "📍 FAST-PATH STEP 2: Saving assistant message to conversation history"
        )
        logger.info("📍 FAST-PATH STEP 2 INPUT:", {
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          conversationId: params.conversationId,
          content: finalMessage,
          agentType: "SYSTEM_NOTIFICATION",
          tokensUsed: totalTokens,
        })

        // Step 2: Save as assistant message in history
        await this.conversationManager.saveAssistantMessage({
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          conversationId: params.conversationId,
          content: finalMessage,
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
          response: finalMessage,
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

        const securityMessage = securityCheck.message || "Security alert"

        const securityTranslationResult = await this.translationAgent.process({
          workspaceId: params.workspaceId,
          message: securityMessage,
          targetLanguage: params.customerLanguage || "en",
          customerName: params.customerName,
          customerId: params.customerId,
          channel: params.channel,
        })

        let translatedSecurityMessage = securityTranslationResult.message
        let securityTokensUsed = securityTranslationResult.tokensUsed || 0

        securityDebugSteps.push({
          type: "safety",
          agent: "Translation Layer",
          model: securityTranslationResult.model || "openai/gpt-4o-mini",
          temperature: 0.1,
          timestamp: new Date().toISOString(),
          systemPrompt: securityTranslationResult.systemPrompt,
          input: {
            previousResponse: securityMessage,
            targetLanguage: params.customerLanguage || "en",
          },
          output: {
            translatedText: translatedSecurityMessage,
            decision: securityTranslationResult.translated ? "translated" : "passthrough",
          },
          tokenUsage: {
            promptTokens: 0,
            completionTokens: securityTranslationResult.tokensUsed || 0,
            totalTokens: securityTranslationResult.tokensUsed || 0,
          },
        })

        if (this.shouldApplyWidgetSecurity(params.channel)) {
          const securityInput = translatedSecurityMessage
          const widgetSecurityResult = await this.securityAgent.process({
            workspaceId: params.workspaceId,
            message: securityInput,
            customerName: params.customerName,
            customerId: params.customerId,
          })

          translatedSecurityMessage = widgetSecurityResult.message || securityInput
          securityTokensUsed += widgetSecurityResult.tokensUsed || 0

          securityDebugSteps.push({
            type: "safety",
            agent: "Widget Security Layer",
            model: "openai/gpt-4o-mini",
            temperature: 0.2,
            timestamp: new Date().toISOString(),
            systemPrompt: widgetSecurityResult.systemPrompt,
            input: {
              textToValidate: securityInput,
            },
            output: {
              translatedText: translatedSecurityMessage,
              safe: widgetSecurityResult.safe,
              decision: widgetSecurityResult.safe ? "approved" : "blocked",
            },
            tokenUsage: {
              promptTokens: 0,
              completionTokens: widgetSecurityResult.tokensUsed || 0,
              totalTokens: widgetSecurityResult.tokensUsed || 0,
            },
            safe: widgetSecurityResult.safe,
            blocked: !widgetSecurityResult.safe,
            blockedReason: widgetSecurityResult.blockedReason,
          })
        } else {
          logger.info("⏭️ Skipping Widget Security for security message (WhatsApp - scheduler handles it)")
        }

        // Save generic security warning (OUTBOUND) with translated message and debugInfo
        await this.conversationManager.saveAssistantMessage({
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          conversationId: params.conversationId,
          content: translatedSecurityMessage,
          agentType: "ROUTER" as AgentType,
          debugInfo: {
            steps: securityDebugSteps,
            totalTokens: securityTokensUsed,
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
          tokensUsed: securityTokensUsed,
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
        // wipMessage can be either a JSON object with language keys { en: "...", it: "..." }
        // or a plain string. Handle both formats gracefully.
        const rawWip = workspace?.wipMessage
        let wipMessage: string
        if (rawWip && typeof rawWip === "object") {
          // JSON object with language keys
          const lang = params.customerLanguage?.toLowerCase() || "en"
          wipMessage = (rawWip as any)[lang] || (rawWip as any).en || "Work in progress. Please contact us later."
        } else if (typeof rawWip === "string" && rawWip.trim()) {
          wipMessage = rawWip
        } else {
          wipMessage = "Work in progress. Please contact us later."
        }

        logger.info("🚧 P2: Sending WIP message (chatbot disabled)", {
          workspaceId: params.workspaceId,
          language: params.customerLanguage,
          executionTimeMs,
        })

        // 🔍 Build debug steps for WIP message flow
        // NOTE: WIP messages are already multi-language (selected from wipMessage JSON by language key)
        // NO LLM calls needed — zero tokens, zero cost, fast execution
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
              textResponse: wipMessage,
            },
            tokenUsage: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            },
          },
        ]

        return {
          response: wipMessage,
          agentUsed: "ROUTER" as AgentType,
          confidence: 1.0,
          tokensUsed: 0,
          executionTimeMs,
          wasFAQ: false,
          debugInfo: {
            steps: wipDebugSteps,
            totalTokens: 0,
            totalCost: 0,
            executionTimeMs,
            timestamp: new Date().toISOString(),
          },
        }
      }

      // ✅ Priority checks passed - proceeding to normal LLM router flow

      // ❌ REMOVED: FAQ Pre-check (lines 209-320)
      // WHY: FAQ check bypassed Router LLM → Router lost decision control
      // NEW APPROACH: Router LLM decides FIRST, then can delegate to FAQ agent if needed
      // TODO: Implement FAQ as delegatable function for Router to call

      // STEP 2: Load conversation history
      logger.info("Step 2: Loading conversation history")
      const isInformational = workspace?.sellsProductsAndServices === false
      const conversationHistoryRaw = await this.conversationManager.loadHistory(
        params.workspaceId,
        params.conversationId
      )

      // 🛑 Session Rate Limit: Prevent infinite loops or abuse (max 100 calls in 24h history window)
      const recentFunctionCallsCount = conversationHistoryRaw.filter(msg => msg.role === "function").length
      if (recentFunctionCallsCount > 100) {
        logger.warn(`🛑 Session function rate limit reached: ${params.conversationId} (${recentFunctionCallsCount} calls)`)
        const limitMessage = workspace.language === "it"
          ? "Spiacenti, hai raggiunto il limite massimo di operazioni per questa sessione. Riprova tra qualche minuto."
          : "Sorry, you've reached the maximum number of operations for this session. Please try again in a few minutes."

        // Save assistant response atomically so user sees why it's blocked
        await this.conversationManager.saveUserAndAssistantAtomic({
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          conversationId: params.conversationId,
          userContent: params.message,
          assistantContent: limitMessage,
          agentType: isInformational ? "INFO_AGENT" : "ROUTER",
          debugInfo: { error: "SESSION_RATE_LIMIT_EXCEEDED", callCount: recentFunctionCallsCount }
        })

        return {
          response: limitMessage,
          agentUsed: "ROUTER" as AgentType,
          confidence: 0,
          tokensUsed: 0,
          executionTimeMs: Date.now() - startTime,
          wasFAQ: false,
          debugInfo: {
            steps: [],
            totalTokens: 0,
            totalCost: 0,
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
          }
        }
      }

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

      // STEP 4: Load Router/Info Agent template from files
      // 🛍️ Feature 174: Informational workspaces use INFO_AGENT template instead of ROUTER
      const mainAgentType = isInformational ? "INFO_AGENT" : "ROUTER"
      const routerSystemPrompt = await this.templateLoader.loadAndRenderTemplate(
        mainAgentType,
        params.workspaceId
      )

      logger.info(`📋 Loaded ${mainAgentType} template from files`, {
        promptLength: routerSystemPrompt.length,
        isInformational,
      })

      // STEP 4.5: Load customer data and dynamic content for Router prompt
      logger.info("Step 4.5: Loading customer data and dynamic content")
      const customer = await this.prisma.customers.findFirst({
        where: { id: params.customerId, workspaceId: params.workspaceId }, // 🔒 Workspace isolation
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          discount: true,
          isActive: true, // 🔒 Feature 174: Must include for price visibility control
          language: true,
          company: true,
          push_notifications_consent: true,
          sales: { select: { firstName: true, lastName: true, phone: true, email: true } }, // Include sales via select
        }
      })

      if (!customer) {
        throw new Error(`Customer ${params.customerId} not found in workspace ${params.workspaceId}`)
      }

      // Workspace already loaded at the top of routeMessage

      const messageRepo =
        new (require("../repositories/message.repository").MessageRepository)()

      const directIntentIndexPromise = this.getDirectIntentIndex(params.workspaceId)

      // 🛍️ Filter catalog data based on workspace type
      // E-commerce channels: Load products, categories, offers
      // Informational channels: Load only services and FAQs
      const [categories, offers, products, services, faqs, lastOrder, directIntentIndex, appointmentTypesRaw, customerAppointmentsRaw] =
        await Promise.all([
          workspace.sellsProductsAndServices
            ? messageRepo.getActiveCategories(params.workspaceId)
            : Promise.resolve([]),
          workspace.sellsProductsAndServices
            ? messageRepo.getActiveOffers(params.workspaceId)
            : Promise.resolve([]),
          workspace.sellsProductsAndServices
            ? messageRepo.getActiveProducts(
              params.workspaceId,
              customer.discount || 0,
              customerIsActive // 🔒 Feature 174: Hide prices for non-registered users
            )
            : Promise.resolve([]),
          messageRepo.getActiveServices(
            params.workspaceId,
            customerIsActive // 🔒 Feature 174: Hide prices for non-registered users (Rule #4)
          ), // ✅ Always load (informational)
          messageRepo.getActiveFaqs(params.workspaceId), // ✅ Always load (informational)
          this.prisma.orders.findFirst({
            where: { customerId: customer.id },
            orderBy: { createdAt: "desc" },
            select: { orderCode: true },
          }),
          directIntentIndexPromise,
          // 📅 Calendar: Load bookable services if calendar is enabled
          workspace.enableCalendarBooking
            ? this.prisma.services.findMany({
                where: { workspaceId: params.workspaceId, isActive: true, enableForBooking: true },
                select: { name: true, description: true, duration: true, price: true },
                orderBy: { name: 'asc' },
              })
            : Promise.resolve([]),
          // 📅 Calendar: Load customer's upcoming appointments
          workspace.enableCalendarBooking
            ? this.prisma.appointment.findMany({
                where: {
                  workspaceId: params.workspaceId,
                  customerId: customer.id,
                  status: 'confirmed',
                  startTime: { gte: new Date() },
                },
                include: { service: true },
                orderBy: { startTime: 'asc' },
                take: 5,
              })
            : Promise.resolve([]),
        ])

      // 📅 Format appointment data for prompt variables
      const appointmentTypesForPrompt = appointmentTypesRaw.length > 0
        ? appointmentTypesRaw.map(t =>
            `- ${t.name}${t.description ? ` (${t.description})` : ''}: ${t.duration} min${t.price ? `, €${t.price}` : ''}`
          ).join('\n')
        : ''

      const customerUpcomingAppointmentsForPrompt = customerAppointmentsRaw.length > 0
        ? customerAppointmentsRaw.map(a =>
            `- ${a.service?.name || 'Appointment'}: ${a.startTime.toLocaleDateString('it-IT')} ${a.startTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} (${a.status})`
          ).join('\n')
        : ''

      logger.info("📦 Catalog data loaded", {
        productsCount: products.length,
        categoriesCount: categories.length,
        offersCount: offers.length,
        servicesCount: services.length,
        faqsCount: faqs.length,
        sellsProductsAndServices: workspace.sellsProductsAndServices,
      })

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
          appointmentTypes: appointmentTypesForPrompt,
          customerUpcomingAppointments: customerUpcomingAppointmentsForPrompt,
        },
        {
          lastOrderCode: lastOrder?.orderCode || undefined,
          channel: params.channel || 'whatsapp', // 🚫 WIDGET FIX: Pass channel to builder
        }
      )

      // 🔒 BACKWARD COMPATIBILITY: Build legacy customerData object from PromptVariables
      // This is passed to sub-agents until they are migrated to use PromptVariables directly
      const customerData = {
        nameUser: promptVariables.customerName,
        email: promptVariables.customerEmail,
        phone: promptVariables.customerPhone,
        discountUser: promptVariables.customerDiscount,
        isActive: promptVariables.customerIsActive ?? false, // 🔒 Feature 174: Registration status for price visibility
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

      // 🔒 DEBUG: Log customerData construction with raw DB customer data
      logger.info("🔒 DEBUG customerData construction:", {
        rawCustomerIsActive: customer?.isActive,
        promptVariablesCustomerIsActive: promptVariables.customerIsActive,
        finalCustomerDataIsActive: customerData.isActive,
        customerName: customer?.name,
        customerEmail: customer?.email
      })

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
        // 🛍️ Feature 174: Use INFO_AGENT for informational workspaces
        const builtPrompt = await this.promptBuilder.build(mainAgentType, {
          workspaceId: params.workspaceId,
          customerId: params.customerId,
        })

        // ✅ CRITICAL: Replace ALL variables ({{chatbotName}}, {{botIdentityResponse}}, etc.)
        const promptProcessor = new PromptProcessorService()
        processedRouterPrompt = promptProcessor.processWithVariables(
          builtPrompt.content,
          promptVariables
        )

        logger.info(`✅ ${mainAgentType} prompt generated via PromptBuilder`, {
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
            workspace?.websiteUrl || workspace?.url,
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
              supportEmail: workspace?.notificationEmail || undefined,
              allowedExternalLinks: workspace?.allowedExternalLinks || [], // 🆕 Security: allowed domains
              address: workspace?.address || undefined, // 🆕 Physical address
              customAiRules: workspace?.customAiRules || undefined, // 🆕 Custom AI rules
              websiteUrl: workspace?.websiteUrl || workspace?.url || undefined,
              chatbotName: workspace?.chatbotName || undefined, // 🆕 MISSING: Bot name
              businessType: workspace?.businessType || undefined, // 🆕 MISSING: Business type
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

      // 🆕 STEP 4.8: Add Registration Prompt (Progressive invitation system)
      if (params.registrationPromptLevel && params.registrationPromptLevel > 0) {
        const { registrationPromptService } = require("../services/registration-prompt.service")
        const registrationPromptText = registrationPromptService.getPromptText(params.registrationPromptLevel)
        processedRouterPrompt += "\n\n" + registrationPromptText

        logger.info("📝 [RegistrationPrompt] Added to Router prompt", {
          level: params.registrationPromptLevel,
          promptLength: registrationPromptText.length,
        })
      } else {
        logger.info("📝 [RegistrationPrompt] Skipped (level 0 or not set)")
      }

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

      // Load router agent config from DB to respect workspace settings
      const routerAgentConfig = await this.agentConfigRepo.findByTypeCached(
        params.workspaceId,
        mainAgentType as AgentType
      )

      // Create processed router agent with replaced prompt and DB-backed config
      const processedRouterAgent = {
        systemPrompt: processedRouterPrompt,
        model: routerAgentConfig?.model || "gpt-4o-mini", // default if missing
        temperature: routerAgentConfig?.temperature ?? 0, // fallback deterministic routing
        maxTokens: routerAgentConfig?.maxTokens ?? 2000,
      }

      // STEP 5: Function Calling Loop
      logger.info("Step 3: Starting Function Calling loop")
      // 🆕 Feature: Load all active functions from DB (System + Custom)
      const dbFunctions = await this.callingFunctionRepo.findActiveByWorkspace(params.workspaceId)

      // Lazy migration: ensure changeLanguage exists for workspaces created before this feature
      if (!LLMRouterService.verifiedChangeLanguageWorkspaces.has(params.workspaceId)) {
        const hasChangeLanguage = dbFunctions.some(fn => fn.functionName === "changeLanguage")
        if (!hasChangeLanguage) {
          try {
            const created = await this.prisma.workspaceCallingFunction.upsert({
              where: { workspaceId_functionName: { workspaceId: params.workspaceId, functionName: "changeLanguage" } },
              update: { isActive: true },
              create: {
                workspaceId: params.workspaceId,
                functionName: "changeLanguage",
                description: "Change the customer's preferred language. Supported: Italian (it), English (en), Spanish (es), Portuguese (pt).",
                parameters: {
                  type: "object",
                  properties: {
                    language: { type: "string", enum: ["it", "en", "es", "pt"], description: "ISO 639-1 language code" }
                  },
                  required: ["language"]
                },
                isSystemFunction: true,
                executionType: "INTERNAL",
                isActive: true
              }
            })
            dbFunctions.push(created)
            logger.info(`✅ Lazy-migrated changeLanguage for workspace ${params.workspaceId}`)
          } catch (error) {
            logger.warn(`⚠️ Failed to lazy-migrate changeLanguage (non-fatal):`, error)
          }
        }
        LLMRouterService.verifiedChangeLanguageWorkspaces.add(params.workspaceId)
      }

      // 🎯 RUNTIME FILTERING: Filter functions based on workspace capabilities
      // This ensures LLM only sees functions relevant to the workspace's feature set
      const ecommerceFunctions = ["productSearchAgent", "cartManagementAgent", "orderTrackingAgent"]
      const appointmentFunctions = ["listAvailableSlots", "bookAppointment", "cancelAppointment", "rescheduleAppointment", "getCustomerAppointments"]
      
      const filteredDbFunctions = dbFunctions.filter(fn => {
        // Rule 1: Exclude e-commerce functions if workspace is informational
        if (!workspace.sellsProductsAndServices && ecommerceFunctions.includes(fn.functionName)) {
          return false
        }
        // Rule 2: Exclude appointment functions if calendar not enabled
        if (!workspace.enableCalendarBooking && appointmentFunctions.includes(fn.functionName)) {
          return false
        }
        // Rule 3: Widget channel must not expose profile/personal-data tools
        const widgetBlockedFunctions = [
          "profileManagementAgent",
          "getProfileLink",
          "handlePushNotifications",
        ]
        if (params.channel === "widget" && widgetBlockedFunctions.includes(fn.functionName)) {
          return false
        }
        // 🔮 Future: Add filters for hasSalesAgents, hasHumanSupport, etc.
        return true
      })

      // Convert to OpenRouter/OpenAI format
      const tools = filteredDbFunctions.map(fn => ({
        type: "function" as const,
        function: {
          name: fn.functionName,
          description: fn.description || "",
          parameters: (fn.parameters as any) || { type: "object", properties: {} }
        }
      }))

      logger.info(`🛠️ Loaded ${tools.length} dynamic tools for workspace ${params.workspaceId}`)

      // Pass tools to functionCallingLoop
      const result = await this.functionCallingLoop({
        routerAgent: processedRouterAgent,
        conversationHistory: conversationHistoryForRouter,
        userMessage: userMessageForRouter,
        params,
        customerDiscount,
        customerIsActive,
        sellsProductsAndServices: workspace?.sellsProductsAndServices ?? true,
        workspace: workspace!,
        preprocessResult,
        tools
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

      // STEP 4: Replace tokens BEFORE Translation
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
      logger.info("🔍 STEP 4.6: Variable replacement", {
        workspaceId: params.workspaceId,
        responseBeforeReplacement: responseWithLinks.substring(0, 200),
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
        companyName: workspace?.name || "L'Altra Italia",
        languageUser: this.getLanguageDisplayName(
          customer.language || workspace?.language || "en"
        ),
        lastordercode: lastOrder?.orderCode || "",
        channelName: workspace?.name || "Shop",
        adminEmail: workspace?.notificationEmail || "support@echatbot.ai",
        botIdentityResponse: workspace?.botIdentityResponse || "Virtual Assistant",
      }

      responseWithLinks = this.promptProcessor.replaceCustomerVariables(
        responseWithLinks,
        customerVarsData
      )

      // STEP 4.7: Apply Conversation History Layer (🆕 Humanization)
      logger.info("Step 4.7: Applying Conversation History Layer")

      const responseTypeMap: Record<string, TechnicalResponseType> = {
        PRODUCT_SEARCH: "PRODUCT_LIST",
        CART_MANAGEMENT: "CART_STATUS",
        ORDER_TRACKING: "ORDER_LIST",
        CUSTOMER_SUPPORT: "FAQ_ANSWER",
        INFO_AGENT: "FAQ_ANSWER",
        PROFILE_MANAGEMENT: "PROFILE",
        ROUTER: "GENERIC",
      }
      const technicalResponseType = responseTypeMap[result.agentUsed || "ROUTER"] || "GENERIC"

      let conversationMindset: "SALES" | "SUPPORT" | "NEUTRAL" = "NEUTRAL"
      const salesTypes: TechnicalResponseType[] = ["PRODUCT_LIST", "PRODUCT_DETAIL", "CATEGORY_LIST", "CART_STATUS", "CART_UPDATED", "CART_EMPTY", "CHECKOUT", "ORDER_CONFIRMED"]
      const supportTypes: TechnicalResponseType[] = ["FAQ_ANSWER", "SUPPORT_REQUEST", "PROFILE", "ORDER_LIST"]

      if (salesTypes.includes(technicalResponseType)) {
        conversationMindset = "SALES"
      } else if (supportTypes.includes(technicalResponseType)) {
        conversationMindset = "SUPPORT"
      }

      const historyForLayer: ConversationMessage[] = conversationHistory.map((msg: any) => ({
        role: msg.role === "user" ? "customer" : "assistant",
        content: msg.content,
        timestamp: new Date(),
      }))

      const isFirstMessage = conversationHistory.length === 0

      const humanizedResult = await this.conversationHistoryLayer.process({
        workspaceId: params.workspaceId,
        customerId: params.customerId,
        customerName: promptVariables.customerName || "",
        conversationHistory: historyForLayer,
        currentQuestion: params.message,
        technicalResponse: {
          type: technicalResponseType,
          rawMessage: responseWithLinks,
          optionsMapping: explicitOptionMapping || undefined,
        },
        botIdentity: {
          name: workspace?.chatbotName || "Assistente",
          personality: workspace?.botIdentityResponse || null,
        },
        customAiRules: workspace?.customAiRules || null,
        companyName: workspace?.name || "",
        activeOffers: [],
        faqs: [], // Can be enhanced later
        mindset: conversationMindset,
        hasSalesAgents: workspace?.hasSalesAgents ?? false,
        isFirstMessage,
        lastAgentUsed: result.agentUsed || "ROUTER",
        customerLanguage: params.customerLanguage || "en",
      })

      const messageForTranslation = humanizedResult.message
      const humanizationTokens = humanizedResult.metadata.tokensUsed || 0
      totalTokens += humanizationTokens

      debugInfo.steps.push({
        type: "humanization",
        agent: "Conversation History Layer",
        model: humanizedResult.metadata.model,
        temperature: 0.7,
        timestamp: new Date().toISOString(),
        input: {
          technicalResponse: responseWithLinks.substring(0, 200),
          isFirstMessage,
        },
        output: {
          humanizedText: humanizedResult.message.substring(0, 200),
          addedGreeting: humanizedResult.metadata.addedGreeting,
        },
        tokenUsage: {
          promptTokens: 0,
          completionTokens: humanizationTokens,
          totalTokens: humanizationTokens,
        },
      })

      // STEP 5: Apply Translation Layer (always)
      logger.info("Step 5: Applying Translation Layer")
      const translationResult = await this.translationAgent.process({
        workspaceId: params.workspaceId,
        message: messageForTranslation,
        targetLanguage: params.customerLanguage || "en",
        customerName: params.customerName,
        customerId: params.customerId,
        channel: params.channel,
      })

      const finalResponse = translationResult.message
      const translationTokens = translationResult.tokensUsed || 0

      totalTokens += translationTokens

      debugInfo.steps.push({
        type: "safety",
        agent: "Translation Layer",
        model: translationResult.model || "openai/gpt-4o-mini",
        temperature: 0.1,
        timestamp: new Date().toISOString(),
        systemPrompt: translationResult.systemPrompt || "Translate the following message",
        input: {
          previousResponse: responseWithLinks.substring(0, 200),
          targetLanguage: params.customerLanguage || "en",
        },
        output: {
          translatedText: translationResult.message,
          decision: "translated",
        },
        tokenUsage: {
          promptTokens: 0,
          completionTokens: translationTokens,
          totalTokens: translationTokens,
        },
      })

      let finalCleanResponse = finalResponse

      // Punctuation clean up and security (simplified for brevity but essential for finalCleanResponse definition)
      finalCleanResponse = finalCleanResponse
        .replace(/\s*\[SKU:[A-Z0-9-]+\]/gi, '')
        .replace(/\s*\[SKUS?:[A-Z0-9-,]+\]/gi, '')

      if (this.shouldApplyWidgetSecurity(params.channel)) {
        const securityInput = finalCleanResponse
        const widgetSecurityResult = await this.securityAgent.process({
          workspaceId: params.workspaceId,
          message: securityInput,
          customerName: params.customerName,
          customerId: params.customerId,
        })

        totalTokens += widgetSecurityResult.tokensUsed || 0
        finalCleanResponse = widgetSecurityResult.message || securityInput
      }

      // 📢 REGISTRATION REMINDER: Every 6 messages, add registration call-to-action (WhatsApp only)
      // Widget channel skips this: the FunctionExecutor guard already injects [LINK_REGISTRATION]
      // when the user attempts a protected action (orders, cart, appointments).
      try {
        if (params.channel !== "widget" && !customerData.isActive && !(params.registrationPromptLevel && params.registrationPromptLevel > 0)) {
          const messageCount = await this.prisma.conversationMessage.count({
            where: {
              workspaceId: params.workspaceId,
              customerId: params.customerId,
              role: "assistant",
              createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            },
          })

          if ((messageCount + 1) % 6 === 0) {
            // Append a soft, non-intrusive invite rather than a bare link
            finalCleanResponse += "\n\n💡 Register to unlock orders, cart, and more: [LINK_REGISTRATION]"
            const reminderLinkResult = await this.linkReplacementService.replaceTokens(
              { response: finalCleanResponse },
              params.customerId,
              params.workspaceId
            )
            if (reminderLinkResult.success && reminderLinkResult.response) {
              finalCleanResponse = reminderLinkResult.response
            }
          }
        }
      } catch (registrationReminderError) {
        logger.error("⚠️ Failed to add registration reminder", { error: registrationReminderError })
      }
      // 🔗 FINAL CATCH-ALL LINK REPLACEMENT
      // This ensures that any [LINK_XXX] tokens injected by Conversation History Layer,
      // Translation Agent, or Security Agent are replaced before reaching the user.
      const finalLinkCheck = finalCleanResponse.includes("[LINK_") || finalCleanResponse.includes("_TOKEN]") || finalCleanResponse.includes("LINK_")

      if (finalLinkCheck) {
        logger.info("🔗 [LLMRouter] Final link replacement pass triggered")
        const finalLinkResult = await this.linkReplacementService.replaceTokens(
          { response: finalCleanResponse },
          params.customerId,
          params.workspaceId
        )
        if (finalLinkResult.success && finalLinkResult.response) {
          finalCleanResponse = finalLinkResult.response
          logger.info("✅ [LLMRouter] Final link replacement successful")
        }
      }

      // ⚠️ CRITICAL LOG - Verify we reach this point
      logger.info("🏁 [LLMRouter] Routing complete - returning response to orchestrator")

      return {
        response: finalCleanResponse,
        agentUsed: result.agentUsed || "ROUTER",
        confidence: result.confidence || 0.9,
        tokensUsed: totalTokens,
        executionTimeMs,
        wasFAQ: false,
        debugInfo: debugInfo,
        selectedProduct: result.selectedProduct,
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

      // 🔧 Pass generic error message through Translation Layer (always)
      // 🔧 Widget: apply security layer after translation
      const safetyTimestamp = new Date().toISOString()
      const baseErrorMessage = "System error - please try again"

      const errorTranslationResult = await this.translationAgent.process({
        workspaceId: params.workspaceId,
        message: baseErrorMessage,
        targetLanguage: params.customerLanguage || "en",
        customerName: params.customerName,
        customerId: params.customerId,
        channel: params.channel,
      })

      let finalErrorMessage = errorTranslationResult.message
      let errorTokensUsed = errorTranslationResult.tokensUsed || 0

      errorDebugSteps.push({
        type: "safety",
        agent: "Translation Layer",
        model: errorTranslationResult.model || "openai/gpt-4o-mini",
        temperature: 0.1,
        timestamp: safetyTimestamp,
        systemPrompt: errorTranslationResult.systemPrompt,
        tokenUsage: errorTranslationResult.tokensUsed
          ? {
            promptTokens: 0,
            completionTokens: errorTranslationResult.tokensUsed,
            totalTokens: errorTranslationResult.tokensUsed,
          }
          : undefined,
        input: {
          previousResponse: baseErrorMessage,
          targetLanguage: params.customerLanguage || "en",
        },
        output: {
          translatedText: finalErrorMessage,
          decision: errorTranslationResult.translated ? "translated" : "passthrough",
        },
        language: params.customerLanguage || "en",
      })

      if (this.shouldApplyWidgetSecurity(params.channel)) {
        const securityInput = finalErrorMessage
        const errorSecurityResult = await this.securityAgent.process({
          workspaceId: params.workspaceId,
          message: securityInput,
          customerName: params.customerName,
          customerId: params.customerId,
        })

        finalErrorMessage = errorSecurityResult.message || securityInput
        errorTokensUsed += errorSecurityResult.tokensUsed || 0

        errorDebugSteps.push({
          type: "safety",
          agent: "Widget Security Layer",
          model: "openai/gpt-4o-mini",
          temperature: 0.2,
          timestamp: new Date().toISOString(),
          systemPrompt: errorSecurityResult.systemPrompt,
          tokenUsage: errorSecurityResult.tokensUsed
            ? {
              promptTokens: 0,
              completionTokens: errorSecurityResult.tokensUsed,
              totalTokens: errorSecurityResult.tokensUsed,
            }
            : undefined,
          input: {
            textToValidate: securityInput,
          },
          output: {
            translatedText: finalErrorMessage,
            decision: errorSecurityResult.safe ? "approved" : "blocked",
            safe: errorSecurityResult.safe,
          },
          safe: errorSecurityResult.safe,
          blocked: !errorSecurityResult.safe,
          blockedReason: errorSecurityResult.blockedReason,
        })
      } else {
        logger.info("⏭️ Skipping Widget Security for error message (WhatsApp - scheduler handles it)")
      }

      return {
        response: finalErrorMessage,
        tokensUsed: errorTokensUsed,
        executionTimeMs,
        agentUsed: "ROUTER" as AgentType,
        confidence: 0,
        wasFAQ: false,
        debugInfo: {
          steps: errorDebugSteps,
          totalTokens: errorTokensUsed,
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
    customerIsActive: boolean // 🔒 Feature 174: Registration status for function-level guard
    sellsProductsAndServices: boolean
    workspace: any // 🛍️ Workspace object for catalog filtering
    preprocessResult?: PreprocessResult // 🆕 FASE 2: Deterministic delegation
    tools?: any[] // 🆕 Dynamic tools from DB
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
      customerIsActive, // 🔒 Feature 174
      sellsProductsAndServices,
      workspace,
      preprocessResult,
      tools,
    } = options

    let messages: any[] = [
      { role: "system" as const, content: routerAgent.systemPrompt },
      ...conversationHistory,
      { role: "user" as const, content: PromptProcessorService.wrapUserInput(userMessage) },
    ]

    // 🛡️ Sofia Fix: Ensure the LLM doesn't skip tools when a match exists
    const toolCoachingMsg = sellsProductsAndServices
      ? "CRITICAL: For business operations (products, cart, orders, profile or support issues), YOU MUST call the appropriate specialist function. DO NOT attempt to answer these with text directly."
      : "CRITICAL: If the user request matches a function (Profile Management, Support, etc.), YOU MUST call the function. DO NOT answer with text instructions or your identity description if a function is available for the request."

    messages.splice(messages.length - 1, 0, {
      role: "system",
      content: toolCoachingMsg
    })

    let totalTokens = 0
    let iterations = 0
    // 🛍️ Feature 174: Default to INFO_AGENT for informational workspaces
    let agentUsed: AgentType = sellsProductsAndServices ? "ROUTER" : "INFO_AGENT"

    // 🆕 Track selected product from ProductSearchAgentLLM for pendingAction
    let selectedProductFromAgent: { sku: string; name: string; itemType: string } | null = null

    // 🔧 NEW: Track execution steps for debug timeline
    const debugSteps: DebugStep[] = []

    // 🔧 LOOP-SAFETY: break out if LLM keeps requesting same function
    let lastFunctionSignature = ""
    let repeatedFunctionCalls = 0

    // 🆕 NOTE: FAST-PATH removed - LLM now handles all selections using conversation history
    // The preprocessor enriches the message with hints, and LLM understands context

    // Loop until max iterations or final response
    while (iterations < this.maxFunctionIterations) {
      iterations++

      logger.info(
        `Function Calling iteration ${iterations}/${this.maxFunctionIterations}`
      )

      // 🔧 DEBUG: Log FULL system prompt to verify variable replacement
      logger.info("*******FULL SYSTEM PROMPT SENT TO ROUTER LLM*******")
      logger.info(messages[0]?.content || "NO SYSTEM PROMPT")
      logger.info("*******END SYSTEM PROMPT*******")

      // 🔧 DEBUG: Log what we're sending to the LLM
      logger.info("🔍 DEBUG - Messages sent to Router LLM:", {
        systemPromptPreview: messages[0]?.content?.substring(0, 500),
        conversationHistoryCount: messages.length - 2, // minus system and user
        userMessagePreview: messages[messages.length - 1]?.content?.substring(0, 500) || "",
        userMessage: messages[messages.length - 1]?.content,
      })

      let llmResponse: any
      let routerCallDuration = 0
      const routerCallTimestamp = new Date().toISOString()

      // Normal LLM call - let LLM handle ALL questions including identity questions
      // ✅ LLM is intelligent enough to understand "chi sei?" in any language
      // ✅ botIdentityResponse is in system prompt for bot to respond naturally
      const routerCallStart = Date.now()
      // 🆕 Run LLM with dynamic tools
      const routerResponse = await this.callRouterLLM({
        model: routerAgent.model,
        messages,
        temperature: routerAgent.temperature,
        maxTokens: routerAgent.maxTokens,
        sellsProductsAndServices, // 🆕 Dynamic function routing
        channel: params.channel,
        tools, // 🆕 Pass dynamic tools
      })
      routerCallDuration = Date.now() - routerCallStart

      totalTokens += routerResponse.tokensUsed
      llmResponse = routerResponse

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

        // LOOP-SAFETY: detect endless identical function calls (e.g., greetings)
        const currentSignature = `${functionName}:${JSON.stringify(functionArgs)}`
        if (currentSignature === lastFunctionSignature) {
          repeatedFunctionCalls += 1
        } else {
          repeatedFunctionCalls = 0
          lastFunctionSignature = currentSignature
        }

        if (repeatedFunctionCalls >= 2) {
          logger.warn("⚠️ Detected repeating function calls. Breaking with safe fallback.", {
            functionName,
            iterations,
            repeatedFunctionCalls,
          })
          return {
            response:
              "Ciao! Sto ancora elaborando, ma posso già aiutarti: dimmi cosa ti serve (ordini, prodotti o supporto) e ci penso io.",
            tokensUsed: totalTokens,
            iterations,
            agentUsed,
            confidence: 0.5,
            debugSteps,
            selectedProduct: selectedProductFromAgent,
          }
        }

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
            customerIsActive: customerIsActive, // 🔒 Feature 174: Registration status for function-level guard
            sellsProductsAndServices: workspace?.sellsProductsAndServices ?? true, // 🛍️ Registration link only if workspace sells products
            channel: params.channel, // 🌐 "widget" | "whatsapp" — required for contactOperator routing
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

          // 🚫 WIDGET: Skip PROFILE_MANAGEMENT delegation
          // Widget visitors are anonymous (no phone) — profile link generation fails.
          // Let the LLM respond naturally instead of triggering calling functions.
          if (params.channel === "widget" && delegationTarget === "PROFILE_MANAGEMENT") {
            logger.info("🚫 [WIDGET] Skipping PROFILE_MANAGEMENT delegation — not supported for widget", {
              delegationTarget,
              query: delegationQuery,
            })
            // 🌍 Channel-aware fallback: widget does not support profile data operations
            // Covers the most common languages; TranslationAgent is not available here (no sub-agent loop)
            const lang = (params.customerLanguage || "it").toLowerCase().slice(0, 2)
            const profileFallbackMap: Record<string, string> = {
              it: "Per motivi di privacy, nel widget non posso mostrare o modificare i dati del profilo personale. Posso aiutarti qui con informazioni generali oppure metterti in contatto con un operatore.",
              en: "For privacy reasons, profile data cannot be viewed or edited inside the widget chat. I can help with general information here, or connect you with a human operator.",
              es: "Por privacidad, en el widget no puedo mostrar ni modificar los datos del perfil personal. Aquí puedo ayudarte con información general o ponerte en contacto con un operador.",
              pt: "Por privacidade, no widget não posso mostrar nem alterar dados do perfil pessoal. Posso ajudar aqui com informações gerais ou ligar você a um operador.",
              fr: "Pour des raisons de confidentialité, je ne peux pas afficher ni modifier les données de profil personnel dans le widget. Je peux vous aider ici avec des informations générales ou vous mettre en relation avec un opérateur.",
              de: "Aus Datenschutzgründen kann ich Profildaten im Widget-Chat nicht anzeigen oder bearbeiten. Ich kann hier mit allgemeinen Informationen helfen oder Sie mit einem Mitarbeiter verbinden.",
            }
            const profileFallback = profileFallbackMap[lang] ?? profileFallbackMap["en"]
            return {
              response: profileFallback,
              agentUsed: "ROUTER",
              confidence: 0.9,
              tokensUsed: totalTokens,
              iterations: 0,
              debugSteps: [],
            }
          }

          logger.info(`🔀 Delegation detected to: ${delegationTarget}`, {
            query: delegationQuery,
          })

          // Get customer full info with sales agent
          const customer = await this.prisma.customers.findFirst({
            where: { id: params.customerId, workspaceId: params.workspaceId }, // 🔐 Workspace isolation
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              discount: true,
              isActive: true, // 🔒 Feature 174: Must include for price visibility control
              language: true,
              company: true,
              push_notifications_consent: true,
              sales: { select: { firstName: true, lastName: true, phone: true, email: true } }, // Include sales via select
            }
          })

          if (!customer) {
            throw new Error(`Customer not found: ${params.customerId} in workspace ${params.workspaceId}`)
          }

          // Workspace already loaded at the top of routeMessage (reuse it)

          // Get catalog data for sub-agent
          const customerDiscountForCatalog = customer.discount || 0
          const messageRepo =
            new (require("../repositories/message.repository").MessageRepository)()

          // 🛍️ Filter catalog data based on workspace type (delegation context)
          const [categories, offers, products, lastOrder] = await Promise.all([
            workspace!.sellsProductsAndServices
              ? messageRepo.getActiveCategories(params.workspaceId)
              : Promise.resolve([]),
            workspace!.sellsProductsAndServices
              ? messageRepo.getActiveOffers(params.workspaceId)
              : Promise.resolve([]),
            workspace!.sellsProductsAndServices
              ? messageRepo.getActiveProducts(
                params.workspaceId,
                customerDiscountForCatalog,
                customerIsActive // 🔒 Feature 174: Hide prices for non-registered users
              )
              : Promise.resolve([]),
            this.prisma.orders.findFirst({
              where: { customerId: customer.id },
              orderBy: { createdAt: "desc" },
              select: { orderCode: true },
            }),
          ])

          // 🆕 BUILD PROMPT VARIABLES using centralized builder (for delegation)
          const delegationPromptVariables = PromptVariableBuilder.build(
            customer,
            workspace!,
            {
              products,
              categories,
              offers,
            },
            {
              lastOrderCode: lastOrder?.orderCode || undefined,
              channel: params.channel || 'whatsapp', // 🚫 WIDGET FIX: Pass channel to builder
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
                message: `Pattern: ${lastAssistantMessage?.content?.includes("Vuoi")
                  ? "Confirmation"
                  : lastAssistantMessage?.content?.match(/\d+\)/)
                    ? "List selection"
                    : "Short response"
                  } | Switch: ${previousAgent && previousAgent !== delegationTarget
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
                customerIsRegistered: customerIsActive, // 🔒 Registration gate
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
                customerIsRegistered: customerIsActive, // 🔒 Registration gate
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
                channel: params.channel,
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
                this.prisma,
                this.promptBuilder
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
                channel: params.channel, // ✅ Pass channel for widget modal action
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
          // Proceed to Translation layer
          return {
            response: subAgentFinalResponse,
            tokensUsed: totalTokens,
            iterations,
            agentUsed,
            confidence: 0.9,
            debugSteps, // Contains: Router → SubAgent
            selectedProduct: selectedProductFromAgent, // 🆕 For pendingAction ADD_TO_CART
            action: subAgentResponse.action, // 🎯 Widget modal action (if applicable)
          } as any
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
    channel?: string // Optional channel for fallback tool filtering
    tools?: any[] // 🆕 Dynamic tools from DB
  }): Promise<{
    content?: string
    function_call?: { name: string; arguments: string }
    tokensUsed: number
  }> {
    try {
      const response = await withOpenRouterRetry(() => axios.post(
        `${this.openRouterBaseUrl}/chat/completions`,
        {
          model: options.model,
          messages: options.messages,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          // 🔀 Router has ONLY delegation functions (call sub-agents)
          // Router orchestrates, sub-agents execute business functions
          // 🆕 Dynamic: If sellsProductsAndServices=false, exclude e-commerce agents
          // 🔀 Strategy:
          // E-commerce (ROUTER): "required" - Force delegation to specialist agents
          // Informational (INFO_AGENT): "auto" - Allow direct text response (identity/FAQ) or delegation
          // 🆕 Use provided tools (from DB) or fallback to hardcoded ones
          // ⚠️ FIX: empty array [] is truthy in JS → must check .length > 0 to use fallback correctly
          tools: (options.tools && options.tools.length > 0) ? options.tools : getFunctionsForRouter({
            sellsProductsAndServices: options.sellsProductsAndServices ?? true,
            channel: options.channel,
          }),
          tool_choice: "auto", // 🆕 Allow direct text response (greetings/identity) or delegation for ALL modes
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
      ))

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
   * Specialist Agent Delegation Handler
   */
  public async handleWithActiveAgent(options: {
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
        customerLanguage: params.customerLanguage || "en",
      })

      // Check for delegation handoff pattern
      if (specialistResponse.output.includes("🛒 DELEGATE_TO_CART:")) {
        return await this.handleDelegationHandoff(specialistResponse, options)
      }

      // 🔗 STEP 1: Replace [LINK_xxx] tokens with real URLs BEFORE translation
      logger.info("🔗 Applying LinkReplacementService to specialist response")

      let responseWithLinks = specialistResponse.output
      const linkResult = await this.linkReplacementService.replaceTokens(
        { response: specialistResponse.output },
        params.customerId,
        params.workspaceId
      )

      if (linkResult.success && linkResult.response) {
        responseWithLinks = linkResult.response
        logger.info("✅ Link replacement successful")
      }

      // 🔒 STEP 2: Apply Translation Layer (always)
      const translationResult = await this.translationAgent.process({
        workspaceId: params.workspaceId,
        message: responseWithLinks,
        targetLanguage: params.customerLanguage || "en",
        customerName: params.customerName,
        customerId: params.customerId,
        channel: params.channel,
      })

      let finalResponse = translationResult.message
      let autoTokensUsed = (specialistResponse.tokensUsed || 0) + (translationResult.tokensUsed || 0)

      if (this.shouldApplyWidgetSecurity(params.channel)) {
        const securityInput = finalResponse
        const widgetSecurityResult = await this.securityAgent.process({
          workspaceId: params.workspaceId,
          message: securityInput,
          customerName: params.customerName,
          customerId: params.customerId,
        })

        finalResponse = widgetSecurityResult.message || securityInput
        autoTokensUsed += widgetSecurityResult.tokensUsed || 0
      }

      const executionTimeMs = Date.now() - startTime

      // Build debug info
      const debugInfo: DebugInfoSteps = {
        steps: [
          {
            type: "sub_agent",
            agent: activeAgent,
            timestamp: new Date().toISOString(),
            input: { userMessage: query },
            output: { message: specialistResponse.output },
          }
        ],
        totalTokens: autoTokensUsed,
        totalCost: 0,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      }

      return {
        response: finalResponse,
        agentUsed: activeAgent as AgentType,
        confidence: 1.0,
        tokensUsed: autoTokensUsed,
        executionTimeMs,
        wasFAQ: false,
        debugInfo,
      }
    } catch (error) {
      logger.error(`❌ Error in handleWithActiveAgent for ${activeAgent}:`, error)
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
      //  ALWAYS read product code from metadata (source of truth)
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
        customerLanguage: options.params.customerLanguage || "en",
        customerDiscount,
      })

      // Apply Translation (always)
      const cartTranslationResult = await this.translationAgent.process({
        workspaceId: options.params.workspaceId,
        message: cartResponse.output,
        targetLanguage: options.params.customerLanguage || "en",
        customerName: options.params.customerName,
        customerId: options.params.customerId,
        channel: options.params.channel,
      })

      let finalCartResponse = cartTranslationResult.message
      let cartTokensUsed = (cartResponse.tokensUsed || 0) + (cartTranslationResult.tokensUsed || 0)

      // Security Layer
      if (this.shouldApplyWidgetSecurity(options.params.channel)) {
        const securityInput = finalCartResponse
        const cartSecurityResult = await this.securityAgent.process({
          workspaceId: options.params.workspaceId,
          message: securityInput,
          customerName: options.params.customerName,
          customerId: options.params.customerId,
        })

        finalCartResponse = cartSecurityResult.message || securityInput
        cartTokensUsed += cartSecurityResult.tokensUsed || 0
      } else {
        logger.info("⏭️ Skipping Widget Security for cart handoff (WhatsApp - scheduler handles it)")
      }

      const executionTimeMs = Date.now() - startTime

      return {
        response: finalCartResponse,
        agentUsed: "CART_MANAGEMENT",
        tokensUsed: cartTokensUsed,
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
      case "INFO_AGENT":
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
      ITA: "ITALIANO", // ✅ FIX: Add ITA mapping from normalizeLanguage()
      ENG: "ENGLISH",
      ESP: "ESPAÑOL",
      PRT: "PORTUGUÊS",
      POR: "PORTUGUÊS", // ✅ FIX: Add POR mapping
      DEU: "DEUTSCH", // ✅ FIX: Add DEU mapping
      FRA: "FRANÇAIS", // ✅ FIX: Add FRA mapping
    }
    return languageMap[languageCode] || "ENGLISH"
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
