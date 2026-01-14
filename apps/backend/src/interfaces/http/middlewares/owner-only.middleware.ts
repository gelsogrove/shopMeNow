/**
 * Owner-Only Middleware
 * Ensures that only the workspace owner can perform the action
 * 
 * CRITICAL: Use this for sensitive operations like:
 * - Deleting workspace
 * - Modifying debugMode
 * - Changing billing settings
 * - Managing team members (future)
 * 
 * Usage:
 * router.put('/workspaces/:workspaceId/debug-mode',
 *   authMiddleware,
 *   workspaceValidationMiddleware,
 *   ownerOnlyMiddleware,  // ← Add this
 *   controller.updateDebugMode
 * )
 */

import { NextFunction, Request, Response } from "express"
import { prisma } from "../../../lib/prisma"
import logger from "../../../utils/logger"

export const ownerOnlyMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract workspaceId (set by workspaceValidationMiddleware)
    const workspaceId = (req as any).workspaceId || req.params.workspaceId

    if (!workspaceId) {
      logger.error("❌ Owner-only check failed: No workspaceId found")
      res.status(400).json({
        error: "WORKSPACE_ID_REQUIRED",
        message: "Workspace ID is required",
      })
      return
    }

    // Extract userId (set by authMiddleware)
    const userId = (req as any).user?.id

    if (!userId) {
      logger.error("❌ Owner-only check failed: No userId found")
      res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Authentication required",
      })
      return
    }

    // Fetch workspace to check ownership
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true, name: true },
    })

    if (!workspace) {
      logger.error("❌ Owner-only check failed: Workspace not found", { workspaceId })
      res.status(404).json({
        error: "WORKSPACE_NOT_FOUND",
        message: "Workspace not found",
      })
      return
    }

    // Check if user is the owner
    if (workspace.ownerId !== userId) {
      logger.warn("🚫 Owner-only action blocked", {
        workspaceId,
        workspaceName: workspace.name,
        userId,
        ownerId: workspace.ownerId,
        action: `${req.method} ${req.path}`,
      })
      
      res.status(403).json({
        error: "FORBIDDEN",
        message: "Only the workspace owner can perform this action",
      })
      return
    }

    logger.debug("✅ Owner-only check passed", {
      workspaceId,
      userId,
      action: `${req.method} ${req.path}`,
    })

    next()
  } catch (error) {
    logger.error("❌ Owner-only middleware error", error)
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to verify ownership",
    })
  }
}
