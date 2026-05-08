// Location resolution guards: detect Mataró street, escalate unknown locations,
// insist when the customer says "I don't know", and the architectural
// catch-all `guardForceLocation` that prevents the "fact-out-of-order" hole
// (see CLAUDE.md → architectural rule: guard preconditions must not cancel
// each other out).

import { t, tt } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { isMataro, lang } from './helpers.js'
import { listLaundromatsForReply } from '../locations.js'

/**
 * Set of `nonTroubleshootingIncident` values that allow escalation WITHOUT
 * a location. Most incidents need location for the operator handover; these
 * three are about customer demands (refund / compensation) or operations
 * (cameras / AJAX) where the operator will look up the customer's purchase
 * history rather than the laundromat.
 */
const INCIDENTS_NO_LOCATION_REQUIRED: ReadonlySet<string> = new Set([
  'cameras-or-ajax',
  'refund-demand',
  'compensation-demand',
])

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

/**
 * Catch-all gather guard for location.
 *
 * Why this exists: gather guards (`guardForceMachineType`, `guardForceMachineNumber`,
 * `guardForceDisplay`) all gate on `!ar.state.displayState` so they can give
 * up the floor when a display flow is active. Display flows themselves
 * require `location + machineType + machineNumber` via `flow.requires`. If
 * the customer reports the display BEFORE the location, the result is a
 * pipeline hole:
 *
 *   - `guardForce*` skip (displayState set)
 *   - `guardDisplayFlowStart` skips (location missing)
 *   - `guardInsistLocation` / `guardUnknownLocation` skip (only fire on
 *     "no lo sé" or after a clarification round)
 *   → the LLM is on its own → it improvises → escalation cascade.
 *
 * This guard plugs that hole: whenever location is empty and the customer
 * has had a chance to provide it (turnCount ≥ 2), the bot ALWAYS asks for
 * the location before any other flow can take over. The only escape hatches
 * are escalations that genuinely don't need a location (refund / compensation /
 * cameras) and the explicit "no lo sé" branch (handled by guardInsistLocation).
 *
 * Pipeline placement: BEFORE every other gather / display-flow / escalation
 * guard. See `guards/index.ts:GUARD_PIPELINE`.
 */
export const guardForceLocation: Guard = (ar) => {
  if (
    ar.state.location ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested ||
    ar.state.turnCount < 2 ||
    // Mataró: handled by guardMataroStreet which fires earlier in the pipeline
    // (only when location IS Mataró). If location is empty, we still want the
    // generic location ask here — the customer can name Mataró in the reply
    // and Mataró street ask will fire on the next turn.
    ar.state.pendingFlow === 'invoice-ask-location' ||
    // Don't gate non-troubleshooting incidents that escalate without location
    // (cameras / refund / compensation — the operator handles them via
    // customer-account history, not laundromat).
    INCIDENTS_NO_LOCATION_REQUIRED.has(ar.state.nonTroubleshootingIncident || '')
  ) {
    return null
  }
  return {
    reply: t('location', lang(ar)),
    reason: 'force-location',
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
