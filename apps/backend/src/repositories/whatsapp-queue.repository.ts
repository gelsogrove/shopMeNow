// External dependencies
import { PrismaClient, WhatsAppQueue } from "@echatbot/database"

// Internal core
import logger from "../utils/logger"

export interface CreateQueueMessageDto {
  workspaceId: string
  customerId: string
  phoneNumber: string
  messageContent: string
  status?: string
  errorMessage?: string
  conversationMessageId?: string // FK to ConversationMessage for timeline tracking
  skipSecurityCheck?: boolean // 🔐 Skip security validation for trusted messages (e.g., welcome message)
}

export class WhatsAppQueueRepository {
  constructor(private prisma: PrismaClient) { }

  /**
   * Find all queue messages for a workspace
   * @param workspaceId Workspace ID (workspace isolation)
   * @param status Optional status filter (pending, sent, error)
   * @returns Array of queue messages
   */
  async findByWorkspace(
    workspaceId: string,
    status?: string
  ): Promise<WhatsAppQueue[]> {
    try {
      const where: any = { workspaceId }
      if (status) {
        where.status = status
      }

      return await this.prisma.whatsAppQueue.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          workspace: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc", // Most recent first (descending order)
        },
      })
    } catch (error) {
      logger.error(`[WhatsAppQueueRepository] Error in findByWorkspace:`, error)
      throw error
    }
  }

  /**
   * Find pending messages for processing (FIFO order)
   * @param workspaceId Workspace ID (workspace isolation)
   * @param limit Number of messages to fetch (default: 1)
   * @returns First pending message or null
   */
  async findPending(
    workspaceId: string,
    limit: number = 1
  ): Promise<WhatsAppQueue | null> {
    try {
      const messages = await this.prisma.whatsAppQueue.findMany({
        where: {
          workspaceId,
          status: "pending",
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              language: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc", // FIFO: oldest first
        },
        take: limit,
      })

      return messages.length > 0 ? messages[0] : null
    } catch (error) {
      logger.error(`[WhatsAppQueueRepository] Error in findPending:`, error)
      throw error
    }
  }

  /**
   * Create a new queue message
   * @param data Message data
   * @returns Created message
   */
  async create(data: CreateQueueMessageDto): Promise<WhatsAppQueue> {
    logger.debug(`[WhatsAppQueueRepository] Creating queue message for workspace ${data.workspaceId}`)

    try {
      const result = await this.prisma.whatsAppQueue.create({
        data: {
          workspaceId: data.workspaceId,
          customerId: data.customerId,
          phoneNumber: data.phoneNumber,
          messageContent: data.messageContent,
          status: data.status || "pending",
          errorMessage: data.errorMessage,
          conversationMessageId: data.conversationMessageId,
          skipSecurityCheck: data.skipSecurityCheck || false,
        },
      })

      logger.debug(`[WhatsAppQueueRepository] Created queue message: ${result.id}`)

      return result
    } catch (error) {
      logger.error(`[WhatsAppQueueRepository] Error in create:`, error)
      throw error
    }
  }

  /**
   * Update message status
   * @param id Message ID
   * @param status New status (sent, error)
   * @param error Optional error message
   */
  async updateStatus(
    id: string,
    status: string,
    error?: string
  ): Promise<void> {
    try {
      await this.prisma.whatsAppQueue.update({
        where: { id },
        data: {
          status,
          errorMessage: error,
          deliveredAt: status === "sent" ? new Date() : undefined,
        },
      })
    } catch (error) {
      logger.error(`[WhatsAppQueueRepository] Error in updateStatus:`, error)
      throw error
    }
  }

  /**
   * Record a failed send attempt. Re-queues as "pending" with an exponential
   * backoff gate (nextRetryAt) until maxRetries is exhausted, then marks the
   * message "error" permanently (dead-letter — excluded from findPending).
   * @param id Message ID
   * @param errorMessage Failure reason to persist
   */
  async recordFailure(id: string, errorMessage: string): Promise<void> {
    try {
      const message = await this.prisma.whatsAppQueue.findUnique({
        where: { id },
        select: {
          retryCount: true,
          maxRetries: true,
          workspaceId: true,
          customerId: true,
          pushCampaignId: true,
        },
      })
      if (!message) return

      const nextRetryCount = message.retryCount + 1
      const exhausted = nextRetryCount >= message.maxRetries

      await this.prisma.whatsAppQueue.update({
        where: { id },
        data: {
          status: exhausted ? "error" : "pending",
          errorMessage,
          retryCount: nextRetryCount,
          // Exponential backoff: 1m, 2m, 4m, ... capped implicitly by maxRetries
          nextRetryAt: exhausted ? null : new Date(Date.now() + Math.pow(2, nextRetryCount - 1) * 60_000),
        },
      })

      if (exhausted) {
        // Same convention as BILLING_RECONCILE in the direct-send service:
        // error-level with every identifier needed to find and re-send it.
        logger.error("QUEUE_DEAD_LETTER: message permanently failed after exhausting retries", {
          messageId: id,
          workspaceId: message.workspaceId,
          customerId: message.customerId,
          pushCampaignId: message.pushCampaignId,
          attempts: nextRetryCount,
          lastError: errorMessage,
        })
      }
    } catch (error) {
      logger.error(`[WhatsAppQueueRepository] Error in recordFailure:`, error)
      throw error
    }
  }

  /**
   * Delete message from queue
   * @param id Message ID
   * @param workspaceId Workspace ID for security validation
   */
  async delete(id: string, workspaceId: string): Promise<void> {
    try {
      // SECURITY: First verify the message belongs to this workspace
      const message = await this.prisma.whatsAppQueue.findUnique({
        where: { id },
        select: { workspaceId: true }
      })

      if (!message) {
        throw new Error('Queue message not found')
      }

      if (message.workspaceId !== workspaceId) {
        logger.warn('🚨 SECURITY: Attempted cross-workspace queue message deletion', {
          messageId: id,
          requestedWorkspaceId: workspaceId,
          actualWorkspaceId: message.workspaceId
        })
        throw new Error('Queue message not found') // Don't reveal it exists in another workspace
      }

      await this.prisma.whatsAppQueue.delete({
        where: { id },
      })
    } catch (error) {
      logger.error(`[WhatsAppQueueRepository] Error in delete:`, error)
      throw error
    }
  }

  /**
   * Delete messages by status for a workspace
   * @param workspaceId Workspace ID
   * @param statuses Array of statuses to delete
   * @returns Number of deleted messages
   */
  async deleteByStatus(
    workspaceId: string,
    statuses: string[]
  ): Promise<number> {
    try {
      const result = await this.prisma.whatsAppQueue.deleteMany({
        where: {
          workspaceId,
          status: { in: statuses },
        },
      })
      return result.count
    } catch (error) {
      logger.error(`[WhatsAppQueueRepository] Error in deleteByStatus:`, error)
      throw error
    }
  }

  /**
   * Check for duplicate messages (deduplication)
   * 🔧 FIX: Strengthened to prevent Meta retry race conditions
   * - Checks ALL statuses (pending, sent, error) instead of just pending
   * - Increased time window from 1 to 2 minutes
   * @param customerId Customer ID
   * @param content Message content
   * @param withinMinutes Time window in minutes (default: 2)
   * @returns True if duplicate exists
   */
  async checkDuplicate(
    customerId: string,
    content: string,
    withinMinutes: number = 2 // 🔧 Increased from 1 to 2 minutes
  ): Promise<boolean> {
    try {
      const timeThreshold = new Date(Date.now() - withinMinutes * 60 * 1000)

      // 🔧 FIX: Check ALL statuses to prevent Meta retry duplicates
      const existing = await this.prisma.whatsAppQueue.findFirst({
        where: {
          customerId,
          messageContent: content,
          // 🔧 REMOVED status filter - now checks pending, sent, AND error
          createdAt: {
            gte: timeThreshold,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      if (existing) {
        logger.warn(
          `[WhatsAppQueueRepository] 🚫 Duplicate message detected`,
          {
            customerId,
            messagePreview: content.substring(0, 50),
            existingStatus: existing.status,
            existingCreatedAt: existing.createdAt,
            timeSinceLastMessage: Date.now() - existing.createdAt.getTime(),
          }
        )
      }

      return existing !== null
    } catch (error) {
      logger.error(`[WhatsAppQueueRepository] Error in checkDuplicate:`, error)
      throw error
    }
  }

  /**
   * Get message by ID with workspace validation
   * @param id Message ID
   * @param workspaceId Workspace ID (workspace isolation)
   * @returns Message or null
   */
  async findById(
    id: string,
    workspaceId: string
  ): Promise<WhatsAppQueue | null> {
    try {
      return await this.prisma.whatsAppQueue.findFirst({
        where: {
          id,
          workspaceId,
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      })
    } catch (error) {
      logger.error(`[WhatsAppQueueRepository] Error in findById:`, error)
      throw error
    }
  }

  /**
   * Count messages by status for a workspace
   * @param workspaceId Workspace ID
   * @returns Object with counts per status
   */
  async countByStatus(workspaceId: string): Promise<{
    pending: number
    sent: number
    error: number
    total: number
  }> {
    try {
      const [pending, sent, error, total] = await Promise.all([
        this.prisma.whatsAppQueue.count({
          where: { workspaceId, status: "pending" },
        }),
        this.prisma.whatsAppQueue.count({
          where: { workspaceId, status: "sent" },
        }),
        this.prisma.whatsAppQueue.count({
          where: { workspaceId, status: { in: ["error", "failed"] } },
        }),
        this.prisma.whatsAppQueue.count({
          where: { workspaceId },
        }),
      ])

      return { pending, sent, error, total }
    } catch (error) {
      logger.error(`[WhatsAppQueueRepository] Error in countByStatus:`, error)
      throw error
    }
  }
}
