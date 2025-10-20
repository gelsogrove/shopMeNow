import { NextFunction, Request, Response } from "express"
import {
  AgentService,
  agentService as applicationAgentService,
} from "../../../application/services/agent.service"
import { WorkspaceService } from "../../../application/services/workspace.service"
import { prisma } from "../../../lib/prisma"
import logger from "../../../utils/logger"

export class AgentController {
  private agentService: AgentService

  constructor(agentService?: AgentService) {
    this.agentService = agentService || applicationAgentService
  }

  /**
   * Get all agents for a workspace
   */
  getAllForWorkspace = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const paramId = req.params.workspaceId
      const customId = (req as any).workspaceId
      const headerId = req.headers["x-workspace-id"] as string
      const userId = (req as any).user ? ((req as any).user as any).id : null

      // Try to get workspaceId from multiple sources
      let workspaceId = paramId || customId || headerId

      logger.info("Agent controller - workspaceId:", workspaceId)
      logger.info("Agent controller - sources:", {
        paramId,
        customId,
        headerId,
        userId,
      })

      if (!workspaceId) {
        return res.status(400).json({
          message: "Workspace ID is required",
          debug: { paramId, customId, headerId, userId, final: workspaceId },
        })
      }

      // Check if workspace exists using WorkspaceService (secure Prisma query)
      const workspaceService = new WorkspaceService(prisma)
      const workspace = await workspaceService.getById(workspaceId)
      if (!workspace) {
        return res.status(404).json({
          message: "Workspace not found",
          workspaceId,
        })
      }

      logger.info(`Getting all agents for workspace ${workspaceId}`)

      const agents = await this.agentService.getAllForWorkspace(workspaceId)
      logger.info("=== AGENT CONTROLLER SUCCESS ===")
      logger.info(
        `Found ${Array.isArray(agents) ? agents.length : 0} agents for workspace ${workspaceId}`
      )
      return res.json(agents)
    } catch (error) {
      logger.info("=== AGENT CONTROLLER ERROR ===", error)
      logger.error("Error fetching agents:", error)
      return next(error)
    }
  }

  /**
   * Get a specific agent by ID
   */
  /**
   * Update an existing agent
   */
  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params

      // Extract workspaceId the same way as getAllForWorkspace
      const paramId = req.params.workspaceId
      const customId = (req as any).workspaceId
      const headerId = req.headers["x-workspace-id"] as string

      // Try to get workspaceId from multiple sources
      let workspaceId = paramId || customId || headerId

      logger.info("Agent update - workspaceId:", workspaceId)
      logger.info("Agent update - sources:", { paramId, customId, headerId })

      if (!workspaceId) {
        return res.status(400).json({
          message: "Workspace ID is required for update",
          debug: { paramId, customId, headerId },
        })
      }

      logger.info(`Updating agentConfig ${id} for workspace ${workspaceId}`)

      // Extract userId from authenticated request for security check
      const userId = (req as any).user?.id

      // Use updateAgentConfig method for AgentConfig table
      const updatedAgent = await this.agentService.updateAgentConfig(
        id,
        req.body,
        workspaceId,
        userId // Pass userId for admin verification
      )

      if (!updatedAgent) {
        return res.status(404).json({ message: "Agent not found" })
      }

      return res.json(updatedAgent)
    } catch (error: any) {
      logger.error("Error updating agent:", error)

      // Check if this is a conflict error (duplicate router agent)
      if (
        error.message &&
        error.message.includes("router agent already exists")
      ) {
        return res.status(409).json({
          message: "A router agent already exists for this workspace",
        })
      }

      return next(error)
    }
  }

  /**
   * Handle API errors with consistent response format
   */
  private handleError(res: Response, err: any, message: string): void {
    const statusCode = err.statusCode || 500
    const errorMessage = err.message || message

    logger.error(`${message}:`, err)

    res.status(statusCode).json({
      status: "error",
      message: errorMessage,
    })
  }
}
