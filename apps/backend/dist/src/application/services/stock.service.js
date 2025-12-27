"use strict";
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
exports.StockService = void 0;
const prisma_1 = require("../../lib/prisma");
const push_messaging_service_1 = require("../../services/push-messaging.service");
const logger_1 = __importDefault(require("../../utils/logger"));
const email_service_1 = require("./email.service");
class StockService {
    constructor() {
        this.emailService = new email_service_1.EmailService();
    }
    /**
     * Update product stock based on order status change
     */
    handleOrderStatusChange(orderId, oldStatus, newStatus) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`[STOCK] Processing status change for order ${orderId}: ${oldStatus} → ${newStatus}`);
                // Get order with items
                const order = yield prisma_1.prisma.orders.findUnique({
                    where: { id: orderId },
                    include: {
                        items: true,
                        customer: true,
                        workspace: true,
                    },
                });
                if (!order) {
                    logger_1.default.error(`[STOCK] Order ${orderId} not found`);
                    return;
                }
                // Handle different status transitions
                if (oldStatus === "PENDING" && newStatus === "CONFIRMED") {
                    yield this.scaleStockForConfirmedOrder(order);
                    yield this.sendConfirmationNotifications(order);
                }
                else if (oldStatus === "CONFIRMED" && newStatus === "CANCELLED") {
                    yield this.restoreStockForCancelledOrder(order);
                }
                else if (newStatus === "CANCELLED" && oldStatus !== "PENDING") {
                    yield this.restoreStockForCancelledOrder(order);
                }
                logger_1.default.info(`[STOCK] Stock management completed for order ${orderId}`);
            }
            catch (error) {
                logger_1.default.error(`[STOCK] Error handling order status change for ${orderId}:`, error);
                throw error;
            }
        });
    }
    /**
     * Scale stock when order is confirmed (PENDING → CONFIRMED)
     */
    scaleStockForConfirmedOrder(order) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`[STOCK] Scaling stock for confirmed order ${order.orderCode}`);
            for (const item of order.items) {
                if (item.itemType === "PRODUCT" && item.productId) {
                    try {
                        // Get current product
                        const product = yield prisma_1.prisma.products.findUnique({
                            where: { id: item.productId },
                        });
                        if (!product) {
                            logger_1.default.warn(`[STOCK] Product ${item.productId} not found for order item`);
                            continue;
                        }
                        // Check if enough stock
                        if (product.stock < item.quantity) {
                            logger_1.default.warn(`[STOCK] Insufficient stock for product ${product.name}: ${product.stock} < ${item.quantity}`);
                            // Could throw error or handle gracefully - for now we continue
                            continue;
                        }
                        // Update stock
                        const newStock = product.stock - item.quantity;
                        yield prisma_1.prisma.products.update({
                            where: { id: item.productId },
                            data: { stock: newStock },
                        });
                        logger_1.default.info(`[STOCK] Updated product ${product.name}: ${product.stock} → ${newStock} (-${item.quantity})`);
                        // Log stock change
                        yield this.logStockChange(item.productId, order.workspaceId, -item.quantity, `Order confirmed: ${order.orderCode}`, order.id);
                    }
                    catch (error) {
                        logger_1.default.error(`[STOCK] Error updating stock for product ${item.productId}:`, error);
                        // Continue with other products
                    }
                }
            }
        });
    }
    /**
     * Restore stock when order is cancelled
     */
    restoreStockForCancelledOrder(order) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`[STOCK] Restoring stock for cancelled order ${order.orderCode}`);
            for (const item of order.items) {
                if (item.itemType === "PRODUCT" && item.productId) {
                    try {
                        // Get current product
                        const product = yield prisma_1.prisma.products.findUnique({
                            where: { id: item.productId },
                        });
                        if (!product) {
                            logger_1.default.warn(`[STOCK] Product ${item.productId} not found for stock restoration`);
                            continue;
                        }
                        // Restore stock
                        const newStock = product.stock + item.quantity;
                        yield prisma_1.prisma.products.update({
                            where: { id: item.productId },
                            data: { stock: newStock },
                        });
                        logger_1.default.info(`[STOCK] Restored product ${product.name}: ${product.stock} → ${newStock} (+${item.quantity})`);
                        // Log stock change
                        yield this.logStockChange(item.productId, order.workspaceId, item.quantity, `Order cancelled: ${order.orderCode}`, order.id);
                    }
                    catch (error) {
                        logger_1.default.error(`[STOCK] Error restoring stock for product ${item.productId}:`, error);
                        // Continue with other products
                    }
                }
            }
        });
    }
    /**
     * Send confirmation notifications when order is confirmed
     */
    sendConfirmationNotifications(order) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get admin email from whatsapp settings
                const whatsappSettings = yield prisma_1.prisma.whatsappSettings.findFirst({
                    where: { workspaceId: order.workspaceId },
                });
                const adminEmail = (whatsappSettings === null || whatsappSettings === void 0 ? void 0 : whatsappSettings.adminEmail) || order.workspace.notificationEmail;
                // Send email to customer
                if (order.customer.email) {
                    yield this.sendCustomerConfirmationEmail(order.customer.email, order, order.customer.name);
                }
                // Send email to admin
                if (adminEmail) {
                    yield this.sendAdminConfirmationEmail(adminEmail, order, order.customer);
                }
                // Send WhatsApp confirmation
                yield this.sendWhatsAppConfirmation(order.customer.phone, order.orderCode, order.workspaceId);
                logger_1.default.info(`[STOCK] Confirmation notifications sent for order ${order.orderCode}`);
            }
            catch (error) {
                logger_1.default.error(`[STOCK] Error sending confirmation notifications:`, error);
                // Don't throw - order is already confirmed
            }
        });
    }
    /**
     * Send confirmation email to customer
     */
    sendCustomerConfirmationEmail(email, order, customerName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const emailContent = `
Ciao ${customerName},

🎉 Il tuo ordine ${order.orderCode} è stato confermato!

Il nostro team ti contatterà per i dettagli di consegna.

Dettagli ordine:
${order.items
                    .map((item) => { var _a; return `- ${item.quantity}x ${((_a = item.productVariant) === null || _a === void 0 ? void 0 : _a.descrizione) || "Prodotto"} (€${item.unitPrice.toFixed(2)})`; })
                    .join("\n")}

Totale: €${order.totalAmount.toFixed(2)}

Grazie per aver scelto i nostri servizi!

Cordiali saluti,
Il Team
      `.trim();
                const transporter = yield this.emailService["transporter"];
                yield transporter.sendMail({
                    from: process.env.SMTP_FROM || "noreply@echatbot.ai",
                    to: email,
                    subject: `🎉 Ordine Confermato - ${order.orderCode}`,
                    text: emailContent,
                });
                logger_1.default.info(`[STOCK] Customer confirmation email sent to ${email}`);
            }
            catch (error) {
                logger_1.default.error("[STOCK] Error sending customer confirmation email:", error);
            }
        });
    }
    /**
     * Send confirmation email to admin
     */
    sendAdminConfirmationEmail(email, order, customer) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const emailContent = `
Ordine confermato e processato:

Ordine: ${order.orderCode}
Cliente: ${customer.name}
Email: ${customer.email}
Telefono: ${customer.phone}
Totale: €${order.totalAmount.toFixed(2)}
Status: CONFERMATO

Prodotti (stock aggiornato):
${order.items
                    .map((item) => { var _a; return `- ${item.quantity}x ${((_a = item.productVariant) === null || _a === void 0 ? void 0 : _a.descrizione) || "Prodotto"} (€${item.unitPrice.toFixed(2)})`; })
                    .join("\n")}

L'ordine è stato processato e lo stock è stato aggiornato.
      `.trim();
                const transporter = yield this.emailService["transporter"];
                yield transporter.sendMail({
                    from: process.env.SMTP_FROM || "noreply@echatbot.ai",
                    to: email,
                    subject: `Ordine Confermato e Processato - ${order.orderCode}`,
                    text: emailContent,
                });
                logger_1.default.info(`[STOCK] Admin confirmation email sent to ${email}`);
            }
            catch (error) {
                logger_1.default.error("[STOCK] Error sending admin confirmation email:", error);
            }
        });
    }
    /**
     * Send WhatsApp confirmation using centralized push messaging service
     */
    sendWhatsAppConfirmation(phoneNumber, orderCode, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Find customer
                const customer = yield prisma_1.prisma.customers.findFirst({
                    where: { phone: phoneNumber, workspaceId },
                });
                if (!customer) {
                    logger_1.default.error(`[STOCK] Customer not found for WhatsApp confirmation: ${phoneNumber}`);
                    return;
                }
                // 🚀 Use centralized push messaging service
                const success = yield push_messaging_service_1.pushMessagingService.sendOrderConfirmation(customer.id, phoneNumber, workspaceId, orderCode);
                if (success) {
                    logger_1.default.info(`[STOCK] ✅ WhatsApp confirmation sent via push service for ${phoneNumber}: ${orderCode}`);
                }
                else {
                    logger_1.default.error(`[STOCK] ❌ Failed to send WhatsApp confirmation for ${phoneNumber}: ${orderCode}`);
                }
            }
            catch (error) {
                logger_1.default.error("[STOCK] Error sending WhatsApp confirmation:", error);
            }
        });
    }
    /**
     * Log stock changes for audit
     */
    logStockChange(productId, workspaceId, change, reason, orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // This could be a separate StockLog table, for now just log to console
                logger_1.default.info(`[STOCK_LOG] Product ${productId}: ${change > 0 ? "+" : ""}${change} (${reason})`);
            }
            catch (error) {
                logger_1.default.error("[STOCK] Error logging stock change:", error);
            }
        });
    }
    /**
     * Check stock availability for products
     */
    checkStockAvailability(productId, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const product = yield prisma_1.prisma.products.findUnique({
                    where: { id: productId },
                });
                if (!product || !product.isActive) {
                    return false;
                }
                return product.stock >= quantity;
            }
            catch (error) {
                logger_1.default.error(`[STOCK] Error checking stock availability for ${productId}:`, error);
                return false;
            }
        });
    }
    /**
     * Get products with low stock (stock = 0)
     */
    getOutOfStockProducts(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield prisma_1.prisma.products.findMany({
                    where: {
                        workspaceId,
                        stock: 0,
                        isActive: true,
                    },
                    select: {
                        id: true,
                        name: true,
                        // sku: true, // REMOVED: field no longer exists
                        stock: true,
                        price: true,
                    },
                });
            }
            catch (error) {
                logger_1.default.error(`[STOCK] Error getting out of stock products:`, error);
                return [];
            }
        });
    }
}
exports.StockService = StockService;
//# sourceMappingURL=stock.service.js.map