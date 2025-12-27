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
exports.pushMessagingService = exports.PushMessageType = void 0;
const database_1 = require("@echatbot/database");
const billing_prices_enum_1 = require("../domain/enums/billing-prices.enum");
const logger_1 = __importDefault(require("../utils/logger"));
const usage_service_1 = require("./usage.service");
// prisma imported
/**
 * 📱 PUSH MESSAGING SERVICE - Sistema Centralizzato
 *
 * Gestisce tutti i push messaging WhatsApp con:
 * - 🌍 Supporto multilingua automatico
 * - 💰 Tracking costi da BillingPrices enum (SINGLE SOURCE OF TRUTH)
 * - 📊 Integrazione analytics
 * - 🔄 Template messaging unificati
 *
 * @author Andrea Gelso
 */
var PushMessageType;
(function (PushMessageType) {
    PushMessageType["ORDER_CONFIRMED"] = "ORDER_CONFIRMED";
    PushMessageType["USER_REGISTERED"] = "USER_REGISTERED";
    PushMessageType["DISCOUNT_UPDATED"] = "DISCOUNT_UPDATED";
    PushMessageType["NEW_OFFER"] = "NEW_OFFER";
    PushMessageType["CHATBOT_REACTIVATED"] = "CHATBOT_REACTIVATED";
})(PushMessageType || (exports.PushMessageType = PushMessageType = {}));
/**
 * Template messaggi per tutti i tipi di push
 */
const MESSAGE_TEMPLATES = {
    [PushMessageType.ORDER_CONFIRMED]: {
        it: "🎉 Ordine confermato! Numero ordine: {orderCode}. Ti contatteremo per i dettagli di consegna.",
        en: "🎉 Order confirmed! Order number: {orderCode}. We'll contact you for delivery details.",
        es: "🎉 ¡Pedido confirmado! Número de pedido: {orderCode}. Te contactaremos para los detalles de entrega.",
        pt: "🎉 Pedido confirmado! Número do pedido: {orderCode}. Entraremos em contato para os detalhes da entrega.",
        fr: "🎉 Commande confirmée! Numéro de commande: {orderCode}. Nous vous contactrons pour les détails de livraison.",
        de: "🎉 Bestellung bestätigt! Bestellnummer: {orderCode}. Wir werden Sie bezüglich der Lieferdetails kontaktieren.",
    },
    [PushMessageType.USER_REGISTERED]: {
        it: "👋 Benvenuto! Grazie per esserti registrato al nostro servizio di IA presto verrai attivato dai nostri commerciali.",
        en: "👋 Welcome! Thank you for registering to our AI service, you will be activated soon by our sales team.",
        es: "👋 ¡Bienvenido! Gracias por registrarte en nuestro servicio de IA, pronto serás activado por nuestro equipo comercial.",
        pt: "👋 Bem-vindo! Obrigado por se registrar em nosso serviço de IA, você será ativado em breve por nossa equipe de vendas.",
        fr: "👋 Bienvenue! Merci de vous être inscrit à notre service d'IA, vous serez bientôt activé par notre équipe commerciale.",
        de: "👋 Willkommen! Danke für die Anmeldung bei unserem KI-Service, Sie werden bald von unserem Vertriebsteam aktiviert.",
    },
    [PushMessageType.DISCOUNT_UPDATED]: {
        it: "💸 Ciao {customerName}! Da oggi puoi usufruire del {discountPercentage}% di sconto sui nostri prodotti.",
        en: "💸 Hi {customerName}! From today you can enjoy {discountPercentage}% discount on our products.",
        es: "💸 ¡Hola {customerName}! Desde hoy puedes disfrutar de {discountPercentage}% de descuento en nuestros productos.",
        pt: "💸 Olá {customerName}! A partir de hoje você pode aproveitar {discountPercentage}% de desconto em nossos produtos.",
        fr: "💸 Salut {customerName}! À partir d'aujourd'hui, vous pouvez bénéficier de {discountPercentage}% de remise sur nos produits.",
        de: "💸 Hallo {customerName}! Ab heute können Sie {discountPercentage}% Rabatt auf unsere Produkte genießen.",
    },
    [PushMessageType.NEW_OFFER]: {
        it: "🎯 Ciao {customerName}! Abbiamo un'offerta del {offerPercentage}% sulla categoria: {categoryName} fino al {offerEndDate}",
        en: "🎯 Hi {customerName}! We have a {offerPercentage}% offer on category: {categoryName} until {offerEndDate}",
        es: "🎯 ¡Hola {customerName}! Tenemos una oferta del {offerPercentage}% en la categoría: {categoryName} hasta el {offerEndDate}",
        pt: "🎯 Olá {customerName}! Temos uma oferta de {offerPercentage}% na categoria: {categoryName} até {offerEndDate}",
        fr: "🎯 Salut {customerName}! Nous avons une offre de {offerPercentage}% sur la catégorie: {categoryName} jusqu'au {offerEndDate}",
        de: "🎯 Hallo {customerName}! Wir haben ein {offerPercentage}% Angebot für die Kategorie: {categoryName} bis {offerEndDate}",
    },
    [PushMessageType.CHATBOT_REACTIVATED]: {
        it: "🤖 Ciao {customerName}, il chatbot è ora disponibile, come posso aiutarti oggi?",
        en: "🤖 Hi {customerName}, the chatbot is now available, how can I help you today?",
        es: "🤖 ¡Hola {customerName}, el chatbot ya está disponible, ¿cómo puedo ayudarte hoy?",
        pt: "🤖 Olá {customerName}, o chatbot está agora disponível, como posso ajudá-lo hoje?",
        fr: "🤖 Salut {customerName}, le chatbot est maintenant disponible, comment puis-je vous aider aujourd'hui?",
        de: "🤖 Hallo {customerName}, der Chatbot ist jetzt verfügbar, wie kann ich Ihnen heute helfen?",
    },
};
exports.pushMessagingService = {
    /**
     * 📱 Invia push message centralizzato
     *
     * @param data - Dati del messaggio push
     * @returns Promise<boolean> - Success status
     */
    sendPushMessage(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`[PUSH-MESSAGING] 🚀 Sending ${data.type} push to ${data.customerPhone}`);
                // 1. Ottieni dati customer completi
                const customer = yield this.getCustomerData(data.customerId, data.workspaceId);
                if (!customer) {
                    logger_1.default.error(`[PUSH-MESSAGING] ❌ Customer ${data.customerId} not found`);
                    return false;
                }
                // 2. Rileva lingua (auto o da parametro) e mappa formato
                const languageMapping = {
                    IT: "it",
                    ENG: "en",
                    ESP: "es",
                    PRT: "pt",
                    FR: "fr",
                    DE: "de",
                };
                const rawLanguage = data.customerLanguage || customer.language || "it";
                const language = languageMapping[rawLanguage] || rawLanguage || "it";
                logger_1.default.info(`[PUSH-MESSAGING] 🌍 Language mapping: ${customer.language} -> ${language} for customer ${customer.name}`);
                // 3. Genera messaggio dalla template
                const message = this.generateMessage(data.type, language, Object.assign(Object.assign({}, data.templateData), { customerName: customer.name }));
                // 4. Salva messaggio in chat history prima dell'invio
                const chatSession = yield this.ensureChatSession(customer.id, data.workspaceId);
                // 5. 📱 Invio effettivo WhatsApp
                const whatsappResult = yield this.sendWhatsAppMessage(data.customerPhone, message, data.workspaceId);
                // 6. Salva messaggio con status corretto basato su risultato WhatsApp
                const messageStatus = whatsappResult.success ? "sent" : "failed";
                yield this.saveOutboundMessage(chatSession.id, message, data.type, messageStatus, whatsappResult.messageId);
                // 7. 💰 Track usage cost based on message type (using centralized pricing)
                const messagePrice = this.getMessagePrice(data.type);
                if (messagePrice > 0) {
                    yield this.trackPushCost(data.workspaceId, data.customerId, messagePrice, data.type);
                    logger_1.default.info(`[PUSH-MESSAGING] 💰 Cost tracked: €${messagePrice.toFixed(2)} for ${data.type}`);
                }
                else {
                    logger_1.default.info(`[PUSH-MESSAGING] 🆓 FREE message: ${data.type} (€${messagePrice.toFixed(2)})`);
                }
                if (whatsappResult.success) {
                    logger_1.default.info(`[PUSH-MESSAGING] ✅ Push sent successfully: ${data.type} to ${customer.name}`);
                    return true;
                }
                else {
                    logger_1.default.error(`[PUSH-MESSAGING] ❌ Push failed: ${whatsappResult.error}`);
                    return false;
                }
            }
            catch (error) {
                logger_1.default.error(`[PUSH-MESSAGING] ❌ Error sending push message:`, error);
                return false;
            }
        });
    },
    /**
     * 🌍 Genera messaggio dalla template con supporto multilingua
     */
    generateMessage(type, language, templateData = {}) {
        const template = MESSAGE_TEMPLATES[type];
        let message = template[language] || template.it;
        // Sostituisci placeholder con dati effettivi
        Object.entries(templateData).forEach(([key, value]) => {
            if (value !== undefined) {
                message = message.replace(`{${key}}`, String(value));
            }
        });
        return message;
    },
    /**
     * 👤 Ottieni dati customer completi
     */
    getCustomerData(customerId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_1.prisma.customers.findFirst({
                where: {
                    id: customerId,
                    workspaceId: workspaceId,
                },
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    language: true,
                    workspaceId: true,
                },
            });
        });
    },
    /**
     * 💬 Assicura esistenza chat session
     */
    ensureChatSession(customerId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            let chatSession = yield database_1.prisma.chatSession.findFirst({
                where: {
                    customerId: customerId,
                    workspaceId: workspaceId,
                    status: "active",
                },
            });
            if (!chatSession) {
                chatSession = yield database_1.prisma.chatSession.create({
                    data: {
                        customerId: customerId,
                        workspaceId: workspaceId,
                        status: "active",
                        context: {},
                    },
                });
            }
            return chatSession;
        });
    },
    /**
     * 💾 Salva messaggio outbound in history con status
     * 🔧 CRITICAL: Use conversationMessage table (NEW) for consistency
     */
    saveOutboundMessage(chatSessionId_1, content_1, pushType_1) {
        return __awaiter(this, arguments, void 0, function* (chatSessionId, content, pushType, messageStatus = "sent", messageId) {
            // Get chat session to retrieve workspaceId and customerId
            const chatSession = yield database_1.prisma.chatSession.findUnique({
                where: { id: chatSessionId },
                select: { workspaceId: true, customerId: true },
            });
            if (!chatSession) {
                logger_1.default.error(`[PUSH-MESSAGING] ❌ Chat session ${chatSessionId} not found - cannot save message`);
                return;
            }
            // Save to conversationMessage table (NEW format - same as all other messages)
            yield database_1.prisma.conversationMessage.create({
                data: {
                    workspaceId: chatSession.workspaceId,
                    customerId: chatSession.customerId,
                    conversationId: chatSessionId,
                    role: "assistant", // Bot response
                    content: content,
                    agentType: "PUSH_MESSAGING",
                    tokensUsed: 0, // No LLM tokens (static template message)
                    debugInfo: JSON.stringify({
                        source: "push_messaging",
                        pushType: pushType,
                        messageStatus: messageStatus,
                        whatsappMessageId: messageId,
                        timestamp: new Date().toISOString(),
                    }),
                },
            });
            logger_1.default.info(`[PUSH-MESSAGING] 💾 Message saved with status: ${messageStatus}${messageId ? `, messageId: ${messageId}` : ""}`);
        });
    },
    /**
     * 💰 Get message price - ALL push notifications use PUSH_CAMPAIGN price
     * Simplified: only 2 prices exist (MESSAGE and PUSH_CAMPAIGN)
     */
    getMessagePrice(_type) {
        // All push notifications have the same price
        return billing_prices_enum_1.BillingPrices.PUSH_CAMPAIGN;
    },
    /**
     * 💰 Traccia costo push message con prezzo configurabile
     */
    trackPushCost(workspaceId, customerId, price, messageType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (price === 0) {
                    logger_1.default.info(`[PUSH-MESSAGING] 🆓 FREE message - no cost tracking for ${messageType}`);
                    return;
                }
                yield usage_service_1.usageService.trackUsage({
                    workspaceId: workspaceId,
                    clientId: customerId,
                    price: price,
                });
                logger_1.default.info(`[PUSH-MESSAGING] ✅ Cost tracked: €${price.toFixed(2)} for ${messageType}`);
            }
            catch (error) {
                logger_1.default.error(`[PUSH-MESSAGING] ❌ Error tracking push cost:`, error);
                throw error;
            }
        });
    },
    /**
     * 📱 Invio effettivo WhatsApp via Business API o Dev Mode
     */
    sendWhatsAppMessage(phoneNumber, message, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                logger_1.default.info(`[PUSH-MESSAGING] 📱 Sending WhatsApp message to ${phoneNumber}`);
                // Get workspace WhatsApp settings
                const workspace = yield database_1.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: {
                        whatsappApiKey: true,
                        whatsappPhoneNumber: true,
                    },
                });
                if (!workspace ||
                    !workspace.whatsappApiKey ||
                    !workspace.whatsappPhoneNumber) {
                    logger_1.default.error(`[PUSH-MESSAGING] ❌ WhatsApp settings not configured for workspace ${workspaceId}`);
                    return { success: false, error: "WhatsApp settings not configured" };
                }
                // 🔧 DEV MODE: Simulate successful sending for development
                if (workspace.whatsappApiKey === "DEV_MODE_SIMULATOR_TOKEN_FOR_TESTING") {
                    logger_1.default.info(`[PUSH-MESSAGING] 🔧 DEV MODE: Simulating WhatsApp message send to ${phoneNumber}`);
                    logger_1.default.info(`[PUSH-MESSAGING] 🔧 DEV MODE: Message content: ${message}`);
                    const simulatedMessageId = `dev_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                    logger_1.default.info(`[PUSH-MESSAGING] ✅ DEV MODE: Simulated message sent successfully`, {
                        messageId: simulatedMessageId,
                        phoneNumber,
                        workspaceId,
                        note: "This is a simulated message for development - no real WhatsApp message was sent",
                    });
                    return {
                        success: true,
                        messageId: simulatedMessageId,
                        status: "sent",
                        devMode: true,
                    };
                }
                // PRODUCTION MODE: Real WhatsApp API call
                const whatsappApiUrl = `https://graph.facebook.com/v18.0/${workspace.whatsappPhoneNumber}/messages`;
                const whatsappPayload = {
                    messaging_product: "whatsapp",
                    to: phoneNumber.replace("+", ""),
                    type: "text",
                    text: {
                        body: message,
                    },
                };
                logger_1.default.info(`[PUSH-MESSAGING] 🚀 Calling WhatsApp API: ${whatsappApiUrl}`);
                const response = yield fetch(whatsappApiUrl, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${workspace.whatsappApiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(whatsappPayload),
                });
                const responseData = yield response.json();
                if (response.ok && ((_b = (_a = responseData.messages) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.id)) {
                    logger_1.default.info(`[PUSH-MESSAGING] ✅ WhatsApp message sent successfully to ${phoneNumber}`, {
                        messageId: responseData.messages[0].id,
                        phoneNumber,
                        workspaceId,
                    });
                    return {
                        success: true,
                        messageId: responseData.messages[0].id,
                        status: "sent",
                    };
                }
                else {
                    logger_1.default.error(`[PUSH-MESSAGING] ❌ WhatsApp API error:`, responseData);
                    return {
                        success: false,
                        error: ((_c = responseData.error) === null || _c === void 0 ? void 0 : _c.message) || "Unknown WhatsApp API error",
                        details: responseData,
                    };
                }
            }
            catch (error) {
                logger_1.default.error(`[PUSH-MESSAGING] ❌ Error sending WhatsApp message:`, error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                };
            }
        });
    },
    /**
     * 📊 Helper per inviare diversi tipi di push message
     */
    sendOrderConfirmation(customerId, customerPhone, workspaceId, orderCode) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.sendPushMessage({
                workspaceId,
                customerId,
                customerPhone,
                type: PushMessageType.ORDER_CONFIRMED,
                templateData: { orderCode },
            });
        });
    },
    sendUserWelcome(customerId, customerPhone, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.sendPushMessage({
                workspaceId,
                customerId,
                customerPhone,
                type: PushMessageType.USER_REGISTERED,
            });
        });
    },
    sendDiscountUpdate(customerId, customerPhone, workspaceId, discountPercentage) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.sendPushMessage({
                workspaceId,
                customerId,
                customerPhone,
                type: PushMessageType.DISCOUNT_UPDATED,
                templateData: { discountPercentage },
            });
        });
    },
    sendNewOffer(customerId, customerPhone, workspaceId, offerPercentage, categoryName, offerEndDate) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.sendPushMessage({
                workspaceId,
                customerId,
                customerPhone,
                type: PushMessageType.NEW_OFFER,
                templateData: { offerPercentage, categoryName, offerEndDate },
            });
        });
    },
    sendChatbotReactivated(customerId, customerPhone, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.sendPushMessage({
                workspaceId,
                customerId,
                customerPhone,
                type: PushMessageType.CHATBOT_REACTIVATED,
            });
        });
    },
};
//# sourceMappingURL=push-messaging.service.js.map