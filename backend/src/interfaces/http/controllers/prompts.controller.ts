import { NextFunction, Request, Response } from "express"
import { AgentService } from "../../../application/services/agent.service"
import logger from "../../../utils/logger"

export class PromptsController {
  private agentService: AgentService

  constructor() {
    this.agentService = new AgentService()
  }

  /**
   * Get all prompts for a workspace
   */
  async getAllPrompts(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId } = req.params
      logger.info(`Getting all prompts for workspace ${workspaceId}`)

      const prompts = await this.agentService.getAllForWorkspace(workspaceId)
      res.json(prompts)
    } catch (error) {
      logger.error("Error fetching prompts:", error)
      next(error)
    }
  }

  /**
   * ⚠️ DEPRECATED: Direct CRUD operations on prompts are no longer supported
   * Prompts are now managed through agentConfig table
   * Use agent configuration APIs instead
   */
  async getPromptById(req: Request, res: Response, next: NextFunction) {
    res.status(501).json({
      error: "Not Implemented",
      message:
        "Direct prompt operations are deprecated. Use agent configuration APIs.",
    })
  }

  /**
   * ⚠️ DEPRECATED: Direct CRUD operations on prompts are no longer supported
   */
  async createPrompt(req: Request, res: Response, next: NextFunction) {
    res.status(501).json({
      error: "Not Implemented",
      message:
        "Direct prompt operations are deprecated. Use agent configuration APIs.",
    })
  }

  /**
   * ⚠️ DEPRECATED: Direct CRUD operations on prompts are no longer supported
   */
  async updatePrompt(req: Request, res: Response, next: NextFunction) {
    res.status(501).json({
      error: "Not Implemented",
      message:
        "Direct prompt operations are deprecated. Use agent configuration APIs.",
    })
  }

  /**
   * ⚠️ DEPRECATED: Direct CRUD operations on prompts are no longer supported
   */
  async deletePrompt(req: Request, res: Response, next: NextFunction) {
    res.status(501).json({
      error: "Not Implemented",
      message:
        "Direct prompt operations are deprecated. Use agent configuration APIs.",
    })
  }

  /**
   * ⚠️ DEPRECATED: Direct CRUD operations on prompts are no longer supported
   */
  async duplicatePrompt(req: Request, res: Response, next: NextFunction) {
    res.status(501).json({
      error: "Not Implemented",
      message:
        "Direct prompt operations are deprecated. Use agent configuration APIs.",
    })
  }
}
