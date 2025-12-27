"use strict";
/**
 * OptionsMappingService
 *
 * Manages lastOptionsMapping for FAST-PATH numeric selection handling.
 *
 * CRITICAL FOR: "Codice decide, LLM formatta" principle
 * - Saves numbered list options from assistant responses
 * - Loads mapping for next user message
 * - Enables deterministic resolution: "5" → "Formaggi"
 *
 * Used by CodeFirstLLMService to:
 * 1. Load mapping before processing
 * 2. Save mapping after response
 *
 * @see docs/regole_di_prompts.md - FAST-PATH section
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptionsMappingService = void 0;
exports.getOptionsMappingService = getOptionsMappingService;
const logger_1 = __importDefault(require("../../utils/logger"));
class OptionsMappingService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    isExpired(expiresAt) {
        if (!expiresAt)
            return false;
        const expiryMs = Date.parse(expiresAt);
        return !Number.isNaN(expiryMs) && expiryMs <= Date.now();
    }
    /**
     * Load lastOptionsMapping from database for a conversation
     */
    loadMapping(workspaceId, conversationId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            try {
                logger_1.default.info("📋📥📥📥 [OptionsMapping] LOADING from DB", {
                    conversationId,
                    conversationIdLength: conversationId === null || conversationId === void 0 ? void 0 : conversationId.length,
                    workspaceId: workspaceId.substring(0, 8) + "...",
                });
                const searchConv = yield this.prisma.searchConversations.findUnique({
                    where: { sessionId: conversationId },
                });
                logger_1.default.info("📋📥📥📥 [OptionsMapping] DB result", {
                    conversationId,
                    found: !!searchConv,
                    searchConvId: (_a = searchConv === null || searchConv === void 0 ? void 0 : searchConv.id) === null || _a === void 0 ? void 0 : _a.substring(0, 8),
                    hasMetadata: !!(searchConv === null || searchConv === void 0 ? void 0 : searchConv.metadata),
                    metadataKeys: (searchConv === null || searchConv === void 0 ? void 0 : searchConv.metadata) ? Object.keys(searchConv.metadata) : [],
                });
                const metadata = (searchConv === null || searchConv === void 0 ? void 0 : searchConv.metadata) || {};
                const mapping = metadata.lastOptionsMapping || null;
                // TTL check: clear expired mappings
                if ((mapping === null || mapping === void 0 ? void 0 : mapping.expiresAt) && this.isExpired(mapping.expiresAt)) {
                    logger_1.default.info("⏰ [OptionsMapping] Mapping expired, clearing", {
                        conversationId,
                        expiresAt: mapping.expiresAt,
                    });
                    yield this.clearMapping(conversationId);
                    return null;
                }
                logger_1.default.info("📋 [OptionsMapping] Loaded mapping", {
                    conversationId,
                    hasMapping: !!mapping,
                    listType: mapping === null || mapping === void 0 ? void 0 : mapping.listType,
                    optionsCount: (_b = mapping === null || mapping === void 0 ? void 0 : mapping.options) === null || _b === void 0 ? void 0 : _b.length,
                    currentOrderCode: mapping === null || mapping === void 0 ? void 0 : mapping.currentOrderCode,
                    hasPendingAction: !!(mapping === null || mapping === void 0 ? void 0 : mapping.pendingAction),
                    pendingActionType: (_c = mapping === null || mapping === void 0 ? void 0 : mapping.pendingAction) === null || _c === void 0 ? void 0 : _c.type,
                    pendingActionProductId: (_d = mapping === null || mapping === void 0 ? void 0 : mapping.pendingAction) === null || _d === void 0 ? void 0 : _d.productId,
                    pendingActionItemType: (_e = mapping === null || mapping === void 0 ? void 0 : mapping.pendingAction) === null || _e === void 0 ? void 0 : _e.itemType,
                });
                return mapping;
            }
            catch (error) {
                logger_1.default.error("❌ [OptionsMapping] Failed to load mapping", {
                    conversationId,
                    error,
                });
                return null;
            }
        });
    }
    /**
     * UI-level retrieval: prefer lastPresentedMenu (menu dedicato), fallback to lastOptionsMapping
     */
    loadMenu(workspaceId, conversationId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const searchConv = yield this.prisma.searchConversations.findUnique({
                    where: { sessionId: conversationId },
                });
                const metadata = (searchConv === null || searchConv === void 0 ? void 0 : searchConv.metadata) || {};
                const menu = metadata.lastPresentedMenu || null;
                if (menu && menu.expiresAt && this.isExpired(menu.expiresAt)) {
                    logger_1.default.info("⏰ [OptionsMapping] Presented menu expired, clearing", {
                        conversationId,
                        expiresAt: menu.expiresAt,
                    });
                    yield this.clearMapping(conversationId);
                    return null;
                }
                if (menu) {
                    return {
                        type: "numbered",
                        options: menu.options,
                        listType: menu.type,
                        groupMapping: menu.groupMapping,
                        renderedText: menu.renderedText,
                        expiresAt: menu.expiresAt,
                    };
                }
                // fallback to lastOptionsMapping
                return yield this.loadMapping(workspaceId, conversationId);
            }
            catch (error) {
                logger_1.default.error("❌ [OptionsMapping] Failed to load menu", { conversationId, error });
                return null;
            }
        });
    }
    /**
     * Save lastOptionsMapping to database after assistant response
     */
    saveMapping(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const { workspaceId, conversationId, customerId, responseText, forceClear, groupMapping, items, listType: explicitListType, currentOrderCode, expiresInMs } = options;
            // 🔍 DEBUG: Log what we receive
            logger_1.default.info("📋 [OptionsMapping] saveMapping CALLED with params", {
                conversationId,
                hasItems: !!(items && items.length > 0),
                itemCount: (items === null || items === void 0 ? void 0 : items.length) || 0,
                explicitListType,
                responseTextPreview: responseText.substring(0, 50),
            });
            try {
                let mapping = null;
                // 🆕 CLEAN ARCHITECTURE: If we have items + explicitListType, use them directly
                // NO hardcoded regex detection needed - the ResponseBuilder knows the type!
                if (items && items.length > 0 && explicitListType) {
                    const optionsFromItems = items.map(item => ({
                        number: item.number,
                        label: item.name,
                        skus: item.sku ? [item.sku] : undefined,
                        id: item.id,
                        metadata: item.metadata,
                    }));
                    mapping = {
                        type: "numbered",
                        options: optionsFromItems,
                        listType: explicitListType,
                    };
                    logger_1.default.info("📋 [OptionsMapping] Using explicit items + listType (clean path)", {
                        conversationId,
                        itemCount: items.length,
                        listType: explicitListType,
                        firstItem: { number: items[0].number, name: (_a = items[0].name) === null || _a === void 0 ? void 0 : _a.substring(0, 20), sku: items[0].sku },
                    });
                }
                else {
                    // Fallback: try to extract from response text (legacy path)
                    mapping = forceClear ? null : this.extractFromResponse(responseText);
                    // If we have items without explicit type, add SKUs to extracted mapping
                    if (mapping && items && items.length > 0) {
                        mapping.options = mapping.options.map(opt => {
                            const itemMatch = items.find(i => i.number === opt.number);
                            if (itemMatch && itemMatch.sku) {
                                return Object.assign(Object.assign({}, opt), { skus: [itemMatch.sku], id: itemMatch.id, metadata: itemMatch.metadata });
                            }
                            if (itemMatch) {
                                return Object.assign(Object.assign({}, opt), { id: itemMatch.id, metadata: itemMatch.metadata });
                            }
                            return opt;
                        });
                    }
                    // Override listType if explicit one provided
                    if (mapping && explicitListType) {
                        logger_1.default.info("📋 [OptionsMapping] Overriding listType with explicit value", {
                            explicitListType,
                            previousListType: mapping.listType,
                            conversationId,
                        });
                        mapping.listType = explicitListType;
                    }
                }
                // 🆕 If we have a groupMapping from LLM, add it to the mapping
                // 🔧 FIX: Create/replace mapping options with groupMapping data (which has SKUs!)
                // The extractFromResponse only gets labels from text, NOT the SKUs
                if (groupMapping) {
                    // ALWAYS use groupMapping to create options (it has the SKUs!)
                    const optionsFromGroupMapping = Object.entries(groupMapping).map(([num, group]) => ({
                        number: parseInt(num),
                        label: group.nome,
                        skus: group.skus,
                    }));
                    if (!mapping) {
                        // Create a new mapping from scratch
                        mapping = {
                            type: "numbered",
                            options: optionsFromGroupMapping,
                            listType: "GROUPS",
                        };
                        logger_1.default.info("📋 [OptionsMapping] Created new mapping from groupMapping", {
                            conversationId,
                            groupCount: Object.keys(groupMapping).length,
                        });
                    }
                    else {
                        // Replace options with groupMapping options (they have SKUs!)
                        mapping.options = optionsFromGroupMapping;
                        logger_1.default.info("📋 [OptionsMapping] Replaced options with groupMapping (added SKUs)", {
                            conversationId,
                            optionCount: optionsFromGroupMapping.length,
                        });
                    }
                    mapping.groupMapping = groupMapping;
                    mapping.listType = "GROUPS"; // Mark as smart grouping
                    logger_1.default.info("📋 [OptionsMapping] Final mapping with groupMapping", {
                        conversationId,
                        groupCount: Object.keys(groupMapping).length,
                        totalSkus: Object.values(groupMapping).reduce((sum, g) => { var _a; return sum + (((_a = g.skus) === null || _a === void 0 ? void 0 : _a.length) || 0); }, 0),
                        firstOption: (_b = mapping.options) === null || _b === void 0 ? void 0 : _b[0],
                    });
                }
                // 🔧 FIX: Don't overwrite existing mapping with null
                // Only update if we have a new list OR if explicitly clearing
                if (!mapping && !forceClear) {
                    logger_1.default.debug("📋 [OptionsMapping] No new list found, keeping existing mapping", {
                        conversationId,
                        responseTextPreview: responseText.substring(0, 100),
                    });
                    return; // Don't overwrite existing mapping with null
                }
                logger_1.default.info("📋💾💾💾 [OptionsMapping] SAVING mapping to DB", {
                    conversationId,
                    conversationIdLength: conversationId === null || conversationId === void 0 ? void 0 : conversationId.length,
                    customerId,
                    workspaceId: workspaceId.substring(0, 8) + "...",
                    extracted: mapping
                        ? { type: mapping.type, listType: mapping.listType, count: (_c = mapping.options) === null || _c === void 0 ? void 0 : _c.length }
                        : null,
                    responseTextPreview: responseText.substring(0, 100),
                    isForceClear: forceClear,
                });
                const existing = yield this.prisma.searchConversations.findUnique({
                    where: { sessionId: conversationId },
                });
                const currentMetadata = (existing === null || existing === void 0 ? void 0 : existing.metadata) || {};
                const existingMapping = currentMetadata.lastOptionsMapping || {};
                const existingPendingAction = existingMapping.pendingAction;
                // 🔧 CRITICAL: Preserve currentOrderCode when updating mapping
                // This ensures ORDER_ACTIONS can still access the order code
                const updatedMapping = mapping ? Object.assign(Object.assign({}, mapping), { currentOrderCode: currentOrderCode !== null && currentOrderCode !== void 0 ? currentOrderCode : existingMapping.currentOrderCode, 
                    // 🔧 Preserve pendingAction (e.g., ADD_TO_CART) when saving new list
                    pendingAction: (_d = mapping.pendingAction) !== null && _d !== void 0 ? _d : existingPendingAction, renderedText: responseText, expiresAt: new Date(Date.now() + (expiresInMs !== null && expiresInMs !== void 0 ? expiresInMs : OptionsMappingService.DEFAULT_TTL_MS)).toISOString() }) : null;
                const presentedMenu = updatedMapping
                    ? {
                        type: updatedMapping.listType || "unknown",
                        options: updatedMapping.options,
                        groupMapping: updatedMapping.groupMapping,
                        renderedText: updatedMapping.renderedText,
                        expiresAt: updatedMapping.expiresAt,
                    }
                    : null;
                const updatedMetadata = Object.assign(Object.assign({}, currentMetadata), { lastOptionsMapping: updatedMapping, lastPresentedMenu: presentedMenu });
                yield this.prisma.searchConversations.upsert({
                    where: { sessionId: conversationId },
                    create: {
                        sessionId: conversationId,
                        workspaceId,
                        customerId,
                        metadata: updatedMetadata,
                        activeAgent: null,
                        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
                    },
                    update: {
                        metadata: updatedMetadata,
                    },
                });
                logger_1.default.debug("✅ [OptionsMapping] Mapping saved successfully");
            }
            catch (error) {
                logger_1.default.error("❌ [OptionsMapping] Failed to save mapping", {
                    conversationId,
                    error,
                });
                // Don't throw - mapping failure shouldn't break chat
            }
        });
    }
    /**
     * Set a pending action awaiting user confirmation (sì/no)
     * Called when showing product detail with "Vuoi aggiungerlo al carrello?"
     *
     * NOTE: This ADDS pendingAction to existing mapping, does NOT replace type/listType
     */
    setPendingAction(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { workspaceId, conversationId, pendingAction } = options;
            try {
                logger_1.default.info("🛒 [OptionsMapping] Setting pending action", {
                    conversationId,
                    actionType: pendingAction.type,
                    productId: pendingAction.productId,
                    productName: pendingAction.productName,
                });
                const existing = yield this.prisma.searchConversations.findUnique({
                    where: { sessionId: conversationId },
                });
                const currentMetadata = (existing === null || existing === void 0 ? void 0 : existing.metadata) || {};
                const currentMapping = currentMetadata.lastOptionsMapping || {};
                // 🔧 FIX: Only ADD pendingAction, keep existing type/listType/options
                const updatedMetadata = Object.assign(Object.assign({}, currentMetadata), { lastOptionsMapping: Object.assign(Object.assign({}, currentMapping), { pendingAction }) });
                yield this.prisma.searchConversations.upsert({
                    where: { sessionId: conversationId },
                    create: {
                        sessionId: conversationId,
                        workspaceId,
                        customerId: (existing === null || existing === void 0 ? void 0 : existing.customerId) || "unknown",
                        metadata: updatedMetadata,
                        activeAgent: null,
                        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                    },
                    update: {
                        metadata: updatedMetadata,
                    },
                });
                logger_1.default.debug("✅ [OptionsMapping] Pending action set successfully");
            }
            catch (error) {
                logger_1.default.error("❌ [OptionsMapping] Failed to set pending action", {
                    conversationId,
                    error,
                });
            }
        });
    }
    /**
     * Clear pending action after it's been processed
     */
    clearPendingAction(conversationId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const existing = yield this.prisma.searchConversations.findUnique({
                    where: { sessionId: conversationId },
                });
                if (!existing)
                    return;
                const currentMetadata = existing.metadata || {};
                const currentMapping = currentMetadata.lastOptionsMapping || {};
                // Remove pendingAction but keep the rest
                const { pendingAction } = currentMapping, restMapping = __rest(currentMapping, ["pendingAction"]);
                const updatedMetadata = Object.assign(Object.assign({}, currentMetadata), { lastOptionsMapping: Object.keys(restMapping).length > 0 ? restMapping : null });
                yield this.prisma.searchConversations.update({
                    where: { sessionId: conversationId },
                    data: { metadata: updatedMetadata },
                });
                logger_1.default.debug("✅ [OptionsMapping] Pending action cleared");
            }
            catch (error) {
                logger_1.default.error("❌ [OptionsMapping] Failed to clear pending action", {
                    conversationId,
                    error,
                });
            }
        });
    }
    /**
     * Clear entire mapping when user switches context (text input resets state)
     * Principle XV: User Context Freedom - TEXT input = fresh start
     */
    clearMapping(conversationId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const existing = yield this.prisma.searchConversations.findUnique({
                    where: { sessionId: conversationId },
                });
                if (!existing)
                    return;
                const currentMetadata = existing.metadata || {};
                // Clear lastOptionsMapping entirely
                const updatedMetadata = Object.assign(Object.assign({}, currentMetadata), { lastOptionsMapping: null });
                yield this.prisma.searchConversations.update({
                    where: { sessionId: conversationId },
                    data: { metadata: updatedMetadata },
                });
                logger_1.default.debug("✅ [OptionsMapping] Mapping cleared (context reset)");
            }
            catch (error) {
                logger_1.default.error("❌ [OptionsMapping] Failed to clear mapping", {
                    conversationId,
                    error,
                });
            }
        });
    }
    /**
     * Set current order code for order actions (fattura, ripeti, nota credito)
     * This is used to know which order the user is referring to when selecting an action
     */
    setCurrentOrderCode(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { workspaceId, conversationId, orderCode } = options;
            try {
                logger_1.default.debug("📦 [OptionsMapping] Setting current order code", {
                    conversationId,
                    orderCode,
                });
                const existing = yield this.prisma.searchConversations.findUnique({
                    where: { sessionId: conversationId },
                });
                const currentMetadata = (existing === null || existing === void 0 ? void 0 : existing.metadata) || {};
                const currentMapping = currentMetadata.lastOptionsMapping || {};
                const updatedMetadata = Object.assign(Object.assign({}, currentMetadata), { lastOptionsMapping: Object.assign(Object.assign({}, currentMapping), { currentOrderCode: orderCode }) });
                yield this.prisma.searchConversations.upsert({
                    where: { sessionId: conversationId },
                    create: {
                        sessionId: conversationId,
                        workspaceId,
                        customerId: (existing === null || existing === void 0 ? void 0 : existing.customerId) || "unknown",
                        metadata: updatedMetadata,
                        activeAgent: null,
                        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                    },
                    update: {
                        metadata: updatedMetadata,
                    },
                });
                logger_1.default.debug("✅ [OptionsMapping] Current order code set successfully", { orderCode });
            }
            catch (error) {
                logger_1.default.error("❌ [OptionsMapping] Failed to set current order code", {
                    conversationId,
                    error,
                });
            }
        });
    }
    /**
     * Extract numbered list or yes/no pattern from assistant response
     *
     * Detects patterns like:
     * 1. Bevande (4 prodotti)
     * 2. Condimenti (6 prodotti)
     * ...
     *
     * Also extracts SKU codes from patterns like:
     * 1. Condimenti Freschi (3 prodotti) [SKUS:COND-003,COND-004,COND-005]
     *
     * Or binary yes/no prompts
     */
    extractFromResponse(responseText) {
        if (!responseText)
            return null;
        const lines = responseText.split(/\r?\n/);
        const options = [];
        for (const line of lines) {
            // Match: "1. Label" or "1) Label"
            const match = line.match(/^\s*(\d+)[\.|\)]\s*(.+)$/);
            if (match) {
                const number = parseInt(match[1], 10);
                let label = match[2].trim();
                if (!Number.isNaN(number) && label) {
                    // Extract SKUs if present: "[SKUS:COND-003,COND-004,COND-005]"
                    let skus;
                    const skusMatch = label.match(/\[SKUS?:([A-Z0-9-,]+)\]/i);
                    if (skusMatch) {
                        skus = skusMatch[1].split(',').map(s => s.trim());
                        // Remove SKU tag from label for cleaner display
                        label = label.replace(/\s*\[SKUS?:[A-Z0-9-,]+\]/gi, '').trim();
                        logger_1.default.debug("📋 [OptionsMapping] Extracted SKUs from label", {
                            number,
                            skus,
                            cleanLabel: label.substring(0, 30),
                        });
                    }
                    // Extract count if present: "(7 prodotti)" or "(4 items)"
                    const countMatch = label.match(/\((\d+)\s*(prodotti|items|servizi)\)/i);
                    const count = countMatch ? parseInt(countMatch[1], 10) : undefined;
                    options.push({ number, label, count, skus });
                }
            }
        }
        // Need at least 2 options to be a list
        if (options.length >= 2) {
            // 🆕 CLEAN ARCHITECTURE: Don't try to detect listType from text!
            // The ResponseBuilder should always pass explicitListType.
            // If we reach this fallback, use "unknown" and log a warning.
            logger_1.default.warn("📋 [OptionsMapping] extractFromResponse fallback - no explicitListType provided", {
                optionsCount: options.length,
                firstThree: options.slice(0, 3).map((o) => ({
                    label: o.label.substring(0, 30),
                    skus: o.skus
                })),
            });
            return {
                type: "numbered",
                options: options.slice(0, 30), // Limit to 30 options
                listType: "unknown", // 🆕 Don't guess - let the caller provide explicitListType
            };
        }
        // 🆕 REMOVED: Binary yes/no detection with hardcoded Italian words
        // The FSM and pendingAction system handles confirmations properly
        // If we need binary detection, it should be language-agnostic
        return null;
    }
    /**
     * @deprecated This method uses hardcoded language patterns
     * Use explicitListType from ResponseBuilder instead
     */
    detectListType(responseText, options) {
        // 🆕 CLEAN ARCHITECTURE: This method should NOT be called!
        // All list types should come from ResponseBuilder via explicitListType
        logger_1.default.warn("📋 [OptionsMapping] detectListType called - should use explicitListType instead");
        return "unknown";
    }
    /**
     * Clean a label by removing:
     * - Count suffix: "(7 prodotti)"
     * - Price suffix: "- €12.50"
     * - SKU codes: "(FROZ-CAR-001)"
     * - Category tags: "[Surgelati]"
     * - Emojis
     *
     * Examples:
     * "Formaggi (7 prodotti)" → "Formaggi"
     * "Condimenti (6 prodotti) 🥫" → "Condimenti"
     * "Mozzarella (FORM-001) - €12.50 [Formaggi]" → "Mozzarella"
     * "Carciofi alla Romana Surgelati (FROZ-CAR-001) - €8.50 [Surgelati]" → "Carciofi alla Romana Surgelati"
     */
    static cleanLabel(label) {
        return label
            .replace(/^#/, "") // Strip # prefix from order codes (e.g., #ORD-048-2025-9 → ORD-048-2025-9)
            .replace(/\s*\(\d+\s*(prodotti|items|servizi)?\)\s*/gi, " ") // (7 prodotti)
            .replace(/\s*-\s*€[\d.,]+.*$/i, "") // - €12.50 [...]
            .replace(/\s*\([A-Z0-9-]+\)\s*$/i, "") // (FROZ-CAR-001) at end
            .replace(/\s*\([A-Z]{2,}-[A-Z0-9-]+\)/gi, "") // (SKU-CODE) anywhere
            .replace(/\s*\[[^\]]+\]\s*$/i, "") // [Surgelati] category
            .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, "") // Remove emojis
            .trim();
    }
}
exports.OptionsMappingService = OptionsMappingService;
OptionsMappingService.DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
// ================================================================================
// SINGLETON
// ================================================================================
let instance = null;
function getOptionsMappingService(prisma) {
    if (!instance) {
        instance = new OptionsMappingService(prisma);
    }
    return instance;
}
//# sourceMappingURL=options-mapping.service.js.map