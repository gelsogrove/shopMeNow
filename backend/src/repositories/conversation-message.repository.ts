/**
 * ConversationMessageRepository
 *
 * Repository for managing conversation history messages.
 * Used by LLM Router to maintain context across multiple interactions.
 *
 * Key Methods:
 * - saveMessage: Save single message to history
 * - getHistory: Get conversation history for LLM context
 * - cleanupOldMessages: Delete messages older than retention period
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation)
 */

import { PrismaClient } from "@prisma/client"
import logger from "../utils/logger"

export interface SaveMessageParams {
  workspaceId: string
  customerId: string
  conversationId: string
  role: "user" | "assistant" | "function" | "system"
  content: string
  agentType?: string
  functionName?: string
  functionArguments?: any
  tokensUsed?: number
  debugInfo?: any // ✅ Debug information for message flow tracking
}

export interface ConversationHistory {
  role: string
  content: string
  name?: string // Function name if role="function"
}

export class ConversationMessageRepository {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Save a message to conversation history
   */
  async saveMessage(params: SaveMessageParams): Promise<string> {
    try {
      const message = await this.prisma.conversationMessage.create({
        data: {
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          conversationId: params.conversationId,
          role: params.role,
          content: params.content,
          agentType: params.agentType,
          functionName: params.functionName,
          functionArguments: params.functionArguments,
          tokensUsed: params.tokensUsed,
          debugInfo: params.debugInfo
            ? JSON.stringify(params.debugInfo)
            : undefined, // ✅ Save debug info as JSON string
        },
      })

      logger.debug(
        `Saved conversation message: ${params.role} in ${params.conversationId}`
      )

      return message.id
    } catch (error) {
      logger.error("Error saving conversation message:", error)
      throw error
    }
  }

  /**
   * Get conversation history for LLM context
   *
   * @param workspaceId - Workspace ID (security filter)
   * @param conversationId - Conversation ID
   * @param limit - Max messages to return (default: 20, last 20 messages)
   * @returns Array of messages formatted for LLM
   */
  async getHistory(
    workspaceId: string,
    conversationId: string,
    limit: number = 20
  ): Promise<ConversationHistory[]> {
    try {
      const messages = await this.prisma.conversationMessage.findMany({
        where: {
          workspaceId,
          conversationId,
        },
        orderBy: {
          createdAt: "asc", // Chronological order
        },
        take: limit,
        select: {
          role: true,
          content: true,
          functionName: true,
        },
      })

      // Format for OpenRouter API
      return messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        ...(msg.functionName && { name: msg.functionName }), // Add name for function messages
      }))
    } catch (error) {
      logger.error("Error getting conversation history:", error)
      throw error
    }
  }

  /**
   * Get conversation history by time window (for ConversationManager)
   *
   * @param workspaceId - Workspace ID (security filter)
   * @param conversationId - Conversation ID
   * @param sinceTime - Get messages after this timestamp
   * @returns Array of messages formatted for LLM
   */
  async getHistoryByTime(
    workspaceId: string,
    conversationId: string,
    sinceTime: Date
  ): Promise<ConversationHistory[]> {
    try {
      const messages = await this.prisma.conversationMessage.findMany({
        where: {
          workspaceId,
          conversationId,
          createdAt: {
            gte: sinceTime,
          },
        },
        orderBy: {
          createdAt: "asc", // Chronological order
        },
        select: {
          role: true,
          content: true,
          functionName: true,
        },
      })

      // Format for OpenRouter API
      return messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        ...(msg.functionName && { name: msg.functionName }), // Add name for function messages
      }))
    } catch (error) {
      logger.error("Error getting conversation history by time:", error)
      throw error
    }
  }

  /**
   * Count messages in a conversation
   */
  async countMessages(
    workspaceId: string,
    conversationId: string
  ): Promise<number> {
    try {
      return await this.prisma.conversationMessage.count({
        where: {
          workspaceId,
          conversationId,
        },
      })
    } catch (error) {
      logger.error("Error counting conversation messages:", error)
      throw error
    }
  }

  /**
   * Delete old messages (data retention policy)
   *
   * @param workspaceId - Workspace ID
   * @param olderThan - Delete messages older than this date
   * @returns Number of deleted messages
   */
  async cleanupOldMessages(
    workspaceId: string,
    olderThan: Date
  ): Promise<number> {
    try {
      const result = await this.prisma.conversationMessage.deleteMany({
        where: {
          workspaceId,
          createdAt: {
            lt: olderThan,
          },
        },
      })

      logger.info(
        `Cleaned up ${result.count} old conversation messages for workspace ${workspaceId}`
      )

      return result.count
    } catch (error) {
      logger.error("Error cleaning up old messages:", error)
      throw error
    }
  }

  /**
   * Delete all messages for a conversation
   * (e.g., GDPR compliance or user request)
   */
  async deleteConversation(
    workspaceId: string,
    conversationId: string
  ): Promise<number> {
    try {
      const result = await this.prisma.conversationMessage.deleteMany({
        where: {
          workspaceId,
          conversationId,
        },
      })

      logger.info(
        `Deleted conversation ${conversationId}: ${result.count} messages`
      )

      return result.count
    } catch (error) {
      logger.error("Error deleting conversation:", error)
      throw error
    }
  }

  /**
   * Get customer's recent conversations
   * (for customer support / debugging)
   */
  async getCustomerConversations(
    workspaceId: string,
    customerId: string,
    limit: number = 10
  ): Promise<
    Array<{ conversationId: string; messageCount: number; lastMessage: Date }>
  > {
    try {
      const conversations = await this.prisma.conversationMessage.groupBy({
        by: ["conversationId"],
        where: {
          workspaceId,
          customerId,
        },
        _count: {
          id: true,
        },
        _max: {
          createdAt: true,
        },
        orderBy: {
          _max: {
            createdAt: "desc",
          },
        },
        take: limit,
      })

      return conversations.map((conv) => ({
        conversationId: conv.conversationId,
        messageCount: conv._count.id,
        lastMessage: conv._max.createdAt!,
      }))
    } catch (error) {
      logger.error("Error getting customer conversations:", error)
      throw error
    }
  }
}
