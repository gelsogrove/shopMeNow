"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicInvitationRoutes = exports.invitationRoutes = exports.publicInvitationRouter = exports.invitationRouter = void 0;
const express_1 = require("express");
const logger_1 = __importDefault(require("../../../utils/logger"));
const invitation_controller_1 = require("../controllers/invitation.controller");
const async_middleware_1 = require("../middlewares/async.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const workspace_validation_middleware_1 = require("../../../middlewares/workspace-validation.middleware");
const workspace_role_middleware_1 = require("../../../middlewares/workspace-role.middleware");
/**
 * Invitation routes for workspace team management
 *
 * Protected routes (require auth + workspace membership):
 * - GET /api/workspaces/:workspaceId/invitations - List pending invitations
 *
 * SUPER_ADMIN only routes:
 * - POST /api/workspaces/:workspaceId/invitations - Create invitation
 * - DELETE /api/workspaces/:workspaceId/invitations/:invitationId - Cancel invitation
 * - POST /api/workspaces/:workspaceId/invitations/:invitationId/resend - Resend invitation
 *
 * Public routes (token-based):
 * - GET /api/invitations/validate/:token - Validate token
 * - POST /api/invitations/accept - Accept invitation
 */
const invitationRouter = () => {
    const router = (0, express_1.Router)({ mergeParams: true }); // mergeParams to access :workspaceId
    logger_1.default.info("Setting up invitation routes");
    // === PROTECTED ROUTES (workspace-scoped) ===
    // These require authentication and workspace validation
    // Get pending invitations (any workspace member can view)
    router.get("/", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, workspace_role_middleware_1.requireWorkspaceMember, (0, async_middleware_1.asyncHandler)(invitation_controller_1.invitationController.getPendingInvitations));
    // Create invitation (SUPER_ADMIN only)
    router.post("/", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, workspace_role_middleware_1.requireSuperAdmin, (0, async_middleware_1.asyncHandler)(invitation_controller_1.invitationController.createInvitation));
    // Cancel invitation (SUPER_ADMIN only)
    router.delete("/:invitationId", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, workspace_role_middleware_1.requireSuperAdmin, (0, async_middleware_1.asyncHandler)(invitation_controller_1.invitationController.cancelInvitation));
    // Resend invitation (SUPER_ADMIN only)
    router.post("/:invitationId/resend", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, workspace_role_middleware_1.requireSuperAdmin, (0, async_middleware_1.asyncHandler)(invitation_controller_1.invitationController.resendInvitation));
    logger_1.default.info("Invitation routes setup complete");
    return router;
};
exports.invitationRouter = invitationRouter;
/**
 * Public invitation routes (no auth required)
 * These are mounted separately at /api/invitations
 */
const publicInvitationRouter = () => {
    const router = (0, express_1.Router)();
    logger_1.default.info("Setting up public invitation routes");
    // Validate token (public)
    router.get("/validate/:token", (0, async_middleware_1.asyncHandler)(invitation_controller_1.invitationController.validateToken));
    // Accept invitation (public - token is sufficient for existing users)
    router.post("/accept", (0, async_middleware_1.asyncHandler)(invitation_controller_1.invitationController.acceptInvitation));
    logger_1.default.info("Public invitation routes setup complete");
    return router;
};
exports.publicInvitationRouter = publicInvitationRouter;
// Export for compatibility
exports.invitationRoutes = (0, exports.invitationRouter)();
exports.publicInvitationRoutes = (0, exports.publicInvitationRouter)();
//# sourceMappingURL=invitation.routes.js.map