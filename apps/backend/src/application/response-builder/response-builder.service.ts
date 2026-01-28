/**
 * ResponseBuilder Service - Code-First LLM Architecture
 *
 * RESPONSIBILITY: Deterministic logic for formatting responses
 *
 * PRINCIPLES:
 * - ALL decisions are made by CODE, not LLM
 * - Grouping rules: >10 products → group by category
 * - Count display: always show (N items)
 * - Numeric options: numbered list for selection
 * - NO LLM calls in this service
 *
 * OUTPUT: StructuredResponse ready for LLMFormatter
 */

import { PrismaClient } from "@echatbot/database"
import logger from "../../utils/logger"
import { Intent } from "../intent/intent.types"
import {
  LoadedData,
  CategoryData,
  ProductData,
  CartData,
  OrderData,
  WorkspaceIdentityData,
  WorkspaceLocationData,
  BusinessInfoData,
  FAQData,
  CustomerProfileData,
  OfferData,
  AgentInfoData,
  ServiceData,
} from "../data-loader/data-loader.service"

// ================================================================================
// RESPONSE TYPES - What we send to LLMFormatter
// ================================================================================

export type ResponseType =
  | "CATEGORY_LIST"
  | "PRODUCT_LIST"
  | "PRODUCT_GROUPED"
  | "PRODUCT_NEEDS_SMART_GROUPING"  // LLM creates logical groups (e.g., "Formaggi Freschi" vs "Stagionati")
  | "CATALOG_AGGREGATE"
  | "PRODUCT_DETAIL"
  | "SERVICE_DETAIL"
  | "SERVICE_LIST"    // 🆕 Service list (numbered)
  | "CART_VIEW"
  | "CART_EMPTY"
  | "CART_UPDATED"
  | "CART_ACTION"  // Cart action (CONFIRM_ORDER, SHOW_PRODUCTS, REMOVE_FROM_CART, OPTIMIZE_TRANSPORT)
  | "CART_REMOVAL_OPTIONS"  // Cart removal options list
  | "ORDER_LIST"
  | "ORDER_DETAIL"
  | "ORDER_NOT_FOUND"
  | "ORDER_ACTION"  // Action to execute (SEND_INVOICE, REPEAT_ORDER, SEND_CREDIT_NOTES)
  | "AGENT_INFO"    // Customer's sales agent information
  | "IDENTITY"
  | "LOCATION"
  | "BUSINESS_INFO"  // 🆕 Business type/sector info ("che settore?")
  | "FAQ"  // FAQ response - LLM matches user query to FAQ answers
  | "PROFILE"  // Customer profile with discount info
  | "OFFERS"  // Active offers list
  | "OFFER_WITH_PRODUCTS"  // 🆕 Single offer with its products
  | "GREETING"
  | "GOODBYE"
  | "THANKS"
  | "HELP"
  | "HUMAN_SUPPORT"
  | "ERROR"
  | "NO_RESULTS"
  | "SIMPLE_TEXT"
  | "NEEDS_LLM_FORMAT"
  | "NEEDS_LLM_CONTEXT"

export interface StructuredResponse {
  type: ResponseType
  data: ResponseData
  formatting: FormattingInstructions
  context: ResponseContext
  // For simple text responses
  text?: string
  // For LLM formatting
  template?: string
  
  // 🆕 Contextual Enrichment - Makes responses more natural and helpful
  enrichment?: ConversationEnrichment
}

// ================================================================================
// 🆕 CONVERSATION ENRICHMENT - Contextual intelligence for natural responses
// ================================================================================

export interface ConversationEnrichment {
  // Clarifying question when response is ambiguous
  clarifyingQuestion?: string
  
  // Contextual suggestions based on conversation flow
  suggestions?: ContextualSuggestion[]
  
  // Personalization based on customer history
  personalization?: PersonalizationData
  
  // Conversational tone hints for LLM
  toneHints?: ToneHint[]
}

export interface ContextualSuggestion {
  text: string           // "Vedi offerte del giorno"
  intent: string         // "SHOW_OFFERS" - helps with quick actions
  priority: number       // 1 = high, 2 = medium, 3 = low
  emoji?: string         // "🎁"
}

export interface PersonalizationData {
  // Reference to previous orders
  lastOrderHint?: string           // "Come l'ordine di martedì scorso?"
  frequentProducts?: string[]      // Products they buy often
  preferredCategories?: string[]   // Categories they browse most
  
  // Customer-specific context
  isReturningCustomer: boolean
  daysSinceLastOrder?: number
  totalOrders?: number
}

export interface ToneHint {
  type: "friendly" | "urgent" | "helpful" | "apologetic" | "celebratory"
  reason: string  // "first_time_customer", "empty_cart", "large_order", etc.
}

export interface ResponseData {
  // For lists
  items?: ListItem[]
  groups?: GroupedItems[]
  count?: number

  // For single items
  product?: ProductData
  service?: ServiceData
  order?: OrderData
  cart?: CartData

  // For workspace info
  identity?: WorkspaceIdentityData
  location?: WorkspaceLocationData
  businessInfo?: BusinessInfoData  // 🆕 Business type/sector for "che settore?" questions

  // For customer info
  profile?: CustomerProfileData
  agentInfo?: AgentInfoData  // Sales agent info for B2B customers

  // For offers
  offers?: OfferData[]
  offer?: OfferData  // 🆕 Single offer (for OFFER_WITH_PRODUCTS)
  products?: ProductData[]  // 🆕 Products for single offer

  // For errors
  errorMessage?: string

  // For aggregate results
  aggregateResult?: {
    type: "min" | "max" | "count"
    field: string
    value: number
  }
  
  // 🆕 For smart grouping (PRODUCT_NEEDS_SMART_GROUPING)
  categoryName?: string
  productGroups?: Array<{ number: number; name: string; productCount: number }>
  groupMapping?: Record<string, { nome: string; skus: string[] }>

  // For order actions
  orderCode?: string

  // 🆕 For order actions (SEND_INVOICE, REPEAT_ORDER, etc.)
  action?: "SEND_INVOICE" | "REPEAT_ORDER" | "SEND_CREDIT_NOTES" | "ADD_ORDER_NOTE" | "CONFIRM_ORDER" | "SHOW_PRODUCTS" | "REMOVE_FROM_CART" | "OPTIMIZE_TRANSPORT"
  label?: string
  originalListType?: string
  inferAttempted?: string | null
}

export interface ListItem {
  number: number // 1-based for user selection
  id: string
  name: string
  sku?: string // Product code for cart operations
  price?: number
  priceWithDiscount?: number
  imageUrl?: string
  stock?: number
  description?: string
  extra?: string // category name, region, etc.
}

export interface GroupedItems {
  groupName: string
  variantCount: number
  items: ListItem[]
}

export interface FormattingInstructions {
  showNumbers: boolean // Show numbered list for selection
  showPrices: boolean // Show prices
  showStock: boolean // Show stock availability
  showTotal: boolean // Show total count "(N items)"
  groupByCategory: boolean // Group products by category
  includeEmoji: boolean // Include emoji in response
  maxItemsBeforeGroup: number // Threshold for grouping (default 10)
}

export interface ResponseContext {
  intentType: string
  customerLanguage: string
  hasDiscount: boolean
  discountPercent: number
  customerName?: string
  showOptimizeOption?: boolean  // Show "Ottimizza spedizione" option for Premium/Enterprise
  disableGrouping?: boolean     // Force simple lists even when count > threshold
  userMessage?: string          // Last user utterance (used for contextual ranking)
  enableCategoryRanking?: boolean // Enable category prioritization based on user query
  customerIsActive?: boolean    // 🔒 Feature 174: Customer registration status for price visibility
}

// ================================================================================
// DEFAULT FORMATTING
// ================================================================================

export const RESPONSE_DEFAULT_FORMATTING: FormattingInstructions = {
  showNumbers: true,
  showPrices: true,
  showStock: false, // Only show for cart
  showTotal: true,
  groupByCategory: false,
  includeEmoji: true,
  maxItemsBeforeGroup: 5, // AC-10: 6+ prodotti = grouping (soglia = 5, quindi >5 = group)
}

const DEFAULT_FORMATTING = RESPONSE_DEFAULT_FORMATTING

// ================================================================================
// 🆕 ENRICHMENT OPTIONS - Input for contextual enrichment
// ================================================================================

export interface EnrichmentOptions {
  // Conversation history for context
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>
  
  // Customer profile for personalization
  customerProfile?: {
    isReturningCustomer: boolean
    totalOrders: number
    lastOrderDate?: Date
    frequentProducts?: Array<{ sku: string; name: string; orderCount: number }>
    preferredCategories?: string[]
  }
  
  // Enable specific enrichment features
  enableClarifyingQuestions?: boolean
  enableSuggestions?: boolean
  enablePersonalization?: boolean
}

// ================================================================================
// RESPONSE BUILDER SERVICE
// ================================================================================

export class ResponseBuilderService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Main entry point - build structured response from loaded data
   * 
   * 🆕 enrichmentOptions: Pass conversation history for contextual enrichment
   */
  build(
    intent: Intent,
    loadedData: LoadedData,
    options: {
      customerName?: string
      customerLanguage?: string
      workspaceId: string
      customerDiscount?: number  // Customer's discount percentage (0-100)
      showOptimizeOption?: boolean  // Show "Ottimizza spedizione" option for Premium/Enterprise
      disableGrouping?: boolean
      userMessage?: string
      enableCategoryRanking?: boolean
      customerIsActive?: boolean  // 🔒 Feature 174: Customer registration status
    },
    enrichmentOptions?: EnrichmentOptions
  ): StructuredResponse {
    logger.info("🏗️ [ResponseBuilder] Building response", {
      intentType: intent.type,
      dataType: loadedData.type,
      customerDiscount: options.customerDiscount,
    })

    const discountPercent = options.customerDiscount || 0
    const context: ResponseContext = {
      intentType: intent.type,
      customerLanguage: options.customerLanguage || "it",
      hasDiscount: discountPercent > 0,
      discountPercent,
      customerName: options.customerName,
      showOptimizeOption: options.showOptimizeOption,
      disableGrouping: options.disableGrouping,
      userMessage: options.userMessage,
      enableCategoryRanking: options.enableCategoryRanking,
      customerIsActive: options.customerIsActive ?? false, // 🔒 Feature 174: Default false
    }

    // Handle errors first
    if (loadedData.type === "ERROR") {
      return this.buildErrorResponse(loadedData.error, context)
    }

    // Build response based on data type
    switch (loadedData.type) {
      case "CATEGORIES":
        return this.buildCategoryList(loadedData.categories, context)

      case "PRODUCTS":
        return this.buildProductList(loadedData.products, context)

      case "PRODUCT_DETAIL":
        return this.buildProductDetail(loadedData.product, context)

      case "SERVICES":
        return this.buildServiceList(loadedData.services, context)

      case "SERVICE_DETAIL":
        return this.buildServiceDetail(loadedData.service, context)

      case "CART":
        return this.buildCartResponse(loadedData.cart, context)

      case "ORDER_LIST":
        return this.buildOrderList(loadedData.orders, context)

      case "ORDER_DETAIL":
        return this.buildOrderDetail(loadedData.order, context)

      case "IDENTITY":
        return this.buildIdentityResponse(loadedData.identity, context)

      case "LOCATION":
        return this.buildLocationResponse(loadedData.location, context)

      case "BUSINESS_INFO":
        return this.buildBusinessInfoResponse(loadedData.businessInfo, context)

      case "FAQ":
        return this.buildFAQResponse(loadedData.faqs, loadedData.query, context)

      case "PROFILE":
        return this.buildProfileResponse(loadedData.profile, context)

      case "OFFERS":
        return this.buildOffersResponse(loadedData.offers, context)

      case "OFFER_WITH_PRODUCTS":
        return this.buildOfferWithProductsResponse(loadedData.offer, loadedData.products, context)

      case "ORDER_ACTION":
        return this.buildOrderActionResponse(loadedData.action, context, {
          orderCode: loadedData.orderCode,
        })

      case "CART_ACTION":
        // CART_ACTION is handled directly in chat-engine, this is a fallback
        return {
          type: "CART_ACTION",
          data: { action: loadedData.action },
          formatting: DEFAULT_FORMATTING,
          context,
        }

      case "CART_REMOVAL_OPTIONS":
        // CART_REMOVAL_OPTIONS is handled directly in chat-engine, this is a fallback
        // Map CartRemovalItemData[] to ListItem[] (ensuring number is always present)
        return {
          type: "CART_REMOVAL_OPTIONS",
          data: { 
            items: (loadedData.items || []).map((item, index) => ({
              number: item.number ?? (index + 1),
              id: item.id,
              name: item.name,
              price: item.price,
            }))
          },
          formatting: DEFAULT_FORMATTING,
          context,
        }

      case "AGENT_INFO":
        return this.buildAgentInfoResponse(loadedData.agentInfo, context)

      case "NEEDS_LLM_CONTEXT":
        // 🧠 Hybrid fallback: inference failed, needs LLM to understand from context
        return {
          type: "NEEDS_LLM_CONTEXT",
          data: { 
            label: loadedData.label,
            originalListType: loadedData.originalListType,
            inferAttempted: loadedData.inferAttempted,
          },
          formatting: DEFAULT_FORMATTING,
          context,
        }

      case "EMPTY":
        return this.enrichResponse(
          this.buildEmptyResponse(intent.type, loadedData.reason, context),
          enrichmentOptions
        )

      default:
        return this.buildErrorResponse("Unknown data type", context)
    }
  }

  // ================================================================================
  // 🆕 CONTEXTUAL ENRICHMENT - Makes responses more natural and helpful
  // ================================================================================

  /**
   * Enrich a structured response with contextual intelligence
   * 
   * Adds:
   * - Clarifying questions when response is ambiguous
   * - Contextual suggestions based on conversation flow
   * - Personalization based on customer history
   * - Tone hints for the LLM formatter
   */
  private enrichResponse(
    response: StructuredResponse,
    options?: EnrichmentOptions
  ): StructuredResponse {
    // Skip enrichment if no options provided
    if (!options) {
      return response
    }

    const enrichment: ConversationEnrichment = {}
    let hasEnrichment = false

    // 1. Add clarifying questions for ambiguous responses
    if (options.enableClarifyingQuestions !== false) {
      const clarifyingQuestion = this.generateClarifyingQuestion(response, options)
      if (clarifyingQuestion) {
        enrichment.clarifyingQuestion = clarifyingQuestion
        hasEnrichment = true
      }
    }

    // 2. Add contextual suggestions
    if (options.enableSuggestions !== false) {
      const suggestions = this.generateContextualSuggestions(response, options)
      if (suggestions.length > 0) {
        enrichment.suggestions = suggestions
        hasEnrichment = true
      }
    }

    // 3. Add personalization from customer profile
    if (options.enablePersonalization !== false && options.customerProfile) {
      const personalization = this.generatePersonalization(response, options)
      if (personalization) {
        enrichment.personalization = personalization
        hasEnrichment = true
      }
    }

    // 4. Add tone hints based on context
    const toneHints = this.generateToneHints(response, options)
    if (toneHints.length > 0) {
      enrichment.toneHints = toneHints
      hasEnrichment = true
    }

    // Only add enrichment if we have something
    if (hasEnrichment) {
      logger.info("✨ [ResponseBuilder] Response enriched", {
        responseType: response.type,
        hasClarifyingQuestion: !!enrichment.clarifyingQuestion,
        suggestionsCount: enrichment.suggestions?.length || 0,
        hasPersonalization: !!enrichment.personalization,
        toneHintsCount: enrichment.toneHints?.length || 0,
      })
      return { ...response, enrichment }
    }

    return response
  }

  /**
   * Generate clarifying question when response has multiple options
   */
  private generateClarifyingQuestion(
    response: StructuredResponse,
    options: EnrichmentOptions
  ): string | undefined {
    // Multiple products with similar names → ask for preference
    if (response.type === "PRODUCT_LIST" && response.data.items) {
      const items = response.data.items
      if (items.length >= 3 && items.length <= 6) {
        // Check if products are similar (same base name)
        const baseNames = items.map(i => i.name.split(" ")[0].toLowerCase())
        const uniqueBaseNames = new Set(baseNames)
        if (uniqueBaseNames.size <= 2) {
          return "Quale formato preferisci?"
        }
      }
    }

    // Cart is empty → suggest action
    if (response.type === "CART_EMPTY") {
      return "Vuoi vedere i nostri prodotti o le offerte attive?"
    }

    // Search with many results → help narrow down
    if (response.type === "PRODUCT_LIST" && (response.data.count || 0) > 10) {
      return "Posso aiutarti a restringere la ricerca?"
    }

    return undefined
  }

  /**
   * Generate contextual suggestions based on conversation state
   */
  private generateContextualSuggestions(
    response: StructuredResponse,
    options: EnrichmentOptions
  ): ContextualSuggestion[] {
    const suggestions: ContextualSuggestion[] = []

    // After viewing cart → suggest checkout or continue shopping
    if (response.type === "CART_VIEW" && response.data.cart?.items?.length) {
      suggestions.push({
        text: "Procedi al checkout",
        intent: "CHECKOUT",
        priority: 1,
        emoji: "✅",
      })
      suggestions.push({
        text: "Continua a comprare",
        intent: "SHOW_CATEGORIES",
        priority: 2,
        emoji: "🛒",
      })
    }

    // After viewing categories → suggest offers
    if (response.type === "CATEGORY_LIST") {
      suggestions.push({
        text: "Vedi offerte attive",
        intent: "SHOW_OFFERS",
        priority: 2,
        emoji: "🎁",
      })
    }

    // Product detail → suggest add to cart
    if (response.type === "PRODUCT_DETAIL" && response.data.product) {
      suggestions.push({
        text: "Aggiungi al carrello",
        intent: "ADD_TO_CART",
        priority: 1,
        emoji: "🛒",
      })
      suggestions.push({
        text: "Vedi prodotti simili",
        intent: "SEARCH_PRODUCTS",
        priority: 3,
        emoji: "🔍",
      })
    }

    // After viewing order → suggest actions
    if (response.type === "ORDER_DETAIL") {
      suggestions.push({
        text: "Riordina",
        intent: "REPEAT_ORDER",
        priority: 1,
        emoji: "🔄",
      })
    }

    // Empty results → suggest alternatives
    if (response.type === "NO_RESULTS") {
      suggestions.push({
        text: "Vedi tutti i prodotti",
        intent: "SHOW_PRODUCTS",
        priority: 1,
        emoji: "📦",
      })
      suggestions.push({
        text: "Cerca per categoria",
        intent: "SHOW_CATEGORIES",
        priority: 2,
        emoji: "📁",
      })
    }

    return suggestions.slice(0, 3) // Max 3 suggestions
  }

  /**
   * Generate personalization based on customer history
   */
  private generatePersonalization(
    response: StructuredResponse,
    options: EnrichmentOptions
  ): PersonalizationData | undefined {
    const profile = options.customerProfile
    if (!profile) return undefined

    const personalization: PersonalizationData = {
      isReturningCustomer: profile.isReturningCustomer,
      totalOrders: profile.totalOrders,
    }

    // Calculate days since last order
    if (profile.lastOrderDate) {
      const daysSince = Math.floor(
        (Date.now() - new Date(profile.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)
      )
      personalization.daysSinceLastOrder = daysSince

      // Suggest reorder if it's been a while
      if (daysSince >= 7 && daysSince <= 30) {
        personalization.lastOrderHint = "Come l'ultima volta?"
      }
    }

    // Add frequent products if viewing categories/products
    if (
      (response.type === "CATEGORY_LIST" || response.type === "PRODUCT_LIST") &&
      profile.frequentProducts?.length
    ) {
      personalization.frequentProducts = profile.frequentProducts
        .slice(0, 3)
        .map(p => p.name)
    }

    // Add preferred categories
    if (profile.preferredCategories?.length) {
      personalization.preferredCategories = profile.preferredCategories.slice(0, 3)
    }

    return personalization
  }

  /**
   * Generate tone hints for the LLM formatter
   */
  private generateToneHints(
    response: StructuredResponse,
    options: EnrichmentOptions
  ): ToneHint[] {
    const hints: ToneHint[] = []

    // First time customer → extra friendly
    if (options.customerProfile && !options.customerProfile.isReturningCustomer) {
      hints.push({
        type: "friendly",
        reason: "first_time_customer",
      })
    }

    // Empty cart → helpful
    if (response.type === "CART_EMPTY") {
      hints.push({
        type: "helpful",
        reason: "empty_cart",
      })
    }

    // Large order (>5 items) → celebratory
    if (response.type === "CART_VIEW") {
      const itemCount = response.data.cart?.items?.length || 0
      if (itemCount >= 5) {
        hints.push({
          type: "celebratory",
          reason: "large_order",
        })
      }
    }

    // Error or no results → apologetic
    if (response.type === "ERROR" || response.type === "NO_RESULTS") {
      hints.push({
        type: "apologetic",
        reason: "no_results_or_error",
      })
    }

    // Returning customer with recent order → familiar
    if (
      options.customerProfile?.isReturningCustomer &&
      options.customerProfile?.totalOrders > 3
    ) {
      hints.push({
        type: "friendly",
        reason: "loyal_customer",
      })
    }

    return hints
  }

  // ================================================================================
  // CATEGORY BUILDERS
  // ================================================================================

  private buildCategoryList(
    categories: CategoryData[],
    context: ResponseContext
  ): StructuredResponse {
    if (categories.length === 0) {
      return {
        type: "NO_RESULTS",
        data: { errorMessage: "No categories available" },
        formatting: { ...DEFAULT_FORMATTING, showNumbers: false },
        context,
      }
    }

    const orderedCategories = context.enableCategoryRanking
      ? this.prioritizeCategories(categories, context.userMessage)
      : categories

    const items: ListItem[] = orderedCategories.map((cat, index) => ({
      number: index + 1,
      id: cat.id,
      name: cat.name,
      description: cat.description,
      extra: cat.productCount > 0 ? `${cat.productCount} prodotti` : undefined,
    }))

    return {
      type: "CATEGORY_LIST",
      data: {
        items,
        count: categories.length,
      },
      formatting: {
        ...DEFAULT_FORMATTING,
        showPrices: false,
        showStock: false,
        showTotal: false,
      },
      context,
    }
  }

  private prioritizeCategories(categories: CategoryData[], userMessage?: string): CategoryData[] {
    if (!userMessage) {
      return categories
    }

    const tokens = this.tokenizeQuery(userMessage)
    if (tokens.length === 0) {
      return categories
    }

    const scored = categories.map((category, index) => ({
      category,
      index,
      score: this.calculateCategoryScore(category.name, tokens),
    }))

    const matches = scored.filter((entry) => entry.score > 0)

    const sourceArray = matches.length > 0 ? matches : scored

    sourceArray.sort((a, b) => {
      if (b.score === a.score) {
        return a.index - b.index
      }
      return b.score - a.score
    })

    const ordered = sourceArray.map((entry) => entry.category)

    // If we only returned matches, ensure we don't return empty list
    if (ordered.length > 0) {
      return ordered
    }

    return categories
  }

  private tokenizeQuery(message: string): string[] {
    const normalized = this.normalizeText(message)
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    if (!normalized) {
      return []
    }

    return normalized
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  }

  private calculateCategoryScore(name: string, tokens: string[]): number {
    const normalizedName = this.normalizeText(name)
    let score = 0

    for (const token of tokens) {
      if (!token) continue
      if (normalizedName.includes(token)) {
        score += 5
        continue
      }

      if (token.length > 4) {
        const singular = token.replace(/(i|e|o|a)$/i, "")
        if (singular && singular.length >= 3 && normalizedName.includes(singular)) {
          score += 3
        }
      }
    }

    return score
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
  }

  // ================================================================================
  // PRODUCT BUILDERS
  // ================================================================================

  private buildProductList(
    products: ProductData[],
    context: ResponseContext
  ): StructuredResponse {
    if (products.length === 0) {
      return {
        type: "NO_RESULTS",
        data: { errorMessage: "No products found" },
        formatting: { ...DEFAULT_FORMATTING, showNumbers: false },
        context,
      }
    }

    // 🎯 OPTIMIZATION: If only 1 product, skip list and show detail directly
    if (products.length === 1) {
      const [product] = products
      return {
        type: "PRODUCT_DETAIL",
        data: { product },
        formatting: DEFAULT_FORMATTING,
        context,
      }
    }

    // 🚫 If grouping is disabled (e.g., selection came from an existing group), force a flat list
    if (context.disableGrouping) {
      const items: ListItem[] = products.map((p, index) => ({
        number: index + 1,
        id: p.id,
        name: p.name,
        sku: p.sku,
        price: p.price,
        priceWithDiscount: p.priceWithDiscount,
        imageUrl: p.imageUrl,
        stock: p.stock,
        description: p.description,
        extra: p.categoryName || p.region,
      }))

      return {
        type: "PRODUCT_LIST",
        data: {
          items,
          count: products.length,
        },
        formatting: {
          ...DEFAULT_FORMATTING,
          showStock: products.some((p) => !p.isAvailable),
          showTotal: false,
        },
        context,
      }
    }

    // RULE: If >5 products, try to group by category
    // But only if we can create 2+ meaningful groups
    if (!context.disableGrouping && products.length > DEFAULT_FORMATTING.maxItemsBeforeGroup) {
      const grouped = this.buildGroupedProducts(products, context)
      
      // 🔧 FIX: PRODUCT_NEEDS_SMART_GROUPING should be returned directly!
      // It doesn't have `groups`, it has `items` for LLM to group
      if (grouped.type === "PRODUCT_NEEDS_SMART_GROUPING") {
        logger.info("🏗️ [ResponseBuilder] Smart grouping needed for single category", {
          count: products.length,
          category: products[0]?.categoryName,
        })
        return grouped
      }
      
      // Only use category grouping if we have 2+ groups (1 group is useless)
      if (grouped.data.groups && grouped.data.groups.length >= 2) {
        return grouped
      }
      // Otherwise fall through to simple list
    }

    // Simple list
    const items: ListItem[] = products.map((p, index) => ({
      number: index + 1,
      id: p.id,
      name: p.name,
      sku: p.sku, // Include SKU for cart operations
      price: p.price,
      priceWithDiscount: p.priceWithDiscount,
      imageUrl: p.imageUrl,
      stock: p.stock,
      description: p.description,
      extra: p.categoryName || p.region,
    }))

    return {
      type: "PRODUCT_LIST",
      data: {
        items,
        count: products.length,
      },
      formatting: {
        ...DEFAULT_FORMATTING,
        showStock: products.some((p) => !p.isAvailable),
        showTotal: false,
      },
      context,
    }
  }

  private buildGroupedProducts(
    products: ProductData[],
    context: ResponseContext
  ): StructuredResponse {
    // Group by category
    const groupMap = new Map<string, ProductData[]>()

    for (const product of products) {
      const groupName = product.categoryName || "Altri prodotti"
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, [])
      }
      groupMap.get(groupName)!.push(product)
    }

    // If ALL products are in the SAME category (1 group with 6+ items),
    // we use CODE-FIRST grouping based on product attributes
    // The LLM only formats the text, NOT the grouping logic!
    if (groupMap.size === 1 && products.length >= 6) {
      const categoryName = products[0].categoryName || "Prodotti"
      
      // 🔧 CODE-FIRST GROUPING: Group by common attributes (region, formato, description keywords)
      const productGroups = this.createSmartGroups(products, categoryName)
      
      // 🆕 If no meaningful groups found (empty array), fall through to flat list
      if (productGroups.length === 0) {
        logger.info("🏗️ [ResponseBuilder] No meaningful groups found, using flat list", {
          categoryName,
          productCount: products.length,
        })
        // Fall through to standard grouped view or flat list below
      } else {
        // Build items list with group info
        const items: ListItem[] = products.map((p, index) => ({
          number: index + 1,
          id: p.id,
          name: p.name,
          sku: p.sku,
          price: p.price,
          priceWithDiscount: p.priceWithDiscount,
          imageUrl: p.imageUrl,
          stock: p.stock,
          description: p.description,
          extra: p.region || p.formato,
        }))
        
        // 🆕 Pre-compute groupMapping here, not in LLM!
        const groupMapping: Record<string, { nome: string; skus: string[] }> = {}
        productGroups.forEach((group, index) => {
          groupMapping[String(index + 1)] = {
            nome: group.name,
            skus: group.products.map(p => p.sku).filter(Boolean) as string[],
          }
        })
        
        logger.info("🏗️ [ResponseBuilder] CODE-FIRST grouping created", {
          categoryName,
          groupCount: productGroups.length,
          groups: productGroups.map(g => ({ name: g.name, count: g.products.length })),
          totalSkus: Object.values(groupMapping).reduce((sum, g) => sum + g.skus.length, 0),
        })
        
        return {
          type: "PRODUCT_NEEDS_SMART_GROUPING",
          data: {
            items,
            count: products.length,
            categoryName,
            // 🆕 Pass pre-computed groups to formatter
            productGroups: productGroups.map((g, i) => ({
              number: i + 1,
              name: g.name,
              productCount: g.products.length,
            })),
            // 🆕 Pass groupMapping directly - NO LLM needed for this!
            groupMapping,
          },
          formatting: {
            ...DEFAULT_FORMATTING,
            groupByCategory: true,
          },
          context,
        }
      }
    }

    let itemNumber = 1
    const rawGroups: GroupedItems[] = []

    for (const [groupName, groupProducts] of groupMap) {
      const items: ListItem[] = groupProducts.map((p) => ({
        number: itemNumber++,
        id: p.id,
        name: p.name,
        sku: p.sku, // Include SKU for cart operations
        price: p.price,
        priceWithDiscount: p.priceWithDiscount,
        imageUrl: p.imageUrl,
        stock: p.stock,
        extra: p.region || p.formato,
      }))

      rawGroups.push({
        groupName,
        variantCount: groupProducts.length,
        items,
      })
    }

    const groups = rawGroups
      .sort((a, b) => {
        const aIsOther = a.groupName.trim().toLowerCase() === "altri"
        const bIsOther = b.groupName.trim().toLowerCase() === "altri"
        if (aIsOther !== bIsOther) return aIsOther ? 1 : -1
        return b.variantCount - a.variantCount
      })
      .slice(0, 4)

    const groupMapping: Record<string, { nome: string; skus: string[] }> = {}
    groups.forEach((group, index) => {
      groupMapping[String(index + 1)] = {
        nome: group.groupName,
        skus: group.items
          .map((item) => item.sku)
          .filter((sku): sku is string => Boolean(sku)),
      }
    })

    return {
      type: "PRODUCT_GROUPED",
      data: {
        groups,
        count: groups.reduce((sum, group) => sum + group.variantCount, 0),
        groupMapping,
      },
      formatting: {
        ...DEFAULT_FORMATTING,
        groupByCategory: true,
        showTotal: false,
      },
      context,
    }
  }

  private buildProductDetail(
    product: ProductData | null,
    context: ResponseContext
  ): StructuredResponse {
    if (!product) {
      return {
        type: "NO_RESULTS",
        data: { errorMessage: "Product not found" },
        formatting: { ...DEFAULT_FORMATTING, showNumbers: false },
        context,
      }
    }

    return {
      type: "PRODUCT_DETAIL",
      data: { product },
      formatting: {
        ...DEFAULT_FORMATTING,
        showNumbers: false, // No selection needed
        showStock: true, // Show availability
      },
      context,
    }
  }

  // ================================================================================
  // SERVICE BUILDERS
  // ================================================================================

  private buildServiceList(
    services: ServiceData[],
    context: ResponseContext
  ): StructuredResponse {
    if (services.length === 0) {
      return {
        type: "NO_RESULTS",
        data: { errorMessage: "No services available" },
        formatting: { ...DEFAULT_FORMATTING, showNumbers: false },
        context,
      }
    }

    // 🎯 OPTIMIZATION: If only 1 service, skip list and show detail directly
    if (services.length === 1) {
      const service = services[0]
      logger.info("🎯 [ResponseBuilder] Single service found - showing detail directly", {
        serviceName: service.name,
        code: service.code,
      })
      return this.buildServiceDetail(service, context)
    }

    const items: ListItem[] = services.map((svc, index) => ({
      number: index + 1,
      id: svc.id,
      name: svc.name,
      price: svc.price,
      sku: svc.code,  // Use code as SKU for cart operations
      extra: svc.currency,
    }))

    return {
      type: "SERVICE_LIST",  // 🆕 Use SERVICE_LIST type to distinguish from CATEGORY_LIST
      data: {
        items,
        count: services.length,
      },
      formatting: {
        ...DEFAULT_FORMATTING,
        showPrices: true,
        showStock: false,  // Services don't have stock
      },
      context,
    }
  }

  private buildServiceDetail(
    service: ServiceData | null,
    context: ResponseContext
  ): StructuredResponse {
    if (!service) {
      return {
        type: "NO_RESULTS",
        data: { errorMessage: "Service not found" },
        formatting: { ...DEFAULT_FORMATTING, showNumbers: false },
        context,
      }
    }

    return {
      type: "SERVICE_DETAIL",  // Use dedicated SERVICE_DETAIL type
      data: { service },  // Pass service data directly
      formatting: {
        ...DEFAULT_FORMATTING,
        showNumbers: false,  // No selection needed
        showStock: false,  // Services don't have stock
      },
      context,
    }
  }

  // ================================================================================
  // CART BUILDERS
  // ================================================================================

  private buildCartResponse(
    cart: CartData,
    context: ResponseContext
  ): StructuredResponse {
    if (cart.isEmpty) {
      return {
        type: "CART_EMPTY",
        data: { cart },
        formatting: { ...DEFAULT_FORMATTING, showNumbers: false },
        context,
      }
    }

    const items: ListItem[] = cart.items.map((item, index) => ({
      number: index + 1,
      id: item.productId,
      name: item.productName,
      price: item.totalPrice,
      stock: item.stock,
      extra: `${item.quantity}×`,
    }))

    return {
      type: "CART_VIEW",
      data: {
        items,
        cart,
        count: cart.itemCount,
      },
      formatting: {
        ...DEFAULT_FORMATTING,
        showStock: true,
        showTotal: true,
      },
      context,
    }
  }

  // ================================================================================
  // ORDER BUILDERS
  // ================================================================================

  private buildOrderList(
    orders: OrderData[],
    context: ResponseContext
  ): StructuredResponse {
    if (orders.length === 0) {
      return {
        type: "NO_RESULTS",
        data: { errorMessage: "Non ci sono ordini per questo cliente. Posso aiutarti a trovare prodotti o servizi?" },
        formatting: { ...DEFAULT_FORMATTING, showNumbers: false },
        context,
      }
    }

    const items: ListItem[] = orders.map((o, index) => ({
      number: index + 1,
      id: o.id,
      name: `#${o.code}`,
      price: o.totalAmount,
      extra: `${o.status}${o.createdAt ? ` · ${new Date(o.createdAt).toLocaleDateString("it-IT")}` : ""}`,
    }))

    return {
      type: "ORDER_LIST",
      data: {
        items,
        count: orders.length,
      },
      formatting: {
        ...DEFAULT_FORMATTING,
        showStock: false,
      },
      context,
    }
  }

  private buildOrderDetail(
    order: OrderData | null,
    context: ResponseContext
  ): StructuredResponse {
    if (!order) {
      return {
        type: "ORDER_NOT_FOUND",
        data: { errorMessage: "Order not found" },
        formatting: { ...DEFAULT_FORMATTING, showNumbers: false },
        context,
      }
    }

    return {
      type: "ORDER_DETAIL",
      data: { order },
      formatting: {
        ...DEFAULT_FORMATTING,
        showNumbers: false,
      },
      context,
    }
  }

  /**
   * Build response for order actions (SEND_INVOICE, REPEAT_ORDER, SEND_CREDIT_NOTES)
   * Returns ORDER_ACTION type for the chat-engine to execute the calling function
   */
  private buildOrderActionResponse(
    action: "SEND_INVOICE" | "REPEAT_ORDER" | "SEND_CREDIT_NOTES" | "ADD_ORDER_NOTE",
    context: ResponseContext,
    extras?: { orderCode?: string }
  ): StructuredResponse {
    return {
      type: "ORDER_ACTION",
      data: { action, orderCode: extras?.orderCode },
      formatting: {
        ...DEFAULT_FORMATTING,
        showNumbers: false,
      },
      context,
    }
  }

  /**
   * Build agent info response for "who is my agent?" queries
   * @see Feature 202 - Agent Variables
   */
  private buildAgentInfoResponse(
    agentInfo: AgentInfoData,
    context: ResponseContext
  ): StructuredResponse {
    return {
      type: "AGENT_INFO",
      data: { agentInfo },
      formatting: {
        ...DEFAULT_FORMATTING,
        showNumbers: false,
        showPrices: false,
      },
      context,
    }
  }

  // ================================================================================
  // WORKSPACE INFO BUILDERS
  // ================================================================================

  private buildIdentityResponse(
    identity: WorkspaceIdentityData,
    context: ResponseContext
  ): StructuredResponse {
    const identityText = identity.botName?.trim()
    if (identityText) {
      return {
        type: "SIMPLE_TEXT",
        data: { identity },
        formatting: {
          ...DEFAULT_FORMATTING,
          showNumbers: false,
          showPrices: false,
        },
        context,
        text: identityText,
      }
    }

    return {
      type: "IDENTITY",
      data: { identity },
      formatting: {
        ...DEFAULT_FORMATTING,
        showNumbers: false,
        showPrices: false,
      },
      context,
    }
  }

  private buildLocationResponse(
    location: WorkspaceLocationData,
    context: ResponseContext
  ): StructuredResponse {
    return {
      type: "LOCATION",
      data: { location },
      formatting: {
        ...DEFAULT_FORMATTING,
        showNumbers: false,
        showPrices: false,
      },
      context,
    }
  }

  /**
   * Build business info response - for "che settore?", "che tipo di negozio?"
   * Provides chatbot name, business type, and basic info
   */
  private buildBusinessInfoResponse(
    businessInfo: BusinessInfoData,
    context: ResponseContext
  ): StructuredResponse {
    return {
      type: "BUSINESS_INFO",
      data: { businessInfo },
      formatting: {
        ...DEFAULT_FORMATTING,
        showNumbers: false,
        showPrices: false,
      },
      context,
    }
  }

  /**
   * Build FAQ response - passes FAQs to LLM for matching
   * LLM will find the best matching FAQ answer for the user's query
   */
  private buildFAQResponse(
    faqs: FAQData[],
    query: string,
    context: ResponseContext
  ): StructuredResponse {
    if (!faqs || faqs.length === 0) {
      // No FAQs configured - return NEEDS_LLM_FORMAT for general response
      return {
        type: "NEEDS_LLM_FORMAT",
        data: {},
        formatting: {
          ...DEFAULT_FORMATTING,
          showNumbers: false,
        },
        context,
        template: `The user asked: "${query}". There are no FAQs configured. Provide a helpful general response.`,
      }
    }

    // Pass FAQs to LLM for semantic matching
    return {
      type: "FAQ",
      data: {
        faqs,
        query,
      } as any, // Extend ResponseData type as needed
      formatting: {
        ...DEFAULT_FORMATTING,
        showNumbers: false,
        showPrices: false,
      },
      context,
    }
  }

  /**
   * Build profile response - shows customer discount info
   */
  private buildProfileResponse(
    profile: CustomerProfileData,
    context: ResponseContext
  ): StructuredResponse {
    return {
      type: "PROFILE",
      data: { profile },
      formatting: {
        ...DEFAULT_FORMATTING,
        showNumbers: false,
        showPrices: false,
      },
      context,
    }
  }

  /**
   * Build offers response - shows active offers/promotions
   * 🆕 Now includes numbered options to view products for each offer with a category
   */
  private buildOffersResponse(
    offers: OfferData[],
    context: ResponseContext
  ): StructuredResponse {
    if (offers.length === 0) {
      return {
        type: "NO_RESULTS",
        data: { errorMessage: "No active offers" },
        formatting: { ...DEFAULT_FORMATTING, showNumbers: false },
        context,
      }
    }

    // 🆕 Create numbered items for offers that have categories (can show products)
    const offersWithCategories = offers.filter(o => o.categoryName)
    const items: ListItem[] = offersWithCategories.map((offer, index) => ({
      number: index + 1,
      id: offer.id,
      name: `Vedi prodotti ${offer.categoryName} in sconto (-${offer.discountPercent}%)`,
      sku: offer.categoryName, // Store category name as SKU for resolution
      extra: offer.categoryName, // Category name for filtering
    }))

    return {
      type: "OFFERS",
      data: { 
        offers, 
        count: offers.length,
        items: items.length > 0 ? items : undefined, // 🆕 Include items for selection
      },
      formatting: {
        ...DEFAULT_FORMATTING,
        showNumbers: items.length > 0,  // 🆕 Enable numbered selection if we have categories
        showPrices: true,
      },
      context,
    }
  }

  /**
   * Build offer with products response - shows single offer with its products
   * 🆕 For single-offer scenario: shows offer context (discount %) + product list
   */
  private buildOfferWithProductsResponse(
    offer: OfferData,
    products: ProductData[],
    context: ResponseContext
  ): StructuredResponse {
    if (!offer) {
      return {
        type: "NO_RESULTS",
        data: { errorMessage: "Offer not found" },
        formatting: { ...DEFAULT_FORMATTING, showNumbers: false },
        context,
      }
    }

    // Create numbered items for products
    const items: ListItem[] = products.map((product, index) => ({
      number: index + 1,
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      extra: product.description,
    }))

    return {
      type: "OFFER_WITH_PRODUCTS",
      data: {
        offer,
        products,
        items,
        count: products.length,
      },
      formatting: {
        ...DEFAULT_FORMATTING,
        showNumbers: true,
        showPrices: true,
      },
      context,
    }
  }

  // ================================================================================
  // SIMPLE INTENT BUILDERS
  // ================================================================================

  private buildEmptyResponse(
    intentType: string,
    reason: string,
    context: ResponseContext
  ): StructuredResponse {
    // Map simple intents to response types
    const typeMap: Record<string, ResponseType> = {
      GREETING: "GREETING",
      GOODBYE: "GOODBYE",
      THANKS: "THANKS",
      ASK_HELP: "HELP",
      HUMAN_SUPPORT: "HUMAN_SUPPORT",
    }

    const responseType = typeMap[intentType] || "NEEDS_LLM_FORMAT"

    return {
      type: responseType,
      data: {},
      formatting: {
        ...DEFAULT_FORMATTING,
        showNumbers: false,
        showPrices: false,
      },
      context,
    }
  }

  private buildErrorResponse(
    errorMessage: string,
    context: ResponseContext
  ): StructuredResponse {
    return {
      type: "ERROR",
      data: { errorMessage },
      formatting: {
        ...DEFAULT_FORMATTING,
        showNumbers: false,
      },
      context,
    }
  }

  /**
   * 🆕 CODE-FIRST Smart Grouping - Groups products by attributes WITHOUT LLM
   * 
   * Grouping strategy (in order of priority):
   * 1. If "formato" exists AND is NOT just a weight (e.g., "Stagionato", "Fresco") → group by formato
   * 2. If "region" exists (e.g., "Toscana", "Piemonte") → group by region
   * 3. Otherwise → group by first word of description or "Altri"
   * 
   * CRITICAL: Skip formato if it's just a weight like "200g", "1kg", "500ml"
   */
  private createSmartGroups(
    products: ProductData[],
    categoryName: string
  ): Array<{ name: string; products: ProductData[] }> {
    const groupMap = new Map<string, ProductData[]>()
    
    // Helper: Check if a string is just a weight/measure (not meaningful for grouping)
    const isJustWeight = (s: string): boolean => {
      if (!s) return true
      const trimmed = s.trim().toLowerCase()
      // Match patterns like: "200g", "1kg", "500ml", "1.5l", "250 g", "1 kg"
      return /^\d+(\.\d+)?\s*(g|kg|ml|l|cl|gr|grammi|litri|litro)$/i.test(trimmed)
    }
    
    // Determine grouping strategy based on available data
    // IMPORTANT: formato must have MEANINGFUL values, not just weights
    const formatoValues = products.map(p => p.formato?.trim()).filter(Boolean) as string[]
    const hasUsefulFormato = formatoValues.length > 0 && formatoValues.some(f => !isJustWeight(f))
    const hasRegion = products.some(p => p.region && p.region.trim() !== "")
    const hasTransport = products.some(p => (p as any).type && String((p as any).type).trim() !== "")

    const normalizedText = (product: ProductData): string =>
      `${product.name || ""} ${product.description || ""}`.toLowerCase()

    const typePatterns: Array<{ name: string; regex: RegExp }> = [
      { name: "Freschi", regex: /\bfresc[oaie]|\bmozzarella|\bstracciatella|\bfiordilatte/ },
      { name: "Stagionati", regex: /\bstagionat|\bvecchi[aoe]|\baffinat/ },
      { name: "Erborinati", regex: /\berborinat|\bgorgonzola|\bblu/ },
      { name: "Affumicati", regex: /\baffumicat/ },
      { name: "Spalmabili", regex: /\bspalmabil|\bcremos[oaie]|\bphiladelphia/ },
      { name: "Piccanti", regex: /\bpiccant|\bpeperoncino/ },
      { name: "Dolci", regex: /\bdolc[ei]|\bvaniglia|\bcioccolat/ },
      { name: "Integrali", regex: /\bintegral/ },
      { name: "Bio", regex: /\bbio|\bbiologic/ },
      { name: "Senza Lattosio", regex: /\bsenza lattosio|\blactose free/ },
      { name: "Senza Glutine", regex: /\bsenza glutine|\bgluten[-\s]?free/ },
    ]

    const getTypeGroup = (product: ProductData): string | null => {
      const text = normalizedText(product)
      for (const pattern of typePatterns) {
        if (pattern.regex.test(text)) {
          return pattern.name
        }
      }
      return null
    }

    const typeMatches = products
      .map((product) => getTypeGroup(product))
      .filter((value): value is string => Boolean(value))
    const typeGroupsCount = new Set(typeMatches).size
    const hasTypeGrouping = typeGroupsCount >= 2

    logger.info("🧠 [ResponseBuilder] createSmartGroups analyzing", {
      categoryName,
      productCount: products.length,
      hasTypeGrouping,
      hasUsefulFormato,
      hasRegion,
      hasTransport,
      formatoValues: formatoValues.slice(0, 5),
      sampleProducts: products.slice(0, 3).map(p => ({
        name: p.name,
        formato: p.formato,
        region: p.region,
      })),
    })
    
    for (const product of products) {
      let groupKey: string
      
      if (hasTypeGrouping) {
        // Strategy 1: Group by product typology inferred from name/description
        groupKey = getTypeGroup(product) || "Altri"
      } else if (hasRegion && product.region && product.region.trim() !== "") {
        // Strategy 2: Group by region (e.g., "Toscana", "Piemonte")
        groupKey = product.region.trim()
      } else if (hasTransport && (product as any).type && String((product as any).type).trim() !== "") {
        // Strategy 3: Group by transport type when available
        groupKey = String((product as any).type).trim()
      } else if (hasUsefulFormato && product.formato && product.formato.trim() !== "" && !isJustWeight(product.formato)) {
        // Strategy 4: Group by formato (e.g., "Stagionato", "Fresco") - but NOT if it's just weight
        groupKey = product.formato.trim()
      } else {
        // Fallback: Group by first significant word in name/description
        // Skip common words like "Formaggio", use second word if available
        const nameWords = product.name.split(" ")
        groupKey = nameWords.length > 1 ? nameWords[1] : nameWords[0] || "Altri"
      }
      
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, [])
      }
      groupMap.get(groupKey)!.push(product)
    }
    
    // Convert to array and sort by group size (largest first)
    const groups = Array.from(groupMap.entries())
      .map(([name, prods]) => ({ name, products: prods }))
      .sort((a, b) => b.products.length - a.products.length)
    
    // If we ended up with too many groups (>=5), skip grouping entirely
    if (groups.length >= 5) {
      logger.info("🧠 [ResponseBuilder] Too many groups, skipping grouping", {
        groupCount: groups.length,
        categoryName,
      })
      return []
    }

    // 🆕 If we only have 1 group (all products ended up in same group), 
    // don't bother grouping - just return empty to trigger flat list
    if (groups.length <= 1) {
      logger.info("🧠 [ResponseBuilder] Only 1 group found, skipping grouping", {
        groupName: groups[0]?.name,
        productCount: groups[0]?.products.length,
      })
      return []
    }
    
    logger.info("🧠 [ResponseBuilder] Smart groups created", {
      groupCount: groups.length,
      groups: groups.map(g => ({ name: g.name, count: g.products.length })),
    })
    
    return groups
  }
}

// ================================================================================
// SINGLETON INSTANCE
// ================================================================================

let responseBuilderInstance: ResponseBuilderService | null = null

export function getResponseBuilder(prisma: PrismaClient): ResponseBuilderService {
  if (!responseBuilderInstance) {
    responseBuilderInstance = new ResponseBuilderService(prisma)
  }
  return responseBuilderInstance
}
