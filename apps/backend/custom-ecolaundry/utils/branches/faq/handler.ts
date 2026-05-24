// FAQ branch handler.
//
// When the router classifies the customer's message as a FAQ topic, this
// handler:
//   1. Reads `routerDetails.faqKey` (the key the router extracted from the
//      message — e.g. "openingHours").
//   2. Fetches the answer from json/faqs.json (with optional per-location
//      override from json/locations.json:faqOverrides).
//   3. Emits the answer in the tenant's output language.
//
// The handler is INTENTIONALLY trivial: all the multilingual recognition
// work happens in the router (LLM-driven). No regex on free text, no
// per-language keyword lists. Adding a new FAQ key = adding 1 entry to
// json/faqs.json, no code change.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getFaqs, getLocationOverride } from '../../runtime.js'
import { getLocalisedFaqOverrideFromBlock } from '../../faq-overrides.js'
import { pickLang, type BranchHandler, type BranchI18n } from '../types.js'
import type { SupportedLanguage } from '../../../models/index.js'
import { TARJETA_TOPIC } from '../../guards/loyalty-card-buy.js'

// Load i18n FAQ translations from json/i18n/*.json
const i18nRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..', 'json', 'i18n')
function loadI18nFaqs(lang: string): Record<string, string> {
  try {
    return JSON.parse(readFileSync(path.join(i18nRoot, `${lang}.json`), 'utf8')) as Record<string, string>
  } catch {
    return {}
  }
}

interface FaqStrings {
  /** Returned when the router could not extract a faqKey OR the key is
   *  not in json/faqs.json. The bot apologises and offers to clarify. */
  unknownKey: string
  // Allow dynamic access to any FAQ key (e.g. openingHours, colorTemperature, etc.)
  [key: string]: string
}

const HERE = path.dirname(fileURLToPath(import.meta.url))
function loadLang(lang: string): FaqStrings {
  return JSON.parse(readFileSync(path.join(HERE, `${lang}.json`), 'utf8')) as FaqStrings
}

const I18N: BranchI18n<FaqStrings> = {
  es: loadLang('es'),
  it: loadLang('it'),
  en: loadLang('en'),
  ca: loadLang('ca'),
  pt: loadLang('pt'),
  fr: loadLang('fr'),
}

export const faqHandler: BranchHandler = async ({ message, ar, routerDetails, language }) => {
  const tenantLang = pickOutputLanguage(ar, language)
  const strings = pickLang(I18N, tenantLang)

  // Regola-A (F101 Fase 1 — Andrea 2026-05-24): any non-empty pendingFlow means
  // a multi-step gather is already in progress — the turn belongs to the legacy
  // guard that owns that flow (faq-prices-await-location, discount-code-await,
  // loyalty-card-await-location, invoice-ask-*, no-change-*, double-charge-*,
  // photo-await-decision, display-reask-pending, …). Delegating here is the
  // single deterministic catch-all that replaces the previous two enumerated
  // blocks (Caso 12 T2+ and F-Caso8). The legacy guard pipeline is the correct
  // owner of every in-progress gather step — the FAQ handler has no business
  // re-interpreting a mid-flow customer reply.
  const pending = ar.state.pendingFlow
  if (pending) {
    return { reply: '', handoff: 'delegate-to-legacy' }
  }

  const faqKey = routerDetails.faqKey

  // Post-FAQ closure (Andrea T4 fix 2026-05-14): after a data-driven FAQ
  // rendered (hours / prices), state.lastResolvedIntent === 'faq'. The
  // branch is still sticky and T2+ skips the router → routerDetails empty.
  // If the customer sends a closure word ("gracias", "grazie", "thanks",
  // "ok"…), the legacy `guardFaqClosure` handles it gracefully — but only
  // when control reaches the legacy pipeline. Delegate so the closure
  // guard can fire instead of returning the unknownKey reply.
  if (!faqKey && ar.state.lastResolvedIntent === 'faq') {
    return { reply: '', handoff: 'delegate-to-legacy' }
  }

  // Caso 12 T1: pricing + openingHours + programs are no longer static FAQ
  // entries. They're handled by guardFaqPrices / guardFaqHours /
  // guardFaqPrograms in the legacy pipeline, which read metadata.hours +
  // metadata.machines + metadata.programs from json/locations.json to
  // produce a location-aware answer. Delegate so the guard pipeline takes
  // over (same thin-handler pattern as loyalty / invoice).
  // F95 (Andrea 2026-05-23): howToUse is now ALSO location-aware (instructions
  // differ between the Hortes/Goya/Pineda group and the Alemanya/L'Escala/
  // Platja d'Aro group — see docs/csv/instruccions-us.csv). guardFaqHowToUse
  // owns the ask-location + per-location render flow, so delegate here too.
  if (
    faqKey === 'pricing' ||
    faqKey === 'openingHours' ||
    faqKey === 'programs' ||
    faqKey === 'howToUse' ||
    // Caso 10/11 (Andrea regression 2026-05-23): loyalty card "buy" and
    // "recharge" intents have legacy guards that emit the per-language
    // i18n base answer (loyaltyCardBuyBase / loyaltyCardRecharge) and arm
    // a pendingFlow so the T2 location reply gets handled. Returning
    // getFaqs()['loyaltyCard'] verbatim here would be wrong: it's ES-only
    // and mixes the canonical answer with Goya-specific instructions,
    // producing spanglish in EN/CA sessions and a trouble-machine drift
    // when the customer says "estoy en Goya" on T2.
    faqKey === 'loyaltyCard'
  ) {
    return { reply: '', handoff: 'delegate-to-legacy' }
  }

  // F96 — loyalty card intent mid-FAQ-branch: when activeBranch='faq' is
  // sticky but the customer's T2+ message is a loyalty card query (not
  // re-classified by the router because T2+ skips LLM routing), routerDetails
  // is empty → faqKey is undefined. Without this gate the handler returns
  // unknownKey ("no estoy seguro de haber entendido") and the legacy guard
  // guardLoyaltyCardBuy never gets a chance to run. Delegate so the guard
  // can fire deterministically. Pattern symmetric to F93 (guardFaqHowToUse
  // safety gate) and F-Caso8 (non-faq pendingFlow delegation above).
  if (!faqKey && TARJETA_TOPIC.test(message)) {
    return { reply: '', handoff: 'delegate-to-legacy' }
  }

  // F100 — Mataró loyalty-card T2 delegation: when the customer's T1 message
  // was a loyalty card query at Mataró (guardMataroStreet fired and set
  // state.faqTopic='buy-loyalty-card'), the T2 reply is the street sub-location
  // ("Goya" / "Alemanya") — NOT a loyalty card phrase, so TARJETA_TOPIC.test()
  // above returns false. Without this gate the handler falls through to the
  // unknownKey reply ("no estoy seguro") and emits handoff='topic-switch' →
  // activeBranch=null → guard pipeline never reached → guardLoyaltyCardBuy's
  // askedTarjeta branch (which reads state.faqTopic) never fires.
  // Fix: check state.faqTopic directly (the signal F100 armed on T1). This
  // is the state-based complement to the message-based F96 gate — together
  // they cover all T2+ turns where the loyalty context was preserved across
  // a multi-step gather sequence (Mataró street disambiguation).
  if (!faqKey && ar.state.faqTopic === 'buy-loyalty-card') {
    return { reply: '', handoff: 'delegate-to-legacy' }
  }

  if (!faqKey) {
    // Router couldn't extract a key — fall back to the unknown-key reply.
    // Topic-switch so the next turn can be re-routed (the customer will
    // probably rephrase or ask something different).
    return { reply: strings.unknownKey, handoff: 'topic-switch' }
  }

  const override = getLocationOverride(ar.runtime, ar.state.location)
  // F-Caso10 (Andrea 2026-05-23): faqOverrides values are either legacy ES
  // strings or multi-lang objects {es,ca,en,...}. The helper resolves the
  // session-language answer with ES fallback. Replaces the direct
  // `.faqOverrides[faqKey]` read that returned an object verbatim for
  // migrated entries (Goya.buy-loyalty-card) and crashed downstream.
  const overrideAnswer = getLocalisedFaqOverrideFromBlock(override, faqKey, tenantLang)
  // Try to fetch the FAQ in the customer's language from i18n (CA/EN/IT/PT/FR).
  // Fallback to ES if not found (faqs.json is ES-first).
  const i18nFaqs = tenantLang !== 'es' ? loadI18nFaqs(tenantLang) : {}
  const baseAnswer = i18nFaqs[faqKey] || getFaqs()[faqKey]
  const answer = overrideAnswer || baseAnswer

  if (!answer) {
    // FAQ key not in catalogue — same fallback as missing key.
    return { reply: strings.unknownKey, handoff: 'topic-switch' }
  }

  // Mark intent so that any acknowledgement on the next turn can be closed
  // by guardFaqClosure (legacy pipeline) or by the future faq-closure
  // sub-state.
  ar.state.lastResolvedIntent = 'faq'

  return {
    reply: answer,
    // FAQ resolved → release control so the next turn can be a new topic.
    handoff: 'topic-switch',
  }
}

function pickOutputLanguage(
  ar: { runtime: { settings?: { enabledLanguages?: SupportedLanguage[]; defaultLanguage?: SupportedLanguage } } },
  inputLang: SupportedLanguage,
): SupportedLanguage {
  const enabled = ar.runtime.settings?.enabledLanguages ?? []
  const fallback = ar.runtime.settings?.defaultLanguage ?? 'es'
  return enabled.includes(inputLang) ? inputLang : fallback
}
