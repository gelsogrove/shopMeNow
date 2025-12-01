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
import { WhatsAppQueueService } from "./whatsapp-queue.service"
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
  debugInfo?: any // ✅ Debug information for message flow tracking
  deliveryStatus?: "not_queued" | "pending" | "sent" | "error" | "blocked" // ✅ WhatsApp delivery status (blocked = Security Agent blocked it)
}

export class ConversationManager {
  private conversationRepo: ConversationMessageRepository
  private whatsappQueueService: WhatsAppQueueService
  private historyWindowMinutes: number

  constructor(
    private prisma: PrismaClient,
    historyWindowMinutes: number = 5
  ) {
    this.conversationRepo = new ConversationMessageRepository(prisma)
    this.whatsappQueueService = new WhatsAppQueueService(prisma)
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
      let deliveryStatus = params.deliveryStatus || "not_queued" // Default: not queued unless enqueueing succeeds

      // 🛡️ GUARDIA: Skip empty messages entirely - never enqueue or save empty content
      if (!params.content?.trim()) {
        logger.error("🚨 Empty message content detected - cannot save/enqueue empty message", {
          customerId: params.customerId,
          conversationId: params.conversationId,
          agentType: params.agentType,
        })
        // Don't save empty messages - this is a critical bug upstream
        return
      }

      // 🆕 Feature 181: If message is already marked as blocked, skip enqueueing entirely
      if (deliveryStatus === "blocked") {
        logger.warn("🚫 Message is blocked - skipping WhatsApp queue", {
          customerId: params.customerId,
          conversationId: params.conversationId,
        })
        // Fall through to save with blocked status - don't try to enqueue
      }
      // 🚫 SKIP ENQUEUEING FOR REGISTRATION FLOW MESSAGES
      // Welcome messages from new user registration should NOT go to WhatsApp queue
      else if (params.agentType !== "REGISTRATION_FLOW") {
        // 2️⃣ Try to Add to WhatsApp Queue (for sending) - ONLY for regular assistant messages
        try {
          // Get customer phone number
          const customer = await this.prisma.customers.findFirst({
            where: { id: params.customerId, workspaceId: params.workspaceId }, // 🔒 Workspace isolation
            select: { phone: true },
          })

          if (customer?.phone) {
            await this.whatsappQueueService.enqueue({
              workspaceId: params.workspaceId,
              customerId: params.customerId,
              phoneNumber: customer.phone,
              messageContent: params.content,
            })
            deliveryStatus = "pending" // ✅ Successfully enqueued = pending
            logger.debug("📤 Assistant message added to WhatsApp queue", {
              customerId: params.customerId,
              phone: customer.phone,
              deliveryStatus: "pending",
            })
          } else {
            logger.warn("⚠️  Customer has no phone number, skipping WhatsApp queue", {
              customerId: params.customerId,
            })
            deliveryStatus = "not_queued" // No phone = not queued
          }
        } catch (queueError) {
          // Non-critical: log error but don't fail message save
          logger.error("❌ Failed to add message to WhatsApp queue:", queueError)
          deliveryStatus = "not_queued" // Enqueue failed = not queued
        }
      } else {
        logger.info(
          "🚫 Skipping WhatsApp queue for REGISTRATION_FLOW message (welcome message)",
          {
            customerId: params.customerId,
          }
        )
        deliveryStatus = "not_queued" // Registration flow = not queued
      }

      // 1️⃣ Save to History (conversationMessage) with final deliveryStatus
      await this.conversationRepo.saveMessage({
        ...params,
        role: "assistant",
        deliveryStatus, // ✅ Pass the final delivery status
      })
      logger.debug("🤖 Assistant message saved to history", {
        conversationId: params.conversationId,
        deliveryStatus: deliveryStatus,
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
