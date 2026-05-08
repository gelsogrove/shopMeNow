// Generic display-flow guard. Two phases driven by json/display-flows.json
// (validated at boot via models/display-flow.ts). Replaces the hardcoded
// guardCaso5Al001AskBefore / guardCaso14AlmDoor[Escalate] / guardCaso15
// Explain001 / guardCaso15Escalate001 functions, all of which encoded the
// same "intercept display X → emit guidance → handle resolved/persist on
// next turn" shape.

import { t } from '../localization.js'
import { escalate, markResolved, requireCustomerName, startNewFlow } from '../state-transitions.js'
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

  startNewFlow(ar, flow.id)
  return { reply: t(flow.step.replyKey, lang(ar)), reason: flow.id }
}

/**
 * Phase B/C — handle the customer's reply after a flow has been started.
 *
 * Phase B (normal): Resolved → close the case. Persist → escalate (or, if
 *   `flow.reaskBeforeEscalate`, ask for the exact display code first — Phase C).
 *
 * Phase C (reask): pendingFlow was set to 'display-reask-pending' in Phase B.
 *   Whatever the customer sends, escalate immediately and ask for name.
 *
 * In both cases, return null to let the LLM (or downstream guards) handle
 * turns that don't match resolved/persist patterns.
 */
export const guardDisplayFlowFollowUp: Guard = (ar, userMessage) => {
  const flow = findFlowById(ar, ar.state.activeFlowId)
  if (!flow) return null
  if (ar.state.customerName || ar.state.customerNameRequested) return null

  const reply = userMessage.trim()

  // Phase C: we already asked for the exact code on the previous turn.
  // Whatever the customer sent, escalate now (the re-ask purpose was to
  // confirm the code is still the same before handing off to the operator).
  if (ar.state.pendingFlow === 'display-reask-pending') {
    ar.state.pendingFlow = ''
    ar.state.activeFlowId = null
    escalate(ar, flow.escalationReason)
    requireCustomerName(ar)
    const escalateKey = flow.escalationReplyKey || 'reaffirmEscalate'
    const escalateText = t(escalateKey, lang(ar))
    const nameAsk = t('customerNameAsk', lang(ar))
    const reply_ = escalateKey === 'reaffirmEscalate' ? escalateText : `${escalateText} ${nameAsk}`
    return { reply: reply_, reason: `${flow.id}-reask-escalate` }
  }

  // Phase B: resolved?
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

  // Phase B → escalation path.
  // If `reaskBeforeEscalate` is set AND the customer's message does NOT
  // already contain a known display token (e.g. "sigue saliendo" has no
  // code, but "sigue saliendo AL001" already contains it), ask for the
  // exact code first (Phase C next turn). This implements Scenario 5.3.
  if (flow.reaskBeforeEscalate) {
    const normalized = reply.toUpperCase().replace(/\s+/g, '')
    const hasCode = flow.displayMatches.some(
      (m) => normalized.includes(m.toUpperCase().replace(/\s+/g, '')),
    )
    if (!hasCode) {
      ar.state.pendingFlow = 'display-reask-pending'
      return { reply: t('displayShort', lang(ar)), reason: `${flow.id}-reask-ask` }
    }
  }

  ar.state.activeFlowId = null
  escalate(ar, flow.escalationReason)
  requireCustomerName(ar)

  const escalateKey = flow.escalationReplyKey || 'reaffirmEscalate'
  const escalateText = t(escalateKey, lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  const reply_ = escalateKey === 'reaffirmEscalate' ? escalateText : `${escalateText} ${nameAsk}`
  return { reply: reply_, reason: `${flow.id}-escalate` }
}
