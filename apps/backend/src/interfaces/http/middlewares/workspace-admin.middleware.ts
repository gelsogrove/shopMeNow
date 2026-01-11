import { NextFunction, Request, Response } from "express"
import { prisma } from "../../../lib/prisma"
import logger from "../../../utils/logger"

/**
 * Middleware to verify that user is SUPER_ADMIN of the workspace
 * This middleware MUST be used AFTER authMiddleware and workspaceValidationMiddleware
 * 
 * Usage:
 *   router.put('/workspace-route', authMiddleware, workspaceValidationMiddleware, workspaceAdminMiddleware, controller.method)
 */
export const workspaceAdminMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user
    const workspaceId = req.params.workspaceId || (req as any).workspaceId

    if (!user) {
      logger.warn("workspaceAdminMiddleware: No user in request")
      res.status(401).json({
        success: false,
        error: "Authentication required",
      })
      return
    }

    if (!workspaceId) {
      logger.warn("workspaceAdminMiddleware: No workspace ID in request")
      res.status(400).json({
        success: false,
        error: "Workspace ID is required",
      })
      return
    }

    // Check if user is SUPER_ADMIN in this workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: user.id,
        workspaceId: workspaceId,
        role: "SUPER_ADMIN",
      },
    })

    if (!userWorkspace) {
      logger.warn(
        `Workspace admin access denied for user ${user.email} to workspace ${workspaceId}`
      )
      res.status(403).json({
        success: false,
        error: "Permission denied",
        message: "You must be a workspace admin to perform this action",
      })
      return
    }

    logger.info(
      `Workspace admin access granted for user ${user.email} to workspace ${workspaceId}`
    )
    next()
  } catch (error) {
    logger.error("workspaceAdminMiddleware error:", error)
    res.status(500).json({
      success: false,
      error: "Internal server error",
    })
  }
}
