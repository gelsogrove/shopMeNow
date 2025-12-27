"use strict";
/**
 * ShowCheckout - LLM-Callable Function
 *
 * Shows the cart summary and asks for order confirmation.
 * Used when customer wants to proceed with checkout.
 *
 * Flow:
 * 1. Get customer's cart with items
 * 2. Calculate totals using PriceCalculationService (same as product search)
 * 3. Show cart summary with profile link for data verification
 * 4. Ask for confirmation
 *
 * IMPORTANT: Uses PriceCalculationService to ensure consistent pricing
 * with product search (including rounding to nearest 10 cents)
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
exports.showCheckout = showCheckout;
const database_1 = require("@echatbot/database");
const price_calculation_service_1 = require("../../application/services/price-calculation.service");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Shows cart summary and asks for order confirmation
 */
function showCheckout(request) {
    return __awaiter(this, void 0, void 0, function* () {
        // prisma imported
        try {
            logger_1.default.info("🛒 ShowCheckout called with:", {
                customerId: request.customerId,
                workspaceId: request.workspaceId,
            });
            if (!request.customerId || !request.workspaceId) {
                logger_1.default.error("❌ Missing required parameters in ShowCheckout");
                return {
                    success: false,
                    error: "Missing required parameters",
                    message: "Unable to show checkout. Missing parameters.",
                    timestamp: new Date().toISOString(),
                };
            }
            // 1. Get customer
            const customer = yield database_1.prisma.customers.findFirst({
                where: {
                    id: request.customerId,
                    workspaceId: request.workspaceId,
                },
            });
            if (!customer) {
                logger_1.default.error("❌ Customer not found in ShowCheckout");
                yield database_1.prisma.$disconnect();
                return {
                    success: false,
                    error: "Customer not found",
                    message: "Unable to find your account.",
                    timestamp: new Date().toISOString(),
                };
            }
            // 2. Get cart with items
            const cart = yield database_1.prisma.carts.findFirst({
                where: {
                    customerId: request.customerId,
                    workspaceId: request.workspaceId,
                },
                include: {
                    items: {
                        include: {
                            product: true,
                            service: true,
                        },
                    },
                },
            });
            if (!cart || !cart.items || cart.items.length === 0) {
                logger_1.default.error("❌ Cart empty in ShowCheckout");
                yield database_1.prisma.$disconnect();
                return {
                    success: false,
                    error: "Cart empty",
                    message: "Your cart is empty! 🛒\n\n" +
                        "Add some products before proceeding to checkout.",
                    timestamp: new Date().toISOString(),
                };
            }
            // 3. Calculate prices using PriceCalculationService (same as product search)
            // This ensures consistent pricing with rounding to nearest 10 cents
            const priceService = new price_calculation_service_1.PriceCalculationService(database_1.prisma);
            const productIds = cart.items
                .filter(item => item.product)
                .map(item => item.product.id);
            // Get calculated prices for all products
            const priceResult = yield priceService.calculatePricesWithDiscounts(request.workspaceId, productIds, customer.discount || 0);
            // Create a map for quick lookup: productId -> {originalPrice, finalPrice}
            const priceMap = new Map(priceResult.products.map(p => [p.id, { originalPrice: p.originalPrice, finalPrice: p.finalPrice }]));
            // 4. Build cart summary with correct prices
            let totalAmount = 0;
            const cartItems = [];
            for (const item of cart.items) {
                if (item.product) {
                    const calculatedPrice = priceMap.get(item.product.id);
                    // Use finalPrice from PriceCalculationService (already discounted and rounded)
                    const unitPrice = (calculatedPrice === null || calculatedPrice === void 0 ? void 0 : calculatedPrice.finalPrice) || Number(item.product.price) || 0;
                    const itemTotal = unitPrice * item.quantity;
                    totalAmount += itemTotal;
                    // Show simple format: quantity × product = total (NO discount info)
                    // The price shown IS the final price customer pays
                    cartItems.push(`• ${item.quantity}x ${item.product.name} - €${itemTotal.toFixed(2)}`);
                    logger_1.default.info(`📦 Product: ${item.product.name}, qty: ${item.quantity}, unitPrice: €${unitPrice.toFixed(2)}, total: €${itemTotal.toFixed(2)}`);
                }
                else if (item.service) {
                    // Services don't get discounts
                    const price = Number(item.service.price) || 0;
                    const itemTotal = price * item.quantity;
                    totalAmount += itemTotal;
                    cartItems.push(`• ${item.quantity}x ${item.service.name} - €${itemTotal.toFixed(2)}`);
                }
            }
            yield database_1.prisma.$disconnect();
            // 5. Build checkout message (English - Translation Agent will translate)
            // Include discount info if customer has one
            const customerDiscount = customer.discount || 0;
            let message = `📦 **Order Summary:**\n\n`;
            message += cartItems.join("\n") + "\n\n";
            message += `💰 **Total:** €${totalAmount.toFixed(2)}`;
            // Add discount info if customer has a discount
            if (customerDiscount > 0) {
                message += ` *(includes your ${customerDiscount}% personal discount)*`;
            }
            message += `\n\n🔐 Before proceeding, please verify your shipping details:\n`;
            message += `[LINK_PROFILE_WITH_TOKEN]\n\n`;
            message += `✅ Are your details correct? Reply **"confirm"** or **"ok"** to proceed with the order.`;
            logger_1.default.info("✅ ShowCheckout completed successfully:", {
                itemsCount: cart.items.length,
                total: totalAmount,
                discountPercent: customerDiscount,
            });
            return {
                success: true,
                message,
                cartTotal: totalAmount,
                itemsCount: cart.items.length,
                discountPercent: customerDiscount,
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            logger_1.default.error("❌ Error in ShowCheckout:", error);
            yield database_1.prisma.$disconnect();
            return {
                success: false,
                error: error instanceof Error ? error.message : "Internal error",
                message: "A technical issue occurred. Please try again later or contact support.",
                timestamp: new Date().toISOString(),
            };
        }
    });
}
//# sourceMappingURL=showCheckout.js.map