// PII redaction layer.
//
// Pipeline (architecture mirrors custom-demowash):
//
//   1. PRE-SCAN regex on incoming user message → extract PII patterns
//      (email, CIF, NIF/DNI, IBAN, card-16-digits, card-last-4-with-context,
//      phone). Replace with placeholders. Save real values in SessionState.
//      (In real estate these show up in reservation deposits / DNI for
//      booking a viewing or a reservation — same redaction applies.)
//
//   2. DE-REDACT history with state already known (from earlier turns):
//      replace any literal occurrence of state.name, state.address,
//      state.companyName, state.cif, state.email, state.phone, state.cardLast4
//      with placeholder tokens.
//
//   3. The cleaned text is what gets saved in history AND sent to the LLM.
//      The real values live ONLY in SessionState (server-side).
//
//   4. When the bot wants to send something to the operator (email),
//      the handler substitutes the placeholders back with real values
//      from SessionState. The LLM never sees the real values verbatim
//      after the initial pre-scan.

import type { SessionState } from './state.js'
import { updateState } from './state.js'

// ── Patterns ─────────────────────────────────────────────────────────────────

const EMAIL_RE = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g

// Spanish CIF: 1 letter from a specific set + 7 digits + 1 letter/digit.
const CIF_RE = /\b[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]\b/g

// Spanish NIF / DNI: 8 digits + 1 letter.
const NIF_RE = /\b\d{8}[A-HJ-NP-TV-Z]\b/gi

// IBAN: 2 letters + 2 digits + up to 30 alphanumerics.
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g

// Full 16-digit credit card (loose, with optional separators).
const CARD_FULL_RE = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g

// Last 4 digits ONLY if mentioned in a card context. Multilingual.
const CARD_LAST4_CTX_RE =
  /(?:tarjeta|carta|card|últim[oa]s?\s*(?:4|cuatro)|terminada\s*en|finale|finita\s*in|ending\s*in|terminant\s*par|terminando\s*em|acabada\s*en)\D{0,12}(\d{4})\b/gi

// Spanish phone: optional +34 prefix + 9 digits starting with 6/7/8/9.
const PHONE_ES_RE = /(?:\+34\s?)?[6789]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}/g

// Canonical office/city names. The DemoCasa agency has one branch office per
// city; the customer tells us which area they're interested in. Names are
// always written in Latin script, even inside a message in another script
// (Chinese, Greek, Cyrillic…). The LLM reliably understands them but does NOT
// always call remember({location}) when the name is embedded in non-Latin text
// and it can answer without saving it. So we detect the city deterministically
// here, by matching one of these 8 fixed proper nouns (NOT keyword/intent
// detection — same idea as the PII pre-scan), and seed `location` if the model
// didn't. Works in every language.
const CANONICAL_VENUES = ['Sant Cugat', 'Eixample', 'Mataró', 'Gràcia', 'Terrassa', 'Rubí', 'Madrid', 'Valencia'] as const

// Match a city accent-insensitively and as a whole word. "Sant Cugat" first so
// the two-word name isn't shadowed. Returns the canonical spelling or null.
function detectVenue(message: string): string | null {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const haystack = norm(message)
  for (const venue of CANONICAL_VENUES) {
    const needle = norm(venue)
    // Word-ish boundary: not preceded/followed by a Latin letter (so it still
    // fires when glued to non-Latin script, e.g. "在Eixample买房").
    const re = new RegExp(`(?<![a-z])${needle.replace(/ /g, '\\s+')}(?![a-z])`, 'i')
    if (re.test(haystack)) return venue
  }
  return null
}

// ── Pre-scan: extract PII from raw message, replace with placeholders ────────

export interface RedactionResult {
  redacted: string
  captured: Partial<{
    email: string
    cif: string
    nif: string
    iban: string
    cardFull: string
    cardLast4: string
    phone: string
  }>
}

export function preScanAndRedact(input: string): RedactionResult {
  let s = input
  const captured: RedactionResult['captured'] = {}

  // Email
  s = s.replace(EMAIL_RE, (m) => {
    if (!captured.email) captured.email = m
    return '[EMAIL]'
  })

  // IBAN (must come before CIF to avoid CIF eating IBAN prefix-like patterns)
  s = s.replace(IBAN_RE, (m) => {
    if (!captured.iban) captured.iban = m
    return '[IBAN]'
  })

  // Card full (must come before card-last-4 to avoid double match)
  s = s.replace(CARD_FULL_RE, (m) => {
    if (!captured.cardFull) captured.cardFull = m
    return '[CARD_FULL]'
  })

  // Card last 4 (context-required)
  s = s.replace(CARD_LAST4_CTX_RE, (_full, digits) => {
    if (!captured.cardLast4) captured.cardLast4 = digits
    return `tarjeta [CARD_4]`
  })

  // CIF
  s = s.replace(CIF_RE, (m) => {
    if (!captured.cif) captured.cif = m
    return '[CIF]'
  })

  // NIF
  s = s.replace(NIF_RE, (m) => {
    if (!captured.nif) captured.nif = m
    return '[NIF]'
  })

  // Phone (Spanish)
  s = s.replace(PHONE_ES_RE, (m) => {
    if (!captured.phone) captured.phone = m
    return '[PHONE]'
  })

  return { redacted: s, captured }
}

// ── De-redact with known state ───────────────────────────────────────────────
// For PII captured in earlier turns and already in SessionState, replace
// literal occurrences in NEW text with placeholders. This guards against
// the customer or the model repeating the value verbatim later.

export function deRedactWithState(input: string, state: SessionState): string {
  let s = input
  // Order matters: longer strings first to avoid partial overlaps.
  const subs: Array<[string | undefined, string]> = [
    [state.email, '[EMAIL]'],
    [state.iban, '[IBAN]'],
    [state.cardFull, '[CARD_FULL]'],
    [state.cif, '[CIF]'],
    [state.nif, '[NIF]'],
    [state.phone, '[PHONE]'],
    [state.address, '[ADDRESS]'],
    [state.companyName, '[COMPANY_NAME]'],
    [state.name, '[CUSTOMER_NAME]'],
    [state.cardLast4 ? `[CARD_4]` : undefined, '[CARD_4]'], // no-op marker
  ]
  for (const [needle, placeholder] of subs) {
    if (needle && typeof needle === 'string' && needle.length >= 2) {
      // Escape regex special chars in the needle.
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      s = s.replace(new RegExp(escaped, 'gi'), placeholder)
    }
  }
  return s
}

// ── Process incoming user message (the main entry point) ─────────────────────
// Combines pre-scan + de-redact + state seeding in one call. Returns the
// clean text that should be saved in history and sent to the LLM.

export function processIncomingMessage(
  sessionId: string,
  rawMessage: string,
  state: SessionState,
): { cleanText: string; capturedKeys: string[] } {
  // Step 1: pre-scan structured PII patterns
  const { redacted, captured } = preScanAndRedact(rawMessage)

  // Step 2: save captured PII into SessionState (server-side only)
  const patch: Partial<SessionState> = {}
  if (captured.email) patch.email = captured.email
  if (captured.cif) patch.cif = captured.cif
  if (captured.nif) patch.nif = captured.nif
  if (captured.iban) patch.iban = captured.iban
  if (captured.cardFull) patch.cardFull = captured.cardFull
  if (captured.cardLast4) patch.cardLast4 = captured.cardLast4
  if (captured.phone) patch.phone = captured.phone
  // Backstop: if the message names a city and we don't have one yet, seed it
  // deterministically (the LLM may have skipped remember({location})). Only
  // when location is still unset — never override a city already chosen.
  if (!state.location) {
    const venue = detectVenue(rawMessage)
    if (venue) patch.location = venue
  }
  if (Object.keys(patch).length > 0) {
    updateState(sessionId, patch)
  }

  // Step 3: de-redact with state already known (names/address/company from
  // earlier turns). We use the UPDATED state to also cover values just captured.
  const finalState = { ...state, ...patch }
  const cleanText = deRedactWithState(redacted, finalState)

  return { cleanText, capturedKeys: Object.keys(captured) }
}

// ── Substitute placeholders back to real values (operator-bound text) ────────
// When the bot wants to send a briefing to the operator (real human), we
// substitute the placeholders with the real values from SessionState.
// The LLM produces text with placeholders; this function makes it operator-ready.

export function substitutePlaceholders(text: string, state: SessionState): string {
  let s = text
  const subs: Array<[string, string | undefined]> = [
    ['[CUSTOMER_NAME]', state.name],
    ['[COMPANY_NAME]', state.companyName],
    ['[ADDRESS]', state.address],
    ['[EMAIL]', state.email],
    ['[CIF]', state.cif],
    ['[NIF]', state.nif],
    ['[IBAN]', state.iban],
    ['[CARD_FULL]', state.cardFull],
    ['[CARD_4]', state.cardLast4],
    ['[PHONE]', state.phone],
  ]
  for (const [placeholder, value] of subs) {
    if (value) {
      const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      s = s.replace(new RegExp(escaped, 'g'), value)
    }
  }
  return s
}
