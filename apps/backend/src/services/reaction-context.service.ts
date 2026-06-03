/**
 * Reaction context
 *
 * A WhatsApp reaction (👍 on a message) carries the id of the message it reacted
 * to. Outbound messages we send store that id in `Message.whatsappMessageId`, so
 * we can look the original up and tell the LLM *what* the customer reacted to —
 * e.g. 👍 on "Confermi l'ordine da 30€?" → the model treats it as a confirmation
 * of THAT message, not just a bare emoji.
 *
 * DESIGN (CLAUDE.md rule #14 / #1): we do NOT translate or interpret the emoji in
 * code. We build a neutral, language-agnostic string (`👍 → "<original>"`) and the
 * LLM does the interpreting. The quoted text is the real stored message, in
 * whatever language it was sent.
 *
 * Workspace-isolated (rule #2): the lookup is scoped by workspaceId. Never throws.
 */

import { PrismaClient } from "@echatbot/database"
import { ExtractedReaction } from "./webhook-reaction.extract"

const MAX_QUOTED_CHARS = 160

/** Collapse whitespace + cap length so the injected quote stays small. */
export function truncateQuoted(text: string, max: number = MAX_QUOTED_CHARS): string {
  const normalized = text.trim().replace(/\s+/g, " ")
  if (normalized.length <= max) return normalized
  return normalized.slice(0, max - 1).trimEnd() + "…"
}

/**
 * Neutral text fed to the LLM for a reaction. Pure (no I/O). When the original
 * message isn't known, returns just the emoji (v1 behaviour).
 */
export function composeReactionText(emoji: string, originalText: string | null): string {
  if (!originalText || !originalText.trim()) return emoji
  return `${emoji} → "${truncateQuoted(originalText)}"`
}

/**
 * Look up the text of the message the customer reacted to, by the WhatsApp
 * message id we stored on the outbound message. Workspace-isolated. Returns null
 * when not found (e.g. id not stored, message purged) or on any error.
 */
export async function resolveReactedMessageText(
  prisma: PrismaClient,
  workspaceId: string,
  whatsappMessageId: string
): Promise<string | null> {
  try {
    const msg = await prisma.message.findFirst({
      where: {
        whatsappMessageId,
        chatSession: { workspaceId },
      },
      select: { content: true },
      orderBy: { createdAt: "desc" },
    })
    return msg?.content?.trim() ? msg.content : null
  } catch {
    return null
  }
}

/**
 * Full helper for the webhook controllers: resolve the reacted-to message (if the
 * provider gave us its id) and compose the final text. Never throws; degrades to
 * emoji-only when the original can't be resolved.
 */
export async function buildReactionText(
  prisma: PrismaClient,
  workspaceId: string,
  reaction: ExtractedReaction
): Promise<string> {
  if (!reaction.messageId) return reaction.emoji
  const original = await resolveReactedMessageText(prisma, workspaceId, reaction.messageId)
  return composeReactionText(reaction.emoji, original)
}
