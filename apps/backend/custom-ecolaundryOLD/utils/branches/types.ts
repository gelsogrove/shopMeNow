// Branch handler contract (target — see docs/branch-router-architecture.md).
//
// Each branch under utils/branches/<branch>/handler.ts implements this
// interface. The dispatcher in utils/branches/index.ts routes to the
// right handler based on state.activeBranch (sticky after T1 router).

import type { AgentRuntime, SessionState, SupportedLanguage } from '../../models/index.js'
import type { RouterDecision } from '../router.js'

/** Outcome a branch handler may signal back to the agent loop.
 *
 *  - 'resolved'           branch closed the case (mark_resolved equivalent)
 *  - 'escalate'           handover to operator (state already mutated)
 *  - 'topic-switch'       re-invoke the router for the next turn
 *  - 'delegate-to-legacy' handler is a thin wrapper; let the legacy guard
 *                         pipeline handle this turn. The dispatcher keeps
 *                         state.activeBranch set so subsequent turns stay
 *                         in this branch (no re-routing) but the actual
 *                         work is done by the legacy pipeline + LLM.
 *  - null/undefined       branch keeps control on the next turn (its own
 *                         deterministic state machine drives the next reply)
 */
export type BranchHandoff =
  | 'resolved'
  | 'escalate'
  | 'topic-switch'
  | 'delegate-to-legacy'
  | null

export interface BranchInput {
  /** The customer's last message (after L1 sanitisation). */
  message: string
  /** Mutable agent runtime — handlers can call state-transitions on it. */
  ar: AgentRuntime
  /** The router's classification details (only relevant on T1; subsequent
   *  turns receive an empty object). */
  routerDetails: RouterDecision['details']
  /** Customer language as detected by the router (or sticky on subsequent
   *  turns). The output language is still controlled by settings.welcomeMessage
   *  / settings.enabledLanguages — this field is ONLY for input
   *  understanding (so a per-language regex / per-language reply file can
   *  pick the right strings). */
  language: SupportedLanguage
}

export interface BranchOutput {
  /** Customer-facing reply text. Must respect settings.enabledLanguages
   *  for OUTPUT (e.g. ES tenant always replies in ES). */
  reply: string
  /** Optional handoff signal:
   *    - 'resolved'      → branch closes the case (mark_resolved equivalent)
   *    - 'escalate'      → handover to operator
   *    - 'topic-switch'  → re-invoke the router for the next turn
   *    - null/undefined  → branch keeps control on the next turn
   */
  handoff?: BranchHandoff
}

export type BranchHandler = (input: BranchInput) => Promise<BranchOutput>

/** Helper: pick the per-language strings file for a branch. Each branch
 *  registers its language map at module load. */
export type BranchI18n<T> = Partial<Record<SupportedLanguage, T>>

export function pickLang<T>(
  i18nMap: BranchI18n<T>,
  customerLang: SupportedLanguage,
  fallbackLang: SupportedLanguage = 'es',
): T {
  return i18nMap[customerLang] ?? i18nMap[fallbackLang] ?? Object.values(i18nMap)[0] as T
}

/** Helper: did a previous turn already activate a branch? */
export function hasActiveBranch(state: SessionState): boolean {
  return state.activeBranch != null && state.activeBranch !== 'unknown'
}
