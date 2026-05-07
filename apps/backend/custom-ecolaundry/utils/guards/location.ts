// Location-related guards: Mataró street, unknown location, Caso 31 insist,
// force-gather (machine type / number / display / payment), and Caso 21-24
// location mismatch.

import { t, tt } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { escalate, requireCustomerName } from '../state-transitions.js'
import { isMataro, lang, notInActiveSubFlow } from './helpers.js'
import { listLaundromatsForReply } from '../locations.js'

/** G2.5 — Mataró street: as soon as the customer names Mataró as location,
 *  ask the street BEFORE asking machine type/number/display. */
export const guardMataroStreet: Guard = (ar) => {
  if (
    isMataro(ar) &&
    !ar.state.locationStreet &&
    !ar.state.operatorRequested &&
    !ar.state.customerNameRequested
  ) {
    ar.state.locationStreetRequested = true
    return {
      reply: t('mataroStreet', lang(ar)),
      reason: 'mataro-street',
    }
  }
  return null
}

/** Caso 31bis — cliente fornisce un nome non valido. Insistere chiedendo nome
 *  di una delle 6 lavanderie effettive. */
export const guardUnknownLocation: Guard = (ar) => {
  if (
    ar.state.location ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested ||
    !ar.state.locationClarificationCount ||
    ar.state.turnCount < 2 ||
    ar.state.pendingFlow ||
    ar.state.nonTroubleshootingIncident
  ) {
    return null
  }
  return {
    reply: tt('unknownLocationList', lang(ar), { list: listLaundromatsForReply() }),
    reason: 'unknown-location',
  }
}

/** Caso 31 — cliente dice "no lo sé / no sé / no me acuerdo" → insistere. */
export const guardCaso31InsistLocation: Guard = (ar, userMessage) => {
  if (
    ar.state.location ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested ||
    ar.state.turnCount < 2
  ) {
    return null
  }
  const reply = userMessage.trim().toLowerCase()
  const dontKnow = /^(no\s+lo\s+s[eé]|no\s+s[eé]|no\s+me\s+acuerdo|ni\s+idea|no\s+tengo\s+idea)(?:\s|$|[.,!?])/i.test(reply)
  if (!dontKnow) return null
  return {
    reply: t('caso31InsistLocation', lang(ar)),
    reason: 'caso31-insist-location',
  }
}

/** G3 — Force "lavadora o secadora?" when location is known but type is not.
 *
 *  Always asks ONLY the type. The number is asked separately on the next
 *  turn by guardForceMachineNumber. This keeps the canonical question order
 *  (Step 2 = type, Step 3 = number) one-question-per-turn.
 *
 *  Caso 32 (customer volunteers the number proactively, e.g. "Pineda" → "3"):
 *  autoExtractFacts populates machineNumber before this guard runs. On the
 *  next turn guardForceMachineNumber is skipped (number already set) and
 *  this guard asks only the type — no awkward re-ask of the number. */
export const guardForceMachineType: Guard = (ar) => {
  if (
    ar.state.location &&
    !ar.state.machineType &&
    !ar.state.displayState &&
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
 * G4a — Force "¿Has podido realizar el pago?" when local+type+number known.
 *
 * NOTE: this guard is NOT currently included in GUARD_PIPELINE in guards/index.ts.
 * Payment confirmation in the general flow is handled by the LLM reading the
 * sticky state from the system prompt. If you want deterministic payment-step
 * behaviour (per usecases.md Caso 1), add it to the pipeline between
 * guardForceMachineNumber and guardForceDisplay and re-run the full test suite.
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

/** G4 — Force "qué aparece en la pantalla?" when local+type+number known. */
export const guardForceDisplay: Guard = (ar) => {
  if (
    ar.state.location &&
    ar.state.machineType &&
    ar.state.machineNumber &&
    !ar.state.displayState &&
    !ar.state.nonTroubleshootingIncident &&
    notInActiveSubFlow(ar) &&
    ar.state.turnCount >= 2
  ) {
    return {
      reply: t('displayShort', lang(ar)),
      reason: 'force-display',
    }
  }
  return null
}

/** G5 — Force "cuál es el número?" when local+type known but number missing. */
export const guardForceMachineNumber: Guard = (ar) => {
  if (
    ar.state.location &&
    ar.state.machineType &&
    !ar.state.machineNumber &&
    !ar.state.displayState &&
    !ar.state.nonTroubleshootingIncident &&
    notInActiveSubFlow(ar) &&
    ar.state.turnCount >= 2
  ) {
    if (isMataro(ar) && !ar.state.locationStreet) return null
    const numKey = ar.state.machineType === 'dryer' ? 'machineNumberDryer' : 'machineNumberWasher'
    return {
      reply: t(numKey, lang(ar)),
      reason: 'force-machine-number',
    }
  }
  return null
}

/** Caso 21-24 location-gated escalation. Data-driven via locations.json metadata. */
export const guardCaso2124LocationMismatch: Guard = (ar) => {
  const incident = ar.state.nonTroubleshootingIncident
  if (
    !ar.state.location ||
    ar.state.operatorRequested ||
    ar.state.customerName ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const isDryerMinutes = incident === 'dryer-minutes-not-credited'
  const isCardPayment = incident === 'card-payment'
  if (!isDryerMinutes && !isCardPayment) return null

  const meta = (ar.runtime.locations?.locations?.[ar.state.location]?.metadata || {}) as Record<string, unknown>
  const flag = isDryerMinutes ? 'dryerMinutesIncreaseIssue' : 'cardPaymentUnreliable'
  if (meta[flag] === true) return null

  escalate(ar, `${incident} reported at ${ar.state.location} (not documented)`)
  requireCustomerName(ar)
  const line = tt('caso2124NotDocHere', lang(ar), { location: ar.state.location })
  const nameAsk = t('customerNameAsk', lang(ar))
  return {
    reply: `${line} ${nameAsk}`,
    reason: 'caso21-24-location-mismatch',
  }
}
