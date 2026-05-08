// Paid-not-used incident — He pagado pero no he podido usar el servicio.
//
// LLM detects the trigger and sets pendingFlow='paid-not-used-ask-change'.
// The gather guards (guardForceMachineType, guardForceMachineNumber) run
// normally and collect tipo + numero. Once both are known, this guard asks
// "¿la central te ha devuelto el cambio?" and transitions to
// paid-not-used-await-display (LLM drives the rest).
//
// Scenarios 7.1/7.2: the customer may answer the cambio question with the
// display code directly (e.g. "PUSH PROG"). The LLM-driven phase handles
// this: it recognises the code, stores displayState, and routes to the
// display-specific instruction.

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang, notInActiveSubFlow } from './helpers.js'

/** Caso 7 — after location + machineType + machineNumber, ask "¿La central te ha devuelto el cambio?". */
export const guardPaidNotUsedAskChange: Guard = (ar) => {
  if (
    ar.state.pendingFlow === 'paid-not-used-ask-change' &&
    ar.state.location &&
    ar.state.machineType &&
    ar.state.machineNumber &&
    !ar.state.displayState &&
    notInActiveSubFlow(ar) &&
    ar.state.turnCount >= 2
  ) {
    ar.state.pendingFlow = 'paid-not-used-await-display'
    return {
      reply: t('centralReturnedChange', lang(ar)),
      reason: 'paid-not-used-ask-change',
    }
  }
  return null
}
