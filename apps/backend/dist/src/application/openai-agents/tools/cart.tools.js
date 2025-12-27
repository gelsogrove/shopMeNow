"use strict";
/**
 * OpenAI Agents SDK - Cart Tools
 *
 * Tools for cart management: add items, remove items, view cart, clear cart.
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
exports.cartTools = exports.getCartLinkTool = exports.clearCartTool = exports.updateCartQuantityTool = exports.removeFromCartTool = exports.addToCartTool = exports.getCartTool = void 0;
const agents_1 = require("@openai/agents");
const zod_1 = require("zod");
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * Get customer's cart
 */
exports.getCartTool = (0, agents_1.tool)({
    name: "get_cart",
    description: `Get the customer's current shopping cart with all items and totals.
    Use this when the customer asks to see their cart, basket, or wants to know what they have selected.`,
    parameters: zod_1.z.object({}),
    execute: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { context }) {
        const ctx = context;
        try {
            logger_1.default.info(`🛒 [getCart] Customer: ${ctx.customerId}, Workspace: ${ctx.workspaceId}`);
            // Find or create cart
            let cart = yield ctx.prisma.carts.findUnique({
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
            // Verify workspace isolation
            if (cart && cart.workspaceId !== ctx.workspaceId) {
                logger_1.default.error(`🚨 [getCart] Workspace mismatch! Cart: ${cart.workspaceId}, Context: ${ctx.workspaceId}`);
                return {
                    success: false,
                    error: "Workspace mismatch",
                    message: "Errore di sicurezza",
                };
            }
            if (!cart || cart.items.length === 0) {
                return {
                    success: true,
                    data: {
                        id: (cart === null || cart === void 0 ? void 0 : cart.id) || "",
                        items: [],
                        totalItems: 0,
                        subtotal: 0,
                        discount: 0,
                        total: 0,
                    },
                    message: "Il carrello è vuoto",
                };
            }
            // Calculate totals
            const customerDiscount = ctx.customerDiscount || 0;
            let subtotal = 0;
            const items = cart.items.map((item) => {
                var _a, _b, _c, _d, _e, _f;
                const name = ((_a = item.product) === null || _a === void 0 ? void 0 : _a.name) || ((_b = item.service) === null || _b === void 0 ? void 0 : _b.name) || "Unknown";
                const unitPrice = ((_c = item.product) === null || _c === void 0 ? void 0 : _c.price) || ((_d = item.service) === null || _d === void 0 ? void 0 : _d.price) || 0;
                const totalPrice = unitPrice * item.quantity;
                subtotal += totalPrice;
                return {
                    id: item.id,
                    productId: item.productId || undefined,
                    serviceId: item.serviceId || undefined,
                    productName: (_e = item.product) === null || _e === void 0 ? void 0 : _e.name,
                    serviceName: (_f = item.service) === null || _f === void 0 ? void 0 : _f.name,
                    quantity: item.quantity,
                    unitPrice,
                    totalPrice,
                    notes: item.notes || undefined,
                };
            });
            const discount = customerDiscount > 0 ? subtotal * (customerDiscount / 100) : 0;
            const total = subtotal - discount;
            return {
                success: true,
                data: {
                    id: cart.id,
                    items,
                    totalItems: items.reduce((acc, i) => acc + i.quantity, 0),
                    subtotal,
                    discount,
                    total,
                },
                message: `Carrello con ${items.length} articoli`,
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [getCart] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nel recupero del carrello",
            };
        }
    }),
});
/**
 * Add item to cart
 */
exports.addToCartTool = (0, agents_1.tool)({
    name: "add_to_cart",
    description: `Add a product or service to the customer's cart.
    Use this when the customer wants to add something to their cart/basket.
    Requires product ID and quantity.`,
    parameters: zod_1.z.object({
        productId: zod_1.z.string().optional().describe("Product ID to add"),
        serviceId: zod_1.z.string().optional().describe("Service ID to add"),
        quantity: zod_1.z.number().min(1).default(1).describe("Quantity to add"),
        notes: zod_1.z.string().optional().describe("Optional notes for this item"),
    }),
    execute: (_a, _b) => __awaiter(void 0, [_a, _b], void 0, function* ({ productId, serviceId, quantity, notes }, { context }) {
        var _c, _d, _e, _f, _g, _h;
        const ctx = context;
        try {
            if (!productId && !serviceId) {
                return {
                    success: false,
                    error: "Product or service ID required",
                    message: "Specifica quale prodotto o servizio vuoi aggiungere",
                };
            }
            logger_1.default.info(`🛒 [addToCart] Adding ${productId || serviceId}, qty: ${quantity}`);
            // Verify product/service exists and belongs to workspace
            if (productId) {
                const product = yield ctx.prisma.products.findFirst({
                    where: {
                        id: productId,
                        workspaceId: ctx.workspaceId,
                        isActive: true,
                    },
                });
                if (!product) {
                    return {
                        success: false,
                        error: "Product not found",
                        message: "Prodotto non trovato o non disponibile",
                    };
                }
                if (product.stock < quantity) {
                    return {
                        success: false,
                        error: "Insufficient stock",
                        message: `Disponibilità insufficiente. Stock disponibile: ${product.stock}`,
                    };
                }
            }
            if (serviceId) {
                const service = yield ctx.prisma.services.findFirst({
                    where: {
                        id: serviceId,
                        workspaceId: ctx.workspaceId,
                        isActive: true,
                    },
                });
                if (!service) {
                    return {
                        success: false,
                        error: "Service not found",
                        message: "Servizio non trovato o non disponibile",
                    };
                }
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
            // Check if item already in cart
            const existingItem = yield ctx.prisma.cartItems.findFirst({
                where: {
                    cartId: cart.id,
                    productId: productId || null,
                    serviceId: serviceId || null,
                },
            });
            let cartItem;
            if (existingItem) {
                // Update quantity
                cartItem = yield ctx.prisma.cartItems.update({
                    where: { id: existingItem.id },
                    data: {
                        quantity: existingItem.quantity + quantity,
                        notes: notes || existingItem.notes,
                    },
                    include: {
                        product: true,
                        service: true,
                    },
                });
            }
            else {
                // Create new item
                cartItem = yield ctx.prisma.cartItems.create({
                    data: {
                        cartId: cart.id,
                        productId: productId || null,
                        serviceId: serviceId || null,
                        itemType: productId ? "PRODUCT" : "SERVICE",
                        quantity,
                        notes,
                    },
                    include: {
                        product: true,
                        service: true,
                    },
                });
            }
            const unitPrice = ((_c = cartItem.product) === null || _c === void 0 ? void 0 : _c.price) || ((_d = cartItem.service) === null || _d === void 0 ? void 0 : _d.price) || 0;
            return {
                success: true,
                data: {
                    id: cartItem.id,
                    productId: cartItem.productId || undefined,
                    serviceId: cartItem.serviceId || undefined,
                    productName: (_e = cartItem.product) === null || _e === void 0 ? void 0 : _e.name,
                    serviceName: (_f = cartItem.service) === null || _f === void 0 ? void 0 : _f.name,
                    quantity: cartItem.quantity,
                    unitPrice,
                    totalPrice: unitPrice * cartItem.quantity,
                    notes: cartItem.notes || undefined,
                },
                message: `Aggiunto ${cartItem.quantity}x "${((_g = cartItem.product) === null || _g === void 0 ? void 0 : _g.name) || ((_h = cartItem.service) === null || _h === void 0 ? void 0 : _h.name)}" al carrello`,
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [addToCart] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nell'aggiunta al carrello",
            };
        }
    }),
});
/**
 * Remove item from cart
 */
exports.removeFromCartTool = (0, agents_1.tool)({
    name: "remove_from_cart",
    description: `Remove an item from the customer's cart.
    Use this when the customer wants to remove something from their cart.`,
    parameters: zod_1.z.object({
        cartItemId: zod_1.z.string().optional().describe("Cart item ID to remove"),
        productId: zod_1.z.string().optional().describe("Product ID to remove"),
        serviceId: zod_1.z.string().optional().describe("Service ID to remove"),
        quantity: zod_1.z.number().optional().describe("Quantity to remove (if omitted, removes all)"),
    }),
    execute: (_a, _b) => __awaiter(void 0, [_a, _b], void 0, function* ({ cartItemId, productId, serviceId, quantity }, { context }) {
        var _c, _d;
        const ctx = context;
        try {
            const cart = yield ctx.prisma.carts.findUnique({
                where: { customerId: ctx.customerId },
            });
            if (!cart || cart.workspaceId !== ctx.workspaceId) {
                return {
                    success: false,
                    error: "Cart not found",
                    message: "Carrello non trovato",
                };
            }
            // Find the item
            let whereClause = { cartId: cart.id };
            if (cartItemId) {
                whereClause.id = cartItemId;
            }
            else if (productId) {
                whereClause.productId = productId;
            }
            else if (serviceId) {
                whereClause.serviceId = serviceId;
            }
            else {
                return {
                    success: false,
                    error: "Item identifier required",
                    message: "Specifica quale articolo vuoi rimuovere",
                };
            }
            const item = yield ctx.prisma.cartItems.findFirst({
                where: whereClause,
                include: { product: true, service: true },
            });
            if (!item) {
                return {
                    success: false,
                    error: "Item not found in cart",
                    message: "Articolo non trovato nel carrello",
                };
            }
            const itemName = ((_c = item.product) === null || _c === void 0 ? void 0 : _c.name) || ((_d = item.service) === null || _d === void 0 ? void 0 : _d.name);
            if (quantity && quantity < item.quantity) {
                // Reduce quantity
                yield ctx.prisma.cartItems.update({
                    where: { id: item.id },
                    data: { quantity: item.quantity - quantity },
                });
                return {
                    success: true,
                    data: true,
                    message: `Rimosso ${quantity}x "${itemName}" dal carrello`,
                };
            }
            else {
                // Remove entirely
                yield ctx.prisma.cartItems.delete({
                    where: { id: item.id },
                });
                return {
                    success: true,
                    data: true,
                    message: `"${itemName}" rimosso dal carrello`,
                };
            }
        }
        catch (error) {
            logger_1.default.error(`❌ [removeFromCart] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nella rimozione dal carrello",
            };
        }
    }),
});
/**
 * Update cart item quantity
 */
exports.updateCartQuantityTool = (0, agents_1.tool)({
    name: "update_cart_quantity",
    description: `Update the quantity of an item in the cart.
    Use this when the customer wants to change how many of something they want.`,
    parameters: zod_1.z.object({
        cartItemId: zod_1.z.string().optional().describe("Cart item ID"),
        productId: zod_1.z.string().optional().describe("Product ID"),
        newQuantity: zod_1.z.number().min(0).describe("New quantity (0 to remove)"),
    }),
    execute: (_a, _b) => __awaiter(void 0, [_a, _b], void 0, function* ({ cartItemId, productId, newQuantity }, { context }) {
        var _c, _d, _e, _f, _g, _h;
        const ctx = context;
        try {
            const cart = yield ctx.prisma.carts.findUnique({
                where: { customerId: ctx.customerId },
            });
            if (!cart || cart.workspaceId !== ctx.workspaceId) {
                return {
                    success: false,
                    error: "Cart not found",
                    message: "Carrello non trovato",
                };
            }
            let whereClause = { cartId: cart.id };
            if (cartItemId) {
                whereClause.id = cartItemId;
            }
            else if (productId) {
                whereClause.productId = productId;
            }
            else {
                return {
                    success: false,
                    error: "Item identifier required",
                    message: "Specifica quale articolo modificare",
                };
            }
            const item = yield ctx.prisma.cartItems.findFirst({
                where: whereClause,
                include: { product: true, service: true },
            });
            if (!item) {
                return {
                    success: false,
                    error: "Item not found",
                    message: "Articolo non trovato nel carrello",
                };
            }
            const itemName = ((_c = item.product) === null || _c === void 0 ? void 0 : _c.name) || ((_d = item.service) === null || _d === void 0 ? void 0 : _d.name);
            if (newQuantity === 0) {
                yield ctx.prisma.cartItems.delete({ where: { id: item.id } });
                return {
                    success: true,
                    message: `"${itemName}" rimosso dal carrello`,
                };
            }
            // Check stock
            if (item.product && item.product.stock < newQuantity) {
                return {
                    success: false,
                    error: "Insufficient stock",
                    message: `Disponibilità insufficiente. Stock: ${item.product.stock}`,
                };
            }
            const updated = yield ctx.prisma.cartItems.update({
                where: { id: item.id },
                data: { quantity: newQuantity },
                include: { product: true, service: true },
            });
            const unitPrice = ((_e = updated.product) === null || _e === void 0 ? void 0 : _e.price) || ((_f = updated.service) === null || _f === void 0 ? void 0 : _f.price) || 0;
            return {
                success: true,
                data: {
                    id: updated.id,
                    productId: updated.productId || undefined,
                    serviceId: updated.serviceId || undefined,
                    productName: (_g = updated.product) === null || _g === void 0 ? void 0 : _g.name,
                    serviceName: (_h = updated.service) === null || _h === void 0 ? void 0 : _h.name,
                    quantity: updated.quantity,
                    unitPrice,
                    totalPrice: unitPrice * updated.quantity,
                    notes: updated.notes || undefined,
                },
                message: `Quantità di "${itemName}" aggiornata a ${newQuantity}`,
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [updateCartQuantity] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nell'aggiornamento quantità",
            };
        }
    }),
});
/**
 * Clear entire cart
 */
exports.clearCartTool = (0, agents_1.tool)({
    name: "clear_cart",
    description: `Clear all items from the customer's cart.
    Use this when the customer wants to empty their cart completely.`,
    parameters: zod_1.z.object({
        confirm: zod_1.z.boolean().describe("Confirmation to clear cart"),
    }),
    execute: (_a, _b) => __awaiter(void 0, [_a, _b], void 0, function* ({ confirm }, { context }) {
        const ctx = context;
        try {
            if (!confirm) {
                return {
                    success: false,
                    error: "Confirmation required",
                    message: "Conferma che vuoi svuotare il carrello",
                };
            }
            const cart = yield ctx.prisma.carts.findUnique({
                where: { customerId: ctx.customerId },
            });
            if (!cart || cart.workspaceId !== ctx.workspaceId) {
                return {
                    success: true,
                    data: true,
                    message: "Il carrello è già vuoto",
                };
            }
            yield ctx.prisma.cartItems.deleteMany({
                where: { cartId: cart.id },
            });
            return {
                success: true,
                data: true,
                message: "Carrello svuotato",
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [clearCart] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nello svuotamento del carrello",
            };
        }
    }),
});
/**
 * Get cart link for checkout
 */
exports.getCartLinkTool = (0, agents_1.tool)({
    name: "get_cart_link",
    description: `Generate a secure link for the customer to view and checkout their cart.
    Use this when the customer is ready to checkout or wants to view their cart in the browser.`,
    parameters: zod_1.z.object({}),
    execute: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { context }) {
        const ctx = context;
        try {
            // Import SecureTokenService
            const { SecureTokenService } = yield Promise.resolve().then(() => __importStar(require("../../services/secure-token.service")));
            const secureTokenService = new SecureTokenService();
            const token = yield secureTokenService.createToken("cart", ctx.workspaceId, undefined, // payload
            "1h", // expiresIn
            undefined, // userId
            undefined, // phoneNumber
            undefined, // ipAddress
            ctx.customerId);
            const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
            const cartUrl = `${baseUrl}/cart-public?token=${token}`;
            return {
                success: true,
                data: cartUrl,
                message: "Link carrello generato (valido 1 ora)",
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [getCartLink] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nella generazione del link carrello",
            };
        }
    }),
});
// Export all cart tools
exports.cartTools = [
    exports.getCartTool,
    exports.addToCartTool,
    exports.removeFromCartTool,
    exports.updateCartQuantityTool,
    exports.clearCartTool,
    exports.getCartLinkTool,
];
//# sourceMappingURL=cart.tools.js.map