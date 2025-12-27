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
exports.CartController = void 0;
const price_calculation_service_1 = require("../../../application/services/price-calculation.service");
const secure_token_service_1 = require("../../../application/services/secure-token.service");
const prisma_1 = require("../../../lib/prisma");
const logger_1 = __importDefault(require("../../../utils/logger"));
class CartController {
    constructor() {
        this.secureTokenService = new secure_token_service_1.SecureTokenService();
    }
    /**
     * 🎯 TASK: Clean up orphaned cart items (items with missing products OR services)
     */
    cleanupOrphanedCartItems(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Find ALL cart items for this workspace with relations loaded
                const allItems = yield prisma_1.prisma.cartItems.findMany({
                    where: {
                        cart: {
                            workspaceId: workspaceId,
                        },
                    },
                    include: {
                        cart: true,
                        product: true,
                        service: true,
                    },
                });
                // Filter orphaned items in memory
                const orphanedItems = allItems.filter((item) => {
                    // PRODUCT items without a product are orphaned
                    if (item.itemType === "PRODUCT" && !item.product) {
                        return true;
                    }
                    // SERVICE items without a service are orphaned
                    if (item.itemType === "SERVICE" && !item.service) {
                        return true;
                    }
                    return false;
                });
                if (orphanedItems.length > 0) {
                    logger_1.default.warn(`🧹 Found ${orphanedItems.length} orphaned cart items in workspace ${workspaceId}`);
                    // Delete orphaned items
                    yield prisma_1.prisma.cartItems.deleteMany({
                        where: {
                            id: {
                                in: orphanedItems.map((item) => item.id),
                            },
                        },
                    });
                    logger_1.default.info(`🧹 Cleaned up ${orphanedItems.length} orphaned cart items`);
                }
            }
            catch (error) {
                logger_1.default.error("❌ Error cleaning up orphaned cart items:", error);
                // Don't throw - we don't want cleanup to break the request
            }
        });
    }
    /**
     * � Helper: Calculate product item pricing with discounts
     * Extracts duplicated logic from getCartByToken, addItemToCart, checkoutByToken
     */
    calculateProductItemPrice(item, workspaceId, customerDiscount) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const priceService = new price_calculation_service_1.PriceCalculationService(prisma_1.prisma);
            const itemPrices = yield priceService.calculatePricesWithDiscounts(workspaceId, [item.productId], customerDiscount);
            const originalPrice = item.product.price || 0;
            const finalPrice = ((_a = itemPrices.products[0]) === null || _a === void 0 ? void 0 : _a.finalPrice) || originalPrice;
            const discountInfo = itemPrices.products[0];
            const appliedDiscount = (discountInfo === null || discountInfo === void 0 ? void 0 : discountInfo.appliedDiscount) || 0;
            const discountAmount = appliedDiscount > 0 ? (originalPrice * appliedDiscount) / 100 : 0;
            const itemTotal = finalPrice * item.quantity;
            return {
                originalPrice,
                finalPrice,
                discountAmount,
                appliedDiscount,
                itemTotal,
            };
        });
    }
    /**
     * 🎯 Helper: Calculate service item pricing (no discounts)
     * Extracts duplicated logic from getCartByToken, addItemToCart, checkoutByToken
     */
    calculateServiceItemPrice(item) {
        var _a;
        const originalPrice = ((_a = item.service) === null || _a === void 0 ? void 0 : _a.price) || 0;
        const finalPrice = originalPrice; // Services are NEVER discounted
        const appliedDiscount = 0;
        const discountAmount = 0;
        const itemTotal = finalPrice * item.quantity;
        return {
            originalPrice,
            finalPrice,
            discountAmount,
            appliedDiscount,
            itemTotal,
        };
    }
    /**
     * Helper: Calculate cart total amount (base prices without discounts)
     * Used in addItemToCart, updateCartItem, removeCartItem
     */
    calculateCartTotal(items) {
        return items.reduce((sum, item) => {
            if (item.itemType === "PRODUCT") {
                if (!item.product) {
                    logger_1.default.warn(`Cart item ${item.id} has missing product (productId: ${item.productId})`);
                    return sum;
                }
                return sum + (item.product.price || 0) * item.quantity;
            }
            if (item.itemType === "SERVICE") {
                if (!item.service) {
                    logger_1.default.warn(`Cart item ${item.id} has missing service (serviceId: ${item.serviceId})`);
                    return sum;
                }
                return sum + (item.service.price || 0) * item.quantity;
            }
            return sum;
        }, 0);
    }
    /**
     * �🆕 Generate a new cart token for public access
     */
    generateToken(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { customerId, workspaceId, expiresInMinutes = 60 } = req.body;
                if (!customerId || !workspaceId) {
                    res.status(400).json({
                        success: false,
                        error: "customerId and workspaceId are required",
                    });
                    return;
                }
                // Verify customer exists
                const customer = yield prisma_1.prisma.customers.findFirst({
                    where: {
                        id: customerId,
                        workspaceId: workspaceId,
                        isActive: true,
                    },
                });
                if (!customer) {
                    res.status(400).json({
                        success: false,
                        error: "Customer not found",
                    });
                    return;
                }
                // Get or create cart for customer
                let cart = yield prisma_1.prisma.carts.findFirst({
                    where: {
                        customerId: customerId,
                        workspaceId: workspaceId,
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
                if (!cart) {
                    cart = yield prisma_1.prisma.carts.create({
                        data: {
                            customerId: customerId,
                            workspaceId: workspaceId,
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
                }
                // Calculate total amount
                const totalAmount = cart.items.reduce((sum, item) => {
                    var _a, _b;
                    const price = item.itemType === "PRODUCT"
                        ? ((_a = item.product) === null || _a === void 0 ? void 0 : _a.price) || 0
                        : ((_b = item.service) === null || _b === void 0 ? void 0 : _b.price) || 0;
                    return sum + price * item.quantity;
                }, 0);
                // Generate token
                const tokenData = {
                    customerId: customer.id,
                    cartId: cart.id,
                    items: cart.items,
                    totalAmount: totalAmount,
                    currency: customer.currency || "EUR",
                    createdAt: new Date().toISOString(),
                };
                const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
                const token = yield this.secureTokenService.createToken("cart", workspaceId, tokenData, `${expiresInMinutes}m`, undefined, undefined, undefined, customer.id);
                logger_1.default.info(`[CART] Token generated for customer ${customer.id}, cart ${cart.id}`);
                res.json({
                    success: true,
                    token: token,
                    expiresAt: expiresAt.toISOString(),
                    cartId: cart.id,
                    customer: {
                        id: customer.id,
                        name: customer.name,
                        email: customer.email,
                        company: customer.company,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("[CART] Error generating token:", error);
                res.status(500).json({
                    success: false,
                    error: "Internal server error",
                });
            }
        });
    }
    /**
     * Get cart contents by token
     */
    getCartByToken(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const token = req.params.token;
                const validation = yield this.secureTokenService.validateToken(token); // 🚀 KISS: Solo esistenza + non scaduto
                if (!validation.valid || !validation.payload) {
                    res.status(400).json({
                        success: false,
                        error: "Invalid or expired token",
                    });
                    return;
                }
                const payload = validation.payload;
                const customerId = payload.customerId || validation.data.customerId;
                const workspaceId = validation.data.workspaceId;
                // 🎯 TASK: Clean up orphaned cart items before retrieving cart
                yield this.cleanupOrphanedCartItems(workspaceId);
                // Try to get existing cart by cartId (if available) or find/create cart for customer
                let cart = null;
                if (payload.cartId) {
                    // Token has specific cartId
                    cart = yield prisma_1.prisma.carts.findFirst({
                        where: {
                            id: payload.cartId,
                            customerId: customerId,
                            workspaceId: workspaceId,
                        },
                        include: {
                            items: {
                                include: {
                                    product: {
                                        select: {
                                            id: true,
                                            name: true,
                                            sku: true,
                                            price: true,
                                            description: true,
                                            formato: true,
                                            imageUrl: true,
                                        },
                                    },
                                    service: true,
                                },
                            },
                            customer: true,
                        },
                    });
                }
                else {
                    // Token doesn't have cartId (e.g., checkout token), find or create cart for customer
                    cart = yield prisma_1.prisma.carts.findFirst({
                        where: {
                            customerId: customerId,
                            workspaceId: workspaceId,
                        },
                        include: {
                            items: {
                                include: {
                                    product: {
                                        select: {
                                            id: true,
                                            name: true,
                                            sku: true,
                                            price: true,
                                            description: true,
                                            formato: true,
                                            imageUrl: true,
                                        },
                                    },
                                    service: true,
                                },
                            },
                            customer: true,
                        },
                    });
                    // If no cart exists, create one
                    if (!cart) {
                        logger_1.default.info(`🛒 Creating new cart for customer ${customerId} in workspace ${workspaceId}`);
                        cart = yield prisma_1.prisma.carts.create({
                            data: {
                                customerId: customerId,
                                workspaceId: workspaceId,
                            },
                            include: {
                                items: {
                                    include: {
                                        product: {
                                            select: {
                                                id: true,
                                                name: true,
                                                sku: true,
                                                price: true,
                                                description: true,
                                                formato: true,
                                                imageUrl: true,
                                            },
                                        },
                                        service: true,
                                    },
                                },
                                customer: true,
                            },
                        });
                    }
                }
                if (!cart) {
                    res.status(400).json({
                        success: false,
                        error: "Cart not found",
                    });
                    return;
                }
                logger_1.default.info(`🛒 Cart found with ${cart.items.length} items:`, cart.items.map((item) => ({
                    id: item.id,
                    itemType: item.itemType,
                    productId: item.productId,
                    serviceId: item.serviceId,
                })));
                // Get customer discount
                const customerDiscount = ((_a = cart.customer) === null || _a === void 0 ? void 0 : _a.discount) || 0;
                // Calculate updated totals with discounts
                let totalAmount = 0;
                const items = [];
                for (const item of cart.items) {
                    // Handle PRODUCT items
                    if (item.itemType === "PRODUCT") {
                        // 🎯 TASK: Handle missing product gracefully
                        if (!item.product) {
                            logger_1.default.warn(`⚠️ Cart item ${item.id} has missing product (productId: ${item.productId})`);
                            items.push({
                                id: item.id,
                                type: "product",
                                itemType: "PRODUCT",
                                productId: item.productId,
                                sku: "N/A",
                                name: `Product ${item.productId} (Not Found)`,
                                originalPrice: 0,
                                finalPrice: 0,
                                discountAmount: 0,
                                appliedDiscount: 0,
                                quantity: item.quantity,
                                total: 0,
                                imageUrl: [], // No image for missing product
                            });
                            continue;
                        }
                        // 🚀 Use helper method to calculate pricing with discounts
                        const pricing = yield this.calculateProductItemPrice(item, validation.data.workspaceId, customerDiscount);
                        totalAmount += pricing.itemTotal;
                        items.push({
                            id: item.id,
                            type: "product",
                            itemType: "PRODUCT",
                            productId: item.productId,
                            sku: item.product.sku || item.productId,
                            name: item.product.formato
                                ? `${item.product.name} ${item.product.formato}`
                                : item.product.name || `Product ${item.productId}`,
                            formato: item.product.formato || null,
                            originalPrice: pricing.originalPrice,
                            finalPrice: pricing.finalPrice,
                            discountAmount: pricing.discountAmount,
                            appliedDiscount: pricing.appliedDiscount,
                            quantity: item.quantity,
                            total: pricing.itemTotal,
                            imageUrl: item.product.imageUrl || [], // Add product images
                        });
                    }
                    // Handle SERVICE items
                    else if (item.itemType === "SERVICE") {
                        if (!item.service) {
                            logger_1.default.warn(`⚠️ Cart item ${item.id} has missing service (serviceId: ${item.serviceId})`);
                            items.push({
                                id: item.id,
                                type: "service",
                                itemType: "SERVICE",
                                serviceId: item.serviceId,
                                serviceCode: "N/A",
                                name: `Service ${item.serviceId} (Not Found)`,
                                originalPrice: 0,
                                finalPrice: 0,
                                discountAmount: 0,
                                appliedDiscount: 0,
                                quantity: item.quantity,
                                notes: item.notes || null,
                                total: 0,
                                imageUrl: [], // No image for missing service
                            });
                            continue;
                        }
                        // 🚀 Use helper method to calculate service pricing (no discounts)
                        const pricing = this.calculateServiceItemPrice(item);
                        totalAmount += pricing.itemTotal;
                        items.push({
                            id: item.id,
                            type: "service",
                            itemType: "SERVICE",
                            serviceId: item.serviceId,
                            serviceCode: item.service.code || item.serviceId,
                            name: item.service.name || `Service ${item.serviceId}`,
                            description: item.service.description || null,
                            duration: item.service.duration || null,
                            originalPrice: pricing.originalPrice,
                            finalPrice: pricing.finalPrice,
                            discountAmount: 0, // Services NEVER have discount amount
                            appliedDiscount: 0, // Services NEVER have applied discount
                            quantity: item.quantity,
                            notes: item.notes || null,
                            total: pricing.itemTotal,
                            imageUrl: item.service.imageUrl || [], // Add service images
                        });
                    }
                }
                // 🚀 KISS: Return format compatible with CheckoutPage frontend
                res.json({
                    success: true,
                    data: {
                        id: cart.id,
                        customerId: cart.customerId,
                        workspaceId: validation.data.workspaceId,
                        items,
                        totalItems: items.length,
                        subtotal: totalAmount,
                        totalDiscount: 0,
                        finalTotal: totalAmount,
                        lastUpdated: cart.updatedAt,
                        createdAt: cart.createdAt,
                    },
                    // 🎯 Frontend expects these fields for CheckoutPage compatibility
                    customer: {
                        id: cart.customer.id,
                        name: cart.customer.name,
                        email: cart.customer.email,
                        phone: cart.customer.phone,
                        address: cart.customer.address, // Include address for frontend
                        company: cart.customer.company, // Include company for frontend
                        language: cart.customer.language, // 🌐 Include language for translations
                    },
                    prodotti: items.map((item) => ({
                        id: item.id,
                        itemType: item.itemType, // 🎯 CRITICAL: Include itemType (PRODUCT or SERVICE)
                        productId: item.productId || null,
                        serviceId: item.serviceId || null,
                        codice: item.itemType === "PRODUCT" ? item.sku : item.serviceCode, // Use correct code based on type
                        descrizione: item.name,
                        formato: item.formato || null, // Only products have formato
                        duration: item.duration || null, // Only services have duration
                        notes: item.notes || null, // Only services have notes
                        quantita: item.quantity,
                        prezzo: item.originalPrice,
                        prezzoScontato: item.finalPrice,
                        sconto: item.appliedDiscount,
                        totale: item.total,
                    })),
                });
            }
            catch (error) {
                logger_1.default.error("[CART] Error getting cart by token:", error);
                res.status(500).json({
                    success: false,
                    error: "Internal server error",
                });
            }
        });
    }
    /**
     * Add item to cart by token
     */
    addItemToCart(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            try {
                const token = req.params.token;
                const { productId, serviceId, quantity = 1, notes, itemType = "PRODUCT", } = req.body;
                // Validate that either productId or serviceId is provided
                if (!productId && !serviceId) {
                    res.status(400).json({
                        success: false,
                        error: "Either productId or serviceId is required",
                    });
                    return;
                }
                // Validate itemType matches the provided ID
                if (itemType === "PRODUCT" && !productId) {
                    res.status(400).json({
                        success: false,
                        error: "productId is required when itemType is PRODUCT",
                    });
                    return;
                }
                if (itemType === "SERVICE" && !serviceId) {
                    res.status(400).json({
                        success: false,
                        error: "serviceId is required when itemType is SERVICE",
                    });
                    return;
                }
                const validation = yield this.secureTokenService.validateToken(token); // 🚀 KISS: Solo esistenza + non scaduto
                if (!validation.valid || !validation.payload) {
                    res.status(400).json({
                        success: false,
                        error: "Invalid or expired token",
                    });
                    return;
                }
                const payload = validation.payload;
                const customerId = payload.customerId || validation.data.customerId;
                const workspaceId = validation.data.workspaceId;
                // Get or create cart (following same logic as getCartByToken)
                let cart = yield prisma_1.prisma.carts.findFirst({
                    where: {
                        id: payload.cartId,
                        customerId: customerId,
                        workspaceId: workspaceId,
                    },
                });
                // If cart with specific ID not found, try to find or create cart for customer
                if (!cart) {
                    cart = yield prisma_1.prisma.carts.findFirst({
                        where: {
                            customerId: customerId,
                            workspaceId: workspaceId,
                        },
                    });
                    // If no cart exists for customer, create one
                    if (!cart) {
                        logger_1.default.info(`🛒 Creating new cart for customer ${customerId} in workspace ${workspaceId}`);
                        cart = yield prisma_1.prisma.carts.create({
                            data: {
                                customerId: customerId,
                                workspaceId: workspaceId,
                            },
                        });
                    }
                }
                // Verify product or service exists
                if (itemType === "PRODUCT" && productId) {
                    const product = yield prisma_1.prisma.products.findFirst({
                        where: {
                            id: productId,
                            workspaceId: validation.data.workspaceId,
                            isActive: true,
                        },
                    });
                    if (!product) {
                        res.status(400).json({
                            success: false,
                            error: "Product not found",
                        });
                        return;
                    }
                }
                else if (itemType === "SERVICE" && serviceId) {
                    const service = yield prisma_1.prisma.services.findFirst({
                        where: {
                            id: serviceId,
                            workspaceId: validation.data.workspaceId,
                        },
                    });
                    if (!service) {
                        res.status(400).json({
                            success: false,
                            error: "Service not found",
                        });
                        return;
                    }
                }
                // Check if item already exists in cart
                const existingCartItem = yield prisma_1.prisma.cartItems.findFirst({
                    where: Object.assign(Object.assign({ cartId: cart.id }, (itemType === "PRODUCT"
                        ? { productId: productId }
                        : { serviceId: serviceId })), { itemType: itemType }),
                });
                let cartItem;
                if (existingCartItem) {
                    // Update quantity
                    cartItem = yield prisma_1.prisma.cartItems.update({
                        where: { id: existingCartItem.id },
                        data: Object.assign({ quantity: existingCartItem.quantity + quantity }, (notes ? { notes } : {})),
                        include: {
                            product: true,
                            service: true,
                        },
                    });
                }
                else {
                    // Create new cart item
                    const createData = Object.assign(Object.assign(Object.assign(Object.assign({ cartId: cart.id, itemType: itemType }, (productId ? { productId } : {})), (serviceId ? { serviceId } : {})), { quantity }), (notes ? { notes } : {}));
                    logger_1.default.info(`🔨 Creating cart item with data:`, createData);
                    cartItem = yield prisma_1.prisma.cartItems.create({
                        data: createData,
                        include: {
                            product: true,
                            service: true,
                        },
                    });
                    logger_1.default.info(`✅ Cart item created:`, {
                        id: cartItem.id,
                        itemType: cartItem.itemType,
                        productId: cartItem.productId,
                        serviceId: cartItem.serviceId,
                        hasProduct: !!cartItem.product,
                        hasService: !!cartItem.service,
                    });
                }
                // Calculate cart totals
                const cartWithItems = yield prisma_1.prisma.carts.findFirst({
                    where: { id: cart.id },
                    include: {
                        items: {
                            include: {
                                product: true,
                                service: true,
                            },
                        },
                    },
                });
                const totalAmount = this.calculateCartTotal(cartWithItems.items);
                logger_1.default.info(`[CART] Item added to cart ${cart.id} via token - ${itemType}: ${productId || serviceId}`);
                res.json({
                    success: true,
                    cartItem: {
                        id: cartItem.id,
                        type: itemType.toLowerCase(), // Use actual itemType (product or service)
                        itemType: itemType, // Include full itemType for frontend
                        name: itemType === "PRODUCT"
                            ? ((_a = cartItem.product) === null || _a === void 0 ? void 0 : _a.name) || `Product ${cartItem.productId}`
                            : ((_b = cartItem.service) === null || _b === void 0 ? void 0 : _b.name) || `Service ${cartItem.serviceId}`,
                        formato: itemType === "PRODUCT" ? ((_c = cartItem.product) === null || _c === void 0 ? void 0 : _c.formato) || null : null,
                        duration: itemType === "SERVICE" ? ((_d = cartItem.service) === null || _d === void 0 ? void 0 : _d.duration) || null : null,
                        notes: cartItem.notes || null,
                        price: itemType === "PRODUCT"
                            ? ((_e = cartItem.product) === null || _e === void 0 ? void 0 : _e.price) || 0
                            : ((_f = cartItem.service) === null || _f === void 0 ? void 0 : _f.price) || 0,
                        quantity: cartItem.quantity,
                        total: itemType === "PRODUCT"
                            ? (((_g = cartItem.product) === null || _g === void 0 ? void 0 : _g.price) || 0) * cartItem.quantity
                            : (((_h = cartItem.service) === null || _h === void 0 ? void 0 : _h.price) || 0) * cartItem.quantity,
                    },
                    cart: {
                        totalAmount: totalAmount,
                        itemCount: cartWithItems.items.length,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("[CART] Error adding item to cart:", error);
                res.status(500).json({
                    success: false,
                    error: "Internal server error",
                });
            }
        });
    }
    /**
     * Update cart item by token
     */
    updateCartItem(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g;
            try {
                const token = req.params.token;
                const itemId = req.params.productId; // Keep param name for backwards compatibility
                const { quantity, itemType = "PRODUCT" } = req.body;
                logger_1.default.info(`[CART] UPDATE ITEM - Token: ${token === null || token === void 0 ? void 0 : token.substring(0, 10)}..., ItemId: ${itemId}, ItemType: ${itemType}, Quantity: ${quantity}`);
                if (quantity === undefined) {
                    res.status(400).json({
                        success: false,
                        error: "quantity is required",
                    });
                    return;
                }
                const validation = yield this.secureTokenService.validateToken(token); // 🚀 KISS: Solo esistenza + non scaduto
                if (!validation.valid || !validation.payload) {
                    res.status(400).json({
                        success: false,
                        error: "Invalid or expired token",
                    });
                    return;
                }
                const payload = validation.payload;
                const customerId = payload.customerId || validation.data.customerId;
                const workspaceId = validation.data.workspaceId;
                // Find the cart for this customer/token (same logic as getCartByToken)
                let cart = null;
                if (payload.cartId) {
                    // Token has specific cartId - look for that cart first
                    cart = yield prisma_1.prisma.carts.findFirst({
                        where: {
                            id: payload.cartId,
                            customerId: customerId,
                            workspaceId: workspaceId,
                        },
                    });
                }
                if (!cart) {
                    // If no specific cart found, look for any cart for this customer
                    cart = yield prisma_1.prisma.carts.findFirst({
                        where: {
                            customerId: customerId,
                            workspaceId: workspaceId,
                        },
                    });
                }
                if (!cart) {
                    logger_1.default.error("[CART] UPDATE - Cart not found");
                    res.status(400).json({
                        success: false,
                        error: "Cart not found",
                    });
                    return;
                }
                logger_1.default.info(`[CART] UPDATE - Cart found: ${cart.id}`);
                // Find cart item by productId or serviceId depending on itemType
                const cartItem = yield prisma_1.prisma.cartItems.findFirst({
                    where: Object.assign({ cartId: cart.id, itemType: itemType }, (itemType === "PRODUCT"
                        ? { productId: itemId }
                        : { serviceId: itemId })),
                    include: {
                        product: true,
                        service: true,
                    },
                });
                logger_1.default.info(`[CART] UPDATE - Cart item found: ${cartItem ? cartItem.id : "null"}`);
                if (!cartItem) {
                    logger_1.default.error(`[CART] UPDATE - Cart item not found for ${itemType}: ${itemId} in cart: ${cart.id}`);
                    res.status(400).json({
                        success: false,
                        error: "Cart item not found",
                    });
                    return;
                }
                logger_1.default.info(`[CART] UPDATE - Updating cart item ${cartItem.id} quantity from ${cartItem.quantity} to ${quantity}`);
                // Update cart item with explicit transaction
                const updatedCartItem = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    const updated = yield tx.cartItems.update({
                        where: { id: cartItem.id },
                        data: { quantity },
                        include: {
                            product: true,
                            service: true,
                        },
                    });
                    logger_1.default.info(`[CART] UPDATE - Transaction completed, updated quantity: ${updated.quantity}`);
                    return updated;
                }));
                logger_1.default.info(`[CART] UPDATE - Cart item updated successfully: ${updatedCartItem.id}, new quantity: ${updatedCartItem.quantity}`);
                // Calculate cart totals
                const cartWithItems = yield prisma_1.prisma.carts.findFirst({
                    where: { id: cart.id },
                    include: {
                        items: {
                            include: {
                                product: true,
                                service: true,
                            },
                        },
                    },
                });
                const totalAmount = this.calculateCartTotal(cartWithItems.items);
                logger_1.default.info(`[CART] Item ${cartItem.id} updated in cart ${cart.id} via token`);
                const itemData = updatedCartItem.itemType === "PRODUCT"
                    ? {
                        id: updatedCartItem.id,
                        type: "product",
                        itemType: "PRODUCT",
                        name: ((_a = updatedCartItem.product) === null || _a === void 0 ? void 0 : _a.name) ||
                            `Product ${updatedCartItem.productId}`,
                        formato: ((_b = updatedCartItem.product) === null || _b === void 0 ? void 0 : _b.formato) || null,
                        price: ((_c = updatedCartItem.product) === null || _c === void 0 ? void 0 : _c.price) || 0,
                    }
                    : {
                        id: updatedCartItem.id,
                        type: "service",
                        itemType: "SERVICE",
                        name: ((_d = updatedCartItem.service) === null || _d === void 0 ? void 0 : _d.name) ||
                            `Service ${updatedCartItem.serviceId}`,
                        description: ((_e = updatedCartItem.service) === null || _e === void 0 ? void 0 : _e.description) || null,
                        price: ((_f = updatedCartItem.service) === null || _f === void 0 ? void 0 : _f.price) || 0,
                    };
                res.json({
                    success: true,
                    cartItem: Object.assign(Object.assign({}, itemData), { quantity: updatedCartItem.quantity, total: (((_g = updatedCartItem.product) === null || _g === void 0 ? void 0 : _g.price) || 0) * updatedCartItem.quantity }),
                    cart: {
                        totalAmount: totalAmount,
                        itemCount: cartWithItems.items.length,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("[CART] Error updating cart item:", error);
                res.status(500).json({
                    success: false,
                    error: "Internal server error",
                });
            }
        });
    }
    /**
     * Remove item from cart by token
     */
    removeCartItem(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const token = req.params.token;
                const itemId = req.params.productId; // Keep param name for backwards compatibility
                const { itemType = "PRODUCT" } = req.body;
                const validation = yield this.secureTokenService.validateToken(token); // 🚀 KISS: Solo esistenza + non scaduto
                if (!validation.valid || !validation.payload) {
                    res.status(400).json({
                        success: false,
                        error: "Invalid or expired token",
                    });
                    return;
                }
                const payload = validation.payload;
                const customerId = payload.customerId || validation.data.customerId;
                const workspaceId = validation.data.workspaceId;
                // Find the cart for this customer/token (same logic as getCartByToken)
                let cart = null;
                if (payload.cartId) {
                    // Token has specific cartId - look for that cart first
                    cart = yield prisma_1.prisma.carts.findFirst({
                        where: {
                            id: payload.cartId,
                            customerId: customerId,
                            workspaceId: workspaceId,
                        },
                    });
                }
                if (!cart) {
                    // If no specific cart found, look for any cart for this customer
                    cart = yield prisma_1.prisma.carts.findFirst({
                        where: {
                            customerId: customerId,
                            workspaceId: workspaceId,
                        },
                    });
                }
                if (!cart) {
                    res.status(400).json({
                        success: false,
                        error: "Cart not found",
                    });
                    return;
                }
                // Find cart item by productId or serviceId
                const cartItem = yield prisma_1.prisma.cartItems.findFirst({
                    where: Object.assign({ cartId: cart.id, itemType: itemType }, (itemType === "PRODUCT"
                        ? { productId: itemId }
                        : { serviceId: itemId })),
                });
                if (!cartItem) {
                    res.status(400).json({
                        success: false,
                        error: "Cart item not found",
                    });
                    return;
                }
                // Remove cart item
                yield prisma_1.prisma.cartItems.delete({
                    where: { id: cartItem.id },
                });
                // Calculate cart totals
                const cartWithItems = yield prisma_1.prisma.carts.findFirst({
                    where: { id: payload.cartId },
                    include: {
                        items: {
                            include: {
                                product: true,
                                service: true,
                            },
                        },
                    },
                });
                const totalAmount = this.calculateCartTotal(cartWithItems.items);
                logger_1.default.info(`[CART] Item ${itemType} ${itemId} removed from cart ${cart.id} via token`);
                res.json({
                    success: true,
                    message: "Item removed from cart",
                    cart: {
                        totalAmount: totalAmount,
                        itemCount: cartWithItems.items.length,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("[CART] Error removing cart item:", error);
                res.status(500).json({
                    success: false,
                    error: "Internal server error",
                });
            }
        });
    }
    /**
     * Checkout cart by token
     */
    checkoutByToken(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const token = req.params.token;
                const { shippingAddress, paymentMethod = "CASH" } = req.body;
                const validation = yield this.secureTokenService.validateToken(token); // 🚀 KISS: Solo esistenza + non scaduto
                if (!validation.valid || !validation.payload) {
                    res.status(400).json({
                        success: false,
                        error: "Invalid or expired token",
                    });
                    return;
                }
                const payload = validation.payload;
                // Get cart with items
                const cart = yield prisma_1.prisma.carts.findFirst({
                    where: {
                        id: payload.cartId,
                        customerId: payload.customerId,
                        workspaceId: validation.data.workspaceId,
                    },
                    include: {
                        items: {
                            include: {
                                product: true,
                                service: true, // ✅ Include services
                            },
                        },
                        customer: true,
                    },
                });
                if (!cart || cart.items.length === 0) {
                    res.status(400).json({
                        success: false,
                        error: "Cart is empty or not found",
                    });
                    return;
                }
                const totalAmount = cart.items.reduce((sum, item) => {
                    // Handle PRODUCT items
                    if (item.itemType === "PRODUCT") {
                        if (!item.product) {
                            logger_1.default.warn(`⚠️ Cart item ${item.id} has missing product (productId: ${item.productId})`);
                            return sum;
                        }
                        return sum + (item.product.price || 0) * item.quantity;
                    }
                    // Handle SERVICE items
                    if (item.itemType === "SERVICE") {
                        if (!item.service) {
                            logger_1.default.warn(`⚠️ Cart item ${item.id} has missing service (serviceId: ${item.serviceId})`);
                            return sum;
                        }
                        return sum + (item.service.price || 0) * item.quantity;
                    }
                    return sum;
                }, 0);
                // Generate unique order code - 5 uppercase letters
                const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                let orderCode = "";
                for (let i = 0; i < 5; i++) {
                    orderCode += letters.charAt(Math.floor(Math.random() * letters.length));
                }
                // 🔒 TRANSACTION: Ensure order creation, customer update, and cart clearing are atomic
                // Prevents: duplicate orders if cart clear fails, orphan orders if customer update crashes
                const order = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    // 1️⃣ Create order with items
                    const newOrder = yield tx.orders.create({
                        data: {
                            orderCode,
                            customerId: cart.customerId,
                            workspaceId: validation.data.workspaceId,
                            totalAmount: totalAmount,
                            status: "PENDING",
                            paymentMethod: paymentMethod,
                            shippingAddress: shippingAddress || cart.customer.address,
                            items: {
                                create: cart.items.map((item) => {
                                    // Handle PRODUCT items
                                    if (item.itemType === "PRODUCT") {
                                        if (!item.product) {
                                            logger_1.default.warn(`⚠️ Cart item ${item.id} has missing product (productId: ${item.productId})`);
                                            return {
                                                itemType: "PRODUCT",
                                                productId: item.productId,
                                                quantity: item.quantity,
                                                unitPrice: 0,
                                                totalPrice: 0,
                                            };
                                        }
                                        return {
                                            itemType: "PRODUCT",
                                            productId: item.productId,
                                            quantity: item.quantity,
                                            unitPrice: item.product.price || 0,
                                            totalPrice: (item.product.price || 0) * item.quantity,
                                        };
                                    }
                                    // Handle SERVICE items
                                    if (item.itemType === "SERVICE") {
                                        if (!item.service) {
                                            logger_1.default.warn(`⚠️ Cart item ${item.id} has missing service (serviceId: ${item.serviceId})`);
                                            return {
                                                itemType: "SERVICE",
                                                serviceId: item.serviceId,
                                                quantity: item.quantity,
                                                unitPrice: 0,
                                                totalPrice: 0,
                                            };
                                        }
                                        return {
                                            itemType: "SERVICE",
                                            serviceId: item.serviceId,
                                            quantity: item.quantity,
                                            unitPrice: item.service.price || 0,
                                            totalPrice: (item.service.price || 0) * item.quantity,
                                        };
                                    }
                                    // Fallback for unknown item types
                                    logger_1.default.warn(`⚠️ Cart item ${item.id} has unknown itemType: ${item.itemType}`);
                                    return {
                                        itemType: "PRODUCT",
                                        productId: item.productId,
                                        quantity: item.quantity,
                                        unitPrice: 0,
                                        totalPrice: 0,
                                    };
                                }),
                            },
                        },
                        include: {
                            items: true,
                        },
                    });
                    // 2️⃣ Auto-update customer address in database (within transaction)
                    const hasValidShippingAddress = shippingAddress &&
                        shippingAddress.firstName &&
                        shippingAddress.lastName &&
                        shippingAddress.address &&
                        shippingAddress.city &&
                        shippingAddress.postalCode;
                    if (hasValidShippingAddress) {
                        // Create structured address object for customer
                        const customerAddress = {
                            name: `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim(),
                            street: shippingAddress.address,
                            city: shippingAddress.city,
                            postalCode: shippingAddress.postalCode,
                            province: shippingAddress.province || "",
                            country: shippingAddress.country || "Italy",
                            phone: shippingAddress.phone || cart.customer.phone || "",
                        };
                        yield tx.customers.update({
                            where: {
                                id: cart.customerId,
                                workspaceId: validation.data.workspaceId,
                            },
                            data: {
                                address: JSON.stringify(customerAddress),
                                updatedAt: new Date(),
                            },
                        });
                        logger_1.default.info(`[CART] Auto-updated customer address for ${cart.customerId}:`, customerAddress);
                    }
                    else {
                        logger_1.default.info(`[CART] No valid shipping address provided for customer ${cart.customerId}, using existing address`);
                    }
                    // 3️⃣ Clear cart items (within transaction)
                    yield tx.cartItems.deleteMany({
                        where: { cartId: cart.id },
                    });
                    return newOrder;
                }));
                // Invalidate token (optional since user might want to create new orders)
                // await this.secureTokenService.invalidateToken(token)
                logger_1.default.info(`[CART] Checkout completed for cart ${cart.id}, order ${order.id} created via token`);
                res.json({
                    success: true,
                    order: {
                        id: order.id,
                        orderCode: order.orderCode,
                        totalAmount: order.totalAmount,
                        status: order.status,
                        createdAt: order.createdAt,
                        itemCount: order.items.length,
                    },
                    message: "Checkout completed successfully",
                });
            }
            catch (error) {
                logger_1.default.error("[CART] Error during checkout:", error);
                res.status(500).json({
                    success: false,
                    error: "Internal server error",
                });
            }
        });
    }
    validateToken(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const token = req.query.token;
                if (!token) {
                    res.status(400).json({
                        valid: false,
                        error: "Token is required",
                    });
                    return;
                }
                const validation = yield this.secureTokenService.validateToken(token); // 🚀 KISS: Solo esistenza + non scaduto
                if (!validation.valid) {
                    res.status(400).json({
                        valid: false,
                        error: "Token non valido o scaduto",
                        errorType: "INVALID_TOKEN",
                    });
                    return;
                }
                const secureToken = validation.data;
                if (!validation.payload) {
                    res.status(400).json({
                        valid: false,
                        error: "Token corrotto",
                        errorType: "CORRUPTED_TOKEN",
                    });
                    return;
                }
                const payload = validation.payload;
                const customer = yield prisma_1.prisma.customers.findFirst({
                    where: {
                        id: payload.customerId,
                        workspaceId: secureToken.workspaceId,
                    },
                });
                if (!customer) {
                    res.status(400).json({
                        valid: false,
                        error: "Customer not found",
                    });
                    return;
                }
                logger_1.default.info(`[CART] Token validated for customer ${customer.id}`);
                res.json({
                    success: true,
                    data: {
                        id: payload.cartId,
                        customerId: customer.id,
                        workspaceId: secureToken.workspaceId,
                        items: (payload.items || []).map((item) => ({
                            id: item.id,
                            productId: item.productId || "",
                            sku: item.code,
                            productName: item.name,
                            quantity: item.quantity,
                            unitPrice: item.finalPrice,
                            totalPrice: item.total,
                            discountAmount: item.appliedDiscount
                                ? (item.originalPrice - item.finalPrice) * item.quantity
                                : 0,
                            finalPrice: item.finalPrice,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        })),
                        totalItems: (payload.items || []).reduce((sum, item) => sum + item.quantity, 0),
                        subtotal: payload.totalAmount,
                        totalDiscount: (payload.items || []).reduce((sum, item) => {
                            return (sum +
                                (item.appliedDiscount
                                    ? (item.originalPrice - item.finalPrice) * item.quantity
                                    : 0));
                        }, 0),
                        finalTotal: payload.totalAmount,
                        lastUpdated: new Date().toISOString(),
                        createdAt: payload.createdAt || new Date().toISOString(),
                    },
                });
            }
            catch (error) {
                logger_1.default.error("[CART] Error validating token:", error);
                res.status(500).json({
                    valid: false,
                    error: "Internal server error",
                });
            }
        });
    }
    /**
     * 💰 Calculate discounted price for a product
     * Used by admin panel when adding products to orders manually
     * Applies same discount logic as web cart (customer discount + active offers)
     */
    calculatePrice(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                const { productId, quantity = 1, customerId } = req.body;
                if (!productId) {
                    res.status(400).json({ error: "Product ID is required" });
                    return;
                }
                // Get product details
                const product = yield prisma_1.prisma.products.findFirst({
                    where: {
                        id: productId,
                        workspaceId: workspaceId,
                    },
                });
                if (!product) {
                    res.status(404).json({ error: "Product not found" });
                    return;
                }
                // Get customer discount if customerId provided
                let customerDiscount = 0;
                if (customerId) {
                    const customer = yield prisma_1.prisma.customers.findFirst({
                        where: {
                            id: customerId,
                            workspaceId: workspaceId,
                        },
                    });
                    if (customer) {
                        customerDiscount = customer.discount || 0;
                        logger_1.default.info(`[CART] Customer ${customer.name} has ${customerDiscount}% discount`);
                    }
                }
                // Calculate price with discounts (including customer discount)
                const priceService = new price_calculation_service_1.PriceCalculationService(prisma_1.prisma);
                logger_1.default.info(`[CART] Calculating price for product ${productId} in workspace ${workspaceId} with customer discount ${customerDiscount}%`);
                const result = yield priceService.calculatePricesWithDiscounts(workspaceId, [productId], customerDiscount);
                logger_1.default.info(`[CART] Price calculation result:`, JSON.stringify(result, null, 2));
                if (result.products.length === 0) {
                    res.status(404).json({ error: "Product pricing not found" });
                    return;
                }
                const productPricing = result.products[0];
                const originalPrice = product.price;
                const unitPrice = productPricing.finalPrice || originalPrice;
                const totalPrice = unitPrice * quantity;
                logger_1.default.info(`[CART] Final pricing - Original: ${originalPrice}, Unit: ${unitPrice}, Total: ${totalPrice}, Discount: ${productPricing.appliedDiscount}%`);
                // Build discount message if applicable
                let discountApplied = null;
                if (productPricing.appliedDiscount &&
                    productPricing.appliedDiscount > 0) {
                    discountApplied = `${productPricing.appliedDiscount}% off`;
                    if (productPricing.discountName) {
                        discountApplied += ` (${productPricing.discountName})`;
                    }
                }
                res.json({
                    productId,
                    productName: product.name,
                    quantity,
                    originalPrice,
                    unitPrice,
                    totalPrice,
                    discountApplied,
                    appliedDiscountPercent: productPricing.appliedDiscount || 0,
                });
            }
            catch (error) {
                logger_1.default.error("[CART] Error calculating price:", error);
                res.status(500).json({
                    error: "Failed to calculate price",
                    message: error.message,
                });
            }
        });
    }
}
exports.CartController = CartController;
//# sourceMappingURL=cart.controller.js.map