// Generic display-flow guard. Two phases driven by json/display-flows.json
// (validated at boot via models/display-flow.ts). Replaces the hardcoded
// guardCaso5Al001AskBefore / guardCaso14AlmDoor[Escalate] / guardCaso15
// Explain001 / guardCaso15Escalate001 functions, all of which encoded the
// same "intercept display X → emit guidance → handle resolved/persist on
// next turn" shape.

import { t } from '../localization.js'
import { escalate, markResolved, requireCustomerName } from '../state-transitions.js'
import { lang } from './helpers.js'
import type {
  AgentRuntime,
  DisplayFlowDefinition,
  DisplayFlowRequirement,
  Guard,
} from '../../models/index.js'

function normalizeDisplay(token: string): string {
  return token.toUpperCase().replace(/\s+/g, '')
}

function findFlowForDisplay(
  ar: AgentRuntime,
  display: string,
): DisplayFlowDefinition | null {
  if (!display) return null
  const normalized = normalizeDisplay(display)
  return (
    ar.runtime.displayFlows.flows.find((f) =>
      f.displayMatches.some((m) => normalizeDisplay(m) === normalized),
    ) || null
  )
}

function findFlowById(
  ar: AgentRuntime,
  id: string | null,
): DisplayFlowDefinition | null {
  if (!id) return null
  return ar.runtime.displayFlows.flows.find((f) => f.id === id) || null
}

function prerequisitesMet(
  ar: AgentRuntime,
  requires: readonly DisplayFlowRequirement[],
): boolean {
  // SessionState fields are all string|null|boolean; truthy check matches the
  // ad-hoc checks the legacy guards used (e.g. `!!ar.state.location`).
  const s = ar.state as unknown as Record<string, unknown>
  return requires.every((field) => Boolean(s[field]))
}

/**
 * Phase A — start a flow when the display matches and prerequisites are met.
 *
 * Architectural note on `customerNameRequested`: a previous escalation guard
 * may have set this flag during an earlier turn (e.g. an empathy/escalation
 * path that ran before the customer typed the display code). When the
 * customer subsequently provides a display token that has a documented
 * intermediate flow, the flow takes precedence — we intentionally clear
 * `operatorRequested`, `customerNameRequested`, and `pendingEscalation` so
 * the deterministic guidance is shown first. This matches the original
 * behaviour of guardCaso5Al001AskBefore and is the documented intent of the
 * Caso 5 / 14 / 15 use cases (try the documented fix BEFORE handing off).
 */
export const guardDisplayFlowStart: Guard = (ar) => {
  if (ar.state.customerName) return null
  const flow = findFlowForDisplay(ar, ar.state.displayState)
  if (!flow) return null
  if (!prerequisitesMet(ar, flow.requires)) return null

  // Preemption rule: if another flow is currently active but the display the
  // customer just reported maps to a DIFFERENT documented flow (e.g. they
  // were on the SEL guidance from the washer flow-engine and now type
  // "alarm 001"), abandon the previous flow and start the new one. The
  // customer's most-recent display is the truth — earlier flows were
  // chasing an obsolete code. Same-flow re-entry is a no-op so the JSON
  // guidance is not emitted twice.
  if (ar.state.activeFlowId === flow.id) return null

  ar.state.activeFlowId = flow.id
  ar.state.activeStepId = null
  ar.state.operatorRequested = false
  ar.state.customerNameRequested = false
  ar.pendingEscalation = null
  return { reply: t(flow.step.replyKey, lang(ar)), reason: flow.id }
}

/**
 * Phase B — handle the customer's reply after a flow has been started.
 * Resolved → close the case. Persist (or alwaysEscalateOnNextTurn) →
 * escalate with the flow's `escalationReason`. Otherwise return null and
 * let the LLM (or downstream guards) handle it.
 */
export const guardDisplayFlowFollowUp: Guard = (ar, userMessage) => {
  const flow = findFlowById(ar, ar.state.activeFlowId)
  if (!flow) return null
  if (ar.state.customerName || ar.state.customerNameRequested) return null

  const reply = userMessage.trim()

  if (flow.resolvedRegex && new RegExp(flow.resolvedRegex, 'i').test(reply)) {
    ar.state.activeFlowId = null
    markResolved(ar)
    const ackKey = flow.step.resolvedReplyKey
    if (ackKey) {
      return { reply: t(ackKey, lang(ar)), reason: `${flow.id}-resolved` }
    }
    return null
  }

  const shouldEscalate =
    flow.step.alwaysEscalateOnNextTurn === true ||
    (flow.persistFailureRegex !== undefined &&
      new RegExp(flow.persistFailureRegex, 'i').test(reply))

  if (!shouldEscalate) return null

  ar.state.activeFlowId = null
  escalate(ar, flow.escalationReason)
  requireCustomerName(ar)

  const escalateKey = flow.escalationReplyKey || 'reaffirmEscalate'
  const escalateText = t(escalateKey, lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  // `reaffirmEscalate` already contains the name ask in some locales; we
  // append it explicitly for keys that don't (caso15Escalate, etc.) so the
  // operator handover can capture the customer name on the next turn.
  const reply_ = escalateKey === 'reaffirmEscalate' ? escalateText : `${escalateText} ${nameAsk}`
  return { reply: reply_, reason: `${flow.id}-escalate` }
}
