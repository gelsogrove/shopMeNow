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
import { pickLang, type BranchHandler, type BranchI18n } from '../types.js'
import type { SupportedLanguage } from '../../../models/index.js'

interface FaqStrings {
  /** Returned when the router could not extract a faqKey OR the key is
   *  not in json/faqs.json. The bot apologises and offers to clarify. */
  unknownKey: string
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

export const faqHandler: BranchHandler = async ({ ar, routerDetails, language }) => {
  const tenantLang = pickOutputLanguage(ar, language)
  const strings = pickLang(I18N, tenantLang)

  const faqKey = routerDetails.faqKey
  if (!faqKey) {
    // Router couldn't extract a key — fall back to the unknown-key reply.
    // Topic-switch so the next turn can be re-routed (the customer will
    // probably rephrase or ask something different).
    return { reply: strings.unknownKey, handoff: 'topic-switch' }
  }

  const override = getLocationOverride(ar.runtime, ar.state.location)
  const overrideAnswer = override?.faqOverrides?.[faqKey]
  const baseAnswer = getFaqs()[faqKey]
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
