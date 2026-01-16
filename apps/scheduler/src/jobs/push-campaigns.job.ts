import { prisma, Prisma } from '../config/database'
import logger from '../utils/logger'

/**
 * Push Campaigns job (WhatsApp only).
 * Picks campaigns with status SCHEDULED and sendAt <= now,
 * enqueues messages into whatsapp_queue, and updates recipient statuses.
 *
 * NOTE: throttle/rate-limit will be handled by the whatsapp-channel-queue job;
 * here we just enqueue and update states. BatchSize limits how many recipients
 * are processed per loop to avoid long locks.
 */
export async function pushCampaignsJob(): Promise<void> {
  const now = new Date()
  const campaigns = await prisma.pushCampaign.findMany({
    where: {
      status: 'SCHEDULED',
      OR: [{ sendAt: null }, { sendAt: { lte: now } }],
    },
    orderBy: { createdAt: 'asc' },
  })

  if (campaigns.length === 0) return

  logger.info(`[PUSH-CAMPAIGN] Found ${campaigns.length} scheduled campaigns`)

  for (const campaign of campaigns) {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: campaign.workspaceId },
        select: { ownerId: true },
      })
      if (!workspace?.ownerId) {
        await prisma.pushCampaign.update({
          where: { id: campaign.id },
          data: { status: 'FAILED', lastError: 'Workspace owner not found' },
        })
        continue
      }

      await prisma.pushCampaign.update({
        where: { id: campaign.id },
        data: { status: 'RUNNING', lastError: null },
      })

      const batchSize = campaign.batchSize || 50
      const throttlePerSecond = campaign.throttlePerSecond || 10
      const perRunLimit = Math.max(1, Math.min(batchSize, throttlePerSecond))

      const recipients = await prisma.pushCampaignRecipient.findMany({
        where: {
          campaignId: campaign.id,
          status: 'PENDING',
        },
        orderBy: { createdAt: 'asc' },
        take: perRunLimit,
      })

      let processed = 0
      let creditExhausted = false

      for (const recipient of recipients) {
        if (creditExhausted) break
        try {
          if (!recipient.customerId) {
            await prisma.pushCampaignRecipient.update({
              where: { id: recipient.id },
              data: {
                status: 'SKIPPED',
                errorCode: 'NO_CUSTOMER',
                errorMessage: 'Recipient has no customerId (unsupported)',
              },
            })
            continue
          }

          // Credit check (owner-level)
          const owner = await prisma.user.findUnique({
            where: { id: workspace.ownerId },
            select: { creditBalance: true },
          })
          if (!owner || owner.creditBalance.lt(campaign.costPerMessage)) {
            creditExhausted = true
            break
          }

          if (!recipient.phone) {
            await prisma.pushCampaignRecipient.update({
              where: { id: recipient.id },
              data: {
                status: 'SKIPPED',
                errorCode: 'NO_PHONE',
                errorMessage: 'Missing phone',
              },
            })
            continue
          }

          const messageContent =
            campaign.bodyPreview || 'Campaign message (no preview provided)'

          await prisma.$transaction(async (tx) => {
            // Debit credit
            await tx.user.update({
              where: { id: workspace.ownerId },
              data: {
                creditBalance: {
                  decrement: campaign.costPerMessage,
                },
              },
            })

            const queue = await tx.whatsAppQueue.create({
              data: {
                workspaceId: campaign.workspaceId,
                customerId: recipient.customerId!,
                phoneNumber: recipient.phone,
                messageContent,
                status: 'pending',
                channel: 'whatsapp',
              },
            })

            await tx.pushCampaignRecipient.update({
              where: { id: recipient.id },
              data: {
                status: 'SENT',
                sentAt: new Date(),
                messageId: queue.id,
                priceCharged: campaign.costPerMessage,
              },
            })
          })

          processed++
        } catch (error) {
          logger.error(
            `[PUSH-CAMPAIGN] Error sending to recipient ${recipient.id}:`,
            error
          )
          await prisma.pushCampaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'FAILED',
              errorCode: 'SEND_ERROR',
              errorMessage: (error as Error).message,
            },
          })
        }
      }

      if (creditExhausted) {
        await prisma.pushCampaign.update({
          where: { id: campaign.id },
          data: {
            status: 'PAUSED',
            lastError: 'Insufficient credit',
          },
        })
        logger.warn(
          `[PUSH-CAMPAIGN] Campaign ${campaign.id} paused due to insufficient credit`
        )
        continue
      }

      // If there are still pending recipients, keep RUNNING
      const pendingCount = await prisma.pushCampaignRecipient.count({
        where: { campaignId: campaign.id, status: 'PENDING' },
      })

      if (pendingCount > 0) {
        logger.info(
          `[PUSH-CAMPAIGN] Campaign ${campaign.id} processed ${processed} recipients this run. Pending=${pendingCount}`
        )
        continue
      }

      // Update counters and close campaign
      const counts = await prisma.pushCampaignRecipient.groupBy({
        by: ['status'],
        where: { campaignId: campaign.id },
        _count: { _all: true },
      })
      const actualSent = counts.find((c) => c.status === 'SENT')?._count._all || 0
      const actualFailed = counts.find((c) => c.status === 'FAILED')?._count._all || 0
      const actualSkipped = counts.find((c) => c.status === 'SKIPPED')?._count._all || 0

      await prisma.pushCampaign.update({
        where: { id: campaign.id },
        data: {
          actualSent,
          actualFailed,
          actualSkipped,
          status: 'COMPLETED',
        },
      })

      logger.info(
        `[PUSH-CAMPAIGN] Campaign ${campaign.id} completed. Sent=${actualSent} failed=${actualFailed} skipped=${actualSkipped}`
      )
    } catch (error) {
      logger.error(`[PUSH-CAMPAIGN] Campaign ${campaign.id} failed:`, error)
      await prisma.pushCampaign.update({
        where: { id: campaign.id },
        data: {
          status: 'FAILED',
          lastError: (error as Error).message,
        },
      })
    }
  }
}
