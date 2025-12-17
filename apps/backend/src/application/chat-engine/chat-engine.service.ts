/**
 * Chat Engine Service - Main Orchestrator
 *
 * CORE PRINCIPLE: "Codice decide, LLM formatta"
 * 
 * This is the heart of the chatbot - it processes incoming messages
 * through a pipeline: Intent → Data → Response → Format → Deliver
 */

import { PrismaClient, AgentType } from "@echatbot/database"
import logger from "../../utils/logger"
import {
  IntentParserService,
  getIntentParser,
  Intent,
  SearchProductsIntent,
  AddToCartIntent,
  RepeatOrderIntent,
  RequestHumanIntent,
  AskFAQIntent,
} from "../intent"
import { DataLoaderService, getDataLoader, LoadedData } from "../data-loader"
import { ResponseBuilderService, getResponseBuilder, StructuredResponse, ListItem } from "../response-builder"
import { LLMFormatterService, getLLMFormatter, FormatterResult } from "../llm-formatter"
import { ConversationManager } from "../../services/conversation-manager.service"
import { LinkReplacementService, ReplaceLinkWithTokenParams } from "../services/link-replacement.service"
import {
  OptionsMappingService,
  getOptionsMappingService,
  OptionsMapping,
  ListType,
} from "./options-mapping.service"
import {
  MessagePreprocessorService,
  PreprocessResult,
  messagePreprocessorService,
} from "../../services/message-preprocessor.service"
import { CartManagementAgentLLM } from "../agents/CartManagementAgentLLM"
import { ProductContextAgentLLM, ProductContextData } from "../agents/ProductContextAgentLLM"
import { SystemContextService, getSystemContextService } from "../../services/system-context.service"
import {
  ConversationStateService, 
  ConversationState,
  StateContext,
  CONFIRM_TRIGGERS_CHECKOUT,
  NUMERIC_MEANS_PRODUCT,
  NUMERIC_MEANS_ORDER,
  NUMERIC_MEANS_CATEGORY,
  NUMERIC_MEANS_ORDER_ACTION,
} from "./conversation-state.service"
import { TranslationAgent } from "../agents/TranslationAgent"
import { CatalogQueryService, CatalogQueryLoadedData } from "../catalog-query/catalog-query.service"
import { confirmOrder } from "../../domain/calling-functions/ConfirmOrder"
import { LLMRouterService } from "../../services/llm-router.service"
import { getUnifiedChatRouter, UnifiedChatRouter } from "../services/unified-chat-router.service"

type PipelineLoadedData = LoadedData | CatalogQueryLoadedData

// ================================================================================
// WORKSPACE CONFIG CACHE
// ================================================================================

interface WorkspaceConfig {
  sellsProductsAndServices: boolean
  hasSalesAgents: boolean
  hasSuppliers: boolean
  hasHumanSupport: boolean
  humanSupportInstructions: string | null
  operatorContactMethod: string | null
  welcomeMessage: any
  botIdentityResponse: string | null
  customAiRules: string | null  // Custom AI rules that override default behavior
  adminEmail: string | null
  workspaceName: string
  address: string | null
}

const workspaceConfigCache = new Map<string, { config: WorkspaceConfig; timestamp: number }>()
const CONFIG_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// ================================================================================
// CUSTOMER-LEVEL LOCKS (Concurrency Safety - Principle VI)
// ================================================================================

/**
 * In-memory lock per customer to prevent race conditions when same customer
 * sends multiple messages simultaneously. Each customer can only have ONE
 * message being processed at a time - subsequent messages wait in queue.
 * 
 * Pattern: Promise-based sequential processing per customer
 * - If lock exists: wait for it to release
 * - Acquire lock before processing
 * - Release lock after processing (success or error)
 */
const customerProcessingLocks = new Map<string, Promise<void>>()

// ================================================================================
// DEBUG STEP TYPES (for Message Flow Timeline)
// ================================================================================

export interface DebugStep {
  type: "router" | "sub_agent" | "function_call" | "function_result" | "safety" | "link-replacement" | "intent-parser" | "data-loader" | "llm-formatter" | "save-history" | "whatsapp-queue"
  agent: string
  model?: string
  temperature?: number
  timestamp: string | number
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  systemPrompt?: string
  input?: {
    userMessage?: string
    conversationHistory?: any[]
    functionResult?: any
    textContent?: string
    targetLanguage?: string  // 🆕 For Translation Agent
  }
  output?: {
    decision?: string
    functionCall?: { name: string; arguments: any } | string
    textResponse?: string
    result?: any
    executionTimeMs?: number
    textContent?: string
    translated?: boolean  // 🆕 For Translation Agent
  }
  duration?: number
}

// ================================================================================
// INPUT/OUTPUT TYPES
// ================================================================================

export interface ChatEngineInput {
  message: string
  customerId: string
  workspaceId: string
  conversationId?: string
  customerName?: string
  customerLanguage?: string
  customerDiscount?: number
}

export interface ChatEngineOutput {
  // New fields
  message: string
  agentType: AgentType
  wasHandled: boolean
  intent: string
  confidence: "HIGH" | "MEDIUM" | "LOW"
  source: "PATTERN" | "KEYWORD" | "LLM_FALLBACK" | "LLM_CONTEXT"
  processingTimeMs: number
  debugInfo?: {
    loadedDataType: string
    responseType: string
    llmUsed: boolean
    steps?: DebugStep[]  // 🆕 Timeline steps (optional for early returns)
    totalTokens?: number
    totalCost?: number
    executionTimeMs?: number
    [key: string]: any
  }
  // Legacy fields for webhook compatibility
  response: string  // Same as message
  agentUsed: string // String version of agentType
  tokensUsed: number
  executionTimeMs: number // Same as processingTimeMs
  wasFAQ: boolean
  isBlocked: boolean
  _assistantMessageId?: string
}

// ================================================================================
// MAIN SERVICE
// ================================================================================

export class ChatEngineService {
  // Core pipeline services
  private intentParser: IntentParserService
  private dataLoader: DataLoaderService
  private responseBuilder: ResponseBuilderService
  private llmFormatter: LLMFormatterService
  private catalogQueryService: CatalogQueryService
  
  // Support services
  private conversationManager: ConversationManager
  private linkReplacementService: LinkReplacementService
  private optionsMappingService: OptionsMappingService
  private systemContextService: SystemContextService
  private conversationStateService: ConversationStateService
  private llmRouterService: LLMRouterService
  private unifiedChatRouter: UnifiedChatRouter // OpenAI SDK integration
  
  // Translation layer (applied as final step in routeMessage wrapper)
  private translationAgent: TranslationAgent

  constructor(private prisma: PrismaClient) {
    // Initialize core pipeline
    this.intentParser = getIntentParser(prisma)
    this.dataLoader = getDataLoader(prisma)
    this.responseBuilder = getResponseBuilder(prisma)
    this.llmFormatter = getLLMFormatter(prisma)
    
    // Initialize support services
    this.conversationManager = new ConversationManager(prisma)
    this.linkReplacementService = new LinkReplacementService()
    this.optionsMappingService = getOptionsMappingService(prisma)
    this.systemContextService = getSystemContextService(prisma)
    this.conversationStateService = new ConversationStateService(prisma)
    this.catalogQueryService = new CatalogQueryService(prisma)
    this.llmRouterService = new LLMRouterService(prisma)
    this.unifiedChatRouter = getUnifiedChatRouter(prisma) // OpenAI SDK integration
    
    // Initialize translation layer
    this.translationAgent = new TranslationAgent(prisma)
  }

  /**
   * Helper: Replace user variables in calling function messages
   * This handles {{nameUser}}, {{agentPhone}}, etc. that are NOT processed by PromptProcessor
   * because calling functions return raw messages with placeholders.
   */
  private async replaceUserVariables(
    message: string,
    customerId: string,
    workspaceId: string,
    customerName?: string
  ): Promise<string> {
    let result = message
    if (!result?.includes("{{")) return result

    let cachedCustomer: {
      name?: string | null
      sales?: {
        firstName: string | null
        lastName: string | null
        email: string | null
        phone: string | null
      } | null
    } | null = null
    let cachedWorkspace: {
      whatsappPhoneNumber?: string | null
      notificationEmail?: string | null
      whatsappSettings?: { adminEmail?: string | null } | null
    } | null = null

    const loadCustomer = async () => {
      if (cachedCustomer) return cachedCustomer
      cachedCustomer = await this.prisma.customers.findUnique({
        where: { id: customerId },
        select: {
          name: true,
          sales: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      })
      return cachedCustomer
    }

    const loadWorkspace = async () => {
      if (cachedWorkspace) return cachedWorkspace
      cachedWorkspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          whatsappPhoneNumber: true,
          notificationEmail: true,
          whatsappSettings: { select: { adminEmail: true } },
        },
      })
      return cachedWorkspace
    }

    const ensureCustomerName = async () => {
      if (customerName) return customerName
      const customer = await loadCustomer()
      return customer?.name || "Cliente"
    }

    if (result.includes("{{nameUser}}")) {
      const resolvedName = await ensureCustomerName()
      result = result.replace(/\{\{nameUser\}\}/g, resolvedName)
    }

    if (
      result.includes("{{agentName}}") ||
      result.includes("{{agentEmail}}") ||
      result.includes("{{agentPhone}}")
    ) {
      const customer = await loadCustomer()
      const workspace = await loadWorkspace()
      const sales = customer?.sales

      const agentName =
        (sales
          ? `${sales.firstName || ""} ${sales.lastName || ""}`.trim()
          : "") || "Il nostro team"
      const agentEmail =
        sales?.email ||
        workspace?.notificationEmail ||
        workspace?.whatsappSettings?.adminEmail ||
        "support@echatbot.ai"
      const agentPhone =
        sales?.phone || workspace?.whatsappPhoneNumber || "N/A"

      result = result
        .replace(/\{\{agentName\}\}/g, agentName)
        .replace(/\{\{agentEmail\}\}/g, agentEmail)
        .replace(/\{\{agentPhone\}\}/g, agentPhone)
    }

    if (result.includes("{{adminEmail}}")) {
      const workspace = await loadWorkspace()
      const adminEmail =
        workspace?.whatsappSettings?.adminEmail ||
        workspace?.notificationEmail ||
        "support@echatbot.ai"
      result = result.replace(/\{\{adminEmail\}\}/g, adminEmail)
    }

    if (result.includes("{{TOKEN_DURATION}}")) {
      result = result.replace(
        /\{\{TOKEN_DURATION\}\}/g,
        this.formatTokenDuration(process.env.TOKEN_EXPIRATION || "1h")
      )
    }

    return result
  }

  private formatTokenDuration(duration: string): string {
    const match = duration.match(/^(\d+)([mh])$/)
    if (!match) return "15 minutes"

    const value = parseInt(match[1], 10)
    const unit = match[2]

    if (unit === "m") {
      return value === 1 ? "1 minute" : `${value} minutes`
    }
    return value === 1 ? "1 hour" : `${value} hours`
  }

  private getHumanSupportTemplate(
    workspaceConfig: WorkspaceConfig,
    options?: { reason?: string }
  ): string {
    const reason = options?.reason?.toLowerCase()
    const hasSupport = workspaceConfig.hasHumanSupport
    if (!hasSupport) {
      if (workspaceConfig.humanSupportInstructions?.trim()) {
        return workspaceConfig.humanSupportInstructions.trim()
      }
      return `Ciao {{nameUser}}, manda una email a {{adminEmail}} con i dettagli e ti risponderemo il prima possibile.`
    }

    const isFrustration =
      reason === "frustration" ||
      reason === "frustrated" ||
      reason === "angry" ||
      reason === "complaint"

    if (isFrustration) {
      if (workspaceConfig.hasSalesAgents) {
        return `Ciao {{nameUser}}, capisco la tua frustrazione e mi dispiace per l'inconveniente.\nMi sto mettendo in contatto con l'agente {{agentName}}. Ti richiamera' al piu' presto (tel: {{agentPhone}} - email: {{agentEmail}}).\nDisattivo il chatbot finche' non ricevi risposta.`
      }
      return `Ciao {{nameUser}}, capisco la tua frustrazione e voglio risolvere subito.\nMi sto mettendo in contatto con il nostro operatore. Ti rispondera' al piu' presto e disattivo il chatbot finche' non ricevi assistenza.`
    }

    if (workspaceConfig.humanSupportInstructions?.trim()) {
      return workspaceConfig.humanSupportInstructions.trim()
    }

    if (workspaceConfig.hasSalesAgents) {
      return `Ciao {{nameUser}}, mi sto mettendo in contatto con l'agente {{agentName}}.\nTi rispondera' a breve. Metto in pausa il chatbot finche' non ricevi assistenza.`
    }
    return `Ciao {{nameUser}}, mi sto mettendo in contatto con il nostro operatore.\nTi rispondera' al piu' presto. Metto in pausa il chatbot finche' non ricevi assistenza.`
  }

  private applyHumanSupportPlaceholders(
    template: string,
    replacements: Record<string, string | undefined>
  ): string {
    let result = template

    for (const [key, value] of Object.entries(replacements)) {
      const safeValue = value ?? ""
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), safeValue)
    }

    return result
  }

  private shouldCheckFaqBeforeHumanSupport(reason?: string): boolean {
    if (!reason) return false
    const normalized = reason.trim().toLowerCase()
    return ["frustration", "frustrated", "angry", "complaint"].includes(normalized)
  }

  private async tryHandleFAQBeforeHumanSupport(params: {
    input: ChatEngineInput
    workspaceConfig: WorkspaceConfig
    conversationId: string
    debugSteps: DebugStep[]
    startTime: number
    requestIntent: RequestHumanIntent
    intentConfidence: "HIGH" | "MEDIUM" | "LOW"
    intentSource: "PATTERN" | "KEYWORD" | "LLM_FALLBACK"
  }): Promise<ChatEngineOutput | null> {
    const {
      input,
      workspaceConfig,
      conversationId,
      debugSteps,
      startTime,
      requestIntent,
      intentConfidence,
      intentSource,
    } = params

    if (!this.shouldCheckFaqBeforeHumanSupport(requestIntent.reason)) {
      return null
    }

    try {
      debugSteps.push({
        type: "router",
        agent: "🤖 FAQ Precheck",
        timestamp: new Date().toISOString(),
        input: {
          userMessage: input.message,
        },
        output: {
          decision: "faq_precheck_start",
        },
      })

      const faqIntent: AskFAQIntent = {
        type: "ASK_FAQ",
        query: input.message.trim(),
      }

      const loadedData = await this.dataLoader.loadForIntent(
        faqIntent,
        input.workspaceId,
        input.customerId,
        input.customerDiscount || 0
      )

      if (loadedData.type !== "FAQ" || !loadedData.faqs?.length) {
        return null
      }

      const structuredResponse = this.responseBuilder.build(faqIntent, loadedData, {
        workspaceId: input.workspaceId,
        customerLanguage: input.customerLanguage || "it",
        customerName: input.customerName,
        customerDiscount: input.customerDiscount,
      })

      if (structuredResponse.type !== "FAQ") {
        return null
      }

      const formatterResult = await this.formatWithCustomRules(
        structuredResponse,
        input.customerLanguage || "it",
        workspaceConfig
      )

      let finalMessage = formatterResult.text
      const formatterTokens = formatterResult.tokensUsed || 0

      const replacementResult = await this.linkReplacementService.replaceTokens(
        { response: finalMessage, linkType: "auto" },
        input.customerId,
        input.workspaceId
      )
      if (replacementResult.success && replacementResult.response) {
        finalMessage = replacementResult.response
      }

      finalMessage = finalMessage
        .replace(/\s*\[SKU:[A-Z0-9-]+\]/gi, "")
        .replace(/\s*\[SKUS?:[A-Z0-9-,]+\]/gi, "")

      const processingTimeMs = Date.now() - startTime

      debugSteps.push({
        type: "router",
        agent: "🤖 FAQ Precheck",
        timestamp: new Date().toISOString(),
        output: {
          decision: "answered_with_faq",
          executionTimeMs: processingTimeMs,
        },
      })

      const debugInfo = {
        loadedDataType: loadedData.type,
        responseType: structuredResponse.type,
        llmUsed: !formatterResult.cached,
        steps: debugSteps,
        totalTokens: formatterTokens,
        executionTimeMs: processingTimeMs,
      }

      const savedMessages = await this.saveMessages(
        input.workspaceId,
        input.customerId,
        conversationId,
        input.message,
        finalMessage,
        AgentType.CUSTOMER_SUPPORT,
        formatterTokens,
        debugInfo
      )

      return {
        message: finalMessage,
        agentType: AgentType.CUSTOMER_SUPPORT,
        wasHandled: true,
        intent: "ASK_FAQ",
        confidence: intentConfidence,
        source: intentSource,
        processingTimeMs,
        debugInfo,
        response: finalMessage,
        agentUsed: AgentType.CUSTOMER_SUPPORT,
        tokensUsed: formatterTokens,
        executionTimeMs: processingTimeMs,
        wasFAQ: true,
        isBlocked: false,
        _assistantMessageId: savedMessages?.assistantMessageId,
      }
    } catch (error) {
      logger.error("⚠️ [ChatEngine] FAQ precheck failed, continuing with human support", {
        error,
        workspaceId: input.workspaceId,
        customerId: input.customerId,
      })
      return null
    }
  }

  private async handleHumanSupportRequest(params: {
    input: ChatEngineInput
    workspaceConfig: WorkspaceConfig
    conversationId: string
    debugSteps: DebugStep[]
    totalTokens: number
    startTime: number
    requestIntent: RequestHumanIntent
    intentConfidence: "HIGH" | "MEDIUM" | "LOW"
    intentSource: "PATTERN" | "KEYWORD" | "LLM_FALLBACK"
  }): Promise<ChatEngineOutput> {
    const {
      input,
      workspaceConfig,
      conversationId,
      debugSteps,
      totalTokens,
      startTime,
      requestIntent,
      intentConfidence,
      intentSource,
    } = params

    const customer = await this.prisma.customers.findUnique({
      where: { id: input.customerId },
      select: {
        name: true,
        phone: true,
        sales: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    })

    const customerName =
      input.customerName || customer?.name || "Cliente"

    let agentName = ""
    let agentEmail = ""
    let agentPhone = ""

    if (customer?.sales) {
      const first = customer.sales.firstName?.trim() || ""
      const last = customer.sales.lastName?.trim() || ""
      agentName = [first, last].filter(Boolean).join(" ").trim()
      agentEmail = customer.sales.email || ""
      agentPhone = customer.sales.phone || ""
    } else if (workspaceConfig.hasSalesAgents) {
      logger.warn("⚠️ [ChatEngine] No sales agent assigned for customer requesting human support", {
        customerId: input.customerId,
      })
    }

    const faqPrecheckResult = await this.tryHandleFAQBeforeHumanSupport({
      input,
      workspaceConfig,
      conversationId,
      debugSteps,
      startTime,
      requestIntent,
      intentConfidence,
      intentSource,
    })

    if (faqPrecheckResult) {
      logger.info("📚 [ChatEngine] Human support converted to FAQ response", {
        workspaceId: input.workspaceId,
        customerId: input.customerId,
      })
      return faqPrecheckResult
    }

    const template = this.getHumanSupportTemplate(workspaceConfig, {
      reason: requestIntent.reason,
    })

    const adminEmail =
      workspaceConfig.adminEmail || "support@echatbot.ai"

    const finalMessage = this.applyHumanSupportPlaceholders(template, {
      nameUser: customerName,
      agentName,
      agentEmail,
      agentPhone,
      adminEmail,
    }).trim()

    if (workspaceConfig.hasHumanSupport) {
      try {
        debugSteps.push({
          type: "function_call",
          agent: "📞 contactOperator",
          timestamp: new Date().toISOString(),
          input: {
            textContent: requestIntent.reason || input.message,
          },
        })

        const { contactOperator } = await import("../../domain/calling-functions/contactOperator")
        const contactResult = await contactOperator({
          phoneNumber: customer?.phone || "",
          workspaceId: input.workspaceId,
          customerId: input.customerId,
          reason: requestIntent.reason || input.message,
        })

        debugSteps.push({
          type: "function_result",
          agent: "📞 contactOperator",
          timestamp: new Date().toISOString(),
          output: {
            result: {
              success: contactResult.success,
              summaryAgentExecuted: contactResult.summaryAgentExecuted,
            },
          },
        })
      } catch (error) {
        logger.error("❌ [ChatEngine] contactOperator failed during human support handling", {
          error,
          customerId: input.customerId,
          workspaceId: input.workspaceId,
        })
      }
    }

    const processingTimeMs = Date.now() - startTime

    const debugInfo = {
      loadedDataType: "HUMAN_SUPPORT",
      responseType: "HUMAN_SUPPORT",
      llmUsed: false,
      steps: debugSteps,
      totalTokens,
      totalCost: (totalTokens * 0.0003) / 1000,
      executionTimeMs: processingTimeMs,
    }

    const savedMessages = await this.saveMessages(
      input.workspaceId,
      input.customerId,
      conversationId,
      input.message,
      finalMessage,
      AgentType.CUSTOMER_SUPPORT,
      totalTokens,
      debugInfo
    )

    return {
      message: finalMessage,
      agentType: AgentType.CUSTOMER_SUPPORT,
      wasHandled: true,
      intent: "REQUEST_HUMAN",
      confidence: intentConfidence,
      source: intentSource,
      processingTimeMs,
      debugInfo,
      response: finalMessage,
      agentUsed: AgentType.CUSTOMER_SUPPORT,
      tokensUsed: totalTokens,
      executionTimeMs: processingTimeMs,
      wasFAQ: false,
      isBlocked: false,
      _assistantMessageId: savedMessages?.assistantMessageId,
    } as any
  }

  /**
   * Helper: formatta con LLM includendo customAiRules dal workspace
   */
  private async formatWithCustomRules(
    structuredResponse: StructuredResponse,
    language: string,
    workspaceConfig: WorkspaceConfig,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<FormatterResult> {
    return this.llmFormatter.format(
      structuredResponse,
      language,
      conversationHistory,
      { customAiRules: workspaceConfig.customAiRules }
    )
  }

  /**
   * ============================================================================
   * TRANSLATION LAYER (Single Responsibility: Translate final response)
   * ============================================================================
   * 
   * Translates the formatted response to customer's preferred language.
   * This method is called ONLY from routeMessage() wrapper to ensure
   * ALL responses pass through translation before reaching the customer.
   * 
   * Design Pattern: Decorator - wraps response with translation
   * 
   * @param message - The formatted message to translate
   * @param workspaceId - Workspace ID for loading TRANSLATION agent config
   * @param targetLanguage - Customer's language code (e.g., "pt", "en", "es")
   * @param debugSteps - Array to push translation debug step for timeline
   * @param customerName - Optional customer name for personalization
   * @returns Object with translated message and tokens used
   */
  private async applyTranslation(
    message: string,
    workspaceId: string,
    targetLanguage: string,
    debugSteps: DebugStep[],
    customerName?: string
  ): Promise<{ message: string; tokensUsed: number }> {
    const startTime = Date.now()
    
    try {
      // Call TranslationAgent to translate message
      const result = await this.translationAgent.process({
        workspaceId,
        message,
        targetLanguage: targetLanguage || "it",
        customerName,
      })
      
      const executionTimeMs = Date.now() - startTime
      
      // Add debug step for Message Flow Timeline
      this.pushTranslationDebugStep(debugSteps, {
        model: result.model || "gpt-4o-mini",
        inputMessage: message,
        outputMessage: result.message,
        targetLanguage: targetLanguage || "it",
        translated: result.translated,
        tokensUsed: result.tokensUsed,
        executionTimeMs,
        systemPrompt: result.systemPrompt,
      })
      
      logger.info("🌍 [ChatEngine] Translation applied", {
        targetLanguage,
        translated: result.translated,
        tokensUsed: result.tokensUsed,
        executionTimeMs,
      })
      
      return { 
        message: result.message, 
        tokensUsed: result.tokensUsed || 0 
      }
    } catch (error) {
      // Log error but don't fail - return original message
      logger.error("⚠️ [ChatEngine] Translation failed, using original", { error })
      
      // Track error in timeline
      this.pushTranslationDebugStep(debugSteps, {
        model: "error",
        inputMessage: message,
        outputMessage: message,
        targetLanguage: targetLanguage || "it",
        translated: false,
        tokensUsed: 0,
        executionTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      })
      
      return { message, tokensUsed: 0 }
    }
  }

  private getTransportEmoji(label?: string): string {
    const normalized = (label || "").toLowerCase()
    if (normalized.includes("congel") || normalized.includes("frozen")) {
      return "🧊"
    }
    if (normalized.includes("refriger") || normalized.includes("frigo") || normalized.includes("cold")) {
      return "❄️"
    }
    return "📦"
  }

  private async routeGenericLLMFallback(params: {
    input: ChatEngineInput
    conversationId: string
    history: Array<{ role: string; content: string }>
    fallbackReason?: string
    debugSteps: DebugStep[]
  }): Promise<{ message: string; tokensUsed: number }> {
    const { input, conversationId, history, fallbackReason, debugSteps } = params
    const prompt = `Non riesco a soddisfare la richiesta dell'utente con le regole deterministiche.\nContesto:\n- Ultimo messaggio utente: "${input.message}"\n- Problema rilevato: ${
      fallbackReason || "nessun risultato dal catalogo"
    }\n\nScrivi una risposta empatica e informativa basata sui dati disponibili (FAQ, identity, servizi) evitando di promettere azioni non confermate. Invita l'utente a specificare meglio o suggerisci alternative rilevanti.`

    try {
      // Use UnifiedChatRouter for engine selection (Legacy vs OpenAI SDK)
      const llmResponse = await this.unifiedChatRouter.routeMessage({
        workspaceId: input.workspaceId,
        customerId: input.customerId,
        customerName: input.customerName || "Cliente",
        customerLanguage: input.customerLanguage || "it",
        message: prompt,
        conversationHistory: history,
        customerDiscount: input.customerDiscount || 0,
        conversationId,
        messageId: `${conversationId}-fallback-${Date.now()}`,
      })

      debugSteps.push({
        type: "sub_agent",
        agent: "UnifiedChatRouter",
        timestamp: new Date().toISOString(),
        output: {
          decision: "generic_fallback",
          textResponse: llmResponse.response?.substring(0, 200),
        },
        tokenUsage: {
          promptTokens: 0,
          completionTokens: llmResponse.tokensUsed || 0,
          totalTokens: llmResponse.tokensUsed || 0,
        },
      })

      return {
        message:
          llmResponse.response ||
          "Mi dispiace, non ho trovato informazioni utili. Posso aiutarti in altro modo?",
        tokensUsed: llmResponse.tokensUsed || 0,
      }
    } catch (error) {
      logger.error("❌ [ChatEngine] Generic LLM fallback failed", { error })
      return {
        message:
          "Mi dispiace, al momento non riesco a trovare informazioni utili. Vuoi provare a riformulare la richiesta?",
        tokensUsed: 0,
      }
    }
  }

  private async buildCartActionOptions(hasRemovableItems: boolean, workspaceId?: string) {
    const options: Array<{ number: number; name: string; id: string }> = []
    let nextNumber = 1
    options.push({ number: nextNumber++, name: "✅ Confermare l'ordine", id: "CONFIRM_ORDER" })
    options.push({ number: nextNumber++, name: "🛍️ Esplorare il catalogo", id: "SHOW_PRODUCTS" })
    options.push({ number: nextNumber++, name: "🧾 Mostra servizi", id: "SHOW_SERVICES" })
    if (hasRemovableItems) {
      options.push({ number: nextNumber++, name: "🗑️ Rimuovere un articolo", id: "REMOVE_FROM_CART" })
    }
    options.push({ number: nextNumber++, name: "🧹 Cancella il carrello", id: "CLEAR_CART" })
    
    // Option 5: Order optimization (show when multiple transport modes may exist)
    options.push({ number: nextNumber++, name: "🚚 Ottimizza spedizione", id: "OPTIMIZE_TRANSPORT" })
    
    return options
  }

  private extractCartItemCountFromFunctionCalls(functionCalls?: Array<{ result?: any }>): number | null {
    if (!functionCalls?.length) return null
    for (let idx = functionCalls.length - 1; idx >= 0; idx--) {
      const resultCartItems = functionCalls[idx]?.result?.cartData?.cart?.items
      if (Array.isArray(resultCartItems)) {
        return resultCartItems.length
      }
    }
    return null
  }

  private async handleProductContextIntent(params: {
    input: ChatEngineInput
    conversationId: string
    history: Array<{ role: string; content: string }>
    chatSession: { id: string } | null
    fsmState: StateContext
    workspaceConfig: WorkspaceConfig
    startTime: number
    debugSteps: DebugStep[]
  }): Promise<ChatEngineOutput | null> {
    const { input, conversationId, history, chatSession, fsmState, workspaceConfig, startTime, debugSteps } = params

    if (!chatSession) {
      return null
    }

    const validStates = new Set<ConversationState>([
      ConversationState.VIEWING_PRODUCT,
      ConversationState.AWAITING_ADD_CONFIRM,
    ])

    if (!validStates.has(fsmState.state)) {
      return null
    }

    const selectedProductId = fsmState.selectedProductId
    const selectedProductSku = fsmState.selectedProductSku

    if (!selectedProductId && !selectedProductSku) {
      return null
    }

    const where: Record<string, any> = {
      workspaceId: input.workspaceId,
    }

    if (selectedProductId) {
      where.id = selectedProductId
    } else if (selectedProductSku) {
      where.sku = selectedProductSku
    }

    const productRecord = await this.prisma.products.findFirst({
      where,
      include: {
        category: { select: { name: true } },
        productCertifications: {
          include: { certification: true },
        },
        productTransportTypes: {
          include: { transportType: true },
        },
      },
    })

    if (!productRecord) {
      logger.warn("⚠️ [ChatEngine] PRODUCT_CONTEXT intent but product not found", {
        workspaceId: input.workspaceId,
        productId: selectedProductId,
        productSku: selectedProductSku,
      })
      return null
    }

    const certifications = new Set<string>()
    for (const relation of productRecord.productCertifications || []) {
      if (relation.certification?.name) {
        certifications.add(relation.certification.name)
      }
    }
    for (const inline of productRecord.certifications || []) {
      if (inline) certifications.add(inline)
    }

    const transportType =
      productRecord.productTransportTypes?.[0]?.transportType?.name ||
      productRecord.transportType ||
      null

    const productData: ProductContextData = {
      id: productRecord.id,
      name: productRecord.name,
      description: productRecord.description,
      format: productRecord.formato,
      price: productRecord.price,
      region: productRecord.region,
      certifications: Array.from(certifications),
      transportType,
      tags: [productRecord.category?.name, productRecord.region].filter(Boolean) as string[],
      storageInfo: null,
      pairingSuggestions: undefined,
      ingredients: [],
      allergens: productRecord.allergens || [],
    }

    const agent = new ProductContextAgentLLM(this.prisma)
    const conversationHistory = history
      .filter((msg) => msg.role === "assistant" || msg.role === "user")
      .slice(-4)
      .map((msg) => ({
        role: msg.role as "assistant" | "user",
        content: msg.content,
      }))

    const agentResponse = await agent.handleQuestion({
      workspaceId: input.workspaceId,
      customerId: input.customerId,
      customerName: input.customerName,
      customerLanguage: input.customerLanguage,
      customerDiscount: input.customerDiscount,
      question: input.message,
      product: productData,
      workspaceInfo: {
        name: workspaceConfig.workspaceName,
        botIdentityResponse: workspaceConfig.botIdentityResponse,
        customAiRules: workspaceConfig.customAiRules,
        sellsProductsAndServices: workspaceConfig.sellsProductsAndServices,
        address: workspaceConfig.address,
      },
      conversationHistory,
    })

    const processingTimeMs = Date.now() - startTime

    debugSteps.push({
      type: "sub_agent",
      agent: "🧀 ProductContextAgentLLM",
      model: agentResponse.model,
      timestamp: new Date().toISOString(),
      tokenUsage: agentResponse.tokensUsed
        ? {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: agentResponse.tokensUsed,
          }
        : undefined,
      input: {
        userMessage: input.message,
      },
      output: {
        textResponse:
          agentResponse.output.length > 200
            ? `${agentResponse.output.substring(0, 200)}...`
            : agentResponse.output,
        executionTimeMs: agentResponse.executionTimeMs,
      },
      duration: agentResponse.executionTimeMs,
    })

    const usedTokens = agentResponse.tokensUsed || 0

    const finalDebugInfo = {
      loadedDataType: "PRODUCT_CONTEXT",
      responseType: "PRODUCT_CONTEXT",
      llmUsed: true,
      steps: debugSteps,
      totalTokens: usedTokens,
      totalCost: (usedTokens * 0.0003) / 1000,
      executionTimeMs: processingTimeMs,
    }

    const savedMessages = await this.saveMessages(
      input.workspaceId,
      input.customerId,
      conversationId,
      input.message,
      agentResponse.output,
      AgentType.PRODUCT_SEARCH,
      agentResponse.tokensUsed,
      finalDebugInfo,
    )

    return {
      message: agentResponse.output,
      agentType: AgentType.PRODUCT_SEARCH,
      wasHandled: true,
      intent: "PRODUCT_CONTEXT",
      confidence: "HIGH",
      source: "LLM_FALLBACK",
      processingTimeMs,
      debugInfo: finalDebugInfo,
      response: agentResponse.output,
      agentUsed: AgentType.PRODUCT_SEARCH,
      tokensUsed: usedTokens,
      executionTimeMs: processingTimeMs,
      wasFAQ: false,
      isBlocked: false,
      _assistantMessageId: savedMessages?.assistantMessageId,
    } as ChatEngineOutput
  }

  /**
   * Helper: Push translation debug step to timeline
   * Extracted to reduce code duplication in applyTranslation
   */
  private pushTranslationDebugStep(
    debugSteps: DebugStep[],
    data: {
      model: string
      inputMessage: string
      outputMessage: string
      targetLanguage: string
      translated: boolean
      tokensUsed?: number
      executionTimeMs: number
      systemPrompt?: string
      error?: string
    }
  ): void {
    debugSteps.push({
      type: "sub_agent",
      agent: "🌍 Translation Agent",
      model: data.model,
      timestamp: new Date().toISOString(),
      tokenUsage: data.tokensUsed ? {
        promptTokens: Math.floor(data.tokensUsed * 0.7),
        completionTokens: Math.floor(data.tokensUsed * 0.3),
        totalTokens: data.tokensUsed,
      } : undefined,
      systemPrompt: data.error 
        ? `ERROR: ${data.error}` 
        : (data.systemPrompt || "Translate to target language"),
      input: {
        textContent: data.inputMessage.substring(0, 200) + (data.inputMessage.length > 200 ? "..." : ""),
        targetLanguage: data.targetLanguage,
      },
      output: {
        textResponse: data.outputMessage.substring(0, 200) + (data.outputMessage.length > 200 ? "..." : ""),
        translated: data.translated,
        executionTimeMs: data.executionTimeMs,
      },
      duration: data.executionTimeMs,
    })
  }

  /**
   * Load workspace configuration (cached)
   */
  private async loadWorkspaceConfig(workspaceId: string): Promise<WorkspaceConfig> {
    const cached = workspaceConfigCache.get(workspaceId)
    if (cached && Date.now() - cached.timestamp < CONFIG_CACHE_TTL) {
      return cached.config
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        name: true,
        sellsProductsAndServices: true,
        hasSalesAgents: true,
        hasSuppliers: true,
        hasHumanSupport: true,
        humanSupportInstructions: true,
        operatorContactMethod: true,
        welcomeMessage: true,
        botIdentityResponse: true,
        customAiRules: true,  // Custom AI rules that override default behavior
        notificationEmail: true,
        address: true,
        whatsappSettings: {
          select: { adminEmail: true },
        },
      },
    })

    const config: WorkspaceConfig = {
      sellsProductsAndServices: workspace?.sellsProductsAndServices ?? true,
      hasSalesAgents: workspace?.hasSalesAgents ?? false,
      hasSuppliers: workspace?.hasSuppliers ?? false,
       hasHumanSupport: workspace?.hasHumanSupport ?? false,
       humanSupportInstructions: workspace?.humanSupportInstructions ?? null,
       operatorContactMethod: workspace?.operatorContactMethod ?? null,
      welcomeMessage: workspace?.welcomeMessage,
      botIdentityResponse: workspace?.botIdentityResponse ?? null,
      customAiRules: workspace?.customAiRules ?? null,
      adminEmail:
        workspace?.whatsappSettings?.adminEmail ||
        workspace?.notificationEmail ||
        null,
      workspaceName: workspace?.name || "Il nostro shop",
      address: workspace?.address || null,
    }

    workspaceConfigCache.set(workspaceId, { config, timestamp: Date.now() })
    return config
  }

  /**
   * Check if intent is e-commerce related (requires sellsProductsAndServices=true)
   */
  private isEcommerceIntent(intentType: string): boolean {
    const ecommerceIntents = [
      "SHOW_CATEGORIES",
      "SHOW_CATEGORY",
      "SHOW_PRODUCTS",
      "SHOW_PRODUCT",
      "SEARCH_PRODUCTS",
      "SHOW_OFFERS",
      "SHOW_NEW_ARRIVALS",
      "VIEW_CART",
      "ADD_TO_CART",
      "REMOVE_FROM_CART",
      "UPDATE_CART_QUANTITY",
      "CLEAR_CART",
      "CHECKOUT",
      "START_CHECKOUT",  // Same as CHECKOUT
      "VIEW_ORDERS",
      "ORDER_DETAILS",
      "TRACK_ORDER",
      "REPEAT_ORDER",  // Re-order products from previous order
      "PRODUCT_CONTEXT",
    ]
    return ecommerceIntents.includes(intentType)
  }

  private shouldUseCatalogQuery(intent: Intent): boolean {
    const supportedIntents = new Set(["SEARCH_PRODUCTS"])
    return supportedIntents.has(intent.type)
  }

  /**
   * Normalize language code from DB format (ITA, ENG, PRT) to ISO format (it, en, pt)
   * This is critical to avoid translating Italian to Italian when DB has "ITA"
   */
  private normalizeLanguageCode(language: string): string {
    const normalized = language?.toLowerCase?.() || "it"
    
    const mapping: Record<string, string> = {
      // Italian
      it: "it", ita: "it", italian: "it",
      // English  
      en: "en", eng: "en", english: "en",
      // Spanish
      es: "es", esp: "es", spa: "es", spanish: "es",
      // Portuguese
      pt: "pt", prt: "pt", portuguese: "pt",
      // French
      fr: "fr", fra: "fr", french: "fr",
      // German
      de: "de", deu: "de", ger: "de", german: "de",
    }
    
    return mapping[normalized] || "it"  // Default to Italian if unknown
  }

  /**
   * ============================================================================
   * MAIN ENTRY POINT (Public API)
   * ============================================================================
   * 
   * Design Pattern: Decorator/Wrapper with Customer-Level Lock
   * 
   * This wrapper ensures:
   * 1. CONCURRENCY SAFETY: Only ONE message per customer processed at a time
   * 2. TRANSLATION: ALL responses pass through Translation Layer
   * 
   * Flow:
   *   0. Acquire customer lock (wait if another message is processing)
   *   1. processMessageInternal() → Business logic, returns Italian response
   *   2. applyTranslation() → Translates to customer's language
   *   3. Release customer lock
   *   4. Return final translated response
   * 
   * @param input - Customer message and context
   * @returns Translated response ready for delivery
   */
  async routeMessage(input: ChatEngineInput): Promise<ChatEngineOutput> {
    // 🔒 CONCURRENCY LOCK: Ensure sequential processing per customer
    const lockKey = `customer:${input.customerId}`
    
    // Wait for any existing lock to release
    while (customerProcessingLocks.has(lockKey)) {
      logger.info(`🔒 [ChatEngine] Waiting for lock: ${lockKey}`)
      await customerProcessingLocks.get(lockKey)
    }
    
    // Create and set our lock
    let releaseLock: () => void
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve
    })
    customerProcessingLocks.set(lockKey, lockPromise)
    
    logger.info(`🔒 [ChatEngine] Lock acquired: ${lockKey}`)
    
    try {
      // STEP 1: Process message through business logic pipeline
      const result = await this.processMessageInternal(input)
    
      // STEP 2: Apply Translation Layer (SINGLE translation point)
      const debugSteps = result.debugInfo?.steps || []
      const rawTargetLanguage = input.customerLanguage || "it"
    
      // Normalize language code (handles ITA, ENG, PRT, SPA, etc.)
      const normalizedLanguage = this.normalizeLanguageCode(rawTargetLanguage)
    
      // Always apply translation layer (even for Italian - ensures consistent flow)
      const translationResult = await this.applyTranslation(
        result.message,
        input.workspaceId,
        normalizedLanguage,  // Pass normalized code (pt, en, es, it) 
        debugSteps,
        input.customerName
      )
    
      // 🌍 STEP 2B: Update the saved message with translated version
      // Use the message ID saved from processMessageInternal
      const messageIdToUpdate = (result as any)._assistantMessageId
    
      if (messageIdToUpdate) {
        try {
          logger.info("🌍 [ChatEngine] Attempting to update message", {
            messageId: messageIdToUpdate,
            targetLanguage: normalizedLanguage,
            hasId: !!messageIdToUpdate,
          })
        
          // Build updated debugInfo with translation step
          const updatedDebugInfo = result.debugInfo ? {
            ...result.debugInfo,
            steps: debugSteps, // Now includes translation step
            totalTokens: (result.debugInfo.totalTokens || 0) + translationResult.tokensUsed,
          } : undefined
        
          await this.prisma.conversationMessage.update({
            where: { id: messageIdToUpdate },
            data: { 
              content: translationResult.message,
              debugInfo: updatedDebugInfo ? JSON.stringify(updatedDebugInfo) : undefined,
            }
          })
        
          logger.info("🌍 [ChatEngine] ✅ Updated saved message with translation", {
            messageId: messageIdToUpdate,
            targetLanguage: normalizedLanguage,
            newContentLength: translationResult.message.length,
            debugStepsCount: debugSteps.length,
          })
        } catch (error: any) {
          logger.error("⚠️ [ChatEngine] Failed to update message translation", { 
            error: error.message || error,
            messageId: messageIdToUpdate,
            errorCode: error.code,
          })
          // Continue anyway - the translated message will be returned to user
        }
      } else {
        logger.warn("⚠️ [ChatEngine] No message ID to update translation", {
          hasResult: !!result,
          hasAssistantMessageId: !!(result as any)._assistantMessageId,
        })
      }
    
      // STEP 3: Return translated result with updated metrics
      // Remove the internal _assistantMessageId before returning
      const { _assistantMessageId, ...cleanResult } = result as any
    
      return {
        ...cleanResult,
        message: translationResult.message,
        response: translationResult.message,
        tokensUsed: cleanResult.tokensUsed + translationResult.tokensUsed,
        debugInfo: cleanResult.debugInfo ? {
          ...cleanResult.debugInfo,
          steps: debugSteps,
          totalTokens: (cleanResult.debugInfo.totalTokens || 0) + translationResult.tokensUsed,
        } : undefined,
      }
    } finally {
      // 🔓 ALWAYS release lock, even on error
      customerProcessingLocks.delete(lockKey)
      releaseLock!()
      logger.info(`🔓 [ChatEngine] Lock released: ${lockKey}`)
    }
  }

  /**
   * ============================================================================
   * INTERNAL MESSAGE PROCESSOR (Private - Business Logic)
   * ============================================================================
   * 
   * Contains all message processing logic. Returns response in Italian (base language).
   * Translation is handled by the routeMessage() wrapper.
   * 
   * Pipeline Steps:
   *   0. Load workspace config
   *   1. Preprocess (detect numbers, confirmations)
   *   2. FAST-PATH: Handle confirmations, numeric selections
   *   3. Parse intent with LLM
   *   4. Load data based on intent
   *   5. Build structured response
   *   6. Format with LLM
   *   7. Replace links/tokens
   *   8. Save to history
   *   9. Update FSM state
   * 
   * @param input - Customer message and context
   * @returns Response in Italian (base language)
   */
  private async processMessageInternal(input: ChatEngineInput): Promise<ChatEngineOutput> {
    const startTime = Date.now()
    const debugSteps: DebugStep[] = []
    let totalTokens = 0

    logger.info("🚀 [ChatEngine] Processing message", {
      customerId: input.customerId,
      workspaceId: input.workspaceId,
      messagePreview: input.message.substring(0, 50),
    })

    try {
      // ========================================================================
      // STEP 0: Load workspace config
      // ========================================================================
      const workspaceConfig = await this.loadWorkspaceConfig(input.workspaceId)
      
      logger.info("⚙️ [ChatEngine] Workspace config loaded", {
        sellsProducts: workspaceConfig.sellsProductsAndServices,
        hasSalesAgents: workspaceConfig.hasSalesAgents,
      })

      // ========================================================================
      // STEP 0.5: Preprocess short inputs (numbers, yes/no)
      // ========================================================================
      const conversationId = input.conversationId || `temp-${input.customerId}`
      
      logger.debug("🔍 [ChatEngine] Processing message", {
        conversationId,
        message: input.message.substring(0, 50),
      })

      // Preprocess: detect short inputs and enrich message for LLM
      let preprocessResult = messagePreprocessorService.process(input.message)

      logger.info("🔍 [ChatEngine] Preprocess result", {
        isShortInput: preprocessResult.isShortInput,
        inputType: preprocessResult.inputType,
        extractedNumber: preprocessResult.extractedNumber,
        extractedQuantity: preprocessResult.extractedQuantity,
      })

      // Use enriched message for LLM (contains context hints for short inputs)
      const messageForLLM = preprocessResult.enrichedMessage

      let cachedOptionsMapping: OptionsMapping | null | undefined
      const loadOptionsMapping = async (): Promise<OptionsMapping | null> => {
        if (cachedOptionsMapping === undefined) {
          cachedOptionsMapping = await this.optionsMappingService.loadMapping(
            input.workspaceId,
            conversationId
          )
        }
        return cachedOptionsMapping
      }

      // ========================================================================
      // STEP 0.55: Pending action requiring free-text note (ADD_ORDER_NOTE)
      // ========================================================================
      const pendingMapping = await loadOptionsMapping()
      if (pendingMapping?.pendingAction?.type === "ADD_ORDER_NOTE") {
        const orderCode = pendingMapping.pendingAction.orderCode
        const noteContent = input.message.trim()

        if (!orderCode) {
          logger.warn("⚠️ [ChatEngine] Pending ADD_ORDER_NOTE without orderCode")
          await this.optionsMappingService.clearPendingAction(conversationId)
        } else if (!noteContent) {
          const promptMessage = "Scrivi la nota che vuoi aggiungere all'ordine."
          const savedMessages = await this.saveMessages(
            input.workspaceId,
            input.customerId,
            conversationId,
            input.message,
            promptMessage
          )
          return {
            message: promptMessage,
            agentType: AgentType.ORDER_TRACKING,
            wasHandled: true,
            intent: "ADD_ORDER_NOTE",
            confidence: "HIGH",
            source: "PATTERN",
            processingTimeMs: Date.now() - startTime,
            response: promptMessage,
            agentUsed: AgentType.ORDER_TRACKING,
            tokensUsed: 0,
            executionTimeMs: Date.now() - startTime,
            wasFAQ: false,
            isBlocked: false,
            _assistantMessageId: savedMessages?.assistantMessageId,
          }
        } else {
          const { addOrderNote } = require("../../domain/calling-functions/addOrderNote")
          const noteResult = await addOrderNote({
            workspaceId: input.workspaceId,
            customerId: input.customerId,
            orderCode,
            note: noteContent,
          })

          await this.optionsMappingService.clearPendingAction(conversationId)
          cachedOptionsMapping = null

          const processedMessage = await this.replaceUserVariables(
            noteResult.message,
            input.customerId,
            input.workspaceId,
            input.customerName
          )

          const savedMessages = await this.saveMessages(
            input.workspaceId,
            input.customerId,
            conversationId,
            input.message,
            processedMessage
          )

          return {
            message: processedMessage,
            agentType: AgentType.ORDER_TRACKING,
            wasHandled: true,
            intent: "ADD_ORDER_NOTE",
            confidence: "HIGH",
            source: "PATTERN",
            processingTimeMs: Date.now() - startTime,
            response: processedMessage,
            agentUsed: AgentType.ORDER_TRACKING,
            tokensUsed: 0,
            executionTimeMs: Date.now() - startTime,
            wasFAQ: false,
            isBlocked: false,
            _assistantMessageId: savedMessages?.assistantMessageId,
          }
        }
      }

      // ========================================================================
      // STEP 0.6: FAST-PATH for confirmation with quantity (e.g., "sì 3", "si, 2 pezzi")
      // ========================================================================
      // If preprocessor detected "confirmation_with_quantity", handle ADD_TO_CART directly
      if (preprocessResult.inputType === "confirmation_with_quantity" || preprocessResult.inputType === "confirmation") {
        const optionsMapping = await loadOptionsMapping()
        const pendingAction = optionsMapping?.pendingAction
        
        if (pendingAction && pendingAction.type === "ADD_TO_CART" && pendingAction.productId) {
          logger.info("🛒 [ChatEngine] FAST-PATH: Confirmation detected with pending ADD_TO_CART", {
            inputType: preprocessResult.inputType,
            extractedQuantity: preprocessResult.extractedQuantity,
            productId: pendingAction.productId,
            productName: pendingAction.productName,
            itemType: pendingAction.itemType || "PRODUCT",
          })
          
          // Extract quantity: from message if present, otherwise default to 1
          const quantity = preprocessResult.extractedQuantity || pendingAction.quantity || 1
          const itemLabel = pendingAction.itemType === "SERVICE" ? "servizio" : "prodotto"
          
          // Delegate to CartManagementAgentLLM with selectedSku and itemType
          const cartAgent = new CartManagementAgentLLM(this.prisma)
          const cartResponse = await cartAgent.handleQuery({
            workspaceId: input.workspaceId,
            customerId: input.customerId,
            query: `aggiungi ${quantity} ${pendingAction.productName || itemLabel} al carrello`,
            customerName: input.customerName || "",
            customerLanguage: input.customerLanguage || "it",
            customerDiscount: input.customerDiscount || 0,
            selectedSku: pendingAction.productId, // SKU/code for precise cart addition
            selectedItemType: pendingAction.itemType || "PRODUCT", // 🆕 Pass item type
          })
          
          // 🧹 CRITICAL: Clear pendingAction after execution to prevent re-use
          await this.optionsMappingService.clearPendingAction(conversationId)
          logger.info("🧹 [ChatEngine] Cleared pendingAction after ADD_TO_CART execution")
          
          // 🛒 CRITICAL: Save CART_ACTIONS mapping so "1" triggers CONFIRM_ORDER, not product search!
          const cartItemCount = this.extractCartItemCountFromFunctionCalls(cartResponse.functionCalls)
          const cartActions = await this.buildCartActionOptions((cartItemCount ?? 2) > 1, input.workspaceId)

          await this.optionsMappingService.saveMapping({
            workspaceId: input.workspaceId,
            conversationId,
            customerId: input.customerId,
            responseText: "",
            items: cartActions,
            listType: "CART_ACTIONS",
          })
          logger.info("🛒 [ChatEngine] Set CART_ACTIONS mapping after ADD_TO_CART", {
            cartItemCount,
            actions: cartActions.map((action) => action.id),
          })
          
          const processingTimeMs = Date.now() - startTime
          
          const savedMessages = await this.saveMessages(
            input.workspaceId,
            input.customerId,
            conversationId,  // 🔧 Use conversationId (not input.conversationId) for consistent history
            input.message,
            cartResponse.output
          )
          
          return {
            message: cartResponse.output,
            agentType: AgentType.CART_MANAGEMENT,
            wasHandled: true,
            intent: "CONFIRM_ADD_TO_CART",
            confidence: "HIGH",
            source: "PATTERN",
            processingTimeMs,
            debugInfo: {
              loadedDataType: "PENDING_ACTION_EXECUTED",
              responseType: "CART_OPERATION",
              // llmUsed: true, // RIMOSSO: non esiste nel tipo
              // fastPath: "CONFIRMATION_WITH_QUANTITY", // RIMOSSO: non esiste nel tipo
            },
            response: cartResponse.output,
            agentUsed: AgentType.CART_MANAGEMENT,
            tokensUsed: cartResponse.tokensUsed,
            executionTimeMs: processingTimeMs,
            wasFAQ: false,
            isBlocked: false,
            _assistantMessageId: savedMessages?.assistantMessageId,
          }
        } else if (pendingAction && pendingAction.type === "SHOW_PRODUCTS") {
          logger.info("🛍️ [ChatEngine] FAST-PATH: Confirmation detected for SHOW_PRODUCTS prompt")
          
          await this.optionsMappingService.clearPendingAction(conversationId)
          cachedOptionsMapping = null
          
          const showIntent: Intent = { type: "SHOW_PRODUCTS" } as Intent
          const loadedData = await this.dataLoader.loadForIntent(
            showIntent,
            input.workspaceId,
            input.customerId,
            input.customerDiscount
          )
          
          const structuredResponse = this.responseBuilder.build(showIntent, loadedData, {
            workspaceId: input.workspaceId,
            customerLanguage: input.customerLanguage || "it",
            customerName: input.customerName,
            customerDiscount: input.customerDiscount,
          })
          
          const formatterResult = await this.formatWithCustomRules(
            structuredResponse,
            input.customerLanguage || "it",
            workspaceConfig
          )
          
          const finalMessage = formatterResult.text
          const processingTimeMs = Date.now() - startTime
          
          const savedMessages = await this.saveMessages(
            input.workspaceId,
            input.customerId,
            conversationId,
            input.message,
            finalMessage
          )
          
          const categoryItems =
            structuredResponse.data?.items?.map((item: ListItem) => ({
              number: item.number,
              name: item.name,
              id: item.id,
            })) || []
          
          await this.optionsMappingService.saveMapping({
            workspaceId: input.workspaceId,
            conversationId,
            customerId: input.customerId,
            responseText: formatterResult.text,
            items: categoryItems,
            listType: "CATEGORIES",
          })
          
          return {
            message: finalMessage,
            agentType: AgentType.PRODUCT_SEARCH,
            wasHandled: true,
            intent: "SHOW_PRODUCTS",
            confidence: "HIGH",
            source: "PATTERN",
            processingTimeMs,
            response: finalMessage,
            agentUsed: AgentType.PRODUCT_SEARCH,
            tokensUsed: formatterResult.tokensUsed || 0,
            executionTimeMs: processingTimeMs,
            wasFAQ: false,
            isBlocked: false,
            _assistantMessageId: savedMessages?.assistantMessageId,
          }
        }
      }

      // ========================================================================
      // STEP 0.7: Load ChatSession for FSM state management
      // ========================================================================

      if (preprocessResult.inputType === "normal") {
        const optionsMapping = await loadOptionsMapping()
        if (optionsMapping?.options?.length) {
          const normalizedMessage = OptionsMappingService.cleanLabel(input.message).toLowerCase()
          const matchedOption = optionsMapping.options.find((opt) => {
            const normalizedLabel = OptionsMappingService.cleanLabel(opt.label).toLowerCase()
            return normalizedLabel === normalizedMessage
          })

          if (matchedOption) {
            logger.info("🎯 [ChatEngine] Text-based selection matched option", {
              label: matchedOption.label,
              number: matchedOption.number,
              listType: optionsMapping.listType,
            })

            preprocessResult = {
              ...preprocessResult,
              isShortInput: true,
              inputType: "number",
              extractedNumber: matchedOption.number,
            }
          }
        }
      }

      // 🆕 Load chatSession early so FSM can be used in FAST-PATH
      const chatSession = await this.prisma.chatSession.findFirst({
        where: { 
          workspaceId: input.workspaceId,
          customerId: input.customerId,
          status: "active",
        },
        select: { id: true },
      })
      
      let fsmState: StateContext = {
        state: ConversationState.IDLE,
        stateEnteredAt: new Date().toISOString(),
      }
      
      if (chatSession) {
        fsmState = await this.conversationStateService.getState(chatSession.id)
        logger.debug("🔄 [FSM] Loaded conversation state (early)", {
          chatSessionId: chatSession.id.substring(0, 8),
          state: fsmState.state,
        })
      }

      // ========================================================================
      // NOTE: NO automatic context reset for text input
      // ========================================================================
      // Principle XV: "User Context Freedom" - Users can switch context at ANY time
      // BUT we DON'T clear optionsMapping preemptively because:
      // 1. User might reference items from the current list ("cancella Confezione Regalo")
      // 2. Intent Parser needs context to understand relative references
      // 3. The LLM will naturally handle context switches
      // 
      // optionsMapping is cleared ONLY when:
      // - A new list is shown (overwrites old mapping)
      // - User explicitly starts a new flow (handled by FSM transitions)

      // ========================================================================
      // STEP 0.75: FAST-PATH - Resolve numeric selections from options mapping
      // ========================================================================
      // If user typed a number, load options mapping from DB and resolve directly
      if (preprocessResult.inputType === "number" && preprocessResult.extractedNumber) {
        const optionsMapping = await loadOptionsMapping()
        
        // 🔍 DEBUG: Log what we got from the database
        logger.info("🔍 [DEBUG] Loaded optionsMapping for number selection", {
          hasMapping: !!optionsMapping,
          listType: optionsMapping?.listType,
          optionsCount: optionsMapping?.options?.length,
          hasGroupMapping: !!optionsMapping?.groupMapping,
          groupMappingKeys: optionsMapping?.groupMapping ? Object.keys(optionsMapping.groupMapping) : [],
          firstOptionSkus: optionsMapping?.options?.[0]?.skus?.slice(0, 2),
        })
        
        // 🆕 PRIORITY 1: Check groupMapping first (for smart grouping like "Formaggi Freschi")
        // This contains the SKUs for each numbered group created by LLM
        if (optionsMapping?.groupMapping) {
          const groupKey = String(preprocessResult.extractedNumber)
          const selectedGroup = optionsMapping.groupMapping[groupKey]
          
          logger.info("🔍 [DEBUG] Checking groupMapping", {
            groupKey,
            hasSelectedGroup: !!selectedGroup,
            selectedGroupSkus: selectedGroup?.skus?.slice(0, 3),
          })
          
          if (selectedGroup && selectedGroup.skus?.length > 0) {
            logger.info("🎯 [ChatEngine] FAST-PATH: Using groupMapping to resolve selection", {
              number: preprocessResult.extractedNumber,
              groupName: selectedGroup.nome,
              skuCount: selectedGroup.skus.length,
              skus: selectedGroup.skus,
            })
            
            // Load products by SKUs
            const products = await this.dataLoader.loadProductsBySkus(
              input.workspaceId,
              selectedGroup.skus,
              input.customerDiscount
            )
            
            if (products.length > 0) {
              // Build response with loaded products
              const loadedData = {
                type: "PRODUCTS" as const,
                products,
              }
              
              const structuredResponse = this.responseBuilder.build(
                { type: "SEARCH_PRODUCTS", query: selectedGroup.nome },
                loadedData,
                {
                  customerName: input.customerName,
                  customerLanguage: input.customerLanguage || "it",
                  workspaceId: input.workspaceId,
                  customerDiscount: input.customerDiscount,
                }
              )
              
              // Format with LLM
              const formatterResult = await this.formatWithCustomRules(
                structuredResponse,
                input.customerLanguage || "it",
                workspaceConfig
              )
              let finalMessage = formatterResult.text
              
              // Remove any SKU tags before showing to customer
              finalMessage = finalMessage
                .replace(/\s*\[SKU:[A-Z0-9-]+\]/gi, '')
                .replace(/\s*\[SKUS?:[A-Z0-9-,]+\]/gi, '')
                .replace(/---JSON_MAPPING---[\s\S]*?---END_JSON---/g, '')
                .trim()
              
              const processingTimeMs = Date.now() - startTime
              
              // Save messages
              const savedMessages = await this.saveMessages(
                input.workspaceId,
                input.customerId,
                conversationId,  // 🔧 Use conversationId for consistent history
                input.message,
                finalMessage
              )
              
              // 🔧 CRITICAL: Save new options mapping with items and listType
              // This ensures next "1" is interpreted as product selection, not group selection!
              const itemsWithSkus = structuredResponse.data?.items?.map((item: any) => ({
                number: item.number,
                name: item.name,
                sku: item.sku,
              }))
              
              await this.optionsMappingService.saveMapping({
                workspaceId: input.workspaceId,
                conversationId,
                customerId: input.customerId,
                responseText: formatterResult.text,
                items: itemsWithSkus,  // 🔧 Pass items with SKUs
                listType: "PRODUCTS",  // 🔧 Mark as product list for next selection
                // groupMapping: undefined - intentionally NOT passing groupMapping for product lists
              })
              
              logger.info("✅ [ChatEngine] FAST-PATH groupMapping complete", {
                groupName: selectedGroup.nome,
                productsReturned: products.length,
                savedItemsCount: itemsWithSkus?.length || 0,
                savedListType: "PRODUCTS",
                timeMs: processingTimeMs,
              })
              
              return {
                message: finalMessage,
                agentType: AgentType.PRODUCT_SEARCH,
                wasHandled: true,
                intent: "SELECT_GROUP",
                confidence: "HIGH",
                source: "PATTERN",
                processingTimeMs,
                debugInfo: {
                  loadedDataType: "PRODUCTS_FROM_GROUP",
                  responseType: structuredResponse.type,
                  llmUsed: !formatterResult.cached,
                  steps: debugSteps,
                  totalTokens: formatterResult.tokensUsed || 0,
                },
                response: finalMessage,
                agentUsed: AgentType.PRODUCT_SEARCH,
                tokensUsed: formatterResult.tokensUsed || 0,
                executionTimeMs: processingTimeMs,
                wasFAQ: false,
                isBlocked: false,
                _assistantMessageId: savedMessages?.assistantMessageId,
              }
            }
          }
        }
        
        // PRIORITY 2: Fall back to regular options (categories, products with SKUs)
        if (optionsMapping?.options && optionsMapping.options.length > 0) {
          const selectedOption = optionsMapping.options.find(
            opt => opt.number === preprocessResult.extractedNumber
          )
          
          if (selectedOption) {
            logger.info("🎯 [ChatEngine] FAST-PATH: Resolved selection from options mapping", {
              number: preprocessResult.extractedNumber,
              label: selectedOption.label,
              skus: selectedOption.skus,
              id: (selectedOption as any).id,  // 🆕 For ORDER_ACTIONS
              listType: optionsMapping.listType,
            })
            
            // Create SELECT_OPTION intent with SKUs and optionId
            const selectIntent: import("../intent/intent.types").SelectOptionIntent = {
              type: "SELECT_OPTION",
              number: preprocessResult.extractedNumber,
              resolvedValue: selectedOption.label,
              listType: (optionsMapping.listType as import("../intent/intent.types").ListType) || "CATEGORIES",
              skus: selectedOption.skus,
              optionId: (selectedOption as any).id,  // 🆕 For ORDER_ACTIONS: "SEND_INVOICE", "REPEAT_ORDER"
              optionMetadata: (selectedOption as any).metadata,
            }
            
            // Load data using this intent
            const loadedData = await this.dataLoader.loadForIntent(
              selectIntent,
              input.workspaceId,
              input.customerId,
              input.customerDiscount
            )
            
            // Build and format response
            const structuredResponse = this.responseBuilder.build(
              selectIntent,
              loadedData, 
              {
                workspaceId: input.workspaceId,
                customerLanguage: input.customerLanguage,
                customerName: input.customerName,
                customerDiscount: input.customerDiscount,
                disableGrouping: selectIntent.listType === "ORDER_OPTIMIZATION_ACTIONS",
              }
            )
            
            // 📦 Handle ORDER_ACTION - execute calling function directly
            if (structuredResponse.type === "ORDER_ACTION") {
              const orderActionData = structuredResponse.data as { action: string; orderCode?: string }
              const action = orderActionData.action
              const metadataOrderCode = optionsMapping.options?.find(opt => (opt as any).id === action)?.metadata?.orderCode
              const orderCode =
                orderActionData.orderCode ||
                metadataOrderCode ||
                optionsMapping.currentOrderCode
              
              logger.info("📦 [ChatEngine] ORDER_ACTION detected, executing calling function", {
                action,
                orderCode,
              })
              
              if (!orderCode) {
                logger.warn("⚠️ [ChatEngine] No order code found for ORDER_ACTION")
                return {
                  message: "Mi dispiace, non ho trovato l'ordine di riferimento. Puoi dirmi il codice ordine?",
                  agentType: AgentType.ORDER_TRACKING,
                  wasHandled: true,
                  intent: "ORDER_ACTION",
                  confidence: "HIGH",
                  source: "PATTERN",
                  processingTimeMs: Date.now() - startTime,
                  llmUsed: false,
                }
              }
              
              // Execute the appropriate calling function
              const actionResult = await this.executeOrderAction(
                action,
                orderCode,
                input.workspaceId,
                input.customerId,
                conversationId
              )
              
              // 🔧 Replace user variables in the message ({{nameUser}}, {{agentPhone}}, etc.)
              const processedMessage = await this.replaceUserVariables(
                actionResult.message,
                input.customerId,
                input.workspaceId,
                input.customerName
              )
              
              // Save messages to history
              const savedMessages = await this.saveMessages(
                input.workspaceId,
                input.customerId,
                conversationId,
                input.message,
                processedMessage
              )
              
              return {
                message: processedMessage,
                agentType: AgentType.ORDER_TRACKING,
                wasHandled: true,
                intent: "ORDER_ACTION",
                confidence: "HIGH",
                source: "PATTERN",
                processingTimeMs: Date.now() - startTime,
                // llmUsed: false, // RIMOSSO: non esiste nel tipo
                _assistantMessageId: savedMessages?.assistantMessageId,
              }
            }
            
            // 🛒 Handle CART_ACTION - execute cart action directly
            if (structuredResponse.type === "CART_ACTION") {
              const action = (structuredResponse.data as { action: string }).action
              
              logger.info("🛒 [ChatEngine] CART_ACTION detected", { action })
              
              if (action === "CONFIRM_ORDER") {
                const confirmStart = Date.now()
                const orderResult = await confirmOrder({
                  workspaceId: input.workspaceId,
                  customerId: input.customerId,
                })

                // Replace template variables
                let confirmMessage = await this.replaceUserVariables(
                  orderResult.message,
                  input.customerId,
                  input.workspaceId,
                  input.customerName
                )

                const replacementResult = await this.linkReplacementService.replaceTokens(
                  { response: confirmMessage, linkType: "auto" },
                  input.customerId,
                  input.workspaceId
                )
                if (replacementResult.success && replacementResult.response) {
                  confirmMessage = replacementResult.response
                }

                // Persist response
                const savedMessages = await this.saveMessages(
                  input.workspaceId,
                  input.customerId,
                  conversationId,
                  input.message,
                  confirmMessage,
                  AgentType.CART_MANAGEMENT,
                  0,
                  {
                    loadedDataType: "CART_ACTION",
                    responseType: "CONFIRM_ORDER",
                    llmUsed: false,
                    steps: [
                      {
                        type: "function_call",
                        agent: "🧾 confirmOrder",
                        timestamp: new Date().toISOString(),
                        input: { textContent: "Finalize cart checkout" },
                        output: {
                          result: {
                            success: orderResult.success,
                            orderCode: orderResult.orderCode,
                            total: orderResult.orderTotal,
                          },
                          executionTimeMs: Date.now() - confirmStart,
                        },
                        duration: Date.now() - confirmStart,
                      },
                    ],
                    totalTokens: 0,
                    totalCost: 0,
                    executionTimeMs: Date.now() - confirmStart,
                  }
                )

                // Clear any pending checkout confirmations
                await this.optionsMappingService.clearPendingAction(conversationId)

                // Save next actions (notes / orders) if provided
                if (orderResult.nextActions?.options?.length) {
                  await this.optionsMappingService.saveMapping({
                    workspaceId: input.workspaceId,
                    conversationId,
                    customerId: input.customerId,
                    responseText: "",
                    items: orderResult.nextActions.options.map((opt) => ({
                      number: opt.number,
                      name: opt.label,
                      id: opt.id,
                      metadata: opt.metadata,
                    })),
                    listType: (orderResult.nextActions.listType as ListType) || "ORDER_ACTIONS",
                  })
                } else {
                  await this.optionsMappingService.saveMapping({
                    workspaceId: input.workspaceId,
                    conversationId,
                    customerId: input.customerId,
                    responseText: "",
                    forceClear: true,
                  })
                }

                return {
                  message: confirmMessage,
                  agentType: AgentType.CART_MANAGEMENT,
                  wasHandled: orderResult.success,
                  intent: "CART_ACTION",
                  confidence: "HIGH",
                  source: "PATTERN",
                  processingTimeMs: Date.now() - startTime,
                  response: confirmMessage,
                  agentUsed: AgentType.CART_MANAGEMENT,
                  tokensUsed: 0,
                  executionTimeMs: Date.now() - startTime,
                  wasFAQ: false,
                  isBlocked: false,
                  _assistantMessageId: savedMessages?.assistantMessageId,
                }
              }
              
              // 🚚 Handle OPTIMIZE_TRANSPORT - Premium/Enterprise feature
              if (action === "OPTIMIZE_TRANSPORT") {
                logger.info("🚚 [ChatEngine] OPTIMIZE_TRANSPORT action triggered")
                
                // Import the OrderOptimizationAgentLLM
                const { OrderOptimizationAgentLLM } = await import("../agents/OrderOptimizationAgentLLM")
                const optimizationAgent = new OrderOptimizationAgentLLM(this.prisma)
                
                const optimizationStart = Date.now()
                const optimizationResult = await optimizationAgent.process({
                  workspaceId: input.workspaceId,
                  customerId: input.customerId,
                  customerLanguage: input.customerLanguage || "it",
                })
                
                // Persist response
                const savedMessages = await this.saveMessages(
                  input.workspaceId,
                  input.customerId,
                  conversationId,
                  input.message,
                  optimizationResult.explanation,
                  AgentType.CART_MANAGEMENT,
                  optimizationResult.tokensUsed || 0,
                  {
                    loadedDataType: "CART_ACTION",
                    responseType: "OPTIMIZE_TRANSPORT",
                    llmUsed: true,
                    steps: [
                      {
                        type: "function_call",
                        agent: "🚚 OrderOptimizationAgentLLM",
                        timestamp: new Date().toISOString(),
                        input: { customerId: input.customerId },
                        output: {
                          result: {
                            success: optimizationResult.success,
                            hasSuggestions: !!optimizationResult.recommendations?.length,
                          },
                          executionTimeMs: Date.now() - optimizationStart,
                        },
                        duration: Date.now() - optimizationStart,
                      },
                    ],
                    totalTokens: optimizationResult.tokensUsed || 0,
                    totalCost: 0,
                    executionTimeMs: Date.now() - optimizationStart,
                  }
                )
                
                // Clear pending action
                await this.optionsMappingService.clearPendingAction(conversationId)
                
                // 🚚 Save ORDER_OPTIMIZATION options for next interaction
                const transports = optimizationResult.analysis?.transports ?? []
                const optimizationOptions: Array<{ number: number; name: string; id: string; metadata?: Record<string, any> }> = []
                let optionCounter = 1

                if (transports.length > 0) {
                  for (const transport of transports.slice(0, 3)) {
                    optimizationOptions.push({
                      number: optionCounter++,
                      name: `${this.getTransportEmoji(transport.transportTypeName)} Mostra prodotti ${transport.transportTypeName}`,
                      id: "SHOW_TRANSPORT_PRODUCTS",
                      metadata: { transportTypeName: transport.transportTypeName },
                    })
                  }
                } else {
                  // Fallback options if analysis did not return transport names
                  optimizationOptions.push(
                    { number: optionCounter++, name: "🧊 Mostra prodotti Congelati", id: "SHOW_FROZEN_PRODUCTS", metadata: { transportTypeName: "Trasporto congelato" } },
                    { number: optionCounter++, name: "❄️ Mostra prodotti Refrigerati", id: "SHOW_REFRIGERATED_PRODUCTS", metadata: { transportTypeName: "Trasporto refrigerato" } },
                    { number: optionCounter++, name: "📦 Mostra prodotti Temperatura Ambiente", id: "SHOW_AMBIENT_PRODUCTS", metadata: { transportTypeName: "Temperatura ambiente" } },
                  )
                }

                optimizationOptions.push({
                  number: optionCounter++,
                  name: "🛒 Torna al carrello",
                  id: "SHOW_CART",
                })

                await this.optionsMappingService.saveMapping({
                  workspaceId: input.workspaceId,
                  conversationId,
                  customerId: input.customerId,
                  responseText: optimizationResult.explanation,
                  items: optimizationOptions,
                  listType: "ORDER_OPTIMIZATION_ACTIONS",
                })
                
                return {
                  message: optimizationResult.explanation,
                  agentType: AgentType.CART_MANAGEMENT,
                  wasHandled: true,
                  intent: "CART_ACTION",
                  confidence: "HIGH",
                  source: "PATTERN",
                  processingTimeMs: Date.now() - startTime,
                  response: optimizationResult.explanation,
                  agentUsed: AgentType.CART_MANAGEMENT,
                  tokensUsed: optimizationResult.tokensUsed || 0,
                  executionTimeMs: Date.now() - startTime,
                  wasFAQ: false,
                  isBlocked: false,
                  _assistantMessageId: savedMessages?.assistantMessageId,
                }
              }
              
              // Other actions (SHOW_PRODUCTS) → let normal flow handle it (returns categories)
            }
            
            // 🗑️ Handle CART_REMOVAL_OPTIONS - format removal options
            if (structuredResponse.type === "CART_REMOVAL_OPTIONS") {
              const items = (structuredResponse.data as { items: any[] }).items || []
              
              if (items.length === 0) {
                const emptyMsg = "Il tuo carrello è vuoto, non c'è nulla da rimuovere."
                const savedMessages = await this.saveMessages(
                  input.workspaceId,
                  input.customerId,
                  conversationId,
                  input.message,
                  emptyMsg
                )
                return {
                  message: emptyMsg,
                  agentType: AgentType.CART_MANAGEMENT,
                  wasHandled: true,
                  intent: "CART_REMOVAL_OPTIONS",
                  confidence: "HIGH",
                  source: "PATTERN",
                  processingTimeMs: Date.now() - startTime,
                  _assistantMessageId: savedMessages?.assistantMessageId,
                }
              }
              
              // Build formatted list
              const products = items.filter((i: any) => !i.isService)
              const services = items.filter((i: any) => i.isService)
              
              let removalMessage = "Quale articolo vuoi rimuovere?\n\n"
              let optionNumber = 1
              const mappingItems: Array<{ number: number; name: string; id: string }> = []
              
              if (products.length > 0) {
                removalMessage += "🛍️ **PRODOTTI:**\n"
                for (const p of products) {
                  removalMessage += `${optionNumber}. ${p.name} (${p.quantity}×) - €${(p.price * p.quantity).toFixed(2)}\n`
                  mappingItems.push({ number: optionNumber, name: p.name, id: p.id })
                  optionNumber++
                }
                removalMessage += "\n"
              }
              
              if (services.length > 0) {
                removalMessage += "🎁 **SERVIZI:**\n"
                for (const s of services) {
                  removalMessage += `${optionNumber}. ${s.name} (${s.quantity}×) - €${(s.price * s.quantity).toFixed(2)}\n`
                  mappingItems.push({ number: optionNumber, name: s.name, id: s.id })
                  optionNumber++
                }
              }
              
              removalMessage += "\nRispondi con il numero dell'articolo da rimuovere."
              
              // Save mapping for removal selection
              await this.optionsMappingService.saveMapping({
                workspaceId: input.workspaceId,
                conversationId,
                customerId: input.customerId,
                responseText: "",
                items: mappingItems,
                listType: "CART_ITEMS",
              })
              
              const savedMessages = await this.saveMessages(
                input.workspaceId,
                input.customerId,
                conversationId,
                input.message,
                removalMessage
              )
              
              return {
                message: removalMessage,
                agentType: AgentType.CART_MANAGEMENT,
                wasHandled: true,
                intent: "CART_REMOVAL_OPTIONS",
                confidence: "HIGH",
                source: "PATTERN",
                processingTimeMs: Date.now() - startTime,
                _assistantMessageId: savedMessages?.assistantMessageId,
              }
            }
            
            // ========================================================================
            // 🧠 Handle NEEDS_LLM_CONTEXT - Hybrid fallback when inference failed
            // Pass to LLM with conversation history to understand user intent
            // ========================================================================
            if (structuredResponse.type === "NEEDS_LLM_CONTEXT") {
              const contextData = structuredResponse.data as { 
                label: string
                originalListType: string
                inferAttempted: string | null
              }
              
              debugSteps.push({
                step: "HYBRID_FALLBACK",
                timestamp: Date.now(),
                details: {
                  label: contextData.label,
                  originalListType: contextData.originalListType,
                  inferAttempted: contextData.inferAttempted,
                  action: "Passing to LLM with context",
                },
              })
              
              logger.info("🧠 [ChatEngine] NEEDS_LLM_CONTEXT - passing to LLM with history", {
                label: contextData.label,
                originalListType: contextData.originalListType,
                conversationId,
              })
              
              // Load conversation history for context
              const history = await this.conversationManager.loadHistory(input.workspaceId, conversationId)
              
              // Build a contextual prompt for the LLM
              const contextPrompt = `L'utente ha selezionato l'opzione: "${contextData.label}"
              
Basandoti sulla conversazione precedente, rispondi in modo appropriato a questa selezione.
Se l'utente vuole:
- Confermare un ordine → chiedi conferma
- Vedere prodotti/catalogo → mostra le categorie disponibili
- Rimuovere un articolo → chiedi quale articolo vuole rimuovere
- Scaricare fattura → conferma l'invio
- Ripetere un ordine → chiedi conferma
- Altro → rispondi in modo utile

Rispondi in modo naturale e fluido, come un assistente esperto.`

              // Use UnifiedChatRouter for engine selection (Legacy vs OpenAI SDK)
              const llmResponse = await this.unifiedChatRouter.routeMessage({
                workspaceId: input.workspaceId,
                customerId: input.customerId,
                customerName: input.customerName || "Cliente",
                customerLanguage: input.customerLanguage || "it",
                message: contextPrompt,
                conversationHistory: history,
                customerDiscount: input.customerDiscount || 0,
                conversationId,
                messageId: `${conversationId}-context-${Date.now()}`,
              })
              
              debugSteps.push({
                step: "UNIFIED_ROUTER_RESPONSE",
                timestamp: Date.now(),
                details: {
                  responseLength: llmResponse.response?.length || 0,
                  tokensUsed: llmResponse.tokensUsed || 0,
                  agentUsed: llmResponse.agentUsed,
                },
              })
              
              const finalMessage = llmResponse.response || "Mi dispiace, non ho capito. Puoi ripetere?"
              
              const savedMessages = await this.saveMessages(
                input.workspaceId,
                input.customerId,
                conversationId,
                input.message,
                finalMessage
              )
              
              return {
                message: finalMessage,
                agentType: AgentType.ROUTER,
                wasHandled: true,
                intent: "LLM_CONTEXT_FALLBACK",
                confidence: "MEDIUM",
                source: "LLM_CONTEXT",
                processingTimeMs: Date.now() - startTime,
                debugInfo: {
                  steps: debugSteps,
                  hybridFallback: true,
                  originalLabel: contextData.label,
                },
                _assistantMessageId: savedMessages?.assistantMessageId,
              }
            }
            
            // Format with LLM
            let finalMessage = structuredResponse.text || ""
            let llmUsed = false
            let groupMappingFromFormatter: Record<string, { nome: string; skus: string[] }> | undefined
            
            if (structuredResponse.type !== "NO_RESULTS" && structuredResponse.type !== "ERROR") {
              const formattedResult = await this.formatWithCustomRules(
                structuredResponse,
                input.customerLanguage || "it",
                workspaceConfig
              )
              finalMessage = formattedResult.text
              llmUsed = !formattedResult.cached
              groupMappingFromFormatter = formattedResult.groupMapping  // 🔧 Capture groupMapping
            } else if (structuredResponse.type === "NO_RESULTS") {
              const errorMessage = (structuredResponse.data as { errorMessage?: string })?.errorMessage || "Nessun risultato trovato"
              logger.warn("⚠️ [ChatEngine] NO_RESULTS response, delegating to generic fallback", {
                errorMessage,
                listType: optionsMapping?.listType,
              })
              const fallback = await this.routeGenericLLMFallback({
                input,
                conversationId,
                history,
                fallbackReason: errorMessage,
                debugSteps,
              })
              finalMessage = fallback.message
              llmUsed = true
              totalTokens += fallback.tokensUsed
            }
            
            // Save response WITH SKUs for next selection
            const responseWithSkus = finalMessage
            
            // Remove SKU tags before showing to customer
            finalMessage = finalMessage
              .replace(/\s*\[SKU:[A-Z0-9-]+\]/gi, '')
              .replace(/\s*\[SKUS?:[A-Z0-9-,]+\]/gi, '')
            
            const processingTimeMs = Date.now() - startTime
            const agentType = AgentType.PRODUCT_SEARCH
            
            // Save messages to history
            const savedMessages = await this.saveMessages(
              input.workspaceId,
              input.customerId,
              conversationId,  // 🔧 Use conversationId for consistent history
              input.message,
              finalMessage
            )
            
            // Save options mapping for next selection
            // 🔧 FIX: Pass groupMapping from formatter result for smart grouping!
            // 🆕 FIX: Pass items with SKUs for product lists - no more text parsing!
            const itemsWithSkus = structuredResponse.data.items?.map((item: any) => ({
              number: item.number,
              name: item.name,
              sku: item.sku,
              id: item.id,
            }))
            
            // 🔍 DEBUG: Check what listType we're passing
            const computedListType = structuredResponse.type === "PRODUCT_LIST" ? "PRODUCTS" 
                      : structuredResponse.type === "ORDER_LIST" ? "ORDERS"
                      : structuredResponse.type === "CATEGORY_LIST" ? "CATEGORIES"
                      : structuredResponse.type === "SERVICE_LIST" ? "SERVICES"
                      : structuredResponse.type === "OFFERS" ? "OFFER_CATEGORIES"  // 🆕
                      : undefined
            logger.info("📋 [ChatEngine] DEBUG: About to save mapping", {
              structuredResponseType: structuredResponse.type,
              computedListType,
              itemsCount: itemsWithSkus?.length || 0,
            })
            
            await this.optionsMappingService.saveMapping({
              workspaceId: input.workspaceId,
              conversationId,
              customerId: input.customerId,
              responseText: responseWithSkus,
              groupMapping: groupMappingFromFormatter,
              items: itemsWithSkus,
              listType: structuredResponse.type === "PRODUCT_LIST" ? "PRODUCTS" 
                      : structuredResponse.type === "ORDER_LIST" ? "ORDERS"
                      : structuredResponse.type === "CATEGORY_LIST" ? "CATEGORIES"
                      : structuredResponse.type === "SERVICE_LIST" ? "SERVICES"
                      : structuredResponse.type === "OFFERS" ? "OFFER_CATEGORIES"  // 🆕
                      : undefined,
            })
            
            // 🆕 FSM: Update conversation state based on response type
            if (chatSession) {
              let newFsmState: ConversationState | null = null
              const fsmContext: Partial<StateContext> = {}
              
              switch (structuredResponse.type) {
                case "CATEGORY_LIST":
                  newFsmState = ConversationState.BROWSING_CATEGORIES
                  break
                case "PRODUCT_LIST":
                  newFsmState = ConversationState.BROWSING_PRODUCTS
                  break
                case "SERVICE_LIST":  // 🆕
                  newFsmState = ConversationState.BROWSING_SERVICES
                  break
                case "ORDER_LIST":
                  newFsmState = ConversationState.BROWSING_ORDERS
                  break
                case "PRODUCT_DETAIL":
                  newFsmState = ConversationState.VIEWING_PRODUCT
                  if (structuredResponse.data.product) {
                    fsmContext.selectedProductId = structuredResponse.data.product.id
                    fsmContext.selectedProductSku = structuredResponse.data.product.sku
                    fsmContext.selectedProductName = structuredResponse.data.product.name
                  }
                  break
                case "ORDER_DETAIL":
                  newFsmState = ConversationState.VIEWING_ORDER
                  if (structuredResponse.data.order) {
                    fsmContext.selectedOrderId = structuredResponse.data.order.id
                    fsmContext.selectedOrderCode = structuredResponse.data.order.code
                  }
                  break
                case "CART_VIEW":
                case "CART_UPDATED":
                  newFsmState = ConversationState.VIEWING_CART
                  break
              }
              
              if (newFsmState) {
                await this.conversationStateService.setState(chatSession.id, newFsmState, fsmContext)
                logger.info("🔄 [FSM] FAST-PATH state updated", {
                  newState: newFsmState,
                  responseType: structuredResponse.type,
                })
              }
            }
            
            // 🛒 Set pending action for PRODUCT_DETAIL (add to cart prompt)
            if (structuredResponse.type === "PRODUCT_DETAIL" && structuredResponse.data.product) {
              const product = structuredResponse.data.product
              await this.optionsMappingService.setPendingAction({
                workspaceId: input.workspaceId,
                conversationId,
                pendingAction: {
                  type: "ADD_TO_CART",
                  productId: product.sku || product.id, // 🔧 Use SKU for CartManagementAgent (prefers SKU)
                  productName: product.name,
                  quantity: 1,
                },
              })
              logger.info("🛒 [ChatEngine] FAST-PATH: Set pending ADD_TO_CART action", {
                productId: product.sku || product.id,
                productName: product.name,
              })
            }
            
            // 🆕 Set pending action for SERVICE_DETAIL (add to cart prompt)
            if (structuredResponse.type === "SERVICE_DETAIL" && structuredResponse.data.service) {
              const service = structuredResponse.data.service
              await this.optionsMappingService.setPendingAction({
                workspaceId: input.workspaceId,
                conversationId,
                pendingAction: {
                  type: "ADD_TO_CART",
                  productId: service.code || service.id, // For services, use code
                  productName: service.name,
                  quantity: 1,
                  itemType: "SERVICE", // 🆕 Mark as service for CartManagementAgent
                },
              })
              logger.info("🛒 [ChatEngine] FAST-PATH: Set pending ADD_TO_CART action for service", {
                serviceId: service.code || service.id,
                serviceName: service.name,
              })
            }
            
            // 📦 Save order code AND order actions for ORDER_DETAIL
            // 🔧 CRITICAL: We must save the ACTION options explicitly, not extract from text
            // Because the text contains order items BEFORE actions, and extractFromResponse picks the first numbers
            if (structuredResponse.type === "ORDER_DETAIL" && structuredResponse.data.order) {
              const order = structuredResponse.data.order
              
              // Save order code
              await this.optionsMappingService.setCurrentOrderCode({
                workspaceId: input.workspaceId,
                conversationId,
                orderCode: order.code,
              })
              
              // 🆕 CRITICAL: Save explicit action options so "1" = Fattura, "2" = Ripeti
              // This overrides the extracted options (which would be order items)
              await this.optionsMappingService.saveMapping({
                workspaceId: input.workspaceId,
                conversationId,
                customerId: input.customerId,
                responseText: "", // Empty - we're providing explicit items
                items: [
                  { number: 1, name: "📄 Scarica fattura", id: "SEND_INVOICE", metadata: { orderCode: order.code } },
                  { number: 2, name: "🔄 Ripeti ordine", id: "REPEAT_ORDER", metadata: { orderCode: order.code } },
                ],
                listType: "ORDER_ACTIONS",
              })
              
              logger.info("📦 [ChatEngine] FAST-PATH: Set order actions for ORDER_DETAIL", {
                orderCode: order.code,
                actions: ["SEND_INVOICE", "REPEAT_ORDER"],
              })
            }
            
            // 🛒 Save CART_ACTIONS for CART_VIEW (guided cart options)
            if (structuredResponse.type === "CART_VIEW" || structuredResponse.type === "CART_UPDATED") {
              const cartItems = structuredResponse.data.items || []
              const cartActions = await this.buildCartActionOptions(cartItems.length > 1, input.workspaceId)
              
              await this.optionsMappingService.saveMapping({
                workspaceId: input.workspaceId,
                conversationId,
                customerId: input.customerId,
                responseText: "", // Empty - we're providing explicit items
                items: cartActions,
                listType: "CART_ACTIONS",
              })
              
              logger.info("🛒 [ChatEngine] FAST-PATH: Set cart actions for CART_VIEW", {
                actions: cartActions.map((action) => action.id),
                cartItemCount: cartItems.length,
              })
            }
            
            return {
              message: finalMessage,
              agentType,
              wasHandled: true,
              intent: selectIntent.type,
              confidence: "HIGH",
              source: "PATTERN",
              processingTimeMs,
              debugInfo: {
                loadedDataType: loadedData.type,
                responseType: structuredResponse.type,
                llmUsed,
                steps: debugSteps,
                totalTokens: 0,
              },
              response: finalMessage,
              agentUsed: agentType,
              tokensUsed: 0,
              executionTimeMs: processingTimeMs,
              wasFAQ: false,
              isBlocked: false,
              _assistantMessageId: savedMessages?.assistantMessageId,
            }
          } else {
            // ========================================================================
            // 🚫 INVALID OPTION NUMBER - User selected a number not in the list
            // Instead of falling through to search, return a helpful error message
            // ========================================================================
            const availableOptions = optionsMapping.options || []
            const selectedNumber = preprocessResult.extractedNumber
            const maxOption = availableOptions.reduce((max, opt) => Math.max(max, opt.number || 0), 0)
            
            logger.info("🚫 [ChatEngine] Invalid option number selected", {
              selectedNumber,
              listType: optionsMapping.listType,
              availableOptions: availableOptions.map(o => o.number),
            })
            
            // Build a friendly error message based on the context
            let invalidMessage: string
            if (availableOptions.length > 0) {
              const optionsText = availableOptions
                .map(opt => `${opt.number}. ${opt.label || opt.name || opt.id}`)
                .join("\n")
              invalidMessage = `⚠️ Opzione non valida. Per favore scegli una delle seguenti opzioni:\n${optionsText}`
            } else {
              invalidMessage = `⚠️ Opzione non valida. Per favore scegli un numero valido.`
            }
            
            const processingTimeMs = Date.now() - startTime
            
            // Save messages to history
            const savedMessages = await this.saveMessages(
              input.workspaceId,
              input.customerId,
              conversationId,
              input.message,
              invalidMessage
            )
            
            return {
              message: invalidMessage,
              agentType: AgentType.ROUTER,
              wasHandled: true,
              intent: "INVALID_OPTION",
              confidence: "HIGH",
              source: "PATTERN",
              processingTimeMs,
              debugInfo: {
                invalidOption: selectedNumber,
                maxOption,
                listType: optionsMapping.listType,
                steps: debugSteps,
              },
              _assistantMessageId: savedMessages?.assistantMessageId,
            }
          }
        }
      }

      // ========================================================================
      // STEP 1: Load conversation history
      // ========================================================================
      // 🔧 CRITICAL: Use conversationId (which falls back to temp-{customerId}), NOT input.conversationId
      // Otherwise history is empty for temp conversations!
      const history = await this.conversationManager.loadHistory(input.workspaceId, conversationId)

      logger.debug("📜 [ChatEngine] History loaded", { 
        historyLength: history.length,
        conversationId,
        usedInputConversationId: !!input.conversationId,
      })

      // ========================================================================
      // STEP 1.5: FSM State already loaded in STEP 0.7
      // ========================================================================
      // Re-load FSM state here in case it changed (e.g., from FAST-PATH)
      if (chatSession) {
        fsmState = await this.conversationStateService.getState(chatSession.id)
        logger.info("🔄 [FSM] Refreshed conversation state", {
          chatSessionId: chatSession.id.substring(0, 8),
          state: fsmState.state,
          pendingAction: fsmState.pendingAction?.type,
          selectedOrderCode: fsmState.selectedOrderCode,
        })
      }

      // ========================================================================
      // STEP 2: Parse intent using ORIGINAL message for pattern matching
      // ========================================================================
      // IMPORTANT: Use original message (not enriched) for pattern matching!
      // The enriched message has "[SELECTION: User typed "1"...]" which breaks ^(\d+)$ patterns
      // The IntentParser will use lastAssistantMessage to resolve numeric selections
      const intentParseStart = Date.now()
      const lastAssistantMessage = history.length > 0 
        ? history.filter(h => h.role === "assistant").pop()?.content
        : undefined

      const intentResult = await this.intentParser.parse(input.message, {
        workspaceId: input.workspaceId,
        customerId: input.customerId,
        lastAssistantMessage,
        conversationHistory: history.map((h) => ({ role: h.role, content: h.content })),
      })

      // 🆕 Add Router/IntentParser debug step
      const intentParseTime = Date.now() - intentParseStart
      debugSteps.push({
        type: "router",
        agent: "🧭 Router Agent (IntentParser)",
        model: intentResult.source === "LLM_FALLBACK" ? "gpt-4o-mini" : undefined,
        timestamp: new Date().toISOString(),
        tokenUsage: intentResult.source === "LLM_FALLBACK" ? {
          promptTokens: 150,  // Estimated for intent classification
          completionTokens: 10,
          totalTokens: 160,
        } : undefined,
        systemPrompt: intentResult.source === "LLM_FALLBACK" 
          ? "Intent classification prompt (hardcoded in IntentParser)"
          : "Pattern/Keyword matching (no LLM)",
        input: {
          userMessage: input.message,
        },
        output: {
          decision: `Intent: ${intentResult.intent.type} (${intentResult.confidence} confidence, ${intentResult.source})`,
          executionTimeMs: intentParseTime,
        },
        duration: intentParseTime,
      })
      if (intentResult.source === "LLM_FALLBACK") {
        totalTokens += 160
      }

      logger.info("🎯 [ChatEngine] Intent detected", {
        type: intentResult.intent.type,
        confidence: intentResult.confidence,
        source: intentResult.source,
        timeMs: intentResult.processingTimeMs,
      })

      // ========================================================================
      // STEP 2.25: Handle UNKNOWN intent - ONLY if LLM fallback also failed
      // ========================================================================
      // The IntentParser already uses LLM fallback for classification.
      // If we still get UNKNOWN, it means the LLM couldn't classify it either.
      // In that case, for e-commerce workspaces, try semantic product search.
      // This is a LAST RESORT, not the primary classification method!
      if (intentResult.intent.type === "UNKNOWN" && workspaceConfig.sellsProductsAndServices) {
        const originalMessage = (intentResult.intent as any).originalMessage || input.message
        
        logger.info("🔄 [ChatEngine] UNKNOWN intent after LLM fallback - trying semantic product search", {
          originalIntent: "UNKNOWN",
          source: intentResult.source,
          query: originalMessage
        })
        
        // Last resort: try semantic product search
        // The LLM already tried to classify, so this is just searching products
        intentResult.intent = {
          type: "SEARCH_PRODUCTS",
          query: originalMessage
        } as SearchProductsIntent
        intentResult.source = "LLM_FALLBACK"
      }

      // ========================================================================
      // STEP 2.5.5: 🧹 Clear stale pendingAction if intent is NOT CONFIRM/REJECT
      // ========================================================================
      // If user changes topic (e.g., "cancella carrello", "mostra categorie", etc.),
      // any previous pendingAction (like ADD_TO_CART) is no longer valid
      if (intentResult.intent.type !== "CONFIRM" && intentResult.intent.type !== "REJECT") {
        const existingMapping = await this.optionsMappingService.loadMapping(
          input.workspaceId,
          conversationId
        )
        if (existingMapping?.pendingAction) {
          logger.info("🧹 [ChatEngine] Clearing stale pendingAction - intent changed", {
            previousAction: existingMapping.pendingAction.type,
            newIntent: intentResult.intent.type,
          })
          await this.optionsMappingService.clearPendingAction(conversationId)
        }
      }

      // ========================================================================
      // STEP 2.6: Handle CONFIRM/REJECT with pendingAction
      // ========================================================================
      // When user says "sì" after "Vuoi aggiungerlo al carrello?", execute the pending action
      if (intentResult.intent.type === "CONFIRM" || intentResult.intent.type === "REJECT") {
        const optionsMapping = await this.optionsMappingService.loadMapping(
          input.workspaceId,
          conversationId
        )
        
        if (optionsMapping?.pendingAction) {
          const { pendingAction } = optionsMapping
          
          logger.info("✅ [ChatEngine] Processing CONFIRM/REJECT with pendingAction", {
            intentType: intentResult.intent.type,
            actionType: pendingAction.type,
            productId: pendingAction.productId,
            productName: pendingAction.productName,
          })
          
          if (intentResult.intent.type === "REJECT") {
            // User said "no" - clear pending action and acknowledge
            // 🧹 CRITICAL: Clear pendingAction after rejection
            await this.optionsMappingService.clearPendingAction(conversationId)
            logger.info("🧹 [ChatEngine] Cleared pendingAction after REJECT")
            
            const processingTimeMs = Date.now() - startTime
            const rejectMessage = "Ok, nessun problema! Posso aiutarti con altro?"
            
            const savedMessages = await this.saveMessages(
              input.workspaceId,
              input.customerId,
              conversationId,  // 🔧 Use conversationId for consistent history
              input.message,
              rejectMessage
            )
            
            return {
              message: rejectMessage,
              agentType: AgentType.ROUTER,
              wasHandled: true,
              intent: "REJECT",
              confidence: "HIGH",
              source: "PATTERN",
              processingTimeMs,
              debugInfo: {
                loadedDataType: "PENDING_ACTION_REJECTED",
                responseType: "ACKNOWLEDGMENT",
                // llmUsed: false, // RIMOSSO: non esiste nel tipo
              },
              response: rejectMessage,
              agentUsed: AgentType.ROUTER,
              tokensUsed: 0,
              executionTimeMs: processingTimeMs,
              wasFAQ: false,
              isBlocked: false,
              _assistantMessageId: savedMessages?.assistantMessageId,
            }
          }
          
          // User said "yes" - execute the pending action
          if (pendingAction.type === "ADD_TO_CART" && pendingAction.productId) {
            // Extract quantity from message if present (e.g., "sì, 2 pezzi", "yes, 2 pieces", "sí, 2 unidades")
            // Multilingual: pezzi/pezz|pieces|units|unidades|peças|stück
            const quantityMatch = input.message.match(/(\d+)\s*(pezz[oi]|unit[aà]|pieces?|units?|unidades?|peças?|stück|x)?/i)
            const quantity = quantityMatch ? parseInt(quantityMatch[1]) : (pendingAction.quantity || 1)
            const itemLabel = pendingAction.itemType === "SERVICE" ? "servizio" : "prodotto"
            
            // Delegate to CartManagementAgentLLM for intelligent cart handling
            // 🔧 CRITICAL: Pass selectedSku and itemType so CartManagementAgent knows EXACTLY what to add
            const cartAgent = new CartManagementAgentLLM(this.prisma)
            const cartResponse = await cartAgent.handleQuery({
              workspaceId: input.workspaceId,
              customerId: input.customerId,
              query: `aggiungi ${quantity} ${pendingAction.productName || itemLabel} al carrello`,
              customerName: input.customerName || "",
              customerLanguage: input.customerLanguage || "it",
              customerDiscount: input.customerDiscount || 0,
              selectedSku: pendingAction.productId, // 🔧 SKU/code for precise cart addition
              selectedItemType: pendingAction.itemType || "PRODUCT", // 🆕 Pass item type
            })
            
            // 🧹 CRITICAL: Clear pendingAction after execution
            await this.optionsMappingService.clearPendingAction(conversationId)
            logger.info("🧹 [ChatEngine] Cleared pendingAction after ADD_TO_CART execution (STEP 2.6)")
            
            // 🛒 CRITICAL: Save CART_ACTIONS mapping so "1" triggers CONFIRM_ORDER, not product search!
            const cartItemCount = this.extractCartItemCountFromFunctionCalls(cartResponse.functionCalls)
            const cartActions = await this.buildCartActionOptions((cartItemCount ?? 2) > 1, input.workspaceId)

            await this.optionsMappingService.saveMapping({
              workspaceId: input.workspaceId,
              conversationId,
              customerId: input.customerId,
              responseText: "",
              items: cartActions,
              listType: "CART_ACTIONS",
            })
            logger.info("🛒 [ChatEngine] Set CART_ACTIONS mapping after ADD_TO_CART (STEP 2.6)", {
              cartItemCount,
              actions: cartActions.map((action) => action.id),
            })
            
            const processingTimeMs = Date.now() - startTime
            
            const savedMessages = await this.saveMessages(
              input.workspaceId,
              input.customerId,
              conversationId,  // 🔧 Use conversationId for consistent history
              input.message,
              cartResponse.output
            )
            
            return {
              message: cartResponse.output,
              agentType: AgentType.CART_MANAGEMENT,
              wasHandled: true,
              intent: "CONFIRM_ADD_TO_CART",
              confidence: "HIGH",
              source: "PATTERN",
              processingTimeMs,
              debugInfo: {
                loadedDataType: "PENDING_ACTION_EXECUTED",
                responseType: "CART_OPERATION",
                llmUsed: true,
              },
              response: cartResponse.output,
              agentUsed: AgentType.CART_MANAGEMENT,
              tokensUsed: cartResponse.tokensUsed,
              executionTimeMs: processingTimeMs,
              wasFAQ: false,
              isBlocked: false,
              _assistantMessageId: savedMessages?.assistantMessageId,
            }
          }
          
          if (pendingAction.type === "CONFIRM_ORDER") {
            // User confirmed checkout - delegate to checkout flow
            intentResult.intent = { type: "START_CHECKOUT" }
            logger.info("✅ [ChatEngine] CONFIRM_ORDER → START_CHECKOUT")
          }
        } else if (intentResult.intent.type === "CONFIRM") {
          // ========================================================================
          // 🆕 FSM-BASED CONFIRM HANDLING (replaces context guessing)
          // ========================================================================
          // Use FSM state to determine what CONFIRM means, not text parsing
          
          logger.info("🔄 [FSM] CONFIRM intent detected - checking FSM state", {
            fsmState: fsmState.state,
            pendingAction: fsmState.pendingAction?.type,
          })
          
          // 🎯 FSM Priority 1: Check if current state triggers checkout on CONFIRM
          if (this.conversationStateService.shouldConfirmTriggerCheckout(fsmState.state)) {
            logger.info("🔄 [FSM] State triggers checkout: CONFIRM → START_CHECKOUT", {
              state: fsmState.state,
            })
            intentResult.intent = { type: "START_CHECKOUT" }
            
            // Update FSM state to IN_CHECKOUT
            if (chatSession) {
              await this.conversationStateService.setState(
                chatSession.id,
                ConversationState.IN_CHECKOUT
              )
            }
          }
          // 🎯 FSM Priority 2: Check FSM pendingAction
          else if (fsmState.pendingAction?.type === "CONFIRM_ORDER") {
            logger.info("🔄 [FSM] PendingAction CONFIRM_ORDER → START_CHECKOUT")
            intentResult.intent = { type: "START_CHECKOUT" }
            
            if (chatSession) {
              await this.conversationStateService.setState(
                chatSession.id,
                ConversationState.IN_CHECKOUT
              )
            }
          }
          // 🎯 FSM Priority 3: Browsing products/categories → user wants to see them
          else if (fsmState.state === ConversationState.BROWSING_CATEGORIES ||
                   fsmState.state === ConversationState.BROWSING_PRODUCTS) {
            logger.info("🔄 [FSM] Browsing state: CONFIRM stays in current flow")
            // Don't change intent - let it fall through to show categories
            intentResult.intent = { type: "SHOW_CATEGORIES" }
          }
          // 🎯 FSM Priority 4: Viewing cart → CONFIRM means checkout
          else if (fsmState.state === ConversationState.VIEWING_CART) {
            logger.info("🔄 [FSM] Viewing cart: CONFIRM → START_CHECKOUT")
            intentResult.intent = { type: "START_CHECKOUT" }
            
            if (chatSession) {
              await this.conversationStateService.setState(
                chatSession.id,
                ConversationState.IN_CHECKOUT
              )
            }
          }
          // 🎯 FSM Fallback: Use listType from optionsMapping (no text matching!)
          else if (fsmState.state === ConversationState.IDLE) {
            // Use structured listType instead of text matching (language-agnostic)
            const optionsMapping = await this.optionsMappingService.loadMapping(
              input.workspaceId,
              conversationId
            )
            const lastListType = optionsMapping?.listType
            
            logger.info("🔄 [FSM] IDLE state - using listType from optionsMapping", {
              listType: lastListType,
              hasPendingAction: !!optionsMapping?.pendingAction,
            })
            
            // Map listType to intent (language-agnostic!)
            if (lastListType === "CART_ITEMS" || optionsMapping?.pendingAction?.type === "CHECKOUT") {
              intentResult.intent = { type: "START_CHECKOUT" }
            } else if (lastListType === "PRODUCTS" || lastListType === "CATEGORIES" || lastListType === "GROUPS") {
              intentResult.intent = { type: "SHOW_CATEGORIES" }
            } else if (lastListType === "ORDERS" || lastListType === "ORDER_ACTIONS") {
              intentResult.intent = { type: "VIEW_ORDERS" }
            } else {
              // Default fallback
              intentResult.intent = { type: "SHOW_CATEGORIES" }
            }
          }
          // 🎯 Default: Show categories
          else {
            logger.info("🔄 [FSM] Unknown state, defaulting to SHOW_CATEGORIES", {
              state: fsmState.state,
            })
            intentResult.intent = { type: "SHOW_CATEGORIES" }
          }
        }
      }

      // ========================================================================
      // STEP 2.5: Check if e-commerce intent is allowed
      // ========================================================================
      if (this.isEcommerceIntent(intentResult.intent.type) && !workspaceConfig.sellsProductsAndServices) {
        // E-commerce not enabled - redirect to support response
        logger.info("🚫 [ChatEngine] E-commerce disabled, redirecting to support", {
          intentType: intentResult.intent.type,
        })
        
        const processingTimeMs = Date.now() - startTime
        const supportMessage = this.getEcommerceDisabledMessage(input.customerLanguage || "it")
        
        return {
          message: supportMessage,
          agentType: AgentType.CUSTOMER_SUPPORT,
          wasHandled: true,
          intent: "ECOMMERCE_DISABLED",
          confidence: "HIGH",
          source: "PATTERN",
          processingTimeMs,
          debugInfo: {
            loadedDataType: "NONE",
            responseType: "ECOMMERCE_DISABLED",
            llmUsed: false,
          },
          response: supportMessage,
          agentUsed: AgentType.CUSTOMER_SUPPORT,
          tokensUsed: 0,
          executionTimeMs: processingTimeMs,
          wasFAQ: false,
          isBlocked: false,
        }
      }

      if (intentResult.intent.type === "REQUEST_HUMAN") {
        return await this.handleHumanSupportRequest({
          input,
          workspaceConfig,
          conversationId,
          debugSteps,
          totalTokens,
          startTime,
          requestIntent: intentResult.intent as RequestHumanIntent,
          intentConfidence: intentResult.confidence,
          intentSource: intentResult.source,
        })
      }

      if (intentResult.intent.type === "PRODUCT_CONTEXT") {
        const productContextHandled = await this.handleProductContextIntent({
          input,
          conversationId,
          history,
          chatSession,
          fsmState,
          workspaceConfig,
          startTime,
          debugSteps,
        })

        if (productContextHandled) {
          return productContextHandled
        }

        logger.warn("⚠️ [ChatEngine] PRODUCT_CONTEXT intent could not be handled, falling back to generic search", {
          workspaceId: input.workspaceId,
          customerId: input.customerId,
        })

        intentResult.intent = {
          type: "SEARCH_PRODUCTS",
          query: input.message,
        } as Intent
      }

      // ========================================================================
      // STEP 3: Handle CART intents with LLM intelligence
      // ========================================================================
      // 🆕 For ADD_TO_CART without productId, delegate to CartManagementAgentLLM
      // The LLM has the product catalog and can map "pecorini" → SKU
      if (intentResult.intent.type === "ADD_TO_CART") {
        const addIntent = intentResult.intent as AddToCartIntent
        if (!addIntent.productId && addIntent.productName) {
          logger.info("🛒 [ChatEngine] ADD_TO_CART needs LLM intelligence - delegating to CartManagementAgentLLM", {
            productName: addIntent.productName,
            quantity: addIntent.quantity,
          })
          
          const cartAgentLLM = new CartManagementAgentLLM(this.prisma)
          const cartResponse = await cartAgentLLM.handleQuery({
            workspaceId: input.workspaceId,
            customerId: input.customerId,
            customerName: input.customerName,
            customerLanguage: input.customerLanguage,
            customerDiscount: input.customerDiscount,
            query: input.message, // Original message with context
            conversationHistory: [], // Could add history if needed
          })
          
          const processingTimeMs = Date.now() - startTime
          
          // Save messages
          const savedMessages = await this.saveMessages(
            input.workspaceId,
            input.customerId,
            conversationId,  // 🔧 Use conversationId for consistent history
            input.message,
            cartResponse.output
          )
          
          // 🛒 CRITICAL: Save CART_ACTIONS mapping if cart was shown
          // Check if response contains cart options (the LLM shows cart after operations)
          if (cartResponse.output.includes("Cosa vuoi fare?") || 
              cartResponse.output.includes("Ecco il tuo carrello")) {
            const cartItemCount = this.extractCartItemCountFromFunctionCalls(cartResponse.functionCalls)
            const cartActions = await this.buildCartActionOptions((cartItemCount ?? 2) > 1, input.workspaceId)
            
            await this.optionsMappingService.saveMapping({
              workspaceId: input.workspaceId,
              conversationId,
              customerId: input.customerId,
              responseText: "",
              items: cartActions,
              listType: "CART_ACTIONS",
            })
            logger.info("🛒 [ChatEngine] Set CART_ACTIONS mapping after ADD_TO_CART (LLM fallback)", {
              cartItemCount,
              actions: cartActions.map((action) => action.id),
            })
          }
          
          return {
            message: cartResponse.output,
            agentType: AgentType.CART_MANAGEMENT,
            wasHandled: true,
            intent: "ADD_TO_CART",
            confidence: "HIGH",
            source: "LLM_FALLBACK",  // LLM-based cart agent
            processingTimeMs,
            debugInfo: {
              loadedDataType: "CART_LLM",
              responseType: "CART_OPERATION",
              llmUsed: true,
            },
            response: cartResponse.output,
            agentUsed: AgentType.CART_MANAGEMENT,
            tokensUsed: cartResponse.tokensUsed,
            executionTimeMs: processingTimeMs,
            wasFAQ: false,
            isBlocked: false,
            _assistantMessageId: savedMessages?.assistantMessageId,
          }
        }
      }

      // ========================================================================
      // 🔄 REPEAT_ORDER: Copy products from previous order to cart
      // ========================================================================
      if (intentResult.intent.type === "REPEAT_ORDER") {
        const repeatIntent = intentResult.intent as RepeatOrderIntent
        
        logger.info("🔄 [ChatEngine] REPEAT_ORDER intent detected", {
          orderCode: repeatIntent.orderCode || "(last order)",
        })

        // Find the order to repeat
        let orderToRepeat: any = null
        
        if (repeatIntent.orderCode) {
          // User specified an order code (e.g., "ripeti ordine ORD-12345")
          orderToRepeat = await this.prisma.orders.findFirst({
            where: {
              workspaceId: input.workspaceId,
              orderCode: repeatIntent.orderCode,
              customerId: input.customerId,
              deletedAt: null,
            },
            include: {
              items: {
                include: {
                  product: true,
                },
              },
            },
          })
        } else {
          // No order code - find the most recent completed order
          orderToRepeat = await this.prisma.orders.findFirst({
            where: {
              workspaceId: input.workspaceId,
              customerId: input.customerId,
              status: { in: ["DELIVERED", "SHIPPED", "CONFIRMED"] },
              deletedAt: null,
            },
            orderBy: { createdAt: "desc" },
            include: {
              items: {
                include: {
                  product: true,
                },
              },
            },
          })
        }

        if (!orderToRepeat) {
          const errorMessage = repeatIntent.orderCode
            ? `Non ho trovato l'ordine ${repeatIntent.orderCode}. Verifica il codice e riprova.`
            : "Non hai ancora ordini completati da ripetere."
          
          const processingTimeMs = Date.now() - startTime
          
          const savedMessages = await this.saveMessages(
            input.workspaceId,
            input.customerId,
            conversationId,  // 🔧 Use conversationId for consistent history
            input.message,
            errorMessage
          )
          
          return {
            message: errorMessage,
            agentType: AgentType.ORDER_TRACKING,
            wasHandled: true,
            intent: "REPEAT_ORDER",
            confidence: "HIGH",
            source: "PATTERN",
            processingTimeMs,
            debugInfo: {
              loadedDataType: "ORDER_NOT_FOUND",
              responseType: "ERROR",
              llmUsed: false,
            },
            response: errorMessage,
            agentUsed: AgentType.ORDER_TRACKING,
            tokensUsed: 0,
            executionTimeMs: processingTimeMs,
            wasFAQ: false,
            isBlocked: false,
            _assistantMessageId: savedMessages?.assistantMessageId,
          }
        }

        // Clear cart and add all items from the order
        const cart = await this.prisma.carts.upsert({
          where: {
            customerId: input.customerId,
          },
          update: {},
          create: {
            customerId: input.customerId,
            workspaceId: input.workspaceId,
          },
        })

        // Clear existing cart items
        await this.prisma.cartItems.deleteMany({
          where: {
            cartId: cart.id,
            cart: { workspaceId: input.workspaceId },
          },
        })

        // Add items from order to cart
        const addedItems: string[] = []
        const failedItems: string[] = []

        for (const orderItem of orderToRepeat.items) {
          if (!orderItem.product || !orderItem.product.isActive) {
            failedItems.push(orderItem.product?.name || "Prodotto non disponibile")
            continue
          }

          await this.prisma.cartItems.create({
            data: {
              cartId: cart.id,
              productId: orderItem.productId,
              quantity: orderItem.quantity,
            },
          })
          addedItems.push(`${orderItem.quantity}x ${orderItem.product.name}`)
        }

        // Build response message
        let responseMessage: string
        if (addedItems.length === 0) {
          responseMessage = `Mi dispiace, nessuno dei prodotti dell'ordine ${orderToRepeat.orderCode} è attualmente disponibile.`
        } else if (failedItems.length > 0) {
          responseMessage = `Ho aggiunto al carrello ${addedItems.length} prodotti dall'ordine ${orderToRepeat.orderCode}:\n` +
            addedItems.map(item => `• ${item}`).join("\n") +
            `\n\n⚠️ ${failedItems.length} prodotti non sono più disponibili:\n` +
            failedItems.map(item => `• ${item}`).join("\n") +
            `\n\nVuoi procedere al checkout o modificare il carrello?`
        } else {
          responseMessage = `Perfetto! Ho aggiunto al carrello tutti i ${addedItems.length} prodotti dall'ordine ${orderToRepeat.orderCode}:\n` +
            addedItems.map(item => `• ${item}`).join("\n") +
            `\n\nVuoi procedere al checkout?`
        }

        const processingTimeMs = Date.now() - startTime

        // Save messages
        const savedMessages = await this.saveMessages(
          input.workspaceId,
          input.customerId,
          conversationId,  // 🔧 Use conversationId for consistent history
          input.message,
          responseMessage
        )

        // Set pending action for checkout (VIEW_CART first to review)
        // 🔧 NOTE: conversationId is already defined with fallback at the top of processMessage
        await this.optionsMappingService.setPendingAction({
          workspaceId: input.workspaceId,
          conversationId,  // 🔧 Use consistent conversationId
          pendingAction: { type: "CONFIRM_ORDER" },
        })

        // 🆕 FSM: Set state to AWAITING_ORDER_CONFIRM after REPEAT_ORDER
        // This ensures next "conferma" triggers checkout, not cart view
        if (chatSession) {
          await this.conversationStateService.setState(
            chatSession.id,
            ConversationState.AWAITING_ORDER_CONFIRM,
            {
              pendingAction: { type: "CONFIRM_ORDER", orderCode: orderToRepeat.orderCode },
              selectedOrderCode: orderToRepeat.orderCode,
            }
          )
          logger.info("🔄 [FSM] State updated to AWAITING_ORDER_CONFIRM", {
            orderCode: orderToRepeat.orderCode,
          })
        }

        logger.info("🔄 [ChatEngine] REPEAT_ORDER completed", {
          orderCode: orderToRepeat.orderCode,
          addedItems: addedItems.length,
          failedItems: failedItems.length,
        })

        return {
          message: responseMessage,
          agentType: AgentType.CART_MANAGEMENT,
          wasHandled: true,
          intent: "REPEAT_ORDER",
          confidence: "HIGH",
          source: "PATTERN",
          processingTimeMs,
          debugInfo: {
            loadedDataType: "REPEAT_ORDER",
            responseType: "CART_UPDATED",
            llmUsed: false,
          },
          response: responseMessage,
          agentUsed: AgentType.CART_MANAGEMENT,
          tokensUsed: 0,
          executionTimeMs: processingTimeMs,
          wasFAQ: false,
          isBlocked: false,
          _assistantMessageId: savedMessages?.assistantMessageId,
        }
      }

      // ========================================================================
      // STEP 4: Load data based on intent (for non-LLM paths)
      // ========================================================================
      let loadedData: PipelineLoadedData | null = null
      let structuredResponseOverride: StructuredResponse | null = null

      if (this.shouldUseCatalogQuery(intentResult.intent)) {
        const catalogStart = Date.now()
        try {
          const catalogResult = await this.catalogQueryService.process({
            workspaceId: input.workspaceId,
            message: input.message,
            customerDiscount: input.customerDiscount || 0,
            intentType: intentResult.intent.type,
            customerLanguage: input.customerLanguage || "it",
          })

          loadedData = catalogResult.loadedData
          structuredResponseOverride = catalogResult.structuredResponse

          if (catalogResult.tokenUsage?.totalTokens) {
            totalTokens += catalogResult.tokenUsage.totalTokens
          }

          const catalogDuration = Date.now() - catalogStart
          const queryPreviewRaw = JSON.stringify(catalogResult.query)
          const queryPreview =
            queryPreviewRaw.length > 200
              ? `${queryPreviewRaw.substring(0, 200)}...`
              : queryPreviewRaw
          debugSteps.push({
            type: "sub_agent",
            agent: "🧱 Catalog QueryBuilder",
            model: catalogResult.model,
            timestamp: new Date().toISOString(),
            tokenUsage: catalogResult.tokenUsage
              ? {
                  promptTokens: catalogResult.tokenUsage.promptTokens || 0,
                  completionTokens: catalogResult.tokenUsage.completionTokens || 0,
                  totalTokens: catalogResult.tokenUsage.totalTokens || 0,
                }
              : undefined,
            input: {
              userMessage: input.message,
            },
            output: {
              decision: `CatalogQuery: ${queryPreview}`,
              executionTimeMs: catalogDuration,
            },
            duration: catalogDuration,
          })

          const executorSummary =
            catalogResult.resultType === "LIST"
              ? `Items: ${catalogResult.loadedData.products?.length || 0}`
              : catalogResult.resultType === "GROUPED"
                ? `Groups: ${catalogResult.loadedData.groups?.length || 0}`
                : catalogResult.resultType === "AGGREGATE"
                  ? `Value: ${catalogResult.structuredResponse.data.aggregateResult?.value}`
                  : "Empty result"

          debugSteps.push({
            type: "function_call",
            agent: "🧮 Catalog QueryExecutor",
            timestamp: new Date().toISOString(),
            output: {
              textContent: `Result: ${catalogResult.resultType} (${executorSummary})`,
              executionTimeMs: catalogDuration,
            },
            duration: catalogDuration,
          })

          logger.info("📦 [ChatEngine] Catalog query executed", {
            resultType: catalogResult.resultType,
          })
        } catch (error) {
          logger.error("❌ [ChatEngine] Catalog query processing failed", {
            error,
          })
        }
      }

      if (!loadedData) {
        const dataLoadStart = Date.now()
        loadedData = await this.dataLoader.loadForIntent(
          intentResult.intent,
          input.workspaceId,
          input.customerId,
          input.customerDiscount || 0
        )
        const dataLoadTime = Date.now() - dataLoadStart

        // 🆕 Add DataLoader debug step
        debugSteps.push({
          type: "sub_agent",
          agent: `📦 DataLoader (${loadedData.type})`,
          timestamp: new Date().toISOString(),
          input: {
            textContent: `Intent: ${intentResult.intent.type}`,
          },
          output: {
            textContent: `Loaded: ${loadedData.type}`,
            executionTimeMs: dataLoadTime,
          },
          duration: dataLoadTime,
        })
      }

      const finalLoadedData = loadedData!

      logger.info("📦 [ChatEngine] Data loaded", { type: finalLoadedData.type })

      // ========================================================================
      // STEP 4: Build structured response
      // ========================================================================
      
      // Check if workspace has Premium/Enterprise plan for optimization option
      let showOptimizeOption = false
      if (finalLoadedData.type === "CART") {
        try {
          const workspace = await this.prisma.workspace.findUnique({
            where: { id: input.workspaceId },
            select: { planType: true }
          })
          const eligiblePlan = workspace?.planType === 'PREMIUM' || workspace?.planType === 'ENTERPRISE'
          const transportTypes = finalLoadedData.cart?.transport
            ? Object.keys(finalLoadedData.cart.transport.byType || {})
            : []
          const hasMultipleTransports = transportTypes.length >= 2
          showOptimizeOption = eligiblePlan && hasMultipleTransports
        } catch (err) {
          logger.warn("⚠️ [ChatEngine] Could not check workspace plan type for optimization option", { error: err, workspaceId: input.workspaceId })
        }
      }
      
      const structuredResponse =
        structuredResponseOverride ??
        this.responseBuilder.build(intentResult.intent, finalLoadedData as LoadedData, {
          customerName: input.customerName,
          customerLanguage: input.customerLanguage || "it",
          workspaceId: input.workspaceId,
          customerDiscount: input.customerDiscount,
          showOptimizeOption,
        })

      logger.info("🏗️ [ChatEngine] Response built", { type: structuredResponse.type })

      // ========================================================================
      // STEP 5: Format with LLM (only formatting, no decisions)
      // ========================================================================
      const formatStart = Date.now()
      let finalMessage: string
      let llmUsed = false
      let groupMapping: Record<string, { nome: string; skus: string[] }> | undefined

      // Check response type for simple text vs needs LLM
      if (this.isSimpleResponseType(structuredResponse.type)) {
        // Use LLM formatter but with cached template
        const formatterResult = await this.formatWithCustomRules(
          structuredResponse,
          input.customerLanguage || "it",
          workspaceConfig
        )
        finalMessage = formatterResult.text
        llmUsed = !formatterResult.cached
        groupMapping = formatterResult.groupMapping
      } else {
        // Full LLM formatting for complex responses
        const formatterResult = await this.formatWithCustomRules(
          structuredResponse,
          input.customerLanguage || "it",
          workspaceConfig
        )
        finalMessage = formatterResult.text
        llmUsed = !formatterResult.cached
        groupMapping = formatterResult.groupMapping
      }
      const formatTime = Date.now() - formatStart

      // 🆕 Add LLM Formatter debug step
      const agentType = this.mapIntentToAgentType(intentResult.intent.type)
      debugSteps.push({
        type: "sub_agent",
        agent: `✨ ${agentType} (LLM Formatter)`,
        model: llmUsed ? "gpt-4o-mini" : undefined,
        timestamp: new Date().toISOString(),
        tokenUsage: llmUsed ? {
          promptTokens: 200,
          completionTokens: 150,
          totalTokens: 350,
        } : undefined,
        systemPrompt: llmUsed ? `Template: ${agentType.toLowerCase()}.template.md` : "Cached response (no LLM)",
        input: {
          textContent: `Structured response type: ${structuredResponse.type}`,
        },
        output: {
          textResponse: finalMessage.substring(0, 200) + (finalMessage.length > 200 ? "..." : ""),
          executionTimeMs: formatTime,
        },
        duration: formatTime,
      })
      if (llmUsed) {
        totalTokens += 350
      }

      // ========================================================================
      // STEP 6: Replace tokens/links
      // ========================================================================
      const replacementStart = Date.now()
      const replacementParams: ReplaceLinkWithTokenParams = {
        response: finalMessage,
        linkType: "auto",
      }
      const replacementResult = await this.linkReplacementService.replaceTokens(
        replacementParams,
        input.customerId,
        input.workspaceId
      )
      const replacementTime = Date.now() - replacementStart
      
      if (replacementResult.success && replacementResult.response) {
        finalMessage = replacementResult.response
        
        // 🆕 Add link replacement debug step (only if links were replaced)
        if (replacementResult.response !== finalMessage) {
          debugSteps.push({
            type: "link-replacement",
            agent: "🔗 Link Replacement",
            timestamp: new Date().toISOString(),
            input: {
              textContent: "Scanning for [LINK_*_WITH_TOKEN] placeholders",
            },
            output: {
              textContent: "Tokens replaced with secure URLs",
              executionTimeMs: replacementTime,
            },
            duration: replacementTime,
          })
        }
      }

      // ========================================================================
      // STEP 6.5: Save response WITH SKU tags for options mapping (before cleanup)
      // ========================================================================
      const responseWithSkus = finalMessage // Save before SKU removal

      // ========================================================================
      // STEP 6.6: Remove SKU tags (they're for system tracking, not customer-visible)
      // ========================================================================
      finalMessage = finalMessage
        .replace(/\s*\[SKU:[A-Z0-9-]+\]/gi, '')
        .replace(/\s*\[SKUS?:[A-Z0-9-,]+\]/gi, '')

      // ========================================================================
      // STEP 7: Determine agent type from intent
      // ========================================================================
      // agentType already defined above in STEP 5

      const processingTimeMs = Date.now() - startTime

      // 🆕 Add Save to History debug step
      debugSteps.push({
        type: "function_call",
        agent: "💾 Save to History",
        timestamp: new Date().toISOString(),
        input: {
          textContent: `Saving conversation for customer ${input.customerId}`,
        },
        output: {
          textContent: "✅ Messages saved to database",
        },
        duration: 10,
      })

      // 🆕 Add WhatsApp Queue debug step
      debugSteps.push({
        type: "function_call",
        agent: "📤 Add to WhatsApp Queue",
        timestamp: new Date().toISOString(),
        input: {
          textContent: `Message to send:\n\n${finalMessage.substring(0, 100)}...`,
        },
        output: {
          textContent: "✅ Message queued for WhatsApp delivery",
        },
        duration: 5,
      })

      // Calculate cost estimate (gpt-4o-mini pricing: $0.15/1M input, $0.60/1M output)
      const totalCost = (totalTokens * 0.0003) / 1000

      logger.info("✅ [ChatEngine] Processing complete", {
        intent: intentResult.intent.type,
        agentType,
        llmUsed,
        totalTimeMs: processingTimeMs,
        debugStepsCount: debugSteps.length,
        totalTokens,
      })

      // 🆕 Build debugInfo for timeline visualization
      const debugInfo = {
        loadedDataType: finalLoadedData.type,
        responseType: structuredResponse.type,
        llmUsed,
        steps: debugSteps,  // 🆕 Full timeline for Message Flow Dialog
        totalTokens,
        totalCost,
        executionTimeMs: processingTimeMs,
      }

      // ========================================================================
      // STEP 8: Save messages to conversation history (with debugInfo for timeline)
      // ========================================================================
      const savedMessages = await this.saveMessages(
        input.workspaceId,
        input.customerId,
        conversationId,  // 🔧 Use conversationId for consistent history
        input.message,
        finalMessage,
        agentType,
        totalTokens,
        debugInfo  // 🆕 Pass debugInfo for Message Flow Dialog
      )

      // Store the assistant message ID for later use (needed for translation update)
      const assistantMessageId = savedMessages?.assistantMessageId

      // ========================================================================
      // STEP 9: 🆕 Save options mapping for FAST-PATH on next message
      // Uses responseWithSkus to preserve SKU info for selection resolution
      // 🆕 Also passes groupMapping from LLM for smart grouping resolution
      // 🔧 CRITICAL: Pass items with SKUs for proper product selection!
      // 🔧 CART_VIEW/CART_UPDATED/ORDER_DETAIL have specific action mappings
      // ========================================================================
      
      // For CART_VIEW/CART_UPDATED: save CART_ACTIONS mapping
      if (structuredResponse.type === "CART_VIEW" || structuredResponse.type === "CART_UPDATED") {
        const cartItems = structuredResponse.data.items || []
        const cartActions = await this.buildCartActionOptions(cartItems.length > 1, input.workspaceId)
        
        await this.optionsMappingService.saveMapping({
          workspaceId: input.workspaceId,
          conversationId,
          customerId: input.customerId,
          responseText: "", // Empty - we're providing explicit items
          items: cartActions,
          listType: "CART_ACTIONS",
        })
        
        logger.info("🛒 [ChatEngine] STEP 9: Saved CART_ACTIONS mapping", {
          responseType: structuredResponse.type,
          cartItemCount: cartItems.length,
          conversationId,
          actions: cartActions.map((action) => action.id),
        })
      } 
      // For ORDER_DETAIL: save ORDER_ACTIONS mapping  
      else if (structuredResponse.type === "ORDER_DETAIL") {
        const order = structuredResponse.data.order
        const items = [
          { number: 1, name: "📄 Scarica fattura", id: "SEND_INVOICE", metadata: { orderCode: order?.code } },
          { number: 2, name: "🔄 Ripeti ordine", id: "REPEAT_ORDER", metadata: { orderCode: order?.code } },
        ]
        
        // Add credit note option if order has credit notes
        if (order?.hasCreditNotes) {
          items.push({ number: 3, name: "📋 Scarica nota di credito", id: "SEND_CREDIT_NOTES", metadata: { orderCode: order?.code } })
        }
        
        await this.optionsMappingService.saveMapping({
          workspaceId: input.workspaceId,
          conversationId,
          customerId: input.customerId,
          responseText: "",
          items,
          listType: "ORDER_ACTIONS",
          currentOrderCode: order?.code,
        })
        
        logger.info("📦 [ChatEngine] STEP 9: Saved ORDER_ACTIONS mapping", {
          responseType: structuredResponse.type,
          orderCode: order?.code,
          conversationId,
        })
      } else if (structuredResponse.type === "CART_EMPTY") {
        await this.optionsMappingService.saveMapping({
          workspaceId: input.workspaceId,
          conversationId,
          customerId: input.customerId,
          responseText: "",
          forceClear: true,
        })
        await this.optionsMappingService.setPendingAction({
          workspaceId: input.workspaceId,
          conversationId,
          pendingAction: { type: "SHOW_PRODUCTS" },
        })
      }
      // For other types: normal saveMapping
      else {
        // Extract items with SKUs from structuredResponse for proper mapping
        const itemsWithSkus = structuredResponse.data?.items?.map((item: any) => ({
          number: item.number,
          name: item.name,
          sku: item.sku,
          id: item.id,
        }))
        
        // Determine listType from response type
        const responseListType = structuredResponse.type === "PRODUCT_LIST" ? "PRODUCTS" 
                               : structuredResponse.type === "ORDER_LIST" ? "ORDERS"
                               : structuredResponse.type === "CATEGORY_LIST" ? "CATEGORIES"
                               : structuredResponse.type === "SERVICE_LIST" ? "SERVICES"
                               : structuredResponse.type === "OFFERS" ? "OFFER_CATEGORIES"  // 🆕 Offers with category selection
                               : undefined
        
        await this.optionsMappingService.saveMapping({
          workspaceId: input.workspaceId,
          conversationId,
          customerId: input.customerId,
          responseText: responseWithSkus, // Use response WITH SKUs for mapping
          groupMapping, // 🆕 Pass LLM-generated group mapping if available
          items: itemsWithSkus, // 🔧 Pass items with SKUs for reliable selection
          listType: responseListType, // 🔧 Pass list type for proper intent creation
        })

        // Log what we saved for debugging
        if (itemsWithSkus && itemsWithSkus.length > 0) {
          logger.info("📋 [ChatEngine] Saved items with SKUs for FAST-PATH", {
            conversationId,
            listType: responseListType,
            itemCount: itemsWithSkus.length,
            firstItem: { number: itemsWithSkus[0].number, name: itemsWithSkus[0].name?.substring(0, 20), sku: itemsWithSkus[0].sku },
          })
        }

        // Log if we saved a group mapping
        if (groupMapping) {
          logger.info("🗂️ [ChatEngine] Saved smart grouping mapping", {
            conversationId,
            groups: Object.keys(groupMapping),
            example: Object.entries(groupMapping)[0],
          })
        }
      } // End of shouldSkipSaveMapping else block

      // ========================================================================
      // STEP 9.5: 🛒 Set pending action for PRODUCT_DETAIL (add to cart prompt)
      // ========================================================================
      if (structuredResponse.type === "PRODUCT_DETAIL" && structuredResponse.data.product) {
        const product = structuredResponse.data.product
        await this.optionsMappingService.setPendingAction({
          workspaceId: input.workspaceId,
          conversationId,
          pendingAction: {
            type: "ADD_TO_CART",
            productId: product.sku || product.id, // 🔧 Use SKU for CartManagementAgent (prefers SKU)
            productName: product.name,
            quantity: 1,
          },
        })
        logger.info("🛒 [ChatEngine] Set pending ADD_TO_CART action", {
          productId: product.sku || product.id,
          productName: product.name,
        })
      }

      // ========================================================================
      // STEP 9.52: 🛒 Set pending action for SERVICE_DETAIL (add to cart prompt)
      // ========================================================================
      if (structuredResponse.type === "SERVICE_DETAIL" && structuredResponse.data.service) {
        const service = structuredResponse.data.service
        await this.optionsMappingService.setPendingAction({
          workspaceId: input.workspaceId,
          conversationId,
          pendingAction: {
            type: "ADD_TO_CART",
            productId: service.code || service.id, // For services, use code
            productName: service.name,
            quantity: 1,
            itemType: "SERVICE", // 🆕 Mark as service for CartManagementAgent
          },
        })
        logger.info("🛒 [ChatEngine] Set pending ADD_TO_CART action for service", {
          serviceId: service.code || service.id,
          serviceName: service.name,
        })
      }

      // ========================================================================
      // STEP 9.55: 📦 Set order actions for ORDER_DETAIL
      // ========================================================================
      if (structuredResponse.type === "ORDER_DETAIL" && structuredResponse.data.order) {
        const order = structuredResponse.data.order
        
        // Save order code
        await this.optionsMappingService.setCurrentOrderCode({
          workspaceId: input.workspaceId,
          conversationId,
          orderCode: order.code,
        })
        
        // 🆕 CRITICAL: Save explicit action options so "1" = Fattura, "2" = Ripeti
        await this.optionsMappingService.saveMapping({
          workspaceId: input.workspaceId,
          conversationId,
          customerId: input.customerId,
          responseText: "", // Empty - we're providing explicit items
          items: [
            { number: 1, name: "📄 Scarica fattura", id: "SEND_INVOICE", metadata: { orderCode: order.code } },
            { number: 2, name: "🔄 Ripeti ordine", id: "REPEAT_ORDER", metadata: { orderCode: order.code } },
          ],
          listType: "ORDER_ACTIONS",
        })
        
        logger.info("📦 [ChatEngine] Set order actions for ORDER_DETAIL", {
          orderCode: order.code,
          actions: ["SEND_INVOICE", "REPEAT_ORDER"],
        })
      }

      // ========================================================================
      // STEP 9.6: 🆕 FSM - Update conversation state based on response type
      // ========================================================================
      if (chatSession) {
        let newFsmState: ConversationState | null = null
        const fsmContext: Partial<StateContext> = {}
        
        switch (structuredResponse.type) {
          case "CATEGORY_LIST":
            newFsmState = ConversationState.BROWSING_CATEGORIES
            break
          case "PRODUCT_LIST":
          case "PRODUCT_GROUPED":
          case "PRODUCT_NEEDS_SMART_GROUPING":
            newFsmState = ConversationState.BROWSING_PRODUCTS
            break
          case "ORDER_LIST":
            newFsmState = ConversationState.BROWSING_ORDERS
            break
          case "PRODUCT_DETAIL":
            newFsmState = ConversationState.VIEWING_PRODUCT
            if (structuredResponse.data.product) {
              fsmContext.selectedProductId = structuredResponse.data.product.id
              fsmContext.selectedProductSku = structuredResponse.data.product.sku
              fsmContext.selectedProductName = structuredResponse.data.product.name
            }
            break
          case "ORDER_DETAIL":
            newFsmState = ConversationState.VIEWING_ORDER
            if (structuredResponse.data.order) {
              fsmContext.selectedOrderId = structuredResponse.data.order.id
              fsmContext.selectedOrderCode = structuredResponse.data.order.code
            }
            break
          case "CART_VIEW":
          case "CART_UPDATED":
            newFsmState = ConversationState.VIEWING_CART
            break
          case "CART_EMPTY":
            // 🔧 When cart is empty, go back to IDLE - next "sì" should NOT trigger checkout!
            newFsmState = ConversationState.IDLE
            break
        }
        
        if (newFsmState) {
          await this.conversationStateService.setState(chatSession.id, newFsmState, fsmContext)
          logger.info("🔄 [FSM] Normal flow state updated", {
            newState: newFsmState,
            responseType: structuredResponse.type,
          })
        }
      }

      return {
        // New fields
        message: finalMessage,
        agentType,
        wasHandled: true,
        intent: intentResult.intent.type,
        confidence: intentResult.confidence,
        source: intentResult.source,
        processingTimeMs,
        debugInfo: {
          ...debugInfo,
          steps: debugSteps,
          totalTokens,
        },
        // Legacy fields for webhook compatibility
        response: finalMessage,
        agentUsed: agentType,
        tokensUsed: totalTokens,
        executionTimeMs: processingTimeMs,
        wasFAQ: false,
        isBlocked: false,
        // 🆕 Store assistant message ID for translation layer
        _assistantMessageId: assistantMessageId,
      } as any
    } catch (error) {
      logger.error("❌ [ChatEngine] Error processing message", { error })
      const errorTimeMs = Date.now() - startTime

      return {
        // New fields
        message: "Mi scusi, si è verificato un errore. Può riprovare?",
        agentType: AgentType.ROUTER,
        wasHandled: false,
        intent: "ERROR",
        confidence: "LOW",
        source: "PATTERN",
        processingTimeMs: errorTimeMs,
        debugInfo: {
          loadedDataType: "ERROR",
          responseType: "ERROR",
          llmUsed: false,
          steps: debugSteps,  // 🆕 Include steps even on error
          totalTokens,
          totalCost: 0,
          executionTimeMs: errorTimeMs,
        },
        // Legacy fields
        response: "Mi scusi, si è verificato un errore. Può riprovare?",
        agentUsed: AgentType.ROUTER,
        tokensUsed: 0,
        executionTimeMs: errorTimeMs,
        wasFAQ: false,
        isBlocked: false,
      }
    }
  }

  /**
   * Check if response type can use cached template
   */
  private isSimpleResponseType(type: string): boolean {
    const simpleTypes = [
      "GREETING",
      "GOODBYE", 
      "THANKS",
      "HELP",
      "CART_EMPTY",
      "NO_RESULTS",
      "ERROR",
      "HUMAN_SUPPORT",
    ]
    return simpleTypes.includes(type)
  }

  /**
   * Map intent type to AgentType for logging/analytics
   */
  private mapIntentToAgentType(intentType: string): AgentType {
    const mapping: Record<string, AgentType> = {
      // Product search intents
      SHOW_CATEGORIES: AgentType.PRODUCT_SEARCH,
      SHOW_CATEGORY: AgentType.PRODUCT_SEARCH,
      SHOW_PRODUCTS: AgentType.PRODUCT_SEARCH,
      SHOW_PRODUCT: AgentType.PRODUCT_SEARCH,
      SEARCH_PRODUCTS: AgentType.PRODUCT_SEARCH,
      SHOW_OFFERS: AgentType.PRODUCT_SEARCH,
      SHOW_NEW_ARRIVALS: AgentType.PRODUCT_SEARCH,
      PRODUCT_CONTEXT: AgentType.PRODUCT_SEARCH,

      // Service intents
      VIEW_SERVICES: AgentType.PRODUCT_SEARCH,
      SHOW_SERVICE: AgentType.PRODUCT_SEARCH,

      // Cart intents
      VIEW_CART: AgentType.CART_MANAGEMENT,
      ADD_TO_CART: AgentType.CART_MANAGEMENT,
      REMOVE_FROM_CART: AgentType.CART_MANAGEMENT,
      UPDATE_CART_QUANTITY: AgentType.CART_MANAGEMENT,
      CLEAR_CART: AgentType.CART_MANAGEMENT,
      CHECKOUT: AgentType.CART_MANAGEMENT,
      START_CHECKOUT: AgentType.CART_MANAGEMENT,  // Same as CHECKOUT

      // Order intents
      VIEW_ORDERS: AgentType.ORDER_TRACKING,
      ORDER_DETAILS: AgentType.ORDER_TRACKING,
      TRACK_ORDER: AgentType.ORDER_TRACKING,
      REPEAT_ORDER: AgentType.CART_MANAGEMENT,  // Adds previous order items to cart

      // Support intents
      ASK_IDENTITY: AgentType.CUSTOMER_SUPPORT,
      ASK_LOCATION: AgentType.CUSTOMER_SUPPORT,
      ASK_CONTACT: AgentType.CUSTOMER_SUPPORT,
      REQUEST_HUMAN: AgentType.CUSTOMER_SUPPORT,
      ASK_HOURS: AgentType.CUSTOMER_SUPPORT,
      ASK_SHIPPING: AgentType.CUSTOMER_SUPPORT,
      ASK_PAYMENT: AgentType.CUSTOMER_SUPPORT,
      ASK_HELP: AgentType.CUSTOMER_SUPPORT,

      // Greeting intents
      GREETING: AgentType.ROUTER,
      GOODBYE: AgentType.ROUTER,
      THANKS: AgentType.ROUTER,

      // Selection intent
      SELECT_OPTION: AgentType.ROUTER,
    }

    return mapping[intentType] || AgentType.ROUTER
  }

  /**
   * Get message when e-commerce is disabled
   */
  private getEcommerceDisabledMessage(language: string): string {
    // NOTE: Do not hardcode translations here; translation layer handles localization.
    return "Sorry, we don't handle online sales at the moment. I can help you with information or support. How can I assist you?"
  }

  /**
   * Execute order action (calling functions for invoice, repeat order, credit notes)
   * @see Feature 202 - Order Selection & Invoice Actions
   */
  private async executeOrderAction(
    action: string,
    orderCode: string,
    workspaceId: string,
    customerId: string,
    conversationId: string
  ): Promise<{ message: string; success: boolean }> {
    logger.info("📦 [executeOrderAction] Executing order action", {
      action,
      orderCode,
      workspaceId,
      customerId,
      conversationId,
    })

    try {
      switch (action) {
        case "SEND_INVOICE": {
          // Import and call sendInvoice calling function
          const { sendInvoice } = await import("../../domain/calling-functions/sendInvoice")
          const result = await sendInvoice({
            customerId,
            workspaceId,
            orderId: orderCode,  // sendInvoice accepts orderCode or orderId
          })
          return {
            message: result.message || "Invoice sent successfully!",
            success: result.success,
          }
        }

        case "REPEAT_ORDER": {
          // Import and call repeatOrder calling function
          const { repeatOrder } = await import("../../domain/calling-functions/repeatOrder")
          const result = await repeatOrder({
            customerId,
            workspaceId,
            orderCode,
          })
          
          // Handle stock unavailability (ABORT message per spec)
          if (!result.success && result.error?.includes("stock")) {
            return {
              message: "Sorry, the order can't be repeated because one or more items are out of stock. Do you want me to help you find a similar product?",
              success: false,
            }
          }
          
          return {
            message: result.message,
            success: result.success,
          }
        }

        case "SEND_CREDIT_NOTES": {
          // Get credit notes for this order
          const creditNotes = await this.prisma.creditNote.findMany({
            where: {
              order: {
                orderCode,
                workspaceId,
                customerId,
              },
            },
            include: {
              order: true,
            },
          })

          if (creditNotes.length === 0) {
            return {
              message: "There are no credit notes available for this order.",
              success: false,
            }
          }

          // Format credit notes list for download
          // Per spec: naming is {orderCode}_notadicredito{N}.pdf
          const notesList = creditNotes.map((cn, index) => {
            const fileName = `${orderCode}_notadicredito${index + 1}.pdf`
            return `📋 ${fileName} - €${cn.amount.toFixed(2)}`
          }).join("\n")

          return {
            message: `I found ${creditNotes.length} credit note(s) for order ${orderCode}:\n\n${notesList}\n\nI emailed the credit notes to you.`,
            success: true,
          }
        }

        case "ADD_ORDER_NOTE": {
          if (!orderCode) {
            return {
              message: "Non ho trovato il codice ordine da aggiornare. Puoi ripetere quale ordine vuoi modificare?",
              success: false,
            }
          }

          await this.optionsMappingService.setPendingAction({
            workspaceId,
            conversationId,
            pendingAction: {
              type: "ADD_ORDER_NOTE",
              orderCode,
            },
          })

          return {
            message: `Perfetto! Scrivi la nota che vuoi aggiungere all'ordine **${orderCode}**.`,
            success: true,
          }
        }

        default:
          logger.warn("⚠️ [executeOrderAction] Unknown action", { action })
          return {
            message: "Sorry, I didn't understand which action you want to run. Can you try again?",
            success: false,
          }
      }
    } catch (error) {
      logger.error("❌ [executeOrderAction] Error executing action", { 
        error, 
        action, 
        orderCode 
      })
      return {
        message: "Sorry, something went wrong. Please try again later or contact support.",
        success: false,
      }
    }
  }

  /**
   * Save messages to conversation history
   * 🆕 Now includes debugInfo for Message Flow Dialog timeline
   * 🆕 Returns assistant message ID for potential translation updates
   */
  private async saveMessages(
    workspaceId: string,
    customerId: string,
    conversationId: string,
    userMessage: string,
    assistantMessage: string,
    agentType?: string,
    tokensUsed?: number,
    debugInfo?: any
  ): Promise<{ assistantMessageId?: string }> {
    try {
      // Save user message
      await this.conversationManager.saveUserMessage({
        workspaceId,
        customerId,
        conversationId,
        content: userMessage,
      })
      
      // 🆕 Create minimal debugInfo if not provided (for FAST-PATH responses)
      const finalDebugInfo = debugInfo || {
        loadedDataType: "FAST_PATH",
        responseType: "FAST_PATH",
        llmUsed: false,
        steps: [{
          type: "router",
          agent: "⚡ Fast Path",
          timestamp: new Date().toISOString(),
          input: { textContent: userMessage.substring(0, 100) },
          output: { textContent: "Response generated via optimized path" },
          duration: 0,
        }],
        totalTokens: tokensUsed || 0,
        totalCost: 0,
        executionTimeMs: 0,
      }
      
      // Save assistant response with debugInfo for timeline
      const assistantMessageId = await this.conversationManager.saveAssistantMessage({
        workspaceId,
        customerId,
        conversationId,
        content: assistantMessage,
        agentType,
        tokensUsed,
        debugInfo: finalDebugInfo,  // 🆕 Always have debugInfo for Message Flow Dialog
      })
      
      logger.debug("💾 [ChatEngine] Messages saved to history", { 
        hasDebugInfo: true,
        debugStepsCount: finalDebugInfo?.steps?.length || 0,
        wasFastPath: !debugInfo,
        assistantMessageId,
      })
      
      // Return the assistant message ID
      return { assistantMessageId }
    } catch (error) {
      // Don't fail the request if saving fails
      logger.error("❌ [ChatEngine] Failed to save messages", { error })
      return {}
    }
  }

  // ================================================================================
}

// ================================================================================
// SINGLETON
// ================================================================================

let chatEngineInstance: ChatEngineService | null = null

export function getChatEngine(prisma: PrismaClient): ChatEngineService {
  if (!chatEngineInstance) {
    chatEngineInstance = new ChatEngineService(prisma)
  }
  return chatEngineInstance
}
