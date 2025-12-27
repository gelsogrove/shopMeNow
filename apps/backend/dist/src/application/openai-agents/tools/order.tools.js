"use strict";
/**
 * OpenAI Agents SDK - Order Tools
 *
 * Tools for order management: create order, track orders, view history.
 *
 * @architecture Clean Architecture - Tools layer
 * @security ALL queries filtered by workspaceId AND customerId
 * @critical NO hardcoded data - all from database
 */
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
exports.orderTools = exports.getOrderLinkTool = exports.repeatOrderTool = exports.createOrderFromCartTool = exports.getOrderDetailsTool = exports.getOrdersTool = void 0;
const agents_1 = require("@openai/agents");
const zod_1 = require("zod");
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * Get customer's orders
 */
exports.getOrdersTool = (0, agents_1.tool)({
    name: "get_orders",
    description: `Get the customer's order history.
    Use this when the customer asks about their orders, purchases, or order history.`,
    parameters: zod_1.z.object({
        status: zod_1.z.string().optional().describe("Filter by order status: PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED"),
        limit: zod_1.z.number().default(10).describe("Maximum number of orders to return"),
    }),
    execute: (_a, _b) => __awaiter(void 0, [_a, _b], void 0, function* ({ status, limit }, { context }) {
        const ctx = context;
        try {
            logger_1.default.info(`📦 [getOrders] Customer: ${ctx.customerId}, Status: ${status || "all"}`);
            const whereClause = {
                customerId: ctx.customerId,
                workspaceId: ctx.workspaceId,
                deletedAt: null,
            };
            if (status) {
                whereClause.status = status.toUpperCase();
            }
            const orders = yield ctx.prisma.orders.findMany({
                where: whereClause,
                include: {
                    items: {
                        include: {
                            product: true,
                            service: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                take: limit,
            });
            const results = orders.map((o) => ({
                id: o.id,
                orderCode: o.orderCode,
                status: o.status,
                paymentStatus: o.paymentStatus || undefined,
                totalAmount: o.totalAmount,
                shippingAmount: o.shippingAmount || undefined,
                taxAmount: o.taxAmount || undefined,
                discountAmount: o.discountAmount || undefined,
                items: o.items.map((item) => {
                    var _a, _b;
                    return ({
                        productName: (_a = item.product) === null || _a === void 0 ? void 0 : _a.name,
                        serviceName: (_b = item.service) === null || _b === void 0 ? void 0 : _b.name,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.totalPrice,
                    });
                }),
                createdAt: o.createdAt,
                trackingNumber: o.trackingNumber || undefined,
                notes: o.notes || undefined,
            }));
            return {
                success: true,
                data: results,
                message: results.length > 0
                    ? `Trovati ${results.length} ordini`
                    : "Nessun ordine trovato",
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [getOrders] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nel recupero degli ordini",
            };
        }
    }),
});
/**
 * Get order details by code
 */
exports.getOrderDetailsTool = (0, agents_1.tool)({
    name: "get_order_details",
    description: `Get detailed information about a specific order.
    Use this when the customer asks about a specific order or order code.`,
    parameters: zod_1.z.object({
        orderCode: zod_1.z.string().describe("Order code (e.g., ORD-2024-001)"),
    }),
    execute: (_a, _b) => __awaiter(void 0, [_a, _b], void 0, function* ({ orderCode }, { context }) {
        const ctx = context;
        try {
            logger_1.default.info(`📦 [getOrderDetails] Order: ${orderCode}`);
            const order = yield ctx.prisma.orders.findFirst({
                where: {
                    orderCode,
                    customerId: ctx.customerId,
                    workspaceId: ctx.workspaceId,
                    deletedAt: null,
                },
                include: {
                    items: {
                        include: {
                            product: true,
                            service: true,
                        },
                    },
                    paymentDetails: true,
                },
            });
            if (!order) {
                return {
                    success: false,
                    error: "Order not found",
                    message: "Ordine non trovato. Verifica il codice ordine.",
                };
            }
            return {
                success: true,
                data: {
                    id: order.id,
                    orderCode: order.orderCode,
                    status: order.status,
                    paymentStatus: order.paymentStatus || undefined,
                    totalAmount: order.totalAmount,
                    shippingAmount: order.shippingAmount || undefined,
                    taxAmount: order.taxAmount || undefined,
                    discountAmount: order.discountAmount || undefined,
                    items: order.items.map((item) => {
                        var _a, _b;
                        return ({
                            productName: (_a = item.product) === null || _a === void 0 ? void 0 : _a.name,
                            serviceName: (_b = item.service) === null || _b === void 0 ? void 0 : _b.name,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            totalPrice: item.totalPrice,
                        });
                    }),
                    createdAt: order.createdAt,
                    trackingNumber: order.trackingNumber || undefined,
                    notes: order.notes || undefined,
                },
                message: `Dettagli ordine ${orderCode}`,
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [getOrderDetails] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nel recupero dettagli ordine",
            };
        }
    }),
});
/**
 * Create order from cart
 */
exports.createOrderFromCartTool = (0, agents_1.tool)({
    name: "create_order_from_cart",
    description: `Create an order from the customer's current cart.
    Use this when the customer confirms they want to place an order.`,
    parameters: zod_1.z.object({
        notes: zod_1.z.string().optional().describe("Optional notes for the order"),
        paymentMethod: zod_1.z.enum(["BANK_TRANSFER", "CREDIT_CARD", "PAYPAL", "CASH_ON_DELIVERY"]).optional().describe("Payment method"),
    }),
    execute: (_a, _b) => __awaiter(void 0, [_a, _b], void 0, function* ({ notes, paymentMethod }, { context }) {
        var _c, _d;
        const ctx = context;
        try {
            logger_1.default.info(`📦 [createOrderFromCart] Creating order for customer: ${ctx.customerId}`);
            // Get cart
            const cart = yield ctx.prisma.carts.findUnique({
                where: { customerId: ctx.customerId },
                include: {
                    items: {
                        include: {
                            product: true,
                            service: true,
                        },
                    },
                },
            });
            if (!cart || cart.workspaceId !== ctx.workspaceId) {
                return {
                    success: false,
                    error: "Cart not found",
                    message: "Carrello non trovato",
                };
            }
            if (cart.items.length === 0) {
                return {
                    success: false,
                    error: "Cart is empty",
                    message: "Il carrello è vuoto. Aggiungi prodotti prima di ordinare.",
                };
            }
            // Calculate totals
            let subtotal = 0;
            const orderItems = [];
            for (const item of cart.items) {
                const unitPrice = ((_c = item.product) === null || _c === void 0 ? void 0 : _c.price) || ((_d = item.service) === null || _d === void 0 ? void 0 : _d.price) || 0;
                const totalPrice = unitPrice * item.quantity;
                subtotal += totalPrice;
                // Verify stock
                if (item.product && item.product.stock < item.quantity) {
                    return {
                        success: false,
                        error: "Insufficient stock",
                        message: `Stock insufficiente per "${item.product.name}". Disponibili: ${item.product.stock}`,
                    };
                }
                orderItems.push({
                    productId: item.productId,
                    serviceId: item.serviceId,
                    itemType: item.itemType,
                    quantity: item.quantity,
                    unitPrice,
                    totalPrice,
                });
            }
            const customerDiscount = ctx.customerDiscount || 0;
            const discountAmount = customerDiscount > 0 ? subtotal * (customerDiscount / 100) : 0;
            const totalAmount = subtotal - discountAmount;
            // Generate order code
            const year = new Date().getFullYear();
            const lastOrder = yield ctx.prisma.orders.findFirst({
                where: {
                    workspaceId: ctx.workspaceId,
                    orderCode: { startsWith: `ORD-${year}` },
                },
                orderBy: { createdAt: "desc" },
            });
            let orderNumber = 1;
            if (lastOrder) {
                const parts = lastOrder.orderCode.split("-");
                orderNumber = parseInt(parts[2] || "0", 10) + 1;
            }
            const orderCode = `ORD-${year}-${orderNumber.toString().padStart(4, "0")}`;
            // Create order in transaction
            const order = yield ctx.prisma.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
                // Create order
                const newOrder = yield tx.orders.create({
                    data: {
                        orderCode,
                        customerId: ctx.customerId,
                        workspaceId: ctx.workspaceId,
                        status: "PENDING",
                        paymentStatus: "PENDING",
                        paymentMethod: paymentMethod || null,
                        totalAmount,
                        discountAmount,
                        notes,
                        items: {
                            create: orderItems,
                        },
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
                // Update stock for products
                for (const item of cart.items) {
                    if (item.productId && item.product) {
                        yield tx.products.update({
                            where: { id: item.productId },
                            data: { stock: item.product.stock - item.quantity },
                        });
                    }
                }
                // Clear cart
                yield tx.cartItems.deleteMany({ where: { cartId: cart.id } });
                return newOrder;
            }));
            logger_1.default.info(`✅ [createOrderFromCart] Order created: ${orderCode}`);
            return {
                success: true,
                data: {
                    id: order.id,
                    orderCode: order.orderCode,
                    status: order.status,
                    paymentStatus: order.paymentStatus || undefined,
                    totalAmount: order.totalAmount,
                    discountAmount: order.discountAmount || undefined,
                    items: order.items.map((item) => {
                        var _a, _b;
                        return ({
                            productName: (_a = item.product) === null || _a === void 0 ? void 0 : _a.name,
                            serviceName: (_b = item.service) === null || _b === void 0 ? void 0 : _b.name,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            totalPrice: item.totalPrice,
                        });
                    }),
                    createdAt: order.createdAt,
                    notes: order.notes || undefined,
                },
                message: `Ordine ${orderCode} creato con successo!`,
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [createOrderFromCart] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nella creazione dell'ordine",
            };
        }
    }),
});
/**
 * Repeat a previous order
 */
exports.repeatOrderTool = (0, agents_1.tool)({
    name: "repeat_order",
    description: `Repeat a previous order by adding all its items to the cart.
    Use this when the customer wants to order the same products again.`,
    parameters: zod_1.z.object({
        orderCode: zod_1.z.string().describe("Order code to repeat"),
    }),
    execute: (_a, _b) => __awaiter(void 0, [_a, _b], void 0, function* ({ orderCode }, { context }) {
        var _c, _d;
        const ctx = context;
        try {
            logger_1.default.info(`📦 [repeatOrder] Repeating order: ${orderCode}`);
            const order = yield ctx.prisma.orders.findFirst({
                where: {
                    orderCode,
                    customerId: ctx.customerId,
                    workspaceId: ctx.workspaceId,
                    deletedAt: null,
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
            if (!order) {
                return {
                    success: false,
                    error: "Order not found",
                    message: "Ordine non trovato",
                };
            }
            // Find or create cart
            let cart = yield ctx.prisma.carts.findUnique({
                where: { customerId: ctx.customerId },
            });
            if (!cart) {
                cart = yield ctx.prisma.carts.create({
                    data: {
                        customerId: ctx.customerId,
                        workspaceId: ctx.workspaceId,
                    },
                });
            }
            // Add items to cart
            let addedCount = 0;
            let unavailableItems = [];
            for (const item of order.items) {
                if (item.productId && ((_c = item.product) === null || _c === void 0 ? void 0 : _c.isActive)) {
                    if (item.product.stock >= item.quantity) {
                        yield ctx.prisma.cartItems.create({
                            data: {
                                cartId: cart.id,
                                productId: item.productId,
                                itemType: "PRODUCT",
                                quantity: item.quantity,
                            },
                        });
                        addedCount++;
                    }
                    else {
                        unavailableItems.push(item.product.name);
                    }
                }
                else if (item.serviceId && ((_d = item.service) === null || _d === void 0 ? void 0 : _d.isActive)) {
                    yield ctx.prisma.cartItems.create({
                        data: {
                            cartId: cart.id,
                            serviceId: item.serviceId,
                            itemType: "SERVICE",
                            quantity: item.quantity,
                        },
                    });
                    addedCount++;
                }
            }
            let message = `Aggiunti ${addedCount} articoli al carrello dall'ordine ${orderCode}`;
            if (unavailableItems.length > 0) {
                message += `. Non disponibili: ${unavailableItems.join(", ")}`;
            }
            return {
                success: true,
                data: message,
                message,
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [repeatOrder] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nel ripetere l'ordine",
            };
        }
    }),
});
/**
 * Get order tracking link
 */
exports.getOrderLinkTool = (0, agents_1.tool)({
    name: "get_order_link",
    description: `Generate a secure link for the customer to view their orders.
    Use this when the customer wants to see their orders in the browser.`,
    parameters: zod_1.z.object({
        orderCode: zod_1.z.string().optional().describe("Specific order code (optional)"),
    }),
    execute: (_a, _b) => __awaiter(void 0, [_a, _b], void 0, function* ({ orderCode }, { context }) {
        const ctx = context;
        try {
            const { SecureTokenService } = yield Promise.resolve().then(() => __importStar(require("../../services/secure-token.service")));
            const secureTokenService = new SecureTokenService();
            const token = yield secureTokenService.createToken("orders", ctx.workspaceId, undefined, // payload
            "1h", // expiresIn
            undefined, // userId
            undefined, // phoneNumber
            undefined, // ipAddress
            ctx.customerId);
            const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
            let ordersUrl = `${baseUrl}/orders-public?token=${token}`;
            if (orderCode) {
                ordersUrl = `${baseUrl}/orders-public/${orderCode}?token=${token}`;
            }
            return {
                success: true,
                data: ordersUrl,
                message: "Link ordini generato (valido 1 ora)",
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [getOrderLink] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nella generazione del link ordini",
            };
        }
    }),
});
// Export all order tools
exports.orderTools = [
    exports.getOrdersTool,
    exports.getOrderDetailsTool,
    exports.createOrderFromCartTool,
    exports.repeatOrderTool,
    exports.getOrderLinkTool,
];
//# sourceMappingURL=order.tools.js.map