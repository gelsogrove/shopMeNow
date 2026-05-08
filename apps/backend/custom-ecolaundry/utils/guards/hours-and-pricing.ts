// Caso 12 — Horarios y precios.
//
// Two related guards:
//   - guardPricingDeflect: customer asks "¿cuánto cuesta?" → "tengo que revisarlo"
//   - guardOpeningHours: customer asks "¿cuál es el horario?" → uses
//     per-location faqOverrides.openingHours when available, otherwise the
//     default (8-22). Also handles the follow-up "¿y en L'Escala?" form.

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'

const PRECIO_TOPIC = /(cu[aá]nto\s+cuesta|qu[eé]\s+precio|cu[aá]l\s+es\s+el\s+precio|how\s+much\s+(?:does\s+it\s+)?cost)/i

export const guardPricingDeflect: Guard = (ar, userMessage) => {
  if (
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  if (!PRECIO_TOPIC.test(userMessage)) return null
  return {
    reply: t('pricingDeflect', lang(ar)),
    reason: 'pricing-deflect',
  }
}

const HORARIOS_TOPIC = /(\bhorario\b|\bhorarios\b|qu[eé]\s+horas?|a\s+qu[eé]\s+hora|cu[aá]ndo\s+abr|cu[aá]ndo\s+cierr|opening\s+hours)/i

export const guardOpeningHours: Guard = (ar, userMessage) => {
  if (
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const isHorarioFollowUp =
    ar.state.lastResolvedIntent === 'faq' &&
    /^[¿¡]?\s*(?:y|and|e)\s+(?:en\s+)?(goya|pineda|l['']?escala|alemanya|hortes|matar[oó])/i.test(userMessage.trim())
  if (!HORARIOS_TOPIC.test(userMessage) && !isHorarioFollowUp) return null
  const followUpLocationMatch = userMessage.match(/(goya|pineda|l['']?escala|alemanya|hortes|matar[oó])/i)
  const inlineLocation = followUpLocationMatch?.[1] || ''
  const checkLocation = inlineLocation || ar.state.location
  // Data-driven: use faqOverrides.openingHours from locations.json when available,
  // fall back to the default general hours string. This avoids hardcoding
  // location-specific hours and keeps L'Escala's extended schedule in one place.
  const locData = checkLocation
    ? (ar.runtime.locations?.locations?.[checkLocation] as { faqOverrides?: Record<string, string> } | undefined)
    : null
  const reply = locData?.faqOverrides?.['openingHours'] ?? t('openingHoursDefault', lang(ar))
  ar.state.lastResolvedIntent = 'faq'
  return { reply, reason: 'opening-hours' }
}
