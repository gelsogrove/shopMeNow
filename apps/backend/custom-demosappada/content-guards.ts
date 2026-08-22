/**
 * Deterministic checks on what the model is about to send.
 *
 * The main prompt says "never invent a URL or a phone number". That is an
 * instruction, and instructions are probabilistic — a tourist sent to a
 * mistyped number or a made-up page is the failure this module exists to
 * avoid (CLAUDE.md §16 iron rule 1: the fix for a misbehaving LLM is code
 * that removes its freedom, not another sentence asking it to behave).
 *
 * So the facts that can actually strand someone — links and phone numbers —
 * are checked against the FAQ block they must come from. Anything the
 * approved content does not contain is removed before the reply goes out.
 */

/** Bare URLs. Trailing sentence punctuation is trimmed by the caller. */
const URL_RE = /https?:\/\/[^\s<>()\[\]]+/gi

/**
 * Italian phone numbers as a tourist would read them: an optional +39, then
 * 6-11 digits possibly broken by spaces, dots or dashes.
 *
 * The separator class is deliberately HORIZONTAL only. With \s in there the
 * match ran across a line break, so "tel. 0435 469265\n3. La Rustica" was one
 * number: stripping it removed the next list item's marker too, and the reply
 * went out as "tel.. Ristorante La Rustica" (live run, 2026-08-22).
 */
const PHONE_RE = /(?:\+39[ .-]?)?\d(?:[ .-]?\d){5,10}/g

/** Short numbers that are facts about the world, not tenant data. */
const EMERGENCY_NUMBERS = new Set(['112', '113', '115', '116', '117', '118', '1515', '1530'])

function normalizeUrl(raw: string): string {
  return raw.replace(/[)\].,;:!?]+$/, '').toLowerCase()
}

function digitsOf(raw: string): string {
  return raw.replace(/\D/g, '')
}

export interface ContentCheck {
  /** The reply with unverifiable links/numbers removed. */
  text: string
  /** What was stripped, for the log. Empty when the reply was clean. */
  removed: string[]
}

/**
 * Strip every URL and phone number that does not appear in `approvedContent`
 * (the FAQ block plus any tool output served this turn).
 *
 * Removal, not refusal: a reply that is otherwise useful should still reach
 * the customer, minus the part that could send them somewhere that does not
 * exist. Emergency numbers pass unconditionally — they are not tenant data
 * and must never be filtered out of a reply about an emergency.
 */
export function stripUnverifiableContacts(reply: string, approvedContent: string): ContentCheck {
  const haystack = approvedContent.toLowerCase()
  const haystackDigits = digitsOf(approvedContent)
  const removed: string[] = []

  let text = reply.replace(URL_RE, (match) => {
    const url = normalizeUrl(match)
    if (haystack.includes(url)) return match
    // A URL may be cited with different trailing punctuation than the source.
    const withoutScheme = url.replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (withoutScheme.length > 0 && haystack.includes(withoutScheme)) return match
    removed.push(match)
    return ''
  })

  text = text.replace(PHONE_RE, (match) => {
    const digits = digitsOf(match)
    if (digits.length < 6) return match
    if (EMERGENCY_NUMBERS.has(digits)) return match
    if (haystackDigits.includes(digits)) return match
    removed.push(match)
    return ''
  })

  if (removed.length > 0) {
    // Tidy the holes left behind: doubled spaces, orphaned punctuation,
    // and lines that held nothing but the stripped value.
    text = text
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/[ \t]+([.,;:!?])/g, '$1')
      .split('\n')
      .filter((line, i, all) => {
        const bare = line.replace(/^[\s•\-*\d.)]+/, '').trim()
        if (bare.length > 0) return true
        // Keep single blank lines used as paragraph breaks.
        return line.trim() === '' && all[i - 1]?.trim() !== ''
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  return { text, removed }
}
