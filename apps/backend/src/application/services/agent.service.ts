import { prisma } from "@echatbot/database"
import { getFunctionsForAgentType } from "../../config/agent-function-mapping"
import logger from "../../utils/logger"

/**
 * Service layer for Agents
 * Handles agent operations for AI assistants
 */
export class AgentService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = prisma
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

      // 🔄 MAPPING: Trasforma agentConfig per il frontend
      const mappedAgents = agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        content: agent.systemPrompt, // Backward compatibility
        systemPrompt: agent.systemPrompt, // Standard
        workspaceId: agent.workspaceId,
        temperature: agent.temperature,
        model: agent.model,
        maxTokens: agent.maxTokens, // ✅ STANDARD: camelCase
        order: agent.order,
        agentType: agent.type, // ✅ FIX: Database field is "type" not "agentType"
        isActive: agent.isActive,
        icon: agent.icon, // 🎨 Icon name from database
        functions: getFunctionsForAgentType(agent.type), // ✅ FIX: Use "type" field
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      }))

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

      // 🔒 SECURITY CHECK: Verify user is admin if trying to update prompt/content
      if (userId && (data.prompt !== undefined || data.content !== undefined)) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        })

        if (!user || user.role !== "ADMIN") {
          logger.warn(
            `🚨 SECURITY: Non-admin user ${userId} attempted to modify agent prompt`
          )
          throw new Error("Only admin users can modify agent prompts")
        }

        logger.info(`✅ Admin ${userId} authorized to update prompt`)
      }

      // Map frontend fields to database fields (frontend → backend)
      const updateData: any = {}

      // 🔒 CRITICAL: Only allow prompt updates from verified admin users
      if (data.prompt !== undefined) updateData.systemPrompt = data.prompt
      if (data.content !== undefined) updateData.systemPrompt = data.content
      if (data.systemPrompt !== undefined)
        updateData.systemPrompt = data.systemPrompt

      // These fields can be updated by any authenticated user
      if (data.model !== undefined) updateData.model = data.model
      if (data.temperature !== undefined)
        updateData.temperature = data.temperature
      if (data.maxTokens !== undefined) updateData.maxTokens = data.maxTokens
      if (data.isActive !== undefined) updateData.isActive = data.isActive

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
