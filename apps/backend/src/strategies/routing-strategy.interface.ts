/**
 * Routing Strategy Interface
 * 
 * Defines contract for different routing strategies based on workspace type.
 * Used by RouterOrchestrationService to select appropriate routing logic.
 * 
 * Strategies:
 * - InformationalWorkspaceStrategy: For workspaces with sellsProductsAndServices=false
 * - EcommerceWorkspaceStrategy: For workspaces with sellsProductsAndServices=true
 * 
 * @pattern Strategy Pattern
 * @architecture Clean Architecture with SOLID principles
 */

import type { AgentType, Workspace } from "@echatbot/database"

/**
 * Context passed to routing strategies
 */
export interface RoutingContext {
  workspaceId: string
  customerId: string
  customerName?: string
  customerLanguage?: string
  message: string
  conversationId?: string
  isSystemMessage?: boolean
  sessionId?: string
  channel?: string // 🆕 'widget' | 'whatsapp' - determines SafetyTranslation behavior
}

/**
 * Result returned from routing strategies
 */
export interface RoutingResult {
  response: string
  agentType: AgentType
  debugSteps?: any[]
  totalTokens?: number
  conversationId?: string
  optionsMapping?: any
  action?: any
}

/**
 * Base interface for routing strategies
 */
export interface RoutingStrategy {
  /**
   * Check if this strategy can handle the given workspace
   */
  canHandle(workspace: Workspace): boolean

  /**
   * Route the message according to strategy-specific logic
   */
  route(context: RoutingContext, workspace: Workspace): Promise<RoutingResult>
}
