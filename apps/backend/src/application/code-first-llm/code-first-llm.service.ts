/**
 * Code-First LLM Service - Main Orchestrator
 *
 * CORE PRINCIPLE: "Codice decide, LLM formatta"
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
// INPUT/OUTPUT TYPES
// ================================================================================

export interface CodeFirstLLMInput {
  message: string
  customerId: string
  workspaceId: string
  conversationId?: string
  customerName?: string
  customerLanguage?: string
  customerDiscount?: number
}

export interface CodeFirstLLMOutput {
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

export class CodeFirstLLMService {
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
  async routeMessage(input: CodeFirstLLMInput): Promise<CodeFirstLLMOutput> {
    const startTime = Date.now()

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
      // STEP 0.75: FAST-PATH - Resolve numeric selections from options mapping
      // ========================================================================
      // If user typed a number, load options mapping from DB and resolve directly
      if (preprocessResult.inputType === "number" && preprocessResult.extractedNumber) {
        const optionsMapping = await this.optionsMappingService.loadMapping(
          input.workspaceId,
          conversationId
        )
        
        // 🆕 PRIORITY 1: Check groupMapping first (for smart grouping like "Formaggi Freschi")
        // This contains the SKUs for each numbered group created by LLM
        if (optionsMapping?.groupMapping) {
          const groupKey = String(preprocessResult.extractedNumber)
          const selectedGroup = optionsMapping.groupMapping[groupKey]
          
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
                input.conversationId,
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
            
            if (structuredResponse.type !== "NO_RESULTS" && structuredResponse.type !== "ERROR") {
              const formattedResult = await this.formatWithCustomRules(
                structuredResponse,
                input.customerLanguage || "it",
                workspaceConfig
              )
              finalMessage = formattedResult.text
              llmUsed = !formattedResult.cached
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
              input.conversationId,
              input.message,
              finalMessage
            )
            
            // Save options mapping for next selection
            await this.optionsMappingService.saveMapping({
              workspaceId: input.workspaceId,
              conversationId,
              customerId: input.customerId,
              responseText: responseWithSkus,
            })
            
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
      const history = input.conversationId
        ? await this.conversationManager.loadHistory(input.workspaceId, input.conversationId)
        : []

      logger.debug("📜 [CodeFirstLLM] History loaded", { historyLength: history.length })

      // ========================================================================
      // STEP 2: Parse intent using ORIGINAL message for pattern matching
      // ========================================================================
      // IMPORTANT: Use original message (not enriched) for pattern matching!
      // The enriched message has "[SELECTION: User typed "1"...]" which breaks ^(\d+)$ patterns
      // The IntentParser will use lastAssistantMessage to resolve numeric selections
      const lastAssistantMessage = history.length > 0 
        ? history.filter(h => h.role === "assistant").pop()?.content
        : undefined

      const intentResult = await this.intentParser.parse(input.message, {
        workspaceId: input.workspaceId,
        customerId: input.customerId,
        lastAssistantMessage,
        conversationHistory: history.map((h) => ({ role: h.role, content: h.content })),
      })

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
            const processingTimeMs = Date.now() - startTime
            const rejectMessage = "Ok, nessun problema! Posso aiutarti con altro?"
            
            await this.saveMessages(
              input.workspaceId,
              input.customerId,
              input.conversationId,
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
            const cartAgent = new CartManagementAgentLLM(this.prisma)
            const cartResponse = await cartAgent.handleQuery({
              workspaceId: input.workspaceId,
              customerId: input.customerId,
              query: `aggiungi ${quantity} ${pendingAction.productName || "prodotto"} al carrello`,
              customerName: input.customerName || "",
              customerLanguage: input.customerLanguage || "it",
            })
            
            const processingTimeMs = Date.now() - startTime
            
            await this.saveMessages(
              input.workspaceId,
              input.customerId,
              input.conversationId,
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
            input.conversationId,
            input.message,
            cartResponse.output
          )
          
          // 🆕 Save VIEW_CART as pending action (in case user says "si" to "Vuoi vedere il carrello?")
          const pendingConversationId = input.conversationId || `temp-${input.customerId}`
          await this.optionsMappingService.setPendingAction({
            workspaceId: input.workspaceId,
            conversationId: pendingConversationId,
            pendingAction: { type: "VIEW_CART" },
          })
          logger.info("🛒 [CodeFirstLLM] Set pending VIEW_CART action after cart operation")
          
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
            input.conversationId,
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
          input.conversationId,
          input.message,
          responseMessage
        )

        // Set pending action for checkout (VIEW_CART first to review)
        const pendingConversationId = input.conversationId || `temp-${input.customerId}`
        await this.optionsMappingService.setPendingAction({
          workspaceId: input.workspaceId,
          conversationId: pendingConversationId,
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
      const loadedData = await this.dataLoader.loadForIntent(
        intentResult.intent,
        input.workspaceId,
        input.customerId,
        input.customerDiscount || 0
      )

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

      // ========================================================================
      // STEP 6: Replace tokens/links
      // ========================================================================
      const replacementParams: ReplaceLinkWithTokenParams = {
        response: finalMessage,
        linkType: "auto",
      }
      const replacementResult = await this.linkReplacementService.replaceTokens(
        replacementParams,
        input.customerId,
        input.workspaceId
      )
      if (replacementResult.success && replacementResult.response) {
        finalMessage = replacementResult.response
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
      const agentType = this.mapIntentToAgentType(intentResult.intent.type)

      const processingTimeMs = Date.now() - startTime

      logger.info("✅ [CodeFirstLLM] Processing complete", {
        intent: intentResult.intent.type,
        agentType,
        llmUsed,
        totalTimeMs: processingTimeMs,
      })

      // ========================================================================
      // STEP 8: Save messages to conversation history
      // ========================================================================
      await this.saveMessages(
        input.workspaceId,
        input.customerId,
        input.conversationId,
        input.message,
        finalMessage
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
            productId: product.id,
            productName: product.name,
            quantity: 1,
          },
        })
        logger.info("🛒 [CodeFirstLLM] Set pending ADD_TO_CART action", {
          productId: product.id,
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
        debugInfo: {
          loadedDataType: loadedData.type,
          responseType: structuredResponse.type,
          llmUsed,
        },
        // Legacy fields for webhook compatibility
        response: finalMessage,
        agentUsed: agentType,
        tokensUsed: 0, // Code-first uses minimal tokens
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
   */
  private async saveMessages(
    workspaceId: string,
    customerId: string,
    conversationId: string,
    userMessage: string,
    assistantMessage: string
  ): Promise<void> {
    try {
      // Save user message
      await this.conversationManager.saveUserMessage({
        workspaceId,
        customerId,
        conversationId,
        content: userMessage,
      })
      
      // Save assistant response
      await this.conversationManager.saveAssistantMessage({
        workspaceId,
        customerId,
        conversationId,
        content: assistantMessage,
      })
      
      logger.debug("💾 [CodeFirstLLM] Messages saved to history")
    } catch (error) {
      // Don't fail the request if saving fails
      logger.error("❌ [CodeFirstLLM] Failed to save messages", { error })
    }
  }

  // ================================================================================
}

// ================================================================================
// SINGLETON
// ================================================================================

let codeFirstLLMInstance: CodeFirstLLMService | null = null

export function getCodeFirstLLM(prisma: PrismaClient): CodeFirstLLMService {
  if (!codeFirstLLMInstance) {
    codeFirstLLMInstance = new CodeFirstLLMService(prisma)
  }
  return codeFirstLLMInstance
}
