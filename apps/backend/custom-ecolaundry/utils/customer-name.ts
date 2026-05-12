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
  '^(no|si|sí|s[íi]|yes|ok|okay|vale|claro|gracias|grazie|thanks|perfecto|perfect|perfetto|entendido|capito|got|nope|nada|d\'accordo|adelante)$',
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
