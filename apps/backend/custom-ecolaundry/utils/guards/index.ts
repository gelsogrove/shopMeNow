// Deterministic guards executed BEFORE the LLM call in agentTurn.
//
// Each guard is a pure function that decides whether to short-circuit the
// turn and produce a deterministic reply. Pipeline order is meaningful:
// earlier guards win.
//
// Guards are split by domain across sibling files:
//   - greeting.ts     — pure greeting short-circuit (G0)
//   - payment.ts      — cambio (4, 7), pagado-no-usado (6), código (8), tarjeta (10), recarga (11)
//   - display.ts      — no-photo (17), numeric (18), post-instruction failure, unknown display
//   - display-flow.ts — generic Phase A/B engine driven by json/display-flows.json
//                       (AL001 caso 5, ALM/DOOR caso 14, C001 caso 15, …)
//   - location.ts     — Mataró street, force-gather, location mismatch (21-24)
//   - faq.ts          — closure, factura (9), precio/horarios (12), arrabbiato (25), refund (26-27), contradictory (28)
//
// This file ASSEMBLES them into the canonical ordered pipeline. DO NOT
// reorder without knowing what you are doing — the order encodes priority
// across cases (e.g. Mataró street must fire before any case-specific flow).

import type { AgentRuntime, Guard, GuardOutcome } from '../../models/index.js'

import { guardPureGreeting } from './greeting.js'

import {
  guardNoChangePivotOnDisplay,
  guardNoChangeAsk,
  guardNoChangeNoCambio,
  guardNoChangeYesButBroken,
  guardNoChangeAfterRetry,
} from './payment-no-change.js'
import {
  guardDoubleChargeAskUsed,
  guardDoubleChargeAskNarrative,
  guardDoubleChargeAskType,
  guardDoubleChargeAskNumber,
  guardDoubleChargeAskCardDigits,
  guardDoubleChargeAskReceipt,
  guardDoubleChargeAwaitName,
} from './payment-double-charge.js'
import {
  guardDiscountCodeAsk,
  guardDiscountCodeAwait,
  guardDiscountCodeAwaitName,
  guardDiscountCodeAwaitLocation,
  guardDiscountCodeAwaitMachine,
  guardDiscountCodeAwaitDoor,
} from './discount-code-flow.js'
import { guardLoyaltyCardBuy, guardLoyaltyCardBuyAwaitLocation } from './loyalty-card-buy.js'
import { guardLoyaltyCardRecharge } from './loyalty-card-recharge.js'

import {
  guardAskPhoto,
  guardPostInstructionFailure,
  guardNumericCodeAskLetters,
  guardNumericCodeNoLetters,
  guardEscalateUnknownDisplay,
} from './display.js'

import {
  guardDisplayFlowFollowUp,
  guardDisplayFlowStart,
} from './display-flow.js'

import { guardAlmDisambiguation } from './alm-disambiguation.js'

import {
  guardMataroStreet,
  guardUnknownLocation,
  guardInsistLocation,
  guardForceLocation,
} from './location-resolution.js'
import {
  guardForceMachineType,
  guardForceDisplay,
  guardForceMachineNumber,
} from './force-gather.js'
import { guardLocationGatedMismatch } from './location-gated-mismatch.js'

import { guardFaqClosure } from './faq-closure.js'
import { guardFaqDetergents } from './faq-detergents.js'
import { guardFaqHowToUse, guardFaqHowToUseAwaitLocation } from './faq-how-to-use.js'
import { guardInvoiceFlow } from './invoice-flow.js'
import { guardFaqHours, guardFaqHoursAwaitLocation } from './faq-hours.js'
import {
  guardFaqPrices,
  guardFaqPricesAwaitLocation,
  guardFaqPricesAwaitDryerConfirm,
  guardFaqPricesAwaitWasherConfirm,
} from './faq-prices.js'
import { guardFaqPrograms, guardFaqProgramsAwaitLocation } from './faq-programs.js'
import { guardAngryCustomerEmpathic, guardAngryCustomerEscalate, guardAngryCustomerExplicit } from './angry-customer.js'
import { guardRefundOrCompensation } from './refund-and-compensation.js'
import { guardContradictoryNarrative } from './contradictory-narrative.js'
import { guardDryerMinutesStuck } from './dryer-minutes-stuck.js'
import { guardEscalateNonTroubleshooting } from './faq-non-troubleshooting.js'
import { guardAutoStartMachineFlow } from './auto-start-machine-flow.js'
import { guardAdvanceMachineFlow } from './advance-machine-flow.js'

export type { Guard, GuardOutcome } from '../../models/index.js'

/**
 * Ordered pipeline of guards. The first guard that returns a non-null outcome
 * wins. Order matters — must remain identical to the legacy single-file
 * pipeline (see git history of utils/agent-guards.ts for the original).
 */
export const GUARD_PIPELINE: Guard[] = [
  guardPureGreeting,
  guardMataroStreet,
  // Boundary signal: rage + explicit operator request → immediate escalate.
  // Must run BEFORE guardForceLocation and any gather guard so the customer
  // who screams "muy enfadado, quiero un operador" doesn't get asked
  // "¿en qué lavandería estás?". See angry-customer.ts for rationale.
  guardAngryCustomerExplicit,
  // Caso 12 — FAQ hours, prices & programs (location-driven, data-aware).
  // Must run EARLY: customer asking "¿cuánto cuesta?" / "¿qué horarios?" /
  // "¿qué programas tiene?" gets a concrete data-driven answer (or a location
  // ask) BEFORE the generic gather/flow guards can derail the conversation.
  // T1 guards (intent + maybe-ask-location):
  guardFaqHours,
  guardFaqPrices,
  guardFaqPrograms,
  // Caso 34 — FAQ detergente/jabón: single-turn, no gather needed.
  // Runs early so mid-flow pivots ("¿hay jabón?" mid DOOR troubleshoot) work.
  guardFaqDetergents,
  // Caso 35 — FAQ how-to-use: single-turn, no gather needed.
  // Runs early for same reason — mid-flow pivot ("¿cómo se usa?" mid DOOR) works.
  guardFaqHowToUse,
  // T2 guards (location reply unlocks the answer):
  guardFaqHoursAwaitLocation,
  guardFaqPricesAwaitLocation,
  guardFaqProgramsAwaitLocation,
  guardFaqHowToUseAwaitLocation,
  // T3: "sí" or "y la secadora" follow-up renders dryer prices.
  guardFaqPricesAwaitDryerConfirm,
  // T3 mirror (F58): "sí" or "y la lavadora" follow-up renders washer prices
  // after a dryer-only T2 render.
  guardFaqPricesAwaitWasherConfirm,
  guardFaqClosure,
  // Caso 4 → Caso 3 pivot: when the customer is in the no-change flow and
  // a recoverable display code (SEL/PUSH/DOOR/…) gets extracted, drop the
  // no-change assumption so guardAutoStartMachineFlow can emit the
  // canonical localised display reply. Must run BEFORE the other
  // guardNoChange* so the pivot wins over the no-change ask/await steps.
  guardNoChangePivotOnDisplay,
  guardNoChangeAsk,
  guardNoChangeNoCambio,
  guardNoChangeYesButBroken,
  guardNoChangeAfterRetry,
  guardDiscountCodeAsk,
  guardDiscountCodeAwait,
  guardDiscountCodeAwaitName,
  guardDiscountCodeAwaitLocation,
  guardDiscountCodeAwaitMachine,
  guardDiscountCodeAwaitDoor,
  guardNumericCodeAskLetters,
  guardNumericCodeNoLetters,
  guardInvoiceFlow,
  guardLoyaltyCardRecharge,
  guardLoyaltyCardBuy,
  // T2 of Caso 10 — must run BEFORE guardForce* gather guards so the
  // customer's location reply ("Estoy en Goya") is consumed by the loyalty
  // flow and the per-location override is emitted, instead of being treated
  // as a fresh trouble-machine incident asking for tipo/numero.
  guardLoyaltyCardBuyAwaitLocation,
  // (legacy guardPricingDeflect + guardOpeningHours removed — replaced by
  // guardFaqPrices / guardFaqHours above with full location-aware behaviour.
  // See utils/guards/faq-location-context.ts and Caso 12 in usecases.md.)
  guardAngryCustomerEmpathic,
  guardAngryCustomerEscalate,
  guardContradictoryNarrative,
  guardDryerMinutesStuck,
  // Refund-form name capture must run BEFORE forceLocation/forceDisplay
  // — when the customer replies with their name after the receipt step,
  // we must capture it deterministically and close as refund-form, NOT
  // fall through to a gather guard asking pantalla.
  guardDoubleChargeAwaitName,
  guardDoubleChargeAskUsed,
  guardDoubleChargeAskNarrative,
  guardDoubleChargeAskType,
  guardDoubleChargeAskNumber,
  guardDoubleChargeAskCardDigits,
  guardDoubleChargeAskReceipt,
  guardAskPhoto,
  guardInsistLocation,
  guardUnknownLocation,
  guardRefundOrCompensation,
  // Catch-all for the fact-out-of-order hole: when location is empty but
  // the customer has volunteered display / type / number, every other gather
  // and display-flow guard skips. This guard ALWAYS asks for the location
  // before any flow can start. See location-resolution.ts:guardForceLocation
  // for the rationale and CLAUDE.md → "guard preconditions must not cancel".
  // MUST stay BEFORE guardDisplayFlowStart and guardForce* gather guards.
  guardForceLocation,
  // Phase B before Phase A: when a flow is already active, follow-up logic
  // (resolved/persist) takes priority over re-detection of the display token.
  guardDisplayFlowFollowUp,
  guardDisplayFlowStart,
  // ALM generic: show sub-type list so customer can identify the exact variant.
  // Must come AFTER guardDisplayFlowStart (specific sub-type flows take priority).
  guardAlmDisambiguation,
  // Post-instruction failure (Phase B/C re-ask + escalate) MUST run BEFORE
  // guardAdvanceMachineFlow. Reason: the washer flow's check_result node has
  // a special-case that routes any display-token reply to NO → followup_display
  // — but when we're in Phase C (pendingFlow='display-reask-pending'), the
  // customer's display code is meant to CONFIRM the failure for escalation,
  // NOT to advance the flow. Phase C must intercept first.
  guardPostInstructionFailure,
  // Washer/dryer flow engine catch-all (rule #10): when the LLM skips the
  // advance_machine_flow tool, this guard advances the flow deterministically
  // for unambiguous inputs (YES/NO, numeric, exact key). MUST run AFTER
  // guardPostInstructionFailure (Phase C wins over flow advance) and BEFORE
  // the gather/force guards (so an active flow is not interrupted by a re-ask).
  guardAdvanceMachineFlow,
  guardLocationGatedMismatch,
  guardEscalateNonTroubleshooting,
  guardForceMachineType,
  guardForceMachineNumber,
  guardForceDisplay,
  // Deterministic auto-start of the washer/dryer flow when location +
  // type + number + recoverable display are all set. Replaces the LLM's
  // unreliable `start_machine_flow` tool call. Must come AFTER force-*
  // gather guards (so missing facts get asked first) and AFTER
  // guardDisplayFlowStart (so JSON-declarative flows AL001/ALM-DOOR/C001
  // take priority for their codes).
  guardAutoStartMachineFlow,
  guardEscalateUnknownDisplay,
]

/**
 * Runs the pipeline. Returns the first non-null outcome, or null if no guard fired.
 */
export function runGuardPipeline(ar: AgentRuntime, userMessage: string): GuardOutcome | null {
  for (const guard of GUARD_PIPELINE) {
    const outcome = guard(ar, userMessage)
    if (outcome) return outcome
  }
  return null
}
