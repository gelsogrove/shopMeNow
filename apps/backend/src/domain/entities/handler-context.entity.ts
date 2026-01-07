/**
 * Handler Context Entities
 * Context data passed to different handler types
 */

import { LoadedData, RoutingWorkspaceConfig } from "./routing.entity"

/**
 * Context for SimpleIntentHandler
 * Contains data needed for pattern/keyword matched intents
 */
export interface SimpleIntentHandlerContext {
  message: string
  customerId: string
  conversationId: string
  workspaceId: string
  workspace: RoutingWorkspaceConfig
  loadedData: LoadedData
  conversationHistory?: Array<{ role: "customer" | "bot"; content: string }>
}

/**
 * Context for LLMIntentHandler
 * Contains data needed for LLM-based intent routing
 */
export interface LLMIntentHandlerContext {
  message: string
  customerId: string
  conversationId: string
  workspaceId: string
  workspace: RoutingWorkspaceConfig
  loadedData: LoadedData
  conversationHistory?: Array<{ role: "customer" | "bot"; content: string }>
}

/**
 * Union type for any handler context
 */
export type AnyHandlerContext = SimpleIntentHandlerContext | LLMIntentHandlerContext
