/**
 * Webhook reaction extraction
 *
 * A WhatsApp "reaction" (long-press a message → 👍/❤️/…) arrives as its own
 * message kind, separate from text. These pure parsers pull the emoji out of
 * each provider's payload and return it as a plain string, or null when there
 * is no (live) reaction — including the "reaction removed" case, where the
 * provider sends an empty emoji.
 *
 * DESIGN (CLAUDE.md rule #14 — no hardcoded phrase/intent detection): we do NOT
 * map "👍" → "yes" here. The emoji is handed to the pipeline AS the message
 * text and the LLM interprets it in context, exactly like an emoji the customer
 * typed. No language-specific or emoji-specific intent logic lives in code.
 *
 *   - Meta:     message.type === "reaction"; message.reaction = { message_id, emoji }
 *   - UltraMsg: data.type === "reaction"; emoji in data.reaction || data.body (best-effort)
 *   - Wasender: message.message.reactionMessage = { key, text } (Baileys)
 */

/**
 * A live reaction: the emoji plus, when the provider exposes it, the id of the
 * message that was reacted to (the WhatsApp message id we stored on outbound).
 * `messageId` is null when the provider doesn't carry it — the caller then
 * degrades to emoji-only (no "what was reacted to" context).
 */
export interface ExtractedReaction {
  emoji: string
  messageId: string | null
}

function cleanEmoji(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

function cleanId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

/** Meta Cloud API inbound reaction → { emoji, messageId } (or null). */
export function extractMetaReaction(message: any): ExtractedReaction | null {
  if (message?.type !== "reaction") return null
  const emoji = cleanEmoji(message?.reaction?.emoji)
  if (!emoji) return null
  return { emoji, messageId: cleanId(message?.reaction?.message_id) }
}

/** UltraMsg inbound reaction payload (data.*) → { emoji, messageId } (or null). */
export function extractUltramsgReaction(data: any): ExtractedReaction | null {
  if (data?.type !== "reaction") return null
  // UltraMsg is inconsistent across versions: emoji may be in `reaction` or `body`.
  const emoji = cleanEmoji(data?.reaction) ?? cleanEmoji(data?.body)
  if (!emoji) return null
  // UltraMsg does not reliably expose the reacted-to message id → degrade to
  // emoji-only. (We still try a couple of known field names, best-effort.)
  const messageId = cleanId(data?.referenceId) ?? cleanId(data?.quotedMsgId)
  return { emoji, messageId }
}

/** Wasender (Baileys) inbound reaction → { emoji, messageId } (or null). */
export function extractWasenderReaction(message: any): ExtractedReaction | null {
  const emoji = cleanEmoji(message?.message?.reactionMessage?.text)
  if (!emoji) return null
  return { emoji, messageId: cleanId(message?.message?.reactionMessage?.key?.id) }
}
