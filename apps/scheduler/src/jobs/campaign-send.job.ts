import { prisma, CampaignFrequency } from '../config/database'
import logger from '../utils/logger'
import { translationService } from '../services/translation.service'
import { BillingService } from '../services/billing.service'

/**
 * Campaign Send Job
 * Runs daily at 10:00 AM
 * Checks active campaigns and queues messages for eligible customers
 * 
 * FLOW:
 * 1. Find active campaigns
 * 2. For each campaign, check if it's time to send based on frequency
 * 3. Get eligible customers (not blacklisted, active, with consent)
 * 4. Queue messages to WhatsAppQueue (processed by whatsapp-channel-queue.job)
 */
export async function campaignSendJob(): Promise<void> {
  logger.info('🚀 [CAMPAIGN] Starting daily campaign check...')
  const billingService = new BillingService()

  // Find all active campaigns
  const activeCampaigns = await prisma.campaign.findMany({
    where: {
      isActive: true,
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          debugMode: true,
        },
      },
    },
  })

  logger.info(`[CAMPAIGN] Found ${activeCampaigns.length} active campaigns`)

  let totalMessagesSent = 0
  let totalCampaignsProcessed = 0

  for (const campaign of activeCampaigns) {
    try {
      // Skip if workspace is in debug mode (test mode)
      if (campaign.workspace.debugMode === true) {
        logger.info(`[CAMPAIGN] Skipping campaign ${campaign.name} - workspace in debug mode`)
        continue
      }

      const hasCredit = await billingService.hasOwnerCredit(campaign.workspaceId)
      if (!hasCredit) {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { isActive: false },
        })
        logger.warn(`[CAMPAIGN] Deactivating campaign ${campaign.name} - insufficient credit or inactive subscription`)
        continue
      }

      // Check if campaign should run based on frequency
      const shouldRun = await shouldCampaignRun(campaign)
      if (!shouldRun) {
        logger.info(`[CAMPAIGN] Skipping campaign ${campaign.name} - not time yet`)
        continue
      }

      // Get target customers
      const customers = await getTargetCustomers(campaign)

      logger.info(`[CAMPAIGN] Campaign ${campaign.name}: ${customers.length} eligible customers`)

      if (customers.length === 0) {
        continue
      }

      // Queue messages for each customer
      let messagesQueued = 0
      for (const customer of customers) {
        try {
          // Check if already sent to this customer for this campaign today
          const alreadySent = await checkAlreadySent(campaign.id, customer.id)
          if (alreadySent) {
            continue
          }

          // Queue message
          await queueCampaignMessage(campaign, customer)
          messagesQueued++
        } catch (error) {
          logger.error(`[CAMPAIGN] Error queueing message for customer ${customer.id}:`, error)
        }
      }

      // Update campaign last run timestamp
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { lastRunAt: new Date() },
      })

      totalMessagesSent += messagesQueued
      totalCampaignsProcessed++

      logger.info(`✅ [CAMPAIGN] Campaign ${campaign.name}: ${messagesQueued} messages queued`)

    } catch (error) {
      logger.error(`[CAMPAIGN] Error processing campaign ${campaign.id}:`, error)
    }
  }

  logger.info(`✅ [CAMPAIGN] Daily check completed: ${totalCampaignsProcessed} campaigns, ${totalMessagesSent} messages queued`)
}

/**
 * Check if campaign should run based on frequency and last run
 */
async function shouldCampaignRun(campaign: any): Promise<boolean> {
  const now = new Date()
  const lastRun = campaign.lastRunAt

  // If never run, run now
  if (!lastRun) {
    return true
  }

  const daysSinceLastRun = getDaysSince(lastRun)
  const requiredDays = getFrequencyDays(campaign.frequency)

  return daysSinceLastRun >= requiredDays
}

/**
 * Get target customers for campaign
 */
async function getTargetCustomers(campaign: any): Promise<any[]> {
  const baseWhere = {
    workspaceId: campaign.workspaceId,
    isActive: true,
    isBlacklisted: false,
    push_notifications_consent: true,
    last_privacy_version_accepted: { not: null },
  }

  if (campaign.targetType === 'ALL') {
    return await prisma.customers.findMany({
      where: baseWhere,
      select: {
        id: true,
        name: true,
        phone: true,
        language: true,
      },
    })
  } else {
    // SELECTED - only specific customers
    return await prisma.customers.findMany({
      where: {
        ...baseWhere,
        id: { in: campaign.customerIds || [] },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        language: true,
      },
    })
  }
}

/**
 * Check if message was already sent to customer for this campaign
 */
async function checkAlreadySent(campaignId: string, customerId: string): Promise<boolean> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const existing = await prisma.campaignSent.findFirst({
    where: {
      campaignId,
      customerId,
      sentAt: { gte: today },
    },
  })

  return !!existing
}

/**
 * Queue campaign message to WhatsApp Queue
 * 🌍 AI Translation: Message is automatically translated to customer's language
 */
async function queueCampaignMessage(campaign: any, customer: any): Promise<void> {
  // Process message - replace {{nome}} with customer name
  let message = campaign.messagePreview
  message = message.replace(/\{\{nome\}\}/gi, customer.name || 'Cliente')

  // 🌍 AI Translation: Translate to customer's preferred language
  const customerLanguage = customer.language || 'IT'
  const translatedMessage = await translationService.translateMessage(message, customerLanguage)

  logger.info(`[CAMPAIGN] 🌍 Message translated to ${customerLanguage} for ${customer.name}`)

  // Add to WhatsApp Queue with translated message
  await prisma.whatsAppQueue.create({
    data: {
      workspaceId: campaign.workspaceId,
      customerId: customer.id,
      phoneNumber: customer.phone,
      messageContent: translatedMessage,
      status: 'pending',
    },
  })

  // Track in CampaignSent
  await prisma.campaignSent.create({
    data: {
      campaignId: campaign.id,
      customerId: customer.id,
      workspaceId: campaign.workspaceId,
    },
  })

  logger.info(`[CAMPAIGN] ✅ Queued message for ${customer.name} (${customer.phone}) in ${customerLanguage}`)
}

/**
 * Get number of days based on campaign frequency
 */
function getFrequencyDays(frequency: CampaignFrequency): number {
  const map: Record<CampaignFrequency, number> = {
    ONCE: 999999,
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
function getDaysSince(date: Date): number {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}
