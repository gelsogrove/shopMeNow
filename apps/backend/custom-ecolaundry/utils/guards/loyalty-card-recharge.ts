// Caso 11 — Recargar tarjeta de fidelización (FAQ + escalation if needed).
//
// Boundary regex: catches "¿cómo recargo?" / "recargar tarjeta" /
// "how to (re)charge". Once matched, returns the canonical instruction
// from i18n key `loyaltyCardRecharge`. If the central misbehaves the LLM
// drives the rest (no deterministic follow-up).

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'

const RECARGA_TOPIC = /(c[oó]mo\s+recargo|recargar\s+(?:la\s+)?tarjeta|recarga\s+(?:de\s+)?(?:la\s+)?tarjeta|how\s+(?:do\s+i\s+|to\s+)?(?:re)?charge\s+(?:the\s+)?(?:loyalty\s+)?card)/i

export const guardLoyaltyCardRecharge: Guard = (ar, userMessage) => {
  if (
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  if (!RECARGA_TOPIC.test(userMessage)) return null
  ar.state.lastResolvedIntent = 'faq'
  return { reply: t('loyaltyCardRecharge', lang(ar)), reason: 'loyalty-card-recharge' }
}
