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
exports.CallingFunctionsService = void 0;
const config_1 = require("../config");
const link_generator_service_1 = require("../application/services/link-generator.service");
const link_replacement_service_1 = require("../application/services/link-replacement.service");
const price_calculation_service_1 = require("../application/services/price-calculation.service");
const secure_token_service_1 = require("../application/services/secure-token.service");
const logger_1 = __importDefault(require("../utils/logger"));
const database_1 = require("@echatbot/database");
class CallingFunctionsService {
    constructor(linkGeneratorService) {
        this.secureTokenService = new secure_token_service_1.SecureTokenService();
        this.linkGeneratorService =
            linkGeneratorService || new link_generator_service_1.LinkGeneratorService();
        this.baseUrl = "http://localhost:3001/api/internal";
    }
    createErrorResponse(error, context) {
        var _a, _b;
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const details = ((_b = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || errorMessage;
        logger_1.default.error(`❌ ${context} error:`, error);
        return {
            success: false,
            error: errorMessage,
            message: `Unable to ${context.toLowerCase()}. Please try again later.`,
            details: details,
            timestamp: new Date().toISOString(),
        };
    }
    createSuccessResponse(data, context) {
        logger_1.default.info(`✅ ${context} response:`, data);
        return {
            success: true,
            data: data,
            timestamp: new Date().toISOString(),
        };
    }
    getServices(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🔧 Calling getServices with:", request);
                // Direct database query with Prisma for complete services list
                // Get all services, ordered by name alphabetically
                const services = yield database_1.prisma.services.findMany({
                    where: {
                        workspaceId: request.workspaceId,
                        isActive: true,
                    },
                    orderBy: { name: "asc" },
                });
                yield database_1.prisma.$disconnect();
                if (!services || services.length === 0) {
                    return {
                        success: false,
                        error: "Nessun servizio disponibile",
                        message: "Nessun servizio disponibile",
                        timestamp: new Date().toISOString(),
                    };
                }
                logger_1.default.info("✅ Services found:", services.length);
                return {
                    success: true,
                    data: {
                        services: services.map((service) => ({
                            code: service.code,
                            name: service.name,
                            description: service.description,
                            price: service.price,
                        })),
                        totalServices: services.length,
                    },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                logger_1.default.error("❌ Error in getServices:", error);
                return this.createErrorResponse(error, "getServices");
            }
        });
    }
    getOrdersListLink(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🔧 Calling getOrdersListLink with:", request);
                logger_1.default.info("🔧 SecureTokenService instance:", !!this.secureTokenService);
                // If orderCode is specified, validate it exists in database
                if (request.orderCode) {
                    try {
                        logger_1.default.info("🔍 Checking if order exists in database:", request.orderCode);
                        // Import Prisma client
                        // Query the database for the order
                        const order = yield database_1.prisma.orders.findFirst({
                            where: {
                                orderCode: request.orderCode,
                                workspaceId: request.workspaceId,
                            },
                        });
                        yield database_1.prisma.$disconnect();
                        if (!order) {
                            logger_1.default.info("❌ Order not found in database:", request.orderCode);
                            return {
                                success: false,
                                error: `Ordine non trovato`,
                                message: `Ordine non trovato`,
                                timestamp: new Date().toISOString(),
                            };
                        }
                        logger_1.default.info("✅ Order found in database:", request.orderCode);
                    }
                    catch (dbError) {
                        logger_1.default.info("❌ Database error while checking order:", dbError);
                        return {
                            success: false,
                            error: `Ordine non trovato`,
                            message: `Ordine non trovato`,
                            timestamp: new Date().toISOString(),
                        };
                    }
                }
                logger_1.default.info("🔧 About to create token...");
                const token = yield this.secureTokenService.createToken("orders", request.workspaceId, { customerId: request.customerId }, undefined, // Uses TOKEN_EXPIRATION from env
                undefined, undefined, undefined, request.customerId);
                logger_1.default.info("🔧 Token created successfully:", token);
                // Use the injected linkGeneratorService instance
                const linkUrl = yield this.linkGeneratorService.generateOrdersLink(token, request.workspaceId, request.orderCode);
                return {
                    success: true,
                    token: token,
                    linkUrl: linkUrl,
                    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                    action: "orders",
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.createErrorResponse(error, "getOrdersListLink");
            }
        });
    }
    getCartLink(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🔧 Calling getCartLink with:", request);
                logger_1.default.info("🔧 About to create token...");
                const token = yield this.secureTokenService.createToken("cart", request.workspaceId, { customerId: request.customerId }, undefined, // Uses TOKEN_EXPIRATION from env
                undefined, undefined, undefined, request.customerId);
                logger_1.default.info("🔧 Token created successfully:", token);
                // Use the injected linkGeneratorService instance
                // FR-13: Pass step parameter to generateCheckoutLink
                const linkUrl = yield this.linkGeneratorService.generateCheckoutLink(token, request.workspaceId, request.step // Pass step parameter (undefined if not provided)
                );
                return {
                    success: true,
                    token: token,
                    linkUrl: linkUrl,
                    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                    action: "cart",
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.createErrorResponse(error, "getCartLink");
            }
        });
    }
    getProfileLink(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🔧 Calling getProfileLink with:", request);
                logger_1.default.info("🔧 About to create token...");
                const token = yield this.secureTokenService.createToken("profile", request.workspaceId, { customerId: request.customerId }, undefined, // Uses TOKEN_EXPIRATION from env
                undefined, undefined, undefined, request.customerId);
                logger_1.default.info("🔧 Token created successfully:", token);
                // Use centralized link generator for consistent URL shortening
                const { linkGeneratorService, } = require("../application/services/link-generator.service");
                const linkUrl = yield linkGeneratorService.generateProfileLink(token, request.workspaceId);
                return {
                    success: true,
                    token: token,
                    linkUrl: linkUrl,
                    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                    action: "profile",
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.createErrorResponse(error, "getProfileLink");
            }
        });
    }
    contactOperator(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🔧 Calling contactOperator with:", request);
                // Import the contactOperator function
                const { contactOperator, } = require("../domain/calling-functions/contactOperator");
                const result = yield contactOperator({
                    phoneNumber: request.phoneNumber, // 🎯 CORRETTO: phoneNumber invece di phone
                    workspaceId: request.workspaceId,
                    customerId: request.customerId, // 🎯 AGGIUNTO: customerId se disponibile
                });
                logger_1.default.info("✅ contactOperator result:", result);
                // 📧 Se il Summary Agent è stato eseguito, loggalo per il debug timeline
                if (result.summaryAgentExecuted) {
                    logger_1.default.info("📧 Summary Agent executed successfully for email notification", {
                        ticketId: result.ticketId,
                        emailSent: result.summaryEmailSent,
                        timestamp: result.timestamp
                    });
                }
                return {
                    success: true,
                    message: result.message ||
                        "Certo, verrà contattato il prima possibile dal nostro operatore.",
                    timestamp: new Date().toISOString(),
                    // 🔧 Passa le informazioni del Summary Agent per il debug
                    summaryAgentExecuted: result.summaryAgentExecuted,
                    summaryEmailSent: result.summaryEmailSent,
                    ticketId: result.ticketId,
                    generatedSummary: result.generatedSummary, // 📧 Riassunto per debug timeline
                    conversationMessages: result.conversationMessages // 📧 Messaggi per debug timeline
                };
            }
            catch (error) {
                logger_1.default.error("❌ Error in contactOperator:", error);
                return {
                    success: false,
                    message: "Si è verificato un errore nel contattare l'operatore. Riprova più tardi.",
                    timestamp: new Date().toISOString(),
                };
            }
        });
    }
    /**
     * Manage push notification subscription (SUBSCRIBE/UNSUBSCRIBE)
     * Priority: 4.5 (between addProduct and searchProduct)
     * @param request - Request with action, customerId, workspaceId
     * @returns StandardResponse with confirmation message
     */
    manageNotifications(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🔔 Calling manageNotifications with:", request);
                // Import the manageNotifications function
                const { manageNotifications, } = require("../domain/calling-functions/manageNotifications");
                const result = yield manageNotifications({
                    action: request.action,
                    customerId: request.customerId,
                    workspaceId: request.workspaceId,
                });
                logger_1.default.info("✅ manageNotifications result:", result);
                return {
                    success: result.success,
                    message: result.message,
                    timestamp: new Date().toISOString(),
                    data: {
                        action: result.action,
                        currentStatus: result.currentStatus,
                    },
                };
            }
            catch (error) {
                logger_1.default.error("❌ Error in manageNotifications:", error);
                return {
                    success: false,
                    message: "An error occurred while updating your notification preferences. Please try again later.",
                    timestamp: new Date().toISOString(),
                };
            }
        });
    }
    /**
     * Delegate to Product and Services Agent
     * This triggers a sub-agent call in the LLM orchestration layer
     */
    productSearchAgent(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🔍 Router delegating to Product and Services Agent:", request);
                // This function is called by Router Agent to delegate to Product and Services Agent
                // The actual delegation happens in llm-router.service.ts
                // We return a signal that tells the router to call the sub-agent
                // ✅ FIX: Return delegateTo (not agentType) to match llm-router.service.ts check at line 1480
                return {
                    success: true,
                    message: `DELEGATE_TO_AGENT:PRODUCT_SEARCH:${request.query}`,
                    timestamp: new Date().toISOString(),
                    data: {
                        delegateTo: "PRODUCT_SEARCH", // ✅ FIX: Use delegateTo (not agentType)
                        query: request.query,
                    },
                };
            }
            catch (error) {
                logger_1.default.error("❌ Error in productSearchAgent:", error);
                return {
                    success: false,
                    message: "Error delegating to Product and Services Agent",
                    timestamp: new Date().toISOString(),
                };
            }
        });
    }
    /**
     * Delegate to Cart Management Agent
     * This triggers a sub-agent call in the LLM orchestration layer
     */
    cartManagementAgent(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🛒 Router delegating to Cart Management Agent:", request);
                return {
                    success: true,
                    message: `DELEGATE_TO_AGENT:CART_MANAGEMENT:${request.query}`,
                    timestamp: new Date().toISOString(),
                    data: {
                        delegateTo: "CART_MANAGEMENT", // ✅ FIX: Use delegateTo (not agentType)
                        query: request.query,
                    },
                };
            }
            catch (error) {
                logger_1.default.error("❌ Error in cartManagementAgent:", error);
                return {
                    success: false,
                    message: "Error delegating to Cart Management Agent",
                    timestamp: new Date().toISOString(),
                };
            }
        });
    }
    /**
     * Delegate to Order Tracking Agent
     * This triggers a sub-agent call in the LLM orchestration layer
     */
    orderTrackingAgent(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("📦 Router delegating to Order Tracking Agent:", request);
                return {
                    success: true,
                    message: `DELEGATE_TO_AGENT:ORDER_TRACKING:${request.query}`,
                    timestamp: new Date().toISOString(),
                    data: {
                        delegateTo: "ORDER_TRACKING", // ✅ FIX: Use delegateTo (not agentType)
                        query: request.query,
                    },
                };
            }
            catch (error) {
                logger_1.default.error("❌ Error in orderTrackingAgent:", error);
                return {
                    success: false,
                    message: "Error delegating to Order Tracking Agent",
                    timestamp: new Date().toISOString(),
                };
            }
        });
    }
    /**
     * Delegate to Customer Support Agent
     * This triggers a sub-agent call in the LLM orchestration layer
     */
    customerSupportAgent(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("💬 Router delegating to Customer Support Agent:", request);
                return {
                    success: true,
                    message: `DELEGATE_TO_AGENT:CUSTOMER_SUPPORT:${request.query}`,
                    timestamp: new Date().toISOString(),
                    data: {
                        delegateTo: "CUSTOMER_SUPPORT", // ✅ FIX: Use delegateTo (not agentType)
                        query: request.query,
                    },
                };
            }
            catch (error) {
                logger_1.default.error("❌ Error in customerSupportAgent:", error);
                return {
                    success: false,
                    message: "Error delegating to Customer Support Agent",
                    timestamp: new Date().toISOString(),
                };
            }
        });
    }
    /**
     * Replace [LINK_WITH_TOKEN] with generated link
     */
    replaceLinkWithToken(response_1) {
        return __awaiter(this, arguments, void 0, function* (response, linkType = "auto", customerId, workspaceId) {
            try {
                logger_1.default.info("🔧 Calling replaceLinkWithToken with:", {
                    response,
                    linkType,
                    customerId,
                    workspaceId,
                });
                const result = yield (0, link_replacement_service_1.ReplaceLinkWithToken)({ response, linkType: linkType }, customerId, workspaceId);
                if (result.success) {
                    return {
                        success: true,
                        message: result.response || response,
                        timestamp: new Date().toISOString(),
                    };
                }
                else {
                    return {
                        success: false,
                        error: result.error || "Failed to replace link token",
                        message: response, // Return original response if replacement fails
                        timestamp: new Date().toISOString(),
                    };
                }
            }
            catch (error) {
                return this.createErrorResponse(error, "replaceLinkWithToken");
            }
        });
    }
    /**
     * Aggiungi prodotto al carrello
     */
    addProductToCart(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🛒 Calling addProductToCart with:", request);
                try {
                    // Trova il cliente
                    const customer = yield database_1.prisma.customers.findFirst({
                        where: {
                            id: request.customerId,
                            workspaceId: request.workspaceId,
                        },
                    });
                    if (!customer) {
                        logger_1.default.error("❌ Customer not found in addProductToCart");
                        return {
                            success: false,
                            error: "Cliente non trovato",
                            message: "Non riesco a trovare il tuo account.",
                            timestamp: new Date().toISOString(),
                        };
                    }
                    // Trova il prodotto per sku o per nome (fallback)
                    // Prima prova con sku esatto
                    let product = yield database_1.prisma.products.findFirst({
                        where: {
                            sku: request.sku,
                            workspaceId: request.workspaceId,
                            isActive: true,
                        },
                    });
                    // Se non trovato per Sku, cerca per nome (case-insensitive)
                    if (!product) {
                        logger_1.default.info(`🔍 Sku not found, searching by name: ${request.sku}`);
                        product = yield database_1.prisma.products.findFirst({
                            where: {
                                name: {
                                    contains: request.sku,
                                    mode: "insensitive",
                                },
                                workspaceId: request.workspaceId,
                                isActive: true,
                            },
                        });
                    }
                    if (!product) {
                        logger_1.default.error("❌ Product not found:", request.sku);
                        return {
                            success: false,
                            error: "Prodotto non trovato",
                            message: `Il prodotto "${request.sku}" non è disponibile.`,
                            timestamp: new Date().toISOString(),
                        };
                    }
                    // Verifica stock disponibile
                    if (product.stock < request.quantity) {
                        logger_1.default.error(`❌ Insufficient stock for product ${request.sku}. Available: ${product.stock}, Requested: ${request.quantity}`);
                        return {
                            success: false,
                            error: "Stock insufficiente",
                            message: `Purtroppo disponibili solo ${product.stock} unità di "${product.name}".`,
                            timestamp: new Date().toISOString(),
                        };
                    }
                    // Trova o crea il carrello del cliente
                    let cart = yield database_1.prisma.carts.findFirst({
                        where: {
                            customerId: request.customerId,
                            workspaceId: request.workspaceId,
                        },
                    });
                    if (!cart) {
                        cart = yield database_1.prisma.carts.create({
                            data: {
                                customerId: request.customerId,
                                workspaceId: request.workspaceId,
                            },
                        });
                        logger_1.default.info("✅ Created new cart for customer:", request.customerId);
                    }
                    // Controlla se il prodotto è già nel carrello
                    const existingCartItem = yield database_1.prisma.cartItems.findFirst({
                        where: {
                            cartId: cart.id,
                            productId: product.id,
                        },
                    });
                    if (existingCartItem) {
                        // Se esiste già, aggiorna la quantità
                        yield database_1.prisma.cartItems.update({
                            where: { id: existingCartItem.id },
                            data: {
                                quantity: existingCartItem.quantity + request.quantity,
                            },
                        });
                        logger_1.default.info("✅ Updated existing cart item for product:", request.sku);
                    }
                    else {
                        // Altrimenti, crea un nuovo item
                        yield database_1.prisma.cartItems.create({
                            data: {
                                cartId: cart.id,
                                productId: product.id,
                                quantity: request.quantity,
                                itemType: "PRODUCT",
                                notes: request.notes || "",
                            },
                        });
                        logger_1.default.info("✅ Added product to cart:", request.sku);
                    }
                    // Genera token per accesso al carrello
                    const token = yield this.secureTokenService.createToken("cart", request.workspaceId, { customerId: request.customerId }, undefined, undefined, undefined, undefined, request.customerId);
                    // Genera short URL del carrello
                    // FR-13: AddProduct always uses step=2 (skip cart review, go to address)
                    const { linkGeneratorService, } = require("../application/services/link-generator.service");
                    const cartUrl = yield linkGeneratorService.generateCheckoutLink(token, request.workspaceId, 2 // FR-13: Skip cart review step
                    );
                    yield database_1.prisma.$disconnect();
                    // 🔧 IMPORTANTE: Non usare placeholder nel message - usa il cartUrl REALE
                    // L'AI deve vedere il link diretto, non [LINK_CHECKOUT_WITH_TOKEN]
                    return {
                        success: true,
                        message: `✅ Ho aggiunto ${request.quantity} x "${product.name}" al carrello!\n\n🛒 Vedi il tuo carrello: ${cartUrl}\n\n⏰ Link valido per 15 minuti`,
                        productName: product.name,
                        quantity: request.quantity,
                        cartCode: cart.id,
                        cartUrl: cartUrl, // ✅ L'AI deve usare QUESTO campo per costruire la risposta
                        token: token,
                        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                        timestamp: new Date().toISOString(),
                    };
                }
                catch (error) {
                    logger_1.default.error("❌ Error in addProductToCart database operations:", error);
                    yield database_1.prisma.$disconnect();
                    throw error;
                }
            }
            catch (error) {
                logger_1.default.error("❌ Error in addProductToCart:", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Errore interno",
                    message: "Impossibile aggiungere il prodotto al carrello.",
                    timestamp: new Date().toISOString(),
                };
            }
        });
    }
    /**
     * Aggiungi servizio al carrello
     * Feature 123 - M1: AddService support
     */
    addServiceToCart(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🛠️ Calling addServiceToCart with:", request);
                try {
                    // Trova il cliente
                    const customer = yield database_1.prisma.customers.findFirst({
                        where: {
                            id: request.customerId,
                            workspaceId: request.workspaceId,
                        },
                    });
                    if (!customer) {
                        logger_1.default.error("❌ Customer not found in addServiceToCart");
                        return {
                            success: false,
                            error: "Cliente non trovato",
                            message: "Non riesco a trovare il tuo account.",
                            timestamp: new Date().toISOString(),
                        };
                    }
                    // Trova il servizio per serviceCode o per nome (fallback)
                    let service = yield database_1.prisma.services.findFirst({
                        where: {
                            code: request.serviceCode,
                            workspaceId: request.workspaceId,
                            isActive: true,
                        },
                    });
                    // Se non trovato per code, cerca per nome (case-insensitive)
                    if (!service) {
                        logger_1.default.info(`🔍 ServiceCode not found, searching by name: ${request.serviceCode}`);
                        service = yield database_1.prisma.services.findFirst({
                            where: {
                                name: {
                                    contains: request.serviceCode,
                                    mode: "insensitive",
                                },
                                workspaceId: request.workspaceId,
                                isActive: true,
                            },
                        });
                    }
                    if (!service) {
                        logger_1.default.error("❌ Service not found:", request.serviceCode);
                        return {
                            success: false,
                            error: "Servizio non trovato",
                            message: `Il servizio "${request.serviceCode}" non è disponibile.`,
                            timestamp: new Date().toISOString(),
                        };
                    }
                    // Trova o crea il carrello del cliente
                    let cart = yield database_1.prisma.carts.findFirst({
                        where: {
                            customerId: request.customerId,
                            workspaceId: request.workspaceId,
                        },
                    });
                    if (!cart) {
                        cart = yield database_1.prisma.carts.create({
                            data: {
                                customerId: request.customerId,
                                workspaceId: request.workspaceId,
                            },
                        });
                        logger_1.default.info("✅ Created new cart for customer:", request.customerId);
                    }
                    // Controlla se il servizio è già nel carrello
                    const existingCartItem = yield database_1.prisma.cartItems.findFirst({
                        where: {
                            cartId: cart.id,
                            serviceId: service.id,
                        },
                    });
                    if (existingCartItem) {
                        // Se esiste già, aggiorna la quantità
                        yield database_1.prisma.cartItems.update({
                            where: { id: existingCartItem.id },
                            data: {
                                quantity: existingCartItem.quantity + request.quantity,
                            },
                        });
                        logger_1.default.info("✅ Updated existing cart item for service:", request.serviceCode);
                    }
                    else {
                        // Altrimenti, crea un nuovo item
                        yield database_1.prisma.cartItems.create({
                            data: {
                                cartId: cart.id,
                                serviceId: service.id,
                                quantity: request.quantity,
                                itemType: "SERVICE",
                                notes: request.notes || "",
                            },
                        });
                        logger_1.default.info("✅ Added service to cart:", request.serviceCode);
                    }
                    // Genera token per accesso al carrello
                    const token = yield this.secureTokenService.createToken("cart", request.workspaceId, { customerId: request.customerId }, undefined, undefined, undefined, undefined, request.customerId);
                    // Genera short URL del carrello
                    const { linkGeneratorService, } = require("../application/services/link-generator.service");
                    const cartUrl = yield linkGeneratorService.generateCheckoutLink(token, request.workspaceId, 2 // Skip cart review step
                    );
                    yield database_1.prisma.$disconnect();
                    return {
                        success: true,
                        message: `✅ Ho aggiunto ${request.quantity} x "${service.name}" al carrello!\n\n🛒 Vedi il tuo carrello: ${cartUrl}\n\n⏰ Link valido per 15 minuti`,
                        serviceName: service.name,
                        quantity: request.quantity,
                        cartCode: cart.id,
                        cartUrl: cartUrl,
                        token: token,
                        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                        timestamp: new Date().toISOString(),
                    };
                }
                catch (error) {
                    logger_1.default.error("❌ Error in addServiceToCart database operations:", error);
                    yield database_1.prisma.$disconnect();
                    throw error;
                }
            }
            catch (error) {
                logger_1.default.error("❌ Error in addServiceToCart:", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Errore interno",
                    message: "Impossibile aggiungere il servizio al carrello.",
                    timestamp: new Date().toISOString(),
                };
            }
        });
    }
    /**
     * Registra ricerca prodotto per analytics
     */
    searchProduct(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🔍 Calling searchProduct with:", request);
                // Import the searchProduct function
                const { searchProduct, } = require("../domain/calling-functions/searchProduct");
                const result = yield searchProduct({
                    customerId: request.customerId,
                    workspaceId: request.workspaceId,
                    productName: request.productName,
                });
                logger_1.default.info("✅ searchProduct result:", result);
                return {
                    success: true,
                    message: result.message || "Ricerca registrata per analytics",
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                logger_1.default.error("❌ Error in searchProduct:", error);
                return {
                    success: false,
                    message: "Errore nel registrare la ricerca.",
                    timestamp: new Date().toISOString(),
                };
            }
        });
    }
    /**
     * Get specific order details by order ID or code
     */
    getOrder(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("📦 Calling getOrder with:", request);
                const { getOrder } = require("../domain/calling-functions/getOrder");
                const result = yield getOrder({
                    customerId: request.customerId,
                    workspaceId: request.workspaceId,
                    orderId: request.orderId,
                });
                logger_1.default.info("✅ GetOrder result:", result);
                return result;
            }
            catch (error) {
                logger_1.default.error("❌ Error in getOrder:", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                    message: "Errore nel recupero dell'ordine.",
                    timestamp: new Date().toISOString(),
                };
            }
        });
    }
    /**
     * Track order shipment status
     */
    trackOrder(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("📍 Calling trackOrder with:", request);
                const { trackOrder } = require("../domain/calling-functions/trackOrder");
                const result = yield trackOrder({
                    customerId: request.customerId,
                    workspaceId: request.workspaceId,
                    orderId: request.orderId,
                });
                logger_1.default.info("✅ TrackOrder result:", result);
                return result;
            }
            catch (error) {
                logger_1.default.error("❌ Error in trackOrder:", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                    message: "Errore nel tracking dell'ordine.",
                    timestamp: new Date().toISOString(),
                };
            }
        });
    }
    /**
     * Send invoice PDF via email
     */
    sendInvoice(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("📧 Calling sendInvoice with:", request);
                const { sendInvoice } = require("../domain/calling-functions/sendInvoice");
                const result = yield sendInvoice({
                    customerId: request.customerId,
                    workspaceId: request.workspaceId,
                    orderId: request.orderId,
                    email: request.email,
                });
                logger_1.default.info("✅ SendInvoice result:", result);
                return result;
            }
            catch (error) {
                logger_1.default.error("❌ Error in sendInvoice:", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                    message: "Errore nell'invio della fattura.",
                    timestamp: new Date().toISOString(),
                };
            }
        });
    }
    /**
     * Send security alert email to workspace admins
     */
    sendAlertEmail(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.warn("🚨 Calling sendAlertEmail with:", request);
                const { sendAlertEmail, } = require("../domain/calling-functions/sendAlertEmail");
                const result = yield sendAlertEmail({
                    workspaceId: request.workspaceId,
                    customerId: request.customerId,
                    alertType: request.alertType,
                    messageContent: request.messageContent,
                    severity: request.severity,
                    additionalInfo: request.additionalInfo,
                });
                logger_1.default.warn("✅ SendAlertEmail result:", result);
                return result;
            }
            catch (error) {
                logger_1.default.error("❌ Error in sendAlertEmail:", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                    message: "Errore nell'invio dell'alert.",
                    timestamp: new Date().toISOString(),
                };
            }
        });
    }
    /**
     * 🔍 Get product details by sku or name
     *
     * ✅ Feature 191: FIRST searches by exact sku match (most reliable for multi-language)
     * Then falls back to fuzzy name matching if code not found.
     * Used by ProductSearchAgent to lookup full product details when user selects a product.
     * Returns INTERNAL product code (never shown to user) for cart operations.
     *
     * @param request - Product code or name, and optional formato for matching
     * @returns Product details with internal code
     */
    getProductDetails(request) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const { workspaceId, customerId, productName, formato } = request;
                logger_1.default.info("🔍 getProductDetails called:", {
                    workspaceId,
                    customerId,
                    productName,
                    formato,
                });
                try {
                    // Get customer discount for price calculation
                    const customer = yield database_1.prisma.customers.findFirst({
                        where: { id: customerId, workspaceId },
                        select: { discount: true }
                    });
                    const customerDiscount = (customer === null || customer === void 0 ? void 0 : customer.discount) || 0;
                    // Normalize search terms: trim and lowercase
                    const searchName = productName.trim().toLowerCase();
                    const searchFormato = formato === null || formato === void 0 ? void 0 : formato.trim().toLowerCase();
                    // Get all active products for workspace
                    const products = yield database_1.prisma.products.findMany({
                        where: {
                            workspaceId,
                            isActive: true,
                        },
                        include: {
                            category: { select: { name: true } },
                            productCertifications: {
                                select: {
                                    certification: { select: { name: true } }
                                }
                            }
                        }
                    });
                    // ✅ Feature 191: FIRST try exact match by sku (most reliable)
                    let matchedProducts = products.filter((p) => {
                        var _a;
                        const pCode = ((_a = p.sku) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase()) || "";
                        return pCode === searchName;
                    });
                    // If no code match, try fuzzy name matching
                    if (matchedProducts.length === 0) {
                        matchedProducts = products.filter((p) => {
                            var _a;
                            const pName = p.name.trim().toLowerCase();
                            const pFormato = ((_a = p.formato) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase()) || "";
                            // Name matching: either contains
                            const nameMatch = pName.includes(searchName) || searchName.includes(pName);
                            // If formato specified, require match
                            if (searchFormato && nameMatch) {
                                return pFormato.includes(searchFormato) || searchFormato.includes(pFormato);
                            }
                            return nameMatch;
                        });
                    }
                    // If no match, try word-based matching
                    // Use .every() to require ALL search words to be present (not just any)
                    if (matchedProducts.length === 0) {
                        const searchWords = searchName.split(/\s+/).filter(w => w.length > 2);
                        matchedProducts = products.filter((p) => {
                            const pName = p.name.trim().toLowerCase();
                            // ALL words must be present in product name
                            return searchWords.every(word => pName.includes(word));
                        });
                        // If still no match with .every(), fallback to .some() but with priority
                        if (matchedProducts.length === 0) {
                            // Find products that match at least one word, prioritize by match count
                            const scoredProducts = products.map((p) => {
                                const pName = p.name.trim().toLowerCase();
                                const matchCount = searchWords.filter(word => pName.includes(word)).length;
                                return { product: p, matchCount };
                            }).filter(sp => sp.matchCount > 0)
                                .sort((a, b) => b.matchCount - a.matchCount);
                            // Only take products with highest match count
                            if (scoredProducts.length > 0) {
                                const maxScore = scoredProducts[0].matchCount;
                                matchedProducts = scoredProducts
                                    .filter(sp => sp.matchCount === maxScore)
                                    .map(sp => sp.product);
                            }
                        }
                    }
                    if (matchedProducts.length === 0) {
                        logger_1.default.info("❌ No product found for:", { productName, formato });
                        return {
                            success: false,
                            found: false,
                            message: `Prodotto "${productName}" non trovato. Vuoi che ti mostri i prodotti disponibili?`,
                            timestamp: new Date().toISOString(),
                        };
                    }
                    // Use PriceCalculationService to get correct prices (with discounts and rounding)
                    const priceService = new price_calculation_service_1.PriceCalculationService(database_1.prisma);
                    const productIds = matchedProducts.map((p) => p.id);
                    const priceResult = yield priceService.calculatePricesWithDiscounts(workspaceId, productIds, customerDiscount);
                    const priceMap = new Map(priceResult.products.map(p => [p.id, p]));
                    // If multiple matches, return all for user selection with correct prices
                    if (matchedProducts.length > 1) {
                        const options = matchedProducts.map((p) => {
                            const pricing = priceMap.get(p.id);
                            return {
                                name: p.name,
                                formato: p.formato,
                                price: (pricing === null || pricing === void 0 ? void 0 : pricing.finalPrice) || p.price, // Use calculated final price
                            };
                        });
                        logger_1.default.info("ℹ️ Multiple products found:", options);
                        return {
                            success: true,
                            found: true,
                            multiple: true,
                            products: options,
                            message: `Ho trovato ${matchedProducts.length} prodotti simili. Quale intendi?`,
                            timestamp: new Date().toISOString(),
                        };
                    }
                    // Single match - return full details with correct price
                    const product = matchedProducts[0];
                    const pricing = priceMap.get(product.id);
                    const certifications = ((_a = product.productCertifications) === null || _a === void 0 ? void 0 : _a.map((pc) => pc.certification.name)) || [];
                    logger_1.default.info("✅ Product found:", {
                        name: product.name,
                        sku: product.sku,
                        basePrice: product.price,
                        finalPrice: pricing === null || pricing === void 0 ? void 0 : pricing.finalPrice,
                        customerDiscount,
                    });
                    // Build full image URL
                    const getFullImageUrl = (imageUrl) => {
                        // Handle array case - take first element
                        const urlString = Array.isArray(imageUrl) ? imageUrl[0] : imageUrl;
                        if (!urlString)
                            return null;
                        if (urlString.startsWith("http://") || urlString.startsWith("https://")) {
                            return urlString;
                        }
                        const baseUrl = config_1.config.appUrl.replace(/\/+$/, "");
                        const path = urlString.startsWith("/") ? urlString : `/${urlString}`;
                        return `${baseUrl}${path}`;
                    };
                    return {
                        success: true,
                        found: true,
                        multiple: false,
                        product: {
                            // INTERNAL: sku is for system use (addProductToCart), never show to user
                            sku: product.sku,
                            name: product.name,
                            formato: product.formato,
                            // ✅ Use finalPrice from PriceCalculationService (already discounted and rounded)
                            price: (pricing === null || pricing === void 0 ? void 0 : pricing.finalPrice) || product.price,
                            description: product.description,
                            stock: product.stock,
                            category: (_b = product.category) === null || _b === void 0 ? void 0 : _b.name,
                            region: product.region,
                            transportType: product.transportType,
                            certifications: certifications,
                            // ✅ Include full image URL for display
                            imageUrl: getFullImageUrl(Array.isArray(product.imageUrl) ? product.imageUrl[0] : product.imageUrl),
                            isAvailable: product.stock > 0,
                        },
                        timestamp: new Date().toISOString(),
                    };
                }
                finally {
                    yield database_1.prisma.$disconnect();
                }
            }
            catch (error) {
                logger_1.default.error("❌ Error in getProductDetails:", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                    message: "Errore nel recupero dettagli prodotto.",
                    timestamp: new Date().toISOString(),
                };
            }
        });
    }
    /**
     * 🔍 Get service details by serviceCode or name
     *
     * ✅ Feature 191: FIRST searches by exact serviceCode match (most reliable for multi-language)
     * Then falls back to fuzzy name matching if code not found.
     * Used by ProductSearchAgent to lookup full service details when user selects a service.
     * Returns INTERNAL service code (never shown to user) for cart operations.
     *
     * @param request - Service code or name for matching
     * @returns Service details with internal code
     */
    getServiceDetails(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId, serviceName } = request;
                logger_1.default.info("🔍 getServiceDetails called:", {
                    workspaceId,
                    serviceName,
                });
                try {
                    // Normalize search term: trim and lowercase
                    const searchName = serviceName.trim().toLowerCase();
                    // Get all active services for workspace
                    const services = yield database_1.prisma.services.findMany({
                        where: {
                            workspaceId,
                            isActive: true,
                        }
                    });
                    // ✅ Feature 191: FIRST try exact match by serviceCode (most reliable)
                    let matchedServices = services.filter((s) => {
                        var _a;
                        const sCode = ((_a = s.code) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase()) || "";
                        return sCode === searchName;
                    });
                    // If no code match, try fuzzy name matching
                    if (matchedServices.length === 0) {
                        matchedServices = services.filter((s) => {
                            const sName = s.name.trim().toLowerCase();
                            return sName.includes(searchName) || searchName.includes(sName);
                        });
                    }
                    // If still no match, try word-based matching
                    if (matchedServices.length === 0) {
                        const searchWords = searchName.split(/\s+/).filter(w => w.length > 2);
                        matchedServices = services.filter((s) => {
                            const sName = s.name.trim().toLowerCase();
                            return searchWords.some(word => sName.includes(word));
                        });
                    }
                    if (matchedServices.length === 0) {
                        logger_1.default.info("❌ No service found for:", { serviceName });
                        return {
                            success: false,
                            found: false,
                            message: `Servizio "${serviceName}" non trovato. Vuoi che ti mostri i servizi disponibili?`,
                            timestamp: new Date().toISOString(),
                        };
                    }
                    // If multiple matches, return all for user selection
                    if (matchedServices.length > 1) {
                        const options = matchedServices.map((s) => ({
                            name: s.name,
                            price: s.price,
                        }));
                        logger_1.default.info("ℹ️ Multiple services found:", options);
                        return {
                            success: true,
                            found: true,
                            multiple: true,
                            services: options,
                            message: `Ho trovato ${matchedServices.length} servizi simili. Quale intendi?`,
                            timestamp: new Date().toISOString(),
                        };
                    }
                    // Single match - return full details
                    const service = matchedServices[0];
                    logger_1.default.info("✅ Service found:", {
                        name: service.name,
                        serviceCode: service.code,
                    });
                    return {
                        success: true,
                        found: true,
                        multiple: false,
                        service: {
                            // INTERNAL: serviceCode is for system use (addServiceToCart), never show to user
                            serviceCode: service.code,
                            name: service.name,
                            price: service.price,
                            description: service.description,
                        },
                        timestamp: new Date().toISOString(),
                    };
                }
                finally {
                    yield database_1.prisma.$disconnect();
                }
            }
            catch (error) {
                logger_1.default.error("❌ Error in getServiceDetails:", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                    message: "Errore nel recupero dettagli servizio.",
                    timestamp: new Date().toISOString(),
                };
            }
        });
    }
    /**
     * 📊 Save product search for analytics (statistics tracking)
     *
     * Called AUTOMATICALLY by ProductSearchAgent every time a user searches for products.
     * Tracks all search attempts (successful or not) for analytics purposes.
     *
     * Data retention: 6 months (cleaned up by scheduler cron job)
     *
     * @param request - Search details with workspaceId, customerId, query
     * @returns Success confirmation
     */
    searchProductForStatistics(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId, customerId, query } = request;
                logger_1.default.info("📊 Saving product search for statistics", {
                    workspaceId,
                    customerId,
                    query: query.substring(0, 50), // Limit log size
                });
                try {
                    yield database_1.prisma.productSearch.create({
                        data: {
                            workspaceId,
                            customerId,
                            query: query.trim(),
                        },
                    });
                    logger_1.default.info("✅ Product search saved successfully", {
                        workspaceId,
                        query: query.substring(0, 30),
                    });
                    return {
                        success: true,
                        message: `Ricerca "${query.substring(0, 30)}..." registrata per statistiche`,
                        timestamp: new Date().toISOString(),
                    };
                }
                finally {
                    yield database_1.prisma.$disconnect();
                }
            }
            catch (error) {
                logger_1.default.error("❌ Error saving product search statistics:", error);
                // Non bloccare il flusso principale - statistiche sono opzionali
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                    message: "Errore nel salvataggio statistiche (non critico)",
                    timestamp: new Date().toISOString(),
                };
            }
        });
    }
}
exports.CallingFunctionsService = CallingFunctionsService;
//# sourceMappingURL=calling-functions.service.js.map