// Multi-step flow handlers — start_machine_flow / advance_machine_flow.
// Each delegates to flow-engine; we add a flow/machine compatibility check
// upstream so the LLM gets actionable guidance instead of a raw "not found".

import { advanceActiveFlow, startFlow } from '../flow-engine.js'
import { checkFlowCompatibility } from '../flow-compatibility.js'
import { logger } from '../logger.js'
import { t } from '../localization.js'
import { lang } from '../guards/helpers.js'
import { asTrimmedString } from './arg-coercion.js'
import type { TranslationKey } from '../localization.js'
import type { ToolHandler } from './types.js'

export const startMachineFlow: ToolHandler = async (ar, args) => {
  const flowId = asTrimmedString(args.flowId) ?? 'non_parte'
  const compatibility = checkFlowCompatibility({
    flowId,
    machineType: ar.state.machineType,
    flows: ar.runtime.flows,
  })
  if (!compatibility.valid) {
    logger.warn('start_machine_flow rejected by compatibility check', {
      flowId,
      machineType: ar.state.machineType,
      reason: compatibility.reason,
    })
    return { ok: false, error: compatibility.reason || 'flow not compatible' }
  }
  try {
    const translateFn = (key: string) => t(key as TranslationKey, lang(ar))
    const result = startFlow(ar.runtime, ar.state, flowId, translateFn)
    return {
      ok: true,
      data: {
        stepId: result.stepId,
        prompt: result.prompt,
        isTerminal: result.isTerminal,
        action: result.action,
      },
    }
  } catch (err) {
    logger.warn('start_machine_flow failed', {
      flowId,
      machineType: ar.state.machineType,
      error: err instanceof Error ? err.message : String(err),
    })
    return { ok: false, error: (err as Error).message }
  }
}

export const advanceMachineFlow: ToolHandler = async (ar, args) => {
  const userReply = asTrimmedString(args.userReply) ?? ''
  try {
    const translateFn = (key: string) => t(key as TranslationKey, lang(ar))
    const result = await advanceActiveFlow(ar.runtime, ar.state, userReply, translateFn)
    return {
      ok: true,
      data: {
        stepId: result.stepId,
        prompt: result.prompt,
        isTerminal: result.isTerminal,
        action: result.action,
      },
    }
  } catch (err) {
    logger.warn('advance_machine_flow failed', {
      activeFlowId: ar.state.activeFlowId,
      activeStepId: ar.state.activeStepId,
      error: err instanceof Error ? err.message : String(err),
    })
    return { ok: false, error: (err as Error).message }
  }
}
