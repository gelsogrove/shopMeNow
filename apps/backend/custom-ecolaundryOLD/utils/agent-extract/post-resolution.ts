// approved-by-andrea: REFACTOR ONLY — extracted from utils/agent-extract.ts
// as part of the iron rule #3 split. Zero behavioural change. Iron rule #5
// not applicable (depth-2 file).
//
// Step 2 of autoExtractFacts: post-resolution reset (R2 in the architecture
// doc). Single trigger: state.pendingClosure === 'resolved'.
//
// F38 — discriminate between (a) follow-up flow on the SAME machine
// (preserve machine identity for follow-up factura) and (b) new incident on
// a DIFFERENT machine (full reset). Heuristic: explicit machine-type mention
// that differs from current state.machineType triggers full reset.

import type { AgentRuntime } from '../../models/index.js'
import { normalizeMachineType } from '../intent.js'
import { resetIncidentDetails, resetMachineFacts } from '../state.js'

export function extractPostResolutionReset(ar: AgentRuntime, trimmed: string): void {
  const state = ar.state
  if (state.pendingClosure !== 'resolved') return

  const newType = normalizeMachineType(trimmed)
  const switchedMachine = newType && state.machineType && newType !== state.machineType
  if (switchedMachine) {
    resetMachineFacts(state)
  } else {
    resetIncidentDetails(state)
  }
  state.pendingClosure = null
  ar.resolved = false
}
