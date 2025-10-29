/**
 * AgentConversationLogRepository
 *
 * Repository for managing Agent Conversation Logs (complete LLM interaction tracking).
 * Provides logging, retrieval, and analytics for multi-agent conversations.
 *
 * Key Methods:
 * - create: Log a single agent interaction
 * - findByConversation: Get all logs for a conversation (complete agent pipeline)
 * - getAgentPerformanceMetrics: Analytics by agent type
 * - getErrorLogs: Filter logs with errors for debugging
 *
 * Security: ALL queries filtered by workspaceId AND customerId (multi-tenant + customer isolation)
 */

import { AgentConversationLog, AgentType, PrismaClient } from "@prisma/client"
import logger from "../utils/logger"

export class AgentConversationLogRepository {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Create new agent conversation log entry
   * @param data - Log data from agent interaction
   * @returns Created log entry
   */
  async create(data: {
    workspaceId: string
    customerId: string
    conversationId: string
    messageId: string
    step: number
    agentType: AgentType
    agentAction?: string
    inputMessage: string
    agentPrompt: string
    llmModel: string
    llmResponse: string
    confidence?: number
    reasoning?: string
    tokensUsed?: number
    executionTimeMs: number
    functionsCalled?: any
    hasError?: boolean
    errorMessage?: string
  }): Promise<AgentConversationLog> {
    try {
      const log = await this.prisma.agentConversationLog.create({
        data: {
          workspaceId: data.workspaceId,
          customerId: data.customerId,
          conversationId: data.conversationId,
          messageId: data.messageId,
          step: data.step,
          agentType: data.agentType,
          agentAction: data.agentAction,
          inputMessage: data.inputMessage,
          agentPrompt: data.agentPrompt,
          llmModel: data.llmModel,
          llmResponse: data.llmResponse,
          confidence: data.confidence,
          reasoning: data.reasoning,
          tokensUsed: data.tokensUsed,
          executionTimeMs: data.executionTimeMs,
          functionsCalled: data.functionsCalled,
          hasError: data.hasError ?? false,
          errorMessage: data.errorMessage,
        },
      })

      logger.info(
        `Logged agent interaction: ${data.agentType} (step ${data.step}) for conversation ${data.conversationId}`
      )

      return log
    } catch (error) {
      logger.error("Error creating agent conversation log:", error)
      throw error
    }
  }

  /**
   * Find all logs for a specific conversation (complete agent pipeline)
   * Useful for debugging: see all agents that processed this message
   *
   * @param workspaceId - Workspace ID (security filter)
   * @param conversationId - Conversation ID
   * @param customerId - Customer ID (optional, additional security filter)
   * @returns Array of logs sorted by step (chronological order)
   */
  async findByConversation(
    workspaceId: string,
    conversationId: string,
    customerId?: string
  ): Promise<AgentConversationLog[]> {
    try {
      const where: any = {
        workspaceId,
        conversationId,
      }

      if (customerId) {
        where.customerId = customerId
      }

      const logs = await this.prisma.agentConversationLog.findMany({
        where,
        orderBy: {
          step: "asc", // Show agent pipeline in order: ROUTER → specialist → SAFETY
        },
      })

      logger.info(
        `Found ${logs.length} agent logs for conversation ${conversationId} (workspace: ${workspaceId})`
      )

      return logs
    } catch (error) {
      logger.error(
        `Error finding logs for conversation ${conversationId}:`,
        error
      )
      throw error
    }
  }

  /**
   * Find logs by message ID (all agents that processed this specific message)
   * @param workspaceId - Workspace ID (security filter)
   * @param messageId - Message ID
   * @returns Array of logs sorted by step
   */
  async findByMessage(
    workspaceId: string,
    messageId: string
  ): Promise<AgentConversationLog[]> {
    try {
      return await this.prisma.agentConversationLog.findMany({
        where: {
          workspaceId,
          messageId,
        },
        orderBy: {
          step: "asc",
        },
      })
    } catch (error) {
      logger.error(`Error finding logs for message ${messageId}:`, error)
      throw error
    }
  }

  /**
   * Find logs by customer (complete customer interaction history)
   * @param workspaceId - Workspace ID (security filter)
   * @param customerId - Customer ID
   * @param limit - Maximum number of results
   * @returns Array of logs sorted by creation date (most recent first)
   */
  async findByCustomer(
    workspaceId: string,
    customerId: string,
    limit: number = 100
  ): Promise<AgentConversationLog[]> {
    try {
      return await this.prisma.agentConversationLog.findMany({
        where: {
          workspaceId,
          customerId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
      })
    } catch (error) {
      logger.error(`Error finding logs for customer ${customerId}:`, error)
      throw error
    }
  }

  /**
   * Get error logs for debugging
   * @param workspaceId - Workspace ID (security filter)
   * @param limit - Maximum number of results
   * @returns Array of logs with errors
   */
  async getErrorLogs(
    workspaceId: string,
    limit: number = 50
  ): Promise<AgentConversationLog[]> {
    try {
      return await this.prisma.agentConversationLog.findMany({
        where: {
          workspaceId,
          hasError: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
      })
    } catch (error) {
      logger.error("Error getting error logs:", error)
      throw error
    }
  }

  /**
   * Get agent performance metrics (analytics)
   *
   * Returns:
   * - Total interactions per agent type
   * - Average confidence per agent
   * - Average execution time per agent
   * - Average tokens used per agent
   * - Error rate per agent
   *
   * @param workspaceId - Workspace ID (security filter)
   * @param startDate - Filter logs from this date (optional)
   * @param endDate - Filter logs to this date (optional)
   * @returns Performance metrics by agent type
   */
  async getAgentPerformanceMetrics(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<
    Array<{
      agentType: AgentType
      totalInteractions: number
      avgConfidence: number | null
      avgExecutionTimeMs: number | null
      avgTokensUsed: number | null
      errorCount: number
      errorRate: number
    }>
  > {
    try {
      const where: any = { workspaceId }

      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt.gte = startDate
        if (endDate) where.createdAt.lte = endDate
      }

      // Group by agent type and calculate metrics
      const result = await this.prisma.agentConversationLog.groupBy({
        by: ["agentType"],
        where,
        _count: {
          id: true,
        },
        _avg: {
          confidence: true,
          executionTimeMs: true,
          tokensUsed: true,
        },
      })

      // Count errors per agent type
      const errorCounts = await this.prisma.agentConversationLog.groupBy({
        by: ["agentType"],
        where: {
          ...where,
          hasError: true,
        },
        _count: {
          id: true,
        },
      })

      const errorCountMap = new Map(
        errorCounts.map((item) => [item.agentType, item._count.id])
      )

      // Combine results
      const metrics = result.map((item) => {
        const errorCount = errorCountMap.get(item.agentType) || 0
        return {
          agentType: item.agentType as AgentType, // Cast from string to AgentType
          totalInteractions: item._count.id,
          avgConfidence: item._avg.confidence,
          avgExecutionTimeMs: item._avg.executionTimeMs,
          avgTokensUsed: item._avg.tokensUsed,
          errorCount,
          errorRate: item._count.id > 0 ? errorCount / item._count.id : 0,
        }
      })

      logger.info(
        `Generated performance metrics for ${metrics.length} agent types`
      )
      return metrics
    } catch (error) {
      logger.error("Error getting agent performance metrics:", error)
      throw error
    }
  }

  /**
   * Get token usage statistics
   * @param workspaceId - Workspace ID (security filter)
   * @param startDate - Filter from this date (optional)
   * @param endDate - Filter to this date (optional)
   * @returns Total tokens used and breakdown by agent type
   */
  async getTokenUsageStats(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalTokens: number
    byAgent: Array<{ agentType: AgentType; totalTokens: number }>
  }> {
    try {
      const where: any = { workspaceId }

      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt.gte = startDate
        if (endDate) where.createdAt.lte = endDate
      }

      // Total tokens
      const totalResult = await this.prisma.agentConversationLog.aggregate({
        where,
        _sum: {
          tokensUsed: true,
        },
      })

      // Tokens by agent type
      const byAgentResult = await this.prisma.agentConversationLog.groupBy({
        by: ["agentType"],
        where,
        _sum: {
          tokensUsed: true,
        },
      })

      return {
        totalTokens: totalResult._sum.tokensUsed || 0,
        byAgent: byAgentResult.map((item) => ({
          agentType: item.agentType as AgentType, // Cast from string to AgentType
          totalTokens: item._sum.tokensUsed || 0,
        })),
      }
    } catch (error) {
      logger.error("Error getting token usage stats:", error)
      throw error
    }
  }

  /**
   * Delete logs older than specified date (cleanup)
   * @param workspaceId - Workspace ID (security filter)
   * @param olderThan - Delete logs older than this date
   * @returns Number of deleted logs
   */
  async deleteOlderThan(workspaceId: string, olderThan: Date): Promise<number> {
    try {
      const result = await this.prisma.agentConversationLog.deleteMany({
        where: {
          workspaceId,
          createdAt: {
            lt: olderThan,
          },
        },
      })

      logger.info(
        `Deleted ${result.count} agent logs older than ${olderThan.toISOString()} for workspace ${workspaceId}`
      )

      return result.count
    } catch (error) {
      logger.error("Error deleting old agent logs:", error)
      throw error
    }
  }

  /**
   * Count total logs for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Total number of logs
   */
  async count(workspaceId: string): Promise<number> {
    try {
      return await this.prisma.agentConversationLog.count({
        where: {
          workspaceId,
        },
      })
    } catch (error) {
      logger.error("Error counting agent logs:", error)
      throw error
    }
  }
}
