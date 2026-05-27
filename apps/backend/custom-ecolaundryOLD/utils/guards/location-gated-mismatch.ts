// Location-gated escalation: when a customer reports an incident that is
// only documented at SOME of our laundromats (e.g. dryer minutes stuck,
// card payment unreliable), but the customer is at a location where that
// incident is NOT documented, we escalate with a "not documented here"
// reply instead of letting the canned per-location response fire.

import { t, tt } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { escalate, requireCustomerName } from '../state-transitions.js'
import { lang } from './helpers.js'

export const guardLocationGatedMismatch: Guard = (ar) => {
  const incident = ar.state.nonTroubleshootingIncident
  if (
    !ar.state.location ||
    ar.state.operatorRequested ||
    ar.state.customerName ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const isDryerMinutes = incident === 'dryer-minutes-not-credited'
  const isCardPayment = incident === 'card-payment'
  if (!isDryerMinutes && !isCardPayment) return null

  const meta = (ar.runtime.locations?.locations?.[ar.state.location]?.metadata || {}) as Record<string, unknown>
  const flag = isDryerMinutes ? 'dryerMinutesIncreaseIssue' : 'cardPaymentUnreliable'
  if (meta[flag] === true) return null

  escalate(ar, `${incident} reported at ${ar.state.location} (not documented)`)
  requireCustomerName(ar)
  const line = tt('locationGatedNotDocumented', lang(ar), { location: ar.state.location })
  const nameAsk = t('customerNameAsk', lang(ar))
  return {
    reply: `${line} ${nameAsk}`,
    reason: 'location-gated-mismatch',
  }
}
