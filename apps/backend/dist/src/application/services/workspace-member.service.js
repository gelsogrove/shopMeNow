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
exports.workspaceMemberService = exports.WorkspaceMemberService = void 0;
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../../utils/logger"));
class WorkspaceMemberService {
    constructor(prismaInstance) {
        this.prisma = prismaInstance || database_1.prisma;
    }
    /**
     * Get all members of a workspace
     *
     * Business Rule: If a member's email exists in the Sales table for this workspace,
     * their displayed role should be "AGENT" instead of "ADMIN".
     * SUPER_ADMIN (owner) role is never overridden.
     */
    getMembers(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const userWorkspaces = yield this.prisma.userWorkspace.findMany({
                where: { workspaceId },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
                orderBy: [{ role: "asc" }, { createdAt: "asc" }],
            });
            // Get all Sales emails for this workspace to check for AGENT role
            let salesEmails = new Set();
            try {
                const salesRecords = yield this.prisma.sales.findMany({
                    where: { workspaceId },
                    select: { email: true },
                });
                // Store emails in lowercase for case-insensitive matching
                salesEmails = new Set(salesRecords.map((s) => s.email.toLowerCase()));
            }
            catch (error) {
                // Graceful degradation: if Sales query fails, continue with original roles
                logger_1.default.warn(`Failed to fetch Sales for workspace ${workspaceId}, using original roles:`, error);
            }
            return userWorkspaces.map((uw) => {
                // Determine role: SUPER_ADMIN stays unchanged, ADMIN becomes AGENT if in Sales
                let displayRole = uw.role;
                if (uw.role !== "SUPER_ADMIN" && salesEmails.has(uw.user.email.toLowerCase())) {
                    displayRole = "AGENT";
                }
                return {
                    userId: uw.user.id,
                    email: uw.user.email,
                    firstName: uw.user.firstName,
                    lastName: uw.user.lastName,
                    role: displayRole,
                    createdAt: uw.createdAt,
                };
            });
        });
    }
    /**
     * Get all ADMINs for all workspaces owned by a specific user
     */
    getAdminsByOwnerId(ownerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const ownerWorkspaces = yield this.prisma.workspace.findMany({
                where: { ownerId },
                select: { id: true },
            });
            const workspaceIds = ownerWorkspaces.map((w) => w.id);
            const admins = yield this.prisma.userWorkspace.findMany({
                where: {
                    workspaceId: { in: workspaceIds },
                    role: "ADMIN",
                },
                include: {
                    user: {
                        select: { id: true, email: true },
                    },
                },
                distinct: ["userId"],
            });
            return admins.map((a) => ({
                userId: a.user.id,
                email: a.user.email,
            }));
        });
    }
    /**
     * Add a member to all workspaces owned by a specific user
     * Used when accepting an invitation
     */
    addMemberToAllOwnerChannels(userId_1, ownerId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, ownerId, role = "ADMIN") {
            const ownerWorkspaces = yield this.prisma.workspace.findMany({
                where: { ownerId },
                select: { id: true },
            });
            let workspacesAdded = 0;
            for (const workspace of ownerWorkspaces) {
                const existing = yield this.prisma.userWorkspace.findUnique({
                    where: {
                        userId_workspaceId: {
                            userId,
                            workspaceId: workspace.id,
                        },
                    },
                });
                if (!existing) {
                    yield this.prisma.userWorkspace.create({
                        data: {
                            userId,
                            workspaceId: workspace.id,
                            role,
                        },
                    });
                    workspacesAdded++;
                }
            }
            logger_1.default.info(`Added user ${userId} to ${workspacesAdded} workspace(s) owned by ${ownerId}`);
            return { success: true, workspacesAdded };
        });
    }
    /**
     * Remove a member from all workspaces owned by the workspace's owner
     * SUPER_ADMIN cannot remove themselves
     */
    removeMember(workspaceId, userIdToRemove, requestingUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get the workspace and check ownership
            const workspace = yield this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { ownerId: true },
            });
            if (!workspace || !workspace.ownerId) {
                return { success: false, error: "Workspace not found" };
            }
            // Check if requesting user is the SUPER_ADMIN (owner)
            if (requestingUserId !== workspace.ownerId) {
                return { success: false, error: "Only workspace owner can remove members" };
            }
            // Cannot remove yourself (the owner)
            if (userIdToRemove === workspace.ownerId) {
                return { success: false, error: "Cannot remove yourself from the workspace" };
            }
            // Find all workspaces owned by the same owner
            const ownerWorkspaces = yield this.prisma.workspace.findMany({
                where: { ownerId: workspace.ownerId },
                select: { id: true },
            });
            const workspaceIds = ownerWorkspaces.map((w) => w.id);
            // Remove user from all owner's workspaces
            const result = yield this.prisma.userWorkspace.deleteMany({
                where: {
                    userId: userIdToRemove,
                    workspaceId: { in: workspaceIds },
                },
            });
            logger_1.default.info(`Removed user ${userIdToRemove} from ${result.count} workspace(s)`);
            return { success: true, workspacesRemoved: result.count };
        });
    }
    /**
     * Check if a user is a member of a workspace
     */
    isUserMember(workspaceId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const membership = yield this.prisma.userWorkspace.findUnique({
                where: {
                    userId_workspaceId: {
                        userId,
                        workspaceId,
                    },
                },
            });
            return {
                isMember: !!membership,
                role: (membership === null || membership === void 0 ? void 0 : membership.role) || null,
            };
        });
    }
    /**
     * Check if user is SUPER_ADMIN (owner) of a workspace
     */
    isSuperAdmin(workspaceId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const workspace = yield this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { ownerId: true },
            });
            return (workspace === null || workspace === void 0 ? void 0 : workspace.ownerId) === userId;
        });
    }
    /**
     * Get user's role in a workspace
     */
    getUserRole(workspaceId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const membership = yield this.prisma.userWorkspace.findUnique({
                where: {
                    userId_workspaceId: {
                        userId,
                        workspaceId,
                    },
                },
            });
            return (membership === null || membership === void 0 ? void 0 : membership.role) || null;
        });
    }
    /**
     * Add all existing ADMINs to a new workspace
     * Called when SUPER_ADMIN creates a new channel
     */
    addExistingAdminsToNewWorkspace(newWorkspaceId, ownerId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get all ADMINs from owner's existing workspaces
            const existingAdmins = yield this.getAdminsByOwnerId(ownerId);
            let adminsAdded = 0;
            for (const admin of existingAdmins) {
                const existing = yield this.prisma.userWorkspace.findUnique({
                    where: {
                        userId_workspaceId: {
                            userId: admin.userId,
                            workspaceId: newWorkspaceId,
                        },
                    },
                });
                if (!existing) {
                    yield this.prisma.userWorkspace.create({
                        data: {
                            userId: admin.userId,
                            workspaceId: newWorkspaceId,
                            role: "ADMIN",
                        },
                    });
                    adminsAdded++;
                }
            }
            logger_1.default.info(`Added ${adminsAdded} existing ADMINs to new workspace ${newWorkspaceId}`);
            return { success: true, adminsAdded };
        });
    }
    /**
     * Check if user can create a new workspace (channel)
     * A user can create workspace if:
     * 1. They have NO workspaces yet (first-time owner), OR
     * 2. They are SUPER_ADMIN (owner) in at least one workspace
     *
     * ADMIN users cannot create new workspaces - only SUPER_ADMIN can
     */
    canUserCreateWorkspace(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check all workspace memberships for this user
            const memberships = yield this.prisma.userWorkspace.findMany({
                where: { userId },
                select: { role: true, workspaceId: true },
            });
            // If user has no workspaces, they can create their first one (become owner)
            if (memberships.length === 0) {
                return { canCreate: true, isFirstTimeOwner: true };
            }
            // Check if user is SUPER_ADMIN in at least one workspace
            const isSuperAdminInAny = memberships.some((m) => m.role === "SUPER_ADMIN");
            if (isSuperAdminInAny) {
                return { canCreate: true, isFirstTimeOwner: false };
            }
            // User is ONLY ADMIN in all workspaces - cannot create new ones
            return {
                canCreate: false,
                reason: "Only workspace owners (SUPER_ADMIN) can create new channels",
            };
        });
    }
}
exports.WorkspaceMemberService = WorkspaceMemberService;
exports.workspaceMemberService = new WorkspaceMemberService();
//# sourceMappingURL=workspace-member.service.js.map