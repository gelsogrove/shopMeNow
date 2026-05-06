// Input sanitisers — defence-in-depth for values that cross trust boundaries:
//   - sanitizeUserMessage for the customer message before it reaches the LLM
//   - sanitizePhoneNumber for the phone passed in by the chat-engine
//   - sanitizeForDisplay  for fields embedded into operator-visible markdown
//
// All helpers are pure, zero-deps, and *non-rejecting* (truncate/strip rather
// than throw): the user must always get a reply, even if their input is weird.

import { logger } from './logger.js'

/** Max characters accepted in a single user message before truncation. */
export const MAX_USER_MESSAGE_LENGTH = 2000

/** Max characters accepted in customerPhone after sanitisation. */
export const MAX_PHONE_LENGTH = 32

/** Max characters of a free-text field rendered into operator markdown. */
export const MAX_DISPLAY_LENGTH = 200

// Regexes are built via the RegExp constructor with explicit unicode escapes
// so the source file stays printable ASCII (no embedded control bytes or
// zero-width chars) and the byte ranges are auditable in code review.
//
// CONTROL_CHARS:     C0 (U+0000..U+0008) + DEL (U+007F) + C1 (U+0080..U+009F),
//                    keeping TAB (U+0009), LF (U+000A) and CR (U+000D).
// INVISIBLE_CHARS:   bidi overrides + zero-width chars used in homograph and
//                    prompt-injection attacks: U+200B..U+200F (ZWSP/ZWNJ/ZWJ/
//                    LRM/RLM), U+202A..U+202E (LRE/RLE/PDF/LRO/RLO),
//                    U+2066..U+2069 (LRI/RLI/FSI/PDI), U+FEFF (BOM).
// PHONE_DISALLOWED:  anything not in [0-9 + whitespace ( ) - .].
// MARKDOWN_SPECIALS: delimiters that can break operator-visible markdown or
//                    fake links: backslash, backtick, *, _, {}, [], (), #,
//                    +, -, !, <, >, |.
const CONTROL_CHARS = new RegExp(
  '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]',
  'g',
)
const INVISIBLE_CHARS = new RegExp(
  '[\\u200B-\\u200F\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]',
  'g',
)
const PHONE_DISALLOWED = /[^0-9+\s()\-.]/g
const MARKDOWN_SPECIALS = /[\\`*_{}[\]()#+\-!<>|]/g

/**
 * Strip control + invisible characters and cap length. Used on the customer
 * message before it reaches the LLM so a payload cannot smuggle hidden text
 * via zero-width chars or stuff the prompt with megabytes of garbage.
 */
export function sanitizeUserMessage(raw: string): string {
  if (typeof raw !== 'string') return ''
  let cleaned = raw.replace(CONTROL_CHARS, '').replace(INVISIBLE_CHARS, '')
  if (cleaned.length > MAX_USER_MESSAGE_LENGTH) {
    logger.warn('User message truncated to MAX_USER_MESSAGE_LENGTH', {
      received: cleaned.length,
      kept: MAX_USER_MESSAGE_LENGTH,
    })
    cleaned = cleaned.slice(0, MAX_USER_MESSAGE_LENGTH)
  }
  return cleaned
}

/**
 * Keep only digits, +, spaces, parentheses, hyphens and dots; cap length.
 * Anything else (control chars, markdown, scripts, emoji) is dropped before
 * the value lands in state.customerPhone and downstream operator messages.
 */
export function sanitizePhoneNumber(raw: string | undefined | null): string | undefined {
  if (typeof raw !== 'string') return undefined
  const cleaned = raw.replace(PHONE_DISALLOWED, '').trim()
  if (!cleaned) return undefined
  return cleaned.slice(0, MAX_PHONE_LENGTH)
}

/**
 * Make a free-text field safe to embed inside operator-visible markdown.
 * Strips control chars + markdown delimiters so a customer-supplied name
 * like [evil](http://x) cannot render as a fake link in the handover note.
 */
export function sanitizeForDisplay(raw: string | undefined | null): string {
  if (typeof raw !== 'string') return ''
  const cleaned = raw
    .replace(CONTROL_CHARS, '')
    .replace(INVISIBLE_CHARS, '')
    .replace(MARKDOWN_SPECIALS, '')
    .trim()
  return cleaned.length > MAX_DISPLAY_LENGTH
    ? cleaned.slice(0, MAX_DISPLAY_LENGTH)
    : cleaned
}
