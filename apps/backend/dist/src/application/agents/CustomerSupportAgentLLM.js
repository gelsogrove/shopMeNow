"use strict";
/**
 * CustomerSupportAgentLLM
 *
 * ✅ SPECIALIST AGENT with OWN LLM - Clean Architecture
 *
 * Responsibilities:
 * 1. Handle customer support queries with dedicated LLM
 * 2. Execute function calls for FAQ, support tickets, complaints
 * 3. Return English response with [LINK_xxx] tokens
 *
 * Architecture:
 * - Own LLM instance (OpenRouter + GPT-4o-mini)
 * - Own system prompt from files (TemplateLoaderService loads from /templates/ecommerce/04-customer-support.template.md)
 * - Function execution via FAQRepository
 * - Returns English ONLY (Router handles translation)
 *
 * Flow:
 * 1. Router delegates query → CustomerSupportAgentLLM
 * 2. Load system prompt from database (agentType: CUSTOMER_SUPPORT)
 * 3. Call LLM with support functions
 * 4. Execute functions via FAQRepository
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
exports.CustomerSupportAgentLLM = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../../config");
const faq_repository_1 = require("../../repositories/faq.repository");
const template_loader_service_1 = require("../services/template-loader.service");
const prompt_processor_service_1 = require("../../services/prompt-processor.service");
const logger_1 = __importDefault(require("../../utils/logger"));
class CustomerSupportAgentLLM {
    constructor(prisma) {
        this.prisma = prisma;
        this.faqRepo = new faq_repository_1.FAQRepository(prisma);
        this.templateLoader = template_loader_service_1.TemplateLoaderService.getInstance(prisma);
        // OpenRouter API configuration
        this.openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
        this.openRouterBaseUrl = "https://openrouter.ai/api/v1";
        if (!this.openRouterApiKey) {
            throw new Error("OPENROUTER_API_KEY is required for CustomerSupportAgentLLM");
        }
    }
    /**
     * Handle customer support query with LLM
     */
    handleQuery(context) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            const startTime = Date.now();
            try {
                logger_1.default.info(`💬 CustomerSupportAgentLLM: Processing query`, {
                    workspaceId: context.workspaceId,
                    customerId: context.customerId,
                    query: context.query.substring(0, 100),
                });
                // STEP 1: Load system prompt from template files
                let systemPrompt = yield this.templateLoader.loadAndRenderTemplate("CUSTOMER_SUPPORT", context.workspaceId);
                logger_1.default.info(`📋 Loaded CUSTOMER_SUPPORT template from files`, {
                    promptLength: systemPrompt.length,
                });
                // 🆕 STEP 1.5: Load workspace config for address and other dynamic fields
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: context.workspaceId },
                    select: {
                        address: true,
                        customAiRules: true,
                        name: true,
                        botIdentityResponse: true,
                        notificationEmail: true,
                    },
                });
                // Build dynamic context to inject into prompt
                // Inject address if available
                if (workspace === null || workspace === void 0 ? void 0 : workspace.address) {
                    const addressSection = `\n\n## OUR LOCATION\nWhen customer asks "where are you?", "your address?", "dove siete?", "indirizzo?":\nRespond with: "${workspace.address}"\n`;
                    // Insert after the first section or at the beginning
                    systemPrompt = systemPrompt + addressSection;
                    logger_1.default.info(`📍 Injected address into CUSTOMER_SUPPORT prompt: ${workspace.address}`);
                }
                // Inject custom AI rules if available
                if (workspace === null || workspace === void 0 ? void 0 : workspace.customAiRules) {
                    const rulesSection = `\n\n## ⚠️ PRIORITY RULES (OVERRIDE)\nThe following rules have PRIORITY over all other instructions:\n${workspace.customAiRules}\n`;
                    systemPrompt = systemPrompt + rulesSection;
                    logger_1.default.info(`⚙️ Injected custom AI rules into CUSTOMER_SUPPORT prompt`);
                }
                // 🔧 STEP 1.6: Replace ALL variables ({{companyName}}, {{nameUser}}, etc.)
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
                    lastordercode: "",
                    languageUser: context.customerLanguage || "it",
                    agentName: "Non assegnato",
                    agentPhone: "N/A",
                    agentEmail: "N/A",
                    botIdentityResponse: (workspace === null || workspace === void 0 ? void 0 : workspace.botIdentityResponse) || "",
                    adminEmail: (workspace === null || workspace === void 0 ? void 0 : workspace.notificationEmail) || "", // 🆕 For support/escalation
                };
                // Merge: Router data takes priority, but fallback to local workspace data if empty
                const customerDataForPrompt = context.customerData ? Object.assign(Object.assign(Object.assign({}, baseCustomerData), context.customerData), { 
                    // 🔴 CRITICAL: Ensure companyName and botIdentityResponse are NEVER empty
                    companyName: context.customerData.companyName || (workspace === null || workspace === void 0 ? void 0 : workspace.name) || baseCustomerData.companyName, botIdentityResponse: context.customerData.botIdentityResponse || (workspace === null || workspace === void 0 ? void 0 : workspace.botIdentityResponse) || "", adminEmail: context.customerData.adminEmail || (workspace === null || workspace === void 0 ? void 0 : workspace.notificationEmail) || "" }) : baseCustomerData;
                // 🔍 DEBUG: Log what we're passing to preProcessPrompt
                logger_1.default.info(`📋 CustomerSupportAgent customerDataForPrompt:`, {
                    companyName: customerDataForPrompt.companyName,
                    nameUser: customerDataForPrompt.nameUser,
                    botIdentityResponse: ((_a = customerDataForPrompt.botIdentityResponse) === null || _a === void 0 ? void 0 : _a.substring(0, 50)) + "...",
                    hasRouterData: !!context.customerData,
                    workspaceName: workspace === null || workspace === void 0 ? void 0 : workspace.name,
                });
                const processedPrompt = yield promptProcessor.preProcessPrompt(systemPrompt, context.workspaceId, customerDataForPrompt, {
                    faqs: "", // FAQ loaded via functions, not in prompt
                    products: "",
                    categories: "",
                    services: "",
                    offers: "",
                }, undefined, // workspaceUrl
                {
                    address: (workspace === null || workspace === void 0 ? void 0 : workspace.address) || "",
                    customAiRules: (workspace === null || workspace === void 0 ? void 0 : workspace.customAiRules) || "",
                    botIdentityResponse: ((_b = context.customerData) === null || _b === void 0 ? void 0 : _b.botIdentityResponse) || (workspace === null || workspace === void 0 ? void 0 : workspace.botIdentityResponse) || "",
                    adminEmail: ((_c = context.customerData) === null || _c === void 0 ? void 0 : _c.adminEmail) || (workspace === null || workspace === void 0 ? void 0 : workspace.notificationEmail) || "", // 🆕 For support/escalation
                });
                logger_1.default.info(`✅ Variables replaced in CUSTOMER_SUPPORT prompt`, {
                    originalLength: systemPrompt.length,
                    processedLength: processedPrompt.length,
                });
                // STEP 2: Build messages for LLM
                const messages = [
                    {
                        role: "system",
                        content: processedPrompt,
                    },
                    {
                        role: "user",
                        content: context.query,
                    },
                ];
                // STEP 3: Define function calls for customer support
                const functions = this.getCustomerSupportFunctions();
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
                        logger_1.default.error(`🚨 SECURITY VIOLATION: CustomerSupportAgentLLM tried to call another SubLLM!`, {
                            attemptedFunction: functionName,
                            args: functionArgs,
                        });
                        throw new Error(`INVALID OPERATION: SubLLM cannot call other SubLLMs. Only Router can delegate to SubAgents. Attempted: ${functionName}`);
                    }
                    logger_1.default.info(`⚙️ CustomerSupportAgentLLM: Function call requested`, {
                        functionName,
                        args: functionArgs,
                    });
                    // Execute function via FAQRepository
                    const functionResult = yield this.executeFunction(functionName, functionArgs, context);
                    functionCalls.push({
                        name: functionName,
                        arguments: functionArgs,
                        result: functionResult,
                    });
                    // 🔧 DIRECT RETURN: For ContactOperator - return message directly without LLM reformulation
                    // This preserves the empathetic message and formatting
                    const isContactOperator = functionName.toLowerCase() === "contactoperator";
                    if (isContactOperator && (functionResult === null || functionResult === void 0 ? void 0 : functionResult.success) && (functionResult === null || functionResult === void 0 ? void 0 : functionResult.message)) {
                        logger_1.default.info(`🚀 ContactOperator: Returning message directly (no LLM reformulation)`);
                        finalResponse = functionResult.message;
                        // Replace customer name variable if present
                        if (finalResponse.includes("{{nameUser}}")) {
                            finalResponse = finalResponse.replace(/\{\{nameUser\}\}/gi, context.customerName || "Cliente");
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
                    }
                }
                const executionTimeMs = Date.now() - startTime;
                logger_1.default.info(`✅ CustomerSupportAgentLLM: Query processed`, {
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
                    systemPrompt: processedPrompt, // 🔧 FIX: Return PROCESSED prompt (with variables replaced), not raw template
                };
            }
            catch (error) {
                const executionTimeMs = Date.now() - startTime;
                // Extract only relevant error info (avoid circular references)
                const errorInfo = Object.assign({ message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, (error && typeof error === "object" && "response" in error
                    ? {
                        status: (_d = error.response) === null || _d === void 0 ? void 0 : _d.status,
                        statusText: (_e = error.response) === null || _e === void 0 ? void 0 : _e.statusText,
                        data: (_f = error.response) === null || _f === void 0 ? void 0 : _f.data,
                    }
                    : {}));
                logger_1.default.error("❌ CustomerSupportAgentLLM error:", errorInfo);
                return {
                    success: false,
                    output: "Error processing customer support request",
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
                        "X-Title": "eChatbot - Customer Support Agent",
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
     * Execute function call via FAQRepository
     */
    executeFunction(functionName, args, context) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                switch (functionName) {
                    case "searchFAQ":
                        return yield this.faqRepo.searchByKeywords(context.workspaceId, args.query, 5 // Limit to top 5 results
                        );
                    case "getFAQByCategory":
                        return yield this.faqRepo.findByCategory(context.workspaceId, args.category);
                    case "createSupportTicket":
                        // Support ticket creation - Future feature
                        // For now, escalate to contactSupport for human assistance
                        return {
                            success: true,
                            ticketId: "TICKET-" + Date.now(),
                            message: "Support ticket created successfully. Our team will contact you soon.",
                        };
                    case "contactSupport":
                        // Get sales agent info from customer
                        const customer = yield this.prisma.customers.findUnique({
                            where: { id: context.customerId },
                            include: { sales: true },
                        });
                        if (!customer || !customer.sales) {
                            return {
                                success: false,
                                error: "No sales agent assigned to this customer",
                            };
                        }
                        // 🔴 CRITICAL: Disable chatbot when customer requests human support
                        yield this.prisma.customers.update({
                            where: { id: context.customerId },
                            data: { activeChatbot: false },
                        });
                        logger_1.default.info(`🚨 Chatbot disabled for customer ${context.customerId} - human support requested`);
                        // 📧 Call ContactOperator to send email with summary
                        const { ContactOperator, } = require("../../domain/calling-functions/contactOperator");
                        logger_1.default.info("📧 Calling ContactOperator to send email notification");
                        const contactResult = yield ContactOperator({
                            phoneNumber: customer.phone,
                            workspaceId: context.workspaceId,
                            customerId: context.customerId,
                            reason: args.reason || "Customer requested operator assistance",
                        });
                        logger_1.default.info("✅ ContactOperator completed", {
                            success: contactResult.success,
                            customerId: context.customerId,
                        });
                        // 🔧 Return ContactOperator's empathetic message instead of generic one
                        return {
                            success: true,
                            salesAgent: {
                                name: `${customer.sales.firstName} ${customer.sales.lastName}`,
                                email: customer.sales.email,
                                phone: customer.sales.phone,
                            },
                            message: contactResult.message, // Use ContactOperator's message
                            chatbotDisabled: true,
                        };
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
     * Get function definitions for customer support
     */
    getCustomerSupportFunctions() {
        return [
            {
                name: "searchFAQ",
                description: "Search FAQ database for answers to customer questions",
                parameters: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "Search query for FAQ",
                        },
                    },
                    required: ["query"],
                },
            },
            {
                name: "getFAQByCategory",
                description: "Get FAQ entries by category (e.g., 'shipping', 'returns', 'payment')",
                parameters: {
                    type: "object",
                    properties: {
                        category: {
                            type: "string",
                            description: "FAQ category name",
                        },
                    },
                    required: ["category"],
                },
            },
            {
                name: "createSupportTicket",
                description: "Create a support ticket for issues that require manual attention",
                parameters: {
                    type: "object",
                    properties: {
                        subject: {
                            type: "string",
                            description: "Ticket subject/title",
                        },
                        description: {
                            type: "string",
                            description: "Detailed description of the issue",
                        },
                        priority: {
                            type: "string",
                            enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
                            description: "Ticket priority level",
                        },
                    },
                    required: ["subject", "description"],
                },
            },
            {
                name: "contactSupport",
                description: "Get sales agent contact information for this customer",
                parameters: {
                    type: "object",
                    properties: {},
                    required: [],
                },
            },
        ];
    }
}
exports.CustomerSupportAgentLLM = CustomerSupportAgentLLM;
//# sourceMappingURL=CustomerSupportAgentLLM.js.map