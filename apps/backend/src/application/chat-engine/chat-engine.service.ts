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
  }
  output?: {
    decision?: string
    functionCall?: { name: string; arguments: any } | string
    textResponse?: string
    result?: any
    executionTimeMs?: number
    textContent?: string
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
  private intentParser: IntentParserService
  private dataLoader: DataLoaderService
  private responseBuilder: ResponseBuilderService
  private llmFormatter: LLMFormatterService
  private conversationManager: ConversationManager
  private linkReplacementService: LinkReplacementService
  private optionsMappingService: OptionsMappingService
  private systemContextService: SystemContextService

  constructor(private prisma: PrismaClient) {
    this.intentParser = getIntentParser(prisma)
    this.dataLoader = getDataLoader(prisma)
    this.responseBuilder = getResponseBuilder(prisma)
    this.llmFormatter = getLLMFormatter(prisma)
    this.conversationManager = new ConversationManager(prisma)
    this.linkReplacementService = new LinkReplacementService()
    this.optionsMappingService = getOptionsMappingService(prisma)
    this.systemContextService = getSystemContextService(prisma)
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
   * Main entry point - replaces LLMRouterService.routeMessage()
   */
  async routeMessage(input: ChatEngineInput): Promise<ChatEngineOutput> {
    const startTime = Date.now()
    
    // 🆕 Initialize debug steps for Message Flow Timeline
    const debugSteps: DebugStep[] = []
    let totalTokens = 0

    logger.info("🚀 [CodeFirstLLM] Processing message", {
      customerId: input.customerId,
      workspaceId: input.workspaceId,
      messagePreview: input.message.substring(0, 50),
    })

    try {
      // ========================================================================
      // STEP 0: Load workspace config
      // ========================================================================
      const workspaceConfig = await this.loadWorkspaceConfig(input.workspaceId)
      
      logger.info("⚙️ [CodeFirstLLM] Workspace config", {
        sellsProducts: workspaceConfig.sellsProductsAndServices,
        hasSalesAgents: workspaceConfig.hasSalesAgents,
      })

      // ========================================================================
      // STEP 0.5: Preprocess short inputs (numbers, yes/no)
      // ========================================================================
      // The preprocessor only DETECTS patterns and ENRICHES the message
      // The LLM does the actual work with conversation history
      
      const conversationId = input.conversationId || `temp-${input.customerId}`
      
      logger.debug("🔍 [CodeFirstLLM] Processing message", {
        conversationId,
        message: input.message.substring(0, 50),
      })

      // Preprocess: detect short inputs and enrich message for LLM
      const preprocessResult = messagePreprocessorService.process(input.message)

      logger.info("🔍 [CodeFirstLLM] Preprocess result", {
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
          logger.info("🛒 [CodeFirstLLM] FAST-PATH: Confirmation detected with pending ADD_TO_CART", {
            inputType: preprocessResult.inputType,
            extractedQuantity: preprocessResult.extractedQuantity,
            productId: pendingAction.productId,
            productName: pendingAction.productName,
          })
          
          // Extract quantity: from message if present, otherwise default to 1
          const quantity = preprocessResult.extractedQuantity || pendingAction.quantity || 1
          
          // Delegate to CartManagementAgentLLM with selectedSku
          const cartAgent = new CartManagementAgentLLM(this.prisma)
          const cartResponse = await cartAgent.handleQuery({
            workspaceId: input.workspaceId,
            customerId: input.customerId,
            query: `aggiungi ${quantity} ${pendingAction.productName || "prodotto"} al carrello`,
            customerName: input.customerName || "",
            customerLanguage: input.customerLanguage || "it",
            selectedSku: pendingAction.productId, // SKU for precise cart addition
          })
          
          // 🧹 CRITICAL: Clear pendingAction after execution to prevent re-use
          await this.optionsMappingService.clearPendingAction(conversationId)
          logger.info("🧹 [CodeFirstLLM] Cleared pendingAction after ADD_TO_CART execution")
          
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
              llmUsed: true,
              fastPath: "CONFIRMATION_WITH_QUANTITY",
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
            logger.info("🎯 [CodeFirstLLM] FAST-PATH: Using groupMapping to resolve selection", {
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
              
              // Save new options mapping (for next selection if user picks a product)
              await this.optionsMappingService.saveMapping({
                workspaceId: input.workspaceId,
                conversationId,
                customerId: input.customerId,
                responseText: formatterResult.text,
                groupMapping: formatterResult.groupMapping,
              })
              
              logger.info("✅ [CodeFirstLLM] FAST-PATH groupMapping complete", {
                groupName: selectedGroup.nome,
                productsReturned: products.length,
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
                },
                response: finalMessage,
                agentUsed: AgentType.PRODUCT_SEARCH,
                tokensUsed: formatterResult.tokensUsed,
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
            logger.info("🎯 [CodeFirstLLM] FAST-PATH: Resolved selection from options mapping", {
              number: preprocessResult.extractedNumber,
              label: selectedOption.label,
              skus: selectedOption.skus,
              listType: optionsMapping.listType,
            })
            
            // Create SELECT_OPTION intent with SKUs
            const selectIntent: import("../intent/intent.types").SelectOptionIntent = {
              type: "SELECT_OPTION",
              number: preprocessResult.extractedNumber,
              resolvedValue: selectedOption.label,
              listType: (optionsMapping.listType as import("../intent/intent.types").ListType) || "CATEGORIES",
              skus: selectedOption.skus,
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
            await this.optionsMappingService.saveMapping({
              workspaceId: input.workspaceId,
              conversationId,
              customerId: input.customerId,
              responseText: responseWithSkus,
              groupMapping: groupMappingFromFormatter,
            })
            
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
              logger.info("🛒 [CodeFirstLLM] FAST-PATH: Set pending ADD_TO_CART action", {
                productId: product.sku || product.id,
                productName: product.name,
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
              },
              response: finalMessage,
              agentUsed: agentType,
              tokensUsed: 0,
              executionTimeMs: processingTimeMs,
              wasFAQ: false,
              isBlocked: false,
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

      logger.debug("📜 [CodeFirstLLM] History loaded", { 
        historyLength: history.length,
        conversationId,
        usedInputConversationId: !!input.conversationId,
      })

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

      logger.info("🎯 [CodeFirstLLM] Intent detected", {
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
        
        logger.info("🔄 [CodeFirstLLM] UNKNOWN intent after LLM fallback - trying semantic product search", {
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
          logger.info("🧹 [CodeFirstLLM] Clearing stale pendingAction - intent changed", {
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
          
          logger.info("✅ [CodeFirstLLM] Processing CONFIRM/REJECT with pendingAction", {
            intentType: intentResult.intent.type,
            actionType: pendingAction.type,
            productId: pendingAction.productId,
            productName: pendingAction.productName,
          })
          
          if (intentResult.intent.type === "REJECT") {
            // User said "no" - clear pending action and acknowledge
            // 🧹 CRITICAL: Clear pendingAction after rejection
            await this.optionsMappingService.clearPendingAction(conversationId)
            logger.info("🧹 [CodeFirstLLM] Cleared pendingAction after REJECT")
            
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
                llmUsed: false,
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
            // Extract quantity from message if present (e.g., "sì, 2 pezzi")
            const quantityMatch = input.message.match(/(\d+)\s*(pezz[oi]|unit[aà]|x)?/i)
            const quantity = quantityMatch ? parseInt(quantityMatch[1]) : (pendingAction.quantity || 1)
            
            // Delegate to CartManagementAgentLLM for intelligent cart handling
            // 🔧 CRITICAL: Pass selectedSku so CartManagementAgent knows EXACTLY which product to add
            const cartAgent = new CartManagementAgentLLM(this.prisma)
            const cartResponse = await cartAgent.handleQuery({
              workspaceId: input.workspaceId,
              customerId: input.customerId,
              query: `aggiungi ${quantity} ${pendingAction.productName || "prodotto"} al carrello`,
              customerName: input.customerName || "",
              customerLanguage: input.customerLanguage || "it",
              selectedSku: pendingAction.productId, // 🔧 SKU for precise cart addition
            })
            
            // 🧹 CRITICAL: Clear pendingAction after execution
            await this.optionsMappingService.clearPendingAction(conversationId)
            logger.info("🧹 [CodeFirstLLM] Cleared pendingAction after ADD_TO_CART execution (STEP 2.6)")
            
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
            logger.info("✅ [CodeFirstLLM] CONFIRM_ORDER → START_CHECKOUT")
          }
        } else if (intentResult.intent.type === "CONFIRM") {
          // 🎯 CONTEXT-AWARE CONFIRM: No pendingAction, but user said "sì"
          // Look at the last assistant message to understand what we're confirming
          const lastAssistantMessage = history
            .filter(h => h.role === "assistant")
            .pop()?.content?.toLowerCase() || ""
          
          logger.info("🔍 [CodeFirstLLM] CONFIRM without pendingAction - checking context", {
            lastAssistantMessagePreview: lastAssistantMessage.substring(0, 100),
          })
          
          // If bot asked "Vuoi vedere i nostri prodotti?" → show categories
          if (lastAssistantMessage.includes("prodotti") || 
              lastAssistantMessage.includes("catalogo") ||
              lastAssistantMessage.includes("categorie")) {
            logger.info("🎯 [CodeFirstLLM] Context: User wants to see products → SHOW_CATEGORIES")
            intentResult.intent = { type: "SHOW_CATEGORIES" }  // 🔧 Use correct intent type
          }
          // If bot asked "Vuoi vedere il carrello?" → show cart
          else if (lastAssistantMessage.includes("carrello")) {
            logger.info("🎯 [CodeFirstLLM] Context: User wants to see cart → VIEW_CART")
            intentResult.intent = { type: "VIEW_CART" }
          }
          // If bot asked "Vuoi procedere con l'ordine?" → start checkout
          else if (lastAssistantMessage.includes("ordine") || lastAssistantMessage.includes("checkout")) {
            logger.info("🎯 [CodeFirstLLM] Context: User wants to checkout → START_CHECKOUT")
            intentResult.intent = { type: "START_CHECKOUT" }
          }
          // Default: show categories (most common case)
          else {
            logger.info("🎯 [CodeFirstLLM] Context: Unknown, defaulting to SHOW_CATEGORIES")
            intentResult.intent = { type: "SHOW_CATEGORIES" }  // 🔧 Use correct intent type
          }
        }
      }

      // ========================================================================
      // STEP 2.5: Check if e-commerce intent is allowed
      // ========================================================================
      if (this.isEcommerceIntent(intentResult.intent.type) && !workspaceConfig.sellsProductsAndServices) {
        // E-commerce not enabled - redirect to support response
        logger.info("🚫 [CodeFirstLLM] E-commerce disabled, redirecting to support", {
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
          logger.info("🛒 [CodeFirstLLM] ADD_TO_CART needs LLM intelligence - delegating to CartManagementAgentLLM", {
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
        
        logger.info("🔄 [CodeFirstLLM] REPEAT_ORDER intent detected", {
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

        logger.info("🔄 [CodeFirstLLM] REPEAT_ORDER completed", {
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

      logger.info("📦 [CodeFirstLLM] Data loaded", { type: loadedData.type })

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
        }
      )

      logger.info("🏗️ [CodeFirstLLM] Response built", { type: structuredResponse.type })

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
      await this.saveMessages(
        input.workspaceId,
        input.customerId,
        conversationId,  // 🔧 Use conversationId for consistent history
        input.message,
        finalMessage,
        agentType,
        totalTokens,
        debugInfo  // 🆕 Pass debugInfo for Message Flow Dialog
      )

      // ========================================================================
      // STEP 9: 🆕 Save options mapping for FAST-PATH on next message
      // Uses responseWithSkus to preserve SKU info for selection resolution
      // 🆕 Also passes groupMapping from LLM for smart grouping resolution
      // ========================================================================
      await this.optionsMappingService.saveMapping({
        workspaceId: input.workspaceId,
        conversationId,
        customerId: input.customerId,
        responseText: responseWithSkus, // Use response WITH SKUs for mapping
        groupMapping, // 🆕 Pass LLM-generated group mapping if available
      })

      // Log if we saved a group mapping
      if (groupMapping) {
        logger.info("🗂️ [CodeFirstLLM] Saved smart grouping mapping", {
          conversationId,
          groups: Object.keys(groupMapping),
          example: Object.entries(groupMapping)[0],
        })
      }

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
        logger.info("🛒 [CodeFirstLLM] Set pending ADD_TO_CART action", {
          productId: product.sku || product.id,
          productName: product.name,
        })
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
        debugInfo,  // 🆕 Already built above, includes timeline steps
        // Legacy fields for webhook compatibility
        response: finalMessage,
        agentUsed: agentType,
        tokensUsed: totalTokens,
        executionTimeMs: processingTimeMs,
        wasFAQ: false,
        isBlocked: false,
      }
    } catch (error) {
      logger.error("❌ [CodeFirstLLM] Error processing message", { error })
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
    const messages: Record<string, string> = {
      it: "Mi dispiace, al momento non gestiamo vendite online. Posso aiutarti con informazioni o supporto. Come posso assisterti?",
      en: "Sorry, we don't handle online sales at the moment. I can help you with information or support. How can I assist you?",
      es: "Lo siento, no gestionamos ventas en línea por el momento. Puedo ayudarte con información o soporte. ¿Cómo puedo asistirte?",
      pt: "Desculpe, não gerenciamos vendas online no momento. Posso ajudá-lo com informações ou suporte. Como posso ajudá-lo?",
    }
    return messages[language] || messages.it
  }

  /**
   * Save messages to conversation history
   * 🆕 Now includes debugInfo for Message Flow Dialog timeline
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
  ): Promise<void> {
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
      await this.conversationManager.saveAssistantMessage({
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
      })
    } catch (error) {
      // Don't fail the request if saving fails
      logger.error("❌ [ChatEngine] Failed to save messages", { error })
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
