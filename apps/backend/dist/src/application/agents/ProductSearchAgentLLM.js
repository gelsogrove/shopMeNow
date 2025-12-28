"use strict";
/**
 * ProductSearchAgentLLM - Product and Services Agent
 *
 * ✅ SPECIALIST AGENT with OWN LLM - Clean Architecture
 *
 * Responsibilities:
 * 1. Handle product/service search queries with dedicated LLM
 * 2. Respond with exact data from variables (NO function calls)
 * 3. Return direct response in customer's language
 *
 * Architecture:
 * - Own LLM instance (OpenRouter + GPT-4o-mini)
 * - Own system prompt from files (TemplateLoaderService loads from /templates/ecommerce/02-product-search.template.md)
 * - Variables replaced: {{PRODUCTS}}, {{CATEGORIES}}, {{OFFERS}}, {{nameUser}}, etc.
 * - Returns direct Italian response (no translation needed)
 *
 * Flow:
 * 1. Router delegates query → Product and Services Agent
 * 2. Load system prompt from template files (agentType: PRODUCT_SEARCH)
 * 3. Replace all variables with real data
 * 4. Call LLM with customer query
 * 5. Return direct response → Router
 *
 * Security:
 * - ALL queries filtered by workspaceId
 * - NO translation (Router handles it)
 * - NO direct customer interaction
 *
 * @critical NEVER call LLMService - this is a SPECIALIST with OWN LLM
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
exports.ProductSearchAgentLLM = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../../config");
const searchConversation_repository_1 = require("../../repositories/searchConversation.repository");
const template_loader_service_1 = require("../services/template-loader.service");
const system_context_service_1 = require("../../services/system-context.service");
const logger_1 = __importDefault(require("../../utils/logger"));
class ProductSearchAgentLLM {
    constructor(prisma) {
        this.prisma = prisma;
        // NOTE: ProductSearchAgent instance removed - no database queries needed
        this.searchConversationRepo = new searchConversation_repository_1.SearchConversationRepository();
        this.templateLoader = template_loader_service_1.TemplateLoaderService.getInstance(prisma);
        this.systemContextService = (0, system_context_service_1.getSystemContextService)(prisma);
        // OpenRouter API configuration
        this.openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
        this.openRouterBaseUrl = "https://openrouter.ai/api/v1";
        if (!this.openRouterApiKey) {
            throw new Error("OPENROUTER_API_KEY is required for ProductSearchAgentLLM");
        }
    }
    /**
     * Handle product search query with LLM
     *
     * @param context - Search context from Router
     * @returns English response with tokens
     */
    handleQuery(context) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g;
            const startTime = Date.now();
            try {
                // 🆕 Track selected product for pendingAction handoff to chat-engine
                let selectedProductForCart = null;
                logger_1.default.info(`🔍 ProductSearchAgentLLM: Processing query`, {
                    workspaceId: context.workspaceId,
                    customerId: context.customerId,
                    sessionId: context.sessionId,
                    query: context.query.substring(0, 100),
                });
                // 📊 STEP 0.1: Save search query for analytics (statistics tracking)
                // This is NON-BLOCKING and happens BEFORE any product search logic
                // If it fails, it won't block the user's search experience
                try {
                    const { CallingFunctionsService, } = require("../../services/calling-functions.service");
                    const callingFunctions = new CallingFunctionsService();
                    yield callingFunctions.searchProductForStatistics({
                        workspaceId: context.workspaceId,
                        customerId: context.customerId,
                        query: context.query,
                    });
                    logger_1.default.debug("📊 Product search statistics saved", {
                        query: context.query.substring(0, 30),
                    });
                }
                catch (statError) {
                    // Non-critical error - log but don't block search
                    logger_1.default.warn("⚠️ Failed to save search statistics (non-critical):", statError);
                }
                // STEP 0.2: Load conversational memory for context
                // Feature 191: Removed hardcoded product selection logic
                // Now the LLM uses getProductDetails() function call to lookup products
                const conversation = yield this.searchConversationRepo.findBySessionId(context.sessionId, context.workspaceId);
                // STEP 1: Load template from file (NOT from Router query)
                // Router query goes as USER MESSAGE, template is the SYSTEM PROMPT
                const systemPrompt = yield this.templateLoader.loadAndRenderTemplate("PRODUCT_SEARCH", context.workspaceId);
                logger_1.default.info(`📋 Loaded ProductSearch template from file`, {
                    promptLength: systemPrompt.length,
                });
                // 🔴 CRITICAL: Replace {{PRODUCTS}} with real data from database
                const { PromptProcessorService } = yield Promise.resolve().then(() => __importStar(require("../../services/prompt-processor.service")));
                const { MessageRepository } = yield Promise.resolve().then(() => __importStar(require("../../repositories/message.repository")));
                const promptProcessor = new PromptProcessorService();
                const messageRepo = new MessageRepository();
                logger_1.default.info(`🔄 Loading products and categories for variable replacement...`);
                // 🔧 OPTIMIZATION: Use pre-loaded customerData from Router if available (avoids duplicate DB queries)
                let customerDataForPrompt;
                let customerDiscount;
                if (context.customerData) {
                    // Router already loaded customer data - use it directly
                    customerDataForPrompt = context.customerData;
                    customerDiscount = context.customerData.discountUser || 0;
                    logger_1.default.info(`✅ Using pre-loaded customerData from Router (0 extra queries)`);
                }
                else {
                    // Fallback: Load customer data from DB (legacy behavior)
                    const customer = yield this.prisma.customers.findUnique({
                        where: { id: context.customerId },
                    });
                    customerDataForPrompt = customer
                        ? {
                            nameUser: customer.name || "Cliente",
                            email: customer.email || "",
                            phone: customer.phone || "",
                            discountUser: customer.discount || 0,
                            languageUser: customer.language || "ITALIANO",
                        }
                        : {};
                    customerDiscount = (customer === null || customer === void 0 ? void 0 : customer.discount) || 0;
                    logger_1.default.warn(`⚠️ Fallback: Loaded customer from DB (consider passing customerData from Router)`);
                }
                // Load dynamic content (products, categories, etc.) with customer discount applied
                const productsText = yield messageRepo.getActiveProducts(context.workspaceId, customerDiscount // 🔴 CRITICAL: Pass customer discount to calculate prices correctly
                );
                const categoriesText = yield messageRepo.getActiveCategories(context.workspaceId);
                const offersText = yield messageRepo.getActiveOffers(context.workspaceId);
                const servicesText = yield messageRepo.getActiveServices(context.workspaceId);
                logger_1.default.info(`📦 Loaded dynamic content`, {
                    productsLength: productsText.length,
                    categoriesLength: categoriesText.length,
                    offersLength: offersText.length,
                    servicesLength: servicesText.length,
                    offersContent: offersText, // 🔍 DEBUG: Log actual offers content
                });
                // 🔒 Runtime overrides to prevent grouping regressions for known cases (e.g., Salumi single-group)
                const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const extractCategoryProducts = (categoryName) => {
                    if (!productsText)
                        return { count: 0, items: [] };
                    const headerRegex = new RegExp(`\\*\\*${escapeRegExp(categoryName.toUpperCase())}\\*\\* \\((\\d+) prodotti\\)\\n([\\s\\S]*?)(?:\\n\\n|$)`, "i");
                    const match = productsText.match(headerRegex);
                    if (!match)
                        return { count: 0, items: [] };
                    const count = parseInt(match[1], 10) || 0;
                    const block = match[2] || "";
                    const items = block
                        .split(/\n/)
                        .map((line) => line.trim())
                        .filter((line) => line.startsWith("•"));
                    return { count, items };
                };
                const findKeywordMatches = (keyword) => {
                    if (!keyword || !productsText)
                        return { count: 0, items: [] };
                    const lower = keyword.toLowerCase();
                    const items = productsText
                        .split(/\n/)
                        .map((line) => line.trim())
                        .filter((line) => line.startsWith("•") && line.toLowerCase().includes(lower));
                    return { count: items.length, items };
                };
                const findProductLineByName = (productName) => {
                    if (!productName || !productsText)
                        return null;
                    const lower = productName.toLowerCase();
                    return (productsText
                        .split(/\n/)
                        .map((line) => line.trim())
                        .find((line) => line.startsWith("•") && line.toLowerCase().includes(lower)) || null);
                };
                let runtimeDirectives = "";
                const normalizedQueryRuntime = context.query.toLowerCase();
                const keywordMatch = context.query.match(/products related to \"([^\"]+)\"|products related to '([^']+)'/i);
                const keyword = keywordMatch ? keywordMatch[1] || keywordMatch[2] : null;
                if (keyword) {
                    const keywordMatches = findKeywordMatches(keyword);
                    if (keywordMatches.count === 1) {
                        runtimeDirectives += `- Parola chiave "${keyword}": trovato 1 prodotto. Mostra i dettagli di quel prodotto e chiedi se aggiungere al carrello. Non reindirizzare ad altre categorie o gruppi.\n`;
                    }
                    else if (keywordMatches.count >= 2 && keywordMatches.count <= 5) {
                        runtimeDirectives += `- Parola chiave "${keyword}": trovati ${keywordMatches.count} prodotti. Elenca tutti con numeri e prezzi (no gruppi) e chiedi quale prodotto interessa.\n`;
                    }
                    else if (keywordMatches.count >= 6) {
                        runtimeDirectives += `- Parola chiave "${keyword}": trovati ${keywordMatches.count} prodotti. Crea 2-4 gruppi bilanciati; se i gruppi sarebbero singoli, elenca direttamente tutti i prodotti con numeri e prezzi (mai un solo gruppo).\n`;
                    }
                }
                // Force direct product detail when Router passes an explicit product name (avoids salumi/category fallback)
                const directProductMatch = context.query.match(/product ['\"]([^'\"]+)['\"]/i);
                if (directProductMatch && directProductMatch[1]) {
                    const productName = directProductMatch[1];
                    const productLine = findProductLineByName(productName);
                    if (productLine) {
                        runtimeDirectives += `- Prodotto specifico "${productName}": mostra i dettagli esatti di questo prodotto (nome, prezzo, breve descrizione se presente) e chiedi se aggiungere al carrello. Non raggruppare, non cambiare categoria o elenco.
`;
                    }
                }
                // Replace ALL variables ({{PRODUCTS}}, {{CATEGORIES}}, {{nameUser}}, etc.)
                const processedPrompt = yield promptProcessor.preProcessPrompt(systemPrompt, context.workspaceId, customerDataForPrompt, // Mapped customer data for variable replacement
                {
                    faqs: "", // Not used in product search
                    products: productsText,
                    categories: categoriesText,
                    services: servicesText, // ✅ Feature 191: Include services for product/services search
                    offers: offersText,
                });
                // 🎯 CRITICAL: Add Router's query as INSTRUCTION to the system prompt
                // Router sends: "User want to see categories... Format MUST be: 1. Name (N items)"
                // This becomes part of system prompt so LLM follows it as instruction
                let finalSystemPrompt = processedPrompt +
                    "\n\n## 🎯 CURRENT REQUEST (FOLLOW THESE INSTRUCTIONS)\n" +
                    context.query;
                if (runtimeDirectives) {
                    finalSystemPrompt +=
                        "\n\n## RUNTIME DIRECTIVES (HIGH PRIORITY)\n" +
                            runtimeDirectives.trim();
                }
                logger_1.default.info(`✅ Prompt variables replaced + Router instructions added`, {
                    originalLength: systemPrompt.length,
                    processedLength: finalSystemPrompt.length,
                });
                // 🔍 DEBUG: Log prompt info (without printing full prompt to console)
                logger_1.default.debug("Product Search Agent prompt processed", {
                    promptLength: finalSystemPrompt.length,
                    firstChars: finalSystemPrompt.substring(0, 200),
                });
                // STEP 2: Build messages for LLM (with conversation history if appropriate)
                const messages = [
                    {
                        role: "system",
                        content: finalSystemPrompt, // ✅ Use processed prompt with ALL variables replaced + Router instructions
                    },
                ];
                // 🚦 Conversation history is helpful for follow-ups like "1" after a product list,
                // but it can cause loops when the Router explicitly asks to show a category or to reset to full categories.
                // Always include conversation history when available (no keyword heuristics)
                if ((conversation === null || conversation === void 0 ? void 0 : conversation.lastQuery) && (conversation === null || conversation === void 0 ? void 0 : conversation.lastResponse)) {
                    messages.push({
                        role: "user",
                        content: conversation.lastQuery,
                    });
                    messages.push({
                        role: "assistant",
                        content: conversation.lastResponse,
                    });
                    logger_1.default.info(`🧠 Added conversation history to context`, {
                        lastQuery: conversation.lastQuery.substring(0, 50),
                        lastResponse: conversation.lastResponse.substring(0, 50),
                    });
                }
                // User message is simple - instructions are already in system prompt
                messages.push({
                    role: "user",
                    content: "Execute the request following the instructions above.",
                });
                // STEP 3: Define function calls for product search
                const functions = this.getProductSearchFunctions();
                // STEP 4: Call LLM (OpenRouter) with default config
                const llmResponse = yield this.callLLM({
                    model: "gpt-4o-mini", // 🆕 Default model from template
                    messages,
                    functions,
                    temperature: 0.3, // Slightly higher to avoid over-constraint while keeping responses stable
                    maxTokens: 2000, // 🆕 Default max tokens
                });
                let totalTokens = llmResponse.tokensUsed;
                let finalResponse = llmResponse.content || "";
                const functionCalls = [];
                // STEP 5: Handle function calling loop
                if (llmResponse.function_call) {
                    const functionName = llmResponse.function_call.name;
                    const functionArgs = JSON.parse(llmResponse.function_call.arguments || "{}");
                    // 🚨 CRITICAL SECURITY CHECK: SubLLM CANNOT call other SubLLMs!
                    // Only Router can delegate to SubAgents
                    const forbiddenFunctions = [
                        "cartManagementAgent",
                        "productSearchAgent",
                        "orderTrackingAgent",
                        "customerSupportAgent",
                        "safetyTranslationAgent",
                    ];
                    if (forbiddenFunctions.includes(functionName)) {
                        logger_1.default.error(`🚨 SECURITY VIOLATION: ProductSearchAgentLLM tried to call another SubLLM!`, {
                            attemptedFunction: functionName,
                            args: functionArgs,
                        });
                        throw new Error(`INVALID OPERATION: SubLLM cannot call other SubLLMs. Only Router can delegate to SubAgents. Attempted: ${functionName}`);
                    }
                    logger_1.default.info(`⚙️ ProductSearchAgentLLM: Function call requested`, {
                        functionName,
                        args: functionArgs,
                    });
                    // Execute function call
                    // Feature 191: Simplified - no more pre-filtered products or group forcing
                    const functionResult = yield this.executeFunction(functionName, functionArgs, context);
                    functionCalls.push({
                        name: functionName,
                        arguments: functionArgs,
                        result: functionResult,
                    });
                    // STEP 6: Return function result to LLM for final response
                    messages.push({
                        role: "assistant",
                        content: null,
                        function_call: llmResponse.function_call,
                    });
                    messages.push({
                        role: "function",
                        name: functionName,
                        content: JSON.stringify(functionResult),
                    });
                    const finalLLMResponse = yield this.callLLM({
                        model: "gpt-4o-mini", // 🆕 Default model from template
                        messages,
                        functions,
                        temperature: 0.3, // Match primary call for consistent behavior
                        maxTokens: 2000, // 🆕 Default max tokens
                    });
                    totalTokens += finalLLMResponse.tokensUsed;
                    finalResponse = finalLLMResponse.content || "";
                }
                // 🔴 STEP 6.5: VALIDATE GROUPING RULE
                // If response contains 6+ product lines, retry with grouping instruction
                const groupingValidation = this.validateGroupingRule(finalResponse);
                if (groupingValidation.violated) {
                    logger_1.default.warn(`🚨 Grouping rule violated! Retrying with explicit instruction...`, {
                        productLineCount: groupingValidation.productLineCount,
                    });
                    const retryResult = yield this.retryWithGroupingInstruction(messages, this.getProductSearchFunctions(), groupingValidation.productLineCount, finalResponse);
                    if (retryResult.content) {
                        // Validate retry response too
                        const retryValidation = this.validateGroupingRule(retryResult.content);
                        if (!retryValidation.violated) {
                            finalResponse = retryResult.content;
                            totalTokens += retryResult.tokensUsed;
                            logger_1.default.info(`✅ Grouping retry successful - now using grouped response`);
                        }
                        else {
                            logger_1.default.warn(`⚠️ Retry still violated grouping (${retryValidation.productLineCount} lines) - using original`);
                        }
                    }
                }
                const executionTimeMs = Date.now() - startTime;
                // STEP 7: Save conversation to memory (10-minute TTL)
                // Feature 191: Simplified - just save last query/response for context
                // The LLM uses getProductDetails() to look up products when needed
                try {
                    // Check if we got product details from a function call
                    const productDetailsFunctionCall = functionCalls.find((fc) => fc.name === "getProductDetails" || fc.name === "getServiceDetails");
                    let groupsMetadata = null;
                    // If we got product details, save for potential cart handoff
                    if (((_a = productDetailsFunctionCall === null || productDetailsFunctionCall === void 0 ? void 0 : productDetailsFunctionCall.result) === null || _a === void 0 ? void 0 : _a.found) && ((_b = productDetailsFunctionCall === null || productDetailsFunctionCall === void 0 ? void 0 : productDetailsFunctionCall.result) === null || _b === void 0 ? void 0 : _b.product)) {
                        const product = productDetailsFunctionCall.result.product;
                        groupsMetadata = {
                            selectedSku: product.sku,
                            productName: product.name,
                            timestamp: new Date().toISOString(),
                        };
                        // 🆕 Store selectedProduct for pendingAction in chat-engine
                        selectedProductForCart = {
                            sku: product.sku,
                            name: product.name,
                            itemType: "PRODUCT",
                        };
                        logger_1.default.info(`📦 Storing product details from function call`, {
                            selectedSku: product.sku,
                            productName: product.name,
                        });
                    }
                    // Check for service details too
                    if (((_c = productDetailsFunctionCall === null || productDetailsFunctionCall === void 0 ? void 0 : productDetailsFunctionCall.result) === null || _c === void 0 ? void 0 : _c.found) && ((_d = productDetailsFunctionCall === null || productDetailsFunctionCall === void 0 ? void 0 : productDetailsFunctionCall.result) === null || _d === void 0 ? void 0 : _d.service)) {
                        const service = productDetailsFunctionCall.result.service;
                        selectedProductForCart = {
                            sku: service.code,
                            name: service.name,
                            itemType: "SERVICE",
                        };
                        logger_1.default.info(`📦 Storing service details from function call`, {
                            selectedCode: service.code,
                            serviceName: service.name,
                        });
                    }
                    yield this.searchConversationRepo.upsert({
                        sessionId: context.sessionId,
                        workspaceId: context.workspaceId,
                        customerId: context.customerId,
                        lastQuery: context.query,
                        lastResponse: finalResponse.substring(0, 500), // Truncate long responses
                        metadata: groupsMetadata || null,
                    });
                    logger_1.default.info(`💾 Saved conversation to memory`, {
                        sessionId: context.sessionId,
                        hasProductDetails: !!groupsMetadata,
                        selectedSku: groupsMetadata === null || groupsMetadata === void 0 ? void 0 : groupsMetadata.selectedSku,
                    });
                }
                catch (memoryError) {
                    logger_1.default.error(`⚠️ Failed to save conversation memory:`, memoryError);
                    // Don't fail the whole request if memory save fails
                }
                // 🆕 STEP 7.5: Extract and save list to SystemContext (for numeric selections)
                try {
                    const extractedList = this.extractListFromResponse(finalResponse, functionCalls);
                    if (extractedList && extractedList.length > 0) {
                        yield this.systemContextService.setCurrentList(context.workspaceId, context.customerId, {
                            type: this.determineListType(extractedList),
                            items: extractedList,
                        });
                        logger_1.default.info(`📋 [SystemContext] Saved list for future selections`, {
                            itemCount: extractedList.length,
                            type: this.determineListType(extractedList),
                        });
                    }
                }
                catch (contextError) {
                    logger_1.default.error(`⚠️ Failed to save SystemContext:`, contextError);
                }
                logger_1.default.info(`✅ ProductSearchAgentLLM: Query processed`, {
                    executionTimeMs,
                    tokensUsed: totalTokens,
                    responseLength: finalResponse.length,
                    functionCallsCount: functionCalls.length,
                });
                return {
                    success: true,
                    output: finalResponse, // English response with [LINK_xxx] tokens
                    tokensUsed: totalTokens,
                    executionTimeMs,
                    functionCalls,
                    systemPrompt: processedPrompt, // 🆕 Include processed prompt for debugging
                    model: "gpt-4o-mini", // 🆕 Default model from template
                    selectedProduct: selectedProductForCart, // 🆕 For pendingAction ADD_TO_CART handoff
                };
            }
            catch (error) {
                const executionTimeMs = Date.now() - startTime;
                // Extract only relevant error info (avoid circular references)
                const errorInfo = Object.assign({ message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, (error && typeof error === "object" && "response" in error
                    ? {
                        status: (_e = error.response) === null || _e === void 0 ? void 0 : _e.status,
                        statusText: (_f = error.response) === null || _f === void 0 ? void 0 : _f.statusText,
                        data: (_g = error.response) === null || _g === void 0 ? void 0 : _g.data,
                    }
                    : {}));
                logger_1.default.error("❌ ProductSearchAgentLLM error:", errorInfo);
                return {
                    success: false,
                    output: "Error processing product search request",
                    tokensUsed: 0,
                    executionTimeMs,
                    functionCalls: [],
                };
            }
        });
    }
    /**
     * Call OpenRouter API with function calling
     */
    callLLM(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                // Convert functions to tools format (OpenRouter new API)
                const tools = options.functions.map((fn) => ({
                    type: "function",
                    function: fn,
                }));
                const response = yield axios_1.default.post(`${this.openRouterBaseUrl}/chat/completions`, {
                    model: options.model,
                    messages: options.messages,
                    tools, // ✅ Use tools instead of functions
                    temperature: options.temperature,
                    max_tokens: options.maxTokens,
                }, {
                    headers: {
                        Authorization: `Bearer ${this.openRouterApiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": config_1.config.appUrl,
                        "X-Title": "eChatbot - Product and Services Agent",
                    },
                });
                const choice = (_a = response.data.choices) === null || _a === void 0 ? void 0 : _a[0];
                const message = choice === null || choice === void 0 ? void 0 : choice.message;
                return {
                    content: (message === null || message === void 0 ? void 0 : message.content) || null,
                    function_call: (_c = (_b = message === null || message === void 0 ? void 0 : message.tool_calls) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.function, // ✅ Parse from tool_calls
                    tokensUsed: ((_d = response.data.usage) === null || _d === void 0 ? void 0 : _d.total_tokens) || 0,
                };
            }
            catch (error) {
                logger_1.default.error("❌ OpenRouter API call failed:", error);
                throw error;
            }
        });
    }
    /**
     * Execute function call
     * Feature 191: Simplified - getProductDetails and getServiceDetails for product lookup
     */
    executeFunction(functionName, args, context) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                logger_1.default.info(`⚙️ ProductSearchAgentLLM executing function: ${functionName}`, {
                    args,
                    workspaceId: context.workspaceId,
                });
                // Handle getProductDetails - lookup product by code (priority) or name
                if (functionName === "getProductDetails") {
                    const { CallingFunctionsService } = yield Promise.resolve().then(() => __importStar(require("../../services/calling-functions.service")));
                    const callingFunctionsService = new CallingFunctionsService();
                    const result = yield callingFunctionsService.getProductDetails({
                        workspaceId: context.workspaceId,
                        customerId: context.customerId,
                        productName: args.productName,
                        formato: args.formato,
                    });
                    logger_1.default.info(`✅ getProductDetails result:`, {
                        found: result.found,
                        multiple: result.multiple,
                        productName: (_a = result.product) === null || _a === void 0 ? void 0 : _a.name,
                    });
                    return result;
                }
                // Handle getServiceDetails - lookup service by code (priority) or name
                if (functionName === "getServiceDetails") {
                    const { CallingFunctionsService } = yield Promise.resolve().then(() => __importStar(require("../../services/calling-functions.service")));
                    const callingFunctionsService = new CallingFunctionsService();
                    const result = yield callingFunctionsService.getServiceDetails({
                        workspaceId: context.workspaceId,
                        customerId: context.customerId,
                        serviceName: args.serviceName,
                    });
                    logger_1.default.info(`✅ getServiceDetails result:`, {
                        found: result.found,
                        multiple: result.multiple,
                        serviceName: (_b = result.service) === null || _b === void 0 ? void 0 : _b.name,
                    });
                    return result;
                }
                // Handle searchProductByCertifications (existing function)
                if (functionName === "searchProductByCertifications") {
                    // Existing implementation for certification search
                    logger_1.default.info(`🔖 searchProductByCertifications called:`, args);
                    return {
                        success: true,
                        message: "Use {{PRODUCTS}} variable for certification filtering",
                    };
                }
                // Handle searchProductForStatistics (existing function)
                if (functionName === "searchProductForStatistics") {
                    const { CallingFunctionsService } = yield Promise.resolve().then(() => __importStar(require("../../services/calling-functions.service")));
                    const callingFunctionsService = new CallingFunctionsService();
                    const result = yield callingFunctionsService.searchProductForStatistics({
                        workspaceId: context.workspaceId,
                        customerId: context.customerId,
                        query: args.query,
                    });
                    logger_1.default.info(`📊 searchProductForStatistics saved:`, result);
                    return result;
                }
                logger_1.default.warn(`❌ Unknown function: ${functionName}`);
                return {
                    success: false,
                    error: `Unknown function: ${functionName}`,
                };
            }
            catch (error) {
                logger_1.default.error(`Error in executeFunction:`, error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                };
            }
        });
    }
    /**
     * Get function definitions for product search
     * ✅ Feature 191: getProductDetails and getServiceDetails for cart flow
     */
    getProductSearchFunctions() {
        return [
            {
                name: "getProductDetails",
                description: "Get full product details by sku (priority) or name. Use this when user selects a product to see details before adding to cart. Returns the INTERNAL product code needed for cart operations. NEVER show the sku to the user.",
                parameters: {
                    type: "object",
                    properties: {
                        productName: {
                            type: "string",
                            description: "The sku [e.g. PARM-500G] or product name. Prefer code from product list.",
                        },
                        formato: {
                            type: "string",
                            description: "Optional product format/size (e.g., '500g', '1kg')",
                        },
                    },
                    required: ["productName"],
                },
            },
            {
                name: "getServiceDetails",
                description: "Get full service details by serviceCode (priority) or name. Use this when user selects a service to see details before adding to cart. Returns the INTERNAL service code needed for cart operations. NEVER show the serviceCode to the user.",
                parameters: {
                    type: "object",
                    properties: {
                        serviceName: {
                            type: "string",
                            description: "The serviceCode [e.g. SHIPPING, GIFT-WRAP] or service name. Prefer code from service list.",
                        },
                    },
                    required: ["serviceName"],
                },
            },
            {
                name: "searchProductForStatistics",
                description: "SOLO per analytics. Chiama questa funzione DOPO aver risposto al cliente con i dettagli prodotto. Non sostituisce la risposta - devi SEMPRE rispondere con i dati prodotto da {{PRODUCTS}} E ANCHE chiamare questa funzione per tracciare la ricerca.",
                parameters: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "The search query to track",
                        },
                    },
                    required: ["query"],
                },
            },
        ];
    }
    // Feature 191: Removed extractGroupText, filterByGroupKeywords, extractKeywords
    // These were part of the hardcoded product selection logic
    // Now the LLM uses getProductDetails() function call instead
    /**
     * 🔴 GROUPING RULE VALIDATION
     *
     * Detects if response violates the 6+ grouping rule:
     * - Pattern: 6 or more lines like "1. Product Name - €Price"
     * - If violated, returns the count of product lines
     * - If valid, returns null
     */
    validateGroupingRule(response) {
        // Pattern to match product list lines: "1. Product Name - €Price" or "1. Product Name €Price"
        // Also matches lines like "1. Product Name (€7.50/kg)" or variations
        const productLinePattern = /^\s*\d+\.\s+[^(]+(?:€[\d.,]+|[\d.,]+\s*€)/gm;
        const matches = response.match(productLinePattern) || [];
        const productLineCount = matches.length;
        logger_1.default.info(`🔍 Grouping validation check`, {
            productLineCount,
            responseLength: response.length,
            responsePreview: response.substring(0, 200),
            matchedLines: matches.slice(0, 5),
        });
        if (productLineCount >= 6) {
            logger_1.default.warn(`🚨 GROUPING RULE VIOLATED: Response contains ${productLineCount} product lines (>=6 should be grouped)`, {
                sampleLines: matches.slice(0, 3).map(l => l.trim()),
            });
            return { violated: true, productLineCount };
        }
        return { violated: false, productLineCount };
    }
    /**
     * 🔧 RETRY WITH GROUPING INSTRUCTION
     *
     * When grouping rule is violated, retry the LLM with explicit instruction
     * to group the products instead of listing them all.
     */
    retryWithGroupingInstruction(messages, functions, productLineCount, originalResponse) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`🔄 Retrying with grouping instruction after ${productLineCount} products listed`);
            // Add correction message to conversation
            const correctionMessages = [
                ...messages,
                {
                    role: "assistant",
                    content: originalResponse,
                },
                {
                    role: "user",
                    content: `⚠️ ERRORE: Hai listato ${productLineCount} prodotti singolarmente. Questo viola la REGOLA DI GROUPING: quando ci sono 6+ prodotti, DEVI raggrupparli in 2-4 categorie logiche.

NON listare prodotti singoli! Invece, crea gruppi come:
1. [Nome Gruppo] (X prodotti)
2. [Nome Gruppo] (Y prodotti)

Raggruppa per: tipo/texture, uso, fascia di prezzo, o profilo di sapore.
Rispondi ORA con i gruppi, NON con la lista prodotti.`,
                },
            ];
            const retryResponse = yield this.callLLM({
                model: "gpt-4o-mini",
                messages: correctionMessages,
                functions,
                temperature: 0.2, // Lower temperature for more deterministic grouping
                maxTokens: 1500,
            });
            return {
                content: retryResponse.content,
                tokensUsed: retryResponse.tokensUsed,
            };
        });
    }
    /**
     * 🆕 Extract list items from LLM response for SystemContext
     *
     * Parses numbered lists from response and extracts SKUs from function calls
     * to create a mapping for future numeric selections.
     */
    extractListFromResponse(response, functionCalls) {
        var _a, _b;
        const items = [];
        // Pattern 1: Numbered list with products or groups
        // e.g., "1. Parmigiano Reggiano - €12.50 [SKU:PARM-24]"
        // e.g., "1. Formaggi Stagionati (4 items) [SKUS:SKU1,SKU2,SKU3,SKU4]"
        const numberedLinePattern = /^(\d+)[.)]\s*(.+)$/gm;
        let match;
        while ((match = numberedLinePattern.exec(response)) !== null) {
            const index = parseInt(match[1], 10);
            const label = match[2].trim();
            // Try to extract single SKU (format: [SKU:XXX])
            const skuMatch = label.match(/\[SKU:([A-Z0-9-]+)\]/i);
            // Try to extract multiple SKUs (format: [SKUS:XXX,YYY,ZZZ])
            const skusMatch = label.match(/\[SKUS?:([A-Z0-9-,]+)\]/i);
            // Check if this looks like a grouping (contains "prodotti" or "products" count)
            const isGrouping = /\(\d+\s*(?:prodotti?|products?|items?)\)/i.test(label);
            // Clean the label by removing SKU tags
            const cleanLabel = label
                .replace(/\[SKU:[A-Z0-9-]+\]/gi, '')
                .replace(/\[SKUS?:[A-Z0-9-,]+\]/gi, '')
                .trim();
            if (isGrouping && skusMatch) {
                // This is a grouping with multiple SKUs
                const skus = skusMatch[1].split(',').map(s => s.trim());
                items.push({
                    index,
                    label: cleanLabel,
                    skus,
                    type: "grouping",
                });
            }
            else if (isGrouping) {
                // Grouping without explicit SKUs (fallback)
                items.push({
                    index,
                    label: cleanLabel,
                    type: "grouping",
                });
            }
            else {
                // This is a single product
                items.push({
                    index,
                    label: cleanLabel,
                    sku: skuMatch ? skuMatch[1] : (skusMatch ? skusMatch[1] : undefined),
                    type: "product",
                });
            }
        }
        // Pattern 2: Try to get SKUs from function call results (backup)
        for (const fc of functionCalls) {
            if (fc.name === "getProductDetails" && ((_a = fc.result) === null || _a === void 0 ? void 0 : _a.product)) {
                const product = fc.result.product;
                // Update the matching item with SKU if we found it
                const matchingItem = items.find(item => item.label.toLowerCase().includes(product.name.toLowerCase().substring(0, 10)));
                if (matchingItem && !matchingItem.sku) {
                    matchingItem.sku = product.sku;
                }
            }
            // Handle searchProducts results
            if (fc.name === "searchProducts" && ((_b = fc.result) === null || _b === void 0 ? void 0 : _b.products)) {
                const products = fc.result.products;
                products.forEach((product, idx) => {
                    const existingItem = items.find(item => item.index === idx + 1);
                    if (existingItem && !existingItem.sku && product.sku) {
                        existingItem.sku = product.sku;
                    }
                });
            }
        }
        return items;
    }
    /**
     * 🆕 Determine list type from extracted items
     */
    determineListType(items) {
        if (items.some(i => i.type === "grouping")) {
            return "groupings";
        }
        if (items.every(i => i.type === "product")) {
            return "products";
        }
        if (items.every(i => i.type === "category")) {
            return "categories";
        }
        return "products"; // Default
    }
}
exports.ProductSearchAgentLLM = ProductSearchAgentLLM;
//# sourceMappingURL=ProductSearchAgentLLM.js.map