// Location-related guards: Mataró street, unknown location, Caso 31 insist,
// force-gather (machine type / number / display / payment), and Caso 21-24
// location mismatch.

import { t, tt } from '../localization.js'
import type { Guard } from './helpers.js'
import { isMataro, lang, notInActiveSubFlow } from './helpers.js'

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
    reply: 'No reconozco esa ubicación. Nuestras lavanderías son: Goya, Pineda, L\'Escala, Alemanya, Hortes y Mataró. ¿En cuál de ellas estás?',
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

/** G3 — Force "lavadora o secadora?" when location is known but type is not. */
export const guardForceMachineType: Guard = (ar) => {
  if (
    ar.state.location &&
    !ar.state.machineType &&
    !ar.state.displayState &&
    !ar.state.machineNumber &&
    !ar.state.nonTroubleshootingIncident &&
    !ar.state.operatorRequested &&
    !ar.state.customerNameRequested &&
    ar.state.turnCount >= 2
  ) {
    return {
      reply: t('machineType', lang(ar)),
      reason: 'force-machine-type',
    }
  }
  return null
}

/** G4a — Force "¿Has podido realizar el pago?" when local+type+number known. */
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

  ar.state.escalationReason = `${incident} reported at ${ar.state.location} (not documented)`
  ar.state.operatorRequested = true
  ar.state.customerNameRequested = true
  ar.pendingEscalation = { reason: ar.state.escalationReason }
  const line = tt('caso2124NotDocHere', lang(ar), { location: ar.state.location })
  const nameAsk = t('customerNameAsk', lang(ar))
  return {
    reply: `${line} ${nameAsk}`,
    reason: 'caso21-24-location-mismatch',
  }
}
