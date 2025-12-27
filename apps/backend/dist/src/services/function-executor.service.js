"use strict";
/**
 * FunctionExecutor
 *
 * Maps function calls from Router LLM to actual agent implementations.
 *
 * Responsibilities:
 * 1. Validate function names and parameters
 * 2. Execute the correct agent/repository method
 * 3. Handle errors gracefully
 * 4. Log all executions
 * 5. Return standardized results
 *
 * @architecture Clean Architecture - Dependency Injection
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
exports.FunctionExecutor = void 0;
const CartManagementAgent_1 = require("../application/agents/CartManagementAgent");
// NOTE: ProductSearchAgent removed - LLM uses {{products}} from prompt only
const cart_repository_1 = require("../repositories/cart.repository");
const order_repository_1 = require("../repositories/order.repository");
const product_repository_1 = require("../repositories/product.repository");
const service_repository_1 = require("../repositories/service.repository");
const contactOperator_1 = require("../domain/calling-functions/contactOperator");
const logger_1 = __importDefault(require("../utils/logger"));
class FunctionExecutor {
    constructor(prisma) {
        this.prisma = prisma;
        // Initialize repositories
        this.productRepo = new product_repository_1.ProductRepository();
        this.serviceRepo = new service_repository_1.ServiceRepository();
        this.cartRepo = new cart_repository_1.CartRepository();
        this.orderRepo = new order_repository_1.OrderRepository();
        // Initialize agents
        // NOTE: ProductSearchAgent removed - no database search needed
        this.cartManagementAgent = new CartManagementAgent_1.CartManagementAgent(this.cartRepo, this.productRepo, this.serviceRepo, this.orderRepo);
        logger_1.default.info("✅ FunctionExecutor initialized with all agents");
    }
    /**
     * Execute a function by name
     *
     * @param functionName - Name of function to execute
     * @param args - Function arguments (validated by caller)
     * @param context - Execution context (workspace, customer, etc.)
     * @returns FunctionResult with data or error
     */
    execute(functionName, args, context) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            try {
                logger_1.default.info(`⚙️ Executing function: ${functionName}`, {
                    workspaceId: context.workspaceId,
                    customerId: context.customerId,
                    args,
                });
                // Route to correct implementation
                let result;
                switch (functionName) {
                    // Delegation functions (Router → Sub-Agent)
                    case "productSearchAgent":
                        result = yield this.delegateToProductSearch(args, context);
                        break;
                    case "cartManagementAgent":
                        result = yield this.delegateToCartManagement(args, context);
                        break;
                    case "orderTrackingAgent":
                        result = yield this.delegateToOrderTracking(args, context);
                        break;
                    case "customerSupportAgent":
                        result = yield this.delegateToCustomerSupport(args, context);
                        break;
                    case "profileManagementAgent":
                        result = yield this.delegateToProfileManagement(args, context);
                        break;
                    // Direct function calls (Sub-Agents)
                    // NOTE: searchProducts removed - LLM uses {{products}} from prompt
                    case "addItemToCart":
                    case "addToCart": // backward compatibility
                        result = yield this.addToCart(args, context);
                        break;
                    case "viewCart":
                        result = yield this.viewCart(context);
                        break;
                    case "removeFromCart":
                        result = yield this.removeFromCart(args, context);
                        break;
                    case "updateCartItem":
                    case "updateCartQuantity": // backward compatibility
                        result = yield this.updateCartQuantity(args, context);
                        break;
                    case "clearCart":
                        result = yield this.clearCart(context);
                        break;
                    case "repeatLastOrder":
                        result = yield this.repeatLastOrder(context);
                        break;
                    // Order Tracking Functions (aligned naming)
                    case "getOrderHistory":
                        result = yield this.getOrderHistory(args, context);
                        break;
                    case "getLastOrders":
                        result = yield this.getLastOrders(args, context);
                        break;
                    case "getOrderDetails":
                        result = yield this.getOrderDetails(args, context);
                        break;
                    case "trackOrderStatus":
                        result = yield this.trackOrderStatus(args, context);
                        break;
                    // Backward compatibility aliases (deprecated)
                    case "getOrders":
                        logger_1.default.warn("⚠️ DEPRECATED: Use getOrderHistory instead of getOrders");
                        result = yield this.getOrderHistory(args, context);
                        break;
                    case "getOrder":
                        logger_1.default.warn("⚠️ DEPRECATED: Use getOrderDetails instead of getOrder");
                        result = yield this.getOrderDetails(args, context);
                        break;
                    case "trackOrder":
                        logger_1.default.warn("⚠️ DEPRECATED: Use trackOrderStatus instead of trackOrder");
                        result = yield this.trackOrderStatus(args, context);
                        break;
                    case "contactSupport":
                        result = yield this.contactSupport(args, context);
                        break;
                    default:
                        throw new Error(`Unknown function: ${functionName}`);
                }
                const executionTimeMs = Date.now() - startTime;
                logger_1.default.info(`✅ Function executed successfully: ${functionName}`, {
                    executionTimeMs,
                });
                return {
                    success: true,
                    data: result,
                    executionTimeMs,
                };
            }
            catch (error) {
                const executionTimeMs = Date.now() - startTime;
                logger_1.default.error(`❌ Function execution failed: ${functionName}`, {
                    error,
                    executionTimeMs,
                });
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    executionTimeMs,
                };
            }
        });
    }
    // NOTE: searchProducts method removed - LLM uses {{products}} from prompt only
    /**
     * Add product to cart
     */
    addToCart(args, context) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate required parameters
            if (!args.productId) {
                throw new Error("addToCart requires 'productId'");
            }
            if (!args.quantity || args.quantity <= 0) {
                throw new Error("addToCart requires 'quantity' > 0");
            }
            // Build cart context
            const cartContext = {
                workspaceId: context.workspaceId,
                customerId: context.customerId,
                customerName: context.customerName,
                language: context.customerLanguage,
                customerDiscount: context.customerDiscount,
            };
            // Execute via CartManagementAgent
            const result = yield this.cartManagementAgent.addToCart(cartContext, {
                productId: args.productId,
                quantity: args.quantity,
                notes: args.notes,
            });
            return result;
        });
    }
    /**
     * View cart contents
     */
    viewCart(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const cartContext = {
                workspaceId: context.workspaceId,
                customerId: context.customerId,
                customerName: context.customerName,
                language: context.customerLanguage,
                customerDiscount: context.customerDiscount,
            };
            const result = yield this.cartManagementAgent.getCart(cartContext);
            return result;
        });
    }
    /**
     * Remove item from cart
     */
    removeFromCart(args, context) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate required parameters
            if (!args.cartItemId) {
                throw new Error("removeFromCart requires 'cartItemId'");
            }
            const cartContext = {
                workspaceId: context.workspaceId,
                customerId: context.customerId,
                customerName: context.customerName,
                language: context.customerLanguage,
                customerDiscount: context.customerDiscount,
            };
            const result = yield this.cartManagementAgent.removeFromCart(cartContext, args.cartItemId);
            return result;
        });
    }
    /**
     * Update cart item quantity
     */
    updateCartQuantity(args, context) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate required parameters
            if (!args.cartItemId) {
                throw new Error("updateCartQuantity requires 'cartItemId'");
            }
            if (args.newQuantity === undefined || args.newQuantity < 0) {
                throw new Error("updateCartQuantity requires 'newQuantity' >= 0");
            }
            const cartContext = {
                workspaceId: context.workspaceId,
                customerId: context.customerId,
                customerName: context.customerName,
                language: context.customerLanguage,
                customerDiscount: context.customerDiscount,
            };
            const result = yield this.cartManagementAgent.updateQuantity(cartContext, {
                cartItemId: args.cartItemId,
                newQuantity: args.newQuantity,
            });
            return result;
        });
    }
    /**
     * Clear entire cart
     */
    clearCart(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const cartContext = {
                workspaceId: context.workspaceId,
                customerId: context.customerId,
                customerName: context.customerName,
                language: context.customerLanguage,
                customerDiscount: context.customerDiscount,
            };
            const result = yield this.cartManagementAgent.resetCart(cartContext);
            return result;
        });
    }
    /**
     * Repeat last order (copy items to cart)
     */
    repeatLastOrder(context) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get last order for customer
            const orders = yield this.orderRepo.findByCustomerId(context.customerId, context.workspaceId);
            if (!orders || orders.length === 0) {
                return {
                    success: false,
                    message: "No previous orders found",
                };
            }
            const lastOrder = orders[0];
            const cartContext = {
                workspaceId: context.workspaceId,
                customerId: context.customerId,
                customerName: context.customerName,
                language: context.customerLanguage,
                customerDiscount: context.customerDiscount,
            };
            const result = yield this.cartManagementAgent.repeatOrder(cartContext, {
                orderId: lastOrder.id,
            });
            return result;
        });
    }
    /**
     * Get customer complete order history
     */
    getOrderHistory(args, context) {
        return __awaiter(this, void 0, void 0, function* () {
            const limit = args.limit || 10;
            const orders = yield this.orderRepo.findByCustomerId(context.customerId, context.workspaceId);
            // Return limited orders with correct field mapping
            const limitedOrders = orders.slice(0, Math.min(limit, 50));
            // Map orders to include totalAmount explicitly for LLM consumption
            const mappedOrders = limitedOrders.map((order) => {
                var _a;
                return ({
                    orderCode: order.orderCode,
                    createdAt: order.createdAt,
                    totalAmount: order.totalAmount || 0, // ✅ Use totalAmount, not totalPrice
                    status: order.status,
                    itemCount: ((_a = order.items) === null || _a === void 0 ? void 0 : _a.length) || 0,
                });
            });
            return {
                success: true,
                orders: mappedOrders,
                total: orders.length,
                limit: limitedOrders.length,
            };
        });
    }
    /**
     * Get last N orders with summary details
     */
    getLastOrders(args, context) {
        return __awaiter(this, void 0, void 0, function* () {
            const limit = args.limit || 20;
            const orders = yield this.orderRepo.findByCustomerId(context.customerId, context.workspaceId);
            // Return only the first N orders (already sorted by date DESC)
            const limitedOrders = orders.slice(0, Math.min(limit, 50));
            return limitedOrders.map((order) => {
                var _a;
                return ({
                    orderCode: order.orderCode,
                    createdAt: order.createdAt,
                    totalAmount: order.totalAmount || 0, // ✅ Fixed: use totalAmount, not totalPrice
                    status: order.status,
                    itemCount: ((_a = order.items) === null || _a === void 0 ? void 0 : _a.length) || 0,
                });
            });
        });
    }
    /**
     * Get detailed information about a specific order
     */
    getOrderDetails(args, context) {
        return __awaiter(this, void 0, void 0, function* () {
            let order = null;
            // If orderCode provided, get specific order
            if (args.orderCode) {
                order = yield this.orderRepo.findByOrderCode(args.orderCode, context.workspaceId);
            }
            else {
                // If no orderCode, get last order
                const orders = yield this.orderRepo.findByCustomerId(context.customerId, context.workspaceId);
                order = orders && orders.length > 0 ? orders[0] : null;
            }
            if (!order) {
                return {
                    success: false,
                    message: args.orderCode
                        ? `Ordine ${args.orderCode} non trovato`
                        : "Nessun ordine trovato",
                };
            }
            return {
                success: true,
                order: order,
            };
        });
    }
    /**
     * Track order status
     */
    trackOrderStatus(args, context) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!args.orderCode) {
                return {
                    success: false,
                    error: "Order code required",
                    message: "Fornisci il codice ordine per il tracking",
                };
            }
            const order = yield this.orderRepo.findByOrderCode(args.orderCode, context.workspaceId);
            if (!order) {
                return {
                    success: false,
                    error: "Order not found",
                    message: `Ordine ${args.orderCode} non trovato`,
                };
            }
            return {
                success: true,
                order: order,
                status: order.status,
                trackingNumber: order.trackingNumber || null,
            };
        });
    }
    /**
     * Get customer orders (DEPRECATED - use getOrderHistory)
     * @deprecated Use getOrderHistory, getLastOrders, or getOrderDetails instead
     */
    getOrders(args, context) {
        return __awaiter(this, void 0, void 0, function* () {
            // Backward compatibility: delegate to new methods
            logger_1.default.warn("⚠️ DEPRECATED METHOD CALLED: getOrders - use getOrderHistory instead");
            if (args.orderId) {
                // Single order request → use getOrderDetails
                return this.getOrderDetails({ orderCode: args.orderId }, context);
            }
            // Multiple orders → use getOrderHistory
            return this.getOrderHistory(args, context);
        });
    }
    /**
     * Contact support (create ticket)
     */
    contactSupport(args, context) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info("📞 contactSupport CF called, invoking contactOperator.ts", {
                workspaceId: context.workspaceId,
                customerId: context.customerId,
                reason: args.reason,
                urgency: args.urgency,
            });
            // Get customer phone number to call contactOperator
            const customer = yield this.prisma.customers.findUnique({
                where: { id: context.customerId },
                select: { phone: true },
            });
            if (!customer) {
                throw new Error(`Customer not found: ${context.customerId}`);
            }
            // Call the actual contactOperator function
            const result = yield (0, contactOperator_1.contactOperator)({
                phoneNumber: customer.phone,
                workspaceId: context.workspaceId,
                customerId: context.customerId,
                reason: args.reason || "Customer requested operator assistance",
            });
            logger_1.default.info("✅ contactOperator completed", {
                success: result.success,
                customerId: context.customerId,
            });
            return result;
        });
    }
    /**
     * Validate function arguments against schema
     *
     * @param functionName - Function name
     * @param args - Arguments to validate
     * @returns Validation result
     */
    static validateArguments(functionName, args) {
        // Basic validation - can be extended with Zod schemas
        switch (functionName) {
            // NOTE: searchProducts validation removed - function disabled
            case "addItemToCart":
            case "addToCart":
                if (!args.productId && !args.items) {
                    return { valid: false, error: "addItemToCart requires 'productId' or 'items'" };
                }
                if (args.productId && (!args.quantity || args.quantity <= 0)) {
                    return {
                        valid: false,
                        error: "addItemToCart requires 'quantity' > 0",
                    };
                }
                break;
            case "removeFromCart":
                // Now uses sku/productName instead of cartItemId
                if (!args.cartItemId && !args.sku && !args.productName) {
                    return {
                        valid: false,
                        error: `removeFromCart requires 'sku' or 'productName'`,
                    };
                }
                break;
            case "updateCartItem":
            case "updateCartQuantity":
                if (args.newQuantity === undefined || args.newQuantity < 0) {
                    return {
                        valid: false,
                        error: `${functionName} requires 'newQuantity' >= 0`,
                    };
                }
                // Allow sku/productName or cartItemId
                if (!args.cartItemId && !args.sku && !args.productName) {
                    return {
                        valid: false,
                        error: `${functionName} requires 'sku', 'productName', or 'cartItemId'`,
                    };
                }
                break;
            case "contactSupport":
                if (!args.reason || !args.urgency) {
                    return {
                        valid: false,
                        error: "contactSupport requires 'reason' and 'urgency'",
                    };
                }
                break;
            // Functions with no required args
            case "viewCart":
            case "clearCart":
            case "repeatLastOrder":
            case "getOrderHistory":
            case "getLastOrders":
            case "getOrderDetails":
                // Optional arguments only
                break;
            case "trackOrderStatus":
                if (!args.orderCode) {
                    return {
                        valid: false,
                        error: "trackOrderStatus requires 'orderCode'",
                    };
                }
                break;
            // Deprecated functions (backward compatibility)
            case "getOrders":
            case "getOrder":
            case "trackOrder":
                // Allow deprecated functions but log warning
                logger_1.default.warn(`⚠️ DEPRECATED FUNCTION: ${functionName}`);
                break;
            case "getOrders":
                break;
            // Delegation functions
            case "productSearchAgent":
            case "cartManagementAgent":
            case "orderTrackingAgent":
            case "customerSupportAgent":
            case "profileManagementAgent":
                if (!args.query) {
                    return {
                        valid: false,
                        error: `${functionName} requires 'query' parameter`,
                    };
                }
                break;
            default:
                return { valid: false, error: `Unknown function: ${functionName}` };
        }
        return { valid: true };
    }
    /**
     * Delegation methods - Router → Sub-Agent
     * These methods signal that a sub-agent should be called
     */
    delegateToProductSearch(args, context) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info("🔍 Delegating to Product and Services Agent", {
                args,
                context,
            });
            // Return a special response that signals llm-router.service.ts to call Product and Services Agent
            return {
                delegateTo: "PRODUCT_SEARCH",
                query: args.query,
                message: `Delegating to Product and Services Agent for: ${args.query}`,
            };
        });
    }
    delegateToCartManagement(args, context) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info("🛒 Delegating to Cart Management Agent", { args, context });
            return {
                delegateTo: "CART_MANAGEMENT",
                query: args.query,
                message: `Delegating to Cart Management Agent for: ${args.query}`,
            };
        });
    }
    delegateToOrderTracking(args, context) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info("📦 Delegating to Order Tracking Agent", { args, context });
            return {
                delegateTo: "ORDER_TRACKING",
                query: args.query,
                message: `Delegating to Order Tracking Agent for: ${args.query}`,
            };
        });
    }
    delegateToCustomerSupport(args, context) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info("💬 Delegating to Customer Support Agent", { args, context });
            return {
                delegateTo: "CUSTOMER_SUPPORT",
                query: args.query,
                message: `Delegating to Customer Support Agent for: ${args.query}`,
            };
        });
    }
    delegateToProfileManagement(args, context) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info("👤 Delegating to Profile Management Agent", { args, context });
            return {
                delegateTo: "PROFILE_MANAGEMENT",
                query: args.query,
                message: `Delegating to Profile Management Agent for: ${args.query}`,
            };
        });
    }
}
exports.FunctionExecutor = FunctionExecutor;
//# sourceMappingURL=function-executor.service.js.map