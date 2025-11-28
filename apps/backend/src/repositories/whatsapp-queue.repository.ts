// External dependencies
import { PrismaClient, WhatsAppQueue } from "@prisma/client"

// Internal core
import logger from "../utils/logger"

export interface CreateQueueMessageDto {
  workspaceId: string
  customerId: string
  phoneNumber: string
  messageContent: string
  status?: string
  errorMessage?: string
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
    const timestamp = new Date().toISOString()
    console.log(`\n💾💾💾 [${timestamp}] REPOSITORY.CREATE() CALLED`)
    console.log(`   - Workspace: ${data.workspaceId}`)
    console.log(`   - Customer: ${data.customerId}`)
    console.log(`   - Phone: ${data.phoneNumber}`)
    console.log(`   - Message: "${data.messageContent.substring(0, 50)}..."`)
    console.log(`   - Status: ${data.status || "pending"}`)

    try {
      const result = await this.prisma.whatsAppQueue.create({
        data: {
          workspaceId: data.workspaceId,
          customerId: data.customerId,
          phoneNumber: data.phoneNumber,
          messageContent: data.messageContent,
          status: data.status || "pending",
          errorMessage: data.errorMessage,
        },
      })

      console.log(`✅✅✅ [${timestamp}] RECORD CREATED IN DATABASE!`)
      console.log(`   - Record ID: ${result.id}`)
      console.log(`   - Created At: ${result.createdAt}`)
      console.log(`   - Status: ${result.status}\n`)

      return result
    } catch (error) {
      console.log(`❌ DATABASE ERROR: ${(error as Error).message}\n`)
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
   */
  async delete(id: string): Promise<void> {
    try {
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
          where: { workspaceId, status: "error" },
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
