/**
 * WhatsAppRetentionService — periodic cleanup of WhatsApp bookkeeping tables
 *
 * Two tables grow forever without this job:
 * - whatsapp_webhook_events: inbound-webhook dedup guard. Providers retry
 *   within minutes/hours, so rows older than the retention window can never
 *   dedup anything again.
 * - whatsapp_queue: rows in a terminal status (sent/delivered/error/failed)
 *   are kept as history for a while, then purged. Anonymous widget rows
 *   whose expiresAt has passed are dead sessions and are purged regardless
 *   of status (this is the cleanup the schema's expiresAt index was made
 *   for and that never existed).
 *
 * Pending / non-expired rows are NEVER touched — a workspace whose channel
 * comes online later must still drain its queue.
 */

import { PrismaClient } from "@echatbot/database"
import logger from "../utils/logger"

// Retention windows (days). Same 30-day convention as the
// SearchConversation cleanup job in scheduler.ts.
export const WEBHOOK_EVENT_RETENTION_DAYS = 30
export const QUEUE_TERMINAL_RETENTION_DAYS = 30

const TERMINAL_STATUSES = ["sent", "delivered", "error", "failed"]

export interface RetentionResult {
  webhookEventsDeleted: number
  queueMessagesDeleted: number
}

export class WhatsAppRetentionService {
  constructor(private prisma: PrismaClient) {}

  async cleanup(): Promise<RetentionResult> {
    const now = new Date()
    const webhookCutoff = new Date(now.getTime() - WEBHOOK_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const queueCutoff = new Date(now.getTime() - QUEUE_TERMINAL_RETENTION_DAYS * 24 * 60 * 60 * 1000)

    const webhookEvents = await this.prisma.whatsappWebhookEvent.deleteMany({
      where: { receivedAt: { lt: webhookCutoff } },
    })

    const queueMessages = await this.prisma.whatsAppQueue.deleteMany({
      where: {
        OR: [
          // Terminal statuses past the history window
          { status: { in: TERMINAL_STATUSES }, createdAt: { lt: queueCutoff } },
          // Dead anonymous widget sessions (expiresAt is only set for those)
          { expiresAt: { not: null, lt: now } },
        ],
      },
    })

    if (webhookEvents.count > 0 || queueMessages.count > 0) {
      logger.info("[WhatsAppRetention] Cleanup completed", {
        webhookEventsDeleted: webhookEvents.count,
        queueMessagesDeleted: queueMessages.count,
      })
    }

    return {
      webhookEventsDeleted: webhookEvents.count,
      queueMessagesDeleted: queueMessages.count,
    }
  }
}
