// Branch handoff translation — converts a handler's `output.handoff`
// signal into the corresponding state mutation. Exit-time counterpart
// of boundary-resets.ts (entry-time). Pure function over runtime state.

import type { AgentRuntime } from '../../models/index.js'
import type { BranchOutput } from './types.js'

/** Apply the handler's handoff signal to the runtime state. */
export function applyHandoff(ar: AgentRuntime, output: BranchOutput): void {
  switch (output.handoff) {
    case 'resolved':
      // Branch closed the case → release sticky branch so T+1 starts fresh.
      ar.state.previousBranch = ar.state.activeBranch
      ar.state.activeBranch = null
      break
    case 'topic-switch':
      // Handler explicitly releases control → T+1 will re-run the router.
      ar.state.previousBranch = ar.state.activeBranch
      ar.state.activeBranch = null
      break
    case 'escalate':
      // Escalation already mutated state via state-transitions; we leave
      // activeBranch in place so the rest of the conversation (capture
      // name, handover summary) stays in the escalation branch.
      break
    case 'delegate-to-legacy':
      // Thin handler — the work for this turn is done by the legacy
      // pipeline. Keep activeBranch sticky so T+1 stays in this branch
      // (no re-routing) but signal to the dispatcher that the dispatcher
      // result is "not handled" → agent loop continues with guards + LLM.
      break
    case null:
    case undefined:
      // Branch keeps control on the next turn.
      break
  }
}
