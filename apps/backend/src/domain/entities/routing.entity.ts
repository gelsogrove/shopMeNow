/**
 * Routing Domain Entities
 * Single source of truth for all routing-related types
 */

/**
 * Core intent type detected from customer message
 */
export interface Intent {
  type: IntentType
  confidence: number
  source: "PATTERN" | "KEYWORD" | "LLM"
  metadata?: Record<string, any>
}

/**
 * All possible intent types in the system
 */
export type IntentType =
  | "SHOW_PRODUCTS"
  | "ADD_TO_CART"
  | "REPEAT_ORDER"
  | "VIEW_CART"
  | "CONTINUE_CHECKOUT"
  | "INCOMPREHENSIBLE"

/**
 * Routing path decision: where to send the intent
 */
export type RoutingPath = "SIMPLE" | "LLM" | "FAQ"

/**
 * Input context for routing decisions
 */
export interface RoutingContext {
  message: string
  customerId: string
  conversationId: string
  workspaceId: string
  conversationHistory?: Array<{ role: "customer" | "bot"; content: string }>
  workspace?: any
}

/**
 * Complete routing decision with metadata
 */
export interface RoutingDecision {
  intent: Intent
  path: RoutingPath
  workspace: any
  confidence: number
  source: "PATTERN" | "KEYWORD" | "LLM"
  timestamp: Date
  dataLoaded: {
    workspace: boolean
    products: boolean
    faqs: boolean
    services: boolean
    offers: boolean
  }
}

/**
 * Data loaded during routing for the handler
 */
export interface LoadedData {
  products?: any[]
  faqs?: any[]
  services?: any[]
  offers?: any[]
}

/**
 * Handler output structure
 */
export interface HandlerResult {
  message: string
  agentUsed: "SIMPLE" | "LLM" | "FAQ"
  workspaceId: string
  customerId: string
  conversationId: string
  confidence: number
  metadata?: Record<string, any>
}

/**
 * Workspace configuration for routing
 */
export interface RoutingWorkspaceConfig {
  workspaceId: string
  enableProducts: boolean
  enableFAQ: boolean
  enableServices: boolean
  enableOffers: boolean
  defaultPath: RoutingPath
  preferredLanguage: string
}
