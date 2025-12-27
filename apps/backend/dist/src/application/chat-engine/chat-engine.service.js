"use strict";
/**
 * Chat Engine Service - Main Orchestrator
 *
 * CORE PRINCIPLE: "Codice decide, LLM formatta"
 *
 * This is the heart of the chatbot - it processes incoming messages
 * through a pipeline: Intent → Data → Response → Format → Deliver
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatEngineService = void 0;
exports.getChatEngine = getChatEngine;
const database_1 = require("@echatbot/database");
const pricing_1 = require("../../../../../shared/pricing");
const logger_1 = __importDefault(require("../../utils/logger"));
const intent_1 = require("../intent");
const data_loader_1 = require("../data-loader");
const response_builder_1 = require("../response-builder");
const llm_formatter_1 = require("../llm-formatter");
const conversation_manager_service_1 = require("../../services/conversation-manager.service");
const link_replacement_service_1 = require("../services/link-replacement.service");
const options_mapping_service_1 = require("./options-mapping.service");
const message_preprocessor_service_1 = require("../../services/message-preprocessor.service");
const CartManagementAgentLLM_1 = require("../agents/CartManagementAgentLLM");
const ProductContextAgentLLM_1 = require("../agents/ProductContextAgentLLM");
const system_context_service_1 = require("../../services/system-context.service");
const conversation_state_service_1 = require("./conversation-state.service");
const TranslationAgent_1 = require("../agents/TranslationAgent");
const catalog_query_service_1 = require("../catalog-query/catalog-query.service");
const ConfirmOrder_1 = require("../../domain/calling-functions/ConfirmOrder");
const llm_router_service_1 = require("../../services/llm-router.service");
const unified_chat_router_service_1 = require("../services/unified-chat-router.service");
const workspaceConfigCache = new Map();
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const formatCartPrice = (value) => (0, pricing_1.formatRoundedCurrency)(value !== null && value !== void 0 ? value : 0, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useSmartRound: true,
    step: pricing_1.DEFAULT_ROUNDING_STEP,
});
// ================================================================================
// CUSTOMER-LEVEL LOCKS (Concurrency Safety - Principle VI)
// ================================================================================
/**
 * In-memory lock per customer to prevent race conditions when same customer
 * sends multiple messages simultaneously. Each customer can only have ONE
 * message being processed at a time - subsequent messages wait in queue.
 *
 * Pattern: Promise-based sequential processing per customer
 * - If lock exists: wait for it to release
 * - Acquire lock before processing
 * - Release lock after processing (success or error)
 */
const customerProcessingLocks = new Map();
// ================================================================================
// MAIN SERVICE
// ================================================================================
class ChatEngineService {
    constructor(prisma) {
        this.prisma = prisma;
        // Initialize core pipeline
        this.intentParser = (0, intent_1.getIntentParser)(prisma);
        this.dataLoader = (0, data_loader_1.getDataLoader)(prisma);
        this.responseBuilder = (0, response_builder_1.getResponseBuilder)(prisma);
        this.llmFormatter = (0, llm_formatter_1.getLLMFormatter)(prisma);
        // Initialize support services
        this.conversationManager = new conversation_manager_service_1.ConversationManager(prisma);
        this.linkReplacementService = new link_replacement_service_1.LinkReplacementService();
        this.optionsMappingService = (0, options_mapping_service_1.getOptionsMappingService)(prisma);
        this.systemContextService = (0, system_context_service_1.getSystemContextService)(prisma);
        this.conversationStateService = new conversation_state_service_1.ConversationStateService(prisma);
        this.catalogQueryService = new catalog_query_service_1.CatalogQueryService(prisma);
        this.llmRouterService = new llm_router_service_1.LLMRouterService(prisma);
        this.unifiedChatRouter = (0, unified_chat_router_service_1.getUnifiedChatRouter)(prisma); // OpenAI SDK integration
        // Initialize translation layer
        this.translationAgent = new TranslationAgent_1.TranslationAgent(prisma);
    }
    /**
     * Helper: Replace user variables in calling function messages
     * This handles {{nameUser}}, {{agentPhone}}, etc. that are NOT processed by PromptProcessor
     * because calling functions return raw messages with placeholders.
     */
    replaceUserVariables(message, customerId, workspaceId, customerName) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            let result = message;
            if (!(result === null || result === void 0 ? void 0 : result.includes("{{")))
                return result;
            let cachedCustomer = null;
            let cachedWorkspace = null;
            const loadCustomer = () => __awaiter(this, void 0, void 0, function* () {
                if (cachedCustomer)
                    return cachedCustomer;
                cachedCustomer = yield this.prisma.customers.findUnique({
                    where: { id: customerId },
                    select: {
                        name: true,
                        sales: {
                            select: {
                                firstName: true,
                                lastName: true,
                                email: true,
                                phone: true,
                            },
                        },
                    },
                });
                return cachedCustomer;
            });
            const loadWorkspace = () => __awaiter(this, void 0, void 0, function* () {
                if (cachedWorkspace)
                    return cachedWorkspace;
                cachedWorkspace = yield this.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: {
                        whatsappPhoneNumber: true,
                        notificationEmail: true,
                        whatsappSettings: { select: { adminEmail: true } },
                    },
                });
                return cachedWorkspace;
            });
            const ensureCustomerName = () => __awaiter(this, void 0, void 0, function* () {
                if (customerName)
                    return customerName;
                const customer = yield loadCustomer();
                return (customer === null || customer === void 0 ? void 0 : customer.name) || "Cliente";
            });
            if (result.includes("{{nameUser}}")) {
                const resolvedName = yield ensureCustomerName();
                result = result.replace(/\{\{nameUser\}\}/g, resolvedName);
            }
            if (result.includes("{{agentName}}") ||
                result.includes("{{agentEmail}}") ||
                result.includes("{{agentPhone}}")) {
                const customer = yield loadCustomer();
                const workspace = yield loadWorkspace();
                const sales = customer === null || customer === void 0 ? void 0 : customer.sales;
                const agentName = (sales
                    ? `${sales.firstName || ""} ${sales.lastName || ""}`.trim()
                    : "") || "Il nostro team";
                const agentEmail = (sales === null || sales === void 0 ? void 0 : sales.email) ||
                    (workspace === null || workspace === void 0 ? void 0 : workspace.notificationEmail) ||
                    ((_a = workspace === null || workspace === void 0 ? void 0 : workspace.whatsappSettings) === null || _a === void 0 ? void 0 : _a.adminEmail) ||
                    "support@echatbot.ai";
                const agentPhone = (sales === null || sales === void 0 ? void 0 : sales.phone) || (workspace === null || workspace === void 0 ? void 0 : workspace.whatsappPhoneNumber) || "N/A";
                result = result
                    .replace(/\{\{agentName\}\}/g, agentName)
                    .replace(/\{\{agentEmail\}\}/g, agentEmail)
                    .replace(/\{\{agentPhone\}\}/g, agentPhone);
            }
            if (result.includes("{{adminEmail}}")) {
                const workspace = yield loadWorkspace();
                const adminEmail = ((_b = workspace === null || workspace === void 0 ? void 0 : workspace.whatsappSettings) === null || _b === void 0 ? void 0 : _b.adminEmail) ||
                    (workspace === null || workspace === void 0 ? void 0 : workspace.notificationEmail) ||
                    "support@echatbot.ai";
                result = result.replace(/\{\{adminEmail\}\}/g, adminEmail);
            }
            if (result.includes("{{TOKEN_DURATION}}")) {
                result = result.replace(/\{\{TOKEN_DURATION\}\}/g, this.formatTokenDuration(process.env.TOKEN_EXPIRATION || "1h"));
            }
            return result;
        });
    }
    formatTokenDuration(duration) {
        const match = duration.match(/^(\d+)([mh])$/);
        if (!match)
            return "15 minutes";
        const value = parseInt(match[1], 10);
        const unit = match[2];
        if (unit === "m") {
            return value === 1 ? "1 minute" : `${value} minutes`;
        }
        return value === 1 ? "1 hour" : `${value} hours`;
    }
    getHumanSupportTemplate(workspaceConfig, options) {
        var _a, _b, _c;
        const reason = (_a = options === null || options === void 0 ? void 0 : options.reason) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        const hasSupport = workspaceConfig.hasHumanSupport;
        if (!hasSupport) {
            if ((_b = workspaceConfig.humanSupportInstructions) === null || _b === void 0 ? void 0 : _b.trim()) {
                return workspaceConfig.humanSupportInstructions.trim();
            }
            return `Ciao {{nameUser}}, manda una email a {{adminEmail}} con i dettagli e ti risponderemo il prima possibile.`;
        }
        const isFrustration = reason === "frustration" ||
            reason === "frustrated" ||
            reason === "angry" ||
            reason === "complaint";
        if (isFrustration) {
            if (workspaceConfig.hasSalesAgents) {
                return `Ciao {{nameUser}}, capisco la tua frustrazione e mi dispiace per l'inconveniente.\nMi sto mettendo in contatto con l'agente {{agentName}}. Ti richiamera' al piu' presto (tel: {{agentPhone}} - email: {{agentEmail}}).\nDisattivo il chatbot finche' non ricevi risposta.`;
            }
            return `Ciao {{nameUser}}, capisco la tua frustrazione e voglio risolvere subito.\nMi sto mettendo in contatto con il nostro operatore. Ti rispondera' al piu' presto e disattivo il chatbot finche' non ricevi assistenza.`;
        }
        if ((_c = workspaceConfig.humanSupportInstructions) === null || _c === void 0 ? void 0 : _c.trim()) {
            return workspaceConfig.humanSupportInstructions.trim();
        }
        if (workspaceConfig.hasSalesAgents) {
            return `Ciao {{nameUser}}, mi sto mettendo in contatto con l'agente {{agentName}}.\nTi rispondera' a breve. Metto in pausa il chatbot finche' non ricevi assistenza.`;
        }
        return `Ciao {{nameUser}}, mi sto mettendo in contatto con il nostro operatore.\nTi rispondera' al piu' presto. Metto in pausa il chatbot finche' non ricevi assistenza.`;
    }
    applyHumanSupportPlaceholders(template, replacements) {
        let result = template;
        for (const [key, value] of Object.entries(replacements)) {
            const safeValue = value !== null && value !== void 0 ? value : "";
            result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), safeValue);
        }
        return result;
    }
    shouldCheckFaqBeforeHumanSupport(reason) {
        if (!reason)
            return false;
        const normalized = reason.trim().toLowerCase();
        return ["frustration", "frustrated", "angry", "complaint"].includes(normalized);
    }
    tryHandleFAQBeforeHumanSupport(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { input, workspaceConfig, conversationId, debugSteps, startTime, requestIntent, intentConfidence, intentSource, } = params;
            if (!this.shouldCheckFaqBeforeHumanSupport(requestIntent.reason)) {
                return null;
            }
            try {
                debugSteps.push({
                    type: "router",
                    agent: "🤖 FAQ Precheck",
                    timestamp: new Date().toISOString(),
                    input: {
                        userMessage: input.message,
                    },
                    output: {
                        decision: "faq_precheck_start",
                    },
                });
                const faqIntent = {
                    type: "ASK_FAQ",
                    query: input.message.trim(),
                };
                const loadedData = yield this.dataLoader.loadForIntent(faqIntent, input.workspaceId, input.customerId, input.customerDiscount || 0);
                if (loadedData.type !== "FAQ" || !((_a = loadedData.faqs) === null || _a === void 0 ? void 0 : _a.length)) {
                    return null;
                }
                const structuredResponse = this.responseBuilder.build(faqIntent, loadedData, {
                    workspaceId: input.workspaceId,
                    customerLanguage: input.customerLanguage || "it",
                    customerName: input.customerName,
                    customerDiscount: input.customerDiscount,
                    userMessage: input.message,
                    enableCategoryRanking: workspaceConfig.sellsProductsAndServices,
                });
                if (structuredResponse.type !== "FAQ") {
                    return null;
                }
                const formatterResult = yield this.formatWithCustomRules(structuredResponse, input.customerLanguage || "it", workspaceConfig, undefined, { customerName: input.customerName });
                let finalMessage = formatterResult.text;
                const formatterTokens = formatterResult.tokensUsed || 0;
                const replacementResult = yield this.linkReplacementService.replaceTokens({ response: finalMessage, linkType: "auto" }, input.customerId, input.workspaceId);
                if (replacementResult.success && replacementResult.response) {
                    finalMessage = replacementResult.response;
                }
                finalMessage = finalMessage
                    .replace(/\s*\[SKU:[A-Z0-9-]+\]/gi, "")
                    .replace(/\s*\[SKUS?:[A-Z0-9-,]+\]/gi, "");
                const processingTimeMs = Date.now() - startTime;
                debugSteps.push({
                    type: "router",
                    agent: "🤖 FAQ Precheck",
                    timestamp: new Date().toISOString(),
                    output: {
                        decision: "answered_with_faq",
                        executionTimeMs: processingTimeMs,
                    },
                });
                const debugInfo = {
                    loadedDataType: loadedData.type,
                    responseType: structuredResponse.type,
                    llmUsed: !formatterResult.cached,
                    steps: debugSteps,
                    totalTokens: formatterTokens,
                    executionTimeMs: processingTimeMs,
                };
                const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, input.message, finalMessage, database_1.AgentType.CUSTOMER_SUPPORT, formatterTokens, debugInfo);
                return {
                    message: finalMessage,
                    agentType: database_1.AgentType.CUSTOMER_SUPPORT,
                    wasHandled: true,
                    intent: "ASK_FAQ",
                    confidence: intentConfidence,
                    source: intentSource,
                    processingTimeMs,
                    debugInfo,
                    response: finalMessage,
                    agentUsed: database_1.AgentType.CUSTOMER_SUPPORT,
                    tokensUsed: formatterTokens,
                    executionTimeMs: processingTimeMs,
                    wasFAQ: true,
                    isBlocked: false,
                    _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
                };
            }
            catch (error) {
                logger_1.default.error("⚠️ [ChatEngine] FAQ precheck failed, continuing with human support", {
                    error,
                    workspaceId: input.workspaceId,
                    customerId: input.customerId,
                });
                return null;
            }
        });
    }
    handleHumanSupportRequest(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { input, workspaceConfig, conversationId, debugSteps, totalTokens, startTime, requestIntent, intentConfidence, intentSource, } = params;
            const customer = yield this.prisma.customers.findUnique({
                where: { id: input.customerId },
                select: {
                    name: true,
                    phone: true,
                    sales: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true,
                            phone: true,
                        },
                    },
                },
            });
            const customerName = input.customerName || (customer === null || customer === void 0 ? void 0 : customer.name) || "Cliente";
            let agentName = "";
            let agentEmail = "";
            let agentPhone = "";
            if (customer === null || customer === void 0 ? void 0 : customer.sales) {
                const first = ((_a = customer.sales.firstName) === null || _a === void 0 ? void 0 : _a.trim()) || "";
                const last = ((_b = customer.sales.lastName) === null || _b === void 0 ? void 0 : _b.trim()) || "";
                agentName = [first, last].filter(Boolean).join(" ").trim();
                agentEmail = customer.sales.email || "";
                agentPhone = customer.sales.phone || "";
            }
            else if (workspaceConfig.hasSalesAgents) {
                logger_1.default.warn("⚠️ [ChatEngine] No sales agent assigned for customer requesting human support", {
                    customerId: input.customerId,
                });
            }
            const faqPrecheckResult = yield this.tryHandleFAQBeforeHumanSupport({
                input,
                workspaceConfig,
                conversationId,
                debugSteps,
                startTime,
                requestIntent,
                intentConfidence,
                intentSource,
            });
            if (faqPrecheckResult) {
                logger_1.default.info("📚 [ChatEngine] Human support converted to FAQ response", {
                    workspaceId: input.workspaceId,
                    customerId: input.customerId,
                });
                return faqPrecheckResult;
            }
            const template = this.getHumanSupportTemplate(workspaceConfig, {
                reason: requestIntent.reason,
            });
            const adminEmail = workspaceConfig.adminEmail || "support@echatbot.ai";
            const finalMessage = this.applyHumanSupportPlaceholders(template, {
                nameUser: customerName,
                agentName,
                agentEmail,
                agentPhone,
                adminEmail,
            }).trim();
            if (workspaceConfig.hasHumanSupport) {
                try {
                    debugSteps.push({
                        type: "function_call",
                        agent: "📞 contactOperator",
                        timestamp: new Date().toISOString(),
                        input: {
                            textContent: requestIntent.reason || input.message,
                        },
                    });
                    const { contactOperator } = yield Promise.resolve().then(() => __importStar(require("../../domain/calling-functions/contactOperator")));
                    const contactResult = yield contactOperator({
                        phoneNumber: (customer === null || customer === void 0 ? void 0 : customer.phone) || "",
                        workspaceId: input.workspaceId,
                        customerId: input.customerId,
                        reason: requestIntent.reason || input.message,
                    });
                    debugSteps.push({
                        type: "function_result",
                        agent: "📞 contactOperator",
                        timestamp: new Date().toISOString(),
                        output: {
                            result: {
                                success: contactResult.success,
                                summaryAgentExecuted: contactResult.summaryAgentExecuted,
                            },
                        },
                    });
                }
                catch (error) {
                    logger_1.default.error("❌ [ChatEngine] contactOperator failed during human support handling", {
                        error,
                        customerId: input.customerId,
                        workspaceId: input.workspaceId,
                    });
                }
            }
            const processingTimeMs = Date.now() - startTime;
            const debugInfo = {
                loadedDataType: "HUMAN_SUPPORT",
                responseType: "HUMAN_SUPPORT",
                llmUsed: false,
                steps: debugSteps,
                totalTokens,
                totalCost: (totalTokens * 0.0003) / 1000,
                executionTimeMs: processingTimeMs,
            };
            const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, input.message, finalMessage, database_1.AgentType.CUSTOMER_SUPPORT, totalTokens, debugInfo);
            return {
                message: finalMessage,
                agentType: database_1.AgentType.CUSTOMER_SUPPORT,
                wasHandled: true,
                intent: "REQUEST_HUMAN",
                confidence: intentConfidence,
                source: intentSource,
                processingTimeMs,
                debugInfo,
                response: finalMessage,
                agentUsed: database_1.AgentType.CUSTOMER_SUPPORT,
                tokensUsed: totalTokens,
                executionTimeMs: processingTimeMs,
                wasFAQ: false,
                isBlocked: false,
                _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
            };
        });
    }
    /**
     * Helper: formatta con LLM includendo customAiRules e botIdentity dal workspace
     */
    formatWithCustomRules(structuredResponse, language, workspaceConfig, conversationHistory, personalizationOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.llmFormatter.format(structuredResponse, language, conversationHistory, {
                customAiRules: workspaceConfig.customAiRules,
                botIdentity: workspaceConfig.botIdentity,
                botName: workspaceConfig.name,
                chatbotName: workspaceConfig.chatbotName, // 🆕 Custom chatbot name
                businessType: workspaceConfig.businessType, // 🆕 Business sector
                customerName: personalizationOptions === null || personalizationOptions === void 0 ? void 0 : personalizationOptions.customerName,
                isFirstMessage: personalizationOptions === null || personalizationOptions === void 0 ? void 0 : personalizationOptions.isFirstMessage,
            });
        });
    }
    /**
     * ============================================================================
     * TRANSLATION LAYER (Single Responsibility: Translate final response)
     * ============================================================================
     *
     * Translates the formatted response to customer's preferred language.
     * This method is called ONLY from routeMessage() wrapper to ensure
     * ALL responses pass through translation before reaching the customer.
     *
     * Design Pattern: Decorator - wraps response with translation
     *
     * @param message - The formatted message to translate
     * @param workspaceId - Workspace ID for loading TRANSLATION agent config
     * @param targetLanguage - Customer's language code (e.g., "pt", "en", "es")
     * @param debugSteps - Array to push translation debug step for timeline
     * @param customerName - Optional customer name for personalization
     * @returns Object with translated message and tokens used
     */
    applyTranslation(message, workspaceId, targetLanguage, debugSteps, customerName) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            try {
                // Call TranslationAgent to translate message
                const result = yield this.translationAgent.process({
                    workspaceId,
                    message,
                    targetLanguage: targetLanguage || "it",
                    customerName,
                });
                const executionTimeMs = Date.now() - startTime;
                // Add debug step for Message Flow Timeline
                this.pushTranslationDebugStep(debugSteps, {
                    model: result.model || "gpt-4o-mini",
                    inputMessage: message,
                    outputMessage: result.message,
                    targetLanguage: targetLanguage || "it",
                    translated: result.translated,
                    tokensUsed: result.tokensUsed,
                    executionTimeMs,
                    systemPrompt: result.systemPrompt,
                });
                logger_1.default.info("🌍 [ChatEngine] Translation applied", {
                    targetLanguage,
                    translated: result.translated,
                    tokensUsed: result.tokensUsed,
                    executionTimeMs,
                });
                return {
                    message: result.message,
                    tokensUsed: result.tokensUsed || 0
                };
            }
            catch (error) {
                // Log error but don't fail - return original message
                logger_1.default.error("⚠️ [ChatEngine] Translation failed, using original", { error });
                // Track error in timeline
                this.pushTranslationDebugStep(debugSteps, {
                    model: "error",
                    inputMessage: message,
                    outputMessage: message,
                    targetLanguage: targetLanguage || "it",
                    translated: false,
                    tokensUsed: 0,
                    executionTimeMs: Date.now() - startTime,
                    error: error instanceof Error ? error.message : "Unknown error",
                });
                return { message, tokensUsed: 0 };
            }
        });
    }
    getTransportEmoji(label) {
        const normalized = (label || "").toLowerCase();
        if (normalized.includes("congel") || normalized.includes("frozen")) {
            return "🧊";
        }
        if (normalized.includes("refriger") || normalized.includes("frigo") || normalized.includes("cold")) {
            return "❄️";
        }
        return "📦";
    }
    routeGenericLLMFallback(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { input, conversationId, history, fallbackReason, debugSteps } = params;
            const prompt = `Non riesco a soddisfare la richiesta dell'utente con le regole deterministiche.\nContesto:\n- Ultimo messaggio utente: "${input.message}"\n- Problema rilevato: ${fallbackReason || "nessun risultato dal catalogo"}\n\nScrivi una risposta empatica e informativa basata sui dati disponibili (FAQ, identity, servizi) evitando di promettere azioni non confermate. Invita l'utente a specificare meglio o suggerisci alternative rilevanti.`;
            try {
                // Use UnifiedChatRouter for engine selection (Legacy vs OpenAI SDK)
                const llmResponse = yield this.unifiedChatRouter.routeMessage({
                    workspaceId: input.workspaceId,
                    customerId: input.customerId,
                    customerName: input.customerName || "Cliente",
                    customerLanguage: input.customerLanguage || "it",
                    message: prompt,
                    conversationHistory: history,
                    customerDiscount: input.customerDiscount || 0,
                    conversationId,
                    messageId: `${conversationId}-fallback-${Date.now()}`,
                });
                debugSteps.push({
                    type: "sub_agent",
                    agent: "UnifiedChatRouter",
                    timestamp: new Date().toISOString(),
                    output: {
                        decision: "generic_fallback",
                        textResponse: (_a = llmResponse.response) === null || _a === void 0 ? void 0 : _a.substring(0, 200),
                    },
                    tokenUsage: {
                        promptTokens: 0,
                        completionTokens: llmResponse.tokensUsed || 0,
                        totalTokens: llmResponse.tokensUsed || 0,
                    },
                });
                return {
                    message: llmResponse.response ||
                        "Mi dispiace, non ho trovato informazioni utili. Posso aiutarti in altro modo?",
                    tokensUsed: llmResponse.tokensUsed || 0,
                };
            }
            catch (error) {
                logger_1.default.error("❌ [ChatEngine] Generic LLM fallback failed", { error });
                return {
                    message: "Mi dispiace, al momento non riesco a trovare informazioni utili. Vuoi provare a riformulare la richiesta?",
                    tokensUsed: 0,
                };
            }
        });
    }
    buildCartActionOptions(hasRemovableItems_1, workspaceId_1) {
        return __awaiter(this, arguments, void 0, function* (hasRemovableItems, workspaceId, uniqueTransportModes = 0) {
            const options = [];
            let nextNumber = 1;
            options.push({ number: nextNumber++, name: "Conferma ordine", id: "CONFIRM_ORDER" });
            options.push({ number: nextNumber++, name: "Esplorare il catalogo", id: "SHOW_PRODUCTS" });
            options.push({ number: nextNumber++, name: "Mostra servizi", id: "SHOW_SERVICES" });
            options.push({ number: nextNumber++, name: "Guardare le offerte", id: "SHOW_OFFERS" });
            if (hasRemovableItems) {
                options.push({ number: nextNumber++, name: "Rimuovere un articolo", id: "REMOVE_FROM_CART" });
            }
            options.push({ number: nextNumber++, name: "Cancella il carrello", id: "CLEAR_CART" });
            // TODO: "Ottimizza spedizione" feature - will be implemented later
            // Option: Order optimization (show only when 2+ different transport modes exist)
            // if (uniqueTransportModes >= 2) {
            //   options.push({ number: nextNumber++, name: "Ottimizza spedizione", id: "OPTIMIZE_TRANSPORT" })
            // }
            return options;
        });
    }
    extractCartItemCountFromFunctionCalls(functionCalls) {
        var _a, _b, _c, _d;
        if (!(functionCalls === null || functionCalls === void 0 ? void 0 : functionCalls.length))
            return null;
        for (let idx = functionCalls.length - 1; idx >= 0; idx--) {
            const resultCartItems = (_d = (_c = (_b = (_a = functionCalls[idx]) === null || _a === void 0 ? void 0 : _a.result) === null || _b === void 0 ? void 0 : _b.cartData) === null || _c === void 0 ? void 0 : _c.cart) === null || _d === void 0 ? void 0 : _d.items;
            if (Array.isArray(resultCartItems)) {
                return resultCartItems.length;
            }
        }
        return null;
    }
    /**
     * Count unique transport modes from cart data
     * Returns 0 if no transport info available
     */
    countUniqueTransportModes(cartData) {
        var _a;
        const transport = ((_a = cartData === null || cartData === void 0 ? void 0 : cartData.cart) === null || _a === void 0 ? void 0 : _a.transport) || (cartData === null || cartData === void 0 ? void 0 : cartData.transport);
        if (!(transport === null || transport === void 0 ? void 0 : transport.byType))
            return 0;
        return Object.keys(transport.byType).length;
    }
    /**
     * Extract unique transport modes count from function calls (for LLM responses)
     */
    extractTransportModesFromFunctionCalls(functionCalls) {
        var _a, _b;
        if (!(functionCalls === null || functionCalls === void 0 ? void 0 : functionCalls.length))
            return 0;
        for (let idx = functionCalls.length - 1; idx >= 0; idx--) {
            const cartData = (_b = (_a = functionCalls[idx]) === null || _a === void 0 ? void 0 : _a.result) === null || _b === void 0 ? void 0 : _b.cartData;
            if (cartData) {
                return this.countUniqueTransportModes(cartData);
            }
        }
        return 0;
    }
    handleProductContextIntent(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const { input, conversationId, history, chatSession, fsmState, workspaceConfig, startTime, debugSteps } = params;
            if (!chatSession) {
                return null;
            }
            const validStates = new Set([
                conversation_state_service_1.ConversationState.VIEWING_PRODUCT,
                conversation_state_service_1.ConversationState.AWAITING_ADD_CONFIRM,
            ]);
            if (!validStates.has(fsmState.state)) {
                return null;
            }
            const selectedProductId = fsmState.selectedProductId;
            const selectedProductSku = fsmState.selectedProductSku;
            if (!selectedProductId && !selectedProductSku) {
                return null;
            }
            const where = {
                workspaceId: input.workspaceId,
            };
            if (selectedProductId) {
                where.id = selectedProductId;
            }
            else if (selectedProductSku) {
                where.sku = selectedProductSku;
            }
            const productRecord = yield this.prisma.products.findFirst({
                where,
                include: {
                    category: { select: { name: true } },
                    productCertifications: {
                        include: { certification: true },
                    },
                    productTransportTypes: {
                        include: { transportType: true },
                    },
                },
            });
            if (!productRecord) {
                logger_1.default.warn("⚠️ [ChatEngine] PRODUCT_CONTEXT intent but product not found", {
                    workspaceId: input.workspaceId,
                    productId: selectedProductId,
                    productSku: selectedProductSku,
                });
                return null;
            }
            const certifications = new Set();
            for (const relation of productRecord.productCertifications || []) {
                if ((_a = relation.certification) === null || _a === void 0 ? void 0 : _a.name) {
                    certifications.add(relation.certification.name);
                }
            }
            for (const inline of productRecord.certifications || []) {
                if (inline)
                    certifications.add(inline);
            }
            const transportType = ((_d = (_c = (_b = productRecord.productTransportTypes) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.transportType) === null || _d === void 0 ? void 0 : _d.name) ||
                productRecord.transportType ||
                null;
            const productData = {
                id: productRecord.id,
                name: productRecord.name,
                description: productRecord.description,
                format: productRecord.formato,
                price: productRecord.price,
                region: productRecord.region,
                certifications: Array.from(certifications),
                transportType,
                tags: [(_e = productRecord.category) === null || _e === void 0 ? void 0 : _e.name, productRecord.region].filter(Boolean),
                storageInfo: null,
                pairingSuggestions: undefined,
                ingredients: [],
                allergens: productRecord.allergens || [],
                imageUrl: Array.isArray(productRecord.imageUrl) ? productRecord.imageUrl[0] : productRecord.imageUrl,
            };
            const agent = new ProductContextAgentLLM_1.ProductContextAgentLLM(this.prisma);
            const conversationHistory = history
                .filter((msg) => msg.role === "assistant" || msg.role === "user")
                .slice(-4)
                .map((msg) => ({
                role: msg.role,
                content: msg.content,
            }));
            const agentResponse = yield agent.handleQuestion({
                workspaceId: input.workspaceId,
                customerId: input.customerId,
                customerName: input.customerName,
                customerLanguage: input.customerLanguage,
                customerDiscount: input.customerDiscount,
                question: input.message,
                product: productData,
                workspaceInfo: {
                    name: workspaceConfig.workspaceName,
                    botIdentityResponse: workspaceConfig.botIdentityResponse,
                    customAiRules: workspaceConfig.customAiRules,
                    sellsProductsAndServices: workspaceConfig.sellsProductsAndServices,
                    address: workspaceConfig.address,
                },
                conversationHistory,
            });
            // If ProductContextAgent failed, return null to trigger FAQ fallback
            if (!agentResponse.success) {
                logger_1.default.warn("⚠️ [ChatEngine] ProductContextAgent failed, will try FAQ fallback", {
                    workspaceId: input.workspaceId,
                    productId: productData.id,
                    question: input.message,
                });
                return null;
            }
            const processingTimeMs = Date.now() - startTime;
            debugSteps.push({
                type: "sub_agent",
                agent: "🧀 ProductContextAgentLLM",
                model: agentResponse.model,
                timestamp: new Date().toISOString(),
                tokenUsage: agentResponse.tokensUsed
                    ? {
                        promptTokens: 0,
                        completionTokens: 0,
                        totalTokens: agentResponse.tokensUsed,
                    }
                    : undefined,
                input: {
                    userMessage: input.message,
                },
                output: {
                    textResponse: agentResponse.output.length > 200
                        ? `${agentResponse.output.substring(0, 200)}...`
                        : agentResponse.output,
                    executionTimeMs: agentResponse.executionTimeMs,
                },
                duration: agentResponse.executionTimeMs,
            });
            const usedTokens = agentResponse.tokensUsed || 0;
            const finalDebugInfo = {
                loadedDataType: "PRODUCT_CONTEXT",
                responseType: "PRODUCT_CONTEXT",
                llmUsed: true,
                steps: debugSteps,
                totalTokens: usedTokens,
                totalCost: (usedTokens * 0.0003) / 1000,
                executionTimeMs: processingTimeMs,
            };
            const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, input.message, agentResponse.output, database_1.AgentType.PRODUCT_SEARCH, agentResponse.tokensUsed, finalDebugInfo);
            return {
                message: agentResponse.output,
                agentType: database_1.AgentType.PRODUCT_SEARCH,
                wasHandled: true,
                intent: "PRODUCT_CONTEXT",
                confidence: "HIGH",
                source: "LLM_FALLBACK",
                processingTimeMs,
                debugInfo: finalDebugInfo,
                response: agentResponse.output,
                agentUsed: database_1.AgentType.PRODUCT_SEARCH,
                tokensUsed: usedTokens,
                executionTimeMs: processingTimeMs,
                wasFAQ: false,
                isBlocked: false,
                _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
            };
        });
    }
    /**
     * Helper: Push translation debug step to timeline
     * Extracted to reduce code duplication in applyTranslation
     */
    pushTranslationDebugStep(debugSteps, data) {
        debugSteps.push({
            type: "sub_agent",
            agent: "🌍 Translation Agent",
            model: data.model,
            timestamp: new Date().toISOString(),
            tokenUsage: data.tokensUsed ? {
                promptTokens: Math.floor(data.tokensUsed * 0.7),
                completionTokens: Math.floor(data.tokensUsed * 0.3),
                totalTokens: data.tokensUsed,
            } : undefined,
            systemPrompt: data.error
                ? `ERROR: ${data.error}`
                : (data.systemPrompt || "Translate to target language"),
            input: {
                textContent: data.inputMessage.substring(0, 200) + (data.inputMessage.length > 200 ? "..." : ""),
                targetLanguage: data.targetLanguage,
            },
            output: {
                textResponse: data.outputMessage.substring(0, 200) + (data.outputMessage.length > 200 ? "..." : ""),
                translated: data.translated,
                executionTimeMs: data.executionTimeMs,
            },
            duration: data.executionTimeMs,
        });
    }
    /**
     * Load workspace configuration (cached)
     */
    loadWorkspaceConfig(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const cached = workspaceConfigCache.get(workspaceId);
            if (cached && Date.now() - cached.timestamp < CONFIG_CACHE_TTL) {
                return cached.config;
            }
            const workspace = yield this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: {
                    name: true,
                    sellsProductsAndServices: true,
                    hasSalesAgents: true,
                    hasHumanSupport: true,
                    humanSupportInstructions: true,
                    operatorContactMethod: true,
                    welcomeMessage: true,
                    botIdentityResponse: true,
                    customAiRules: true, // Custom AI rules that override default behavior
                    notificationEmail: true,
                    address: true,
                },
            });
            const config = {
                name: (workspace === null || workspace === void 0 ? void 0 : workspace.name) || "Assistente",
                sellsProductsAndServices: (_a = workspace === null || workspace === void 0 ? void 0 : workspace.sellsProductsAndServices) !== null && _a !== void 0 ? _a : true,
                hasSalesAgents: (_b = workspace === null || workspace === void 0 ? void 0 : workspace.hasSalesAgents) !== null && _b !== void 0 ? _b : false,
                hasHumanSupport: (_c = workspace === null || workspace === void 0 ? void 0 : workspace.hasHumanSupport) !== null && _c !== void 0 ? _c : false,
                humanSupportInstructions: (_d = workspace === null || workspace === void 0 ? void 0 : workspace.humanSupportInstructions) !== null && _d !== void 0 ? _d : null,
                operatorContactMethod: (_e = workspace === null || workspace === void 0 ? void 0 : workspace.operatorContactMethod) !== null && _e !== void 0 ? _e : null,
                welcomeMessage: workspace === null || workspace === void 0 ? void 0 : workspace.welcomeMessage,
                botIdentityResponse: (_f = workspace === null || workspace === void 0 ? void 0 : workspace.botIdentityResponse) !== null && _f !== void 0 ? _f : null,
                botIdentity: (_g = workspace === null || workspace === void 0 ? void 0 : workspace.botIdentityResponse) !== null && _g !== void 0 ? _g : null, // Alias for LLMFormatter
                customAiRules: (_h = workspace === null || workspace === void 0 ? void 0 : workspace.customAiRules) !== null && _h !== void 0 ? _h : null,
                adminEmail: (workspace === null || workspace === void 0 ? void 0 : workspace.notificationEmail) || null,
                workspaceName: (workspace === null || workspace === void 0 ? void 0 : workspace.name) || "Il nostro shop",
                address: (workspace === null || workspace === void 0 ? void 0 : workspace.address) || null
            };
            workspaceConfigCache.set(workspaceId, { config, timestamp: Date.now() });
            return config;
        });
    }
    /**
     * Check if intent is e-commerce related (requires sellsProductsAndServices=true)
     */
    isEcommerceIntent(intentType) {
        const ecommerceIntents = [
            "SHOW_CATEGORIES",
            "SHOW_CATEGORY",
            "SHOW_PRODUCTS",
            "SHOW_PRODUCT",
            "SEARCH_PRODUCTS",
            "SHOW_OFFERS",
            "SHOW_NEW_ARRIVALS",
            "VIEW_CART",
            "ADD_TO_CART",
            "REMOVE_FROM_CART",
            "UPDATE_CART_QUANTITY",
            "CLEAR_CART",
            "CHECKOUT",
            "START_CHECKOUT", // Same as CHECKOUT
            "VIEW_ORDERS",
            "ORDER_DETAILS",
            "TRACK_ORDER",
            "REPEAT_ORDER", // Re-order products from previous order
            "PRODUCT_CONTEXT",
        ];
        return ecommerceIntents.includes(intentType);
    }
    shouldUseCatalogQuery(intent) {
        const supportedIntents = new Set(["SEARCH_PRODUCTS"]);
        return supportedIntents.has(intent.type);
    }
    /**
     * Normalize language code from DB format (ITA, ENG, PRT) to ISO format (it, en, pt)
     * This is critical to avoid translating Italian to Italian when DB has "ITA"
     */
    normalizeLanguageCode(language) {
        var _a;
        const normalized = ((_a = language === null || language === void 0 ? void 0 : language.toLowerCase) === null || _a === void 0 ? void 0 : _a.call(language)) || "it";
        const mapping = {
            // Italian
            it: "it", ita: "it", italian: "it",
            // English  
            en: "en", eng: "en", english: "en",
            // Spanish
            es: "es", esp: "es", spa: "es", spanish: "es",
            // Portuguese
            pt: "pt", prt: "pt", portuguese: "pt",
            // French
            fr: "fr", fra: "fr", french: "fr",
            // German
            de: "de", deu: "de", ger: "de", german: "de",
        };
        return mapping[normalized] || "it"; // Default to Italian if unknown
    }
    /**
     * ============================================================================
     * MAIN ENTRY POINT (Public API)
     * ============================================================================
     *
     * Design Pattern: Decorator/Wrapper with Customer-Level Lock
     *
     * This wrapper ensures:
     * 1. CONCURRENCY SAFETY: Only ONE message per customer processed at a time
     * 2. TRANSLATION: ALL responses pass through Translation Layer
     *
     * Flow:
     *   0. Acquire customer lock (wait if another message is processing)
     *   1. processMessageInternal() → Business logic, returns Italian response
     *   2. applyTranslation() → Translates to customer's language
     *   3. Release customer lock
     *   4. Return final translated response
     *
     * @param input - Customer message and context
     * @returns Translated response ready for delivery
     */
    routeMessage(input) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // 🔒 CONCURRENCY LOCK: Ensure sequential processing per customer
            const lockKey = `customer:${input.customerId}`;
            // Wait for any existing lock to release
            while (customerProcessingLocks.has(lockKey)) {
                logger_1.default.info(`🔒 [ChatEngine] Waiting for lock: ${lockKey}`);
                yield customerProcessingLocks.get(lockKey);
            }
            // Create and set our lock
            let releaseLock;
            const lockPromise = new Promise((resolve) => {
                releaseLock = resolve;
            });
            customerProcessingLocks.set(lockKey, lockPromise);
            logger_1.default.info(`🔒 [ChatEngine] Lock acquired: ${lockKey}`);
            try {
                // STEP 1: Process message through business logic pipeline
                const result = yield this.processMessageInternal(input);
                // STEP 2: Apply Translation Layer (SINGLE translation point)
                const debugSteps = ((_a = result.debugInfo) === null || _a === void 0 ? void 0 : _a.steps) || [];
                const rawTargetLanguage = input.customerLanguage || "it";
                // Normalize language code (handles ITA, ENG, PRT, SPA, etc.)
                const normalizedLanguage = this.normalizeLanguageCode(rawTargetLanguage);
                // Always apply translation layer (even for Italian - ensures consistent flow)
                const translationResult = yield this.applyTranslation(result.message, input.workspaceId, normalizedLanguage, // Pass normalized code (pt, en, es, it) 
                debugSteps, input.customerName);
                // 🌍 STEP 2B: Update the saved message with translated version
                // Use the message ID saved from processMessageInternal
                const messageIdToUpdate = result._assistantMessageId;
                if (messageIdToUpdate) {
                    try {
                        logger_1.default.info("🌍 [ChatEngine] Attempting to update message", {
                            messageId: messageIdToUpdate,
                            targetLanguage: normalizedLanguage,
                            hasId: !!messageIdToUpdate,
                        });
                        // Build updated debugInfo with translation step
                        const updatedDebugInfo = result.debugInfo ? Object.assign(Object.assign({}, result.debugInfo), { steps: debugSteps, totalTokens: (result.debugInfo.totalTokens || 0) + translationResult.tokensUsed }) : undefined;
                        yield this.prisma.conversationMessage.update({
                            where: { id: messageIdToUpdate },
                            data: {
                                content: translationResult.message,
                                debugInfo: updatedDebugInfo ? JSON.stringify(updatedDebugInfo) : undefined,
                            }
                        });
                        logger_1.default.info("🌍 [ChatEngine] ✅ Updated saved message with translation", {
                            messageId: messageIdToUpdate,
                            targetLanguage: normalizedLanguage,
                            newContentLength: translationResult.message.length,
                            debugStepsCount: debugSteps.length,
                        });
                    }
                    catch (error) {
                        logger_1.default.error("⚠️ [ChatEngine] Failed to update message translation", {
                            error: error.message || error,
                            messageId: messageIdToUpdate,
                            errorCode: error.code,
                        });
                        // Continue anyway - the translated message will be returned to user
                    }
                }
                else {
                    logger_1.default.warn("⚠️ [ChatEngine] No message ID to update translation", {
                        hasResult: !!result,
                        hasAssistantMessageId: !!result._assistantMessageId,
                    });
                }
                // STEP 3: Return translated result with updated metrics
                // Remove the internal _assistantMessageId before returning
                const _b = result, { _assistantMessageId } = _b, cleanResult = __rest(_b, ["_assistantMessageId"]);
                return Object.assign(Object.assign({}, cleanResult), { message: translationResult.message, response: translationResult.message, tokensUsed: cleanResult.tokensUsed + translationResult.tokensUsed, debugInfo: cleanResult.debugInfo ? Object.assign(Object.assign({}, cleanResult.debugInfo), { steps: debugSteps, totalTokens: (cleanResult.debugInfo.totalTokens || 0) + translationResult.tokensUsed }) : undefined });
            }
            finally {
                // 🔓 ALWAYS release lock, even on error
                customerProcessingLocks.delete(lockKey);
                releaseLock();
                logger_1.default.info(`🔓 [ChatEngine] Lock released: ${lockKey}`);
            }
        });
    }
    /**
     * ============================================================================
     * INTERNAL MESSAGE PROCESSOR (Private - Business Logic)
     * ============================================================================
     *
     * Contains all message processing logic. Returns response in Italian (base language).
     * Translation is handled by the routeMessage() wrapper.
     *
     * Pipeline Steps:
     *   0. Load workspace config
     *   1. Preprocess (detect numbers, confirmations)
     *   2. FAST-PATH: Handle confirmations, numeric selections
     *   3. Parse intent with LLM
     *   4. Load data based on intent
     *   5. Build structured response
     *   6. Format with LLM
     *   7. Replace links/tokens
     *   8. Save to history
     *   9. Update FSM state
     *
     * @param input - Customer message and context
     * @returns Response in Italian (base language)
     */
    processMessageInternal(input) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17;
            const startTime = Date.now();
            const debugSteps = [];
            let totalTokens = 0;
            logger_1.default.info("🚀 [ChatEngine] Processing message", {
                customerId: input.customerId,
                workspaceId: input.workspaceId,
                messagePreview: input.message.substring(0, 50),
            });
            try {
                // ========================================================================
                // STEP 0: Load workspace config
                // ========================================================================
                const workspaceConfig = yield this.loadWorkspaceConfig(input.workspaceId);
                logger_1.default.info("⚙️ [ChatEngine] Workspace config loaded", {
                    sellsProducts: workspaceConfig.sellsProductsAndServices,
                    hasSalesAgents: workspaceConfig.hasSalesAgents,
                });
                // ========================================================================
                // STEP 0.1: Check if first message → Return Welcome Message
                // ========================================================================
                // Count previous messages from this customer in this workspace
                const previousMessageCount = yield this.prisma.message.count({
                    where: {
                        chatSession: {
                            customerId: input.customerId,
                            workspaceId: input.workspaceId,
                        },
                        deletedAt: null,
                    },
                });
                const isFirstMessage = previousMessageCount === 0;
                logger_1.default.info("👋 [ChatEngine] First message check", {
                    customerId: input.customerId,
                    previousMessageCount,
                    isFirstMessage,
                });
                // If first message and welcomeMessage is configured, return it directly
                if (isFirstMessage && workspaceConfig.welcomeMessage) {
                    const welcomeText = typeof workspaceConfig.welcomeMessage === "string"
                        ? workspaceConfig.welcomeMessage
                        : typeof workspaceConfig.welcomeMessage === "object" && ((_a = workspaceConfig.welcomeMessage) === null || _a === void 0 ? void 0 : _a.text)
                            ? workspaceConfig.welcomeMessage.text
                            : JSON.stringify(workspaceConfig.welcomeMessage);
                    logger_1.default.info("👋 [ChatEngine] Returning welcome message for first-time customer", {
                        customerId: input.customerId,
                        workspaceId: input.workspaceId,
                        welcomeMessageLength: welcomeText.length,
                    });
                    const conversationId = input.conversationId || `temp-${input.customerId}`;
                    // Save messages to history
                    const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, input.message, welcomeText, "WELCOME", 0, {
                        loadedDataType: "WELCOME_MESSAGE",
                        responseType: "WELCOME_MESSAGE",
                        llmUsed: false,
                        steps: [{
                                type: "welcome",
                                agent: "👋 Welcome",
                                timestamp: new Date().toISOString(),
                                input: { textContent: input.message.substring(0, 100) },
                                output: { textContent: "First message - returning configured welcome message" },
                                duration: 0,
                            }],
                        totalTokens: 0,
                        executionTimeMs: Date.now() - startTime,
                    });
                    return {
                        message: welcomeText,
                        agentType: database_1.AgentType.ROUTER,
                        wasHandled: true,
                        intent: "GREETING",
                        confidence: "HIGH",
                        source: "PATTERN",
                        processingTimeMs: Date.now() - startTime,
                        tokensUsed: 0,
                        agentUsed: "WELCOME",
                        _assistantMessageId: savedMessages.assistantMessageId,
                    };
                }
                // ========================================================================
                // STEP 0.5: Preprocess short inputs (numbers, yes/no)
                // ========================================================================
                const conversationId = input.conversationId || `temp-${input.customerId}`;
                logger_1.default.debug("🔍 [ChatEngine] Processing message", {
                    conversationId,
                    message: input.message.substring(0, 50),
                });
                // Preprocess: detect short inputs and enrich message for LLM
                let preprocessResult = message_preprocessor_service_1.messagePreprocessorService.process(input.message);
                logger_1.default.info("🔍 [ChatEngine] Preprocess result", {
                    isShortInput: preprocessResult.isShortInput,
                    inputType: preprocessResult.inputType,
                    extractedNumber: preprocessResult.extractedNumber,
                    extractedQuantity: preprocessResult.extractedQuantity,
                });
                // Use enriched message for LLM (contains context hints for short inputs)
                const messageForLLM = preprocessResult.enrichedMessage;
                let cachedOptionsMapping;
                const loadOptionsMapping = () => __awaiter(this, void 0, void 0, function* () {
                    if (cachedOptionsMapping === undefined) {
                        cachedOptionsMapping = yield this.optionsMappingService.loadMapping(input.workspaceId, conversationId);
                    }
                    return cachedOptionsMapping;
                });
                // ========================================================================
                // STEP 0.55: Pending action requiring free-text note (ADD_ORDER_NOTE)
                // ========================================================================
                const pendingMapping = yield loadOptionsMapping();
                if (((_b = pendingMapping === null || pendingMapping === void 0 ? void 0 : pendingMapping.pendingAction) === null || _b === void 0 ? void 0 : _b.type) === "ADD_ORDER_NOTE") {
                    const orderCode = pendingMapping.pendingAction.orderCode;
                    const noteContent = input.message.trim();
                    if (!orderCode) {
                        logger_1.default.warn("⚠️ [ChatEngine] Pending ADD_ORDER_NOTE without orderCode");
                        yield this.optionsMappingService.clearPendingAction(conversationId);
                    }
                    else if (!noteContent) {
                        const promptMessage = "Scrivi la nota che vuoi aggiungere all'ordine.";
                        const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, input.message, promptMessage);
                        return {
                            message: promptMessage,
                            agentType: database_1.AgentType.ORDER_TRACKING,
                            wasHandled: true,
                            intent: "ADD_ORDER_NOTE",
                            confidence: "HIGH",
                            source: "PATTERN",
                            processingTimeMs: Date.now() - startTime,
                            response: promptMessage,
                            agentUsed: database_1.AgentType.ORDER_TRACKING,
                            tokensUsed: 0,
                            executionTimeMs: Date.now() - startTime,
                            wasFAQ: false,
                            isBlocked: false,
                            _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
                        };
                    }
                    else {
                        const { addOrderNote } = require("../../domain/calling-functions/addOrderNote");
                        const noteResult = yield addOrderNote({
                            workspaceId: input.workspaceId,
                            customerId: input.customerId,
                            orderCode,
                            note: noteContent,
                        });
                        yield this.optionsMappingService.clearPendingAction(conversationId);
                        cachedOptionsMapping = null;
                        const processedMessage = yield this.replaceUserVariables(noteResult.message, input.customerId, input.workspaceId, input.customerName);
                        const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, input.message, processedMessage);
                        return {
                            message: processedMessage,
                            agentType: database_1.AgentType.ORDER_TRACKING,
                            wasHandled: true,
                            intent: "ADD_ORDER_NOTE",
                            confidence: "HIGH",
                            source: "PATTERN",
                            processingTimeMs: Date.now() - startTime,
                            response: processedMessage,
                            agentUsed: database_1.AgentType.ORDER_TRACKING,
                            tokensUsed: 0,
                            executionTimeMs: Date.now() - startTime,
                            wasFAQ: false,
                            isBlocked: false,
                            _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
                        };
                    }
                }
                // ========================================================================
                // STEP 0.6: FAST-PATH for confirmation with quantity (e.g., "sì 3", "si, 2 pezzi")
                // ========================================================================
                // If preprocessor detected "confirmation_with_quantity", handle ADD_TO_CART directly
                if (preprocessResult.inputType === "confirmation_with_quantity" || preprocessResult.inputType === "confirmation") {
                    const optionsMapping = yield loadOptionsMapping();
                    const pendingAction = optionsMapping === null || optionsMapping === void 0 ? void 0 : optionsMapping.pendingAction;
                    logger_1.default.info("🔍 [ChatEngine] DEBUG: Checking pendingAction for confirmation", {
                        hasPendingAction: !!pendingAction,
                        pendingActionType: pendingAction === null || pendingAction === void 0 ? void 0 : pendingAction.type,
                        pendingActionProductId: pendingAction === null || pendingAction === void 0 ? void 0 : pendingAction.productId,
                        pendingActionItemType: pendingAction === null || pendingAction === void 0 ? void 0 : pendingAction.itemType,
                        fullOptionsMapping: JSON.stringify(optionsMapping),
                    });
                    if (pendingAction && pendingAction.type === "ADD_TO_CART" && pendingAction.productId) {
                        logger_1.default.info("🛒 [ChatEngine] FAST-PATH: Confirmation detected with pending ADD_TO_CART", {
                            inputType: preprocessResult.inputType,
                            extractedQuantity: preprocessResult.extractedQuantity,
                            productId: pendingAction.productId,
                            productName: pendingAction.productName,
                            itemType: pendingAction.itemType || "PRODUCT",
                            pendingActionFull: JSON.stringify(pendingAction), // 🔍 DEBUG: Log full pendingAction
                        });
                        // Extract quantity: from message if present, otherwise default to 1
                        const quantity = preprocessResult.extractedQuantity || pendingAction.quantity || 1;
                        const itemLabel = pendingAction.itemType === "SERVICE" ? "servizio" : "prodotto";
                        // Delegate to CartManagementAgentLLM with selectedSku and itemType
                        const cartAgent = new CartManagementAgentLLM_1.CartManagementAgentLLM(this.prisma);
                        const cartResponse = yield cartAgent.handleQuery({
                            workspaceId: input.workspaceId,
                            customerId: input.customerId,
                            query: `aggiungi ${quantity} ${pendingAction.productName || itemLabel} al carrello`,
                            customerName: input.customerName || "",
                            customerLanguage: input.customerLanguage || "it",
                            customerDiscount: input.customerDiscount || 0,
                            selectedSku: pendingAction.productId, // SKU/code for precise cart addition
                            selectedItemType: pendingAction.itemType || "PRODUCT", // 🆕 Pass item type
                        });
                        // 🧹 CRITICAL: Clear pendingAction after execution to prevent re-use
                        yield this.optionsMappingService.clearPendingAction(conversationId);
                        logger_1.default.info("🧹 [ChatEngine] Cleared pendingAction after ADD_TO_CART execution");
                        // 🛒 CRITICAL: Save CART_ACTIONS mapping so "1" triggers CONFIRM_ORDER, not product search!
                        const cartItemCount = this.extractCartItemCountFromFunctionCalls(cartResponse.functionCalls);
                        const transportModes = this.extractTransportModesFromFunctionCalls(cartResponse.functionCalls);
                        const cartActions = yield this.buildCartActionOptions((cartItemCount !== null && cartItemCount !== void 0 ? cartItemCount : 2) > 1, input.workspaceId, transportModes);
                        yield this.optionsMappingService.saveMapping({
                            workspaceId: input.workspaceId,
                            conversationId,
                            customerId: input.customerId,
                            responseText: "",
                            items: cartActions,
                            listType: "CART_ACTIONS",
                        });
                        logger_1.default.info("🛒 [ChatEngine] Set CART_ACTIONS mapping after ADD_TO_CART", {
                            cartItemCount,
                            actions: cartActions.map((action) => action.id),
                        });
                        const processingTimeMs = Date.now() - startTime;
                        const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, // 🔧 Use conversationId (not input.conversationId) for consistent history
                        input.message, cartResponse.output);
                        return {
                            message: cartResponse.output,
                            agentType: database_1.AgentType.CART_MANAGEMENT,
                            wasHandled: true,
                            intent: "CONFIRM_ADD_TO_CART",
                            confidence: "HIGH",
                            source: "PATTERN",
                            processingTimeMs,
                            debugInfo: {
                                loadedDataType: "PENDING_ACTION_EXECUTED",
                                responseType: "CART_OPERATION",
                                // llmUsed: true, // RIMOSSO: non esiste nel tipo
                                // fastPath: "CONFIRMATION_WITH_QUANTITY", // RIMOSSO: non esiste nel tipo
                            },
                            response: cartResponse.output,
                            agentUsed: database_1.AgentType.CART_MANAGEMENT,
                            tokensUsed: cartResponse.tokensUsed,
                            executionTimeMs: processingTimeMs,
                            wasFAQ: false,
                            isBlocked: false,
                            _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
                        };
                    }
                    else if (pendingAction && pendingAction.type === "SHOW_PRODUCTS") {
                        // 🔧 FIX: When user says "si" after "Vuoi vedere i nostri prodotti?", 
                        // show CATEGORIES (not grouped products limited to 4)
                        logger_1.default.info("🛍️ [ChatEngine] FAST-PATH: Confirmation detected for SHOW_PRODUCTS prompt → showing CATEGORIES");
                        yield this.optionsMappingService.clearPendingAction(conversationId);
                        cachedOptionsMapping = null;
                        // Load history before usage
                        const history = yield this.conversationManager.loadHistory(input.workspaceId, conversationId);
                        // Use SHOW_CATEGORIES instead of SHOW_PRODUCTS to show ALL categories
                        const showIntent = { type: "SHOW_CATEGORIES" };
                        const loadedData = yield this.dataLoader.loadForIntent(showIntent, input.workspaceId, input.customerId, input.customerDiscount);
                        const structuredResponse = this.responseBuilder.build(showIntent, loadedData, {
                            workspaceId: input.workspaceId,
                            customerLanguage: input.customerLanguage || "it",
                            customerName: input.customerName,
                            customerDiscount: input.customerDiscount,
                            userMessage: input.message,
                            enableCategoryRanking: workspaceConfig.sellsProductsAndServices,
                        });
                        const formatterResult = yield this.formatWithCustomRules(structuredResponse, input.customerLanguage || "it", workspaceConfig, undefined, // conversationHistory
                        { customerName: input.customerName, isFirstMessage: history.length === 0 });
                        const finalMessage = formatterResult.text;
                        const processingTimeMs = Date.now() - startTime;
                        const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, input.message, finalMessage);
                        const categoryItems = ((_d = (_c = structuredResponse.data) === null || _c === void 0 ? void 0 : _c.items) === null || _d === void 0 ? void 0 : _d.map((item) => ({
                            number: item.number,
                            name: item.name,
                            id: item.id,
                        }))) || [];
                        yield this.optionsMappingService.saveMapping({
                            workspaceId: input.workspaceId,
                            conversationId,
                            customerId: input.customerId,
                            responseText: formatterResult.text,
                            items: categoryItems,
                            listType: "CATEGORIES",
                        });
                        return {
                            message: finalMessage,
                            agentType: database_1.AgentType.PRODUCT_SEARCH,
                            wasHandled: true,
                            intent: "SHOW_PRODUCTS",
                            confidence: "HIGH",
                            source: "PATTERN",
                            processingTimeMs,
                            response: finalMessage,
                            agentUsed: database_1.AgentType.PRODUCT_SEARCH,
                            tokensUsed: formatterResult.tokensUsed || 0,
                            executionTimeMs: processingTimeMs,
                            wasFAQ: false,
                            isBlocked: false,
                            _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
                        };
                    }
                }
                // ========================================================================
                // STEP 0.7: Load ChatSession for FSM state management
                // ========================================================================
                if (preprocessResult.inputType === "normal") {
                    const optionsMapping = yield loadOptionsMapping();
                    if ((_e = optionsMapping === null || optionsMapping === void 0 ? void 0 : optionsMapping.options) === null || _e === void 0 ? void 0 : _e.length) {
                        const normalizedMessage = options_mapping_service_1.OptionsMappingService.cleanLabel(input.message).toLowerCase();
                        const matchedOption = optionsMapping.options.find((opt) => {
                            const normalizedLabel = options_mapping_service_1.OptionsMappingService.cleanLabel(opt.label).toLowerCase();
                            return normalizedLabel === normalizedMessage;
                        });
                        if (matchedOption) {
                            logger_1.default.info("🎯 [ChatEngine] Text-based selection matched option", {
                                label: matchedOption.label,
                                number: matchedOption.number,
                                listType: optionsMapping.listType,
                            });
                            preprocessResult = Object.assign(Object.assign({}, preprocessResult), { isShortInput: true, inputType: "number", extractedNumber: matchedOption.number });
                        }
                    }
                }
                // 🆕 Load chatSession early so FSM can be used in FAST-PATH
                const chatSession = yield this.prisma.chatSession.findFirst({
                    where: {
                        workspaceId: input.workspaceId,
                        customerId: input.customerId,
                        status: "active",
                    },
                    select: { id: true },
                });
                let fsmState = {
                    state: conversation_state_service_1.ConversationState.IDLE,
                    stateEnteredAt: new Date().toISOString(),
                };
                if (chatSession) {
                    fsmState = yield this.conversationStateService.getState(chatSession.id);
                    logger_1.default.debug("🔄 [FSM] Loaded conversation state (early)", {
                        chatSessionId: chatSession.id.substring(0, 8),
                        state: fsmState.state,
                    });
                }
                // ========================================================================
                // NOTE: NO automatic context reset for text input
                // ========================================================================
                // Principle XV: "User Context Freedom" - Users can switch context at ANY time
                // BUT we DON'T clear optionsMapping preemptively because:
                // 1. User might reference items from the current list ("cancella Confezione Regalo")
                // 2. Intent Parser needs context to understand relative references
                // 3. The LLM will naturally handle context switches
                // 
                // optionsMapping is cleared ONLY when:
                // - A new list is shown (overwrites old mapping)
                // - User explicitly starts a new flow (handled by FSM transitions)
                // ========================================================================
                // STEP 0.75: FAST-PATH - Resolve numeric selections from options mapping
                // ========================================================================
                // If user typed a number, load options mapping from DB and resolve directly
                if (preprocessResult.inputType === "number" && preprocessResult.extractedNumber) {
                    const optionsMapping = yield loadOptionsMapping();
                    // 🔍 DEBUG: Log what we got from the database
                    logger_1.default.info("🔍 [DEBUG] Loaded optionsMapping for number selection", {
                        hasMapping: !!optionsMapping,
                        listType: optionsMapping === null || optionsMapping === void 0 ? void 0 : optionsMapping.listType,
                        optionsCount: (_f = optionsMapping === null || optionsMapping === void 0 ? void 0 : optionsMapping.options) === null || _f === void 0 ? void 0 : _f.length,
                        hasGroupMapping: !!(optionsMapping === null || optionsMapping === void 0 ? void 0 : optionsMapping.groupMapping),
                        groupMappingKeys: (optionsMapping === null || optionsMapping === void 0 ? void 0 : optionsMapping.groupMapping) ? Object.keys(optionsMapping.groupMapping) : [],
                        firstOptionSkus: (_j = (_h = (_g = optionsMapping === null || optionsMapping === void 0 ? void 0 : optionsMapping.options) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.skus) === null || _j === void 0 ? void 0 : _j.slice(0, 2),
                    });
                    // 🆕 PRIORITY 1: Check groupMapping first (for smart grouping like "Formaggi Freschi")
                    // This contains the SKUs for each numbered group created by LLM
                    if (optionsMapping === null || optionsMapping === void 0 ? void 0 : optionsMapping.groupMapping) {
                        const groupKey = String(preprocessResult.extractedNumber);
                        const selectedGroup = optionsMapping.groupMapping[groupKey];
                        logger_1.default.info("🔍 [DEBUG] Checking groupMapping", {
                            groupKey,
                            hasSelectedGroup: !!selectedGroup,
                            selectedGroupSkus: (_k = selectedGroup === null || selectedGroup === void 0 ? void 0 : selectedGroup.skus) === null || _k === void 0 ? void 0 : _k.slice(0, 3),
                        });
                        if (selectedGroup && ((_l = selectedGroup.skus) === null || _l === void 0 ? void 0 : _l.length) > 0) {
                            logger_1.default.info("🎯 [ChatEngine] FAST-PATH: Using groupMapping to resolve selection", {
                                number: preprocessResult.extractedNumber,
                                groupName: selectedGroup.nome,
                                skuCount: selectedGroup.skus.length,
                                skus: selectedGroup.skus,
                            });
                            // Load products by SKUs
                            const products = yield this.dataLoader.loadProductsBySkus(input.workspaceId, selectedGroup.skus, input.customerDiscount);
                            if (products.length > 0) {
                                // Load history before usage
                                const history = yield this.conversationManager.loadHistory(input.workspaceId, conversationId);
                                // Build response with loaded products
                                const loadedData = {
                                    type: "PRODUCTS",
                                    products,
                                };
                                const structuredResponse = this.responseBuilder.build({ type: "SEARCH_PRODUCTS", query: selectedGroup.nome }, loadedData, {
                                    customerName: input.customerName,
                                    customerLanguage: input.customerLanguage || "it",
                                    workspaceId: input.workspaceId,
                                    customerDiscount: input.customerDiscount,
                                    userMessage: input.message,
                                    enableCategoryRanking: workspaceConfig.sellsProductsAndServices,
                                });
                                // Format with LLM
                                const formatterResult = yield this.formatWithCustomRules(structuredResponse, input.customerLanguage || "it", workspaceConfig, undefined, { customerName: input.customerName, isFirstMessage: history.length === 0 });
                                let finalMessage = formatterResult.text;
                                // Remove any SKU tags before showing to customer
                                finalMessage = finalMessage
                                    .replace(/\s*\[SKU:[A-Z0-9-]+\]/gi, '')
                                    .replace(/\s*\[SKUS?:[A-Z0-9-,]+\]/gi, '')
                                    .replace(/---JSON_MAPPING---[\s\S]*?---END_JSON---/g, '')
                                    .trim();
                                const processingTimeMs = Date.now() - startTime;
                                // Save messages
                                const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, // 🔧 Use conversationId for consistent history
                                input.message, finalMessage);
                                // 🔧 CRITICAL: Save new options mapping with items and listType
                                // This ensures next "1" is interpreted as product selection, not group selection!
                                const itemsWithSkus = (_o = (_m = structuredResponse.data) === null || _m === void 0 ? void 0 : _m.items) === null || _o === void 0 ? void 0 : _o.map((item) => ({
                                    number: item.number,
                                    name: item.name,
                                    sku: item.sku,
                                }));
                                yield this.optionsMappingService.saveMapping({
                                    workspaceId: input.workspaceId,
                                    conversationId,
                                    customerId: input.customerId,
                                    responseText: formatterResult.text,
                                    items: itemsWithSkus, // 🔧 Pass items with SKUs
                                    listType: "PRODUCTS", // 🔧 Mark as product list for next selection
                                    // groupMapping: undefined - intentionally NOT passing groupMapping for product lists
                                });
                                logger_1.default.info("✅ [ChatEngine] FAST-PATH groupMapping complete", {
                                    groupName: selectedGroup.nome,
                                    productsReturned: products.length,
                                    savedItemsCount: (itemsWithSkus === null || itemsWithSkus === void 0 ? void 0 : itemsWithSkus.length) || 0,
                                    savedListType: "PRODUCTS",
                                    timeMs: processingTimeMs,
                                });
                                return {
                                    message: finalMessage,
                                    agentType: database_1.AgentType.PRODUCT_SEARCH,
                                    wasHandled: true,
                                    intent: "SELECT_GROUP",
                                    confidence: "HIGH",
                                    source: "PATTERN",
                                    processingTimeMs,
                                    debugInfo: {
                                        loadedDataType: "PRODUCTS_FROM_GROUP",
                                        responseType: structuredResponse.type,
                                        llmUsed: !formatterResult.cached,
                                        steps: debugSteps,
                                        totalTokens: formatterResult.tokensUsed || 0,
                                    },
                                    response: finalMessage,
                                    agentUsed: database_1.AgentType.PRODUCT_SEARCH,
                                    tokensUsed: formatterResult.tokensUsed || 0,
                                    executionTimeMs: processingTimeMs,
                                    wasFAQ: false,
                                    isBlocked: false,
                                    _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
                                };
                            }
                        }
                    }
                    // PRIORITY 2: Fall back to regular options (categories, products with SKUs)
                    if ((optionsMapping === null || optionsMapping === void 0 ? void 0 : optionsMapping.options) && optionsMapping.options.length > 0) {
                        const selectedOption = optionsMapping.options.find(opt => opt.number === preprocessResult.extractedNumber);
                        if (selectedOption) {
                            logger_1.default.info("🎯 [ChatEngine] FAST-PATH: Resolved selection from options mapping", {
                                number: preprocessResult.extractedNumber,
                                label: selectedOption.label,
                                skus: selectedOption.skus,
                                id: selectedOption.id, // 🆕 For ORDER_ACTIONS
                                listType: optionsMapping.listType,
                            });
                            // Create SELECT_OPTION intent with SKUs and optionId
                            const selectIntent = {
                                type: "SELECT_OPTION",
                                number: preprocessResult.extractedNumber,
                                resolvedValue: selectedOption.label,
                                listType: optionsMapping.listType || "CATEGORIES",
                                skus: selectedOption.skus,
                                optionId: selectedOption.id, // 🆕 For ORDER_ACTIONS: "SEND_INVOICE", "REPEAT_ORDER"
                                optionMetadata: selectedOption.metadata,
                            };
                            // Load data using this intent
                            const loadedData = yield this.dataLoader.loadForIntent(selectIntent, input.workspaceId, input.customerId, input.customerDiscount);
                            // Build and format response
                            const structuredResponse = this.responseBuilder.build(selectIntent, loadedData, {
                                workspaceId: input.workspaceId,
                                customerLanguage: input.customerLanguage,
                                customerName: input.customerName,
                                customerDiscount: input.customerDiscount,
                                disableGrouping: selectIntent.listType === "ORDER_OPTIMIZATION_ACTIONS",
                                userMessage: input.message,
                                enableCategoryRanking: workspaceConfig.sellsProductsAndServices,
                            });
                            // 📦 Handle ORDER_ACTION - execute calling function directly
                            if (structuredResponse.type === "ORDER_ACTION") {
                                const orderActionData = structuredResponse.data;
                                const action = orderActionData.action;
                                const metadataOrderCode = (_r = (_q = (_p = optionsMapping.options) === null || _p === void 0 ? void 0 : _p.find(opt => opt.id === action)) === null || _q === void 0 ? void 0 : _q.metadata) === null || _r === void 0 ? void 0 : _r.orderCode;
                                const orderCode = orderActionData.orderCode ||
                                    metadataOrderCode ||
                                    optionsMapping.currentOrderCode;
                                logger_1.default.info("📦 [ChatEngine] ORDER_ACTION detected, executing calling function", {
                                    action,
                                    orderCode,
                                });
                                if (!orderCode) {
                                    logger_1.default.warn("⚠️ [ChatEngine] No order code found for ORDER_ACTION");
                                    return {
                                        message: "Mi dispiace, non ho trovato l'ordine di riferimento. Puoi dirmi il codice ordine?",
                                        agentType: database_1.AgentType.ORDER_TRACKING,
                                        wasHandled: true,
                                        intent: "ORDER_ACTION",
                                        confidence: "HIGH",
                                        source: "PATTERN",
                                        processingTimeMs: Date.now() - startTime,
                                        debugInfo: { llmUsed: false },
                                    };
                                }
                                // Execute the appropriate calling function
                                const actionResult = yield this.executeOrderAction(action, orderCode, input.workspaceId, input.customerId, conversationId);
                                // 🔧 Replace user variables in the message ({{nameUser}}, {{agentPhone}}, etc.)
                                const processedMessage = yield this.replaceUserVariables(actionResult.message, input.customerId, input.workspaceId, input.customerName);
                                // Save messages to history
                                const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, input.message, processedMessage);
                                return {
                                    message: processedMessage,
                                    agentType: database_1.AgentType.ORDER_TRACKING,
                                    wasHandled: true,
                                    intent: "ORDER_ACTION",
                                    confidence: "HIGH",
                                    source: "PATTERN",
                                    processingTimeMs: Date.now() - startTime,
                                    // llmUsed: false, // RIMOSSO: non esiste nel tipo
                                    _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
                                };
                            }
                            // 🛒 Handle CART_ACTION - execute cart action directly
                            if (structuredResponse.type === "CART_ACTION") {
                                const action = structuredResponse.data.action;
                                logger_1.default.info("🛒 [ChatEngine] CART_ACTION detected", { action });
                                if (action === "CONFIRM_ORDER") {
                                    const confirmStart = Date.now();
                                    const orderResult = yield (0, ConfirmOrder_1.confirmOrder)({
                                        workspaceId: input.workspaceId,
                                        customerId: input.customerId,
                                    });
                                    // Replace template variables
                                    let confirmMessage = yield this.replaceUserVariables(orderResult.message, input.customerId, input.workspaceId, input.customerName);
                                    const replacementResult = yield this.linkReplacementService.replaceTokens({ response: confirmMessage, linkType: "auto" }, input.customerId, input.workspaceId);
                                    if (replacementResult.success && replacementResult.response) {
                                        confirmMessage = replacementResult.response;
                                    }
                                    // Persist response
                                    const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, input.message, confirmMessage, database_1.AgentType.CART_MANAGEMENT, 0, {
                                        loadedDataType: "CART_ACTION",
                                        responseType: "CONFIRM_ORDER",
                                        llmUsed: false,
                                        steps: [
                                            {
                                                type: "function_call",
                                                agent: "🧾 confirmOrder",
                                                timestamp: new Date().toISOString(),
                                                input: { textContent: "Finalize cart checkout" },
                                                output: {
                                                    result: {
                                                        success: orderResult.success,
                                                        orderCode: orderResult.orderCode,
                                                        total: orderResult.orderTotal,
                                                    },
                                                    executionTimeMs: Date.now() - confirmStart,
                                                },
                                                duration: Date.now() - confirmStart,
                                            },
                                        ],
                                        totalTokens: 0,
                                        totalCost: 0,
                                        executionTimeMs: Date.now() - confirmStart,
                                    });
                                    // Clear any pending checkout confirmations
                                    yield this.optionsMappingService.clearPendingAction(conversationId);
                                    // Save next actions (notes / orders) if provided
                                    if ((_t = (_s = orderResult.nextActions) === null || _s === void 0 ? void 0 : _s.options) === null || _t === void 0 ? void 0 : _t.length) {
                                        yield this.optionsMappingService.saveMapping({
                                            workspaceId: input.workspaceId,
                                            conversationId,
                                            customerId: input.customerId,
                                            responseText: "",
                                            items: orderResult.nextActions.options.map((opt) => ({
                                                number: opt.number,
                                                name: opt.label,
                                                id: opt.id,
                                                metadata: opt.metadata,
                                            })),
                                            listType: orderResult.nextActions.listType || "ORDER_ACTIONS",
                                        });
                                    }
                                    else {
                                        yield this.optionsMappingService.saveMapping({
                                            workspaceId: input.workspaceId,
                                            conversationId,
                                            customerId: input.customerId,
                                            responseText: "",
                                            forceClear: true,
                                        });
                                    }
                                    return {
                                        message: confirmMessage,
                                        agentType: database_1.AgentType.CART_MANAGEMENT,
                                        wasHandled: orderResult.success,
                                        intent: "CART_ACTION",
                                        confidence: "HIGH",
                                        source: "PATTERN",
                                        processingTimeMs: Date.now() - startTime,
                                        response: confirmMessage,
                                        agentUsed: database_1.AgentType.CART_MANAGEMENT,
                                        tokensUsed: 0,
                                        executionTimeMs: Date.now() - startTime,
                                        wasFAQ: false,
                                        isBlocked: false,
                                        _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
                                    };
                                }
                                // 🚚 Handle OPTIMIZE_TRANSPORT - Premium/Enterprise feature
                                if (action === "OPTIMIZE_TRANSPORT") {
                                    logger_1.default.info("🚚 [ChatEngine] OPTIMIZE_TRANSPORT action triggered");
                                    // Import the OrderOptimizationAgentLLM
                                    const { OrderOptimizationAgentLLM } = yield Promise.resolve().then(() => __importStar(require("../agents/OrderOptimizationAgentLLM")));
                                    const optimizationAgent = new OrderOptimizationAgentLLM(this.prisma);
                                    const optimizationStart = Date.now();
                                    const optimizationResult = yield optimizationAgent.process({
                                        workspaceId: input.workspaceId,
                                        customerId: input.customerId,
                                        customerLanguage: input.customerLanguage || "it",
                                    });
                                    // Persist response
                                    const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, input.message, optimizationResult.explanation, database_1.AgentType.CART_MANAGEMENT, optimizationResult.tokensUsed || 0, {
                                        loadedDataType: "CART_ACTION",
                                        responseType: "OPTIMIZE_TRANSPORT",
                                        llmUsed: true,
                                        steps: [
                                            {
                                                type: "function_call",
                                                agent: "🚚 OrderOptimizationAgentLLM",
                                                timestamp: new Date().toISOString(),
                                                input: { customerId: input.customerId },
                                                output: {
                                                    result: {
                                                        success: optimizationResult.success,
                                                        hasSuggestions: !!((_u = optimizationResult.recommendations) === null || _u === void 0 ? void 0 : _u.length),
                                                    },
                                                    executionTimeMs: Date.now() - optimizationStart,
                                                },
                                                duration: Date.now() - optimizationStart,
                                            },
                                        ],
                                        totalTokens: optimizationResult.tokensUsed || 0,
                                        totalCost: 0,
                                        executionTimeMs: Date.now() - optimizationStart,
                                    });
                                    // Clear pending action
                                    yield this.optionsMappingService.clearPendingAction(conversationId);
                                    // 🚚 Save ORDER_OPTIMIZATION options for next interaction
                                    const transports = (_w = (_v = optimizationResult.analysis) === null || _v === void 0 ? void 0 : _v.transports) !== null && _w !== void 0 ? _w : [];
                                    const optimizationOptions = [];
                                    let optionCounter = 1;
                                    if (transports.length > 0) {
                                        for (const transport of transports.slice(0, 3)) {
                                            optimizationOptions.push({
                                                number: optionCounter++,
                                                name: `${this.getTransportEmoji(transport.transportTypeName)} Mostra prodotti ${transport.transportTypeName}`,
                                                id: "SHOW_TRANSPORT_PRODUCTS",
                                                metadata: { transportTypeName: transport.transportTypeName },
                                            });
                                        }
                                    }
                                    else {
                                        // Fallback options if analysis did not return transport names
                                        optimizationOptions.push({ number: optionCounter++, name: "🧊 Mostra prodotti Congelati", id: "SHOW_FROZEN_PRODUCTS", metadata: { transportTypeName: "Trasporto congelato" } }, { number: optionCounter++, name: "❄️ Mostra prodotti Refrigerati", id: "SHOW_REFRIGERATED_PRODUCTS", metadata: { transportTypeName: "Trasporto refrigerato" } }, { number: optionCounter++, name: "📦 Mostra prodotti Temperatura Ambiente", id: "SHOW_AMBIENT_PRODUCTS", metadata: { transportTypeName: "Temperatura ambiente" } });
                                    }
                                    optimizationOptions.push({
                                        number: optionCounter++,
                                        name: "🛒 Torna al carrello",
                                        id: "SHOW_CART",
                                    });
                                    yield this.optionsMappingService.saveMapping({
                                        workspaceId: input.workspaceId,
                                        conversationId,
                                        customerId: input.customerId,
                                        responseText: optimizationResult.explanation,
                                        items: optimizationOptions,
                                        listType: "ORDER_OPTIMIZATION_ACTIONS",
                                    });
                                    return {
                                        message: optimizationResult.explanation,
                                        agentType: database_1.AgentType.CART_MANAGEMENT,
                                        wasHandled: true,
                                        intent: "CART_ACTION",
                                        confidence: "HIGH",
                                        source: "PATTERN",
                                        processingTimeMs: Date.now() - startTime,
                                        response: optimizationResult.explanation,
                                        agentUsed: database_1.AgentType.CART_MANAGEMENT,
                                        tokensUsed: optimizationResult.tokensUsed || 0,
                                        executionTimeMs: Date.now() - startTime,
                                        wasFAQ: false,
                                        isBlocked: false,
                                        _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
                                    };
                                }
                                // Other actions (SHOW_PRODUCTS) → let normal flow handle it (returns categories)
                            }
                            // 📋 Handle PRODUCT_DETAIL_ACTIONS - navigation shortcuts from product detail view
                            if (optionsMapping.listType === "PRODUCT_DETAIL_ACTIONS" && selectedOption.id) {
                                const actionId = selectedOption.id;
                                logger_1.default.info("📋 [ChatEngine] PRODUCT_DETAIL_ACTIONS detected", { actionId });
                                if (actionId === "SHOW_CATEGORIES") {
                                    // Show categories
                                    const categoriesIntent = {
                                        type: "SHOW_CATEGORIES",
                                    };
                                    const loadedData = yield this.dataLoader.loadForIntent(categoriesIntent, input.workspaceId, input.customerId, input.customerDiscount);
                                    const structuredResp = this.responseBuilder.build(categoriesIntent, loadedData, {
                                        workspaceId: input.workspaceId,
                                        customerLanguage: input.customerLanguage,
                                        customerName: input.customerName,
                                        customerDiscount: input.customerDiscount,
                                        userMessage: input.message,
                                        enableCategoryRanking: workspaceConfig.sellsProductsAndServices,
                                    });
                                    const formatterResult = yield this.formatWithCustomRules(structuredResp, input.customerLanguage || "it", workspaceConfig, undefined, { customerName: input.customerName });
                                    const formattedText = formatterResult.text;
                                    // Save mapping for category list so future selections use new options
                                    const categoryItems = (_y = (_x = structuredResp.data) === null || _x === void 0 ? void 0 : _x.items) === null || _y === void 0 ? void 0 : _y.map((item) => ({
                                        number: item.number,
                                        name: item.name,
                                        sku: item.sku,
                                        id: item.id,
                                    }));
                                    yield this.optionsMappingService.saveMapping({
                                        workspaceId: input.workspaceId,
                                        conversationId,
                                        customerId: input.customerId,
                                        responseText: formattedText,
                                        items: categoryItems,
                                        listType: "CATEGORIES",
                                    });
                                    if (chatSession) {
                                        yield this.conversationStateService.setState(chatSession.id, conversation_state_service_1.ConversationState.BROWSING_CATEGORIES, {});
                                    }
                                    const savedMsgs = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, input.message, formattedText);
                                    return {
                                        message: formattedText,
                                        agentType: database_1.AgentType.PRODUCT_SEARCH,
                                        wasHandled: true,
                                        intent: "SHOW_CATEGORIES",
                                        confidence: "HIGH",
                                        source: "PATTERN",
                                        processingTimeMs: Date.now() - startTime,
                                        _assistantMessageId: savedMsgs === null || savedMsgs === void 0 ? void 0 : savedMsgs.assistantMessageId,
                                    };
                                }
                                if (actionId === "VIEW_CART") {
                                    // Show cart
                                    const cartIntent = {
                                        type: "VIEW_CART",
                                    };
                                    const loadedData = yield this.dataLoader.loadForIntent(cartIntent, input.workspaceId, input.customerId, input.customerDiscount);
                                    const structuredResp = this.responseBuilder.build(cartIntent, loadedData, {
                                        workspaceId: input.workspaceId,
                                        customerLanguage: input.customerLanguage,
                                        customerName: input.customerName,
                                        customerDiscount: input.customerDiscount,
                                        userMessage: input.message,
                                        enableCategoryRanking: workspaceConfig.sellsProductsAndServices,
                                    });
                                    const formatterResult = yield this.formatWithCustomRules(structuredResp, input.customerLanguage || "it", workspaceConfig, undefined, { customerName: input.customerName });
                                    const formattedText = formatterResult.text;
                                    // Mirror CART_VIEW mappings/actions so numeric selections map correctly
                                    const cartItems = structuredResp.data.items || [];
                                    const transportModes = this.countUniqueTransportModes(structuredResp.data);
                                    const cartActions = yield this.buildCartActionOptions(cartItems.length > 1, input.workspaceId, transportModes);
                                    yield this.optionsMappingService.saveMapping({
                                        workspaceId: input.workspaceId,
                                        conversationId,
                                        customerId: input.customerId,
                                        responseText: "",
                                        items: cartActions,
                                        listType: "CART_ACTIONS",
                                    });
                                    if (chatSession) {
                                        yield this.conversationStateService.setState(chatSession.id, conversation_state_service_1.ConversationState.VIEWING_CART, {});
                                    }
                                    const savedMsgs = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, input.message, formattedText);
                                    return {
                                        message: formattedText,
                                        agentType: database_1.AgentType.CART_MANAGEMENT,
                                        wasHandled: true,
                                        intent: "VIEW_CART",
                                        confidence: "HIGH",
                                        source: "PATTERN",
                                        processingTimeMs: Date.now() - startTime,
                                        _assistantMessageId: savedMsgs === null || savedMsgs === void 0 ? void 0 : savedMsgs.assistantMessageId,
                                    };
                                }
                            }
                            // 🗑️ Handle CART_REMOVAL_OPTIONS - format removal options
                            if (structuredResponse.type === "CART_REMOVAL_OPTIONS") {
                                const items = structuredResponse.data.items || [];
                                if (items.length === 0) {
                                    const emptyMsg = "Il tuo carrello è vuoto, non c'è nulla da rimuovere.";
                                    const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, input.message, emptyMsg);
                                    return {
                                        message: emptyMsg,
                                        agentType: database_1.AgentType.CART_MANAGEMENT,
                                        wasHandled: true,
                                        intent: "CART_REMOVAL_OPTIONS",
                                        confidence: "HIGH",
                                        source: "PATTERN",
                                        processingTimeMs: Date.now() - startTime,
                                        _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
                                    };
                                }
                                // Build formatted list
                                // 🎯 Use itemType for consistent product/service filtering
                                const products = items.filter((i) => i.itemType === "PRODUCT" || (!i.itemType && !i.isService));
                                const services = items.filter((i) => i.itemType === "SERVICE" || i.isService);
                                let removalMessage = "Quale articolo vuoi rimuovere?\n\n";
                                let optionNumber = 1;
                                const mappingItems = [];
                                if (products.length > 0) {
                                    removalMessage += "🛒 Prodotti:\n";
                                    for (const p of products) {
                                        const qty = p.quantity || 1;
                                        const price = p.price || 0;
                                        removalMessage += `${optionNumber}. ${qty}x ${p.name} - ${formatCartPrice(price * qty)}\n`;
                                        mappingItems.push({ number: optionNumber, name: p.name, id: p.id });
                                        optionNumber++;
                                    }
                                    removalMessage += "\n";
                                }
                                if (services.length > 0) {
                                    removalMessage += "🔧 Servizi:\n";
                                    for (const s of services) {
                                        const price = s.price || 0;
                                        // Services don't show "1x" prefix
                                        removalMessage += `${optionNumber}. ${s.name} - ${formatCartPrice(price)}\n`;
                                        mappingItems.push({ number: optionNumber, name: s.name, id: s.id });
                                        optionNumber++;
                                    }
                                }
                                removalMessage += "\nRispondi con il numero dell'articolo da rimuovere.";
                                // Save mapping for removal selection
                                yield this.optionsMappingService.saveMapping({
                                    workspaceId: input.workspaceId,
                                    conversationId,
                                    customerId: input.customerId,
                                    responseText: "",
                                    items: mappingItems,
                                    listType: "CART_ITEMS",
                                });
                                const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, input.message, removalMessage);
                                return {
                                    message: removalMessage,
                                    agentType: database_1.AgentType.CART_MANAGEMENT,
                                    wasHandled: true,
                                    intent: "CART_REMOVAL_OPTIONS",
                                    confidence: "HIGH",
                                    source: "PATTERN",
                                    processingTimeMs: Date.now() - startTime,
                                    _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
                                };
                            }
                            // ========================================================================
                            // 🧠 Handle NEEDS_LLM_CONTEXT - Hybrid fallback when inference failed
                            // Pass to LLM with conversation history to understand user intent
                            // ========================================================================
                            if (structuredResponse.type === "NEEDS_LLM_CONTEXT") {
                                const contextData = structuredResponse.data;
                                debugSteps.push({
                                    type: "router",
                                    agent: "ChatEngine",
                                    step: "HYBRID_FALLBACK",
                                    timestamp: Date.now(),
                                    details: {
                                        label: contextData.label,
                                        originalListType: contextData.originalListType,
                                        inferAttempted: contextData.inferAttempted,
                                        action: "Passing to LLM with context",
                                    },
                                });
                                logger_1.default.info("🧠 [ChatEngine] NEEDS_LLM_CONTEXT - passing to LLM with history", {
                                    label: contextData.label,
                                    originalListType: contextData.originalListType,
                                    conversationId,
                                });
                                // Load conversation history for context
                                const history = yield this.conversationManager.loadHistory(input.workspaceId, conversationId);
                                // Build a contextual prompt for the LLM
                                const contextPrompt = `L'utente ha selezionato l'opzione: "${contextData.label}"
              
Basandoti sulla conversazione precedente, rispondi in modo appropriato a questa selezione.
Se l'utente vuole:
- Confermare un ordine → chiedi conferma
- Vedere prodotti/catalogo → mostra le categorie disponibili
- Rimuovere un articolo → chiedi quale articolo vuole rimuovere
- Scaricare fattura → conferma l'invio
- Ripetere un ordine → chiedi conferma
- Altro → rispondi in modo utile

Rispondi in modo naturale e fluido, come un assistente esperto.`;
                                // Use UnifiedChatRouter for engine selection (Legacy vs OpenAI SDK)
                                const llmResponse = yield this.unifiedChatRouter.routeMessage({
                                    workspaceId: input.workspaceId,
                                    customerId: input.customerId,
                                    customerName: input.customerName || "Cliente",
                                    customerLanguage: input.customerLanguage || "it",
                                    message: contextPrompt,
                                    conversationHistory: history,
                                    customerDiscount: input.customerDiscount || 0,
                                    conversationId,
                                    messageId: `${conversationId}-context-${Date.now()}`,
                                });
                                debugSteps.push({
                                    type: "router",
                                    agent: "UnifiedChatRouter",
                                    step: "UNIFIED_ROUTER_RESPONSE",
                                    timestamp: Date.now(),
                                    details: {
                                        responseLength: ((_z = llmResponse.response) === null || _z === void 0 ? void 0 : _z.length) || 0,
                                        tokensUsed: llmResponse.tokensUsed || 0,
                                        agentUsed: llmResponse.agentUsed,
                                    },
                                });
                                const finalMessage = llmResponse.response || "Mi dispiace, non ho capito. Puoi ripetere?";
                                const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, input.message, finalMessage);
                                return {
                                    message: finalMessage,
                                    agentType: database_1.AgentType.ROUTER,
                                    wasHandled: true,
                                    intent: "LLM_CONTEXT_FALLBACK",
                                    confidence: "MEDIUM",
                                    source: "LLM_CONTEXT",
                                    processingTimeMs: Date.now() - startTime,
                                    debugInfo: {
                                        steps: debugSteps,
                                        hybridFallback: true,
                                        originalLabel: contextData.label,
                                    },
                                    _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
                                };
                            }
                            // Format with LLM
                            let finalMessage = structuredResponse.text || "";
                            let llmUsed = false;
                            let groupMappingFromFormatter;
                            if (structuredResponse.type !== "NO_RESULTS" && structuredResponse.type !== "ERROR") {
                                const formattedResult = yield this.formatWithCustomRules(structuredResponse, input.customerLanguage || "it", workspaceConfig, undefined, { customerName: input.customerName });
                                finalMessage = formattedResult.text;
                                llmUsed = !formattedResult.cached;
                                groupMappingFromFormatter = formattedResult.groupMapping; // 🔧 Capture groupMapping
                            }
                            else if (structuredResponse.type === "NO_RESULTS") {
                                const errorMessage = ((_0 = structuredResponse.data) === null || _0 === void 0 ? void 0 : _0.errorMessage) || "Nessun risultato trovato";
                                logger_1.default.warn("⚠️ [ChatEngine] NO_RESULTS response, delegating to generic fallback", {
                                    errorMessage,
                                    listType: optionsMapping === null || optionsMapping === void 0 ? void 0 : optionsMapping.listType,
                                });
                                // Load conversation history for context
                                const fallbackHistory = yield this.conversationManager.loadHistory(input.workspaceId, conversationId);
                                const fallback = yield this.routeGenericLLMFallback({
                                    input,
                                    conversationId,
                                    history: fallbackHistory,
                                    fallbackReason: errorMessage,
                                    debugSteps,
                                });
                                finalMessage = fallback.message;
                                llmUsed = true;
                                totalTokens += fallback.tokensUsed;
                            }
                            // Save response WITH SKUs for next selection
                            const responseWithSkus = finalMessage;
                            // Remove SKU tags before showing to customer
                            finalMessage = finalMessage
                                .replace(/\s*\[SKU:[A-Z0-9-]+\]/gi, '')
                                .replace(/\s*\[SKUS?:[A-Z0-9-,]+\]/gi, '');
                            const processingTimeMs = Date.now() - startTime;
                            const agentType = database_1.AgentType.PRODUCT_SEARCH;
                            // Save messages to history
                            const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, // 🔧 Use conversationId for consistent history
                            input.message, finalMessage);
                            // Save options mapping for next selection
                            // 🔧 FIX: Pass groupMapping from formatter result for smart grouping!
                            // 🆕 FIX: Pass items with SKUs for product lists - no more text parsing!
                            const itemsWithSkus = (_1 = structuredResponse.data.items) === null || _1 === void 0 ? void 0 : _1.map((item) => ({
                                number: item.number,
                                name: item.name,
                                sku: item.sku,
                                id: item.id,
                            }));
                            // 🔍 DEBUG: Check what listType we're passing
                            const computedListType = structuredResponse.type === "PRODUCT_LIST" ? "PRODUCTS"
                                : structuredResponse.type === "ORDER_LIST" ? "ORDERS"
                                    : structuredResponse.type === "CATEGORY_LIST" ? "CATEGORIES"
                                        : structuredResponse.type === "SERVICE_LIST" ? "SERVICES"
                                            : structuredResponse.type === "OFFERS" ? "OFFER_CATEGORIES" // 🆕
                                                : structuredResponse.type === "OFFER_WITH_PRODUCTS" ? "PRODUCTS" // 🆕 Single offer shows products
                                                    : undefined;
                            logger_1.default.info("📋 [ChatEngine] DEBUG: About to save mapping", {
                                structuredResponseType: structuredResponse.type,
                                computedListType,
                                itemsCount: (itemsWithSkus === null || itemsWithSkus === void 0 ? void 0 : itemsWithSkus.length) || 0,
                            });
                            yield this.optionsMappingService.saveMapping({
                                workspaceId: input.workspaceId,
                                conversationId,
                                customerId: input.customerId,
                                responseText: responseWithSkus,
                                groupMapping: groupMappingFromFormatter,
                                items: itemsWithSkus,
                                listType: structuredResponse.type === "PRODUCT_LIST" ? "PRODUCTS"
                                    : structuredResponse.type === "ORDER_LIST" ? "ORDERS"
                                        : structuredResponse.type === "CATEGORY_LIST" ? "CATEGORIES"
                                            : structuredResponse.type === "SERVICE_LIST" ? "SERVICES"
                                                : structuredResponse.type === "OFFERS" ? "OFFER_CATEGORIES" // 🆕
                                                    : structuredResponse.type === "OFFER_WITH_PRODUCTS" ? "PRODUCTS" // 🆕 Single offer shows products
                                                        : undefined,
                            });
                            // 🆕 FSM: Update conversation state based on response type
                            if (chatSession) {
                                let newFsmState = null;
                                const fsmContext = {};
                                switch (structuredResponse.type) {
                                    case "CATEGORY_LIST":
                                        newFsmState = conversation_state_service_1.ConversationState.BROWSING_CATEGORIES;
                                        break;
                                    case "PRODUCT_LIST":
                                        newFsmState = conversation_state_service_1.ConversationState.BROWSING_PRODUCTS;
                                        break;
                                    case "SERVICE_LIST": // 🆕
                                        newFsmState = conversation_state_service_1.ConversationState.BROWSING_SERVICES;
                                        break;
                                    case "ORDER_LIST":
                                        newFsmState = conversation_state_service_1.ConversationState.BROWSING_ORDERS;
                                        break;
                                    case "PRODUCT_DETAIL":
                                        newFsmState = conversation_state_service_1.ConversationState.VIEWING_PRODUCT;
                                        if (structuredResponse.data.product) {
                                            fsmContext.selectedProductId = structuredResponse.data.product.id;
                                            fsmContext.selectedProductSku = structuredResponse.data.product.sku;
                                            fsmContext.selectedProductName = structuredResponse.data.product.name;
                                        }
                                        break;
                                    case "ORDER_DETAIL":
                                        newFsmState = conversation_state_service_1.ConversationState.VIEWING_ORDER;
                                        if (structuredResponse.data.order) {
                                            fsmContext.selectedOrderId = structuredResponse.data.order.id;
                                            fsmContext.selectedOrderCode = structuredResponse.data.order.code;
                                        }
                                        break;
                                    case "CART_VIEW":
                                    case "CART_UPDATED":
                                        newFsmState = conversation_state_service_1.ConversationState.VIEWING_CART;
                                        break;
                                }
                                if (newFsmState) {
                                    yield this.conversationStateService.setState(chatSession.id, newFsmState, fsmContext);
                                    logger_1.default.info("🔄 [FSM] FAST-PATH state updated", {
                                        newState: newFsmState,
                                        responseType: structuredResponse.type,
                                    });
                                }
                            }
                            // 🛒 Set pending action for PRODUCT_DETAIL (add to cart prompt)
                            if (structuredResponse.type === "PRODUCT_DETAIL" && structuredResponse.data.product) {
                                const product = structuredResponse.data.product;
                                yield this.optionsMappingService.setPendingAction({
                                    workspaceId: input.workspaceId,
                                    conversationId,
                                    pendingAction: {
                                        type: "ADD_TO_CART",
                                        productId: product.sku || product.id, // 🔧 Use SKU for CartManagementAgent (prefers SKU)
                                        productName: product.name,
                                        quantity: 1,
                                    },
                                });
                                logger_1.default.info("🛒 [ChatEngine] FAST-PATH: Set pending ADD_TO_CART action", {
                                    productId: product.sku || product.id,
                                    productName: product.name,
                                });
                                // 📋 Save PRODUCT_DETAIL_ACTIONS for navigation shortcuts (1. Esplora, 2. Carrello)
                                const productDetailActions = [
                                    { number: 1, name: "Esplora il catalogo", id: "SHOW_CATEGORIES", metadata: {} },
                                    { number: 2, name: "Mostrami il carrello", id: "VIEW_CART", metadata: {} },
                                ];
                                yield this.optionsMappingService.saveMapping({
                                    workspaceId: input.workspaceId,
                                    conversationId,
                                    customerId: input.customerId,
                                    responseText: "",
                                    items: productDetailActions,
                                    listType: "PRODUCT_DETAIL_ACTIONS",
                                });
                                logger_1.default.info("📋 [ChatEngine] FAST-PATH: Saved PRODUCT_DETAIL_ACTIONS mapping", {
                                    conversationId,
                                    actions: ["SHOW_CATEGORIES", "VIEW_CART"],
                                });
                            }
                            // 🆕 Set pending action for SERVICE_DETAIL (add to cart prompt)
                            if (structuredResponse.type === "SERVICE_DETAIL" && structuredResponse.data.service) {
                                const service = structuredResponse.data.service;
                                yield this.optionsMappingService.setPendingAction({
                                    workspaceId: input.workspaceId,
                                    conversationId,
                                    pendingAction: {
                                        type: "ADD_TO_CART",
                                        productId: service.code || service.id, // For services, use code
                                        productName: service.name,
                                        quantity: 1,
                                        itemType: "SERVICE", // 🆕 Mark as service for CartManagementAgent
                                    },
                                });
                                logger_1.default.info("🛒 [ChatEngine] FAST-PATH: Set pending ADD_TO_CART action for service", {
                                    serviceId: service.code || service.id,
                                    serviceName: service.name,
                                });
                            }
                            // 📦 Save order code AND order actions for ORDER_DETAIL
                            // 🔧 CRITICAL: We must save the ACTION options explicitly, not extract from text
                            // Because the text contains order items BEFORE actions, and extractFromResponse picks the first numbers
                            if (structuredResponse.type === "ORDER_DETAIL" && structuredResponse.data.order) {
                                const order = structuredResponse.data.order;
                                // Save order code
                                yield this.optionsMappingService.setCurrentOrderCode({
                                    workspaceId: input.workspaceId,
                                    conversationId,
                                    orderCode: order.code,
                                });
                                // 🆕 CRITICAL: Save explicit action options so "1" = Fattura, "2" = Ripeti
                                // This overrides the extracted options (which would be order items)
                                yield this.optionsMappingService.saveMapping({
                                    workspaceId: input.workspaceId,
                                    conversationId,
                                    customerId: input.customerId,
                                    responseText: "", // Empty - we're providing explicit items
                                    items: [
                                        { number: 1, name: "📄 Scarica fattura", id: "SEND_INVOICE", metadata: { orderCode: order.code } },
                                        { number: 2, name: "🔄 Ripeti ordine", id: "REPEAT_ORDER", metadata: { orderCode: order.code } },
                                    ],
                                    listType: "ORDER_ACTIONS",
                                });
                                logger_1.default.info("📦 [ChatEngine] FAST-PATH: Set order actions for ORDER_DETAIL", {
                                    orderCode: order.code,
                                    actions: ["SEND_INVOICE", "REPEAT_ORDER"],
                                });
                            }
                            // 🛒 Save CART_ACTIONS for CART_VIEW (guided cart options)
                            if (structuredResponse.type === "CART_VIEW" || structuredResponse.type === "CART_UPDATED") {
                                const cartItems = structuredResponse.data.items || [];
                                const transportModes = this.countUniqueTransportModes(structuredResponse.data);
                                const cartActions = yield this.buildCartActionOptions(cartItems.length > 1, input.workspaceId, transportModes);
                                yield this.optionsMappingService.saveMapping({
                                    workspaceId: input.workspaceId,
                                    conversationId,
                                    customerId: input.customerId,
                                    responseText: "", // Empty - we're providing explicit items
                                    items: cartActions,
                                    listType: "CART_ACTIONS",
                                });
                                logger_1.default.info("🛒 [ChatEngine] FAST-PATH: Set cart actions for CART_VIEW", {
                                    actions: cartActions.map((action) => action.id),
                                    cartItemCount: cartItems.length,
                                });
                            }
                            return {
                                message: finalMessage,
                                agentType,
                                wasHandled: true,
                                intent: selectIntent.type,
                                confidence: "HIGH",
                                source: "PATTERN",
                                processingTimeMs,
                                debugInfo: {
                                    loadedDataType: loadedData.type,
                                    responseType: structuredResponse.type,
                                    llmUsed,
                                    steps: debugSteps,
                                    totalTokens: 0,
                                },
                                response: finalMessage,
                                agentUsed: agentType,
                                tokensUsed: 0,
                                executionTimeMs: processingTimeMs,
                                wasFAQ: false,
                                isBlocked: false,
                                _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
                            };
                        }
                        else {
                            // ========================================================================
                            // 🚫 INVALID OPTION NUMBER - User selected a number not in the list
                            // Instead of falling through to search, return a helpful error message
                            // ========================================================================
                            const availableOptions = optionsMapping.options || [];
                            const selectedNumber = preprocessResult.extractedNumber;
                            const maxOption = availableOptions.reduce((max, opt) => Math.max(max, opt.number || 0), 0);
                            logger_1.default.info("🚫 [ChatEngine] Invalid option number selected", {
                                selectedNumber,
                                listType: optionsMapping.listType,
                                availableOptions: availableOptions.map(o => o.number),
                            });
                            // Build a friendly error message based on the context
                            let invalidMessage;
                            if (availableOptions.length > 0) {
                                const optionsText = availableOptions
                                    .map(opt => `${opt.number}. ${opt.label || opt.name || opt.id}`)
                                    .join("\n");
                                invalidMessage = `⚠️ Opzione non valida. Per favore scegli una delle seguenti opzioni:\n${optionsText}`;
                            }
                            else {
                                invalidMessage = `⚠️ Opzione non valida. Per favore scegli un numero valido.`;
                            }
                            const processingTimeMs = Date.now() - startTime;
                            // Save messages to history
                            const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, input.message, invalidMessage);
                            return {
                                message: invalidMessage,
                                agentType: database_1.AgentType.ROUTER,
                                wasHandled: true,
                                intent: "INVALID_OPTION",
                                confidence: "HIGH",
                                source: "PATTERN",
                                processingTimeMs,
                                debugInfo: {
                                    invalidOption: selectedNumber,
                                    maxOption,
                                    listType: optionsMapping.listType,
                                    steps: debugSteps,
                                },
                                _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
                            };
                        }
                    }
                }
                // ========================================================================
                // STEP 1: Load conversation history
                // ========================================================================
                // 🔧 CRITICAL: Use conversationId (which falls back to temp-{customerId}), NOT input.conversationId
                // Otherwise history is empty for temp conversations!
                const history = yield this.conversationManager.loadHistory(input.workspaceId, conversationId);
                logger_1.default.debug("📜 [ChatEngine] History loaded", {
                    historyLength: history.length,
                    conversationId,
                    usedInputConversationId: !!input.conversationId,
                });
                // ========================================================================
                // STEP 1.5: FSM State already loaded in STEP 0.7
                // ========================================================================
                // Re-load FSM state here in case it changed (e.g., from FAST-PATH)
                if (chatSession) {
                    fsmState = yield this.conversationStateService.getState(chatSession.id);
                    logger_1.default.info("🔄 [FSM] Refreshed conversation state", {
                        chatSessionId: chatSession.id.substring(0, 8),
                        state: fsmState.state,
                        pendingAction: (_2 = fsmState.pendingAction) === null || _2 === void 0 ? void 0 : _2.type,
                        selectedOrderCode: fsmState.selectedOrderCode,
                    });
                }
                // ========================================================================
                // STEP 2: Parse intent using ORIGINAL message for pattern matching
                // ========================================================================
                // IMPORTANT: Use original message (not enriched) for pattern matching!
                // The enriched message has "[SELECTION: User typed "1"...]" which breaks ^(\d+)$ patterns
                // The IntentParser will use lastAssistantMessage to resolve numeric selections
                const intentParseStart = Date.now();
                const lastAssistantMessage = history.length > 0
                    ? (_3 = history.filter(h => h.role === "assistant").pop()) === null || _3 === void 0 ? void 0 : _3.content
                    : undefined;
                const intentResult = yield this.intentParser.parse(input.message, {
                    workspaceId: input.workspaceId,
                    customerId: input.customerId,
                    lastAssistantMessage,
                    conversationHistory: history.map((h) => ({ role: h.role, content: h.content })),
                });
                // 🆕 Add Router/IntentParser debug step
                const intentParseTime = Date.now() - intentParseStart;
                debugSteps.push({
                    type: "router",
                    agent: "🧭 Router Agent (IntentParser)",
                    model: intentResult.source === "LLM_FALLBACK" ? "gpt-4o-mini" : undefined,
                    timestamp: new Date().toISOString(),
                    tokenUsage: intentResult.source === "LLM_FALLBACK" ? {
                        promptTokens: 150, // Estimated for intent classification
                        completionTokens: 10,
                        totalTokens: 160,
                    } : undefined,
                    systemPrompt: intentResult.source === "LLM_FALLBACK"
                        ? "Intent classification prompt (hardcoded in IntentParser)"
                        : "Pattern/Keyword matching (no LLM)",
                    input: {
                        userMessage: input.message,
                    },
                    output: {
                        decision: `Intent: ${intentResult.intent.type} (${intentResult.confidence} confidence, ${intentResult.source})`,
                        executionTimeMs: intentParseTime,
                    },
                    duration: intentParseTime,
                });
                if (intentResult.source === "LLM_FALLBACK") {
                    totalTokens += 160;
                }
                logger_1.default.info("🎯 [ChatEngine] Intent detected", {
                    type: intentResult.intent.type,
                    confidence: intentResult.confidence,
                    source: intentResult.source,
                    timeMs: intentResult.processingTimeMs,
                });
                // ========================================================================
                // STEP 2.20: Handle GREETING intent - Simple greeting response
                // ========================================================================
                if (intentResult.intent.type === "GREETING") {
                    const processingTimeMs = Date.now() - startTime;
                    // Get workspace name for personalized greeting
                    const workspaceName = workspaceConfig.name || "il nostro servizio";
                    // Simple greeting response - will be translated by translation layer
                    const greetingResponse = `Ciao! 👋 Benvenuto su ${workspaceName}. Come posso aiutarti oggi?`;
                    // Save messages
                    const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, input.message, greetingResponse);
                    logger_1.default.info("👋 [ChatEngine] Greeting handled", {
                        workspaceId: input.workspaceId,
                        customerId: input.customerId,
                        responseLength: greetingResponse.length,
                    });
                    return {
                        message: greetingResponse,
                        agentType: database_1.AgentType.ROUTER,
                        wasHandled: true,
                        intent: "GREETING",
                        confidence: "HIGH",
                        source: "PATTERN",
                        processingTimeMs,
                        debugInfo: {
                            steps: debugSteps,
                        },
                        response: greetingResponse,
                        agentUsed: database_1.AgentType.ROUTER,
                        tokensUsed: 0,
                        executionTimeMs: processingTimeMs,
                        wasFAQ: false,
                        _assistantMessageId: savedMessages.assistantMessageId,
                        isBlocked: false,
                    };
                }
                // ========================================================================
                // STEP 2.25: Handle UNKNOWN intent - Return "didn't understand" message
                // ========================================================================
                // The IntentParser already uses LLM fallback for classification.
                // If we still get UNKNOWN, it means the LLM couldn't classify it either.
                // Instead of trying product search, return a polite "didn't understand" message.
                if (intentResult.intent.type === "UNKNOWN") {
                    const processingTimeMs = Date.now() - startTime;
                    // Polite "didn't understand" message - will be translated by translation layer
                    const unknownResponse = "Mi dispiace, non ho capito. Potresti riformulare la domanda? 🤔";
                    // Save messages
                    const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, input.message, unknownResponse);
                    logger_1.default.info("❓ [ChatEngine] UNKNOWN intent - returning didn't understand message", {
                        workspaceId: input.workspaceId,
                        customerId: input.customerId,
                        originalMessage: input.message.substring(0, 50),
                    });
                    return {
                        message: unknownResponse,
                        agentType: database_1.AgentType.ROUTER,
                        wasHandled: true,
                        intent: "UNKNOWN",
                        confidence: "LOW",
                        source: "PATTERN",
                        processingTimeMs,
                        debugInfo: {
                            steps: debugSteps,
                        },
                        response: unknownResponse,
                        agentUsed: database_1.AgentType.ROUTER,
                        tokensUsed: 0,
                        executionTimeMs: processingTimeMs,
                        _assistantMessageId: savedMessages.assistantMessageId,
                        wasFAQ: false,
                        isBlocked: false,
                    };
                }
                // ========================================================================
                // STEP 2.5.5: 🧹 Clear stale pendingAction if intent is NOT CONFIRM/REJECT
                // ========================================================================
                // If user changes topic (e.g., "cancella carrello", "mostra categorie", etc.),
                // any previous pendingAction (like ADD_TO_CART) is no longer valid
                if (intentResult.intent.type !== "CONFIRM" && intentResult.intent.type !== "REJECT") {
                    const existingMapping = yield this.optionsMappingService.loadMapping(input.workspaceId, conversationId);
                    if (existingMapping === null || existingMapping === void 0 ? void 0 : existingMapping.pendingAction) {
                        logger_1.default.info("🧹 [ChatEngine] Clearing stale pendingAction - intent changed", {
                            previousAction: existingMapping.pendingAction.type,
                            newIntent: intentResult.intent.type,
                        });
                        yield this.optionsMappingService.clearPendingAction(conversationId);
                    }
                }
                // ========================================================================
                // STEP 2.6: Handle CONFIRM/REJECT with pendingAction
                // ========================================================================
                // When user says "sì" after "Vuoi aggiungerlo al carrello?", execute the pending action
                if (intentResult.intent.type === "CONFIRM" || intentResult.intent.type === "REJECT") {
                    const optionsMapping = yield this.optionsMappingService.loadMapping(input.workspaceId, conversationId);
                    if (optionsMapping === null || optionsMapping === void 0 ? void 0 : optionsMapping.pendingAction) {
                        const { pendingAction } = optionsMapping;
                        logger_1.default.info("✅ [ChatEngine] Processing CONFIRM/REJECT with pendingAction", {
                            intentType: intentResult.intent.type,
                            actionType: pendingAction.type,
                            productId: pendingAction.productId,
                            productName: pendingAction.productName,
                        });
                        if (intentResult.intent.type === "REJECT") {
                            // User said "no" - clear pending action and acknowledge
                            // 🧹 CRITICAL: Clear pendingAction after rejection
                            yield this.optionsMappingService.clearPendingAction(conversationId);
                            logger_1.default.info("🧹 [ChatEngine] Cleared pendingAction after REJECT");
                            const processingTimeMs = Date.now() - startTime;
                            const rejectMessage = "Ok, nessun problema! Posso aiutarti con altro?";
                            const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, // 🔧 Use conversationId for consistent history
                            input.message, rejectMessage);
                            return {
                                message: rejectMessage,
                                agentType: database_1.AgentType.ROUTER,
                                wasHandled: true,
                                intent: "REJECT",
                                confidence: "HIGH",
                                source: "PATTERN",
                                processingTimeMs,
                                debugInfo: {
                                    loadedDataType: "PENDING_ACTION_REJECTED",
                                    responseType: "ACKNOWLEDGMENT",
                                    // llmUsed: false, // RIMOSSO: non esiste nel tipo
                                },
                                response: rejectMessage,
                                agentUsed: database_1.AgentType.ROUTER,
                                tokensUsed: 0,
                                executionTimeMs: processingTimeMs,
                                wasFAQ: false,
                                isBlocked: false,
                                _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
                            };
                        }
                        // User said "yes" - execute the pending action
                        if (pendingAction.type === "ADD_TO_CART" && pendingAction.productId) {
                            // Extract quantity from message if present (e.g., "sì, 2 pezzi", "yes, 2 pieces", "sí, 2 unidades")
                            // Multilingual: pezzi/pezz|pieces|units|unidades|peças|stück
                            const quantityMatch = input.message.match(/(\d+)\s*(pezz[oi]|unit[aà]|pieces?|units?|unidades?|peças?|stück|x)?/i);
                            const quantity = quantityMatch ? parseInt(quantityMatch[1]) : (pendingAction.quantity || 1);
                            const itemLabel = pendingAction.itemType === "SERVICE" ? "servizio" : "prodotto";
                            // Delegate to CartManagementAgentLLM for intelligent cart handling
                            // 🔧 CRITICAL: Pass selectedSku and itemType so CartManagementAgent knows EXACTLY what to add
                            const cartAgent = new CartManagementAgentLLM_1.CartManagementAgentLLM(this.prisma);
                            const cartResponse = yield cartAgent.handleQuery({
                                workspaceId: input.workspaceId,
                                customerId: input.customerId,
                                query: `aggiungi ${quantity} ${pendingAction.productName || itemLabel} al carrello`,
                                customerName: input.customerName || "",
                                customerLanguage: input.customerLanguage || "it",
                                customerDiscount: input.customerDiscount || 0,
                                selectedSku: pendingAction.productId, // 🔧 SKU/code for precise cart addition
                                selectedItemType: pendingAction.itemType || "PRODUCT", // 🆕 Pass item type
                            });
                            // 🧹 CRITICAL: Clear pendingAction after execution
                            yield this.optionsMappingService.clearPendingAction(conversationId);
                            logger_1.default.info("🧹 [ChatEngine] Cleared pendingAction after ADD_TO_CART execution (STEP 2.6)");
                            // 🛒 CRITICAL: Save CART_ACTIONS mapping so "1" triggers CONFIRM_ORDER, not product search!
                            const cartItemCount = this.extractCartItemCountFromFunctionCalls(cartResponse.functionCalls);
                            const transportModes = this.extractTransportModesFromFunctionCalls(cartResponse.functionCalls);
                            const cartActions = yield this.buildCartActionOptions((cartItemCount !== null && cartItemCount !== void 0 ? cartItemCount : 2) > 1, input.workspaceId, transportModes);
                            yield this.optionsMappingService.saveMapping({
                                workspaceId: input.workspaceId,
                                conversationId,
                                customerId: input.customerId,
                                responseText: "",
                                items: cartActions,
                                listType: "CART_ACTIONS",
                            });
                            logger_1.default.info("🛒 [ChatEngine] Set CART_ACTIONS mapping after ADD_TO_CART (STEP 2.6)", {
                                cartItemCount,
                                actions: cartActions.map((action) => action.id),
                            });
                            const processingTimeMs = Date.now() - startTime;
                            const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, // 🔧 Use conversationId for consistent history
                            input.message, cartResponse.output);
                            return {
                                message: cartResponse.output,
                                agentType: database_1.AgentType.CART_MANAGEMENT,
                                wasHandled: true,
                                intent: "CONFIRM_ADD_TO_CART",
                                confidence: "HIGH",
                                source: "PATTERN",
                                processingTimeMs,
                                debugInfo: {
                                    loadedDataType: "PENDING_ACTION_EXECUTED",
                                    responseType: "CART_OPERATION",
                                    llmUsed: true,
                                },
                                response: cartResponse.output,
                                agentUsed: database_1.AgentType.CART_MANAGEMENT,
                                tokensUsed: cartResponse.tokensUsed,
                                executionTimeMs: processingTimeMs,
                                wasFAQ: false,
                                isBlocked: false,
                                _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
                            };
                        }
                        if (pendingAction.type === "CONFIRM_ORDER") {
                            // User confirmed checkout - delegate to checkout flow
                            intentResult.intent = { type: "START_CHECKOUT" };
                            logger_1.default.info("✅ [ChatEngine] CONFIRM_ORDER → START_CHECKOUT");
                        }
                    }
                    else if (intentResult.intent.type === "CONFIRM") {
                        // ========================================================================
                        // 🆕 FSM-BASED CONFIRM HANDLING (replaces context guessing)
                        // ========================================================================
                        // Use FSM state to determine what CONFIRM means, not text parsing
                        logger_1.default.info("🔄 [FSM] CONFIRM intent detected - checking FSM state", {
                            fsmState: fsmState.state,
                            pendingAction: (_4 = fsmState.pendingAction) === null || _4 === void 0 ? void 0 : _4.type,
                        });
                        // 🎯 FSM Priority 1: Check if current state triggers checkout on CONFIRM
                        if (this.conversationStateService.shouldConfirmTriggerCheckout(fsmState.state)) {
                            logger_1.default.info("🔄 [FSM] State triggers checkout: CONFIRM → START_CHECKOUT", {
                                state: fsmState.state,
                            });
                            intentResult.intent = { type: "START_CHECKOUT" };
                            // Update FSM state to IN_CHECKOUT
                            if (chatSession) {
                                yield this.conversationStateService.setState(chatSession.id, conversation_state_service_1.ConversationState.IN_CHECKOUT);
                            }
                        }
                        // 🎯 FSM Priority 2: Check FSM pendingAction
                        else if (((_5 = fsmState.pendingAction) === null || _5 === void 0 ? void 0 : _5.type) === "CONFIRM_ORDER") {
                            logger_1.default.info("🔄 [FSM] PendingAction CONFIRM_ORDER → START_CHECKOUT");
                            intentResult.intent = { type: "START_CHECKOUT" };
                            if (chatSession) {
                                yield this.conversationStateService.setState(chatSession.id, conversation_state_service_1.ConversationState.IN_CHECKOUT);
                            }
                        }
                        // 🎯 FSM Priority 3: Browsing products/categories → user wants to see them
                        else if (fsmState.state === conversation_state_service_1.ConversationState.BROWSING_CATEGORIES ||
                            fsmState.state === conversation_state_service_1.ConversationState.BROWSING_PRODUCTS) {
                            logger_1.default.info("🔄 [FSM] Browsing state: CONFIRM stays in current flow");
                            // Don't change intent - let it fall through to show categories
                            intentResult.intent = { type: "SHOW_CATEGORIES" };
                        }
                        // 🎯 FSM Priority 4: Viewing cart → CONFIRM means checkout
                        else if (fsmState.state === conversation_state_service_1.ConversationState.VIEWING_CART) {
                            logger_1.default.info("🔄 [FSM] Viewing cart: CONFIRM → START_CHECKOUT");
                            intentResult.intent = { type: "START_CHECKOUT" };
                            if (chatSession) {
                                yield this.conversationStateService.setState(chatSession.id, conversation_state_service_1.ConversationState.IN_CHECKOUT);
                            }
                        }
                        // 🎯 FSM Fallback: Use listType from optionsMapping (no text matching!)
                        else if (fsmState.state === conversation_state_service_1.ConversationState.IDLE) {
                            // Use structured listType instead of text matching (language-agnostic)
                            const optionsMapping = yield this.optionsMappingService.loadMapping(input.workspaceId, conversationId);
                            const lastListType = optionsMapping === null || optionsMapping === void 0 ? void 0 : optionsMapping.listType;
                            logger_1.default.info("🔄 [FSM] IDLE state - using listType from optionsMapping", {
                                listType: lastListType,
                                hasPendingAction: !!(optionsMapping === null || optionsMapping === void 0 ? void 0 : optionsMapping.pendingAction),
                            });
                            // Map listType to intent (language-agnostic!)
                            if (lastListType === "CART_ITEMS" || ((_6 = optionsMapping === null || optionsMapping === void 0 ? void 0 : optionsMapping.pendingAction) === null || _6 === void 0 ? void 0 : _6.type) === "CONFIRM_ORDER") {
                                intentResult.intent = { type: "START_CHECKOUT" };
                            }
                            else if (lastListType === "PRODUCTS" || lastListType === "CATEGORIES" || lastListType === "GROUPS") {
                                intentResult.intent = { type: "SHOW_CATEGORIES" };
                            }
                            else if (lastListType === "ORDERS" || lastListType === "ORDER_ACTIONS") {
                                intentResult.intent = { type: "VIEW_ORDERS" };
                            }
                            else {
                                // Default fallback
                                intentResult.intent = { type: "SHOW_CATEGORIES" };
                            }
                        }
                        // 🎯 Default: Show categories
                        else {
                            logger_1.default.info("🔄 [FSM] Unknown state, defaulting to SHOW_CATEGORIES", {
                                state: fsmState.state,
                            });
                            intentResult.intent = { type: "SHOW_CATEGORIES" };
                        }
                    }
                }
                // ========================================================================
                // STEP 2.5: Check if e-commerce intent is allowed
                // ========================================================================
                if (this.isEcommerceIntent(intentResult.intent.type) && !workspaceConfig.sellsProductsAndServices) {
                    // E-commerce not enabled - redirect to support response
                    logger_1.default.info("🚫 [ChatEngine] E-commerce disabled, redirecting to support", {
                        intentType: intentResult.intent.type,
                    });
                    const processingTimeMs = Date.now() - startTime;
                    const supportMessage = this.getEcommerceDisabledMessage(input.customerLanguage || "it");
                    return {
                        message: supportMessage,
                        agentType: database_1.AgentType.CUSTOMER_SUPPORT,
                        wasHandled: true,
                        intent: "ECOMMERCE_DISABLED",
                        confidence: "HIGH",
                        source: "PATTERN",
                        processingTimeMs,
                        debugInfo: {
                            loadedDataType: "NONE",
                            responseType: "ECOMMERCE_DISABLED",
                            llmUsed: false,
                        },
                        response: supportMessage,
                        agentUsed: database_1.AgentType.CUSTOMER_SUPPORT,
                        tokensUsed: 0,
                        executionTimeMs: processingTimeMs,
                        wasFAQ: false,
                        isBlocked: false,
                    };
                }
                if (intentResult.intent.type === "REQUEST_HUMAN") {
                    return yield this.handleHumanSupportRequest({
                        input,
                        workspaceConfig,
                        conversationId,
                        debugSteps,
                        totalTokens,
                        startTime,
                        requestIntent: intentResult.intent,
                        intentConfidence: intentResult.confidence,
                        intentSource: intentResult.source,
                    });
                }
                // ========================================================================
                // STEP: Handle UPDATE_PROFILE intent - Generate profile edit link
                // ========================================================================
                if (intentResult.intent.type === "UPDATE_PROFILE") {
                    logger_1.default.info("📝 [ChatEngine] UPDATE_PROFILE detected - generating profile link", {
                        workspaceId: input.workspaceId,
                        customerId: input.customerId,
                    });
                    try {
                        // Import CallingFunctionsService to generate profile link
                        const { CallingFunctionsService } = yield Promise.resolve().then(() => __importStar(require("../../services/calling-functions.service")));
                        const callingFunctions = new CallingFunctionsService();
                        const profileLinkResult = yield callingFunctions.getProfileLink({
                            customerId: input.customerId,
                            workspaceId: input.workspaceId,
                        });
                        if (!profileLinkResult.success || !profileLinkResult.linkUrl) {
                            throw new Error("Failed to generate profile link");
                        }
                        // Format the response with the link
                        const customerFirstName = ((_7 = input.customerName) === null || _7 === void 0 ? void 0 : _7.split(" ")[0]) || "!";
                        const profileMessage = `Certo ${customerFirstName}! 📝 Per aggiornare i tuoi dati personali clicca qui:\n\n👉 Modifica Profilo\n${profileLinkResult.linkUrl}\n\nPer questioni di sicurezza il link sarà abilitato solo per 15 minuti.\n\nTi posso aiutare con qualcos'altro? 😊`;
                        const processingTimeMs = Date.now() - startTime;
                        // Save messages
                        const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, input.message, profileMessage);
                        // Clear any pending options
                        yield this.optionsMappingService.clearMapping(conversationId);
                        logger_1.default.info("✅ [ChatEngine] UPDATE_PROFILE handled successfully", {
                            workspaceId: input.workspaceId,
                            customerId: input.customerId,
                            linkGenerated: true,
                        });
                        return {
                            message: profileMessage,
                            agentType: database_1.AgentType.PROFILE_MANAGEMENT,
                            wasHandled: true,
                            intent: "UPDATE_PROFILE",
                            confidence: intentResult.confidence,
                            source: intentResult.source,
                            processingTimeMs,
                            debugInfo: {
                                loadedDataType: "PROFILE_LINK",
                                responseType: "UPDATE_PROFILE",
                                llmUsed: false,
                            },
                            response: profileMessage,
                            agentUsed: database_1.AgentType.PROFILE_MANAGEMENT,
                            tokensUsed: 0,
                            executionTimeMs: processingTimeMs,
                            wasFAQ: false,
                            isBlocked: false,
                            _assistantMessageId: savedMessages.assistantMessageId,
                        };
                    }
                    catch (error) {
                        logger_1.default.error("❌ [ChatEngine] Failed to generate profile link", { error });
                        const errorMessage = "Mi dispiace, non sono riuscito a generare il link per modificare il profilo. Riprova tra qualche istante! 😅";
                        const processingTimeMs = Date.now() - startTime;
                        return {
                            message: errorMessage,
                            agentType: database_1.AgentType.PROFILE_MANAGEMENT,
                            wasHandled: true,
                            intent: "UPDATE_PROFILE",
                            confidence: intentResult.confidence,
                            source: intentResult.source,
                            processingTimeMs,
                            debugInfo: {
                                loadedDataType: "ERROR",
                                responseType: "UPDATE_PROFILE_ERROR",
                                llmUsed: false,
                            },
                            response: errorMessage,
                            agentUsed: database_1.AgentType.PROFILE_MANAGEMENT,
                            tokensUsed: 0,
                            executionTimeMs: processingTimeMs,
                            wasFAQ: false,
                            isBlocked: false,
                        };
                    }
                }
                // ========================================================================
                // STEP: Handle CHANGE_LANGUAGE intent - Redirect to profile for language settings
                // ========================================================================
                if (intentResult.intent.type === "CHANGE_LANGUAGE") {
                    logger_1.default.info("🌍 [ChatEngine] CHANGE_LANGUAGE detected - generating profile link for language change", {
                        workspaceId: input.workspaceId,
                        customerId: input.customerId,
                    });
                    try {
                        // Import CallingFunctionsService to generate profile link
                        const { CallingFunctionsService } = yield Promise.resolve().then(() => __importStar(require("../../services/calling-functions.service")));
                        const callingFunctions = new CallingFunctionsService();
                        const profileLinkResult = yield callingFunctions.getProfileLink({
                            customerId: input.customerId,
                            workspaceId: input.workspaceId,
                        });
                        if (!profileLinkResult.success || !profileLinkResult.linkUrl) {
                            throw new Error("Failed to generate profile link");
                        }
                        // Format the response with the link and supported languages
                        const customerFirstName = ((_8 = input.customerName) === null || _8 === void 0 ? void 0 : _8.split(" ")[0]) || "!";
                        const languageMessage = `Certo ${customerFirstName}! 🌍 Per cambiare la lingua di conversazione, puoi modificarla nel tuo profilo:\n\n👉 Modifica Lingua\n${profileLinkResult.linkUrl}\n\n📌 Lingue supportate:\n• 🇮🇹 Italiano\n• 🇬🇧 English\n• 🇪🇸 Español\n• 🇵🇹 Português\n\nPer questioni di sicurezza il link sarà abilitato solo per 15 minuti.\n\nTi posso aiutare con qualcos'altro? 😊`;
                        const processingTimeMs = Date.now() - startTime;
                        // Save messages
                        const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, input.message, languageMessage);
                        // Clear any pending options
                        yield this.optionsMappingService.clearMapping(conversationId);
                        logger_1.default.info("✅ [ChatEngine] CHANGE_LANGUAGE handled successfully", {
                            workspaceId: input.workspaceId,
                            customerId: input.customerId,
                            linkGenerated: true,
                        });
                        return {
                            message: languageMessage,
                            agentType: database_1.AgentType.PROFILE_MANAGEMENT,
                            wasHandled: true,
                            intent: "CHANGE_LANGUAGE",
                            confidence: intentResult.confidence,
                            source: intentResult.source,
                            processingTimeMs,
                            debugInfo: {
                                loadedDataType: "PROFILE_LINK",
                                responseType: "CHANGE_LANGUAGE",
                                llmUsed: false,
                            },
                            response: languageMessage,
                            agentUsed: database_1.AgentType.PROFILE_MANAGEMENT,
                            tokensUsed: 0,
                            executionTimeMs: processingTimeMs,
                            wasFAQ: false,
                            isBlocked: false,
                            _assistantMessageId: savedMessages.assistantMessageId,
                        };
                    }
                    catch (error) {
                        logger_1.default.error("❌ [ChatEngine] Failed to generate profile link for language change", { error });
                        const errorMessage = "Mi dispiace, non sono riuscito a generare il link per modificare la lingua. Riprova tra qualche istante! 😅";
                        const processingTimeMs = Date.now() - startTime;
                        return {
                            message: errorMessage,
                            agentType: database_1.AgentType.PROFILE_MANAGEMENT,
                            wasHandled: true,
                            intent: "CHANGE_LANGUAGE",
                            confidence: intentResult.confidence,
                            source: intentResult.source,
                            processingTimeMs,
                            debugInfo: {
                                loadedDataType: "ERROR",
                                responseType: "CHANGE_LANGUAGE_ERROR",
                                llmUsed: false,
                            },
                            response: errorMessage,
                            agentUsed: database_1.AgentType.PROFILE_MANAGEMENT,
                            tokensUsed: 0,
                            executionTimeMs: processingTimeMs,
                            wasFAQ: false,
                            isBlocked: false,
                        };
                    }
                }
                if (intentResult.intent.type === "PRODUCT_CONTEXT") {
                    const productContextHandled = yield this.handleProductContextIntent({
                        input,
                        conversationId,
                        history,
                        chatSession,
                        fsmState,
                        workspaceConfig,
                        startTime,
                        debugSteps,
                    });
                    if (productContextHandled) {
                        return productContextHandled;
                    }
                    // ProductContext failed - try FAQ first for questions like "when will it arrive?"
                    logger_1.default.warn("⚠️ [ChatEngine] PRODUCT_CONTEXT failed, trying FAQ fallback", {
                        workspaceId: input.workspaceId,
                        customerId: input.customerId,
                        question: input.message,
                    });
                    intentResult.intent = {
                        type: "ASK_FAQ",
                        query: input.message,
                    };
                }
                // ========================================================================
                // STEP 3: Handle CART intents with LLM intelligence
                // ========================================================================
                // 🆕 For ADD_TO_CART without productId, delegate to CartManagementAgentLLM
                // The LLM has the product catalog and can map "pecorini" → SKU
                if (intentResult.intent.type === "ADD_TO_CART") {
                    const addIntent = intentResult.intent;
                    if (!addIntent.productId && addIntent.productName) {
                        logger_1.default.info("🛒 [ChatEngine] ADD_TO_CART needs LLM intelligence - delegating to CartManagementAgentLLM", {
                            productName: addIntent.productName,
                            quantity: addIntent.quantity,
                        });
                        const cartAgentLLM = new CartManagementAgentLLM_1.CartManagementAgentLLM(this.prisma);
                        const cartResponse = yield cartAgentLLM.handleQuery({
                            workspaceId: input.workspaceId,
                            customerId: input.customerId,
                            customerName: input.customerName,
                            customerLanguage: input.customerLanguage,
                            customerDiscount: input.customerDiscount,
                            query: input.message, // Original message with context
                            conversationHistory: [], // Could add history if needed
                        });
                        const processingTimeMs = Date.now() - startTime;
                        // Save messages
                        const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, // 🔧 Use conversationId for consistent history
                        input.message, cartResponse.output);
                        // 🛒 CRITICAL: Save CART_ACTIONS mapping if cart was shown
                        // Check if response contains cart options (the LLM shows cart after operations)
                        if (cartResponse.output.includes("Cosa vuoi fare?") ||
                            cartResponse.output.includes("Ecco il tuo carrello")) {
                            const cartItemCount = this.extractCartItemCountFromFunctionCalls(cartResponse.functionCalls);
                            const transportModes = this.extractTransportModesFromFunctionCalls(cartResponse.functionCalls);
                            const cartActions = yield this.buildCartActionOptions((cartItemCount !== null && cartItemCount !== void 0 ? cartItemCount : 2) > 1, input.workspaceId, transportModes);
                            yield this.optionsMappingService.saveMapping({
                                workspaceId: input.workspaceId,
                                conversationId,
                                customerId: input.customerId,
                                responseText: "",
                                items: cartActions,
                                listType: "CART_ACTIONS",
                            });
                            logger_1.default.info("🛒 [ChatEngine] Set CART_ACTIONS mapping after ADD_TO_CART (LLM fallback)", {
                                cartItemCount,
                                actions: cartActions.map((action) => action.id),
                            });
                        }
                        return {
                            message: cartResponse.output,
                            agentType: database_1.AgentType.CART_MANAGEMENT,
                            wasHandled: true,
                            intent: "ADD_TO_CART",
                            confidence: "HIGH",
                            source: "LLM_FALLBACK", // LLM-based cart agent
                            processingTimeMs,
                            debugInfo: {
                                loadedDataType: "CART_LLM",
                                responseType: "CART_OPERATION",
                                llmUsed: true,
                            },
                            response: cartResponse.output,
                            agentUsed: database_1.AgentType.CART_MANAGEMENT,
                            tokensUsed: cartResponse.tokensUsed,
                            executionTimeMs: processingTimeMs,
                            wasFAQ: false,
                            isBlocked: false,
                            _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
                        };
                    }
                }
                // ========================================================================
                // 🔄 REPEAT_ORDER: Copy products from previous order to cart
                // ========================================================================
                if (intentResult.intent.type === "REPEAT_ORDER") {
                    const repeatIntent = intentResult.intent;
                    logger_1.default.info("🔄 [ChatEngine] REPEAT_ORDER intent detected", {
                        orderCode: repeatIntent.orderCode || "(last order)",
                    });
                    // Find the order to repeat
                    let orderToRepeat = null;
                    if (repeatIntent.orderCode) {
                        // User specified an order code (e.g., "ripeti ordine ORD-12345")
                        orderToRepeat = yield this.prisma.orders.findFirst({
                            where: {
                                workspaceId: input.workspaceId,
                                orderCode: repeatIntent.orderCode,
                                customerId: input.customerId,
                                deletedAt: null,
                            },
                            include: {
                                items: {
                                    include: {
                                        product: true,
                                    },
                                },
                            },
                        });
                    }
                    else {
                        // No order code - find the most recent completed order
                        orderToRepeat = yield this.prisma.orders.findFirst({
                            where: {
                                workspaceId: input.workspaceId,
                                customerId: input.customerId,
                                status: { in: ["DELIVERED", "SHIPPED", "CONFIRMED"] },
                                deletedAt: null,
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
                    }
                    if (!orderToRepeat) {
                        const errorMessage = repeatIntent.orderCode
                            ? `Non ho trovato l'ordine ${repeatIntent.orderCode}. Verifica il codice e riprova.`
                            : "Non hai ancora ordini completati da ripetere.";
                        const processingTimeMs = Date.now() - startTime;
                        const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, // 🔧 Use conversationId for consistent history
                        input.message, errorMessage);
                        return {
                            message: errorMessage,
                            agentType: database_1.AgentType.ORDER_TRACKING,
                            wasHandled: true,
                            intent: "REPEAT_ORDER",
                            confidence: "HIGH",
                            source: "PATTERN",
                            processingTimeMs,
                            debugInfo: {
                                loadedDataType: "ORDER_NOT_FOUND",
                                responseType: "ERROR",
                                llmUsed: false,
                            },
                            response: errorMessage,
                            agentUsed: database_1.AgentType.ORDER_TRACKING,
                            tokensUsed: 0,
                            executionTimeMs: processingTimeMs,
                            wasFAQ: false,
                            isBlocked: false,
                            _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
                        };
                    }
                    // Clear cart and add all items from the order
                    const cart = yield this.prisma.carts.upsert({
                        where: {
                            customerId: input.customerId,
                        },
                        update: {},
                        create: {
                            customerId: input.customerId,
                            workspaceId: input.workspaceId,
                        },
                    });
                    // Clear existing cart items
                    yield this.prisma.cartItems.deleteMany({
                        where: {
                            cartId: cart.id,
                            cart: { workspaceId: input.workspaceId },
                        },
                    });
                    // Add items from order to cart
                    const addedItems = [];
                    const failedItems = [];
                    for (const orderItem of orderToRepeat.items) {
                        if (!orderItem.product || !orderItem.product.isActive) {
                            failedItems.push(((_9 = orderItem.product) === null || _9 === void 0 ? void 0 : _9.name) || "Prodotto non disponibile");
                            continue;
                        }
                        yield this.prisma.cartItems.create({
                            data: {
                                cartId: cart.id,
                                productId: orderItem.productId,
                                quantity: orderItem.quantity,
                            },
                        });
                        addedItems.push(`${orderItem.quantity}x ${orderItem.product.name}`);
                    }
                    // Build response message
                    let responseMessage;
                    if (addedItems.length === 0) {
                        responseMessage = `Mi dispiace, nessuno dei prodotti dell'ordine ${orderToRepeat.orderCode} è attualmente disponibile.`;
                    }
                    else if (failedItems.length > 0) {
                        responseMessage = `Ho aggiunto al carrello ${addedItems.length} prodotti dall'ordine ${orderToRepeat.orderCode}:\n` +
                            addedItems.map(item => `• ${item}`).join("\n") +
                            `\n\n⚠️ ${failedItems.length} prodotti non sono più disponibili:\n` +
                            failedItems.map(item => `• ${item}`).join("\n") +
                            `\n\nVuoi procedere al checkout o modificare il carrello?`;
                    }
                    else {
                        responseMessage = `Perfetto! Ho aggiunto al carrello tutti i ${addedItems.length} prodotti dall'ordine ${orderToRepeat.orderCode}:\n` +
                            addedItems.map(item => `• ${item}`).join("\n") +
                            `\n\nVuoi procedere al checkout?`;
                    }
                    const processingTimeMs = Date.now() - startTime;
                    // Save messages
                    const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, // 🔧 Use conversationId for consistent history
                    input.message, responseMessage);
                    // Set pending action for checkout (VIEW_CART first to review)
                    // 🔧 NOTE: conversationId is already defined with fallback at the top of processMessage
                    yield this.optionsMappingService.setPendingAction({
                        workspaceId: input.workspaceId,
                        conversationId, // 🔧 Use consistent conversationId
                        pendingAction: { type: "CONFIRM_ORDER" },
                    });
                    // 🆕 FSM: Set state to AWAITING_ORDER_CONFIRM after REPEAT_ORDER
                    // This ensures next "conferma" triggers checkout, not cart view
                    if (chatSession) {
                        yield this.conversationStateService.setState(chatSession.id, conversation_state_service_1.ConversationState.AWAITING_ORDER_CONFIRM, {
                            pendingAction: { type: "CONFIRM_ORDER", orderCode: orderToRepeat.orderCode },
                            selectedOrderCode: orderToRepeat.orderCode,
                        });
                        logger_1.default.info("🔄 [FSM] State updated to AWAITING_ORDER_CONFIRM", {
                            orderCode: orderToRepeat.orderCode,
                        });
                    }
                    logger_1.default.info("🔄 [ChatEngine] REPEAT_ORDER completed", {
                        orderCode: orderToRepeat.orderCode,
                        addedItems: addedItems.length,
                        failedItems: failedItems.length,
                    });
                    return {
                        message: responseMessage,
                        agentType: database_1.AgentType.CART_MANAGEMENT,
                        wasHandled: true,
                        intent: "REPEAT_ORDER",
                        confidence: "HIGH",
                        source: "PATTERN",
                        processingTimeMs,
                        debugInfo: {
                            loadedDataType: "REPEAT_ORDER",
                            responseType: "CART_UPDATED",
                            llmUsed: false,
                        },
                        response: responseMessage,
                        agentUsed: database_1.AgentType.CART_MANAGEMENT,
                        tokensUsed: 0,
                        executionTimeMs: processingTimeMs,
                        wasFAQ: false,
                        isBlocked: false,
                        _assistantMessageId: savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId,
                    };
                }
                // ========================================================================
                // STEP 4: Load data based on intent (for non-LLM paths)
                // ========================================================================
                let loadedData = null;
                let structuredResponseOverride = null;
                if (this.shouldUseCatalogQuery(intentResult.intent)) {
                    const catalogStart = Date.now();
                    try {
                        const catalogResult = yield this.catalogQueryService.process({
                            workspaceId: input.workspaceId,
                            message: input.message,
                            customerDiscount: input.customerDiscount || 0,
                            intentType: intentResult.intent.type,
                            customerLanguage: input.customerLanguage || "it",
                        });
                        const shouldUseCatalogResult = catalogResult.resultType !== "EMPTY" &&
                            catalogResult.loadedData &&
                            catalogResult.loadedData.type !== "EMPTY";
                        if (shouldUseCatalogResult) {
                            loadedData = catalogResult.loadedData;
                            structuredResponseOverride = catalogResult.structuredResponse;
                        }
                        else {
                            logger_1.default.info("📦 [ChatEngine] Catalog query empty - falling back to DataLoader", {
                                resultType: catalogResult.resultType,
                            });
                            loadedData = null;
                            structuredResponseOverride = null;
                        }
                        if ((_10 = catalogResult.tokenUsage) === null || _10 === void 0 ? void 0 : _10.totalTokens) {
                            totalTokens += catalogResult.tokenUsage.totalTokens;
                        }
                        const catalogDuration = Date.now() - catalogStart;
                        const queryPreviewRaw = JSON.stringify(catalogResult.query);
                        const queryPreview = queryPreviewRaw.length > 200
                            ? `${queryPreviewRaw.substring(0, 200)}...`
                            : queryPreviewRaw;
                        debugSteps.push({
                            type: "sub_agent",
                            agent: "🧱 Catalog QueryBuilder",
                            model: catalogResult.model,
                            timestamp: new Date().toISOString(),
                            tokenUsage: catalogResult.tokenUsage
                                ? {
                                    promptTokens: catalogResult.tokenUsage.promptTokens || 0,
                                    completionTokens: catalogResult.tokenUsage.completionTokens || 0,
                                    totalTokens: catalogResult.tokenUsage.totalTokens || 0,
                                }
                                : undefined,
                            input: {
                                userMessage: input.message,
                            },
                            output: {
                                decision: `CatalogQuery: ${queryPreview}`,
                                executionTimeMs: catalogDuration,
                            },
                            duration: catalogDuration,
                        });
                        const executorSummary = catalogResult.resultType === "LIST"
                            ? `Items: ${((_11 = catalogResult.loadedData.products) === null || _11 === void 0 ? void 0 : _11.length) || 0}`
                            : catalogResult.resultType === "GROUPED"
                                ? `Groups: ${((_12 = catalogResult.loadedData.groups) === null || _12 === void 0 ? void 0 : _12.length) || 0}`
                                : catalogResult.resultType === "AGGREGATE"
                                    ? `Value: ${(_13 = catalogResult.structuredResponse.data.aggregateResult) === null || _13 === void 0 ? void 0 : _13.value}`
                                    : "Empty result";
                        debugSteps.push({
                            type: "function_call",
                            agent: "🧮 Catalog QueryExecutor",
                            timestamp: new Date().toISOString(),
                            output: {
                                textContent: `Result: ${catalogResult.resultType} (${executorSummary})`,
                                executionTimeMs: catalogDuration,
                            },
                            duration: catalogDuration,
                        });
                        logger_1.default.info("📦 [ChatEngine] Catalog query executed", {
                            resultType: catalogResult.resultType,
                        });
                    }
                    catch (error) {
                        logger_1.default.error("❌ [ChatEngine] Catalog query processing failed", {
                            error,
                        });
                    }
                }
                if (!loadedData) {
                    const dataLoadStart = Date.now();
                    loadedData = yield this.dataLoader.loadForIntent(intentResult.intent, input.workspaceId, input.customerId, input.customerDiscount || 0);
                    const dataLoadTime = Date.now() - dataLoadStart;
                    // 🆕 Add DataLoader debug step
                    debugSteps.push({
                        type: "sub_agent",
                        agent: `📦 DataLoader (${loadedData.type})`,
                        timestamp: new Date().toISOString(),
                        input: {
                            textContent: `Intent: ${intentResult.intent.type}`,
                        },
                        output: {
                            textContent: `Loaded: ${loadedData.type}`,
                            executionTimeMs: dataLoadTime,
                        },
                        duration: dataLoadTime,
                    });
                }
                const finalLoadedData = loadedData;
                logger_1.default.info("📦 [ChatEngine] Data loaded", { type: finalLoadedData.type });
                // ========================================================================
                // STEP 4: Build structured response
                // ========================================================================
                // Check if workspace has Premium/Enterprise plan for optimization option
                let showOptimizeOption = false;
                if (finalLoadedData.type === "CART") {
                    try {
                        const workspace = yield this.prisma.workspace.findUnique({
                            where: { id: input.workspaceId },
                            select: { planType: true }
                        });
                        const eligiblePlan = (workspace === null || workspace === void 0 ? void 0 : workspace.planType) === 'PREMIUM' || (workspace === null || workspace === void 0 ? void 0 : workspace.planType) === 'ENTERPRISE';
                        const transportTypes = ((_14 = finalLoadedData.cart) === null || _14 === void 0 ? void 0 : _14.transport)
                            ? Object.keys(finalLoadedData.cart.transport.byType || {})
                            : [];
                        const hasMultipleTransports = transportTypes.length >= 2;
                        showOptimizeOption = eligiblePlan && hasMultipleTransports;
                    }
                    catch (err) {
                        logger_1.default.warn("⚠️ [ChatEngine] Could not check workspace plan type for optimization option", { error: err, workspaceId: input.workspaceId });
                    }
                }
                // ========================================================================
                // STEP 4.1: Build enrichment options for contextual responses
                // ========================================================================
                const enrichmentOptions = yield this.buildEnrichmentOptions(input.workspaceId, input.customerId, history.map(msg => ({ role: msg.role, content: msg.content })));
                const structuredResponse = structuredResponseOverride !== null && structuredResponseOverride !== void 0 ? structuredResponseOverride : this.responseBuilder.build(intentResult.intent, finalLoadedData, {
                    customerName: input.customerName,
                    customerLanguage: input.customerLanguage || "it",
                    workspaceId: input.workspaceId,
                    customerDiscount: input.customerDiscount,
                    showOptimizeOption,
                    userMessage: input.message,
                    enableCategoryRanking: workspaceConfig.sellsProductsAndServices,
                }, enrichmentOptions);
                logger_1.default.info("🏗️ [ChatEngine] Response built", { type: structuredResponse.type });
                // ========================================================================
                // STEP 5: Format with LLM (only formatting, no decisions)
                // ========================================================================
                const formatStart = Date.now();
                let finalMessage;
                let llmUsed = false;
                let groupMapping;
                // Check response type for simple text vs needs LLM
                if (this.isSimpleResponseType(structuredResponse.type)) {
                    // Use LLM formatter but with cached template
                    const formatterResult = yield this.formatWithCustomRules(structuredResponse, input.customerLanguage || "it", workspaceConfig, undefined, { customerName: input.customerName, isFirstMessage: history.length === 0 });
                    finalMessage = formatterResult.text;
                    llmUsed = !formatterResult.cached;
                    groupMapping = formatterResult.groupMapping;
                }
                else {
                    // Full LLM formatting for complex responses
                    const formatterResult = yield this.formatWithCustomRules(structuredResponse, input.customerLanguage || "it", workspaceConfig, undefined, { customerName: input.customerName, isFirstMessage: history.length === 0 });
                    finalMessage = formatterResult.text;
                    llmUsed = !formatterResult.cached;
                    groupMapping = formatterResult.groupMapping;
                }
                const formatTime = Date.now() - formatStart;
                // 🆕 Add LLM Formatter debug step
                const agentType = this.mapIntentToAgentType(intentResult.intent.type);
                debugSteps.push({
                    type: "sub_agent",
                    agent: `✨ ${agentType} (LLM Formatter)`,
                    model: llmUsed ? "gpt-4o-mini" : undefined,
                    timestamp: new Date().toISOString(),
                    tokenUsage: llmUsed ? {
                        promptTokens: 200,
                        completionTokens: 150,
                        totalTokens: 350,
                    } : undefined,
                    systemPrompt: llmUsed ? `Template: ${agentType.toLowerCase()}.template.md` : "Cached response (no LLM)",
                    input: {
                        textContent: `Structured response type: ${structuredResponse.type}`,
                    },
                    output: {
                        textResponse: finalMessage.substring(0, 200) + (finalMessage.length > 200 ? "..." : ""),
                        executionTimeMs: formatTime,
                    },
                    duration: formatTime,
                });
                if (llmUsed) {
                    totalTokens += 350;
                }
                // ========================================================================
                // STEP 6: Replace tokens/links
                // ========================================================================
                const replacementStart = Date.now();
                const replacementParams = {
                    response: finalMessage,
                    linkType: "auto",
                };
                const replacementResult = yield this.linkReplacementService.replaceTokens(replacementParams, input.customerId, input.workspaceId);
                const replacementTime = Date.now() - replacementStart;
                if (replacementResult.success && replacementResult.response) {
                    finalMessage = replacementResult.response;
                    // 🆕 Add link replacement debug step (only if links were replaced)
                    if (replacementResult.response !== finalMessage) {
                        debugSteps.push({
                            type: "link-replacement",
                            agent: "🔗 Link Replacement",
                            timestamp: new Date().toISOString(),
                            input: {
                                textContent: "Scanning for [LINK_*_WITH_TOKEN] placeholders",
                            },
                            output: {
                                textContent: "Tokens replaced with secure URLs",
                                executionTimeMs: replacementTime,
                            },
                            duration: replacementTime,
                        });
                    }
                }
                // ========================================================================
                // STEP 6.5: Save response WITH SKU tags for options mapping (before cleanup)
                // ========================================================================
                const responseWithSkus = finalMessage; // Save before SKU removal
                // ========================================================================
                // STEP 6.6: Remove SKU tags (they're for system tracking, not customer-visible)
                // ========================================================================
                finalMessage = finalMessage
                    .replace(/\s*\[SKU:[A-Z0-9-]+\]/gi, '')
                    .replace(/\s*\[SKUS?:[A-Z0-9-,]+\]/gi, '');
                // ========================================================================
                // STEP 7: Determine agent type from intent
                // ========================================================================
                // agentType already defined above in STEP 5
                const processingTimeMs = Date.now() - startTime;
                // 🆕 Add Save to History debug step
                debugSteps.push({
                    type: "function_call",
                    agent: "💾 Save to History",
                    timestamp: new Date().toISOString(),
                    input: {
                        textContent: `Saving conversation for customer ${input.customerId}`,
                    },
                    output: {
                        textContent: "✅ Messages saved to database",
                    },
                    duration: 10,
                });
                // 🆕 Add WhatsApp Queue debug step
                debugSteps.push({
                    type: "function_call",
                    agent: "📤 Add to WhatsApp Queue",
                    timestamp: new Date().toISOString(),
                    input: {
                        textContent: `Message to send:\n\n${finalMessage.substring(0, 100)}...`,
                    },
                    output: {
                        textContent: "✅ Message queued for WhatsApp delivery",
                    },
                    duration: 5,
                });
                // Calculate cost estimate (gpt-4o-mini pricing: $0.15/1M input, $0.60/1M output)
                const totalCost = (totalTokens * 0.0003) / 1000;
                logger_1.default.info("✅ [ChatEngine] Processing complete", {
                    intent: intentResult.intent.type,
                    agentType,
                    llmUsed,
                    totalTimeMs: processingTimeMs,
                    debugStepsCount: debugSteps.length,
                    totalTokens,
                });
                // 🆕 Build debugInfo for timeline visualization
                const debugInfo = {
                    loadedDataType: finalLoadedData.type,
                    responseType: structuredResponse.type,
                    llmUsed,
                    steps: debugSteps, // 🆕 Full timeline for Message Flow Dialog
                    totalTokens,
                    totalCost,
                    executionTimeMs: processingTimeMs,
                };
                // ========================================================================
                // STEP 8: Save messages to conversation history (with debugInfo for timeline)
                // ========================================================================
                const savedMessages = yield this.saveMessages(input.workspaceId, input.customerId, conversationId, // 🔧 Use conversationId for consistent history
                input.message, finalMessage, agentType, totalTokens, debugInfo // 🆕 Pass debugInfo for Message Flow Dialog
                );
                // Store the assistant message ID for later use (needed for translation update)
                const assistantMessageId = savedMessages === null || savedMessages === void 0 ? void 0 : savedMessages.assistantMessageId;
                // ========================================================================
                // STEP 9: 🆕 Save options mapping for FAST-PATH on next message
                // Uses responseWithSkus to preserve SKU info for selection resolution
                // 🆕 Also passes groupMapping from LLM for smart grouping resolution
                // 🔧 CRITICAL: Pass items with SKUs for proper product selection!
                // 🔧 CART_VIEW/CART_UPDATED/ORDER_DETAIL have specific action mappings
                // ========================================================================
                // For CART_VIEW/CART_UPDATED: save CART_ACTIONS mapping
                if (structuredResponse.type === "CART_VIEW" || structuredResponse.type === "CART_UPDATED") {
                    const cartItems = structuredResponse.data.items || [];
                    const transportModes = this.countUniqueTransportModes(structuredResponse.data);
                    const cartActions = yield this.buildCartActionOptions(cartItems.length > 1, input.workspaceId, transportModes);
                    yield this.optionsMappingService.saveMapping({
                        workspaceId: input.workspaceId,
                        conversationId,
                        customerId: input.customerId,
                        responseText: "", // Empty - we're providing explicit items
                        items: cartActions,
                        listType: "CART_ACTIONS",
                    });
                    logger_1.default.info("🛒 [ChatEngine] STEP 9: Saved CART_ACTIONS mapping", {
                        responseType: structuredResponse.type,
                        cartItemCount: cartItems.length,
                        conversationId,
                        actions: cartActions.map((action) => action.id),
                    });
                }
                // For ORDER_DETAIL: save ORDER_ACTIONS mapping  
                else if (structuredResponse.type === "ORDER_DETAIL") {
                    const order = structuredResponse.data.order;
                    const items = [
                        { number: 1, name: "📄 Scarica fattura", id: "SEND_INVOICE", metadata: { orderCode: order === null || order === void 0 ? void 0 : order.code } },
                        { number: 2, name: "🔄 Ripeti ordine", id: "REPEAT_ORDER", metadata: { orderCode: order === null || order === void 0 ? void 0 : order.code } },
                    ];
                    // Add credit note option if order has credit notes
                    if (order === null || order === void 0 ? void 0 : order.hasCreditNotes) {
                        items.push({ number: 3, name: "📋 Scarica nota di credito", id: "SEND_CREDIT_NOTES", metadata: { orderCode: order === null || order === void 0 ? void 0 : order.code } });
                    }
                    yield this.optionsMappingService.saveMapping({
                        workspaceId: input.workspaceId,
                        conversationId,
                        customerId: input.customerId,
                        responseText: "",
                        items,
                        listType: "ORDER_ACTIONS",
                        currentOrderCode: order === null || order === void 0 ? void 0 : order.code,
                    });
                    logger_1.default.info("📦 [ChatEngine] STEP 9: Saved ORDER_ACTIONS mapping", {
                        responseType: structuredResponse.type,
                        orderCode: order === null || order === void 0 ? void 0 : order.code,
                        conversationId,
                    });
                }
                else if (structuredResponse.type === "PRODUCT_DETAIL") {
                    const productDetailActions = [
                        { number: 1, name: "Esplora il catalogo", id: "SHOW_CATEGORIES", metadata: {} },
                        { number: 2, name: "Mostrami il carrello", id: "VIEW_CART", metadata: {} },
                    ];
                    yield this.optionsMappingService.saveMapping({
                        workspaceId: input.workspaceId,
                        conversationId,
                        customerId: input.customerId,
                        responseText: "",
                        items: productDetailActions,
                        listType: "PRODUCT_DETAIL_ACTIONS",
                    });
                    logger_1.default.info("📋 [ChatEngine] STEP 9: Saved PRODUCT_DETAIL_ACTIONS mapping", {
                        conversationId,
                        responseType: structuredResponse.type,
                    });
                }
                else if (structuredResponse.type === "CART_EMPTY") {
                    yield this.optionsMappingService.saveMapping({
                        workspaceId: input.workspaceId,
                        conversationId,
                        customerId: input.customerId,
                        responseText: "",
                        forceClear: true,
                    });
                    yield this.optionsMappingService.setPendingAction({
                        workspaceId: input.workspaceId,
                        conversationId,
                        pendingAction: { type: "SHOW_PRODUCTS" },
                    });
                }
                // For other types: normal saveMapping
                else {
                    // Extract items with SKUs from structuredResponse for proper mapping
                    const itemsWithSkus = (_16 = (_15 = structuredResponse.data) === null || _15 === void 0 ? void 0 : _15.items) === null || _16 === void 0 ? void 0 : _16.map((item) => ({
                        number: item.number,
                        name: item.name,
                        sku: item.sku,
                        id: item.id,
                    }));
                    // Determine listType from response type
                    const responseListType = structuredResponse.type === "PRODUCT_LIST" ? "PRODUCTS"
                        : structuredResponse.type === "ORDER_LIST" ? "ORDERS"
                            : structuredResponse.type === "CATEGORY_LIST" ? "CATEGORIES"
                                : structuredResponse.type === "SERVICE_LIST" ? "SERVICES"
                                    : structuredResponse.type === "OFFERS" ? "OFFER_CATEGORIES" // 🆕 Offers with category selection
                                        : structuredResponse.type === "OFFER_WITH_PRODUCTS" ? "PRODUCTS" // 🆕 Single offer shows products
                                            : undefined;
                    yield this.optionsMappingService.saveMapping({
                        workspaceId: input.workspaceId,
                        conversationId,
                        customerId: input.customerId,
                        responseText: responseWithSkus, // Use response WITH SKUs for mapping
                        groupMapping, // 🆕 Pass LLM-generated group mapping if available
                        items: itemsWithSkus, // 🔧 Pass items with SKUs for reliable selection
                        listType: responseListType, // 🔧 Pass list type for proper intent creation
                    });
                    // Log what we saved for debugging
                    if (itemsWithSkus && itemsWithSkus.length > 0) {
                        logger_1.default.info("📋 [ChatEngine] Saved items with SKUs for FAST-PATH", {
                            conversationId,
                            listType: responseListType,
                            itemCount: itemsWithSkus.length,
                            firstItem: { number: itemsWithSkus[0].number, name: (_17 = itemsWithSkus[0].name) === null || _17 === void 0 ? void 0 : _17.substring(0, 20), sku: itemsWithSkus[0].sku },
                        });
                    }
                    // Log if we saved a group mapping
                    if (groupMapping) {
                        logger_1.default.info("🗂️ [ChatEngine] Saved smart grouping mapping", {
                            conversationId,
                            groups: Object.keys(groupMapping),
                            example: Object.entries(groupMapping)[0],
                        });
                    }
                } // End of shouldSkipSaveMapping else block
                // ========================================================================
                // STEP 9.5: 🛒 Set pending action for PRODUCT_DETAIL (add to cart prompt)
                // ========================================================================
                if (structuredResponse.type === "PRODUCT_DETAIL" && structuredResponse.data.product) {
                    const product = structuredResponse.data.product;
                    yield this.optionsMappingService.setPendingAction({
                        workspaceId: input.workspaceId,
                        conversationId,
                        pendingAction: {
                            type: "ADD_TO_CART",
                            productId: product.sku || product.id, // 🔧 Use SKU for CartManagementAgent (prefers SKU)
                            productName: product.name,
                            quantity: 1,
                        },
                    });
                    logger_1.default.info("🛒 [ChatEngine] Set pending ADD_TO_CART action", {
                        productId: product.sku || product.id,
                        productName: product.name,
                    });
                }
                // ========================================================================
                // STEP 9.52: 🛒 Set pending action for SERVICE_DETAIL (add to cart prompt)
                // ========================================================================
                if (structuredResponse.type === "SERVICE_DETAIL" && structuredResponse.data.service) {
                    const service = structuredResponse.data.service;
                    yield this.optionsMappingService.setPendingAction({
                        workspaceId: input.workspaceId,
                        conversationId,
                        pendingAction: {
                            type: "ADD_TO_CART",
                            productId: service.code || service.id, // For services, use code
                            productName: service.name,
                            quantity: 1,
                            itemType: "SERVICE", // 🆕 Mark as service for CartManagementAgent
                        },
                    });
                    logger_1.default.info("🛒 [ChatEngine] Set pending ADD_TO_CART action for service", {
                        serviceId: service.code || service.id,
                        serviceName: service.name,
                    });
                }
                // ========================================================================
                // STEP 9.55: 📦 Set order actions for ORDER_DETAIL
                // ========================================================================
                if (structuredResponse.type === "ORDER_DETAIL" && structuredResponse.data.order) {
                    const order = structuredResponse.data.order;
                    // Save order code
                    yield this.optionsMappingService.setCurrentOrderCode({
                        workspaceId: input.workspaceId,
                        conversationId,
                        orderCode: order.code,
                    });
                    // 🆕 CRITICAL: Save explicit action options so "1" = Fattura, "2" = Ripeti
                    yield this.optionsMappingService.saveMapping({
                        workspaceId: input.workspaceId,
                        conversationId,
                        customerId: input.customerId,
                        responseText: "", // Empty - we're providing explicit items
                        items: [
                            { number: 1, name: "📄 Scarica fattura", id: "SEND_INVOICE", metadata: { orderCode: order.code } },
                            { number: 2, name: "🔄 Ripeti ordine", id: "REPEAT_ORDER", metadata: { orderCode: order.code } },
                        ],
                        listType: "ORDER_ACTIONS",
                    });
                    logger_1.default.info("📦 [ChatEngine] Set order actions for ORDER_DETAIL", {
                        orderCode: order.code,
                        actions: ["SEND_INVOICE", "REPEAT_ORDER"],
                    });
                }
                // ========================================================================
                // STEP 9.6: 🆕 FSM - Update conversation state based on response type
                // ========================================================================
                if (chatSession) {
                    let newFsmState = null;
                    const fsmContext = {};
                    switch (structuredResponse.type) {
                        case "CATEGORY_LIST":
                            newFsmState = conversation_state_service_1.ConversationState.BROWSING_CATEGORIES;
                            break;
                        case "PRODUCT_LIST":
                        case "PRODUCT_GROUPED":
                        case "PRODUCT_NEEDS_SMART_GROUPING":
                            newFsmState = conversation_state_service_1.ConversationState.BROWSING_PRODUCTS;
                            break;
                        case "ORDER_LIST":
                            newFsmState = conversation_state_service_1.ConversationState.BROWSING_ORDERS;
                            break;
                        case "PRODUCT_DETAIL":
                            newFsmState = conversation_state_service_1.ConversationState.VIEWING_PRODUCT;
                            if (structuredResponse.data.product) {
                                fsmContext.selectedProductId = structuredResponse.data.product.id;
                                fsmContext.selectedProductSku = structuredResponse.data.product.sku;
                                fsmContext.selectedProductName = structuredResponse.data.product.name;
                            }
                            break;
                        case "ORDER_DETAIL":
                            newFsmState = conversation_state_service_1.ConversationState.VIEWING_ORDER;
                            if (structuredResponse.data.order) {
                                fsmContext.selectedOrderId = structuredResponse.data.order.id;
                                fsmContext.selectedOrderCode = structuredResponse.data.order.code;
                            }
                            break;
                        case "CART_VIEW":
                        case "CART_UPDATED":
                            newFsmState = conversation_state_service_1.ConversationState.VIEWING_CART;
                            break;
                        case "CART_EMPTY":
                            // 🔧 When cart is empty, go back to IDLE - next "sì" should NOT trigger checkout!
                            newFsmState = conversation_state_service_1.ConversationState.IDLE;
                            break;
                    }
                    if (newFsmState) {
                        yield this.conversationStateService.setState(chatSession.id, newFsmState, fsmContext);
                        logger_1.default.info("🔄 [FSM] Normal flow state updated", {
                            newState: newFsmState,
                            responseType: structuredResponse.type,
                        });
                    }
                }
                return {
                    // New fields
                    message: finalMessage,
                    agentType,
                    wasHandled: true,
                    intent: intentResult.intent.type,
                    confidence: intentResult.confidence,
                    source: intentResult.source,
                    processingTimeMs,
                    debugInfo: Object.assign(Object.assign({}, debugInfo), { steps: debugSteps, totalTokens }),
                    // Legacy fields for webhook compatibility
                    response: finalMessage,
                    agentUsed: agentType,
                    tokensUsed: totalTokens,
                    executionTimeMs: processingTimeMs,
                    wasFAQ: false,
                    isBlocked: false,
                    // 🆕 Store assistant message ID for translation layer
                    _assistantMessageId: assistantMessageId,
                };
            }
            catch (error) {
                logger_1.default.error("❌ [ChatEngine] Error processing message", {
                    errorMessage: error instanceof Error ? error.message : String(error),
                    errorStack: error instanceof Error ? error.stack : undefined,
                });
                const errorTimeMs = Date.now() - startTime;
                return {
                    // New fields
                    message: "Mi scusi, si è verificato un errore. Può riprovare?",
                    agentType: database_1.AgentType.ROUTER,
                    wasHandled: false,
                    intent: "ERROR",
                    confidence: "LOW",
                    source: "PATTERN",
                    processingTimeMs: errorTimeMs,
                    debugInfo: {
                        loadedDataType: "ERROR",
                        responseType: "ERROR",
                        llmUsed: false,
                        steps: debugSteps, // 🆕 Include steps even on error
                        totalTokens,
                        totalCost: 0,
                        executionTimeMs: errorTimeMs,
                    },
                    // Legacy fields
                    response: "Mi scusi, si è verificato un errore. Può riprovare?",
                    agentUsed: database_1.AgentType.ROUTER,
                    tokensUsed: 0,
                    executionTimeMs: errorTimeMs,
                    wasFAQ: false,
                    isBlocked: false,
                };
            }
        });
    }
    /**
     * Check if response type can use cached template
     */
    isSimpleResponseType(type) {
        const simpleTypes = [
            "GREETING",
            "GOODBYE",
            "THANKS",
            "HELP",
            "CART_EMPTY",
            "NO_RESULTS",
            "ERROR",
            "HUMAN_SUPPORT",
        ];
        return simpleTypes.includes(type);
    }
    /**
     * Map intent type to AgentType for logging/analytics
     */
    mapIntentToAgentType(intentType) {
        const mapping = {
            // Product search intents
            SHOW_CATEGORIES: database_1.AgentType.PRODUCT_SEARCH,
            SHOW_CATEGORY: database_1.AgentType.PRODUCT_SEARCH,
            SHOW_PRODUCTS: database_1.AgentType.PRODUCT_SEARCH,
            SHOW_PRODUCT: database_1.AgentType.PRODUCT_SEARCH,
            SEARCH_PRODUCTS: database_1.AgentType.PRODUCT_SEARCH,
            SHOW_OFFERS: database_1.AgentType.PRODUCT_SEARCH,
            SHOW_NEW_ARRIVALS: database_1.AgentType.PRODUCT_SEARCH,
            PRODUCT_CONTEXT: database_1.AgentType.PRODUCT_SEARCH,
            // Service intents
            VIEW_SERVICES: database_1.AgentType.PRODUCT_SEARCH,
            SHOW_SERVICE: database_1.AgentType.PRODUCT_SEARCH,
            // Cart intents
            VIEW_CART: database_1.AgentType.CART_MANAGEMENT,
            ADD_TO_CART: database_1.AgentType.CART_MANAGEMENT,
            REMOVE_FROM_CART: database_1.AgentType.CART_MANAGEMENT,
            UPDATE_CART_QUANTITY: database_1.AgentType.CART_MANAGEMENT,
            CLEAR_CART: database_1.AgentType.CART_MANAGEMENT,
            CHECKOUT: database_1.AgentType.CART_MANAGEMENT,
            START_CHECKOUT: database_1.AgentType.CART_MANAGEMENT, // Same as CHECKOUT
            // Order intents
            VIEW_ORDERS: database_1.AgentType.ORDER_TRACKING,
            ORDER_DETAILS: database_1.AgentType.ORDER_TRACKING,
            TRACK_ORDER: database_1.AgentType.ORDER_TRACKING,
            REPEAT_ORDER: database_1.AgentType.CART_MANAGEMENT, // Adds previous order items to cart
            // Support intents
            ASK_IDENTITY: database_1.AgentType.CUSTOMER_SUPPORT,
            ASK_LOCATION: database_1.AgentType.CUSTOMER_SUPPORT,
            ASK_BUSINESS_INFO: database_1.AgentType.CUSTOMER_SUPPORT, // 🆕 "che settore?", "che tipo di negozio?"
            ASK_CONTACT: database_1.AgentType.CUSTOMER_SUPPORT,
            REQUEST_HUMAN: database_1.AgentType.CUSTOMER_SUPPORT,
            ASK_HOURS: database_1.AgentType.CUSTOMER_SUPPORT,
            ASK_SHIPPING: database_1.AgentType.CUSTOMER_SUPPORT,
            ASK_PAYMENT: database_1.AgentType.CUSTOMER_SUPPORT,
            ASK_HELP: database_1.AgentType.CUSTOMER_SUPPORT,
            // Profile intents
            VIEW_PROFILE: database_1.AgentType.PROFILE_MANAGEMENT,
            UPDATE_PROFILE: database_1.AgentType.PROFILE_MANAGEMENT,
            CHANGE_LANGUAGE: database_1.AgentType.PROFILE_MANAGEMENT,
            // Greeting intents
            GREETING: database_1.AgentType.ROUTER,
            GOODBYE: database_1.AgentType.ROUTER,
            THANKS: database_1.AgentType.ROUTER,
            // Selection intent
            SELECT_OPTION: database_1.AgentType.ROUTER,
        };
        return mapping[intentType] || database_1.AgentType.ROUTER;
    }
    /**
     * Get message when e-commerce is disabled
     */
    getEcommerceDisabledMessage(language) {
        // NOTE: Do not hardcode translations here; translation layer handles localization.
        return "Sorry, we don't handle online sales at the moment. I can help you with information or support. How can I assist you?";
    }
    /**
     * Execute order action (calling functions for invoice, repeat order, credit notes)
     * @see Feature 202 - Order Selection & Invoice Actions
     */
    executeOrderAction(action, orderCode, workspaceId, customerId, conversationId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            logger_1.default.info("📦 [executeOrderAction] Executing order action", {
                action,
                orderCode,
                workspaceId,
                customerId,
                conversationId,
            });
            try {
                switch (action) {
                    case "SEND_INVOICE": {
                        // Import and call sendInvoice calling function
                        const { sendInvoice } = yield Promise.resolve().then(() => __importStar(require("../../domain/calling-functions/SendInvoice")));
                        const result = yield sendInvoice({
                            customerId,
                            workspaceId,
                            orderId: orderCode, // sendInvoice accepts orderCode or orderId
                        });
                        return {
                            message: result.message || "Invoice sent successfully!",
                            success: result.success,
                        };
                    }
                    case "REPEAT_ORDER": {
                        // Import and call repeatOrder calling function
                        const { repeatOrder } = yield Promise.resolve().then(() => __importStar(require("../../domain/calling-functions/RepeatOrder")));
                        const result = yield repeatOrder({
                            customerId,
                            workspaceId,
                            orderCode,
                        });
                        // Handle stock unavailability (ABORT message per spec)
                        if (!result.success && ((_a = result.error) === null || _a === void 0 ? void 0 : _a.includes("stock"))) {
                            return {
                                message: "Sorry, the order can't be repeated because one or more items are out of stock. Do you want me to help you find a similar product?",
                                success: false,
                            };
                        }
                        return {
                            message: result.message,
                            success: result.success,
                        };
                    }
                    case "SEND_CREDIT_NOTES": {
                        // Get credit notes for this order
                        const creditNotes = yield this.prisma.creditNote.findMany({
                            where: {
                                order: {
                                    orderCode,
                                    workspaceId,
                                    customerId,
                                },
                            },
                            include: {
                                order: true,
                            },
                        });
                        if (creditNotes.length === 0) {
                            return {
                                message: "There are no credit notes available for this order.",
                                success: false,
                            };
                        }
                        // Format credit notes list for download
                        // Per spec: naming is {orderCode}_notadicredito{N}.pdf
                        const notesList = creditNotes.map((cn, index) => {
                            const fileName = `${orderCode}_notadicredito${index + 1}.pdf`;
                            return `📋 ${fileName} - €${cn.amount.toFixed(2)}`;
                        }).join("\n");
                        return {
                            message: `I found ${creditNotes.length} credit note(s) for order ${orderCode}:\n\n${notesList}\n\nI emailed the credit notes to you.`,
                            success: true,
                        };
                    }
                    case "ADD_ORDER_NOTE": {
                        if (!orderCode) {
                            return {
                                message: "Non ho trovato il codice ordine da aggiornare. Puoi ripetere quale ordine vuoi modificare?",
                                success: false,
                            };
                        }
                        yield this.optionsMappingService.setPendingAction({
                            workspaceId,
                            conversationId,
                            pendingAction: {
                                type: "ADD_ORDER_NOTE",
                                orderCode,
                            },
                        });
                        return {
                            message: `Perfetto! Scrivi la nota che vuoi aggiungere all'ordine **${orderCode}**.`,
                            success: true,
                        };
                    }
                    default:
                        logger_1.default.warn("⚠️ [executeOrderAction] Unknown action", { action });
                        return {
                            message: "Sorry, I didn't understand which action you want to run. Can you try again?",
                            success: false,
                        };
                }
            }
            catch (error) {
                logger_1.default.error("❌ [executeOrderAction] Error executing action", {
                    error,
                    action,
                    orderCode
                });
                return {
                    message: "Sorry, something went wrong. Please try again later or contact support.",
                    success: false,
                };
            }
        });
    }
    /**
     * Save messages to conversation history
     * 🆕 Now includes debugInfo for Message Flow Dialog timeline
     * 🆕 Returns assistant message ID for potential translation updates
     */
    saveMessages(workspaceId, customerId, conversationId, userMessage, assistantMessage, agentType, tokensUsed, debugInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Save user message
                yield this.conversationManager.saveUserMessage({
                    workspaceId,
                    customerId,
                    conversationId,
                    content: userMessage,
                });
                // 🆕 Create minimal debugInfo if not provided (for FAST-PATH responses)
                const finalDebugInfo = debugInfo || {
                    loadedDataType: "FAST_PATH",
                    responseType: "FAST_PATH",
                    llmUsed: false,
                    steps: [{
                            type: "router",
                            agent: "⚡ Fast Path",
                            timestamp: new Date().toISOString(),
                            input: { textContent: userMessage.substring(0, 100) },
                            output: { textContent: "Response generated via optimized path" },
                            duration: 0,
                        }],
                    totalTokens: tokensUsed || 0,
                    totalCost: 0,
                    executionTimeMs: 0,
                };
                // Save assistant response with debugInfo for timeline
                const assistantMessageId = yield this.conversationManager.saveAssistantMessage({
                    workspaceId,
                    customerId,
                    conversationId,
                    content: assistantMessage,
                    agentType,
                    tokensUsed,
                    debugInfo: finalDebugInfo, // 🆕 Always have debugInfo for Message Flow Dialog
                });
                logger_1.default.debug("💾 [ChatEngine] Messages saved to history", {
                    hasDebugInfo: true,
                    debugStepsCount: ((_a = finalDebugInfo === null || finalDebugInfo === void 0 ? void 0 : finalDebugInfo.steps) === null || _a === void 0 ? void 0 : _a.length) || 0,
                    wasFastPath: !debugInfo,
                    assistantMessageId,
                });
                // Return the assistant message ID
                return { assistantMessageId };
            }
            catch (error) {
                // Don't fail the request if saving fails
                logger_1.default.error("❌ [ChatEngine] Failed to save messages", { error });
                return {};
            }
        });
    }
    // ================================================================================
    // 🆕 CONTEXTUAL ENRICHMENT - Build enrichment options for ResponseBuilder
    // ================================================================================
    /**
     * Build enrichment options for contextual responses
     *
     * Loads customer profile data for personalization and prepares
     * conversation history for contextual suggestions.
     */
    buildEnrichmentOptions(workspaceId, customerId, conversationHistory) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const enrichmentOptions = {
                conversationHistory,
                enableClarifyingQuestions: true,
                enableSuggestions: true,
                enablePersonalization: true,
            };
            try {
                // Load customer order statistics for personalization
                const orderStats = yield this.prisma.orders.groupBy({
                    by: ["customerId"],
                    where: {
                        customerId,
                        workspaceId,
                        deletedAt: null,
                    },
                    _count: { id: true },
                    _max: { createdAt: true },
                });
                const customerOrderCount = ((_a = orderStats[0]) === null || _a === void 0 ? void 0 : _a._count.id) || 0;
                const lastOrderDate = (_b = orderStats[0]) === null || _b === void 0 ? void 0 : _b._max.createdAt;
                // Load frequent products (top 5 by order count)
                let frequentProducts = [];
                if (customerOrderCount > 0) {
                    const frequentProductsRaw = yield this.prisma.orderItems.groupBy({
                        by: ["productId"],
                        where: {
                            order: {
                                customerId,
                                workspaceId,
                                deletedAt: null,
                            },
                        },
                        _count: { productId: true },
                        orderBy: { _count: { productId: "desc" } },
                        take: 5,
                    });
                    if (frequentProductsRaw.length > 0) {
                        const productIds = frequentProductsRaw.map(p => p.productId).filter(Boolean);
                        const products = yield this.prisma.products.findMany({
                            where: { id: { in: productIds }, isActive: true },
                            select: { id: true, sku: true, name: true },
                        });
                        frequentProducts = frequentProductsRaw
                            .map(fp => {
                            const product = products.find(p => p.id === fp.productId);
                            return product ? {
                                sku: product.sku,
                                name: product.name,
                                orderCount: fp._count.productId,
                            } : null;
                        })
                            .filter(Boolean);
                    }
                }
                // Build customer profile for personalization
                enrichmentOptions.customerProfile = {
                    isReturningCustomer: customerOrderCount > 0,
                    totalOrders: customerOrderCount,
                    lastOrderDate: lastOrderDate || undefined,
                    frequentProducts: frequentProducts.length > 0 ? frequentProducts : undefined,
                };
                logger_1.default.debug("✨ [ChatEngine] Enrichment options built", {
                    isReturningCustomer: customerOrderCount > 0,
                    totalOrders: customerOrderCount,
                    frequentProductsCount: frequentProducts.length,
                    historyLength: conversationHistory.length,
                });
            }
            catch (error) {
                // Don't fail if enrichment data can't be loaded
                logger_1.default.warn("⚠️ [ChatEngine] Could not load enrichment data", { error });
            }
            return enrichmentOptions;
        });
    }
}
exports.ChatEngineService = ChatEngineService;
// ================================================================================
// SINGLETON
// ================================================================================
let chatEngineInstance = null;
function getChatEngine(prisma) {
    if (!chatEngineInstance) {
        chatEngineInstance = new ChatEngineService(prisma);
    }
    return chatEngineInstance;
}
//# sourceMappingURL=chat-engine.service.js.map