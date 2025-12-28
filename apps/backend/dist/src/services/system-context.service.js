"use strict";
/**
 * SystemContextService
 *
 * Manages the hidden System message context that LLM sees but customer doesn't.
 *
 * PURPOSE:
 * - Store SKU mappings for list selections (1, 2, 3...)
 * - Store groupings created by LLM
 * - Store cart summary for dialogue context
 * - Store active offers and customer discount
 *
 * PATTERN:
 * - Customer sees: "1. Stagionati (4) 2. Freschi (3)"
 * - System has: { grouping: [{index:1, skus:[...]}, {index:2, skus:[...]}] }
 * - When user says "2", LLM knows exactly which SKUs to show
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
exports.SystemContextService = void 0;
exports.getSystemContextService = getSystemContextService;
const logger_1 = __importDefault(require("../utils/logger"));
// ================================================================================
// IN-MEMORY CACHE (per conversation)
// ================================================================================
// Cache key: `${workspaceId}:${customerId}`
const contextCache = new Map();
// Cache TTL: 30 minutes (conversation timeout)
const CACHE_TTL = 30 * 60 * 1000;
// Track last access for cleanup
const lastAccess = new Map();
// ================================================================================
// SERVICE
// ================================================================================
class SystemContextService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Get cache key for workspace + customer
     */
    getCacheKey(workspaceId, customerId) {
        return `${workspaceId}:${customerId}`;
    }
    /**
     * Get current system context for a conversation
     */
    getContext(workspaceId, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = this.getCacheKey(workspaceId, customerId);
            lastAccess.set(key, Date.now());
            // Return cached if exists
            if (contextCache.has(key)) {
                return contextCache.get(key);
            }
            // Initialize new context
            const context = {};
            // Load cart summary from DB
            context.cartSummary = yield this.loadCartSummary(workspaceId, customerId);
            // Load customer discount
            context.customerDiscount = yield this.loadCustomerDiscount(workspaceId, customerId);
            // Load active offers
            context.activeOffers = yield this.loadActiveOffers(workspaceId);
            contextCache.set(key, context);
            return context;
        });
    }
    /**
     * Update context with new list (for selection tracking)
     */
    setCurrentList(workspaceId, customerId, list) {
        return __awaiter(this, void 0, void 0, function* () {
            const context = yield this.getContext(workspaceId, customerId);
            context.currentList = list;
            const key = this.getCacheKey(workspaceId, customerId);
            contextCache.set(key, context);
            logger_1.default.info("📋 [SystemContext] List updated", {
                workspaceId,
                customerId,
                listType: list === null || list === void 0 ? void 0 : list.type,
                itemCount: list === null || list === void 0 ? void 0 : list.items.length,
            });
        });
    }
    /**
     * Set pending action (for confirmations like "Vuoi aggiungerlo?")
     */
    setPendingAction(workspaceId, customerId, action) {
        return __awaiter(this, void 0, void 0, function* () {
            const context = yield this.getContext(workspaceId, customerId);
            context.pendingAction = action;
            const key = this.getCacheKey(workspaceId, customerId);
            contextCache.set(key, context);
            logger_1.default.info("⏳ [SystemContext] Pending action set", {
                workspaceId,
                customerId,
                actionType: action === null || action === void 0 ? void 0 : action.type,
                sku: action === null || action === void 0 ? void 0 : action.sku,
            });
        });
    }
    /**
     * Clear pending action after it's processed
     */
    clearPendingAction(workspaceId, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const context = yield this.getContext(workspaceId, customerId);
            context.pendingAction = undefined;
            const key = this.getCacheKey(workspaceId, customerId);
            contextCache.set(key, context);
        });
    }
    /**
     * Refresh cart summary from DB
     */
    refreshCartSummary(workspaceId, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const context = yield this.getContext(workspaceId, customerId);
            context.cartSummary = yield this.loadCartSummary(workspaceId, customerId);
            const key = this.getCacheKey(workspaceId, customerId);
            contextCache.set(key, context);
        });
    }
    /**
     * Format context as JSON string for System message
     */
    formatForSystemMessage(workspaceId, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const context = yield this.getContext(workspaceId, customerId);
            // Only include non-empty fields
            const systemData = {};
            if ((_a = context.currentList) === null || _a === void 0 ? void 0 : _a.items.length) {
                systemData.currentList = context.currentList;
            }
            if (context.cartSummary && context.cartSummary.itemCount > 0) {
                systemData.cart = context.cartSummary;
            }
            if (context.customerDiscount && context.customerDiscount > 0) {
                systemData.customerDiscount = `${context.customerDiscount}%`;
            }
            if ((_b = context.activeOffers) === null || _b === void 0 ? void 0 : _b.length) {
                systemData.activeOffers = context.activeOffers;
            }
            if (context.pendingAction) {
                systemData.pendingAction = context.pendingAction;
            }
            if (Object.keys(systemData).length === 0) {
                return "";
            }
            return `
---
CONTEXT (use this to understand user selections and cart state):
${JSON.stringify(systemData, null, 2)}
---`;
        });
    }
    /**
     * Resolve selection number to SKU(s)
     * Returns null if selection not found
     */
    resolveSelection(workspaceId, customerId, selectionIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const context = yield this.getContext(workspaceId, customerId);
            if (!((_a = context.currentList) === null || _a === void 0 ? void 0 : _a.items.length)) {
                return null;
            }
            const item = context.currentList.items.find(i => i.index === selectionIndex);
            if (!item) {
                return null;
            }
            return {
                type: item.type,
                sku: item.sku,
                skus: item.skus,
                label: item.label,
            };
        });
    }
    // ================================================================================
    // PRIVATE: DB LOADERS
    // ================================================================================
    loadCartSummary(workspaceId, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cartItems = yield this.prisma.cartItems.findMany({
                    where: {
                        cart: {
                            customerId,
                            workspaceId,
                        },
                    },
                    include: {
                        product: {
                            select: {
                                sku: true,
                                price: true,
                            },
                        },
                    },
                });
                if (cartItems.length === 0) {
                    return {
                        itemCount: 0,
                        totalQuantity: 0,
                        skus: [],
                        totalValue: "€0.00",
                    };
                }
                const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
                const totalValue = cartItems.reduce((sum, item) => {
                    var _a;
                    const price = ((_a = item.product) === null || _a === void 0 ? void 0 : _a.price) || 0;
                    return sum + (Number(price) * item.quantity);
                }, 0);
                return {
                    itemCount: cartItems.length,
                    totalQuantity,
                    skus: cartItems.map(item => { var _a; return (_a = item.product) === null || _a === void 0 ? void 0 : _a.sku; }).filter(Boolean),
                    totalValue: `€${totalValue.toFixed(2)}`,
                };
            }
            catch (error) {
                logger_1.default.error("❌ [SystemContext] Failed to load cart summary", { error });
                return {
                    itemCount: 0,
                    totalQuantity: 0,
                    skus: [],
                    totalValue: "€0.00",
                };
            }
        });
    }
    loadCustomerDiscount(workspaceId, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const customer = yield this.prisma.customers.findFirst({
                    where: { id: customerId, workspaceId },
                    select: { discount: true },
                });
                return (customer === null || customer === void 0 ? void 0 : customer.discount) || 0;
            }
            catch (error) {
                logger_1.default.error("❌ [SystemContext] Failed to load customer discount", { error });
                return 0;
            }
        });
    }
    loadActiveOffers(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const now = new Date();
                const offers = yield this.prisma.offers.findMany({
                    where: {
                        workspaceId,
                        isActive: true,
                        OR: [
                            { startDate: null },
                            { startDate: { lte: now } },
                        ],
                        AND: [
                            {
                                OR: [
                                    { endDate: null },
                                    { endDate: { gte: now } },
                                ],
                            },
                        ],
                    },
                    select: {
                        name: true,
                        discountPercent: true,
                    },
                    take: 5, // Limit to avoid token overload
                });
                return offers.map(o => ({
                    name: o.name,
                    discount: o.discountPercent || 0,
                }));
            }
            catch (error) {
                logger_1.default.error("❌ [SystemContext] Failed to load offers", { error });
                return [];
            }
        });
    }
    // ================================================================================
    // CLEANUP
    // ================================================================================
    /**
     * Clean up expired contexts (call periodically)
     */
    static cleanup() {
        const now = Date.now();
        for (const [key, time] of lastAccess.entries()) {
            if (now - time > CACHE_TTL) {
                contextCache.delete(key);
                lastAccess.delete(key);
            }
        }
    }
}
exports.SystemContextService = SystemContextService;
// Cleanup every 5 minutes
setInterval(() => SystemContextService.cleanup(), 5 * 60 * 1000);
// ================================================================================
// SINGLETON
// ================================================================================
let instance = null;
function getSystemContextService(prisma) {
    if (!instance) {
        instance = new SystemContextService(prisma);
    }
    return instance;
}
//# sourceMappingURL=system-context.service.js.map