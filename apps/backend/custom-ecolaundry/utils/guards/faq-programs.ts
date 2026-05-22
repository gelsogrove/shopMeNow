// Caso 12.4 — FAQ programmi (location-driven, F81).
//
// Two-phase flow:
//   T1 guardFaqPrograms              — detects programs intent. If location is
//                                      unknown, arms pendingFlow=faq-programs-
//                                      await-location and asks "¿en qué pueblo?".
//                                      If known, renders washer + dryer programs
//                                      from json/locations.json:metadata.programs.
//   T2 guardFaqProgramsAwaitLocation — fires when pendingFlow is armed AND the
//                                      location-extractor captured a location
//                                      this turn. Clears the flag and renders.
//
// Iron rule #6 (FAQ topic exemption): detectProgramsIntent in utils/intent.ts
// is a regex-based topic classifier — see CLAUDE.md → "Tracked exemption —
// FAQ topic guards" for why this is allowed here.
//
// Architecture: same pattern as faq-hours.ts and faq-prices.ts (F50 / F81).
// Expanding to a new location = JSON edit only, zero TS changes.

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { detectProgramsIntent } from '../intent.js'
import {
  formatWasherPrograms,
  formatDryerPrograms,
  type ProgramTranslateFn,
} from '../faq-location-formatter.js'

// Build a translate function from the i18n catalogue for this language.
function makeProgramTranslate(ar: Parameters<Guard>[0]): ProgramTranslateFn {
  const lng = lang(ar)
  return (key: string) => t(key as Parameters<typeof t>[0], lng)
}

function renderPrograms(ar: Parameters<Guard>[0]): string {
  const lng = lang(ar)
  const translateFn = makeProgramTranslate(ar)
  const washerList = formatWasherPrograms(ar.state.location, ar.runtime, translateFn)
  const dryerList = formatDryerPrograms(ar.state.location, ar.runtime, translateFn)

  if (!washerList && !dryerList) return t('programsNoData', lng)

  const parts: string[] = []
  if (washerList) {
    parts.push(`${t('programsWasherTitle', lng)}\n\n${washerList}`)
  }
  if (dryerList) {
    parts.push(`${t('programsDryerTitle', lng)}\n\n${dryerList}`)
  }
  return parts.join('\n\n')
}

export const guardFaqPrograms: Guard = (ar, userMessage) => {
  if (ar.state.operatorRequested || ar.state.customerNameRequested) return null
  if (!detectProgramsIntent(userMessage)) return null

  if (!ar.state.location) {
    ar.state.pendingFlow = 'faq-programs-await-location'
    return { reply: t('programsAsk', lang(ar)), reason: 'faq-programs-ask-location' }
  }

  ar.state.lastResolvedIntent = 'faq'
  ar.state.lastFaqKey = 'programs'
  return {
    reply: renderPrograms(ar),
    reason: 'faq-programs',
  }
}

export const guardFaqProgramsAwaitLocation: Guard = (ar) => {
  if (ar.state.pendingFlow !== 'faq-programs-await-location') return null
  if (!ar.state.location) return null

  ar.state.pendingFlow = ''
  ar.state.lastResolvedIntent = 'faq'
  ar.state.lastFaqKey = 'programs'
  return {
    reply: renderPrograms(ar),
    reason: 'faq-programs-resolved',
  }
}
