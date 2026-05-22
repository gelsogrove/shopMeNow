// Output invariant — split inline numbered lists into separate lines.
//
// Bug surface: the LLM (agent + rephrase) generates how-to / step-by-step
// answers as a single inline paragraph: "La lavadora funciona así:
// 1. Selecciona el programa. 2. Carga la ropa. 3. Cierra la puerta."
// The customer sees a wall of text and cannot scan the steps. The doc
// (usecases.md) does not specify list formatting because numbered lists
// are LLM-emergent, not part of any canned i18n.
//
// Architecturally this is the F32/F37/F41/F49/F56 family: the rephrase
// LLM is structurally bad at format guarantees. Adding "use newlines"
// to prompts/rephrase.txt is a pezza — T=0.6 will ignore it on long
// replies (proven by F41 bullet flatten). The fix is deterministic L5.
//
// Rule: when reply contains ≥2 sequential "N. " markers inline (same
// paragraph, no preceding \n), insert "\n\n" before each numbered item.
// Idempotent: replies already formatted with \n\n keep their structure.

import { logger } from '../logger.js'

// Pattern: a number (1-2 digits) + ". " preceded by a non-newline char
// (so we only target INLINE numbered items, never re-format an already
// properly-formatted list). The capture group is the digit+dot+space.
const INLINE_NUMBERED_ITEM = /(?<=[^\n])\s+(\d{1,2}\.\s)/g

export function splitInlineNumberedList(reply: string): string {
  // Quick exit: count the sequential "N. " markers. We only act when
  // there are ≥2 such markers AND at least one of them is inline (i.e.
  // the regex above produces a match).
  const allMarkers = reply.match(/\b\d{1,2}\.\s/g)
  if (!allMarkers || allMarkers.length < 2) return reply

  // If no inline marker is present, nothing to do (already formatted).
  if (!INLINE_NUMBERED_ITEM.test(reply)) {
    INLINE_NUMBERED_ITEM.lastIndex = 0
    return reply
  }
  INLINE_NUMBERED_ITEM.lastIndex = 0

  const result = reply.replace(INLINE_NUMBERED_ITEM, '\n\n$1')

  if (result !== reply) {
    logger.warn('output-invariant: split inline numbered list', {
      original: reply.slice(0, 200),
      result: result.slice(0, 200),
    })
  }
  return result || reply
}
