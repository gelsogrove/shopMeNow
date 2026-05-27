// Loyalty branch handler.
//
// Status: thin wrapper (Andrea, 2026-05-08). The router classifies the
// customer's message as "loyalty" only when they want to BUY or RECHARGE
// the card (general info goes to the "faq" branch with faqKey="loyaltyCard").
// The two operational variants are handled by the legacy guards
// `guardLoyaltyCardBuy` and `guardLoyaltyCardRecharge`. They use a regex
// to distinguish "buy" from "recharge" — that classification stays for
// now; migration to a deterministic branch state machine is future work.

import type { BranchHandler } from '../types.js'

export const loyaltyHandler: BranchHandler = async () => {
  // No state seeding needed — the legacy loyalty guards self-trigger on
  // the customer's message via their own regexes (TARJETA_TOPIC and
  // RECARGA_TOPIC). They run as part of the guard pipeline below.
  return {
    reply: '',
    handoff: 'delegate-to-legacy',
  }
}
