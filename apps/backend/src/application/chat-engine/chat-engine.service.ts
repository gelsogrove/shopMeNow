/**
 * Chat Engine Service - Main Orchestrator
 *
 * CORE PRINCIPLE: "Codice decide, LLM formatta"
 * 
 * This is the heart of the chatbot - it processes incoming messages
 * through a pipeline: Intent → Data → Response → Format → Deliver
 */

import { PrismaClient, AgentType } from "@echatbot/database"
import {
  DEFAULT_ROUNDING_STEP,
  formatRoundedCurrency,
} from "@shared/pricing"
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
import { TranslationAgent } from "../agents/TranslationAgent"
import { SecurityAgent } from "../agents/SecurityAgent"
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
import { CatalogQueryService, CatalogQueryLoadedData } from "../catalog-query/catalog-query.service"
import { confirmOrder } from "../../domain/calling-functions/confirmOrder"
import { LLMRouterService } from "../../services/llm-router.service"
import { getUnifiedChatRouter, UnifiedChatRouter } from "../services/unified-chat-router.service"
import { UnifiedRoutingService } from "../services/unified-routing.service"
import { SimpleIntentHandler, LLMIntentHandler } from "./handlers"
import { CacheService } from "../services/cache.service"
import { MessagePersistenceService } from "./message-persistence.service"
import {
  WorkspaceConfig,
  DebugStep,
  ChatEngineInput,
  ChatEngineOutput,
} from "./chat-engine.types"

// Re-export types for external consumers
export { ChatEngineInput, ChatEngineOutput, DebugStep, WorkspaceConfig } from "./chat-engine.types"

type PipelineLoadedData = LoadedData | CatalogQueryLoadedData

// ================================================================================
// WORKSPACE CONFIG CACHE
// ================================================================================

const workspaceConfigCache = new Map<string, { config: WorkspaceConfig; timestamp: number }>()
const CONFIG_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/** Invalidate cached workspace config — call after workspace settings are updated */
export function invalidateWorkspaceConfig(workspaceId: string): void {
  workspaceConfigCache.delete(workspaceId)
}

const formatCartPrice = (value?: number | null) =>
  formatRoundedCurrency(value ?? 0, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useSmartRound: true,
    step: DEFAULT_ROUNDING_STEP,
  })

// ================================================================================
// CUSTOMER-LEVEL LOCKS (Concurrency Safety - Principle VI)
// ================================================================================

const customerProcessingLocks = new Map<string, Promise<void>>()

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
  // Widget Security Layer (applied after translation for widget channel)
  private securityAgent: SecurityAgent
  
  // 🆕 NEW: Routing orchestration services
  private welcomeMessageHandler: any // WelcomeMessageHandler
  private routerOrchestration: any // RouterOrchestrationService
  
  // 🆕 NEW: Unified routing with handlers (PHASE 4)
  private unifiedRoutingService: UnifiedRoutingService
  private simpleIntentHandler: SimpleIntentHandler
  private llmIntentHandler: LLMIntentHandler
  private cacheService: CacheService
  private messagePersistence: MessagePersistenceService

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
    this.securityAgent = new SecurityAgent(prisma)
    
    // 🆕 NEW: Initialize routing orchestration
    const { WelcomeMessageHandler } = require("../../utils/welcome-message.handler")
    const { RouterOrchestrationService } = require("../../services/router-orchestration.service")
    this.welcomeMessageHandler = new WelcomeMessageHandler(prisma)
    this.routerOrchestration = new RouterOrchestrationService(prisma)
    
    // 🆕 NEW: Initialize unified routing services (PHASE 4)
    this.cacheService = new CacheService()
    this.unifiedRoutingService = new UnifiedRoutingService(prisma, this.intentParser, this.cacheService)
    this.simpleIntentHandler = new SimpleIntentHandler()
    this.llmIntentHandler = new LLMIntentHandler(this.llmRouterService)
    this.messagePersistence = new MessagePersistenceService(prisma)
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

  private async isCustomerBlacklisted(
    customerId: string,
    workspaceId: string
  ): Promise<boolean> {
    const customer = await this.prisma.customers.findFirst({
      where: { id: customerId, workspaceId },
      select: { isBlacklisted: true },
    })

    return Boolean(customer?.isBlacklisted)
  }

  private getHumanSupportTemplate(
    workspaceConfig: WorkspaceConfig,
    options?: { reason?: string }
  ): string {
    const hasSupport = workspaceConfig.hasHumanSupport
    if (!hasSupport) {
      if (workspaceConfig.humanSupportInstructions?.trim()) {
        return workspaceConfig.humanSupportInstructions.trim()
      }
      return `Ciao {{nameUser}}, manda una email a {{adminEmail}} con i dettagli e ti risponderemo il prima possibile.`
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
    return Boolean(reason?.trim())
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
        input.customerDiscount || 0,
        false // FAQ doesn't need price visibility check
      )

      if (loadedData.type !== "FAQ" || !loadedData.faqs?.length) {
        return null
      }

      const structuredResponse = this.responseBuilder.build(faqIntent, loadedData, {
        workspaceId: input.workspaceId,
        customerLanguage: input.customerLanguage || "en",
        customerName: input.customerName,
        customerDiscount: input.customerDiscount,
        userMessage: input.message,
        enableCategoryRanking: workspaceConfig.channelMode === "ECOMMERCE",
      })

      if (structuredResponse.type !== "FAQ") {
        return null
      }

      const formatterResult = await this.formatWithCustomRules(
        structuredResponse,
        input.customerLanguage || "en",
        workspaceConfig,
        undefined,
        { customerName: input.customerName }
      )

      let finalMessage = formatterResult.text
      const formatterTokens = formatterResult.tokensUsed || 0

      // 🔗 TASK17: Replace token placeholders with secure links
      const messageBeforeReplacement = finalMessage
      const replacementResult = await this.linkReplacementService.replaceTokens(
        { response: finalMessage, linkType: "auto" },
        input.customerId,
        input.workspaceId
      )
      if (replacementResult.success && replacementResult.response) {
        finalMessage = replacementResult.response
        
        // 🔗 TASK17 FIX: Add debug step when tokens are replaced
        if (messageBeforeReplacement !== finalMessage) {
          debugSteps.push({
            type: "link-replacement",
            agent: "🔗 Link Replacement",
            timestamp: new Date().toISOString(),
            input: {
              textContent: "Scanning for [LINK_*_WITH_TOKEN] placeholders",
            },
            output: {
              textContent: "Tokens replaced with secure URLs",
            },
          })
        }
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

      const savedMessages = await this.messagePersistence.saveMessages(
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

    let finalMessage = this.applyHumanSupportPlaceholders(template, {
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
          channel: input.channel || "whatsapp",
        })

        // 🔧 FIX: Use the message returned by contactOperator (with variables replaced)
        if (contactResult.success && contactResult.message) {
          finalMessage = contactResult.message
          logger.info("✅ [ChatEngine] Using contactOperator message with variables replaced", {
            messageLength: finalMessage.length,
            hasNameUser: finalMessage.includes(customer?.name || ""),
          })
        }

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

    // 🌍 TRANSLATION LAYER: Translate escalation message to customer language
    let translationTokens = 0
    if (finalMessage && input.customerLanguage) {
      try {
        const translationResult = await this.applyTranslation(
          finalMessage,
          input.workspaceId,
          input.customerLanguage,
          debugSteps,
          input.customerName
        )
        finalMessage = translationResult.message
        translationTokens = translationResult.tokensUsed
        logger.info("✅ [ChatEngine] Escalation message translated", {
          targetLanguage: input.customerLanguage,
          tokensUsed: translationResult.tokensUsed,
        })
      } catch (translationError) {
        logger.error("❌ [ChatEngine] Translation failed for escalation message", {
          error: translationError,
        })
        // Continue with untranslated message
      }
    }

    const processingTimeMs = Date.now() - startTime

    const debugInfo = {
      loadedDataType: "HUMAN_SUPPORT",
      responseType: "HUMAN_SUPPORT",
      llmUsed: false,
      steps: debugSteps,
      totalTokens: totalTokens + translationTokens,
      totalCost: ((totalTokens + translationTokens) * 0.0003) / 1000,
      executionTimeMs: processingTimeMs,
    }

    const savedMessages = await this.messagePersistence.saveMessages(
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
   * Helper: formatta con LLM includendo customAiRules e botIdentity dal workspace
   */
  private async formatWithCustomRules(
    structuredResponse: StructuredResponse,
    language: string,
    workspaceConfig: WorkspaceConfig,
    conversationHistory?: Array<{ role: string; content: string }>,
    personalizationOptions?: {
      customerName?: string
      isFirstMessage?: boolean
    }
  ): Promise<FormatterResult> {
    return this.llmFormatter.format(
      structuredResponse,
      language,
      conversationHistory,
      { 
        customAiRules: workspaceConfig.customAiRules,
        botIdentity: workspaceConfig.botIdentity,
        botName: workspaceConfig.name,
        chatbotName: workspaceConfig.chatbotName,      // 🆕 Custom chatbot name
        businessType: workspaceConfig.businessType,    // 🆕 Business sector
        customerName: personalizationOptions?.customerName,
        isFirstMessage: personalizationOptions?.isFirstMessage,
      }
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
    
    logger.info("🌍 [applyTranslation] Called", {
      messageLength: message.length,
      messagePreview: message.substring(0, 80),
      targetLanguage,
      workspaceId: workspaceId.substring(0, 8),
    })
    
    try {
      // Call TranslationAgent to translate message
      const result = await this.translationAgent.process({
        workspaceId,
        message,
        targetLanguage: targetLanguage || "en",
        customerName,
      })
      
      const executionTimeMs = Date.now() - startTime
      
      logger.info("🌍 [applyTranslation] TranslationAgent result", {
        translated: result.translated,
        tokensUsed: result.tokensUsed,
        outputPreview: result.message.substring(0, 80),
      })
      
      // Add debug step for Message Flow Timeline
      this.pushTranslationDebugStep(debugSteps, {
        model: result.model || "gpt-4o-mini",
        inputMessage: message,
        outputMessage: result.message,
        targetLanguage: targetLanguage || "en",
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
        targetLanguage: targetLanguage || "en",
        translated: false,
        tokensUsed: 0,
        executionTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      })
      
      return { message, tokensUsed: 0 }
    }
  }

  /**
   * Deterministically append registration reminder (bypasses LLM obedience).
   * Avoids duplicates if the placeholder is already present.
   * Uses customerLanguage to provide the reminder in the correct language.
   */
  private appendRegistrationReminder(
    message: string,
    registrationPromptLevel?: number,
    debugSteps?: DebugStep[],
    customerLanguage?: string
  ): string {
    if (!registrationPromptLevel || registrationPromptLevel <= 0) {
      return message
    }

    const lang = (customerLanguage || "it").toLowerCase().split("-")[0]
    const REMINDER_BY_LANG: Record<string, string> = {
      it: "Se vuoi ricevere le nostre offerte o notizie registrati a questo link [LINK_REGISTRATION].",
      en: "To receive our offers and news, register at this link [LINK_REGISTRATION].",
      es: "Para recibir nuestras ofertas y novedades, regístrate en este enlace [LINK_REGISTRATION].",
      pt: "Para receber nossas ofertas e novidades, registre-se neste link [LINK_REGISTRATION].",
    }
    const reminder = REMINDER_BY_LANG[lang] ?? REMINDER_BY_LANG["en"]

    // 🐛 FIX: Check if reminder already present (prevents double-append on race conditions)
    // Only check for the specific placeholder — generic words like "registrati"/"register"
    // cause false positives when LLM naturally mentions registration in responses
    if (message.includes("[LINK_REGISTRATION]")) {
      return message
    }

    const updated = `${message.trim()}\n\n${reminder}`

    if (debugSteps) {
      debugSteps.push({
        type: "token-replacement",
        agent: "RegistrationReminder",
        timestamp: new Date().toISOString(),
        input: { textContent: message.substring(0, 120) },
        output: { textContent: reminder },
      })
    }

    return updated
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
        customerLanguage: input.customerLanguage || "en",
        message: prompt,
        conversationHistory: history,
        customerDiscount: input.customerDiscount || 0,
        conversationId,
        messageId: `${conversationId}-fallback-${Date.now()}`,
        registrationPromptLevel: input.registrationPromptLevel,
        skipTranslation: true, // ChatEngine wrapper handles translation + security
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

  private async buildCartActionOptions(hasRemovableItems: boolean, workspaceId?: string, uniqueTransportModes: number = 0) {
    const options: Array<{ number: number; name: string; id: string }> = []
    let nextNumber = 1
    options.push({ number: nextNumber++, name: "Conferma ordine", id: "CONFIRM_ORDER" })
    options.push({ number: nextNumber++, name: "Esplorare il catalogo", id: "SHOW_PRODUCTS" })
    options.push({ number: nextNumber++, name: "Mostra servizi", id: "SHOW_SERVICES" })
    options.push({ number: nextNumber++, name: "Guardare le offerte", id: "SHOW_OFFERS" })
    if (hasRemovableItems) {
      options.push({ number: nextNumber++, name: "Rimuovere un articolo", id: "REMOVE_FROM_CART" })
    }
    options.push({ number: nextNumber++, name: "Cancella il carrello", id: "CLEAR_CART" })
    
    // TODO: "Ottimizza spedizione" feature - will be implemented later
    // Option: Order optimization (show only when 2+ different transport modes exist)
    // if (uniqueTransportModes >= 2) {
    //   options.push({ number: nextNumber++, name: "Ottimizza spedizione", id: "OPTIMIZE_TRANSPORT" })
    // }
    
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

  /**
   * Count unique transport modes from cart data
   * Returns 0 if no transport info available
   */
  private countUniqueTransportModes(cartData: any): number {
    const transport = cartData?.cart?.transport || cartData?.transport
    if (!transport?.byType) return 0
    return Object.keys(transport.byType).length
  }

  /**
   * Extract unique transport modes count from function calls (for LLM responses)
   */
  private extractTransportModesFromFunctionCalls(functionCalls?: Array<{ result?: any }>): number {
    if (!functionCalls?.length) return 0
    for (let idx = functionCalls.length - 1; idx >= 0; idx--) {
      const cartData = functionCalls[idx]?.result?.cartData
      if (cartData) {
        return this.countUniqueTransportModes(cartData)
      }
    }
    return 0
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
        productCategories: {
          include: { category: { select: { name: true } } },
        },
        productCertifications: {
          include: { certification: true },
        },
        productTypes: {
          include: { type: true },
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

    const type =
      productRecord.productTypes?.[0]?.type?.name ||
      productRecord.type ||
      null

    const categoryName = productRecord.productCategories?.[0]?.category?.name

    const productData: ProductContextData = {
      id: productRecord.id,
      name: productRecord.name,
      description: productRecord.description,
      format: productRecord.formato,
      price: Number(productRecord.price),
      region: productRecord.region,
      certifications: Array.from(certifications),
      type,
      tags: [categoryName, productRecord.region].filter(Boolean) as string[],
      storageInfo: null,
      pairingSuggestions: undefined,
      ingredients: [],
      allergens: productRecord.allergens || [],
      imageUrl: Array.isArray(productRecord.imageUrl) ? productRecord.imageUrl[0] : productRecord.imageUrl,
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
        channelMode: workspaceConfig.channelMode,
        address: workspaceConfig.address,
      },
      conversationHistory,
    })

    // If ProductContextAgent failed, return null to trigger FAQ fallback
    if (!agentResponse.success) {
      logger.warn("⚠️ [ChatEngine] ProductContextAgent failed, will try FAQ fallback", {
        workspaceId: input.workspaceId,
        productId: productData.id,
        question: input.message,
      })
      return null
    }

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

    const savedMessages = await this.messagePersistence.saveMessages(
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
      type: "safety",
      agent: "Translation Layer",
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
        decision: data.translated ? "translated" : "passthrough",
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
        channelMode: true,
        hasSalesAgents: true,
        hasHumanSupport: true,
        humanSupportInstructions: true,
        operatorContactMethod: true,
        welcomeMessage: true,
        botIdentityResponse: true,
        customAiRules: true,  // Custom AI rules that override default behavior
        notificationEmail: true,
        address: true,
        catalogBaseLanguage: true,
      },
    })

    const config: WorkspaceConfig = {
      name: workspace?.name || "Assistente",
      channelMode: workspace?.channelMode ?? "ECOMMERCE",
      hasSalesAgents: workspace?.hasSalesAgents ?? false,
       hasHumanSupport: workspace?.hasHumanSupport ?? false,
       humanSupportInstructions: workspace?.humanSupportInstructions ?? null,
       operatorContactMethod: workspace?.operatorContactMethod ?? null,
      welcomeMessage: workspace?.welcomeMessage,
      botIdentityResponse: workspace?.botIdentityResponse ?? null,
      botIdentity: workspace?.botIdentityResponse ?? null,  // Alias for LLMFormatter
      customAiRules: workspace?.customAiRules ?? null,
      adminEmail: workspace?.notificationEmail || null,
      workspaceName: workspace?.name || "Il nostro shop",
      address: workspace?.address || null,
      catalogBaseLanguage: workspace?.catalogBaseLanguage || null,
    }

    workspaceConfigCache.set(workspaceId, { config, timestamp: Date.now() })
    return config
  }

  /**
   * Check if intent is e-commerce related (requires channelMode=ECOMMERCE)
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

  /**
   * Check if intent should go to UnifiedChatRouter for informational workspaces
   * These intents should ALWAYS use FAQ when available
   */
  private isInformationalIntent(intentType: string): boolean {
    const informationalIntents = [
      "GENERAL_QUESTION",
      "COMPANY_INFO", 
      "CONTACT_INFO",
      "BUSINESS_HOURS",
      "LOCATION",
      "SERVICES_INFO",
      "VIEW_SERVICES",
      "SHOW_SERVICE",
      "PRODUCT_INFO",
      "FAQ",
      "HELP",
      "GREETING", // Sometimes contains product questions
      "ASK_BUSINESS_INFO",
      // 🚫 UPDATE_PROFILE and CHANGE_LANGUAGE must NOT be here
      // They have dedicated handlers (STEP 2.20+) that must run before strategy routing
    ]

    return informationalIntents.includes(intentType)
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
    const normalized = language?.trim?.().toLowerCase?.().split(/[-_]/)[0] || "en"
    
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
    
    return mapping[normalized] || "en"  // Default to English if unknown
  }

  /**
   * Resolve a requested language string (from intent parser) to ISO 639-1 code.
   * Handles both codes ("it") and natural language names ("italiano", "Italian", "inglese").
   * Returns null if the string cannot be resolved to a supported language.
   */
  private resolveLanguageCode(input: string): string | null {
    if (!input) return null
    const normalized = input.trim().toLowerCase()
    
    const mapping: Record<string, string> = {
      // ISO codes
      it: "it", en: "en", es: "es", pt: "pt",
      // Italian names
      italiano: "it", inglese: "en", spagnolo: "es", portoghese: "pt",
      // English names
      italian: "it", english: "en", spanish: "es", portuguese: "pt",
      // Spanish names
      "español": "es", "espanol": "es", "inglés": "en", "portugués": "pt",
      // Portuguese names
      "português": "pt", "espanhol": "es", "inglês": "en",
      // Common variants
      "ingles": "en", "portugues": "pt",
    }
    
    return mapping[normalized] || null
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
   * 3. Widget Security Layer applies only for widget channel (after translation)
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
    const startTime = Date.now()
    // 🔒 CONCURRENCY LOCK: Ensure sequential processing per customer
    const lockKey = `customer:${input.customerId}`

    let releaseLock: (() => void) | null = null

    try {
      // Wait for any existing lock to release
      while (customerProcessingLocks.has(lockKey)) {
        logger.info(`🔒 [ChatEngine] Waiting for lock: ${lockKey}`)
        try {
          await customerProcessingLocks.get(lockKey)
        } catch (lockError) {
          // 🐛 FIX: If previous lock promise rejected, remove stale lock
          logger.warn(`⚠️ [ChatEngine] Lock promise rejected, cleaning up`, { lockKey, error: lockError })
          customerProcessingLocks.delete(lockKey)
        }
      }

      // Create and set our lock
      const lockPromise = new Promise<void>((resolve) => {
        releaseLock = resolve
      })
      customerProcessingLocks.set(lockKey, lockPromise)

      logger.info(`🔒 [ChatEngine] Lock acquired: ${lockKey}`)
    } catch (lockError) {
      logger.error(`🚫 [ChatEngine] Failed to acquire lock`, { lockKey, error: lockError })
      const processingTimeMs = Date.now() - startTime
      return {
        message: "System temporarily unavailable. Please try again.",
        agentType: AgentType.ROUTER,
        wasHandled: false,
        intent: "ERROR",
        confidence: "HIGH",
        source: "PATTERN",
        processingTimeMs,
        debugInfo: {
          steps: [],
          blockReason: "LOCK_ACQUISITION_FAILED",
          executionTimeMs: processingTimeMs,
        },
        response: "",
        agentUsed: AgentType.ROUTER,
        tokensUsed: 0,
        executionTimeMs: processingTimeMs,
        wasFAQ: false,
        isBlocked: true,
      }
    }

    try {
      const isBlockedCustomer = await this.isCustomerBlacklisted(
        input.customerId,
        input.workspaceId
      )

      if (isBlockedCustomer) {
        const processingTimeMs = Date.now() - startTime
        logger.warn("🚫 [ChatEngine] Blocked customer - skipping processing", {
          customerId: input.customerId,
          workspaceId: input.workspaceId,
        })

        return {
          message: "",
          agentType: AgentType.ROUTER,
          wasHandled: false,
          intent: "BLOCKED",
          confidence: "HIGH",
          source: "PATTERN",
          processingTimeMs,
          debugInfo: {
            steps: [],
            blockReason: "CUSTOMER_BLACKLISTED",
            executionTimeMs: processingTimeMs,
          },
          response: "",
          agentUsed: AgentType.ROUTER,
          tokensUsed: 0,
          executionTimeMs: processingTimeMs,
          wasFAQ: false,
          isBlocked: true,
        }
      }

      // 💰 BILLING CHECK: Ensure workspace can process messages
      if (!input.isPlayground) {
        const { WorkspaceAccessService } = await import("../services/workspace-access.service")
        const workspaceAccessService = new WorkspaceAccessService(this.prisma)
        const accessResult = await workspaceAccessService.canProcessMessages(input.workspaceId, false)

        if (!accessResult.canProcess && 
            (accessResult.blockReason === "CREDIT_EXHAUSTED" || 
             accessResult.blockReason === "PAUSED" || 
             accessResult.blockReason === "CANCELLED" ||
             accessResult.blockReason === "PAYMENT_FAILED")) {
          
          const processingTimeMs = Date.now() - startTime
          logger.warn("💰 [ChatEngine] 🚫 Billing block - skipping processing", {
            workspaceId: input.workspaceId,
            reason: accessResult.blockReason,
            balance: accessResult.details?.creditBalance
          })

          return {
            message: "",
            agentType: AgentType.ROUTER,
            wasHandled: false,
            intent: "BILLING_BLOCKED",
            confidence: "HIGH",
            source: "PATTERN",
            processingTimeMs,
            debugInfo: {
              steps: [],
              blockReason: accessResult.blockReason,
              executionTimeMs: processingTimeMs,
            },
            response: "",
            agentUsed: AgentType.ROUTER,
            tokensUsed: 0,
            executionTimeMs: processingTimeMs,
            wasFAQ: false,
            isBlocked: true,
          }
        }
      }

      // STEP 1: Process message through business logic pipeline
      const result = await this.processMessageInternal(input)
    
      const debugSteps = result.debugInfo?.steps || []
      let rawTargetLanguage = input.customerLanguage || "en"

      // 🌍 FIX: If changeLanguage was called during processing (via intent intercept or LLM function calling),
      // reload the customer's language from DB to use the FRESH value for translation.
      // Without this, the translation layer would use the STALE language from the start of the request.
      if ((result as any)._languageChanged) {
        rawTargetLanguage = (result as any)._languageChanged
        logger.info("🌍 [ChatEngine] Language changed during processing — using fresh language for translation", {
          previousLanguage: input.customerLanguage,
          newLanguage: rawTargetLanguage,
        })
      } else {
        // Check if changeLanguage was called via LLM function calling path
        const freshCustomer = await this.prisma.customers.findFirst({
          where: { id: input.customerId, workspaceId: input.workspaceId },
          select: { language: true },
        })
        if (freshCustomer?.language && freshCustomer.language !== input.customerLanguage) {
          rawTargetLanguage = freshCustomer.language
          logger.info("🌍 [ChatEngine] Detected language change via function calling — reloaded from DB", {
            previousLanguage: input.customerLanguage,
            newLanguage: rawTargetLanguage,
          })
        }
      }

      const normalizedLanguage = this.normalizeLanguageCode(rawTargetLanguage)
      const isWidgetChannel = input.channel === "widget"

      let finalMessage = this.appendRegistrationReminder(
        result.message,
        input.registrationPromptLevel,
        debugSteps,
        input.customerLanguage
      )
      let translationTokens = 0
      let safetyTokens = 0

      // STEP 2: Apply Translation Layer (SKIP when customer language matches workspace catalog base language)
      const workspaceConfig = await this.loadWorkspaceConfig(input.workspaceId)
      const catalogBaseLanguage = this.normalizeLanguageCode(workspaceConfig.catalogBaseLanguage || "it")
      // 🌍 FIX: If language was changed THIS turn (previous lang ≠ new lang), never skip translation.
      // The response was generated in the OLD language — we must translate it to the NEW one,
      // even if the new language matches the catalog base language.
      const languageChangedThisTurn = rawTargetLanguage !== (input.customerLanguage || "en")
      const shouldSkipTranslation = !languageChangedThisTurn && normalizedLanguage === catalogBaseLanguage

      if (shouldSkipTranslation) {
        logger.info("🌍 [ChatEngine] Skipping translation (customer language matches catalog base language)", {
          normalizedLanguage,
          catalogBaseLanguage,
          customerLanguage: input.customerLanguage,
        })
      } else {
        logger.info("🌍 [ChatEngine] Before translation", {
          originalMessage: result.message.substring(0, 100),
          rawTargetLanguage,
          normalizedLanguage,
          customerLanguage: input.customerLanguage,
          channel: input.channel,
        })

        const translationResult = await this.applyTranslation(
          finalMessage,
          input.workspaceId,
          normalizedLanguage, // Pass normalized code (pt, en, es, it)
          debugSteps,
          input.customerName
        )

        translationTokens = translationResult.tokensUsed || 0
        finalMessage = translationResult.message

        logger.info("🌍 [ChatEngine] After translation", {
          translatedMessage: finalMessage.substring(0, 100),
          tokensUsed: translationTokens,
        })
      }

      // STEP 2.5: Security Layer (after translation)
      if (isWidgetChannel) {
        // 🐛 FIX: Use constant for agent name to prevent string-match fragility
        const WIDGET_SECURITY_AGENT_NAME = "Widget Security Layer"
        const hasWidgetSafetyStep = debugSteps.some(
          (step) =>
            step.type === "safety" &&
            step.agent === WIDGET_SECURITY_AGENT_NAME
        )

        if (!hasWidgetSafetyStep) {
          try {
            const securityResult = await this.securityAgent.process({
              workspaceId: input.workspaceId,
              message: finalMessage,
              customerName: input.customerName,
              customerId: input.customerId,
            })

            safetyTokens = securityResult.tokensUsed || 0

            debugSteps.push({
              type: "safety",
              agent: WIDGET_SECURITY_AGENT_NAME,
              timestamp: new Date().toISOString(),
              input: {
                textContent: finalMessage,
              },
              output: {
                textResponse: securityResult.message || finalMessage,
                decision: securityResult.safe ? "approved" : "blocked",
              },
              tokenUsage: {
                promptTokens: 0,
                completionTokens: safetyTokens,
                totalTokens: safetyTokens,
              },
              details: {
                safe: securityResult.safe,
                blocked: !securityResult.safe,
                blockedReason: securityResult.blockedReason,
              },
            })

            finalMessage = securityResult.message || finalMessage
          } catch (error) {
            logger.error("❌ [ChatEngine] Widget Security failed", {
              workspaceId: input.workspaceId,
              customerId: input.customerId,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }
      }
    
      // 🌍 STEP 2B: Update the saved message with final version
      // Use the message ID saved from processMessageInternal
      const messageIdToUpdate = (result as any)._assistantMessageId
    
      if (messageIdToUpdate) {
        try {
          logger.info("🌍 [ChatEngine] Attempting to update message", {
            messageId: messageIdToUpdate,
            targetLanguage: normalizedLanguage,
            hasId: !!messageIdToUpdate,
          })
        
          const totalExtraTokens = translationTokens + safetyTokens

          // Build updated debugInfo with translation + safety tokens (if any)
          const updatedDebugInfo = result.debugInfo
            ? {
                ...result.debugInfo,
                steps: debugSteps,
                totalTokens: (result.debugInfo.totalTokens || 0) + totalExtraTokens,
              }
            : undefined

          await this.prisma.conversationMessage.update({
            where: { id: messageIdToUpdate },
            data: {
              content: finalMessage,
              debugInfo: updatedDebugInfo ? JSON.stringify(updatedDebugInfo) : undefined,
            },
          })
        
          logger.info("🌍 [ChatEngine] ✅ Updated saved message with final output", {
            messageId: messageIdToUpdate,
            targetLanguage: normalizedLanguage,
            newContentLength: finalMessage.length,
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

      // 🐛 FIX: Use single source of truth for token counting
      // debugInfo.totalTokens is authoritative (includes all processing)
      const baseTokens = cleanResult.debugInfo?.totalTokens || cleanResult.tokensUsed || 0
      const totalTokens = baseTokens + translationTokens + safetyTokens

      // 🐛 FIX: Strip trailing punctuation from URLs in final message
      // LLM/Translation layer sometimes adds "." or "," at the end of URLs
      // Example: "https://www.echatbot.ai/s/p3vN8s." → "https://www.echatbot.ai/s/p3vN8s"
      finalMessage = finalMessage.replace(
        /(https?:\/\/[^\s<>"'\]\)]+?)([.,;:!?]+)(?=\s|$|\n|\r)/g,
        (_match: string, url: string, _punctuation: string) => url
      )

      return {
        ...cleanResult,
        message: finalMessage,
        response: finalMessage,
        tokensUsed: totalTokens,
        debugInfo: cleanResult.debugInfo
          ? {
              ...cleanResult.debugInfo,
              steps: debugSteps,
              totalTokens,
            }
          : undefined,
      }
    } finally {
      // 🔓 ALWAYS release lock, even on error
      customerProcessingLocks.delete(lockKey)
      if (releaseLock) {
        releaseLock()
      }
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
    let responseAction: ChatEngineOutput["action"] | undefined = undefined // 🎯 Widget modal action

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
        sellsProducts: workspaceConfig.channelMode === "ECOMMERCE",
        hasSalesAgents: workspaceConfig.hasSalesAgents,
      })

      // ========================================================================
      // STEP 0.1: Check if first message → Return Welcome Message
      // ========================================================================
      // 🆕 NEW: Use WelcomeMessageHandler instead of inline logic
      const welcomeResult = await this.welcomeMessageHandler.handleWelcomeMessage({
        customerId: input.customerId,
        workspaceId: input.workspaceId,
        customerLanguage: input.customerLanguage,
        customerMessage: input.message,
        conversationId: input.conversationId,
        channel: input.channel || "whatsapp",
      })

      if (welcomeResult.isWelcomeMessage) {
        debugSteps.push({
          type: "router",
          agent: "👋 Welcome Message",
          timestamp: new Date().toISOString(),
          input: {
            userMessage: input.message,
          },
          output: {
            decision: "welcome_message",
            textResponse: welcomeResult.welcomeText?.substring(0, 200),
          },
        })

        logger.info("👋 [ChatEngine] Returning welcome message from handler", {
          customerId: input.customerId,
          workspaceId: input.workspaceId,
          welcomeMessageLength: welcomeResult.welcomeText?.length,
        })

        // 🆕 FLOW workspaces: Don't return early — combine welcome + response
        // For FLOW, the welcome message is prepended to the actual response
        // so the customer gets "Hi! I'm Sofia...\n\nTell me what's happening..."
        if (workspaceConfig.channelMode === "FLOW") {
          logger.info("🔄 [ChatEngine] FLOW workspace — continuing with welcome prefix", {
            channelMode: workspaceConfig.channelMode,
          })
          // Continue to STEP 0.2 with welcomePrefix
        } else {
          return {
            message: welcomeResult.welcomeText!,
            agentType: AgentType.ROUTER,
            wasHandled: true,
            intent: "GREETING",
            confidence: "HIGH",
            source: "PATTERN",
            processingTimeMs: Date.now() - startTime,
            debugInfo: {
              steps: debugSteps,
              totalTokens: 0,
              executionTimeMs: Date.now() - startTime,
            },
            tokensUsed: 0,
            agentUsed: "WELCOME",
            _assistantMessageId: welcomeResult.assistantMessageId,
          }
        }
      }

      // ========================================================================
      // STEP 0.2: Non-ECOMMERCE Workspaces — Route to correct strategy
      // ========================================================================
      if (workspaceConfig.channelMode === "FLOW") {
        return await this.handleFlowMessage({
          input,
          workspaceConfig,
          startTime,
          debugSteps,
          welcomePrefix: welcomeResult.isWelcomeMessage ? welcomeResult.welcomeText : undefined,
        })
      }

      if (workspaceConfig.channelMode !== "ECOMMERCE") {
        return await this.handleInformationalMessage({
          input,
          workspaceConfig,
          startTime,
          debugSteps,
          welcomePrefix: welcomeResult.isWelcomeMessage ? welcomeResult.welcomeText : undefined,
        })
      }

      // ========================================================================
      // STEP 0.5: Preprocess short inputs (numbers, yes/no)
      // ========================================================================
      // 🐛 FIX: Don't use customerId as fallback - generates context pollution
      // Always require conversationId or use UUID
      const conversationId = input.conversationId || (() => {
        logger.warn("⚠️ [ChatEngine] conversationId not provided, generating UUID", {
          customerId: input.customerId,
          workspaceId: input.workspaceId,
        })
        return `conv_${Math.random().toString(36).substring(7)}_${Date.now()}`
      })()
      
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
          const savedMessages = await this.messagePersistence.saveMessages(
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

          const savedMessages = await this.messagePersistence.saveMessages(
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
        
        logger.info("🔍 [ChatEngine] DEBUG: Checking pendingAction for confirmation", {
          hasPendingAction: !!pendingAction,
          pendingActionType: pendingAction?.type,
          pendingActionProductId: pendingAction?.productId,
          pendingActionItemType: pendingAction?.itemType,
          fullOptionsMapping: JSON.stringify(optionsMapping),
        })
        
        if (pendingAction && pendingAction.type === "ADD_TO_CART" && pendingAction.productId) {
          logger.info("🛒 [ChatEngine] FAST-PATH: Confirmation detected with pending ADD_TO_CART", {
            inputType: preprocessResult.inputType,
            extractedQuantity: preprocessResult.extractedQuantity,
            productId: pendingAction.productId,
            productName: pendingAction.productName,
            itemType: pendingAction.itemType || "PRODUCT",
            pendingActionFull: JSON.stringify(pendingAction), // 🔍 DEBUG: Log full pendingAction
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
            customerLanguage: input.customerLanguage || "en",
            customerDiscount: input.customerDiscount || 0,
            selectedSku: pendingAction.productId, // SKU/code for precise cart addition
            selectedItemType: pendingAction.itemType || "PRODUCT", // 🆕 Pass item type
          })
          
          // 🧹 CRITICAL: Clear pendingAction after execution to prevent re-use
          await this.optionsMappingService.clearPendingAction(conversationId)
          logger.info("🧹 [ChatEngine] Cleared pendingAction after ADD_TO_CART execution")
          
          // 🛒 CRITICAL: Save CART_ACTIONS mapping so "1" triggers CONFIRM_ORDER, not product search!
          const cartItemCount = this.extractCartItemCountFromFunctionCalls(cartResponse.functionCalls)
          const transportModes = this.extractTransportModesFromFunctionCalls(cartResponse.functionCalls)
          const cartActions = await this.buildCartActionOptions((cartItemCount ?? 2) > 1, input.workspaceId, transportModes)

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
          
          const savedMessages = await this.messagePersistence.saveMessages(
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
          // 🔧 FIX: When user says "si" after "Vuoi vedere i nostri prodotti?", 
          // show CATEGORIES (not grouped products limited to 4)
          logger.info("🛍️ [ChatEngine] FAST-PATH: Confirmation detected for SHOW_PRODUCTS prompt → showing CATEGORIES")
          
          await this.optionsMappingService.clearPendingAction(conversationId)
          cachedOptionsMapping = null
          
          // Load history before usage
          const history = await this.conversationManager.loadHistory(input.workspaceId, conversationId)
          
          // Use SHOW_CATEGORIES instead of SHOW_PRODUCTS to show ALL categories
          const showIntent: Intent = { type: "SHOW_CATEGORIES" } as Intent
          const loadedData = await this.dataLoader.loadForIntent(
            showIntent,
            input.workspaceId,
            input.customerId,
            input.customerDiscount,
            false // Categories don't need price visibility check
          )
          
          const structuredResponse = this.responseBuilder.build(showIntent, loadedData, {
            workspaceId: input.workspaceId,
            customerLanguage: input.customerLanguage || "en",
            customerName: input.customerName,
            customerDiscount: input.customerDiscount,
            userMessage: input.message,
            enableCategoryRanking: workspaceConfig.channelMode === "ECOMMERCE",
          })
          
          const formatterResult = await this.formatWithCustomRules(
            structuredResponse,
            input.customerLanguage || "en",
            workspaceConfig,
            undefined, // conversationHistory
            { customerName: input.customerName, isFirstMessage: history.length === 0 }
          )
          
          const finalMessage = formatterResult.text
          const processingTimeMs = Date.now() - startTime
          
          const savedMessages = await this.messagePersistence.saveMessages(
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
          // 🐛 FIX: Filter out options without labels upfront
          const validOptions = optionsMapping.options.filter((opt) => {
            if (!opt.label) {
              logger.error("🚫 [ChatEngine] Option stored without label - DATA CORRUPTION", {
                opt,
                workspaceId: input.workspaceId,
                customerId: input.customerId,
              })
              return false
            }
            return true
          })

          if (!validOptions.length && optionsMapping.options.length > 0) {
            logger.warn("⚠️ [ChatEngine] All options have no labels - clearing mapping", {
              optionsCount: optionsMapping.options.length,
              workspaceId: input.workspaceId,
            })
            await this.optionsMappingService.clearPendingAction(conversationId)
          }

          const normalizedMessage = OptionsMappingService.cleanLabel(input.message).toLowerCase()
          const matchedOption = validOptions.find((opt) => {
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

        if (!optionsMapping || (!optionsMapping.options?.length && !optionsMapping.groupMapping)) {
          logger.info("⏳ [ChatEngine] Numeric selection without active mapping - republishing categories", {
            number: preprocessResult.extractedNumber,
            workspaceId: input.workspaceId,
            customerId: input.customerId,
          })
          return await this.handleExpiredNumericSelection({
            input,
            workspaceConfig,
            conversationId,
            chatSessionId: chatSession?.id,
            startTime,
            debugSteps,
          })
        }
        
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
              // Load history before usage
              const history = await this.conversationManager.loadHistory(input.workspaceId, conversationId)
              
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
                  customerLanguage: input.customerLanguage || "en",
                  workspaceId: input.workspaceId,
                  customerDiscount: input.customerDiscount,
                  userMessage: input.message,
                  enableCategoryRanking: workspaceConfig.channelMode === "ECOMMERCE",
                }
              )
              
              // Format with LLM
              const formatterResult = await this.formatWithCustomRules(
                structuredResponse,
                input.customerLanguage || "en",
                workspaceConfig,
                undefined,
                { customerName: input.customerName, isFirstMessage: history.length === 0 }
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
              const savedMessages = await this.messagePersistence.saveMessages(
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
            
            // 📅 APPOINTMENT_SLOTS: User selected a time slot → call bookAppointment
            if (optionsMapping.listType === "APPOINTMENT_SLOTS") {
              const slotMetadata = (selectedOption as any).metadata
              if (slotMetadata?.startTime && slotMetadata?.serviceId) {
                logger.info("📅 [ChatEngine] FAST-PATH: Booking appointment slot", {
                  slotNumber: preprocessResult.extractedNumber,
                  startTime: slotMetadata.startTime,
                  serviceId: slotMetadata.serviceId,
                })

                try {
                  const { bookAppointment } = await import("../../domain/calling-functions/bookAppointment")
                  const bookResult = await bookAppointment({
                    workspaceId: input.workspaceId,
                    customerId: input.customerId,
                    serviceId: slotMetadata.serviceId,
                    startTime: slotMetadata.startTime,
                    channel: input.channel,
                  })

                  const processingTimeMs = Date.now() - startTime
                  let bookMessage = bookResult.message

                  // Replace user variables
                  bookMessage = await this.replaceUserVariables(
                    bookMessage,
                    input.customerId,
                    input.workspaceId,
                    input.customerName
                  )

                  // Save messages
                  const savedMessages = await this.messagePersistence.saveMessages(
                    input.workspaceId,
                    input.customerId,
                    conversationId,
                    input.message,
                    bookMessage
                  )

                  // Clear optionsMapping after booking
                  await this.optionsMappingService.saveMapping({
                    workspaceId: input.workspaceId,
                    conversationId,
                    customerId: input.customerId,
                    responseText: bookMessage,
                    forceClear: true,
                  })

                  return {
                    message: bookMessage,
                    agentType: AgentType.ROUTER,
                    wasHandled: true,
                    intent: "BOOK_APPOINTMENT",
                    confidence: "HIGH",
                    source: "PATTERN",
                    processingTimeMs,
                    debugInfo: {
                      steps: debugSteps,
                      totalTokens: 0,
                      executionTimeMs: processingTimeMs,
                    },
                    response: bookMessage,
                    agentUsed: AgentType.ROUTER,
                    tokensUsed: 0,
                    executionTimeMs: processingTimeMs,
                    wasFAQ: false,
                    isBlocked: false,
                    _assistantMessageId: savedMessages?.assistantMessageId,
                  }
                } catch (bookError) {
                  logger.error("❌ [ChatEngine] FAST-PATH bookAppointment failed", { error: bookError })
                  // Fall through to generic handling
                }
              }
            }

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
            
            // 🔒 Feature 174: Load customer isActive for price visibility (Rule #4)
            let customerIsActive = false
            if (selectIntent.listType === "PRODUCTS") {
              const customer = await this.prisma.customers.findUnique({
                where: { id: input.customerId },
                select: { isActive: true }
              })
              customerIsActive = customer?.isActive ?? false
            }
            
            // Load data using this intent
            const loadedData = await this.dataLoader.loadForIntent(
              selectIntent,
              input.workspaceId,
              input.customerId,
              input.customerDiscount,
              customerIsActive
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
                userMessage: input.message,
                enableCategoryRanking: workspaceConfig.channelMode === "ECOMMERCE",
                customerIsActive, // 🔒 Feature 174: Pass registration status for price visibility
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
                  debugInfo: { llmUsed: false },
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
              const savedMessages = await this.messagePersistence.saveMessages(
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

                // 🔗 TASK17: Replace token placeholders with secure links
                const messageBeforeReplacement = confirmMessage
                const replacementStart = Date.now()
                const replacementResult = await this.linkReplacementService.replaceTokens(
                  { response: confirmMessage, linkType: "auto" },
                  input.customerId,
                  input.workspaceId
                )
                if (replacementResult.success && replacementResult.response) {
                  confirmMessage = replacementResult.response
                }
                const replacementTime = Date.now() - replacementStart

                // Build debug steps array for confirmOrder
                const confirmDebugSteps: DebugStep[] = [
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
                ]

                // 🔗 TASK17 FIX: Add link replacement debug step when tokens are replaced
                if (messageBeforeReplacement !== confirmMessage) {
                  confirmDebugSteps.push({
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

                // Persist response
                const savedMessages = await this.messagePersistence.saveMessages(
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
                    steps: confirmDebugSteps,
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
                  customerLanguage: input.customerLanguage || "en",
                })
                
                // Persist response
                const savedMessages = await this.messagePersistence.saveMessages(
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
                      name: `${this.getTransportEmoji(transport.typeName)} Mostra prodotti ${transport.typeName}`,
                      id: "SHOW_TRANSPORT_PRODUCTS",
                      metadata: { typeName: transport.typeName },
                    })
                  }
                } else {
                  // Fallback options if analysis did not return transport names
                  optimizationOptions.push(
                    { number: optionCounter++, name: "🧊 Mostra prodotti Congelati", id: "SHOW_FROZEN_PRODUCTS", metadata: { typeName: "Trasporto congelato" } },
                    { number: optionCounter++, name: "❄️ Mostra prodotti Refrigerati", id: "SHOW_REFRIGERATED_PRODUCTS", metadata: { typeName: "Trasporto refrigerato" } },
                    { number: optionCounter++, name: "📦 Mostra prodotti Temperatura Ambiente", id: "SHOW_AMBIENT_PRODUCTS", metadata: { typeName: "Temperatura ambiente" } },
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
            
            // 📋 Handle PRODUCT_DETAIL_ACTIONS - navigation shortcuts from product detail view
            if (optionsMapping.listType === "PRODUCT_DETAIL_ACTIONS" && (selectedOption as any).id) {
              const actionId = (selectedOption as any).id
              logger.info("📋 [ChatEngine] PRODUCT_DETAIL_ACTIONS detected", { actionId })
              
              if (actionId === "SHOW_CATEGORIES") {
                // Show categories
                const categoriesIntent: import("../intent/intent.types").ShowCategoriesIntent = {
                  type: "SHOW_CATEGORIES",
                }
                
                const loadedData = await this.dataLoader.loadForIntent(
                  categoriesIntent,
                  input.workspaceId,
                  input.customerId,
                  input.customerDiscount,
                  false // Categories don't need price visibility check
                )
                
                const structuredResp = this.responseBuilder.build(
                  categoriesIntent,
                  loadedData,
                  {
                    workspaceId: input.workspaceId,
                    customerLanguage: input.customerLanguage,
                    customerName: input.customerName,
                    customerDiscount: input.customerDiscount,
                    userMessage: input.message,
                    enableCategoryRanking: workspaceConfig.channelMode === "ECOMMERCE",
                  }
                )
                
                const formatterResult = await this.formatWithCustomRules(
                  structuredResp,
                  input.customerLanguage || "en",
                  workspaceConfig,
                  undefined,
                  { customerName: input.customerName }
                )
                const formattedText = formatterResult.text

                // Save mapping for category list so future selections use new options
                const categoryItems = structuredResp.data?.items?.map((item: any) => ({
                  number: item.number,
                  name: item.name,
                  sku: item.sku,
                  id: item.id,
                }))

                await this.optionsMappingService.saveMapping({
                  workspaceId: input.workspaceId,
                  conversationId,
                  customerId: input.customerId,
                  responseText: formattedText,
                  items: categoryItems,
                  listType: "CATEGORIES",
                })

                if (chatSession) {
                  await this.conversationStateService.setState(
                    chatSession.id,
                    ConversationState.BROWSING_CATEGORIES,
                    {}
                  )
                }
                
                const savedMsgs = await this.messagePersistence.saveMessages(
                  input.workspaceId,
                  input.customerId,
                  conversationId,
                  input.message,
                  formattedText
                )
                
                return {
                  message: formattedText,
                  agentType: AgentType.PRODUCT_SEARCH,
                  wasHandled: true,
                  intent: "SHOW_CATEGORIES",
                  confidence: "HIGH",
                  source: "PATTERN",
                  processingTimeMs: Date.now() - startTime,
                  _assistantMessageId: savedMsgs?.assistantMessageId,
                }
              }
              
              if (actionId === "VIEW_CART") {
                // Show cart
                const cartIntent: import("../intent/intent.types").ViewCartIntent = {
                  type: "VIEW_CART",
                }
                
                const loadedData = await this.dataLoader.loadForIntent(
                  cartIntent,
                  input.workspaceId,
                  input.customerId,
                  input.customerDiscount,
                  false // Cart doesn't use customerIsActive param
                )
                
                const structuredResp = this.responseBuilder.build(
                  cartIntent,
                  loadedData,
                  {
                    workspaceId: input.workspaceId,
                    customerLanguage: input.customerLanguage,
                    customerName: input.customerName,
                    customerDiscount: input.customerDiscount,
                    userMessage: input.message,
                    enableCategoryRanking: workspaceConfig.channelMode === "ECOMMERCE",
                  }
                )
                
                const formatterResult = await this.formatWithCustomRules(
                  structuredResp,
                  input.customerLanguage || "en",
                  workspaceConfig,
                  undefined,
                  { customerName: input.customerName }
                )
                const formattedText = formatterResult.text

                // Mirror CART_VIEW mappings/actions so numeric selections map correctly
                const cartItems = structuredResp.data.items || []
                const transportModes = this.countUniqueTransportModes(structuredResp.data)
                const cartActions = await this.buildCartActionOptions(cartItems.length > 1, input.workspaceId, transportModes)

                await this.optionsMappingService.saveMapping({
                  workspaceId: input.workspaceId,
                  conversationId,
                  customerId: input.customerId,
                  responseText: "",
                  items: cartActions,
                  listType: "CART_ACTIONS",
                })

                if (chatSession) {
                  await this.conversationStateService.setState(
                    chatSession.id,
                    ConversationState.VIEWING_CART,
                    {}
                  )
                }
                
                const savedMsgs = await this.messagePersistence.saveMessages(
                  input.workspaceId,
                  input.customerId,
                  conversationId,
                  input.message,
                  formattedText
                )
                
                return {
                  message: formattedText,
                  agentType: AgentType.CART_MANAGEMENT,
                  wasHandled: true,
                  intent: "VIEW_CART",
                  confidence: "HIGH",
                  source: "PATTERN",
                  processingTimeMs: Date.now() - startTime,
                  _assistantMessageId: savedMsgs?.assistantMessageId,
                }
              }
            }
            
            // 🗑️ Handle CART_REMOVAL_OPTIONS - format removal options
            if (structuredResponse.type === "CART_REMOVAL_OPTIONS") {
              const items = (structuredResponse.data as { items: any[] }).items || []
              
              if (items.length === 0) {
                const emptyMsg = "Il tuo carrello è vuoto, non c'è nulla da rimuovere."
                const savedMessages = await this.messagePersistence.saveMessages(
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
              // 🎯 Use itemType for consistent product/service filtering
              const products = items.filter((i: any) => i.itemType === "PRODUCT" || (!i.itemType && !i.isService))
              const services = items.filter((i: any) => i.itemType === "SERVICE" || i.isService)
              
              let removalMessage = "Quale articolo vuoi rimuovere?\n\n"
              let optionNumber = 1
              const mappingItems: Array<{ number: number; name: string; id: string }> = []
              
              if (products.length > 0) {
                removalMessage += "🛒 Prodotti:\n"
                for (const p of products) {
                  const qty = p.quantity || 1
                  const price = p.price || 0
                  removalMessage += `${optionNumber}. ${qty}x ${p.name} - ${formatCartPrice(price * qty)}\n`
                  mappingItems.push({ number: optionNumber, name: p.name, id: p.id })
                  optionNumber++
                }
                removalMessage += "\n"
              }
              
              if (services.length > 0) {
                removalMessage += "🔧 Servizi:\n"
                for (const s of services) {
                  const price = s.price || 0
                  // Services don't show "1x" prefix
                  removalMessage += `${optionNumber}. ${s.name} - ${formatCartPrice(price)}\n`
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
              
              const savedMessages = await this.messagePersistence.saveMessages(
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
                type: "router",
                agent: "ChatEngine",
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
                customerLanguage: input.customerLanguage || "en",
                message: contextPrompt,
                conversationHistory: history,
                customerDiscount: input.customerDiscount || 0,
                conversationId,
                messageId: `${conversationId}-context-${Date.now()}`,
                registrationPromptLevel: input.registrationPromptLevel,
                skipTranslation: true, // ChatEngine wrapper handles translation + security
              })

              // 🎯 Extract widget action if present
              if (llmResponse.action) {
                responseAction = llmResponse.action
              }

              debugSteps.push({
                type: "router",
                agent: "UnifiedChatRouter",
                step: "UNIFIED_ROUTER_RESPONSE",
                timestamp: Date.now(),
                details: {
                  responseLength: llmResponse.response?.length || 0,
                  tokensUsed: llmResponse.tokensUsed || 0,
                  agentUsed: llmResponse.agentUsed,
                },
              })
              
              const finalMessage = llmResponse.response || "Mi dispiace, non ho capito. Puoi ripetere?"
              
              const savedMessages = await this.messagePersistence.saveMessages(
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
                input.customerLanguage || "en",
                workspaceConfig,
                undefined,
                { customerName: input.customerName }
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
              // Load conversation history for context
              const fallbackHistory = await this.conversationManager.loadHistory(input.workspaceId, conversationId)
              const fallback = await this.routeGenericLLMFallback({
                input,
                conversationId,
                history: fallbackHistory,
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
            const savedMessages = await this.messagePersistence.saveMessages(
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
                      : structuredResponse.type === "OFFER_WITH_PRODUCTS" ? "PRODUCTS"  // 🆕 Single offer shows products
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
                      : structuredResponse.type === "OFFER_WITH_PRODUCTS" ? "PRODUCTS"  // 🆕 Single offer shows products
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
              
              // 📋 Save PRODUCT_DETAIL_ACTIONS for navigation shortcuts (1. Esplora, 2. Carrello)
              const productDetailActions = [
                { number: 1, name: "Esplora il catalogo", id: "SHOW_CATEGORIES", metadata: {} },
                { number: 2, name: "Mostrami il carrello", id: "VIEW_CART", metadata: {} },
              ]
              
              await this.optionsMappingService.saveMapping({
                workspaceId: input.workspaceId,
                conversationId,
                customerId: input.customerId,
                responseText: "",
                items: productDetailActions,
                listType: "PRODUCT_DETAIL_ACTIONS",
              })
              
              logger.info("📋 [ChatEngine] FAST-PATH: Saved PRODUCT_DETAIL_ACTIONS mapping", {
                conversationId,
                actions: ["SHOW_CATEGORIES", "VIEW_CART"],
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
              const transportModes = this.countUniqueTransportModes(structuredResponse.data)
              const cartActions = await this.buildCartActionOptions(cartItems.length > 1, input.workspaceId, transportModes)
              
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
            const savedMessages = await this.messagePersistence.saveMessages(
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
      // STEP 0.8: 🆕 OPTIONAL: Try unified routing handler (PHASE 4)
      // ========================================================================
      // NEW ARCHITECTURE: Attempt handler-based routing for common intents
      // This is optional/experimental - if handler doesn't route, continue with normal pipeline
      // Handlers pre-compute data loading and provide faster responses for simple cases
      const tryHandlerRouting = async (): Promise<ChatEngineOutput | null> => {
        try {
          // Load workspace config for handler context
          const workspace = await this.unifiedRoutingService.getWorkspace(input.workspaceId)
          if (!workspace) return null
          
          // Detect intent (pattern → keyword → LLM fallback)
          const intent = await this.unifiedRoutingService.detectIntent({
            message: input.message,
            customerId: input.customerId,
            conversationId,
            workspaceId: input.workspaceId,
          })
          
          // Check if intent is simple enough for handler routing
          const isSimpleIntent = ["SHOW_PRODUCTS", "ADD_TO_CART", "VIEW_CART", "REPEAT_ORDER", "CONTINUE_CHECKOUT"].includes(intent.type)
          if (!isSimpleIntent || intent.type === "INCOMPREHENSIBLE") return null
          
          // Select routing path (SIMPLE, LLM, FAQ)
          const path = this.unifiedRoutingService.selectRoutingPath(workspace, intent)
          if (path !== "SIMPLE") return null // Only handle SIMPLE path via handlers
          
          // Load data for intent
          const loadedData = await this.unifiedRoutingService.loadDataForIntent(workspace, intent)
          
          // Create context for handler
          const handlerContext = {
            message: input.message,
            customerId: input.customerId,
            conversationId,
            workspaceId: input.workspaceId,
            workspace,
            loadedData,
            conversationHistory: [],
          }
          
          // Call simple intent handler
          const result = await this.simpleIntentHandler.handle(intent, handlerContext)
          
          // Log routing decision
          this.unifiedRoutingService.logRoutingDecision({
            intent,
            path: "SIMPLE",
            workspace,
            confidence: intent.confidence,
            source: intent.source,
            timestamp: new Date(),
            dataLoaded: {
              workspace: true,
              products: loadedData.products?.length > 0 || false,
              faqs: loadedData.faqs?.length > 0 || false,
              services: loadedData.services?.length > 0 || false,
              offers: loadedData.offers?.length > 0 || false,
            },
          })
          
          // Save messages
          const savedMessages = await this.messagePersistence.saveMessages(
            input.workspaceId,
            input.customerId,
            conversationId,
            input.message,
            result.message
          )
          
          logger.info("✅ [ChatEngine] Handler routing succeeded (PHASE 4)", {
            intent: intent.type,
            agentUsed: result.agentUsed,
            timeMs: Date.now() - startTime,
          })
          
          return {
            message: result.message,
            agentType: AgentType.ROUTER,
            wasHandled: true,
            intent: intent.type,
            confidence: "HIGH",
            source: "PATTERN",
            processingTimeMs: Date.now() - startTime,
            debugInfo: { steps: debugSteps, handlerUsed: true },
            response: result.message,
            agentUsed: result.agentUsed,
            tokensUsed: 0,
            executionTimeMs: Date.now() - startTime,
            wasFAQ: false,
            isBlocked: false,
            _assistantMessageId: savedMessages?.assistantMessageId,
          }
        } catch (error) {
          // Handler routing failed - log and continue with normal pipeline
          logger.debug("⚠️ [ChatEngine] Handler routing failed (fallback to normal pipeline)", {
            error: error.message,
            intent: (error as any).intent,
          })
          return null
        }
      }
      
      // Try handler routing (experimental - PHASE 4)
      const handlerResult = await tryHandlerRouting()
      if (handlerResult) {
        return handlerResult
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
      // STEP 2.19: Informational Workspace - Override intent for FAQ-based response
      // 🔒 Feature 174: If workspace doesn't sell products, force INFO_AGENT (with FAQ)
      // This ensures GREETING, UPDATE_PROFILE, CHANGE_LANGUAGE go through unified Router flow
      // ========================================================================
      if ((this.isEcommerceIntent(intentResult.intent.type) || this.isInformationalIntent(intentResult.intent.type)) && workspaceConfig.channelMode !== "ECOMMERCE") {
        logger.info("🔀 [ChatEngine] Informational workspace: forcing Router flow", {
          originalIntent: intentResult.intent.type,
          workspaceId: input.workspaceId
        })
        
        // Override intent to force Router routing (continues normal flow with LinkReplacement + Translation)
        intentResult.intent.type = "ASK_FAQ" as any // Force FAQ routing
        intentResult.source = "PATTERN" // Use valid source type
      }

      // ========================================================================
      // STEP 2.20: Handle GREETING intent - Simple greeting response (WIDGET ONLY)
      // ========================================================================
      // ⚠️ CRITICAL: Hardcoded greeting ONLY for widget channel
      // WhatsApp uses natural LLM routing, widget needs quick hardcoded response
      if (intentResult.intent.type === "GREETING" && input.channel === "widget") {
        const processingTimeMs = Date.now() - startTime
        
        // Get workspace name for personalized greeting
        const workspaceName = workspaceConfig.name || "il nostro servizio"
        
        // Simple greeting response - will be translated by translation layer
        const greetingResponse = `Ciao! 👋 Benvenuto su ${workspaceName}. Come posso aiutarti oggi?`
        
        // Save messages
        const savedMessages = await this.messagePersistence.saveMessages(
          input.workspaceId,
          input.customerId,
          conversationId,
          input.message,
          greetingResponse
        )
        
        logger.info("👋 [ChatEngine] Greeting handled (WIDGET)", {
          workspaceId: input.workspaceId,
          customerId: input.customerId,
          responseLength: greetingResponse.length,
          channel: input.channel,
        })
        
        return {
          message: greetingResponse,
          agentType: AgentType.ROUTER,
          wasHandled: true,
          intent: "GREETING",
          confidence: "HIGH",
          source: "PATTERN",
          processingTimeMs,
          debugInfo: {
            steps: debugSteps,
          },
          response: greetingResponse,
          agentUsed: AgentType.ROUTER,
          tokensUsed: 0,
          executionTimeMs: processingTimeMs,
          wasFAQ: false,
          _assistantMessageId: savedMessages.assistantMessageId,
          isBlocked: false,
        }
      }

      // ========================================================================
      // STEP 2.25: Handle UNKNOWN intent - Delegate to RouterOrchestrationService
      // ========================================================================
      // 🆕 NEW ARCHITECTURE: IntentParser returned UNKNOWN (no pattern/keyword match)
      // This means we have a complex query that needs LLM routing.
      // Delegate to RouterOrchestrationService which will:
      // - Informational workspace → INFO_AGENT (FAQ system)
      // - E-commerce workspace → Full Router LLM (all agents)
      if (intentResult.intent.type === "UNKNOWN") {
        logger.info("❓ [ChatEngine] UNKNOWN intent - delegating to RouterOrchestrationService", {
          workspaceId: input.workspaceId,
          customerId: input.customerId,
          messagePreview: input.message.substring(0, 50),
        })

        const routingStart = Date.now()
        
        try {
          // Call RouterOrchestrationService
          const routingResult = await this.routerOrchestration.route({
            workspaceId: input.workspaceId,
            customerId: input.customerId,
            customerName: input.customerName,
            customerLanguage: input.customerLanguage,
            message: input.message,
            conversationId,
            isSystemMessage: false,
            sessionId: input.conversationId,
          })

          const routingTime = Date.now() - routingStart
          totalTokens += routingResult.totalTokens || 0

          // Merge debug steps from routing
          if (routingResult.debugSteps) {
            debugSteps.push(...routingResult.debugSteps)
          }

          logger.info("✅ [ChatEngine] RouterOrchestrationService completed", {
            workspaceId: input.workspaceId,
            agentType: routingResult.agentType,
            totalTokens: routingResult.totalTokens,
            executionTimeMs: routingTime,
          })

          // Save messages
          const savedMessages = await this.messagePersistence.saveMessages(
            input.workspaceId,
            input.customerId,
            conversationId,
            input.message,
            routingResult.response,
            routingResult.agentType,
            routingResult.totalTokens || 0,
            {
              steps: debugSteps,
              totalTokens,
              executionTimeMs: Date.now() - startTime,
            }
          )

          const processingTimeMs = Date.now() - startTime

          return {
            message: routingResult.response,
            agentType: routingResult.agentType,
            wasHandled: true,
            intent: "ROUTER_DELEGATED",
            confidence: "HIGH",
            source: "LLM_CONTEXT",
            processingTimeMs,
            debugInfo: {
              steps: debugSteps,
              totalTokens,
              executionTimeMs: processingTimeMs,
            },
            response: routingResult.response,
            agentUsed: routingResult.agentType,
            tokensUsed: routingResult.totalTokens || 0,
            executionTimeMs: processingTimeMs,
            wasFAQ: false,
            _assistantMessageId: savedMessages.assistantMessageId,
            isBlocked: false,
          }

        } catch (error) {
          logger.error("❌ [ChatEngine] RouterOrchestrationService failed", {
            workspaceId: input.workspaceId,
            error: error.message,
          })
          
          // Fallback: Return polite "didn't understand" message
          const processingTimeMs = Date.now() - startTime
          const unknownResponse = "Mi dispiace, si è verificato un errore. Potresti riprovare? 🤔"
          
          const savedMessages = await this.messagePersistence.saveMessages(
            input.workspaceId,
            input.customerId,
            conversationId,
            input.message,
            unknownResponse,
            AgentType.ROUTER,
            0,
            { steps: debugSteps, totalTokens, executionTimeMs: processingTimeMs }
          )
          
          return {
            message: unknownResponse,
            agentType: AgentType.ROUTER,
            wasHandled: true,
            intent: "ERROR",
            confidence: "LOW",
            source: "PATTERN",
            processingTimeMs,
            debugInfo: { steps: debugSteps, totalTokens, executionTimeMs: processingTimeMs },
            response: unknownResponse,
            agentUsed: AgentType.ROUTER,
            tokensUsed: 0,
            executionTimeMs: processingTimeMs,
            _assistantMessageId: savedMessages.assistantMessageId,
          }
        }
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
            
            const savedMessages = await this.messagePersistence.saveMessages(
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
            const quantityMatch = input.message.match(/(\d+)/)
            const quantity = quantityMatch
              ? parseInt(quantityMatch[1], 10)
              : (pendingAction.quantity || 1)
            const itemLabel = pendingAction.itemType === "SERVICE" ? "servizio" : "prodotto"
            
            // Delegate to CartManagementAgentLLM for intelligent cart handling
            // 🔧 CRITICAL: Pass selectedSku and itemType so CartManagementAgent knows EXACTLY what to add
            const cartAgent = new CartManagementAgentLLM(this.prisma)
            const cartResponse = await cartAgent.handleQuery({
              workspaceId: input.workspaceId,
              customerId: input.customerId,
              query: `aggiungi ${quantity} ${pendingAction.productName || itemLabel} al carrello`,
              customerName: input.customerName || "",
              customerLanguage: input.customerLanguage || "en",
              customerDiscount: input.customerDiscount || 0,
              selectedSku: pendingAction.productId, // 🔧 SKU/code for precise cart addition
              selectedItemType: pendingAction.itemType || "PRODUCT", // 🆕 Pass item type
            })
            
            // 🧹 CRITICAL: Clear pendingAction after execution
            await this.optionsMappingService.clearPendingAction(conversationId)
            logger.info("🧹 [ChatEngine] Cleared pendingAction after ADD_TO_CART execution (STEP 2.6)")
            
            // 🛒 CRITICAL: Save CART_ACTIONS mapping so "1" triggers CONFIRM_ORDER, not product search!
            const cartItemCount = this.extractCartItemCountFromFunctionCalls(cartResponse.functionCalls)
            const transportModes = this.extractTransportModesFromFunctionCalls(cartResponse.functionCalls)
            const cartActions = await this.buildCartActionOptions((cartItemCount ?? 2) > 1, input.workspaceId, transportModes)

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
            
            const savedMessages = await this.messagePersistence.saveMessages(
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
            if (lastListType === "CART_ITEMS" || optionsMapping?.pendingAction?.type === "CONFIRM_ORDER") {
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

      // ========================================================================
      // STEP: Handle UPDATE_PROFILE / VIEW_PROFILE intent - Generate profile link
      // 🐛 FIX: VIEW_PROFILE was missing here, causing it to fall through to wrong agent
      // ========================================================================
      if (intentResult.intent.type === "UPDATE_PROFILE" || intentResult.intent.type === "VIEW_PROFILE") {
        logger.info("📝 [ChatEngine] UPDATE_PROFILE/VIEW_PROFILE detected - generating profile link", {
          workspaceId: input.workspaceId,
          customerId: input.customerId,
        })

        try {
          // Import CallingFunctionsService to generate profile link
          const { CallingFunctionsService } = await import("../../services/calling-functions.service")
          const callingFunctions = new CallingFunctionsService()
          
          const profileLinkResult = await callingFunctions.getProfileLink({
            customerId: input.customerId,
            workspaceId: input.workspaceId,
          })

          if (!profileLinkResult.success || !profileLinkResult.data?.profileLink) {
            throw new Error("Failed to generate profile link")
          }

          // Format the response with the link (use shortLink if available)
          const customerFirstName = input.customerName?.split(" ")[0] || "!"
          const profileLink = profileLinkResult.data.shortLink || profileLinkResult.data.profileLink
          const isViewProfile = intentResult.intent.type === "VIEW_PROFILE"
          const profileMessage = isViewProfile
            ? `Certo ${customerFirstName}! 👤 Per visualizzare i tuoi dati personali clicca qui:\n\n👉 Il mio Profilo\n${profileLink}\n\nPer questioni di sicurezza il link sarà abilitato solo per 15 minuti.\n\nTi posso aiutare con qualcos'altro? 😊`
            : `Certo ${customerFirstName}! 📝 Per aggiornare i tuoi dati personali clicca qui:\n\n👉 Modifica Profilo\n${profileLink}\n\nPer questioni di sicurezza il link sarà abilitato solo per 15 minuti.\n\nTi posso aiutare con qualcos'altro? 😊`

          const processingTimeMs = Date.now() - startTime

          // Save messages
          const savedMessages = await this.messagePersistence.saveMessages(
            input.workspaceId,
            input.customerId,
            conversationId,
            input.message,
            profileMessage
          )

          // Clear any pending options
          await this.optionsMappingService.clearMapping(conversationId)

          logger.info("✅ [ChatEngine] UPDATE_PROFILE/VIEW_PROFILE handled successfully", {
            workspaceId: input.workspaceId,
            customerId: input.customerId,
            linkGenerated: true,
          })

          return {
            message: profileMessage,
            agentType: AgentType.PROFILE_MANAGEMENT,
            wasHandled: true,
            intent: intentResult.intent.type,
            confidence: intentResult.confidence,
            source: intentResult.source,
            processingTimeMs,
            debugInfo: {
              loadedDataType: "PROFILE_LINK",
              responseType: intentResult.intent.type,
              llmUsed: false,
            },
            response: profileMessage,
            agentUsed: AgentType.PROFILE_MANAGEMENT,
            tokensUsed: 0,
            executionTimeMs: processingTimeMs,
            wasFAQ: false,
            isBlocked: false,
            _assistantMessageId: savedMessages.assistantMessageId,
          }
        } catch (error) {
          logger.error("❌ [ChatEngine] Failed to generate profile link", { error })
          
          const errorMessage = "Mi dispiace, non sono riuscito a generare il link per modificare il profilo. Riprova tra qualche istante! 😅"
          const processingTimeMs = Date.now() - startTime

          return {
            message: errorMessage,
            agentType: AgentType.PROFILE_MANAGEMENT,
            wasHandled: true,
            intent: "UPDATE_PROFILE",
            confidence: intentResult.confidence,
            source: intentResult.source,
            processingTimeMs,
            debugInfo: {
              loadedDataType: "ERROR",
              responseType: "UPDATE_PROFILE_ERROR",
              llmUsed: false,
            },
            response: errorMessage,
            agentUsed: AgentType.PROFILE_MANAGEMENT,
            tokensUsed: 0,
            executionTimeMs: processingTimeMs,
            wasFAQ: false,
            isBlocked: false,
          }
        }
      }

      // ========================================================================
      // STEP: Handle CHANGE_LANGUAGE intent - Call changeLanguage() directly
      // ========================================================================
      if (intentResult.intent.type === "CHANGE_LANGUAGE") {
        const requestedLang = (intentResult.intent as any).requestedLanguage || ""
        const resolvedLangCode = this.resolveLanguageCode(requestedLang)

        logger.info("🌍 [ChatEngine] CHANGE_LANGUAGE detected - calling changeLanguage directly", {
          workspaceId: input.workspaceId,
          customerId: input.customerId,
          requestedLanguage: requestedLang,
          resolvedLangCode,
        })

        if (resolvedLangCode) {
          try {
            const { changeLanguage } = await import("../../domain/calling-functions/changeLanguage")
            const result = await changeLanguage({
              workspaceId: input.workspaceId,
              customerId: input.customerId,
              language: resolvedLangCode,
            })

            const LANG_LABELS: Record<string, string> = { it: "Italiano", en: "English", es: "Español", pt: "Português" }
            const langLabel = LANG_LABELS[resolvedLangCode] || resolvedLangCode
            const customerFirstName = input.customerName?.split(" ")[0] || "!"

            // Response in the NEW language so no translation is needed
            const LANG_RESPONSES: Record<string, string> = {
              it: `Certo ${customerFirstName}! 🌍 Da ora in poi risponderò in Italiano. Come posso aiutarti? 😊`,
              en: `Sure ${customerFirstName}! 🌍 From now on I will respond in English. How can I help you? 😊`,
              es: `¡Claro ${customerFirstName}! 🌍 A partir de ahora responderé en Español. ¿Cómo puedo ayudarte? 😊`,
              pt: `Claro ${customerFirstName}! 🌍 A partir de agora responderei em Português. Como posso ajudar? 😊`,
            }
            const languageMessage = LANG_RESPONSES[resolvedLangCode] || LANG_RESPONSES["en"]

            const processingTimeMs = Date.now() - startTime

            const savedMessages = await this.messagePersistence.saveMessages(
              input.workspaceId,
              input.customerId,
              conversationId,
              input.message,
              languageMessage
            )

            await this.optionsMappingService.clearMapping(conversationId)

            logger.info("✅ [ChatEngine] CHANGE_LANGUAGE completed", {
              workspaceId: input.workspaceId,
              customerId: input.customerId,
              newLanguage: resolvedLangCode,
            })

            return {
              message: languageMessage,
              agentType: AgentType.PROFILE_MANAGEMENT,
              wasHandled: true,
              intent: "CHANGE_LANGUAGE",
              confidence: intentResult.confidence,
              source: intentResult.source,
              processingTimeMs,
              debugInfo: {
                loadedDataType: "LANGUAGE_CHANGE",
                responseType: "CHANGE_LANGUAGE",
                llmUsed: false,
                newLanguage: resolvedLangCode,
              },
              response: languageMessage,
              agentUsed: AgentType.PROFILE_MANAGEMENT,
              tokensUsed: 0,
              executionTimeMs: processingTimeMs,
              wasFAQ: false,
              isBlocked: false,
              _assistantMessageId: savedMessages.assistantMessageId,
              _languageChanged: resolvedLangCode,
            } as any
          } catch (error) {
            logger.error("❌ [ChatEngine] changeLanguage failed", { error })
            // Fall through to LLM router
          }
        }
        // If no valid language detected, fall through to LLM router which can call changeLanguage via function calling
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

        // ProductContext failed - try FAQ first for questions like "when will it arrive?"
        logger.warn("⚠️ [ChatEngine] PRODUCT_CONTEXT failed, trying FAQ fallback", {
          workspaceId: input.workspaceId,
          customerId: input.customerId,
          question: input.message,
        })

        intentResult.intent = {
          type: "ASK_FAQ",
          query: input.message,
        } as AskFAQIntent
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
          const savedMessages = await this.messagePersistence.saveMessages(
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
            const transportModes = this.extractTransportModesFromFunctionCalls(cartResponse.functionCalls)
            const cartActions = await this.buildCartActionOptions((cartItemCount ?? 2) > 1, input.workspaceId, transportModes)
            
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
          
          const savedMessages = await this.messagePersistence.saveMessages(
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
        const savedMessages = await this.messagePersistence.saveMessages(
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
        
        // 🔒 Feature 174: Load customer registration status for price visibility
        const customer = await this.prisma.customers.findUnique({
          where: { id: input.customerId },
          select: { isActive: true, name: true, phone: true }
        })
        const customerIsActive = customer?.isActive ?? false
        
        // 🔒 DEBUG: Log customer registration status per Rule #4
        logger.info("🔒 ChatEngine - Customer Registration Debug", {
          customerId: input.customerId,
          customerName: customer?.name,
          customerPhone: customer?.phone,
          customerIsActive,
          message: input.message.substring(0, 30)
        })
        
        try {
          const catalogResult = await this.catalogQueryService.process({
            workspaceId: input.workspaceId,
            message: input.message,
            customerDiscount: input.customerDiscount || 0,
            intentType: intentResult.intent.type,
            customerLanguage: input.customerLanguage || "en",
            customerIsActive, // 🔒 Feature 174: Pass registration status for price control
          })

          const shouldUseCatalogResult =
            catalogResult.resultType !== "EMPTY" &&
            catalogResult.loadedData &&
            (catalogResult.loadedData as any).type !== "EMPTY"

          if (shouldUseCatalogResult) {
            loadedData = catalogResult.loadedData
            structuredResponseOverride = catalogResult.structuredResponse
          } else {
            logger.info("📦 [ChatEngine] Catalog query empty - falling back to DataLoader", {
              resultType: catalogResult.resultType,
            })
            loadedData = null
            structuredResponseOverride = null
          }

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
        
        // 🔒 Feature 174: Load customer isActive for price visibility (Rule #4)
        let customerIsActive = false
        if (intentResult.intent.type === "SHOW_PRODUCT") {
          const customer = await this.prisma.customers.findUnique({
            where: { id: input.customerId },
            select: { isActive: true }
          })
          customerIsActive = customer?.isActive ?? false
        }
        
        loadedData = await this.dataLoader.loadForIntent(
          intentResult.intent,
          input.workspaceId,
          input.customerId,
          input.customerDiscount,
          customerIsActive
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
      
      // Check if OWNER has Premium/Enterprise plan for optimization option (Feature 198)
      let showOptimizeOption = false
      if (finalLoadedData.type === "CART") {
        try {
          const workspace = await this.prisma.workspace.findUnique({
            where: { id: input.workspaceId },
            select: {
              owner: {
                select: { planType: true },
              },
            },
          })
          const ownerPlan = workspace?.owner?.planType
          const eligiblePlan = ownerPlan === 'PREMIUM' || ownerPlan === 'ENTERPRISE'
          const types = finalLoadedData.cart?.transport
            ? Object.keys(finalLoadedData.cart.transport.byType || {})
            : []
          const hasMultipleTransports = types.length >= 2
          showOptimizeOption = eligiblePlan && hasMultipleTransports
        } catch (err) {
          logger.warn("⚠️ [ChatEngine] Could not check owner plan type for optimization option", { error: err, workspaceId: input.workspaceId })
        }
      }
      
      // ========================================================================
      // STEP 4.1: Build enrichment options for contextual responses
      // ========================================================================
      const enrichmentOptions = await this.messagePersistence.buildEnrichmentOptions(
        input.workspaceId,
        input.customerId,
        history.map(msg => ({ role: msg.role as "user" | "assistant", content: msg.content }))
      )
      
      const structuredResponse =
        structuredResponseOverride ??
        this.responseBuilder.build(intentResult.intent, finalLoadedData as LoadedData, {
          customerName: input.customerName,
          customerLanguage: input.customerLanguage || "en",
          workspaceId: input.workspaceId,
          customerDiscount: input.customerDiscount,
          showOptimizeOption,
          userMessage: input.message,
          enableCategoryRanking: workspaceConfig.channelMode === "ECOMMERCE",
        }, enrichmentOptions)

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
          input.customerLanguage || "en",
          workspaceConfig,
          undefined,
          { customerName: input.customerName, isFirstMessage: history.length === 0 }
        )
        finalMessage = formatterResult.text
        llmUsed = !formatterResult.cached
        groupMapping = formatterResult.groupMapping
      } else {
        // Full LLM formatting for complex responses
        const formatterResult = await this.formatWithCustomRules(
          structuredResponse,
          input.customerLanguage || "en",
          workspaceConfig,
          undefined,
          { customerName: input.customerName, isFirstMessage: history.length === 0 }
        )
        finalMessage = formatterResult.text
        llmUsed = !formatterResult.cached
        groupMapping = formatterResult.groupMapping
      }
      const formatTime = Date.now() - formatStart

      // 🆕 Add LLM Formatter debug step
      const agentType = this.mapIntentToAgentType(intentResult.intent.type, workspaceConfig)
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
      const messageBeforeReplacement = finalMessage // Store original for comparison
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
        // TASK17 FIX: Compare BEFORE vs AFTER replacement (not result vs result)
        if (messageBeforeReplacement !== finalMessage) {
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
      const savedMessages = await this.messagePersistence.saveMessages(
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
        const transportModes = this.countUniqueTransportModes(structuredResponse.data)
        const cartActions = await this.buildCartActionOptions(cartItems.length > 1, input.workspaceId, transportModes)
        
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
      } else if (structuredResponse.type === "PRODUCT_DETAIL") {
        const productDetailActions = [
          { number: 1, name: "Esplora il catalogo", id: "SHOW_CATEGORIES", metadata: {} },
          { number: 2, name: "Mostrami il carrello", id: "VIEW_CART", metadata: {} },
        ]

        await this.optionsMappingService.saveMapping({
          workspaceId: input.workspaceId,
          conversationId,
          customerId: input.customerId,
          responseText: "",
          items: productDetailActions,
          listType: "PRODUCT_DETAIL_ACTIONS",
        })

        logger.info("📋 [ChatEngine] STEP 9: Saved PRODUCT_DETAIL_ACTIONS mapping", {
          conversationId,
          responseType: structuredResponse.type,
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
                               : structuredResponse.type === "OFFER_WITH_PRODUCTS" ? "PRODUCTS"  // 🆕 Single offer shows products
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
        // 🎯 Widget-specific action (e.g., open profile modal)
        action: responseAction,
      } as any
    } catch (error) {
      logger.error("❌ [ChatEngine] Error processing message", {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        customerLanguage: input.customerLanguage,
      })
      const errorTimeMs = Date.now() - startTime
      
      // STEP: Get base error message in customer language
      const baseErrorMessage = this.messagePersistence.getErrorMessageByLanguage(input.customerLanguage)
      
      // 🌍 TRANSLATION LAYER for error messages (async, non-blocking)
      // Even errors should be polished through translation, if customer language is not English
      const finalErrorMessage = await this.messagePersistence.translateErrorMessage(
        baseErrorMessage,
        input.workspaceId,
        input.customerLanguage,
        input.customerName
      )

      return {
        // New fields
        message: finalErrorMessage,
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
          hasTranslation: finalErrorMessage !== baseErrorMessage, // Track if translation was applied
        },
        // Legacy fields
        response: finalErrorMessage,
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
   * Handle messages for FLOW workspaces.
   * Delegates entirely to FlowWorkspaceStrategy via RouterOrchestrationService,
   * bypassing the ECOMMERCE/INFORMATIONAL pipeline.
   */
  private async handleFlowMessage(params: {
    input: ChatEngineInput
    workspaceConfig: WorkspaceConfig
    startTime: number
    debugSteps: DebugStep[]
    welcomePrefix?: string
  }): Promise<ChatEngineOutput> {
    const { input, startTime, debugSteps, welcomePrefix } = params

    logger.info("🔄 [ChatEngine] FLOW workspace — delegating to FlowWorkspaceStrategy", {
      workspaceId: input.workspaceId,
      customerId: input.customerId,
    })

    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: input.workspaceId },
      })

      if (!workspace) {
        throw new Error(`Workspace not found: ${input.workspaceId}`)
      }

      const routingContext = {
        message: input.message,
        customerId: input.customerId,
        workspaceId: input.workspaceId,
        conversationId: input.conversationId || `temp-${input.customerId}`,
        customerName: input.customerName,
        customerLanguage: input.customerLanguage,
        channel: input.channel || "whatsapp",
        isPlayground: input.isPlayground ?? false,
      }

      const result = await this.routerOrchestration.route(routingContext)

      let responseText = result.response || ""

      if (welcomePrefix) {
        responseText = `${welcomePrefix}\n\n${responseText}`
      }

      return {
        message: responseText,
        agentType: result.agentType || AgentType.ROUTER,
        wasHandled: true,
        intent: "FLOW",
        confidence: "HIGH",
        source: "LLM_FALLBACK",
        processingTimeMs: Date.now() - startTime,
        debugInfo: {
          steps: [...(debugSteps || []), ...(result.debugSteps || [])],
          totalTokens: result.totalTokens || 0,
          executionTimeMs: Date.now() - startTime,
        },
        tokensUsed: result.totalTokens || 0,
        agentUsed: "FLOW",
      }
    } catch (error) {
      logger.error("❌ [ChatEngine] handleFlowMessage failed", { error })
      throw error
    }
  }

  private async handleInformationalMessage(params: {
    input: ChatEngineInput
    workspaceConfig: WorkspaceConfig
    startTime: number
    debugSteps: DebugStep[]
    welcomePrefix?: string
  }): Promise<ChatEngineOutput> {
    const { input, workspaceConfig, startTime, debugSteps, welcomePrefix } = params
    const conversationId = input.conversationId || `temp-${input.customerId}`

    // ========================================================================
    // STEP 0.2.1: Intercept intents with DEDICATED handlers BEFORE they reach UnifiedChatRouter
    // Without these checks, intents fall through to LLMRouterService → if agent fails → 
    // fallback leaks botIdentityResponse (internal admin config) as customer message.
    // ✅ Intercepted: REQUEST_HUMAN, UPDATE_PROFILE, VIEW_PROFILE, CHANGE_LANGUAGE
    // ⚠️ All other intents go to UnifiedChatRouter → LLMRouterService (which is OK for ASK_FAQ, ASK_IDENTITY etc.)
    // ========================================================================
    try {
      const intentResult = await this.intentParser.parse(input.message, {
        workspaceId: input.workspaceId,
        customerId: input.customerId,
      })

      // ========================================================================
      // INTERCEPT: REQUEST_HUMAN → reuse existing handleHumanSupportRequest
      // Without this, "voglio parlare con un operatore" falls through to
      // CustomerSupportAgentLLM → now handled by UnifiedChatRouter which dumps the system prompt
      // ========================================================================
      if (intentResult.intent.type === "REQUEST_HUMAN") {
        logger.info("📞 [ChatEngine] REQUEST_HUMAN in informational workspace - routing to human support handler", {
          workspaceId: input.workspaceId,
          customerId: input.customerId,
        })

        return await this.handleHumanSupportRequest({
          input,
          workspaceConfig,
          conversationId: input.conversationId || `temp-${input.customerId}`,
          debugSteps,
          totalTokens: 0,
          startTime,
          requestIntent: intentResult.intent as RequestHumanIntent,
          intentConfidence: intentResult.confidence,
          intentSource: intentResult.source,
        })
      }

      if (intentResult.intent.type === "UPDATE_PROFILE" || intentResult.intent.type === "VIEW_PROFILE") {
        logger.info("📝 [ChatEngine] UPDATE_PROFILE/VIEW_PROFILE in informational workspace - generating profile link", {
          workspaceId: input.workspaceId,
          customerId: input.customerId,
        })


        try {
          const { CallingFunctionsService } = await import("../../services/calling-functions.service")
          const callingFunctions = new CallingFunctionsService()
          
          const profileLinkResult = await callingFunctions.getProfileLink({
            customerId: input.customerId,
            workspaceId: input.workspaceId,
          })

          if (!profileLinkResult.success || !profileLinkResult.data?.profileLink) {
            throw new Error("Failed to generate profile link")
          }

          const customerFirstName = input.customerName?.split(" ")[0] || "!"
          const profileLink = profileLinkResult.data.shortLink || profileLinkResult.data.profileLink
          const isViewProfile = intentResult.intent.type === "VIEW_PROFILE"
          let profileMessage = isViewProfile
            ? `Certo ${customerFirstName}! 👤 Per visualizzare i tuoi dati personali clicca qui:\n\n👉 Il mio Profilo\n${profileLink}\n\nPer questioni di sicurezza il link sarà abilitato solo per 15 minuti.\n\nTi posso aiutare con qualcos'altro? 😊`
            : `Certo ${customerFirstName}! 📝 Per aggiornare i tuoi dati personali clicca qui:\n\n👉 Modifica Profilo\n${profileLink}\n\nPer questioni di sicurezza il link sarà abilitato solo per 15 minuti.\n\nTi posso aiutare con qualcos'altro? 😊`

          // Translate to customer language
          const customerLanguage = input.customerLanguage || "en"
          try {
            const translationResult = await this.applyTranslation(
              profileMessage,
              input.workspaceId,
              customerLanguage,
              debugSteps,
              customerFirstName
            )
            profileMessage = translationResult.message
          } catch (translationError) {
            logger.warn("⚠️ [ChatEngine] Profile message translation failed, using Italian", {
              error: (translationError as Error).message,
            })
          }

          const processingTimeMs = Date.now() - startTime
          const savedMessages = await this.messagePersistence.saveMessages(
            input.workspaceId,
            input.customerId,
            conversationId,
            input.message,
            profileMessage
          )

          return {
            message: profileMessage,
            agentType: AgentType.PROFILE_MANAGEMENT,
            wasHandled: true,
            intent: intentResult.intent.type,
            confidence: intentResult.confidence,
            source: intentResult.source,
            processingTimeMs,
            debugInfo: { steps: debugSteps, totalTokens: 0, executionTimeMs: processingTimeMs },
            response: profileMessage,
            agentUsed: AgentType.PROFILE_MANAGEMENT,
            tokensUsed: 0,
            executionTimeMs: processingTimeMs,
            wasFAQ: false,
            isBlocked: false,
            _assistantMessageId: savedMessages.assistantMessageId,
          }
        } catch (error) {
          logger.error("❌ [ChatEngine] Failed to generate profile link (informational)", { error })
          // Fall through to INFO_AGENT on error
        }
      }

      // ========================================================================
      // INTERCEPT: CHANGE_LANGUAGE → reuse profile link logic for language change
      // Without this, CHANGE_LANGUAGE in informational workspaces falls through
      // to UnifiedChatRouter which may fail and leak the system prompt
      // ========================================================================
      if (intentResult.intent.type === "CHANGE_LANGUAGE") {
        const requestedLang = (intentResult.intent as any).requestedLanguage || ""
        const resolvedLangCode = this.resolveLanguageCode(requestedLang)

        logger.info("🌍 [ChatEngine] CHANGE_LANGUAGE in informational workspace - calling changeLanguage directly", {
          workspaceId: input.workspaceId,
          customerId: input.customerId,
          requestedLanguage: requestedLang,
          resolvedLangCode,
        })

        if (resolvedLangCode) {
          try {
            const { changeLanguage } = await import("../../domain/calling-functions/changeLanguage")
            const result = await changeLanguage({
              workspaceId: input.workspaceId,
              customerId: input.customerId,
              language: resolvedLangCode,
            })

            const customerFirstName = input.customerName?.split(" ")[0] || "!"
            const LANG_RESPONSES: Record<string, string> = {
              it: `Certo ${customerFirstName}! 🌍 Da ora in poi risponderò in Italiano. Come posso aiutarti? 😊`,
              en: `Sure ${customerFirstName}! 🌍 From now on I will respond in English. How can I help you? 😊`,
              es: `¡Claro ${customerFirstName}! 🌍 A partir de ahora responderé en Español. ¿Cómo puedo ayudarte? 😊`,
              pt: `Claro ${customerFirstName}! 🌍 A partir de agora responderei em Português. Como posso ajudar? 😊`,
            }
            const languageMessage = LANG_RESPONSES[resolvedLangCode] || LANG_RESPONSES["en"]

            const processingTimeMs = Date.now() - startTime
            const savedMessages = await this.messagePersistence.saveMessages(
              input.workspaceId,
              input.customerId,
              conversationId,
              input.message,
              languageMessage
            )

            return {
              message: languageMessage,
              agentType: AgentType.PROFILE_MANAGEMENT,
              wasHandled: true,
              intent: "CHANGE_LANGUAGE",
              confidence: intentResult.confidence,
              source: intentResult.source,
              processingTimeMs,
              debugInfo: { steps: debugSteps, totalTokens: 0, executionTimeMs: processingTimeMs, newLanguage: resolvedLangCode },
              response: languageMessage,
              agentUsed: AgentType.PROFILE_MANAGEMENT,
              tokensUsed: 0,
              executionTimeMs: processingTimeMs,
              wasFAQ: false,
              isBlocked: false,
              _assistantMessageId: savedMessages.assistantMessageId,
              _languageChanged: resolvedLangCode,
            } as any
          } catch (error) {
            logger.error("❌ [ChatEngine] changeLanguage failed (informational)", { error })
            // Fall through to INFO_AGENT on error
          }
        }
        // If no valid language detected, fall through to INFO_AGENT which can call changeLanguage via function calling
      }
    } catch (intentError) {
      logger.warn("⚠️ [ChatEngine] Intent parsing failed in informational flow, continuing to INFO_AGENT", {
        error: (intentError as Error).message,
      })
    }

    const customer = await this.prisma.customers.findFirst({
      where: { id: input.customerId, workspaceId: input.workspaceId },
      select: {
        name: true,
        email: true,
        phone: true,
        language: true,
        discount: true,
      },
    })

    const customerName = input.customerName || customer?.name || "Cliente"
    const customerLanguage =
      input.customerLanguage || customer?.language || "en"

    let agentResponse = {
      success: false,
      output: "",
      tokensUsed: 0,
      executionTimeMs: 0,
      functionCalls: [],
    }

    try {
      // 🔄 Task 1.1: Rewire to UnifiedChatRouter → LLMRouterService
      // Gains: conversation history (20min), booking functions from DB, multi-function loop (8 iterations)
      const llmResponse = await this.unifiedChatRouter.routeMessage({
        workspaceId: input.workspaceId,
        customerId: input.customerId,
        conversationId,
        messageId: `${conversationId}-info-${Date.now()}`,
        message: input.message,
        customerName,
        customerLanguage,
        customerDiscount: customer?.discount || 0,
        channel: input.channel,
        registrationPromptLevel: input.registrationPromptLevel,
        skipTranslation: true, // ChatEngine wrapper handles translation + security
      })

      agentResponse = {
        success: !!llmResponse.response,
        output: llmResponse.response || "",
        tokensUsed: llmResponse.tokensUsed || 0,
        executionTimeMs: llmResponse.executionTimeMs || 0,
        functionCalls: [],
      }
    } catch (error) {
      logger.error("❌ [ChatEngine] Informational support agent failed", {
        workspaceId: input.workspaceId,
        customerId: input.customerId,
        error: error.message,
      })
    }

    let totalTokens = agentResponse.tokensUsed || 0
    let finalMessage = agentResponse.output

    if (!agentResponse.success || !finalMessage) {
      // 🔒 SECURITY FIX: NEVER expose botIdentityResponse in fallback!
      // botIdentityResponse is internal admin config — leaking it is a prompt injection vector.
      // Use a safe generic message instead. Log the error details for debugging.
      logger.warn("⚠️ [ChatEngine] Informational agent returned no output — using safe fallback", {
        workspaceId: input.workspaceId,
        customerId: input.customerId,
        agentSuccess: agentResponse.success,
        hadOutput: !!agentResponse.output,
        message: input.message,
      })

      const agentName = workspaceConfig.name || "eChatbot"
      const fallbackSupport = workspaceConfig.hasHumanSupport && workspaceConfig.adminEmail
        ? `\n\nSe preferisci, puoi contattarci a ${workspaceConfig.adminEmail}.`
        : ""
      finalMessage = `Ciao! Sono l'assistente di ${agentName}. Al momento non sono riuscito a elaborare la tua richiesta. Puoi riformulare la domanda?${fallbackSupport}`
    }

    // 🆕 FLOW: Prepend welcome prefix to response so customer gets
    // "Hi! I'm Sofia...\n\nTell me what's happening with your appliance..."
    if (welcomePrefix && finalMessage) {
      finalMessage = welcomePrefix + "\n\n" + finalMessage
      logger.info("🔄 [ChatEngine] Prepended welcome prefix to FLOW response", {
        workspaceId: input.workspaceId,
        welcomePrefixLength: welcomePrefix.length,
        finalMessageLength: finalMessage.length,
      })
    }

    debugSteps.push({
      type: "sub_agent",
      agent: "Info Agent",
      timestamp: new Date().toISOString(),
      input: {
        userMessage: input.message,
        customerLanguage,
      },
      output: {
        textResponse: finalMessage,
        functionCalls: agentResponse.functionCalls || [],
      },
      tokenUsage: {
        promptTokens: 0,
        completionTokens: agentResponse.tokensUsed || 0,
        totalTokens: agentResponse.tokensUsed || 0,
      },
      executionTimeMs: agentResponse.executionTimeMs || 0,
    })

    // 🔄 Task 1.1: Registration reminder, translation, and security are handled by
    // the routeMessage() wrapper (lines ~1690-1782) — removed here to prevent double-processing.

    const messageBeforeReplacement = finalMessage
    const replacementResult = await this.linkReplacementService.replaceTokens(
      { response: finalMessage, linkType: "auto" },
      input.customerId,
      input.workspaceId
    )

    if (replacementResult.success && replacementResult.response) {
      finalMessage = replacementResult.response
      if (messageBeforeReplacement !== finalMessage) {
        debugSteps.push({
          type: "link-replacement",
          agent: "🔗 Link Replacement",
          timestamp: new Date().toISOString(),
          input: {
            textContent: "Scanning for [LINK_*] placeholders",
          },
          output: {
            textContent: "Tokens replaced with secure URLs",
          },
        })
      }
    }

    const processingTimeMs = Date.now() - startTime

    const savedMessages = await this.messagePersistence.saveMessages(
      input.workspaceId,
      input.customerId,
      conversationId,
      input.message,
      finalMessage,
      AgentType.INFO_AGENT,
      totalTokens,
      {
        steps: debugSteps,
        totalTokens,
        executionTimeMs: processingTimeMs,
      }
    )

    return {
      message: finalMessage,
      agentType: AgentType.INFO_AGENT,
      wasHandled: true,
      intent: "ASK_FAQ",
      confidence: "HIGH",
      source: "LLM_FALLBACK",
      processingTimeMs,
      debugInfo: {
        steps: debugSteps,
        totalTokens,
        executionTimeMs: processingTimeMs,
      },
      response: finalMessage,
      agentUsed: AgentType.INFO_AGENT,
      tokensUsed: totalTokens,
      executionTimeMs: processingTimeMs,
      wasFAQ: false,
      isBlocked: false,
      _assistantMessageId: savedMessages?.assistantMessageId,
    }
  }

  private async handleExpiredNumericSelection(params: {
    input: ChatEngineInput
    workspaceConfig: WorkspaceConfig
    conversationId: string
    chatSessionId?: string
    startTime: number
    debugSteps: DebugStep[]
  }): Promise<ChatEngineOutput> {
    const { input, workspaceConfig, conversationId, chatSessionId, startTime, debugSteps } = params
    const customerName = input.customerName || "Cliente"

    const history = await this.conversationManager.loadHistory(
      input.workspaceId,
      conversationId
    )

    const showIntent: Intent = { type: "SHOW_CATEGORIES" } as Intent
    const loadedData = await this.dataLoader.loadForIntent(
      showIntent,
      input.workspaceId,
      input.customerId,
      input.customerDiscount,
      false
    )

    const structuredResponse = this.responseBuilder.build(showIntent, loadedData, {
      workspaceId: input.workspaceId,
      customerLanguage: input.customerLanguage || "en",
      customerName: input.customerName,
      customerDiscount: input.customerDiscount,
      userMessage: input.message,
      enableCategoryRanking: workspaceConfig.channelMode === "ECOMMERCE",
    })

    const formatterResult = await this.formatWithCustomRules(
      structuredResponse,
      input.customerLanguage || "en",
      workspaceConfig,
      undefined,
      { customerName: input.customerName, isFirstMessage: history.length === 0 }
    )

    let finalMessage = `Bentornato ${customerName}, come posso esserti utile oggi?\n\n${formatterResult.text}`
    const messageBeforeReplacement = finalMessage
    const replacementResult = await this.linkReplacementService.replaceTokens(
      { response: finalMessage, linkType: "auto" },
      input.customerId,
      input.workspaceId
    )
    if (replacementResult.success && replacementResult.response) {
      finalMessage = replacementResult.response
      if (finalMessage !== messageBeforeReplacement) {
        debugSteps.push({
          type: "link-replacement",
          agent: "🔗 Link Replacement",
          timestamp: new Date().toISOString(),
          input: { textContent: "Scanning for [LINK_*] placeholders" },
          output: { textContent: "Tokens replaced with secure URLs" },
        })
      }
    }

    const responseWithSkus = finalMessage
    finalMessage = finalMessage
      .replace(/\s*\[SKU:[A-Z0-9-]+\]/gi, "")
      .replace(/\s*\[SKUS?:[A-Z0-9-,]+\]/gi, "")

    const itemsWithSkus = structuredResponse.data?.items?.map((item: any) => ({
      number: item.number,
      name: item.name,
      sku: item.sku,
      id: item.id,
    }))

    await this.optionsMappingService.saveMapping({
      workspaceId: input.workspaceId,
      conversationId,
      customerId: input.customerId,
      responseText: responseWithSkus,
      items: itemsWithSkus,
      listType: "CATEGORIES",
    })

    // FIX: Set FSM state to BROWSING_CATEGORIES so the next numeric input
    // (e.g. user sends "4" to select a category) is resolved correctly.
    // Without this, state remains IDLE and the next number triggers another
    // re-greeting loop instead of selecting the category.
    if (chatSessionId) {
      await this.conversationStateService.setState(
        chatSessionId,
        ConversationState.BROWSING_CATEGORIES,
        {}
      )
    }

    const processingTimeMs = Date.now() - startTime
    const savedMessages = await this.messagePersistence.saveMessages(
      input.workspaceId,
      input.customerId,
      conversationId,
      input.message,
      finalMessage
    )

    return {
      message: finalMessage,
      agentType: AgentType.PRODUCT_SEARCH,
      wasHandled: true,
      intent: "SHOW_CATEGORIES",
      confidence: "HIGH",
      source: "PATTERN",
      processingTimeMs,
      debugInfo: {
        loadedDataType: loadedData.type,
        responseType: structuredResponse.type,
        llmUsed: !formatterResult.cached,
        steps: debugSteps,
        totalTokens: formatterResult.tokensUsed || 0,
        executionTimeMs: processingTimeMs,
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

  /**
   * Map intent type to AgentType for logging/analytics
   * 🔒 Feature 174: Informational workspaces route e-commerce intents to INFO_AGENT with FAQ
   */
  private mapIntentToAgentType(intentType: string, workspaceConfig?: WorkspaceConfig): AgentType {
    // 🆕 If informational workspace + e-commerce intent → route to INFO_AGENT (has FAQ in template)
    if (
      workspaceConfig &&
      workspaceConfig.channelMode !== "ECOMMERCE" &&
      this.isEcommerceIntent(intentType)
    ) {
      return AgentType.INFO_AGENT
    }

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
      ASK_BUSINESS_INFO: AgentType.CUSTOMER_SUPPORT,  // 🆕 "che settore?", "che tipo di negozio?"
      ASK_CONTACT: AgentType.CUSTOMER_SUPPORT,
      REQUEST_HUMAN: AgentType.CUSTOMER_SUPPORT,
      ASK_HOURS: AgentType.CUSTOMER_SUPPORT,
      ASK_SHIPPING: AgentType.CUSTOMER_SUPPORT,
      ASK_PAYMENT: AgentType.CUSTOMER_SUPPORT,
      ASK_HELP: AgentType.CUSTOMER_SUPPORT,

      // Profile intents
      VIEW_PROFILE: AgentType.PROFILE_MANAGEMENT,
      UPDATE_PROFILE: AgentType.PROFILE_MANAGEMENT,
      CHANGE_LANGUAGE: AgentType.PROFILE_MANAGEMENT,

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
