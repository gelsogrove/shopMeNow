// Branch entry-time state resets — applied after the router classifies
// a turn but BEFORE the branch handler runs. Centralises the clear-on-
// boundary logic so the dispatcher stays a thin coordinator.

import type { AgentRuntime } from '../../models/index.js'
import type { RouterDecision } from '../router.js'
import { clearFaqContextOnTroubleEntry } from '../state-transitions.js'

/**
 * Apply boundary state resets when the router classifies a new branch.
 *
 * F60 (Andrea 2026-05-15) — clear FAQ-context sticky location at the
 * boundary FAQ → trouble-machine. The router classification is the
 * authoritative signal of intent change (iron rule #6 corollary: branch
 * boundary is a structural signal, not phrase regex).
 *
 * F64 (Andrea 2026-05-15) — widen the trigger to also fire on
 * `previousBranch === 'faq'`. After F62 closure + F63 branch release,
 * `lastResolvedIntent` is wiped (FAQ context closed cleanly) but the
 * sticky `state.location` from a price comparison is still stale; the
 * `previousBranch` marker is the signal that survives the closure.
 * Without this, a customer who closes a FAQ and then opens a trouble
 * without an explicit location word ("no funciona la lavadora") would
 * proceed with the wrong location silently.
 */
export function applyBranchEntryResets(
  ar: AgentRuntime,
  decision: RouterDecision,
): void {
  if (
    decision.branch === 'trouble-machine' &&
    (ar.state.lastResolvedIntent === 'faq' || ar.state.previousBranch === 'faq')
  ) {
    clearFaqContextOnTroubleEntry(ar)
  }
}
