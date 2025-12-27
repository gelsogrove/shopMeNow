"use strict";
/**
 * RepeatOrder - LLM-Callable Function
 *
 * Repeats a previous order by adding all its items to the current cart.
 * Used when customer says: "Voglio riordinare", "Ripeti l'ordine", "Riordino", etc.
 *
 * ⚠️ IMPORTANTE: Questa funzione aggiunge al carrello esistente (non lo sostituisce)
 * ⚠️ IMPORTANT: Uses PriceCalculationService to ensure consistent pricing with rounding
 *
 * @see docs/prompt_agent.md - Sezione "repeatOrder()"
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
exports.repeatOrder = repeatOrder;
const logger_1 = __importDefault(require("../../utils/logger"));
const price_calculation_service_1 = require("../../application/services/price-calculation.service");
const database_1 = require("@echatbot/database");
/**
 * Ripete un ordine precedente aggiungendo i prodotti al carrello
 *
 * @param request - Request parameters
 * @returns Result con confirmazione e link carrello
 */
function repeatOrder(request) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        try {
            logger_1.default.info("🔄 RepeatOrder called with:", {
                customerId: request.customerId,
                workspaceId: request.workspaceId,
                orderCode: request.orderCode,
            });
            // Validazione parametri obbligatori
            if (!request.customerId || !request.workspaceId) {
                logger_1.default.error("❌ Missing required parameters in RepeatOrder");
                return {
                    success: false,
                    error: "Parametri richiesti mancanti",
                    message: "Impossibile ripetere l'ordine. Parametri incompleti.",
                    timestamp: new Date().toISOString(),
                };
            }
            try {
                // Trova il cliente
                const customer = yield database_1.prisma.customers.findFirst({
                    where: {
                        id: request.customerId,
                        workspaceId: request.workspaceId,
                    },
                });
                if (!customer) {
                    logger_1.default.error("❌ Customer not found in RepeatOrder");
                    return {
                        success: false,
                        error: "Cliente non trovato",
                        message: "Ops {{nameUser}}! 😅\n\n" +
                            "Non riesco a trovare il tuo account nel sistema. Questo è strano!\n\n" +
                            "📞 Contatta il nostro supporto: {{agentPhone}}\n" +
                            "📧 Email: {{agentEmail}}\n\n" +
                            "Ti aiuteremo subito! 🚀",
                        timestamp: new Date().toISOString(),
                    };
                }
                // Se orderCode non è specificato, prendi l'ultimo ordine
                let order;
                let anyOrder = null;
                if (request.orderCode) {
                    // Check if order exists regardless of customer (for security validation)
                    anyOrder = yield database_1.prisma.orders.findFirst({
                        where: {
                            orderCode: request.orderCode,
                        }
                    });
                    order = yield database_1.prisma.orders.findFirst({
                        where: {
                            orderCode: request.orderCode,
                            customerId: request.customerId,
                            workspaceId: request.workspaceId,
                            deletedAt: null, // 🔧 FIX: Add soft delete filter
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
                else {
                    // Prendi l'ultimo ordine (più recente)
                    order = yield database_1.prisma.orders.findFirst({
                        where: {
                            customerId: request.customerId,
                            workspaceId: request.workspaceId,
                            deletedAt: null, // 🔧 FIX: Add soft delete filter
                        },
                        orderBy: {
                            createdAt: "desc",
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
                logger_1.default.debug("🔍 RepeatOrder found order:", {
                    orderFound: !!order,
                    orderCode: order === null || order === void 0 ? void 0 : order.orderCode,
                    itemsCount: ((_a = order === null || order === void 0 ? void 0 : order.items) === null || _a === void 0 ? void 0 : _a.length) || 0,
                    orderStatus: order === null || order === void 0 ? void 0 : order.status,
                });
                if (!order || !order.items || order.items.length === 0) {
                    // Controlla se l'ordine esiste ma appartiene a un altro customer
                    if (anyOrder && !order) {
                        logger_1.default.warn("⚠️ Order exists but belongs to different customer", {
                            orderCode: request.orderCode,
                            requestCustomerId: request.customerId,
                            actualCustomerId: anyOrder.customerId
                        });
                        return {
                            success: false,
                            error: "Order not accessible",
                            message: "Ops {{nameUser}}! 😅\n\nQuest'ordine non ti appartiene o non è più disponibile.\n\n🔍 Prova con:\n• **\"ordini\"** - per vedere i tuoi ordini\n• **\"prodotti\"** - per fare un nuovo ordine\n\nCome posso aiutarti? 😊",
                            timestamp: new Date().toISOString(),
                        };
                    }
                    logger_1.default.error("❌ No order found to repeat");
                    logger_1.default.debug("🔍 RepeatOrder query details:", {
                        orderCode: request.orderCode,
                        customerId: request.customerId,
                        workspaceId: request.workspaceId,
                        queryUsed: request.orderCode ? "by orderCode" : "by latest",
                    });
                    return {
                        success: false,
                        error: "Nessun ordine trovato",
                        message: "Ciao {{nameUser}}! 👋\n\n" +
                            "Non trovo ordini precedenti da ripetere. È la prima volta che ordini da noi? 🎉\n\n" +
                            "Nessun problema! Dai un'occhiata alle nostre **offerte speciali** e ai prodotti disponibili!\n\n" +
                            "💡 Hai uno sconto del **{{discountUser}}%** su tutti i prodotti! 🛍️\n\n" +
                            "Cosa ti piacerebbe ordinare oggi? 😊",
                        timestamp: new Date().toISOString(),
                    };
                }
                // Svuota il carrello esistente (opzionale, per ricominciare pulito)
                let cart = yield database_1.prisma.carts.findFirst({
                    where: {
                        customerId: request.customerId,
                        workspaceId: request.workspaceId,
                    },
                });
                if (!cart) {
                    // Crea carrello se non esiste
                    cart = yield database_1.prisma.carts.create({
                        data: {
                            customerId: request.customerId,
                            workspaceId: request.workspaceId,
                        },
                    });
                }
                // Opzionale: svuota il carrello prima di aggiungere i nuovi prodotti
                // Commenta questa sezione se vuoi aggiungere ai prodotti esistenti
                yield database_1.prisma.cartItems.deleteMany({
                    where: {
                        cartId: cart.id,
                    },
                });
                // Aggiungi tutti i prodotti/servizi dell'ordine al carrello
                // Raggruppa prodotti per codice e somma le quantità
                let productsAdded = 0;
                const productGroups = {};
                const serviceGroups = {};
                for (const item of order.items) {
                    if (item.itemType === "PRODUCT" && item.product) {
                        const code = item.product.sku; // 🔧 FIX: Use sku, not code
                        if (!code) {
                            logger_1.default.warn(`⚠️ Product ${item.product.name} has no sku, skipping`);
                            continue;
                        }
                        if (!productGroups[code]) {
                            productGroups[code] = { item, totalQty: 0 };
                        }
                        productGroups[code].totalQty += item.quantity;
                    }
                    else if (item.itemType === "SERVICE" && item.service) {
                        const code = item.service.code; // ✅ Services use 'code'
                        if (!code) {
                            logger_1.default.warn(`⚠️ Service ${item.service.name} has no code, skipping`);
                            continue;
                        }
                        if (!serviceGroups[code]) {
                            serviceGroups[code] = { item, totalQty: 0 };
                        }
                        serviceGroups[code].totalQty += item.quantity;
                    }
                }
                // Aggiungi prodotti raggruppati (o aggiorna quantità se già presente)
                for (const code in productGroups) {
                    const { item, totalQty } = productGroups[code];
                    const product = yield database_1.prisma.products.findFirst({
                        where: {
                            sku: code, // 🔧 FIX: Use sku field
                            workspaceId: request.workspaceId,
                        },
                    });
                    if (product && product.stock > 0) {
                        // 🔧 FIX: Check if product already exists in cart
                        const existingCartItem = yield database_1.prisma.cartItems.findFirst({
                            where: {
                                cartId: cart.id,
                                productId: product.id,
                                itemType: "PRODUCT",
                            },
                        });
                        if (existingCartItem) {
                            // Update existing quantity
                            yield database_1.prisma.cartItems.update({
                                where: { id: existingCartItem.id },
                                data: { quantity: existingCartItem.quantity + totalQty },
                            });
                            logger_1.default.info(`✅ Updated product ${product.sku || product.id} (${product.name}): ${existingCartItem.quantity} + ${totalQty} = ${existingCartItem.quantity + totalQty}`);
                        }
                        else {
                            // Create new cart item
                            yield database_1.prisma.cartItems.create({
                                data: {
                                    cartId: cart.id,
                                    productId: product.id,
                                    quantity: totalQty,
                                    itemType: "PRODUCT",
                                    notes: item.notes,
                                },
                            });
                            logger_1.default.info(`✅ Added product ${product.sku} (${product.name}) x${totalQty} to cart`);
                        }
                        productsAdded++;
                    }
                    else {
                        logger_1.default.warn(`⚠️ Product ${code} not found or out of stock`);
                    }
                }
                // Aggiungi servizi raggruppati (o aggiorna quantità se già presente)
                for (const code in serviceGroups) {
                    const { item, totalQty } = serviceGroups[code];
                    const service = yield database_1.prisma.services.findFirst({
                        where: {
                            code,
                            workspaceId: request.workspaceId,
                        },
                    });
                    if (service) {
                        // 🔧 FIX: Check if service already exists in cart
                        const existingCartItem = yield database_1.prisma.cartItems.findFirst({
                            where: {
                                cartId: cart.id,
                                serviceId: service.id,
                                itemType: "SERVICE",
                            },
                        });
                        if (existingCartItem) {
                            // Update existing quantity
                            yield database_1.prisma.cartItems.update({
                                where: { id: existingCartItem.id },
                                data: { quantity: existingCartItem.quantity + totalQty },
                            });
                            logger_1.default.info(`✅ Updated service ${service.code} (${service.name}): ${existingCartItem.quantity} + ${totalQty} = ${existingCartItem.quantity + totalQty}`);
                        }
                        else {
                            // Create new cart item
                            yield database_1.prisma.cartItems.create({
                                data: {
                                    cartId: cart.id,
                                    serviceId: service.id,
                                    quantity: totalQty,
                                    itemType: "SERVICE",
                                    notes: item.notes,
                                },
                            });
                            logger_1.default.info(`✅ Added service ${service.code} (${service.name}) x${totalQty} to cart`);
                        }
                        productsAdded++;
                    }
                    else {
                        logger_1.default.warn(`⚠️ Service ${code} not found`);
                    }
                }
                // Genera link carrello con token sicuro usando il servizio centralizzato
                const CallingFunctionsService = require("../../services/calling-functions.service").CallingFunctionsService;
                const callingFunctionsService = new CallingFunctionsService();
                const cartLinkResult = yield callingFunctionsService.getCartLink({
                    customerId: request.customerId,
                    workspaceId: request.workspaceId,
                });
                if (!cartLinkResult.success || !cartLinkResult.linkUrl) {
                    logger_1.default.error("❌ Failed to generate cart link in RepeatOrder");
                    yield database_1.prisma.$disconnect();
                    return {
                        success: false,
                        error: "Errore generazione link carrello",
                        message: "Si è verificato un errore durante la generazione del link. Riprova.",
                        timestamp: new Date().toISOString(),
                    };
                }
                const cartUrl = cartLinkResult.linkUrl;
                const token = cartLinkResult.token;
                // 🛒 Recupera dettagli carrello per il riepilogo
                const cartWithItems = yield database_1.prisma.carts.findFirst({
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
                // 🔧 Get customer discount from database
                const customerDiscount = customer.discount ? Number(customer.discount) : 0;
                logger_1.default.info(`📊 Customer discount: ${customerDiscount}%`);
                // 🔧 Use PriceCalculationService for consistent pricing (with rounding)
                const priceService = new price_calculation_service_1.PriceCalculationService(database_1.prisma);
                // Calcola totale carrello usando PriceCalculationService
                let originalTotal = 0; // Total before discount
                let cartTotal = 0; // Total after discount (with rounding)
                const cartSummary = [];
                if (cartWithItems === null || cartWithItems === void 0 ? void 0 : cartWithItems.items) {
                    // Get product IDs for price calculation
                    const productIds = cartWithItems.items
                        .filter(item => item.product)
                        .map(item => item.product.id);
                    // Calculate prices with discounts and rounding
                    let productsWithPrices = [];
                    if (productIds.length > 0) {
                        const priceResult = yield priceService.calculatePricesWithDiscounts(request.workspaceId, productIds, customerDiscount);
                        productsWithPrices = priceResult.products;
                    }
                    for (const item of cartWithItems.items) {
                        if (item.product) {
                            // Find the calculated price for this product
                            const productWithPrice = productsWithPrices.find(p => p.id === item.product.id);
                            // Use finalPrice from PriceCalculationService (already discounted and rounded)
                            const unitPrice = (_b = productWithPrice === null || productWithPrice === void 0 ? void 0 : productWithPrice.finalPrice) !== null && _b !== void 0 ? _b : Number(item.product.price);
                            const originalUnitPrice = (_c = productWithPrice === null || productWithPrice === void 0 ? void 0 : productWithPrice.originalPrice) !== null && _c !== void 0 ? _c : Number(item.product.price);
                            const itemTotal = unitPrice * item.quantity;
                            const itemOriginalTotal = originalUnitPrice * item.quantity;
                            cartTotal += itemTotal;
                            originalTotal += itemOriginalTotal;
                            cartSummary.push(`• ${item.product.name} x${item.quantity} - €${itemTotal.toFixed(2)}`);
                            logger_1.default.info(`📦 Product: ${item.product.name}, qty: ${item.quantity}, unitPrice: €${unitPrice.toFixed(2)}, total: €${itemTotal.toFixed(2)}`);
                        }
                        else if (item.service) {
                            const price = Number(item.service.price) || 0;
                            const itemTotal = price * item.quantity;
                            cartTotal += itemTotal;
                            originalTotal += itemTotal; // Services don't get discount
                            cartSummary.push(`• ${item.service.name} x${item.quantity} - €${itemTotal.toFixed(2)}`);
                        }
                    }
                }
                yield database_1.prisma.$disconnect();
                logger_1.default.info("✅ RepeatOrder success: added", productsAdded, "products");
                // Calculate discount amount (original - discounted)
                const discountAmount = originalTotal - cartTotal;
                // 🔧 Messaggio con riepilogo carrello - chiede conferma finale
                // Se c'è sconto, mostra breakdown; altrimenti mostra solo totale
                let priceSection = "";
                if (customerDiscount > 0 && discountAmount > 0) {
                    priceSection = `💰 **Totale:** €${originalTotal.toFixed(2)}
🎁 **Sconto ${customerDiscount}%:** -€${discountAmount.toFixed(2)}
💵 **Totale finale:** €${cartTotal.toFixed(2)}`;
                }
                else {
                    priceSection = `💰 **Totale:** €${cartTotal.toFixed(2)}`;
                }
                const message = `Perfetto {{nameUser}}! ✅

Ho aggiunto **${productsAdded} prodotto/i** dal tuo ultimo ordine (${order.orderCode}) al carrello! 🛒

---

🛒 **Riepilogo Carrello:**

${cartSummary.join("\n")}

${priceSection}

---

📍 **Verifica i tuoi dati di spedizione:**
[LINK_PROFILE_WITH_TOKEN]

✅ I dati sono corretti? Rispondi **"confermo"** o **"ok"** per procedere con l'ordine.`;
                return {
                    success: true,
                    message,
                    cartCode: cart.id,
                    orderCode: order.orderCode,
                    productsAdded,
                    cartTotal,
                    cartUrl,
                    expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // 1 ora
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                logger_1.default.error("❌ Error in RepeatOrder database operations:", error);
                yield database_1.prisma.$disconnect();
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Errore del database",
                    message: "Ops {{nameUser}}! 😅\n\n" +
                        "Si è verificato un problema tecnico durante il ripristino del tuo ordine.\n\n" +
                        "Non preoccuparti! Puoi:\n" +
                        "• Riprovare tra qualche minuto ⏰\n" +
                        "• Fare un nuovo ordine manualmente 🛍️\n" +
                        "• Contattare il supporto: {{agentPhone}} 📞\n\n" +
                        "Ci scusiamo per l'inconveniente! 🙏",
                    timestamp: new Date().toISOString(),
                };
            }
        }
        catch (error) {
            logger_1.default.error("❌ Error in RepeatOrder:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Errore interno",
                message: "Ops {{nameUser}}! 😅\n\n" +
                    "Si è verificato un problema tecnico durante il ripristino del tuo ordine.\n\n" +
                    "Non preoccuparti! Puoi:\n" +
                    "• Riprovare tra qualche minuto ⏰\n" +
                    "• Fare un nuovo ordine manualmente 🛍️\n" +
                    "• Contattare il supporto: {{agentPhone}} 📞\n\n" +
                    "Ci scusiamo per l'inconveniente! 🙏",
                timestamp: new Date().toISOString(),
            };
        }
    });
}
//# sourceMappingURL=repeatOrder.js.map