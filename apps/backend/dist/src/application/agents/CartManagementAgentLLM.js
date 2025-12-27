"use strict";
/**
 * CartManagementAgentLLM
 *
 * ✅ SPECIALIST AGENT with OWN LLM - Clean Architecture
 *
 * Responsibilities:
 * 1. Handle cart operations with dedicated LLM
 * 2. Execute function calls for cart management
 * 3. Return English response with [LINK_xxx] tokens
 *
 * Architecture:
 * - Own LLM instance (OpenRouter + GPT-4o-mini)
 * - Own system prompt from files (TemplateLoaderService loads from /templates/ecommerce/03-cart-management.template.md)
 * - Function execution via CartManagementAgent
 * - Returns English ONLY (Router handles translation)
 *
 * Flow:
 * 1. Router delegates query → CartManagementAgentLLM
 * 2. Load system prompt from database (agentType: CART_MANAGEMENT)
 * 3. Call LLM with cart management functions
 * 4. Execute functions via CartManagementAgent
 * 5. Return English response with tokens → Router
 *
 * Security:
 * - ALL queries filtered by workspaceId
 * - NO translation (Router handles it)
 * - NO direct customer interaction
 *
 * @critical NEVER call LLMService - this is a SPECIALIST with OWN LLM
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
exports.CartManagementAgentLLM = void 0;
const pricing_1 = require("@shared/pricing");
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../../config");
const cart_repository_1 = require("../../repositories/cart.repository");
const order_repository_1 = require("../../repositories/order.repository");
const product_repository_1 = require("../../repositories/product.repository");
const service_repository_1 = require("../../repositories/service.repository");
const template_loader_service_1 = require("../services/template-loader.service");
const prompt_processor_service_1 = require("../../services/prompt-processor.service");
const system_context_service_1 = require("../../services/system-context.service");
const order_optimization_service_1 = require("../services/order-optimization.service");
const logger_1 = __importDefault(require("../../utils/logger"));
const CartManagementAgent_1 = require("./CartManagementAgent");
const formatCartPrice = (value) => (0, pricing_1.formatRoundedCurrency)(value !== null && value !== void 0 ? value : 0, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useSmartRound: true,
    step: pricing_1.DEFAULT_ROUNDING_STEP,
});
class CartManagementAgentLLM {
    constructor(prisma) {
        this.prisma = prisma;
        // Initialize CartManagementAgent with repositories
        const cartRepo = new cart_repository_1.CartRepository();
        const productRepo = new product_repository_1.ProductRepository();
        const serviceRepo = new service_repository_1.ServiceRepository();
        const orderRepo = new order_repository_1.OrderRepository();
        this.cartManagementAgent = new CartManagementAgent_1.CartManagementAgent(cartRepo, productRepo, serviceRepo, orderRepo);
        this.templateLoader = template_loader_service_1.TemplateLoaderService.getInstance(prisma);
        this.systemContextService = (0, system_context_service_1.getSystemContextService)(prisma);
        // OpenRouter API configuration
        this.openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
        this.openRouterBaseUrl = "https://openrouter.ai/api/v1";
        if (!this.openRouterApiKey) {
            throw new Error("OPENROUTER_API_KEY is required for CartManagementAgentLLM");
        }
    }
    /**
     * Handle cart management query with LLM
     */
    handleQuery(context) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g;
            const startTime = Date.now();
            try {
                logger_1.default.info(`🛒 CartManagementAgentLLM: Processing query`, {
                    workspaceId: context.workspaceId,
                    customerId: context.customerId,
                    query: context.query.substring(0, 100),
                });
                // STEP 1: Load system prompt from template files
                let systemPromptRaw = yield this.templateLoader.loadAndRenderTemplate("CART_MANAGEMENT", context.workspaceId);
                logger_1.default.info(`📋 Loaded CART_MANAGEMENT template from files`, {
                    promptLength: systemPromptRaw.length,
                });
                // 🆕 STEP 1.5: Load workspace config for dynamic fields (customAiRules, botIdentityResponse, etc.)
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: context.workspaceId },
                    select: {
                        name: true,
                        address: true,
                        customAiRules: true,
                        botIdentityResponse: true,
                    },
                });
                // 🔧 STEP 1.6: Replace ALL variables ({{companyName}}, {{nameUser}}, etc.)
                // CRITICAL: Must call preProcessPrompt to render variables before passing to LLM
                const promptProcessor = new prompt_processor_service_1.PromptProcessorService();
                // 🔧 OPTIMIZATION: Use pre-loaded customerData from Router if available (avoids duplicate DB queries)
                // 🔴 CRITICAL FIX: Merge Router data with workspace fallbacks to ensure no empty values
                const baseCustomerData = {
                    nameUser: context.customerName || "",
                    email: "",
                    phone: "",
                    discountUser: context.customerDiscount || 0,
                    companyName: (workspace === null || workspace === void 0 ? void 0 : workspace.name) || "",
                    lastordercode: "",
                    languageUser: context.customerLanguage || "it",
                    agentName: "Non assegnato",
                    agentPhone: "N/A",
                    agentEmail: "N/A",
                    botIdentityResponse: (workspace === null || workspace === void 0 ? void 0 : workspace.botIdentityResponse) || "",
                };
                // Merge: Router data takes priority, but fallback to local workspace data if empty
                const customerDataForPrompt = context.customerData ? Object.assign(Object.assign(Object.assign({}, baseCustomerData), context.customerData), { 
                    // 🔴 CRITICAL: Ensure companyName is NEVER empty
                    companyName: context.customerData.companyName || (workspace === null || workspace === void 0 ? void 0 : workspace.name) || baseCustomerData.companyName }) : baseCustomerData;
                // 🔍 DEBUG: Log what we're passing to preProcessPrompt
                logger_1.default.info(`📋 CartManagementAgent customerDataForPrompt:`, {
                    companyName: customerDataForPrompt.companyName,
                    nameUser: customerDataForPrompt.nameUser,
                    hasRouterData: !!context.customerData,
                    workspaceName: workspace === null || workspace === void 0 ? void 0 : workspace.name,
                });
                // 🆕 Load products with SKU for cart operations
                const productRepo = new product_repository_1.ProductRepository();
                const productsResult = yield productRepo.findAll(context.workspaceId);
                const productsRaw = productsResult.products || [];
                // Format products with SKU for LLM to use in addItemToCart
                const productsFormatted = productsRaw
                    .filter((p) => p.isActive)
                    .map((p) => `- ${p.name} | SKU: ${p.sku} | ${formatCartPrice(p.price)}`)
                    .join("\n");
                logger_1.default.info(`📦 Loaded ${productsRaw.length} products for CartManagement`, {
                    activeProducts: productsRaw.filter((p) => p.isActive).length,
                });
                // 🆕 Load services with serviceCode for cart operations
                const serviceRepo = new service_repository_1.ServiceRepository();
                const servicesRaw = yield serviceRepo.findAll(context.workspaceId);
                // Format services with serviceCode for LLM
                const servicesFormatted = servicesRaw
                    .filter((s) => s.isActive)
                    .map((s) => `- ${s.name} | CODE: ${s.serviceCode} | ${formatCartPrice(s.price)}`)
                    .join("\n");
                logger_1.default.info(`🎁 Loaded ${servicesRaw.length} services for CartManagement`, {
                    activeServices: servicesRaw.filter((s) => s.isActive).length,
                });
                const systemPrompt = yield promptProcessor.preProcessPrompt(systemPromptRaw, context.workspaceId, customerDataForPrompt, {
                    faqs: "",
                    products: productsFormatted, // 🆕 Include products with SKU
                    categories: "",
                    services: servicesFormatted, // 🆕 Include services with CODE
                    offers: "",
                }, undefined, // workspaceUrl
                {
                    address: (workspace === null || workspace === void 0 ? void 0 : workspace.address) || "",
                    customAiRules: (workspace === null || workspace === void 0 ? void 0 : workspace.customAiRules) || "",
                    botIdentityResponse: ((_a = context.customerData) === null || _a === void 0 ? void 0 : _a.botIdentityResponse) || (workspace === null || workspace === void 0 ? void 0 : workspace.botIdentityResponse) || "",
                });
                logger_1.default.info(`✅ Variables replaced in CART_MANAGEMENT prompt`, {
                    originalLength: systemPromptRaw.length,
                    processedLength: systemPrompt.length,
                });
                // STEP 2: Build messages for LLM (with conversation history for context)
                const messages = [
                    {
                        role: "system",
                        content: systemPrompt,
                    },
                ];
                // 🔧 Feature 123: If we have selectedSku from search, CALL DIRECTLY without LLM!
                // The LLM is unreliable and ignores the code we inject - so we bypass it completely
                if (context.selectedSku) {
                    const isService = context.selectedItemType === "SERVICE";
                    const itemLabel = isService ? "Servizio" : "Prodotto";
                    logger_1.default.info(`📦 DIRECT ADD: Bypassing LLM to add item directly`, {
                        selectedSku: context.selectedSku,
                        selectedItemType: context.selectedItemType || "PRODUCT",
                    });
                    // Extract quantity from query (e.g., "aggiungi 2 al carrello" -> 2)
                    const quantityMatch = (_b = context.query.match(/(\d+)/)) === null || _b === void 0 ? void 0 : _b[1];
                    const quantity = quantityMatch ? parseInt(quantityMatch, 10) : 1;
                    // CALL THE FUNCTION DIRECTLY - don't ask LLM
                    const agentContext = {
                        workspaceId: context.workspaceId,
                        customerId: context.customerId,
                    };
                    const result = yield this.cartManagementAgent.addToCart(agentContext, {
                        productId: context.selectedSku, // This is the code (SKU for products, code for services)
                        quantity,
                        type: isService ? "SERVICE" : "PRODUCT",
                    });
                    logger_1.default.info(`📦 DIRECT ADD result`, {
                        success: result.success,
                        selectedSku: context.selectedSku,
                        quantity,
                        itemType: isService ? "SERVICE" : "PRODUCT",
                    });
                    // Get updated cart
                    const cartAfterAdd = yield this.cartManagementAgent.getCart(agentContext);
                    // Update system context
                    yield this.systemContextService.refreshCartSummary(context.workspaceId, context.customerId);
                    // Format response with transport costs
                    const formatted = yield this.formatCartResponseWithTransport(cartAfterAdd, context.workspaceId, context.customerId);
                    // Build success message
                    const successMessage = result.success
                        ? `✅ Aggiunto al carrello: ${itemLabel}`
                        : `❌ Errore: ${result.error || "Impossibile aggiungere al carrello"}`;
                    return {
                        output: `${successMessage}\n\n${formatted.formattedCart}`,
                        success: true,
                        executionTimeMs: 0,
                        functionCalls: [{
                                name: "addToCart",
                                arguments: { items: [{ code: context.selectedSku, quantity, type: isService ? "SERVICE" : "PRODUCT" }] },
                                result: { success: result.success }
                            }],
                        tokensUsed: 0, // No LLM call
                    };
                }
                // Add conversation history if provided (for context awareness)
                if (context.conversationHistory &&
                    context.conversationHistory.length > 0) {
                    logger_1.default.info(`📜 Adding conversation history`, {
                        historyLength: context.conversationHistory.length,
                    });
                    messages.push(...context.conversationHistory);
                }
                // Add current user query
                messages.push({
                    role: "user",
                    content: context.query,
                });
                // STEP 3: Define function calls for cart management
                const functions = this.getCartManagementFunctions();
                // STEP 4: Call LLM (OpenRouter)
                const llmResponse = yield this.callLLM({
                    model: "gpt-4o-mini",
                    messages,
                    functions,
                    temperature: 0.7,
                    maxTokens: 2000,
                });
                let totalTokens = llmResponse.tokensUsed;
                let finalResponse = llmResponse.content || "";
                const functionCalls = [];
                const maxIterations = 5; // Prevent infinite loops
                // STEP 5: Handle function calling loop (like Router)
                let currentResponse = llmResponse;
                let iteration = 0;
                while (currentResponse.function_call && iteration < maxIterations) {
                    iteration++;
                    const functionName = currentResponse.function_call.name;
                    const functionArgs = JSON.parse(currentResponse.function_call.arguments || "{}");
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
                        logger_1.default.error(`🚨 SECURITY VIOLATION: CartManagementAgentLLM tried to call another SubLLM!`, {
                            attemptedFunction: functionName,
                            iteration,
                            args: functionArgs,
                        });
                        throw new Error(`INVALID OPERATION: SubLLM cannot call other SubLLMs. Only Router can delegate to SubAgents. Attempted: ${functionName}`);
                    }
                    logger_1.default.info(`⚙️ CartManagementAgentLLM: Function call ${iteration}/${maxIterations}`, {
                        functionName,
                        args: functionArgs,
                        currentMessagesCount: messages.length,
                    });
                    // Execute function via CartManagementAgent
                    const functionResult = yield this.executeFunction(functionName, functionArgs, context);
                    functionCalls.push({
                        name: functionName,
                        arguments: functionArgs,
                        result: functionResult,
                    });
                    // Add function call + result to conversation
                    messages.push({
                        role: "assistant",
                        content: null,
                        function_call: currentResponse.function_call,
                    });
                    messages.push({
                        role: "function",
                        name: functionName,
                        content: JSON.stringify(functionResult),
                    });
                    // Call LLM again with function result
                    const nextLLMResponse = yield this.callLLM({
                        model: "gpt-4o-mini",
                        messages,
                        functions,
                        temperature: 0.7,
                        maxTokens: 2000,
                    });
                    totalTokens += nextLLMResponse.tokensUsed;
                    currentResponse = nextLLMResponse;
                    logger_1.default.info(`📥 CartManagementAgentLLM: LLM response after function ${iteration}`, {
                        hasContent: !!currentResponse.content,
                        contentPreview: (_c = currentResponse.content) === null || _c === void 0 ? void 0 : _c.substring(0, 100),
                        hasFunctionCall: !!currentResponse.function_call,
                        nextFunctionName: (_d = currentResponse.function_call) === null || _d === void 0 ? void 0 : _d.name,
                        tokensUsed: nextLLMResponse.tokensUsed,
                    });
                    // If LLM returns text response, we're done
                    if (!currentResponse.function_call && currentResponse.content) {
                        finalResponse = currentResponse.content;
                        logger_1.default.info(`✅ CartManagementAgentLLM: Loop completed with text response`);
                        break;
                    }
                }
                // If we exited loop with function_call still present, something went wrong
                if (currentResponse.function_call) {
                    logger_1.default.warn(`⚠️ CartManagementAgentLLM: Max iterations reached with pending function call`, {
                        finalIteration: iteration,
                        pendingFunction: currentResponse.function_call.name,
                        totalFunctionCalls: functionCalls.length,
                        hasContent: !!currentResponse.content,
                    });
                    finalResponse =
                        currentResponse.content ||
                            "I need more information to complete this request.";
                }
                logger_1.default.info(`🏁 CartManagementAgentLLM: Final response`, {
                    success: !!finalResponse,
                    responseLength: (finalResponse === null || finalResponse === void 0 ? void 0 : finalResponse.length) || 0,
                    totalIterations: iteration,
                    totalFunctionCalls: functionCalls.length,
                    totalTokens,
                });
                const executionTimeMs = Date.now() - startTime;
                logger_1.default.info(`✅ CartManagementAgentLLM: Query processed`, {
                    executionTimeMs,
                    tokensUsed: totalTokens,
                    responseLength: finalResponse.length,
                    functionCallsCount: functionCalls.length,
                });
                return {
                    success: true,
                    output: finalResponse,
                    tokensUsed: totalTokens,
                    executionTimeMs,
                    functionCalls,
                    systemPrompt, // 🆕 Include processed prompt for debugging
                    model: "gpt-4o-mini", // 🆕 Include model for debugging timeline
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
                logger_1.default.error("❌ CartManagementAgentLLM error:", errorInfo);
                return {
                    success: false,
                    output: "Error processing cart management request",
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
                        "X-Title": "eChatbot - Cart Management Agent",
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
     * Execute function call via CartManagementAgent
     */
    executeFunction(functionName, args, context) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const agentContext = {
                    workspaceId: context.workspaceId,
                    customerId: context.customerId,
                    customerName: context.customerName,
                    language: context.customerLanguage,
                    customerDiscount: context.customerDiscount, // 🔧 Pass discount for price calculations
                };
                switch (functionName) {
                    case "viewCart": {
                        const cartResult = yield this.cartManagementAgent.getCart(agentContext);
                        // Use async version with transport costs when viewing cart
                        return yield this.formatCartResponseWithTransport(cartResult, context.workspaceId, context.customerId);
                    }
                    case "addItemToCart":
                    case "addToCart": {
                        // Support new format (items array) and legacy format (productId)
                        const items = args.items || [
                            {
                                code: args.productId,
                                quantity: args.quantity || 1,
                                type: "PRODUCT", // Legacy format assumes PRODUCT
                                notes: args.notes,
                            },
                        ];
                        // Process each item
                        const results = [];
                        for (const item of items) {
                            const result = yield this.cartManagementAgent.addToCart(agentContext, {
                                productId: item.code, // Backend expects productId field (but it's actually a code)
                                quantity: item.quantity || 1,
                                notes: item.notes,
                                type: item.type || "PRODUCT", // Pass type: PRODUCT or SERVICE
                            });
                            results.push(Object.assign({ code: item.code, type: item.type }, result));
                        }
                        // Get updated cart and format response
                        const cartAfterAdd = yield this.cartManagementAgent.getCart(agentContext);
                        const allSucceeded = results.every((r) => r.success);
                        // Update system context with new cart state
                        yield this.systemContextService.refreshCartSummary(context.workspaceId, context.customerId);
                        // Use async version with transport costs and Premium option 5
                        const formatted = yield this.formatCartResponseWithTransport(cartAfterAdd, context.workspaceId, context.customerId);
                        return Object.assign({ success: allSucceeded, message: allSucceeded ? "Items added to cart" : "Some items could not be added" }, formatted);
                    }
                    case "removeFromCart": {
                        // Find item in cart by sku or productName
                        const cart = yield this.cartManagementAgent.getCart(agentContext);
                        if (cart.isEmpty) {
                            return { success: false, error: "Cart is empty", formattedCart: "Il tuo carrello è vuoto." };
                        }
                        // Find the item to remove
                        const itemToRemove = cart.cart.items.find((item) => {
                            const product = item.product || item.service;
                            if (!product)
                                return false;
                            // Match by code
                            if (args.sku && (product.sku === args.sku || product.serviceCode === args.sku)) {
                                return true;
                            }
                            // Match by name (case-insensitive partial match)
                            if (args.productName && product.name.toLowerCase().includes(args.productName.toLowerCase())) {
                                return true;
                            }
                            return false;
                        });
                        if (!itemToRemove) {
                            const formatted = yield this.formatCartResponseWithTransport(cart, context.workspaceId, context.customerId);
                            return Object.assign({ success: false, error: `Product "${args.productName || args.sku}" not found in cart` }, formatted);
                        }
                        // Remove the item
                        const removeResult = yield this.cartManagementAgent.removeFromCart(agentContext, itemToRemove.id);
                        // Get updated cart
                        const cartAfterRemove = yield this.cartManagementAgent.getCart(agentContext);
                        // Update system context with new cart state
                        yield this.systemContextService.refreshCartSummary(context.workspaceId, context.customerId);
                        // Use async version with transport costs and Premium option 5
                        const formatted = yield this.formatCartResponseWithTransport(cartAfterRemove, context.workspaceId, context.customerId);
                        return Object.assign({ success: removeResult.success, message: removeResult.success ? `Removed "${itemToRemove.name}" from cart` : removeResult.error }, formatted);
                    }
                    case "updateCartItem":
                    case "updateCartQuantity": {
                        // Find item in cart by sku or productName
                        const cart = yield this.cartManagementAgent.getCart(agentContext);
                        if (cart.isEmpty) {
                            return { success: false, error: "Cart is empty", formattedCart: "Il tuo carrello è vuoto." };
                        }
                        // Find the item to update
                        const itemToUpdate = cart.cart.items.find((item) => {
                            const product = item.product || item.service;
                            if (!product)
                                return false;
                            // Match by code
                            if (args.sku && (product.sku === args.sku || product.serviceCode === args.sku)) {
                                return true;
                            }
                            // Match by name (case-insensitive partial match)
                            if (args.productName && product.name.toLowerCase().includes(args.productName.toLowerCase())) {
                                return true;
                            }
                            return false;
                        });
                        if (!itemToUpdate) {
                            const formatted = yield this.formatCartResponseWithTransport(cart, context.workspaceId, context.customerId);
                            return Object.assign({ success: false, error: `Product "${args.productName || args.sku}" not found in cart` }, formatted);
                        }
                        // If newQuantity is 0, remove the item
                        if (args.newQuantity === 0) {
                            const removeResult = yield this.cartManagementAgent.removeFromCart(agentContext, itemToUpdate.id);
                            const cartAfterRemove = yield this.cartManagementAgent.getCart(agentContext);
                            // Update system context with new cart state
                            yield this.systemContextService.refreshCartSummary(context.workspaceId, context.customerId);
                            // Use async version with transport costs and Premium option 5
                            const formatted = yield this.formatCartResponseWithTransport(cartAfterRemove, context.workspaceId, context.customerId);
                            return Object.assign({ success: removeResult.success, message: `Removed "${itemToUpdate.name}" from cart` }, formatted);
                        }
                        // Update the quantity
                        const updateResult = yield this.cartManagementAgent.updateQuantity(agentContext, {
                            cartItemId: itemToUpdate.id,
                            newQuantity: args.newQuantity,
                        });
                        // Get updated cart
                        const cartAfterUpdate = yield this.cartManagementAgent.getCart(agentContext);
                        // Update system context with new cart state
                        yield this.systemContextService.refreshCartSummary(context.workspaceId, context.customerId);
                        // Use async version with transport costs and Premium option 5
                        const formatted = yield this.formatCartResponseWithTransport(cartAfterUpdate, context.workspaceId, context.customerId);
                        return Object.assign({ success: updateResult.success, message: updateResult.success
                                ? `Updated "${itemToUpdate.name}" quantity to ${args.newQuantity}`
                                : updateResult.error }, formatted);
                    }
                    case "clearCart": {
                        const clearResult = yield this.cartManagementAgent.resetCart(agentContext);
                        // Update system context with empty cart
                        yield this.systemContextService.refreshCartSummary(context.workspaceId, context.customerId);
                        return {
                            success: clearResult.success,
                            message: "Cart cleared",
                            formattedCart: "Il tuo carrello è ora vuoto.",
                        };
                    }
                    case "getLastOrderDetails":
                        // Get customer's last order with full details
                        const orderDetails = yield this.prisma.orders.findFirst({
                            where: {
                                customerId: context.customerId,
                                workspaceId: context.workspaceId,
                                status: "DELIVERED",
                            },
                            orderBy: { createdAt: "desc" },
                            include: {
                                items: {
                                    include: {
                                        product: true,
                                    },
                                },
                            },
                        });
                        if (!orderDetails) {
                            return {
                                success: false,
                                error: "NO_PREVIOUS_ORDER",
                                message: "No previous orders found",
                            };
                        }
                        // Format order summary for LLM response
                        const itemsSummary = orderDetails.items
                            .map((item) => {
                            const product = item.product;
                            return `- ${product.name} x${item.quantity} (${formatCartPrice(item.unitPrice)})`;
                        })
                            .join("\n");
                        const totalPrice = orderDetails.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
                        return {
                            success: true,
                            orderCode: orderDetails.orderCode,
                            orderDate: orderDetails.createdAt.toISOString().split("T")[0],
                            itemsCount: orderDetails.items.length,
                            totalPrice: (0, pricing_1.smartRoundPrice)(totalPrice).toString(),
                            itemsSummary, // Formatted string ready for LLM
                            items: orderDetails.items.map((item) => ({
                                productName: item.product.name,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                total: (0, pricing_1.smartRoundPrice)(item.unitPrice * item.quantity).toString(),
                            })),
                        };
                    case "repeatLastOrder":
                        // Get customer's last completed order (DELIVERED = completed)
                        const lastOrder = yield this.prisma.orders.findFirst({
                            where: {
                                customerId: context.customerId,
                                workspaceId: context.workspaceId,
                                status: "DELIVERED",
                            },
                            orderBy: { createdAt: "desc" },
                            include: {
                                items: {
                                    include: {
                                        product: true,
                                    },
                                },
                            },
                        });
                        if (!lastOrder) {
                            logger_1.default.warn("repeatLastOrder: No previous DELIVERED orders found", {
                                customerId: context.customerId,
                                workspaceId: context.workspaceId,
                            });
                            return {
                                success: false,
                                error: "NO_PREVIOUS_ORDER",
                                message: "You don't have any previous orders to repeat",
                            };
                        }
                        logger_1.default.info("repeatLastOrder: Found last order", {
                            orderId: lastOrder.id,
                            orderCode: lastOrder.orderCode,
                            itemsCount: lastOrder.items.length,
                            items: lastOrder.items.map((i) => {
                                var _a;
                                return ({
                                    productId: i.productId,
                                    productName: (_a = i.product) === null || _a === void 0 ? void 0 : _a.name,
                                    quantity: i.quantity,
                                });
                            }),
                        });
                        // Call repeatOrder with lastOrder.id
                        const repeatResult = yield this.cartManagementAgent.repeatOrder(agentContext, {
                            orderId: lastOrder.id,
                        });
                        logger_1.default.info("repeatLastOrder: Result from CartManagementAgent", {
                            success: repeatResult.success,
                            message: repeatResult.message,
                            error: repeatResult.error,
                            cartItemCount: (_a = repeatResult.cart) === null || _a === void 0 ? void 0 : _a.itemCount,
                        });
                        return repeatResult;
                    default:
                        logger_1.default.warn(`Unknown function: ${functionName}`);
                        return {
                            success: false,
                            error: `Unknown function: ${functionName}`,
                        };
                }
            }
            catch (error) {
                logger_1.default.error(`Error executing function ${functionName}:`, error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                };
            }
        });
    }
    /**
     * Get function definitions for cart management
     */
    getCartManagementFunctions() {
        return [
            {
                name: "viewCart",
                description: "View current cart contents with all items, quantities, and total price",
                parameters: {
                    type: "object",
                    properties: {},
                    required: [],
                },
            },
            {
                name: "addItemToCart",
                description: "Add products or services to cart. Supports both PRODUCT and SERVICE types. Use AFTER customer confirmation.",
                parameters: {
                    type: "object",
                    properties: {
                        items: {
                            type: "array",
                            description: "Array of items to add. For single item, use array with 1 element.",
                            items: {
                                type: "object",
                                properties: {
                                    code: {
                                        type: "string",
                                        description: "Product or service code (e.g., 'BUR-001', 'SRV-001')",
                                    },
                                    quantity: {
                                        type: "number",
                                        description: "Quantity (default: 1, must be >= 1)",
                                    },
                                    type: {
                                        type: "string",
                                        enum: ["PRODUCT", "SERVICE"],
                                        description: "PRODUCT for products, SERVICE for services",
                                    },
                                    notes: {
                                        type: "string",
                                        description: "Optional notes for this item",
                                    },
                                },
                                required: ["code", "type"],
                            },
                        },
                    },
                    required: ["items"],
                },
            },
            {
                name: "removeFromCart",
                description: "Remove an item from the cart by product/service code or name. Use when customer says 'remove the mozzarella' or 'togli il panettone'",
                parameters: {
                    type: "object",
                    properties: {
                        sku: {
                            type: "string",
                            description: "Product or service code to remove (e.g., 'BUR-001')",
                        },
                        productName: {
                            type: "string",
                            description: "Product or service name to remove (e.g., 'Mozzarella di Bufala'). Use if code is unknown.",
                        },
                    },
                    required: [],
                },
            },
            {
                name: "updateCartItem",
                description: "Update the quantity of an item in the cart. Use when customer says 'I want 5 panettoni instead of 3', 'change mozzarella to 2', 'voglio solo una mozzarella' (reduce quantity to 1), 'metti 3 burrate'. ⚠️ 'voglio solo X' means 'reduce X to 1', NOT 'clear cart'!",
                parameters: {
                    type: "object",
                    properties: {
                        sku: {
                            type: "string",
                            description: "Product or service code to update (e.g., 'BUR-001')",
                        },
                        productName: {
                            type: "string",
                            description: "Product or service name to update (e.g., 'Panettone'). Use if code is unknown.",
                        },
                        newQuantity: {
                            type: "number",
                            description: "New quantity (must be >= 0). Use 0 to remove the item.",
                        },
                    },
                    required: ["newQuantity"],
                },
            },
            {
                name: "clearCart",
                description: "Remove ALL items from the cart. ⚠️ Use ONLY when customer explicitly says 'svuota carrello', 'cancella tutto', 'elimina carrello'. NEVER use for 'voglio solo X' (that's updateCartItem!)",
                parameters: {
                    type: "object",
                    properties: {},
                    required: [],
                },
            },
            {
                name: "getLastOrderDetails",
                description: "Get details of customer's most recent DELIVERED order including product list. Use BEFORE repeatLastOrder to show products to customer.",
                parameters: {
                    type: "object",
                    properties: {},
                    required: [],
                },
            },
            {
                name: "repeatLastOrder",
                description: "Copy all items from customer's most recent DELIVERED order to current cart. Use AFTER showing order details with getLastOrderDetails and receiving confirmation.",
                parameters: {
                    type: "object",
                    properties: {},
                    required: [],
                },
            },
        ];
    }
    /**
     * Format cart response as a readable text for WhatsApp
     * Returns formatted string and prices (already discounted from CartManagementAgent)
     * Now includes transport costs breakdown (Feature: optimize-transport)
     */
    formatCartResponseWithTransport(cartResult, workspaceId, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            if (!cartResult.success) {
                return {
                    formattedCart: "Errore nel caricamento del carrello",
                    cartData: cartResult,
                };
            }
            if (cartResult.isEmpty || !((_b = (_a = cartResult.cart) === null || _a === void 0 ? void 0 : _a.items) === null || _b === void 0 ? void 0 : _b.length)) {
                return {
                    formattedCart: "Il tuo carrello è vuoto.",
                    cartData: cartResult,
                };
            }
            const cart = cartResult.cart;
            const lines = ["Ecco il tuo carrello:", ""];
            let totalItems = 0;
            // Use itemType field for filtering (not item.product/item.service objects)
            const products = cart.items.filter((item) => item.itemType === "PRODUCT" || (!item.itemType && item.product));
            const services = cart.items.filter((item) => item.itemType === "SERVICE" || (!item.itemType && item.service));
            // Display Products with emoji
            if (products.length > 0) {
                lines.push("🛒 Prodotti:");
                for (const item of products) {
                    const name = item.name || ((_c = item.product) === null || _c === void 0 ? void 0 : _c.name) || "Unknown";
                    const quantity = item.quantity || 1;
                    totalItems += quantity;
                    const unitPrice = item.unitPrice || ((_d = item.product) === null || _d === void 0 ? void 0 : _d.price) || 0;
                    const itemTotal = item.total || (unitPrice * quantity);
                    lines.push(`- ${quantity}x ${name} - ${formatCartPrice(itemTotal)}`);
                }
            }
            // Display Services (without quantity) with emoji
            if (services.length > 0) {
                if (products.length > 0)
                    lines.push("");
                lines.push("🔧 Servizi:");
                for (const item of services) {
                    const name = item.name || ((_e = item.service) === null || _e === void 0 ? void 0 : _e.name) || "Unknown";
                    const itemTotal = item.total || ((_f = item.service) === null || _f === void 0 ? void 0 : _f.price) || 0;
                    lines.push(`- ${name} - ${formatCartPrice(itemTotal)}`);
                }
            }
            // Calculate product subtotal
            const productSubtotal = cart.total || cart.items.reduce((sum, item) => {
                var _a, _b;
                const price = item.unitPrice || ((_a = item.product) === null || _a === void 0 ? void 0 : _a.price) || ((_b = item.service) === null || _b === void 0 ? void 0 : _b.price) || 0;
                return sum + (price * (item.quantity || 1));
            }, 0);
            // Transport costs (Feature: optimize-transport)
            let totalTransportCost = 0;
            try {
                const orderOptimizationService = new order_optimization_service_1.OrderOptimizationService(this.prisma);
                const isTransportConfigured = yield orderOptimizationService.hasTransportPricesConfigured(workspaceId);
                if (isTransportConfigured) {
                    const analysis = yield orderOptimizationService.analyzeCart(workspaceId, customerId);
                    if (!analysis.isEmpty && analysis.transports.length > 0) {
                        lines.push("");
                        lines.push("Spedizione:");
                        const selectedTransportId = analysis.selectedTransportTypeId;
                        const selectedTransportCost = analysis.totalTransportCost;
                        for (const transport of analysis.transports) {
                            // Translate transport type: "Refrigerated" → "Frigorifero"
                            const transportName = transport.transportTypeName === "Refrigerated" ? "Frigorifero" : transport.transportTypeName;
                            const isSelected = selectedTransportId
                                ? transport.transportTypeId === selectedTransportId
                                : Math.abs(transport.transportPrice - selectedTransportCost) < 0.01;
                            const selectionLabel = isSelected ? " (selezionata)" : "";
                            lines.push(`- ${transportName}${selectionLabel}: ${formatCartPrice(transport.transportPrice)}`);
                        }
                        // Calculate total: productSubtotal + transport (no "Totale spedizione" line)
                        totalTransportCost = analysis.totalTransportCost;
                        const grandTotal = Math.round((productSubtotal + totalTransportCost) * 100) / 100;
                        lines.push("");
                        lines.push(`<b>💰 totale ordine: ${formatCartPrice(grandTotal)}</b>`);
                    }
                }
            }
            catch (error) {
                // If transport calculation fails, just show products total
                logger_1.default.warn("Could not calculate transport costs", { error, workspaceId });
                lines.push("");
                lines.push(`<b>💰 totale: ${formatCartPrice(productSubtotal)}</b>`);
            }
            // Show discount message if applicable
            const discountPercent = cart.discountApplied || 0;
            if (discountPercent > 0) {
                lines.push("");
                lines.push(`ℹ️ Abbiamo applicato il tuo sconto personale del <b>${discountPercent}</b>%. I prezzi mostrati includono già lo sconto.`);
                lines.push(`I prezzi sono IVA esclusa.`);
            }
            const uniqueItemsCount = Array.isArray(cart.items) ? cart.items.length : 0;
            let actionNumber = 1;
            // TODO: "Ottimizza spedizione" feature - will be implemented later
            // Check if workspace has Premium/Enterprise plan for optimization option
            // let showOptimizationOption = false
            // try {
            //   const workspace = await this.prisma.workspace.findUnique({
            //     where: { id: workspaceId },
            //     select: { planType: true }
            //   })
            //   showOptimizationOption = workspace?.planType === 'PREMIUM' || workspace?.planType === 'ENTERPRISE'
            // } catch (err) {
            //   logger.warn("⚠️ Could not check workspace plan type", { error: err, workspaceId })
            // }
            lines.push("");
            lines.push("Cosa vuoi fare?");
            lines.push(`<b>${actionNumber++}.</b> Confermare l'ordine`);
            lines.push(`<b>${actionNumber++}.</b> Esplorare il catalogo`);
            lines.push(`<b>${actionNumber++}.</b> Mostra servizi`);
            lines.push(`<b>${actionNumber++}.</b> Guardare le offerte`);
            lines.push(`<b>${actionNumber++}.</b> Cancella il carrello`);
            // TODO: "Ottimizza spedizione" feature - will be implemented later
            // Option: Order optimization (Premium/Enterprise only)
            // if (showOptimizationOption) {
            //   lines.push(`<b>${actionNumber++}.</b> Ottimizza spedizione`)
            // }
            lines.push("");
            lines.push("Rispondi con il numero o scrivi cosa stai cercando");
            return {
                formattedCart: lines.join("\n"),
                cartData: cartResult,
            };
        });
    }
    /**
     * Format cart response as a readable text for WhatsApp (sync version)
     * Returns formatted string with emoji and prices (already discounted from CartManagementAgent)
     */
    formatCartResponse(cartResult) {
        var _a, _b, _c, _d, _e, _f;
        if (!cartResult.success) {
            return {
                formattedCart: "Errore nel caricamento del carrello",
                cartData: cartResult,
            };
        }
        if (cartResult.isEmpty || !((_b = (_a = cartResult.cart) === null || _a === void 0 ? void 0 : _a.items) === null || _b === void 0 ? void 0 : _b.length)) {
            return {
                formattedCart: "Il tuo carrello è vuoto.",
                cartData: cartResult,
            };
        }
        const cart = cartResult.cart;
        const lines = ["Ecco il tuo carrello:", ""];
        let totalItems = 0;
        // 🎯 Use itemType field (PRODUCT/SERVICE) for reliable filtering
        const products = cart.items.filter((item) => item.itemType === "PRODUCT");
        const services = cart.items.filter((item) => item.itemType === "SERVICE");
        // Display Products
        if (products.length > 0) {
            lines.push("🛒 Prodotti:");
            for (const item of products) {
                const name = item.name || ((_c = item.product) === null || _c === void 0 ? void 0 : _c.name) || "Unknown";
                const quantity = item.quantity || 1;
                totalItems += quantity;
                const unitPrice = item.unitPrice || ((_d = item.product) === null || _d === void 0 ? void 0 : _d.price) || 0;
                const itemTotal = item.total || (unitPrice * quantity);
                lines.push(`- ${quantity}x ${name} - ${formatCartPrice(itemTotal)}`);
            }
        }
        // Display Services (without quantity prefix)
        if (services.length > 0) {
            if (products.length > 0)
                lines.push("");
            lines.push("🔧 Servizi:");
            for (const item of services) {
                const name = item.name || ((_e = item.service) === null || _e === void 0 ? void 0 : _e.name) || "Unknown";
                const itemTotal = item.total || ((_f = item.service) === null || _f === void 0 ? void 0 : _f.price) || 0;
                lines.push(`- ${name} - ${formatCartPrice(itemTotal)}`);
            }
        }
        // Add total
        const total = cart.total || cart.items.reduce((sum, item) => {
            var _a, _b;
            const price = item.unitPrice || ((_a = item.product) === null || _a === void 0 ? void 0 : _a.price) || ((_b = item.service) === null || _b === void 0 ? void 0 : _b.price) || 0;
            return sum + (price * (item.quantity || 1));
        }, 0);
        lines.push("");
        lines.push(`<b>💰 totale ordine: ${formatCartPrice(total)}</b>`);
        // Show discount message if applicable
        const discountPercent = cart.discountApplied || 0;
        if (discountPercent > 0) {
            lines.push("");
            lines.push(`ℹ️ Abbiamo applicato il tuo sconto personale del <b>${discountPercent}</b>%. I prezzi mostrati includono già lo sconto.`);
            lines.push(`I prezzi sono IVA esclusa.`);
        }
        const uniqueItemsCount = Array.isArray(cart.items) ? cart.items.length : 0;
        const allowRemoveOption = uniqueItemsCount > 1;
        let actionNumber = 1;
        lines.push("");
        lines.push("Cosa vuoi fare?");
        lines.push(`<b>${actionNumber++}.</b> Confermare l'ordine`);
        lines.push(`<b>${actionNumber++}.</b> Esplorare il catalogo`);
        lines.push(`<b>${actionNumber++}.</b> Mostrami servizi`);
        lines.push(`<b>${actionNumber++}.</b> Vedere le offerte`);
        lines.push(`<b>${actionNumber++}.</b> Cancellare il carrello`);
        lines.push("");
        lines.push("Rispondi con il numero o scrivi cosa desideri!");
        return {
            formattedCart: lines.join("\n"),
            cartData: cartResult,
        };
    }
}
exports.CartManagementAgentLLM = CartManagementAgentLLM;
//# sourceMappingURL=CartManagementAgentLLM.js.map