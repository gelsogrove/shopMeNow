/**
 * WhatsApp queue processor — the delivery loop for queued messages.
 *
 * Push campaigns (apps/scheduler push-campaigns.job) enqueue into
 * WhatsAppQueue with status 'pending', but since the old 5-second scheduler
 * job was removed (2026-05-18) nothing delivered them: messages were billed,
 * recipients marked SENT, and the queue rows sat 'pending' forever.
 *
 * This interval runs inside the always-on backend dyno (no extra scheduler
 * dyno needed) and drains the queue via
 * WhatsAppQueueService.processAllPendingWorkspaces(), which only processes
 * workspaces where WhatsApp is ACTIVE and a provider is configured
 * (Andrea 2026-08-06). Chat replies are NOT affected — they stay synchronous
 * via WhatsAppDirectSendService.
 */
import { PrismaClient } from "@echatbot/database"
import logger from "../utils/logger"
import { WhatsAppQueueService } from "./whatsapp-queue.service"

const PROCESS_INTERVAL_MS = 60_000

export function startWhatsAppQueueProcessor(prisma: PrismaClient): NodeJS.Timeout {
  const service = new WhatsAppQueueService(prisma)
  let running = false

  const timer = setInterval(async () => {
    // A slow provider can make one cycle outlast the interval — skip
    // overlapping runs instead of processing the same messages twice.
    if (running) return
    running = true
    try {
      await service.processAllPendingWorkspaces()
    } catch (error) {
      logger.error("[WhatsAppQueueProcessor] cycle failed:", error)
    } finally {
      running = false
    }
  }, PROCESS_INTERVAL_MS)

  // Never keep the process alive just for this loop (clean test/shutdown exit).
  timer.unref()

  logger.info(
    `[WhatsAppQueueProcessor] started — draining WhatsApp queue every ${PROCESS_INTERVAL_MS / 1000}s`
  )
  return timer
}
