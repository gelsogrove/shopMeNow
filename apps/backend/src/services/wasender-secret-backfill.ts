/**
 * One-shot startup backfill of Wasender webhook secrets.
 *
 * Webhook signature verification (X-Webhook-Signature) only activates for a
 * workspace once its wasenderWebhookSecret is stored. New sessions save it at
 * init and the status sync backfills it lazily — but a legacy session whose
 * settings page nobody opens would stay on the weaker sessionId-only check
 * forever. This runs once at boot so every existing session gets upgraded to
 * signed webhooks without any manual action.
 *
 * Idempotent and fail-safe: only touches rows where the secret is missing,
 * and a WasenderAPI error just leaves the row for the next boot/sync.
 */

import { PrismaClient } from "@echatbot/database"
import logger from "../utils/logger"
import { WasenderClientService } from "./wasender-client.service"

export async function backfillWasenderWebhookSecrets(prisma: PrismaClient): Promise<void> {
  try {
    const pending = await prisma.workspace.findMany({
      where: {
        whatsappProvider: "wasender",
        wasenderSessionId: { not: null },
        wasenderWebhookSecret: null,
      },
      select: { id: true, wasenderSessionId: true },
    })
    if (pending.length === 0) return

    logger.info(`[WasenderBackfill] ${pending.length} workspace(s) missing webhook secret — backfilling`)
    const client = new WasenderClientService()

    for (const workspace of pending) {
      try {
        const details = await client.getSessionDetails(workspace.wasenderSessionId!)
        if (!details?.webhookSecret) {
          logger.warn("[WasenderBackfill] Session has no webhook secret on WasenderAPI — skipping", {
            workspaceId: workspace.id,
          })
          continue
        }
        await prisma.workspace.update({
          where: { id: workspace.id },
          data: { wasenderWebhookSecret: details.webhookSecret },
        })
        logger.info("[WasenderBackfill] Webhook secret backfilled", { workspaceId: workspace.id })
      } catch (error) {
        logger.warn("[WasenderBackfill] Failed for workspace (will retry on next boot/sync)", {
          workspaceId: workspace.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  } catch (error) {
    logger.error("[WasenderBackfill] Backfill scan failed:", error)
  }
}
