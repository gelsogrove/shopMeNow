/**
 * Widget Message Delivery Service
 * Handles widget-specific message delivery logic (no WhatsApp API)
 * 
 * For widget messages:
 * - Process through LLM to get response
 * - Save response to responsePayload field
 * - Mark as 'sent' for polling retrieval
 * - No external API calls needed
 */

import { prisma } from "@echatbot/database"
import logger from "../../utils/logger"

export class WidgetDeliveryService {
  /**
   * Process widget message and save response
   * Called by scheduler after LLM processing
   * 
   * @param messageId - Queue message ID
   * @param llmResponse - Response from LLM
   * @returns {Promise<void>}
   */
  static async deliverWidgetMessage(
    messageId: string,
    llmResponse: string
  ): Promise<void> {
    try {
      logger.info("📤 Delivering widget message", { messageId })

      // Save response to queue
      await prisma.whatsAppQueue.update({
        where: { id: messageId },
        data: {
          status: "sent",
          deliveredAt: new Date(),
          responsePayload: {
            response: llmResponse,
            processedAt: new Date().toISOString(),
          },
        },
      })

      logger.info("✅ Widget message delivered (response saved)", { messageId })
    } catch (error) {
      logger.error("❌ Error delivering widget message", { messageId, error })
      
      // Mark as error
      await prisma.whatsAppQueue.update({
        where: { id: messageId },
        data: {
          status: "error",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      })
    }
  }

  /**
   * Check for widget messages that exceeded polling timeout
   * Mark as error if pollingAttempts >= 30 (15 seconds)
   */
  static async cleanupTimedOutMessages(): Promise<void> {
    try {
      const timedOutMessages = await prisma.whatsAppQueue.findMany({
        where: {
          channel: "widget",
          status: "pending",
          pollingAttempts: { gte: 30 },
        },
      })

      if (timedOutMessages.length === 0) {
        return
      }

      logger.warn(`⏰ Found ${timedOutMessages.length} timed-out widget messages`)

      for (const message of timedOutMessages) {
        await prisma.whatsAppQueue.update({
          where: { id: message.id },
          data: {
            status: "error",
            errorMessage: "Timeout: No response within 15 seconds",
          },
        })
      }

      logger.info(`✅ Marked ${timedOutMessages.length} messages as timed out`)
    } catch (error) {
      logger.error("❌ Error cleaning up timed-out widget messages", error)
    }
  }

  /**
   * Cleanup expired widget messages (older than 24 hours)
   */
  static async cleanupExpiredMessages(): Promise<void> {
    try {
      const now = new Date()

      const result = await prisma.whatsAppQueue.deleteMany({
        where: {
          channel: "widget",
          expiresAt: { lt: now },
        },
      })

      if (result.count > 0) {
        logger.info(`🧹 Deleted ${result.count} expired widget messages`)
      }
    } catch (error) {
      logger.error("❌ Error cleaning up expired widget messages", error)
    }
  }
}
