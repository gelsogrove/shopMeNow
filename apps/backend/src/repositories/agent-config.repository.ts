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

import { AgentConfig, AgentType, PrismaClient } from "@echatbot/database"
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
        },
      })

      if (!agent) {
        logger.warn(`⚠️ Agent type ${type} NOT FOUND for workspace ${workspaceId}`)
      }

      return agent
    } catch (error) {
      logger.error(`Error finding agent by type ${type}:`, error)
      throw error
    }
  }

  /**
   * Find all agents sorted by order (for agent execution pipeline)
   * @param workspaceId - Workspace ID (security filter)
   * @returns Array of agent configurations sorted by order field
   */
  async findActiveByOrder(workspaceId: string): Promise<AgentConfig[]> {
    try {
      const agents = await this.prisma.agentConfig.findMany({
        where: { workspaceId },
        orderBy: { order: "asc" },
      })
      return agents
    } catch (error) {
      logger.error("Error finding agents by order:", error)
      throw error
    }
  }

  /**
   * Find all agents for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Array of agent configurations
   */
  async findActiveAgents(workspaceId: string): Promise<AgentConfig[]> {
    try {
      return await this.prisma.agentConfig.findMany({
        where: { workspaceId },
      })
    } catch (error) {
      logger.error("Error finding agents:", error)
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
        },
      })
    } catch (error) {
      logger.error("Error counting active agents:", error)
      throw error
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🆕 CACHED METHODS - Optional performance optimization
  // These methods wrap existing ones with caching. Use when appropriate.
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Find agent configuration by type WITH CACHING
   * 
   * Same as findByType() but with 5-minute cache.
   * Use for high-frequency lookups where slight staleness is acceptable.
   * 
   * Cache is automatically invalidated after TTL expires.
   * For immediate invalidation, call invalidateCache(workspaceId, type).
   * 
   * @param workspaceId - Workspace ID (security filter)
   * @param type - Agent type (ROUTER, PRODUCT_SEARCH, etc.)
   * @returns Agent configuration or null (from cache or database)
   */
  async findByTypeCached(
    workspaceId: string,
    type: AgentType
  ): Promise<AgentConfig | null> {
    const { agentConfigCache } = await import("../utils/cache")
    const cacheKey = `${workspaceId}:${type}`

    // Check cache first
    const cached = agentConfigCache.get(cacheKey)
    if (cached !== undefined) {
      logger.debug(`🟢 AgentConfig cache HIT: ${type}`)
      return cached as AgentConfig | null
    }

    // Cache miss - query database
    logger.debug(`🔴 AgentConfig cache MISS: ${type}`)
    const agent = await this.findByType(workspaceId, type)

    // Store in cache (including null results to prevent repeated lookups)
    agentConfigCache.set(cacheKey, agent)

    return agent
  }

  /**
   * Invalidate cache for specific agent type
   * Call this after updating agent configuration
   * 
   * @param workspaceId - Workspace ID
   * @param type - Optional agent type (if not provided, clears all for workspace)
   */
  async invalidateCache(workspaceId: string, type?: AgentType): Promise<void> {
    const { agentConfigCache } = await import("../utils/cache")
    
    if (type) {
      agentConfigCache.delete(`${workspaceId}:${type}`)
      logger.debug(`🗑️ Cache invalidated: ${workspaceId}:${type}`)
    } else {
      // Clear all agent configs for this workspace
      agentConfigCache.deletePattern(`${workspaceId}:`)
      logger.debug(`🗑️ Cache invalidated: all agents for ${workspaceId}`)
    }
  }
}

