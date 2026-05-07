// Closure-related tool handlers:
//   - escalate_to_operator: requires machine facts AND customerName
//   - mark_resolved:        rejected on mixed-signal customer messages
//   - request_photo:        idempotent, no validation
//
// These handlers enforce the conversational invariants that used to be
// described as "rules" in agent.txt. With the validators in place, the
// LLM cannot close a case prematurely or escalate without a real name.

import { detectMixedSignal } from '../mixed-signal.js'
import { logger } from '../logger.js'
import {
  escalate,
  markResolved as markResolvedTransition,
  requireCustomerName,
} from '../state-transitions.js'
import { asTrimmedString } from './arg-coercion.js'
import type { ToolHandler } from './types.js'

export const escalateToOperator: ToolHandler = async (ar, args) => {
  const { state } = ar
  // Datos mínimos: per reglas.md, machine incidents require location +
  // machineType + machineNumber BEFORE escalation. Non-troubleshooting
  // incidents have their own escalation path via the guard pipeline.
  if (
    !state.nonTroubleshootingIncident &&
    state.displayState &&
    (!state.location || !state.machineType || !state.machineNumber)
  ) {
    const missing: string[] = []
    if (!state.location) missing.push('location')
    if (!state.machineType) missing.push('machineType')
    if (!state.machineNumber) missing.push('machineNumber')
    return {
      ok: false,
      error: `cannot escalate yet — missing required facts: ${missing.join(', ')}. Ask the customer for them first.`,
    }
  }
  // 2-turn protocol: customerName MUST be captured BEFORE escalation so
  // the operator handover summary contains a real name (not a registration
  // placeholder). When unknown, force the bot to ask first.
  if (!state.customerName) {
    requireCustomerName(ar)
    logger.warn('escalate_to_operator blocked: customerName not yet captured')
    return {
      ok: false,
      error:
        'cannot escalate yet — customerName is unknown. Ask the customer "what is your name?" (in their language), then call capture_customer_name with the reply, then retry escalate_to_operator.',
    }
  }
  const reason = asTrimmedString(args.reason) ?? 'manual review'
  escalate(ar, reason)
  return { ok: true, data: { reason } }
}

export const markResolved: ToolHandler = async (ar) => {
  // Mixed-signal block: refuse mark_resolved when the customer's last
  // message contains a "yes BUT new-problem" pattern. The LLM is forced
  // to address the new concern instead of closing the case.
  const mixed = detectMixedSignal(ar.state.lastUserMessage)
  if (mixed.detected) {
    logger.warn('mark_resolved blocked: mixed signal in last user message', {
      evidence: mixed.evidence,
      lastUserMessage: ar.state.lastUserMessage,
    })
    return {
      ok: false,
      error: `Mixed signal detected in customer's reply ("${mixed.evidence}"). The customer acknowledged progress AND reported a new concern. Do NOT mark resolved — address the new concern (gather facts, propose canonical fix, or escalate).`,
    }
  }
  markResolvedTransition(ar)
  return { ok: true, data: {} }
}

export const requestPhoto: ToolHandler = async (ar) => {
  ar.photoRequested = true
  ar.state.photoRequested = true
  return { ok: true, data: {} }
}
