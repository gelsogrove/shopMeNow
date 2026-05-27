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
 *
 * Also switches `activeBranch` to `'escalation'` so the state truthfully
 * reflects WHERE the conversation is now (no longer in trouble-machine /
 * payment / faq / wherever the router originally placed it). Mirrors the
 * branch-router contract: every behavioural pivot updates activeBranch.
 * Without this, downstream introspection (logs, tests, debug snapshots)
 * would still report the pre-escalation branch.
 */
export function escalate(ar: AgentRuntime, reason: string): void {
  ar.state.escalationReason = reason
  ar.state.operatorRequested = true
  ar.state.activeBranch = 'escalation'
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
 * F109 — Release an in-progress machine flow when the customer has clearly
 * abandoned it (e.g. answered a FAQ pivot mid-flow). Clears `activeFlowId`,
 * `activeStepId`, `lastPresentedStepId`, `retryCount` atomically. Also moves
 * `activeBranch` into `previousBranch` so the next turn re-enters
 * `dispatchTurnOne` and the router re-classifies the incoming message —
 * symmetric to `releaseBranchOnFaqClosure` (F63) but driven by the FAQ
 * resolution chokepoint instead of an explicit closure guard.
 *
 * Sticky customer facts (location, machineType, machineNumber, displayState,
 * customerName) are preserved on purpose — they describe the customer/incident
 * snapshot, not the flow control. The next turn can either resume the same
 * topic (re-arm the flow via guardAutoStartMachineFlow) or pivot definitively.
 *
 * Used by `agent.ts:applyGuardOutcome` as a single chokepoint: when the guard
 * that just produced the reply marked `lastResolvedIntent === 'faq'` AND an
 * `activeFlowId` was inherited from a previous trouble flow, release it so the
 * next turn does not feed the user's follow-up question into the dead flow's
 * CHOICE node (which would fall through to `"other": escalate` and emit a
 * spurious washerEscalate reply — F109 root cause).
 *
 * F109 part 2 — also release `activeBranch` when it is `'trouble-machine'`,
 * so the next turn re-routes via the router (loyalty / faq / etc.) instead of
 * being dragged back into the trouble pipeline by sticky-branch dispatch +
 * `guardAutoStartMachineFlow` re-arming the flow from sticky facts.
 */
export function releaseActiveFlow(ar: AgentRuntime): void {
  ar.state.activeFlowId = null
  ar.state.activeStepId = null
  ar.state.lastPresentedStepId = null
  ar.state.retryCount = 0
}

/**
 * F112 — Accept an escalation without a customer name. Called by
 * `guardAnonymousEscalateClosure` when the customer replies with a closure
 * token (gracias/grazie/thanks/merci/obrigado/gracies) instead of giving
 * their name. The escalation reason + pendingEscalation were already set
 * when the escalation was triggered upstream; this transition just clears
 * the name request and finalises the closure.
 *
 * Atomic mutation of `customerNameRequested` (named transition per rule #4)
 * paired with `closeAsEscalated()` (sets pendingClosure='escalated').
 */
export function acceptAnonymousEscalation(ar: AgentRuntime): void {
  ar.state.customerNameRequested = false
  ar.state.pendingClosure = 'escalated'
}

/**
 * F112 — Consume a resolved closure. Called after the resolution ack has been
 * emitted (either by guardResolutionAck or by the applyTurnModeGate
 * resolution short-circuit). Clears `pendingClosure` so T+1 starts fresh
 * without `extractPostResolutionReset` re-firing.
 *
 * Counterpart of `markResolved`: markResolved SETS the closure flag at the
 * moment the bot recognises resolution; consumeResolution CLEARS it once
 * the ack has been delivered. Atomic so no inline mutation is needed.
 */
export function consumeResolution(ar: AgentRuntime): void {
  ar.state.pendingClosure = null
  ar.resolved = false
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

/**
 * F86 — Pivot from any non-machine flow (invoice gather, discount-code gather,
 * double-charge gather, etc.) to a trouble-machine flow.
 *
 * Triggered atomically by the L4 gather guards (invoice-flow, discount-code-
 * flow, payment-double-charge) when the F86 detector
 * `detectTroubleSwitchDuringFlow` matches the customer's turn.
 *
 * BEFORE this transition existed, the gather step would blindly accept the
 * customer's turn as the canonical answer:
 *   - "ah, ahora no funciona la lavadora" would be saved as machineNumber
 *     in discount-code-await-machine
 *   - "scusa, non parte la lavatrice" would be saved as razonSocial in
 *     invoice-ask-company-name
 *   - etc.
 *
 * State pollution was guaranteed for any gather step that ran `field = trimmed`
 * without semantic validation.
 *
 * What this transition does:
 *   - Clears the active non-machine flow's `pendingFlow` (the gather is
 *     abandoned — the customer changed topic)
 *   - Sets `activeBranch = 'trouble-machine'` so the next dispatch routes
 *     to the trouble pipeline
 *   - Clears `activeFlowId` (no display flow yet)
 *   - Preserves sticky customer facts: `location`, `machineType`,
 *     `machineNumber`, `customerName`, `customerPhone` (the customer is the
 *     same; only the conversation topic changed)
 *   - Clears partial gather data (`invoiceData`, `discountCodeData`,
 *     `doubleChargeData`) since the abandoned flow is no longer relevant
 *   - Clears `lastResolvedIntent` / `lastFaqKey` (the FAQ context, if any,
 *     is also abandoned)
 *   - Calls `resetPostEscalationFlags(ar)` for safety (no stale escalation
 *     leaks into the new trouble flow)
 *
 * Iron rule #4 compliant: single atomic transition, all mutations live here.
 *
 * Tested in __tests__/unit/trouble-switch-during-flow.test.ts.
 */
export function pivotToTroubleMachine(ar: AgentRuntime): void {
  ar.state.pendingFlow = ''
  ar.state.activeBranch = 'trouble-machine'
  ar.state.activeFlowId = null
  ar.state.activeStepId = null
  ar.state.lastPresentedStepId = null
  ar.state.lastResolvedIntent = null
  ar.state.lastFaqKey = null
  // Clear partial gather data — the abandoned flow's fields are no longer
  // meaningful. Shape per models/state.ts (verify before editing here).
  ar.state.invoiceData = {
    razonSocial: '',
    direccion: '',
    cif: '',
    fecha: '',
    fechaIso: '',
    costeTotal: '',
    email: '',
    notes: '',
  }
  ar.state.discountCodeData = {
    letters: '',
    fechaIso: '',
    importe: '',
    doorClosed: null,
  }
  // Double-charge has inline fields in SessionState (no nested object).
  // Clear them all so the next trouble-machine flow starts fresh.
  ar.state.doubleChargeNarrativeProvided = false
  ar.state.doubleChargeNarrativeText = ''
  resetPostEscalationFlags(ar)
}

/**
 * Project the statechart's operational facts back onto AgentRuntime so
 * legacy code paths (logs, escalation summary, state patches) see a
 * consistent snapshot of the dialogue.
 *
 * Called by machines/agent-bridge.ts after each statechart turn. Only
 * the union-compatible branch values are projected; v2-only branches
 * (e.g. 'payment') leave `activeBranch` unchanged.
 */
export function projectFromStatechart(
  ar: AgentRuntime,
  branch:
    | 'trouble-machine'
    | 'payment'
    | 'discount-loyalty'
    | 'invoice'
    | 'faq'
    | 'escalation'
    | null,
  facts: {
    location?: string | null
    machineType?: 'washer' | 'dryer' | null
    machineNumber?: string | null
    displayState?: string | null
    customerName?: string | null
  },
): void {
  // For each fact: `undefined` means "skip projection" (the statechart
  // doesn't carry this field), while `null` means "the statechart cleared
  // it on resolve/escalate — wipe it in AgentState too". Without this
  // explicit-null handling, briciole like displayState='DOOR' linger
  // after a resolution and break downstream guards that read AgentState.
  if (facts.location !== undefined) ar.state.location = facts.location ?? ''
  if (facts.machineType !== undefined) ar.state.machineType = facts.machineType ?? ''
  if (facts.machineNumber !== undefined) ar.state.machineNumber = facts.machineNumber ?? ''
  if (facts.displayState !== undefined) ar.state.displayState = facts.displayState ?? ''
  if (facts.customerName != null) ar.state.customerName = facts.customerName

  // When the active branch does NOT carry machine-operational facts
  // (faq, escalation, discount-loyalty), but those fields are still
  // populated from a previously-closed trouble/payment flow, wipe them.
  // Otherwise the legacy pipeline reads stale displayState='DOOR' after
  // the trouble has been resolved and the dialogue moved on.
  const branchCarriesMachineFacts =
    branch === 'trouble-machine' || branch === 'payment' || branch === 'invoice'
  if (!branchCarriesMachineFacts) {
    ar.state.machineType = ''
    ar.state.machineNumber = ''
    ar.state.displayState = ''
  }

  // Branch projection: only project the v1-compatible mappings.
  if (branch === 'trouble-machine') ar.state.activeBranch = 'trouble-machine'
  else if (branch === 'discount-loyalty') ar.state.activeBranch = 'loyalty'
  else if (branch === 'invoice') ar.state.activeBranch = 'invoice'
  else if (branch === 'faq') ar.state.activeBranch = 'faq'
  else if (branch === 'escalation') ar.state.activeBranch = 'escalation'
  // 'payment' has no v1 equivalent — leave activeBranch as-is.
}
