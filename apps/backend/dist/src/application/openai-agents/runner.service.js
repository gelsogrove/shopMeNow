"use strict";
/**
 * OpenAI Agents SDK - Runner Service
 *
 * Main service for running the multi-agent system.
 * Handles conversation flow, context management, and response generation.
 *
 * @architecture Clean Architecture - Service layer
 * @security ALL operations filtered by workspaceId
 * @critical NO hardcoded data - context from database
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
exports.AgentRunnerService = void 0;
exports.getAgentRunner = getAgentRunner;
const agents_1 = require("@openai/agents");
const logger_1 = __importDefault(require("../../utils/logger"));
// Dynamically import createAgentSystem to avoid potential circular dependencies
// eslint-disable-next-line @typescript-eslint/no-require-imports
const agentsModule = require("./agents");
const createAgentSystem = agentsModule.createAgentSystem;
/**
 * Agent Runner Service
 * Manages the lifecycle of agent conversations
 */
class AgentRunnerService {
    constructor(prisma) {
        this.agentSystems = new Map();
        this.prisma = prisma;
    }
    /**
     * Get or create agent system for a workspace
     * Caches agent systems per workspace for performance
     */
    getAgentSystem(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.agentSystems.has(workspaceId)) {
                const system = yield createAgentSystem(this.prisma, workspaceId);
                this.agentSystems.set(workspaceId, system);
            }
            return this.agentSystems.get(workspaceId);
        });
    }
    /**
     * Invalidate agent system cache for a workspace
     * Call this when agent configs are updated
     */
    invalidateCache(workspaceId) {
        this.agentSystems.delete(workspaceId);
        logger_1.default.info(`🔄 Agent cache invalidated for workspace: ${workspaceId}`);
    }
    /**
     * Run the agent system with a user message
     */
    runAgent(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            const handoffs = [];
            const toolCalls = [];
            try {
                logger_1.default.info(`🚀 [AgentRunner] Starting for message: "${params.message.substring(0, 50)}..."`);
                // Get agent system
                const { triageAgent } = yield this.getAgentSystem(params.workspaceId);
                // Build context
                const context = {
                    workspaceId: params.workspaceId,
                    customerId: params.customerId,
                    conversationId: params.conversationId,
                    customerName: params.customerName,
                    customerLanguage: params.customerLanguage,
                    customerEmail: params.customerEmail,
                    customerPhone: params.customerPhone,
                    customerDiscount: params.customerDiscount,
                    prisma: this.prisma,
                    conversationHistory: params.conversationHistory,
                    debugMode: params.debugMode,
                };
                // Build input with conversation context
                let input = params.message;
                if (params.conversationHistory && params.conversationHistory.length > 0) {
                    // Include last few messages for context
                    const recentHistory = params.conversationHistory.slice(-6);
                    const historyText = recentHistory
                        .map((m) => `${m.role === "user" ? "Customer" : "Assistant"}: ${m.content}`)
                        .join("\n");
                    input = `[Conversation history]\n${historyText}\n\n[Current message]\n${params.message}`;
                }
                // Add customer context
                const customerContext = [
                    params.customerName && `Customer name: ${params.customerName}`,
                    params.customerLanguage && `Language: ${params.customerLanguage}`,
                    params.customerDiscount && `Customer discount: ${params.customerDiscount}%`,
                ]
                    .filter(Boolean)
                    .join(", ");
                if (customerContext) {
                    input = `[Customer info: ${customerContext}]\n\n${input}`;
                }
                // Run the agent
                const result = yield (0, agents_1.run)(triageAgent, input, {
                    context,
                    maxTurns: 10, // Limit to prevent infinite loops
                });
                // Extract metrics and trace
                const executionTimeMs = Date.now() - startTime;
                // Process run result to extract info
                let lastAgentName = "TriageAgent";
                let totalTokens = 0;
                // The result contains the final output
                const response = result.finalOutput || "Mi dispiace, non sono riuscito a elaborare la tua richiesta.";
                logger_1.default.info(`✅ [AgentRunner] Completed in ${executionTimeMs}ms`, {
                    agentUsed: lastAgentName,
                    responseLength: response.length,
                });
                return {
                    success: true,
                    response: typeof response === "string" ? response : JSON.stringify(response),
                    agentUsed: lastAgentName,
                    metrics: {
                        tokensUsed: totalTokens,
                        executionTimeMs,
                        toolCallsCount: toolCalls.length,
                        handoffsCount: handoffs.length,
                    },
                    handoffs,
                    toolCalls,
                };
            }
            catch (error) {
                const executionTimeMs = Date.now() - startTime;
                logger_1.default.error(`❌ [AgentRunner] Error:`, error);
                return {
                    success: false,
                    response: "Mi dispiace, si è verificato un errore. Riprova più tardi.",
                    agentUsed: "TriageAgent",
                    metrics: {
                        tokensUsed: 0,
                        executionTimeMs,
                        toolCallsCount: 0,
                        handoffsCount: 0,
                    },
                    handoffs: [],
                    toolCalls: [],
                    error: error.message,
                };
            }
        });
    }
    /**
     * Save conversation log to database
     */
    saveConversationLog(params, result) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Save to AgentConversationLog
                yield this.prisma.agentConversationLog.create({
                    data: {
                        workspaceId: params.workspaceId,
                        customerId: params.customerId,
                        conversationId: params.conversationId,
                        messageId: `msg_${Date.now()}`,
                        step: 1,
                        agentType: result.agentUsed,
                        agentAction: "process_message",
                        inputMessage: params.message,
                        llmResponse: result.response,
                        tokensUsed: result.metrics.tokensUsed,
                        executionTimeMs: result.metrics.executionTimeMs,
                        functionsCalled: result.toolCalls.length > 0 ? result.toolCalls : undefined,
                        hasError: !result.success,
                        errorMessage: result.error,
                    },
                });
                // Save to ConversationMessage for context
                yield this.prisma.conversationMessage.createMany({
                    data: [
                        {
                            workspaceId: params.workspaceId,
                            customerId: params.customerId,
                            conversationId: params.conversationId,
                            role: "user",
                            content: params.message,
                        },
                        {
                            workspaceId: params.workspaceId,
                            customerId: params.customerId,
                            conversationId: params.conversationId,
                            role: "assistant",
                            content: result.response,
                            agentType: result.agentUsed,
                            tokensUsed: result.metrics.tokensUsed,
                        },
                    ],
                });
                logger_1.default.debug(`📝 Conversation log saved`);
            }
            catch (error) {
                logger_1.default.error(`❌ Failed to save conversation log:`, error);
                // Don't throw - logging failure shouldn't break the flow
            }
        });
    }
    /**
     * Load recent conversation history
     */
    loadConversationHistory(workspaceId_1, customerId_1) {
        return __awaiter(this, arguments, void 0, function* (workspaceId, customerId, limit = 10) {
            try {
                const messages = yield this.prisma.conversationMessage.findMany({
                    where: {
                        workspaceId,
                        customerId,
                        role: { in: ["user", "assistant"] },
                    },
                    orderBy: { createdAt: "desc" },
                    take: limit,
                    select: {
                        role: true,
                        content: true,
                    },
                });
                // Reverse to get chronological order
                return messages.reverse().map((m) => ({
                    role: m.role,
                    content: m.content,
                }));
            }
            catch (error) {
                logger_1.default.error(`❌ Failed to load conversation history:`, error);
                return [];
            }
        });
    }
}
exports.AgentRunnerService = AgentRunnerService;
// Singleton instance
let agentRunnerInstance = null;
/**
 * Get the singleton AgentRunnerService instance
 */
function getAgentRunner(prisma) {
    if (!agentRunnerInstance) {
        agentRunnerInstance = new AgentRunnerService(prisma);
    }
    return agentRunnerInstance;
}
//# sourceMappingURL=runner.service.js.map