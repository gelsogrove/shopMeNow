// Guard: ALM generic disambiguation.
//
// When the customer reports a bare "ALM" display code (without the sub-type
// suffix /A, /E, /DOOR, /VAr) and the machine facts are known, show the
// washerCaseAlm i18n list so the customer can identify the exact variant.
//
// This guard DOES NOT set activeFlowId — it clears displayState so the next
// turn is unblocked and guardDisplayFlowStart can route the specific sub-type
// (ALM/DOOR → alm-door-blocked flow, etc.) or guardAutoStartMachineFlow can
// start the washer flow engine for ALM/A and ALM/E.
//
// Pipeline position: after guardDisplayFlowStart (specific flows take priority)
// and before guardAutoStartMachineFlow (which needs a resolved displayState).

import { t } from '../localization.js'
import { lang } from './helpers.js'
import type { Guard } from '../../models/index.js'

export const guardAlmDisambiguation: Guard = (ar) => {
  if (ar.state.displayState !== 'ALM') return null
  if (!ar.state.location || !ar.state.machineNumber) return null
  // Only fires when no flow is active (specific sub-type flows take priority).
  if (ar.state.activeFlowId) return null

  // Clear displayState so the next turn can set the correct sub-type.
  ar.state.displayState = ''

  return { reply: t('washerCaseAlm', lang(ar)), reason: 'alm-disambiguation' }
}
