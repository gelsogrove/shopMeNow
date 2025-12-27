"use strict";
/**
 * AgentConversationLogRepository
 *
 * Repository for managing Agent Conversation Logs (complete LLM interaction tracking).
 * Provides logging, retrieval, and analytics for multi-agent conversations.
 *
 * Key Methods:
 * - create: Log a single agent interaction
 * - findByConversation: Get all logs for a conversation (complete agent pipeline)
 * - getAgentPerformanceMetrics: Analytics by agent type
 * - getErrorLogs: Filter logs with errors for debugging
 *
 * Security: ALL queries filtered by workspaceId AND customerId (multi-tenant + customer isolation)
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
exports.AgentConversationLogRepository = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
class AgentConversationLogRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Create new agent conversation log entry
     * @param data - Log data from agent interaction
     * @returns Created log entry
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const log = yield this.prisma.agentConversationLog.create({
                    data: {
                        workspaceId: data.workspaceId,
                        customerId: data.customerId,
                        conversationId: data.conversationId,
                        messageId: data.messageId,
                        step: data.step,
                        agentType: data.agentType,
                        agentAction: data.agentAction,
                        inputMessage: data.inputMessage,
                        agentPrompt: data.agentPrompt,
                        llmModel: data.llmModel,
                        llmResponse: data.llmResponse,
                        confidence: data.confidence,
                        reasoning: data.reasoning,
                        tokensUsed: data.tokensUsed,
                        executionTimeMs: data.executionTimeMs,
                        functionsCalled: data.functionsCalled,
                        hasError: (_a = data.hasError) !== null && _a !== void 0 ? _a : false,
                        errorMessage: data.errorMessage,
                    },
                });
                logger_1.default.info(`Logged agent interaction: ${data.agentType} (step ${data.step}) for conversation ${data.conversationId}`);
                return log;
            }
            catch (error) {
                logger_1.default.error("Error creating agent conversation log:", error);
                throw error;
            }
        });
    }
    /**
     * Find all logs for a specific conversation (complete agent pipeline)
     * Useful for debugging: see all agents that processed this message
     *
     * @param workspaceId - Workspace ID (security filter)
     * @param conversationId - Conversation ID
     * @param customerId - Customer ID (optional, additional security filter)
     * @returns Array of logs sorted by step (chronological order)
     */
    findByConversation(workspaceId, conversationId, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const where = {
                    workspaceId,
                    conversationId,
                };
                if (customerId) {
                    where.customerId = customerId;
                }
                const logs = yield this.prisma.agentConversationLog.findMany({
                    where,
                    orderBy: {
                        step: "asc", // Show agent pipeline in order: ROUTER → specialist → SAFETY
                    },
                });
                logger_1.default.info(`Found ${logs.length} agent logs for conversation ${conversationId} (workspace: ${workspaceId})`);
                return logs;
            }
            catch (error) {
                logger_1.default.error(`Error finding logs for conversation ${conversationId}:`, error);
                throw error;
            }
        });
    }
    /**
     * Find logs by message ID (all agents that processed this specific message)
     * @param workspaceId - Workspace ID (security filter)
     * @param messageId - Message ID
     * @returns Array of logs sorted by step
     */
    findByMessage(workspaceId, messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.prisma.agentConversationLog.findMany({
                    where: {
                        workspaceId,
                        messageId,
                    },
                    orderBy: {
                        step: "asc",
                    },
                });
            }
            catch (error) {
                logger_1.default.error(`Error finding logs for message ${messageId}:`, error);
                throw error;
            }
        });
    }
    /**
     * Find logs by customer (complete customer interaction history)
     * @param workspaceId - Workspace ID (security filter)
     * @param customerId - Customer ID
     * @param limit - Maximum number of results
     * @returns Array of logs sorted by creation date (most recent first)
     */
    findByCustomer(workspaceId_1, customerId_1) {
        return __awaiter(this, arguments, void 0, function* (workspaceId, customerId, limit = 100) {
            try {
                return yield this.prisma.agentConversationLog.findMany({
                    where: {
                        workspaceId,
                        customerId,
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                    take: limit,
                });
            }
            catch (error) {
                logger_1.default.error(`Error finding logs for customer ${customerId}:`, error);
                throw error;
            }
        });
    }
    /**
     * Get error logs for debugging
     * @param workspaceId - Workspace ID (security filter)
     * @param limit - Maximum number of results
     * @returns Array of logs with errors
     */
    getErrorLogs(workspaceId_1) {
        return __awaiter(this, arguments, void 0, function* (workspaceId, limit = 50) {
            try {
                return yield this.prisma.agentConversationLog.findMany({
                    where: {
                        workspaceId,
                        hasError: true,
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                    take: limit,
                });
            }
            catch (error) {
                logger_1.default.error("Error getting error logs:", error);
                throw error;
            }
        });
    }
    /**
     * Get agent performance metrics (analytics)
     *
     * Returns:
     * - Total interactions per agent type
     * - Average confidence per agent
     * - Average execution time per agent
     * - Average tokens used per agent
     * - Error rate per agent
     *
     * @param workspaceId - Workspace ID (security filter)
     * @param startDate - Filter logs from this date (optional)
     * @param endDate - Filter logs to this date (optional)
     * @returns Performance metrics by agent type
     */
    getAgentPerformanceMetrics(workspaceId, startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const where = { workspaceId };
                if (startDate || endDate) {
                    where.createdAt = {};
                    if (startDate)
                        where.createdAt.gte = startDate;
                    if (endDate)
                        where.createdAt.lte = endDate;
                }
                // Group by agent type and calculate metrics
                const result = yield this.prisma.agentConversationLog.groupBy({
                    by: ["agentType"],
                    where,
                    _count: {
                        id: true,
                    },
                    _avg: {
                        confidence: true,
                        executionTimeMs: true,
                        tokensUsed: true,
                    },
                });
                // Count errors per agent type
                const errorCounts = yield this.prisma.agentConversationLog.groupBy({
                    by: ["agentType"],
                    where: Object.assign(Object.assign({}, where), { hasError: true }),
                    _count: {
                        id: true,
                    },
                });
                const errorCountMap = new Map(errorCounts.map((item) => [item.agentType, item._count.id]));
                // Combine results
                const metrics = result.map((item) => {
                    var _a;
                    const errorCount = Number(errorCountMap.get(item.agentType) || 0);
                    const totalCount = Number(((_a = item._count) === null || _a === void 0 ? void 0 : _a.id) || 0);
                    const errorRate = totalCount > 0 ? Number(errorCount) / Number(totalCount) : 0;
                    return {
                        agentType: item.agentType, // Cast from string to AgentType
                        totalInteractions: item._count.id,
                        avgConfidence: item._avg.confidence,
                        avgExecutionTimeMs: item._avg.executionTimeMs,
                        avgTokensUsed: item._avg.tokensUsed,
                        errorCount,
                        errorRate,
                    };
                });
                logger_1.default.info(`Generated performance metrics for ${metrics.length} agent types`);
                return metrics;
            }
            catch (error) {
                logger_1.default.error("Error getting agent performance metrics:", error);
                throw error;
            }
        });
    }
    /**
     * Get token usage statistics
     * @param workspaceId - Workspace ID (security filter)
     * @param startDate - Filter from this date (optional)
     * @param endDate - Filter to this date (optional)
     * @returns Total tokens used and breakdown by agent type
     */
    getTokenUsageStats(workspaceId, startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const where = { workspaceId };
                if (startDate || endDate) {
                    where.createdAt = {};
                    if (startDate)
                        where.createdAt.gte = startDate;
                    if (endDate)
                        where.createdAt.lte = endDate;
                }
                // Total tokens
                const totalResult = yield this.prisma.agentConversationLog.aggregate({
                    where,
                    _sum: {
                        tokensUsed: true,
                    },
                });
                // Tokens by agent type
                const byAgentResult = yield this.prisma.agentConversationLog.groupBy({
                    by: ["agentType"],
                    where,
                    _sum: {
                        tokensUsed: true,
                    },
                });
                return {
                    totalTokens: totalResult._sum.tokensUsed || 0,
                    byAgent: byAgentResult.map((item) => ({
                        agentType: item.agentType, // Cast from string to AgentType
                        totalTokens: item._sum.tokensUsed || 0,
                    })),
                };
            }
            catch (error) {
                logger_1.default.error("Error getting token usage stats:", error);
                throw error;
            }
        });
    }
    /**
     * Delete logs older than specified date (cleanup)
     * @param workspaceId - Workspace ID (security filter)
     * @param olderThan - Delete logs older than this date
     * @returns Number of deleted logs
     */
    deleteOlderThan(workspaceId, olderThan) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.prisma.agentConversationLog.deleteMany({
                    where: {
                        workspaceId,
                        createdAt: {
                            lt: olderThan,
                        },
                    },
                });
                logger_1.default.info(`Deleted ${result.count} agent logs older than ${olderThan.toISOString()} for workspace ${workspaceId}`);
                return result.count;
            }
            catch (error) {
                logger_1.default.error("Error deleting old agent logs:", error);
                throw error;
            }
        });
    }
    /**
     * Count total logs for a workspace
     * @param workspaceId - Workspace ID (security filter)
     * @returns Total number of logs
     */
    count(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.prisma.agentConversationLog.count({
                    where: {
                        workspaceId,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Error counting agent logs:", error);
                throw error;
            }
        });
    }
}
exports.AgentConversationLogRepository = AgentConversationLogRepository;
//# sourceMappingURL=agent-conversation-log.repository.js.map