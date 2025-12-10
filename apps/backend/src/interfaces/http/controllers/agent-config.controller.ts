import { PrismaClient, AgentType } from "@echatbot/database"
import { Request, Response } from "express"
import archiver from "archiver"
import logger from "../../../utils/logger"
import { defaultAgents } from "../../../../prisma/data/defaultAgents"
import { dynamicAgents } from "../../../../prisma/data/dynamicAgents"

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

      // Check if workspace is e-commerce or info-only
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { sellsProductsAndServices: true },
      })
      const hasEcommerce = workspace?.sellsProductsAndServices ?? true

      // E-commerce only agent types - hide these for info-only workspaces
      const ecommerceOnlyTypes: AgentType[] = ["PRODUCT_SEARCH", "CART_MANAGEMENT", "ORDER_TRACKING"]

      // Fetch all agents for workspace, ordered by order field
      const agents = await this.prisma.agentConfig.findMany({
        where: {
          workspaceId,
          // Filter out e-commerce agents for info-only workspaces
          ...(hasEcommerce ? {} : { type: { notIn: ecommerceOnlyTypes } }),
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
        `✅ Agent configs retrieved for workspace ${workspaceId}: ${agents.length} agents (hasEcommerce: ${hasEcommerce})`
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

  /**
   * Reset all agent prompts to default values
   * This will overwrite all current prompts with the default ones from docs/prompts/
   *
   * @swagger
   * /api/workspaces/{workspaceId}/agent-config/reset-to-defaults:
   *   post:
   *     summary: Reset all agent prompts to defaults
   *     description: Resets all agent configurations to their default values from the seed files. WARNING - This will overwrite all customizations!
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
   *         description: Agent configurations reset successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 resetCount:
   *                   type: number
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *       403:
   *         description: Forbidden - Only workspace owner can reset prompts
   *       500:
   *         description: Internal server error
   */
  async resetToDefaults(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId
      const { useDynamicTemplates } = req.body || {}

      if (!workspaceId) {
        return res.status(400).json({
          error: "Workspace ID required",
          message: "workspaceId must be provided",
        })
      }

      // Get workspace to determine if it's e-commerce or info-only
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { sellsProductsAndServices: true },
      })
      const hasEcommerce = workspace?.sellsProductsAndServices ?? true

      // Choose which templates to load:
      // - useDynamicTemplates=true: Load from src/templates/ with {{#if}} conditionals
      // - useDynamicTemplates=false (default): Load from docs/prompts/ (legacy)
      const templateSource = useDynamicTemplates ? "dynamic ({{#if}} templates)" : "legacy (docs/prompts)"
      const workspaceType = hasEcommerce ? "e-commerce" : "informational"
      logger.info(`🔄 Resetting agent configs to ${templateSource} for ${workspaceType} workspace ${workspaceId}`)

      // Get agent configurations from appropriate source
      const defaults = useDynamicTemplates 
        ? dynamicAgents(workspaceId, hasEcommerce) 
        : defaultAgents(workspaceId)

      // Update each agent with default values
      let resetCount = 0
      for (const defaultAgent of defaults) {
        try {
          await this.prisma.agentConfig.updateMany({
            where: {
              workspaceId,
              type: defaultAgent.type,
            },
            data: {
              name: defaultAgent.name,
              systemPrompt: defaultAgent.systemPrompt,
              description: defaultAgent.description,
              icon: defaultAgent.icon,
              model: defaultAgent.model,
              temperature: defaultAgent.temperature,
              maxTokens: defaultAgent.maxTokens,
              order: defaultAgent.order,
              isActive: defaultAgent.isActive,
              availableFunctions: defaultAgent.availableFunctions,
            },
          })
          resetCount++
        } catch (updateError) {
          logger.warn(`⚠️ Could not update agent ${defaultAgent.type}:`, updateError)
        }
      }

      logger.info(`✅ Reset ${resetCount} agent configs to ${templateSource} for workspace ${workspaceId}`)

      return res.status(200).json({
        message: `Agent configurations reset to ${templateSource} successfully`,
        resetCount,
        templateSource: useDynamicTemplates ? "dynamic" : "legacy",
      })
    } catch (error) {
      logger.error("❌ Failed to reset agent configs:", error)
      return res.status(500).json({
        error: "Failed to reset agent configs",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * Export all agent prompts as a ZIP file with .md files
   *
   * @swagger
   * /api/workspaces/{workspaceId}/agent-config/export:
   *   get:
   *     summary: Export all agent prompts as ZIP
   *     description: Downloads a ZIP file containing all agent prompts as markdown files
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
   *         description: ZIP file with agent prompts
   *         content:
   *           application/zip:
   *             schema:
   *               type: string
   *               format: binary
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *       403:
   *         description: Forbidden - Only workspace owner can export prompts
   *       500:
   *         description: Internal server error
   */
  async exportPrompts(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId

      if (!workspaceId) {
        return res.status(400).json({
          error: "Workspace ID required",
          message: "workspaceId must be provided",
        })
      }

      logger.info(`📦 Exporting agent prompts for workspace ${workspaceId}`)

      // Fetch all agents for workspace
      const agents = await this.prisma.agentConfig.findMany({
        where: { workspaceId },
        orderBy: { order: "asc" },
        select: {
          name: true,
          type: true,
          systemPrompt: true,
        },
      })

      if (agents.length === 0) {
        return res.status(404).json({
          error: "No agents found",
          message: "No agent configurations found for this workspace",
        })
      }

      // Get workspace name for the filename
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true, slug: true },
      })

      const workspaceName = workspace?.slug || workspace?.name || workspaceId
      const sanitizedName = workspaceName.toLowerCase().replace(/[^a-z0-9]/g, "-")
      const timestamp = new Date().toISOString().split("T")[0] // YYYY-MM-DD

      // Set response headers for ZIP download
      res.setHeader("Content-Type", "application/zip")
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="agent-prompts-${sanitizedName}-${timestamp}.zip"`
      )

      // Create archive
      const archive = archiver("zip", { zlib: { level: 9 } })

      // Pipe archive to response
      archive.pipe(res)

      // Add each agent's prompt as a .md file
      for (const agent of agents) {
        const filename = `${agent.type.toLowerCase()}-agent.md`
        const content = agent.systemPrompt || `# ${agent.name}\n\nNo prompt configured.`
        
        // Add file header with metadata
        const fullContent = `# ${agent.name}\n\n<!-- Agent Type: ${agent.type} -->\n<!-- Exported: ${new Date().toISOString()} -->\n\n${content}`
        
        archive.append(fullContent, { name: filename })
      }

      // Finalize archive
      await archive.finalize()

      logger.info(`✅ Exported ${agents.length} agent prompts for workspace ${workspaceId}`)
    } catch (error) {
      logger.error("❌ Failed to export agent prompts:", error)
      return res.status(500).json({
        error: "Failed to export agent prompts",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}

