// Paid-not-used incident — He pagado pero no he podido usar el servicio.
//
// LLM detects the trigger and sets pendingFlow='paid-not-used-ask-change'. After
// the customer gives the location, this guard asks "¿la central te ha
// devuelto el cambio?" and transitions to paid-not-used-await-display (LLM
// drives the rest based on the cambio yes/no).
//
// REMOVED: guardCaso7AwaitDisplay — was a Spanish-only regex classifying
// the customer's yes/no answer. Intent detection across 6 languages is
// the LLM's job. The dialogue from paid-not-used-await-display onward is now
// fully LLM-driven via sticky state + system prompt rules.

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang, notInActiveSubFlow } from './helpers.js'

/** Caso 7 step 1 — after location, ask "¿La central te ha devuelto el cambio?". */
export const guardPaidNotUsedAskChange: Guard = (ar) => {
  if (
    ar.state.pendingFlow === 'paid-not-used-ask-change' &&
    ar.state.location &&
    !ar.state.machineNumber &&
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
