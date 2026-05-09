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

/**
 * The bot has captured the customer's name. Stores it on the state and
 * clears the "name was requested" flag in one atomic step so callers
 * cannot forget one or the other.
 *
 * Used by the `capture_customer_name` tool handler and any guard that
 * accepts the raw input as the name (e.g. invoice flow step `invoice-ask-name`).
 */
export function captureCustomerName(ar: AgentRuntime, name: string): void {
  ar.state.customerName = name
  ar.state.customerNameRequested = false
  ar.state.awaitNameAskAttempts = 0
}

/**
 * Close the conversation as escalated to a human operator. Setting
 * `pendingClosure='escalated'` is the LAST step of an escalation flow:
 * the bot has already called `escalate(ar, reason)`, asked the name via
 * `requireCustomerName(ar)`, and captured it via `captureCustomerName`.
 * The `pendingClosure` flag tells the post-processor that no further
 * automatic question should be asked this turn.
 */
export function closeAsEscalated(ar: AgentRuntime): void {
  ar.state.pendingClosure = 'escalated'
}

/**
 * Mark a case as ready for the refund-form trámite (Caso 6.1 Sí branch).
 * Parallel to `escalate(ar, reason)` but for cases where the closure is
 * a refund procedure, NOT a live operator handover:
 *
 * - The bot collects the customer name, captures the payment receipt, and
 *   sends the refund-form link.
 * - There is NO `operatorHandoffFinal` line ("operador" / "desactivado").
 * - There is NO "👤 Human Support message" summary.
 *
 * Sets `pendingClosure='refund-form'` SUBITO so the post-processor in
 * `agent.ts:appendEscalationSummary` can dispatch on the closure type
 * without matching escalation reason strings (which are fragile). Also
 * sets `escalationReason` so internal logging records the case details.
 * Does NOT set `pendingEscalation` (which is the trigger for the
 * operator handoff) and does NOT set `operatorRequested`.
 *
 * usecases.md §6.1 (riga 627): "El mensaje final NO menciona 'operador'
 * ni 'desactivado': no es una escalación a un humano en vivo, es un
 * trámite de devolución."
 */
export function markRefundFormPending(ar: AgentRuntime, reason: string): void {
  ar.state.escalationReason = reason
  ar.state.pendingClosure = 'refund-form'
}

/**
 * Close the conversation as a refund-form trámite. Counterpart of
 * `closeAsEscalated` for the refund path. The post-processor checks this
 * value to decide whether to append the operator handoff or just return
 * the LLM-generated reply as-is.
 */
export function closeAsRefundForm(ar: AgentRuntime): void {
  ar.state.pendingClosure = 'refund-form'
}

/**
 * Start a fresh deterministic flow on a new incident: clear escalation
 * flags from any previous case and bind `activeFlowId` to the new one.
 * Sticky customer facts (name, phone, location) are preserved on purpose.
 *
 * Used by the display-flow start guard when the customer reports a new
 * display token after a previous escalation.
 */
export function startNewFlow(ar: AgentRuntime, flowId: string): void {
  ar.state.activeFlowId = flowId
  ar.state.activeStepId = null
  ar.state.operatorRequested = false
  ar.state.customerNameRequested = false
  ar.pendingEscalation = null
}
