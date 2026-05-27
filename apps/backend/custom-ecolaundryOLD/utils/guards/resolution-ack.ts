// F112 — Resolution acknowledgement guard.
//
// When the router LLM classifies turnMode='resolution' (customer said "ora
// funziona" / "now it works" / etc.), `applyTurnModeGate` in agent.ts calls
// markResolved + resetMachineFacts BEFORE the legacy pipeline runs. The
// state then has pendingClosure='resolved' but no guard has produced a
// reply yet — without this guard, the pipeline falls through to the LLM
// which often produces an unclear FAQ fallback.
//
// This guard:
//   1. Fires when pendingClosure='resolved' is fresh (no later guard has
//      consumed it) and no escalation is pending.
//   2. Emits a localised "issue resolved, anything else?" ack.
//   3. Clears pendingClosure so the next turn is truly fresh.
//
// Iron rule #4: pendingClosure is a tracked field; we mutate it inline
// here as a CONSUMPTION (not a transition). The consumer pattern mirrors
// how extractPostResolutionReset already clears pendingClosure='resolved'
// at the top of T+1. Doing it here at T (right after markResolved)
// shortens the lifecycle to a single turn.

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { consumeResolution } from '../state-transitions.js'

export const guardResolutionAck: Guard = (ar) => {
  if (ar.state.pendingClosure !== 'resolved') return null
  if (ar.state.operatorRequested || ar.state.customerNameRequested) return null
  // Consume the closure flag — the ack itself IS the resolution outcome.
  consumeResolution(ar)
  return {
    reply: t('al001Resolved', lang(ar)),
    reason: 'resolution-ack',
  }
}
