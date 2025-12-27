"use strict";
/**
 * OrderOptimizationService
 *
 * Service for calculating transport costs and optimization suggestions for cart items.
 * Used by the "Ottimizzazione dell'ordine" feature (menu option 5).
 *
 * Key responsibilities:
 * 1. Calculate transport costs based on cart items
 * 2. Group items by transport type
 * 3. Calculate "spalmatura" (cost allocation per item)
 * 4. Check if transport prices are configured
 *
 * @architecture Clean Architecture - Application Service
 * @feature optimize-transport (specs/optimize-transport/)
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
exports.OrderOptimizationService = void 0;
const transport_type_repository_1 = require("../../repositories/transport-type.repository");
const cart_repository_1 = require("../../repositories/cart.repository");
const logger_1 = __importDefault(require("../../utils/logger"));
// ============================================================================
// SERVICE
// ============================================================================
class OrderOptimizationService {
    constructor(prisma) {
        this.prisma = prisma;
        this.transportTypeRepo = new transport_type_repository_1.TransportTypeRepository(prisma);
        this.cartRepo = new cart_repository_1.CartRepository();
    }
    /**
     * Check if workspace has transport prices configured
     * @param workspaceId Workspace ID
     * @returns true if at least one transport type has price > 0
     */
    hasTransportPricesConfigured(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.transportTypeRepo.hasConfiguredPrices(workspaceId);
        });
    }
    /**
     * Analyze cart transport costs and generate breakdown
     * All prices are GROSS (IVA 22% included) and ROUNDED to integers
     *
     * @param workspaceId Workspace ID
     * @param customerId Customer ID
     * @returns Complete transport analysis
     */
    analyzeCart(workspaceId, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const timestamp = new Date();
            logger_1.default.info("🚚 OrderOptimizationService.analyzeCart", {
                workspaceId,
                customerId,
            });
            // 1. Check if transport prices are configured
            const isConfigured = yield this.hasTransportPricesConfigured(workspaceId);
            if (!isConfigured) {
                logger_1.default.warn("⚠️ Transport prices not configured", { workspaceId });
                return this.createEmptyAnalysis(workspaceId, "", timestamp, false);
            }
            // 2. Get cart with items
            const cart = yield this.cartRepo.getOrCreateCart(workspaceId, customerId);
            if (!cart.items || cart.items.length === 0) {
                return this.createEmptyAnalysis(workspaceId, cart.id, timestamp, true);
            }
            // 3. Get transport types with prices
            const transportTypes = yield this.transportTypeRepo.findActiveWithPrices(workspaceId);
            const transportMap = new Map(transportTypes.map(t => [t.id, t]));
            // 4. Get product transport types (many-to-many relation)
            const productIds = cart.items
                .filter(item => item.productId)
                .map(item => item.productId);
            const productTransportTypes = yield this.prisma.productTransportType.findMany({
                where: { productId: { in: productIds } },
                include: { transportType: true },
            });
            // Map: productId -> transportType
            const productToTransport = new Map();
            for (const ptt of productTransportTypes) {
                // If product has multiple transports, use the first one (primary)
                if (!productToTransport.has(ptt.productId)) {
                    productToTransport.set(ptt.productId, {
                        id: ptt.transportType.id,
                        name: ptt.transportType.name,
                        price: Number(ptt.transportType.price),
                    });
                }
            }
            // 5. Group cart items by transport type
            const transportGroups = new Map();
            let totalUnits = 0;
            let totalProductsCost = 0;
            for (const item of cart.items) {
                if (!item.product)
                    continue;
                const quantity = item.quantity || 1;
                const unitPrice = item.product.price || 0;
                const lineTotal = unitPrice * quantity;
                totalUnits += quantity;
                totalProductsCost += lineTotal;
                // Get transport for this product
                const transport = productToTransport.get(item.productId);
                if (!transport) {
                    // Fallback: use "Ambient Temperature" or first available
                    const defaultTransport = transportTypes[0];
                    if (defaultTransport) {
                        productToTransport.set(item.productId, {
                            id: defaultTransport.id,
                            name: defaultTransport.name,
                            price: defaultTransport.price,
                        });
                    }
                }
                const productTransport = productToTransport.get(item.productId) || {
                    id: "unknown",
                    name: "Unknown",
                    price: 0,
                };
                // Add to transport group
                if (!transportGroups.has(productTransport.id)) {
                    transportGroups.set(productTransport.id, {
                        transportTypeId: productTransport.id,
                        transportTypeName: productTransport.name,
                        transportPrice: productTransport.price,
                        productCount: 0,
                        totalQuantity: 0,
                        products: [],
                        subtotal: 0,
                    });
                }
                const group = transportGroups.get(productTransport.id);
                group.productCount++;
                group.totalQuantity += quantity;
                group.subtotal += lineTotal;
                group.products.push({
                    productId: item.productId,
                    productName: item.product.name,
                    quantity,
                    unitPrice,
                    lineTotal,
                    transportTypeName: productTransport.name,
                });
            }
            // 6. Calculate transport costs (select the strictest requirement)
            const transports = Array.from(transportGroups.values());
            const selectedTransport = transports.reduce((prev, current) => {
                if (!prev)
                    return current;
                return current.transportPrice > prev.transportPrice ? current : prev;
            }, null);
            const selectedTransportCost = (_a = selectedTransport === null || selectedTransport === void 0 ? void 0 : selectedTransport.transportPrice) !== null && _a !== void 0 ? _a : 0;
            const totalTransportCost = Math.round(selectedTransportCost * 100) / 100;
            // 7. Calculate totals (keep two decimals)
            const roundedProductsCost = Math.round(totalProductsCost * 100) / 100;
            const grandTotal = Math.round((roundedProductsCost + totalTransportCost) * 100) / 100;
            // IVA 22% (already included in prices)
            const ivaRate = 0.22;
            const netTotal = Math.round((grandTotal / (1 + ivaRate)) * 100) / 100;
            const ivaAmount = Math.round((grandTotal - netTotal) * 100) / 100;
            // Shipping cost per unit (rounded to whole euros)
            const shippingCostPerUnit = totalUnits > 0
                ? Math.round(totalTransportCost / totalUnits)
                : 0;
            // 8. Calculate allocation per item ("spalmatura")
            const allocationByItem = [];
            let allocatedShippingCents = 0;
            const totalTransportCostCents = Math.round(totalTransportCost * 100);
            const productItems = cart.items.filter((item) => !!item.product);
            const productItemsCount = productItems.length;
            let processedProducts = 0;
            for (const item of cart.items) {
                if (!item.product)
                    continue;
                processedProducts++;
                const quantity = item.quantity || 1;
                const productTotal = Math.round((item.product.price || 0) * quantity);
                // Allocate shipping proportionally to quantity (work in cents)
                let shippingAllocatedCents = totalUnits > 0
                    ? Math.round((totalTransportCostCents * quantity) / totalUnits)
                    : 0;
                // Handle rounding difference on last product item
                if (processedProducts === productItemsCount) {
                    shippingAllocatedCents = totalTransportCostCents - allocatedShippingCents;
                }
                allocatedShippingCents += shippingAllocatedCents;
                const shippingAllocated = shippingAllocatedCents / 100;
                allocationByItem.push({
                    productId: item.productId,
                    productName: item.product.name,
                    quantity,
                    productTotal,
                    shippingAllocated,
                    lineGrandTotal: productTotal + shippingAllocated,
                });
            }
            return {
                workspaceId,
                cartId: cart.id,
                timestamp,
                transports,
                totalUnits,
                totalProductsCost: roundedProductsCost,
                totalTransportCost,
                grandTotal,
                shippingCostPerUnit,
                ivaAmount,
                netTotal,
                allocationByItem,
                isConfigured: true,
                isEmpty: false,
                selectedTransportTypeId: (_b = selectedTransport === null || selectedTransport === void 0 ? void 0 : selectedTransport.transportTypeId) !== null && _b !== void 0 ? _b : null,
                selectedTransportTypeName: (_c = selectedTransport === null || selectedTransport === void 0 ? void 0 : selectedTransport.transportTypeName) !== null && _c !== void 0 ? _c : null,
            };
        });
    }
    /**
     * Create empty analysis result
     */
    createEmptyAnalysis(workspaceId, cartId, timestamp, isConfigured) {
        return {
            workspaceId,
            cartId,
            timestamp,
            transports: [],
            totalUnits: 0,
            totalProductsCost: 0,
            totalTransportCost: 0,
            grandTotal: 0,
            shippingCostPerUnit: 0,
            ivaAmount: 0,
            netTotal: 0,
            allocationByItem: [],
            isConfigured,
            isEmpty: true,
            selectedTransportTypeId: null,
            selectedTransportTypeName: null,
        };
    }
    /**
     * Format transport analysis for display in WhatsApp
     * Returns Italian text (will be translated by Translation Agent)
     */
    formatAnalysisForDisplay(analysis) {
        if (!analysis.isConfigured) {
            return "Al momento non posso calcolare i costi di spedizione perché i prezzi dei trasporti non sono configurati. Puoi comunque continuare con il tuo ordine.";
        }
        if (analysis.isEmpty) {
            return "Il tuo carrello è vuoto. Aggiungi qualche prodotto per vedere l'analisi dei costi di spedizione.";
        }
        const lines = [];
        // Header
        lines.push("📦 **Riepilogo Trasporti**");
        lines.push("");
        // Transport breakdown
        for (const transport of analysis.transports) {
            const emoji = this.getTransportEmoji(transport.transportTypeName);
            lines.push(`${emoji} **${transport.transportTypeName}**: €${transport.transportPrice.toFixed(2)} (${transport.totalQuantity} prodotti)`);
        }
        if (analysis.selectedTransportTypeName) {
            lines.push("");
            lines.push(`✅ **Spedizione applicata:** ${analysis.selectedTransportTypeName}`);
        }
        lines.push("");
        lines.push("---");
        lines.push("");
        // Totals
        lines.push(`📋 **Subtotale prodotti**: €${analysis.totalProductsCost.toFixed(2)}`);
        lines.push(`🚚 **Totale spedizione**: €${analysis.totalTransportCost.toFixed(2)}`);
        lines.push(`💰 **Totale ordine**: €${analysis.grandTotal.toFixed(2)}`);
        lines.push(`💶 **IVA 22%**: €${analysis.ivaAmount.toFixed(2)}`);
        lines.push(`📑 **Totale IVA esclusa**: €${analysis.netTotal.toFixed(2)}`);
        // Cost per unit insight
        if (analysis.shippingCostPerUnit > 0) {
            lines.push("");
            lines.push(`💡 _Costo spedizione medio per prodotto: €${analysis.shippingCostPerUnit.toFixed(2)}_`);
        }
        return lines.join("\n");
    }
    /**
     * Get available products for optimization suggestions
     * Returns products grouped by transport type, excluding those already in cart
     *
     * @param workspaceId Workspace ID
     * @param excludeProductIds Product IDs already in cart
     * @param limit Max products per transport type
     */
    getAvailableProductsForOptimization(workspaceId_1, excludeProductIds_1) {
        return __awaiter(this, arguments, void 0, function* (workspaceId, excludeProductIds, limit = 5) {
            // Get transport types
            const transportTypes = yield this.transportTypeRepo.findActiveWithPrices(workspaceId);
            const result = [];
            for (const transport of transportTypes) {
                // Get products for this transport type
                const productTransports = yield this.prisma.productTransportType.findMany({
                    where: {
                        transportTypeId: transport.id,
                        product: {
                            workspaceId,
                            isActive: true,
                            id: { notIn: excludeProductIds },
                        },
                    },
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                price: true,
                                productCategories: {
                                    include: {
                                        category: {
                                            select: { name: true },
                                        },
                                    },
                                    take: 1,
                                },
                            },
                        },
                    },
                    take: limit,
                });
                if (productTransports.length > 0) {
                    result.push({
                        transportTypeName: transport.name,
                        transportTypeId: transport.id,
                        products: productTransports.map(pt => {
                            var _a, _b;
                            return ({
                                id: pt.product.id,
                                name: pt.product.name,
                                price: pt.product.price,
                                category: ((_b = (_a = pt.product.productCategories[0]) === null || _a === void 0 ? void 0 : _a.category) === null || _b === void 0 ? void 0 : _b.name) || "Altro",
                            });
                        }),
                    });
                }
            }
            return result;
        });
    }
    /**
     * Get emoji for transport type
     */
    getTransportEmoji(transportName) {
        const name = transportName.toLowerCase();
        if (name.includes("frozen") || name.includes("congel") || name.includes("surgel")) {
            return "🧊";
        }
        if (name.includes("refriger") || name.includes("frigo") || name.includes("fresco")) {
            return "❄️";
        }
        return "📦"; // Ambiente
    }
}
exports.OrderOptimizationService = OrderOptimizationService;
//# sourceMappingURL=order-optimization.service.js.map