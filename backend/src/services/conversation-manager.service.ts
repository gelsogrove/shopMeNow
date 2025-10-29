/**
 * ConversationManager
 *
 * Manages conversation history for LLM context.
 *
 * Strategy:
 * - Loads last 10 MINUTES of messages (not 20 messages)
 * - Saves all message types: user, assistant, function, function_result
 * - Auto-cleanup messages older than 10 minutes
 *
 * @architecture Clean Architecture - Uses ConversationMessageRepository
 */

import { PrismaClient } from "@prisma/client"
import { ConversationMessageRepository } from "../repositories/conversation-message.repository"
import logger from "../utils/logger"

export interface Message {
  role: "user" | "assistant" | "function" | "system"
  content: string
  name?: string // Function name for function/function_result roles
}

export interface SaveMessageParams {
  workspaceId: string
  customerId: string
  conversationId: string
  role: "user" | "assistant" | "function" | "system"
  content: string
  agentType?: string
  functionName?: string
  functionArguments?: Record<string, any>
  tokensUsed?: number
}

export class ConversationManager {
  private conversationRepo: ConversationMessageRepository
  private historyWindowMinutes: number

  constructor(
    private prisma: PrismaClient,
    historyWindowMinutes: number = 5
  ) {
    this.conversationRepo = new ConversationMessageRepository(prisma)
    this.historyWindowMinutes = historyWindowMinutes

    logger.info(
      `✅ ConversationManager initialized (history window: ${historyWindowMinutes} minutes)`
    )
  }

  /**
   * Load conversation history for LLM context
   *
   * Returns messages from last N minutes (default: 10)
   * Formatted for OpenRouter API
   *
   * @param workspaceId - Workspace ID
   * @param conversationId - Conversation ID
   * @returns Array of messages in OpenRouter format
   */
  async loadHistory(
    workspaceId: string,
    conversationId: string
  ): Promise<Message[]> {
    try {
      logger.info("📖 Loading conversation history", {
        workspaceId,
        conversationId,
        windowMinutes: this.historyWindowMinutes,
      })

      // Calculate cutoff timestamp (10 minutes ago)
      const cutoffTime = new Date()
      cutoffTime.setMinutes(cutoffTime.getMinutes() - this.historyWindowMinutes)

      // Load messages from repository (filtered by time)
      const messages = await this.conversationRepo.getHistoryByTime(
        workspaceId,
        conversationId,
        cutoffTime
      )

      // Transform to OpenRouter format
      const formattedMessages: Message[] = messages.map((msg) => {
        const message: Message = {
          role: msg.role as "user" | "assistant" | "function" | "system",
          content: msg.content,
        }

        // Add function name if present
        if ("name" in msg && msg.name) {
          message.name = msg.name
        }

        return message
      })

      logger.info(
        `✅ Loaded ${formattedMessages.length} messages from last ${this.historyWindowMinutes} minutes`
      )

      return formattedMessages
    } catch (error) {
      logger.error("❌ Failed to load conversation history", error)
      // Return empty array on error (stateless fallback)
      return []
    }
  }

  /**
   * Save user message
   */
  async saveUserMessage(
    params: Omit<SaveMessageParams, "role">
  ): Promise<void> {
    try {
      await this.conversationRepo.saveMessage({
        ...params,
        role: "user",
      })
      logger.debug("💬 User message saved", {
        conversationId: params.conversationId,
      })
    } catch (error) {
      logger.error("❌ Failed to save user message", error)
    }
  }

  /**
   * Save assistant response
   */
  async saveAssistantMessage(
    params: Omit<SaveMessageParams, "role">
  ): Promise<void> {
    try {
      await this.conversationRepo.saveMessage({
        ...params,
        role: "assistant",
      })
      logger.debug("🤖 Assistant message saved", {
        conversationId: params.conversationId,
      })
    } catch (error) {
      logger.error("❌ Failed to save assistant message", error)
    }
  }

  /**
   * Save function call
   *
   * When Router LLM calls a function, we save it as a "function" message
   */
  async saveFunctionCall(
    params: Omit<SaveMessageParams, "role"> & {
      functionName: string
      functionArguments: Record<string, any>
    }
  ): Promise<void> {
    try {
      await this.conversationRepo.saveMessage({
        ...params,
        role: "function",
        content: JSON.stringify(params.functionArguments),
      })
      logger.debug("⚙️ Function call saved", {
        conversationId: params.conversationId,
        functionName: params.functionName,
      })
    } catch (error) {
      logger.error("❌ Failed to save function call", error)
    }
  }

  /**
   * Save function result
   *
   * After executing function, save result for LLM context
   */
  async saveFunctionResult(
    params: Omit<SaveMessageParams, "role"> & {
      functionName: string
      result: any
    }
  ): Promise<void> {
    try {
      await this.conversationRepo.saveMessage({
        ...params,
        role: "function",
        content:
          typeof params.result === "string"
            ? params.result
            : JSON.stringify(params.result),
        functionName: params.functionName,
      })
      logger.debug("✅ Function result saved", {
        conversationId: params.conversationId,
        functionName: params.functionName,
      })
    } catch (error) {
      logger.error("❌ Failed to save function result", error)
    }
  }

  /**
   * Cleanup old messages
   *
   * Delete messages older than history window
   * Call this periodically (e.g., every hour via cron job)
   */
  async cleanupOldMessages(workspaceId: string): Promise<number> {
    try {
      const cutoffTime = new Date()
      cutoffTime.setMinutes(cutoffTime.getMinutes() - this.historyWindowMinutes)

      const deletedCount = await this.conversationRepo.cleanupOldMessages(
        workspaceId,
        cutoffTime
      )

      logger.info(
        `🧹 Cleaned up ${deletedCount} old messages for workspace ${workspaceId}`
      )
      return deletedCount
    } catch (error) {
      logger.error("❌ Failed to cleanup old messages", error)
      return 0
    }
  }

  /**
   * Get conversation count (for monitoring)
   */
  async getMessageCount(
    workspaceId: string,
    conversationId: string
  ): Promise<number> {
    try {
      return await this.conversationRepo.countMessages(
        workspaceId,
        conversationId
      )
    } catch (error) {
      logger.error("❌ Failed to get message count", error)
      return 0
    }
  }

  /**
   * Delete entire conversation
   *
   * Use when customer requests data deletion (GDPR)
   */
  async deleteConversation(
    workspaceId: string,
    conversationId: string
  ): Promise<number> {
    try {
      const deletedCount = await this.conversationRepo.deleteConversation(
        workspaceId,
        conversationId
      )
      logger.info(
        `🗑️ Deleted ${deletedCount} messages from conversation ${conversationId}`
      )
      return deletedCount
    } catch (error) {
      logger.error("❌ Failed to delete conversation", error)
      return 0
    }
  }

  /**
   * Get all conversations for a customer (for UI)
   */
  async getCustomerConversations(
    workspaceId: string,
    customerId: string,
    limit: number = 10
  ) {
    try {
      return await this.conversationRepo.getCustomerConversations(
        workspaceId,
        customerId,
        limit
      )
    } catch (error) {
      logger.error("❌ Failed to get customer conversations", error)
      return []
    }
  }
}
