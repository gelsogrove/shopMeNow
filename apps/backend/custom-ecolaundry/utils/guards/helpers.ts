// Shared helpers for the guard pipeline. Type contracts (Guard,
// GuardOutcome) live in ../../models/guards.ts.

import type { AgentRuntime, SessionState, SupportedLanguage } from '../../models/index.js'

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
 *                                yes/no on the cambio in caso4-await-cambio).
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
