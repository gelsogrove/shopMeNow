import {
  prisma,
  Prisma,
  CampaignFrequency,
  CampaignTargetType,
  PushCampaignStatus,
} from '../config/database'
import logger from '../utils/logger'
import { translationService } from '../services/translation.service'

/**
 * Push Campaigns job (WhatsApp only).
 * Picks campaigns with status SCHEDULED and sendAt/nextRunAt <= now,
 * enqueues messages into whatsapp_queue, and updates recipient statuses.
 */
export async function pushCampaignsJob(): Promise<void> {
  const now = new Date()
  const campaigns = await prisma.pushCampaign.findMany({
    where: {
      status: PushCampaignStatus.SCHEDULED,
      isActive: true,
      OR: [
        { sendAt: { lte: now }, lastRunAt: null },
        { nextRunAt: { lte: now } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  })

  if (campaigns.length === 0) return

  logger.info(`[PUSH-CAMPAIGN] Found ${campaigns.length} scheduled campaigns`)

  for (const campaign of campaigns) {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: campaign.workspaceId },
        select: { ownerId: true, name: true, enableWhatsapp: true },
      })

      if (!workspace?.enableWhatsapp) {
        await prisma.pushCampaign.update({
          where: { id: campaign.id },
          data: { status: 'FAILED', lastError: 'WhatsApp not enabled for workspace' },
        })
        continue
      }

      if (!workspace?.ownerId) {
        await prisma.pushCampaign.update({
          where: { id: campaign.id },
          data: { status: 'FAILED', lastError: 'Workspace owner not found' },
        })
        continue
      }

      // Ensure we have recipients for this run
      {
        const pendingCount = await prisma.pushCampaignRecipient.count({
          where: { campaignId: campaign.id, status: 'PENDING' },
        })

        if (pendingCount === 0) {
          // If no pending, it means either we just started a run or we finished.
          // For dynamic targeting, we always repopulate.
          // For manual, we repopulate if this is a new run (lastRunAt updated recently).
          await populateRecipientsForRun(campaign)
        }
      }

      await prisma.pushCampaign.update({
        where: { id: campaign.id },
        data: {
          status: 'RUNNING',
          lastError: null,
          lastRunAt: new Date(),
        },
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
          // Load customer for variables, language, consent
          const customer = await prisma.customers.findFirst({
            where: {
              id: recipient.customerId || undefined,
              phone: !recipient.customerId ? recipient.phone : undefined,
              workspaceId: campaign.workspaceId,
            },
            select: {
              id: true,
              name: true,
              email: true,
              company: true,
              phone: true,
              language: true,
              isBlacklisted: true,
              isActive: true,
            },
          })

          if (!customer) {
            await prisma.pushCampaignRecipient.update({
              where: { id: recipient.id },
              data: {
                status: 'SKIPPED',
                errorCode: 'NO_CUSTOMER',
                errorMessage: 'Customer not found or inactive',
              },
            })
            continue
          }

          if (customer.isBlacklisted || !customer.isActive) {
            await prisma.pushCampaignRecipient.update({
              where: { id: recipient.id },
              data: {
                status: 'SKIPPED',
                errorCode: customer.isBlacklisted ? 'BLACKLISTED' : 'INACTIVE',
                errorMessage: `Customer is ${customer.isBlacklisted ? 'blacklisted' : 'inactive'}`,
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

          const phone = recipient.phone || customer.phone
          if (!phone) {
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

          // Build message with variable replacement + translation
          const messageContent = await buildMessageContent({
            campaign,
            customer,
            workspaceName: workspace.name || 'eChatbot',
          })

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
                customerId: customer.id,
                phoneNumber: phone,
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

      // Check if finished this run
      const stillPending = await prisma.pushCampaignRecipient.count({
        where: { campaignId: campaign.id, status: 'PENDING' },
      })

      if (stillPending > 0) {
        await prisma.pushCampaign.update({
          where: { id: campaign.id },
          data: { status: PushCampaignStatus.SCHEDULED },
        })
        continue
      }

      // Finish this run
      const nextRunAt = calculateNextRunAt(campaign.frequency, new Date())
      const finalStatus =
        nextRunAt ? PushCampaignStatus.SCHEDULED : PushCampaignStatus.COMPLETED

      await prisma.pushCampaign.update({
        where: { id: campaign.id },
        data: {
          status: finalStatus,
          nextRunAt,
          actualSent: { increment: processed },
        },
      })

      logger.info(
        `[PUSH-CAMPAIGN] Campaign ${campaign.id} run done. Next run: ${nextRunAt}`
      )
    } catch (error) {
      logger.error(`[PUSH-CAMPAIGN] Campaign ${campaign.id} error:`, error)
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

async function populateRecipientsForRun(campaign: any) {
  let targetCustomerIds: string[] = []

  if (campaign.targetingType === CampaignTargetType.ALL) {
    const customers = await prisma.customers.findMany({
      where: {
        workspaceId: campaign.workspaceId,
        isActive: true,
        activeChatbot: true,
        isBlacklisted: false,
        deletedAt: null,
      },
      select: { id: true },
    })
    targetCustomerIds = customers.map((c) => c.id)
  } else if (campaign.targetingType === CampaignTargetType.TAGS && campaign.tagId) {
    const customers = await prisma.customers.findMany({
      where: {
        workspaceId: campaign.workspaceId,
        tags: { has: campaign.tagId },
        isActive: true,
        activeChatbot: true,
        isBlacklisted: false,
        deletedAt: null,
      },
      select: { id: true },
    })
    targetCustomerIds = customers.map((c) => c.id)
  } else if (campaign.targetingType === CampaignTargetType.MANUAL) {
    targetCustomerIds = campaign.targetCustomerIds || []
  }

  if (targetCustomerIds.length > 0) {
    const customers = await prisma.customers.findMany({
      where: {
        id: { in: targetCustomerIds },
        workspaceId: campaign.workspaceId,
        isActive: true,
        activeChatbot: true,
        isBlacklisted: false,
        deletedAt: null,
      },
      select: { id: true, phone: true },
    })

    if (customers.length > 0) {
      await prisma.pushCampaignRecipient.createMany({
        data: customers.map((c) => ({
          workspaceId: campaign.workspaceId,
          campaignId: campaign.id,
          customerId: c.id,
          phone: c.phone || '',
          status: 'PENDING',
        })),
      })
    }
  }
}

function calculateNextRunAt(
  frequency: CampaignFrequency,
  lastRun: Date = new Date()
): Date | null {
  if (frequency === CampaignFrequency.ONCE) return null
  const next = new Date(lastRun)
  switch (frequency) {
    case CampaignFrequency.WEEKLY:
      next.setDate(next.getDate() + 7)
      break
    case CampaignFrequency.MONTHLY:
      next.setMonth(next.getMonth() + 1)
      break
    case CampaignFrequency.QUARTERLY:
      next.setMonth(next.getMonth() + 3)
      break
    case CampaignFrequency.SEMIANNUAL:
      next.setMonth(next.getMonth() + 6)
      break
    default:
      return null
  }
  return next
}

async function buildMessageContent({
  campaign,
  customer,
  workspaceName,
}: {
  campaign: any
  customer: any
  workspaceName: string
}): Promise<string> {
  const template = campaign.message || campaign.bodyPreview || 'Campaign message'
  const name = customer.name || ''
  const [firstName, ...rest] = name.split(' ')
  const lastName = rest.join(' ').trim()

  const replacements: Record<string, string> = {
    name: name || 'Customer',
    firstName: firstName || name || 'Customer',
    lastName: lastName || '',
    email: customer.email || '',
    phone: customer.phone || '',
    company: customer.company || '',
    workspace: workspaceName || 'eChatbot',
  }

  const message = template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const k = String(key || '').trim()
    return replacements[k] !== undefined && replacements[k] !== null
      ? replacements[k]
      : `{{${k}}}`
  })

  // Translate to customer's preferred language (best-effort)
  const targetLanguage = normalizeLanguage(customer.language)
  try {
    const translated = await translationService.translateMessage(
      message,
      targetLanguage
    )
    return translated || message
  } catch (error) {
    logger.error('[PUSH-CAMPAIGN] Translation failed, using original', error)
    return message
  }
}

function normalizeLanguage(lang?: string | null): string {
  if (!lang) return 'it'
  const l = lang.toLowerCase()
  if (l.startsWith('en')) return 'en'
  if (l.startsWith('es')) return 'es'
  if (l.startsWith('pt')) return 'pt'
  return 'it'
}

// Export helpers for unit testing
export const __test = {
  buildMessageContent,
  normalizeLanguage,
  populateRecipientsForRun,
  calculateNextRunAt,
}
