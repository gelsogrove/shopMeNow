"use strict";
/**
 * ConfirmOrder - LLM-Callable Function
 *
 * Confirms the current cart and creates a new order.
 * Used when customer says: "confermo", "ok", "procedi", "conferma ordine"
 *
 * Flow:
 * 1. Get customer's cart with items
 * 2. Calculate prices using PriceCalculationService (same as ShowCheckout)
 * 3. Create new order from cart items
 * 4. Clear the cart
 * 5. Return success message
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
exports.confirmOrder = confirmOrder;
const database_1 = require("@echatbot/database");
const price_calculation_service_1 = require("../../application/services/price-calculation.service");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Confirms the cart and creates a new order
 */
function confirmOrder(request) {
    return __awaiter(this, void 0, void 0, function* () {
        // prisma imported
        try {
            logger_1.default.info("✅ ConfirmOrder called with:", {
                customerId: request.customerId,
                workspaceId: request.workspaceId,
            });
            if (!request.customerId || !request.workspaceId) {
                logger_1.default.error("❌ Missing required parameters in ConfirmOrder");
                return {
                    success: false,
                    error: "Missing required parameters",
                    message: "Unable to confirm the order. Missing parameters.",
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
                logger_1.default.error("❌ Customer not found in ConfirmOrder");
                yield database_1.prisma.$disconnect();
                return {
                    success: false,
                    error: "Customer not found",
                    message: "Unable to find your account.",
                    timestamp: new Date().toISOString(),
                };
            }
            // 1b. Get workspace to check hasSalesAgents
            const workspace = yield database_1.prisma.workspace.findUnique({
                where: { id: request.workspaceId },
                select: { hasSalesAgents: true, name: true }
            });
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
                logger_1.default.error("❌ Cart empty in ConfirmOrder");
                yield database_1.prisma.$disconnect();
                return {
                    success: false,
                    error: "Cart empty",
                    message: "Your cart is empty! 🛒\n\n" +
                        "Add some products before confirming the order.",
                    timestamp: new Date().toISOString(),
                };
            }
            // 3. Calculate prices using PriceCalculationService (same as ShowCheckout)
            const priceService = new price_calculation_service_1.PriceCalculationService(database_1.prisma);
            const productIds = cart.items
                .filter(item => item.product)
                .map(item => item.product.id);
            // Get calculated prices for all products
            const priceResult = yield priceService.calculatePricesWithDiscounts(request.workspaceId, productIds, customer.discount || 0);
            // Create a map for quick lookup: productId -> {originalPrice, finalPrice}
            const priceMap = new Map(priceResult.products.map(p => [p.id, { originalPrice: p.originalPrice, finalPrice: p.finalPrice }]));
            // 4. Build order items with correct prices
            let totalAmount = 0;
            const orderItems = [];
            let originalTotal = 0;
            for (const item of cart.items) {
                if (item.product) {
                    const calculatedPrice = priceMap.get(item.product.id);
                    // Use finalPrice from PriceCalculationService (already discounted and rounded)
                    const unitPrice = (calculatedPrice === null || calculatedPrice === void 0 ? void 0 : calculatedPrice.finalPrice) || Number(item.product.price) || 0;
                    const originalPrice = (calculatedPrice === null || calculatedPrice === void 0 ? void 0 : calculatedPrice.originalPrice) || Number(item.product.price) || 0;
                    const itemTotal = unitPrice * item.quantity;
                    totalAmount += itemTotal;
                    originalTotal += originalPrice * item.quantity;
                    orderItems.push({
                        itemType: "PRODUCT",
                        productId: item.product.id,
                        quantity: item.quantity,
                        unitPrice: unitPrice,
                        totalPrice: itemTotal,
                        productVariant: item.notes || null,
                    });
                    logger_1.default.info(`📦 Order item: ${item.product.name}, qty: ${item.quantity}, unitPrice: €${unitPrice.toFixed(2)}, total: €${itemTotal.toFixed(2)}`);
                }
                else if (item.service) {
                    // Services don't get discounts
                    const price = Number(item.service.price) || 0;
                    const itemTotal = price * item.quantity;
                    totalAmount += itemTotal;
                    originalTotal += itemTotal;
                    orderItems.push({
                        itemType: "SERVICE",
                        serviceId: item.service.id,
                        quantity: item.quantity,
                        unitPrice: price,
                        totalPrice: itemTotal,
                    });
                }
            }
            // Calculate discount amount for order record (for reference only)
            const discountAmount = originalTotal - totalAmount;
            const discountPercent = customer.discount || 0;
            // 5. Generate order code
            const orderCount = yield database_1.prisma.orders.count({
                where: { workspaceId: request.workspaceId },
            });
            const year = new Date().getFullYear();
            const month = new Date().getMonth() + 1;
            const orderCode = `ORD-${String(orderCount + 1).padStart(3, "0")}-${year}-${month}`;
            // 6. Create the order
            const order = yield database_1.prisma.orders.create({
                data: {
                    orderCode,
                    customerId: request.customerId,
                    workspaceId: request.workspaceId,
                    status: "PENDING",
                    paymentMethod: "PAYPAL",
                    totalAmount,
                    shippingAmount: 0,
                    taxAmount: 0,
                    discountAmount,
                    discountCode: discountPercent > 0 ? `SCONTO_${discountPercent}%` : null,
                    shippingAddress: customer.address || "",
                    billingAddress: customer.address || "",
                    notes: `Ordine creato via chatbot. Sconto cliente: ${discountPercent}%`,
                    items: {
                        create: orderItems,
                    },
                },
                include: {
                    items: true,
                },
            });
            logger_1.default.info("✅ Order created:", {
                orderCode: order.orderCode,
                totalAmount: order.totalAmount,
                itemsCount: order.items.length,
            });
            // 7. Clear the cart
            yield database_1.prisma.cartItems.deleteMany({
                where: { cartId: cart.id },
            });
            logger_1.default.info("🗑️ Cart cleared after order creation");
            // 8. 📧 Notify assigned sales agent about new order
            try {
                if (customer.salesId) {
                    const salesAgent = yield database_1.prisma.sales.findUnique({
                        where: { id: customer.salesId },
                        select: { id: true, email: true, firstName: true, lastName: true }
                    });
                    if (salesAgent === null || salesAgent === void 0 ? void 0 : salesAgent.email) {
                        // Get workspace info
                        const workspace = yield database_1.prisma.workspace.findUnique({
                            where: { id: request.workspaceId },
                            select: { name: true }
                        });
                        // Use EmailService to send notification
                        const { EmailService } = require("../../application/services/email.service");
                        const emailService = new EmailService();
                        const agentName = `${salesAgent.firstName} ${salesAgent.lastName}`.trim();
                        // Build order items summary
                        const itemsSummary = orderItems.map((item) => `• ${item.quantity}x - €${item.totalPrice.toFixed(2)}`).join('\n');
                        const emailSent = yield emailService.sendOperatorNotificationEmail({
                            to: salesAgent.email,
                            customerName: customer.name,
                            chatSummary: `
📦 **NUOVO ORDINE RICEVUTO**

**Codice Ordine:** ${order.orderCode}
**Totale:** €${totalAmount.toFixed(2)}
**Articoli:** ${order.items.length}

${itemsSummary}

Il cliente attende conferma e dettagli di pagamento.
            `.trim(),
                            workspaceName: (workspace === null || workspace === void 0 ? void 0 : workspace.name) || 'N/A',
                            subject: `🛒 Nuovo Ordine ${order.orderCode} da ${customer.name} - €${totalAmount.toFixed(2)}`,
                        });
                        if (emailSent) {
                            logger_1.default.info(`📧 New order notification email sent to agent ${salesAgent.email}`);
                        }
                        else {
                            logger_1.default.warn(`⚠️ Failed to send new order notification email to agent ${salesAgent.email}`);
                        }
                    }
                    else {
                        logger_1.default.info(`ℹ️ Sales agent has no email - skipping email notification`);
                    }
                }
            }
            catch (notificationError) {
                // Don't fail the order if notification fails
                logger_1.default.warn("⚠️ Failed to send new order notification:", notificationError);
            }
            yield database_1.prisma.$disconnect();
            // 9. Return success message (English - will be translated by Translation Agent)
            const contactMessage = (workspace === null || workspace === void 0 ? void 0 : workspace.hasSalesAgents)
                ? "📲 Un nostro **agente commerciale** ti contatterà presto su questo canale per la conferma finale e i dettagli del pagamento."
                : "📲 Un **operatore** ti contatterà presto su questo canale per la conferma finale e i dettagli del pagamento.";
            const finalMessage = [
                `🎉 **Grazie {{nameUser}}!**`,
                ``,
                `Il tuo ordine è stato registrato con successo.`,
                ``,
                `📦 **Riepilogo ordine**`,
                `• Codice: **${order.orderCode}**`,
                `• Articoli: **${order.items.length}**`,
                `• Totale: **€${totalAmount.toFixed(2)}**`,
                ``,
                `🔗 Verifica il tuo indirizzo di spedizione: [LINK_PROFILE_WITH_TOKEN]`,
                `_(Il link resta attivo per {{TOKEN_DURATION}})_`,
                ``,
                contactMessage,
                ``,
                `📋 **Cosa vuoi fare ora?**`,
                `1. Vedere i tuoi ordini`,
            ].join("\n");
            const nextActions = {
                type: "numbered",
                listType: "ORDER_ACTIONS",
                currentOrderCode: order.orderCode,
                options: [
                    {
                        number: 1,
                        label: "Vedere i tuoi ordini",
                        id: "VIEW_ORDERS",
                    },
                ],
            };
            return {
                success: true,
                message: finalMessage,
                orderCode: order.orderCode,
                orderTotal: totalAmount,
                itemsCount: order.items.length,
                timestamp: new Date().toISOString(),
                nextActions,
            };
        }
        catch (error) {
            logger_1.default.error("❌ Error in ConfirmOrder:", error);
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
//# sourceMappingURL=ConfirmOrder.js.map