// Caso 12.2 — FAQ precios (location-driven, machine-aware).
//
// Three-phase flow:
//   T1 guardFaqPrices                  — detects price intent. If location
//                                        unknown, arms `faq-prices-await-
//                                        location` and asks "¿en qué pueblo?".
//                                        If known, renders prices directly.
//   T2 guardFaqPricesAwaitLocation     — fires when T1 armed the await flag
//                                        and the location-extractor captured
//                                        a location this turn. Clears the
//                                        flag and renders prices.
//   T3 guardFaqPricesAwaitDryerConfirm — when the bot rendered washer prices
//                                        + dryer hint ("¿también quieres
//                                        información de secadora?"), a "sí"
//                                        reply renders dryer prices. Any
//                                        other reply releases the flag so
//                                        downstream guards take over.
//
// Iron rule #6 (FAQ topic exemption): detectPriceIntent / detectMachineType-
// Mention in utils/intent.ts are regex topic classifiers. See CLAUDE.md
// → "Tracked exemption — FAQ topic guards".

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { detectPriceIntent, detectMachineTypeMention } from '../intent.js'
// detectMachineTypeMention is reused at T3 so a customer reply naming
// the dryer ("y la secadora", "secadora", "dryer") triggers the render
// even when the "sí" confirm word is absent.
import {
  formatWasherPrices,
  formatDryerPrices,
} from '../faq-location-formatter.js'

export const guardFaqPrices: Guard = (ar, userMessage) => {
  if (ar.state.operatorRequested || ar.state.customerNameRequested) return null
  if (!detectPriceIntent(userMessage)) return null

  // F52 (Andrea 2026-05-14): persist the machine type from T1 to T2.
  // Customer asks "quanto costa asciugare?" → detector returns 'dryer';
  // store on state so the T2 location reply can render the dryer block
  // (otherwise renderPrices at T2 sees only "Pineda" and falls back to
  // the washer-default branch).
  const mentionedAtT1 = detectMachineTypeMention(userMessage)
  if (mentionedAtT1) {
    ar.state.faqPricesType = mentionedAtT1
  }

  if (!ar.state.location) {
    ar.state.pendingFlow = 'faq-prices-await-location'
    return { reply: t('pricesAsk', lang(ar)), reason: 'faq-prices-ask-location' }
  }

  return renderPrices(ar, userMessage)
}

export const guardFaqPricesAwaitLocation: Guard = (ar, userMessage) => {
  if (ar.state.pendingFlow !== 'faq-prices-await-location') return null
  if (!ar.state.location) return null

  ar.state.pendingFlow = ''
  return renderPrices(ar, userMessage)
}

export const guardFaqPricesAwaitDryerConfirm: Guard = (ar, userMessage) => {
  if (ar.state.pendingFlow !== 'faq-prices-await-dryer-confirm') return null
  if (!ar.state.location) return null

  // 6-language affirmative. Word-end lookahead because JS \b is ASCII-only
  // and would miss accented "sí"/"sì". Also accept a dryer mention as
  // implicit confirm ("y la secadora", "secadora", "dryer") since the
  // usecases.md §12.2 dialogue shows that as a valid T3 trigger.
  const wordEnd = '(?=\\s|[!?.,;]|$)'
  const isYes = new RegExp(
    `^(yes|y|si|sì|sí|sim|oui|és|d'accord|claro|vale|ok|adelante|certo)${wordEnd}`,
    'i',
  ).test(userMessage.trim().toLowerCase())
  const mentionsDryer = detectMachineTypeMention(userMessage) === 'dryer'

  if (!isYes && !mentionsDryer) {
    // Customer is moving on — release the flag so other guards/branches
    // can handle the new topic deterministically.
    ar.state.pendingFlow = ''
    return null
  }

  ar.state.pendingFlow = ''
  const formatted = formatDryerPrices(ar.state.location, ar.runtime)
  return {
    reply: formatted || t('priceWarning', lang(ar)),
    reason: 'faq-prices-dryer-confirm',
  }
}

// Internal renderer — chooses washer / dryer / both based on the message
// AND the persisted T1 type (F52). Falls back to a generic warning when
// locations.json has no data.
function renderPrices(
  ar: Parameters<Guard>[0],
  userMessage: string,
): ReturnType<Guard> {
  // Resolve type in priority order:
  //   1. Type mentioned in the CURRENT message (most direct).
  //   2. Type persisted from T1 (faqPricesType) — handles "quanto costa
  //      asciugare? → Pineda" where T2 has only the location.
  const mentioned = detectMachineTypeMention(userMessage) || ar.state.faqPricesType
  const lng = lang(ar)
  const loc = ar.state.location!
  ar.state.lastResolvedIntent = 'faq'
  // Once we consume the persisted type, clear it so the next FAQ cycle
  // starts fresh (e.g. customer asks dryer prices, then later asks washer
  // prices → must not be sticky on dryer).
  ar.state.faqPricesType = null

  if (mentioned === 'washer') {
    const formatted = formatWasherPrices(loc, ar.runtime)
    return { reply: formatted || t('priceWarning', lng), reason: 'faq-prices-washer' }
  }
  if (mentioned === 'dryer') {
    const formatted = formatDryerPrices(loc, ar.runtime)
    return { reply: formatted || t('priceWarning', lng), reason: 'faq-prices-dryer' }
  }

  // F53 (Andrea 2026-05-14): no specific machine type → render washers
  // AND explicitly ask "¿también quieres información de secadora?" so a
  // follow-up "sí" has semantic context. Prior design (silent arming of
  // dryer-confirm flag without the question) created a UX short-circuit
  // where an out-of-context "sí" (e.g. "sí, gracias") triggered dryer
  // prices unexpectedly. The question makes the affirmative meaningful.
  const washers = formatWasherPrices(loc, ar.runtime)
  if (washers) {
    ar.state.pendingFlow = 'faq-prices-await-dryer-confirm'
    return {
      reply: `${washers}\n\n${t('pricesDryerHint', lng)}`,
      reason: 'faq-prices-washers-default',
    }
  }
  return { reply: t('priceWarning', lng), reason: 'faq-prices-fallback' }
}
