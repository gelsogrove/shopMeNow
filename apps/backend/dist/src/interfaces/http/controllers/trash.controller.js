"use strict";
/**
 * TrashController - Handles trash management endpoints
 *
 * Endpoints:
 * - POST /admin/users/{id}/unsubscribe - Initiate user deletion
 * - GET /admin/trash/customers - List deleted customers
 * - GET /admin/trash/workspaces - List deleted workspaces
 * - GET /admin/trash/agents - List deleted agents
 * - POST /admin/trash/{id}/restore - Restore soft-deleted item
 * - POST /admin/trash/{id}/permanently-delete - Hard-delete
 * - GET /admin/trash/audit-log - View deletion audit trail
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
exports.TrashController = void 0;
const logger_1 = __importDefault(require("../../../utils/logger"));
const user_unsubscribe_service_1 = require("../../../services/user-unsubscribe.service");
const trash_restore_service_1 = require("../../../services/trash-restore.service");
const soft_delete_helper_1 = require("../../../utils/soft-delete.helper");
class TrashController {
    constructor(prisma) {
        this.prisma = prisma;
        this.unsubscribeService = new user_unsubscribe_service_1.UserUnsubscribeService(prisma);
        this.restoreService = new trash_restore_service_1.TrashRestoreService(prisma);
    }
    /**
     * POST /admin/users/{id}/unsubscribe
     * Initiate user account deletion (soft-delete with cascade)
     */
    unsubscribeUser(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id: userId } = req.params;
                const { reason = "User requested deletion" } = req.body;
                const result = yield this.unsubscribeService.unsubscribeUser(userId, reason);
                res.status(200).json({
                    success: true,
                    data: result,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to unsubscribe user", error);
                res.status(400).json({
                    error: "Failed to unsubscribe user",
                    message: String(error),
                });
            }
        });
    }
    /**
     * GET /admin/trash/customers?workspaceId=xxx&page=1&limit=50
     * List soft-deleted customers
     * workspaceId is optional - if not provided, shows ALL deleted customers (Platform Admin view)
     */
    listDeletedCustomers(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId, page = "1", limit = "50" } = req.query;
                const pageNum = Math.max(1, parseInt(page, 10) || 1);
                const pageSize = Math.min(100, parseInt(limit, 10) || 50);
                // Build where clause - workspaceId is optional for Platform Admin
                const whereClause = Object.assign({}, (0, soft_delete_helper_1.buildTrashFilter)());
                if (workspaceId) {
                    whereClause.workspaceId = workspaceId;
                }
                const [items, total] = yield Promise.all([
                    this.prisma.customers.findMany({
                        where: whereClause,
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                            deletedAt: true,
                            language: true,
                            workspaceId: true,
                            workspace: {
                                select: {
                                    name: true,
                                },
                            },
                        },
                        skip: (pageNum - 1) * pageSize,
                        take: pageSize,
                        orderBy: { deletedAt: "desc" },
                    }),
                    this.prisma.customers.count({
                        where: whereClause,
                    }),
                ]);
                const retentionDays = (0, soft_delete_helper_1.getRetentionDaysConfig)();
                res.status(200).json({
                    items: items.map((c) => {
                        var _a;
                        return ({
                            id: c.id,
                            name: c.name,
                            email: c.email,
                            phone: c.phone,
                            deletedAt: c.deletedAt,
                            language: c.language,
                            workspaceId: c.workspaceId,
                            workspaceName: ((_a = c.workspace) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown',
                            daysUntilPermanentDelete: (0, soft_delete_helper_1.getDaysUntilPermanentDelete)(c.deletedAt, retentionDays),
                        });
                    }),
                    pagination: {
                        page: pageNum,
                        limit: pageSize,
                        total,
                        pages: Math.ceil(total / pageSize),
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Failed to list deleted customers", error);
                res.status(500).json({
                    error: "Failed to list deleted customers",
                    message: String(error),
                });
            }
        });
    }
    /**
     * GET /admin/trash/workspaces?page=1&limit=50
     * List soft-deleted workspaces
     *
     * FILTERING LOGIC:
     * Only shows workspaces that were deleted DIRECTLY (not as cascade from owner deletion).
     * A workspace appears here only if its owner is NOT deleted.
     * If owner is deleted, the workspace restore must happen via User restore (cascade).
     */
    listDeletedWorkspaces(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { page = "1", limit = "50" } = req.query;
                const pageNum = Math.max(1, parseInt(page, 10) || 1);
                const pageSize = Math.min(100, parseInt(limit, 10) || 50);
                // Filter: workspace deleted BUT owner NOT deleted (direct deletion, not cascade)
                const whereClause = Object.assign(Object.assign({}, (0, soft_delete_helper_1.buildTrashFilter)()), { owner: {
                        deletedAt: null, // Owner must NOT be deleted
                    } });
                const [items, total] = yield Promise.all([
                    this.prisma.workspace.findMany({
                        where: whereClause,
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            ownerId: true,
                            deletedAt: true,
                            owner: {
                                select: {
                                    email: true,
                                },
                            },
                        },
                        skip: (pageNum - 1) * pageSize,
                        take: pageSize,
                        orderBy: { deletedAt: "desc" },
                    }),
                    this.prisma.workspace.count({
                        where: whereClause,
                    }),
                ]);
                const retentionDays = (0, soft_delete_helper_1.getRetentionDaysConfig)();
                res.status(200).json({
                    items: items.map((w) => {
                        var _a;
                        return ({
                            id: w.id,
                            name: w.name,
                            slug: w.slug,
                            ownerId: w.ownerId,
                            ownerEmail: ((_a = w.owner) === null || _a === void 0 ? void 0 : _a.email) || 'Unknown',
                            deletedAt: w.deletedAt,
                            daysUntilPermanentDelete: (0, soft_delete_helper_1.getDaysUntilPermanentDelete)(w.deletedAt, retentionDays),
                        });
                    }),
                    pagination: {
                        page: pageNum,
                        limit: pageSize,
                        total,
                        pages: Math.ceil(total / pageSize),
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Failed to list deleted workspaces", error);
                res.status(500).json({
                    error: "Failed to list deleted workspaces",
                    message: String(error),
                });
            }
        });
    }
    /**
     * GET /admin/trash/users?page=1&limit=50
     * List soft-deleted users
     *
     * FILTERING LOGIC:
     * - OWNER users: Always shown if deleted (they are the root of cascade)
     * - AGENT/OPERATOR users: Only shown if deleted DIRECTLY (not via workspace cascade)
     *   An agent/operator appears only if ALL their workspaces are NOT deleted.
     */
    listDeletedUsers(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { page = "1", limit = "50" } = req.query;
                const pageNum = Math.max(1, parseInt(page, 10) || 1);
                const pageSize = Math.min(100, parseInt(limit, 10) || 50);
                // First, get all deleted users
                const allDeletedUsers = yield this.prisma.user.findMany({
                    where: (0, soft_delete_helper_1.buildTrashFilter)(),
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                        deletedAt: true,
                        workspaces: {
                            select: {
                                workspace: {
                                    select: {
                                        id: true,
                                        name: true,
                                        deletedAt: true, // Need to check if workspace is deleted
                                    },
                                },
                                role: true,
                            },
                        },
                    },
                    orderBy: { deletedAt: "desc" },
                });
                // Filter: Show user only if they are NOT a cascade victim
                // A user is a cascade victim if:
                // - They are AGENT/OPERATOR AND all their workspaces are deleted
                const filteredUsers = allDeletedUsers.filter(user => {
                    // OWNER/ADMIN role users are always shown (they are the root)
                    // Note: isPlatformAdmin is a separate boolean field, not a role value
                    if (user.role === 'OWNER' || user.role === 'ADMIN') {
                        return true;
                    }
                    // For AGENT/OPERATOR: check if ANY of their workspaces is NOT deleted
                    // If at least one workspace is active, they were deleted directly
                    const hasActiveWorkspace = user.workspaces.some(uw => uw.workspace.deletedAt === null);
                    // If they have no workspaces or all workspaces are deleted, they're cascade victims
                    if (user.workspaces.length === 0) {
                        return true; // No workspace = direct deletion
                    }
                    return hasActiveWorkspace;
                });
                // Apply pagination to filtered results
                const total = filteredUsers.length;
                const paginatedUsers = filteredUsers.slice((pageNum - 1) * pageSize, pageNum * pageSize);
                const retentionDays = (0, soft_delete_helper_1.getRetentionDaysConfig)();
                res.status(200).json({
                    items: paginatedUsers.map((u) => ({
                        id: u.id,
                        email: u.email,
                        firstName: u.firstName,
                        lastName: u.lastName,
                        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
                        role: u.role,
                        deletedAt: u.deletedAt,
                        workspaces: u.workspaces.map(w => ({
                            id: w.workspace.id,
                            name: w.workspace.name,
                            role: w.role,
                        })),
                        daysUntilPermanentDelete: (0, soft_delete_helper_1.getDaysUntilPermanentDelete)(u.deletedAt, retentionDays),
                    })),
                    pagination: {
                        page: pageNum,
                        limit: pageSize,
                        total,
                        pages: Math.ceil(total / pageSize),
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Failed to list deleted users", error);
                res.status(500).json({
                    error: "Failed to list deleted users",
                    message: String(error),
                });
            }
        });
    }
    /**
     * POST /admin/trash/{id}/restore
     * Restore soft-deleted customer, workspace, or user
     */
    restoreItem(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const { id } = req.params;
                const { workspaceId, entityType = "CUSTOMER" } = req.body;
                let result;
                if (entityType === "WORKSPACE") {
                    // For workspace restore, the id IS the workspaceId
                    result = yield this.restoreService.restoreWorkspace(id, (_a = req.user) === null || _a === void 0 ? void 0 : _a.id);
                }
                else if (entityType === "USER") {
                    // For user restore
                    result = yield this.restoreUser(id, (_b = req.user) === null || _b === void 0 ? void 0 : _b.id);
                }
                else {
                    // For customer restore, workspaceId is required
                    if (!workspaceId) {
                        res.status(400).json({ error: "workspaceId required for customer restore" });
                        return;
                    }
                    result = yield this.restoreService.restoreCustomer(id, workspaceId);
                }
                res.status(200).json({
                    success: true,
                    data: result,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to restore item", error);
                res.status(400).json({
                    error: "Failed to restore item",
                    message: String(error),
                });
            }
        });
    }
    /**
     * Restore a soft-deleted user with CASCADE restore
     * Restores: User → All owned Workspaces → All workspace data (customers, orders, etc.)
     */
    restoreUser(userId, adminUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const user = yield tx.user.findUnique({
                    where: { id: userId },
                });
                if (!user) {
                    throw new Error(`User not found: ${userId}`);
                }
                if (user.deletedAt === null) {
                    throw new Error(`User not deleted: ${userId}`);
                }
                // 1. Restore the user
                yield tx.user.update({
                    where: { id: userId },
                    data: { deletedAt: null },
                });
                // 2. CASCADE: Restore all workspaces owned by this user
                const ownedWorkspaces = yield tx.workspace.findMany({
                    where: {
                        ownerId: userId,
                        deletedAt: { not: null }
                    },
                    select: { id: true, name: true }
                });
                const cascadeRestored = {
                    workspaces: 0,
                    customers: 0,
                    orders: 0,
                    chatSessions: 0,
                    messages: 0,
                };
                for (const workspace of ownedWorkspaces) {
                    // Restore workspace
                    yield tx.workspace.update({
                        where: { id: workspace.id },
                        data: {
                            deletedAt: null,
                            isDelete: false // Sync both fields
                        }
                    });
                    cascadeRestored.workspaces++;
                    // Restore all customers in this workspace
                    const customerResult = yield tx.customers.updateMany({
                        where: { workspaceId: workspace.id, deletedAt: { not: null } },
                        data: { deletedAt: null }
                    });
                    cascadeRestored.customers += customerResult.count;
                    // Restore all orders in this workspace
                    const orderResult = yield tx.orders.updateMany({
                        where: { workspaceId: workspace.id, deletedAt: { not: null } },
                        data: { deletedAt: null }
                    });
                    cascadeRestored.orders += orderResult.count;
                    // Restore all chat sessions in this workspace
                    const sessionResult = yield tx.chatSession.updateMany({
                        where: { workspaceId: workspace.id, deletedAt: { not: null } },
                        data: { deletedAt: null }
                    });
                    cascadeRestored.chatSessions += sessionResult.count;
                    // Restore all messages in this workspace's sessions
                    const messageResult = yield tx.message.updateMany({
                        where: {
                            chatSession: { workspaceId: workspace.id },
                            deletedAt: { not: null }
                        },
                        data: { deletedAt: null }
                    });
                    cascadeRestored.messages += messageResult.count;
                }
                // Get first workspace for audit log
                const userWorkspace = yield tx.userWorkspace.findFirst({
                    where: { userId },
                    select: { workspaceId: true },
                });
                // Audit log
                if (userWorkspace) {
                    yield tx.softDeleteAuditLog.create({
                        data: {
                            workspaceId: userWorkspace.workspaceId,
                            entityType: "USER_RESTORED_CASCADE",
                            deletedIds: [userId, ...ownedWorkspaces.map(w => w.id)],
                            deletedIdCount: 1 + ownedWorkspaces.length,
                            reason: `Admin initiated cascade restore (${adminUserId || 'system'})`,
                            deletedByUserId: adminUserId || null,
                        },
                    });
                }
                return {
                    success: true,
                    message: "User and all owned workspaces restored successfully",
                    entityType: "USER",
                    cascadeRestored,
                    restoredAt: new Date(),
                };
            }));
        });
    }
    /**
     * POST /admin/trash/{id}/permanently-delete
     * Hard-delete soft-deleted item (requires confirmation text)
     */
    permanentlyDeleteItem(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { workspaceId, confirmationText = "", entityType = "CUSTOMER" } = req.body;
                // Require exact confirmation text
                if (confirmationText !== "PERMANENTLY DELETE") {
                    res.status(400).json({
                        error: "Invalid confirmation",
                        message: 'Must type "PERMANENTLY DELETE" to confirm',
                    });
                    return;
                }
                // Hard-delete based on entity type
                let deletedCount = 0;
                if (entityType === "CUSTOMER") {
                    // Delete customer and all related data
                    yield this.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                        var _a;
                        yield tx.message.deleteMany({
                            where: { chatSession: { customerId: id } },
                        });
                        yield tx.chatSession.deleteMany({ where: { customerId: id } });
                        yield tx.orderItems.deleteMany({
                            where: { order: { customerId: id } },
                        });
                        yield tx.orders.deleteMany({ where: { customerId: id } });
                        const customer = yield tx.customers.delete({ where: { id } });
                        deletedCount++;
                        // Audit log
                        yield tx.softDeleteAuditLog.create({
                            data: {
                                workspaceId,
                                entityType: "CUSTOMER_PERMANENTLY_DELETED",
                                deletedIds: [id],
                                deletedIdCount: deletedCount,
                                reason: "Admin permanently deleted via trash",
                                deletedByUserId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                            },
                        });
                    }));
                }
                else if (entityType === "WORKSPACE") {
                    // Delete entire workspace and ALL related data
                    yield this.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                        const wsId = id;
                        // ===== LEAF TABLES FIRST =====
                        // Messages
                        yield tx.message.deleteMany({
                            where: { chatSession: { workspaceId: wsId } },
                        });
                        // ConversationMessage
                        yield tx.conversationMessage.deleteMany({ where: { workspaceId: wsId } });
                        // AgentConversationLog
                        yield tx.agentConversationLog.deleteMany({ where: { workspaceId: wsId } });
                        // Chat sessions
                        yield tx.chatSession.deleteMany({ where: { workspaceId: wsId } });
                        // Campaign tables
                        yield tx.campaignSent.deleteMany({
                            where: { campaign: { workspaceId: wsId } },
                        });
                        yield tx.campaign.deleteMany({ where: { workspaceId: wsId } });
                        // Product relation tables
                        yield tx.productCertification.deleteMany({
                            where: { product: { workspaceId: wsId } },
                        });
                        yield tx.productTransportType.deleteMany({
                            where: { product: { workspaceId: wsId } },
                        });
                        yield tx.productCategory.deleteMany({
                            where: { product: { workspaceId: wsId } },
                        });
                        // Cart tables
                        yield tx.cartItems.deleteMany({
                            where: { cart: { workspaceId: wsId } },
                        });
                        yield tx.carts.deleteMany({ where: { workspaceId: wsId } });
                        // Order tables
                        yield tx.creditNote.deleteMany({
                            where: { order: { workspaceId: wsId } },
                        });
                        yield tx.orderItems.deleteMany({
                            where: { order: { workspaceId: wsId } },
                        });
                        yield tx.orders.deleteMany({ where: { workspaceId: wsId } });
                        // Customer-related
                        yield tx.customerFeedback.deleteMany({
                            where: { customer: { workspaceId: wsId } },
                        });
                        yield tx.searchConversations.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.customers.deleteMany({ where: { workspaceId: wsId } });
                        // ===== CONTENT TABLES =====
                        yield tx.certification.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.transportType.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.products.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.categories.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.offers.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.services.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.fAQ.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.documents.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.sales.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.languages.deleteMany({ where: { workspaceId: wsId } });
                        // ===== CONFIG TABLES =====
                        yield tx.agentConfig.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.whatsappSettings.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.gdprContent.deleteMany({ where: { workspaceId: wsId } });
                        // ===== OPERATIONAL TABLES =====
                        yield tx.whatsAppQueue.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.productSearch.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.secureToken.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.shortUrls.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.usage.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.billing.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.billingTransaction.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.adminSession.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.workspaceInvitation.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.registrationAttempts.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.registrationToken.deleteMany({ where: { workspaceId: wsId } });
                        yield tx.softDeleteAuditLog.deleteMany({ where: { workspaceId: wsId } });
                        // ===== RELATIONS =====
                        yield tx.userWorkspace.deleteMany({ where: { workspaceId: wsId } });
                        // ===== FINALLY DELETE WORKSPACE =====
                        yield tx.workspace.delete({ where: { id: wsId } });
                        deletedCount = 1;
                    }), { timeout: 60000 });
                }
                else if (entityType === "USER") {
                    // Delete user and all owned workspaces (cascade)
                    yield this.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                        // First, find all workspaces owned by this user
                        const ownedWorkspaces = yield tx.workspace.findMany({
                            where: { ownerId: id },
                            select: { id: true },
                        });
                        // ===== USER AUTH TABLES =====
                        yield tx.twoFactorResetToken.deleteMany({ where: { userId: id } });
                        yield tx.authenticationAttempt.deleteMany({ where: { userId: id } });
                        yield tx.passwordReset.deleteMany({ where: { userId: id } });
                        // Note: RegistrationToken is linked to Workspace, not User - deleted with workspace
                        // Delete all data in each owned workspace
                        for (const workspace of ownedWorkspaces) {
                            const wsId = workspace.id;
                            // ===== LEAF TABLES FIRST =====
                            yield tx.message.deleteMany({
                                where: { chatSession: { workspaceId: wsId } },
                            });
                            yield tx.conversationMessage.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.agentConversationLog.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.chatSession.deleteMany({ where: { workspaceId: wsId } });
                            // Campaign tables
                            yield tx.campaignSent.deleteMany({
                                where: { campaign: { workspaceId: wsId } },
                            });
                            yield tx.campaign.deleteMany({ where: { workspaceId: wsId } });
                            // Product relation tables
                            yield tx.productCertification.deleteMany({
                                where: { product: { workspaceId: wsId } },
                            });
                            yield tx.productTransportType.deleteMany({
                                where: { product: { workspaceId: wsId } },
                            });
                            yield tx.productCategory.deleteMany({
                                where: { product: { workspaceId: wsId } },
                            });
                            // Cart tables
                            yield tx.cartItems.deleteMany({
                                where: { cart: { workspaceId: wsId } },
                            });
                            yield tx.carts.deleteMany({ where: { workspaceId: wsId } });
                            // Order tables
                            yield tx.creditNote.deleteMany({
                                where: { order: { workspaceId: wsId } },
                            });
                            yield tx.orderItems.deleteMany({
                                where: { order: { workspaceId: wsId } },
                            });
                            yield tx.orders.deleteMany({ where: { workspaceId: wsId } });
                            // Customer-related
                            yield tx.customerFeedback.deleteMany({
                                where: { customer: { workspaceId: wsId } },
                            });
                            yield tx.searchConversations.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.customers.deleteMany({ where: { workspaceId: wsId } });
                            // ===== CONTENT TABLES =====
                            yield tx.certification.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.transportType.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.products.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.categories.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.offers.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.services.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.fAQ.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.documents.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.sales.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.languages.deleteMany({ where: { workspaceId: wsId } });
                            // ===== CONFIG TABLES =====
                            yield tx.agentConfig.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.whatsappSettings.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.gdprContent.deleteMany({ where: { workspaceId: wsId } });
                            // ===== OPERATIONAL TABLES =====
                            yield tx.whatsAppQueue.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.productSearch.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.secureToken.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.shortUrls.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.usage.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.billing.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.billingTransaction.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.adminSession.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.workspaceInvitation.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.registrationAttempts.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.registrationToken.deleteMany({ where: { workspaceId: wsId } });
                            yield tx.softDeleteAuditLog.deleteMany({ where: { workspaceId: wsId } });
                            // Delete user-workspace associations for this workspace
                            yield tx.userWorkspace.deleteMany({ where: { workspaceId: wsId } });
                        }
                        // Delete all owned workspaces
                        yield tx.workspace.deleteMany({ where: { ownerId: id } });
                        // Delete user-workspace associations for this user (other workspaces)
                        yield tx.userWorkspace.deleteMany({ where: { userId: id } });
                        // Finally delete the user
                        yield tx.user.delete({ where: { id } });
                        deletedCount = 1 + ownedWorkspaces.length;
                    }), { timeout: 60000 });
                }
                res.status(200).json({
                    success: true,
                    message: `Item permanently deleted`,
                    deletedCount,
                    permanentlyDeletedAt: new Date(),
                });
            }
            catch (error) {
                logger_1.default.error("Failed to permanently delete item", error);
                res.status(400).json({
                    error: "Failed to permanently delete item",
                    message: String(error),
                });
            }
        });
    }
    /**
     * GET /admin/trash/audit-log?workspaceId=xxx&days=30
     * View deletion audit trail
     */
    getAuditLog(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId, days = "30" } = req.query;
                const daysNum = Math.max(1, parseInt(days, 10) || 30);
                if (!workspaceId) {
                    res.status(400).json({ error: "workspaceId required" });
                    return;
                }
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - daysNum);
                const logs = yield this.prisma.softDeleteAuditLog.findMany({
                    where: {
                        workspaceId: workspaceId,
                        deletedAt: {
                            gte: cutoffDate,
                        },
                    },
                    select: {
                        id: true,
                        entityType: true,
                        deletedIds: true,
                        deletedIdCount: true,
                        reason: true,
                        deletedByUserId: true,
                        deletedAt: true,
                    },
                    orderBy: { deletedAt: "desc" },
                    take: 100,
                });
                res.status(200).json({
                    logs,
                    daysShown: daysNum,
                    totalCount: logs.length,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to get audit log", error);
                res.status(500).json({
                    error: "Failed to get audit log",
                    message: String(error),
                });
            }
        });
    }
}
exports.TrashController = TrashController;
//# sourceMappingURL=trash.controller.js.map