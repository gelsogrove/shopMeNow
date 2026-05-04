// Deterministic fact extraction from the customer message.
// Runs before the LLM call so sticky facts always reflect what the customer
// said, even if the agent fails to call set_* tools.
//
// Each extractor has an explicit guard: we only mutate state if we're
// reasonably confident the input maps to that fact. False positives are
// worse than missing extractions.

import type { AgentRuntime } from '../models/index.js'
import {
  extractDisplayState,
  extractExplicitLocation,
  isLikelyStandaloneLocationInput,
  normalizeMachineType,
} from './intent.js'
import { resolveKnownLocation, parseExplicitPaymentSignal } from './message-parsing.js'
import { resetMachineFacts } from './state.js'

// ── Display whitelist ────────────────────────────────────────────────────────
// Tokens that count as a "display state" when typed alone in uppercase.
// Restrictive on purpose: avoids capturing "OK", "NO", "SI" as a display.
//
// Patterns:
//   - Known recoverable codes: SEL, PUSH, PR, DOOR, ALM/DOOR, PRICE, BLANK
//   - Alarm family: ALM, ALN, ALN A, ALN N, AL001, 001
//   - Generic error codes: ERR + digits ("ERR 52", "ERR-52", "ERR52")
//   - Long uppercase codes (≥4 chars): "ERROR", "FAIL", "TIMEOUT"
const KNOWN_DISPLAY_TOKEN = /^(SEL|PUSH(?:\s+PROG)?|PR|DOOR|ALM(?:[\s\/]?(?:DOOR|A|E|VAR))?|ALN(?:\s*[AN])?|AL\s*0*01|0*01|END(?:\s*BAL)?|FILTRO|FALLO\s+DE\s+ROTACION|FALLO\s+DE\s+ASPIRACION|STOP|water)$/i
const ERR_CODE = /^ERR[\s\-]?\d{1,3}$/i
const LONG_CODE = /^[A-Z]{4,15}$/

function shouldAcceptAsDisplay(rawInput: string): boolean {
  const compact = rawInput.replace(/[.,!?¿¡:;"'()]/g, '').trim()
  if (!compact) return false
  // Yes/no in uppercase should NOT become a display.
  if (/^(OK|NO|SI|S[IÍ]|YES)$/i.test(compact)) return false
  if (KNOWN_DISPLAY_TOKEN.test(compact)) return true
  if (ERR_CODE.test(compact)) return true
  if (LONG_CODE.test(compact)) return true
  return false
}

// ── Public API ───────────────────────────────────────────────────────────────

// ── Topic-switch detector ────────────────────────────────────────────────────
// When the customer pivots to a different incident type (e.g. from a machine
// problem to a payment issue), we wipe the machine facts so the next reply
// doesn't mix old data into the new conversation.
//
// We trigger a switch when:
//   - The customer mentions datáfono / TPV / cobro+€ → payment incident
//   - The customer mentions cámaras / AJAX / soporte técnico → ops incident
//   - The customer says "anzi/wait/no" + mentions a different topic
//
// Conservative: only fire if there are already stale machine facts to wipe
// AND the new message contains an explicit pivot signal.
const PAYMENT_TOPIC = /(dat[aá]fono|tpv|me\s+ha\s+cobrad[ao]|charged\s+(?:me\s+)?\d+|\d+\s*€|cobrad[ao]\s+\d+)/i
const OPS_TOPIC = /(c[aá]maras|ajax|soporte\s+t[eé]cnico)/i
// Customer added more coins/money to a dryer but the minutes didn't increase
// (Caso 21 Alemanya, Caso 22 Pineda).
const DRYER_MINUTES_TOPIC = /(?:m[aá]s\s+dinero|m[aá]s\s+monedas|a[ñn]ad(?:i|ido|i[óo])\s+tiempo|a[ñn]ad(?:i|ido|i[óo])\s+monedas|put\s+more\s+money).*(?:secadora|asciugatrice|dryer)|(?:secadora|asciugatrice|dryer).*(?:no\s+(?:suma|sumado|sumam|sum[óo])|no\s+(?:lo\s+)?ha\s+sumado|no\s+aumenta|no\s+aument[óo])/i
// Customer can't pay with card (Caso 23 Alemanya, Caso 24 Hortes).
const CARD_FAIL_TOPIC = /(no\s+puedo\s+pagar\s+con\s+(?:la\s+)?tarjeta|(?:la\s+)?tarjeta\s+no\s+(?:funciona|va)\s+(?:para\s+)?(?:pagar)?|tarjeta\s+rechazada|card\s+(?:doesn'?t|won'?t)\s+work)/i
// Customer demands an immediate refund (Caso 26).
const REFUND_DEMAND_TOPIC = /(devolv[áa]is|devu[ée]lvanme|devu[ée]lveme|devoluci[oó]n\s+(?:ya|ahora|inmediata|inmediatamente)|quiero\s+(?:que\s+me\s+)?devolv|reembolso\s+(?:ya|ahora|inmediato))/i
// Customer demands a specific compensation (Caso 27).
const COMPENSATION_TOPIC = /((?:secadora|lavadora)\s+gratis|c[oó]digo\s+nuevo|compensaci[oó]n|free\s+(?:dryer|washer))/i
const SWITCH_HINT = /\b(anzi|aspetta|wait|en realidad|en realitat|de verdad|en\s+realidade|en\s+r[eé]alit[eé])\b/i

function detectTopicSwitch(state: { displayState: string; machineNumber: string; pendingFlow: string }, userMessage: string): boolean {
  const hasMachineFacts = !!(state.displayState || state.machineNumber || state.pendingFlow)
  if (!hasMachineFacts) return false
  const text = userMessage.toLowerCase()
  if (PAYMENT_TOPIC.test(text)) return true
  if (OPS_TOPIC.test(text)) return true
  if (DRYER_MINUTES_TOPIC.test(text)) return true
  if (CARD_FAIL_TOPIC.test(text)) return true
  if (REFUND_DEMAND_TOPIC.test(text)) return true
  if (COMPENSATION_TOPIC.test(text)) return true
  if (SWITCH_HINT.test(text) && /(c[oó]digo|ticket|factura|tarjeta|datafono|cobrado|pago|cambio)/i.test(text)) return true
  return false
}

export function autoExtractFacts(ar: AgentRuntime, userMessage: string): void {
  const trimmed = userMessage.trim()
  if (!trimmed) return
  const state = ar.state

  // Post-resolution reset (R2 in the architecture doc).
  //
  // Single trigger: `state.pendingClosure === 'resolved'`.
  //
  // pendingClosure is set in exactly two places, both explicit:
  //   1. The `mark_resolved` tool, called by the LLM when the customer
  //      confirms the issue is fixed. (Mandatory per system prompt.)
  //   2. The flow engine, when a non-escalating terminal node is reached.
  //
  // We do NOT try to guess "is this a new incident?" from the message
  // text. Intent classification is the LLM's job. If the LLM forgets
  // mark_resolved, the next turn answers with stale state — that is a
  // prompt-side bug, not an extractor-side bug, and is handled by
  // strengthening the prompt rather than by piling regex heuristics here.
  if (state.pendingClosure === 'resolved') {
    resetMachineFacts(state)
    state.pendingClosure = null
    ar.resolved = false
  }

  // Topic-switch detection — runs first so the rest of the extractor doesn't
  // re-populate stale machine facts from the previous conversation segment.
  if (detectTopicSwitch(state, userMessage)) {
    resetMachineFacts(state)
    // Mark the new incident type so the gather guards don't keep asking
    // about machineType/number when the conversation is now about payment.
    if (PAYMENT_TOPIC.test(userMessage)) {
      state.nonTroubleshootingIncident = 'datafono-wrong-amount'
    } else if (OPS_TOPIC.test(userMessage)) {
      state.nonTroubleshootingIncident = 'cameras-or-ajax'
    } else if (DRYER_MINUTES_TOPIC.test(userMessage)) {
      state.nonTroubleshootingIncident = 'dryer-minutes-not-credited'
    } else if (CARD_FAIL_TOPIC.test(userMessage)) {
      state.nonTroubleshootingIncident = 'card-payment'
    }
    // Allow location override on topic switch: if the customer mentions a
    // different location in the same message ("Estoy en Goya y el datáfono..."),
    // overwrite the previous one. We only do this when topic switches.
    const explicitNew = extractExplicitLocation(trimmed)
    if (explicitNew) {
      const known = resolveKnownLocation(explicitNew)
      state.location = known || explicitNew
    }
  }

  // First-message non-troubleshooting incident detector (no previous facts).
  // Triggers the same flag so the gather guards skip machine-type/number for
  // pure payment-related complaints.
  if (!state.nonTroubleshootingIncident && state.turnCount <= 1) {
    if (PAYMENT_TOPIC.test(userMessage)) {
      state.nonTroubleshootingIncident = 'datafono-wrong-amount'
    } else if (OPS_TOPIC.test(userMessage)) {
      state.nonTroubleshootingIncident = 'cameras-or-ajax'
    } else if (DRYER_MINUTES_TOPIC.test(userMessage)) {
      state.nonTroubleshootingIncident = 'dryer-minutes-not-credited'
    } else if (CARD_FAIL_TOPIC.test(userMessage)) {
      state.nonTroubleshootingIncident = 'card-payment'
    } else if (REFUND_DEMAND_TOPIC.test(userMessage)) {
      state.nonTroubleshootingIncident = 'refund-demand'
    } else if (COMPENSATION_TOPIC.test(userMessage)) {
      state.nonTroubleshootingIncident = 'compensation-demand'
    } else if (
      // Caso 28: messaggio T1 con narrativa intrinsecamente contraddittoria
      // (pago doppio + cobro mixto + dubbi ripetuti). Pattern: cobró dos
      // veces / aunque también pagué + creo / no sé / o algo así.
      /(cobr[oó]\s+dos\s+veces|me\s+han\s+cobrad[oa]\s+(?:dos|2)\s+veces).*(creo|no\s+s[eé]|aunque|tambi[eé]n\s+pagu[eé]|no\s+lo\s+s[eé])/i.test(userMessage)
    ) {
      state.nonTroubleshootingIncident = 'contradictory-narrative'
    }
  }

  // Location — first try explicit pattern ("estoy en Goya"), then standalone
  // input ("Goya"). Resolve against known locations.json keys; if the
  // customer types an unknown city/name (e.g. "Girona"), do NOT set the
  // location — let guardCaso31InsistLocation re-ask. Mataró aside (multiple
  // streets), we only operate in 6 known laundries so unknown names are
  // either a typo or a wrong assumption from the customer.
  if (!state.location) {
    const explicit = extractExplicitLocation(trimmed)
    const candidate = explicit || (isLikelyStandaloneLocationInput(state, trimmed) ? trimmed : null)
    if (candidate) {
      const known = resolveKnownLocation(candidate)
      if (known) {
        state.location = known
      } else {
        // Mark for clarification — bot should insist on a valid location.
        state.locationClarificationCount = (state.locationClarificationCount || 0) + 1
      }
    }
  }

  // Mataró street — when the bot has just asked the street (locationStreetRequested),
  // capture the customer reply as the street. We only capture if location is
  // Mataró (the only multi-street laundry).
  if (state.location && /^matar[oó]$/i.test(state.location.trim()) && !state.locationStreet && state.locationStreetRequested) {
    const street = trimmed.replace(/[.,!?¿¡:;"'()]/g, '').trim()
    if (street && !/^matar[oó]$/i.test(street)) {
      state.locationStreet = street
    }
  }

  // Machine type — extract whenever the message explicitly names one.
  // Cumulative semantics (R4): if the customer types a recognised machine
  // word (washer/dryer/typo) we update state.machineType. The LLM owns
  // intent: if the customer is switching machines mid-conversation, the
  // LLM calls mark_resolved on the previous case first; the post-
  // resolution reset above clears stale facts before this point.
  if (!state.machineType) {
    const mt = normalizeMachineType(trimmed)
    if (mt) state.machineType = mt
  }

  // Machine number — extract on first mention. Two patterns:
  //   1. Whole message is the number ("4", "la 4", "numero 4"). Only when
  //      location is known, to avoid grabbing a stray digit too early.
  //   2. Inline in a sentence ("...lavadora 5", "secadora 3").
  //   3. Fuzzy fallback: machineType just set in this turn but the inline
  //      regex didn't match the keyword (typo case "lavaroda 5") — grab
  //      the first 1-3 digit number.
  if (!state.machineNumber) {
    if (state.location) {
      const whole = trimmed.match(/^\s*(?:la\s+|n\.?\s*|num(?:ero)?\s*[:.#]?\s*)?(\d{1,3})\s*$/i)
      if (whole) state.machineNumber = whole[1]
    }
    if (!state.machineNumber) {
      const inline = trimmed.match(/\b(?:lavadora|secadora|lavatrice|asciugatrice|washer|dryer|rentadora|assecadora)\s+(?:n[º°.]?\s*|num(?:ero)?\s*[:.#]?\s*)?(\d{1,3})\b/i)
      if (inline) state.machineNumber = inline[1]
    }
    if (!state.machineNumber && state.machineType) {
      const fuzzyNum = trimmed.match(/\b(\d{1,3})\b/)
      if (fuzzyNum) state.machineNumber = fuzzyNum[1]
    }
  }
  // Display state — covers SEL/PUSH/DOOR/ALM family/AL001/PRICE/BLANK first;
  // then any uppercase short token that matches the display whitelist.
  // We require state.machineType to be known so we don't grab "PINEDA" or
  // "GOYA" as a display when they're really pueblos.
  //
  // DISPLAY-CHANGE RULE: we accept a NEW display even when state.displayState
  // is already set, IF the message contains a recognised display token that
  // is different from the one in state. This covers the "progress" case
  // where the customer follows the canonical instruction (SEL → presses the
  // machine number → display advances to PUSH) and reports the new code.
  // Without this rule the flow engine sees "no" and routes to case_X_persist
  // (escalation), which is wrong: the display has CHANGED, not persisted.
  const newDisplay = extractDisplayState(trimmed)
  if (newDisplay && newDisplay !== state.displayState) {
    state.displayState = newDisplay
  } else if (!state.displayState && state.machineType && shouldAcceptAsDisplay(trimmed)) {
    state.displayState = trimmed.replace(/[.,!?¿¡:;"'()]/g, '').trim().toUpperCase()
  }

  // Payment signal. If we just asked "¿Has podido realizar el pago?", accept
  // a bare yes/no answer without requiring payment-context keywords.
  if (state.paymentCompleted === null) {
    const paid = parseExplicitPaymentSignal(trimmed)
    if (paid !== null) {
      state.paymentCompleted = paid
    } else if (state.paymentRequested) {
      const lower = trimmed.toLowerCase().replace(/[.,!?¿¡]/g, '').trim()
      if (/^(s[ií]|yes|oui|sim|ok|vale|claro|por\s+supuesto)(\s|$)/.test(lower)) state.paymentCompleted = true
      else if (/^(no|non|nope|nao)(\s|$)/.test(lower)) state.paymentCompleted = false
    }
    if (state.paymentCompleted !== null) state.paymentRequested = false
  }

  // Caso 7 marker: customer said "He pagado pero no he podido usar".
  // Sets pendingFlow so the guard pipeline can short-circuit on the next turn
  // with "¿La central te ha devuelto el cambio?".
  if (
    !state.pendingFlow &&
    /he\s+pagado.+(no\s+(he\s+podido|consegui|logr[eé])\s+usar|no\s+(la\s+)?(he\s+podido\s+)?utilizar)/i.test(userMessage)
  ) {
    state.pendingFlow = 'caso7-ask-cambio'
    state.caso7Active = true
  }

  // Customer name capture: when the bot has explicitly asked for the name
  // (customerNameRequested=true) and the user replies with a valid name
  // token, persist it. This is a deterministic fallback for when the LLM
  // does not call the capture_customer_name tool.
  if (state.customerNameRequested && !state.customerName) {
    const cleaned = trimmed.replace(/[.,!?¿¡]/g, '').trim()
    const nameToken = cleaned.split(/\s+/)[0] || ''
    const lowered = nameToken.toLowerCase()
    const looksLikeAnswer = /^(no|si|sí|s[íi]|yes|ok|okay|vale|claro|gracias|grazie|thanks|perfecto|perfect|perfetto|entendido|capito|got|nope|nada)$/i.test(lowered)
    const isPureNumber = /^\d+$/.test(nameToken)
    const isShortToken = nameToken.length < 2
    const isLikelyName = /^[A-Za-zÀ-ÖØ-öø-ÿ'][A-Za-zÀ-ÖØ-öø-ÿ'-]+$/.test(nameToken)
    if (!looksLikeAnswer && !isPureNumber && !isShortToken && isLikelyName) {
      state.customerName = nameToken
      state.customerNameRequested = false
    }
  }

  // Caso 4 marker: customer said "He pagado y no se ha activado" (or similar).
  // Different from Caso 7: here the issue is about activation (not "he pagado pero
  // no he podido usar"). Flow asks tipo → numero → cambio (NOT display, NOT pago).
  if (
    !state.pendingFlow &&
    /he\s+pagado.+no\s+se\s+(ha\s+)?activad/i.test(userMessage)
  ) {
    state.pendingFlow = 'caso4-ask-cambio'
  }

  // Caso 8 marker: customer says "tengo un código y no sé cómo usarlo" or
  // similar — but WITHOUT giving the code value inline. If they include a
  // numeric value ("Tengo un código: 23432023") it's Caso 18 (incoherence)
  // handled below. If they include an alphanumeric value with letters
  // ("Tengo un código AB12345") we still ask for the code anyway (the doc
  // step expects the customer to repeat it).
  const inlineCodeValue = userMessage.match(/c[oó]digo[\s:.,-]+([A-Za-z0-9-]{3,})/i)?.[1] || ''
  const inlineNumericCode = inlineCodeValue && /^\d{3,}$/.test(inlineCodeValue)
  if (
    !state.pendingFlow &&
    !inlineNumericCode &&
    /(tengo\s+un\s+c[oó]digo|c[oó]digo\s+que?\s+(?:no\s+s[eé]\s+c[oó]mo|usar)|how\s+to\s+use\s+(?:this|the)\s+code)/i.test(userMessage)
  ) {
    state.pendingFlow = 'caso8-ask-code'
  }

  // Caso 17 marker: customer says they can't read the display. Triggers the
  // photo-or-escalate path.
  if (
    !state.pendingFlow &&
    /(no\s+s[eé]\s+(?:qu[eé]|qué)\s+pone|no\s+veo\s+(?:bien\s+)?la\s+pantalla|no\s+puedo\s+leer\s+la\s+pantalla|pero\s+no\s+s[eé]\s+qu[eé])/i.test(userMessage)
  ) {
    state.pendingFlow = 'caso17-ask-photo'
    state.displayUnreadable = true
  }

  // Caso 6 marker: customer reports a doble cobro / charged twice. Triggers
  // the dedicated flow: ask "¿has podido lavar/secar?", then relato, then
  // 4 dígitos, then captura.
  if (
    !state.pendingFlow &&
    /(me\s+(?:han\s+|hab[eé]is\s+|ha\s+)?cobrad[ao]\s+(?:dos\s+veces|2\s+veces|m[aá]s\s+de\s+una\s+vez|el\s+doble)|doble\s+cobro|charged\s+(?:me\s+)?twice|cobr[oó]\s+dos\s+veces)/i.test(userMessage)
  ) {
    state.pendingFlow = 'caso6-ask-podido-lavar'
  }

  // Caso 18 marker: customer says "tengo un código: NNNNN" with a numbers-only
  // value (no letters before the digits). Real Ecolaundry codes have letter
  // prefixes (e.g. "AB12345"); a pure-numeric code is a sign of incoherence.
  // Per doc Caso 18 the bot must ask once "¿ves alguna letra delante?" and,
  // if customer says no, escalate without confronting.
  if (
    !state.pendingFlow &&
    /(?:tengo|tenho|ho|i\s+have)\s+(?:un\s+)?(?:c[oó]digo|codice|code)[\s:.,-]*([A-Za-z0-9-]{3,})/i.test(userMessage)
  ) {
    const m = userMessage.match(/(?:c[oó]digo|codice|code)[\s:.,-]*([A-Za-z0-9-]{3,})/i)
    const codeValue = m?.[1] || ''
    if (codeValue && /^\d{3,}$/.test(codeValue)) {
      state.faqCodeValue = codeValue
      state.pendingFlow = 'numeric-code-ask-letters'
    }
  }
}
