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
        }
      }
    }

    const workspaceId =
      workspaceIdFromParams || workspaceIdFromQuery || workspaceIdFromHeaders

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

      res.status(400).json(debugResponse)
      return
    }

    // Check if workspace exists in database
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, isActive: true, isDelete: true },
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

      res.status(404).json(debugResponse)
      return
    }

    // ✅ CRITICAL: Solo workspace.isDelete blocca l'accesso admin
    // workspace.isActive blocca SOLO i messaggi WhatsApp (gestito in LLMService)
    if (workspace.isDelete) {
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

      res.status(403).json(debugResponse)
      return
    }

    // ⚠️ Se workspace.isActive = false, permetti comunque accesso admin
    // Il blocco dei messaggi WhatsApp è gestito in LLMService.handleMessage()
    if (!workspace.isActive) {
      logger.warn(
        `⚠️ Workspace ${workspaceId} is DISABLED - Admin access allowed, WhatsApp blocked`
      )
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

    res.status(500).json(debugResponse)
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
