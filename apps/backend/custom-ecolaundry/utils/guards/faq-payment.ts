// F102 (Andrea 2026-05-24) — FAQ pagamento a metà di un'altra FAQ.
// Supporta topic-switch fluido: customer chiede prezzi T1, poi "come pago?" T2.
// Il router non gira su T2+, quindi questo guard riconosce "come pago?"
// e lo serve via il FAQ handler, senza tornare unknownKey.

import { t, type TranslationKey } from '../localization.js'
import type { Guard } from '../../models/index.js'
import type { SupportedLanguage } from '../../models/index.js'
import { lang } from './helpers.js'
import { detectPaymentMethodQuestion } from '../intent.js'
import { getFaqs, getLocationOverride } from '../runtime.js'
import { getLocalisedFaqOverrideFromBlock } from '../faq-overrides.js'
import { pickLang, type BranchI18n } from '../branches/types.js'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const i18nRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'json', 'i18n')
function loadI18nFaqs(lang: string): Record<string, string> {
  try {
    return JSON.parse(readFileSync(path.join(i18nRoot, `${lang}.json`), 'utf8')) as Record<string, string>
  } catch {
    return {}
  }
}

interface FaqStrings {
  unknownKey: string
  [key: string]: string
}

const HERE = path.dirname(fileURLToPath(import.meta.url))
function loadLang(lang: string): FaqStrings {
  return JSON.parse(readFileSync(path.join(HERE, '..', 'branches', 'faq', `${lang}.json`), 'utf8')) as FaqStrings
}

const I18N: BranchI18n<FaqStrings> = {
  es: loadLang('es'),
  it: loadLang('it'),
  en: loadLang('en'),
  ca: loadLang('ca'),
  pt: loadLang('pt'),
  fr: loadLang('fr'),
}

function pickOutputLanguage(
  ar: { runtime: { settings?: { enabledLanguages?: SupportedLanguage[]; defaultLanguage?: SupportedLanguage } } },
  inputLang: SupportedLanguage,
): SupportedLanguage {
  const enabled = ar.runtime.settings?.enabledLanguages ?? []
  const fallback = ar.runtime.settings?.defaultLanguage ?? 'es'
  return enabled.includes(inputLang) ? inputLang : fallback
}

export const guardFaqPayment: Guard = (ar, userMessage) => {
  if (ar.state.operatorRequested || ar.state.customerNameRequested) return null
  // Only fire if we're in FAQ context (activeBranch='faq' sticky) AND the
  // message looks like a payment method question.
  if (ar.state.activeBranch !== 'faq') return null
  if (!detectPaymentMethodQuestion(userMessage)) return null

  const tenantLang = pickOutputLanguage(ar, ar.state.language || 'es')
  const strings = pickLang(I18N, tenantLang)

  const override = getLocationOverride(ar.runtime, ar.state.location)
  const overrideAnswer = getLocalisedFaqOverrideFromBlock(override, 'paymentMethods', tenantLang)

  const i18nFaqs = tenantLang !== 'es' ? loadI18nFaqs(tenantLang) : {}
  const baseAnswer = i18nFaqs['paymentMethods'] || getFaqs()['paymentMethods']
  const answer = overrideAnswer || baseAnswer

  if (!answer) {
    return { reply: strings.unknownKey, reason: 'faq-payment-unknown' }
  }

  ar.state.lastResolvedIntent = 'faq'
  ar.state.lastFaqKey = 'paymentMethods'

  return { reply: answer, reason: 'faq-payment' }
}
