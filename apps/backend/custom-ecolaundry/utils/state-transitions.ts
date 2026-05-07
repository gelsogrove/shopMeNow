// Named, atomic state transitions. Anywhere we mutate AgentRuntime.state
// for a conceptual event (case resolved, case escalated, new incident,
// post-escalation reset, …) we go through a function declared here. This
// keeps the side-effects auditable and prevents the same triplet of
// `pendingClosure='resolved'; ar.resolved=true; ...` from being inlined
// across multiple files (where it can drift).

import type { AgentRuntime } from '../models/index.js'
import { resetMachineFacts } from './state.js'

/**
 * Mark the current conversation as resolved. Called by the `mark_resolved`
 * tool, the flow engine on terminal-success nodes, and any guard that
 * closes a case after a deterministic confirmation.
 */
export function markResolved(ar: AgentRuntime): void {
  ar.resolved = true
  ar.state.pendingClosure = 'resolved'
}

/**
 * Undo the resolution mutation. Used by the post-processor when the LLM
 * produced a contradictory reply (resolution + escalation in the same
 * turn). The escalation wins; the resolution side-effect must be erased.
 */
export function undoResolved(ar: AgentRuntime): void {
  ar.resolved = false
  if (ar.state.pendingClosure === 'resolved') {
    ar.state.pendingClosure = null
  }
}

/**
 * Mark the current conversation as escalated to a human operator. The
 * actual handover summary is built later by `agent.ts:appendEscalationSummary`
 * using `ar.pendingEscalation` and `ar.state.customerName`.
 */
export function escalate(ar: AgentRuntime, reason: string): void {
  ar.state.escalationReason = reason
  ar.state.operatorRequested = true
  ar.pendingEscalation = { reason }
}

/**
 * Mark a turn as "the bot has just asked the customer for their name".
 * Subsequent guards / fact extractors use this flag to capture the next
 * user message as the answer.
 */
export function requireCustomerName(ar: AgentRuntime): void {
  ar.state.customerNameRequested = true
}

/**
 * Clear the conversation-control flags so a NEW deterministic flow can run
 * after a previous incident has closed. Sticky facts that are useful across
 * cases (`customerName`, `customerPhone`, `location`, …) are preserved on
 * purpose: they describe the customer, not the incident.
 *
 * Same pattern used by `guardDisplayFlowStart` and the case-marker
 * detection in `agent-extract.ts`.
 */
export function resetPostEscalationFlags(ar: AgentRuntime): void {
  ar.state.operatorRequested = false
  ar.state.customerNameRequested = false
  ar.state.escalationReason = ''
  ar.state.pendingClosure = null
  ar.pendingEscalation = null
}

/**
 * Wipe machine-specific facts when the customer switches incident (e.g.
 * resolved washer, now reports dryer). Preserves customer info; clears
 * machineType, machineNumber, displayState, payment*, active flow, etc.
 *
 * Convenience re-export of `state.ts:resetMachineFacts` so callers don't
 * have to import from two places.
 */
export function resetForNewIncident(ar: AgentRuntime): void {
  resetMachineFacts(ar.state)
}
