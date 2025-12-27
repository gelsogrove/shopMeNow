"use strict";
/**
 * UserUnsubscribeService - Handles user account deletion with role-aware cascade logic
 *
 * OWNER: Cascades to entire workspace (all customers, orders, messages, agents)
 * AGENT: Isolated delete (only that user)
 *
 * SAFETY: All operations in transaction with workspaceId chain verification
 * AUDIT: Every deletion logged to SoftDeleteAuditLog with affected IDs
 * EMAIL: Notification sent to user AND admin for compliance
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
exports.UserUnsubscribeService = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const email_service_1 = require("../application/services/email.service");
class UserUnsubscribeService {
    constructor(prisma) {
        this.prisma = prisma;
        this.emailService = new email_service_1.EmailService();
    }
    /**
     * Initiate user account deletion (soft-delete)
     * Detects role and performs appropriate cascade
     */
    unsubscribeUser(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, reason = "User requested deletion") {
            // 1. Find user and verify it exists
            const user = yield this.prisma.user.findUnique({ where: { id: userId } });
            if (!user) {
                throw new Error(`User not found: ${userId}`);
            }
            if (user.deletedAt !== null) {
                throw new Error(`User already deleted: ${userId}`);
            }
            // 2. Determine role and cascade type
            const ownedWorkspaces = yield this.prisma.workspace.findMany({
                where: { ownerId: userId },
            });
            const isOwner = ownedWorkspaces.length > 0;
            if (isOwner) {
                return yield this.deleteOwner(userId, reason, ownedWorkspaces[0].id);
            }
            else {
                return yield this.deleteAgent(userId, reason);
            }
        });
    }
    /**
     * Delete OWNER - Cascade to entire workspace and all customers
     */
    deleteOwner(userId, reason, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const deletedDate = new Date();
            const permanentDeleteDate = new Date(deletedDate);
            permanentDeleteDate.setDate(permanentDeleteDate.getDate() + 90);
            try {
                const result = yield this.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    // 1. Verify chain: User -> Workspace
                    const user = yield tx.user.findUnique({ where: { id: userId } });
                    const workspace = yield tx.workspace.findUnique({ where: { id: workspaceId } });
                    if (!user || !workspace || workspace.ownerId !== userId) {
                        throw new Error("Owner verification failed - security chain broken");
                    }
                    // 2. Count affected records BEFORE deletion (all filtered by workspaceId for accuracy)
                    const customerCount = yield tx.customers.count({ where: { workspaceId, deletedAt: null } });
                    const orderCount = yield tx.orders.count({ where: { workspaceId, deletedAt: null } });
                    const messageCount = yield tx.message.count({ where: { chatSession: { workspaceId }, deletedAt: null } });
                    const agentCount = yield tx.userWorkspace.count({ where: { workspaceId } });
                    const sessionCount = yield tx.chatSession.count({ where: { workspaceId, deletedAt: null } });
                    // 3. Soft-delete in order of dependencies
                    // First delete messages, chat sessions, orders, customers
                    yield tx.message.updateMany({
                        where: { chatSession: { workspaceId } },
                        data: { deletedAt: deletedDate }
                    });
                    yield tx.chatSession.updateMany({
                        where: { workspaceId },
                        data: { deletedAt: deletedDate }
                    });
                    yield tx.orderItems.updateMany({
                        where: { order: { workspaceId } },
                        data: { deletedAt: deletedDate }
                    });
                    yield tx.orders.updateMany({
                        where: { workspaceId },
                        data: { deletedAt: deletedDate }
                    });
                    yield tx.customers.updateMany({
                        where: { workspaceId },
                        data: { deletedAt: deletedDate }
                    });
                    // Then handle agents in workspace
                    // IMPORTANT: Don't soft-delete agents - they should be able to login and create their own workspace!
                    const agents = yield tx.userWorkspace.findMany({
                        where: { workspaceId, userId: { not: userId } } // Exclude owner
                    });
                    for (const agent of agents) {
                        // Remove the agent from THIS workspace only
                        yield tx.userWorkspace.delete({
                            where: {
                                userId_workspaceId: {
                                    userId: agent.userId,
                                    workspaceId
                                }
                            }
                        });
                        // Check remaining workspaces for logging
                        const remainingWorkspaces = yield tx.userWorkspace.count({
                            where: { userId: agent.userId }
                        });
                        if (remainingWorkspaces === 0) {
                            // Agent has no workspaces left - but DON'T delete their user!
                            // They can login and will see "Create My Channel" form to become an owner
                            logger_1.default.info(`Agent ${agent.userId} removed from last workspace - can login and create their own channel`);
                        }
                        else {
                            logger_1.default.info(`Agent ${agent.userId} removed from workspace (has ${remainingWorkspaces} other workspaces)`);
                        }
                    }
                    // Finally delete workspace and owner user
                    yield tx.workspace.update({ where: { id: workspaceId }, data: { deletedAt: deletedDate } });
                    yield tx.user.update({ where: { id: userId }, data: { deletedAt: deletedDate } });
                    // 4. Log to audit trail
                    yield tx.softDeleteAuditLog.create({
                        data: {
                            workspaceId,
                            entityType: "OWNER_CASCADE",
                            deletedIds: [userId, workspaceId],
                            deletedIdCount: 1 + customerCount + orderCount + messageCount + sessionCount, // Only owner + data, not agents
                            reason,
                            deletedByUserId: userId, // Self-initiated
                        },
                    });
                    return {
                        success: true,
                        message: `Owner account deleted with full workspace cascade`,
                        cascadeType: "OWNER_CASCADE",
                        affectedRecords: {
                            workspaces: 1,
                            customers: customerCount,
                            orders: orderCount,
                            messages: messageCount,
                            chatSessions: sessionCount,
                            agents: agentCount,
                        },
                        deletedDate,
                        permanentDeleteDate,
                    };
                }));
                logger_1.default.info(`Owner unsubscribed: userId=${userId}, workspaceId=${workspaceId}`, {
                    cascadeType: "OWNER_CASCADE",
                    affected: result.affectedRecords,
                });
                // 📧 Send notification email to user and admin
                try {
                    const user = yield this.prisma.user.findUnique({ where: { id: userId } });
                    const workspace = yield this.prisma.workspace.findUnique({ where: { id: workspaceId } });
                    if (user === null || user === void 0 ? void 0 : user.email) {
                        yield this.emailService.sendUnsubscribeNotification({
                            userEmail: user.email,
                            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                            workspaceName: workspace === null || workspace === void 0 ? void 0 : workspace.name,
                            cascadeType: "OWNER_CASCADE",
                            permanentDeleteDate: result.permanentDeleteDate,
                            adminEmail: (workspace === null || workspace === void 0 ? void 0 : workspace.notificationEmail) || undefined,
                        });
                    }
                }
                catch (emailError) {
                    logger_1.default.error("Failed to send unsubscribe email notification:", emailError);
                    // Don't fail the operation - email is non-critical
                }
                return result;
            }
            catch (error) {
                logger_1.default.error(`Failed to unsubscribe owner: ${userId}`, error);
                throw error;
            }
        });
    }
    /**
     * Delete AGENT - Isolated delete (workspace unaffected)
     */
    deleteAgent(userId, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            const deletedDate = new Date();
            const permanentDeleteDate = new Date(deletedDate);
            permanentDeleteDate.setDate(permanentDeleteDate.getDate() + 90);
            try {
                yield this.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    // Get user's workspace(s) for audit
                    const workspaces = yield tx.userWorkspace.findMany({ where: { userId } });
                    // Soft-delete only this user
                    yield tx.user.update({
                        where: { id: userId },
                        data: { deletedAt: deletedDate },
                    });
                    // Log to audit trail (one entry per workspace)
                    for (const ws of workspaces) {
                        yield tx.softDeleteAuditLog.create({
                            data: {
                                workspaceId: ws.workspaceId,
                                entityType: "AGENT_ISOLATED",
                                deletedIds: [userId],
                                deletedIdCount: 1,
                                reason,
                                deletedByUserId: userId, // Self-initiated
                            },
                        });
                    }
                }));
                logger_1.default.info(`Agent unsubscribed: userId=${userId}`, {
                    cascadeType: "AGENT_ISOLATED",
                });
                // 📧 Send notification email to user and admin
                try {
                    const user = yield this.prisma.user.findUnique({ where: { id: userId } });
                    if (user === null || user === void 0 ? void 0 : user.email) {
                        yield this.emailService.sendUnsubscribeNotification({
                            userEmail: user.email,
                            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                            cascadeType: "AGENT_ISOLATED",
                            permanentDeleteDate,
                        });
                    }
                }
                catch (emailError) {
                    logger_1.default.error("Failed to send unsubscribe email notification:", emailError);
                    // Don't fail the operation - email is non-critical
                }
                return {
                    success: true,
                    message: `Agent account deleted (isolated)`,
                    cascadeType: "AGENT_ISOLATED",
                    affectedRecords: {
                        agents: 1,
                    },
                    deletedDate,
                    permanentDeleteDate,
                };
            }
            catch (error) {
                logger_1.default.error(`Failed to unsubscribe agent: ${userId}`, error);
                throw error;
            }
        });
    }
}
exports.UserUnsubscribeService = UserUnsubscribeService;
//# sourceMappingURL=user-unsubscribe.service.js.map