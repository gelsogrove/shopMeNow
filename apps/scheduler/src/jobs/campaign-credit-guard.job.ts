import { prisma } from '../config/database'
import logger from '../utils/logger'
import { BillingService } from '../services/billing.service'

/**
 * Campaign Credit Guard Job
 * 
 * Runs daily to deactivate legacy campaigns when credit/subscription is not sufficient.
 * We do not touch push campaigns here (handled with their own credit checks).
 */
export async function campaignCreditGuardJob(): Promise<void> {
  const billingService = new BillingService()
  const campaigns = await prisma.campaign.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      workspaceId: true,
    },
  })

  if (campaigns.length === 0) {
    logger.info('[CAMPAIGN-CREDIT] No active campaigns to check')
    return
  }

  let disabledCount = 0

  for (const campaign of campaigns) {
    try {
      const hasCredit = await billingService.hasOwnerCredit(campaign.workspaceId)
      if (!hasCredit) {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { isActive: false },
        })
        disabledCount++
        logger.warn(
          `[CAMPAIGN-CREDIT] Deactivated campaign ${campaign.name} (${campaign.id}) due to inactive subscription or insufficient credit`
        )
      }
    } catch (error) {
      logger.error(
        `[CAMPAIGN-CREDIT] Error checking campaign ${campaign.id}:`,
        error
      )
    }
  }

  logger.info(
    `[CAMPAIGN-CREDIT] Checked ${campaigns.length} campaigns. Disabled ${disabledCount} for insufficient funds/subscription.`
  )
}
