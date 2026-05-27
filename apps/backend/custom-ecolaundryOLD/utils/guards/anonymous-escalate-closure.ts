// F112 — Anonymous escalation closure.
//
// When the bot has escalated and is waiting for the customer's name
// (`customerNameRequested=true`), the customer may not want to give it.
// They may reply with a closure token instead: "gracias" / "grazie" /
// "thanks" / "merci" / "obrigado" / "gracies".
//
// Pre-F112 the name-capture pipeline kept re-asking until a valid name
// was given (Scenario 6 CA 2026-05-26: T3 escalate + asks name → T4
// "gracies" → bot insists "Com et dius?" — frustrating for the customer
// who has clearly closed the conversation).
//
// This guard recognises the closure token, finalises the escalation as
// anonymous (operator will receive the case without a customer name),
// and emits a polite closure reply in the session language.
//
// MUST run BEFORE any other name-capture guard (discount-code-await-name,
// double-charge-await-name) so the closure wins.

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { acceptAnonymousEscalation } from '../state-transitions.js'

// Multilingual closure tokens (6 languages). Same family as the FAQ
// closure tokens but used in a different context (escalation in progress).
// Iron rule #6 boundary-signal exemption.
const ANONYMOUS_CLOSURE_RE =
  /^(gracias|grazie|thanks|thank\s+you|merci|obrigado|obrigada|gr[àa]cies|gracies|gracia|no\s+gracias|nada|no\s+importa|d[eé]jalo|d[eé]jelo|fa\s+res|leave\s+it|nevermind|never\s+mind|laisse\s+tomber|deixa)$/i

export const guardAnonymousEscalateClosure: Guard = (ar, userMessage) => {
  // Only fire when the bot has actually asked for the name as part of an
  // escalation. Without customerNameRequested, "gracias" should be handled
  // by faqClosure or similar, not here.
  if (!ar.state.customerNameRequested) return null
  // Don't intercept inside specific name-capture flows that have their own
  // ladder (discount-code-await-name, double-charge-await-name). Those
  // guards know how to handle their own retry+escalate counter.
  if (
    ar.state.pendingFlow === 'discount-code-await-name' ||
    ar.state.pendingFlow === 'double-charge-await-name' ||
    ar.state.pendingFlow === 'invoice-ask-name'
  ) {
    return null
  }
  const lower = userMessage.trim().toLowerCase().replace(/[.,!?¿¡]/g, '').trim()
  if (!ANONYMOUS_CLOSURE_RE.test(lower)) return null

  // Finalise the escalation as anonymous via named transition.
  acceptAnonymousEscalation(ar)
  return {
    reply: t('escalateAnonymousClosure', lang(ar)),
    reason: 'anonymous-escalate-closure',
  }
}
