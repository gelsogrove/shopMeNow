"use strict";
/**
 * AgentLoggerService
 *
 * High-level service for logging agent interactions and retrieving analytics.
 * Wraps AgentConversationLogRepository with business logic and security validation.
 *
 * Key Responsibilities:
 * - Log each agent interaction with complete context
 * - Validate security (customer belongs to workspace)
 * - Provide analytics and performance metrics
 * - Debug support with error logs
 *
 * Security Model:
 * - ALWAYS validate workspaceId + customerId relationship
 * - Prevent cross-workspace data leakage
 * - Audit trail for all LLM interactions
 *
 * Usage:
 * ```typescript
 * const loggerService = new AgentLoggerService(prisma)
 *
 * await loggerService.logAgentInteraction({
 *   workspaceId,
 *   customerId,
 *   conversationId,
 *   agentType: 'ROUTER',
 *   inputMessage: 'cerco latticini',
 *   llmResponse: '{"agent": "PRODUCT_SEARCH", ...}',
 *   executionTimeMs: 145
 * })
 * ```
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
exports.AgentLoggerService = void 0;
const agent_conversation_log_repository_1 = require("../repositories/agent-conversation-log.repository");
const logger_1 = __importDefault(require("../utils/logger"));
class AgentLoggerService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logRepository = new agent_conversation_log_repository_1.AgentConversationLogRepository(prisma);
    }
    /**
     * Log a single agent interaction
     *
     * Security: Validates that customer belongs to workspace before logging
     *
     * @param params - Agent interaction parameters
     * @returns Created log entry ID
     */
    logAgentInteraction(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // 🔒 SECURITY: Validate customer belongs to workspace
                const customer = yield this.prisma.customers.findFirst({
                    where: {
                        id: params.customerId,
                        workspaceId: params.workspaceId,
                    },
                    select: { id: true },
                });
                if (!customer) {
                    const error = `Security violation: Customer ${params.customerId} does not belong to workspace ${params.workspaceId}`;
                    logger_1.default.error(error);
                    throw new Error(error);
                }
                // Create log entry
                const log = yield this.logRepository.create({
                    workspaceId: params.workspaceId,
                    customerId: params.customerId,
                    conversationId: params.conversationId,
                    messageId: params.messageId,
                    step: params.step,
                    agentType: params.agentType,
                    agentAction: params.agentAction,
                    inputMessage: params.inputMessage,
                    agentPrompt: params.agentPrompt,
                    llmModel: params.llmModel,
                    llmResponse: params.llmResponse,
                    confidence: params.confidence,
                    reasoning: params.reasoning,
                    tokensUsed: params.tokensUsed,
                    executionTimeMs: params.executionTimeMs,
                    functionsCalled: params.functionsCalled,
                    hasError: (_a = params.hasError) !== null && _a !== void 0 ? _a : false,
                    errorMessage: params.errorMessage,
                });
                logger_1.default.info(`Logged ${params.agentType} interaction (step ${params.step}) for conversation ${params.conversationId}`);
                return log.id;
            }
            catch (error) {
                logger_1.default.error("Error logging agent interaction:", error);
                throw error;
            }
        });
    }
    /**
     * Get complete conversation logs (all agents in pipeline)
     *
     * Returns logs sorted by step (chronological order of agent execution)
     *
     * @param workspaceId - Workspace ID (security filter)
     * @param conversationId - Conversation ID
     * @param customerId - Optional customer ID (additional security filter)
     * @returns Array of logs with summary
     */
    getConversationLogs(workspaceId, conversationId, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 🔒 SECURITY: If customerId provided, validate it belongs to workspace
                if (customerId) {
                    const customer = yield this.prisma.customers.findFirst({
                        where: {
                            id: customerId,
                            workspaceId,
                        },
                        select: { id: true },
                    });
                    if (!customer) {
                        throw new Error(`Customer ${customerId} does not belong to workspace ${workspaceId}`);
                    }
                }
                // Get all logs for conversation
                const logs = yield this.logRepository.findByConversation(workspaceId, conversationId, customerId);
                if (logs.length === 0) {
                    throw new Error(`No logs found for conversation ${conversationId}`);
                }
                // Calculate summary
                const totalExecutionTimeMs = logs.reduce((sum, log) => sum + log.executionTimeMs, 0);
                const totalTokensUsed = logs.reduce((sum, log) => sum + (log.tokensUsed || 0), 0);
                const hasErrors = logs.some((log) => log.hasError);
                const agentPipeline = logs.map((log) => ({
                    step: log.step,
                    agentType: log.agentType,
                    executionTimeMs: log.executionTimeMs,
                    tokensUsed: log.tokensUsed || 0,
                    hasError: log.hasError,
                }));
                return {
                    conversationId: logs[0].conversationId,
                    messageId: logs[0].messageId,
                    totalSteps: logs.length,
                    totalExecutionTimeMs,
                    totalTokensUsed,
                    hasErrors,
                    agentPipeline,
                };
            }
            catch (error) {
                logger_1.default.error("Error getting conversation logs:", error);
                throw error;
            }
        });
    }
    /**
     * Get agent performance metrics for a workspace
     *
     * Returns comprehensive analytics:
     * - Total interactions per agent
     * - Average confidence, execution time, tokens
     * - Error rates
     * - Cost estimation
     *
     * @param workspaceId - Workspace ID (security filter)
     * @param startDate - Optional start date for filtering
     * @param endDate - Optional end date for filtering
     * @returns Performance report with metrics
     */
    getAgentPerformanceMetrics(workspaceId, startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get metrics from repository
                const metrics = yield this.logRepository.getAgentPerformanceMetrics(workspaceId, startDate, endDate);
                // Get token usage stats
                const tokenStats = yield this.logRepository.getTokenUsageStats(workspaceId, startDate, endDate);
                // Estimate cost (rough estimation: $0.15 per 1M input tokens for GPT-4o-mini)
                // This is a simplified calculation - should use actual pricing per model
                const totalCost = (tokenStats.totalTokens / 1000000) * 0.15;
                return {
                    workspaceId,
                    dateRange: {
                        start: startDate || new Date(0), // Epoch if not provided
                        end: endDate || new Date(),
                    },
                    metrics,
                    totalTokens: tokenStats.totalTokens,
                    totalCost,
                };
            }
            catch (error) {
                logger_1.default.error("Error getting agent performance metrics:", error);
                throw error;
            }
        });
    }
    /**
     * Get error logs for debugging
     *
     * Returns recent logs with errors, sorted by date (newest first)
     *
     * @param workspaceId - Workspace ID (security filter)
     * @param limit - Maximum number of results (default: 50)
     * @returns Array of error logs
     */
    getErrorLogs(workspaceId_1) {
        return __awaiter(this, arguments, void 0, function* (workspaceId, limit = 50) {
            try {
                const errorLogs = yield this.logRepository.getErrorLogs(workspaceId, limit);
                // Format for easy debugging
                return errorLogs.map((log) => ({
                    id: log.id,
                    timestamp: log.createdAt,
                    agentType: log.agentType,
                    agentAction: log.agentAction,
                    conversationId: log.conversationId,
                    messageId: log.messageId,
                    step: log.step,
                    errorMessage: log.errorMessage,
                    inputMessage: log.inputMessage.substring(0, 100), // Truncate for overview
                    llmModel: log.llmModel,
                    executionTimeMs: log.executionTimeMs,
                }));
            }
            catch (error) {
                logger_1.default.error("Error getting error logs:", error);
                throw error;
            }
        });
    }
    /**
     * Get customer interaction history
     *
     * Returns recent agent interactions for a specific customer
     * Useful for customer support and debugging
     *
     * @param workspaceId - Workspace ID (security filter)
     * @param customerId - Customer ID
     * @param limit - Maximum number of results (default: 100)
     * @returns Array of customer interactions
     */
    getCustomerInteractionHistory(workspaceId_1, customerId_1) {
        return __awaiter(this, arguments, void 0, function* (workspaceId, customerId, limit = 100) {
            try {
                // 🔒 SECURITY: Validate customer belongs to workspace
                const customer = yield this.prisma.customers.findFirst({
                    where: {
                        id: customerId,
                        workspaceId,
                    },
                    select: { id: true, name: true },
                });
                if (!customer) {
                    throw new Error(`Customer ${customerId} does not belong to workspace ${workspaceId}`);
                }
                const logs = yield this.logRepository.findByCustomer(workspaceId, customerId, limit);
                // Group by conversation for better visualization
                const conversationMap = new Map();
                for (const log of logs) {
                    if (!conversationMap.has(log.conversationId)) {
                        conversationMap.set(log.conversationId, []);
                    }
                    conversationMap.get(log.conversationId).push(log);
                }
                return {
                    customerId,
                    customerName: customer.name,
                    totalInteractions: logs.length,
                    conversations: Array.from(conversationMap.entries()).map(([conversationId, logs]) => ({
                        conversationId,
                        messageCount: logs.length,
                        firstInteraction: logs[logs.length - 1].createdAt, // Oldest first
                        lastInteraction: logs[0].createdAt, // Newest first
                        agentsUsed: [...new Set(logs.map((l) => l.agentType))],
                        hasErrors: logs.some((l) => l.hasError),
                    })),
                };
            }
            catch (error) {
                logger_1.default.error("Error getting customer interaction history:", error);
                throw error;
            }
        });
    }
    /**
     * Get token usage breakdown by agent type
     *
     * Useful for cost optimization: identify which agents consume most tokens
     *
     * @param workspaceId - Workspace ID (security filter)
     * @param startDate - Optional start date
     * @param endDate - Optional end date
     * @returns Token usage by agent with cost estimation
     */
    getTokenUsageBreakdown(workspaceId, startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const stats = yield this.logRepository.getTokenUsageStats(workspaceId, startDate, endDate);
                // Calculate cost per agent (simplified: $0.15 per 1M tokens)
                const byAgentWithCost = stats.byAgent.map((agent) => ({
                    agentType: agent.agentType,
                    totalTokens: agent.totalTokens,
                    percentage: stats.totalTokens > 0
                        ? ((agent.totalTokens / stats.totalTokens) * 100).toFixed(2)
                        : "0.00",
                    estimatedCost: ((agent.totalTokens / 1000000) * 0.15).toFixed(4),
                }));
                return {
                    totalTokens: stats.totalTokens,
                    totalCost: ((stats.totalTokens / 1000000) * 0.15).toFixed(4),
                    byAgent: byAgentWithCost,
                    dateRange: {
                        start: startDate || new Date(0),
                        end: endDate || new Date(),
                    },
                };
            }
            catch (error) {
                logger_1.default.error("Error getting token usage breakdown:", error);
                throw error;
            }
        });
    }
    /**
     * Cleanup old logs (data retention policy)
     *
     * Deletes logs older than specified date
     * Should be run periodically (e.g., monthly cron job)
     *
     * @param workspaceId - Workspace ID (security filter)
     * @param olderThan - Delete logs older than this date
     * @returns Number of deleted logs
     */
    cleanupOldLogs(workspaceId, olderThan) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const count = yield this.logRepository.deleteOlderThan(workspaceId, olderThan);
                logger_1.default.info(`Cleaned up ${count} agent logs older than ${olderThan.toISOString()} for workspace ${workspaceId}`);
                return count;
            }
            catch (error) {
                logger_1.default.error("Error cleaning up old logs:", error);
                throw error;
            }
        });
    }
    /**
     * Get real-time statistics for monitoring dashboard
     *
     * @param workspaceId - Workspace ID (security filter)
     * @returns Real-time stats
     */
    getRealtimeStats(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const now = new Date();
                const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
                // Get metrics for last 24h and last hour
                const [metrics24h, metricsHour, errorLogs] = yield Promise.all([
                    this.logRepository.getAgentPerformanceMetrics(workspaceId, last24h, now),
                    this.logRepository.getAgentPerformanceMetrics(workspaceId, lastHour, now),
                    this.logRepository.getErrorLogs(workspaceId, 10),
                ]);
                // Calculate totals
                const total24h = metrics24h.reduce((sum, m) => sum + m.totalInteractions, 0);
                const totalHour = metricsHour.reduce((sum, m) => sum + m.totalInteractions, 0);
                const avgResponseTime24h = metrics24h.reduce((sum, m) => sum + (m.avgExecutionTimeMs || 0), 0) /
                    metrics24h.length;
                return {
                    last24Hours: {
                        totalInteractions: total24h,
                        avgResponseTimeMs: avgResponseTime24h,
                        errorRate: metrics24h.reduce((sum, m) => sum + m.errorRate, 0) /
                            metrics24h.length,
                    },
                    lastHour: {
                        totalInteractions: totalHour,
                    },
                    recentErrors: errorLogs.length,
                    status: errorLogs.length > 5 ? "warning" : "healthy",
                };
            }
            catch (error) {
                logger_1.default.error("Error getting realtime stats:", error);
                throw error;
            }
        });
    }
}
exports.AgentLoggerService = AgentLoggerService;
//# sourceMappingURL=agent-logger.service.js.map