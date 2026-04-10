import { prisma } from '../config/database'
import logger from '../utils/logger'

/**
 * WhatsApp Webhook Events Cleanup Job
 * Runs daily at 23:40
 * 
 * Deletes WhatsappWebhookEvent records older than 30 days in batches.
 * These are used only for webhook deduplication (preventing double-processing
 * of the same WhatsApp message). After 30 days the risk of receiving a
 * duplicate webhook is zero.
 * 
 * Batch approach: deletes BATCH_SIZE records per cycle.
 */

const RETENTION_DAYS = 30
const BATCH_SIZE = 1000

export async function webhookEventsCleanupJob(): Promise<void> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS)

  logger.info(`🧹 [WEBHOOK-EVENTS-CLEANUP] Starting (deleting before ${cutoffDate.toISOString()})`)

  let totalDeleted = 0
  let hasMore = true

  while (hasMore) {
    const oldEvents = await prisma.whatsappWebhookEvent.findMany({
      where: {
        receivedAt: { lt: cutoffDate },
      },
      select: { id: true },
      take: BATCH_SIZE,
    })

    if (oldEvents.length === 0) {
      hasMore = false
      break
    }

    const result = await prisma.whatsappWebhookEvent.deleteMany({
      where: {
        id: { in: oldEvents.map((e) => e.id) },
      },
    })

    totalDeleted += result.count

    logger.info(`🧹 [WEBHOOK-EVENTS-CLEANUP] Deleted batch: ${result.count} (total: ${totalDeleted})`)

    if (oldEvents.length < BATCH_SIZE) {
      hasMore = false
    }
  }

  if (totalDeleted > 0) {
    logger.info(`✅ [WEBHOOK-EVENTS-CLEANUP] Completed: ${totalDeleted} events deleted (older than ${RETENTION_DAYS} days)`)
  } else {
    logger.info(`✅ [WEBHOOK-EVENTS-CLEANUP] No events to delete (all newer than ${RETENTION_DAYS} days)`)
  }
}
