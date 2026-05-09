// Deterministic follow-up of the washer/dryer machine flow (rule #10
// catch-all for the LLM-tool-driven flow engine).
//
// PROBLEM: when `guardAutoStartMachineFlow` (T1) emits the first prompt of
// `non_parte` (case_push / case_door / case_sel / …), the flow becomes
// active (`state.activeFlowId='non_parte'`). On subsequent turns the LLM is
// expected to call the `advance_machine_flow` tool to consume the customer's
// reply and emit the next prompt. In practice the LLM occasionally skips
// the tool — and improvises a closure (e.g. "¡Perfecto! Si necesitas más
// ayuda…") instead of the canonical resolved/persist node. That breaks the
// flow and the test for the corresponding case.
//
// FIX (CLAUDE.md iron rule #10 corollary): every required step has a
// deterministic catch-all. This guard is the catch-all for the washer/dryer
// flow engine's CONFIRMATION / numeric / exact-match transitions. It calls
// the synchronous `tryAdvanceFlowSync` helper which deliberately skips the
// LLM classify step — when the input is unambiguous (YES/NO normalized,
// numeric option, exact key, …) the guard advances the flow and emits the
// next node's prompt. Free-text or ambiguous replies fall through to null
// so the LLM keeps its chance to call the tool.
//
// Pipeline order: this guard MUST run AFTER `guardDisplayFlowFollowUp`
// (declarative display-flows in json/display-flows.json take priority)
// and BEFORE the gather/force guards (otherwise re-asking would override
// the in-progress flow). See `utils/guards/index.ts`.

import type { Guard } from '../../models/index.js'
import { tryAdvanceFlowSync } from '../flow-engine.js'
import { markResolved, escalate, requireCustomerName } from '../state-transitions.js'
import { lang } from './helpers.js'
import { t } from '../localization.js'

export const guardAdvanceMachineFlow: Guard = (ar, userMessage) => {
  if (
    !ar.state.activeFlowId ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested ||
    ar.state.customerName
  ) {
    return null
  }
  // Only handle the washer/dryer flow engine. The declarative display-flow
  // (display-flows.json: AL001, ALM/DOOR, C001) is handled upstream by
  // `guardDisplayFlowFollowUp`.
  if (ar.state.activeFlowId !== 'non_parte') return null

  const result = tryAdvanceFlowSync(ar.runtime, ar.state, userMessage)
  if (!result) return null

  // Terminal node: tryAdvanceFlowSync has already cleared activeFlowId/
  // activeStepId and set pendingClosure='resolved' for non-escalate
  // terminals. Mirror that into the AgentRuntime via the named transitions
  // so the post-processor sees a coherent state.
  if (result.isTerminal) {
    if (result.action === 'escalate') {
      escalate(ar, ar.state.escalationReason || 'Machine flow escalation')
      requireCustomerName(ar)
      const nameAsk = t('customerNameAsk', lang(ar))
      return { reply: `${result.prompt} ${nameAsk}`, reason: `flow-engine-escalate` }
    }
    // Non-escalate terminal (e.g. non_parte.ok). The flow engine already set
    // pendingClosure='resolved'; lift it through markResolved so ar.resolved
    // is true (matches the LLM-tool path's behaviour).
    markResolved(ar)
  }

  return { reply: result.prompt, reason: `flow-engine-advance` }
}
