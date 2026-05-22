// Shared helpers for the guard pipeline. Type contracts (Guard,
// GuardOutcome) live in ../../models/guards.ts.

import type { AgentRuntime, SessionState, SupportedLanguage } from '../../models/index.js'
import { detectTroubleSwitchDuringFlow } from '../intent.js'
import { pivotToTroubleMachine } from '../state-transitions.js'

export const RECOVERABLE_DISPLAYS = new Set([
  'SEL', 'PUSH', 'PR', 'DOOR', 'ALM/DOOR', 'PRICE', 'BLANK',
])

/**
 * Resolve the language a deterministic guard MUST use when calling t()/tt().
 *
 * Tenant lock contract (settings.json is law):
 *   1. If `state.language` is in `enabledLanguages`, use it.
 *   2. Otherwise, use `defaultLanguage`.
 *
 * This is the SINGLE gate every guard goes through. Even if `state.language`
 * gets corrupted by a misbehaving caller, browser locale leak, phone-prefix
 * heuristic, or LLM tool-call, the deterministic replies stay tenant-
 * compliant. Settings.json `enabledLanguages` is the source of truth for
 * what languages the bot is allowed to speak — no exceptions, no overrides.
 */
export function lang(ar: AgentRuntime): SupportedLanguage {
  const enabled = ar.runtime.settings.enabledLanguages || []
  const stateLang = ar.state.language as SupportedLanguage | undefined
  if (stateLang && enabled.includes(stateLang)) return stateLang
  return ar.runtime.settings.defaultLanguage
}

export function isMataro(ar: AgentRuntime): boolean {
  return /^matar[oó]$/i.test(ar.state.location.trim())
}

/**
 * True when `pendingFlow` is in its LLM-controlled phase (suffix `-await-`).
 *
 * Convention: every multi-step pendingFlow has two phases:
 *   - `caso<N>-ask-<topic>`   → deterministic gathering phase. The bot is
 *                                still asking facts (location, type, number…)
 *                                so the gather guards (forceLocation,
 *                                forceMachineType, forceDisplay, …) MAY fire.
 *   - `caso<N>-await-<topic>` → LLM-controlled interpretation phase. The bot
 *                                already gave a question; the LLM must read
 *                                the customer's reply semantically. Gather
 *                                guards MUST NOT preempt — they would derail
 *                                the flow (e.g. asking "qué aparece en la
 *                                pantalla?" while the bot is waiting for
 *                                yes/no on the cambio in no-change-await-confirm).
 */
export function isAwaitingPendingFlow(state: SessionState): boolean {
  return Boolean(state.pendingFlow) && state.pendingFlow.includes('-await-')
}

/**
 * True when no other multi-step flow is currently in control of the
 * conversation. Used by the gather guards (forceLocation, forceMachineType,
 * forceDisplay, …) to decide whether they may preempt the LLM.
 *
 * Blocked by:
 *   - `activeFlowId` (declarative display-flow in progress)
 *   - `operatorRequested` (escalation already triggered)
 *   - `customerNameRequested` (waiting for the name)
 *   - `pendingFlow` in `-await-` phase (see `isAwaitingPendingFlow`)
 */
export function notInActiveSubFlow(ar: AgentRuntime): boolean {
  return (
    !ar.state.activeFlowId &&
    !ar.state.operatorRequested &&
    !ar.state.customerNameRequested &&
    !isAwaitingPendingFlow(ar.state)
  )
}

/**
 * F86 — Shared gate for every gather step that does verbatim accept.
 *
 * If the customer pivots to a trouble-machine signal mid-gather (e.g.
 * "ah, ahora no funciona la lavadora", "non parte la lavatrice",
 * "the dryer doesn't work"), this helper:
 *   - calls `pivotToTroubleMachine(ar)` atomically (clears the non-machine
 *     flow data, arms `activeBranch='trouble-machine'`, preserves sticky
 *     customer facts)
 *   - returns `true` to signal the caller MUST `return null` so the trouble
 *     pipeline takes over on the next pass / next turn
 *
 * Returns `false` when no pivot signal is detected — the caller proceeds
 * with the normal gather step.
 *
 * Iron rule #16 respected: ONE helper, ONE place. Adding a new non-machine
 * gather guard means importing this and calling it before the verbatim
 * assignment — no copy-paste of the detect/pivot logic.
 *
 * Consumers (per F86 architectural fix):
 *   - `utils/guards/invoice-flow.ts`        (in-flow switch block)
 *   - `utils/guards/discount-code-flow.ts`  (4 await-* steps)
 *   - `utils/guards/payment-double-charge.ts` (4 gather steps)
 *
 * Tested in __tests__/unit/trouble-switch-during-flow.test.ts.
 */
export function pivotIfTroubleSwitch(ar: AgentRuntime, userMessage: string): boolean {
  if (detectTroubleSwitchDuringFlow(ar.runtime, userMessage)) {
    pivotToTroubleMachine(ar)
    return true
  }
  return false
}
