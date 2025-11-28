import { PrismaClient } from "@prisma/client"
import { Request, Response } from "express"
import logger from "../../../utils/logger"

/**
 * Agent Configuration Controller
 * Handles API requests for agent configuration and available functions
 */
export class AgentConfigController {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get all agent configurations for a workspace
   * Returns agents with their available functions from database
   *
   * @swagger
   * /api/workspaces/{workspaceId}/agent-config:
   *   get:
   *     summary: Get all agent configurations
   *     description: Returns all agents with their available functions, prompts, and settings
   *     tags: [Agent Configuration]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: Workspace ID
   *       - in: header
   *         name: x-workspace-id
   *         required: true
   *         schema:
   *           type: string
   *         description: Workspace ID (must match path parameter)
   *     responses:
   *       200:
   *         description: Agent configurations retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 agents:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       name:
   *                         type: string
   *                       type:
   *                         type: string
   *                       description:
   *                         type: string
   *                       icon:
   *                         type: string
   *                       systemPrompt:
   *                         type: string
   *                       model:
   *                         type: string
   *                       temperature:
   *                         type: number
   *                       maxTokens:
   *                         type: number
   *                       order:
   *                         type: number
   *                       isActive:
   *                         type: boolean
   *                       availableFunctions:
   *                         type: array
   *                         items:
   *                           type: string
   *                         description: Array of function names this agent can call
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *       403:
   *         description: Forbidden - Workspace access denied
   *       500:
   *         description: Internal server error
   */
  async getAgentConfigs(req: Request, res: Response) {
    try {
      // Extract workspaceId from middleware
      const workspaceId = (req as any).workspaceId

      if (!workspaceId) {
        return res.status(400).json({
          error: "Workspace ID required",
          message: "workspaceId must be provided",
        })
      }

      // Fetch all agents for workspace, ordered by order field
      const agents = await this.prisma.agentConfig.findMany({
        where: {
          workspaceId,
        },
        orderBy: {
          order: "asc",
        },
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
          icon: true,
          systemPrompt: true,
          model: true,
          temperature: true,
          maxTokens: true,
          order: true,
          isActive: true,
          availableFunctions: true, // ✅ Now populated from agent-functions.config.ts
        },
      })

      logger.info(
        `✅ Agent configs retrieved for workspace ${workspaceId}: ${agents.length} agents`
      )

      return res.status(200).json({
        agents,
      })
    } catch (error) {
      logger.error("❌ Failed to get agent configs:", error)
      return res.status(500).json({
        error: "Failed to get agent configs",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
