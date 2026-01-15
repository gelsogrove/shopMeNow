import { NextFunction, Request, Response } from "express"
import { prisma } from "../../../lib/prisma"
import logger from "../../../utils/logger"

/**
 * Middleware to validate that a workspace ID is present in the request
 * This can be in the URL params, headers, or user context
 */
export const workspaceValidationMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const isProd = process.env.NODE_ENV === "production"
    // Extract workspace ID from various sources
    let workspaceIdFromParams = req.params.workspaceId
    const workspaceIdFromQuery = req.query.workspaceId as string
    const workspaceIdFromHeaders = req.headers["x-workspace-id"] as string

    // CRITICAL FIX: If workspaceId is not in params, extract it from URL manually
    if (!workspaceIdFromParams) {
      // Try to match /workspaces/{workspaceId} pattern
      let urlMatch = req.originalUrl.match(/\/workspaces\/([^\/\?]+)/)
      if (urlMatch && urlMatch[1]) {
        workspaceIdFromParams = urlMatch[1]
        // Also set it in params for downstream middleware
        req.params.workspaceId = workspaceIdFromParams
      } else {
        // Try to match /settings/{workspaceId}/gdpr pattern (frontend uses this)
        urlMatch = req.originalUrl.match(/\/settings\/([^\/\?]+)\/gdpr/)
        if (urlMatch && urlMatch[1]) {
          workspaceIdFromParams = urlMatch[1]
          // Also set it in params for downstream middleware
          req.params.workspaceId = workspaceIdFromParams
        } else {
          // Try to match /analytics/{workspaceId} pattern
          urlMatch = req.originalUrl.match(/\/analytics\/([^\/\?]+)/)
          if (urlMatch && urlMatch[1]) {
            workspaceIdFromParams = urlMatch[1]
            // Also set it in params for downstream middleware
            req.params.workspaceId = workspaceIdFromParams
          }
        }
      }
    }

    let workspaceId =
      workspaceIdFromParams || workspaceIdFromQuery || workspaceIdFromHeaders

    // 🆕 NEW: If still no workspaceId, try to extract from user's workspaces (JWT context)
    if (!workspaceId || workspaceId.trim() === "") {
      const user = (req as any).user
      const userWorkspaces = user?.workspaces || (req as any).userWorkspaces // 🔧 FIX: Check both locations

      logger.info(
        `🔍 No workspaceId in params/query/headers - checking user context`,
        {
          user: user?.email || "no user",
          workspacesCount: userWorkspaces?.length || 0,
        }
      )

      // If user has only ONE workspace, use it automatically
      if (userWorkspaces && userWorkspaces.length === 1) {
        workspaceId = userWorkspaces[0].id
        logger.info(
          `✅ Auto-selected single workspace for user: ${workspaceId}`
        )
      } else if (userWorkspaces && userWorkspaces.length > 1) {
        // Multiple workspaces - cannot auto-select
        logger.warn(
          `⚠️ User has ${userWorkspaces.length} workspaces - cannot auto-select`
        )
      }
    }

    if (!workspaceId || workspaceId.trim() === "") {
      // Create debug response with all the information
      const debugResponse = {
        message: "Workspace ID is required",
        debug: {
          url: req.originalUrl,
          method: req.method,
          params: req.params,
          query: req.query,
          headers: {
            "x-workspace-id": req.headers["x-workspace-id"],
            "workspace-id": req.headers["workspace-id"],
          },
          workspaceIdSources: {
            fromParams: workspaceIdFromParams,
            fromQuery: workspaceIdFromQuery,
            fromHeaders: workspaceIdFromHeaders,
          },
          finalWorkspaceId: workspaceId,
        },
        sqlQuery: "No SQL query executed - workspace ID missing",
      }

      const responsePayload = isProd
        ? { message: "Workspace ID is required" }
        : debugResponse

      res.status(400).json(responsePayload)
      return
    }

    // Check if workspace exists in database AND get owner status
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { 
        id: true, 
        name: true, 
        deletedAt: true,
        ownerId: true,
        owner: {
          select: {
            status: true
          }
        }
      },
    })

    if (!workspace) {
      const debugResponse = {
        message: "Workspace not found",
        debug: {
          workspaceId,
          url: req.originalUrl,
          method: req.method,
        },
      }

      const responsePayload = isProd
        ? { message: "Workspace not found" }
        : debugResponse

      res.status(404).json(responsePayload)
      return
    }

    // ✅ CRITICAL: Workspace soft-deleted blocks access
    if (workspace.deletedAt) {
      logger.info("❌ Workspace is deleted - blocking access")

      const debugResponse = {
        message: "Workspace is not available",
        debug: {
          workspaceId,
          workspace,
          url: req.originalUrl,
          method: req.method,
          reason: "Workspace is deleted",
        },
      }

      const responsePayload = isProd
        ? { message: "Workspace is not available" }
        : debugResponse

      res.status(403).json(responsePayload)
      return
    }

    // 🔒 CRITICAL: Check owner status - if INACTIVE, block ALL operations silently
    if (workspace.owner?.status === 'INACTIVE') {
      logger.warn(`🚫 Owner is DISABLED - silently blocking operation for workspace ${workspaceId}`)
      // Return 200 with empty success response (silent block)
      res.status(200).json({ success: true, message: "Operation completed" })
      return
    }

    // Store workspace info in request
    ;(req as any).workspace = workspace
    ;(req as any).workspaceId = workspaceId

    next()
  } catch (error) {
    logger.error("Workspace validation error:", error)
    logger.error("Workspace validation middleware error:", error)

    const debugResponse = {
      message: "Workspace validation failed",
      debug: {
        error: (error as Error).message,
        stack: (error as Error).stack,
        url: req.originalUrl,
        method: req.method,
      },
      sqlQuery: "Error occurred before SQL execution",
    }

    const responsePayload =
      process.env.NODE_ENV === "production"
        ? { message: "Workspace validation failed" }
        : debugResponse

    res.status(500).json(responsePayload)
    return
  }
}

/**
 * Helper function to validate if a workspace ID exists
 */
export async function validateWorkspaceId(
  workspaceId: string
): Promise<boolean> {
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    })

    return !!workspace
  } catch (error) {
    logger.error(`Error validating workspace ID ${workspaceId}:`, error)
    throw error
  }
}
