import { Router } from "express"
import logger from "../../../utils/logger"
import { invitationController } from "../controllers/invitation.controller"
import { asyncHandler } from "../middlewares/async.middleware"
import { authMiddleware } from "../middlewares/auth.middleware"
import { validateWorkspaceOperation } from "../../../middlewares/workspace-validation.middleware"
import {
  requireSuperAdmin,
  requireWorkspaceMember,
} from "../../../middlewares/workspace-role.middleware"

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
export const invitationRouter = (): Router => {
  const router = Router({ mergeParams: true }) // mergeParams to access :workspaceId

  logger.info("Setting up invitation routes")

  // === PROTECTED ROUTES (workspace-scoped) ===
  // These require authentication and workspace validation

  // Get pending invitations (any workspace member can view)
  router.get(
    "/",
    authMiddleware,
    validateWorkspaceOperation,
    requireWorkspaceMember,
    asyncHandler(invitationController.getPendingInvitations)
  )

  // Create invitation (SUPER_ADMIN only)
  router.post(
    "/",
    authMiddleware,
    validateWorkspaceOperation,
    requireSuperAdmin,
    asyncHandler(invitationController.createInvitation)
  )

  // Cancel invitation (SUPER_ADMIN only)
  router.delete(
    "/:invitationId",
    authMiddleware,
    validateWorkspaceOperation,
    requireSuperAdmin,
    asyncHandler(invitationController.cancelInvitation)
  )

  // Resend invitation (SUPER_ADMIN only)
  router.post(
    "/:invitationId/resend",
    authMiddleware,
    validateWorkspaceOperation,
    requireSuperAdmin,
    asyncHandler(invitationController.resendInvitation)
  )

  logger.info("Invitation routes setup complete")
  return router
}

/**
 * Public invitation routes (no auth required)
 * These are mounted separately at /api/invitations
 */
export const publicInvitationRouter = (): Router => {
  const router = Router()

  logger.info("Setting up public invitation routes")

  // Validate token (public)
  router.get(
    "/validate/:token",
    asyncHandler(invitationController.validateToken)
  )

  // Accept invitation (public - token is sufficient for existing users)
  router.post("/accept", asyncHandler(invitationController.acceptInvitation))

  logger.info("Public invitation routes setup complete")
  return router
}

// Export for compatibility
export const invitationRoutes = invitationRouter()
export const publicInvitationRoutes = publicInvitationRouter()
