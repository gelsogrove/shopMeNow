// Branch dispatcher — entry point of the branch-router architecture.
// See docs/branch-router-architecture.md for the full design + migration plan.
//
//   T1:  router classifies → dispatch picks handler → emit reply
//   T2+: state.activeBranch sticky → dispatch goes straight to handler
//   handoff="topic-switch"     → re-route on T+1
//   handoff="delegate-to-legacy" → keep activeBranch sticky, fall back to
//                                  the legacy guard pipeline + LLM

import { classifyMessageBranch, type Branch, type RouterDecision } from '../router.js'
import type { AgentRuntime, SupportedLanguage } from '../../models/index.js'
import { greetingHandler } from './greeting/handler.js'
import { faqHandler } from './faq/handler.js'
import { troubleMachineHandler } from './trouble-machine/handler.js'
import { invoiceHandler } from './invoice/handler.js'
import { loyaltyHandler } from './loyalty/handler.js'
import { escalationHandler } from './escalation/handler.js'
import type { BranchHandler, BranchOutput } from './types.js'

/** Map of implemented branches → handler. All 6 branches register a
 *  handler; the "thin" ones (trouble-machine, invoice, loyalty,
 *  escalation) seed sticky state from the router's details and then
 *  return `delegate-to-legacy` so the existing guard pipeline + LLM
 *  loop produces the actual reply. Migration of those branches to a
 *  fully self-contained state machine is tracked phase by phase in
 *  docs/branch-router-architecture.md. */
const HANDLERS: Partial<Record<Branch, BranchHandler>> = {
  greeting: greetingHandler,
  faq: faqHandler,
  'trouble-machine': troubleMachineHandler,
  invoice: invoiceHandler,
  loyalty: loyaltyHandler,
  escalation: escalationHandler,
}

export interface DispatchResult {
  /** True when a branch handler produced the reply. False means the
   *  dispatcher could not handle this turn (no handler registered for
   *  the chosen branch) — caller falls back to the legacy pipeline. */
  handled: boolean
  output?: BranchOutput
  decision?: RouterDecision
}

/**
 * T1 dispatch: classify the message, store the decision in state, run
 * the matching handler. If no handler is registered for the chosen
 * branch, return `handled: false` so the agent loop falls back to the
 * legacy guard pipeline. This lets us migrate branches incrementally
 * without breaking the bot.
 */
export async function dispatchTurnOne(
  ar: AgentRuntime,
  message: string,
): Promise<DispatchResult> {
  const decision = await classifyMessageBranch(message, { runtime: ar.runtime })
  ar.state.activeBranch = decision.branch
  ar.state.previousBranch = null

  const handler = HANDLERS[decision.branch]
  if (!handler) {
    // Branch not yet migrated — let the legacy pipeline take over.
    return { handled: false, decision }
  }

  const output = await handler({
    message,
    ar,
    routerDetails: decision.details,
    language: decision.language,
  })

  applyHandoff(ar, output)
  // delegate-to-legacy: handler is a thin wrapper. The legacy pipeline
  // does the heavy lifting; we keep activeBranch sticky for T+1 routing
  // but tell the caller "not handled here" so it falls through.
  if (output.handoff === 'delegate-to-legacy') {
    return { handled: false, decision }
  }
  return { handled: true, output, decision }
}

/**
 * T2+ dispatch: skip the router, go straight to the sticky branch
 * handler. If no handler is registered, fall back to the legacy
 * pipeline.
 */
export async function dispatchSubsequentTurn(
  ar: AgentRuntime,
  message: string,
  inputLanguage: SupportedLanguage,
): Promise<DispatchResult> {
  const branch = ar.state.activeBranch
  if (!branch || branch === 'unknown') {
    return { handled: false }
  }
  const handler = HANDLERS[branch]
  if (!handler) {
    return { handled: false }
  }

  const output = await handler({
    message,
    ar,
    routerDetails: {},  // T2+ does not re-run the router
    language: inputLanguage,
  })

  applyHandoff(ar, output)
  if (output.handoff === 'delegate-to-legacy') {
    return { handled: false }
  }
  return { handled: true, output }
}

/** Apply the handler's handoff signal to the runtime state. */
function applyHandoff(ar: AgentRuntime, output: BranchOutput): void {
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
