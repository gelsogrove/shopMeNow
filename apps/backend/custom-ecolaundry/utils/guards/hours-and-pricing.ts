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

// Multilingual price-topic detector. Tenant runs ES today (rule #8 "Spanish
// first" exemption) but the customer can still type in any of the 6
// supported languages — we recognise the topic and let the deterministic
// reply fire instead of falling through to "I don't recognise that location".
const PRECIO_TOPIC = /(cu[aá]nto\s+cuesta|qu[eé]\s+precio|cu[aá]l\s+es\s+el\s+precio|how\s+much\s+(?:does\s+it\s+)?cost|quanto\s+costa|qual\s+[èe]\s+il\s+prezzo|combien\s+(?:co[ûu]te|coute)|qual\s+[ée]\s+o\s+pre[çc]o|quin\s+[ée]s\s+el\s+preu)/i

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

// Multilingual opening-hours detector. ES is the active tenant language
// (rule #8 "Spanish first" exemption) but customers can type in IT/EN/CA/PT/FR
// and still expect the canonical hours reply.
const HORARIOS_TOPIC = /(\bhorario\b|\bhorarios\b|qu[eé]\s+horas?|a\s+qu[eé]\s+hora|cu[aá]ndo\s+abr|cu[aá]ndo\s+cierr|opening\s+hours|what\s+time|\bche\s+orari?\b|\borario\b|\borari\b|a\s+che\s+ora|quando\s+(?:apr|chiud)|\bhoraires?\b|quels?\s+horaires|\bhor[áa]rios?\b|que\s+horas|\bhoraris?\b|quins\s+horaris)/i

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
