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

import { PrismaClient, MessageDirection, MessageType } from "@echatbot/database"
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

      if (formattedMessages.length === 0) {
        logger.warn(
          "⚠️ Conversation history empty in time window, falling back to last 20 messages",
          {
            workspaceId,
            conversationId,
            windowMinutes: this.historyWindowMinutes,
          }
        )
        const fallbackMessages = await this.conversationRepo.getHistory(
          workspaceId,
          conversationId,
          20
        )
        const fallbackFormatted: Message[] = fallbackMessages.map((msg) => {
          const message: Message = {
            role: msg.role as "user" | "assistant" | "function" | "system",
            content: msg.content,
          }
          if (msg.name) {
            message.name = msg.name
          }
          return message
        })
        logger.info(
          `✅ Loaded ${fallbackFormatted.length} messages via fallback (last 20)`
        )
        return fallbackFormatted
      }

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
  ): Promise<string | undefined> {
    try {
      const messageId = await this.conversationRepo.saveMessage({
        ...params,
        role: "user",
      })
      logger.debug("💬 User message saved", {
        conversationId: params.conversationId,
      })

      // Mirror to Message table (UI reads from messages)
      await this.saveToMessagesTable({
        conversationId: params.conversationId,
        content: params.content,
        role: "user",
        agentType: params.agentType,
        tokensUsed: params.tokensUsed,
        debugInfo: params.debugInfo,
        deliveryStatus: params.deliveryStatus,
      })
      return messageId
    } catch (error) {
      logger.error("❌ Failed to save user message", error)
      return undefined
    }
  }

  /**
   * Save system context message (hidden from user, visible to LLM)
   * Used for passing JSON context like group mappings, cart state, etc.
   */
  async saveSystemContext(
    params: Omit<SaveMessageParams, "role" | "deliveryStatus">
  ): Promise<void> {
    try {
      await this.conversationRepo.saveMessage({
        ...params,
        role: "system",
        deliveryStatus: "not_queued", // System messages never go to WhatsApp
      })
      logger.info("📋 System context saved to history", {
        conversationId: params.conversationId,
        contentPreview: params.content.substring(0, 100),
      })
    } catch (error) {
      logger.error("❌ Failed to save system context", error)
    }
  }

  /**
   * Save assistant response
   */
  async saveAssistantMessage(
    params: Omit<SaveMessageParams, "role">
  ): Promise<string | undefined> {
    try {
      let deliveryStatus = params.deliveryStatus || "not_queued" // Default: not queued unless enqueueing succeeds
      let customerPhone: string | null = null

      // 🛡️ GUARDIA: Skip empty messages entirely - never enqueue or save empty content
      if (!params.content?.trim()) {
        logger.error("🚨 Empty message content detected - cannot save/enqueue empty message", {
          customerId: params.customerId,
          conversationId: params.conversationId,
          agentType: params.agentType,
        })
        // Don't save empty messages - this is a critical bug upstream
        return undefined
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
        // Check if customer has phone number (needed for queue)
        const customer = await this.prisma.customers.findFirst({
          where: { id: params.customerId, workspaceId: params.workspaceId }, // 🔒 Workspace isolation
          select: { phone: true },
        })
        customerPhone = customer?.phone || null

        if (customerPhone) {
          deliveryStatus = "pending" // Will be enqueued after save
        } else {
          logger.warn("⚠️  Customer has no phone number, skipping WhatsApp queue", {
            customerId: params.customerId,
          })
          deliveryStatus = "not_queued" // No phone = not queued
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

      // 1️⃣ Save to History (conversationMessage) FIRST to get the ID
      const messageId = await this.conversationRepo.saveMessage({
        ...params,
        role: "assistant",
        deliveryStatus, // ✅ Pass the delivery status
      })
      logger.debug("🤖 Assistant message saved to history", {
        messageId,
        conversationId: params.conversationId,
        deliveryStatus: deliveryStatus,
      })

      // 2️⃣ If pending status, try to add to WhatsApp Queue with the message ID
      if (deliveryStatus === "pending" && customerPhone) {
        try {
          await this.whatsappQueueService.enqueue({
            workspaceId: params.workspaceId,
            customerId: params.customerId,
            phoneNumber: customerPhone,
            messageContent: params.content,
            conversationMessageId: messageId, // ✅ Link queue to conversation message for timeline tracking
          })
          logger.debug("📤 Assistant message added to WhatsApp queue", {
            messageId,
            customerId: params.customerId,
            phone: customerPhone,
            deliveryStatus: "pending",
          })
        } catch (queueError) {
          // Non-critical: update message status and log error
          logger.error("❌ Failed to add message to WhatsApp queue:", queueError)
          // Update message to not_queued since enqueue failed
          await this.conversationRepo.updateDeliveryStatus(messageId, "not_queued")
        }
      }

      // Mirror to Message table (UI reads from messages)
      await this.saveToMessagesTable({
        conversationId: params.conversationId,
        content: params.content,
        role: "assistant",
        agentType: params.agentType,
        tokensUsed: params.tokensUsed,
        debugInfo: params.debugInfo,
        deliveryStatus,
      })
      
      // 🆕 Return the message ID for translation update
      return messageId
    } catch (error) {
      logger.error("❌ Failed to save assistant message", error)
      return undefined
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
   * Mirror conversationMessage into Message table used by chat controller/UI
   */
  private async saveToMessagesTable(params: {
    conversationId: string
    content: string
    role: "user" | "assistant" | "function" | "system"
    agentType?: string
    tokensUsed?: number
    debugInfo?: any
    deliveryStatus?: string
  }): Promise<void> {
    try {
      const direction =
        params.role === "user"
          ? MessageDirection.INBOUND
          : MessageDirection.OUTBOUND

      await this.prisma.message.create({
        data: {
          chatSessionId: params.conversationId,
          content: params.content,
          direction,
          type: MessageType.TEXT,
          aiGenerated: params.role === "assistant",
          metadata: {
            agentType: params.agentType,
            tokensUsed: params.tokensUsed,
            debugInfo: params.debugInfo,
            deliveryStatus: params.deliveryStatus,
          },
        },
      })
    } catch (error) {
      logger.error("❌ Failed to mirror message to messages table", {
        conversationId: params.conversationId,
        role: params.role,
        error,
      })
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
