"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.memberRoutes = exports.memberRouter = void 0;
const express_1 = require("express");
const logger_1 = __importDefault(require("../../../utils/logger"));
const member_controller_1 = require("../controllers/member.controller");
const async_middleware_1 = require("../middlewares/async.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const workspace_validation_middleware_1 = require("../../../middlewares/workspace-validation.middleware");
const workspace_role_middleware_1 = require("../../../middlewares/workspace-role.middleware");
/**
 * Member routes for workspace team management
 *
 * Protected routes (require auth + workspace membership):
 * - GET /api/workspaces/:workspaceId/members - List all members
 * - GET /api/workspaces/:workspaceId/members/me/role - Get current user's role
 *
 * SUPER_ADMIN only routes:
 * - DELETE /api/workspaces/:workspaceId/members/:userId - Remove a member
 */
const memberRouter = () => {
    const router = (0, express_1.Router)({ mergeParams: true }); // mergeParams to access :workspaceId
    logger_1.default.info("Setting up member routes");
    // Get current user's role (must be before /:userId to avoid conflict)
    router.get("/me/role", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, (0, async_middleware_1.asyncHandler)(member_controller_1.memberController.getMyRole));
    // Get all members (any workspace member can view)
    router.get("/", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, workspace_role_middleware_1.requireWorkspaceMember, (0, async_middleware_1.asyncHandler)(member_controller_1.memberController.getMembers));
    // Remove a member (SUPER_ADMIN only)
    router.delete("/:userId", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, workspace_role_middleware_1.requireSuperAdmin, (0, async_middleware_1.asyncHandler)(member_controller_1.memberController.removeMember));
    logger_1.default.info("Member routes setup complete");
    return router;
};
exports.memberRouter = memberRouter;
// Export for compatibility
exports.memberRoutes = (0, exports.memberRouter)();
//# sourceMappingURL=member.routes.js.map