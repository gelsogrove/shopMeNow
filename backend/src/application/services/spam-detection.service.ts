import { PrismaClient } from "@prisma/client"
import logger from "../../utils/logger"

export interface SpamDetectionResult {
  isSpam: boolean
  messageCount: number
  timeWindow: number
  threshold: number
  reason?: string
}

export class SpamDetectionService {
  private prisma: PrismaClient
  private readonly SPAM_THRESHOLD = 50 // 50 messages (increased for MCP testing)
  private readonly TIME_WINDOW_SECONDS = 60 // in 60 seconds (1 minute)

  constructor() {
    this.prisma = new PrismaClient()
  }

  /**
   * Check if a phone number is sending spam messages
   * @param phoneNumber Customer phone number
   * @param workspaceId Workspace ID
   * @returns SpamDetectionResult
   */
  async checkSpamBehavior(
    phoneNumber: string,
    workspaceId: string
  ): Promise<SpamDetectionResult> {
    try {
      // ✅ SPAM DETECTION ENABLED - Check for spam behavior
      logger.info(`[SPAM_DETECTION] Checking spam behavior for ${phoneNumber}`)

      // Calculate time window (60 seconds ago)
      const now = new Date()
      const timeWindowStart = new Date(
        now.getTime() - this.TIME_WINDOW_SECONDS * 1000
      )

      // Count messages from this phone number in the last 60 seconds
      const messageCount = await this.prisma.message.count({
        where: {
          chatSession: {
            workspaceId: workspaceId,
            customer: {
              phone: phoneNumber,
            },
          },
          direction: "INBOUND",
          createdAt: {
            gte: timeWindowStart,
          },
        },
      })

      const isSpam = messageCount >= this.SPAM_THRESHOLD

      if (isSpam) {
        logger.warn(
          `[SPAM_DETECTION] Spam detected for ${phoneNumber}: ${messageCount} messages in ${this.TIME_WINDOW_SECONDS} seconds (threshold: ${this.SPAM_THRESHOLD})`
        )
      }

      return {
        isSpam,
        messageCount,
        timeWindow: this.TIME_WINDOW_SECONDS,
        threshold: this.SPAM_THRESHOLD,
        reason: isSpam
          ? `Sent ${messageCount} messages in ${this.TIME_WINDOW_SECONDS} seconds`
          : undefined,
      }
    } catch (error) {
      logger.error(
        `[SPAM_DETECTION] Error checking spam for ${phoneNumber}:`,
        error
      )
      // Return false on error to avoid false positives
      return {
        isSpam: false,
        messageCount: 0,
        timeWindow: this.TIME_WINDOW_SECONDS,
        threshold: this.SPAM_THRESHOLD,
      }
    }
  }

  /**
   * Block a phone number due to spam behavior
   * @param phoneNumber Phone number to block
   * @param workspaceId Workspace ID
   * @param reason Reason for blocking
   */
  async blockSpamUser(
    phoneNumber: string,
    workspaceId: string,
    reason: string
  ): Promise<void> {
    try {
      // 1. Mark customer as blacklisted (if customer record exists)
      const customer = await this.prisma.customers.findFirst({
        where: {
          phone: phoneNumber,
          workspaceId: workspaceId,
        },
      })

      if (customer) {
        await this.prisma.customers.update({
          where: { id: customer.id },
          data: { isBlacklisted: true },
        })
        logger.info(
          `[SPAM_DETECTION] Marked customer ${customer.name} (${phoneNumber}) as blacklisted`
        )
      } else {
        // Create a blocked customer record
        await this.prisma.customers.create({
          data: {
            phone: phoneNumber,
            workspaceId: workspaceId,
            name: "Spam User",
            email: `${phoneNumber.replace(/[^0-9]/g, "")}@spam.com`,
            isBlacklisted: true,
            isActive: true,
          },
        })
        logger.info(
          `[SPAM_DETECTION] Created blocked customer record for ${phoneNumber}`
        )
      }

      // 2. Add phone number to workspace blocklist
      await this.addToWorkspaceBlocklist(phoneNumber, workspaceId)

      // 3. Log the spam event for audit
      logger.warn(`[SPAM_DETECTION] Blocked ${phoneNumber} for spam: ${reason}`)
    } catch (error) {
      logger.error(
        `[SPAM_DETECTION] Error blocking spam user ${phoneNumber}:`,
        error
      )
      throw error
    }
  }

  /**
   * Add phone number to workspace blocklist
   * @param phoneNumber Phone number to add
   * @param workspaceId Workspace ID
   */
  private async addToWorkspaceBlocklist(
    phoneNumber: string,
    workspaceId: string
  ): Promise<void> {
    try {
      // Get current workspace
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true, // blocklist field removed - using customers.isBlacklisted instead
        },
      })

      if (!workspace) {
        throw new Error(`Workspace ${workspaceId} not found`)
      }

      /**
       * ⚠️ DEPRECATED: workspace.blocklist field was removed
       * Now using customers.isBlacklisted instead
       * Use CustomerRepository.updateCustomer({ isBlacklisted: true })
       */
      logger.warn(
        `[SPAM_DETECTION] addToWorkspaceBlocklist is deprecated. Use customers.isBlacklisted instead for ${phoneNumber}`
      )
      return // No-op

      // Parse current blocklist
      // const currentBlocklist = workspace.blocklist || ""
      // const blockedNumbers = currentBlocklist
      //   .split(/[\n,]/)
      //   .map((num) => num.trim())
      //   .filter((num) => num.length > 0)

      // // Add phone number if not already present
      // if (!blockedNumbers.includes(phoneNumber)) {
      //   blockedNumbers.push(phoneNumber)

      //   // Update workspace blocklist
      //   const newBlocklist = blockedNumbers.join("\n")
      //   await this.prisma.workspace.update({
      //     where: { id: workspaceId },
      //     data: { blocklist: newBlocklist },
      //   })

      //   logger.info(`[SPAM_DETECTION] Added ${phoneNumber} to workspace ${workspaceId} blocklist`)
      // } else {
      //   logger.info(`[SPAM_DETECTION] ${phoneNumber} already in workspace ${workspaceId} blocklist`)
      // }
    } catch (error) {
      logger.error(
        `[SPAM_DETECTION] Error adding to workspace blocklist:`,
        error
      )
      throw error
    }
  }

  /**
   * Get spam detection statistics for a workspace
   * @param workspaceId Workspace ID
   * @returns Statistics about spam detection
   */
  async getSpamStats(workspaceId: string): Promise<{
    totalBlocked: number
    recentSpamAttempts: number
    blocklistSize: number
  }> {
    try {
      // Count blacklisted customers
      const totalBlocked = await this.prisma.customers.count({
        where: {
          workspaceId: workspaceId,
          isBlacklisted: true,
        },
      })

      // Count recent spam attempts (last 24 hours)
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const recentSpamAttempts = await this.prisma.message.count({
        where: {
          chatSession: {
            workspaceId: workspaceId,
            customer: {
              isBlacklisted: true,
            },
          },
          direction: "INBOUND",
          createdAt: {
            gte: last24Hours,
          },
        },
      })

      // Get blocklist size - DEPRECATED: using customers.isBlacklisted count instead
      const blacklistedCustomers = await this.prisma.customers.count({
        where: {
          workspaceId,
          isBlacklisted: true,
        },
      })

      return {
        totalBlocked,
        recentSpamAttempts,
        blocklistSize: blacklistedCustomers,
      }
    } catch (error) {
      logger.error(
        `[SPAM_DETECTION] Error getting spam stats for workspace ${workspaceId}:`,
        error
      )
      return {
        totalBlocked: 0,
        recentSpamAttempts: 0,
        blocklistSize: 0,
      }
    }
  }
}
