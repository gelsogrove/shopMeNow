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
  constructor(private prisma: PrismaClient) {}

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
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
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
   * Check for duplicate messages (deduplication)
   * @param customerId Customer ID
   * @param content Message content
   * @param withinMinutes Time window in minutes (default: 1)
   * @returns True if duplicate exists
   */
  async checkDuplicate(
    customerId: string,
    content: string,
    withinMinutes: number = 1
  ): Promise<boolean> {
    try {
      const timeThreshold = new Date(Date.now() - withinMinutes * 60 * 1000)

      const existing = await this.prisma.whatsAppQueue.findFirst({
        where: {
          customerId,
          messageContent: content,
          status: "pending", // 🔥 ONLY check pending messages, allow same message if previous is sent/error
          createdAt: {
            gte: timeThreshold,
          },
        },
      })

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
