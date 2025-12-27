"use strict";
/**
 * History Parser - Extract list context from conversation history
 *
 * Parses the last assistant message to understand what kind of list
 * was shown and what items it contained. This enables numeric selection
 * resolution without LLM.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseListFromMessage = parseListFromMessage;
exports.buildContextFromHistory = buildContextFromHistory;
exports.extractActiveCategory = extractActiveCategory;
const logger_1 = __importDefault(require("../../../utils/logger"));
// =============================================================================
// LIST DETECTION PATTERNS
// =============================================================================
/**
 * Pattern to detect category lists: "1. CategoryName (N prodotti)"
 */
const CATEGORY_LIST_PATTERN = /^(\d+)\.\s*\*?\*?([^(]+?)\*?\*?\s*\((\d+)\s*(?:prodott[io]|items?|productos?|produtos?)\)/gim;
/**
 * Pattern to detect product lists with prices: "1. ProductName - €XX.XX"
 */
const PRODUCT_LIST_PATTERN = /^(\d+)\.\s*\*?\*?([^-€]+?)\*?\*?\s*[-–]\s*€([\d.,]+)/gim;
/**
 * Pattern to detect group lists: "1. GroupName (N)" or "1. GroupName (N items)"
 */
const GROUP_LIST_PATTERN = /^(\d+)\.\s*\*?\*?([^(]+?)\*?\*?\s*\((\d+)(?:\s*(?:items?|prodott[io]|productos?|produtos?))?\)/gim;
/**
 * Pattern to detect order lists: "1. #CODE - DATE" or "1️⃣ #CODE"
 */
const ORDER_LIST_PATTERN = /^(?:\d+\.?|[1-9]️⃣)\s*#([A-Z0-9-]+)\s*[-–]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})?/gim;
/**
 * Pattern to detect cart items: "1. ProductName × N" or "1. ProductName - €XX × N"
 */
const CART_LIST_PATTERN = /^(\d+)\.\s*\*?\*?([^×\-]+?)\*?\*?\s*(?:[-–]\s*€[\d.,]+\s*)?[×x]\s*(\d+)/gim;
// =============================================================================
// LIST PARSING FUNCTIONS
// =============================================================================
/**
 * Parse category list from message
 */
function parseCategoryList(message) {
    const items = [];
    const regex = new RegExp(CATEGORY_LIST_PATTERN.source, "gim");
    let match;
    while ((match = regex.exec(message)) !== null) {
        items.push({
            number: parseInt(match[1], 10),
            value: match[2].trim(),
            metadata: {
                count: parseInt(match[3], 10)
            }
        });
    }
    return items.length > 0 ? items : null;
}
/**
 * Parse product list from message
 */
function parseProductList(message) {
    const items = [];
    const regex = new RegExp(PRODUCT_LIST_PATTERN.source, "gim");
    let match;
    while ((match = regex.exec(message)) !== null) {
        items.push({
            number: parseInt(match[1], 10),
            value: match[2].trim(),
            metadata: {
                price: parseFloat(match[3].replace(",", "."))
            }
        });
    }
    return items.length > 0 ? items : null;
}
/**
 * Parse group list from message
 * Groups have format: "1. Name (N items/prodotti/productos/itens)" - with count in parentheses
 * Categories have format: "1. Name" - no count
 */
function parseGroupList(message) {
    const items = [];
    const regex = new RegExp(GROUP_LIST_PATTERN.source, "gim");
    let match;
    while ((match = regex.exec(message)) !== null) {
        // Group lists MUST have a count in parentheses - that's the distinguishing feature
        // The regex already captures this, so if we have match[3] (the count), it's a group
        const count = parseInt(match[3], 10);
        if (isNaN(count) || count <= 0) {
            // No valid count = not a group list
            continue;
        }
        items.push({
            number: parseInt(match[1], 10),
            value: match[2].trim(),
            metadata: {
                count: count
            }
        });
    }
    return items.length > 0 ? items : null;
}
/**
 * Parse order list from message
 */
function parseOrderList(message) {
    const items = [];
    const regex = new RegExp(ORDER_LIST_PATTERN.source, "gim");
    let match;
    let number = 1;
    while ((match = regex.exec(message)) !== null) {
        items.push({
            number: number++,
            value: match[1], // Order code without #
            metadata: {
                code: `#${match[1]}`
            }
        });
    }
    return items.length > 0 ? items : null;
}
/**
 * Parse cart list from message
 */
function parseCartList(message) {
    const items = [];
    const regex = new RegExp(CART_LIST_PATTERN.source, "gim");
    let match;
    while ((match = regex.exec(message)) !== null) {
        items.push({
            number: parseInt(match[1], 10),
            value: match[2].trim(),
            metadata: {
                count: parseInt(match[3], 10) // quantity
            }
        });
    }
    return items.length > 0 ? items : null;
}
// =============================================================================
// MAIN PARSER
// =============================================================================
/**
 * Detect what type of list is in the message and extract items
 */
function parseListFromMessage(message) {
    if (!message)
        return null;
    // Order of detection matters - more specific patterns first
    // 1. Cart items (has × quantity)
    const cartItems = parseCartList(message);
    if (cartItems && cartItems.length > 0) {
        logger_1.default.debug(`📋 Detected CART list with ${cartItems.length} items`);
        return { listType: "CART_ITEMS", items: cartItems };
    }
    // 2. Order list (has # codes)
    const orderItems = parseOrderList(message);
    if (orderItems && orderItems.length > 0) {
        logger_1.default.debug(`📋 Detected ORDER list with ${orderItems.length} items`);
        return { listType: "ORDERS", items: orderItems };
    }
    // 3. Category list (has "N prodotti")
    const categoryItems = parseCategoryList(message);
    if (categoryItems && categoryItems.length > 0) {
        logger_1.default.debug(`📋 Detected CATEGORY list with ${categoryItems.length} items`);
        return { listType: "CATEGORIES", items: categoryItems };
    }
    // 4. Product list (has € prices)
    const productItems = parseProductList(message);
    if (productItems && productItems.length > 0) {
        logger_1.default.debug(`📋 Detected PRODUCT list with ${productItems.length} items`);
        return { listType: "PRODUCTS", items: productItems };
    }
    // 5. Group list (has just count in parentheses)
    const groupItems = parseGroupList(message);
    if (groupItems && groupItems.length > 0) {
        logger_1.default.debug(`📋 Detected GROUP list with ${groupItems.length} items`);
        return { listType: "GROUPS", items: groupItems };
    }
    return null;
}
/**
 * Build conversation context from history
 */
function buildContextFromHistory(lastAssistantMessage, previousContext) {
    var _a, _b;
    const context = Object.assign({ lastAssistantMessage }, previousContext);
    if (lastAssistantMessage) {
        const listInfo = parseListFromMessage(lastAssistantMessage);
        if (listInfo) {
            const normalizedListType = listInfo.listType === "PRODUCT_DETAIL_ACTIONS" ? "CATEGORIES" : listInfo.listType;
            context.lastListType = normalizedListType;
            context.lastListItems = listInfo.items;
            logger_1.default.info(`📋 Context updated from history:`, {
                listType: listInfo.listType,
                itemCount: listInfo.items.length,
                firstItem: (_a = listInfo.items[0]) === null || _a === void 0 ? void 0 : _a.value,
                lastItem: (_b = listInfo.items[listInfo.items.length - 1]) === null || _b === void 0 ? void 0 : _b.value
            });
        }
    }
    return context;
}
/**
 * Extract active category from context
 * Looks for patterns like "nella categoria X" or "category X"
 * Supports: IT, ES, PT, EN, DE, FR
 */
function extractActiveCategory(message) {
    // Multilingual patterns: categoria (IT/PT), categoría (ES), category (EN), Kategorie (DE), catégorie (FR)
    const multiMatch = message.match(/(?:categoria|categor[ií]a|category|kategorie|catégorie)\s+['"]?([^'",:.\n]+)['"]?/i);
    if (multiMatch)
        return multiMatch[1].trim();
    // Header patterns like "**Formaggi** (7 prodotti)" - language agnostic (uses markdown format)
    const headerMatch = message.match(/^\*\*([^*]+)\*\*\s*\(/m);
    if (headerMatch)
        return headerMatch[1].trim();
    return null;
}
//# sourceMappingURL=history-parser.js.map