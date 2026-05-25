// REFACTOR ONLY — pure move of detectPaidNotActivatedIntent,
// detectPaymentMention and detectPaymentMethodQuestion from utils/intent.ts
// into a barrel-split cassette. Zero behavioural change. Patterns remain
// exempt from iron rule #6 under the tracked exemption recorded in
// CLAUDE.md (topic-classifier fast-paths kept until ES is stable).
//
// History (regression catalogue): F16, F20, F24, F29, F47.
// Full design rationale and multi-language coverage: docs/usecases.md.

import { PAYMENT_METHOD_QUESTION_RE, LOYALTY_CARD_MENTION_RE } from '../patterns.js'
import { extractDisplayState } from './display.js'
import { levenshtein } from './_shared.js'

export function detectPaidNotActivatedIntent(message: string): boolean {
  const lower = message.toLowerCase().trim()
  if (!lower) return false

  // Discriminator (F29): if a display code is mentioned, let the display
  // flow handle it instead of diverting into the Caso 4 / no-change branch.
  if (extractDisplayState(message)) return false

  // \b is ASCII-only in JS; non-ASCII trailing chars (é, ó) need a manual
  // lookahead instead of \b for the right boundary.
  const wordEnd = '(?=\\s|[!?.,;]|$)'

  const paymentSignal =
    /\bhe\s+pagado\b/i.test(lower) ||
    new RegExp(`\\bpagu[eé]${wordEnd}`, 'i').test(lower) ||
    /\bpagad[oa]\b/i.test(lower)

  if (!paymentSignal) {
    const afterPaymentFailure =
      /\b(?:despu[eé]s|tras)\s+(?:de\s+)?pagar\b/i.test(lower) &&
      /\bno\s+(?:me\s+|se\s+)?(?:funciona|arranca|empieza|responde|parte|va)\b/i.test(lower)
    return afterPaymentFailure
  }

  if (/\bno\s+se\s+(?:ha\s+)?activad[oa]\b/i.test(lower)) return true
  if (new RegExp(`\\bno\\s+se\\s+activ[aoó]${wordEnd}`, 'i').test(lower)) return true

  // Typo tolerance: accept Levenshtein distance 1 on the verb token
  // ("activado"/"activada") — closes the "acrivado" regression.
  const m = lower.match(/\bno\s+se\s+(?:ha\s+)?([a-záéíóúñ]{6,})\b/i)
  if (m) {
    const token = m[1]
    if (levenshtein(token, 'activado') <= 1) return true
    if (levenshtein(token, 'activada') <= 1) return true
  }

  if (/\bno\s+(?:me\s+|se\s+)?(?:arranca|funciona|empieza|responde|parte|va)\b/i.test(lower)) return true

  return false
}

export function detectPaymentMention(message: string): boolean {
  const lower = message.toLowerCase().trim()
  if (!lower) return false

  // Negation guard: payment is denied or has not happened yet.
  if (
    /\bno\s+he\s+pagad[oa]\b/i.test(lower) ||
    /\bno\s+pagu[eé]\b/i.test(lower) ||
    /\bnon\s+ho\s+pagat[oa]\b/i.test(lower) ||
    /\b(?:haven'?t|have\s+not|did\s+not|didn'?t)\s+paid\b/i.test(lower) ||
    /\bn[ãa]o\s+(?:paguei|pagei|tenho\s+pago)\b/i.test(lower) ||
    /\bno\s+he\s+pagat\b/i.test(lower) ||
    /\bn'?ai\s+pas\s+pay[eé]e?(?=\s|[!?.,;]|$)/i.test(lower)
  ) {
    return false
  }

  // Past forms (participio / preterite) only — promises don't qualify.
  return (
    /\bhe\s+pagado\b/i.test(lower) ||
    /\bpagu[eé](?=\s|[!?.,;]|$)/i.test(lower) ||
    /\bpagad[oa]\b/i.test(lower) ||
    /\bho\s+(?:gi[àa]\s+)?pagat[oa]\b/i.test(lower) ||
    /(?:^|\s)pagat[oa](?=\s|[!?.,;]|$)/i.test(lower) ||
    /\bi(?:\s+have|'ve|\s+'?ve)?\s+paid\b/i.test(lower) ||
    /\bhave\s+paid\b/i.test(lower) ||
    /\b(?:j[áa]\s+)?paguei\b/i.test(lower) ||
    /\btenho\s+pago\b/i.test(lower) ||
    /\b(?:ja\s+)?he\s+pagat\b/i.test(lower) ||
    /(?:^|\s)pagat(?=\s|[!?.,;]|$)/i.test(lower) ||
    /\b(?:j'?ai|ai)\s+pay[eé]e?\b/i.test(lower) ||
    /(?:^|\s)pay[eé]e?(?=\s|[!?.,;]|$)/i.test(lower)
  )
}

export function detectPaymentMethodQuestion(message: string): boolean {
  // Negative gate: "loyalty card" / "tarjeta de fidelidad" is Caso 10's
  // territory, never a payment-method question — even though the literal
  // word "card" / "tarjeta" appears (would false-trigger the positive regex).
  if (LOYALTY_CARD_MENTION_RE.test(message)) return false
  return PAYMENT_METHOD_QUESTION_RE.test(message)
}
