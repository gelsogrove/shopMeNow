"use strict";
/**
 * Cart Repository
 *
 * Data access layer for cart operations.
 * Handles all database interactions for carts and cart items.
 *
 * @architecture Clean Architecture - Repository Pattern
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
exports.CartRepository = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const database_1 = require("@echatbot/database");
class CartRepository {
    constructor() {
        this.prisma = database_1.prisma;
    }
    /**
     * Get or create cart for customer
     */
    getOrCreateCart(workspaceId, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Try to find existing cart
                let cart = yield this.prisma.carts.findUnique({
                    where: {
                        customerId
                    },
                    include: {
                        items: {
                            include: {
                                product: {
                                    select: {
                                        id: true,
                                        name: true,
                                        price: true,
                                        stock: true,
                                        isActive: true
                                    }
                                },
                                service: {
                                    select: {
                                        id: true,
                                        name: true,
                                        price: true,
                                        isActive: true
                                    }
                                }
                            }
                        }
                    }
                });
                // If no cart exists, create one
                if (!cart) {
                    cart = yield this.prisma.carts.create({
                        data: {
                            workspaceId,
                            customerId,
                            items: {
                                create: []
                            }
                        },
                        include: {
                            items: {
                                include: {
                                    product: {
                                        select: {
                                            id: true,
                                            name: true,
                                            price: true,
                                            stock: true,
                                            isActive: true
                                        }
                                    },
                                    service: {
                                        select: {
                                            id: true,
                                            name: true,
                                            price: true,
                                            isActive: true
                                        }
                                    }
                                }
                            }
                        }
                    });
                    logger_1.default.info('Created new cart:', { workspaceId, customerId, cartId: cart.id });
                }
                return cart;
            }
            catch (error) {
                logger_1.default.error('CartRepository.getOrCreateCart error:', error);
                throw error;
            }
        });
    }
    /**
     * Add item to cart
     */
    addItem(cartId, params) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { itemType, productId, serviceId, quantity, notes } = params;
                // Check if item already exists in cart
                const existingItem = yield this.prisma.cartItems.findFirst({
                    where: Object.assign(Object.assign({ cartId }, (productId && { productId })), (serviceId && { serviceId }))
                });
                if (existingItem) {
                    // ✅ Feature 191: Services can only have quantity 1 (no stacking)
                    if (itemType === 'SERVICE') {
                        logger_1.default.info('Service already in cart, keeping quantity 1:', { cartId, serviceId });
                        // Return existing item without updating - service already in cart
                        return existingItem;
                    }
                    // For products, update quantity (stack)
                    return yield this.prisma.cartItems.update({
                        where: { id: existingItem.id },
                        data: {
                            quantity: existingItem.quantity + quantity,
                            updatedAt: new Date()
                        }
                    });
                }
                // Create new cart item
                const cartItem = yield this.prisma.cartItems.create({
                    data: {
                        cartId,
                        itemType,
                        productId,
                        serviceId,
                        quantity,
                        notes
                    }
                });
                logger_1.default.info('Added item to cart:', { cartId, itemType, productId, serviceId, quantity });
                return cartItem;
            }
            catch (error) {
                logger_1.default.error('CartRepository.addItem error:', error);
                throw error;
            }
        });
    }
    /**
     * Remove item from cart
     * @param cartItemId Cart item ID
     * @param workspaceId Workspace ID for security validation
     */
    removeItem(cartItemId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // SECURITY: First verify the item belongs to this workspace
                const cartItem = yield this.prisma.cartItems.findUnique({
                    where: { id: cartItemId },
                    include: {
                        cart: {
                            select: { workspaceId: true }
                        }
                    }
                });
                if (!cartItem) {
                    throw new Error('Cart item not found');
                }
                if (cartItem.cart.workspaceId !== workspaceId) {
                    logger_1.default.warn('🚨 SECURITY: Attempted cross-workspace cart item deletion', {
                        cartItemId,
                        requestedWorkspaceId: workspaceId,
                        actualWorkspaceId: cartItem.cart.workspaceId
                    });
                    throw new Error('Cart item not found'); // Don't reveal it exists in another workspace
                }
                yield this.prisma.cartItems.delete({
                    where: { id: cartItemId }
                });
                logger_1.default.info('Removed item from cart:', { cartItemId, workspaceId });
            }
            catch (error) {
                logger_1.default.error('CartRepository.removeItem error:', error);
                throw error;
            }
        });
    }
    /**
     * Update item quantity
     * @param cartItemId Cart item ID
     * @param newQuantity New quantity
     * @param workspaceId Workspace ID for security validation
     */
    updateItemQuantity(cartItemId, newQuantity, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // SECURITY: First verify the item belongs to this workspace
                const cartItem = yield this.prisma.cartItems.findUnique({
                    where: { id: cartItemId },
                    include: {
                        cart: {
                            select: { workspaceId: true }
                        }
                    }
                });
                if (!cartItem) {
                    throw new Error('Cart item not found');
                }
                if (cartItem.cart.workspaceId !== workspaceId) {
                    logger_1.default.warn('🚨 SECURITY: Attempted cross-workspace cart item update', {
                        cartItemId,
                        requestedWorkspaceId: workspaceId,
                        actualWorkspaceId: cartItem.cart.workspaceId
                    });
                    throw new Error('Cart item not found'); // Don't reveal it exists in another workspace
                }
                yield this.prisma.cartItems.update({
                    where: { id: cartItemId },
                    data: {
                        quantity: newQuantity,
                        updatedAt: new Date()
                    }
                });
                logger_1.default.info('Updated cart item quantity:', { cartItemId, newQuantity, workspaceId });
            }
            catch (error) {
                logger_1.default.error('CartRepository.updateItemQuantity error:', error);
                throw error;
            }
        });
    }
    /**
     * Clear all items from cart
     * @param cartId Cart ID
     * @param workspaceId Workspace ID for security validation
     */
    clearCart(cartId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // SECURITY: First verify the cart belongs to this workspace
                const cart = yield this.prisma.carts.findUnique({
                    where: { id: cartId },
                    select: { workspaceId: true }
                });
                if (!cart) {
                    throw new Error('Cart not found');
                }
                if (cart.workspaceId !== workspaceId) {
                    logger_1.default.warn('🚨 SECURITY: Attempted cross-workspace cart clear', {
                        cartId,
                        requestedWorkspaceId: workspaceId,
                        actualWorkspaceId: cart.workspaceId
                    });
                    throw new Error('Cart not found'); // Don't reveal it exists in another workspace
                }
                yield this.prisma.cartItems.deleteMany({
                    where: { cartId }
                });
                logger_1.default.info('Cleared cart:', { cartId, workspaceId });
            }
            catch (error) {
                logger_1.default.error('CartRepository.clearCart error:', error);
                throw error;
            }
        });
    }
    /**
     * Get cart item by ID
     */
    getItemById(cartItemId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.prisma.cartItems.findUnique({
                    where: { id: cartItemId },
                    include: {
                        product: true,
                        service: true
                    }
                });
            }
            catch (error) {
                logger_1.default.error('CartRepository.getItemById error:', error);
                throw error;
            }
        });
    }
    /**
     * Get cart total value
     */
    getCartTotal(cartId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cart = yield this.prisma.carts.findUnique({
                    where: { id: cartId },
                    include: {
                        items: {
                            include: {
                                product: {
                                    select: { price: true }
                                },
                                service: {
                                    select: { price: true }
                                }
                            }
                        }
                    }
                });
                if (!cart)
                    return 0;
                return cart.items.reduce((total, item) => {
                    var _a, _b;
                    const price = ((_a = item.product) === null || _a === void 0 ? void 0 : _a.price) || ((_b = item.service) === null || _b === void 0 ? void 0 : _b.price) || 0;
                    return total + (price * item.quantity);
                }, 0);
            }
            catch (error) {
                logger_1.default.error('CartRepository.getCartTotal error:', error);
                throw error;
            }
        });
    }
}
exports.CartRepository = CartRepository;
//# sourceMappingURL=cart.repository.js.map