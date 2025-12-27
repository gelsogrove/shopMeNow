"use strict";
/**
 * SearchConversationRepository
 *
 * Manages conversational state for product search sessions.
 * Provides 10-minute memory for contextual searches.
 *
 * Use cases:
 * - Store last query/response for context refinement
 * - Track active/completed/abandoned sessions
 * - Auto-expire sessions after 10 minutes inactivity
 * - Enable conversational queries like "show only organic ones"
 *
 * Security:
 * - ALL queries filtered by workspaceId
 * - sessionId indexed for fast lookups
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
exports.SearchConversationRepository = void 0;
const database_1 = require("@echatbot/database");
const prisma_1 = require("../lib/prisma");
const logger_1 = __importDefault(require("../utils/logger"));
class SearchConversationRepository {
    /**
     * Find active conversation by sessionId
     * Returns null if not found or expired
     */
    findBySessionId(sessionId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const conversation = yield prisma_1.prisma.searchConversations.findFirst({
                    where: {
                        sessionId,
                        workspaceId,
                        expiresAt: {
                            gte: new Date(), // Not expired
                        },
                    },
                });
                return conversation;
            }
            catch (error) {
                logger_1.default.error("Error finding search conversation:", error);
                return null;
            }
        });
    }
    /**
     * Create new search conversation
     * Auto-sets expiresAt to 10 minutes from now
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
                const conversation = yield prisma_1.prisma.searchConversations.create({
                    data: {
                        sessionId: data.sessionId,
                        workspaceId: data.workspaceId,
                        customerId: data.customerId,
                        state: database_1.SearchConversationState.ACTIVE,
                        lastQuery: data.lastQuery,
                        lastResponse: data.lastResponse || null,
                        metadata: data.metadata || null,
                        expiresAt,
                    },
                });
                logger_1.default.info(`✅ Created search conversation`, {
                    sessionId: data.sessionId,
                    customerId: data.customerId,
                    expiresAt,
                });
                return conversation;
            }
            catch (error) {
                logger_1.default.error("Error creating search conversation:", error);
                throw error;
            }
        });
    }
    /**
     * Update existing conversation
     * Resets expiresAt to 10 minutes from now
     */
    update(sessionId, workspaceId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // Reset to 10 minutes
                const conversation = yield prisma_1.prisma.searchConversations.updateMany({
                    where: {
                        sessionId,
                        workspaceId,
                    },
                    data: Object.assign(Object.assign({}, data), { expiresAt, updatedAt: new Date() }),
                });
                if (conversation.count === 0) {
                    logger_1.default.warn(`⚠️ No search conversation found to update`, {
                        sessionId,
                        workspaceId,
                    });
                    return null;
                }
                logger_1.default.info(`✅ Updated search conversation`, {
                    sessionId,
                    updatedFields: Object.keys(data),
                });
                // Fetch updated conversation
                return yield this.findBySessionId(sessionId, workspaceId);
            }
            catch (error) {
                logger_1.default.error("Error updating search conversation:", error);
                throw error;
            }
        });
    }
    /**
     * Upsert conversation (create or update)
     * Uses Prisma's native upsert to avoid race conditions
     */
    upsert(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
                const conversation = yield prisma_1.prisma.searchConversations.upsert({
                    where: {
                        sessionId: data.sessionId,
                    },
                    update: {
                        lastQuery: data.lastQuery,
                        lastResponse: data.lastResponse || null,
                        state: data.state || database_1.SearchConversationState.ACTIVE,
                        metadata: data.metadata || null,
                        expiresAt, // Reset expiry on update
                        updatedAt: new Date(),
                    },
                    create: {
                        sessionId: data.sessionId,
                        workspaceId: data.workspaceId,
                        customerId: data.customerId,
                        state: data.state || database_1.SearchConversationState.ACTIVE,
                        lastQuery: data.lastQuery,
                        lastResponse: data.lastResponse || null,
                        metadata: data.metadata || null,
                        expiresAt,
                    },
                });
                logger_1.default.info(`✅ Upserted search conversation`, {
                    sessionId: data.sessionId,
                    customerId: data.customerId,
                    isNew: conversation.createdAt.getTime() === conversation.updatedAt.getTime(),
                    expiresAt,
                });
                return conversation;
            }
            catch (error) {
                logger_1.default.error("Error upserting search conversation:", error);
                throw error;
            }
        });
    }
    /**
     * Mark conversation as completed
     */
    markCompleted(sessionId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield prisma_1.prisma.searchConversations.updateMany({
                    where: {
                        sessionId,
                        workspaceId,
                    },
                    data: {
                        state: database_1.SearchConversationState.COMPLETED,
                        updatedAt: new Date(),
                    },
                });
                logger_1.default.info(`✅ Marked conversation as completed`, { sessionId });
            }
            catch (error) {
                logger_1.default.error("Error marking conversation completed:", error);
            }
        });
    }
    /**
     * Mark conversation as abandoned
     */
    markAbandoned(sessionId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield prisma_1.prisma.searchConversations.updateMany({
                    where: {
                        sessionId,
                        workspaceId,
                    },
                    data: {
                        state: database_1.SearchConversationState.ABANDONED,
                        updatedAt: new Date(),
                    },
                });
                logger_1.default.info(`✅ Marked conversation as abandoned`, { sessionId });
            }
            catch (error) {
                logger_1.default.error("Error marking conversation abandoned:", error);
            }
        });
    }
    /**
     * Mark expired conversations (called by cronjob)
     * Changes state to EXPIRED for sessions past expiresAt
     * 🔒 SECURITY: workspaceId is MANDATORY
     */
    markExpired(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 🔒 SECURITY: workspaceId is MANDATORY for isolation
                if (!workspaceId) {
                    logger_1.default.error("markExpired: workspaceId is required");
                    throw new Error("workspaceId is mandatory for marking expired conversations");
                }
                const where = {
                    expiresAt: {
                        lt: new Date(), // Past expiration
                    },
                    state: database_1.SearchConversationState.ACTIVE, // Only active ones
                    workspaceId: workspaceId, // 🔒 Hard requirement
                };
                const result = yield prisma_1.prisma.searchConversations.updateMany({
                    where,
                    data: {
                        state: database_1.SearchConversationState.EXPIRED,
                        updatedAt: new Date(),
                    },
                });
                if (result.count > 0) {
                    logger_1.default.info(`✅ Marked ${result.count} conversations as expired in workspace ${workspaceId}`);
                }
                return result.count;
            }
            catch (error) {
                logger_1.default.error("Error marking conversations expired:", error);
                return 0;
            }
        });
    }
    /**
     * Delete old conversations (called by cronjob)
     * Removes conversations older than 30 days
     * 🔒 SECURITY: workspaceId is MANDATORY
     */
    deleteOld() {
        return __awaiter(this, arguments, void 0, function* (daysOld = 30, workspaceId) {
            try {
                // 🔒 SECURITY: workspaceId is MANDATORY for isolation
                if (!workspaceId) {
                    logger_1.default.error("deleteOld: workspaceId is required");
                    throw new Error("workspaceId is mandatory for deleting old conversations");
                }
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - daysOld);
                const where = {
                    createdAt: {
                        lt: cutoffDate,
                    },
                    workspaceId: workspaceId, // 🔒 Hard requirement
                };
                const result = yield prisma_1.prisma.searchConversations.deleteMany({
                    where,
                });
                if (result.count > 0) {
                    logger_1.default.info(`✅ Deleted ${result.count} conversations older than ${daysOld} days in workspace ${workspaceId}`);
                }
                return result.count;
            }
            catch (error) {
                logger_1.default.error("Error deleting old conversations:", error);
                return 0;
            }
        });
    }
    /**
     * Get conversation statistics for a workspace
     */
    getStats(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [total, active, completed, abandoned, expired] = yield Promise.all([
                    prisma_1.prisma.searchConversations.count({ where: { workspaceId } }),
                    prisma_1.prisma.searchConversations.count({
                        where: { workspaceId, state: database_1.SearchConversationState.ACTIVE },
                    }),
                    prisma_1.prisma.searchConversations.count({
                        where: { workspaceId, state: database_1.SearchConversationState.COMPLETED },
                    }),
                    prisma_1.prisma.searchConversations.count({
                        where: { workspaceId, state: database_1.SearchConversationState.ABANDONED },
                    }),
                    prisma_1.prisma.searchConversations.count({
                        where: { workspaceId, state: database_1.SearchConversationState.EXPIRED },
                    }),
                ]);
                return { total, active, completed, abandoned, expired };
            }
            catch (error) {
                logger_1.default.error("Error getting conversation stats:", error);
                return { total: 0, active: 0, completed: 0, abandoned: 0, expired: 0 };
            }
        });
    }
}
exports.SearchConversationRepository = SearchConversationRepository;
//# sourceMappingURL=searchConversation.repository.js.map