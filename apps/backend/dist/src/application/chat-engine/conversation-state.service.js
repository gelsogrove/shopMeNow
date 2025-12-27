"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationStateService = exports.NUMERIC_MEANS_CART_ACTION = exports.NUMERIC_MEANS_ORDER_ACTION = exports.NUMERIC_MEANS_SERVICE = exports.NUMERIC_MEANS_CATEGORY = exports.NUMERIC_MEANS_ORDER = exports.NUMERIC_MEANS_PRODUCT = exports.CONFIRM_TRIGGERS_CHECKOUT = exports.ConversationState = void 0;
const logger_1 = __importDefault(require("../../utils/logger"));
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
var ConversationState;
(function (ConversationState) {
    // === Initial/Default States ===
    ConversationState["IDLE"] = "IDLE";
    // === Browsing States ===
    ConversationState["BROWSING_CATEGORIES"] = "BROWSING_CATEGORIES";
    ConversationState["BROWSING_SUBCATEGORIES"] = "BROWSING_SUBCATEGORIES";
    ConversationState["BROWSING_PRODUCTS"] = "BROWSING_PRODUCTS";
    ConversationState["BROWSING_ORDERS"] = "BROWSING_ORDERS";
    ConversationState["BROWSING_SERVICES"] = "BROWSING_SERVICES";
    ConversationState["BROWSING_GROUPS"] = "BROWSING_GROUPS";
    // === Detail View States ===
    ConversationState["VIEWING_PRODUCT"] = "VIEWING_PRODUCT";
    ConversationState["VIEWING_SERVICE"] = "VIEWING_SERVICE";
    ConversationState["VIEWING_ORDER"] = "VIEWING_ORDER";
    ConversationState["VIEWING_ORDER_ACTIONS"] = "VIEWING_ORDER_ACTIONS";
    ConversationState["VIEWING_CART_ACTIONS"] = "VIEWING_CART_ACTIONS";
    ConversationState["VIEWING_CART"] = "VIEWING_CART";
    // === Confirmation Waiting States ===
    ConversationState["AWAITING_ADD_CONFIRM"] = "AWAITING_ADD_CONFIRM";
    ConversationState["AWAITING_ORDER_CONFIRM"] = "AWAITING_ORDER_CONFIRM";
    ConversationState["AWAITING_CHECKOUT"] = "AWAITING_CHECKOUT";
    // === Multi-step Process States ===
    ConversationState["IN_CHECKOUT"] = "IN_CHECKOUT";
    ConversationState["IN_REGISTRATION"] = "IN_REGISTRATION";
})(ConversationState || (exports.ConversationState = ConversationState = {}));
/**
 * State transition rules
 * Format: [currentState, intent] → newState
 */
const STATE_TRANSITIONS = new Map([
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
]);
/**
 * States where CONFIRM triggers START_CHECKOUT
 */
exports.CONFIRM_TRIGGERS_CHECKOUT = [
    ConversationState.AWAITING_ORDER_CONFIRM,
    ConversationState.VIEWING_CART,
];
/**
 * States where numeric selection means "select product"
 */
exports.NUMERIC_MEANS_PRODUCT = [
    ConversationState.BROWSING_PRODUCTS,
    ConversationState.BROWSING_SUBCATEGORIES,
    ConversationState.BROWSING_GROUPS,
];
/**
 * States where numeric selection means "select order"
 */
exports.NUMERIC_MEANS_ORDER = [
    ConversationState.BROWSING_ORDERS,
    ConversationState.VIEWING_ORDER_ACTIONS,
];
/**
 * States where numeric selection means "select category"
 */
exports.NUMERIC_MEANS_CATEGORY = [
    ConversationState.BROWSING_CATEGORIES,
];
/**
 * States where numeric selection means "select service"
 */
exports.NUMERIC_MEANS_SERVICE = [
    ConversationState.BROWSING_SERVICES,
];
/**
 * States where numeric selection means "select order action"
 */
exports.NUMERIC_MEANS_ORDER_ACTION = [
    ConversationState.VIEWING_ORDER,
    ConversationState.VIEWING_ORDER_ACTIONS,
];
/**
 * States where numeric selection means "select cart action"
 */
exports.NUMERIC_MEANS_CART_ACTION = [
    ConversationState.VIEWING_CART_ACTIONS,
    ConversationState.VIEWING_CART,
];
class ConversationStateService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Get current conversation state from ChatSession.context
     */
    getState(chatSessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const session = yield this.prisma.chatSession.findUnique({
                    where: { id: chatSessionId },
                    select: { context: true },
                });
                const context = session === null || session === void 0 ? void 0 : session.context;
                const stateContext = context === null || context === void 0 ? void 0 : context.conversationState;
                if (!stateContext) {
                    // Default state for new conversations
                    return {
                        state: ConversationState.IDLE,
                        stateEnteredAt: new Date().toISOString(),
                    };
                }
                logger_1.default.debug("🔄 [FSM] Loaded state", {
                    chatSessionId: chatSessionId.substring(0, 8),
                    state: stateContext.state,
                    pendingAction: (_a = stateContext.pendingAction) === null || _a === void 0 ? void 0 : _a.type,
                });
                return stateContext;
            }
            catch (error) {
                logger_1.default.error("❌ [FSM] Failed to load state", { chatSessionId, error });
                return {
                    state: ConversationState.IDLE,
                    stateEnteredAt: new Date().toISOString(),
                };
            }
        });
    }
    /**
     * Update conversation state in ChatSession.context
     */
    setState(chatSessionId, newState, additionalContext) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            try {
                const session = yield this.prisma.chatSession.findUnique({
                    where: { id: chatSessionId },
                    select: { context: true },
                });
                const existingContext = (session === null || session === void 0 ? void 0 : session.context) || {};
                const existingStateContext = existingContext.conversationState;
                // Build new state context
                const newStateContext = {
                    state: newState,
                    stateEnteredAt: new Date().toISOString(),
                    // Preserve existing context data unless overridden
                    selectedCategoryId: (_a = additionalContext === null || additionalContext === void 0 ? void 0 : additionalContext.selectedCategoryId) !== null && _a !== void 0 ? _a : existingStateContext === null || existingStateContext === void 0 ? void 0 : existingStateContext.selectedCategoryId,
                    selectedCategoryName: (_b = additionalContext === null || additionalContext === void 0 ? void 0 : additionalContext.selectedCategoryName) !== null && _b !== void 0 ? _b : existingStateContext === null || existingStateContext === void 0 ? void 0 : existingStateContext.selectedCategoryName,
                    selectedProductId: (_c = additionalContext === null || additionalContext === void 0 ? void 0 : additionalContext.selectedProductId) !== null && _c !== void 0 ? _c : existingStateContext === null || existingStateContext === void 0 ? void 0 : existingStateContext.selectedProductId,
                    selectedProductSku: (_d = additionalContext === null || additionalContext === void 0 ? void 0 : additionalContext.selectedProductSku) !== null && _d !== void 0 ? _d : existingStateContext === null || existingStateContext === void 0 ? void 0 : existingStateContext.selectedProductSku,
                    selectedProductName: (_e = additionalContext === null || additionalContext === void 0 ? void 0 : additionalContext.selectedProductName) !== null && _e !== void 0 ? _e : existingStateContext === null || existingStateContext === void 0 ? void 0 : existingStateContext.selectedProductName,
                    selectedOrderId: (_f = additionalContext === null || additionalContext === void 0 ? void 0 : additionalContext.selectedOrderId) !== null && _f !== void 0 ? _f : existingStateContext === null || existingStateContext === void 0 ? void 0 : existingStateContext.selectedOrderId,
                    selectedOrderCode: (_g = additionalContext === null || additionalContext === void 0 ? void 0 : additionalContext.selectedOrderCode) !== null && _g !== void 0 ? _g : existingStateContext === null || existingStateContext === void 0 ? void 0 : existingStateContext.selectedOrderCode,
                    pendingAction: additionalContext === null || additionalContext === void 0 ? void 0 : additionalContext.pendingAction,
                    // Keep last 3 states in history
                    stateHistory: [
                        ...((existingStateContext === null || existingStateContext === void 0 ? void 0 : existingStateContext.stateHistory) || []).slice(-2),
                        { state: (existingStateContext === null || existingStateContext === void 0 ? void 0 : existingStateContext.state) || ConversationState.IDLE, timestamp: new Date().toISOString() },
                    ],
                };
                // Clear context data that doesn't apply to new state
                if (newState === ConversationState.IDLE) {
                    delete newStateContext.selectedCategoryId;
                    delete newStateContext.selectedCategoryName;
                    delete newStateContext.selectedProductId;
                    delete newStateContext.selectedProductSku;
                    delete newStateContext.selectedProductName;
                    delete newStateContext.selectedOrderId;
                    delete newStateContext.selectedOrderCode;
                    delete newStateContext.pendingAction;
                }
                // Save to database (use JSON.parse/stringify to ensure Prisma-compatible JSON)
                const contextToSave = JSON.parse(JSON.stringify(Object.assign(Object.assign({}, existingContext), { conversationState: newStateContext })));
                yield this.prisma.chatSession.update({
                    where: { id: chatSessionId },
                    data: {
                        context: contextToSave,
                    },
                });
                logger_1.default.info("🔄 [FSM] State updated", {
                    chatSessionId: chatSessionId.substring(0, 8),
                    previousState: (existingStateContext === null || existingStateContext === void 0 ? void 0 : existingStateContext.state) || "NONE",
                    newState,
                    pendingAction: (_h = newStateContext.pendingAction) === null || _h === void 0 ? void 0 : _h.type,
                });
                return newStateContext;
            }
            catch (error) {
                logger_1.default.error("❌ [FSM] Failed to save state", { chatSessionId, newState, error });
                throw error;
            }
        });
    }
    /**
     * Get the next state based on current state and intent
     */
    getNextState(currentState, intent) {
        const key = `${currentState}:${intent}`;
        const nextState = STATE_TRANSITIONS.get(key);
        if (nextState) {
            logger_1.default.debug("🔄 [FSM] Transition found", { currentState, intent, nextState });
            return nextState;
        }
        // Allow transition from any state for these global intents
        const globalIntents = ["VIEW_CART", "VIEW_ORDERS", "SHOW_CATEGORIES", "GREETING", "FAQ"];
        if (globalIntents.includes(intent)) {
            const globalKey = `${ConversationState.IDLE}:${intent}`;
            const globalNextState = STATE_TRANSITIONS.get(globalKey);
            if (globalNextState) {
                logger_1.default.debug("🔄 [FSM] Global transition", { currentState, intent, nextState: globalNextState });
                return globalNextState;
            }
        }
        logger_1.default.debug("🔄 [FSM] No transition found", { currentState, intent });
        return null;
    }
    /**
     * Transition to new state and save
     */
    transition(chatSessionId, intent, additionalContext) {
        return __awaiter(this, void 0, void 0, function* () {
            const currentStateContext = yield this.getState(chatSessionId);
            const currentState = currentStateContext.state;
            const nextState = this.getNextState(currentState, intent);
            if (nextState) {
                return yield this.setState(chatSessionId, nextState, additionalContext);
            }
            // No valid transition - stay in current state
            logger_1.default.warn("⚠️ [FSM] Invalid transition, staying in current state", {
                chatSessionId: chatSessionId.substring(0, 8),
                currentState,
                intent,
            });
            return currentStateContext;
        });
    }
    /**
     * Check what a numeric selection means in current state
     */
    getNumericSelectionType(state) {
        if (exports.NUMERIC_MEANS_PRODUCT.includes(state))
            return "PRODUCT";
        if (exports.NUMERIC_MEANS_ORDER.includes(state))
            return "ORDER";
        if (exports.NUMERIC_MEANS_CATEGORY.includes(state))
            return "CATEGORY";
        if (exports.NUMERIC_MEANS_ORDER_ACTION.includes(state))
            return "ORDER_ACTION";
        return "UNKNOWN";
    }
    /**
     * Check if CONFIRM should trigger checkout in current state
     */
    shouldConfirmTriggerCheckout(state) {
        return exports.CONFIRM_TRIGGERS_CHECKOUT.includes(state);
    }
    /**
     * Clear state (reset to IDLE)
     */
    clearState(chatSessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.setState(chatSessionId, ConversationState.IDLE);
        });
    }
}
exports.ConversationStateService = ConversationStateService;
//# sourceMappingURL=conversation-state.service.js.map