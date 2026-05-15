// Force-gather guards: deterministic questions when sticky facts are
// missing. The canonical question order (one question per turn) is:
//   Step 2 — type      (washer or dryer?)
//   Step 3 — number    (which machine number?)
//   Step 4 — display   (what does the screen show?)
// Step 1 (location) is handled by location-resolution.ts.
// Payment is intentionally NOT in the pipeline — see guardForcePayment.

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import type { SessionState } from '../../models/index.js'
import { isMataro, lang, notInActiveSubFlow } from './helpers.js'
import { escalate, requireCustomerName } from '../state-transitions.js'
import { nextRetryLadderStep } from './retry-ladder.js'

/** F59 (Andrea 2026-05-15) — Gate semantico FAQ context.
 *
 *  After a FAQ resolution (`lastResolvedIntent === 'faq'`), the customer
 *  may mention a machine type ("y la secadora", "lavadora") as part of a
 *  FAQ follow-up — NOT as a trouble report. `autoExtractFacts` sets
 *  `state.machineType` from any bare mention, which would otherwise cause
 *  the force-gather guards to fire and ask for the machine number as if
 *  it were a trouble incident.
 *
 *  The gate skips the force-gather guards when:
 *  - `lastResolvedIntent === 'faq'` AND
 *  - no trouble pendingFlow is armed AND
 *  - the current message does NOT contain a trouble boundary signal
 *    ("no funciona" / "non funziona" / "doesn't work" / …).
 *
 *  The boundary signal is what lets MIX 0 (FAQ → trouble pivot) still
 *  trigger guardForceMachineType normally — when the customer explicitly
 *  says "no funciona" they are leaving the FAQ topic. Iron rule #6
 *  exception: boundary signal (topic switch), not intent classification. */
const TROUBLE_SIGNAL_RE =
  /\b(?:no\s+funciona|no\s+arranca|no\s+va\b|est[áa]\s+rot[ao]|non\s+funziona|non\s+parte|non\s+va\b|non\s+arranca|doesn'?t\s+work|isn'?t\s+working|doesn'?t\s+start|broken|n[aã]o\s+funciona|n[aã]o\s+arranca|ne\s+fonctionne\s+pas|ne\s+marche\s+pas|ne\s+d[ée]marre\s+pas)/i

function isInFaqContext(state: SessionState, userMessage: string): boolean {
  if (state.lastResolvedIntent !== 'faq') return false
  if (state.pendingFlow && !state.pendingFlow.startsWith('faq-')) return false
  if (TROUBLE_SIGNAL_RE.test(userMessage)) {
    // Boundary signal: customer pivots FAQ → trouble. Clear the FAQ marker
    // so subsequent turns ("6" as machine number, "PUSH" as display, …) are
    // not gated. Without this, T+1 in MIX 0 would fall through to LLM
    // improvisation because the trouble keyword is only present in T.
    // lastResolvedIntent is not in the protected-flag list (rule #4 covers
    // pendingClosure/operatorRequested/escalationReason/customerNameRequested
    // /pendingEscalation only) — inline clear is allowed.
    state.lastResolvedIntent = null
    return false
  }
  return true
}

/** Step 2 — Force "lavadora o secadora?" when location is known but type is not.
 *
 *  Always asks ONLY the type. The number is asked separately on the next
 *  turn by guardForceMachineNumber. This keeps the canonical question order
 *  one-question-per-turn.
 *
 *  Caso 32 (customer volunteers the number proactively, e.g. "Pineda" → "3"):
 *  autoExtractFacts populates machineNumber before this guard runs. On the
 *  next turn guardForceMachineNumber is skipped (number already set) and
 *  this guard asks only the type — no awkward re-ask of the number.
 *
 *  Iron rule #10: this guard does NOT gate on `!ar.state.displayState`
 *  anymore. Earlier it did, on the assumption "if display is set, the
 *  flow takes over". But the display flow can only start once
 *  type+number are also set, so when the customer reports the display
 *  before the type (e.g. "me sale PUSH PROG" first), the gather pipeline
 *  used to skip type entirely and the LLM had to improvise. Active-flow
 *  detection is delegated to `notInActiveSubFlow(ar)` which is the
 *  authoritative signal. */
export const guardForceMachineType: Guard = (ar, userMessage) => {
  if (isInFaqContext(ar.state, userMessage)) return null
  if (
    ar.state.location &&
    !ar.state.machineType &&
    !ar.state.nonTroubleshootingIncident &&
    notInActiveSubFlow(ar) &&
    ar.state.turnCount >= 2
  ) {
    return {
      reply: t('machineType', lang(ar)),
      reason: 'force-machine-type',
    }
  }
  return null
}

/**
 * Force "¿Has podido realizar el pago?" when local+type+number known.
 *
 * NOTE: this guard is NOT currently included in GUARD_PIPELINE in guards/index.ts.
 * Payment confirmation in the general flow is handled by the LLM reading the
 * sticky state from the system prompt. If you want deterministic payment-step
 * behaviour, add it to the pipeline between guardForceMachineNumber and
 * guardForceDisplay and re-run the full test suite.
 */
export const guardForcePayment: Guard = (ar) => {
  if (
    ar.state.location &&
    ar.state.machineType &&
    ar.state.machineNumber &&
    !ar.state.displayState &&
    ar.state.paymentCompleted === null &&
    !ar.state.nonTroubleshootingIncident &&
    notInActiveSubFlow(ar) &&
    ar.state.turnCount >= 2
  ) {
    ar.state.paymentRequested = true
    return {
      reply: t('paymentAsk', lang(ar)),
      reason: 'force-payment',
    }
  }
  return null
}

/** Step 4 — Force "qué aparece en la pantalla?" when local+type+number known.
 *
 *  Includes a retry-then-escalate path for unrecognised codes (typos, free
 *  text that doesn't look like any known display token). The customer-facing
 *  flow is:
 *
 *    1st miss (counter == 0):  ask the canonical "qué aparece en pantalla"
 *    2nd miss (counter == 1):  re-ask politely — "no reconozco ese código
 *                              exactamente, ¿podrías comprobarlo nuevamente?"
 *    3rd miss (counter >= 2):  escalate to a human operator (asks the
 *                              customer name, hands off).
 *
 *  Iron rule #10: this guard is a single deterministic catch-all for the
 *  "display still empty" state. Without the retry+escalate logic, the
 *  customer who types a typo (e.g. "USH PROG") would either hit an
 *  infinite re-ask loop or trigger LLM improvisation. Counter is reset by
 *  resetMachineFacts and (implicitly) when displayState is set by
 *  autoExtractFacts on a recognised input. */
export const guardForceDisplay: Guard = (ar, userMessage) => {
  if (isInFaqContext(ar.state, userMessage)) return null
  if (
    !ar.state.location ||
    !ar.state.machineType ||
    !ar.state.machineNumber ||
    ar.state.displayState ||
    ar.state.nonTroubleshootingIncident ||
    !notInActiveSubFlow(ar) ||
    ar.state.turnCount < 2
  ) {
    return null
  }
  const step = nextRetryLadderStep(
    ar.state.displayAskAttempts || 0,
    (n) => { ar.state.displayAskAttempts = n },
  )
  if (step === 'escalate') {
    escalate(ar, 'Display code unrecognised after 2 attempts')
    requireCustomerName(ar)
    return {
      reply: t('reaffirmEscalate', lang(ar)),
      reason: 'display-unrecognized-escalate',
    }
  }
  if (step === 'first-ask') {
    return { reply: t('displayShort', lang(ar)), reason: 'force-display' }
  }
  // step === 'reask'
  return {
    reply: t('displayUnrecognizedReask', lang(ar)),
    reason: 'display-unrecognized-reask',
  }
}

/** Step 3 — Force "cuál es el número?" when local+type known but number missing.
 *
 *  Includes the same retry-then-escalate path as `guardForceDisplay` for
 *  the case where the customer doesn't (or can't) give a number:
 *
 *    1st miss (counter == 0):  ask the canonical "qué número tiene la
 *                              lavadora/secadora?"
 *    2nd miss (counter == 1):  re-ask with a hint on where to find the
 *                              number — "el número está pegado en la
 *                              propia máquina, normalmente arriba o al
 *                              lado de la pantalla. ¿Podrías comprobarlo?"
 *    3rd miss (counter >= 2):  escalate to a human operator.
 *
 *  Iron rule #10: same as guardForceMachineType — does NOT gate on
 *  `!ar.state.displayState`. If the customer volunteered the display
 *  before the number, we still need the number for the flow to start.
 *  Counter is reset by resetMachineFacts and (implicitly) when
 *  machineNumber is captured by autoExtractFacts. */
export const guardForceMachineNumber: Guard = (ar, userMessage) => {
  if (isInFaqContext(ar.state, userMessage)) return null
  if (
    !ar.state.location ||
    !ar.state.machineType ||
    ar.state.machineNumber ||
    ar.state.nonTroubleshootingIncident ||
    !notInActiveSubFlow(ar) ||
    ar.state.turnCount < 2
  ) {
    return null
  }
  if (isMataro(ar) && !ar.state.locationStreet) return null

  const step = nextRetryLadderStep(
    ar.state.machineNumberAskAttempts || 0,
    (n) => { ar.state.machineNumberAskAttempts = n },
  )
  if (step === 'escalate') {
    escalate(ar, 'Customer could not provide machine number after 2 attempts')
    requireCustomerName(ar)
    return {
      reply: t('reaffirmEscalate', lang(ar)),
      reason: 'machine-number-unrecognized-escalate',
    }
  }
  if (step === 'first-ask') {
    // F48 — generic "máquina" wording (no lavadora/secadora) so the rephrase
    // LLM can't flip the machineType in the customer-facing prompt. The fact
    // is preserved in state.machineType for the operator briefing.
    return { reply: t('machineNumberAsk', lang(ar)), reason: 'force-machine-number' }
  }
  // step === 'reask' — hint where the number is.
  return {
    reply: t('machineNumberRetry', lang(ar)),
    reason: 'machine-number-unrecognized-reask',
  }
}
