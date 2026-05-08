// No-change incident — He pagado y no se ha activado, sin cambio.
//
// After the gather guards have collected location + machineType +
// machineNumber, the LLM sets pendingFlow='no-change-ask'. This guard
// then deterministically asks "¿la central te ha devuelto el cambio?"
// and transitions to the LLM-driven `no-change-await-confirm` phase.
//
// REMOVED: guardCaso4AwaitCambio + guardCaso4AwaitConfirmation —
// they classified yes/no in Spanish (token-level imports from a few
// other languages) and escalated on negative matches. Same bug surface
// as Caso 5: regex misses any non-enumerated phrasing → wrong escalation.
// The yes/no is now interpreted by the LLM via sticky state.

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'

/** Caso 4 step 4 — after location + tipo + numero, ask
 *  "¿La central te ha devuelto el cambio?". */
export const guardNoChangeAsk: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'no-change-ask' ||
    !ar.state.location ||
    !ar.state.machineType ||
    !ar.state.machineNumber ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.pendingFlow = 'no-change-await-confirm'
  return { reply: t('centralReturnedChange', lang(ar)), reason: 'no-change-ask' }
}
