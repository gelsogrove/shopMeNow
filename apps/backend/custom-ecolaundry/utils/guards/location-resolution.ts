// Location resolution guards: detect Mataró street, escalate unknown locations,
// insist when the customer says "I don't know".

import { t, tt } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { isMataro, lang } from './helpers.js'
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

/** Customer mentioned a location that is not in our laundromat list — list
 *  the valid options. Fires only after at least one clarification round and
 *  no other deterministic flow is active. */
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

/** Customer says "no lo sé / no me acuerdo / ni idea" — insist that we need
 *  the location before we can help. */
export const guardInsistLocation: Guard = (ar, userMessage) => {
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
    reply: t('insistLocationFollowUp', lang(ar)),
    reason: 'insist-location-followup',
  }
}
