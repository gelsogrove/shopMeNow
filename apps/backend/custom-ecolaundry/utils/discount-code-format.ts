// F46 — Discount-code format helpers (Caso 8). Pure L3 detector — no state,
// no i18n, no runtime. The functions here are the single source of truth for
// "what shape does a tenant discount code have", consumed by:
//   - guards/discount-code-flow.ts  → parse + validate the customer's code
//   - customer-name.ts              → refuse code-shaped tokens as a name
//
// Code shape: `^<prefix>(\d{2})(\d{2})(\d{2})(\d{1,2})$`
//   - prefix:  uppercase letters from settings.json (e.g. SAU)
//   - DDMMYY:  six-digit date, validated as dd ∈ 01..31 AND mm ∈ 01..12
//   - amount:  1 or 2 digits (importe in whole euros — €1..€99 by tenant policy)
// Example with prefix "SAU": SAU2904266 → letters SAU, fecha 2026-04-29, importe 6
//
// The prefix is tenant config (Iron rule #7 — settings are law). The validator
// in utils/runtime.ts:validateSettings() rejects non-uppercase or empty
// prefixes at boot, so callers can trust that `prefix` matches `/^[A-Z]+$/`.

const NORMALIZE_STRIP = /[\s.,!?¿¡-]/g

function normaliseCandidate(raw: string): string {
  return raw.trim().toUpperCase().replace(NORMALIZE_STRIP, '')
}

/** Build the discount-code regex for the given tenant prefix. */
export function buildDiscountCodeRegex(prefix: string): RegExp {
  if (!/^[A-Z]+$/.test(prefix)) {
    throw new Error(
      `discount-code prefix must be uppercase letters only, got "${prefix}"`,
    )
  }
  return new RegExp(`^(${prefix})(\\d{2})(\\d{2})(\\d{2})(\\d{1,2})$`)
}

export type ParsedDiscountCode = {
  letters: string
  fechaIso: string
  importe: string
}

/**
 * Parse `raw` as a discount code for the given tenant `prefix`.
 * Returns the parsed parts on success, or null when the format doesn't match
 * OR when the embedded calendar date is invalid (dd > 31, mm > 12, etc.) OR
 * when the importe is outside 1-2 digits (Andrea, 2026-05-12: real chat
 * showed `SAU2904266636363` with a 7-digit "importe" being accepted —
 * euros, not millions).
 *
 * The input is normalised (uppercase, common punctuation/whitespace stripped)
 * before the regex test so customer typos like "sau-290426 6" still parse.
 */
export function parseDiscountCode(
  raw: string,
  prefix: string,
): ParsedDiscountCode | null {
  const cleaned = normaliseCandidate(raw)
  const re = buildDiscountCodeRegex(prefix)
  const m = cleaned.match(re)
  if (!m) return null
  const [, letters, dd, mm, yy, importe] = m
  // Date sanity: regex already enforces 2 digits for each, but allows things
  // like 32/13/yy. We reject obviously invalid calendar values so a typo
  // doesn't slip through and reach the operator briefing.
  const ddN = Number(dd)
  const mmN = Number(mm)
  if (ddN < 1 || ddN > 31 || mmN < 1 || mmN > 12) return null
  return { letters, fechaIso: `20${yy}-${mm}-${dd}`, importe }
}

/**
 * Returns true when `raw` looks like a tenant discount code. Used by the
 * customer-name validator to refuse code-shaped tokens (the real bug from
 * the production chat: the customer typed "SAU2904266" when the bot asked
 * for their name — historically the validator accepted it because it only
 * blocked numeric-only / confirmation-word / <2 char tokens).
 *
 * Note: a `false` here is NOT proof that `raw` IS a name — it only means
 * "not a discount code in this tenant's shape". Callers compose this with
 * the rest of the name-validation rules.
 */
export function looksLikeDiscountCode(raw: string, prefix: string): boolean {
  return parseDiscountCode(raw, prefix) !== null
}
