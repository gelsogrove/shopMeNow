"use strict";
/**
 * Intent Types - Code-First LLM Architecture
 *
 * Spec: /specs/201-code-first-llm-refactoring/README.md
 *
 * These types define ALL possible user intents that the system can handle.
 * The IntentParser converts user messages into these typed intents,
 * which are then processed deterministically by code (not LLM).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProductSearchIntent = isProductSearchIntent;
exports.isCartIntent = isCartIntent;
exports.isOrderIntent = isOrderIntent;
exports.isServiceIntent = isServiceIntent;
exports.isSupportIntent = isSupportIntent;
exports.isSelectionIntent = isSelectionIntent;
exports.isConfirmationIntent = isConfirmationIntent;
exports.isUnknownIntent = isUnknownIntent;
exports.isGreetingIntent = isGreetingIntent;
// =============================================================================
// TYPE GUARDS - For type-safe intent handling
// =============================================================================
function isProductSearchIntent(intent) {
    return [
        "SHOW_CATEGORIES",
        "SHOW_CATEGORY",
        "SHOW_GROUP",
        "SHOW_PRODUCT",
        "SHOW_PRODUCTS",
        "PRODUCT_CONTEXT",
        "SEARCH_PRODUCTS",
        "SHOW_OFFERS"
    ].includes(intent.type);
}
function isCartIntent(intent) {
    return [
        "VIEW_CART",
        "ADD_TO_CART",
        "REMOVE_FROM_CART",
        "UPDATE_CART_QUANTITY",
        "CLEAR_CART"
    ].includes(intent.type);
}
function isOrderIntent(intent) {
    return ["VIEW_ORDERS", "ORDER_DETAILS"].includes(intent.type);
}
function isServiceIntent(intent) {
    return ["VIEW_SERVICES", "SHOW_SERVICE"].includes(intent.type);
}
function isSupportIntent(intent) {
    return [
        "ASK_IDENTITY",
        "ASK_LOCATION",
        "ASK_BUSINESS_INFO",
        "ASK_FAQ",
        "REQUEST_HUMAN",
        "ASK_CONTACT",
        "SHOW_AGENT_INFO",
        "GREETING",
        "VIEW_PROFILE"
    ].includes(intent.type);
}
function isSelectionIntent(intent) {
    return intent.type === "SELECT_OPTION";
}
function isConfirmationIntent(intent) {
    return ["CONFIRM", "REJECT"].includes(intent.type);
}
function isUnknownIntent(intent) {
    return intent.type === "UNKNOWN";
}
function isGreetingIntent(intent) {
    return intent.type === "GREETING";
}
//# sourceMappingURL=intent.types.js.map