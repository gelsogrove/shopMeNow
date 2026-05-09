// Pure intent-detection and pattern-matching helpers.
// No LLM calls, no state mutations — only deterministic regex/heuristic logic.

import {
  normalizeDisplayState,
} from './display-state.js'
import {
  isBlankDisplayReply,
  hasExtraButtonIssue,
  hasStopIntent,
} from './message-parsing.js'
import type { SessionState } from '../models/index.js'

// ── Display state extraction ──────────────────────────────────────────────────

export function extractDisplayState(message: string): string | null {
  const trimmed = message.trim()
  if (isBlankDisplayReply(trimmed)) return 'BLANK'
  if (/END.*bAL|bAL.*END/i.test(trimmed)) return 'END_BAL'
  if (/\b\d{1,2}[.,]\d{2}\b/.test(trimmed)) return 'PRICE'
  if (/puerta abierta|dibujo de la puerta|icono de puerta|door open|open door icon/i.test(trimmed)) return 'DOOR'
  // AL001 family — Caso 5 (error in payment sequence). Accepts the canonical
  // "AL001"/"AL 001" plus the natural-language variants the customer often
  // types instead of the code itself: "alarm 001", "alarma 001", "ALM 001".
  // The downstream display-flow JSON (`displayMatches`) lists the same set,
  // so the extractor and the flow engine stay in sync — both treat this
  // as the same incident.
  const alarm001Match = trimmed.match(/\b(?:AL\s*|ALM\s*|ALARMA?\s+)0*01\b/i)
  if (alarm001Match) return 'AL001'
  // Bare "001" / "01" code (without "AL"/"ALM" prefix) → C001 (caso 15:
  // selection-before-payment, always escalates). Use \D boundary so "1001"
  // or "100" don't false-match.
  if (/(?:^|\D)0*01(?:\D|$)/.test(trimmed) && !/\b\d{4,}\b/.test(trimmed)) return 'C001'

  // Accept the sub-code separated by "/", whitespace, or nothing — "ALM DOOR",
  // "ALM/DOOR", "ALMDOOR" should all collapse to the same display token.
  const specificAlarmMatch = trimmed.match(/\b(ALM[\/\s]?A|ALM[\/\s]?E|ALM[\/\s]?DOOR|ALM[\/\s]?V(?:AR|Ar))\b/i)
  if (specificAlarmMatch) return normalizeDisplayState(specificAlarmMatch[1])

  // ALN family ("ALN", "ALN A", "ALN N") is treated as an undocumented alarm —
  // matched here so it surfaces as a display state and the flow engine can
  // route it through the troubleshooting → escalate path (case 16).
  const alnMatch = trimmed.match(/\bALN(?:\s*[AN])?\b/i)
  if (alnMatch) return normalizeDisplayState(alnMatch[0])

  // Generic ERR/ERROR codes ("ERR 52", "ERROR 47", "ERR-50") — surfaces as
  // an undocumented display so the bot escalates per Caso 30.
  const errMatch = trimmed.match(/\b(ERR(?:OR)?[\s\-]?\d{1,3})\b/i)
  if (errMatch) return errMatch[1].toUpperCase().replace(/\s+/g, ' ')

  const genericMatch = trimmed.match(/\b(SEL|PUSH|PR|DOOR|ALM|AL001|END|ON|FILTRO|FALLO DE ROTACION|FALLO DE ASPIRACION|STOP|water)\b/i)
  if (genericMatch) return normalizeDisplayState(genericMatch[1])

  // Fuzzy fallback for common typos: "USH PROG" (missing P) → PUSH PROG,
  // "DOR" → DOOR, "ALM01" → AL001, "selh" → SEL.
  // Only fires when the strict regexes above fail. Accepts edit distance ≤ 1
  // for short tokens (≤4 chars) and ≤ 2 for longer ones — small enough to
  // catch single-letter typos without false-matching unrelated words.
  const fuzzy = fuzzyDisplayMatch(trimmed)
  if (fuzzy) return fuzzy

  return null
}

/**
 * Customer-facing label for a display token, preserving the wording the
 * customer used. Where `extractDisplayState` returns the canonical token
 * (e.g. "PUSH" — used by the flow engine for routing), this function
 * returns the literal string the customer typed (e.g. "PUSH PROG").
 *
 * Heuristic: locate the canonical token in the message, then extend
 * rightward over adjacent ALL-UPPERCASE tokens. Lowercase prose stops
 * the extension, so "veo PUSH PROG en la pantalla" → "PUSH PROG" but
 * "veo push prog" → "PUSH" (we don't risk picking up lowercase prose).
 *
 * Returns the canonical token unchanged when no extension is possible.
 *
 * REGRESSION (Andrea, 2026-05-09): the operator handover summary was
 * showing "La pantalla muestra PUSH" while the customer had typed
 * "PUSH PROG". `extractDisplayState` collapses to "PUSH" because the
 * \b word boundary in the regex stops at the space before "PROG". This
 * function recovers the customer-friendly form.
 */
export function extractDisplayLabel(message: string, canonical: string): string {
  if (!canonical) return ''
  // Build a permissive matcher for the canonical token's "stem" (the part
  // that actually appears in the customer's message). For PUSH/SEL/DOOR
  // etc. the stem is the canonical itself. For canonicals that contain
  // characters customers don't type literally (e.g. "ALM/DOOR" — the
  // slash is the bot's separator), fall back to the leading alpha run.
  const stem = canonical.match(/^[A-Z0-9]+/i)?.[0] || canonical
  const re = new RegExp(`\\b${stem}\\b`, 'i')
  const match = message.match(re)
  if (!match || match.index === undefined) return canonical.toUpperCase()
  let end = match.index + match[0].length
  // Greedily extend over " WORD" runs of uppercase letters/digits in the
  // SOURCE message. Lowercase prose stops the extension.
  const tail = message.slice(end).match(/^(?:\s+[A-Z][A-Z0-9]{1,})+/)
  if (tail) end += tail[0].length
  return message
    .slice(match.index, end)
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Fuzzy display match ───────────────────────────────────────────────────────
//
// The strict regex above misses common typos like "USH PROG" (missing P).
// This fuzzy match runs only as a fallback and uses a small Levenshtein
// distance so it cannot accidentally rebrand unrelated words — anything
// further than 1-2 edits away is rejected.

const FUZZY_TARGETS: ReadonlyArray<{ token: string; canonical: string }> = [
  { token: 'PUSH PROG', canonical: 'PUSH' },
  { token: 'PUSH', canonical: 'PUSH' },
  { token: 'SEL', canonical: 'SEL' },
  { token: 'DOOR', canonical: 'DOOR' },
  { token: 'ALM DOOR', canonical: 'ALM/DOOR' },
  { token: 'ALMDOOR', canonical: 'ALM/DOOR' },
  { token: 'AL001', canonical: 'AL001' },
  { token: 'ALARM 001', canonical: 'AL001' },
  { token: 'ALARMA 001', canonical: 'AL001' },
  { token: 'ALN', canonical: 'ALN' },
  { token: 'ALM', canonical: 'ALM' },
]

function fuzzyDisplayMatch(input: string): string | null {
  // Normalise: uppercase, collapse whitespace, drop punctuation that the
  // customer often interleaves ("PUSH-PROG", "PUSH.PROG").
  const norm = input
    .toUpperCase()
    .replace(/[/.\-_,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (norm.length < 3) return null
  // Reject obvious non-codes (sentences with multiple words and lowercase
  // letters in original) — only fuzzy-match if the input looks like a code:
  // mostly uppercase letters and digits, ≤ 12 chars after normalisation.
  if (norm.length > 12) return null
  if (!/^[A-Z0-9 ]+$/.test(norm)) return null

  let best: { token: string; canonical: string; dist: number } | null = null
  for (const { token, canonical } of FUZZY_TARGETS) {
    const dist = levenshtein(norm, token)
    const maxDist = token.length <= 4 ? 1 : 2
    if (dist <= maxDist && (!best || dist < best.dist)) {
      best = { token, canonical, dist }
    }
  }
  return best ? best.canonical : null
}

export function isDisplayCodeLikeInput(message: string): boolean {
  return Boolean(extractDisplayState(message))
}

/**
 * Detect a "I don't know yet / I haven't done that yet" reply from the
 * customer. Used by gather guards (forceMachineNumber, forceDisplay, …)
 * to short-circuit the retry counter: when the customer is explicit that
 * they can't give the requested info, asking again is pointless. The bot
 * should jump straight to a guidance message or to the operator.
 *
 * Multilingual coverage on the 6 supported languages — boundary signal,
 * not intent classification (rule #6 OK). Tested in
 * `__tests__/unit/intent.test.ts`.
 */
export function detectIDontKnowReply(message: string): boolean {
  const trimmed = message.trim().toLowerCase()
  if (!trimmed) return false
  return (
    // Spanish — note: trailing "\b" after "[eé]" is replaced with a lookahead
    // because JS regex `\b` is ASCII-only and does not match between "é" and a
    // word boundary (same bug class fixed previously in guardNoChangeYesButBroken).
    /\bno\s+lo\s+s[eé](?=[\s,.!?]|$)|\bno\s+s[eé](?=[\s,.!?]|$)|\bno\s+me\s+acuerdo\b|\bni\s+idea\b|\bno\s+tengo\s+idea\b/i.test(trimmed) ||
    /\bno\s+(?:lo|la|los|las)\s+he\s+(?:seleccionad[oa]|elegid[oa]|cogid[oa]|usad[oa])/i.test(trimmed) ||
    /\b(?:todav[ií]a|a[uú]n)\s+no\b/i.test(trimmed) ||
    /\bno\s+he\s+(?:elegid[oa]|seleccionad[oa]|cogid[oa])/i.test(trimmed) ||
    // Italian
    /\bnon\s+lo\s+so\b|\bnon\s+l[''’]ho\b|\bnon\s+ricordo\b|\bnon\s+ancora\b/i.test(trimmed) ||
    // English
    /\bi\s+don'?t\s+know\b|\bi\s+haven'?t\s+(?:yet|done)\b|\bnot\s+(?:yet|sure)\b|\bno\s+idea\b/i.test(trimmed) ||
    // Portuguese
    /\bn[ãa]o\s+sei\b|\bainda\s+n[ãa]o\b|\bn[ãa]o\s+me\s+lembro\b/i.test(trimmed) ||
    // French
    /\bje\s+ne\s+sais\s+pas\b|\bpas\s+encore\b|\baucune\s+id[ée]e\b/i.test(trimmed) ||
    // Catalan — same trailing lookahead trick after "[eé]"
    /\bno\s+ho\s+s[eé](?=[\s,.!?]|$)|\bencara\s+no\b/i.test(trimmed)
  )
}

// ── Doble-cobro intent detection ──────────────────────────────────────────────
//
// Topic classifier (rule #6 tracked exemption — fast-path for the most
// common ES/multi-lang phrasings; the LLM still picks up free-form
// reports). Returns true when the customer reports a double charge.
//
// Why a function and not an inline regex in `agent-extract.ts`:
//   The original regex required a strict verb prefix
//   `me\s+(?:han|hab[eé]is|ha)?\s+cobrad[ao]` which silently failed on
//   typos like "me habieis cobrado dos veces" (real Andrea-2026-05-09
//   chat) — the verb prefix doesn't match "habieis" because of the extra
//   `i`. Detection failed, the case 6 flow never started, and the bot
//   improvised. The new shape drops the verb-prefix requirement and
//   relies on the unambiguous co-occurrence of "cobrad/charged/etc."
//   plus a quantifier ("dos veces / twice / due volte / etc.").
//
// Multi-language coverage on the 6 supported languages (rule #8). Tested
// in `__tests__/unit/intent.test.ts` — happy path + the historical typo
// regression.
export function detectDoubleChargeIntent(message: string): boolean {
  const trimmed = message.toLowerCase()
  if (!trimmed) return false
  return (
    // Spanish — "cobrado/cobrada dos veces", "doble cobro", "cobró dos veces", etc.
    /\bcobrad[ao]\s+(?:dos\s+veces|2\s+veces|m[aá]s\s+de\s+una\s+vez|el\s+doble|dos\s+cargos)\b/i.test(trimmed) ||
    /\bdoble\s+(?:cobro|cargo|cobr[ao])\b/i.test(trimmed) ||
    /\bcobr[oó]\s+dos\s+veces\b/i.test(trimmed) ||
    /\b2\s+(?:cargos|cobros)\b/i.test(trimmed) ||
    // Italian — "addebitato due volte", "doppio addebito"
    /\baddebitat[ao]\s+due\s+volte\b/i.test(trimmed) ||
    /\bdoppio\s+addebito\b/i.test(trimmed) ||
    // English — "charged twice", "double charge", "charged me two times"
    /\bcharged\s+(?:me\s+)?twice\b/i.test(trimmed) ||
    /\bcharged\s+(?:me\s+)?two\s+times\b/i.test(trimmed) ||
    /\bdouble\s+charge\b/i.test(trimmed) ||
    // Portuguese — "cobrado duas vezes", "cobrança dupla"
    /\bcobrad[ao]\s+(?:duas\s+vezes|2\s+vezes)\b/i.test(trimmed) ||
    /\bcobran[çc]a\s+dupla\b/i.test(trimmed) ||
    // Catalan — "cobrat dues vegades", "cobrament doble"
    /\bcobrat\s+(?:dues\s+vegades|2\s+vegades)\b/i.test(trimmed) ||
    /\bcobrament\s+doble\b/i.test(trimmed) ||
    // French — "débité deux fois", "double débit"
    /\bd[eé]bit[eé]\s+deux\s+fois\b/i.test(trimmed) ||
    /\bdouble\s+d[eé]bit\b/i.test(trimmed)
  )
}

// ── Discount-code intent detection (Caso 8) ──────────────────────────────────
//
// Topic classifier (rule #6 tracked exemption — fast-path before the LLM).
// Returns true when the customer expresses they have a discount code, even
// if they don't paste the value inline (the bot will ask for it).
//
// REGRESSION (Andrea, 2026-05-09): real chat showed the bot ignored the
// intent because the customer typed "teng un codigo" (typo: missing 'o' on
// the verb). The original regex required exactly "tengo" and silently
// failed, so the bot drifted into the generic machine-troubleshooting flow
// asking for type / number / display.
//
// Same fix shape as `detectDoubleChargeIntent`: relax the verb prefix
// (allow "teng/tengo/tenga/tnego" with `t[ie]ng[oai]?`), and also accept
// phrasings that mention "código + no sé cómo / cómo usar / dónde poner"
// without any leading verb. Multi-language coverage on the 6 supported
// languages (rule #8). Tested in `__tests__/unit/intent.test.ts`.
export function detectDiscountCodeIntent(message: string): boolean {
  const trimmed = message.toLowerCase()
  if (!trimmed) return false
  return (
    // Spanish — verb-prefix permissive ("teng", "tengo"), plus standalone
    // "código + (no sé cómo | cómo uso | dónde pongo)" phrasings.
    /\bt[ie]ng[oai]?\s+un\s+c[oó]digo\b/i.test(trimmed) ||
    /\bc[oó]digo\s+(?:de\s+descuento\s+)?(?:y\s+|que\s+)?(?:no\s+s[eé]\s+c[oó]mo|c[oó]mo\s+(?:lo\s+)?(?:uso|usar|usarlo|utilizar|utilizarlo|utilizo)|d[oó]nde\s+(?:lo\s+)?(?:pongo|poner|ponerlo|meto|meterlo))/i.test(trimmed) ||
    // Italian — "ho un codice", "codice + non so come / come uso / dove metterlo"
    /\bho\s+un\s+codice\b/i.test(trimmed) ||
    /\bcodice\s+(?:e\s+)?(?:non\s+so\s+come|come\s+(?:lo\s+)?(?:uso|usare|utilizzo|utilizzarlo)|dove\s+(?:lo\s+)?(?:metto|mettere|mettelo))/i.test(trimmed) ||
    // English — "I have a code", "code + don't know how / how to use / where to put"
    /\bi\s+have\s+(?:a|the)\s+code\b/i.test(trimmed) ||
    /\bcode\s+(?:and\s+)?(?:i\s+don'?t\s+know\s+how|how\s+(?:to|do\s+i)\s+(?:use|enter)|where\s+(?:to|do\s+i)\s+(?:put|enter))/i.test(trimmed) ||
    // Portuguese — "tenho um código", "código + não sei como / onde colocar"
    /\btenho\s+um\s+c[oó]digo\b/i.test(trimmed) ||
    /\bc[oó]digo\s+(?:e\s+)?(?:n[ãa]o\s+sei\s+como|como\s+(?:o\s+)?(?:uso|usar|utilizar|utilizo)|onde\s+(?:o\s+)?(?:ponho|colocar|meter|meto))/i.test(trimmed) ||
    // Catalan — "tinc un codi", "codi + no sé com / on poso"
    /\btinc\s+un\s+codi\b/i.test(trimmed) ||
    /\bcodi\s+(?:i\s+)?(?:no\s+s[eé]\s+com|com\s+(?:el\s+)?(?:uso|usar|utilitzar|utilitzo)|on\s+(?:el\s+)?(?:poso|posar|fico))/i.test(trimmed) ||
    // French — "j'ai un code", "code + comment utiliser / où mettre"
    /\bj['']?\s*ai\s+(?:un|le)\s+code\b/i.test(trimmed) ||
    /\bcode\s+(?:et\s+)?(?:je\s+ne\s+sais\s+comment|comment\s+(?:l'?\s*)?(?:utiliser|utilise)|o[uù]\s+(?:le\s+)?(?:mettre|mets|saisir))/i.test(trimmed)
  )
}

// ── Invoice intent detection (Caso 9) ─────────────────────────────────────────
//
// Topic classifier (rule #6 tracked exemption — fast-path before the LLM).
// Returns true when the customer asks for an invoice / factura. Multi-
// language coverage (es/it/en/pt/ca/fr) + tolerance for common typos
// ("factra", "fctra", "fattra"). Tested in `__tests__/unit/intent.test.ts`.
//
// REGRESSION (Andrea, 2026-05-09): the inline FACTURA_TOPIC regex in
// `guards/invoice-flow.ts` required exact "factura/fattura/invoice/etc."
// and silently failed on typos ("factra" → bot drifted into machine flow).
// Same pattern as Bug A on doble-cobro and Bug D on discount code.
export function detectInvoiceIntent(message: string): boolean {
  const trimmed = message.toLowerCase()
  if (!trimmed) return false
  return (
    // Spanish — "factura/facturas/quiero factura/necesito factura"
    /\bfactur[ao]s?\b/i.test(trimmed) ||
    // Italian — "fattura/fatture"
    /\bfattur[ae]\b/i.test(trimmed) ||
    // Portuguese — "fatura/faturas"
    /\bfatur[ao]s?\b/i.test(trimmed) ||
    // English — "invoice/invoices"
    /\binvoices?\b/i.test(trimmed) ||
    // French / Catalan — "facture/factures"
    /\bfactures?\b/i.test(trimmed) ||
    // Typo tolerance: "factra", "fctra", "fattra", "fattura" missing letters.
    // Heuristic: word starts with "f", contains "ct" or "tt", ends with "ra/re/ras",
    // length 5-9. Catches common typos without over-matching.
    /\bf[aàeéiou]?[ct]+[rt]+[aàeéiou]s?\b/i.test(trimmed) &&
      /\b(?:quiero|necesito|me\s+(?:da|hace)|voglio|voglia|i\s+(?:want|need)|je\s+(?:veux|voudrais)|preciso|vull|hace\s+falta)\b/i.test(trimmed)
  )
}

// ── Topic-switch detection during pending escalation ─────────────────────────
//
// When the bot has already escalated (operatorRequested + customerNameRequested
// set) and the customer is being asked their name, sometimes the customer
// instead reports a NEW problem ("ahora me sale SEL", "tengo un código",
// "me cobraron dos veces"). Without a topic-switch reset, the bot's reply
// mixes the old escalation handover with the new topic guidance — a
// confused mess (Andrea-2026-05-09 chat: discount-code escalate +
// "mi da SEL ora la macchina" → bot mixed SEL guidance with operator
// handover line).
//
// This detector returns true when the user message looks like a new
// incident report rather than a name. The caller resets escalation flags
// and lets the pipeline re-run cleanly for the new topic.
export function detectTopicSwitchDuringEscalation(message: string): boolean {
  const trimmed = message.toLowerCase()
  if (!trimmed) return false
  return (
    // New display token reported (PUSH, SEL, DOOR, AL001, etc.)
    extractDisplayState(message) !== null ||
    // New "Caso 6" doble cobro intent
    detectDoubleChargeIntent(message) ||
    // New "Caso 8" discount code intent
    detectDiscountCodeIntent(message) ||
    // "Ahora me sale X / mi da X / aparece X" — phrasing of a new symptom
    /\b(?:ahora\s+(?:me\s+)?(?:sale|aparece|pone|dice)|mi\s+da|me\s+sale|aparece|adesso\s+mi\s+(?:da|appare))\b/i.test(trimmed) ||
    // Reports of new machine problems
    /\b(?:la\s+lavadora|la\s+secadora|the\s+(?:washer|dryer))\s+(?:no\s+(?:funciona|arranca|va)|sigue|otra\s+vez|otra)/i.test(trimmed)
  )
}

// ── Short reply classification ────────────────────────────────────────────────

export function isShortContextReply(message: string): boolean {
  const trimmed = message.trim()
  return (
    /^\d{1,2}$/.test(trimmed) ||
    /^(yes|y|si|sì|sí|no|n|ok|ok risolto|risolto|fatto|ora funziona|water|perfecto|perfect|perfetto|gracias|grazie|thanks|vale|claro|de\s+acuerdo|entendido|capito|got\s+it|d'accordo|adelante|continuamos)$/i.test(trimmed) ||
    isBlankDisplayReply(trimmed) ||
    isDisplayCodeLikeInput(trimmed)
  )
}

// ── Non-troubleshooting incident detection ──────────────────────────────────
// These are customer reports that should NOT enter the machine-troubleshooting
// flow (no machineType / machineNumber / displayState gathering). After
// capturing location, the case escalates to a human operator with a manual
// review message that includes "revisar / revisión".
// MULTILINGUA TODO: today the patterns are Spanish-only because ecolaundry is
// configured for Spanish. When more languages are enabled, move these strings
// to a per-language file or use an LLM classifier.
// ── Angry / frustrated tone detection ──────────────────────────────────────
// Detects when the customer's tone is aggressive, demanding, or very upset so
// the bot can prepend an empathetic acknowledgement ("Entiendo tu malestar...")
// before continuing the normal data gathering. MULTILINGUA TODO: kept Spanish
// + a few Italian/English roots since ecolaundry is Spanish-only today.
// ── Operational context ───────────────────────────────────────────────────────

export function isPaidButNotActivatedCase(
  state: SessionState,
  _issueSummary: string,
  routeMachineType: '' | 'washer' | 'dryer',
): boolean {
  if (routeMachineType !== 'washer' && routeMachineType !== 'dryer') return false
  if (state.paymentCompleted !== true) return false
  if (state.displayState) return false
  return true
}

// ── Machine type + route normalization ───────────────────────────────────────

// Canonical vocabulary used by the fuzzy matcher below. Keep entries ≥ 6
// chars so the distance threshold doesn't accidentally swallow short
// unrelated words ("gato", "lavar", "goya", …).
const WASHER_VOCAB = ['lavadora', 'lavatrice', 'washer', 'rentadora', 'lavelinge']
const DRYER_VOCAB = ['secadora', 'asciugatrice', 'dryer', 'assecadora', 'sechelinge']

/** Levenshtein distance (in-place DP, tiny). Used only on short tokens. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const m = a.length
  const n = b.length
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  const curr = new Array(n + 1).fill(0)
  for (let i = 1; i <= m; i += 1) {
    curr[0] = i
    for (let j = 1; j <= n; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    prev = curr.slice()
  }
  return prev[n]
}

/** True if `token` is within distance `maxDist` of any vocab entry whose
 *  length is similar (avoids matching across vastly different lengths). */
function fuzzyMatchesVocab(token: string, vocab: string[], maxDist: number): boolean {
  if (token.length < 6) return false
  for (const word of vocab) {
    if (Math.abs(word.length - token.length) > maxDist) continue
    if (levenshtein(token, word) <= maxDist) return true
  }
  return false
}

export function normalizeMachineType(value: unknown): '' | 'washer' | 'dryer' {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return ''
  // Strip non-letters for fuzzy comparison only ("lave-linge" → "lavelinge").
  const stripped = normalized.replace(/[^a-zàèéìòùáéíóúüñç]/gi, '')

  // Tier 1 — exact match on canonical vocab.
  if (['washer', 'lavatrice', 'lavadora', 'washing machine'].includes(normalized)) return 'washer'
  if (['dryer', 'asciugatrice', 'secadora'].includes(normalized)) return 'dryer'

  // Tier 2 — root regex (covers compound utterances and minor inflections).
  if (/lavat(?:rice|ric|rce)|lavador|wash(?:er|ing machine)/i.test(normalized)) return 'washer'
  if (/asci(?:ugatrice|ugatric)|ascig(?:atrice|aatrice|a+trice)|secador|dry(?:er|ing)/i.test(normalized)) return 'dryer'

  // Tier 3 — fuzzy match (Levenshtein ≤ 2) for typos like "lavaroda",
  // "lavdora", "secadra", "asciuagtrice". Kept conservative on length
  // (≥ 6 chars + similar-length filter) so unrelated short words never
  // accidentally classify.
  //
  // We scan TOKEN BY TOKEN because the input may be a full sentence
  // ("la lavaroda 5 no funciona"), not just a single word. Tokens are
  // letter-only fragments; numbers / punctuation split the boundary.
  const tokens = normalized.split(/[^a-zàèéìòùáéíóúüñç]+/i).filter(Boolean)
  for (const token of tokens) {
    if (fuzzyMatchesVocab(token, WASHER_VOCAB, 2)) return 'washer'
    if (fuzzyMatchesVocab(token, DRYER_VOCAB, 2)) return 'dryer'
  }
  // Also try the stripped form (removes hyphens for "lave-linge").
  if (fuzzyMatchesVocab(stripped, WASHER_VOCAB, 2)) return 'washer'
  if (fuzzyMatchesVocab(stripped, DRYER_VOCAB, 2)) return 'dryer'

  return ''
}

// ── Location / greeting / reset ───────────────────────────────────────────────

export function isAwaitingLocation(state: SessionState): boolean {
  return !state.location && state.lastMissingFacts.includes('location')
}

export function hasGreetingIntent(message: string): boolean {
  return /\b(ciao|ciao\s+come\s+stai|hello|hi|hola|buongiorno|buonasera)\b/i.test(message.trim())
}

export function detectLanguageHeuristic(message: string): SessionState['language'] | null {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return null

  if (/(¿|¡|secadora|lavadora|lavander[ií]a|arranc|otra vez|pantalla|centrifug|ropa|mojad|dinero|he pulsado|he premudo|como lo|autoservicio|cobrado|doble cobro|paso a paso|lavar|secar|captura|tarjeta|local|me sale|aparece en|sale en|no arranca|no funciona|no se activa|he pagado|he puesto|teneis|tenéis|ten[eé]is|qu[eé] horario|qu[eé] precio|cu[aá]nto cuesta|hola|estoy en|sí|por favor)/i.test(normalized)) {
    return 'es'
  }

  if (/(asciug|lavatrice|lavanderia|centrifug|bagnat|sportello|cosa devo fare|ho gia risposto|schermata|pagamento|carta|lavato|asciugato)/i.test(normalized)) {
    return 'it'
  }

  if (/(rentadora|assecadora|rentadora|rentar|assecar|carrer|localitat|cobrament|pantalla de la rentadora|no arrenca|ha cobrat|pas a pas)/i.test(normalized)) {
    return 'ca'
  }

  if (/(washer|dryer|laundromat|display shows|charged twice|double charge|step by step|card digits|screenshot|payment proof|did not start|does not start|i can'?t|hi|hello|my\s+(washer|dryer|machine))/i.test(normalized)) {
    return 'en'
  }

  // Portuguese: avoid matching Spanish "hola" as PT. Require explicit PT
  // markers (accented olá, ã, ç, voce, etc.) or PT-only spellings.
  if (/(\bolá\b|n[ãâ]o\s|lavandaria|m[áa]quina de lavar|m[áa]quina de secar|j[áa] paguei|comprovante|você|voce|estou em|obrigad[oa])/i.test(normalized)) {
    return 'pt'
  }

  if (/(bonjour|salut|lave-linge|s[èe]che-linge|laverie|ne marche pas|ne fonctionne pas|j'?ai pay[ée]|je n'?arrive pas|d[ée]j[àa] pay[ée]|machine [aà])/i.test(normalized)) {
    return 'fr'
  }

  return null
}

export function isLikelyStandaloneLocationInput(state: SessionState, message: string): boolean {
  const trimmed = message.trim()
  if (!(isAwaitingLocation(state) || (!state.location && trimmed.split(/\s+/).length <= 4))) return false
  if (!trimmed || trimmed.length > 60) return false
  if (/^\d+$/.test(trimmed)) return false
  if (isShortContextReply(trimmed)) return false
  if (hasGreetingIntent(trimmed)) return false
  if (normalizeMachineType(trimmed)) return false
  // Boundary signal: a question is never a standalone location reply. Catches
  // "¿qué orari avete?", "what are your hours?", "che orari avete?", etc.
  // across all 6 supported languages.
  // NOTE: \b is ASCII-only in JS regex without /u flag, so it does NOT match
  // after accented chars ("qué") — we use a non-word lookahead instead.
  if (/[?¿]/.test(trimmed)) return false
  if (/^(qu[eé]|che|what|cosa|qual|quel|quali|how|c[oó]mo|come|comment|com|when|cu[aá]ndo|quando|quan|onde|d[oó]nde|dove|o[uù]|on)(?=\s|$|[.,!?¿¡])/i.test(trimmed)) return false
  if (/lavatric|washer|lavadora|asciugatric|dryer|secadora|display|alm|door|push|sel|filtro|rotacion|aspiracion/i.test(trimmed)) {
    return false
  }
  // "No lo sé / no sé / no me acuerdo / ni idea" must not be captured as a
  // location — Caso 31 needs the bot to insist on the location instead.
  if (/^(no\s+lo\s+s[eé]|no\s+s[eé]|no\s+me\s+acuerdo|ni\s+idea|no\s+tengo\s+idea)(?:\s|$|[.,!?])/i.test(trimmed)) {
    return false
  }
  // Messages that mention an incident/FAQ keyword are NOT a standalone
  // location. E.g. "Tengo un código: 23432023" is Caso 18, not a location.
  // Multilingual coverage on FAQ topics so the active ES tenant correctly
  // routes a customer who happens to type "orari" (it) / "horaires" (fr) etc.
  if (/c[oó]digo|cobr|pag[uoa]|tarjeta|carta\s+fedelt|loyalty|datafono|factura|fattura|invoice|fatura|facture|recargar|ricaric|recharge|fidelizaci[oó]n|fidelit|horario|orario|orari|horaires?|hor[áa]rio|horari|opening|hours|cuesta|costa|cost|prezzo|precio|preu|pre[çc]o|price|prix|devolv|devu[ée]lv|reembolso|rimborso|refund|c[aá]maras|telecamere|cameras|ajax|monedas|monete|coins|dinero|denaro|money|gratis|free|gratuit|compensaci[oó]n|compensazione|compensation/i.test(trimmed)) {
    return false
  }
  return true
}

export function extractExplicitLocation(message: string): string | null {
  // Patterns:
  //   "estoy en Goya", "sono a Pineda", "i am at Hortes" → explicit "I am at"
  //   "...en Goya", "...en Pineda" → trailing "en <Loc>" reference (e.g.
  //     "el datáfono me ha cobrado 10€ en Goya"). Restricted to single-word
  //     known-style location names to avoid false positives.
  const explicit = message.match(/\b(?:sono a|sono in|mi trovo a|estoy en|estoy a|i am in|i'm in|i am at)\s+([A-Za-zÀ-ÿ' -]{2,40})/i)
  if (explicit) return explicit[1].split(/[.,!?]/)[0].trim()
  // Inline "en/a <Location>" pattern, case-insensitive — covers "En Pineda
  // me ha cobrado", "...a Goya", "Sto usando una lavatrice a Goya", etc.
  // Restrict to a single word after the preposition to avoid eating sentences
  // ("en realidad", "a la 5", etc. handled by filler skip).
  const trailing = message.match(/\b(?:en|a)\s+([A-ZÀ-ÿ][a-zà-ÿ']{2,20})\b/i)
  if (trailing) {
    const candidate = trailing[1].split(/[.,!?]/)[0].trim()
    // Skip filler words that often follow "en"/"a"
    if (!/^(realidad|verdad|cuanto|qu[eé]|la|el|los|las|este|esta|cu[aá]l|que)$/i.test(candidate)) {
      return candidate
    }
  }
  return null
}

// ── Payment parsing ───────────────────────────────────────────────────────────

export function parsePaymentAnswer(message: string): boolean | null {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return null

  if (/^(no|not yet|non ancora|ancora no)$/i.test(normalized)) {
    return false
  }

  if (/\b(non ho pagato|not paid|non pagato|no he pagado|todav[ií]a no)\b/i.test(normalized)) {
    return false
  }

  if (
    /^(yes|y|si|sì|sí)\b/i.test(normalized) ||
    /\b(ho pagato|pagato|paid|pagamento fatto|payment completed|fatto il pagamento|ho messo i soldi|messo i soldi|inserito i soldi)\b/i.test(normalized)
  ) {
    return true
  }

  return null
}

// ── Post-cycle issue detection ────────────────────────────────────────────────

// Re-export helpers from other modules so consumers can import from one place.
export { hasExtraButtonIssue, hasStopIntent }
