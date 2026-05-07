// Flow / machineType compatibility detector for the start_machine_flow tool.
//
// Each machine has its own set of declared troubleshooting flows (washer:
// non_parte / stop_error / post_ciclo, dryer: non_parte / errore_reset).
// The LLM occasionally tries a flowId that exists only on the OTHER machine
// — e.g. "caso5-al001" (which is a display-flow id from json/display-flows.json,
// not a machine flow at all). Without validation, `flow-engine.ts:startFlow`
// would throw a generic "Flow X not found" error and the LLM would retry
// blindly. With this validator the tool returns a *guidance* error that tells
// the LLM what to do instead.

import type { FlowMap } from '../models/index.js'

export type MachineType = 'washer' | 'dryer'

export interface FlowCompatibilityReport {
  /** True when (flowId, machineType) is a valid pair declared in the JSON. */
  valid: boolean
  /** Suggested next action when not valid. Used as the tool error message. */
  reason?: string
}

interface CheckArgs {
  flowId: string
  machineType: '' | MachineType
  flows: { washer: FlowMap; dryer: FlowMap }
}

/**
 * Returns `{valid: true}` only when:
 *   1. `machineType` is set (washer or dryer)
 *   2. `flowId` exists under `flows[machineType]`
 *
 * Otherwise returns `{valid: false, reason}` with a message tailored to the
 * actual mismatch (machineType missing, flow not in any machine, flow only
 * available on the OTHER machine, …).
 */
export function checkFlowCompatibility(args: CheckArgs): FlowCompatibilityReport {
  const { flowId, machineType, flows } = args
  const trimmedId = flowId.trim()
  if (!trimmedId) {
    return { valid: false, reason: 'flowId is empty' }
  }
  if (!machineType) {
    return {
      valid: false,
      reason: 'machineType missing — capture it via set_machine_facts before starting a flow',
    }
  }
  const target = machineType === 'dryer' ? flows.dryer : flows.washer
  if (target[trimmedId]) {
    return { valid: true }
  }
  // Surface a helpful message: the flow IS declared, but on the OTHER machine.
  const other = machineType === 'dryer' ? flows.washer : flows.dryer
  if (other[trimmedId]) {
    const otherType: MachineType = machineType === 'dryer' ? 'washer' : 'dryer'
    return {
      valid: false,
      reason: `Flow "${trimmedId}" is declared only for ${otherType}, not for ${machineType}. For ${machineType} alarms not in the catalog, escalate to operator.`,
    }
  }
  return {
    valid: false,
    reason: `Flow "${trimmedId}" is not a registered machine flow. Available flows for ${machineType}: ${Object.keys(target).filter((k) => !k.startsWith('_')).join(', ') || '(none)'}. Use one of these or escalate.`,
  }
}
