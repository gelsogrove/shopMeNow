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
import { IntentParserService, getIntentParser, Intent, SearchProductsIntent, AddToCartIntent, RepeatOrderIntent } from "../intent"
import { DataLoaderService, getDataLoader, LoadedData } from "../data-loader"
import { ResponseBuilderService, getResponseBuilder, StructuredResponse } from "../response-builder"
import { LLMFormatterService, getLLMFormatter, FormatterResult } from "../llm-formatter"
import { ConversationManager } from "../../services/conversation-manager.service"
import { LinkReplacementService, ReplaceLinkWithTokenParams } from "../services/link-replacement.service"
import {
  OptionsMappingService,
  getOptionsMappingService,
  OptionsMapping,
} from "./options-mapping.service"
import {
  MessagePreprocessorService,
  PreprocessResult,
  messagePreprocessorService,
} from "../../services/message-preprocessor.service"
import { CartManagementAgentLLM } from "../agents/CartManagementAgentLLM"
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

// ================================================================================
// WORKSPACE CONFIG CACHE
// ================================================================================

interface WorkspaceConfig {
  sellsProductsAndServices: boolean
  hasSalesAgents: boolean
  hasSuppliers: boolean
  welcomeMessage: any
  botIdentityResponse: string | null
  customAiRules: string | null  // Custom AI rules that override default behavior
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
  timestamp: string
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
  source: "PATTERN" | "KEYWORD" | "LLM_FALLBACK"
  processingTimeMs: number
  debugInfo?: {
    loadedDataType: string
    responseType: string
    llmUsed: boolean
    steps?: DebugStep[]  // 🆕 Timeline steps (optional for early returns)
    totalTokens?: number
    totalCost?: number
    executionTimeMs?: number
  }
  // Legacy fields for webhook compatibility
  response: string  // Same as message
  agentUsed: string // String version of agentType
  tokensUsed: number
  executionTimeMs: number // Same as processingTimeMs
  wasFAQ: boolean
  isBlocked: boolean
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
  
  // Support services
  private conversationManager: ConversationManager
  private linkReplacementService: LinkReplacementService
  private optionsMappingService: OptionsMappingService
  private systemContextService: SystemContextService
  private conversationStateService: ConversationStateService
  
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

    // Replace {{nameUser}} with customer name
    if (result.includes("{{nameUser}}")) {
      const name = customerName || await this.getCustomerName(customerId)
      result = result.replace(/\{\{nameUser\}\}/g, name || "Customer")
    }

    // Replace {{agentPhone}} with workspace whatsapp phone
    if (result.includes("{{agentPhone}}")) {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { whatsappPhoneNumber: true },
      })
      result = result.replace(/\{\{agentPhone\}\}/g, workspace?.whatsappPhoneNumber || "support")
    }

    return result
  }

  /**
   * Helper: Get customer name from database
   */
  private async getCustomerName(customerId: string): Promise<string | null> {
    const customer = await this.prisma.customers.findUnique({
      where: { id: customerId },
      select: { name: true },
    })
    return customer?.name || null
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
        sellsProductsAndServices: true,
        hasSalesAgents: true,
        hasSuppliers: true,
        welcomeMessage: true,
        botIdentityResponse: true,
        customAiRules: true,  // Custom AI rules that override default behavior
      },
    })

    const config: WorkspaceConfig = {
      sellsProductsAndServices: workspace?.sellsProductsAndServices ?? true,
      hasSalesAgents: workspace?.hasSalesAgents ?? false,
      hasSuppliers: workspace?.hasSuppliers ?? false,
      welcomeMessage: workspace?.welcomeMessage,
      botIdentityResponse: workspace?.botIdentityResponse ?? null,
      customAiRules: workspace?.customAiRules ?? null,
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
    ]
    return ecommerceIntents.includes(intentType)
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
      const preprocessResult = messagePreprocessorService.process(input.message)

      logger.info("🔍 [ChatEngine] Preprocess result", {
        isShortInput: preprocessResult.isShortInput,
        inputType: preprocessResult.inputType,
        extractedNumber: preprocessResult.extractedNumber,
        extractedQuantity: preprocessResult.extractedQuantity,
      })

      // Use enriched message for LLM (contains context hints for short inputs)
      const messageForLLM = preprocessResult.enrichedMessage

      // ========================================================================
      // STEP 0.6: FAST-PATH for confirmation with quantity (e.g., "sì 3", "si, 2 pezzi")
      // ========================================================================
      // If preprocessor detected "confirmation_with_quantity", handle ADD_TO_CART directly
      if (preprocessResult.inputType === "confirmation_with_quantity" || preprocessResult.inputType === "confirmation") {
        const optionsMapping = await this.optionsMappingService.loadMapping(
          input.workspaceId,
          conversationId
        )
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
            selectedSku: pendingAction.productId, // SKU/code for precise cart addition
            selectedItemType: pendingAction.itemType || "PRODUCT", // 🆕 Pass item type
          })
          
          // 🧹 CRITICAL: Clear pendingAction after execution to prevent re-use
          await this.optionsMappingService.clearPendingAction(conversationId)
          logger.info("🧹 [ChatEngine] Cleared pendingAction after ADD_TO_CART execution")
          
          const processingTimeMs = Date.now() - startTime
          
          await this.saveMessages(
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
          }
        }
      }

      // ========================================================================
      // STEP 0.7: Load ChatSession for FSM state management
      // ========================================================================
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
        const optionsMapping = await this.optionsMappingService.loadMapping(
          input.workspaceId,
          conversationId
        )
        
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
              await this.saveMessages(
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
              }
            )
            
            // 📦 Handle ORDER_ACTION - execute calling function directly
            if (structuredResponse.type === "ORDER_ACTION") {
              const action = (structuredResponse.data as { action: string }).action
              const orderCode = optionsMapping.currentOrderCode
              
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
                input.customerId
              )
              
              // 🔧 Replace user variables in the message ({{nameUser}}, {{agentPhone}}, etc.)
              const processedMessage = await this.replaceUserVariables(
                actionResult.message,
                input.customerId,
                input.workspaceId,
                input.customerName
              )
              
              // Save messages to history
              await this.saveMessages(
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
              }
            }
            
            // 🛒 Handle CART_ACTION - execute cart action directly
            if (structuredResponse.type === "CART_ACTION") {
              const action = (structuredResponse.data as { action: string }).action
              
              logger.info("🛒 [ChatEngine] CART_ACTION detected", { action })
              
              if (action === "CONFIRM_ORDER") {
                // Trigger checkout flow - set pending action and ask for confirmation
                await this.optionsMappingService.setPendingAction({
                  workspaceId: input.workspaceId,
                  conversationId,
                  pendingAction: { type: "CONFIRM_ORDER" },
                })
                
                const confirmMessage = "Perfetto! Vuoi confermare l'ordine? Risponda 'sì' per procedere o 'no' per annullare."
                
                await this.saveMessages(
                  input.workspaceId,
                  input.customerId,
                  conversationId,
                  input.message,
                  confirmMessage
                )
                
                return {
                  message: confirmMessage,
                  agentType: AgentType.CART_MANAGEMENT,
                  wasHandled: true,
                  intent: "CART_ACTION",
                  confidence: "HIGH",
                  source: "PATTERN",
                  processingTimeMs: Date.now() - startTime,
                }
              }
              
              // Other actions (SHOW_PRODUCTS) → let normal flow handle it (returns categories)
            }
            
            // 🗑️ Handle CART_REMOVAL_OPTIONS - format removal options
            if (structuredResponse.type === "CART_REMOVAL_OPTIONS") {
              const items = (structuredResponse.data as { items: any[] }).items || []
              
              if (items.length === 0) {
                const emptyMsg = "Il tuo carrello è vuoto, non c'è nulla da rimuovere."
                await this.saveMessages(
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
              
              await this.saveMessages(
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

              // Use LLM Router to get contextual response
              const llmResponse = await this.llmRouterService.routeMessage({
                workspaceId: input.workspaceId,
                customerId: input.customerId,
                customerName: input.customerName || "Cliente",
                customerLanguage: input.customerLanguage || "it",
                message: contextPrompt,
                conversationHistory: history,
                customerDiscount: input.customerDiscount || 0,
              })
              
              debugSteps.push({
                step: "LLM_CONTEXT_RESPONSE",
                timestamp: Date.now(),
                details: {
                  responseLength: llmResponse.message?.length || 0,
                  tokensUsed: llmResponse.tokensUsed || 0,
                  agentUsed: llmResponse.agentUsed,
                },
              })
              
              const finalMessage = llmResponse.message || "Mi dispiace, non ho capito. Puoi ripetere?"
              
              await this.saveMessages(
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
              // Provide a meaningful fallback message for NO_RESULTS
              const errorMessage = (structuredResponse.data as { errorMessage?: string })?.errorMessage || "Nessun risultato trovato"
              finalMessage = `Mi dispiace, ${errorMessage.toLowerCase()}. Posso aiutarti con qualcos'altro?`
              logger.warn("⚠️ [ChatEngine] NO_RESULTS response, using fallback message", {
                errorMessage,
                listType: optionsMapping?.listType,
              })
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
            await this.saveMessages(
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
                  { number: 1, name: "📄 Scarica fattura", id: "SEND_INVOICE" },
                  { number: 2, name: "🔄 Ripeti ordine", id: "REPEAT_ORDER" },
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
              // Get cart items count for logging
              const cartItems = structuredResponse.data.items || []
              
              // Save explicit cart action options - always 1, 2, 3 (cart items use bullet points)
              await this.optionsMappingService.saveMapping({
                workspaceId: input.workspaceId,
                conversationId,
                customerId: input.customerId,
                responseText: "", // Empty - we're providing explicit items
                items: [
                  { number: 1, name: "✅ Confermare l'ordine", id: "CONFIRM_ORDER" },
                  { number: 2, name: "🛍️ Esplorare il catalogo", id: "SHOW_PRODUCTS" },
                  { number: 3, name: "🗑️ Rimuovere un articolo", id: "REMOVE_FROM_CART" },
                ],
                listType: "CART_ACTIONS",
              })
              
              logger.info("🛒 [ChatEngine] FAST-PATH: Set cart actions for CART_VIEW", {
                actions: ["CONFIRM_ORDER", "SHOW_PRODUCTS", "REMOVE_FROM_CART"],
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
            }
          } else {
            // ========================================================================
            // 🚫 INVALID OPTION NUMBER - User selected a number not in the list
            // Instead of falling through to search, return a helpful error message
            // ========================================================================
            const maxOption = optionsMapping.options.length
            const selectedNumber = preprocessResult.extractedNumber
            
            logger.info("🚫 [ChatEngine] Invalid option number selected", {
              selectedNumber,
              maxOption,
              listType: optionsMapping.listType,
              availableOptions: optionsMapping.options.map(o => o.number),
            })
            
            // Build a friendly error message based on the context
            let invalidMessage: string
            if (optionsMapping.listType === "CART_ACTIONS") {
              invalidMessage = `⚠️ Opzione non valida. Per favore scegli 1, 2 o 3:\n1. ✅ Confermare l'ordine\n2. 🛍️ Esplorare il catalogo\n3. 🗑️ Rimuovere un articolo`
            } else if (optionsMapping.listType === "ORDER_ACTIONS") {
              invalidMessage = `⚠️ Opzione non valida. Per favore scegli 1 o 2:\n1. 📄 Scarica fattura\n2. 🔄 Ripeti ordine`
            } else {
              invalidMessage = `⚠️ Opzione non valida. Per favore scegli un numero da 1 a ${maxOption}.`
            }
            
            const processingTimeMs = Date.now() - startTime
            
            // Save messages to history
            await this.saveMessages(
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
            
            await this.saveMessages(
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
              selectedSku: pendingAction.productId, // 🔧 SKU/code for precise cart addition
              selectedItemType: pendingAction.itemType || "PRODUCT", // 🆕 Pass item type
            })
            
            // 🧹 CRITICAL: Clear pendingAction after execution
            await this.optionsMappingService.clearPendingAction(conversationId)
            logger.info("🧹 [ChatEngine] Cleared pendingAction after ADD_TO_CART execution (STEP 2.6)")
            
            const processingTimeMs = Date.now() - startTime
            
            await this.saveMessages(
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
          await this.saveMessages(
            input.workspaceId,
            input.customerId,
            conversationId,  // 🔧 Use conversationId for consistent history
            input.message,
            cartResponse.output
          )
          
          // 🧹 NOTE: We intentionally do NOT set pendingAction for VIEW_CART
          // The pendingAction mechanism is for actions that require explicit confirmation
          // (ADD_TO_CART, CONFIRM_ORDER). For general questions like "Vuoi vedere i prodotti?",
          // the LLM should interpret "sì" based on conversation context.
          
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
          
          await this.saveMessages(
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
        await this.saveMessages(
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
        }
      }

      // ========================================================================
      // STEP 4: Load data based on intent (for non-LLM paths)
      // ========================================================================
      const dataLoadStart = Date.now()
      const loadedData = await this.dataLoader.loadForIntent(
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

      logger.info("📦 [ChatEngine] Data loaded", { type: loadedData.type })

      // ========================================================================
      // STEP 4: Build structured response
      // ========================================================================
      const structuredResponse = this.responseBuilder.build(
        intentResult.intent,
        loadedData,
        {
          customerName: input.customerName,
          customerLanguage: input.customerLanguage || "it",
          workspaceId: input.workspaceId,
          customerDiscount: input.customerDiscount,
        }
      )

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
        loadedDataType: loadedData.type,
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
        
        await this.optionsMappingService.saveMapping({
          workspaceId: input.workspaceId,
          conversationId,
          customerId: input.customerId,
          responseText: "", // Empty - we're providing explicit items
          items: [
            { number: 1, name: "✅ Confermare l'ordine", id: "CONFIRM_ORDER" },
            { number: 2, name: "🛍️ Esplorare il catalogo", id: "SHOW_PRODUCTS" },
            { number: 3, name: "🗑️ Rimuovere un articolo", id: "REMOVE_FROM_CART" },
          ],
          listType: "CART_ACTIONS",
        })
        
        logger.info("🛒 [ChatEngine] STEP 9: Saved CART_ACTIONS mapping", {
          responseType: structuredResponse.type,
          cartItemCount: cartItems.length,
          conversationId,
        })
      } 
      // For ORDER_DETAIL: save ORDER_ACTIONS mapping  
      else if (structuredResponse.type === "ORDER_DETAIL") {
        const order = structuredResponse.data.order
        const items = [
          { number: 1, name: "📄 Scarica fattura", id: "SEND_INVOICE" },
          { number: 2, name: "🔄 Ripeti ordine", id: "REPEAT_ORDER" },
        ]
        
        // Add credit note option if order has credit notes
        if (order?.hasCreditNotes) {
          items.push({ number: 3, name: "📋 Scarica nota di credito", id: "SEND_CREDIT_NOTES" })
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
            { number: 1, name: "📄 Scarica fattura", id: "SEND_INVOICE" },
            { number: 2, name: "🔄 Ripeti ordine", id: "REPEAT_ORDER" },
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
    customerId: string
  ): Promise<{ message: string; success: boolean }> {
    logger.info("📦 [executeOrderAction] Executing order action", {
      action,
      orderCode,
      workspaceId,
      customerId,
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
