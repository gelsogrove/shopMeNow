/**
 * Compose the text representation of a reaction, mirroring the backend
 * `reaction-context.service.ts` so the demo and the operator UI produce the same
 * neutral, language-agnostic string the LLM already knows how to read:
 *
 *   👍                      → bare emoji (no original known)
 *   👍 → "Confirm order €30?" → emoji + quoted reacted-to message
 *
 * Keeping the format identical on both ends means a reaction "set on an old
 * message" in the demo is interpreted exactly like a real WhatsApp reaction.
 */

const MAX_QUOTED_CHARS = 160

export function composeReactionText(emoji: string, originalText?: string | null): string {
  const normalized = (originalText || "").trim().replace(/\s+/g, " ")
  if (!normalized) return emoji
  const quoted =
    normalized.length <= MAX_QUOTED_CHARS
      ? normalized
      : normalized.slice(0, MAX_QUOTED_CHARS - 1).trimEnd() + "…"
  return `${emoji} → "${quoted}"`
}
