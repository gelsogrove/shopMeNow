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
  detectDisplayUnreadableIntent,
  detectFaqPause,
  detectNumericCodeIntent,
  detectPaidNotActivatedIntent,
  detectPaymentMention,
  detectTopicSwitchDuringEscalation,
} from './intent.js'
import { resolveKnownLocation, resolveKnownLocationFuzzy, parseExplicitPaymentSignal } from './message-parsing.js'
import { resolveLocationByLandmarks } from './locations.js'
import { RECOVERABLE_DISPLAYS } from './guards/helpers.js'
import { resetIncidentDetails, resetMachineFacts } from './state.js'
import { pivotToNoChangeAsk, resetPostEscalationFlags } from './state-transitions.js'
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

// F83 — non-machine flow prefixes. When pendingFlow starts with one of these,
// the customer is in a legitimate non-troubleshooting flow (invoice gather,
// discount-code gather, loyalty FAQ, location-driven FAQ). Their per-turn
// replies (e.g. "6€" as cost total, "B12345678" as tax id, "ana@ex.com" as
// email) MUST NOT be classified as a topic-switch — they are the expected
// answers to the previous canonical question. detectTopicSwitch only fires
// when the customer is genuinely in a MACHINE context (trouble flow / display
// flow / payment incident).
const NON_MACHINE_PENDING_PREFIXES = [
  'invoice-',
  'discount-code-',
  'loyalty-',
  'faq-',
] as const

function isInNonMachineFlow(pendingFlow: string): boolean {
  return NON_MACHINE_PENDING_PREFIXES.some((p) => pendingFlow.startsWith(p))
}

function detectTopicSwitch(
  runtime: Runtime,
  state: { displayState: string; machineNumber: string; pendingFlow: string },
  userMessage: string,
): boolean {
  // F83 — non-machine flows (invoice, discount-code, loyalty, FAQ) collect
  // structured PII or data answers that legitimately contain payment-shaped
  // tokens (€, monetary amounts, "factura", …). They are NOT machine context
  // and their answers MUST NOT trigger a topic-switch reset of machine facts
  // / setting of nonTroubleshootingIncident. Reverting to the LLM here would
  // be the wrong fix — the customer DID answer the canonical question.
  if (isInNonMachineFlow(state.pendingFlow)) return false
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

  // F28 (Andrea 2026-05-10, Caso 32.3 RED-SPEC closure): detect FAQ pause —
  // customer interrupts an active trouble-machine flow with a brief FAQ
  // ("antes una pregunta, ¿cuánto cuesta?"). Setting state.faqPause = true
  // tells the L5 polish layer to append a "¿Sigamos con tu problema?" prompt
  // (i18n key resumeAfterFaq) at the end of the FAQ reply so the customer
  // knows the original flow is paused, not lost. Only fires when:
  //   1. there's an active troubleshooting context (pendingFlow OR display
  //      OR machineNumber), AND
  //   2. the message has both a pause marker and a FAQ topic hint.
  // The flag is cleared on the next turn when the customer resumes
  // (resetForNewIncident / resetMachineFacts also clear it).
  const hasTroubleContext = !!(state.pendingFlow || state.displayState || state.machineNumber)
  if (hasTroubleContext && detectFaqPause(trimmed)) {
    state.faqPause = true
  } else if (state.faqPause) {
    // Customer's next message after the FAQ — clear the flag so the prompt
    // doesn't re-append on the resumed turn.
    state.faqPause = false
  }

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
    // F38 (Andrea 2026-05-11): post-resolved transition — discriminate
    // between (a) follow-up flow on the SAME machine (e.g. factura for the
    // wash that just finished → keep machineType+machineNumber sticky so
    // the bot doesn't re-ask tipo/numero) and (b) the customer reporting a
    // NEW incident on a DIFFERENT machine (e.g. "ahora la secadora 7..."
    // → full reset so the new facts overwrite the old ones).
    // Heuristic: if the new message explicitly names a machine type that
    // DIFFERS from the current state.machineType, full reset. Otherwise
    // light reset (preserves machine identity for follow-up flows like
    // factura). Sticky window: session TTL (1 hour by default).
    const newType = normalizeMachineType(trimmed)
    const switchedMachine = newType && state.machineType && newType !== state.machineType
    if (switchedMachine) {
      resetMachineFacts(state)
    } else {
      resetIncidentDetails(state)
    }
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
  // When the bot is actively waiting for the customer's name (customerNameRequested),
  // a display code like "PUSH PROG" is NOT a topic switch — the customer is repeating
  // what they see on the screen. Only reset when the customer reports a genuinely
  // different incident (new doble-cobro or discount-code intent), not just a display token.
  const isNameAwaitTopicSwitch =
    inPendingEscalation &&
    !detectDoubleChargeIntent(trimmed) &&
    !detectDiscountCodeIntent(trimmed) &&
    extractDisplayState(trimmed) !== null
  if (
    !isNameAwaitTopicSwitch &&
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
      // Exact + fuzzy fallback (typo tolerance, see riga 219 below).
      const known = resolveKnownLocation(explicitNew) || resolveKnownLocationFuzzy(explicitNew)
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

  // Location switch in FAQ context (Caso 12 — Andrea 2026-05-14).
  //
  // Scope: NARROW — fires only when state.lastResolvedIntent === 'faq' or
  // pendingFlow starts with 'faq-'. We deliberately do NOT widen this to
  // trouble flows (Casi 1-7, 13-17): there an accidental location word
  // would silently swap laundries mid-troubleshoot.
  //
  // Use case: customer just got prices/hours for one location and asks
  // about another in the next breath ("e a Playa d'aro?", "en L'Escala?").
  // Without this, state.location is sticky and the bot re-renders the old
  // location's data forever (Andrea's loop bug).
  //
  // Override only when:
  //   - in FAQ context (see above)
  //   - the message contains an EXPLICIT preposition pattern via
  //     extractExplicitLocation (not a bare token)
  //   - the resolved location differs from state.location
  // F64 (Andrea 2026-05-15): also accept `state.previousBranch === 'faq'` as
  // a valid FAQ-context signal — after F62 closure + F63 branch release, the
  // intent/key markers are wiped but previousBranch persists. Without this
  // widening, a customer who closes a FAQ ("no") and then opens a trouble
  // flow with an explicit location ("no funciona la lavadora 6 a Goya")
  // would lose the override because line 303 below blocks bare/standalone
  // location captures when state.location is already set.
  if (
    state.location &&
    (state.lastResolvedIntent === 'faq' ||
      state.previousBranch === 'faq' ||
      state.pendingFlow === 'faq-prices-await-dryer-confirm' ||
      state.pendingFlow === 'faq-prices-await-washer-confirm' ||
      state.pendingFlow === 'faq-prices-await-location' ||
      state.pendingFlow === 'faq-hours-await-location')
  ) {
    const explicitSwitch = extractExplicitLocation(trimmed)
    if (explicitSwitch) {
      const resolved =
        resolveKnownLocation(explicitSwitch) || resolveKnownLocationFuzzy(explicitSwitch)
      if (resolved && resolved !== state.location) {
        state.location = resolved
        // Re-arm pendingFlow for the FAQ sub-state so the next guard pass
        // renders the new location's data. Without this, the stale
        // dryer-confirm / washer-confirm flag could block re-render.
        if (
          state.pendingFlow === 'faq-prices-await-dryer-confirm' ||
          state.pendingFlow === 'faq-prices-await-washer-confirm'
        ) {
          state.pendingFlow = ''
        }
        // F61 (Andrea 2026-05-15): after the location switch, re-arm the
        // correct faq-{prices,hours}-await-location flow so the next guard
        // pass renders the new location deterministically. Without this,
        // a switch like "e a Pineda?" after a price render leaves
        // pendingFlow='' AND no price-keyword in the message →
        // `guardFaqPrices` skips → LLM rephrase improvises a non-canonical
        // reply (Bug A in Andrea's 2026-05-15 mixed-flow chat).
        if (!state.pendingFlow && state.lastFaqKey === 'pricing') {
          state.pendingFlow = 'faq-prices-await-location'
        } else if (!state.pendingFlow && state.lastFaqKey === 'openingHours') {
          state.pendingFlow = 'faq-hours-await-location'
        }
      }
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
      // Exact match first; fall back to fuzzy resolver to catch typos like
      // "Mtaró" → "Mataró", "Granolers" → "Granollers", "Pineda Mar" →
      // "Pineda" (Damerau-Levenshtein distance ≤ threshold). Same pattern
      // used by `guardDiscountCodeAwaitLocation`. Without the fuzzy fallback,
      // typos drop the customer into the unknown-location list which doesn't
      // include the ambiguous pueblo "Mataró" → confusing UX.
      const known = resolveKnownLocation(candidate) || resolveKnownLocationFuzzy(candidate)
      if (known) {
        state.location = known
      } else {
        // Mark for clarification — bot should insist on a valid location.
        state.locationClarificationCount = (state.locationClarificationCount || 0) + 1
      }
    } else {
      // Inline scan: find a known location name anywhere in the free-text
      // message (e.g. "Lavadora 3 Goya" → Goya). This covers free-order
      // multi-fact messages where isLikelyStandaloneLocationInput returns false
      // (machine keywords disqualify standalone check) and extractExplicitLocation
      // returns null (no preposition). Exact-match only to minimise false positives.
      const inlineKnown = resolveKnownLocation(trimmed)
      if (inlineKnown) {
        state.location = inlineKnown
      }
    }

    // F79 — Landmark-based fallback. Customer may identify the laundromat by
    // a nearby reference point ("estoy cerca del Mercadona", "vicino al
    // Carrefour", "junto al Aldi") instead of typing a pueblo name. Data
    // lives in json/locations.json:metadata.landmarks — adding a new
    // landmark is a JSON edit, no code change. Only fires when the previous
    // resolvers didn't capture anything AND the landmark unambiguously
    // identifies a single location. Ambiguous matches (e.g. "Carrefour" →
    // Pineda + L'Escala + Platja d'Aro) leave state.location empty so
    // guardForceLocation can ask the customer to disambiguate by pueblo.
    if (!state.location) {
      const landmarkMatch = resolveLocationByLandmarks(trimmed, ar.runtime.locations)
      if (landmarkMatch.canonical) {
        state.location = landmarkMatch.canonical
        // F79 — Signal the L5 output layer to prepend an acknowledgment so the
        // customer knows the deduction worked ("Entendido, estás en **Goya**
        // (C/ Francisco de Goya 117)..."). One-shot turn-local flag —
        // applyGuardOutcome consumes and clears it before returning.
        // Direct canonical mentions (e.g. customer types "Goya") capture via
        // resolveKnownLocation upstream and do NOT trigger this signal, so
        // the bot stays terse when it has nothing surprising to acknowledge.
        state.locationAckPending = landmarkMatch.canonical
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
  //
  // F55 (Andrea 2026-05-15, narrow FAQ-context override — mirror of F51 for
  // location): default first-set-wins is conservative to avoid mid-trouble
  // flips ("ah no scusa la secadora"). BUT after a FAQ resolution the type
  // can be stale (e.g. FAQ asciugare set machineType='dryer'; customer then
  // says "mi lavadora no funciona" → must flip to 'washer'). Allow override
  // ONLY when no active flow is running AND we just came from a FAQ context.
  const newType = normalizeMachineType(trimmed)
  const inActiveFlow = state.pendingFlow || state.activeFlowId
  const cameFromFaq = state.lastResolvedIntent === 'faq'
  if (state.machineType && newType && newType !== state.machineType && !inActiveFlow && cameFromFaq) {
    state.machineType = newType
  } else if (!state.machineType && newType) {
    state.machineType = newType
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
  // F27 (Andrea 2026-05-10, Caso 32.1 RED-SPEC closure): each time displayState
  // changes to a non-empty value, push the customer-facing displayLabel onto
  // state.displayHistory so the operator handover summary can render the full
  // chronological sequence ("SEL → PUSH PROG → DOOR → AL001"). Helper inline
  // because the logic must run on every assignment site below.
  const recordDisplay = (canonical: string, label: string): void => {
    state.displayState = canonical
    state.displayLabel = label
    if (label && state.displayHistory[state.displayHistory.length - 1] !== label) {
      state.displayHistory.push(label)
    }
  }

  const newDisplay = extractDisplayState(trimmed)
  // F66 + MIX 1/5 widen — only capture a display code when there is at least
  // one OTHER context fact that proves this is a troubleshooting turn, not a
  // bare answer to a location ask. Acceptable signals (any one suffices):
  //   • state.machineType set (FR demo F66 — prevents "AL001" answered to
  //     location ask from being captured prematurely)
  //   • state.displayState set (DISPLAY-CHANGE rule: customer updating the code)
  //   • state.pendingFlow non-empty (MIX 1: topic-switch SEL mid-discount-code
  //     flow — pendingFlow is still set when this branch runs)
  //   • trimmed mentions a machine type explicitly (MIX 5: T1 "dryer + PUSH PROG")
  //   • trimmed has a display-report verb pattern ("me sale X", "ahora me da X",
  //     "appears X", "ora mi da X") — distinguishes a troubleshooting sentence
  //     from a bare-token answer to a location ask (MIX 5: "me sale push prog").
  // The bare "AL001" answer to a location-ask trips none of these.
  const messageMentionsType = !!normalizeMachineType(trimmed)
  const REPORT_VERB_RE = /\b(me\s+sale|me\s+aparece|me\s+da|ahora\s+me\s+sale|aparece|mi\s+da|ora\s+mi\s+da|ora\s+me\s+sale|now\s+(?:showing|shows|displays)|shows|i\s+see|sale\s+(?:el|la|en\s+la\s+pantalla))\b/i
  const messageReportsDisplay = REPORT_VERB_RE.test(trimmed)
  const canCaptureDisplay =
    !!state.machineType ||
    !!state.displayState ||
    !!state.pendingFlow ||
    messageMentionsType ||
    messageReportsDisplay
  if (newDisplay && newDisplay !== state.displayState && canCaptureDisplay) {
    // Preserve the customer-facing label (e.g. "PUSH PROG") for the operator
    // handover summary. Without this the operator reads the canonical token
    // ("PUSH") and loses the customer's exact wording.
    recordDisplay(newDisplay, extractDisplayLabel(trimmed, newDisplay))
  } else if (!state.displayState && state.machineType && shouldAcceptAsDisplay(ar.runtime, trimmed)) {
    const captured = trimmed.replace(/[.,!?¿¡:;"'()]/g, '').trim().toUpperCase()
    recordDisplay(captured, captured)
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
    recordDisplay(captured, captured)
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
  // Caso 7 trigger (paid-not-used) — NO pendingFlow setup needed.
  // Andrea (2026-05-09): aligned to PDF Playbook §5.4. After location +
  // tipo + numero, the standard guardForceDisplay asks pantalla; the
  // display flow handles the rest (PUSH/SEL/DOOR/AL001/...). Cambio is
  // NOT a forced gather step — it's a fallback the operator collects on
  // the phone if the display does not resolve. The previous flow forced
  // the cambio question before pantalla, which inverted the PDF order.

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
  // Detection delegated to `detectPaidNotActivatedIntent` (utils/intent.ts) —
  // typo-tolerant via Levenshtein on the verb token (F16, Andrea 2026-05-10).
  //
  // Skip when the branch router has already classified this as trouble-machine:
  // generic "paid + not starting" phrases overlap with display-code incidents
  // (Caso 3/SEL) and would incorrectly divert the gather to Caso 4 (cambio).
  //
  if (!state.pendingFlow && ar.state.activeBranch !== 'trouble-machine' && detectPaidNotActivatedIntent(userMessage)) {
    state.pendingFlow = 'no-change-ask'
    resetPostEscalationFlags(ar)
  }

  // F47 — AL001 → Caso 4 pivot (Andrea 2026-05-12 real chat):
  // when the customer is in the `al001-sequence-error` display flow (Caso 5)
  // AND mentions they have already paid ("He pagado y apretado el numero…"),
  // the incident type flips from "sequence error" to "paid but not activated"
  // (Caso 4). The pivot is deterministic — handled by `pivotToNoChangeAsk` —
  // so Caso 4 guards (4.2 escalate on "Sí cambio devuelto") own the handoff
  // and we don't bounce LLM-improvised instructions.
  //
  // Detector choice: we use `detectPaymentMention` (bare payment signal),
  // NOT `detectPaidNotActivatedIntent`. The latter requires BOTH a payment
  // signal AND an explicit failure verb ("no arranca", "no funciona", …)
  // — a sensible guard for cold-start Caso 4 detection where the bot has no
  // other context. Here the AL001 flow is already an in-progress
  // troubleshooting incident, so the failure is implicit from the trigger
  // context: a bare "he pagado" is enough to flip the case. The
  // `activeFlowId === 'al001-sequence-error'` gate keeps Caso 3/SEL safe —
  // a generic "he pagado" mid-SEL flow does NOT pivot.
  //
  // Documented in usecases.md §5.4.
  if (
    !state.pendingFlow &&
    ar.state.activeFlowId === 'al001-sequence-error' &&
    detectPaymentMention(userMessage)
  ) {
    pivotToNoChangeAsk(ar)
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
  // Caso 17 trigger — customer reports they cannot read the display.
  // Detection delegated to `detectDisplayUnreadableIntent` (utils/intent.ts) —
  // expanded coverage (F20, Andrea 2026-05-10).
  if (!state.pendingFlow && detectDisplayUnreadableIntent(userMessage)) {
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

  // Caso 18 trigger — customer reports a purely numeric "code".
  // Detection delegated to `detectNumericCodeIntent` (utils/intent.ts) —
  // expanded coverage beyond strict verb prefix (F21, Andrea 2026-05-10).
  if (!state.pendingFlow) {
    const numericCode = detectNumericCodeIntent(userMessage)
    if (numericCode) {
      state.faqCodeValue = numericCode
      state.pendingFlow = 'numeric-code-ask-letters'
      resetPostEscalationFlags(ar)
    }
  }
}
