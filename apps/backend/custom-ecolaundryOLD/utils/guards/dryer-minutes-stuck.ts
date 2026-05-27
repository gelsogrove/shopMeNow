// Dryer minutes not credited — Caso 21/22 — Alemanya/Pineda coins stuck.
//
// When a customer adds money/coins to the dryer central but the minutes
// don't increase (a known issue at Alemanya and Pineda), detect this
// scenario and escalate with context that this is a location-specific
// technical issue, not a payment problem.
//
// Pattern: "añadí dinero/monedas a la secadora pero no suma"
// Languages: ES/CA/EN/IT (6-lang coverage per iron rule #8)

import type { Guard } from '../../models/index.js'
import { escalate, requireCustomerName } from '../state-transitions.js'
import { t, tt } from '../localization.js'
import { lang } from './helpers.js'

export const guardDryerMinutesStuck: Guard = (ar, userMessage) => {
  if (ar.state.operatorRequested || ar.state.customerNameRequested) return null

  const reply = userMessage.trim().toLowerCase()
  // Regex from json/nlu-patterns.json — dryer coins/money but minutes don't increase
  const isDryerMinutesStuck =
    /(?:m[aá]s\s+dinero|m[aá]s\s+monedas|a[ñn]ad(?:i|ido|i[óo])\s+tiempo|a[ñn]ad(?:i|ido|i[óo])\s+monedas|put\s+more\s+money).*(?:secadora|asciugatrice|dryer)|(?:secadora|asciugatrice|dryer).*(?:no\s+(?:suma|sumado|sumam|sum[óo])|no\s+(?:lo\s+)?ha\s+sumado|no\s+aumenta|no\s+aument[óo])/i.test(
      reply
    ) ||
    // CA patterns
    /(?:m[eé]s\s+diners|m[eé]s\s+monedes|a[mn]ad(?:i|it)\s+temps|a[mn]ad(?:i|it)\s+monedes).*(?:assecadora|secadora)|(?:assecadora|secadora).*(?:no\s+(?:suma|sumat|sumem|puja)|no\s+(?:li\s+)?ha\s+sumat|no\s+augment)/i.test(
      reply
    ) ||
    // EN patterns (added moneda/coins/money to dryer, minutes did not increase)
    /(?:added?\s+(?:money|coins|cash)|put\s+more\s+(?:money|coins)).*(?:dryer|dryer\s+machine)|(?:dryer|dryer\s+machine).*(?:time\s+(?:didn't|did\s+not|don't)\s+(?:increase|go\s+up|add)|minutes?\s+(?:didn't|did\s+not|don't)\s+(?:increase|add)|didn't\s+(?:add|work))/i.test(
      reply
    ) ||
    // IT patterns (ho aggiunto soldi ma il tempo non aumenta)
    /(?:ho\s+aggiunt|aggiunti|aggiunta).*(?:soldi|monete|denaro).*(?:asciugatrice|asciuga)|(?:asciugatrice|asciuga).*(?:non\s+(?:aggiungetempi|aumenta|aggiunge))/i.test(
      reply
    )

  if (!isDryerMinutesStuck) return null

  // Known location: check if dryerMinutesIncreaseIssue is true
  const hasKnownIssue = ar.state.location &&
    ar.runtime.locations?.[ar.state.location]?.metadata?.dryerMinutesIncreaseIssue === true

  if (hasKnownIssue) {
    // Location-gated dryer-minutes issue (Alemanya, Pineda). Escalate
    // with context that this is a known technical problem, not the
    // customer's fault. The operator will offer a workaround or
    // compensation.
    ar.state.nonTroubleshootingIncident = 'dryer-minutes-not-credited'
    escalate(ar, 'Dryer minutes not credited (location-gated technical issue)')
    requireCustomerName(ar)
    const escalateText = tt('reassurance', ar.state.language)
    const nameAsk = t('customerNameAsk', lang(ar))
    return { reply: `${escalateText}\n\n${nameAsk}`, reason: 'dryer-minutes-stuck-escalate' }
  }

  // Location not identified yet, or location does not have this issue
  // documented. Delegate to the legacy guard pipeline so the LLM can
  // ask for more context or location clarification.
  return null
}
