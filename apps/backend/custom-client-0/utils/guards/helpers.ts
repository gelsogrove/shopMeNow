// Shared helpers for the guard pipeline. Type contracts (Guard,
// GuardOutcome) live in ../../models/guards.ts.

import type { AgentRuntime, SupportedLanguage } from '../../models/index.js'

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

export function notInActiveSubFlow(ar: AgentRuntime): boolean {
  return (
    !ar.state.activeFlowId &&
    !ar.state.operatorRequested &&
    !ar.state.customerNameRequested
  )
}
