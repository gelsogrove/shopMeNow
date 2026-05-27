// Customer-name validation shared by:
//   - capture_customer_name tool (utils/tool-handlers/customer.ts) — LLM-driven path
//   - guardDiscountCodeAwaitName guard (utils/guards/discount-code-flow.ts) — deterministic path
//
// The two paths used to diverge: the tool rejected confirmation words and
// numeric-only tokens, the guard accepted any non-empty trimmed string. That
// let "si" / "vale" / "gracias" / browser autofill values slip in as the
// customer name. Now both go through `validateCustomerName()`.
//
// F46 — added the `discountCodePrefix` option. The Caso 8 production chat
// (Andrea, 2026-05-12) showed a customer typing "SAU2904266" when the bot
// asked for their name; historically the validator accepted it because it
// only rejected confirmations/digits/<2-char tokens. Callers that know the
// tenant's discount-code prefix (the guard reads it from settings, the tool
// handler from the runtime) pass it in so the validator refuses code-shaped
// tokens up front with a deterministic rejection — no prompt patch needed.

import { looksLikeDiscountCode } from './discount-code-format.js'

const CONFIRMATION_WORDS = new RegExp(
  // ES, IT, EN, FR/CA confirmations and acknowledgments — these are NOT names
  // even though the LLM/regex sometimes mistakes them for one when the user
  // is replying to a different question.
  '^(no|si|sí|s[íi]|yes|ok|okay|vale|claro|gracias|grazie|thanks|perfecto|perfect|perfetto|entendido|capito|got|nope|nada|d\'accordo|adelante|merci|obrigado|obrigada|gràcies|gracies|sim|oui|d\'accord)$',
  'i',
)

// F112 — Non-name common words. Multi-language list of frequent interjections,
// adverbs, conjunctions, and trouble-related verbs that get mistakenly captured
// as customer names when the LLM passes the first-token of a stray reply
// ("ah scusa", "still broken", "ainda nao", "voltando ao problema").
// Anti-name signal, not an intent classifier — rule #6 boundary-signal exempt.
const NON_NAME_TOKENS = new RegExp(
  '^(ah|eh|oh|uh|um|mm|hmm|beh|allora|dunque|pues|bueno|wait|aspetta|espera|attendez|sorry|scusa|perdona|perdón|disculpa|excuse|sigue|sigo|still|aún|todavía|ancora|encore|toujours|ainda|stuck|broken|rotto|roto|trencat|cassé|estragado|hi|hello|hola|ciao|salut|bonjour|olá|please|por\\s+favor|s[íi]l|svp|stp|favor)$',
  'i',
)

export type NameValidation =
  | { valid: true; name: string }
  | { valid: false; reason: string }

export type ValidateCustomerNameOptions = {
  /** Tenant discount-code prefix (settings.discountCodePrefix). When supplied,
   *  the validator rejects tokens that match the discount-code shape so the
   *  customer can't accidentally feed a code into the name field. */
  discountCodePrefix?: string
}

/**
 * Pull the first word out of `raw`, normalise it, and decide whether it's
 * usable as a customer name. Returns the cleaned first name on success, or a
 * human-readable rejection reason on failure (used both as LLM error feedback
 * and as the trigger for a deterministic re-ask in the guards).
 */
export function validateCustomerName(
  raw: unknown,
  options: ValidateCustomerNameOptions = {},
): NameValidation {
  if (typeof raw !== 'string') {
    return { valid: false, reason: 'name must be a non-empty string' }
  }
  const trimmed = raw.trim()
  if (!trimmed) {
    return { valid: false, reason: 'name empty' }
  }
  const firstName = trimmed.split(/\s+/)[0]
  if (!firstName) {
    return { valid: false, reason: 'name empty' }
  }
  const lowered = firstName.toLowerCase().replace(/[.,!?¿¡]/g, '')
  if (CONFIRMATION_WORDS.test(lowered)) {
    return {
      valid: false,
      reason: `"${firstName}" looks like a confirmation, not a name. Ask the customer their name explicitly.`,
    }
  }
  if (NON_NAME_TOKENS.test(lowered)) {
    return {
      valid: false,
      reason: `"${firstName}" looks like an interjection or filler word, not a name. Ask the customer their name explicitly.`,
    }
  }
  if (/^\d+$/.test(firstName) || firstName.length < 2) {
    return { valid: false, reason: `"${firstName}" is not a valid name.` }
  }
  if (options.discountCodePrefix && looksLikeDiscountCode(firstName, options.discountCodePrefix)) {
    return {
      valid: false,
      reason: `"${firstName}" looks like a discount code, not a name. Ask the customer their name explicitly.`,
    }
  }
  return { valid: true, name: firstName }
}
