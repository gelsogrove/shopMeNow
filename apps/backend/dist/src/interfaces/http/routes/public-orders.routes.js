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
const express_1 = require("express");
const secure_token_service_1 = require("../../../application/services/secure-token.service");
const rate_limiters_1 = require("../../../config/rate-limiters");
const prisma_1 = require("../../../lib/prisma");
const address_parser_1 = require("../../../utils/address-parser");
const logger_1 = __importDefault(require("../../../utils/logger"));
const token_validation_middleware_1 = require("../middlewares/token-validation.middleware");
const router = (0, express_1.Router)();
const secureTokenService = new secure_token_service_1.SecureTokenService();
// ========================================
// 🔧 HELPER: Get Orders List Handler
// ========================================
function getOrdersListHandler(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // 🔐 customerId and workspaceId are set by tokenValidationMiddleware
            const customerId = req.customerId;
            const workspaceId = req.workspaceId;
            const { status, payment, from, to } = req.query;
            logger_1.default.info(`[PUBLIC-ORDERS] Getting orders list for customer: ${customerId}`);
            const whereClause = {
                customerId: customerId,
                workspaceId: workspaceId,
            };
            if (status && status !== "ALL") {
                whereClause.status = status;
            }
            if (payment && payment !== "ALL") {
                whereClause.paymentMethod = payment;
            }
            if (from || to) {
                whereClause.createdAt = {};
                if (from)
                    whereClause.createdAt.gte = new Date(from);
                if (to)
                    whereClause.createdAt.lte = new Date(to);
            }
            const customer = yield prisma_1.prisma.customers.findUnique({
                where: { id: customerId },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    language: true,
                },
            });
            if (!customer) {
                return res.status(404).json({
                    success: false,
                    error: "Customer not found",
                });
            }
            const workspace = yield prisma_1.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { id: true, name: true },
            });
            const orders = yield prisma_1.prisma.orders.findMany({
                where: whereClause,
                include: {
                    items: {
                        select: {
                            quantity: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            });
            const formattedOrders = orders.map((order) => ({
                id: order.id,
                orderCode: order.orderCode,
                date: order.createdAt.toISOString(),
                status: order.status,
                paymentStatus: order.paymentMethod,
                totalAmount: order.totalAmount,
                taxAmount: order.taxAmount,
                shippingAmount: order.shippingAmount,
                itemsCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
                invoiceUrl: "",
                ddtUrl: "",
            }));
            return res.json({
                success: true,
                data: {
                    customer,
                    workspace,
                    orders: formattedOrders,
                },
            });
        }
        catch (error) {
            logger_1.default.error("[PUBLIC-ORDERS] Error getting orders list:", error);
            return res.status(500).json({
                success: false,
                error: "Error retrieving orders",
            });
        }
    });
}
/**
 * @swagger
 * /api/internal/validate-secure-token:
 *   post:
 *     tags:
 *       - Public Access
 *     summary: Validate secure token for public access (TOKEN-ONLY)
 *     description: Validates a secure token for public page access
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: Security token
 *               workspaceId:
 *                 type: string
 *                 description: Workspace ID (optional)
 *             required:
 *               - token
 *     responses:
 *       200:
 *         description: Token validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 payload:
 *                   type: object
 *       401:
 *         description: Invalid or expired token
 */
router.post("/validate-secure-token", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { token, workspaceId } = req.body;
        if (!token) {
            return res.status(400).json({
                valid: false,
                error: "Token is required",
            });
        }
        logger_1.default.info(`[TOKEN-VALIDATION] Validating token for workspace: ${workspaceId || "any"}`);
        // Use TOKEN-ONLY system - accept any valid token type
        const validation = yield secureTokenService.validateToken(token);
        if (!validation.valid) {
            return res.status(401).json({
                valid: false,
                error: "Invalid or expired token",
            });
        }
        // Optional workspace validation
        if (workspaceId && ((_a = validation.data) === null || _a === void 0 ? void 0 : _a.workspaceId) !== workspaceId) {
            return res.status(403).json({
                valid: false,
                error: "Token not authorized for this workspace",
            });
        }
        logger_1.default.info("[TOKEN-VALIDATION] ✅ Token validated successfully");
        return res.json({
            valid: true,
            data: validation.data,
            payload: validation.payload,
        });
    }
    catch (error) {
        logger_1.default.error("[TOKEN-VALIDATION] Error validating token:", error);
        return res.status(500).json({
            valid: false,
            error: "Error during token validation",
        });
    }
}));
/**
 * @swagger
 * /api/internal/public/orders:
 *   get:
 *     tags:
 *       - Public Orders
 *     summary: Get customer orders list (public access with token)
 *     description: Returns list of orders for a customer using a secure token
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Security token
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ALL, PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED]
 *         description: Filter by order status
 *       - in: query
 *         name: payment
 *         schema:
 *           type: string
 *           enum: [ALL, PAID, PENDING, FAILED, COMPLETED, DECLINED]
 *         description: Filter by payment status
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter orders from date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter orders to date
 *     responses:
 *       200:
 *         description: Orders list retrieved successfully
 *       401:
 *         description: Invalid or expired token
 */
// 🔒 SECURITY: Rate limited to 30 requests per 15 minutes per IP
router.get("/public/orders", rate_limiters_1.publicOrdersLimiter, token_validation_middleware_1.tokenValidationMiddleware, getOrdersListHandler);
// ✅ ALIAS: Frontend compatibility route
// 🔒 SECURITY: Rate limited to 30 requests per 15 minutes per IP
router.get("/orders-public", rate_limiters_1.publicOrdersLimiter, token_validation_middleware_1.tokenValidationMiddleware, getOrdersListHandler);
/**
 * @swagger
 * /api/internal/public/orders/{orderCode}:
 *   get:
 *     tags:
 *       - Public Orders
 *     summary: Get order details (public access with token)
 *     description: Returns detailed information for a specific order using a secure token
 *     parameters:
 *       - in: path
 *         name: orderCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Order code
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Security token
 *     responses:
 *       200:
 *         description: Order details retrieved successfully
 *       401:
 *         description: Invalid or expired token
 *       404:
 *         description: Order not found
 */
router.get("/public/orders/:orderCode", token_validation_middleware_1.tokenValidationMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 🔐 customerId and workspaceId are set by tokenValidationMiddleware
        const customerId = req.customerId;
        const workspaceId = req.workspaceId;
        const { orderCode } = req.params;
        logger_1.default.info(`[PUBLIC-ORDERS] Getting order details for: ${orderCode}`);
        // Get order with full details
        const order = yield prisma_1.prisma.orders.findFirst({
            where: {
                orderCode,
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
                customer: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        language: true,
                        address: true,
                        invoiceAddress: true,
                    },
                },
                workspace: {
                    select: { id: true, name: true },
                },
            },
        });
        if (!order) {
            return res.status(404).json({
                success: false,
                error: "Order not found",
            });
        }
        // Parse customer addresses using utility
        let parsedCustomer = Object.assign({}, order.customer);
        const invoiceResult = (0, address_parser_1.parseCustomerAddresses)(parsedCustomer.invoiceAddress);
        parsedCustomer.invoiceAddress = invoiceResult.success
            ? invoiceResult.addresses
            : null;
        const addressResult = (0, address_parser_1.parseCustomerAddresses)(parsedCustomer.address);
        parsedCustomer.address = addressResult.success
            ? addressResult.addresses
            : null;
        // Format order items with imageUrl
        const formattedItems = order.items.map((item) => {
            var _a, _b, _c, _d, _e, _f;
            return ({
                id: item.id,
                itemType: item.itemType,
                name: ((_a = item.product) === null || _a === void 0 ? void 0 : _a.name) || ((_b = item.service) === null || _b === void 0 ? void 0 : _b.name) || "Unknown Item",
                code: ((_c = item.product) === null || _c === void 0 ? void 0 : _c.productCode) || ((_d = item.service) === null || _d === void 0 ? void 0 : _d.code) || null,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                imageUrl: ((_e = item.product) === null || _e === void 0 ? void 0 : _e.imageUrl) || ((_f = item.service) === null || _f === void 0 ? void 0 : _f.imageUrl) || [],
            });
        });
        const formattedOrder = {
            id: order.id,
            orderCode: order.orderCode,
            date: order.createdAt.toISOString(),
            status: order.status,
            paymentStatus: order.paymentStatus,
            paymentMethod: order.paymentMethod,
            paymentProvider: null,
            shippingAmount: order.shippingAmount,
            taxAmount: order.taxAmount,
            shippingAddress: order.shippingAddress,
            trackingNumber: order.trackingNumber,
            totalAmount: order.totalAmount,
            items: formattedItems,
            invoiceUrl: "",
            ddtUrl: "",
        };
        return res.json({
            success: true,
            data: {
                order: formattedOrder,
                customer: parsedCustomer,
                workspace: order.workspace,
            },
        });
    }
    catch (error) {
        logger_1.default.error("[PUBLIC-ORDERS] Error getting order details:", error);
        return res.status(500).json({
            success: false,
            error: "Error retrieving order details",
        });
    }
}));
/**
 * @swagger
 * /api/internal/customer-profile/{token}:
 *   get:
 *     tags:
 *       - Public Profile
 *     summary: Get customer profile (public access with token)
 *     description: Returns customer profile information using a secure token
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Security token
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         description: Invalid or expired token
 *       404:
 *         description: Customer not found
 */
router.get("/customer-profile/:token", token_validation_middleware_1.tokenValidationMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 🔐 customerId and workspaceId are set by tokenValidationMiddleware
        const customerId = req.customerId;
        const workspaceId = req.workspaceId;
        logger_1.default.info(`[PUBLIC-PROFILE] Getting profile for customer: ${customerId}`);
        // Get customer profile
        const customer = yield prisma_1.prisma.customers.findFirst({
            where: {
                id: customerId,
                workspaceId: workspaceId,
                isActive: true,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                address: true,
                company: true,
                language: true,
                currency: true,
                discount: true,
                invoiceAddress: true,
                push_notifications_consent: true,
                push_notifications_consent_at: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!customer) {
            return res.status(404).json({
                success: false,
                error: "Customer not found",
            });
        }
        // Get workspace info
        const workspace = yield prisma_1.prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { id: true, name: true },
        });
        // Parse customer addresses using utility
        let parsedCustomer = Object.assign({}, customer);
        const invoiceResult = (0, address_parser_1.parseCustomerAddresses)(parsedCustomer.invoiceAddress);
        // Take first address from array (customer has single address)
        parsedCustomer.invoiceAddress = invoiceResult.success && invoiceResult.addresses.length > 0
            ? invoiceResult.addresses[0]
            : null;
        const addressResult = (0, address_parser_1.parseCustomerAddresses)(parsedCustomer.address);
        // Take first address from array (customer has single shipping address)
        parsedCustomer.address = addressResult.success && addressResult.addresses.length > 0
            ? addressResult.addresses[0]
            : null;
        return res.json({
            success: true,
            data: Object.assign(Object.assign({}, parsedCustomer), { workspace }),
        });
    }
    catch (error) {
        logger_1.default.error("[PUBLIC-PROFILE] Error getting customer profile:", error);
        return res.status(500).json({
            success: false,
            error: "Error retrieving profile",
        });
    }
}));
/**
 * @swagger
 * /api/internal/customer-profile/{token}:
 *   put:
 *     tags:
 *       - Public Profile
 *     summary: Update customer profile (public access with token)
 *     description: Updates customer profile information using a secure token
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Security token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Invalid or expired token
 *       404:
 *         description: Customer not found
 */
router.put("/customer-profile/:token", token_validation_middleware_1.tokenValidationMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 🔐 customerId and workspaceId are set by tokenValidationMiddleware
        const customerId = req.customerId;
        const workspaceId = req.workspaceId;
        const updateData = req.body;
        logger_1.default.info(`[PUBLIC-PROFILE] Updating profile for customer: ${customerId}`);
        // Update customer profile
        const updatedCustomer = yield prisma_1.prisma.customers.update({
            where: {
                id: customerId,
                workspaceId: workspaceId,
            },
            data: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (updateData.name && { name: updateData.name })), (updateData.email && { email: updateData.email })), (updateData.phone && { phone: updateData.phone })), (updateData.address && { address: updateData.address })), (updateData.company && { company: updateData.company })), (updateData.language && { language: updateData.language })), (updateData.currency && { currency: updateData.currency })), (updateData.invoiceAddress && {
                invoiceAddress: updateData.invoiceAddress,
            })), (typeof updateData.push_notifications_consent === 'boolean' && {
                push_notifications_consent: updateData.push_notifications_consent,
                push_notifications_consent_at: updateData.push_notifications_consent ? new Date() : null,
            })), { updatedAt: new Date() }),
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                address: true,
                company: true,
                language: true,
                currency: true,
                discount: true,
                invoiceAddress: true,
                push_notifications_consent: true,
                push_notifications_consent_at: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        // Parse customer addresses using utility
        let parsedCustomer = Object.assign({}, updatedCustomer);
        const invoiceResult = (0, address_parser_1.parseCustomerAddresses)(parsedCustomer.invoiceAddress);
        // Take first address from array (customer has single invoice address)
        parsedCustomer.invoiceAddress = invoiceResult.success && invoiceResult.addresses.length > 0
            ? invoiceResult.addresses[0]
            : null;
        const addressResult = (0, address_parser_1.parseCustomerAddresses)(parsedCustomer.address);
        // Take first address from array (customer has single shipping address)
        parsedCustomer.address = addressResult.success && addressResult.addresses.length > 0
            ? addressResult.addresses[0]
            : null;
        return res.json({
            success: true,
            data: parsedCustomer,
            message: "Profile updated successfully",
        });
    }
    catch (error) {
        logger_1.default.error("[PUBLIC-PROFILE] Error updating customer profile:", error);
        return res.status(500).json({
            success: false,
            error: "Error updating profile",
        });
    }
}));
/**
 * @swagger
 * /api/internal/get-all-products:
 *   post:
 *     tags:
 *       - Public Access
 *     summary: Get all products with discounts applied for a customer (TOKEN REQUIRED)
 *     description: Returns all active products with customer-specific discounts applied using secure token validation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: Security token containing workspaceId and customerId
 *             required:
 *               - token
 *     responses:
 *       200:
 *         description: List of products with discounts applied
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     products:
 *                       type: array
 *                       items:
 *                         type: object
 *                     customerDiscount:
 *                       type: number
 *                     totalProducts:
 *                       type: number
 *       400:
 *         description: Missing token
 *       401:
 *         description: Invalid or expired token
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Internal server error
 */
router.post("/get-all-products", rate_limiters_1.publicOrdersLimiter, token_validation_middleware_1.tokenValidationMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // � customerId and workspaceId are set by tokenValidationMiddleware
        const customerId = req.customerId;
        const workspaceId = req.workspaceId;
        logger_1.default.info("[GET-ALL-PRODUCTS] Request with validated token:", {
            workspaceId,
            customerId,
        });
        // Get customer to fetch their discount
        const customer = yield prisma_1.prisma.customers.findFirst({
            where: {
                id: customerId,
                workspaceId: workspaceId,
                isActive: true,
            },
        });
        if (!customer) {
            return res.status(404).json({
                success: false,
                error: "Customer not found",
            });
        }
        const customerDiscount = customer.discount || 0;
        logger_1.default.info("[GET-ALL-PRODUCTS] Customer discount:", customerDiscount);
        // Get all active products for the workspace
        const products = yield prisma_1.prisma.products.findMany({
            where: {
                workspaceId: workspaceId,
                isActive: true,
                status: "ACTIVE",
            },
            select: {
                id: true,
                name: true,
                sku: true,
                description: true,
                price: true,
                stock: true,
                isActive: true,
                imageUrl: true,
                formato: true,
                category: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                createdAt: true,
                updatedAt: true,
            },
            orderBy: [
                {
                    category: {
                        name: "asc",
                    },
                },
                {
                    name: "asc",
                },
            ],
        });
        // Apply customer discount to all products
        const productsWithDiscounts = products.map((product) => {
            const originalPrice = product.price;
            const discountAmount = originalPrice * (customerDiscount / 100);
            const finalPrice = originalPrice - discountAmount;
            const appliedDiscount = customerDiscount > 0 ? customerDiscount : 0;
            return {
                id: product.id,
                name: product.name,
                sku: product.sku,
                description: product.description,
                formato: product.formato || null,
                price: originalPrice,
                originalPrice: originalPrice,
                finalPrice: finalPrice,
                appliedDiscount: appliedDiscount,
                discount: customerDiscount,
                stock: product.stock,
                isActive: product.isActive,
                imageUrl: product.imageUrl || [],
                category: product.category
                    ? {
                        id: product.category.id,
                        name: product.category.name,
                    }
                    : null,
                createdAt: product.createdAt,
                updatedAt: product.updatedAt,
            };
        });
        logger_1.default.info("[GET-ALL-PRODUCTS] Returning products:", {
            count: productsWithDiscounts.length,
            customerDiscount,
        });
        return res.json({
            success: true,
            data: {
                products: productsWithDiscounts,
                customerDiscount: customerDiscount,
                totalProducts: productsWithDiscounts.length,
            },
        });
    }
    catch (error) {
        logger_1.default.error("[GET-ALL-PRODUCTS] Error fetching products:", error);
        return res.status(500).json({
            success: false,
            error: "Internal server error while fetching products",
        });
    }
}));
// ========================================
// 🔄 ADDITIONAL ROUTE ALIAS for GET /:orderCode
// ========================================
// Note: GET /orders-public is already added above after GET /public/orders handler
/**
 * Alias: GET /orders-public/:orderCode
 * Same handler as GET /public/orders/:orderCode
 * 🔒 SECURITY: Rate limited to 30 requests per 15 minutes per IP
 */
router.get("/orders-public/:orderCode", rate_limiters_1.publicOrdersLimiter, token_validation_middleware_1.tokenValidationMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 🔐 customerId and workspaceId are set by tokenValidationMiddleware
        const customerId = req.customerId;
        const workspaceId = req.workspaceId;
        const { orderCode } = req.params;
        if (!customerId || !workspaceId) {
            return res.status(401).json({
                success: false,
                error: "Token does not contain valid customer information",
            });
        }
        logger_1.default.info(`[PUBLIC-ORDERS] Getting order details for: ${orderCode}`);
        const order = yield prisma_1.prisma.orders.findFirst({
            where: {
                orderCode,
                customerId: customerId,
                workspaceId: workspaceId,
            },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                name: true,
                                sku: true,
                            },
                        },
                        service: {
                            select: {
                                name: true,
                                code: true,
                            },
                        },
                    },
                },
                customer: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        language: true,
                        address: true,
                        invoiceAddress: true,
                    },
                },
                workspace: {
                    select: { id: true, name: true },
                },
            },
        });
        if (!order) {
            return res.status(404).json({
                success: false,
                error: "Order not found",
            });
        }
        let parsedCustomer = Object.assign({}, order.customer);
        const invoiceResult = (0, address_parser_1.parseCustomerAddresses)(parsedCustomer.invoiceAddress);
        parsedCustomer.invoiceAddress = invoiceResult.success
            ? invoiceResult.addresses
            : null;
        const addressResult = (0, address_parser_1.parseCustomerAddresses)(parsedCustomer.address);
        parsedCustomer.address = addressResult.success
            ? addressResult.addresses
            : null;
        const formattedItems = order.items.map((item) => {
            var _a, _b, _c, _d;
            return ({
                id: item.id,
                itemType: item.itemType,
                name: ((_a = item.product) === null || _a === void 0 ? void 0 : _a.name) || ((_b = item.service) === null || _b === void 0 ? void 0 : _b.name) || "Unknown Item",
                code: ((_c = item.product) === null || _c === void 0 ? void 0 : _c.sku) || ((_d = item.service) === null || _d === void 0 ? void 0 : _d.code) || null,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
            });
        });
        const formattedOrder = {
            id: order.id,
            orderCode: order.orderCode,
            date: order.createdAt.toISOString(),
            status: order.status,
            paymentStatus: order.paymentStatus,
            paymentMethod: order.paymentMethod,
            paymentProvider: null,
            shippingAmount: order.shippingAmount,
            taxAmount: order.taxAmount,
            shippingAddress: order.shippingAddress,
            trackingNumber: order.trackingNumber,
            totalAmount: order.totalAmount,
            items: formattedItems,
            invoiceUrl: "",
            ddtUrl: "",
        };
        return res.json({
            success: true,
            data: {
                customer: parsedCustomer,
                workspace: order.workspace,
                order: formattedOrder,
            },
        });
    }
    catch (error) {
        logger_1.default.error("[PUBLIC-ORDERS] Error getting order details:", error);
        return res.status(500).json({
            success: false,
            error: "Error retrieving order",
        });
    }
}));
logger_1.default.info("✅ Added /orders-public/:orderCode route alias for frontend compatibility");
exports.default = router;
//# sourceMappingURL=public-orders.routes.js.map