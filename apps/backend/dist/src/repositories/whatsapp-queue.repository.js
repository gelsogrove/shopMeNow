"use strict";
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
exports.WhatsAppQueueRepository = void 0;
// Internal core
const logger_1 = __importDefault(require("../utils/logger"));
class WhatsAppQueueRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Find all queue messages for a workspace
     * @param workspaceId Workspace ID (workspace isolation)
     * @param status Optional status filter (pending, sent, error)
     * @returns Array of queue messages
     */
    findByWorkspace(workspaceId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const where = { workspaceId };
                if (status) {
                    where.status = status;
                }
                return yield this.prisma.whatsAppQueue.findMany({
                    where,
                    include: {
                        customer: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true,
                            },
                        },
                        workspace: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "desc", // Most recent first (descending order)
                    },
                });
            }
            catch (error) {
                logger_1.default.error(`[WhatsAppQueueRepository] Error in findByWorkspace:`, error);
                throw error;
            }
        });
    }
    /**
     * Find pending messages for processing (FIFO order)
     * @param workspaceId Workspace ID (workspace isolation)
     * @param limit Number of messages to fetch (default: 1)
     * @returns First pending message or null
     */
    findPending(workspaceId_1) {
        return __awaiter(this, arguments, void 0, function* (workspaceId, limit = 1) {
            try {
                const messages = yield this.prisma.whatsAppQueue.findMany({
                    where: {
                        workspaceId,
                        status: "pending",
                    },
                    include: {
                        customer: {
                            select: {
                                id: true,
                                name: true,
                                phone: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "asc", // FIFO: oldest first
                    },
                    take: limit,
                });
                return messages.length > 0 ? messages[0] : null;
            }
            catch (error) {
                logger_1.default.error(`[WhatsAppQueueRepository] Error in findPending:`, error);
                throw error;
            }
        });
    }
    /**
     * Create a new queue message
     * @param data Message data
     * @returns Created message
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug(`[WhatsAppQueueRepository] Creating queue message for workspace ${data.workspaceId}`);
            try {
                const result = yield this.prisma.whatsAppQueue.create({
                    data: {
                        workspaceId: data.workspaceId,
                        customerId: data.customerId,
                        phoneNumber: data.phoneNumber,
                        messageContent: data.messageContent,
                        status: data.status || "pending",
                        errorMessage: data.errorMessage,
                        conversationMessageId: data.conversationMessageId,
                    },
                });
                logger_1.default.debug(`[WhatsAppQueueRepository] Created queue message: ${result.id}`);
                return result;
            }
            catch (error) {
                logger_1.default.error(`[WhatsAppQueueRepository] Error in create:`, error);
                throw error;
            }
        });
    }
    /**
     * Update message status
     * @param id Message ID
     * @param status New status (sent, error)
     * @param error Optional error message
     */
    updateStatus(id, status, error) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.prisma.whatsAppQueue.update({
                    where: { id },
                    data: {
                        status,
                        errorMessage: error,
                        deliveredAt: status === "sent" ? new Date() : undefined,
                    },
                });
            }
            catch (error) {
                logger_1.default.error(`[WhatsAppQueueRepository] Error in updateStatus:`, error);
                throw error;
            }
        });
    }
    /**
     * Delete message from queue
     * @param id Message ID
     * @param workspaceId Workspace ID for security validation
     */
    delete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // SECURITY: First verify the message belongs to this workspace
                const message = yield this.prisma.whatsAppQueue.findUnique({
                    where: { id },
                    select: { workspaceId: true }
                });
                if (!message) {
                    throw new Error('Queue message not found');
                }
                if (message.workspaceId !== workspaceId) {
                    logger_1.default.warn('🚨 SECURITY: Attempted cross-workspace queue message deletion', {
                        messageId: id,
                        requestedWorkspaceId: workspaceId,
                        actualWorkspaceId: message.workspaceId
                    });
                    throw new Error('Queue message not found'); // Don't reveal it exists in another workspace
                }
                yield this.prisma.whatsAppQueue.delete({
                    where: { id },
                });
            }
            catch (error) {
                logger_1.default.error(`[WhatsAppQueueRepository] Error in delete:`, error);
                throw error;
            }
        });
    }
    /**
     * Check for duplicate messages (deduplication)
     * @param customerId Customer ID
     * @param content Message content
     * @param withinMinutes Time window in minutes (default: 1)
     * @returns True if duplicate exists
     */
    checkDuplicate(customerId_1, content_1) {
        return __awaiter(this, arguments, void 0, function* (customerId, content, withinMinutes = 1) {
            try {
                const timeThreshold = new Date(Date.now() - withinMinutes * 60 * 1000);
                const existing = yield this.prisma.whatsAppQueue.findFirst({
                    where: {
                        customerId,
                        messageContent: content,
                        createdAt: {
                            gte: timeThreshold,
                        },
                    },
                });
                return existing !== null;
            }
            catch (error) {
                logger_1.default.error(`[WhatsAppQueueRepository] Error in checkDuplicate:`, error);
                throw error;
            }
        });
    }
    /**
     * Get message by ID with workspace validation
     * @param id Message ID
     * @param workspaceId Workspace ID (workspace isolation)
     * @returns Message or null
     */
    findById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.prisma.whatsAppQueue.findFirst({
                    where: {
                        id,
                        workspaceId,
                    },
                    include: {
                        customer: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true,
                            },
                        },
                    },
                });
            }
            catch (error) {
                logger_1.default.error(`[WhatsAppQueueRepository] Error in findById:`, error);
                throw error;
            }
        });
    }
    /**
     * Count messages by status for a workspace
     * @param workspaceId Workspace ID
     * @returns Object with counts per status
     */
    countByStatus(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [pending, sent, error, total] = yield Promise.all([
                    this.prisma.whatsAppQueue.count({
                        where: { workspaceId, status: "pending" },
                    }),
                    this.prisma.whatsAppQueue.count({
                        where: { workspaceId, status: "sent" },
                    }),
                    this.prisma.whatsAppQueue.count({
                        where: { workspaceId, status: "error" },
                    }),
                    this.prisma.whatsAppQueue.count({
                        where: { workspaceId },
                    }),
                ]);
                return { pending, sent, error, total };
            }
            catch (error) {
                logger_1.default.error(`[WhatsAppQueueRepository] Error in countByStatus:`, error);
                throw error;
            }
        });
    }
}
exports.WhatsAppQueueRepository = WhatsAppQueueRepository;
//# sourceMappingURL=whatsapp-queue.repository.js.map