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
 *
 * F36 (Andrea 2026-05-11): also clear ALL escalation control flags. Without
 * this, when the LLM calls `mark_resolved` while an escalation is still
 * pending (e.g. customer said "si funciona" mid name-capture after a retry-
 * ladder escalation), the residual `operatorRequested + customerNameRequested
 * + pendingEscalation` flags pollute the next turn: a new trigger (e.g. Caso
 * 9 factura) would still append the old handover summary AND capture the
 * first word of the new message as the customer name. mark_resolved means
 * "the case is closed — wipe everything related to the previous trajectory".
 */
export function markResolved(ar: AgentRuntime): void {
  ar.resolved = true
  ar.state.pendingClosure = 'resolved'
  ar.state.operatorRequested = false
  ar.state.customerNameRequested = false
  ar.state.escalationReason = ''
  ar.pendingEscalation = null
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

/**
 * F47 — Atomic pivot from a display-flow (e.g. AL001 sequence error) into the
 * Caso 4 "paid but not activated" gather. The customer was reporting a display
 * incident, but in their next turn they revealed they had already paid; that
 * signal flips the incident type. We abandon the display flow, clear the
 * step pointers, and arm `pendingFlow='no-change-ask'` so the existing
 * Caso 4 guards (`guardNoChangeAsk` → `guardNoChangeYesButBroken` /
 * `guardNoChangeNoCambio` → `guardNoChangeAfterRetry`) own the handoff.
 *
 * Sticky customer facts (name, location, machineType, machineNumber) are
 * preserved on purpose — they are already valid for the new flow. We also
 * call `resetPostEscalationFlags` to wipe any escalation half-state inherited
 * from the abandoned flow.
 *
 * Used by `agent-extract.ts` when `detectPaidNotActivatedIntent` triggers
 * while `activeFlowId === 'al001-sequence-error'` (Caso 5 → Caso 4 pivot,
 * documented in usecases.md §5.4).
 */
export function pivotToNoChangeAsk(ar: AgentRuntime): void {
  ar.state.activeFlowId = null
  ar.state.activeStepId = null
  ar.state.lastPresentedStepId = null
  ar.state.pendingFlow = 'no-change-ask'
  resetPostEscalationFlags(ar)
}

/**
 * F63 (Andrea 2026-05-15) — Release the sticky branch after a FAQ closure.
 *
 * `dispatchSubsequentTurn` reads `state.activeBranch` to decide which handler
 * to run on T2+; if a legacy guard (guardFaqClosure, F62 dryer/washer-decline)
 * emits a closure reply WITHOUT also releasing the branch, the next customer
 * message re-enters `faqHandler` with empty routerDetails and falls into the
 * unknownKey reply ("No estoy seguro de haber entendido…") even though the
 * customer is starting a brand-new topic.
 *
 * Mirror of `applyHandoff('topic-switch')` semantics — moves `activeBranch`
 * into `previousBranch` so the next turn re-enters `dispatchTurnOne` and the
 * router re-classifies the incoming message.
 */
export function releaseBranchOnFaqClosure(ar: AgentRuntime): void {
  ar.state.previousBranch = ar.state.activeBranch
  ar.state.activeBranch = null
}

/**
 * F60 (Andrea 2026-05-15) — Boundary transition FAQ → trouble-machine.
 *
 * When the branch router classifies a new turn as `trouble-machine` AND the
 * previous turn left `state.lastResolvedIntent === 'faq'`, the FAQ-context
 * sticky `state.location` (possibly switched via F51 to a location the
 * customer was only comparing prices for) must be cleared so the trouble
 * flow asks "¿en qué lavandería estás?" fresh and the customer's reply
 * (Goya) becomes the actual incident location.
 *
 * Without this, a customer who just compared Goya/Pineda prices and then
 * said "no funciona" would proceed through the trouble gather narratively
 * with one location while `state.location` silently retained the other —
 * any FAQ pivot mid-trouble (orari, prezzi) would then answer for the
 * wrong location.
 *
 * Architectural placement: called from `branches/index.ts:dispatchTurnOne`
 * where the router decision is the authoritative signal of intent change.
 * No phrase regex involved — iron rule #6 respected (the signal is a
 * router classification, not a customer-phrase pattern).
 */
export function clearFaqContextOnTroubleEntry(ar: AgentRuntime): void {
  ar.state.location = ''
  ar.state.lastResolvedIntent = null
  ar.state.lastFaqKey = null
}
