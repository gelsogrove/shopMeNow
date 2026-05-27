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
import { currentFlowNode, resolveNodePrompt, tryAdvanceFlowSync } from '../flow-engine.js'
import { markResolved, escalate, requireCustomerName } from '../state-transitions.js'
import { lang } from './helpers.js'
import { t, type TranslationKey } from '../localization.js'

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

  const translateFn = (key: string) => t(key as TranslationKey, lang(ar))
  const result = tryAdvanceFlowSync(ar.runtime, ar.state, userMessage, translateFn)

  // F113 — Ambiguous reply mid-flow re-prompt + 2-strike escalate ladder.
  // When tryAdvanceFlowSync returns null (reply does not match any documented
  // transition for the current node), the LLM used to receive the turn and
  // occasionally improvised a regression like re-asking for facts already in
  // state ("Qual è il numero della lavatrice? Cosa c'è scritto sullo schermo?")
  // — iron rule #10 violation (active flow not governed by a deterministic
  // catch-all). The fix re-emits the current node's prompt; after 2 misses we
  // escalate to operator so the customer is never stuck in a loop.
  if (!result) {
    const node = currentFlowNode(ar.runtime, ar.state)
    if (!node || node.type === 'ROUTER' || node.isTerminal) return null
    const attempts = ar.state.flowReaskAttempts ?? 0
    if (attempts >= 2) {
      ar.state.flowReaskAttempts = 0
      escalate(ar, 'Customer reply not actionable inside active machine flow after repeated attempts')
      requireCustomerName(ar)
      const nameAsk = t('customerNameAsk', lang(ar))
      const escalateMsg = t('flowEngineEscalate', lang(ar))
      return { reply: `${escalateMsg} ${nameAsk}`, reason: 'flow-engine-stuck-escalate' }
    }
    ar.state.flowReaskAttempts = attempts + 1
    const prompt = resolveNodePrompt(node, translateFn)
    if (attempts === 0) {
      return { reply: prompt, reason: 'flow-engine-reprompt' }
    }
    const hint = t('flowEngineReprompt', lang(ar))
    return { reply: `${hint}\n\n${prompt}`, reason: 'flow-engine-reprompt-hint' }
  }

  // Forward progress: reset the re-prompt counter.
  ar.state.flowReaskAttempts = 0

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
