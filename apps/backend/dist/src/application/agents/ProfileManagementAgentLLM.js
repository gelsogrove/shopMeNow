"use strict";
/**
 * ProfileManagementAgentLLM - Profile Management Agent
 *
 * ✅ SPECIALIST AGENT with OWN LLM - Clean Architecture
 *
 * Responsibilities:
 * 1. Handle profile updates (email, notifications, preferences)
 * 2. Manage notification subscriptions via handlePushNotifications function
 * 3. Return direct response in customer's language
 *
 * @architecture Clean separation: Profile management ONLY
 * @functions handlePushNotifications(value: boolean) - Enable/disable push notifications
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
exports.ProfileManagementAgentLLM = void 0;
const axios_1 = __importDefault(require("axios"));
const agent_functions_config_1 = require("../../config/agent-functions.config");
const prompt_processor_service_1 = require("../../services/prompt-processor.service");
const logger_1 = __importDefault(require("../../utils/logger"));
class ProfileManagementAgentLLM {
    constructor(prisma) {
        this.prisma = prisma;
        this.openRouterBaseUrl = "https://openrouter.ai/api/v1";
        this.openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
        if (!this.openRouterApiKey) {
            throw new Error("OPENROUTER_API_KEY is required");
        }
    }
    handleQuery(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            let totalTokens = 0;
            try {
                logger_1.default.info(`👤 Profile Management Agent - Processing query`, {
                    workspaceId: context.workspaceId,
                    customerId: context.customerId,
                    query: context.query,
                });
                // Load agent config from database
                const agentConfig = yield this.prisma.agentConfig.findFirst({
                    where: {
                        workspaceId: context.workspaceId,
                        name: { contains: "Profile" },
                    },
                });
                if (!agentConfig) {
                    throw new Error("Profile Management Agent config not found");
                }
                // 🆕 Load workspace config for dynamic fields (customAiRules, companyName, etc.)
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: context.workspaceId },
                    select: {
                        name: true,
                        address: true,
                        customAiRules: true,
                        botIdentityResponse: true,
                    },
                });
                // Get customer data
                const customer = yield this.prisma.customers.findUnique({
                    where: { id: context.customerId },
                });
                const promptProcessor = new prompt_processor_service_1.PromptProcessorService();
                // Map customer data
                const customerData = customer
                    ? {
                        nameUser: customer.name || "Cliente",
                        email: customer.email || "",
                        phone: customer.phone || "",
                        discountUser: customer.discount || 0,
                        companyName: (workspace === null || workspace === void 0 ? void 0 : workspace.name) || "",
                        languageUser: customer.language || "ITALIANO",
                        pushNotificationsConsent: customer.push_notifications_consent,
                    }
                    : {};
                // Process prompt (replace variables)
                const processedPrompt = yield promptProcessor.preProcessPrompt(agentConfig.systemPrompt, context.workspaceId, customerData, {
                    faqs: "",
                    products: "",
                    categories: "",
                    services: "",
                    offers: "",
                }, undefined, // workspaceUrl
                {
                    address: (workspace === null || workspace === void 0 ? void 0 : workspace.address) || "",
                    customAiRules: (workspace === null || workspace === void 0 ? void 0 : workspace.customAiRules) || "",
                    botIdentityResponse: (workspace === null || workspace === void 0 ? void 0 : workspace.botIdentityResponse) || "",
                });
                logger_1.default.info(`📄 Profile Management Agent - Prompt processed`);
                // Get available functions for Profile Management Agent
                // Use PROFILE_MANAGEMENT_FUNCTIONS which includes both handlePushNotifications and getProfileLink
                const profileFunctions = agent_functions_config_1.PROFILE_MANAGEMENT_FUNCTIONS;
                // Build messages array with conversation history
                const messages = [
                    { role: "system", content: processedPrompt },
                ];
                // Add conversation history if provided (for confirmation flows)
                if (context.conversationHistory &&
                    context.conversationHistory.length > 0) {
                    logger_1.default.info(`📜 Adding conversation history to ProfileManagement`, {
                        historyLength: context.conversationHistory.length,
                    });
                    messages.push(...context.conversationHistory);
                }
                // Add current user message
                messages.push({ role: "user", content: context.query });
                const functionCalls = [];
                let iterations = 0;
                const maxIterations = 3;
                let finalResponse = "";
                while (iterations < maxIterations) {
                    iterations++;
                    logger_1.default.info(`🔄 Profile Management Agent - Iteration ${iterations}/${maxIterations}`);
                    // Call LLM with function calling
                    const llmResponse = yield this.callLLM({
                        model: agentConfig.model,
                        messages,
                        functions: profileFunctions,
                        temperature: agentConfig.temperature,
                        maxTokens: agentConfig.maxTokens,
                    });
                    totalTokens += llmResponse.tokensUsed;
                    // Check if LLM wants to call a function
                    if (llmResponse.function_call) {
                        const functionName = llmResponse.function_call.name;
                        const functionArgs = JSON.parse(llmResponse.function_call.arguments || "{}");
                        logger_1.default.info(`⚙️ ProfileManagementAgent calling: ${functionName}`, {
                            args: functionArgs,
                        });
                        // Track function call
                        functionCalls.push({
                            function: functionName,
                            arguments: functionArgs,
                        });
                        // Execute function
                        const functionResult = yield this.executeFunction(functionName, functionArgs, context);
                        logger_1.default.info(`✅ Function ${functionName} executed`, {
                            result: functionResult,
                        });
                        // Add function result to messages
                        messages.push({
                            role: "assistant",
                            content: llmResponse.content || null,
                            function_call: llmResponse.function_call,
                        });
                        messages.push({
                            role: "function",
                            name: functionName,
                            content: JSON.stringify(functionResult),
                        });
                        // Continue loop to get final response
                        continue;
                    }
                    // No function call - final response
                    finalResponse = llmResponse.content || "";
                    break;
                }
                if (!finalResponse) {
                    finalResponse =
                        "Mi dispiace, non sono riuscito a completare la richiesta.";
                }
                const executionTimeMs = Date.now() - startTime;
                logger_1.default.info(`✅ Profile Management Agent completed`, {
                    iterations,
                    functionCallsCount: functionCalls.length,
                    tokensUsed: totalTokens,
                    executionTimeMs,
                    responsePreview: finalResponse.substring(0, 100),
                });
                return {
                    success: true,
                    output: finalResponse,
                    tokensUsed: totalTokens,
                    executionTimeMs,
                    functionCalls,
                    systemPrompt: processedPrompt,
                };
            }
            catch (error) {
                logger_1.default.error("❌ Profile Management Agent error:", error);
                return {
                    success: false,
                    output: "Mi dispiace, c'è stato un problema. Contatta il supporto per assistenza.",
                    tokensUsed: totalTokens,
                    executionTimeMs: Date.now() - startTime,
                    functionCalls: [],
                };
            }
        });
    }
    /**
     * Execute function call
     */
    executeFunction(functionName, args, context) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (functionName === "handlePushNotifications") {
                    // Call manageNotifications domain function
                    const { manageNotifications, } = require("../../domain/calling-functions/manageNotifications");
                    const action = args.value ? "SUBSCRIBE" : "UNSUBSCRIBE";
                    const result = yield manageNotifications({
                        action,
                        customerId: context.customerId,
                        workspaceId: context.workspaceId,
                    });
                    return {
                        success: result.success,
                        message: result.message,
                        currentStatus: result.currentStatus,
                    };
                }
                if (functionName === "getProfileLink") {
                    // Generate secure profile link with token
                    const { CallingFunctionsService, } = require("../../services/calling-functions.service");
                    const callingFunctions = new CallingFunctionsService();
                    const result = yield callingFunctions.getProfileLink({
                        customerId: context.customerId,
                        workspaceId: context.workspaceId,
                    });
                    logger_1.default.info("✅ Profile link generated", {
                        customerId: context.customerId,
                        tokenGenerated: !!result.token,
                    });
                    return {
                        success: true,
                        token: result.token,
                        link: result.link,
                        expiresAt: result.expiresAt,
                        message: "Profile link generated successfully",
                    };
                }
                return {
                    success: false,
                    message: `Unknown function: ${functionName}`,
                };
            }
            catch (error) {
                logger_1.default.error(`❌ Error executing ${functionName}:`, error);
                return {
                    success: false,
                    message: "Function execution failed",
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
                // Functions already come in correct tools format from PROFILE_MANAGEMENT_FUNCTIONS
                // No need to wrap them again - they already have { type: "function", function: {...} }
                const tools = options.functions;
                const response = yield axios_1.default.post(`${this.openRouterBaseUrl}/chat/completions`, {
                    model: options.model,
                    messages: options.messages,
                    tools,
                    temperature: options.temperature,
                    max_tokens: options.maxTokens,
                }, {
                    headers: {
                        Authorization: `Bearer ${this.openRouterApiKey}`,
                        "Content-Type": "application/json",
                        "X-Title": "eChatbot - Profile Management Agent",
                    },
                });
                const choice = (_a = response.data.choices) === null || _a === void 0 ? void 0 : _a[0];
                const message = choice === null || choice === void 0 ? void 0 : choice.message;
                return {
                    content: (message === null || message === void 0 ? void 0 : message.content) || null,
                    function_call: (_c = (_b = message === null || message === void 0 ? void 0 : message.tool_calls) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.function,
                    tokensUsed: ((_d = response.data.usage) === null || _d === void 0 ? void 0 : _d.total_tokens) || 0,
                };
            }
            catch (error) {
                logger_1.default.error("❌ OpenRouter API call failed:", error);
                throw error;
            }
        });
    }
}
exports.ProfileManagementAgentLLM = ProfileManagementAgentLLM;
//# sourceMappingURL=ProfileManagementAgentLLM.js.map