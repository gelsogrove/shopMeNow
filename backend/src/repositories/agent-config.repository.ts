/**
 * AgentConfigRepository
 *
 * Repository for managing Agent Configurations in the multi-agent system.
 * Provides CRUD operations and specialized queries for agent orchestration.
 *
 * Key Methods:
 * - findByType: Get specific agent by type (ROUTER, PRODUCT_SEARCH, etc.)
 * - findActiveByOrder: Get all active agents sorted by execution order
 * - findActiveAgents: Get all active agents for a workspace
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation)
 */

import { AgentConfig, AgentType, PrismaClient } from "@prisma/client"
import logger from "../utils/logger"

export class AgentConfigRepository {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Find agent configuration by type
   * @param workspaceId - Workspace ID (security filter)
   * @param type - Agent type (ROUTER, PRODUCT_SEARCH, etc.)
   * @returns Agent configuration or null
   */
  async findByType(
    workspaceId: string,
    type: AgentType
  ): Promise<AgentConfig | null> {
    try {
      const agent = await this.prisma.agentConfig.findFirst({
        where: {
          workspaceId,
          type,
          isActive: true,
        },
      })

      if (!agent) {
        logger.warn(`Agent type ${type} not found for workspace ${workspaceId}`)
      }

      return agent
    } catch (error) {
      logger.error(`Error finding agent by type ${type}:`, error)
      throw error
    }
  }

  /**
   * Find all active agents sorted by order (for agent execution pipeline)
   * @param workspaceId - Workspace ID (security filter)
   * @returns Array of agent configurations sorted by order field
   */
  async findActiveByOrder(workspaceId: string): Promise<AgentConfig[]> {
    try {
      const agents = await this.prisma.agentConfig.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: {
          order: "asc", // ROUTER first (0), then specialists (2-5), SAFETY last (99)
        },
      })

      logger.info(
        `Found ${agents.length} active agents for workspace ${workspaceId}`
      )
      return agents
    } catch (error) {
      logger.error("Error finding active agents by order:", error)
      throw error
    }
  }

  /**
   * Find all active agents (without order sorting)
   * @param workspaceId - Workspace ID (security filter)
   * @returns Array of active agent configurations
   */
  async findActiveAgents(workspaceId: string): Promise<AgentConfig[]> {
    try {
      return await this.prisma.agentConfig.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
      })
    } catch (error) {
      logger.error("Error finding active agents:", error)
      throw error
    }
  }

  /**
   * Find agent by ID
   * @param id - Agent ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns Agent configuration or null
   */
  async findById(id: string, workspaceId: string): Promise<AgentConfig | null> {
    try {
      return await this.prisma.agentConfig.findFirst({
        where: {
          id,
          workspaceId,
        },
      })
    } catch (error) {
      logger.error(`Error finding agent by ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Find all agents for a workspace (including inactive)
   * @param workspaceId - Workspace ID (security filter)
   * @returns Array of all agent configurations
   */
  async findAll(workspaceId: string): Promise<AgentConfig[]> {
    try {
      return await this.prisma.agentConfig.findMany({
        where: {
          workspaceId,
        },
        orderBy: {
          order: "asc",
        },
      })
    } catch (error) {
      logger.error("Error finding all agents:", error)
      throw error
    }
  }

  /**
   * Create new agent configuration
   * @param data - Agent configuration data
   * @returns Created agent configuration
   */
  async create(data: {
    workspaceId: string
    name: string
    type: AgentType
    description?: string
    systemPrompt: string
    model: string
    temperature: number
    maxTokens: number
    order: number
    isActive?: boolean
    availableFunctions?: any
  }): Promise<AgentConfig> {
    try {
      const agent = await this.prisma.agentConfig.create({
        data: {
          workspaceId: data.workspaceId,
          name: data.name,
          type: data.type,
          description: data.description,
          systemPrompt: data.systemPrompt,
          model: data.model,
          temperature: data.temperature,
          maxTokens: data.maxTokens,
          order: data.order,
          isActive: data.isActive ?? true,
          availableFunctions: data.availableFunctions,
        },
      })

      logger.info(
        `Created agent ${agent.name} (${agent.type}) for workspace ${data.workspaceId}`
      )
      return agent
    } catch (error) {
      logger.error("Error creating agent:", error)
      throw error
    }
  }

  /**
   * Update agent configuration
   * @param id - Agent ID
   * @param workspaceId - Workspace ID (security filter)
   * @param data - Updated fields
   * @returns Updated agent configuration
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<{
      name: string
      description: string
      systemPrompt: string
      model: string
      temperature: number
      maxTokens: number
      order: number
      isActive: boolean
      availableFunctions: any
    }>
  ): Promise<AgentConfig> {
    try {
      const agent = await this.prisma.agentConfig.updateMany({
        where: {
          id,
          workspaceId,
        },
        data,
      })

      if (agent.count === 0) {
        throw new Error(`Agent ${id} not found in workspace ${workspaceId}`)
      }

      logger.info(`Updated agent ${id} for workspace ${workspaceId}`)

      // Return updated agent
      const updatedAgent = await this.findById(id, workspaceId)
      if (!updatedAgent) {
        throw new Error(`Failed to retrieve updated agent ${id}`)
      }

      return updatedAgent
    } catch (error) {
      logger.error(`Error updating agent ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete agent configuration (soft delete: set isActive = false)
   * @param id - Agent ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns Deleted agent configuration
   */
  async softDelete(id: string, workspaceId: string): Promise<AgentConfig> {
    try {
      return await this.update(id, workspaceId, { isActive: false })
    } catch (error) {
      logger.error(`Error soft deleting agent ${id}:`, error)
      throw error
    }
  }

  /**
   * Hard delete agent configuration (permanent removal)
   * @param id - Agent ID
   * @param workspaceId - Workspace ID (security filter)
   */
  async hardDelete(id: string, workspaceId: string): Promise<void> {
    try {
      await this.prisma.agentConfig.deleteMany({
        where: {
          id,
          workspaceId,
        },
      })

      logger.info(`Hard deleted agent ${id} from workspace ${workspaceId}`)
    } catch (error) {
      logger.error(`Error hard deleting agent ${id}:`, error)
      throw error
    }
  }

  /**
   * Count active agents for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Number of active agents
   */
  async countActive(workspaceId: string): Promise<number> {
    try {
      return await this.prisma.agentConfig.count({
        where: {
          workspaceId,
          isActive: true,
        },
      })
    } catch (error) {
      logger.error("Error counting active agents:", error)
      throw error
    }
  }
}
