/**
 * IntentParser Service - Code-First LLM Architecture
 * 
 * STEP 1 of the pipeline: Parse user message into typed Intent
 * 
 * Strategy (in priority order):
 * 1. Pattern matching (deterministic, < 1ms)
 * 2. Keyword matching against known entities from DB (< 10ms)
 * 3. LLM fallback for complex/ambiguous messages (< 500ms)
 * 
 * The LLM is ONLY used as a fallback, and even then it only classifies
 * the intent - it doesn't generate responses or call functions.
 */

import { PrismaClient } from "@echatbot/database"
import { 
  Intent, 
  IntentResult, 
  ConversationContext,
  UnknownIntent,
  IncomprehensibleIntent,
  SearchProductsIntent
} from "./intent.types"
import { matchAllPatterns } from "./patterns/pattern-matcher"
import { buildContextFromHistory, parseListFromMessage } from "./patterns/history-parser"
import { matchKnownEntities, KnownEntity } from "./patterns/keyword-matcher"
import logger from "../../utils/logger"

// =============================================================================
// TYPES
// =============================================================================

interface IntentParserConfig {
  enableLLMFallback: boolean
  llmFallbackThreshold: number  // Confidence threshold below which to use LLM
  maxLLMFallbackTimeMs: number
}

interface ParseOptions {
  workspaceId: string
  customerId?: string
  lastAssistantMessage?: string
  conversationHistory?: Array<{ role: string; content: string }>
}

// =============================================================================
// ENTITY CACHE
// =============================================================================

// Cache known entities per workspace (refreshed every 5 minutes)
const entityCache = new Map<string, {
  categories: KnownEntity[]
  products: KnownEntity[]
  services: KnownEntity[]
  timestamp: number
}>()

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// =============================================================================
// INTENT PARSER SERVICE
// =============================================================================

export class IntentParserService {
  private prisma: PrismaClient
  private config: IntentParserConfig

  constructor(prisma: PrismaClient, config?: Partial<IntentParserConfig>) {
    this.prisma = prisma
    this.config = {
      enableLLMFallback: config?.enableLLMFallback ?? true,
      llmFallbackThreshold: config?.llmFallbackThreshold ?? 0.5,
      maxLLMFallbackTimeMs: config?.maxLLMFallbackTimeMs ?? 3000, // 3 seconds for LLM classification
    }
  }

  /**
   * Parse user message into typed Intent
   * 
   * @param message - User message to parse
   * @param options - Parsing context (workspace, history, etc.)
   * @returns IntentResult with typed intent and metadata
   */
  async parse(message: string, options: ParseOptions): Promise<IntentResult> {
    const startTime = Date.now()
    
    logger.info(`🧠 IntentParser: Parsing message`, {
      message: message.substring(0, 50),
      workspaceId: options.workspaceId,
      hasHistory: !!options.lastAssistantMessage
    })

    // Build conversation context from history
    const context = buildContextFromHistory(options.lastAssistantMessage)

    // STEP 1: Pattern matching (highest priority, deterministic)
    const patternIntent = matchAllPatterns(message, context)
    if (patternIntent) {
      const result: IntentResult = {
        intent: patternIntent,
        confidence: "HIGH",
        source: "PATTERN",
        processingTimeMs: Date.now() - startTime
      }
      
      logger.info(`✅ IntentParser: Pattern match`, {
        intentType: patternIntent.type,
        processingTimeMs: result.processingTimeMs
      })
      
      return result
    }

    // STEP 2.5: 🔧 DETERMINISTIC SEARCH DETECTION (pre-LLM fix for specific product queries)
    // Handle cases like "avete [product]?", "vete [product]?", "do you have [product]?"
    const searchPatterns = [
      /^(a?vete|do you have|tienes?|avez[-\s]vous|haben sie)\s+(.+?)\s*[?]?$/i,
      /^(cerca|search|busca|cherche)\s+(.+)$/i,
      /^(.+?)\s+(fresc[aoe]?|fresh|fresco)\s*[?]?$/i  // "pasta fresca", "cheese fresh", etc.
    ]
    
    for (const pattern of searchPatterns) {
      const match = message.trim().match(pattern)
      if (match) {
        const query = match[2]?.trim() || match[1]?.trim()
        if (query && query.length > 1) {
          const searchIntent: SearchProductsIntent = { type: "SEARCH_PRODUCTS", query }
          const result: IntentResult = {
            intent: searchIntent,
            confidence: "HIGH",
            source: "PATTERN",
            processingTimeMs: Date.now() - startTime
          }
          
          logger.info(`✅ IntentParser: Deterministic search pattern`, {
            originalMessage: message,
            extractedQuery: query,
            pattern: pattern.source,
            processingTimeMs: result.processingTimeMs
          })
          
          return result
        }
      }
    }

    // STEP 2: Keyword matching against known entities
    // NOTE: Only use if confidence is VERY high (0.95+) to avoid false positives
    // that would block LLM intent detection for cart/order queries
    const entities = await this.loadKnownEntities(options.workspaceId)
    const keywordMatch = matchKnownEntities(message, entities)
    
    if (keywordMatch && keywordMatch.confidence >= 0.95) {
      const result: IntentResult = {
        intent: keywordMatch.intent,
        confidence: keywordMatch.confidence >= 0.9 ? "HIGH" : "MEDIUM",
        source: "KEYWORD",
        processingTimeMs: Date.now() - startTime
      }
      
      logger.info(`✅ IntentParser: Keyword match`, {
        intentType: keywordMatch.intent.type,
        matchedEntity: keywordMatch.matchedEntity.name,
        matchType: keywordMatch.matchType,
        confidence: keywordMatch.confidence,
        processingTimeMs: result.processingTimeMs
      })
      
      return result
    }

    // STEP 3: LLM fallback for complex/ambiguous messages
    if (this.config.enableLLMFallback) {
      try {
        const llmIntent = await this.llmFallback(message, context, options, entities)
        if (llmIntent) {
          const result: IntentResult = {
            intent: llmIntent,
            confidence: "MEDIUM",
            source: "LLM_FALLBACK",
            processingTimeMs: Date.now() - startTime
          }
          
          logger.info(`✅ IntentParser: LLM fallback`, {
            intentType: llmIntent.type,
            processingTimeMs: result.processingTimeMs
          })
          
          return result
        }
      } catch (error) {
        logger.error(`❌ IntentParser: LLM fallback failed`, { error })
        // Continue to UNKNOWN
      }
    }

    // STEP 4: Unknown intent (no match found)
    const unknownIntent: UnknownIntent = {
      type: "UNKNOWN",
      originalMessage: message
    }
    
    const result: IntentResult = {
      intent: unknownIntent,
      confidence: "LOW",
      source: "PATTERN", // No match
      processingTimeMs: Date.now() - startTime
    }
    
    logger.warn(`⚠️ IntentParser: No match found`, {
      message: message.substring(0, 50),
      processingTimeMs: result.processingTimeMs
    })
    
    return result
  }

  /**
   * Load known entities from database (cached)
   */
  private async loadKnownEntities(workspaceId: string): Promise<{
    categories: KnownEntity[]
    products: KnownEntity[]
    services: KnownEntity[]
  }> {
    const cached = entityCache.get(workspaceId)
    const now = Date.now()
    
    if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
      return cached
    }

    // Load from database - use correct Prisma model names
    const [categories, products, services] = await Promise.all([
      this.prisma.categories.findMany({
        where: { workspaceId, isActive: true },
        select: { id: true, name: true }
      }),
      this.prisma.products.findMany({
        where: { workspaceId, isActive: true },
        select: { id: true, name: true, sku: true }
      }),
      // 🆕 Load services from Services table
      this.prisma.services.findMany({
        where: { workspaceId, isActive: true },
        select: { id: true, name: true }
      })
    ])

    const entities = {
      categories: categories.map(c => ({ 
        id: c.id, 
        name: c.name, 
        type: "CATEGORY" as const 
      })),
      products: products.map(p => ({ 
        id: p.id, 
        name: p.name, 
        type: "PRODUCT" as const,
        aliases: p.sku ? [p.sku] : undefined  // SKU as alias
      })),
      services: services.map(s => ({ 
        id: s.id, 
        name: s.name, 
        type: "SERVICE" as const 
      })),
      timestamp: now
    }

    entityCache.set(workspaceId, entities)
    
    logger.debug(`📦 IntentParser: Loaded entities for workspace`, {
      workspaceId,
      categories: categories.length,
      products: products.length,
      services: services.length
    })

    return entities
  }

  /**
   * LLM fallback for complex intent classification
   * 
   * NOTE: This does NOT generate responses or call functions.
   * It ONLY classifies the intent into one of the predefined types.
   */
  private async llmFallback(
    message: string, 
    context: ConversationContext,
    options: ParseOptions,
    entities: { categories: KnownEntity[]; products: KnownEntity[]; services: KnownEntity[] }
  ): Promise<Intent | null> {
    // Build category list for the LLM to understand semantic mapping
    const categoryNames = entities.categories.map(c => c.name).join(", ")
    
    // Simple intent classification prompt
    const systemPrompt = `You are an intent classifier for an e-commerce chatbot.
Classify the user message into ONE of these intents.

TYPO TOLERANCE: Be robust to common typos and variations across ALL languages:
- Missing letters: common truncations and abbreviations
- Autocorrect errors: understand intended words despite typos
- Language mixing: handle multilingual queries
- Focus on SEMANTIC MEANING over perfect spelling in any language
- Understand context even with multiple typos or language variations

PRODUCT_SEARCH:
- SHOW_CATEGORIES - User wants to see all categories
- SHOW_CATEGORY:categoryName - User wants to see products in a specific category
- SHOW_PRODUCTS - User wants to see ALL products (lista prodotti, mostra prodotti, tutti i prodotti)
- SEARCH_PRODUCTS:query - User is searching for SPECIFIC products (not "all products")
- SHOW_OFFERS - User wants to see offers/discounts/promotions
- PRODUCT_CONTEXT:question - User is asking for context/info/advice about the CURRENT product being shown (specifications, compatibility, usage, availability, features, etc.) without asking to modify cart. Only use if the last assistant message (or conversation state) indicates they are viewing a product detail.

AVAILABLE CATEGORIES: ${categoryNames}
NOTE: Use semantic understanding to map user queries to actual categories.
The user may use synonyms, related terms, or different languages.
Map their intent to the matching category from the list above.

IMPORTANT: 
- "show all products", "lista prodotti", "mostrar productos" = SHOW_PRODUCTS
- "red shoes", "scarpe rosse", "zapatos rojos", "blue shirt", "camicia blu" = SEARCH_PRODUCTS:query
- Be robust to typos in ANY language: understand intent despite spelling errors
- When user asks for SPECIFIC products/items regardless of language or typos, use SEARCH_PRODUCTS
- When user asks for product advice/context while viewing a product, use PRODUCT_CONTEXT

CART:
- VIEW_CART - User wants to see their cart, check cart contents
- ADD_TO_CART:quantity:productName - User wants to add something to cart (extract quantity, default 1)
- REMOVE_FROM_CART:productName - User wants to remove a specific product from cart
- CLEAR_CART - User wants to empty/clear the entire cart
- CHECKOUT - User wants to proceed to checkout/confirm order
- EXAMPLES: "fammi vedere il carrello", "mostra il carrello", "show me my cart" → VIEW_CART

ORDERS:
- VIEW_ORDERS - User wants to see their orders
- ORDER_DETAILS:orderCode - User wants details of a specific order. If the user asks for "ultimo ordine", "last order", "ordine più recente" or similar without providing a code, return ORDER_DETAILS with NO parameter (the system will automatically fetch the latest order).
- REPEAT_ORDER - User wants to repeat/reorder a previous order

SERVICES:
- VIEW_SERVICES - User wants to see all available services (che servizi avete?, quali servizi?, servizi?)
- SHOW_SERVICE:serviceName - User wants details about a specific service

SUPPORT:
- ASK_IDENTITY - User asks who you are
- SHOW_AGENT_INFO - User wants to know their assigned sales agent
- ASK_LOCATION - User asks where the store is located
- ASK_FAQ:query - User has a question about policies, shipping, etc.
- VIEW_PROFILE - User asks about their discount, profile, or personal info
- REQUEST_HUMAN - User wants to talk to a human OR is frustrated/angry.
  • If the user sounds angry, frustrated, or repeatedly complains about issues (caps lock, "sono stufo", "pessimo servizio", "non funziona mai", damaged goods, etc.) respond with "REQUEST_HUMAN:frustration".
  • If they explicitly ask for a person/operator but are calm, use "REQUEST_HUMAN".

OTHER:
- CONFIRM - User is confirming something (yes, ok, sure)
- REJECT - User is rejecting/canceling something (no, cancel)
- GREETING - User is greeting (hello, hi, ciao)
- INCOMPREHENSIBLE - Message is gibberish, random characters, typos, or completely nonsensical (e.g., "asdfgh", "casdas", "xyzabc", "jjjjj", keyboard mashing). Use this when the message has NO discernible meaning in ANY language.
- UNKNOWN - The message seems like a real attempt at communication, but you can't determine the specific intent

CRITICAL DISTINCTION:
- "INCOMPREHENSIBLE" = The message is NOT a real word or sentence in any language (random characters, keyboard mashing, typos with no meaning)
- "UNKNOWN" = The message IS a real communication attempt, but you can't classify the intent

Respond with ONLY the intent type and parameter if needed.
Examples:
- "SHOW_CATEGORIES"
- "SHOW_CATEGORY:Electronics"
- "SEARCH_PRODUCTS:wireless headphones"
- "SHOW_OFFERS" (when user asks about offers, promotions, discounts, deals)
- "VIEW_SERVICES" (when user asks about available services)
- "SHOW_SERVICE:Shipping" (when user asks about a specific service)
- "ADD_TO_CART:2:iPhone Case"
- "REMOVE_FROM_CART:Laptop"
- "CLEAR_CART"
- "CHECKOUT"
- "VIEW_CART"
- "VIEW_ORDERS"
- "REPEAT_ORDER"
- "VIEW_PROFILE" (when user asks "che sconto ho?", "il mio sconto", "my discount")
- "ASK_FAQ:shipping policy"
- "SHOW_AGENT_INFO"
- "INCOMPREHENSIBLE" (when message is gibberish like "asdfgh", "casdas", "xyzabc123", random keystrokes)
- "UNKNOWN" (when message is a real communication but intent unclear)

${context.lastAssistantMessage ? `\nLast bot message: "${context.lastAssistantMessage.substring(0, 200)}..."` : ''}`

    try {
      // Use OpenRouter for classification
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
          ],
          temperature: 0,  // Deterministic
          max_tokens: 50   // Short response
        }),
        signal: AbortSignal.timeout(this.config.maxLLMFallbackTimeMs)
      })

      if (!response.ok) {
        throw new Error(`OpenRouter error: ${response.status}`)
      }

      const data = await response.json()
      const classification = data.choices?.[0]?.message?.content?.trim()
      
      // 🔍 DEBUG: Log LLM response for debugging
      logger.info("🔍 [IntentDebug] LLM classification response", {
        originalMessage: message,
        llmClassification: classification,
        rawResponse: data.choices?.[0]?.message?.content
      })
      
      if (!classification) {
        return null
      }

      // Parse classification into Intent
      return this.parseClassification(classification, message)
      
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        logger.warn(`⏱️ IntentParser: LLM fallback timed out`)
      } else {
        logger.error(`❌ IntentParser: LLM fallback error`, { error })
      }
      return null
    }
  }

  /**
   * Parse LLM classification string into Intent
   */
  private parseClassification(classification: string, originalMessage?: string): Intent | null {
    // Remove any surrounding quotes that the LLM might have added
    const cleanClassification = classification.replace(/^["'\s]+|["'\s]+$/g, "")
    const [intentType, ...rest] = cleanClassification.split(":")
    const param = rest.length ? rest.join(":") : undefined
    
    // 🔍 DEBUG: Log parsing details
    logger.info("🔍 [IntentDebug] Parsing LLM classification", {
      originalMessage: originalMessage?.substring(0, 100),
      rawClassification: classification,
      cleanClassification,
      intentType: intentType.trim().toUpperCase(),
      param
    })
    
    switch (intentType.trim().toUpperCase()) {
      case "SHOW_CATEGORIES":
        return { type: "SHOW_CATEGORIES" }
        
      case "SHOW_CATEGORY":
        if (param) {
          return { type: "SHOW_CATEGORY", categoryName: param.trim() }
        }
        return { type: "SHOW_CATEGORIES" }
        
      case "SHOW_PRODUCTS":
        return { type: "SHOW_PRODUCTS" }
        
      case "SEARCH_PRODUCTS":
        return { type: "SEARCH_PRODUCTS", query: param?.trim() || "" }
        
      case "VIEW_CART":
        return { type: "VIEW_CART" }
        
      case "CLEAR_CART":
        return { type: "CLEAR_CART" }
        
      case "CHECKOUT":
        return { type: "START_CHECKOUT" }
        
      case "REMOVE_FROM_CART":
        if (param) {
          return { type: "REMOVE_FROM_CART", productName: param.trim() }
        }
        return { type: "VIEW_CART" }  // Show cart if no product specified
        
      case "ADD_TO_CART":
        if (param) {
          // Format: ADD_TO_CART:quantity:productName or ADD_TO_CART:productName
          const parts = param.split(":")
          if (parts.length >= 2) {
            const maybeQuantity = parseInt(parts[0], 10)
            if (!isNaN(maybeQuantity) && maybeQuantity > 0) {
              // Format: quantity:productName
              const productName = parts.slice(1).join(":").trim()
              return { type: "ADD_TO_CART", productName, quantity: maybeQuantity }
            }
          }
          // Fallback: just productName
          return { type: "ADD_TO_CART", productName: param.trim(), quantity: 1 }
        }
        return null
        
      case "VIEW_ORDERS":
        return { type: "VIEW_ORDERS" }
        
      case "REPEAT_ORDER":
        // REPEAT_ORDER: user wants to re-order products from a previous order
        // If orderCode provided (e.g., "ripeti ordine ORD-12345"), use it
        // Otherwise, repeat the most recent completed order
        if (param) {
          return { type: "REPEAT_ORDER", orderCode: param.trim() }
        }
        return { type: "REPEAT_ORDER" }  // Repeat last order
        
      case "ORDER_DETAILS": {
        const orderCode = param?.trim()
        return orderCode
          ? { type: "ORDER_DETAILS", orderCode }
          : { type: "ORDER_DETAILS" }
      }
        
      case "ASK_IDENTITY":
        return { type: "ASK_IDENTITY" }

      case "SHOW_AGENT_INFO":
        return { type: "SHOW_AGENT_INFO" }
        
      case "ASK_LOCATION":
        return { type: "ASK_LOCATION" }
        
      case "ASK_FAQ":
        return { type: "ASK_FAQ", query: param?.trim() || "" }
        
      case "VIEW_PROFILE":
        return { type: "VIEW_PROFILE" }
        
      case "REQUEST_HUMAN": {
        const reason = param?.trim()
        return {
          type: "REQUEST_HUMAN",
          reason: reason ? reason.toLowerCase() : undefined,
        }
      }
        
      case "CONFIRM":
        return { type: "CONFIRM" }
        
      case "REJECT":
        return { type: "REJECT" }
        
      case "GREETING":
        return { type: "GREETING" }
        
      case "SHOW_OFFERS":
        // Return SHOW_OFFERS intent to load active offers
        return { type: "SHOW_OFFERS" }
        
      case "VIEW_SERVICES":
        return { type: "VIEW_SERVICES" }
        
      case "SHOW_SERVICE":
        if (param) {
          return { type: "SHOW_SERVICE", serviceName: param.trim() }
        }
        return { type: "VIEW_SERVICES" }

      case "PRODUCT_CONTEXT":
        return { type: "PRODUCT_CONTEXT", query: param?.trim() || "" }
        
      case "INCOMPREHENSIBLE":
        return { type: "INCOMPREHENSIBLE", originalMessage: originalMessage || "" }
        
      case "UNKNOWN":
      default:
        return null
    }
  }

  /**
   * Clear entity cache for a workspace
   */
  static invalidateCache(workspaceId: string): void {
    entityCache.delete(workspaceId)
    logger.debug(`🗑️ IntentParser: Cache invalidated for ${workspaceId}`)
  }

  /**
   * Clear all caches
   */
  static clearAllCaches(): void {
    entityCache.clear()
    logger.debug(`🗑️ IntentParser: All caches cleared`)
  }
}

// =============================================================================
// EXPORT SINGLETON FACTORY
// =============================================================================

let instance: IntentParserService | null = null

export function getIntentParser(prisma: PrismaClient): IntentParserService {
  if (!instance) {
    instance = new IntentParserService(prisma)
  }
  return instance
}
