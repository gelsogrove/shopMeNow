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
exports.FunctionHandlerService = void 0;
const database_1 = require("@echatbot/database");
// import { getAllProducts } from "../../chatbot/calling-functions/getAllProducts" // REMOVED - file no longer exists
const message_repository_1 = require("../../repositories/message.repository");
const logger_1 = __importDefault(require("../../utils/logger"));
const link_generator_service_1 = require("./link-generator.service");
const price_calculation_service_1 = require("./price-calculation.service");
const secure_token_service_1 = require("./secure-token.service");
/**
 * Service per gestire le chiamate di funzione dal function router
 */
class FunctionHandlerService {
    /**
     * Handle get order status request
     */
    handleGetOrderStatus(phoneNumber, workspaceId, customerId, orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`🔍 FunctionHandler: Getting order status for customer ${customerId}, orderId: ${orderId}`);
                // Find customer
                const customer = yield this.prisma.customers.findFirst({
                    where: {
                        phone: phoneNumber,
                        workspaceId: workspaceId,
                    },
                });
                if (!customer) {
                    return {
                        success: false,
                        response: "Mi dispiace, non riesco a trovare il tuo account. Contatta il nostro supporto per assistenza.",
                        error: "Customer not found",
                    };
                }
                // Get orders for this customer
                const orders = yield this.prisma.orders.findMany({
                    where: {
                        customerId: customer.id,
                        workspaceId: workspaceId,
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                    take: 5, // Last 5 orders
                    select: {
                        id: true,
                        orderCode: true,
                        status: true,
                        totalAmount: true,
                        createdAt: true,
                    },
                });
                if (orders.length === 0) {
                    return {
                        success: true,
                        response: "Non hai ancora effettuato ordini. Quando farai il tuo primo ordine, potrai controllarne lo stato qui!",
                        orders: [],
                    };
                }
                // Format orders for display
                const ordersList = orders
                    .map((order) => `📦 Ordine ${order.orderCode} - ${order.status} - €${order.totalAmount} (${order.createdAt.toLocaleDateString("it-IT")})`)
                    .join("\n");
                return {
                    success: true,
                    response: `Ecco i tuoi ordini recenti:\n\n${ordersList}\n\nPer maggiori dettagli su un ordine specifico, fammi sapere il codice ordine!`,
                    orders: orders,
                };
            }
            catch (error) {
                logger_1.default.error("❌ Error getting order status:", error);
                return {
                    success: false,
                    response: "Mi dispiace, si è verificato un errore nel recuperare i tuoi ordini. Riprova più tardi o contatta il supporto.",
                    error: error.message,
                };
            }
        });
    }
    /**
     * 🎯 TASK: Clean up orphaned cart items (items with missing products)
     */
    cleanupOrphanedCartItems(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Find cart items that reference non-existent products
                const orphanedItems = yield this.prisma.cartItems.findMany({
                    where: {
                        cart: {
                            workspaceId: workspaceId,
                        },
                        product: null,
                    },
                    include: {
                        cart: true,
                    },
                });
                if (orphanedItems.length > 0) {
                    logger_1.default.warn(`🧹 Found ${orphanedItems.length} orphaned cart items in workspace ${workspaceId}`);
                    // Delete orphaned items
                    yield this.prisma.cartItems.deleteMany({
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
            }
        });
    }
    constructor() {
        // 🆕 DISAMBIGUATION SESSION MANAGEMENT
        this.disambiguationSessions = new Map();
        this.SESSION_TTL = 5 * 60 * 1000; // 5 minuti in millisecondi
        this.prisma = database_1.prisma;
        this.messageRepository = new message_repository_1.MessageRepository();
        this.secureTokenService = new secure_token_service_1.SecureTokenService();
        this.priceCalculationService = new price_calculation_service_1.PriceCalculationService(this.prisma);
        this.callingFunctionsService =
            require("../../services/calling-functions.service").default;
        // Auto-cleanup sessioni scadute ogni ora
        setInterval(() => this.cleanExpiredSessions(), 60 * 60 * 1000);
    }
    /**
     * Gestisce una chiamata di funzione in base al nome e ai parametri
     * @param functionName Nome della funzione da chiamare
     * @param params Parametri per la funzione
     * @param customer Informazioni sul cliente
     * @param workspaceId ID del workspace
     * @param phoneNumber Numero di telefono del cliente
     * @returns Risultato della chiamata di funzione
     */
    handleFunctionCall(functionName, params, customer, workspaceId, phoneNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`🎯 FunctionHandlerService: Chiamata ricevuta per ${functionName}`, {
                functionName,
                params,
                customerId: customer === null || customer === void 0 ? void 0 : customer.id,
                workspaceId,
                phoneNumber,
            });
            try {
                logger_1.default.info("🔧 [DEBUG] Entering switch statement for functionName:", functionName);
                switch (functionName) {
                    // 🛒 CART OPERATIONS - REMOVED (now handled via web link)
                    // 📦 PRODUCT OPERATIONS - GetAllProducts REMOVED (redundant with {{PRODUCTS}} in prompt)
                    //  CART LINK
                    case "GetCartLink":
                        return {
                            data: yield this.handleGetCartLink(customer, workspaceId),
                            functionName,
                        };
                    case "get_all_categories":
                        return {
                            functionName,
                            data: null, // No data needed for this function
                        };
                    case "get_order_status":
                        return {
                            data: yield this.handleGetOrderStatus(phoneNumber, workspaceId, customer === null || customer === void 0 ? void 0 : customer.id, params.order_id),
                            functionName,
                        };
                    case "search_products":
                        return {
                            data: yield this.searchProducts(params.query, workspaceId),
                            functionName,
                        };
                    // 🔗 ORDER LINK
                    case "getLinkOrderByCode":
                        return {
                            data: yield this.handleGetLinkOrderByCode(params, customer, workspaceId),
                            functionName,
                        };
                    // 🚚 ORDER OPERATIONS & 🛒 CART OPERATIONS (REMOVED)
                    // case 'confirm_order':
                    //   return {
                    //         ...params
                    //       }),
                    //       functionName
                    //     }
                    // 📄 DOCUMENTATION & FAQ
                    case "search_documents":
                        return {
                            data: yield this.searchDocuments(params.query, workspaceId),
                            functionName,
                        };
                    case "get_faq_info":
                        return {
                            data: yield this.getFaqInfo(params.question, workspaceId),
                            functionName,
                        };
                    //  CONTACT OPERATOR
                    case "contactOperator":
                        return {
                            data: yield this.handleContactOperator(params, customer, workspaceId),
                            functionName,
                        };
                    // 🛒 ADD PRODUCT TO CART
                    case "addProduct":
                        return {
                            data: yield this.handleAddProduct(params, customer, workspaceId),
                            functionName,
                        };
                    // 🔄 REPEAT ORDER
                    case "repeatOrder":
                        return {
                            data: yield this.handleRepeatOrder(params, customer, workspaceId),
                            functionName,
                        };
                    // 📋 GET ORDER DETAILS (Full order info from DB)
                    case "getOrderDetails":
                        return {
                            data: yield this.handleGetOrderDetails(params, customer, workspaceId),
                            functionName,
                        };
                    // 🔍 SEARCH PRODUCT (Background Analytics Tracking)
                    case "searchProduct":
                        return {
                            data: yield this.handleSearchProduct(params, customer, workspaceId),
                            functionName,
                        };
                    // 🎯 DEFAULT CASE
                    default:
                        logger_1.default.warn(`⚠️ Funzione non riconosciuta: ${functionName}`);
                        return {
                            data: {
                                success: false,
                                error: `Funzione ${functionName} non supportata`,
                                supportedFunctions: [
                                    "confirm_order",
                                    "generateCartLink",
                                    "get_all_products",
                                    "get_all_categories",
                                    "search_products",
                                    "search_documents",
                                    "get_faq_info",
                                    "contactOperator",
                                    "addProduct",
                                    "repeatOrder",
                                    "searchProduct",
                                ],
                            },
                            functionName,
                        };
                }
            }
            catch (error) {
                logger_1.default.error("❌ [DEBUG] Error in handleFunctionCall:", error);
                logger_1.default.error("❌ [DEBUG] Error stack:", error.stack);
                logger_1.default.error(`❌ Errore in handleFunctionCall per ${functionName}:`, error);
                return {
                    data: {
                        success: false,
                        error: error instanceof Error
                            ? error.message
                            : "Errore interno del server",
                        errorType: "internal_error",
                    },
                    functionName,
                };
            }
        });
    }
    // =============================================================================
    // 🛒 CART LINK METHODS
    // =============================================================================
    /**
     * Gestisce la richiesta di link al carrello
     */
    handleGetCartLink(customer, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🔧 FunctionHandlerService: handleGetCartLink called");
                // Import the CallingFunctionsService
                const { CallingFunctionsService, } = require("../../services/calling-functions.service");
                const callingFunctionsService = new CallingFunctionsService();
                // Call the getCartLink function
                const result = yield callingFunctionsService.getCartLink({
                    customerId: (customer === null || customer === void 0 ? void 0 : customer.id) || "",
                    workspaceId: workspaceId,
                });
                logger_1.default.info("🔧 FunctionHandlerService: getCartLink result:", result);
                return result;
            }
            catch (error) {
                logger_1.default.error("❌ FunctionHandlerService: Error in handleGetCartLink:", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Errore interno del server",
                    errorType: "internal_error",
                };
            }
        });
    }
    // =============================================================================
    // 🔗 ORDER LINK METHODS
    // =============================================================================
    /**
     * Gestisce la richiesta di link ordine intelligente
     */
    handleGetLinkOrderByCode(params, customer, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🔧 FunctionHandlerService: handleGetLinkOrderByCode called with:", params);
                // Import the getLinkOrderByCode function
                const { getLinkOrderByCode, } = require("../../domain/calling-functions/getLinkOrderByCode");
                // Call the getLinkOrderByCode function
                const result = yield getLinkOrderByCode({
                    customerId: (customer === null || customer === void 0 ? void 0 : customer.id) || "",
                    workspaceId: workspaceId,
                    orderCode: params.orderCode || undefined,
                    documentType: params.documentType || "order",
                    language: params.language || "it",
                });
                logger_1.default.info("🔧 FunctionHandlerService: getLinkOrderByCode result:", result);
                return result;
            }
            catch (error) {
                logger_1.default.error("❌ FunctionHandlerService: Error in handleGetLinkOrderByCode:", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Errore interno del server",
                    errorType: "internal_error",
                };
            }
        });
    }
    /**
     * 📋 Gestisce la richiesta di dettagli completi di un ordine
     * Ritorna: codice, stato, data, totale, lista prodotti, documenti disponibili
     */
    handleGetOrderDetails(params, customer, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                logger_1.default.info("📋 FunctionHandlerService: handleGetOrderDetails called with:", { params, customerId: customer === null || customer === void 0 ? void 0 : customer.id, workspaceId });
                const orderCode = params.orderCode;
                if (!orderCode) {
                    return {
                        success: false,
                        error: "Codice ordine non specificato",
                        errorType: "missing_order_code",
                    };
                }
                if (!(customer === null || customer === void 0 ? void 0 : customer.id)) {
                    return {
                        success: false,
                        error: "Cliente non trovato",
                        errorType: "customer_not_found",
                    };
                }
                // Query order with full details
                const order = yield this.prisma.orders.findFirst({
                    where: {
                        orderCode: orderCode,
                        workspaceId: workspaceId,
                        customerId: customer.id, // Security: customer can only see own orders
                    },
                    include: {
                        customer: {
                            select: {
                                name: true,
                                email: true,
                                phone: true,
                            },
                        },
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
                                        code: true, // Services use 'code', not 'serviceCode'
                                    },
                                },
                            },
                        },
                    },
                });
                if (!order) {
                    return {
                        success: false,
                        error: `Ordine ${orderCode} non trovato`,
                        errorType: "order_not_found",
                    };
                }
                // Map order items from relation (items are OrderItems with product/service relations)
                const orderItems = order.items.map((item, idx) => {
                    var _a, _b, _c, _d;
                    // Get name from product or service relation
                    const itemName = ((_a = item.product) === null || _a === void 0 ? void 0 : _a.name) || ((_b = item.service) === null || _b === void 0 ? void 0 : _b.name) || "Prodotto";
                    const itemCode = ((_c = item.product) === null || _c === void 0 ? void 0 : _c.sku) || ((_d = item.service) === null || _d === void 0 ? void 0 : _d.code) || null;
                    return {
                        index: idx + 1,
                        name: itemName,
                        quantity: item.quantity || 1,
                        price: item.unitPrice || 0,
                        totalPrice: item.totalPrice || (item.quantity || 1) * (item.unitPrice || 0),
                        sku: itemCode,
                        type: item.itemType || "PRODUCT",
                    };
                });
                // Calculate status emoji
                const statusEmojis = {
                    PENDING: "⏳",
                    CONFIRMED: "✅",
                    PROCESSING: "🔄",
                    SHIPPED: "🚚",
                    DELIVERED: "📦",
                    CANCELLED: "❌",
                };
                // Check for available documents (invoice, credit note)
                const documents = [];
                // Invoice is always available for confirmed+ orders
                if (["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status)) {
                    documents.push({
                        type: "invoice",
                        label: "Fattura",
                        available: true,
                    });
                }
                // Credit note only if exists (check if order has related credit notes)
                const creditNote = yield this.prisma.orders.findFirst({
                    where: {
                        workspaceId: workspaceId,
                        customerId: customer.id,
                        notes: {
                            contains: `NOTA_CREDITO_${order.orderCode}`,
                        },
                    },
                });
                if (creditNote) {
                    documents.push({
                        type: "credit_note",
                        label: "Nota di Credito",
                        available: true,
                    });
                }
                // 🔗 Generate secure link to order detail page
                let orderDetailLink = "";
                try {
                    const secureTokenService = new secure_token_service_1.SecureTokenService();
                    const orderToken = yield secureTokenService.createToken("orders", workspaceId, { customerId: customer.id, workspaceId, orderCode: order.orderCode }, "1h", // Valid for 1 hour
                    undefined, customer.phone, undefined, customer.id);
                    orderDetailLink = yield link_generator_service_1.linkGeneratorService.generateOrdersLink(orderToken, workspaceId, order.orderCode);
                    logger_1.default.info(`📋 Generated order detail link: ${orderDetailLink}`);
                }
                catch (linkError) {
                    logger_1.default.error("❌ Error generating order detail link:", linkError);
                }
                const result = {
                    success: true,
                    order: {
                        orderCode: order.orderCode,
                        status: order.status,
                        statusEmoji: statusEmojis[order.status] || "📦",
                        createdAt: order.createdAt,
                        updatedAt: order.updatedAt,
                        totalAmount: order.totalAmount,
                        subtotalAmount: order.totalAmount - (order.shippingAmount || 0) - (order.taxAmount || 0) + (order.discountAmount || 0),
                        shippingAmount: order.shippingAmount || 0,
                        taxAmount: order.taxAmount || 0,
                        discountAmount: order.discountAmount || 0,
                        items: orderItems, // Use mapped items
                        itemsCount: orderItems.length,
                        trackingNumber: order.trackingNumber || null,
                        shippingAddress: order.shippingAddress || null,
                        notes: order.notes || null,
                        documents: documents,
                        orderDetailLink: orderDetailLink, // 🆕 Link to order detail page
                    },
                    customer: {
                        name: ((_a = order.customer) === null || _a === void 0 ? void 0 : _a.name) || "Cliente",
                    },
                };
                logger_1.default.info("📋 FunctionHandlerService: getOrderDetails result:", {
                    orderCode: result.order.orderCode,
                    itemsCount: result.order.itemsCount,
                    totalAmount: result.order.totalAmount,
                    documentsCount: result.order.documents.length,
                    hasDetailLink: !!orderDetailLink,
                });
                return result;
            }
            catch (error) {
                logger_1.default.error("❌ FunctionHandlerService: Error in handleGetOrderDetails:", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Errore interno del server",
                    errorType: "internal_error",
                };
            }
        });
    }
    // =============================================================================
    // 🚚 SHIPMENT TRACKING METHODS
    // =============================================================================
    /**
     * Gestisce la richiesta di tracking della spedizione
    /**
     * Aggiunge un prodotto al carrello (versione semplice)
     */
    /**
     * Rimuove un prodotto dal carrello
     */
    searchProducts(query, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const products = yield this.prisma.products.findMany({
                    where: {
                        workspaceId,
                        isActive: true,
                        OR: [
                            { name: { contains: query, mode: "insensitive" } },
                            { description: { contains: query, mode: "insensitive" } },
                        ],
                    },
                    take: 10,
                });
                return {
                    success: true,
                    products: products.map((product) => ({
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        description: product.description,
                        stock: product.stock,
                        sku: product.sku,
                    })),
                    query,
                    totalFound: products.length,
                };
            }
            catch (error) {
                logger_1.default.error("❌ Errore in searchProducts:", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Errore interno",
                };
            }
        });
    }
    // =============================================================================
    // 📄 DOCUMENTATION METHODS
    // =============================================================================
    /**
     * Cerca nei documenti
     */
    searchDocuments(query, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.warn("⚠️  searchDocuments called but RAG feature is disabled");
            return {
                success: false,
                error: "RAG/Documents feature not available",
                results: [],
            };
        });
    }
    /**
     * Ottiene informazioni FAQ
     */
    getFaqInfo(question, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const faqs = yield this.prisma.fAQ.findMany({
                    where: {
                        workspaceId,
                        isActive: true, // ✅ Only return active FAQs
                        OR: [
                            { question: { contains: question, mode: "insensitive" } },
                            { answer: { contains: question, mode: "insensitive" } },
                        ],
                    },
                    take: 5,
                });
                return {
                    success: true,
                    faqs: faqs.map((faq) => ({
                        id: faq.id,
                        question: faq.question,
                        answer: faq.answer,
                    })),
                    query: question,
                };
            }
            catch (error) {
                logger_1.default.error("❌ Errore in getFaqInfo:", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Errore interno",
                };
            }
        });
    }
    // =============================================================================
    // 🧹 UTILITY METHODS
    // =============================================================================
    /**
     * Pulisce le sessioni di disambiguazione scadute
     */
    cleanExpiredSessions() {
        const now = Date.now();
        for (const [sessionId, session] of this.disambiguationSessions.entries()) {
            if (now - session.lastActivity > this.SESSION_TTL) {
                this.disambiguationSessions.delete(sessionId);
                logger_1.default.info(`🧹 Sessione scaduta rimossa: ${sessionId}`);
            }
        }
    }
    /**
     * Genera un saluto basato sull'ora del giorno
     */
    getTimeBasedGreeting(language = "it") {
        const hour = new Date().getHours();
        if (language === "en") {
            if (hour < 12)
                return "Good morning!";
            if (hour < 18)
                return "Good afternoon!";
            return "Good evening!";
        }
        // Default italiano
        if (hour < 12)
            return "Buongiorno!";
        if (hour < 18)
            return "Buon pomeriggio!";
        return "Buonasera!";
    }
    /**
     * Calcola il prezzo personalizzato per il cliente
     */
    calculateCustomerPrice(basePrice_1) {
        return __awaiter(this, arguments, void 0, function* (basePrice, customerId = null) {
            if (!customerId) {
                return basePrice;
            }
            try {
                const customer = yield this.prisma.customers.findUnique({
                    where: { id: customerId },
                });
                if (!customer) {
                    logger_1.default.warn(`⚠️ Cliente non trovato: ${customerId}`);
                    return basePrice;
                }
                // Applica eventuali sconti personalizzati
                const discountPercent = customer.discount || 0;
                return basePrice * (1 - discountPercent / 100);
            }
            catch (error) {
                logger_1.default.error("❌ Errore nel calcolo prezzo cliente:", error);
                return basePrice;
            }
        });
    }
    /**
     * Handle contact operator request
     */
    handleContactOperator(params, customer, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🔧 FunctionHandlerService: handleContactOperator called");
                // Import the CallingFunctionsService
                const { CallingFunctionsService, } = require("../../services/calling-functions.service");
                const callingFunctionsService = new CallingFunctionsService();
                // Call the contactOperator function with required phoneNumber parameter
                const result = yield callingFunctionsService.contactOperator({
                    message: params.message || "",
                    phoneNumber: (customer === null || customer === void 0 ? void 0 : customer.phone) || "", // Ora usiamo phoneNumber
                    customerId: (customer === null || customer === void 0 ? void 0 : customer.id) || "",
                    workspaceId: workspaceId,
                });
                logger_1.default.info("🔧 contactOperator result:", result);
                return result;
            }
            catch (error) {
                logger_1.default.error("❌ Error in handleContactOperator:", error);
                return {
                    success: false,
                    error: error.message || "Error contacting operator",
                    message: "Errore nel contattare l'operatore",
                };
            }
        });
    }
    /**
     * Aggiungi prodotto al carrello
     */
    handleAddProduct(params, customer, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🛒 FunctionHandlerService: handleAddProduct called with:", params);
                // Validazione parametri
                if (!params.sku || !(customer === null || customer === void 0 ? void 0 : customer.id)) {
                    logger_1.default.error("❌ Missing sku or customerId");
                    return {
                        success: false,
                        error: "Parametri richiesti mancanti",
                        message: "Impossibile aggiungere il prodotto. Parametri incompleti.",
                    };
                }
                // Import the calling function
                const { addProduct, } = require("../../domain/calling-functions/addProduct");
                const result = yield addProduct({
                    customerId: customer.id,
                    workspaceId: workspaceId,
                    sku: params.sku,
                    quantity: params.quantity || 1,
                    notes: params.notes,
                });
                logger_1.default.info("✅ addProduct result:", result);
                return result;
            }
            catch (error) {
                logger_1.default.error("❌ Error in handleAddProduct:", error);
                return {
                    success: false,
                    error: error.message || "Error adding product",
                    message: "Impossibile aggiungere il prodotto al carrello.",
                };
            }
        });
    }
    /**
     * Ripeti l'ultimo ordine
     */
    handleRepeatOrder(params, customer, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🔄 FunctionHandlerService: handleRepeatOrder called with:", params);
                if (!(customer === null || customer === void 0 ? void 0 : customer.id)) {
                    logger_1.default.error("❌ Missing customerId");
                    return {
                        success: false,
                        error: "Cliente non trovato",
                        message: "Impossibile ripetere l'ordine. Cliente non identificato.",
                    };
                }
                // Import the calling function
                const { repeatOrder, } = require("../../domain/calling-functions/repeatOrder");
                const result = yield repeatOrder({
                    customerId: customer.id,
                    workspaceId: workspaceId,
                    orderCode: params.orderCode,
                });
                logger_1.default.info("✅ repeatOrder result:", result);
                return result;
            }
            catch (error) {
                logger_1.default.error("❌ Error in handleRepeatOrder:", error);
                return {
                    success: false,
                    error: error.message || "Error repeating order",
                    message: "Impossibile ripetere l'ordine.",
                };
            }
        });
    }
    /**
     * 🔍 Handle searchProduct - Background analytics tracking
     * Registers product searches without interrupting LLM response
     */
    handleSearchProduct(params, customer, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🔍 FunctionHandlerService: handleSearchProduct called with:", params);
                if (!(customer === null || customer === void 0 ? void 0 : customer.id)) {
                    logger_1.default.error("❌ Missing customerId");
                    return {
                        success: false,
                        error: "Cliente non trovato",
                        message: "Impossibile registrare la ricerca.",
                    };
                }
                if (!params.productName) {
                    logger_1.default.error("❌ Missing productName");
                    return {
                        success: false,
                        error: "Nome prodotto non fornito",
                        message: "Impossibile registrare la ricerca.",
                    };
                }
                // Import the calling function
                const { searchProduct, } = require("../../domain/calling-functions/searchProduct");
                const result = yield searchProduct({
                    customerId: customer.id,
                    workspaceId: workspaceId,
                    productName: params.productName,
                });
                logger_1.default.info("✅ searchProduct result:", result);
                return result;
            }
            catch (error) {
                logger_1.default.error("❌ Error in handleSearchProduct:", error);
                return {
                    success: false,
                    error: error.message || "Error registering search",
                    message: "Impossibile registrare la ricerca.",
                };
            }
        });
    }
}
exports.FunctionHandlerService = FunctionHandlerService;
//# sourceMappingURL=function-handler.service.js.map