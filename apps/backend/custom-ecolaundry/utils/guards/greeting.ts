// Greeting guard — intercepts pure salutations before the LLM call.
//
// When a customer opens with only a greeting ("Ciao", "Hola", "Hi"…)
// we don't yet know what they want — they might have a machine
// problem, but they could also be asking for opening hours, prices,
// an invoice, loyalty card recharge, etc. We must NOT presume a
// machine incident by asking "where is the laundry?" up front; that
// closes off all the non-incident paths.
//
// The guard returns a NEUTRAL open question ("tell me, how can I
// help you?") and lets the LLM (or a downstream guard) ask for the
// location only once the customer has expressed a need that requires
// it. applyGuardOutcome() prepends the configured welcome from
// settings.json, so the result is neutral and on-brand.

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { isPureGreeting } from '../greeting.js'

/** G0 — Pure greeting: skip LLM, open with a neutral "how can I help?".
 *
 *  Fires when the customer message is ONLY a salutation and the session
 *  does not yet have a location (or is already in escalation/name flow).
 *  Asks an open question (i18n key `greetingOpen`) instead of forcing
 *  the location — the location is gathered later by the gather guards
 *  only when the customer actually reports a machine incident. */
export const guardPureGreeting: Guard = (ar, userMessage) => {
  if (
    ar.state.location ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  if (!isPureGreeting(userMessage)) return null
  return {
    reply: t('greetingOpen', lang(ar)),
    reason: 'pure-greeting',
  }
}
