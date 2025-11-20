// External dependencies
import { PrismaClient, WhatsAppQueue } from "@prisma/client"

// Internal core
import logger from "../utils/logger"

// Agents
import { SecurityAgent } from "../application/agents/SecurityAgent"

// Repositories
import { WhatsAppQueueRepository } from "../repositories/whatsapp-queue.repository"

export interface EnqueueMessageDto {
  workspaceId: string
  customerId: string
  phoneNumber: string
  messageContent: string
}

export interface ValidateAndSendResult {
  success: boolean
  error?: string
}

export class WhatsAppQueueService {
  private repository: WhatsAppQueueRepository
  private securityAgent: SecurityAgent // 🆕 Feature 181: Security check before WhatsApp send

  constructor(private prisma: PrismaClient) {
    this.repository = new WhatsAppQueueRepository(prisma)
    this.securityAgent = new SecurityAgent(prisma) // Initialize Security Agent
  }

  /**
   * Get queue status for a workspace
   * @param workspaceId Workspace ID (workspace isolation)
   * @param status Optional status filter
   * @returns Array of queue messages
   */
  async getQueueStatus(
    workspaceId: string,
    status?: string
  ): Promise<WhatsAppQueue[]> {
    try {
      logger.info(
        `[WhatsAppQueueService] Getting queue status for workspace: ${workspaceId}, status: ${status || "all"}`
      )
      return await this.repository.findByWorkspace(workspaceId, status)
    } catch (error) {
      logger.error(`[WhatsAppQueueService] Error in getQueueStatus:`, error)
      throw new Error("Failed to get queue status")
    }
  }

  /**
   * Add message to queue with validation
   * @param data Message data
   * @returns Created queue message
   */
  async enqueue(data: EnqueueMessageDto): Promise<WhatsAppQueue> {
    const timestamp = new Date().toISOString()
    console.log(
      `\n🚨🚨🚨 [${timestamp}] ENQUEUE CALLED - Customer: ${data.customerId}, Phone: ${data.phoneNumber}`
    )

    try {
      console.log(`✅ Step 1: Validating fields...`)

      // Validate required fields
      if (!data.phoneNumber || data.phoneNumber.trim() === "") {
        console.log(`❌ Phone number missing!`)
        throw new Error("Phone number is required")
      }

      if (!data.messageContent || data.messageContent.trim() === "") {
        console.log(`❌ Message content missing!`)
        throw new Error("Message content is required")
      }

      if (!data.workspaceId || data.workspaceId.trim() === "") {
        console.log(`❌ Workspace ID missing!`)
        throw new Error("Workspace ID is required")
      }

      if (!data.customerId || data.customerId.trim() === "") {
        console.log(`❌ Customer ID missing!`)
        throw new Error("Customer ID is required")
      }

      console.log(
        `✅ All fields valid. Message: "${data.messageContent.substring(0, 50)}..."`
      )

      // Check for duplicates (within 1 minute)
      console.log(`✅ Step 2: Checking for duplicates...`)
      const isDuplicate = await this.repository.checkDuplicate(
        data.customerId,
        data.messageContent,
        1
      )

      if (isDuplicate) {
        console.log(`⚠️ DUPLICATE DETECTED - Skipping enqueue`)
        logger.warn(
          `[WhatsAppQueueService] Duplicate message detected for customer ${data.customerId}, skipping enqueue`
        )
        throw new Error("Duplicate message detected (within 1 minute window)")
      }

      console.log(`✅ No duplicates found`)

      console.log(`✅ Step 3: Creating record in database...`)
      logger.info(
        `[WhatsAppQueueService] Enqueueing message for customer: ${data.customerId}`
      )

      const result = await this.repository.create({
        workspaceId: data.workspaceId,
        customerId: data.customerId,
        phoneNumber: data.phoneNumber,
        messageContent: data.messageContent,
        status: "pending",
      })

      console.log(`✅✅✅ SUCCESS! Record created with ID: ${result.id}`)
      console.log(
        `🎉 Message now in queue! Visit http://localhost:3000/queue to see it\n`
      )

      return result
    } catch (error) {
      console.log(`❌❌❌ ERROR IN ENQUEUE: ${(error as Error).message}\n`)
      logger.error(`[WhatsAppQueueService] Error in enqueue:`, error)
      throw error
    }
  }

  /**
   * Process pending messages for a workspace (called by cron)
   * @param workspaceId Workspace ID
   */
  async processPendingMessages(workspaceId: string): Promise<void> {
    try {
      // Fetch ONE pending message (FIFO)
      const message = await this.repository.findPending(workspaceId, 1)

      if (!message) {
        // No pending messages
        return
      }

      logger.info(
        `[WhatsAppQueueService] Processing message ID: ${message.id} for customer: ${message.customerId}`
      )

      // Validate and send
      const result = await this.validateAndSend(message)

      if (result.success) {
        // Success: update status to 'sent' (keep in queue for history)
        await this.repository.updateStatus(message.id, "sent")
        logger.info(
          `[WhatsAppQueueService] Message ${message.id} sent successfully, updated status to 'sent'`
        )

        // Mark as delivered in conversation history (if exists)
        await this.markDeliveredInHistory(
          message.customerId,
          message.messageContent
        )
      } else {
        // Error: update status to 'error' with error message
        await this.repository.updateStatus(message.id, "error", result.error)
        logger.error(
          `[WhatsAppQueueService] Message ${message.id} failed: ${result.error}`
        )
      }
    } catch (error) {
      logger.error(
        `[WhatsAppQueueService] Error in processPendingMessages:`,
        error
      )
      // Don't throw - let cron continue with next cycle
    }
  }

  /**
   * Validate message fields and run through Security Agent
   * (🆕 Feature 181: Security check before sending to WhatsApp)
   * @param message Queue message
   * @returns Validation result
   */
  async validateAndSend(
    message: WhatsAppQueue
  ): Promise<ValidateAndSendResult> {
    try {
      // Validate phone number format (basic check)
      if (!message.phoneNumber || message.phoneNumber.trim() === "") {
        return { success: false, error: "Invalid phone number: empty" }
      }

      // Simple phone validation: must start with + and contain digits
      const phoneRegex = /^\+?[0-9]{8,15}$/
      if (!phoneRegex.test(message.phoneNumber.replace(/\s/g, ""))) {
        return {
          success: false,
          error: `Invalid phone number format: ${message.phoneNumber}`,
        }
      }

      // Validate message content
      if (!message.messageContent || message.messageContent.trim() === "") {
        return { success: false, error: "Invalid message: empty content" }
      }

      // 🆕 STEP 1: Run message through Security Agent (Feature 181)
      logger.info("🛡️ Step 1: Running Security Agent before WhatsApp send")
      const securityResult = await this.securityAgent.process({
        workspaceId: message.workspaceId,
        message: message.messageContent,
        customerId: message.customerId,
        customerName: "", // Not always available from queue record
      })

      // If Security Agent blocks the message, don't send
      if (!securityResult.safe) {
        logger.warn("🚫 Message BLOCKED by Security Agent before WhatsApp send", {
          reason: securityResult.blockedReason,
          customerId: message.customerId,
          messageId: message.id,
        })
        return {
          success: false,
          error: `Security check failed: ${securityResult.blockedReason}`,
        }
      }

      logger.info("✅ Message passed Security Agent check")

      // 🚨 PLACEHOLDER: Console log instead of actual WhatsApp send
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      console.log("📤 SEND MESSAGE WHATSAPP (after Security check)")
      console.log(`   Phone: ${message.phoneNumber}`)
      console.log(`   Customer: ${message.customerId}`)
      console.log(`   Message: ${message.messageContent.substring(0, 100)}${message.messageContent.length > 100 ? "..." : ""}`)
      console.log(`   Workspace: ${message.workspaceId}`)
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

      // Simulate success
      return { success: true }
    } catch (error) {
      logger.error(`[WhatsAppQueueService] Error in validateAndSend:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Mark message as delivered in conversation history
   * @param customerId Customer ID
   * @param messageContent Message content to find
   */
  private async markDeliveredInHistory(
    customerId: string,
    messageContent: string
  ): Promise<void> {
    try {
      // Find matching conversation message (most recent)
      const conversationMessage =
        await this.prisma.conversationMessage.findFirst({
          where: {
            customerId,
            content: messageContent,
            deliveredAt: null, // Only update if not already marked
          },
          orderBy: {
            createdAt: "desc",
          },
        })

      if (conversationMessage) {
        await this.prisma.conversationMessage.update({
          where: { id: conversationMessage.id },
          data: { deliveredAt: new Date() },
        })

        logger.info(
          `[WhatsAppQueueService] Marked conversation message ${conversationMessage.id} as delivered`
        )
      } else {
        logger.warn(
          `[WhatsAppQueueService] No matching conversation message found for customer ${customerId}`
        )
      }
    } catch (error) {
      logger.error(
        `[WhatsAppQueueService] Error marking delivered in history:`,
        error
      )
      // Don't throw - this is non-critical
    }
  }

  /**
   * Get queue statistics for a workspace
   * @param workspaceId Workspace ID
   * @returns Statistics object
   */
  async getStatistics(workspaceId: string): Promise<{
    pending: number
    sent: number
    error: number
    total: number
  }> {
    try {
      return await this.repository.countByStatus(workspaceId)
    } catch (error) {
      logger.error(`[WhatsAppQueueService] Error in getStatistics:`, error)
      throw new Error("Failed to get queue statistics")
    }
  }
}
