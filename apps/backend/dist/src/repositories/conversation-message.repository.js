"use strict";
/**
 * ConversationMessageRepository
 *
 * Repository for managing conversation history messages.
 * Used by LLM Router to maintain context across multiple interactions.
 *
 * Key Methods:
 * - saveMessage: Save single message to history
 * - getHistory: Get conversation history for LLM context
 * - cleanupOldMessages: Delete messages older than retention period
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation)
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
exports.ConversationMessageRepository = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
class ConversationMessageRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Save a message to conversation history
     */
    saveMessage(params) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const message = yield this.prisma.conversationMessage.create({
                    data: {
                        workspaceId: params.workspaceId,
                        customerId: params.customerId,
                        conversationId: params.conversationId,
                        role: params.role,
                        content: params.content,
                        agentType: params.agentType,
                        functionName: params.functionName,
                        functionArguments: params.functionArguments,
                        tokensUsed: params.tokensUsed,
                        deliveryStatus: params.deliveryStatus || "pending", // ✅ Default to "pending" if not specified
                        debugInfo: params.debugInfo
                            ? JSON.stringify(params.debugInfo)
                            : undefined, // ✅ Save debug info as JSON string
                    },
                });
                logger_1.default.debug(`Saved conversation message: ${params.role} in ${params.conversationId}`, {
                    messageId: message.id,
                    deliveryStatus: message.deliveryStatus,
                });
                return message.id;
            }
            catch (error) {
                logger_1.default.error("Error saving conversation message:", error);
                throw error;
            }
        });
    }
    /**
     * Get conversation history for LLM context
     *
     * @param workspaceId - Workspace ID (security filter)
     * @param conversationId - Conversation ID
     * @param limit - Max messages to return (default: 20, last 20 messages)
     * @param excludeFunctionCalls - If true, exclude function messages (default: false for LLM context)
     * @returns Array of messages formatted for LLM
     */
    getHistory(workspaceId_1, conversationId_1) {
        return __awaiter(this, arguments, void 0, function* (workspaceId, conversationId, limit = 20, excludeFunctionCalls = false // ✅ NEW: Option to hide function messages
        ) {
            try {
                const messages = yield this.prisma.conversationMessage.findMany({
                    where: Object.assign({ workspaceId,
                        conversationId }, (excludeFunctionCalls && {
                        role: {
                            not: "function",
                        },
                    })),
                    orderBy: {
                        createdAt: "asc", // Chronological order
                    },
                    take: limit,
                    select: {
                        role: true,
                        content: true,
                        functionName: true,
                    },
                });
                // Format for OpenRouter API
                return messages.map((msg) => (Object.assign({ role: msg.role, content: msg.content }, (msg.functionName && { name: msg.functionName }))));
            }
            catch (error) {
                logger_1.default.error("Error getting conversation history:", error);
                throw error;
            }
        });
    }
    /**
     * Get conversation history by time window (for ConversationManager)
     *
     * @param workspaceId - Workspace ID (security filter)
     * @param conversationId - Conversation ID
     * @param sinceTime - Get messages after this timestamp
     * @returns Array of messages formatted for LLM
     */
    getHistoryByTime(workspaceId, conversationId, sinceTime) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const messages = yield this.prisma.conversationMessage.findMany({
                    where: {
                        workspaceId,
                        conversationId,
                        createdAt: {
                            gte: sinceTime,
                        },
                    },
                    orderBy: {
                        createdAt: "asc", // Chronological order
                    },
                    select: {
                        role: true,
                        content: true,
                        functionName: true,
                    },
                });
                // Format for OpenRouter API
                return messages.map((msg) => (Object.assign({ role: msg.role, content: msg.content }, (msg.functionName && { name: msg.functionName }))));
            }
            catch (error) {
                logger_1.default.error("Error getting conversation history by time:", error);
                throw error;
            }
        });
    }
    /**
     * Count messages in a conversation
     */
    countMessages(workspaceId, conversationId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.prisma.conversationMessage.count({
                    where: {
                        workspaceId,
                        conversationId,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Error counting conversation messages:", error);
                throw error;
            }
        });
    }
    /**
     * Delete old messages (data retention policy)
     *
     * @param workspaceId - Workspace ID
     * @param olderThan - Delete messages older than this date
     * @returns Number of deleted messages
     */
    cleanupOldMessages(workspaceId, olderThan) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.prisma.conversationMessage.deleteMany({
                    where: {
                        workspaceId,
                        createdAt: {
                            lt: olderThan,
                        },
                    },
                });
                logger_1.default.info(`Cleaned up ${result.count} old conversation messages for workspace ${workspaceId}`);
                return result.count;
            }
            catch (error) {
                logger_1.default.error("Error cleaning up old messages:", error);
                throw error;
            }
        });
    }
    /**
     * Delete all messages for a conversation
     * (e.g., GDPR compliance or user request)
     */
    deleteConversation(workspaceId, conversationId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.prisma.conversationMessage.deleteMany({
                    where: {
                        workspaceId,
                        conversationId,
                    },
                });
                logger_1.default.info(`Deleted conversation ${conversationId}: ${result.count} messages`);
                return result.count;
            }
            catch (error) {
                logger_1.default.error("Error deleting conversation:", error);
                throw error;
            }
        });
    }
    /**
     * Update delivery status for a message
     * Used when enqueue fails after message was saved
     */
    updateDeliveryStatus(messageId, deliveryStatus) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.prisma.conversationMessage.update({
                    where: { id: messageId },
                    data: { deliveryStatus },
                });
                logger_1.default.debug(`Updated delivery status for message ${messageId} to ${deliveryStatus}`);
            }
            catch (error) {
                logger_1.default.error("Error updating delivery status:", error);
                throw error;
            }
        });
    }
    /**
     * Get customer's recent conversations
     * (for customer support / debugging)
     */
    getCustomerConversations(workspaceId_1, customerId_1) {
        return __awaiter(this, arguments, void 0, function* (workspaceId, customerId, limit = 10) {
            try {
                const conversations = yield this.prisma.conversationMessage.groupBy({
                    by: ["conversationId"],
                    where: {
                        workspaceId,
                        customerId,
                    },
                    _count: {
                        id: true,
                    },
                    _max: {
                        createdAt: true,
                    },
                    orderBy: {
                        _max: {
                            createdAt: "desc",
                        },
                    },
                    take: limit,
                });
                return conversations.map((conv) => ({
                    conversationId: conv.conversationId,
                    messageCount: conv._count.id,
                    lastMessage: conv._max.createdAt,
                }));
            }
            catch (error) {
                logger_1.default.error("Error getting customer conversations:", error);
                throw error;
            }
        });
    }
}
exports.ConversationMessageRepository = ConversationMessageRepository;
//# sourceMappingURL=conversation-message.repository.js.map