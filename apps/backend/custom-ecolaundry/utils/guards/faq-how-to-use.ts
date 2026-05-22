// Caso 35 — FAQ how to use the laundromat.
//
// Fires when the customer asks how to use the machines / laundromat.
//
// F95 (Andrea 2026-05-23): per-location instructions.
//   CSV `docs/csv/instruccions-us.csv` lists two distinct procedures
//   (Hortes/Goya/Pineda need an explicit "confirm start" tap; Alemanya/
//   L'Escala/Platja d'Aro start automatically). Each location now ships a
//   `faqOverrides.howToUse` in `json/locations.json`. The guard:
//     T1 — if location unknown, asks for it (i18n: howToUseAsk) and arms
//          pendingFlow='faq-how-to-use-await-location'.
//     T2 — when location is captured, renders the per-location override,
//          falling back to faqs.json['howToUse'] only if the location has
//          no override (defensive — every active location should have one).
//
//   This supersedes F69 (Olga's 2026-05-21 ask for a single global answer):
//   once the CSV materialised the per-location differences, ignoring them
//   would have given customers wrong instructions for half the locations.
//
// Iron rule #6 (tracked exemption): detectHowToUseIntent is a regex-based
// topic classifier, same pattern as detectDetergentFaqIntent.
// Iron rule #10: guardFaqHowToUseAwaitLocation is the catch-all that
// completes the location ask — no pipeline hole if the customer answers
// out of canonical order.

import { getFaqs, getLocationOverride } from '../runtime.js'
import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { detectHowToUseIntent, detectDiscountCodeIntent } from '../intent.js'

function renderHowToUse(ar: Parameters<Guard>[0]): ReturnType<Guard> {
  const loc = ar.state.location
  const override = loc ? getLocationOverride(ar.runtime, loc) : null
  const perLocation = override?.faqOverrides?.howToUse
  const answer = perLocation || getFaqs()['howToUse']
  if (!answer) return null
  ar.state.lastResolvedIntent = 'faq'
  ar.state.lastFaqKey = 'howToUse'
  return { reply: answer, reason: 'faq-how-to-use' }
}

export const guardFaqHowToUse: Guard = (ar, userMessage) => {
  if (ar.state.operatorRequested || ar.state.customerNameRequested) return null
  if (!detectHowToUseIntent(userMessage)) return null
  // Yield to discount-code flow: "tengo un código y no sé cómo usarlo"
  // matches howToUse ("cómo usarlo") but is really a discount-code trigger.
  if (detectDiscountCodeIntent(userMessage)) return null

  if (!ar.state.location) {
    ar.state.pendingFlow = 'faq-how-to-use-await-location'
    return { reply: t('howToUseAsk', lang(ar)), reason: 'faq-how-to-use-ask-location' }
  }

  return renderHowToUse(ar)
}

export const guardFaqHowToUseAwaitLocation: Guard = (ar) => {
  if (ar.state.pendingFlow !== 'faq-how-to-use-await-location') return null
  if (!ar.state.location) return null
  ar.state.pendingFlow = ''
  return renderHowToUse(ar)
}
