/**
 * SearchConversationRepository
 *
 * Manages conversational state for product search sessions.
 * Provides 10-minute memory for contextual searches.
 *
 * Use cases:
 * - Store last query/response for context refinement
 * - Track active/completed/abandoned sessions
 * - Auto-expire sessions after 10 minutes inactivity
 * - Enable conversational queries like "show only organic ones"
 *
 * Security:
 * - ALL queries filtered by workspaceId
 * - sessionId indexed for fast lookups
 */

import { Prisma, SearchConversationState } from "@prisma/client"
import { prisma } from "../lib/prisma"
import logger from "../utils/logger"

export interface CreateSearchConversationData {
  sessionId: string
  workspaceId: string
  customerId: string
  lastQuery: string
  lastResponse?: string
  metadata?: any
}

export interface UpdateSearchConversationData {
  lastQuery?: string
  lastResponse?: string
  state?: SearchConversationState
  metadata?: any
}

export class SearchConversationRepository {
  /**
   * Find active conversation by sessionId
   * Returns null if not found or expired
   */
  async findBySessionId(
    sessionId: string,
    workspaceId: string
  ): Promise<any | null> {
    try {
      const conversation = await prisma.searchConversations.findFirst({
        where: {
          sessionId,
          workspaceId,
          expiresAt: {
            gte: new Date(), // Not expired
          },
        },
      })

      return conversation
    } catch (error) {
      logger.error("Error finding search conversation:", error)
      return null
    }
  }

  /**
   * Create new search conversation
   * Auto-sets expiresAt to 10 minutes from now
   */
  async create(data: CreateSearchConversationData): Promise<any> {
    try {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

      const conversation = await prisma.searchConversations.create({
        data: {
          sessionId: data.sessionId,
          workspaceId: data.workspaceId,
          customerId: data.customerId,
          state: SearchConversationState.ACTIVE,
          lastQuery: data.lastQuery,
          lastResponse: data.lastResponse || null,
          metadata: data.metadata || null,
          expiresAt,
        },
      })

      logger.info(`✅ Created search conversation`, {
        sessionId: data.sessionId,
        customerId: data.customerId,
        expiresAt,
      })

      return conversation
    } catch (error) {
      logger.error("Error creating search conversation:", error)
      throw error
    }
  }

  /**
   * Update existing conversation
   * Resets expiresAt to 10 minutes from now
   */
  async update(
    sessionId: string,
    workspaceId: string,
    data: UpdateSearchConversationData
  ): Promise<any | null> {
    try {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // Reset to 10 minutes

      const conversation = await prisma.searchConversations.updateMany({
        where: {
          sessionId,
          workspaceId,
        },
        data: {
          ...data,
          expiresAt,
          updatedAt: new Date(),
        },
      })

      if (conversation.count === 0) {
        logger.warn(`⚠️ No search conversation found to update`, {
          sessionId,
          workspaceId,
        })
        return null
      }

      logger.info(`✅ Updated search conversation`, {
        sessionId,
        updatedFields: Object.keys(data),
      })

      // Fetch updated conversation
      return await this.findBySessionId(sessionId, workspaceId)
    } catch (error) {
      logger.error("Error updating search conversation:", error)
      throw error
    }
  }

  /**
   * Upsert conversation (create or update)
   * Uses Prisma's native upsert to avoid race conditions
   */
  async upsert(
    data: CreateSearchConversationData & UpdateSearchConversationData
  ): Promise<any> {
    try {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

      const conversation = await prisma.searchConversations.upsert({
        where: {
          sessionId: data.sessionId,
        },
        update: {
          lastQuery: data.lastQuery,
          lastResponse: data.lastResponse || null,
          state: data.state || SearchConversationState.ACTIVE,
          metadata: data.metadata || null,
          expiresAt, // Reset expiry on update
          updatedAt: new Date(),
        },
        create: {
          sessionId: data.sessionId,
          workspaceId: data.workspaceId,
          customerId: data.customerId,
          state: data.state || SearchConversationState.ACTIVE,
          lastQuery: data.lastQuery,
          lastResponse: data.lastResponse || null,
          metadata: data.metadata || null,
          expiresAt,
        },
      })

      logger.info(`✅ Upserted search conversation`, {
        sessionId: data.sessionId,
        customerId: data.customerId,
        isNew:
          conversation.createdAt.getTime() === conversation.updatedAt.getTime(),
        expiresAt,
      })

      return conversation
    } catch (error) {
      logger.error("Error upserting search conversation:", error)
      throw error
    }
  }

  /**
   * Mark conversation as completed
   */
  async markCompleted(sessionId: string, workspaceId: string): Promise<void> {
    try {
      await prisma.searchConversations.updateMany({
        where: {
          sessionId,
          workspaceId,
        },
        data: {
          state: SearchConversationState.COMPLETED,
          updatedAt: new Date(),
        },
      })

      logger.info(`✅ Marked conversation as completed`, { sessionId })
    } catch (error) {
      logger.error("Error marking conversation completed:", error)
    }
  }

  /**
   * Mark conversation as abandoned
   */
  async markAbandoned(sessionId: string, workspaceId: string): Promise<void> {
    try {
      await prisma.searchConversations.updateMany({
        where: {
          sessionId,
          workspaceId,
        },
        data: {
          state: SearchConversationState.ABANDONED,
          updatedAt: new Date(),
        },
      })

      logger.info(`✅ Marked conversation as abandoned`, { sessionId })
    } catch (error) {
      logger.error("Error marking conversation abandoned:", error)
    }
  }

  /**
   * Mark expired conversations (called by cronjob)
   * Changes state to EXPIRED for sessions past expiresAt
   * 🔒 SECURITY: workspaceId is MANDATORY
   */
  async markExpired(workspaceId: string): Promise<number> {
    try {
      // 🔒 SECURITY: workspaceId is MANDATORY for isolation
      if (!workspaceId) {
        logger.error("markExpired: workspaceId is required")
        throw new Error("workspaceId is mandatory for marking expired conversations")
      }

      const where: Prisma.SearchConversationsWhereInput = {
        expiresAt: {
          lt: new Date(), // Past expiration
        },
        state: SearchConversationState.ACTIVE, // Only active ones
        workspaceId: workspaceId,  // 🔒 Hard requirement
      }

      const result = await prisma.searchConversations.updateMany({
        where,
        data: {
          state: SearchConversationState.EXPIRED,
          updatedAt: new Date(),
        },
      })

      if (result.count > 0) {
        logger.info(`✅ Marked ${result.count} conversations as expired in workspace ${workspaceId}`)
      }

      return result.count
    } catch (error) {
      logger.error("Error marking conversations expired:", error)
      return 0
    }
  }

  /**
   * Delete old conversations (called by cronjob)
   * Removes conversations older than 30 days
   * 🔒 SECURITY: workspaceId is MANDATORY
   */
  async deleteOld(daysOld: number = 30, workspaceId: string): Promise<number> {
    try {
      // 🔒 SECURITY: workspaceId is MANDATORY for isolation
      if (!workspaceId) {
        logger.error("deleteOld: workspaceId is required")
        throw new Error("workspaceId is mandatory for deleting old conversations")
      }

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysOld)

      const where: Prisma.SearchConversationsWhereInput = {
        createdAt: {
          lt: cutoffDate,
        },
        workspaceId: workspaceId,  // 🔒 Hard requirement
      }

      const result = await prisma.searchConversations.deleteMany({
        where,
      })

      if (result.count > 0) {
        logger.info(
          `✅ Deleted ${result.count} conversations older than ${daysOld} days in workspace ${workspaceId}`
        )
      }

      return result.count
    } catch (error) {
      logger.error("Error deleting old conversations:", error)
      return 0
    }
  }

  /**
   * Get conversation statistics for a workspace
   */
  async getStats(workspaceId: string): Promise<{
    total: number
    active: number
    completed: number
    abandoned: number
    expired: number
  }> {
    try {
      const [total, active, completed, abandoned, expired] = await Promise.all([
        prisma.searchConversations.count({ where: { workspaceId } }),
        prisma.searchConversations.count({
          where: { workspaceId, state: SearchConversationState.ACTIVE },
        }),
        prisma.searchConversations.count({
          where: { workspaceId, state: SearchConversationState.COMPLETED },
        }),
        prisma.searchConversations.count({
          where: { workspaceId, state: SearchConversationState.ABANDONED },
        }),
        prisma.searchConversations.count({
          where: { workspaceId, state: SearchConversationState.EXPIRED },
        }),
      ])

      return { total, active, completed, abandoned, expired }
    } catch (error) {
      logger.error("Error getting conversation stats:", error)
      return { total: 0, active: 0, completed: 0, abandoned: 0, expired: 0 }
    }
  }
}
