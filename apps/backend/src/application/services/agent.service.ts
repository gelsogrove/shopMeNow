import { prisma, PrismaClient, ChannelMode } from "@echatbot/database"
import { getFunctionsForAgentType } from "../../config/agent-function-mapping"
import { dynamicAgents } from "../../../prisma/data/dynamicAgents"
import { getValidAgentTypesForMode } from "../../utils/template-path.helper"
import logger from "../../utils/logger"
import { PromptProcessorService } from "../../services/prompt-processor.service"
import { PromptValidationError } from "../../utils/PromptValidationError"

/**
 * Service layer for Agents
 * Handles agent operations for AI assistants
 */
export class AgentService {
  private prisma: PrismaClient
  private promptProcessor: PromptProcessorService

  constructor() {
    this.prisma = prisma
    this.promptProcessor = new PromptProcessorService()
  }

  /**
   * Get all agents for a workspace
   * @param workspaceId Workspace ID
   * @returns List of agents
   */
  async getAllForWorkspace(workspaceId: string) {
    try {
      logger.info(`Getting all agents for workspace ${workspaceId}`)
      logger.info("DEBUG AGENT SERVICE: workspaceId:", workspaceId)

      // Ensure workspaceId is not undefined
      if (!workspaceId) {
        logger.warn("getAllForWorkspace called without workspaceId")
        return []
      }

      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { channelMode: true },
      })
      const channelMode: ChannelMode = workspace?.channelMode ?? "ECOMMERCE"
      const isInformational = channelMode !== "ECOMMERCE"
      const validAgentTypes = new Set(getValidAgentTypesForMode(channelMode))

      let agents = []
      try {
        agents = await this.prisma.agentConfig.findMany({
          where: {
            workspaceId,
            isActive: true, // ← AGGIUNTO: solo quelli attivi!
          },
        })
        logger.info("DEBUG AGENT SERVICE: Prisma result:", agents)
      } catch (prismaError) {
        logger.info("DEBUG AGENT SERVICE: Prisma query error:", prismaError)
      }
      if (!agents || agents.length === 0) {
        try {
          const rawAgents = await this.prisma.$queryRawUnsafe(
            `SELECT * FROM "Prompts" WHERE "workspaceId" = $1`,
            workspaceId
          )
          logger.info("DEBUG AGENT SERVICE: RAW SQL result:", rawAgents)
          return rawAgents
        } catch (rawError) {
          logger.info("DEBUG AGENT SERVICE: RAW SQL error:", rawError)
        }
      }
      logger.info(`Found ${agents.length} agents for workspace ${workspaceId}`)

      const filteredAgents = agents.filter((agent) => validAgentTypes.has(agent.type))

      const hasMissingPrompt = agents.some(
        (agent) => !agent.systemPrompt || agent.systemPrompt.trim() === ""
      )

      let defaultPromptsByType: Record<string, string> | null = null
      if (hasMissingPrompt) {
        defaultPromptsByType = Object.fromEntries(
          dynamicAgents(workspaceId, channelMode).map((agent) => [
            agent.type,
            agent.systemPrompt,
          ])
        )
      }

      // 🔄 MAPPING: Trasforma agentConfig per il frontend
      const mappedAgents = filteredAgents.map((agent) => {
        const fallbackPrompt =
          !agent.systemPrompt || agent.systemPrompt.trim() === ""
            ? defaultPromptsByType?.[agent.type] || ""
            : agent.systemPrompt

        let functions = getFunctionsForAgentType(agent.type) || []
        if (isInformational && (agent.type === "CUSTOMER_SUPPORT" || agent.type === "INFO_AGENT")) {
          const profileFunctions = getFunctionsForAgentType("PROFILE_MANAGEMENT") || []
          functions = Array.from(new Set([...functions, ...profileFunctions]))
        }

        const name =
          isInformational && (agent.type === "CUSTOMER_SUPPORT" || agent.type === "INFO_AGENT")
            ? "Info Agent"
            : agent.name
        const order =
          isInformational && (agent.type === "CUSTOMER_SUPPORT" || agent.type === "INFO_AGENT") ? 0 : agent.order

        return {
        id: agent.id,
        name,
        content: fallbackPrompt, // Backward compatibility
        systemPrompt: fallbackPrompt, // Standard
        workspaceId: agent.workspaceId,
        temperature: agent.temperature,
        model: agent.model,
        maxTokens: agent.maxTokens, // ✅ STANDARD: camelCase
        order,
        agentType: agent.type, // ✅ FIX: Database field is "type" not "agentType"
        isActive: agent.isActive,
        icon: agent.icon, // 🎨 Icon name from database
        functions, // ✅ FIX: Use "type" field
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
        }
      })

      logger.info("🔄 MAPPED agents for frontend:", mappedAgents)
      return mappedAgents
    } catch (error) {
      logger.error(`Error getting agents:`, error)
      return [] // Return empty array instead of throwing
    }
  }

  /**
   * Get or determine a workspace ID from user context or default
   * @param workspaceId Optional workspace ID directly provided
   * @param userContext User context that may contain workspace ID
   * @returns Workspace ID
   */
  getWorkspaceId(workspaceId?: string, userContext?: any): string {
    // If provided directly, use it
    if (workspaceId) {
      return workspaceId
    }

    // Try to get from user context
    if (userContext?.workspaceId) {
      return userContext.workspaceId
    }

    // Try to get from default workspace in database
    try {
      // This is synchronous so we can't use Prisma here directly
      // In a real app, this should be handled differently
      const defaultId =
        process.env.DEFAULT_WORKSPACE_ID || "default-workspace-id"
      logger.debug(`Using default workspace ID: ${defaultId}`)
      return defaultId
    } catch (error) {
      logger.error("Error getting default workspace ID:", error)
      return "default-workspace-id"
    }
  }

  /**
   * Update agent configuration (AgentConfig table)
   * 🔒 SECURITY: Only admin users can update prompt/content
   */
  async updateAgentConfig(
    id: string,
    data: any,
    workspaceId: string,
    userId?: string
  ) {
    try {
      logger.info(`🔄 Updating agentConfig ${id} for workspace ${workspaceId}`)
      logger.info("📝 Update data received:", data)
      logger.info("🌡️  Temperature in request:", {
        temperature: data.temperature,
        type: typeof data.temperature,
        isDefined: data.temperature !== undefined,
        isNull: data.temperature === null,
        isZero: data.temperature === 0,
      })

      // Ensure required data is present
      if (!id || !workspaceId) {
        logger.warn("Missing required data for updating agentConfig")
        throw new Error("ID and workspace ID are required")
      }

      // First check if the agentConfig exists and belongs to the workspace
      const existingAgent = await this.prisma.agentConfig.findFirst({
        where: {
          id,
          workspaceId,
        },
      })

      if (!existingAgent) {
        logger.warn(
          `❌ AgentConfig ${id} not found for workspace ${workspaceId}`
        )
        return null
      }

      // 🔒 SECURITY CHECK: Verify user is admin/owner if trying to update prompt/content
      if (
        userId &&
        (data.prompt !== undefined ||
          data.content !== undefined ||
          data.systemPrompt !== undefined)
      ) {
        const [user, workspace] = await Promise.all([
          this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, isPlatformAdmin: true },
          }),
          this.prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { ownerId: true },
          }),
        ])

        const isOwner = workspace?.ownerId === userId
        const isAdminRole =
          user?.role === "ADMIN" || user?.role === "OWNER"
        const isPrivileged = Boolean(
          isOwner || isAdminRole || user?.isPlatformAdmin
        )

        if (!isPrivileged) {
          logger.warn(
            `🚨 SECURITY: Non-admin/owner user ${userId} attempted to modify agent prompt`
          )
          throw new Error("Only admin/owner users can modify agent prompts")
        }

        logger.info(`✅ Privileged user ${userId} authorized to update prompt`)
      }

      // Map frontend fields to database fields (frontend → backend)
      const updateData: any = {}

      // 🔒 CRITICAL: Only allow prompt updates from verified admin users
      if (data.prompt !== undefined) updateData.systemPrompt = data.prompt
      if (data.content !== undefined) updateData.systemPrompt = data.content
      if (data.systemPrompt !== undefined)
        updateData.systemPrompt = data.systemPrompt

      // ✅ FEATURE 11: VALIDATE PROMPT VARIABLES BEFORE SAVING
      if (updateData.systemPrompt) {
        try {
          this.promptProcessor.validatePromptForDuplicateVariables(updateData.systemPrompt)
          logger.info(`✅ Prompt validation passed for agent ${id}`)
        } catch (validationError) {
          logger.error(`❌ Prompt validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}`)
          throw validationError
        }
      }

      // These fields can be updated by any authenticated user
      if (data.model !== undefined) updateData.model = data.model
      if (data.temperature !== undefined)
        updateData.temperature = data.temperature
      if (data.maxTokens !== undefined) updateData.maxTokens = data.maxTokens
      if (data.isActive !== undefined) updateData.isActive = data.isActive
      if (data.availableFunctions !== undefined) updateData.availableFunctions = data.availableFunctions

      logger.info("🛠️ Prepared update data:", updateData)
      logger.info("🌡️  Temperature in updateData:", {
        temperature: updateData.temperature,
        type: typeof updateData.temperature,
        willUpdate: updateData.temperature !== undefined,
      })

      // Update the agentConfig
      const updatedAgent = await this.prisma.agentConfig.update({
        where: { id },
        data: updateData,
      })

      logger.info(`✅ AgentConfig ${id} updated successfully`)
      logger.info("🌡️  Temperature after update:", updatedAgent.temperature)

      // Map database fields back to frontend format (backend → frontend)
      const mappedAgent = {
        ...updatedAgent,
        content: updatedAgent.systemPrompt, // Backward compatibility
        systemPrompt: updatedAgent.systemPrompt, // Standard
        maxTokens: updatedAgent.maxTokens, // ✅ STANDARD: camelCase
        agentType: updatedAgent.type, // Legacy frontend compatibility
        name: updatedAgent.name || `Agent-${updatedAgent.workspaceId}`,
        createdAt: updatedAgent.createdAt?.toISOString(),
        updatedAt: updatedAgent.updatedAt?.toISOString(),
      }

      return mappedAgent
    } catch (error) {
      logger.error(`❌ Error updating agentConfig:`, error)
      throw error
    }
  }
}

// Export a singleton instance for backward compatibility
export const agentService = new AgentService()
