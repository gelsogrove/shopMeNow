"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.OrderService = void 0;
const database_1 = require("@echatbot/database");
const order_entity_1 = require("../../domain/entities/order.entity");
const order_repository_1 = require("../../repositories/order.repository");
const logger_1 = __importDefault(require("../../utils/logger"));
const billing_service_1 = require("./billing.service");
const customer_service_1 = require("./customer.service");
const stock_service_1 = require("./stock.service");
class OrderService {
    constructor(orderRepository, stockService, customerService) {
        this.orderRepository = orderRepository || new order_repository_1.OrderRepository();
        this.stockService = stockService || new stock_service_1.StockService();
        this.customerService = customerService || new customer_service_1.CustomerService();
        this.billingService = new billing_service_1.BillingService(database_1.prisma);
    }
    getAllOrders(workspaceId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("OrderService.getAllOrders called with:", {
                    workspaceId,
                    filters,
                });
                return yield this.orderRepository.findAll(workspaceId, filters);
            }
            catch (error) {
                logger_1.default.error("Error in order service getAllOrders:", error);
                throw new Error(`Failed to get orders: ${error.message}`);
            }
        });
    }
    getOrderById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!id) {
                    throw new Error("Order ID is required");
                }
                return yield this.orderRepository.findById(id, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error in order service getOrderById for order ${id}:`, error);
                throw new Error(`Failed to get order: ${error.message}`);
            }
        });
    }
    getOrderByCode(orderCode, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!orderCode) {
                    throw new Error("Order code is required");
                }
                return yield this.orderRepository.findByOrderCode(orderCode, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error in order service getOrderByCode for order ${orderCode}:`, error);
                throw new Error(`Failed to get order by code: ${error.message}`);
            }
        });
    }
    getOrdersByCustomerId(customerId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!customerId) {
                    throw new Error("Customer ID is required");
                }
                return yield this.orderRepository.findByCustomerId(customerId, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error in order service getOrdersByCustomerId for customer ${customerId}:`, error);
                throw new Error(`Failed to get orders by customer: ${error.message}`);
            }
        });
    }
    createOrder(orderData) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                if (!orderData.customerId) {
                    throw new Error("Customer ID is required");
                }
                if (!orderData.workspaceId) {
                    throw new Error("Workspace ID is required");
                }
                if (!orderData.items || orderData.items.length === 0) {
                    throw new Error("Order must have at least one item");
                }
                if (!orderData.totalAmount || orderData.totalAmount <= 0) {
                    throw new Error("Total amount must be greater than 0");
                }
                // Get customer data to populate shipping address
                const customer = yield this.customerService.getById(orderData.customerId, orderData.workspaceId);
                if (!customer) {
                    throw new Error("Customer not found");
                }
                // Set default values
                orderData.status = orderData.status || database_1.OrderStatus.PENDING;
                orderData.shippingAmount = orderData.shippingAmount || 0;
                orderData.taxAmount = orderData.taxAmount || 0;
                orderData.discountAmount = orderData.discountAmount || 0;
                // Populate shipping address from customer if not provided
                if (!orderData.shippingAddress && customer.address) {
                    // Split customer name into firstName and lastName
                    const nameParts = customer.name.trim().split(" ");
                    const firstName = nameParts[0] || "";
                    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
                    // Create a structured shipping address from customer's address field
                    orderData.shippingAddress = {
                        firstName,
                        lastName,
                        address: customer.address,
                        city: "", // Could be parsed from address if needed
                        postalCode: "",
                        country: "",
                        phone: customer.phone || undefined,
                    };
                    logger_1.default.info("Populated shipping address from customer:", {
                        customerId: customer.id,
                        customerName: customer.name,
                        customerAddress: customer.address,
                        shippingAddress: orderData.shippingAddress,
                    });
                }
                // Generate order code if not provided
                if (!orderData.orderCode) {
                    orderData.orderCode = this.generateOrderCode();
                }
                // Create a proper domain entity
                const order = new order_entity_1.Order(orderData);
                const createdOrder = yield this.orderRepository.create(order);
                // If order is created as CONFIRMED, send email notification
                if (createdOrder.status === database_1.OrderStatus.CONFIRMED) {
                    // 📧 SEND EMAIL TO CUSTOMER with order confirmation
                    try {
                        const { EmailService } = require("./email.service");
                        const emailService = new EmailService();
                        // Get workspace for admin email (for CC)
                        const { PrismaClient } = require("@prisma/client");
                        // prisma imported
                        const workspace = yield database_1.prisma.workspace.findUnique({
                            where: { id: createdOrder.workspaceId },
                            select: {
                                name: true,
                                whatsappSettings: {
                                    select: { adminEmail: true },
                                },
                            },
                        });
                        yield database_1.prisma.$disconnect();
                        // Format order items for email
                        const itemsList = createdOrder.items
                            .map((item, idx) => {
                            return `${idx + 1}. ${item.name} - Quantità: ${item.quantity} - Prezzo: €${item.price.toFixed(2)}`;
                        })
                            .join("\n");
                        const emailSubject = `✅ Conferma Ordine ${createdOrder.orderCode}`;
                        const emailBody = `
<h2>✅ Ordine Confermato!</h2>

<p>Gentile cliente,</p>

<p>Il tuo ordine è stato confermato con successo.</p>

<hr>

<h3>📦 Dettagli Ordine</h3>

<table style="width: 100%; border-collapse: collapse;">
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;"><strong>Codice Ordine:</strong></td>
    <td style="padding: 8px; border: 1px solid #ddd;">${createdOrder.orderCode}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;"><strong>Data:</strong></td>
    <td style="padding: 8px; border: 1px solid #ddd;">${new Date(createdOrder.createdAt).toLocaleString("it-IT")}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;"><strong>Stato:</strong></td>
    <td style="padding: 8px; border: 1px solid #ddd;">${createdOrder.status}</td>
  </tr>
</table>

<h3>🛍️ Prodotti</h3>

<pre style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
${itemsList}
</pre>

<h3>💰 Totali</h3>

<table style="width: 100%; border-collapse: collapse;">
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;"><strong>Subtotale:</strong></td>
    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">€${(createdOrder.totalAmount - (createdOrder.shippingAmount || 0) - (createdOrder.taxAmount || 0)).toFixed(2)}</td>
  </tr>
  ${createdOrder.shippingAmount ? `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Spedizione:</strong></td><td style="padding: 8px; border: 1px solid #ddd; text-align: right;">€${createdOrder.shippingAmount.toFixed(2)}</td></tr>` : ""}
  ${createdOrder.taxAmount ? `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>IVA:</strong></td><td style="padding: 8px; border: 1px solid #ddd; text-align: right;">€${createdOrder.taxAmount.toFixed(2)}</td></tr>` : ""}
  ${createdOrder.discountAmount ? `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Sconto:</strong></td><td style="padding: 8px; border: 1px solid #ddd; text-align: right;">-€${createdOrder.discountAmount.toFixed(2)}</td></tr>` : ""}
  <tr style="background-color: #f0f0f0;">
    <td style="padding: 12px; border: 1px solid #ddd;"><strong>TOTALE:</strong></td>
    <td style="padding: 12px; border: 1px solid #ddd; text-align: right; font-size: 18px;"><strong>€${createdOrder.totalAmount.toFixed(2)}</strong></td>
  </tr>
</table>

<hr>

<p>Grazie per il tuo acquisto!</p>

<p style="color: #666; font-size: 12px;">
Email generata automaticamente dal sistema eChatbot<br>
${(workspace === null || workspace === void 0 ? void 0 : workspace.name) || "eChatbot"}
</p>
          `;
                        // Send email to customer with CC to admin
                        yield emailService.sendMail({
                            type: "customer",
                            to: createdOrder.customerId,
                            subject: emailSubject,
                            body: emailBody,
                            cc: ((_a = workspace === null || workspace === void 0 ? void 0 : workspace.whatsappSettings) === null || _a === void 0 ? void 0 : _a.adminEmail) || undefined,
                            workspaceId: createdOrder.workspaceId,
                        });
                        logger_1.default.info("✅ Order confirmation email sent to customer:", createdOrder.customerId, "with CC to admin");
                    }
                    catch (emailError) {
                        logger_1.default.error("❌ Failed to send order confirmation email:", emailError);
                        // Don't fail the order creation if email fails
                    }
                }
                return createdOrder;
            }
            catch (error) {
                logger_1.default.error("Error in order service createOrder:", error);
                throw new Error(`Failed to create order: ${error.message}`);
            }
        });
    }
    updateOrder(id, orderData, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!id) {
                    throw new Error("Order ID is required");
                }
                // Check if order exists and get current status
                const existingOrder = yield this.orderRepository.findById(id, workspaceId);
                if (!existingOrder) {
                    throw new Error("Order not found");
                }
                // Determine the final status (after update)
                const finalStatus = orderData.status || existingOrder.status;
                // Block modification of order items if FINAL status is NOT PENDING or PROCESSING
                if (finalStatus !== "PENDING" &&
                    finalStatus !== "PROCESSING" &&
                    orderData.items !== undefined) {
                    // Check if items have actually changed
                    const existingItemIds = existingOrder.items
                        .map((item) => item.id)
                        .sort();
                    const newItemIds = orderData.items
                        .map((item) => item.id || "new")
                        .sort();
                    const itemsCountChanged = existingOrder.items.length !== orderData.items.length;
                    const itemsIdsChanged = JSON.stringify(existingItemIds) !== JSON.stringify(newItemIds);
                    // Check if quantities have changed
                    let quantitiesChanged = false;
                    if (!itemsCountChanged && !itemsIdsChanged) {
                        for (const newItem of orderData.items) {
                            const existingItem = existingOrder.items.find((item) => item.id === newItem.id);
                            if (existingItem && existingItem.quantity !== newItem.quantity) {
                                quantitiesChanged = true;
                                break;
                            }
                        }
                    }
                    if (itemsCountChanged || itemsIdsChanged || quantitiesChanged) {
                        throw new Error(`Cannot modify order items when status is ${finalStatus}. Only PENDING and PROCESSING orders can have items modified.`);
                    }
                }
                // Check if totalAmount is valid when provided
                if (orderData.totalAmount !== undefined && orderData.totalAmount <= 0) {
                    throw new Error("Total amount must be greater than 0");
                }
                return yield this.orderRepository.update(id, orderData, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error in order service updateOrder for order ${id}:`, error);
                throw new Error(`Failed to update order: ${error.message}`);
            }
        });
    }
    deleteOrder(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!id) {
                    throw new Error("Order ID is required");
                }
                // Check if order exists
                const order = yield this.orderRepository.findById(id, workspaceId);
                if (!order) {
                    throw new Error("Order not found");
                }
                // Allow deletion of all orders regardless of status
                yield this.orderRepository.delete(id, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error in order service deleteOrder for order ${id}:`, error);
                throw new Error(`Failed to delete order: ${error.message}`);
            }
        });
    }
    updateOrderStatus(id, status, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!id) {
                    throw new Error("Order ID is required");
                }
                // Check if order exists
                const order = yield this.orderRepository.findById(id, workspaceId);
                if (!order) {
                    throw new Error("Order not found");
                }
                // Validate status transitions
                if (!this.isValidStatusTransition(order.status, status)) {
                    throw new Error(`Invalid status transition from ${order.status} to ${status}`);
                }
                const oldStatus = order.status;
                // Update order status
                const updatedOrder = yield this.orderRepository.updateStatus(id, status, workspaceId);
                // Handle stock management and notifications
                if (updatedOrder) {
                    yield this.stockService.handleOrderStatusChange(id, oldStatus, status);
                }
                return updatedOrder;
            }
            catch (error) {
                logger_1.default.error(`Error in order service updateOrderStatus for order ${id}:`, error);
                throw new Error(`Failed to update order status: ${error.message}`);
            }
        });
    }
    // Payment status is now handled by PaymentDetails table
    getOrdersByDateRange(workspaceId, startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!startDate || !endDate) {
                    throw new Error("Start date and end date are required");
                }
                if (startDate > endDate) {
                    throw new Error("Start date must be before end date");
                }
                return yield this.orderRepository.getOrdersByDateRange(workspaceId, startDate, endDate);
            }
            catch (error) {
                logger_1.default.error("Error in order service getOrdersByDateRange:", error);
                throw new Error(`Failed to get orders by date range: ${error.message}`);
            }
        });
    }
    getOrdersCount(workspaceId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.orderRepository.getOrdersCount(workspaceId, filters);
            }
            catch (error) {
                logger_1.default.error("Error in order service getOrdersCount:", error);
                throw new Error(`Failed to get orders count: ${error.message}`);
            }
        });
    }
    getTotalRevenue(workspaceId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.orderRepository.getTotalRevenue(workspaceId, filters);
            }
            catch (error) {
                logger_1.default.error("Error in order service getTotalRevenue:", error);
                throw new Error(`Failed to get total revenue: ${error.message}`);
            }
        });
    }
    generateOrderCode() {
        // Generate 5 random uppercase letters
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let orderCode = "";
        for (let i = 0; i < 5; i++) {
            orderCode += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        return orderCode;
    }
    isValidStatusTransition(currentStatus, newStatus) {
        var _a;
        const validTransitions = {
            [database_1.OrderStatus.PENDING]: [database_1.OrderStatus.CONFIRMED, database_1.OrderStatus.CANCELLED],
            [database_1.OrderStatus.CONFIRMED]: [database_1.OrderStatus.PROCESSING, database_1.OrderStatus.CANCELLED],
            [database_1.OrderStatus.PROCESSING]: [database_1.OrderStatus.SHIPPED, database_1.OrderStatus.CANCELLED],
            [database_1.OrderStatus.SHIPPED]: [database_1.OrderStatus.DELIVERED],
            [database_1.OrderStatus.DELIVERED]: [], // No transitions from delivered
            // Can move to fully delivered when payment is complete
            [database_1.OrderStatus.CANCELLED]: [], // No transitions from cancelled
        };
        return ((_a = validTransitions[currentStatus]) === null || _a === void 0 ? void 0 : _a.includes(newStatus)) || false;
    }
    /**
     * Get order analytics for dashboard
     * @param workspaceId Workspace ID
     * @param filters Optional filters
     * @returns Order analytics data
     */
    getOrderAnalytics(workspaceId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [totalOrders, totalRevenue, pendingOrders, completedOrders] = yield Promise.all([
                    this.orderRepository.getOrdersCount(workspaceId, filters),
                    this.orderRepository.getTotalRevenue(workspaceId, filters),
                    this.orderRepository.getOrdersCount(workspaceId, Object.assign(Object.assign({}, filters), { status: database_1.OrderStatus.PENDING })),
                    this.orderRepository.getOrdersCount(workspaceId, Object.assign(Object.assign({}, filters), { status: database_1.OrderStatus.DELIVERED })),
                ]);
                return {
                    totalOrders,
                    totalRevenue,
                    pendingOrders,
                    completedOrders,
                    averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
                };
            }
            catch (error) {
                logger_1.default.error("Error in order service getOrderAnalytics:", error);
                throw new Error(`Failed to get order analytics: ${error.message}`);
            }
        });
    }
    getLatestProcessingTracking(workspaceId, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!workspaceId || !customerId) {
                    throw new Error("workspaceId and customerId are required");
                }
                const order = yield this.orderRepository.findLatestProcessingByCustomer(customerId, workspaceId);
                if (!order) {
                    return null;
                }
                const { buildDhlTrackingUrl } = yield Promise.resolve().then(() => __importStar(require("../../config")));
                const trackingUrl = buildDhlTrackingUrl(order.trackingNumber);
                return {
                    orderId: order.id,
                    orderCode: order.orderCode,
                    status: order.status,
                    trackingNumber: order.trackingNumber || null,
                    trackingUrl,
                };
            }
            catch (error) {
                logger_1.default.error("Error in getLatestProcessingTracking:", error);
                throw error;
            }
        });
    }
}
exports.OrderService = OrderService;
//# sourceMappingURL=order.service.js.map