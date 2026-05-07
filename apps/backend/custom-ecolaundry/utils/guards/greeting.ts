// Greeting guard — intercepts pure salutations before the LLM call.
//
// When a customer opens with only a greeting ("Ciao", "Hola", "Hi"…)
// the LLM tends to respond with reassuring phrases like "Tranquilo,
// te ayudo" that presuppose a problem before we even know what the
// customer wants. The guard short-circuits that path and returns only
// the location question. applyGuardOutcome() prepends the configured
// welcome from settings.json, so the result is neutral and on-brand.

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { isPureGreeting } from '../greeting.js'

/** G0 — Pure greeting: skip LLM, ask for location directly.
 *
 *  Fires when the customer message is ONLY a salutation and the session
 *  does not yet have a location (or is already in escalation/name flow). */
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
    reply: t('location', lang(ar)),
    reason: 'pure-greeting',
  }
}
