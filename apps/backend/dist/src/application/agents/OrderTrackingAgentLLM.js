"use strict";
/**
 * OrderTrackingAgentLLM
 *
 * ✅ SPECIALIST AGENT with OWN LLM - Clean Architecture
 *
 * Responsibilities:
 * 1. Handle order tracking queries with dedicated LLM
 * 2. Execute function calls for order status/history
 * 3. Return English response with [LINK_xxx] tokens
 *
 * Architecture:
 * - Own LLM instance (OpenRouter + GPT-4o-mini)
 * - Own system prompt from files (TemplateLoaderService loads from /templates/ecommerce/03-order-tracking.template.md)
 * - Function execution via OrderRepository
 * - Returns English ONLY (Router handles translation)
 *
 * Flow:
 * 1. Router delegates query → OrderTrackingAgentLLM
 * 2. Load system prompt from database (agentType: ORDER_TRACKING)
 * 3. Call LLM with order tracking functions
 * 4. Execute functions via OrderRepository
 * 5. Return English response with tokens → Router
 *
 * Security:
 * - ALL queries filtered by workspaceId + customerId
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
exports.OrderTrackingAgentLLM = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../../config");
const order_repository_1 = require("../../repositories/order.repository");
const template_loader_service_1 = require("../services/template-loader.service");
const prompt_processor_service_1 = require("../../services/prompt-processor.service");
const calling_functions_service_1 = require("../../services/calling-functions.service");
const system_context_service_1 = require("../../services/system-context.service");
const logger_1 = __importDefault(require("../../utils/logger"));
const link_generator_service_1 = require("../services/link-generator.service");
class OrderTrackingAgentLLM {
    constructor(prisma) {
        this.prisma = prisma;
        this.orderRepo = new order_repository_1.OrderRepository();
        this.templateLoader = template_loader_service_1.TemplateLoaderService.getInstance(prisma);
        this.systemContextService = (0, system_context_service_1.getSystemContextService)(prisma);
        // Initialize CallingFunctionsService with LinkGeneratorService
        const linkGeneratorService = new link_generator_service_1.LinkGeneratorService();
        this.callingFunctionsService = new calling_functions_service_1.CallingFunctionsService(linkGeneratorService);
        // OpenRouter API configuration
        this.openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
        this.openRouterBaseUrl = "https://openrouter.ai/api/v1";
        if (!this.openRouterApiKey) {
            throw new Error("OPENROUTER_API_KEY is required for OrderTrackingAgentLLM");
        }
    }
    /**
     * Handle order tracking query with LLM
     */
    handleQuery(context) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g;
            const startTime = Date.now();
            let directOptionMapping;
            try {
                logger_1.default.info(`📦 OrderTrackingAgentLLM: Processing query`, {
                    workspaceId: context.workspaceId,
                    customerId: context.customerId,
                    query: context.query.substring(0, 100),
                });
                // STEP 1: Load system prompt from template files
                let systemPromptRaw = yield this.templateLoader.loadAndRenderTemplate("ORDER_TRACKING", context.workspaceId);
                logger_1.default.info(`📋 Loaded ORDER_TRACKING template from files`, {
                    promptLength: systemPromptRaw.length,
                });
                // 🆕 STEP 1.3: Load workspace config for dynamic fields (customAiRules, botIdentityResponse, etc.)
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: context.workspaceId },
                    select: {
                        name: true,
                        address: true,
                        customAiRules: true,
                        botIdentityResponse: true,
                    },
                });
                // Replace variables in system prompt
                if (context.lastOrderCode) {
                    systemPromptRaw = systemPromptRaw.replace(/\{\{lastordercode\}\}/g, context.lastOrderCode);
                    logger_1.default.info(`✅ Replaced {{lastordercode}} with: ${context.lastOrderCode}`);
                }
                // 🔧 STEP 1.5: Replace ALL variables ({{companyName}}, {{nameUser}}, etc.)
                // CRITICAL: Must call preProcessPrompt to render variables before passing to LLM
                const promptProcessor = new prompt_processor_service_1.PromptProcessorService();
                // 🔧 OPTIMIZATION: Use pre-loaded customerData from Router if available (avoids duplicate DB queries)
                // 🔴 CRITICAL FIX: Merge Router data with workspace fallbacks to ensure no empty values
                const baseCustomerData = {
                    nameUser: context.customerName || "",
                    email: "",
                    phone: "",
                    discountUser: 0,
                    companyName: (workspace === null || workspace === void 0 ? void 0 : workspace.name) || "",
                    lastordercode: context.lastOrderCode || "",
                    languageUser: context.customerLanguage || "it",
                    agentName: "Non assegnato",
                    agentPhone: "N/A",
                    agentEmail: "N/A",
                    botIdentityResponse: (workspace === null || workspace === void 0 ? void 0 : workspace.botIdentityResponse) || "",
                };
                // Merge: Router data takes priority, but fallback to local workspace data if empty
                const customerDataForPrompt = context.customerData ? Object.assign(Object.assign(Object.assign({}, baseCustomerData), context.customerData), { 
                    // 🔴 CRITICAL: Ensure companyName is NEVER empty
                    companyName: context.customerData.companyName || (workspace === null || workspace === void 0 ? void 0 : workspace.name) || baseCustomerData.companyName, lastordercode: context.lastOrderCode || context.customerData.lastordercode || "" }) : baseCustomerData;
                // 🔍 DEBUG: Log what we're passing to preProcessPrompt
                logger_1.default.info(`📋 OrderTrackingAgent customerDataForPrompt:`, {
                    companyName: customerDataForPrompt.companyName,
                    nameUser: customerDataForPrompt.nameUser,
                    lastordercode: customerDataForPrompt.lastordercode,
                    hasRouterData: !!context.customerData,
                    workspaceName: workspace === null || workspace === void 0 ? void 0 : workspace.name,
                });
                const systemPrompt = yield promptProcessor.preProcessPrompt(systemPromptRaw, context.workspaceId, customerDataForPrompt, {
                    faqs: "",
                    products: "",
                    categories: "",
                    services: "",
                    offers: "",
                }, undefined, // workspaceUrl
                {
                    address: (workspace === null || workspace === void 0 ? void 0 : workspace.address) || "",
                    customAiRules: (workspace === null || workspace === void 0 ? void 0 : workspace.customAiRules) || "",
                    botIdentityResponse: ((_a = context.customerData) === null || _a === void 0 ? void 0 : _a.botIdentityResponse) || (workspace === null || workspace === void 0 ? void 0 : workspace.botIdentityResponse) || "",
                });
                logger_1.default.info(`✅ Variables replaced in ORDER_TRACKING prompt`, {
                    originalLength: systemPromptRaw.length,
                    processedLength: systemPrompt.length,
                });
                // STEP 2: Build messages for LLM
                const messages = [
                    {
                        role: "system",
                        content: systemPrompt, // ✅ Use prompt with replaced variables
                    },
                    {
                        role: "user",
                        content: context.query,
                    },
                ];
                // STEP 3: Define function calls for order tracking
                const functions = this.getOrderTrackingFunctions();
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
                // 🔍 DEBUG: Log LLM response to understand empty responses
                logger_1.default.info(`🔍 OrderTrackingAgentLLM: LLM Response received`, {
                    hasContent: !!llmResponse.content,
                    contentLength: ((_b = llmResponse.content) === null || _b === void 0 ? void 0 : _b.length) || 0,
                    hasFunctionCall: !!llmResponse.function_call,
                    functionCallName: ((_c = llmResponse.function_call) === null || _c === void 0 ? void 0 : _c.name) || null,
                    tokensUsed: llmResponse.tokensUsed,
                });
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
                        logger_1.default.error(`🚨 SECURITY VIOLATION: OrderTrackingAgentLLM tried to call another SubLLM!`, {
                            attemptedFunction: functionName,
                            args: functionArgs,
                        });
                        throw new Error(`INVALID OPERATION: SubLLM cannot call other SubLLMs. Only Router can delegate to SubAgents. Attempted: ${functionName}`);
                    }
                    logger_1.default.info(`⚙️ OrderTrackingAgentLLM: Function call requested`, {
                        functionName,
                        args: functionArgs,
                    });
                    // Execute function via OrderRepository
                    const functionResult = yield this.executeFunction(functionName, functionArgs, context);
                    functionCalls.push({
                        name: functionName,
                        arguments: functionArgs,
                        result: functionResult,
                    });
                    // 🔧 DIRECT RETURN: For repeatOrder, confirmOrder, showCheckout - return message directly without LLM reformulation
                    // This preserves formatting (newlines, markdown, etc.)
                    const isRepeatOrder = functionName.toLowerCase() === "repeatorder";
                    const isConfirmOrder = functionName.toLowerCase() === "confirmorder";
                    const isShowCheckout = functionName.toLowerCase() === "showcheckout";
                    const shouldReturnDirectly = isRepeatOrder || isConfirmOrder || isShowCheckout;
                    logger_1.default.info(`🔍 Function check: functionName="${functionName}", shouldReturnDirectly=${shouldReturnDirectly}, success=${functionResult === null || functionResult === void 0 ? void 0 : functionResult.success}, hasMessage=${!!(functionResult === null || functionResult === void 0 ? void 0 : functionResult.message)}`);
                    if (shouldReturnDirectly && (functionResult === null || functionResult === void 0 ? void 0 : functionResult.success) && (functionResult === null || functionResult === void 0 ? void 0 : functionResult.message)) {
                        logger_1.default.info(`🚀 ${functionName}: Returning message directly (no LLM reformulation)`);
                        logger_1.default.info(`📝 Message preview: ${functionResult.message.substring(0, 200)}...`);
                        finalResponse = functionResult.message;
                        if (functionResult.nextActions) {
                            directOptionMapping = functionResult.nextActions;
                        }
                        // 🔧 Replace customer variables in the response
                        if (finalResponse.includes("{{nameUser}}") || finalResponse.includes("{{agentName}}")) {
                            // Fetch agent name from customer's assigned sales rep
                            let agentName = "our team";
                            try {
                                const customer = yield this.prisma.customers.findUnique({
                                    where: { id: context.customerId },
                                    include: { sales: true }
                                });
                                if (customer === null || customer === void 0 ? void 0 : customer.sales) {
                                    agentName = `${customer.sales.firstName} ${customer.sales.lastName}`.trim();
                                }
                            }
                            catch (e) {
                                logger_1.default.warn("Could not fetch customer sales rep, using default");
                            }
                            finalResponse = finalResponse
                                .replace(/\{\{nameUser\}\}/gi, context.customerName || "Customer")
                                .replace(/\{\{agentName\}\}/gi, agentName);
                            logger_1.default.info(`🔄 Replaced customer variables in direct response: nameUser=${context.customerName}, agentName=${agentName}`);
                        }
                        // Generate proper PROFILE link (not cart link!) - for repeatOrder and showCheckout
                        if ((isRepeatOrder || isShowCheckout || isConfirmOrder) && finalResponse && finalResponse.includes("[LINK_PROFILE_WITH_TOKEN]")) {
                            try {
                                const CallingFunctionsService = require("../../services/calling-functions.service").CallingFunctionsService;
                                const callingFunctionsService = new CallingFunctionsService();
                                const profileLinkResult = yield callingFunctionsService.getProfileLink({
                                    customerId: context.customerId,
                                    workspaceId: context.workspaceId,
                                });
                                if ((profileLinkResult === null || profileLinkResult === void 0 ? void 0 : profileLinkResult.success) && (profileLinkResult === null || profileLinkResult === void 0 ? void 0 : profileLinkResult.linkUrl)) {
                                    finalResponse = finalResponse.replace(/\[LINK_PROFILE_WITH_TOKEN\]/gi, profileLinkResult.linkUrl);
                                    logger_1.default.info(`🔗 Replaced [LINK_PROFILE_WITH_TOKEN] → ${profileLinkResult.linkUrl}`);
                                }
                                else {
                                    logger_1.default.warn(`⚠️ Failed to generate profile link, keeping token`);
                                }
                            }
                            catch (error) {
                                logger_1.default.error(`❌ Error generating profile link:`, error);
                            }
                        }
                    }
                    else {
                        // STEP 6: Return function result to LLM for final response (default behavior)
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
                            model: "gpt-4o-mini",
                            messages,
                            functions,
                            temperature: 0.7,
                            maxTokens: 2000,
                        });
                        totalTokens += finalLLMResponse.tokensUsed;
                        finalResponse = finalLLMResponse.content || "";
                        // 🔗 Replace [LINK_ORDER_WITH_TOKEN] with secure short link
                        logger_1.default.info(`🔍 Checking for LINK_ORDER_WITH_TOKEN replacement:`, {
                            hasSecureLink: !!(functionResult === null || functionResult === void 0 ? void 0 : functionResult.secureLink),
                            secureLink: functionResult === null || functionResult === void 0 ? void 0 : functionResult.secureLink,
                            hasPlaceholder: finalResponse === null || finalResponse === void 0 ? void 0 : finalResponse.includes('[LINK_ORDER_WITH_TOKEN]'),
                        });
                        if (finalResponse === null || finalResponse === void 0 ? void 0 : finalResponse.includes('[LINK_ORDER_WITH_TOKEN]')) {
                            if (functionResult === null || functionResult === void 0 ? void 0 : functionResult.secureLink) {
                                finalResponse = finalResponse.replace(/\[LINK_ORDER_WITH_TOKEN\]/gi, functionResult.secureLink);
                                logger_1.default.info(`🔗 Replaced [LINK_ORDER_WITH_TOKEN] → ${functionResult.secureLink}`);
                            }
                            else {
                                // 🔧 Fallback: Generate the link now if not available
                                logger_1.default.warn(`⚠️ secureLink not found in functionResult, generating now...`);
                                try {
                                    // Try to extract orderCode from functionResult
                                    const orderCode = (functionResult === null || functionResult === void 0 ? void 0 : functionResult.orderCode) || ((_d = functionResult === null || functionResult === void 0 ? void 0 : functionResult.order) === null || _d === void 0 ? void 0 : _d.orderCode);
                                    if (orderCode) {
                                        const linkResult = yield this.callingFunctionsService.getOrdersListLink({
                                            customerId: context.customerId,
                                            workspaceId: context.workspaceId,
                                            orderCode: orderCode,
                                        });
                                        if (linkResult === null || linkResult === void 0 ? void 0 : linkResult.linkUrl) {
                                            finalResponse = finalResponse.replace(/\[LINK_ORDER_WITH_TOKEN\]/gi, linkResult.linkUrl);
                                            logger_1.default.info(`🔗 Generated and replaced [LINK_ORDER_WITH_TOKEN] → ${linkResult.linkUrl}`);
                                        }
                                        else {
                                            // Remove placeholder if we can't generate link
                                            finalResponse = finalResponse.replace(/\[LINK_ORDER_WITH_TOKEN\]/gi, '(link non disponibile)');
                                            logger_1.default.warn(`⚠️ Could not generate order link, placeholder removed`);
                                        }
                                    }
                                    else {
                                        // Remove placeholder if no orderCode
                                        finalResponse = finalResponse.replace(/\[LINK_ORDER_WITH_TOKEN\]/gi, '(link non disponibile)');
                                        logger_1.default.warn(`⚠️ No orderCode found, placeholder removed`);
                                    }
                                }
                                catch (linkError) {
                                    logger_1.default.error(`❌ Error generating fallback order link:`, linkError);
                                    finalResponse = finalResponse.replace(/\[LINK_ORDER_WITH_TOKEN\]/gi, '(link non disponibile)');
                                }
                            }
                        }
                    }
                }
                const executionTimeMs = Date.now() - startTime;
                // 🔧 FALLBACK: If response is empty, provide a helpful message
                if (!finalResponse || finalResponse.trim() === "") {
                    logger_1.default.warn(`⚠️ OrderTrackingAgentLLM: Empty response detected, using fallback`);
                    finalResponse = "I'm sorry, I couldn't process your request. Please try again or ask in a different way.";
                }
                logger_1.default.info(`✅ OrderTrackingAgentLLM: Query processed`, {
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
                    optionMapping: directOptionMapping,
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
                logger_1.default.error("❌ OrderTrackingAgentLLM error:", errorInfo);
                return {
                    success: false,
                    output: "Error processing order tracking request",
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
                        "X-Title": "eChatbot - Order Tracking Agent",
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
     * Execute function call via OrderRepository
     */
    executeFunction(functionName, args, context) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                switch (functionName) {
                    case "getOrderHistory":
                        return yield this.orderRepo.findByCustomerId(context.workspaceId, context.customerId);
                    case "getLastOrders":
                        // Get last N orders with summary details
                        const limit = args.limit || 20;
                        const allOrders = yield this.orderRepo.findByCustomerId(context.customerId, // ✅ customerId first
                        context.workspaceId // ✅ workspaceId second
                        );
                        // Return only the first N orders (already sorted by date DESC)
                        const limitedOrders = allOrders.slice(0, Math.min(limit, 50));
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
                    case "getOrderDetails":
                        // If orderCode provided, get specific order
                        let order = null;
                        if (args.orderCode) {
                            order = yield this.orderRepo.findByOrderCode(args.orderCode, // ✅ orderCode first
                            context.workspaceId // ✅ workspaceId second
                            );
                        }
                        else {
                            // If no orderCode, get last order
                            const orders = yield this.orderRepo.findByCustomerId(context.customerId, // ✅ customerId first
                            context.workspaceId // ✅ workspaceId second
                            );
                            order = orders && orders.length > 0 ? orders[0] : null;
                        }
                        if (!order) {
                            return null;
                        }
                        // Generate secure link with token
                        const linkResult = yield this.callingFunctionsService.getOrdersListLink({
                            customerId: context.customerId,
                            workspaceId: context.workspaceId,
                            orderCode: order.orderCode, // ✅ Pass orderCode to generate specific order link
                        });
                        // Return order data + link
                        return Object.assign(Object.assign({}, order), { secureLink: linkResult.linkUrl || null, linkToken: linkResult.token || null, linkExpiresAt: linkResult.expiresAt || null });
                    case "trackOrderStatus":
                        const trackedOrder = yield this.orderRepo.findByOrderCode(args.orderCode, // ✅ orderCode first
                        context.workspaceId // ✅ workspaceId second
                        );
                        return {
                            success: !!trackedOrder,
                            order: trackedOrder || null,
                            status: (trackedOrder === null || trackedOrder === void 0 ? void 0 : trackedOrder.status) || "NOT_FOUND",
                        };
                    case "repeatOrder":
                        // Call repeatOrder domain function directly
                        const { repeatOrder, } = require("../../domain/calling-functions/repeatOrder");
                        return yield repeatOrder({
                            customerId: context.customerId,
                            workspaceId: context.workspaceId,
                            orderCode: args.orderCode, // Optional - uses last order if not provided
                        });
                    case "confirmOrder":
                        // Call confirmOrder domain function to create order from cart
                        const { confirmOrder, } = require("../../domain/calling-functions/confirmOrder");
                        return yield confirmOrder({
                            customerId: context.customerId,
                            workspaceId: context.workspaceId,
                        });
                    case "showCheckout":
                        // Call showCheckout domain function to display cart summary
                        const { showCheckout, } = require("../../domain/calling-functions/showCheckout");
                        return yield showCheckout({
                            customerId: context.customerId,
                            workspaceId: context.workspaceId,
                        });
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
     * Get function definitions for order tracking
     */
    getOrderTrackingFunctions() {
        return [
            {
                name: "getOrderHistory",
                description: "Get customer's order history with most recent orders first",
                parameters: {
                    type: "object",
                    properties: {
                        limit: {
                            type: "number",
                            description: "Maximum number of orders to return (default: 10)",
                        },
                    },
                    required: [],
                },
            },
            {
                name: "getLastOrders",
                description: "Get last N orders with summary details (orderCode, date, total, status). Use this when customer asks for 'orders', 'my orders', 'recent orders' or 'order history'.",
                parameters: {
                    type: "object",
                    properties: {
                        limit: {
                            type: "number",
                            description: "Number of orders to return (default: 20, max: 50). Use default to show all recent orders.",
                        },
                    },
                    required: [],
                },
            },
            {
                name: "getOrderDetails",
                description: "Get detailed information about a specific order by order code, or get last order if no code provided",
                parameters: {
                    type: "object",
                    properties: {
                        orderCode: {
                            type: "string",
                            description: "Order code (e.g., 'ORD-2024-001'). Optional: if empty, returns last order",
                        },
                    },
                    required: [],
                },
            },
            {
                name: "trackOrderStatus",
                description: "Track the current status of an order",
                parameters: {
                    type: "object",
                    properties: {
                        orderCode: {
                            type: "string",
                            description: "Order code to track",
                        },
                    },
                    required: ["orderCode"],
                },
            },
            {
                name: "repeatOrder",
                description: "Repeat the customer's last delivered order by adding all items to cart. Use after customer confirms they want to repeat their last order. Returns checkout link with step=2 parameter.",
                parameters: {
                    type: "object",
                    properties: {},
                    required: [],
                },
            },
            {
                name: "confirmOrder",
                description: "Confirm the current cart and create a new order. Use when customer says 'confermo', 'ok', 'procedi', 'conferma ordine' after seeing the cart summary. Creates the order, clears the cart, and returns success message.",
                parameters: {
                    type: "object",
                    properties: {},
                    required: [],
                },
            },
            {
                name: "showCheckout",
                description: "Show cart summary and ask for order confirmation. Use when customer wants to proceed with checkout: 'checkout', 'procedi all'ordine', 'voglio comprare', 'finalizza acquisto'. Shows cart contents, total with discounts, and link to verify shipping data.",
                parameters: {
                    type: "object",
                    properties: {},
                    required: [],
                },
            },
        ];
    }
}
exports.OrderTrackingAgentLLM = OrderTrackingAgentLLM;
//# sourceMappingURL=OrderTrackingAgentLLM.js.map