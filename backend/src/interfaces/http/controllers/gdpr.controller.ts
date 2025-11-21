import { Request, Response } from "express"
import logger from "../../../utils/logger"
import { gdprService, GdprContent } from "../../../services/gdpr.service"

export class GdprController {
  /**
   * Get GDPR content for a workspace (all 4 languages)
   */
  async getGdpr(req: Request, res: Response): Promise<Response | void> {
    try {
      const workspaceId = req.params.workspaceId || (req as any).workspaceId

      if (!workspaceId) {
        logger.warn(`[GdprController] Missing workspaceId`)
        return res.status(400).json({
          error: "Missing workspaceId",
          message: "Workspace ID is required",
        })
      }

      const gdprContent = await gdprService.getGdprContent(workspaceId)

      if (!gdprContent) {
        logger.warn(`[GdprController] No GDPR content found for workspace: ${workspaceId}`)
        return res.status(404).json({
          error: "Not found",
          message: "GDPR content not found for this workspace",
        })
      }

      logger.info(`[GdprController] GDPR content served for workspace: ${workspaceId}`)

      return res.json(gdprContent)
    } catch (error) {
      logger.error(`[GdprController] Error retrieving GDPR content:`, error)
      return res.status(500).json({
        error: "Failed to retrieve GDPR content",
        message: (error as Error).message,
      })
    }
  }

  /**
   * Update GDPR content for a workspace (all 4 languages)
   */
  async updateGdpr(req: Request, res: Response): Promise<Response | void> {
    try {
      const workspaceId = req.params.workspaceId || (req as any).workspaceId
      const { gdpr_ita, gdpr_esp, gdpr_eng, gdpr_prt } = req.body

      if (!workspaceId) {
        logger.warn(`[GdprController] Missing workspaceId`)
        return res.status(400).json({
          error: "Missing workspaceId",
          message: "Workspace ID is required",
        })
      }

      // Validate all 4 languages are provided
      if (!gdpr_ita || !gdpr_esp || !gdpr_eng || !gdpr_prt) {
        logger.warn(`[GdprController] Missing GDPR content fields`)
        return res.status(400).json({
          error: "Invalid content",
          message: "All 4 languages must be provided: gdpr_ita, gdpr_esp, gdpr_eng, gdpr_prt",
        })
      }

      const data: GdprContent = { gdpr_ita, gdpr_esp, gdpr_eng, gdpr_prt }
      const result = await gdprService.updateGdprContent(workspaceId, data)

      logger.info(`[GdprController] GDPR content updated for workspace: ${workspaceId}`)

      return res.json(result)
    } catch (error) {
      logger.error(`[GdprController] Error updating GDPR content:`, error)
      return res.status(500).json({
        error: "Failed to update GDPR content",
        message: (error as Error).message,
      })
    }
  }
}

export const gdprController = new GdprController()
