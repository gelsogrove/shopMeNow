// Caso 10 — Tarjeta de fidelización (purchase / overrides per location).
//
// LLM is allowed to detect the topic via free-text (boundary signal — the
// regex below catches the canonical phrasing across the 6 supported
// languages so the deterministic answer can fire without an extra LLM
// hop). Once topic is known, the answer is read from `getFaqs()` (Tier 1
// system FAQ key `loyaltyCard`) and from per-location `faqOverrides`.

import { t } from '../localization.js'
import { getFaqs } from '../runtime.js'
import { getLocalisedFaqOverride, getLocalisedFaqOverrideFromBlock } from '../faq-overrides.js'
import { resolveAllKnownLocations } from '../message-parsing.js'
import type { Guard, SupportedLanguage } from '../../models/index.js'
import { lang } from './helpers.js'

/**
 * Resolve the buy-loyalty-card faqOverride for the customer's effective
 * location. When the customer is at Mataró (multi-street), `state.location`
 * is "Mataró" but `state.locationStreet` carries the actual laundromat
 * ("Goya" or "Alemanya"). The JSON overrides live under the street key, so
 * we fall back to locationStreet when location has no override.
 *
 * F100 — needed because guardMataroStreet answers at T1 (before the guard
 * buy can), and by T2 state.location is still "Mataró" while locationStreet
 * is the sub-location the customer just named.
 */
function getLoyaltyOverride(ar: Parameters<Guard>[0], language: SupportedLanguage): string | null {
  // Try the canonical location first (works for all non-Mataró laundries).
  const direct = getLocalisedFaqOverride(ar, 'buy-loyalty-card', language)
  if (direct) return direct
  // Mataró fallback: try locationStreet as the key.
  const street = ar.state.locationStreet
  if (!street) return null
  const streetLoc = ar.runtime.locations?.locations?.[street] as
    | { faqOverrides?: Record<string, unknown> }
    | undefined
  return getLocalisedFaqOverrideFromBlock(streetLoc, 'buy-loyalty-card', language)
}

// F25 (Andrea 2026-05-10 audit): added "tarjeta de descuento" and "quiero la
// tarjeta" patterns from usecases.md riga 1113 ("Quiero la tarjeta de
// descuento") which the legacy regex missed.
// F44 — Andrea 2026-05-11: extended the intent-verb pattern to allow an
// optional action verb (comprar/tener/conseguir/sacar/adquirir) AND an
// optional adjective ("nueva", "otra") between the intent verb and
// "tarjeta". Catches "quiero comprar una nueva tarjeta" / "necesito sacar
// la tarjeta" / "me gustaría tener una tarjeta nueva" that the previous
// pattern missed.
// Iron rule #8 (multi-language by design): regex covers ES + CA + EN +
// IT/PT/FR for the "buy loyalty card" topic. The Catalan word for "card" is
// "targeta" (j→j swap from ES "tarjeta", regression Andrea 2026-05-23 chat
// where "Com aconsegueixo la targeta de fidelització?" was NOT detected and
// the bot routed to trouble-machine).
// F93 (Andrea CLI 2026-05-23): customer typed "come funziona la tessera di
// fidelizzazione?" — bot answered with howToUse FAQ instead of loyaltyCard.
// IT colloquial vocabulary uses "tessera" (not "carta") and "fidelizzazione"
// (not "fedeltà"). Without these tokens, the legacy guard couldn't catch the
// topic as a fallback when the router LLM misclassified to howToUse.
// Pattern preservativo: every loyalty-card detector for IT MUST cover both
// "carta fedeltà" (formal) and "tessera (di) fidelizzazione/fedeltà"
// (colloquial). Same lesson as F15 (formal vs colloquial vocabulary).
// F98 — extended with cross-location possession/use patterns: "tengo la tarjeta
// de X" / "ho comprato la tessera a X" / "tinc la targeta de X" / "j'ai acheté
// la carte à X". These trigger Caso 10.2 (cross-location warning) when the
// customer already has a card from another location and asks if it works here.
// Pattern: (possession verb) + (optional article) + (card word) — covers all
// 6 languages (Iron rule #8).
export const TARJETA_TOPIC = /(tar[gj]eta\s+(?:de\s+)?(?:fidelizaci[oó]n|fidelitzaci[oó]|fidelidad|descuento)|tessera\s+(?:di\s+)?(?:fidelizzazione|fedelt[aà]|fidelizaci[oó]ne)|loyalty\s+card|carta\s+fedelt[aà]|carta\s+de\s+fidelidade|carte\s+de\s+fid[ée]lit[ée]|c[oó]mo\s+(?:consigo|comprar|recargar|saco|adquiero|tengo)\s+(?:la\s+|una\s+)?tarjeta|com\s+(?:aconsegueixo|comprar|adquirir|tinc)\s+(?:la\s+|una\s+)?tar[gj]eta|how\s+(?:do\s+i\s+)?(?:get|buy|obtain)\s+(?:the\s+|a\s+)?loyalty\s+card|(?:quiero|necesito|me\s+gustar[ií]a|quisiera|vull|voldria|necessito|i\s+want|i\s+need|i'd\s+like)\s+(?:comprar\s+|tener\s+|conseguir\s+|sacar\s+|adquirir\s+|to\s+(?:buy|get|obtain)\s+)?(?:una?\s+|la\s+|el\s+|mi\s+|otra\s+|the\s+|a\s+)?(?:nueva\s+|nuevita\s+|new\s+)?(?:tar[gj]eta|loyalty\s+card)|(?:tengo|tiene|tienen|tinc|té|j'ai|ho(?:\s+(?:comprato|preso))?|comprei|compré|i\s+(?:have|bought|got))\s+(?:una?\s+|la\s+|mi\s+|the\s+|ma\s+|une?\s+|o\s+)?(?:tar[gj]eta|tessera|targeta|loyalty\s+card|carte?\s+(?:de\s+fid[ée]lit[ée]|fedelt[aà]|fidelidade)?|cart[aã]o))/i

/**
 * Caso 36 — Detect the "buy location" (i.e. a laundry different from the
 * customer's current one) referenced in a free-text message.
 *
 * Uses `resolveAllKnownLocations` to find EVERY laundry name in the message,
 * then returns the first canonical name that differs from `currentLocation`.
 * This handles the common case where the customer writes both locations in
 * the same message: "Estoy en Goya. Compré la tarjeta en Pineda" — both
 * are found, Goya is skipped (matches currentLocation), Pineda is returned.
 *
 * When `currentLocation` is null/empty (location not yet known), the
 * function falls back to returning the first match — the guard layer then
 * decides whether a cross-location case applies.
 *
 * Iron rule #8 (multi-language): resolveAllKnownLocations covers all aliases
 * across 6 languages — no separate regex per language needed here.
 * Iron rule #6 (no phrase detection): we detect a LOCATION NAME (proper
 * noun in locations.json), not a phrase like "compré en X". The preposition
 * is irrelevant; the location name is the signal.
 *
 * Returns the canonical location slug (e.g. "Pineda") or null.
 *
 * Exported so the unit test can exercise it in isolation (Iron rule #5).
 */
export function detectBuyLocationInMessage(
  message: string,
  currentLocation?: string,
): string | null {
  const all = resolveAllKnownLocations(message)
  if (all.length === 0) return null
  if (!currentLocation) return all[0]
  // Return the first location that differs from where the customer currently is.
  const foreign = all.find((loc) => loc !== currentLocation)
  return foreign ?? null
}

export const guardLoyaltyCardBuy: Guard = (ar, userMessage) => {
  if (
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const isTarjetaQuery = TARJETA_TOPIC.test(userMessage)
  const askedTarjeta = ar.state.faqTopic === 'buy-loyalty-card'
  if (!isTarjetaQuery && !askedTarjeta) return null

  // Caso 36 — Cross-location loyalty card warning.
  //
  // If the customer is at a known location (state.location is set) AND the
  // message mentions a DIFFERENT known location as a buy-site, emit a
  // deterministic warning instead of the generic base reply. The customer
  // with a card from Pineda asking if it works in Mataró must be told
  // clearly: it doesn't. No LLM improvisation — boundary signal.
  //
  // Detection: resolveKnownLocation finds any known laundry name in the
  // message. If that name ≠ state.location, we have a cross-location case.
  // If it equals state.location, no cross-location (customer is just
  // confirming where they are — normal Caso 10 flow continues).
  // F100 — when the guard fires via askedTarjeta (faqTopic preserved by
  // guardMataroStreet across the Mataró street-disambiguation turn), the
  // userMessage at T2 is the customer's sub-location answer ("Goya"), NOT a
  // cross-location buy-site. Skip the cross-location check when the bot was
  // waiting for the Mataró street clarification (locationStreetRequested=true
  // and locationStreet is now known) — otherwise "Goya" would be misread as a
  // foreign buy-site and emit the wrong-location warning.
  const isMataroStreetReply = ar.state.locationStreetRequested && !!ar.state.locationStreet
  if (ar.state.location && (isTarjetaQuery || askedTarjeta) && !isMataroStreetReply) {
    const mentionedLocation = detectBuyLocationInMessage(userMessage, ar.state.location)
    if (mentionedLocation && mentionedLocation !== ar.state.location) {
      ar.state.faqTopic = ''
      ar.state.lastResolvedIntent = 'faq'
      const currentLocation = ar.state.location
      const raw = t('loyaltyCardWrongLocation', lang(ar)) ?? ''
      const reply = raw
        .replace('{buyLocation}', mentionedLocation)
        .replace('{currentLocation}', currentLocation)
      return { reply, reason: 'loyalty-card-wrong-location' }
    }
  }

  // Location-aware response:
  //   - If `state.location` is known → emit the per-location override (kept
  //     verbatim from locations.json in ES, the LLM rephrase polish handles
  //     language adaptation per session lang).
  //   - Otherwise → emit the canonical i18n base reply in the session
  //     language. The base reply ends with the location ask ("¿En qué
  //     lavandería estás?" / "A quina bugaderia ets?" / "Which laundry are
  //     you at?"), and we arm `pendingFlow='loyalty-card-await-location'`
  //     so the T2 location reply is captured by
  //     guardLoyaltyCardAwaitLocation (NOT by the trouble-machine
  //     pipeline that would otherwise ask "what's the machine number?").
  //
  // Priority (Andrea regression 2026-05-23): i18n key wins over
  // getFaqs()['loyaltyCard'] when location is unknown — the faqs.json entry
  // mixed canonical answer with Goya-specific instructions and was always
  // emitted in ES, producing spanglish in EN/CA sessions. The i18n key is
  // the per-language source of truth (Iron rule #8: multi-language by
  // design). getFaqs() stays as a last-resort fallback.
  ar.state.faqTopic = ''
  ar.state.lastResolvedIntent = 'faq'

  if (ar.state.location) {
    // F-Caso10 / F100: getLoyaltyOverride resolves multi-lang overrides to the
    // session language, with Mataró fallback to locationStreet (Goya/Alemanya).
    const override = getLoyaltyOverride(ar, lang(ar))
    if (override) {
      return { reply: override, reason: 'loyalty-card-buy' }
    }
  }

  const baseReply = t('loyaltyCardBuyBase', lang(ar)) || getFaqs()['loyaltyCard']
  ar.state.pendingFlow = 'loyalty-card-await-location'
  return { reply: baseReply, reason: 'loyalty-card-buy' }
}

/**
 * T2 of Caso 10 — customer answers the "which laundry" question. If they
 * mention a known location, emit the per-location override; otherwise close
 * with the canonical "elsewhere" reply (no override applies).
 *
 * Architectural note: this guard exists because without it the T2 "Estoy en
 * Goya" answer would be picked up by the trouble-machine gather pipeline
 * (guardForceMachineType / guardForceMachineNumber) as the start of a new
 * incident — they read `state.location` set by autoExtractFacts and ask
 * "¿es lavadora o secadora?". The pendingFlow gate keeps the conversation
 * inside Caso 10 until the override is delivered (one-turn FAQ continuation).
 */
export const guardLoyaltyCardBuyAwaitLocation: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'loyalty-card-await-location' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  // autoExtractFacts has already populated state.location if the message
  // matched a known laundry. Clear the pendingFlow regardless so the
  // conversation moves on.
  ar.state.pendingFlow = ''
  if (ar.state.location) {
    // F-Caso10 / F100: same helper as the T1 branch — resolves multi-lang
    // override with Mataró locationStreet fallback.
    const override = getLoyaltyOverride(ar, lang(ar))
    if (override) {
      return { reply: override, reason: 'loyalty-card-buy-with-location' }
    }
  }
  // Customer mentioned an unknown location or just acknowledged — return
  // null so the LLM can field the follow-up naturally with the FAQ context
  // (lastResolvedIntent='faq' from the previous turn keeps the closure
  // guard wired for "gracias / entès / got it").
  return null
}
