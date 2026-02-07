import { PrismaClient, AgentType } from "@echatbot/database"
import { Request, Response } from "express"
import archiver from "archiver"
import logger from "../../../utils/logger"
import { agentService } from "../../../application/services/agent.service"
import { defaultAgents } from "../../../../prisma/data/defaultAgents"
import { dynamicAgents } from "../../../../prisma/data/dynamicAgents"
import { TemplateLoaderService } from "../../../application/services/template-loader.service"
import { PromptValidationError } from "../../../utils/PromptValidationError"
import { getAgentFunctionNames } from "../../../config/agent-functions.config"

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
      const isInformational = !hasEcommerce

      // E-commerce only agent types - hide these for info-only workspaces
      const ecommerceOnlyTypes: AgentType[] = ["PRODUCT_SEARCH", "CART_MANAGEMENT", "ORDER_TRACKING"]
      const infoOnlyHiddenTypes: AgentType[] = ["ROUTER", "PROFILE_MANAGEMENT"]
      const excludedTypes = hasEcommerce ? [] : [...ecommerceOnlyTypes, ...infoOnlyHiddenTypes]

      // Fetch all agents for workspace, ordered by order field
      const agents = await this.prisma.agentConfig.findMany({
        where: {
          workspaceId,
          // Filter out e-commerce agents for info-only workspaces
          ...(excludedTypes.length > 0 ? { type: { notIn: excludedTypes } } : {}),
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

      const infoAgentFunctions = isInformational
        ? Array.from(
            new Set([
              ...(getAgentFunctionNames("CUSTOMER_SUPPORT") || []),
              ...(getAgentFunctionNames("PROFILE_MANAGEMENT") || []),
            ])
          )
        : null

      const mappedAgents = agents.map((agent) => {
        if (isInformational && agent.type === "CUSTOMER_SUPPORT") {
          return {
            ...agent,
            name: "Info Agent",
            description: "Answers FAQs and informational requests",
            order: 0,
            availableFunctions: infoAgentFunctions,
          }
        }
        return agent
      })

      logger.info(
        `✅ Agent configs retrieved for workspace ${workspaceId}: ${agents.length} agents (hasEcommerce: ${hasEcommerce})`
      )

      return res.status(200).json({
        agents: mappedAgents,
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
   * Update a single agent configuration
   *
   * @swagger
   * /api/workspaces/{workspaceId}/agent-config/{agentId}:
   *   put:
   *     summary: Update agent configuration
   *     description: Updates a specific agent's prompt and settings
   *     tags: [Agent Configuration]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: agentId
   *         required: true
   *         schema:
   *           type: string
   *       - in: header
   *         name: x-workspace-id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Agent updated successfully
   *       400:
   *         description: Invalid request
   *       403:
   *         description: Forbidden - only owner can update prompts
   *       404:
   *         description: Agent not found
   *       422:
   *         description: Prompt validation failed
   */
  async updateAgentConfig(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId
      const agentId = req.params.agentId
      const userId = (req as any).user?.id

      if (!workspaceId || !agentId) {
        return res.status(400).json({
          error: "Bad Request",
          message: "workspaceId and agentId are required",
        })
      }

      const updatedAgent = await agentService.updateAgentConfig(
        agentId,
        req.body || {},
        workspaceId,
        userId
      )

      if (!updatedAgent) {
        return res.status(404).json({
          error: "Not Found",
          message: "Agent configuration not found",
        })
      }

      return res.status(200).json(updatedAgent)
    } catch (error) {
      if (error instanceof PromptValidationError) {
        return res.status(error.statusCode).json({
          error: error.code,
          message: error.message,
        })
      }

      if (error instanceof Error && error.message.includes("Only admin")) {
        return res.status(403).json({
          error: "Forbidden",
          message: error.message,
        })
      }

      logger.error("❌ Failed to update agent config:", error)
      return res.status(500).json({
        error: "Failed to update agent config",
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
      const hasEcommerce = workspace?.sellsProductsAndServices === true

      // Choose which templates to load:
      // - useDynamicTemplates=true: Load from src/templates/ with {{#if}} conditionals
      // - useDynamicTemplates=false (default): Load from docs/prompts/ (legacy)
      const templateSource = "latest .template.md files"
      const workspaceType = hasEcommerce ? "e-commerce" : "informational"
      logger.info(`🔄 Resetting agent configs from ${templateSource} for ${workspaceType} workspace ${workspaceId}`)

      // Load templates directly from files (latest version)
      const templateLoader = TemplateLoaderService.getInstance(this.prisma)
      
      // ✅ 1. IDENTIFY & CREATE MISSING AGENTS
      // Get the full list of expected agents for this workspace type
      const expectedAgents = dynamicAgents(workspaceId, hasEcommerce)
      
      // Get all existing agent configs
      const existingAgents = await this.prisma.agentConfig.findMany({
        where: { workspaceId },
      })
      const existingTypes = new Set(existingAgents.map(a => a.type))

      // Create any missing agents (e.g., ROUTER might be missing in old workspaces)
      let createdCount = 0
      for (const expected of expectedAgents) {
        if (!existingTypes.has(expected.type)) {
          logger.info(`➕ Creating missing agent ${expected.type} for workspace ${workspaceId}`)
          // Ensure prompt is loaded from template
          const freshTemplate = await templateLoader.loadAndRenderTemplate(
            expected.type,
            workspaceId
          )
          
          await this.prisma.agentConfig.create({
            data: {
              workspaceId,
              name: expected.name,
              type: expected.type,
              description: expected.description,
              icon: expected.icon,
              systemPrompt: freshTemplate || expected.systemPrompt || "", 
              model: expected.model,
              temperature: expected.temperature,
              maxTokens: expected.maxTokens,
              order: expected.order,
              isActive: expected.isActive,
              availableFunctions: expected.availableFunctions,
            },
          })
          createdCount++
          
          // Add to existingAgents list so it gets processed in the update loop (if needed) 
          // or just consider it done. Actually, creation is enough.
          // We won't add it to existingAgents to avoid double update in the loop below.
        }
      }
      
      if (createdCount > 0) {
        logger.info(`✅ Created ${createdCount} missing agents`)
      }

      // ✅ 2. UPDATE EXISTING AGENTS
      // Refresh list to include newly created ones if we want to return them? 
      // For now, let's just update the ones that ruled existed before. 
      // Actually, newly created ones already have fresh template, so no need to update them.
      
      let resetCount = 0
      for (const agent of existingAgents) {
        try {
          // Load the latest template file for this agent type
          const freshTemplate = await templateLoader.loadAndRenderTemplate(
            agent.type,
            workspaceId
          )
          
          await this.prisma.agentConfig.update({
            where: { id: agent.id },
            data: {
              systemPrompt: freshTemplate, // Load from file, not from seed!
            },
          })
          resetCount++
          logger.info(`✅ Reset ${agent.type} from template file`)
        } catch (updateError) {
          logger.warn(`⚠️ Could not update agent ${agent.type}:`, updateError)
        }
      }

      logger.info(`✅ Reset ${resetCount} agent configs from ${templateSource} for workspace ${workspaceId}`)

      return res.status(200).json({
        message: `Agent configurations reset from latest template files successfully`,
        resetCount,
        templateSource: "latest .template.md files",
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

      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true, slug: true, sellsProductsAndServices: true },
      })
      const hasEcommerce = workspace?.sellsProductsAndServices ?? true
      const isInformational = !hasEcommerce
      const ecommerceOnlyTypes: AgentType[] = ["PRODUCT_SEARCH", "CART_MANAGEMENT", "ORDER_TRACKING"]
      const infoOnlyHiddenTypes: AgentType[] = ["ROUTER", "PROFILE_MANAGEMENT"]
      const excludedTypes = hasEcommerce ? [] : [...ecommerceOnlyTypes, ...infoOnlyHiddenTypes]

      // Fetch all agents for workspace
      const agents = await this.prisma.agentConfig.findMany({
        where: {
          workspaceId,
          ...(excludedTypes.length > 0 ? { type: { notIn: excludedTypes } } : {}),
        },
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
        const displayName =
          isInformational && agent.type === "CUSTOMER_SUPPORT"
            ? "Info Agent"
            : agent.name
        const content = agent.systemPrompt || `# ${displayName}\n\nNo prompt configured.`
        
        // Add file header with metadata
        const fullContent = `# ${displayName}\n\n<!-- Agent Type: ${agent.type} -->\n<!-- Exported: ${new Date().toISOString()} -->\n\n${content}`
        
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
