// Escalation branch handler.
//
// Status: thin wrapper (Andrea, 2026-05-08). The router classifies
// non-troubleshooting incidents (datafono-wrong-amount, cameras-or-ajax,
// refund-demand, compensation-demand, dryer-minutes-not-credited,
// card-payment) as "escalation" and captures the incidentType in the
// router details. We seed `state.nonTroubleshootingIncident` so the
// legacy `guardEscalateNonTroubleshooting` (and the location-gated
// guards for caso 21-24) take over from there.
//
// Allowed incident types — must match the guards' expectations:

import type { SessionState } from '../../../models/index.js'
import type { BranchHandler } from '../types.js'

const VALID_INCIDENTS: ReadonlySet<NonNullable<SessionState['nonTroubleshootingIncident']>> = new Set([
  'datafono-wrong-amount',
  'cameras-or-ajax',
  'refund-demand',
  'compensation-demand',
  'dryer-minutes-not-credited',
  'card-payment',
  'contradictory-narrative',
  'numeric-only-code',
  'undocumented-display',
])

export const escalationHandler: BranchHandler = async ({ ar, routerDetails }) => {
  const incident = routerDetails.incidentType
  if (incident && VALID_INCIDENTS.has(incident as NonNullable<SessionState['nonTroubleshootingIncident']>)) {
    if (!ar.state.nonTroubleshootingIncident) {
      ar.state.nonTroubleshootingIncident = incident as NonNullable<SessionState['nonTroubleshootingIncident']>
    }
  }
  return {
    reply: '',
    handoff: 'delegate-to-legacy',
  }
}
