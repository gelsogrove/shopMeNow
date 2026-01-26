// External dependencies
import { PrismaClient, WhatsAppQueue } from "@echatbot/database"

// Internal core
import logger from "../utils/logger"

// Agents
import { SecurityAgent } from "../application/agents/SecurityAgent"

// Repositories
import { WhatsAppQueueRepository } from "../repositories/whatsapp-queue.repository"

// Services
import { SubscriptionBillingService } from "../application/services/subscription-billing.service"

export interface EnqueueMessageDto {
  workspaceId: string
  customerId: string
  phoneNumber: string
  messageContent: string
  conversationMessageId?: string // FK to ConversationMessage for timeline tracking
  isPlayground?: boolean // 🧪 Skip billing and real sending in playground mode
}

export interface ValidateAndSendResult {
  success: boolean
  error?: string
}

/**
 * Timeline step for debugInfo append
 * Used when cronjob processes queue messages
 */
interface TimelineStep {
  type: "sub_agent"
  agent: string
  timestamp: string
  output?: {
    result?: any
    executionTimeMs?: number
  }
}

export class WhatsAppQueueService {
  private repository: WhatsAppQueueRepository
  private securityAgent: SecurityAgent // 🆕 Feature 181: Security check before WhatsApp send
  private billingService: SubscriptionBillingService // 💰 For credit deduction on message send

  constructor(private prisma: PrismaClient) {
    this.repository = new WhatsAppQueueRepository(prisma)
    this.securityAgent = new SecurityAgent(prisma) // Initialize Security Agent
    this.billingService = new SubscriptionBillingService(prisma) // Initialize billing service
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
    logger.info(`[WhatsAppQueueService] Enqueue called`, {
      customerId: data.customerId,
      phoneNumber: data.phoneNumber,
      workspaceId: data.workspaceId,
    })

    try {
      // Validate required fields
      if (!data.phoneNumber || data.phoneNumber.trim() === "") {
        throw new Error("Phone number is required")
      }

      if (!data.messageContent || data.messageContent.trim() === "") {
        throw new Error("Message content is required")
      }

      if (!data.workspaceId || data.workspaceId.trim() === "") {
        throw new Error("Workspace ID is required")
      }

      if (!data.customerId || data.customerId.trim() === "") {
        throw new Error("Customer ID is required")
      }

      // Check for duplicates (within 1 minute)
      const isDuplicate = await this.repository.checkDuplicate(
        data.customerId,
        data.messageContent,
        1
      )

      if (isDuplicate) {
        logger.warn(
          `[WhatsAppQueueService] Duplicate message detected for customer ${data.customerId}, skipping enqueue`
        )
        throw new Error("Duplicate message detected (within 1 minute window)")
      }

      logger.info(
        `[WhatsAppQueueService] Enqueueing message for customer: ${data.customerId}`
      )

      const result = await this.repository.create({
        workspaceId: data.workspaceId,
        customerId: data.customerId,
        phoneNumber: data.phoneNumber,
        messageContent: data.messageContent,
        status: "pending",
        conversationMessageId: data.conversationMessageId,
      })

      logger.info(`[WhatsAppQueueService] Message queued with ID: ${result.id}`, {
        isPlayground: data.isPlayground || false, // 🧪 Log playground mode
      })

      return result
    } catch (error) {
      logger.error(`[WhatsAppQueueService] Error in enqueue:`, error)
      throw error
    }
  }

  /**
   * Process pending messages for a workspace (called by cron)
   * If debugMode is enabled for the workspace, messages are NOT sent (stay pending)
   * @param workspaceId Workspace ID
   */
  async processPendingMessages(workspaceId: string): Promise<void> {
    try {
      // 🔧 DEBUG MODE CHECK: If debugMode is enabled, send WIP message automatically
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { debugMode: true, name: true, wipMessage: true },
      })

      if (workspace?.debugMode === true) {
        logger.info(
          `[WhatsAppQueueService] 🔧 DEBUG MODE ENABLED for workspace "${workspace.name}" (${workspaceId}) - sending WIP message`
        )
        
        // Fetch ONE pending message (FIFO) to send WIP response
        const message = await this.repository.findPending(workspaceId, 1)
        
        if (!message) {
          return // No messages to process
        }

        // Send WIP message automatically (no LLM, no extra cost)
        const wipMessage = workspace.wipMessage || "We are in maintenance mode. Please try again later."
        
        try {
          // TODO: Replace with actual WhatsApp send when ready
          logger.info(`[WhatsAppQueueService] 🔧 WIP message sent: ${wipMessage}`, {
            customerId: message.customerId,
            phoneNumber: message.phoneNumber,
          })
          
          // Mark as sent (WIP response)
          await this.repository.updateStatus(message.id, "sent")
          
          // Mark as delivered in conversation history
          await this.markDeliveredInHistory(
            message.conversationMessageId,
            message.customerId,
            wipMessage
          )
        } catch (error) {
          logger.error(`[WhatsAppQueueService] ❌ Failed to send WIP message:`, error)
          await this.repository.updateStatus(message.id, "error", "Failed to send WIP message")
        }
        
        return
      }

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

        // 💰 BILLING: Deduct credit NOW that message is actually sent
        try {
          const deductResult = await this.billingService.deductMessageCredit(
            message.workspaceId,
            message.id
          )
          if (deductResult.success) {
              logger.info(
                `[WhatsAppQueueService] 💰 Credit deducted for message ${message.id}`,
                {
                  workspaceId: message.workspaceId,
                  newBalance: deductResult.newBalance,
                }
              )
            } else {
              logger.warn(
                `[WhatsAppQueueService] ⚠️ Failed to deduct credit for message ${message.id}`,
                {
                  workspaceId: message.workspaceId,
                  error: deductResult.error,
                }
              )
            }
          } catch (billingError) {
            // Don't fail the message send if billing fails - just log it
            logger.error(
              `[WhatsAppQueueService] ⚠️ Billing error for message ${message.id}:`,
              billingError
            )
          }

        // Mark as delivered in conversation history (if exists)
        await this.markDeliveredInHistory(
          message.conversationMessageId,
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
   * Append a step to the conversation message timeline (debugInfo)
   * Used when cronjob processes queue messages to add Security Check and Send to WhatsApp steps
   *
   * @param conversationMessageId - The ID of the conversation message to update
   * @param step - The timeline step to append
   */
  private async appendTimelineStep(
    conversationMessageId: string | null,
    step: TimelineStep
  ): Promise<void> {
    if (!conversationMessageId) {
      logger.debug("[WhatsAppQueueService] No conversationMessageId - skipping timeline append")
      return
    }

    try {
      // Get current message with debugInfo
      const message = await this.prisma.conversationMessage.findUnique({
        where: { id: conversationMessageId },
        select: { id: true, debugInfo: true },
      })

      if (!message) {
        logger.warn(`[WhatsAppQueueService] Conversation message ${conversationMessageId} not found for timeline append`)
        return
      }

      // Parse existing debugInfo or create new structure
      let debugInfo: {
        steps: TimelineStep[]
        totalTokens: number
        totalCost: number
        executionTimeMs: number
      }

      if (message.debugInfo) {
        try {
          debugInfo = JSON.parse(message.debugInfo)
          if (!debugInfo.steps) {
            debugInfo.steps = []
          }
        } catch {
          // Invalid JSON, create new structure
          debugInfo = {
            steps: [],
            totalTokens: 0,
            totalCost: 0,
            executionTimeMs: 0,
          }
        }
      } else {
        debugInfo = {
          steps: [],
          totalTokens: 0,
          totalCost: 0,
          executionTimeMs: 0,
        }
      }

      // Append the new step
      debugInfo.steps.push(step)

      // Update execution time if provided
      if (step.output?.executionTimeMs) {
        debugInfo.executionTimeMs += step.output.executionTimeMs
      }

      // Save updated debugInfo
      await this.prisma.conversationMessage.update({
        where: { id: conversationMessageId },
        data: {
          debugInfo: JSON.stringify(debugInfo),
        },
      })

      logger.debug(`[WhatsAppQueueService] Appended "${step.agent}" step to timeline for message ${conversationMessageId}`)
    } catch (error) {
      // Non-critical error - log but don't throw
      logger.error(`[WhatsAppQueueService] Error appending timeline step:`, error)
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
      const securityStartTime = Date.now()
      const securityResult = await this.securityAgent.process({
        workspaceId: message.workspaceId,
        message: message.messageContent,
        customerId: message.customerId,
        customerName: "", // Not always available from queue record
      })
      const securityDuration = Date.now() - securityStartTime

      // 📊 Append Security Check step to timeline
      await this.appendTimelineStep(message.conversationMessageId, {
        type: "sub_agent",
        agent: "Security Check",
        timestamp: new Date().toISOString(),
        output: {
          result: {
            safe: securityResult.safe,
            blockedReason: securityResult.blockedReason || null,
          },
          executionTimeMs: securityDuration,
        },
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

      // 🆕 STEP 2: Send to WhatsApp (placeholder for now)
      const whatsappStartTime = Date.now()

      // 🚨 PLACEHOLDER: Log instead of actual WhatsApp send (API not yet integrated)
      logger.info("📤 [PLACEHOLDER] WhatsApp message ready for send", {
        phone: message.phoneNumber,
        customerId: message.customerId,
        workspaceId: message.workspaceId,
        messageLength: message.messageContent.length,
      })

      const whatsappDuration = Date.now() - whatsappStartTime

      // 📊 Append Send to WhatsApp step to timeline
      await this.appendTimelineStep(message.conversationMessageId, {
        type: "sub_agent",
        agent: "Send to WhatsApp",
        timestamp: new Date().toISOString(),
        output: {
          result: {
            success: true,
            phone: message.phoneNumber,
          },
          executionTimeMs: whatsappDuration,
        },
      })

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
   * Uses conversationMessageId for direct update (if available),
   * otherwise falls back to content matching
   *
   * @param conversationMessageId - Direct ID of the conversation message (preferred)
   * @param customerId - Customer ID (fallback if conversationMessageId not available)
   * @param messageContent - Message content for fallback matching
   */
  private async markDeliveredInHistory(
    conversationMessageId: string | null,
    customerId: string,
    messageContent: string
  ): Promise<void> {
    try {
      // Prefer direct update via conversationMessageId
      if (conversationMessageId) {
        await this.prisma.conversationMessage.update({
          where: { id: conversationMessageId },
          data: {
            deliveredAt: new Date(),
            deliveryStatus: "sent",
          },
        })

        logger.info(
          `[WhatsAppQueueService] Marked conversation message ${conversationMessageId} as delivered (direct ID)`
        )
        return
      }

      // Fallback: Find matching conversation message by content (legacy behavior)
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
          data: {
            deliveredAt: new Date(),
            deliveryStatus: "sent",
          },
        })

        logger.info(
          `[WhatsAppQueueService] Marked conversation message ${conversationMessage.id} as delivered (content match)`
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

  /**
   * Delete a single message from queue
   * @param messageId Message ID to delete
   * @param workspaceId Workspace ID (for isolation)
   * @returns True if deleted, false if not found
   */
  async deleteMessage(messageId: string, workspaceId: string): Promise<boolean> {
    try {
      logger.info(
        `[WhatsAppQueueService] Deleting message ${messageId} from workspace ${workspaceId}`
      )

      const result = await this.prisma.whatsAppQueue.deleteMany({
        where: {
          id: messageId,
          workspaceId, // Ensure workspace isolation
        },
      })

      if (result.count === 0) {
        logger.warn(
          `[WhatsAppQueueService] Message ${messageId} not found in workspace ${workspaceId}`
        )
        return false
      }

      logger.info(
        `[WhatsAppQueueService] Successfully deleted message ${messageId}`
      )
      return true
    } catch (error) {
      logger.error(`[WhatsAppQueueService] Error in deleteMessage:`, error)
      throw new Error("Failed to delete message")
    }
  }

  /**
   * Get queue enabled status for a workspace (based on channelStatus)
   * @param workspaceId Workspace ID
   * @returns Queue enabled status (based on channelStatus) and debug mode
   */
  async getQueueEnabledStatus(workspaceId: string): Promise<{ enabled: boolean; debugMode: boolean }> {
    try {
      logger.debug(`[WhatsAppQueueService] getQueueEnabledStatus: ${workspaceId}`)

      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { channelStatus: true, debugMode: true },
      })

      if (!workspace) {
        throw new Error("Workspace not found")
      }

      logger.debug(`[WhatsAppQueueService] Queue status: enabled=${workspace.channelStatus}, debugMode=${workspace.debugMode}`)

      return { enabled: workspace.channelStatus, debugMode: workspace.debugMode }
    } catch (error) {
      console.error(`🔴 [WhatsAppQueueService.getQueueEnabledStatus] Error:`, error)
      logger.error(`[WhatsAppQueueService] Error in getQueueEnabledStatus:`, error)
      throw new Error("Failed to get queue status")
    }
  }

  /**
   * Update channel status for a workspace (controls queue processing)
   * @param workspaceId Workspace ID
   * @param enabled Enable or disable channel
   * @returns Updated status
   */
  async updateQueueStatus(
    workspaceId: string,
    enabled: boolean
  ): Promise<{ enabled: boolean }> {
    try {
      logger.info(
        `[WhatsAppQueueService] Updating channel status for workspace ${workspaceId}: ${
          enabled ? "ENABLED" : "DISABLED"
        }`
      )

      const updated = await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { channelStatus: enabled },
      })

      logger.debug(`[WhatsAppQueueService] Updated workspace: ${updated.id}`)

      return { enabled }
    } catch (error) {
      console.error(`🔴 [WhatsAppQueueService.updateQueueStatus] Error:`, error)
      logger.error(`[WhatsAppQueueService] Error in updateQueueStatus:`, error)
      throw new Error("Failed to update queue status")
    }
  }

  /**
   * Update debug mode for a workspace
   * When debugMode=true, messages will NOT be sent (stay pending)
   * When debugMode=false, messages will be sent normally
   * @param workspaceId Workspace ID
   * @param debugMode Debug mode setting
   * @returns Updated debug mode status
   */
  async updateDebugMode(
    workspaceId: string,
    debugMode: boolean
  ): Promise<{ debugMode: boolean }> {
    try {
      logger.info(
        `[WhatsAppQueueService] 🔧 Updating debug mode for workspace ${workspaceId}: ${
          debugMode ? "ENABLED" : "DISABLED"
        }`
      )

      const updated = await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { debugMode },
      })

      logger.info(`[WhatsAppQueueService] ✅ Debug mode successfully updated in DB:`, {
        workspaceId: updated.id,
        newDebugMode: updated.debugMode,
        confirmed: updated.debugMode === debugMode,
      })

      return { debugMode }
    } catch (error) {
      console.error(`🔴 [WhatsAppQueueService.updateDebugMode] Error:`, error)
      logger.error(`[WhatsAppQueueService] Error in updateDebugMode:`, error)
      throw new Error("Failed to update debug mode")
    }
  }
}
