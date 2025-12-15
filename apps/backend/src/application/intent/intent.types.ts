/**
 * Intent Types - Code-First LLM Architecture
 * 
 * Spec: /specs/201-code-first-llm-refactoring/README.md
 * 
 * These types define ALL possible user intents that the system can handle.
 * The IntentParser converts user messages into these typed intents,
 * which are then processed deterministically by code (not LLM).
 */

// =============================================================================
// LIST TYPES - What kind of list was shown in the previous message
// =============================================================================

export type ListType = 
  | "CATEGORIES"    // "1. Formaggi (7 prodotti)"
  | "PRODUCTS"      // "1. Mozzarella - €7.10"
  | "GROUPS"        // "1. Formaggi Freschi (3)"
  | "ORDERS"        // "1. #ORD-001 - 05/12/2024"
  | "ORDER_ACTIONS" // "1. Scarica fattura" (actions for a specific order)
  | "CART_ITEMS"    // "1. Mozzarella × 2"
  | "SERVICES"      // "1. Confezione Regalo - €30.00"
  | "unknown"       // Fallback for unrecognized list types

// =============================================================================
// PRODUCT SEARCH INTENTS
// =============================================================================

export interface ShowCategoriesIntent {
  type: "SHOW_CATEGORIES"
}

export interface ShowCategoryIntent {
  type: "SHOW_CATEGORY"
  categoryName: string
}

export interface ShowGroupIntent {
  type: "SHOW_GROUP"
  groupName: string
  parentCategory: string
}

export interface ShowProductIntent {
  type: "SHOW_PRODUCT"
  productId?: string
  productName: string
}

export interface SearchProductsIntent {
  type: "SEARCH_PRODUCTS"
  query: string
}

export interface ShowOffersIntent {
  type: "SHOW_OFFERS"
}

export interface ShowProductsIntent {
  type: "SHOW_PRODUCTS"
}

// =============================================================================
// CART INTENTS
// =============================================================================

export interface ViewCartIntent {
  type: "VIEW_CART"
}

export interface AddToCartIntent {
  type: "ADD_TO_CART"
  productId?: string
  productName: string
  quantity: number
}

export interface RemoveFromCartIntent {
  type: "REMOVE_FROM_CART"
  productId?: string
  productName: string
}

export interface UpdateCartQuantityIntent {
  type: "UPDATE_CART_QUANTITY"
  productId?: string
  productName: string
  quantity: number
}

export interface ClearCartIntent {
  type: "CLEAR_CART"
}

// =============================================================================
// ORDER INTENTS
// =============================================================================

export interface ViewOrdersIntent {
  type: "VIEW_ORDERS"
}

export interface OrderDetailsIntent {
  type: "ORDER_DETAILS"
  orderCode: string
}

export interface RepeatOrderIntent {
  type: "REPEAT_ORDER"
  orderCode?: string  // Optional: if provided, repeat specific order; otherwise repeat last order
}

// =============================================================================
// SUPPORT INTENTS
// =============================================================================

export interface AskIdentityIntent {
  type: "ASK_IDENTITY"
}

export interface AskLocationIntent {
  type: "ASK_LOCATION"
}

export interface AskFAQIntent {
  type: "ASK_FAQ"
  query: string
}

export interface RequestHumanIntent {
  type: "REQUEST_HUMAN"
  reason?: string
}

export interface AskContactIntent {
  type: "ASK_CONTACT"
}

// =============================================================================
// AGENT INFO INTENT (B2B feature)
// @see Feature 202 - Order Selection & Agent Variables
// =============================================================================

export interface ShowAgentInfoIntent {
  type: "SHOW_AGENT_INFO"
}

// =============================================================================
// SELECTION INTENTS (from numbered lists)
// =============================================================================

export interface SelectOptionIntent {
  type: "SELECT_OPTION"
  number: number
  resolvedValue: string  // The actual name/code extracted from history
  listType: ListType
  skus?: string[]  // 🆕 For smart grouping: SKUs of products in the selected group
  optionId?: string  // 🆕 For actions: the ID of the selected option (e.g., "SEND_INVOICE", "REPEAT_ORDER")
}

// =============================================================================
// CONFIRMATION INTENTS
// =============================================================================

export interface ConfirmIntent {
  type: "CONFIRM"
  context?: string  // What was being confirmed
}

export interface RejectIntent {
  type: "REJECT"
  context?: string  // What was being rejected
}

// =============================================================================
// SERVICE INTENTS
// =============================================================================

export interface ViewServicesIntent {
  type: "VIEW_SERVICES"
}

export interface ShowServiceIntent {
  type: "SHOW_SERVICE"
  serviceName: string
}

// =============================================================================
// CHECKOUT INTENTS
// =============================================================================

export interface StartCheckoutIntent {
  type: "START_CHECKOUT"
}

// =============================================================================
// PROFILE INTENTS
// =============================================================================

export interface ViewProfileIntent {
  type: "VIEW_PROFILE"
}

export interface UpdateProfileIntent {
  type: "UPDATE_PROFILE"
  field: string
  value: string
}

// =============================================================================
// UNKNOWN INTENT (fallback)
// =============================================================================

export interface UnknownIntent {
  type: "UNKNOWN"
  originalMessage: string
  possibleIntents?: string[]  // Suggestions from LLM fallback
}

// =============================================================================
// UNION TYPE - All possible intents
// =============================================================================

export type Intent =
  // Product Search
  | ShowCategoriesIntent
  | ShowCategoryIntent
  | ShowGroupIntent
  | ShowProductIntent
  | ShowProductsIntent
  | SearchProductsIntent
  | ShowOffersIntent
  
  // Cart
  | ViewCartIntent
  | AddToCartIntent
  | RemoveFromCartIntent
  | UpdateCartQuantityIntent
  | ClearCartIntent
  
  // Orders
  | ViewOrdersIntent
  | OrderDetailsIntent
  | RepeatOrderIntent
  
  // Support
  | AskIdentityIntent
  | AskLocationIntent
  | AskFAQIntent
  | RequestHumanIntent
  | AskContactIntent
  | ShowAgentInfoIntent
  
  // Selection
  | SelectOptionIntent
  
  // Confirmation
  | ConfirmIntent
  | RejectIntent
  
  // Services
  | ViewServicesIntent
  | ShowServiceIntent
  
  // Checkout
  | StartCheckoutIntent
  
  // Profile
  | ViewProfileIntent
  | UpdateProfileIntent
  
  // Unknown
  | UnknownIntent

// =============================================================================
// INTENT RESULT - Wrapper with metadata
// =============================================================================

export interface IntentResult {
  intent: Intent
  confidence: "HIGH" | "MEDIUM" | "LOW"
  source: "PATTERN" | "KEYWORD" | "LLM_FALLBACK"
  processingTimeMs: number
}

// =============================================================================
// CONVERSATION CONTEXT - For intent parsing
// =============================================================================

export interface ConversationContext {
  lastAssistantMessage?: string
  lastListType?: ListType
  lastListItems?: ListItem[]
  activeCategory?: string
  activeGroup?: string
  pendingConfirmation?: PendingConfirmation
}

export interface ListItem {
  number: number
  value: string       // Name or code
  metadata?: {
    price?: number
    count?: number
    code?: string
  }
}

export interface PendingConfirmation {
  action: "ADD_TO_CART" | "REMOVE_FROM_CART" | "CLEAR_CART" | "CHECKOUT"
  data: Record<string, any>
}

// =============================================================================
// TYPE GUARDS - For type-safe intent handling
// =============================================================================

export function isProductSearchIntent(intent: Intent): intent is 
  | ShowCategoriesIntent 
  | ShowCategoryIntent 
  | ShowGroupIntent
  | ShowProductIntent 
  | ShowProductsIntent
  | SearchProductsIntent
  | ShowOffersIntent {
  return [
    "SHOW_CATEGORIES",
    "SHOW_CATEGORY",
    "SHOW_GROUP",
    "SHOW_PRODUCT",
    "SHOW_PRODUCTS",
    "SEARCH_PRODUCTS",
    "SHOW_OFFERS"
  ].includes(intent.type)
}

export function isCartIntent(intent: Intent): intent is 
  | ViewCartIntent 
  | AddToCartIntent 
  | RemoveFromCartIntent 
  | UpdateCartQuantityIntent
  | ClearCartIntent {
  return [
    "VIEW_CART",
    "ADD_TO_CART",
    "REMOVE_FROM_CART",
    "UPDATE_CART_QUANTITY",
    "CLEAR_CART"
  ].includes(intent.type)
}

export function isOrderIntent(intent: Intent): intent is 
  | ViewOrdersIntent 
  | OrderDetailsIntent {
  return ["VIEW_ORDERS", "ORDER_DETAILS"].includes(intent.type)
}

export function isServiceIntent(intent: Intent): intent is 
  | ViewServicesIntent 
  | ShowServiceIntent {
  return ["VIEW_SERVICES", "SHOW_SERVICE"].includes(intent.type)
}

export function isSupportIntent(intent: Intent): intent is 
  | AskIdentityIntent 
  | AskLocationIntent 
  | AskFAQIntent 
  | RequestHumanIntent
  | AskContactIntent
  | ShowAgentInfoIntent
  | ViewProfileIntent {
  return [
    "ASK_IDENTITY",
    "ASK_LOCATION",
    "ASK_FAQ",
    "REQUEST_HUMAN",
    "ASK_CONTACT",
    "SHOW_AGENT_INFO",
    "VIEW_PROFILE"
  ].includes(intent.type)
}

export function isSelectionIntent(intent: Intent): intent is SelectOptionIntent {
  return intent.type === "SELECT_OPTION"
}

export function isConfirmationIntent(intent: Intent): intent is ConfirmIntent | RejectIntent {
  return ["CONFIRM", "REJECT"].includes(intent.type)
}

export function isUnknownIntent(intent: Intent): intent is UnknownIntent {
  return intent.type === "UNKNOWN"
}
