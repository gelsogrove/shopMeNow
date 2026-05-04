// Shared helpers for the guard pipeline. Type contracts (Guard,
// GuardOutcome) live in ../../models/guards.ts.

import type { AgentRuntime } from '../../models/index.js'

export const RECOVERABLE_DISPLAYS = new Set([
  'SEL', 'PUSH', 'PR', 'DOOR', 'ALM/DOOR', 'PRICE', 'BLANK',
])

export function lang(ar: AgentRuntime) {
  return ar.state.language || ar.runtime.settings.defaultLanguage
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
