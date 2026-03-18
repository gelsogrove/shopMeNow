import {
  prisma,
  Prisma,
  CampaignFrequency,
  CampaignTargetType,
  PushCampaignStatus,
  PushCampaignRecipientStatus,
} from '../config/database'
import logger from '../utils/logger'
import { translationService } from '../services/translation.service'
import { BillingService } from '../services/billing.service'

// Initialize billing service for credit deduction
const billingService = new BillingService()

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
        select: { ownerId: true, name: true, enableWhatsapp: true, defaultLanguage: true },
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
      let noEligibleRecipientsWarning: string | undefined
      {
        const pendingCount = await prisma.pushCampaignRecipient.count({
          where: { campaignId: campaign.id, status: 'PENDING' },
        })

        if (pendingCount === 0) {
          // If no pending, it means either we just started a run or we finished.
          // For dynamic targeting, we always repopulate.
          // For manual, we repopulate if this is a new run (lastRunAt updated recently).
          await populateRecipientsForRun(campaign)

          // Re-check: if STILL 0 PENDING after populate, recipients likely lack push_notifications_consent
          const recheckCount = await prisma.pushCampaignRecipient.count({
            where: { campaignId: campaign.id, status: 'PENDING' },
          })

          if (recheckCount === 0) {
            const skippedCount = await prisma.pushCampaignRecipient.count({
              where: { campaignId: campaign.id, status: 'SKIPPED' },
            })
            noEligibleRecipientsWarning = `No eligible recipients found (${skippedCount} skipped). Verify push_notifications_consent is enabled for target customers.`
            logger.warn(`[PUSH-CAMPAIGN] Campaign ${campaign.id}: ${noEligibleRecipientsWarning}`)

            // ONCE campaigns with 0 eligible recipients → FAILED immediately (will never succeed without re-activation)
            if (campaign.frequency === CampaignFrequency.ONCE) {
              await prisma.pushCampaign.update({
                where: { id: campaign.id },
                data: {
                  status: 'FAILED',
                  isActive: false,
                  lastError: noEligibleRecipientsWarning,
                },
              })
              continue
            }
          }
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
      const costPerMessage = Number(campaign.costPerMessage)
      let availableBalance = 0

      // 💰 CREDIT_MIN_THRESHOLD: Hard cutoff at -$10 (same as backend)
      const CREDIT_MIN_THRESHOLD = -10

      if (recipients.length > 0) {
        const owner = await prisma.user.findUnique({
          where: { id: workspace.ownerId },
          select: { creditBalance: true },
        })
        if (!owner) {
          throw new Error('Owner not found for credit check')
        }
        availableBalance = Number(owner.creditBalance)

        // Upfront hard cutoff: skip entire campaign if below -$10
        if (availableBalance < CREDIT_MIN_THRESHOLD) {
          logger.warn(`[PUSH-CAMPAIGN] Credit exhausted for campaign ${campaign.id} (balance: ${availableBalance})`)
          await prisma.pushCampaign.update({
            where: { id: campaign.id },
            data: {
              status: 'PAUSED',
              lastError: `Credit exhausted (balance: $${availableBalance.toFixed(2)}, threshold: $${CREDIT_MIN_THRESHOLD})`,
            },
          })
          continue
        }
      }

      for (const recipient of recipients) {
        if (creditExhausted) break

        try {
          // Load customer for variables, language, consent
          const customer = await prisma.customers.findFirst({
            where: {
              id: recipient.customerId || undefined,
              phone: !recipient.customerId ? recipient.phone : undefined,
              workspaceId: campaign.workspaceId,
              deletedAt: null, // Skip soft-deleted customers at send time
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
              push_notifications_consent: true,
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

          if (customer.push_notifications_consent !== true) {
            noEligibleRecipientsWarning =
              noEligibleRecipientsWarning ||
              'No eligible recipients: push_notifications_consent is false for all targeted customers.'
            await prisma.pushCampaignRecipient.update({
              where: { id: recipient.id },
              data: {
                status: 'SKIPPED',
                errorCode: 'NO_PUSH_CONSENT',
                errorMessage: 'Customer has not given push_notifications_consent',
              },
            })
            continue
          }

          // Credit check (owner-level, in-memory)
          if (availableBalance < costPerMessage) {
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
            workspaceLanguage: workspace.defaultLanguage || 'en',
          })

          await prisma.$transaction(async (tx) => {
            // Find or create conversationId for this customer
            let conversationId = `conv_${customer.id}`
            const lastConversation = await tx.conversationMessage.findFirst({
              where: { workspaceId: campaign.workspaceId, customerId: customer.id },
              orderBy: { createdAt: 'desc' },
              select: { conversationId: true },
            })
            if (lastConversation?.conversationId) {
              conversationId = lastConversation.conversationId
            }

            const conversationMessage = await tx.conversationMessage.create({
              data: {
                workspaceId: campaign.workspaceId,
                customerId: customer.id,
                conversationId,
                role: 'assistant',
                content: messageContent,
                agentType: 'PUSH_CAMPAIGN',
                functionName: 'push-campaign',
                functionArguments: {
                  campaignId: campaign.id,
                  recipientId: recipient.id,
                },
                deliveryStatus: 'pending',
                debugInfo: JSON.stringify({
                  source: 'push-campaign',
                  frequency: campaign.frequency,
                }),
              },
            })

            const queue = await tx.whatsAppQueue.upsert({
              where: {
                pushCampaignRecipientId: recipient.id,
              },
              update: {
                workspaceId: campaign.workspaceId,
                customerId: customer.id,
                phoneNumber: phone,
                messageContent,
                status: 'pending',
                channel: 'whatsapp',
                conversationMessageId: conversationMessage.id,
                pushCampaignId: campaign.id,
              },
              create: {
                workspaceId: campaign.workspaceId,
                customerId: customer.id,
                phoneNumber: phone,
                messageContent,
                status: 'pending',
                channel: 'whatsapp',
                conversationMessageId: conversationMessage.id,
                pushCampaignId: campaign.id,
                pushCampaignRecipientId: recipient.id,
              },
            })

            await tx.pushCampaignRecipient.update({
              where: { id: recipient.id },
              data: {
                status: 'SENT',
                messageId: queue.id,
              },
            })
          })

          // 💰 BILLING FIX: Deduct push credit from owner (Feature 198)
          const billingResult = await billingService.deductOwnerPushCredit(
            workspace.ownerId,
            campaign.workspaceId,
            campaign.id
          )

          if (!billingResult.success) {
            logger.error(`[PUSH-CAMPAIGN] Failed to deduct credit for recipient ${recipient.id}: ${billingResult.error}`)
            // Mark campaign as paused if billing fails (prevent infinite free messages)
            creditExhausted = true
            await prisma.pushCampaign.update({
              where: { id: campaign.id },
              data: {
                status: 'PAUSED',
                lastError: `Billing error: ${billingResult.error}`,
              },
            })
            break
          }

          // Update in-memory balance from actual DB value (billing service updates DB atomically)
          availableBalance = billingResult.newBalance
          processed++
          
          // Check if credit exhausted after deduction
          if (availableBalance < CREDIT_MIN_THRESHOLD) {
            logger.warn(`[PUSH-CAMPAIGN] Credit exhausted during batch (balance: ${availableBalance})`)
            creditExhausted = true
            break
          }
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
      // If nothing was sent in this run and there was a consent/eligibility warning, FAIL ONCE campaigns
      if (processed === 0 && noEligibleRecipientsWarning && campaign.frequency === CampaignFrequency.ONCE) {
        await prisma.pushCampaign.update({
          where: { id: campaign.id },
          data: {
            status: 'FAILED',
            isActive: false,
            lastError: noEligibleRecipientsWarning,
          },
        })
        continue
      }

      const { nextRunAt, finalStatus, shouldDeactivate } =
        computeCompletionUpdate(campaign, new Date())

      await prisma.pushCampaign.update({
        where: { id: campaign.id },
        data: {
          status: finalStatus,
          nextRunAt,
          actualSent: { increment: processed },
          ...(shouldDeactivate ? { isActive: false } : {}),
          // Persist warning for visibility in the UI when no eligible recipients were found
          ...(noEligibleRecipientsWarning ? { lastError: noEligibleRecipientsWarning } : {}),
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
  return prisma.$transaction(async (tx) => {
    let targetCustomerIds: string[] = []

    if (campaign.targetingType === CampaignTargetType.ALL) {
      const customers = await tx.customers.findMany({
        where: {
          workspaceId: campaign.workspaceId,
          isActive: true,
          activeChatbot: true,
          isBlacklisted: false,
          deletedAt: null,
          push_notifications_consent: true, // ✅ Only customers who consented to push
        },
        select: { id: true },
      })
      targetCustomerIds = customers.map((c) => c.id)
    } else if (campaign.targetingType === CampaignTargetType.TAGS && campaign.tagId) {
      const customers = await tx.customers.findMany({
        where: {
          workspaceId: campaign.workspaceId,
          tags: { has: campaign.tagId },
          isActive: true,
          activeChatbot: true,
          isBlacklisted: false,
          deletedAt: null,
          push_notifications_consent: true, // ✅ Only customers who consented to push
        },
        select: { id: true },
      })
      targetCustomerIds = customers.map((c) => c.id)
    } else if (campaign.targetingType === CampaignTargetType.MANUAL) {
      targetCustomerIds = campaign.targetCustomerIds || []
    }

    if (targetCustomerIds.length === 0) {
      return
    }

    // Fetch eligible customers (consent, active, not blacklisted)
    const customers = await tx.customers.findMany({
      where: {
        id: { in: targetCustomerIds },
        workspaceId: campaign.workspaceId,
        isActive: true,
        activeChatbot: true,
        isBlacklisted: false,
        push_notifications_consent: true,
        deletedAt: null,
      },
      select: { id: true, phone: true },
    })

    if (customers.length === 0) {
      logger.warn(`[PUSH-CAMPAIGN] populateRecipientsForRun: no customers with push_notifications_consent=true found for campaign ${campaign.id} (targeting: ${campaign.targetingType})`)
      return
    }

    const eligibleIds = new Set(customers.map((c) => c.id))

    // Load existing recipients to avoid duplicates across runs
    const existing = await tx.pushCampaignRecipient.findMany({
      where: { campaignId: campaign.id },
      select: { id: true, customerId: true },
    })

    const existingMap = new Map(existing.map((r) => [r.customerId, r.id]))

    // Reset existing recipients to PENDING for this run (if still targeted)
    const resetIds = existing
      .filter((r) => eligibleIds.has(r.customerId))
      .map((r) => r.id)

    if (resetIds.length > 0) {
      await tx.pushCampaignRecipient.updateMany({
        where: { id: { in: resetIds } },
        data: {
          status: PushCampaignRecipientStatus.PENDING,
          errorCode: null,
          errorMessage: null,
          messageId: null,
        },
      })
    }

    // Mark non-eligible existing recipients as SKIPPED to prevent reuse
    const removedIds = existing
      .filter((r) => !eligibleIds.has(r.customerId))
      .map((r) => r.id)
    if (removedIds.length > 0) {
      await tx.pushCampaignRecipient.updateMany({
        where: { id: { in: removedIds } },
        data: {
          status: PushCampaignRecipientStatus.SKIPPED,
          errorCode: 'NOT_TARGET',
          errorMessage: 'Recipient no longer targeted',
          messageId: null,
        },
      })
    }

    // Create recipients that do not exist yet
    const newRecipients = customers
      .filter((c) => !existingMap.has(c.id))
      .map((c) => ({
        workspaceId: campaign.workspaceId,
        campaignId: campaign.id,
        customerId: c.id,
        phone: c.phone || '',
        status: PushCampaignRecipientStatus.PENDING,
      }))

    if (newRecipients.length > 0) {
      await tx.pushCampaignRecipient.createMany({ data: newRecipients })
    }
  })
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

function computeCompletionUpdate(campaign: any, now: Date) {
  const nextRunAt = calculateNextRunAt(campaign.frequency, now)
  const finalStatus = nextRunAt
    ? PushCampaignStatus.SCHEDULED
    : PushCampaignStatus.COMPLETED
  const shouldDeactivate = campaign.frequency === CampaignFrequency.ONCE
  return { nextRunAt, finalStatus, shouldDeactivate }
}

async function buildMessageContent({
  campaign,
  customer,
  workspaceName,
  workspaceLanguage,
}: {
  campaign: any
  customer: any
  workspaceName: string
  workspaceLanguage: string
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
  const targetLanguage = normalizeLanguage(customer.language, workspaceLanguage)
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

function normalizeLanguage(
  customerLang?: string | null,
  workspaceLang?: string | null
): string {
  const lang = (customerLang || workspaceLang || 'en').toLowerCase()
  if (lang.startsWith('it')) return 'it'
  if (lang.startsWith('en')) return 'en'
  if (lang.startsWith('es')) return 'es'
  if (lang.startsWith('pt')) return 'pt'
  if (lang.startsWith('fr')) return 'fr'
  return 'en'
}

// Export helpers for unit testing
export const __test = {
  buildMessageContent,
  normalizeLanguage,
  populateRecipientsForRun,
  calculateNextRunAt,
  computeCompletionUpdate,
}
