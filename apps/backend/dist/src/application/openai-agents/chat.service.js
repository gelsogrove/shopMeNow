"use strict";
/**
 * OpenAI Agents SDK - Chat Service Integration
 *
 * This service provides an ALTERNATIVE implementation of the chat flow
 * using the official OpenAI Agents SDK instead of the custom LLMRouterService.
 *
 * The existing LLMRouterService remains unchanged - this allows:
 * 1. Feature flagging between implementations
 * 2. A/B testing different approaches
 * 3. Gradual migration path
 *
 * @architecture Clean Architecture with OpenAI SDK
 * @security ALL queries filtered by workspaceId
 * @critical Prompts loaded from database (agentConfig table)
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
exports.OpenAIChatService = void 0;
exports.getOpenAIChatService = getOpenAIChatService;
const agents_1 = require("@openai/agents");
const agents_2 = require("./agents");
const logger_1 = __importDefault(require("../../utils/logger"));
const TranslationAgent_1 = require("../agents/TranslationAgent");
const link_replacement_service_1 = require("../services/link-replacement.service");
// ============================================================================
// SERVICE
// ============================================================================
/**
 * OpenAI Agents SDK Chat Service
 * Alternative to LLMRouterService using official SDK
 */
class OpenAIChatService {
    constructor(prisma) {
        // Cache agent systems per workspace (they have prompts loaded from DB)
        this.agentSystemCache = new Map();
        // Cache TTL (5 minutes - prompts don't change often)
        this.CACHE_TTL_MS = 5 * 60 * 1000;
        this.prisma = prisma;
        this.translationAgent = new TranslationAgent_1.TranslationAgent(prisma);
        this.linkReplacementService = new link_replacement_service_1.LinkReplacementService();
    }
    /**
     * Main entry point - processes a customer message using OpenAI Agents SDK
     *
     * Flow:
     * 1. Load/create agent system for workspace (cached)
     * 2. Load customer data and conversation history
     * 3. Run triage agent with context
     * 4. Apply translation (if customer language != Italian)
     * 5. Replace link tokens with secure URLs
     */
    processMessage(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            logger_1.default.info(`🚀 [OpenAI-SDK] Processing message for customer ${input.customerId}`);
            try {
                // 1. Get or create agent system for workspace
                const agents = yield this.getOrCreateAgentSystem(input.workspaceId);
                // 2. Load customer data
                const customer = yield this.prisma.customers.findFirst({
                    where: {
                        id: input.customerId,
                        workspaceId: input.workspaceId,
                    },
                });
                if (!customer) {
                    throw new Error(`Customer not found: ${input.customerId}`);
                }
                // 3. Build context for tools
                const context = {
                    workspaceId: input.workspaceId,
                    customerId: input.customerId,
                    conversationId: input.conversationId,
                    prisma: this.prisma,
                    customerName: customer.name || input.customerName || "Cliente",
                    customerLanguage: customer.language || input.customerLanguage || "it",
                    customerDiscount: customer.discount || input.customerDiscount || 0,
                    customerEmail: customer.email || undefined,
                    customerPhone: customer.phone,
                };
                // 4. Load conversation history (last 20 messages or 10 minutes)
                const history = yield this.loadConversationHistory(input.workspaceId, input.customerId, input.conversationId);
                context.conversationHistory = history;
                // 5. Run the triage agent
                logger_1.default.info(`🤖 [OpenAI-SDK] Running triage agent...`);
                const result = yield (0, agents_1.run)(agents.triageAgent, input.message, {
                    context,
                    maxTurns: 10, // Prevent infinite handoff loops
                });
                // 6. Determine which agent was actually used (last in chain)
                const finalAgentName = this.extractFinalAgent(result);
                const agentUsed = this.mapAgentNameToType(finalAgentName);
                // 7. Get response text
                let responseText = this.extractResponseText(result);
                // 8. Apply translation if needed
                const targetLanguage = context.customerLanguage || "it";
                if (targetLanguage !== "it") {
                    logger_1.default.info(`🌐 [OpenAI-SDK] Translating to ${targetLanguage}`);
                    const translationResult = yield this.translationAgent.process({
                        workspaceId: input.workspaceId,
                        message: responseText,
                        targetLanguage,
                        customerName: context.customerName,
                    });
                    responseText = translationResult.message;
                }
                // 9. Replace link tokens (e.g., [LINK_CART], [LINK_ORDER_xxx])
                const linkResult = yield this.linkReplacementService.replaceTokens({ response: responseText }, input.customerId, input.workspaceId);
                if (linkResult.success && linkResult.response) {
                    responseText = linkResult.response;
                }
                // 10. Save conversation log
                yield this.saveConversationMessages(input.workspaceId, input.customerId, input.conversationId, input.message, responseText);
                const executionTimeMs = Date.now() - startTime;
                logger_1.default.info(`✅ [OpenAI-SDK] Completed in ${executionTimeMs}ms, agent: ${agentUsed}`);
                return {
                    response: responseText,
                    agentUsed,
                    confidence: 0.95, // SDK doesn't provide confidence, assume high
                    tokensUsed: this.estimateTokens(responseText),
                    executionTimeMs,
                    wasFAQ: agentUsed === "CUSTOMER_SUPPORT",
                    sdkDebugInfo: {
                        agentChain: this.extractAgentChain(result),
                        handoffs: this.countHandoffs(result),
                        finalAgent: finalAgentName,
                    },
                };
            }
            catch (error) {
                logger_1.default.error(`❌ [OpenAI-SDK] Error processing message:`, error);
                throw error;
            }
        });
    }
    /**
     * Get cached agent system or create new one
     */
    getOrCreateAgentSystem(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const cached = this.agentSystemCache.get(workspaceId);
            if (cached && Date.now() - cached.createdAt < this.CACHE_TTL_MS) {
                logger_1.default.debug(`📦 [OpenAI-SDK] Using cached agent system for ${workspaceId}`);
                return cached;
            }
            logger_1.default.info(`🏗️ [OpenAI-SDK] Creating new agent system for ${workspaceId}`);
            const agents = yield (0, agents_2.createAgentSystem)(this.prisma, workspaceId);
            this.agentSystemCache.set(workspaceId, Object.assign(Object.assign({}, agents), { createdAt: Date.now() }));
            return agents;
        });
    }
    /**
     * Load conversation history for context
     */
    loadConversationHistory(workspaceId, customerId, conversationId) {
        return __awaiter(this, void 0, void 0, function* () {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            const messages = yield this.prisma.conversationMessage.findMany({
                where: {
                    workspaceId,
                    customerId,
                    conversationId,
                    createdAt: {
                        gte: tenMinutesAgo,
                    },
                },
                orderBy: {
                    createdAt: "asc",
                },
                take: 20,
                select: {
                    role: true,
                    content: true,
                },
            });
            return messages.map((m) => ({
                role: (m.role === "user" ? "user" : "assistant"),
                content: m.content,
            }));
        });
    }
    /**
     * Save conversation messages to database
     */
    saveConversationMessages(workspaceId, customerId, conversationId, userMessage, assistantMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Save user message
                yield this.prisma.conversationMessage.create({
                    data: {
                        workspaceId,
                        customerId,
                        conversationId,
                        role: "user",
                        content: userMessage,
                    },
                });
                // Save assistant message
                yield this.prisma.conversationMessage.create({
                    data: {
                        workspaceId,
                        customerId,
                        conversationId,
                        role: "assistant",
                        content: assistantMessage,
                    },
                });
            }
            catch (error) {
                logger_1.default.error(`❌ [OpenAI-SDK] Failed to save conversation:`, error);
                // Don't throw - conversation saving is non-critical
            }
        });
    }
    /**
     * Extract final agent name from result
     */
    extractFinalAgent(result) {
        // The SDK result contains information about the run
        // We need to check which agent produced the final output
        try {
            // Access the last agent in the execution chain
            const lastOutput = result.output;
            if (typeof lastOutput === "string") {
                // Simple response from an agent
                return "TriageAgent";
            }
            return "TriageAgent";
        }
        catch (_a) {
            return "TriageAgent";
        }
    }
    /**
     * Map SDK agent names to our AgentType enum
     */
    mapAgentNameToType(agentName) {
        const mapping = {
            ProductSearchAgent: "PRODUCT_SEARCH",
            CartManagementAgent: "CART_MANAGEMENT",
            OrderTrackingAgent: "ORDER_TRACKING",
            CustomerSupportAgent: "CUSTOMER_SUPPORT",
            TriageAgent: "ROUTER",
        };
        return mapping[agentName] || "ROUTER";
    }
    /**
     * Extract response text from SDK result
     */
    extractResponseText(result) {
        // The SDK returns the final output in result.output
        if (typeof result.output === "string") {
            return result.output;
        }
        // If structured output, convert to string
        return JSON.stringify(result.output);
    }
    /**
     * Extract chain of agents used
     */
    extractAgentChain(result) {
        // This would require accessing internal SDK state
        // For now, return simplified chain
        return ["TriageAgent"];
    }
    /**
     * Count number of handoffs
     */
    countHandoffs(result) {
        // This would require accessing internal SDK state
        return 0;
    }
    /**
     * Estimate tokens used
     */
    estimateTokens(responseText) {
        // Rough estimation: 4 chars per token
        return Math.ceil(responseText.length / 4) + 500; // +500 for prompt tokens estimate
    }
    /**
     * Clear agent cache for a workspace (call when prompts are updated)
     */
    clearCache(workspaceId) {
        this.agentSystemCache.delete(workspaceId);
        logger_1.default.info(`🗑️ [OpenAI-SDK] Cleared cache for workspace ${workspaceId}`);
    }
    /**
     * Clear all caches
     */
    clearAllCaches() {
        this.agentSystemCache.clear();
        logger_1.default.info(`🗑️ [OpenAI-SDK] Cleared all caches`);
    }
}
exports.OpenAIChatService = OpenAIChatService;
// ============================================================================
// SINGLETON EXPORT
// ============================================================================
let openAIChatServiceInstance = null;
function getOpenAIChatService(prisma) {
    if (!openAIChatServiceInstance) {
        openAIChatServiceInstance = new OpenAIChatService(prisma);
    }
    return openAIChatServiceInstance;
}
//# sourceMappingURL=chat.service.js.map