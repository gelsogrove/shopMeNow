import { CampaignFrequency, PrismaClient } from "@prisma/client"
import * as cron from "node-cron"
import { CampaignTokenService } from "../application/services/campaign-token.service"
import { CampaignService } from "../application/services/campaign.service"
import logger from "../utils/logger"

/**
 * Campaign Scheduler Service
 * Runs daily to check and send scheduled campaign messages
 */
export class CampaignScheduler {
  private campaignService: CampaignService
  private tokenService: CampaignTokenService
  private cronJob: cron.ScheduledTask | null = null

  constructor(private prisma: PrismaClient) {
    this.campaignService = new CampaignService(prisma)
    this.tokenService = new CampaignTokenService(prisma)
  }

  /**
   * Start the campaign scheduler
   * Runs every day at 10:00 AM
   */
  start(): void {
    // Run every day at 10:00 AM
    this.cronJob = cron.schedule("0 10 * * *", async () => {
      logger.info("🚀 [CAMPAIGN SCHEDULER] Starting daily campaign check...")
      await this.processCampaigns()
    })

    logger.info("✅ [CAMPAIGN SCHEDULER] Started - runs daily at 10:00 AM")
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop()
      logger.info("🛑 [CAMPAIGN SCHEDULER] Stopped")
    }
  }

  /**
   * Main processing logic - check all active campaigns
   */
  async processCampaigns(): Promise<void> {
    try {
      const activeCampaigns = await this.campaignService.findActiveCampaigns()

      logger.info(
        `[CAMPAIGN SCHEDULER] Found ${activeCampaigns.length} active campaigns`
      )

      for (const campaign of activeCampaigns) {
        try {
          await this.processSingleCampaign(campaign)
        } catch (error) {
          logger.error(
            `[CAMPAIGN SCHEDULER] Error processing campaign ${campaign.id}:`,
            error
          )
          // Continue with other campaigns
        }
      }

      logger.info("✅ [CAMPAIGN SCHEDULER] Daily check completed")
    } catch (error) {
      logger.error("[CAMPAIGN SCHEDULER] Error in processCampaigns:", error)
    }
  }

  /**
   * Process a single campaign
   */
  private async processSingleCampaign(campaign: any): Promise<void> {
    logger.info(`[CAMPAIGN SCHEDULER] Processing campaign: ${campaign.name}`)

    // Get target customers
    const customers = await this.getTargetCustomers(campaign)

    logger.info(
      `[CAMPAIGN SCHEDULER] Found ${customers.length} target customers for campaign ${campaign.id}`
    )

    let sentCount = 0

    for (const customer of customers) {
      try {
        // Check if customer should receive message based on frequency
        const shouldSend = await this.shouldSendToCustomer(
          campaign,
          customer.id
        )

        if (shouldSend) {
          await this.sendCampaignMessage(campaign, customer)
          sentCount++
        }
      } catch (error) {
        logger.error(
          `[CAMPAIGN SCHEDULER] Error sending to customer ${customer.id}:`,
          error
        )
        // Continue with other customers
      }
    }

    // Update campaign last run timestamp
    await this.campaignService.updateLastRun(campaign.id)

    logger.info(
      `✅ [CAMPAIGN SCHEDULER] Campaign ${campaign.name}: sent ${sentCount}/${customers.length} messages`
    )
  }

  /**
   * Get target customers for campaign
   */
  private async getTargetCustomers(campaign: any): Promise<any[]> {
    if (campaign.targetType === "ALL") {
      // Get all active customers in workspace
      return await this.prisma.customers.findMany({
        where: {
          workspaceId: campaign.workspaceId,
          isActive: true,
          isBlacklisted: false,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          language: true,
        },
      })
    } else {
      // Get only selected customers
      return await this.prisma.customers.findMany({
        where: {
          id: { in: campaign.customerIds },
          workspaceId: campaign.workspaceId,
          isActive: true,
          isBlacklisted: false,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          language: true,
        },
      })
    }
  }

  /**
   * Check if customer should receive message based on campaign frequency
   */
  private async shouldSendToCustomer(
    campaign: any,
    customerId: string
  ): Promise<boolean> {
    // Find last sent message for this campaign + customer
    const lastSent = await this.prisma.campaignSent.findFirst({
      where: {
        campaignId: campaign.id,
        customerId,
      },
      orderBy: { sentAt: "desc" },
    })

    const customer = await this.prisma.customers.findUnique({
      where: { id: customerId },
      select: { createdAt: true },
    })

    if (!customer) {
      return false
    }

    // If no previous send, use customer creation date
    const referenceDate = customer.createdAt // In production: lastSent?.sentAt || customer.createdAt
    const daysSinceReference = this.getDaysSince(referenceDate)
    const requiredDays = this.getFrequencyDays(campaign.frequency)

    return daysSinceReference >= requiredDays
  }

  /**
   * Get number of days based on campaign frequency
   */
  private getFrequencyDays(frequency: CampaignFrequency): number {
    const map: Record<CampaignFrequency, number> = {
      WEEKLY: 7,
      BIWEEKLY: 14,
      MONTHLY: 30,
      BIMONTHLY: 60,
      QUARTERLY: 90,
      SEMIANNUAL: 180,
      ANNUAL: 365,
    }
    return map[frequency] || 30
  }

  /**
   * Calculate days since a date
   */
  private getDaysSince(date: Date): number {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  }

  /**
   * Send campaign message to customer
   */
  private async sendCampaignMessage(
    campaign: any,
    customer: any
  ): Promise<void> {
    logger.info(
      `[CAMPAIGN SCHEDULER] Sending campaign ${campaign.name} to customer ${customer.id}`
    )

    // Replace tokens in message
    const { message: processedMessage, tokensUsed } =
      await this.tokenService.replaceTokens(
        campaign.messagePreview,
        customer.id,
        campaign.workspaceId,
        campaign.id
      )

    // Send WhatsApp message
    // TODO: Integrate with WhatsApp service
    logger.info(
      `[CAMPAIGN SCHEDULER] 📱 WhatsApp message (${tokensUsed.join(", ")}):\n${processedMessage.substring(0, 100)}...`
    )

    // Track sent message
    await this.prisma.campaignSent.create({
      data: {
        campaignId: campaign.id,
        customerId: customer.id,
        workspaceId: campaign.workspaceId,
        tokenUsed: tokensUsed.join(","),
      },
    })

    logger.info(
      `✅ [CAMPAIGN SCHEDULER] Message sent to ${customer.name} (${customer.phone})`
    )
  }
}
