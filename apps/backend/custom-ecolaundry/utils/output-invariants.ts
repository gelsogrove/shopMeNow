// L5 — Output policy invariants applied to the LLM-produced reply just
// before it leaves the agent. Each invariant lives in its own file under
// utils/output-invariants/ and removes/rewrites a documented bug-surface
// pattern. The composer here applies them in order.
//
// Why these live in code instead of in the prompt (iron rule #1):
//   - prompt rules degrade as the system prompt grows; the LLM may
//     forget or contradict them on long histories.
//   - L5 invariants are deterministic and audit-loggable.
//   - they document the bug surface they cover, so future Claudes
//     don't try to "fix" the same issue by adding another DO NOT line.

export { stripEvasivePhrases } from './output-invariants/evasive.js'
export { stripLocationParroting } from './output-invariants/location-parrot.js'
export { stripStandalonePaymentQuestion } from './output-invariants/payment-question.js'

import { stripEvasivePhrases } from './output-invariants/evasive.js'
import { stripLocationParroting } from './output-invariants/location-parrot.js'
import { stripStandalonePaymentQuestion } from './output-invariants/payment-question.js'

export interface OutputInvariantContext {
  location: string | null
}

export function applyOutputInvariants(
  reply: string,
  ctx: OutputInvariantContext,
): string {
  let r = reply
  r = stripEvasivePhrases(r)
  r = stripLocationParroting(r, ctx.location)
  r = stripStandalonePaymentQuestion(r)
  return r
}
