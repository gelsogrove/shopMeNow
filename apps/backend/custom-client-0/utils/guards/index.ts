// Deterministic guards executed BEFORE the LLM call in agentTurn.
//
// Each guard is a pure function that decides whether to short-circuit the
// turn and produce a deterministic reply. Pipeline order is meaningful:
// earlier guards win.
//
// Guards are split by domain across sibling files:
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

import {
  guardCaso7AskCambio,
  guardCaso4AskCambio,
  guardCaso6AskPodidoLavar,
  guardCaso6AskRelato,
  guardCaso6Ask4Digitos,
  guardCaso6AskCaptura,
  guardCaso8AskCode,
  guardCaso8AwaitLocation,
  guardCaso8AskAmount,
  guardCaso8ConfirmLocation,
  guardCaso8AwaitAmount,
  guardCaso10Tarjeta,
  guardCaso11Recarga,
} from './payment.js'

import {
  guardCaso17AskPhoto,
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
  guardCaso31InsistLocation,
  guardForceMachineType,
  guardForceDisplay,
  guardForceMachineNumber,
  guardCaso2124LocationMismatch,
} from './location.js'

import {
  guardFaqClosure,
  guardCaso9Factura,
  guardCaso12Precio,
  guardCaso12Horarios,
  guardCaso25Empathic,
  guardCaso25Escalate,
  guardCaso26Refund,
  guardCaso28Contradictory,
  guardEscalateNonTroubleshooting,
} from './faq.js'

export type { Guard, GuardOutcome } from '../../models/index.js'

/**
 * Ordered pipeline of guards. The first guard that returns a non-null outcome
 * wins. Order matters — must remain identical to the legacy single-file
 * pipeline (see git history of utils/agent-guards.ts for the original).
 */
export const GUARD_PIPELINE: Guard[] = [
  guardMataroStreet,
  guardFaqClosure,
  guardCaso7AskCambio,
  guardCaso4AskCambio,
  guardCaso8AskCode,
  guardCaso8AwaitLocation,
  guardCaso8AskAmount,
  guardCaso8ConfirmLocation,
  guardCaso8AwaitAmount,
  guardNumericCodeAskLetters,
  guardNumericCodeNoLetters,
  guardCaso9Factura,
  guardCaso11Recarga,
  guardCaso10Tarjeta,
  guardCaso12Precio,
  guardCaso12Horarios,
  guardCaso25Empathic,
  guardCaso25Escalate,
  guardCaso28Contradictory,
  guardCaso6AskPodidoLavar,
  guardCaso6AskRelato,
  guardCaso6Ask4Digitos,
  guardCaso6AskCaptura,
  guardCaso17AskPhoto,
  guardCaso31InsistLocation,
  guardUnknownLocation,
  guardCaso26Refund,
  // Phase B before Phase A: when a flow is already active, follow-up logic
  // (resolved/persist) takes priority over re-detection of the display token.
  guardDisplayFlowFollowUp,
  guardDisplayFlowStart,
  guardPostInstructionFailure,
  guardCaso2124LocationMismatch,
  guardEscalateNonTroubleshooting,
  guardForceMachineType,
  guardForceMachineNumber,
  guardForceDisplay,
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
