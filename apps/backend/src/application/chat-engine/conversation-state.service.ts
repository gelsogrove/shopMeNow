/**
 * ConversationStateService - Finite State Machine (FSM) for Chat Conversations
 *
 * Implements Dialog State Tracking pattern for reliable conversation flow.
 *
 * CRITICAL: Replaces "context guessing" with explicit state management.
 *
 * Benefits:
 * - Predictable behavior: Always know what state we're in
 * - Reliable transitions: CONFIRM after AWAITING_CONFIRMATION → START_CHECKOUT
 * - Easy debugging: State is explicit, not inferred from message content
 * - Maintainable: Add states/transitions without if/else chains
 *
 * @see docs/PRD.md - Chat architecture section
 */

import { PrismaClient } from "@echatbot/database"
import logger from "../../utils/logger"

/**
 * Conversation States - Explicit states for the dialog flow
 *
 * NAMING CONVENTION:
 * - IDLE: Waiting for user input, no pending action
 * - BROWSING_*: User is navigating (categories, products, orders)
 * - VIEWING_*: User is looking at a single item detail
 * - AWAITING_*: Waiting for user confirmation
 * - IN_*: User is in a multi-step process
 */
export enum ConversationState {
  // === Initial/Default States ===
  IDLE = "IDLE",                           // No pending action, ready for anything

  // === Browsing States ===
  BROWSING_CATEGORIES = "BROWSING_CATEGORIES",   // User looking at category list
  BROWSING_SUBCATEGORIES = "BROWSING_SUBCATEGORIES", // User looking at subcategory/group list
  BROWSING_PRODUCTS = "BROWSING_PRODUCTS",       // User looking at product list
  BROWSING_ORDERS = "BROWSING_ORDERS",           // User looking at order list
  BROWSING_SERVICES = "BROWSING_SERVICES",       // User looking at services list
  BROWSING_GROUPS = "BROWSING_GROUPS",           // User looking at grouped products (subcategories/LLM groups)

  // === Detail View States ===
  VIEWING_PRODUCT = "VIEWING_PRODUCT",           // User looking at single product detail
  VIEWING_SERVICE = "VIEWING_SERVICE",           // User looking at single service detail
  VIEWING_ORDER = "VIEWING_ORDER",               // User looking at single order detail
  VIEWING_ORDER_ACTIONS = "VIEWING_ORDER_ACTIONS", // User looking at order action menu
  VIEWING_CART_ACTIONS = "VIEWING_CART_ACTIONS",   // User looking at cart action menu
  VIEWING_CART = "VIEWING_CART",                 // User looking at cart contents

  // === Confirmation Waiting States ===
  AWAITING_ADD_CONFIRM = "AWAITING_ADD_CONFIRM",     // "Vuoi aggiungere al carrello?"
  AWAITING_ORDER_CONFIRM = "AWAITING_ORDER_CONFIRM", // "Confermi l'ordine?" (dopo ripeti ordine)
  AWAITING_CHECKOUT = "AWAITING_CHECKOUT",           // "Procedi al checkout?"
  
  // === Multi-step Process States ===
  IN_CHECKOUT = "IN_CHECKOUT",                   // User is in checkout flow
  IN_REGISTRATION = "IN_REGISTRATION",           // User is registering

}

/**
 * Intent types that can trigger state transitions
 */
export type IntentType = 
  | "SHOW_CATEGORIES"
  | "SELECT_CATEGORY"
  | "SELECT_PRODUCT"
  | "SELECT_ORDER"
  | "VIEW_CART"
  | "ADD_TO_CART"
  | "START_CHECKOUT"
  | "CONFIRM"
  | "DENY"
  | "VIEW_ORDERS"
  | "ORDER_ACTION_INVOICE"
  | "ORDER_ACTION_REPEAT"
  | "REPEAT_ORDER"
  | "GREETING"
  | "FAQ"
  | "UNKNOWN"

/**
 * State context data - additional info stored with state
 */
export interface StateContext {
  // Current state
  state: ConversationState
  
  // Timestamp for state timeout
  stateEnteredAt: string
  
  // Context-specific data
  selectedCategoryId?: string
  selectedCategoryName?: string
  selectedProductId?: string
  selectedProductSku?: string
  selectedProductName?: string
  selectedOrderId?: string
  selectedOrderCode?: string
  
  // For AWAITING_* states: what action to perform on CONFIRM
  pendingAction?: {
    type: "ADD_TO_CART" | "CONFIRM_ORDER" | "START_CHECKOUT" | "CANCEL_ORDER"
    productId?: string
    productName?: string
    quantity?: number
    orderId?: string
    orderCode?: string
  }
  
  // History for debugging (last 3 states)
  stateHistory?: Array<{ state: ConversationState; timestamp: string }>
}

/**
 * State transition rules
 * Format: [currentState, intent] → newState
 */
const STATE_TRANSITIONS: Map<string, ConversationState> = new Map([
  // From IDLE
  [`${ConversationState.IDLE}:SHOW_CATEGORIES`, ConversationState.BROWSING_CATEGORIES],
  [`${ConversationState.IDLE}:VIEW_ORDERS`, ConversationState.BROWSING_ORDERS],
  [`${ConversationState.IDLE}:VIEW_CART`, ConversationState.VIEWING_CART],
  [`${ConversationState.IDLE}:GREETING`, ConversationState.IDLE],
  [`${ConversationState.IDLE}:FAQ`, ConversationState.IDLE],
  
  // From BROWSING_CATEGORIES
  [`${ConversationState.BROWSING_CATEGORIES}:SELECT_CATEGORY`, ConversationState.BROWSING_SUBCATEGORIES],
  [`${ConversationState.BROWSING_CATEGORIES}:VIEW_CART`, ConversationState.VIEWING_CART],
  [`${ConversationState.BROWSING_CATEGORIES}:VIEW_ORDERS`, ConversationState.BROWSING_ORDERS],
  [`${ConversationState.BROWSING_CATEGORIES}:SELECT_GROUP`, ConversationState.BROWSING_GROUPS],
  
  // From BROWSING_SUBCATEGORIES (groups/filtered products)
  [`${ConversationState.BROWSING_SUBCATEGORIES}:SELECT_CATEGORY`, ConversationState.BROWSING_PRODUCTS],
  [`${ConversationState.BROWSING_SUBCATEGORIES}:SELECT_PRODUCT`, ConversationState.VIEWING_PRODUCT],
  [`${ConversationState.BROWSING_SUBCATEGORIES}:VIEW_CART`, ConversationState.VIEWING_CART],

  // From BROWSING_GROUPS (LLM/grouped products)
  [`${ConversationState.BROWSING_GROUPS}:SELECT_PRODUCT`, ConversationState.VIEWING_PRODUCT],
  [`${ConversationState.BROWSING_GROUPS}:VIEW_CART`, ConversationState.VIEWING_CART],
  
  // From BROWSING_PRODUCTS
  [`${ConversationState.BROWSING_PRODUCTS}:SELECT_PRODUCT`, ConversationState.VIEWING_PRODUCT],
  [`${ConversationState.BROWSING_PRODUCTS}:VIEW_CART`, ConversationState.VIEWING_CART],
  [`${ConversationState.BROWSING_PRODUCTS}:SHOW_CATEGORIES`, ConversationState.BROWSING_CATEGORIES],
  
  // From VIEWING_PRODUCT
  [`${ConversationState.VIEWING_PRODUCT}:ADD_TO_CART`, ConversationState.AWAITING_ADD_CONFIRM],
  [`${ConversationState.VIEWING_PRODUCT}:VIEW_CART`, ConversationState.VIEWING_CART],
  [`${ConversationState.VIEWING_PRODUCT}:SHOW_CATEGORIES`, ConversationState.BROWSING_CATEGORIES],
  
  // From BROWSING_SERVICES
  [`${ConversationState.BROWSING_SERVICES}:SELECT_SERVICE`, ConversationState.VIEWING_SERVICE],
  [`${ConversationState.BROWSING_SERVICES}:VIEW_CART`, ConversationState.VIEWING_CART],
  [`${ConversationState.BROWSING_SERVICES}:SHOW_CATEGORIES`, ConversationState.BROWSING_CATEGORIES],
  
  // From VIEWING_SERVICE
  [`${ConversationState.VIEWING_SERVICE}:ADD_TO_CART`, ConversationState.AWAITING_ADD_CONFIRM],
  [`${ConversationState.VIEWING_SERVICE}:VIEW_CART`, ConversationState.VIEWING_CART],
  [`${ConversationState.VIEWING_SERVICE}:SHOW_CATEGORIES`, ConversationState.BROWSING_CATEGORIES],
  
  // From AWAITING_ADD_CONFIRM
  [`${ConversationState.AWAITING_ADD_CONFIRM}:CONFIRM`, ConversationState.IDLE], // Added to cart, back to idle
  [`${ConversationState.AWAITING_ADD_CONFIRM}:DENY`, ConversationState.VIEWING_PRODUCT], // Go back to product
  
  // From BROWSING_ORDERS
  [`${ConversationState.BROWSING_ORDERS}:SELECT_ORDER`, ConversationState.VIEWING_ORDER],
  [`${ConversationState.BROWSING_ORDERS}:VIEW_CART`, ConversationState.VIEWING_CART],
  [`${ConversationState.BROWSING_ORDERS}:SHOW_CATEGORIES`, ConversationState.BROWSING_CATEGORIES],
  
  // From VIEWING_ORDER
  [`${ConversationState.VIEWING_ORDER}:ORDER_ACTION_INVOICE`, ConversationState.IDLE], // Invoice sent, done
  [`${ConversationState.VIEWING_ORDER}:ORDER_ACTION_REPEAT`, ConversationState.AWAITING_ORDER_CONFIRM],
  [`${ConversationState.VIEWING_ORDER}:REPEAT_ORDER`, ConversationState.AWAITING_ORDER_CONFIRM],
  [`${ConversationState.VIEWING_ORDER}:VIEW_ORDERS`, ConversationState.BROWSING_ORDERS],
  [`${ConversationState.VIEWING_ORDER}:VIEW_CART`, ConversationState.VIEWING_CART],
  
  // From VIEWING_ORDER_ACTIONS (list of actions: 1.Fattura 2.Ripeti)
  [`${ConversationState.VIEWING_ORDER_ACTIONS}:ORDER_ACTION_INVOICE`, ConversationState.IDLE],
  [`${ConversationState.VIEWING_ORDER_ACTIONS}:ORDER_ACTION_REPEAT`, ConversationState.AWAITING_ORDER_CONFIRM],
  [`${ConversationState.VIEWING_ORDER_ACTIONS}:REPEAT_ORDER`, ConversationState.AWAITING_ORDER_CONFIRM],
  
  // From AWAITING_ORDER_CONFIRM (after "Ripeti ordine" success)
  [`${ConversationState.AWAITING_ORDER_CONFIRM}:CONFIRM`, ConversationState.IN_CHECKOUT], // → START_CHECKOUT
  [`${ConversationState.AWAITING_ORDER_CONFIRM}:DENY`, ConversationState.VIEWING_CART], // Show cart without checkout
  
  // From VIEWING_CART
  [`${ConversationState.VIEWING_CART}:START_CHECKOUT`, ConversationState.IN_CHECKOUT],
  [`${ConversationState.VIEWING_CART}:CONFIRM`, ConversationState.IN_CHECKOUT], // "conferma" when viewing cart → checkout
  [`${ConversationState.VIEWING_CART}:SHOW_CATEGORIES`, ConversationState.BROWSING_CATEGORIES],
  [`${ConversationState.VIEWING_CART}:ADD_TO_CART`, ConversationState.IDLE], // Added more items
  
  // From IN_CHECKOUT
  [`${ConversationState.IN_CHECKOUT}:CONFIRM`, ConversationState.IDLE], // Order placed!
  [`${ConversationState.IN_CHECKOUT}:DENY`, ConversationState.VIEWING_CART],
])

/**
 * States where CONFIRM triggers START_CHECKOUT
 */
export const CONFIRM_TRIGGERS_CHECKOUT: ConversationState[] = [
  ConversationState.AWAITING_ORDER_CONFIRM,
  ConversationState.VIEWING_CART,
]

/**
 * States where numeric selection means "select product"
 */
export const NUMERIC_MEANS_PRODUCT: ConversationState[] = [
  ConversationState.BROWSING_PRODUCTS,
  ConversationState.BROWSING_SUBCATEGORIES,
  ConversationState.BROWSING_GROUPS,
]

/**
 * States where numeric selection means "select order"
 */
export const NUMERIC_MEANS_ORDER: ConversationState[] = [
  ConversationState.BROWSING_ORDERS,
  ConversationState.VIEWING_ORDER_ACTIONS,
]

/**
 * States where numeric selection means "select category"
 */
export const NUMERIC_MEANS_CATEGORY: ConversationState[] = [
  ConversationState.BROWSING_CATEGORIES,
]

/**
 * States where numeric selection means "select service"
 */
export const NUMERIC_MEANS_SERVICE: ConversationState[] = [
  ConversationState.BROWSING_SERVICES,
]

/**
 * States where numeric selection means "select order action"
 */
export const NUMERIC_MEANS_ORDER_ACTION: ConversationState[] = [
  ConversationState.VIEWING_ORDER,
  ConversationState.VIEWING_ORDER_ACTIONS,
]

/**
 * States where numeric selection means "select cart action"
 */
export const NUMERIC_MEANS_CART_ACTION: ConversationState[] = [
  ConversationState.VIEWING_CART_ACTIONS,
  ConversationState.VIEWING_CART,
]

export class ConversationStateService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get current conversation state from ChatSession.context
   */
  async getState(chatSessionId: string): Promise<StateContext> {
    try {
      const session = await this.prisma.chatSession.findUnique({
        where: { id: chatSessionId },
        select: { context: true },
      })

      const context = session?.context as Record<string, unknown> | null
      const stateContext = context?.conversationState as StateContext | undefined

      if (!stateContext) {
        // Default state for new conversations
        return {
          state: ConversationState.IDLE,
          stateEnteredAt: new Date().toISOString(),
        }
      }

      logger.debug("🔄 [FSM] Loaded state", {
        chatSessionId: chatSessionId.substring(0, 8),
        state: stateContext.state,
        pendingAction: stateContext.pendingAction?.type,
      })

      return stateContext
    } catch (error) {
      logger.error("❌ [FSM] Failed to load state", { chatSessionId, error })
      return {
        state: ConversationState.IDLE,
        stateEnteredAt: new Date().toISOString(),
      }
    }
  }

  /**
   * Update conversation state in ChatSession.context
   */
  async setState(
    chatSessionId: string,
    newState: ConversationState,
    additionalContext?: Partial<StateContext>
  ): Promise<StateContext> {
    try {
      const session = await this.prisma.chatSession.findUnique({
        where: { id: chatSessionId },
        select: { context: true },
      })

      const existingContext = (session?.context as Record<string, unknown>) || {}
      const existingStateContext = existingContext.conversationState as StateContext | undefined

      // Build new state context
      const newStateContext: StateContext = {
        state: newState,
        stateEnteredAt: new Date().toISOString(),
        // Preserve existing context data unless overridden
        selectedCategoryId: additionalContext?.selectedCategoryId ?? existingStateContext?.selectedCategoryId,
        selectedCategoryName: additionalContext?.selectedCategoryName ?? existingStateContext?.selectedCategoryName,
        selectedProductId: additionalContext?.selectedProductId ?? existingStateContext?.selectedProductId,
        selectedProductSku: additionalContext?.selectedProductSku ?? existingStateContext?.selectedProductSku,
        selectedProductName: additionalContext?.selectedProductName ?? existingStateContext?.selectedProductName,
        selectedOrderId: additionalContext?.selectedOrderId ?? existingStateContext?.selectedOrderId,
        selectedOrderCode: additionalContext?.selectedOrderCode ?? existingStateContext?.selectedOrderCode,
        pendingAction: additionalContext?.pendingAction,
        // Keep last 3 states in history
        stateHistory: [
          ...(existingStateContext?.stateHistory || []).slice(-2),
          { state: existingStateContext?.state || ConversationState.IDLE, timestamp: new Date().toISOString() },
        ],
      }

      // Clear context data that doesn't apply to new state
      if (newState === ConversationState.IDLE) {
        delete newStateContext.selectedCategoryId
        delete newStateContext.selectedCategoryName
        delete newStateContext.selectedProductId
        delete newStateContext.selectedProductSku
        delete newStateContext.selectedProductName
        delete newStateContext.selectedOrderId
        delete newStateContext.selectedOrderCode
        delete newStateContext.pendingAction
      }

      // Save to database (use JSON.parse/stringify to ensure Prisma-compatible JSON)
      const contextToSave = JSON.parse(JSON.stringify({
        ...existingContext,
        conversationState: newStateContext,
      }))
      
      await this.prisma.chatSession.update({
        where: { id: chatSessionId },
        data: {
          context: contextToSave,
        },
      })

      logger.info("🔄 [FSM] State updated", {
        chatSessionId: chatSessionId.substring(0, 8),
        previousState: existingStateContext?.state || "NONE",
        newState,
        pendingAction: newStateContext.pendingAction?.type,
      })

      return newStateContext
    } catch (error) {
      logger.error("❌ [FSM] Failed to save state", { chatSessionId, newState, error })
      throw error
    }
  }

  /**
   * Get the next state based on current state and intent
   */
  getNextState(currentState: ConversationState, intent: IntentType): ConversationState | null {
    const key = `${currentState}:${intent}`
    const nextState = STATE_TRANSITIONS.get(key)

    if (nextState) {
      logger.debug("🔄 [FSM] Transition found", { currentState, intent, nextState })
      return nextState
    }

    // Allow transition from any state for these global intents
    const globalIntents: IntentType[] = ["VIEW_CART", "VIEW_ORDERS", "SHOW_CATEGORIES", "GREETING", "FAQ"]
    if (globalIntents.includes(intent)) {
      const globalKey = `${ConversationState.IDLE}:${intent}`
      const globalNextState = STATE_TRANSITIONS.get(globalKey)
      if (globalNextState) {
        logger.debug("🔄 [FSM] Global transition", { currentState, intent, nextState: globalNextState })
        return globalNextState
      }
    }

    logger.debug("🔄 [FSM] No transition found", { currentState, intent })
    return null
  }

  /**
   * Transition to new state and save
   */
  async transition(
    chatSessionId: string,
    intent: IntentType,
    additionalContext?: Partial<StateContext>
  ): Promise<StateContext> {
    const currentStateContext = await this.getState(chatSessionId)
    const currentState = currentStateContext.state

    const nextState = this.getNextState(currentState, intent)

    if (nextState) {
      return await this.setState(chatSessionId, nextState, additionalContext)
    }

    // No valid transition - stay in current state
    logger.warn("⚠️ [FSM] Invalid transition, staying in current state", {
      chatSessionId: chatSessionId.substring(0, 8),
      currentState,
      intent,
    })
    return currentStateContext
  }

  /**
   * Check what a numeric selection means in current state
   */
  getNumericSelectionType(state: ConversationState): "PRODUCT" | "ORDER" | "CATEGORY" | "ORDER_ACTION" | "UNKNOWN" {
    if (NUMERIC_MEANS_PRODUCT.includes(state)) return "PRODUCT"
    if (NUMERIC_MEANS_ORDER.includes(state)) return "ORDER"
    if (NUMERIC_MEANS_CATEGORY.includes(state)) return "CATEGORY"
    if (NUMERIC_MEANS_ORDER_ACTION.includes(state)) return "ORDER_ACTION"
    return "UNKNOWN"
  }

  /**
   * Check if CONFIRM should trigger checkout in current state
   */
  shouldConfirmTriggerCheckout(state: ConversationState): boolean {
    return CONFIRM_TRIGGERS_CHECKOUT.includes(state)
  }

  /**
   * Clear state (reset to IDLE)
   */
  async clearState(chatSessionId: string): Promise<StateContext> {
    return await this.setState(chatSessionId, ConversationState.IDLE)
  }
}
