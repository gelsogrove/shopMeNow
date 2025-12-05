import { NextFunction, Request, Response } from "express"
import { PrismaClient } from "@echatbot/database"
import logger from "../utils/logger"

const prisma = new PrismaClient()

/**
 * Middleware to require SUPER_ADMIN role for workspace operations
 * Must be used AFTER authMiddleware and validateWorkspaceOperation
 * 
 * SUPER_ADMIN is determined by checking if the user is the workspace owner (ownerId)
 * OR if the user's role in UserWorkspace is "SUPER_ADMIN"
 */
export const requireSuperAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id
    const workspaceId = (req as any).workspaceId || req.params.workspaceId

    if (!userId) {
      logger.warn("requireSuperAdmin: No user ID found in request")
      res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      })
      return
    }

    if (!workspaceId) {
      logger.warn("requireSuperAdmin: No workspace ID found in request")
      res.status(400).json({
        error: "Bad Request",
        message: "Workspace ID is required",
      })
      return
    }

    // Check if user is the workspace owner
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    })

    if (!workspace) {
      logger.warn(`requireSuperAdmin: Workspace ${workspaceId} not found`)
      res.status(404).json({
        error: "Not Found",
        message: "Workspace not found",
      })
      return
    }

    // User is SUPER_ADMIN if they are the owner
    const isSuperAdmin = workspace.ownerId === userId

    // Also check UserWorkspace role for backward compatibility
    if (!isSuperAdmin) {
      const userWorkspace = await prisma.userWorkspace.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId,
          },
        },
      })

      if (userWorkspace?.role === "SUPER_ADMIN") {
        // User has SUPER_ADMIN role in UserWorkspace
        logger.info(
          `✅ SUPER_ADMIN access granted for user ${userId.substring(0, 8)}... via UserWorkspace role`
        )
        next()
        return
      }

      logger.warn(
        `requireSuperAdmin: User ${userId.substring(0, 8)}... is not SUPER_ADMIN of workspace ${workspaceId.substring(0, 8)}...`
      )
      res.status(403).json({
        error: "Forbidden",
        message: "Only workspace owner can perform this action",
      })
      return
    }

    logger.info(
      `✅ SUPER_ADMIN access granted for user ${userId.substring(0, 8)}... (workspace owner)`
    )
    next()
  } catch (error) {
    logger.error("Error in requireSuperAdmin middleware:", error)
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to verify permissions",
    })
  }
}

/**
 * Middleware to require OWNER role only (not just SUPER_ADMIN)
 * This is stricter than requireSuperAdmin - only the actual workspace owner can access
 * Must be used AFTER authMiddleware and validateWorkspaceOperation
 * 
 * Use case: Agent Configuration - only owner should see/edit AI prompts
 */
export const requireOwner = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id
    const workspaceId = (req as any).workspaceId || req.params.workspaceId

    if (!userId) {
      logger.warn("requireOwner: No user ID found in request")
      res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      })
      return
    }

    if (!workspaceId) {
      logger.warn("requireOwner: No workspace ID found in request")
      res.status(400).json({
        error: "Bad Request",
        message: "Workspace ID is required",
      })
      return
    }

    // Check if user is the workspace owner (ownerId)
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    })

    if (!workspace) {
      logger.warn(`requireOwner: Workspace ${workspaceId} not found`)
      res.status(404).json({
        error: "Not Found",
        message: "Workspace not found",
      })
      return
    }

    // STRICT: Only ownerId can access (no SUPER_ADMIN role fallback)
    if (workspace.ownerId !== userId) {
      logger.warn(
        `requireOwner: User ${userId.substring(0, 8)}... is not the owner of workspace ${workspaceId.substring(0, 8)}...`
      )
      res.status(403).json({
        error: "Forbidden",
        message: "Only workspace owner can access agent configuration",
      })
      return
    }

    logger.info(
      `✅ Owner access granted for user ${userId.substring(0, 8)}... to workspace ${workspaceId.substring(0, 8)}...`
    )
    next()
  } catch (error) {
    logger.error("Error in requireOwner middleware:", error)
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to verify ownership",
    })
  }
}

/**
 * Middleware to require workspace membership (any role)
 * Must be used AFTER authMiddleware
 */
export const requireWorkspaceMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id
    const workspaceId = (req as any).workspaceId || req.params.workspaceId

    if (!userId) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      })
      return
    }

    if (!workspaceId) {
      res.status(400).json({
        error: "Bad Request",
        message: "Workspace ID is required",
      })
      return
    }

    const membership = await prisma.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    })

    if (!membership) {
      logger.warn(
        `requireWorkspaceMember: User ${userId.substring(0, 8)}... is not a member of workspace ${workspaceId.substring(0, 8)}...`
      )
      res.status(403).json({
        error: "Forbidden",
        message: "You are not a member of this workspace",
      })
      return
    }

    // Attach role to request for downstream use
    ;(req as any).userRole = membership.role

    logger.info(
      `✅ Workspace member access granted for user ${userId.substring(0, 8)}... with role ${membership.role}`
    )
    next()
  } catch (error) {
    logger.error("Error in requireWorkspaceMember middleware:", error)
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to verify membership",
    })
  }
}
