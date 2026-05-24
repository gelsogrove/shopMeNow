// Caso 12.1 — FAQ horarios (location-driven).
//
// Two-phase flow:
//   T1 guardFaqHours              — detects hours intent. If location is
//                                   unknown, arms pendingFlow=faq-hours-
//                                   await-location and asks "¿en qué pueblo?".
//                                   If known, renders hours from
//                                   json/locations.json:metadata.hours.
//   T2 guardFaqHoursAwaitLocation — fires when pendingFlow is armed AND the
//                                   location-extractor captured a location
//                                   this turn. Clears the flag and renders.
//
// Iron rule #6 (FAQ topic exemption): detectHoursIntent in utils/intent.ts is
// a regex-based topic classifier — see CLAUDE.md → "Tracked exemption — FAQ
// topic guards" for why this is allowed here.

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { detectHoursIntent } from '../intent.js'
import { formatHours } from '../faq-location-formatter.js'
import type { SupportedLanguage } from '../../models/index.js'

export const guardFaqHours: Guard = (ar, userMessage) => {
  if (ar.state.operatorRequested || ar.state.customerNameRequested) return null
  if (!detectHoursIntent(userMessage)) return null

  if (!ar.state.location) {
    ar.state.pendingFlow = 'faq-hours-await-location'
    return { reply: t('hoursAsk', lang(ar)), reason: 'faq-hours-ask-location' }
  }

  const formatted = formatHours(ar.state.location, ar.runtime, ar.state.language as SupportedLanguage)
  ar.state.lastResolvedIntent = 'faq'
  // F61: mark FAQ subtype so the F51 location-switch block re-arms the
  // correct hours flow on a subsequent location pivot.
  ar.state.lastFaqKey = 'openingHours'
  return {
    reply: formatted || t('openingHoursDefault', lang(ar)),
    reason: 'faq-hours',
  }
}

export const guardFaqHoursAwaitLocation: Guard = (ar) => {
  if (ar.state.pendingFlow !== 'faq-hours-await-location') return null
  if (!ar.state.location) return null

  ar.state.pendingFlow = ''
  ar.state.lastResolvedIntent = 'faq'
  ar.state.lastFaqKey = 'openingHours'
  const formatted = formatHours(ar.state.location, ar.runtime, ar.state.language as SupportedLanguage)
  return {
    reply: formatted || t('openingHoursDefault', lang(ar)),
    reason: 'faq-hours-resolved',
  }
}
