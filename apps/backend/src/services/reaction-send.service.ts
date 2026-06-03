/**
 * Reaction send service (operator → customer)
 *
 * Sends a WhatsApp reaction (emoji) onto a specific customer message, via the
 * workspace's configured provider. Thin, single-responsibility service: it
 * resolves the provider and delegates to `provider.sendReaction`. Persistence
 * and HTTP concerns stay in the controller (layered architecture).
 *
 * - Workspace-isolated (rule #2): the workspace is loaded by id and the provider
 *   is built from ITS credentials only.
 * - Graceful: providers that don't implement reactions (e.g. UltraMsg) return a
 *   clear `unsupported` result instead of throwing.
 * - Never throws: every path returns a result object.
 */

import { PrismaClient } from "@echatbot/database"
import logger from "../utils/logger"
import { WhatsAppProviderFactory } from "./whatsapp/whatsapp-provider.factory"

export interface SendOperatorReactionInput {
  workspaceId: string
  /** Customer phone in E.164 (the reaction recipient). */
  phoneNumber: string
  /** Provider id of the message being reacted to (its stored whatsappMessageId). */
  whatsappMessageId: string
  /** Emoji to apply; empty string removes a previous reaction. */
  emoji: string
}

export interface SendOperatorReactionResult {
  ok: boolean
  /** True when the active provider has no reaction capability. */
  unsupported?: boolean
  providerMessageId?: string
  error?: string
}

export async function sendOperatorReaction(
  prisma: PrismaClient,
  input: SendOperatorReactionInput
): Promise<SendOperatorReactionResult> {
  const { workspaceId, phoneNumber, whatsappMessageId, emoji } = input
  try {
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } })
    if (!workspace) return { ok: false, error: "workspace_not_found" }
    if (!WhatsAppProviderFactory.isConfigured(workspace)) {
      return { ok: false, error: "provider_not_configured" }
    }

    const provider = WhatsAppProviderFactory.create(workspace)
    if (typeof provider.sendReaction !== "function") {
      logger.info("[reaction-send] provider has no reaction support", {
        workspaceId,
        provider: provider.getProviderName(),
      })
      return { ok: false, unsupported: true, error: "provider_does_not_support_reactions" }
    }

    const result = await provider.sendReaction(phoneNumber, whatsappMessageId, emoji)
    if (!result.success) {
      return { ok: false, error: result.error || "send_failed" }
    }

    logger.info("[reaction-send] reaction sent", { workspaceId, emoji, whatsappMessageId })
    return { ok: true, providerMessageId: result.messageId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error("[reaction-send] unexpected failure", { workspaceId, error: msg })
    return { ok: false, error: msg }
  }
}
