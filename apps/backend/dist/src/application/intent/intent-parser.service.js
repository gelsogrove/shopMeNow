"use strict";
/**
 * IntentParser Service - Code-First LLM Architecture
 *
 * STEP 1 of the pipeline: Parse user message into typed Intent
 *
 * Strategy (in priority order):
 * 1. Pattern matching (deterministic, < 1ms)
 * 2. Keyword matching against known entities from DB (< 10ms)
 * 3. LLM fallback for complex/ambiguous messages (< 500ms)
 *
 * The LLM is ONLY used as a fallback, and even then it only classifies
 * the intent - it doesn't generate responses or call functions.
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
exports.IntentParserService = void 0;
exports.getIntentParser = getIntentParser;
const pattern_matcher_1 = require("./patterns/pattern-matcher");
const history_parser_1 = require("./patterns/history-parser");
const keyword_matcher_1 = require("./patterns/keyword-matcher");
const logger_1 = __importDefault(require("../../utils/logger"));
// =============================================================================
// ENTITY CACHE
// =============================================================================
// Cache known entities per workspace (refreshed every 5 minutes)
const entityCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
// =============================================================================
// INTENT PARSER SERVICE
// =============================================================================
class IntentParserService {
    constructor(prisma, config) {
        var _a, _b, _c;
        this.prisma = prisma;
        this.config = {
            enableLLMFallback: (_a = config === null || config === void 0 ? void 0 : config.enableLLMFallback) !== null && _a !== void 0 ? _a : true,
            llmFallbackThreshold: (_b = config === null || config === void 0 ? void 0 : config.llmFallbackThreshold) !== null && _b !== void 0 ? _b : 0.5,
            maxLLMFallbackTimeMs: (_c = config === null || config === void 0 ? void 0 : config.maxLLMFallbackTimeMs) !== null && _c !== void 0 ? _c : 3000, // 3 seconds for LLM classification
        };
    }
    /**
     * Parse user message into typed Intent
     *
     * @param message - User message to parse
     * @param options - Parsing context (workspace, history, etc.)
     * @returns IntentResult with typed intent and metadata
     */
    parse(message, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            logger_1.default.info(`🧠 IntentParser: Parsing message`, {
                message: message.substring(0, 50),
                workspaceId: options.workspaceId,
                hasHistory: !!options.lastAssistantMessage
            });
            // Build conversation context from history
            const context = (0, history_parser_1.buildContextFromHistory)(options.lastAssistantMessage);
            // STEP 1: Pattern matching (highest priority, deterministic)
            const patternIntent = (0, pattern_matcher_1.matchAllPatterns)(message, context);
            if (patternIntent) {
                const result = {
                    intent: patternIntent,
                    confidence: "HIGH",
                    source: "PATTERN",
                    processingTimeMs: Date.now() - startTime
                };
                logger_1.default.info(`✅ IntentParser: Pattern match`, {
                    intentType: patternIntent.type,
                    processingTimeMs: result.processingTimeMs
                });
                return result;
            }
            // STEP 2: Keyword matching against known entities
            // NOTE: Only use if confidence is VERY high (0.95+) to avoid false positives
            // that would block LLM intent detection for cart/order queries
            const entities = yield this.loadKnownEntities(options.workspaceId);
            const keywordMatch = (0, keyword_matcher_1.matchKnownEntities)(message, entities);
            if (keywordMatch && keywordMatch.confidence >= 0.95) {
                const result = {
                    intent: keywordMatch.intent,
                    confidence: keywordMatch.confidence >= 0.9 ? "HIGH" : "MEDIUM",
                    source: "KEYWORD",
                    processingTimeMs: Date.now() - startTime
                };
                logger_1.default.info(`✅ IntentParser: Keyword match`, {
                    intentType: keywordMatch.intent.type,
                    matchedEntity: keywordMatch.matchedEntity.name,
                    matchType: keywordMatch.matchType,
                    confidence: keywordMatch.confidence,
                    processingTimeMs: result.processingTimeMs
                });
                return result;
            }
            // STEP 3: LLM fallback for complex/ambiguous messages
            if (this.config.enableLLMFallback) {
                try {
                    const llmIntent = yield this.llmFallback(message, context, options, entities);
                    if (llmIntent) {
                        const result = {
                            intent: llmIntent,
                            confidence: "MEDIUM",
                            source: "LLM_FALLBACK",
                            processingTimeMs: Date.now() - startTime
                        };
                        logger_1.default.info(`✅ IntentParser: LLM fallback`, {
                            intentType: llmIntent.type,
                            processingTimeMs: result.processingTimeMs
                        });
                        return result;
                    }
                }
                catch (error) {
                    logger_1.default.error(`❌ IntentParser: LLM fallback failed`, { error });
                    // Continue to UNKNOWN
                }
            }
            // STEP 4: Unknown intent (no match found)
            const unknownIntent = {
                type: "UNKNOWN",
                originalMessage: message
            };
            const result = {
                intent: unknownIntent,
                confidence: "LOW",
                source: "PATTERN", // No match
                processingTimeMs: Date.now() - startTime
            };
            logger_1.default.warn(`⚠️ IntentParser: No match found`, {
                message: message.substring(0, 50),
                processingTimeMs: result.processingTimeMs
            });
            return result;
        });
    }
    /**
     * Load known entities from database (cached)
     */
    loadKnownEntities(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const cached = entityCache.get(workspaceId);
            const now = Date.now();
            if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
                return cached;
            }
            // Load from database - use correct Prisma model names
            const [categories, products, services] = yield Promise.all([
                this.prisma.categories.findMany({
                    where: { workspaceId, isActive: true },
                    select: { id: true, name: true }
                }),
                this.prisma.products.findMany({
                    where: { workspaceId, isActive: true },
                    select: { id: true, name: true, sku: true }
                }),
                // 🆕 Load services from Services table
                this.prisma.services.findMany({
                    where: { workspaceId, isActive: true },
                    select: { id: true, name: true }
                })
            ]);
            const entities = {
                categories: categories.map(c => ({
                    id: c.id,
                    name: c.name,
                    type: "CATEGORY"
                })),
                products: products.map(p => ({
                    id: p.id,
                    name: p.name,
                    type: "PRODUCT",
                    aliases: p.sku ? [p.sku] : undefined // SKU as alias
                })),
                services: services.map(s => ({
                    id: s.id,
                    name: s.name,
                    type: "SERVICE"
                })),
                timestamp: now
            };
            entityCache.set(workspaceId, entities);
            logger_1.default.debug(`📦 IntentParser: Loaded entities for workspace`, {
                workspaceId,
                categories: categories.length,
                products: products.length,
                services: services.length
            });
            return entities;
        });
    }
    /**
     * LLM fallback for complex intent classification
     *
     * NOTE: This does NOT generate responses or call functions.
     * It ONLY classifies the intent into one of the predefined types.
     */
    llmFallback(message, context, options, entities) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            // Build category list for the LLM to understand semantic mapping
            const categoryNames = entities.categories.map(c => c.name).join(", ");
            // Simple intent classification prompt
            const systemPrompt = `You are an intent classifier for an e-commerce chatbot.
Classify the user message into ONE of these intents:

PRODUCT_SEARCH:
- SHOW_CATEGORIES - User wants to see all categories
- SHOW_CATEGORY:categoryName - User wants to see products in a specific category
- SHOW_PRODUCTS - User wants to see ALL products (lista prodotti, mostra prodotti, tutti i prodotti)
- SEARCH_PRODUCTS:query - User is searching for SPECIFIC products (not "all products")
- SHOW_OFFERS - User wants to see offers/discounts/promotions
- PRODUCT_CONTEXT:question - User is asking for context/info/advice about the CURRENT product being shown (recipes, pairings, ingredients, availability, certifications, transport, etc.) without asking to modify cart. Only use if the last assistant message (or conversation state) indicates they are viewing a product detail.

AVAILABLE CATEGORIES: ${categoryNames}
NOTE: Use semantic understanding to map user queries to actual categories.
The user may use synonyms, related terms, or different languages.
Map their intent to the matching category from the list above.

IMPORTANT: 
- "dammi lista prodotti", "mostra tutti i prodotti", "che prodotti avete" = SHOW_PRODUCTS
- "prodotti BIO", "formaggi freschi", "cerca pecorino" = SEARCH_PRODUCTS:query
- If the user asks "che ricetta posso fare?", "come si conserva?", "con cosa abbino questo?", and they are in a product detail context, return PRODUCT_CONTEXT with the question after the colon.

CART:
- VIEW_CART - User wants to see their cart, check cart contents
- ADD_TO_CART:quantity:productName - User wants to add something to cart (extract quantity, default 1)
- REMOVE_FROM_CART:productName - User wants to remove a specific product from cart
- CLEAR_CART - User wants to empty/clear the entire cart
- CHECKOUT - User wants to proceed to checkout/confirm order
- EXAMPLES: "fammi vedere il carrello", "mostra il carrello", "show me my cart" → VIEW_CART

ORDERS:
- VIEW_ORDERS - User wants to see their orders
- ORDER_DETAILS:orderCode - User wants details of a specific order. If the user asks for "ultimo ordine", "last order", "ordine più recente" or similar without providing a code, return ORDER_DETAILS with NO parameter (the system will automatically fetch the latest order).
- REPEAT_ORDER - User wants to repeat/reorder a previous order

SERVICES:
- VIEW_SERVICES - User wants to see all available services (che servizi avete?, quali servizi?, servizi?)
- SHOW_SERVICE:serviceName - User wants details about a specific service

SUPPORT:
- ASK_IDENTITY - User asks who you are
- SHOW_AGENT_INFO - User wants to know their assigned sales agent
- ASK_LOCATION - User asks where the store is located
- ASK_FAQ:query - User has a question about policies, shipping, etc.
- ASK_BUSINESS_INFO - User asks about the TYPE of business/store, the SECTOR, what kind of shop this is. Examples: "che settore?", "che tipo di negozio siete?", "in che settore operate?", "what kind of store?", "che attività è?", "di cosa vi occupate?". NOT for categories/products!
- VIEW_PROFILE - User asks about their discount, profile, or personal info (READ ONLY)
- UPDATE_PROFILE - User wants to MODIFY/CHANGE/UPDATE their personal data (email, address, name, shipping address). Examples: "voglio cambiare email", "modifica indirizzo", "aggiorna i miei dati", "cambio indirizzo spedizione"
- CHANGE_LANGUAGE - User wants to change the conversation language or asks to speak in another language. Examples: "parla in inglese", "speak in english", "hablame en español", "fale português", "cambia lingua", "in english please", "voglio parlare in spagnolo"
- REQUEST_HUMAN - User wants to talk to a human OR is frustrated/angry.
  • If the user sounds angry, frustrated, or repeatedly complains about issues (caps lock, "sono stufo", "pessimo servizio", "non funziona mai", damaged goods, etc.) respond with "REQUEST_HUMAN:frustration".
  • If they explicitly ask for a person/operator but are calm, use "REQUEST_HUMAN".

OTHER:
- CONFIRM - User is confirming something (yes, ok, sure)
- REJECT - User is rejecting/canceling something (no, cancel)
- GREETING - User is greeting (hello, hi, ciao)
- UNKNOWN - Cannot determine intent

IMPORTANT: "settore" when asking "che settore?" or "in che settore" means the BUSINESS TYPE, NOT categories! Use ASK_BUSINESS_INFO.

Respond with ONLY the intent type and parameter if needed.
Examples:
- "SHOW_CATEGORIES"
- "SHOW_CATEGORY:Formaggi"
- "SEARCH_PRODUCTS:formaggio stagionato"
- "SHOW_OFFERS" (when user asks "che offerte avete?", "offerte?", "promozioni?", "sconti?", "what offers?", "deals?", "promotions?", "ofertas?", "promociones?")
- "VIEW_SERVICES" (when user asks "che servizi avete?", "quali servizi?", "servizi?")
- "SHOW_SERVICE:Spedizione" (when user asks about a specific service)
- "ASK_BUSINESS_INFO" (when user asks "che settore?", "che tipo di negozio?", "di cosa vi occupate?")
- "ADD_TO_CART:4:Pecorino Romano"
- "REMOVE_FROM_CART:Pecorino"
- "CLEAR_CART"
- "CHECKOUT"
- "VIEW_CART"
- "VIEW_ORDERS"
- "REPEAT_ORDER"
- "VIEW_PROFILE" (when user asks "che sconto ho?", "il mio sconto", "my discount")
- "UPDATE_PROFILE" (when user asks "modifica email", "cambia indirizzo", "aggiorna dati", "voglio cambiare i miei dati")
- "CHANGE_LANGUAGE" (when user asks "parla in inglese", "speak english", "hablame en español", "cambia lingua")
- "ASK_FAQ:shipping policy"
- "SHOW_AGENT_INFO"
- "UNKNOWN"

${context.lastAssistantMessage ? `\nLast bot message: "${context.lastAssistantMessage.substring(0, 200)}..."` : ''}`;
            try {
                // Use OpenRouter for classification
                const response = yield fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "openai/gpt-4o-mini",
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: message }
                        ],
                        temperature: 0, // Deterministic
                        max_tokens: 50 // Short response
                    }),
                    signal: AbortSignal.timeout(this.config.maxLLMFallbackTimeMs)
                });
                if (!response.ok) {
                    throw new Error(`OpenRouter error: ${response.status}`);
                }
                const data = yield response.json();
                const classification = (_d = (_c = (_b = (_a = data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) === null || _d === void 0 ? void 0 : _d.trim();
                if (!classification) {
                    return null;
                }
                // Parse classification into Intent
                return this.parseClassification(classification);
            }
            catch (error) {
                if (error instanceof Error && error.name === "TimeoutError") {
                    logger_1.default.warn(`⏱️ IntentParser: LLM fallback timed out`);
                }
                else {
                    logger_1.default.error(`❌ IntentParser: LLM fallback error`, { error });
                }
                return null;
            }
        });
    }
    /**
     * Parse LLM classification string into Intent
     */
    parseClassification(classification) {
        // Remove any surrounding quotes that the LLM might have added
        const cleanClassification = classification.replace(/^["'\s]+|["'\s]+$/g, "");
        const [intentType, ...rest] = cleanClassification.split(":");
        const param = rest.length ? rest.join(":") : undefined;
        switch (intentType.trim().toUpperCase()) {
            case "SHOW_CATEGORIES":
                return { type: "SHOW_CATEGORIES" };
            case "SHOW_CATEGORY":
                if (param) {
                    return { type: "SHOW_CATEGORY", categoryName: param.trim() };
                }
                return { type: "SHOW_CATEGORIES" };
            case "SHOW_PRODUCTS":
                return { type: "SHOW_PRODUCTS" };
            case "SEARCH_PRODUCTS":
                return { type: "SEARCH_PRODUCTS", query: (param === null || param === void 0 ? void 0 : param.trim()) || "" };
            case "VIEW_CART":
                return { type: "VIEW_CART" };
            case "CLEAR_CART":
                return { type: "CLEAR_CART" };
            case "CHECKOUT":
                return { type: "START_CHECKOUT" };
            case "REMOVE_FROM_CART":
                if (param) {
                    return { type: "REMOVE_FROM_CART", productName: param.trim() };
                }
                return { type: "VIEW_CART" }; // Show cart if no product specified
            case "ADD_TO_CART":
                if (param) {
                    // Format: ADD_TO_CART:quantity:productName or ADD_TO_CART:productName
                    const parts = param.split(":");
                    if (parts.length >= 2) {
                        const maybeQuantity = parseInt(parts[0], 10);
                        if (!isNaN(maybeQuantity) && maybeQuantity > 0) {
                            // Format: quantity:productName
                            const productName = parts.slice(1).join(":").trim();
                            return { type: "ADD_TO_CART", productName, quantity: maybeQuantity };
                        }
                    }
                    // Fallback: just productName
                    return { type: "ADD_TO_CART", productName: param.trim(), quantity: 1 };
                }
                return null;
            case "VIEW_ORDERS":
                return { type: "VIEW_ORDERS" };
            case "REPEAT_ORDER":
                // REPEAT_ORDER: user wants to re-order products from a previous order
                // If orderCode provided (e.g., "ripeti ordine ORD-12345"), use it
                // Otherwise, repeat the most recent completed order
                if (param) {
                    return { type: "REPEAT_ORDER", orderCode: param.trim() };
                }
                return { type: "REPEAT_ORDER" }; // Repeat last order
            case "ORDER_DETAILS": {
                const orderCode = param === null || param === void 0 ? void 0 : param.trim();
                return orderCode
                    ? { type: "ORDER_DETAILS", orderCode }
                    : { type: "ORDER_DETAILS" };
            }
            case "ASK_IDENTITY":
                return { type: "ASK_IDENTITY" };
            case "ASK_BUSINESS_INFO":
                return { type: "ASK_BUSINESS_INFO" };
            case "SHOW_AGENT_INFO":
                return { type: "SHOW_AGENT_INFO" };
            case "ASK_LOCATION":
                return { type: "ASK_LOCATION" };
            case "ASK_FAQ":
                return { type: "ASK_FAQ", query: (param === null || param === void 0 ? void 0 : param.trim()) || "" };
            case "VIEW_PROFILE":
                return { type: "VIEW_PROFILE" };
            case "UPDATE_PROFILE":
                return { type: "UPDATE_PROFILE", field: "all", value: "" };
            case "CHANGE_LANGUAGE":
                return { type: "CHANGE_LANGUAGE", requestedLanguage: param === null || param === void 0 ? void 0 : param.trim() };
            case "REQUEST_HUMAN": {
                const reason = param === null || param === void 0 ? void 0 : param.trim();
                return {
                    type: "REQUEST_HUMAN",
                    reason: reason ? reason.toLowerCase() : undefined,
                };
            }
            case "CONFIRM":
                return { type: "CONFIRM" };
            case "REJECT":
                return { type: "REJECT" };
            case "GREETING":
                // Return GREETING intent to be handled by chat-engine
                return { type: "GREETING" };
            case "SHOW_OFFERS":
                // Return SHOW_OFFERS intent to load active offers
                return { type: "SHOW_OFFERS" };
            case "VIEW_SERVICES":
                return { type: "VIEW_SERVICES" };
            case "SHOW_SERVICE":
                if (param) {
                    return { type: "SHOW_SERVICE", serviceName: param.trim() };
                }
                return { type: "VIEW_SERVICES" };
            case "PRODUCT_CONTEXT":
                return { type: "PRODUCT_CONTEXT", query: (param === null || param === void 0 ? void 0 : param.trim()) || "" };
            case "UNKNOWN":
            default:
                return null;
        }
    }
    /**
     * Clear entity cache for a workspace
     */
    static invalidateCache(workspaceId) {
        entityCache.delete(workspaceId);
        logger_1.default.debug(`🗑️ IntentParser: Cache invalidated for ${workspaceId}`);
    }
    /**
     * Clear all caches
     */
    static clearAllCaches() {
        entityCache.clear();
        logger_1.default.debug(`🗑️ IntentParser: All caches cleared`);
    }
}
exports.IntentParserService = IntentParserService;
// =============================================================================
// EXPORT SINGLETON FACTORY
// =============================================================================
let instance = null;
function getIntentParser(prisma) {
    if (!instance) {
        instance = new IntentParserService(prisma);
    }
    return instance;
}
//# sourceMappingURL=intent-parser.service.js.map