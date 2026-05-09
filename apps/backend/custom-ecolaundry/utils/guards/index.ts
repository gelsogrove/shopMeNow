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
  guardNoChangeAsk,
  guardNoChangeNoCambio,
  guardNoChangeYesButBroken,
  guardNoChangeAfterRetry,
} from './payment-no-change.js'
import { guardPaidNotUsedAskChange } from './payment-paid-not-used.js'
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
import { guardLoyaltyCardBuy } from './loyalty-card-buy.js'
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
import { guardInvoiceFlow } from './invoice-flow.js'
import { guardPricingDeflect, guardOpeningHours } from './hours-and-pricing.js'
import { guardAngryCustomerEmpathic, guardAngryCustomerEscalate, guardAngryCustomerExplicit } from './angry-customer.js'
import { guardRefundOrCompensation } from './refund-and-compensation.js'
import { guardContradictoryNarrative } from './contradictory-narrative.js'
import { guardEscalateNonTroubleshooting } from './faq-non-troubleshooting.js'
import { guardAutoStartMachineFlow } from './auto-start-machine-flow.js'

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
  guardFaqClosure,
  guardPaidNotUsedAskChange,
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
  guardPricingDeflect,
  guardOpeningHours,
  guardAngryCustomerEmpathic,
  guardAngryCustomerEscalate,
  guardContradictoryNarrative,
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
  guardPostInstructionFailure,
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
