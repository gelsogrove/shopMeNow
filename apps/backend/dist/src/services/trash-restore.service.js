"use strict";
/**
 * TrashRestoreService - Handles restoration of soft-deleted items
 *
 * Verifies:
 * - Item is soft-deleted (deletedAt != null)
 * - Item is within 90-day retention window
 * - All cascade relations exist
 *
 * Restores:
 * - Target item
 * - All related records in cascade (orders, messages, sessions, etc.)
 *
 * SAFETY: Transaction-based with audit logging
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
exports.TrashRestoreService = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const soft_delete_helper_1 = require("../utils/soft-delete.helper");
class TrashRestoreService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Restore a soft-deleted customer and all related data
     */
    restoreCustomer(customerId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    // 1. Find customer and verify soft-deleted
                    const customer = yield tx.customers.findUnique({
                        where: { id: customerId },
                    });
                    if (!customer) {
                        throw new Error(`Customer not found: ${customerId}`);
                    }
                    if (customer.deletedAt === null) {
                        throw new Error(`Customer not deleted: ${customerId}`);
                    }
                    // Verify within retention window
                    if (!this.isWithinRetentionWindow(customer.deletedAt)) {
                        throw new Error(`Customer outside retention window (hard-delete eligible): ${(0, soft_delete_helper_1.getDaysUntilPermanentDelete)(customer.deletedAt, (0, soft_delete_helper_1.getRetentionDaysConfig)())} days remaining`);
                    }
                    // 2. Verify workspaceId match
                    if (customer.workspaceId !== workspaceId) {
                        throw new Error("Workspace ID mismatch - security check failed");
                    }
                    const restoredAt = new Date();
                    // 3. Restore cascade in order
                    const cascade = {
                        messages: 0,
                        chatSessions: 0,
                        orderItems: 0,
                        orders: 0,
                    };
                    // Messages
                    const msgResult = yield tx.message.updateMany({
                        where: { chatSession: { customerId, deletedAt: { not: null } } },
                        data: { deletedAt: null }
                    });
                    cascade.messages = msgResult.count;
                    // Chat sessions
                    const sessionResult = yield tx.chatSession.updateMany({
                        where: { customerId, deletedAt: { not: null } },
                        data: { deletedAt: null }
                    });
                    cascade.chatSessions = sessionResult.count;
                    // Order items
                    const itemsResult = yield tx.orderItems.updateMany({
                        where: { order: { customerId, deletedAt: { not: null } } },
                        data: { deletedAt: null }
                    });
                    cascade.orderItems = itemsResult.count;
                    // Orders
                    const orderResult = yield tx.orders.updateMany({
                        where: { customerId, deletedAt: { not: null } },
                        data: { deletedAt: null }
                    });
                    cascade.orders = orderResult.count;
                    // Finally restore customer
                    yield tx.customers.update({
                        where: { id: customerId },
                        data: { deletedAt: null },
                    });
                    // 4. Log restoration to audit trail
                    yield tx.softDeleteAuditLog.create({
                        data: {
                            workspaceId,
                            entityType: "CUSTOMER_RESTORED",
                            deletedIds: [customerId],
                            deletedIdCount: 1 + cascade.orders + cascade.messages + cascade.chatSessions,
                            reason: "Admin initiated restore",
                            deletedByUserId: null, // Will be set by caller if needed
                        },
                    });
                    return {
                        success: true,
                        message: "Customer restored successfully",
                        entityType: "CUSTOMER",
                        cascadeRestored: cascade,
                        restoredAt,
                    };
                }));
                logger_1.default.info(`Customer restored: ${customerId}`, {
                    cascade: result.cascadeRestored,
                });
                return result;
            }
            catch (error) {
                logger_1.default.error(`Failed to restore customer: ${customerId}`, error);
                throw error;
            }
        });
    }
    /**
     * Restore a soft-deleted workspace and all related data
     */
    restoreWorkspace(workspaceId, adminUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    // 1. Find workspace and verify soft-deleted
                    const workspace = yield tx.workspace.findUnique({
                        where: { id: workspaceId },
                    });
                    if (!workspace) {
                        throw new Error(`Workspace not found: ${workspaceId}`);
                    }
                    if (workspace.deletedAt === null) {
                        throw new Error(`Workspace not deleted: ${workspaceId}`);
                    }
                    // Verify within retention window
                    if (!this.isWithinRetentionWindow(workspace.deletedAt)) {
                        throw new Error(`Workspace outside retention window: ${(0, soft_delete_helper_1.getDaysUntilPermanentDelete)(workspace.deletedAt, (0, soft_delete_helper_1.getRetentionDaysConfig)())} days remaining`);
                    }
                    const restoredAt = new Date();
                    const cascade = {
                        messages: 0,
                        chatSessions: 0,
                        orders: 0,
                        customers: 0,
                        agents: 0,
                    };
                    // 2. Restore all cascade
                    // Messages
                    const msgResult = yield tx.message.updateMany({
                        where: { chatSession: { workspaceId, deletedAt: { not: null } } },
                        data: { deletedAt: null }
                    });
                    cascade.messages = msgResult.count;
                    // Chat sessions
                    const sessionResult = yield tx.chatSession.updateMany({
                        where: { workspaceId, deletedAt: { not: null } },
                        data: { deletedAt: null }
                    });
                    cascade.chatSessions = sessionResult.count;
                    // Orders
                    const orderResult = yield tx.orders.updateMany({
                        where: { workspace: { id: workspaceId }, deletedAt: { not: null } },
                        data: { deletedAt: null }
                    });
                    cascade.orders = orderResult.count;
                    // Customers
                    const customerResult = yield tx.customers.updateMany({
                        where: { workspaceId, deletedAt: { not: null } },
                        data: { deletedAt: null }
                    });
                    cascade.customers = customerResult.count;
                    // Agents
                    const agents = yield tx.userWorkspace.findMany({
                        where: { workspaceId },
                        select: { userId: true },
                    });
                    for (const agent of agents) {
                        const updated = yield tx.user.update({
                            where: { id: agent.userId },
                            data: { deletedAt: null },
                        });
                        if (updated.deletedAt === null)
                            cascade.agents++;
                    }
                    // Finally restore workspace
                    yield tx.workspace.update({
                        where: { id: workspaceId },
                        data: {
                            deletedAt: null,
                            isDelete: false, // Also reset legacy isDelete flag
                        },
                    });
                    // 3. Log restoration
                    yield tx.softDeleteAuditLog.create({
                        data: {
                            workspaceId,
                            entityType: "WORKSPACE_RESTORED",
                            deletedIds: [workspaceId],
                            deletedIdCount: 1 + cascade.customers + cascade.orders + cascade.messages,
                            reason: `Admin initiated restore (${adminUserId})`,
                            deletedByUserId: adminUserId,
                        },
                    });
                    return {
                        success: true,
                        message: "Workspace restored successfully",
                        entityType: "WORKSPACE",
                        cascadeRestored: cascade,
                        restoredAt,
                    };
                }));
                logger_1.default.info(`Workspace restored: ${workspaceId}`, {
                    cascade: result.cascadeRestored,
                    admin: adminUserId,
                });
                return result;
            }
            catch (error) {
                logger_1.default.error(`Failed to restore workspace: ${workspaceId}`, error);
                throw error;
            }
        });
    }
    /**
     * Check if a soft-deleted item is within retention window
     */
    isWithinRetentionWindow(deletedAt) {
        const retentionDays = (0, soft_delete_helper_1.getRetentionDaysConfig)();
        const expiryDate = new Date(deletedAt);
        expiryDate.setDate(expiryDate.getDate() + retentionDays);
        return expiryDate > new Date();
    }
}
exports.TrashRestoreService = TrashRestoreService;
//# sourceMappingURL=trash-restore.service.js.map