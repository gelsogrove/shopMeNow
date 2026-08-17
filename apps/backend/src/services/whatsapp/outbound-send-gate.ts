/**
 * Outbound send gate — the single deterministic pre-send validator for every
 * WhatsApp provider call (direct send AND queue).
 *
 * Guarantees, in one place instead of per-caller conventions:
 *   1. The customer exists AND belongs to the workspace (no cross-workspace
 *      sends via a mixed-up customerId).
 *   2. The customer is not blacklisted (contract rule 25) — closes the
 *      "blacklisted after enqueue" hole: a queued campaign message for a
 *      customer blacklisted later is stopped here, at send time.
 *   3. The workspace exists, is not soft-deleted, and its channel is active
 *      (contract rule 26: channel off → nothing goes out).
 *
 * Deliberately NOT validated here: the destination phone number. Operator
 * relays legitimately send to the OPERATOR's phone while carrying the
 * customer's id for context, so destination ↔ customer equality is not an
 * invariant of this platform.
 *
 * Fail-closed: any lookup error denies the send. A security gate that fails
 * open is not a gate (same policy as hard-rate-limit.middleware.ts).
 */
import { PrismaClient } from "@echatbot/database"
import logger from "../../utils/logger"

export type OutboundGateReason =
  | "WORKSPACE_NOT_FOUND"
  | "WORKSPACE_DELETED"
  | "CHANNEL_DISABLED"
  | "CUSTOMER_NOT_IN_WORKSPACE"
  | "CUSTOMER_BLACKLISTED"
  | "GATE_CHECK_FAILED"

export interface OutboundGateVerdict {
  allowed: boolean
  reason?: OutboundGateReason
}

export async function checkOutboundSendGate(
  prisma: PrismaClient,
  params: { workspaceId: string; customerId: string }
): Promise<OutboundGateVerdict> {
  const { workspaceId, customerId } = params

  try {
    const [workspace, customer] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { deletedAt: true, channelStatus: true },
      }),
      prisma.customers.findFirst({
        where: { id: customerId, workspaceId },
        select: { isBlacklisted: true },
      }),
    ])

    let reason: OutboundGateReason | null = null
    if (!workspace) reason = "WORKSPACE_NOT_FOUND"
    else if (workspace.deletedAt) reason = "WORKSPACE_DELETED"
    else if (workspace.channelStatus === false) reason = "CHANNEL_DISABLED"
    else if (!customer) reason = "CUSTOMER_NOT_IN_WORKSPACE"
    else if (customer.isBlacklisted) reason = "CUSTOMER_BLACKLISTED"

    if (reason) {
      logger.warn("[OutboundSendGate] 🚫 Send denied", { workspaceId, customerId, reason })
      return { allowed: false, reason }
    }

    return { allowed: true }
  } catch (error) {
    logger.error("[OutboundSendGate] ❌ Gate check failed - denying send (fail-closed)", {
      workspaceId,
      customerId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { allowed: false, reason: "GATE_CHECK_FAILED" }
  }
}
