"use strict";
/**
 * Intent Patterns - Deterministic pattern matching
 *
 * Evaluated BEFORE any LLM call.
 *
 * ⚠️ PRINCIPLE XV: USER CONTEXT FREEDOM (Constitution v2.2.0)
 *
 * CRITICAL CONSTRAINTS:
 * - ✅ ONLY numeric selection allowed (e.g., "1", "2", "3")
 * - ✅ ONLY yes/no confirmation allowed (e.g., "sì", "no", "ok")
 * - ❌ NO hardcoded phrase detection (if message.includes("ordine"))
 * - ❌ NO language-specific regex patterns (/mostra.*prodotti/)
 * - ❌ NO keyword arrays (["ordine", "order", "pedido"])
 *
 * WHY: Users can switch context at ANY moment. TEXT input = reset state.
 * All phrase-based intent detection goes to Intent Parser (LLM-based).
 *
 * See: .specify/memory/constitution.md → Principle XV
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchRemovalIntent = matchRemovalIntent;
exports.matchNumericSelection = matchNumericSelection;
exports.matchAllPatterns = matchAllPatterns;
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * Detect removal/deletion commands when viewing cart
 * e.g., "rimuovi", "cancella", "togli", "remove"
 */
function matchRemovalIntent(message, context) {
    const normalized = message.toLowerCase().trim();
    // Only match if user has stated a product name (text input, not numeric)
    const removalKeywords = ["rimuovi", "cancella", "togli", "remove", "elimina", "delete"];
    const hasRemovalKeyword = removalKeywords.some(keyword => normalized.includes(keyword));
    if (!hasRemovalKeyword) {
        return null;
    }
    // Extract product name (everything after the keyword, except the keyword itself)
    let productName = normalized;
    for (const keyword of removalKeywords) {
        if (normalized.includes(keyword)) {
            // Remove the keyword and get what's left
            const idx = normalized.indexOf(keyword);
            productName = (normalized.substring(0, idx) + normalized.substring(idx + keyword.length))
                .trim()
                .replace(/^(da|dal|dal|di|per|un|una|l|lo|la)\s+/i, "") // Remove prepositions
                .trim();
            break;
        }
    }
    if (productName.length > 0) {
        logger_1.default.debug(`🎯 Pattern match: REMOVE_FROM_CART - "${message}" → product: "${productName}"`);
        return {
            type: "REMOVE_FROM_CART",
            productName: productName || undefined,
        };
    }
    return null;
}
/**
 * Extract number from message and resolve against list context.
 * Only supports pure digits, e.g. "1".
 */
function matchNumericSelection(message, context) {
    const normalized = message.trim();
    const pureNumberMatch = normalized.match(/^(\d+)$/);
    if (!pureNumberMatch) {
        return null;
    }
    const selectedNumber = parseInt(pureNumberMatch[1], 10);
    if (!context.lastListItems || context.lastListItems.length === 0) {
        logger_1.default.warn(`⚠️ Numeric selection "${selectedNumber}" but no list context available`);
        return {
            type: "SELECT_OPTION",
            number: selectedNumber,
            resolvedValue: `option_${selectedNumber}`,
            listType: (context.lastListType || "PRODUCTS"),
        };
    }
    const selectedItem = context.lastListItems.find((item) => item.number === selectedNumber);
    if (!selectedItem) {
        logger_1.default.warn(`⚠️ Selection ${selectedNumber} not found in list (items: ${context.lastListItems
            .map((i) => i.number)
            .join(", ")})`);
        return {
            type: "SELECT_OPTION",
            number: selectedNumber,
            resolvedValue: `invalid_option_${selectedNumber}`,
            listType: (context.lastListType || "PRODUCTS"),
        };
    }
    logger_1.default.debug(`🎯 Pattern match: NUMERIC_SELECTION - "${message}" → ${selectedNumber} = "${selectedItem.value}"`);
    const normalizedLastListType = context.lastListType === "PRODUCT_DETAIL_ACTIONS"
        ? "CATEGORIES"
        : (context.lastListType || "PRODUCTS");
    return {
        type: "SELECT_OPTION",
        number: selectedNumber,
        resolvedValue: selectedItem.value,
        listType: normalizedLastListType,
    };
}
/**
 * Run all pattern matchers in priority order.
 *
 * Priority:
 * 1. Numeric selection (list menu)
 * 2. Removal commands (rimuovi, cancella, togli)
 */
function matchAllPatterns(message, context) {
    // STEP 1: Numeric selection (e.g., "1", "2", "3")
    const numericMatch = matchNumericSelection(message, context);
    if (numericMatch) {
        return numericMatch;
    }
    // STEP 2: Removal/deletion commands (e.g., "rimuovi una mozzarella")
    const removalMatch = matchRemovalIntent(message, context);
    if (removalMatch) {
        return removalMatch;
    }
    return null;
}
//# sourceMappingURL=pattern-matcher.js.map