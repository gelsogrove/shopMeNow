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
/**
 * Clock times as a guest reads them: "9.00", "17:30", "8-12".
 *
 * Bare integers are deliberately NOT matched — "20 minuti di cammino" and
 * "2 ore" are durations the model derives legitimately from the source, and
 * stripping them would gut correct answers to catch nothing.
 */
const TIME_RE = /\b([01]?\d|2[0-3])[.:][0-5]\d\b/g

/** Prices: an amount with a currency mark, in either order. */
const PRICE_RE = /(?:€\s?\d+(?:[.,]\d{1,2})?|\b\d+(?:[.,]\d{1,2})?\s?(?:€|euro))/gi

/** Digits only, so "9.00" and "9:00" compare equal. */
function timeDigits(raw: string): string {
  return raw.replace(/\D/g, '')
}

/** The numeric part of a price, so "€45" and "45 euro" compare equal. */
function priceDigits(raw: string): string {
  return raw.replace(/[^\d]/g, '')
}

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

  // Opening times and prices: the two facts after contacts that send someone
  // somewhere for nothing — a guest who reads "apre alle 9" and finds a
  // closed door has been failed as surely as one given a wrong number.
  // Verified against the source rather than trusted: the prompt already
  // forbids inventing them, and a prompt is a request (CLAUDE.md §16 rule 1).
  //
  // Compared on digits alone, so the model may reformat freely: the source's
  // "9.00" covers a reply's "9:00", and "€45" covers "45 euro".
  text = text.replace(TIME_RE, (match) => {
    const digits = timeDigits(match)
    if (haystackDigits.includes(digits)) return match
    removed.push(match)
    return ''
  })

  text = text.replace(PRICE_RE, (match) => {
    const digits = priceDigits(match)
    if (digits.length === 0) return match
    if (haystackDigits.includes(digits)) return match
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

/**
 * Keep at most one question in a reply while the intake is still open.
 *
 * The prompt already says "one question per message, NEVER two together", and
 * the model is shown a single field — yet it merged two of them anyway:
 * "siete tutti adulti, o ci sono bambini? E se sì, quanti anni hanno?"
 * (Andrea, live, 2026-08-23). Iron rule 1: when an instruction keeps losing,
 * the fix is code that removes the freedom.
 *
 * Sentences are counted, not phrases matched — nothing here reads WHAT was
 * asked, only that a second question mark closes a later sentence. So it is
 * language-independent (CLAUDE.md §14: no keyword detection on user text).
 *
 * Trailing questions are dropped from the END, because the intake question is
 * appended last: what precedes it is the answer to the guest, which must
 * survive intact.
 */
export function keepSingleQuestion(reply: string): ContentCheck {
  // Split after ? ! . or a newline, keeping the delimiter with its sentence.
  const parts = reply.match(/[^.!?\n]*(?:[.!?]+|\n+|$)/g)?.filter((p) => p.length > 0) ?? []
  const isQuestion = (part: string): boolean => part.trimEnd().endsWith('?')

  let seen = 0
  const kept: string[] = []
  const removed: string[] = []
  for (const part of parts) {
    if (isQuestion(part)) {
      seen++
      // The FIRST question is the one the guest is meant to answer.
      if (seen > 1) {
        const trimmed = part.trim()
        if (trimmed.length > 0) removed.push(trimmed)
        continue
      }
    }
    kept.push(part)
  }

  if (removed.length === 0) return { text: reply, removed: [] }

  const text = kept
    .join('')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { text, removed }
}
