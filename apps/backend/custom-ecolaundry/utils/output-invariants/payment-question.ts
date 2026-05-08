// Output invariant — strip standalone "¿has pagado?" / "have you paid?"
// (and equivalents in 6 languages).
//
// Bug surface: the LLM inserts a payment Q between the machine-number
// step and the display step. The doc and the gather pipeline never list
// payment as a step on its own — the display state itself tells us
// whether payment was completed (PUSH PROG / SEL ⇒ paid). Strip the Q.

import { logger } from '../logger.js'

const STANDALONE_PAYMENT_QUESTION: RegExp[] = [
  // Spanish — "¿has pagado?" / "¿has podido pagar?" / "¿has podido realizar el pago?"
  /¿\s*has\s+(?:pagado|podido\s+(?:pagar|realizar\s+el\s+pago))\s*\??\s*/gi,
  /¿\s*ha\s+pagado\s+ya\s*\??\s*/gi,
  // Italian — "hai pagato?"
  /hai\s+(?:gi[àa]\s+)?pagato\s*\??\s*/gi,
  // English — "have you paid?"
  /have\s+you\s+(?:already\s+)?paid\s*\??\s*/gi,
  // Catalan — "has pagat?"
  /has\s+(?:ja\s+)?pagat\s*\??\s*/gi,
  // Portuguese — "já pagou?"
  /j[áa]\s+pagou\s*\??\s*/gi,
  // French — "as-tu payé?" / "avez-vous payé?"
  /(?:as-tu|avez-vous)\s+(?:d[ée]j[àa]\s+)?pay[ée]\s*\??\s*/gi,
]

export function stripStandalonePaymentQuestion(reply: string): string {
  // Only strip when the question stands ALONE (not embedded in a longer
  // sentence like "perfecto, has pagado y ahora"). We check that the
  // match ends with "?" and is followed by a sentence boundary.
  let result = reply
  for (const pattern of STANDALONE_PAYMENT_QUESTION) {
    result = result.replace(pattern, (match) => {
      // Keep matches that don't end with ? — those are statements, not questions.
      return /\?\s*$/.test(match) ? '' : match
    })
  }
  result = result.replace(/\s{2,}/g, ' ').replace(/^\s*[.,!?]\s*/, '').trim()
  if (result !== reply) {
    logger.warn('output-invariant: stripped standalone "¿has pagado?" from reply', {
      original: reply.slice(0, 200),
      result: result.slice(0, 200),
    })
  }
  return result || reply
}
