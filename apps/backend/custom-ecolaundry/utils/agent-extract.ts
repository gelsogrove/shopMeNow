// Deterministic fact extraction from the customer message.
// Runs before the LLM call so sticky facts always reflect what the customer
// said, even if the agent fails to call set_* tools.
//
// Each extractor has an explicit guard: we only mutate state if we're
// reasonably confident the input maps to that fact. False positives are
// worse than missing extractions.

import type { AgentRuntime, Runtime } from '../models/index.js'
import {
  extractDisplayState,
  extractDisplayLabel,
  extractExplicitLocation,
  isLikelyStandaloneLocationInput,
  normalizeMachineType,
  detectDoubleChargeIntent,
  detectDiscountCodeIntent,
  detectTopicSwitchDuringEscalation,
} from './intent.js'
import { resolveKnownLocation, parseExplicitPaymentSignal } from './message-parsing.js'
import { RECOVERABLE_DISPLAYS } from './guards/helpers.js'
import { resetMachineFacts } from './state.js'
import { resetPostEscalationFlags } from './state-transitions.js'
import { getPattern, matchPattern } from './nlu.js'

// Display whitelist & topic-switch detection — pattern definitions live in
// json/nlu-patterns.json. The functions below only orchestrate the lookups;
// see docs/ecolaundry/usecases.md for the underlying business rules.

function shouldAcceptAsDisplay(runtime: Runtime, rawInput: string): boolean {
  const sanitize = getPattern(runtime, 'displaySanitize')
  const compact = rawInput.replace(sanitize, '').trim()
  if (!compact) return false
  // Yes/no in uppercase should NOT become a display.
  if (matchPattern(runtime, 'yesNoUppercase', compact)) return false
  if (matchPattern(runtime, 'displayKnownToken', compact)) return true
  if (matchPattern(runtime, 'displayErrCode', compact)) return true
  if (matchPattern(runtime, 'displayLongCode', compact)) return true
  return false
}

/**
 * Contextual display capture — used only when ALL THREE prerequisite facts
 * (location, machineType, machineNumber) are already known and displayState
 * is still empty. At that point the bot has just asked "qué aparece en la
 * pantalla?" so any short, non-conversational token IS the display code.
 *
 * Covers gaps left by shouldAcceptAsDisplay:
 *   - Bare digits:           "4", "12"
 *   - Letter+digit combos:   "E3", "F5", "A2", "E32"
 *   - Short uppercase codes: "AB", "EC"  (2-3 chars not in the main whitelist)
 *
 * The 1-3 char limit keeps conversational words ("bien", "vale", "claro")
 * out of scope. yesNoUppercase exclusion covers yes/no in all 6 languages.
 */
function isDisplayContextCode(runtime: Runtime, rawInput: string): boolean {
  const sanitize = getPattern(runtime, 'displaySanitize')
  const compact = rawInput.replace(sanitize, '').trim()
  if (!compact) return false
  if (matchPattern(runtime, 'yesNoUppercase', compact)) return false
  return matchPattern(runtime, 'displayContextCode', compact)
}

function detectTopicSwitch(
  runtime: Runtime,
  state: { displayState: string; machineNumber: string; pendingFlow: string },
  userMessage: string,
): boolean {
  const hasMachineFacts = !!(state.displayState || state.machineNumber || state.pendingFlow)
  if (!hasMachineFacts) return false
  const text = userMessage.toLowerCase()
  if (matchPattern(runtime, 'topicPayment', text)) return true
  if (matchPattern(runtime, 'topicOps', text)) return true
  if (matchPattern(runtime, 'topicDryerMinutes', text)) return true
  if (matchPattern(runtime, 'topicCardFail', text)) return true
  if (matchPattern(runtime, 'topicRefundDemand', text)) return true
  if (matchPattern(runtime, 'topicCompensation', text)) return true
  if (
    matchPattern(runtime, 'switchHint', text) &&
    matchPattern(runtime, 'topicCorrectionContext', text)
  ) {
    return true
  }
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

  // Topic-switch reset (Bug #13.6 + MIX 1 orchestration, Andrea-2026-05-09).
  //
  // Two reset triggers:
  //   1. Pending escalation: bot already escalated, customer changes topic.
  //      Without reset the bot would mix the handover line with the new
  //      topic guidance (Andrea's xxjdse7 → "mi da SEL" chat).
  //   2. Mid-flow (no escalation): bot is waiting for a typed answer to a
  //      narrow question (e.g. discount-code-await expects a SAU2904266
  //      string), but the customer abandons / pivots ("mejor olvídalo,
  //      me sale SEL"). The flow's strict validator would treat the pivot
  //      as 2nd invalid → escalate when the customer just wants to switch
  //      topics. The topic-switch detector resets the flow so the new
  //      topic (display code) can be picked up by the canonical pipeline.
  //
  // The topic-switch detector requires specific signals (display code
  // extracted, double-charge intent, discount-code intent, "ahora me
  // sale X / mi da X" phrasings) — it's not just any non-canonical input.
  // We deliberately do NOT check `!validateCustomerName(trimmed).valid`
  // because that helper is permissive (accepts any 2+ char first word
  // as a name) — it would say "mi" in "mi da SEL" is a valid name and
  // block the reset. The topic-switch detector is specific enough to win.
  //
  // FLOWS_RESETABLE_ON_TOPIC_SWITCH lists the pendingFlow values from
  // which a customer pivot is legitimate. Active troubleshooting flows
  // are NOT listed because autoExtractFacts already captures new display
  // codes naturally there — no reset needed.
  const FLOWS_RESETABLE_ON_TOPIC_SWITCH = new Set<string>([
    'discount-code-await',
    'discount-code-await-name',
    'discount-code-await-location',
    'discount-code-await-machine',
    'discount-code-await-door',
    'numeric-code-ask-letters',
    'numeric-code-await-answer',
  ])
  const inResetableFlow = FLOWS_RESETABLE_ON_TOPIC_SWITCH.has(state.pendingFlow)
  const inPendingEscalation =
    state.operatorRequested && state.customerNameRequested
  if (
    (inPendingEscalation || inResetableFlow) &&
    detectTopicSwitchDuringEscalation(trimmed)
  ) {
    resetPostEscalationFlags(ar)
    resetMachineFacts(state)
  }

  // Topic-switch detection — runs first so the rest of the extractor doesn't
  // re-populate stale machine facts from the previous conversation segment.
  if (detectTopicSwitch(ar.runtime, state, userMessage)) {
    resetMachineFacts(state)
    // Mark the new incident type so the gather guards don't keep asking
    // about machineType/number when the conversation is now about payment.
    if (matchPattern(ar.runtime, 'topicPayment', userMessage)) {
      state.nonTroubleshootingIncident = 'datafono-wrong-amount'
    } else if (matchPattern(ar.runtime, 'topicOps', userMessage)) {
      state.nonTroubleshootingIncident = 'cameras-or-ajax'
    } else if (matchPattern(ar.runtime, 'topicDryerMinutes', userMessage)) {
      state.nonTroubleshootingIncident = 'dryer-minutes-not-credited'
    } else if (matchPattern(ar.runtime, 'topicCardFail', userMessage)) {
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
    if (matchPattern(ar.runtime, 'topicPayment', userMessage)) {
      state.nonTroubleshootingIncident = 'datafono-wrong-amount'
    } else if (matchPattern(ar.runtime, 'topicOps', userMessage)) {
      state.nonTroubleshootingIncident = 'cameras-or-ajax'
    } else if (matchPattern(ar.runtime, 'topicDryerMinutes', userMessage)) {
      state.nonTroubleshootingIncident = 'dryer-minutes-not-credited'
    } else if (matchPattern(ar.runtime, 'topicCardFail', userMessage)) {
      state.nonTroubleshootingIncident = 'card-payment'
    } else if (matchPattern(ar.runtime, 'topicRefundDemand', userMessage)) {
      state.nonTroubleshootingIncident = 'refund-demand'
    } else if (matchPattern(ar.runtime, 'topicCompensation', userMessage)) {
      state.nonTroubleshootingIncident = 'compensation-demand'
    } else if (
      // Caso 28: messaggio T1 con narrativa intrinsecamente contraddittoria
      // (pago doppio + cobro mixto + dubbi ripetuti). Pattern: cobró dos
      // veces / aunque también pagué + creo / no sé / o algo así.
      matchPattern(ar.runtime, 'topicContradictoryNarrative', userMessage)
    ) {
      state.nonTroubleshootingIncident = 'contradictory-narrative'
    }
  }

  // Location — first try explicit pattern ("estoy en Goya"), then standalone
  // input ("Goya"). Resolve against known locations.json keys; if the
  // customer types an unknown city/name (e.g. "Girona"), do NOT set the
  // location — let guardInsistLocation re-ask. Mataró aside (multiple
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
  // We snapshot whether machineNumber existed BEFORE this extraction pass so
  // the contextual display branch (below) can distinguish between:
  //   • User answering the machine-number question ("3") → machineNumber set
  //     here for the first time → contextual display must NOT fire.
  //   • User answering the display question ("4") on a later turn where
  //     machineNumber was already known → contextual display fires correctly.
  const machineNumberWasAlreadySet = !!state.machineNumber
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
    // Preserve the customer-facing label (e.g. "PUSH PROG") for the operator
    // handover summary. Without this the operator reads the canonical token
    // ("PUSH") and loses the customer's exact wording.
    state.displayLabel = extractDisplayLabel(trimmed, newDisplay)
  } else if (!state.displayState && state.machineType && shouldAcceptAsDisplay(ar.runtime, trimmed)) {
    const captured = trimmed.replace(/[.,!?¿¡:;"'()]/g, '').trim().toUpperCase()
    state.displayState = captured
    state.displayLabel = captured
  } else if (
    !state.displayState &&
    state.location &&
    state.machineType &&
    machineNumberWasAlreadySet &&
    isDisplayContextCode(ar.runtime, trimmed)
  ) {
    // All 3 prerequisites were known BEFORE this turn → bot has already asked
    // "qué aparece en la pantalla?" so any short alphanumeric token is the display.
    // machineNumberWasAlreadySet (not state.machineNumber) prevents false capture
    // when the user answers the machine-number question with a digit like "4".
    const captured = trimmed.replace(/[.,!?¿¡:;"'()]/g, '').trim().toUpperCase()
    state.displayState = captured
    state.displayLabel = captured
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

  // Inferred payment from a recoverable display code (Andrea-2026-05-09).
  //
  // When `state.displayState` is set to a recoverable code (PUSH / SEL /
  // DOOR / PRICE / BLANK / ...) and `paymentCompleted` is still null,
  // we INFER the payment was made. Rationale: those displays only appear
  // AFTER payment has been processed by the central. Asking "¿has pagado?"
  // when the display already proves payment is redundant — and worse,
  // the dryer flow's `step_0` asks exactly that, then routes to pay_help
  // on a "no" reply, breaking the resolution.
  //
  // REGRESSION fixed: Andrea's "me sale push prog" + secadora chat. The
  // dryer flow started at step_0 (payment ask) instead of jumping to
  // problem_check. The inference makes the flow engine's existing
  // entry-node logic (flow-engine.ts:103) skip step_0 correctly.
  if (
    state.paymentCompleted === null &&
    state.displayState &&
    RECOVERABLE_DISPLAYS.has(state.displayState.toUpperCase())
  ) {
    state.paymentCompleted = true
  }

  // Caso 7 marker: customer said "He pagado pero no he podido usar".
  // Sets pendingFlow so the guard pipeline can short-circuit on the next turn
  // after collecting location + machineType + machineNumber with
  // "¿La central te ha devuelto el cambio?".
  // Caso 7 trigger (inline regex — left as-is until a real bug requires
  // typo tolerance. Speculative refactor reverted on 2026-05-09 audit:
  // pattern-guessed multi-lang coverage was failing on simple variants
  // like "Pagué pero no arranca" without producing real-world value.)
  if (
    !state.pendingFlow &&
    /he\s+pagado.+(no\s+(he\s+podido|consegui|logr[eé])\s+usar|no\s+(la\s+)?(he\s+podido\s+)?utilizar)/i.test(userMessage)
  ) {
    state.pendingFlow = 'paid-not-used-ask-change'
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
  // Caso 4 trigger (inline regex — left as-is until a real bug requires
  // typo tolerance. Speculative refactor reverted on 2026-05-09 audit.)
  if (
    !state.pendingFlow &&
    /he\s+pagado.+no\s+se\s+(ha\s+)?activad/i.test(userMessage)
  ) {
    state.pendingFlow = 'no-change-ask'
    resetPostEscalationFlags(ar)
  }

  // Caso 8 marker: customer says "tengo un código y no sé cómo usarlo" or
  // similar — but WITHOUT giving the code value inline. If they include a
  // numeric value ("Tengo un código: 23432023") it's Caso 18 (incoherence)
  // handled below. If they include an alphanumeric value with letters
  // ("Tengo un código AB12345") we still ask for the code anyway (the doc
  // step expects the customer to repeat it).
  // Detection delegated to `detectDiscountCodeIntent` (utils/intent.ts) —
  // multi-language + permissive on common verb-prefix typos.
  // REGRESSION (Andrea, 2026-05-09): real chat showed "teng un codigo y
  // no se como utilizarlo" (typo "teng" + variant "utilizarlo") fell
  // through silently. Same pattern as Bug A on the doble-cobro detector.
  const inlineCodeValue = userMessage.match(/c[oó]digo[\s:.,-]+([A-Za-z0-9-]{3,})/i)?.[1] || ''
  const inlineNumericCode = inlineCodeValue && /^\d{3,}$/.test(inlineCodeValue)
  if (
    !state.pendingFlow &&
    !inlineNumericCode &&
    detectDiscountCodeIntent(userMessage)
  ) {
    state.pendingFlow = 'discount-code-ask'
    resetPostEscalationFlags(ar)
  }

  // Caso 17 marker: customer says they can't read the display. Triggers the
  // photo-or-escalate path.
  if (
    !state.pendingFlow &&
    /(no\s+s[eé]\s+(?:qu[eé]|qué)\s+pone|no\s+veo\s+(?:bien\s+)?la\s+pantalla|no\s+puedo\s+leer\s+la\s+pantalla|pero\s+no\s+s[eé]\s+qu[eé])/i.test(userMessage)
  ) {
    state.pendingFlow = 'photo-await-decision'
    state.displayUnreadable = true
    resetPostEscalationFlags(ar)
  }

  // Caso 6 marker: customer reports a doble cobro / charged twice. Triggers
  // the dedicated flow: ask "¿has podido lavar/secar?", then on YES:
  // tipo → número → relato → 4 dígitos → captura. Detection is delegated
  // to `detectDoubleChargeIntent` (utils/intent.ts) which handles the 6
  // supported languages and is permissive on common verb-prefix typos
  // (regression Andrea-2026-05-09: "me habieis cobrado" — typo, used to
  // fall through silently because the original regex required exactly
  // hab[eé]is).
  if (!state.pendingFlow && detectDoubleChargeIntent(userMessage)) {
    state.pendingFlow = 'double-charge-ask-used'
    resetPostEscalationFlags(ar)
  }

  // Caso 18 trigger (inline regex — left as-is. Speculative typo-tolerant
  // refactor reverted on 2026-05-09 audit: not justified by a real bug.)
  if (
    !state.pendingFlow &&
    /(?:tengo|tenho|ho|i\s+have)\s+(?:un\s+)?(?:c[oó]digo|codice|code)[\s:.,-]*([A-Za-z0-9-]{3,})/i.test(userMessage)
  ) {
    const m = userMessage.match(/(?:c[oó]digo|codice|code)[\s:.,-]*([A-Za-z0-9-]{3,})/i)
    const codeValue = m?.[1] || ''
    if (codeValue && /^\d{3,}$/.test(codeValue)) {
      state.faqCodeValue = codeValue
      state.pendingFlow = 'numeric-code-ask-letters'
      resetPostEscalationFlags(ar)
    }
  }
}
