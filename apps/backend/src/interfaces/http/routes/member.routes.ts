import { Router } from "express"
import logger from "../../../utils/logger"
import { memberController } from "../controllers/member.controller"
import { asyncHandler } from "../middlewares/async.middleware"
import { authMiddleware } from "../middlewares/auth.middleware"
import { validateWorkspaceOperation } from "../../../middlewares/workspace-validation.middleware"
import {
  requireSuperAdmin,
  requireWorkspaceMember,
} from "../../../middlewares/workspace-role.middleware"

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
export const memberRouter = (): Router => {
  const router = Router({ mergeParams: true }) // mergeParams to access :workspaceId

  logger.debug("Setting up member routes")

  // Get current user's role (must be before /:userId to avoid conflict)
  router.get(
    "/me/role",
    authMiddleware,
    validateWorkspaceOperation,
    asyncHandler(memberController.getMyRole)
  )

  // Get all members (any workspace member can view)
  router.get(
    "/",
    authMiddleware,
    validateWorkspaceOperation,
    requireWorkspaceMember,
    asyncHandler(memberController.getMembers)
  )

  // Remove a member (SUPER_ADMIN only)
  router.delete(
    "/:userId",
    authMiddleware,
    validateWorkspaceOperation,
    requireSuperAdmin,
    asyncHandler(memberController.removeMember)
  )

  logger.info("Member routes setup complete")
  return router
}

// Export for compatibility
export const memberRoutes = memberRouter()
