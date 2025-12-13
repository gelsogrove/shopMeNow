/**
 * AppContext - Unified context object for entire request lifecycle
 *
 * OBJETIVO: Eliminar query duplicate durante toda la sesión
 * - Se construye UNA SOLA VEZ en routeMessage()
 * - Se pasa a todos los sub-agents, servicios, delegations
 * - NO más loadCustomer/loadWorkspace en cada función
 *
 * BENEFICIOS:
 * - 4 queries menos por messaggio (customer, workspace, catalog x2)
 * - Dati coerenti (stesso snapshot per tutta la richiesta)
 * - Type-safe (TypeScript controlla che tutti i campi siano usati)
 * - Compatible con LangChain (RunnableConfig pattern)
 */

import { Workspace } from "@echatbot/database"

/**
 * Complete application context for a single message processing lifecycle
 */
export interface AppContext {
  /** Workspace config + identity */
  workspace: any // Workspace type from Prisma

  /** Customer data + discount */
  customer: any // Customer type from Prisma

  /** Last order code (for tracking) */
  lastOrderCode?: string

  /** Catalog data (filtered for workspace + customer discount) */
  catalog: {
    products: any[]
    categories: any[]
    offers: any[]
    services: any[]
    faqs: any[]
  }

  /** Pre-built prompt variables (single source of truth) */
  promptVariables: any

  /** Legacy customer data (for backward compatibility during migration) */
  customerData: Record<string, any>

  /** Conversation history (last N messages) */
  conversationHistory: any[]

  /** Session metadata */
  sessionId: string
  workspaceId: string
  customerId: string
  conversationId: string
  messageId: string

  /** Timestamps */
  requestStartTime: Date
  timeoutMs?: number // For sub-agent timeout control
}

/**
 * Minimal context for operations that don't need full catalog
 */
export interface MinimalAppContext {
  workspace: any
  customer: any
  workspaceId: string
  customerId: string
  sessionId: string
}

/**
 * Builder for AppContext (ensures consistency)
 */
export class AppContextBuilder {
  /**
   * Build complete AppContext from raw data
   * Should be called ONCE per request in routeMessage()
   */
  static build(options: {
    workspace: any
    customer: any
    catalog: {
      products: any[]
      categories: any[]
      offers: any[]
      services: any[]
      faqs: any[]
    }
    lastOrderCode?: string
    promptVariables: any
    customerData: any
    conversationHistory: any[]
    sessionId: string
    workspaceId: string
    customerId: string
    conversationId: string
    messageId: string
  }): AppContext {
    return {
      workspace: options.workspace,
      customer: options.customer,
      lastOrderCode: options.lastOrderCode,
      catalog: options.catalog,
      promptVariables: options.promptVariables,
      customerData: options.customerData,
      conversationHistory: options.conversationHistory,
      sessionId: options.sessionId,
      workspaceId: options.workspaceId,
      customerId: options.customerId,
      conversationId: options.conversationId,
      messageId: options.messageId,
      requestStartTime: new Date(),
    }
  }

  /**
   * Validate that AppContext has all required fields
   */
  static validate(context: AppContext): boolean {
    return (
      !!context.workspace &&
      !!context.customer &&
      !!context.catalog &&
      !!context.promptVariables &&
      !!context.sessionId
    )
  }
}
