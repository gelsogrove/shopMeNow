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
exports.requireWorkspaceMember = exports.requireOwner = exports.requireSuperAdmin = void 0;
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../utils/logger"));
// prisma imported
/**
 * Middleware to require SUPER_ADMIN role for workspace operations
 * Must be used AFTER authMiddleware and validateWorkspaceOperation
 *
 * SUPER_ADMIN is determined by checking if the user is the workspace owner (ownerId)
 * OR if the user's role in UserWorkspace is "SUPER_ADMIN"
 */
const requireSuperAdmin = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const workspaceId = req.workspaceId || req.params.workspaceId;
        if (!userId) {
            logger_1.default.warn("requireSuperAdmin: No user ID found in request");
            res.status(401).json({
                error: "Unauthorized",
                message: "Authentication required",
            });
            return;
        }
        if (!workspaceId) {
            logger_1.default.warn("requireSuperAdmin: No workspace ID found in request");
            res.status(400).json({
                error: "Bad Request",
                message: "Workspace ID is required",
            });
            return;
        }
        // Check if user is the workspace owner
        const workspace = yield database_1.prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { ownerId: true },
        });
        if (!workspace) {
            logger_1.default.warn(`requireSuperAdmin: Workspace ${workspaceId} not found`);
            res.status(404).json({
                error: "Not Found",
                message: "Workspace not found",
            });
            return;
        }
        // User is SUPER_ADMIN if they are the owner
        const isSuperAdmin = workspace.ownerId === userId;
        // Also check UserWorkspace role for backward compatibility
        if (!isSuperAdmin) {
            const userWorkspace = yield database_1.prisma.userWorkspace.findUnique({
                where: {
                    userId_workspaceId: {
                        userId,
                        workspaceId,
                    },
                },
            });
            if ((userWorkspace === null || userWorkspace === void 0 ? void 0 : userWorkspace.role) === "SUPER_ADMIN") {
                // User has SUPER_ADMIN role in UserWorkspace
                logger_1.default.info(`✅ SUPER_ADMIN access granted for user ${userId.substring(0, 8)}... via UserWorkspace role`);
                next();
                return;
            }
            logger_1.default.warn(`requireSuperAdmin: User ${userId.substring(0, 8)}... is not SUPER_ADMIN of workspace ${workspaceId.substring(0, 8)}...`);
            res.status(403).json({
                error: "Forbidden",
                message: "Only workspace owner can perform this action",
            });
            return;
        }
        logger_1.default.info(`✅ SUPER_ADMIN access granted for user ${userId.substring(0, 8)}... (workspace owner)`);
        next();
    }
    catch (error) {
        logger_1.default.error("Error in requireSuperAdmin middleware:", error);
        res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to verify permissions",
        });
    }
});
exports.requireSuperAdmin = requireSuperAdmin;
/**
 * Middleware to require OWNER role only (not just SUPER_ADMIN)
 * This is stricter than requireSuperAdmin - only the actual workspace owner can access
 * Must be used AFTER authMiddleware and validateWorkspaceOperation
 *
 * Use case: Agent Configuration - only owner should see/edit AI prompts
 */
const requireOwner = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const workspaceId = req.workspaceId || req.params.workspaceId;
        if (!userId) {
            logger_1.default.warn("requireOwner: No user ID found in request");
            res.status(401).json({
                error: "Unauthorized",
                message: "Authentication required",
            });
            return;
        }
        if (!workspaceId) {
            logger_1.default.warn("requireOwner: No workspace ID found in request");
            res.status(400).json({
                error: "Bad Request",
                message: "Workspace ID is required",
            });
            return;
        }
        // Check if user is the workspace owner (ownerId)
        const workspace = yield database_1.prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { ownerId: true },
        });
        if (!workspace) {
            logger_1.default.warn(`requireOwner: Workspace ${workspaceId} not found`);
            res.status(404).json({
                error: "Not Found",
                message: "Workspace not found",
            });
            return;
        }
        // STRICT: Only ownerId can access (no SUPER_ADMIN role fallback)
        if (workspace.ownerId !== userId) {
            logger_1.default.warn(`requireOwner: User ${userId.substring(0, 8)}... is not the owner of workspace ${workspaceId.substring(0, 8)}...`);
            res.status(403).json({
                error: "Forbidden",
                message: "Only workspace owner can access agent configuration",
            });
            return;
        }
        logger_1.default.info(`✅ Owner access granted for user ${userId.substring(0, 8)}... to workspace ${workspaceId.substring(0, 8)}...`);
        next();
    }
    catch (error) {
        logger_1.default.error("Error in requireOwner middleware:", error);
        res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to verify ownership",
        });
    }
});
exports.requireOwner = requireOwner;
/**
 * Middleware to require workspace membership (any role)
 * Must be used AFTER authMiddleware
 */
const requireWorkspaceMember = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const workspaceId = req.workspaceId || req.params.workspaceId;
        if (!userId) {
            res.status(401).json({
                error: "Unauthorized",
                message: "Authentication required",
            });
            return;
        }
        if (!workspaceId) {
            res.status(400).json({
                error: "Bad Request",
                message: "Workspace ID is required",
            });
            return;
        }
        const membership = yield database_1.prisma.userWorkspace.findUnique({
            where: {
                userId_workspaceId: {
                    userId,
                    workspaceId,
                },
            },
        });
        if (!membership) {
            logger_1.default.warn(`requireWorkspaceMember: User ${userId.substring(0, 8)}... is not a member of workspace ${workspaceId.substring(0, 8)}...`);
            res.status(403).json({
                error: "Forbidden",
                message: "You are not a member of this workspace",
            });
            return;
        }
        // Attach role to request for downstream use
        ;
        req.userRole = membership.role;
        logger_1.default.info(`✅ Workspace member access granted for user ${userId.substring(0, 8)}... with role ${membership.role}`);
        next();
    }
    catch (error) {
        logger_1.default.error("Error in requireWorkspaceMember middleware:", error);
        res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to verify membership",
        });
    }
});
exports.requireWorkspaceMember = requireWorkspaceMember;
//# sourceMappingURL=workspace-role.middleware.js.map