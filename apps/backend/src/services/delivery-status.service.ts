/**
 * Delivery-status updater (✓ sent → ✓✓ delivered → ✓✓ blue read)
 *
 * Shared sink for the provider status webhooks (Meta/UltraMsg/Wasender). Given a
 * PROVIDER message id and a target level, promotes the matching outbound
 * ConversationMessage forward along sent → delivered → read. The lookup keys off
 * the already-indexed `whatsappMessageId` column, which WhatsAppDirectSendService
 * persists on every outbound message.
 *
 * Properties:
 *   - workspace-isolated (filters by workspaceId)
 *   - forward-only & idempotent: only promotes to a higher level, never
 *     downgrades; a no-op for unknown ids or already-equal/higher states
 *   - never throws: a status webhook must never break the message path
 *   - on a real transition, broadcasts the existing `new-message` WS event so the
 *     operator UI re-fetches and the tick advances (✓ → ✓✓ → ✓✓ blue)
 */

import { PrismaClient } from "@echatbot/database"
import logger from "../utils/logger"
import { websocketService } from "./websocket.service"
import type { DeliveryLevel, StatusUpdate } from "./webhook-status.extract"

// Forward-only ordering of delivery states. Only states we promote FROM/TO.
const RANK: Record<string, number> = {
  sent: 1,
  delivered: 2,
  read: 3,
}

export interface ApplyStatusInput {
  workspaceId: string
  providerMessageId: string
  status: DeliveryLevel
}

/**
 * Promote a single outbound message to `status` by its provider message id.
 * Forward-only: a delivered/read event for a message already at that level (or
 * higher) is a no-op.
 * @returns true when the message actually advanced.
 */
export async function applyStatusUpdate(
  prisma: PrismaClient,
  { workspaceId, providerMessageId, status }: ApplyStatusInput
): Promise<boolean> {
  try {
    if (!workspaceId || !providerMessageId) return false

    const message = await prisma.conversationMessage.findFirst({
      where: { workspaceId, whatsappMessageId: providerMessageId },
      select: { id: true, conversationId: true, deliveryStatus: true },
    })

    // Unknown id (e.g. inbound message, or sent via a path that didn't store the
    // wamid). Only promote FROM a tracked outbound state (sent/delivered).
    if (!message) return false
    const currentRank = RANK[message.deliveryStatus || ""] || 0
    const nextRank = RANK[status]
    if (currentRank === 0 || nextRank <= currentRank) return false

    await prisma.conversationMessage.update({
      where: { id: message.id },
      data: {
        deliveryStatus: status,
        // deliveredAt marks the first time it reached delivered-or-beyond.
        ...(message.deliveryStatus === "sent" ? { deliveredAt: new Date() } : {}),
      },
    })

    logger.info(`[DeliveryStatus] ${status === "read" ? "✓✓ blue" : "✓✓"} message ${status}`, {
      workspaceId,
      conversationMessageId: message.id,
      providerMessageId,
    })

    // Reuse the existing new-message channel: the FE invalidates the
    // chat-messages query and re-fetches, picking up the new deliveryStatus.
    // sender "assistant" → no toast (toast only fires for customer messages).
    try {
      websocketService.notifyNewMessage(workspaceId, {
        id: message.id,
        sessionId: message.conversationId,
        sender: "assistant",
        deliveryStatus: status,
        timestamp: new Date().toISOString(),
        workspaceId,
      })
    } catch (wsError) {
      logger.warn("[DeliveryStatus] WS notify failed (non-critical)", {
        error: wsError instanceof Error ? wsError.message : String(wsError),
      })
    }

    return true
  } catch (error) {
    logger.error("[DeliveryStatus] Failed to apply status (non-critical)", {
      workspaceId,
      providerMessageId,
      status,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

/** Apply a batch of { providerMessageId, status } updates for a workspace. */
export async function applyManyStatusUpdates(
  prisma: PrismaClient,
  workspaceId: string,
  updates: StatusUpdate[]
): Promise<number> {
  let changed = 0
  for (const u of updates) {
    if (await applyStatusUpdate(prisma, { workspaceId, providerMessageId: u.providerMessageId, status: u.status })) {
      changed++
    }
  }
  return changed
}
