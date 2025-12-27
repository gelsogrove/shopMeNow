"use strict";
/**
 * Price Calculation Service
 * Handles price calculations with customer and offer discounts
 * Logic: NON-CUMULATIVE - highest discount wins
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
exports.PriceCalculationService = void 0;
const logger_1 = __importDefault(require("../../utils/logger"));
class PriceCalculationService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Calculate final prices for products applying discounts
     * Andrea's Logic: NON-CUMULATIVE - highest discount wins
     * If customer has 10% and Black Friday has 20%, use 20%
     * When Black Friday ends, return to 10%
     */
    calculatePricesWithDiscounts(workspaceId_1, productIds_1) {
        return __awaiter(this, arguments, void 0, function* (workspaceId, productIds, customerDiscount = 0) {
            try {
                logger_1.default.info(`Calculating prices for workspace ${workspaceId} with customer discount ${customerDiscount}%`);
                // Get products
                const products = yield this.getProducts(workspaceId, productIds);
                if (products.length === 0) {
                    return {
                        products: [],
                        totalDiscount: 0,
                        discountsApplied: {
                            customerDiscount: 0,
                            bestOfferDiscount: 0,
                            appliedDiscount: 0,
                            source: "none",
                        },
                    };
                }
                // Get active offers for workspace
                const activeOffers = yield this.getActiveOffers(workspaceId);
                logger_1.default.info(`Found ${activeOffers.length} active offers`);
                // Calculate prices for each product
                const productsWithPrices = products.map((product) => {
                    // Find best offer for this product
                    const applicableOffers = this.findApplicableOffers(product, activeOffers);
                    const bestOffer = this.getBestOffer(applicableOffers);
                    const bestOfferDiscount = bestOffer ? bestOffer.discountPercent : 0;
                    // Andrea's Logic: Highest discount wins (NON-CUMULATIVE)
                    let appliedDiscount = 0;
                    let discountSource = "none";
                    let discountName = "";
                    if (bestOfferDiscount > customerDiscount) {
                        // Offer discount is higher
                        appliedDiscount = bestOfferDiscount;
                        discountSource = "offer";
                        discountName = (bestOffer === null || bestOffer === void 0 ? void 0 : bestOffer.name) || "";
                    }
                    else if (customerDiscount > 0) {
                        // Customer discount is higher (or equal)
                        appliedDiscount = customerDiscount;
                        discountSource = "customer";
                        discountName = "Customer Discount";
                    }
                    // Calculate final price
                    const originalPrice = product.price;
                    let finalPrice = appliedDiscount > 0
                        ? originalPrice * (1 - appliedDiscount / 100)
                        : originalPrice;
                    // 🔴 CRITICAL: Round UP to nearest 10 cents (€8.01 → €8.10, €8.11 → €8.20)
                    // Andrea's requirement: arrotondamento per eccesso ai 10 centesimi
                    finalPrice = Math.ceil(finalPrice * 10) / 10;
                    return Object.assign(Object.assign({}, product), { originalPrice,
                        finalPrice,
                        appliedDiscount, discountSource: discountSource !== "none" ? discountSource : undefined, discountName: discountName || undefined });
                });
                // Calculate total discount applied
                const totalOriginalPrice = productsWithPrices.reduce((sum, p) => sum + p.originalPrice, 0);
                const totalFinalPrice = productsWithPrices.reduce((sum, p) => sum + p.finalPrice, 0);
                const totalDiscount = totalOriginalPrice - totalFinalPrice;
                // Get best overall discount applied
                const bestOverallDiscount = Math.max(...productsWithPrices.map((p) => p.appliedDiscount || 0));
                const bestOfferDiscount = Math.max(...activeOffers.map((o) => o.discountPercent), 0);
                return {
                    products: productsWithPrices,
                    totalDiscount,
                    discountsApplied: {
                        customerDiscount,
                        bestOfferDiscount,
                        appliedDiscount: bestOverallDiscount,
                        source: bestOverallDiscount === bestOfferDiscount
                            ? "offer"
                            : bestOverallDiscount === customerDiscount
                                ? "customer"
                                : "none",
                    },
                };
            }
            catch (error) {
                logger_1.default.error("Error calculating prices with discounts:", error);
                throw error;
            }
        });
    }
    /**
     * Get products from database
     */
    getProducts(workspaceId, productIds) {
        return __awaiter(this, void 0, void 0, function* () {
            const whereClause = {
                workspaceId,
                isActive: true,
                status: "ACTIVE",
            };
            if (productIds && productIds.length > 0) {
                whereClause.id = { in: productIds };
            }
            return yield this.prisma.products.findMany({
                where: whereClause,
                select: {
                    id: true,
                    name: true,
                    price: true,
                    categoryId: true,
                    formato: true,
                    sku: true,
                    description: true,
                    stock: true,
                    // sku: true // REMOVED: field no longer exists
                },
            });
        });
    }
    /**
     * Get active offers for workspace
     */
    getActiveOffers(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            // Offers expire based on dates only - isActive flag is ignored
            return yield this.prisma.offers.findMany({
                where: {
                    workspaceId,
                    startDate: { lte: now },
                    endDate: { gte: now },
                },
                select: {
                    id: true,
                    name: true,
                    discountPercent: true,
                    startDate: true,
                    endDate: true,
                    isActive: true,
                    categoryId: true,
                },
            });
        });
    }
    /**
     * Find offers applicable to a specific product
     */
    findApplicableOffers(product, offers) {
        return offers.filter((offer) => {
            // If offer has no categoryId, it applies to all products
            if (!offer.categoryId) {
                return true;
            }
            // If product has no category, it can't match category-specific offers
            if (!product.categoryId) {
                return false;
            }
            // Check if product category matches offer category
            return offer.categoryId === product.categoryId;
        });
    }
    /**
     * Get the best offer (highest discount)
     */
    getBestOffer(offers) {
        if (offers.length === 0) {
            return null;
        }
        return offers.reduce((best, current) => current.discountPercent > best.discountPercent ? current : best);
    }
    /**
     * Check what discounts are available for a customer
     */
    getAvailableDiscounts(workspaceId, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get customer discount
                let customerDiscount = 0;
                if (customerId) {
                    const customer = yield this.prisma.customers.findUnique({
                        where: { id: customerId },
                        select: { discount: true },
                    });
                    customerDiscount = (customer === null || customer === void 0 ? void 0 : customer.discount) || 0;
                }
                // Get active offers
                const activeOffers = yield this.getActiveOffers(workspaceId);
                const bestOfferDiscount = activeOffers.length > 0
                    ? Math.max(...activeOffers.map((o) => o.discountPercent))
                    : 0;
                return {
                    customerDiscount,
                    bestOfferDiscount,
                    activeOffers: activeOffers.map((offer) => ({
                        id: offer.id,
                        name: offer.name,
                        discountPercent: offer.discountPercent,
                        categoryId: offer.categoryId,
                    })),
                    bestDiscount: Math.max(customerDiscount, bestOfferDiscount),
                    discountSource: bestOfferDiscount > customerDiscount
                        ? "offer"
                        : customerDiscount > 0
                            ? "customer"
                            : "none",
                };
            }
            catch (error) {
                logger_1.default.error("Error getting available discounts:", error);
                throw error;
            }
        });
    }
}
exports.PriceCalculationService = PriceCalculationService;
//# sourceMappingURL=price-calculation.service.js.map