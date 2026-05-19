// Feedback branch handler.
//
// When the router classifies the customer's first message as feedback
// (positive or negative opinion about the service, without a specific
// incident demand), this handler emits a closing reply and marks the
// branch as resolved. No gather, no escalation, no operator involvement.
//
// Positive  → thank the customer and close.
// Negative  → acknowledge and close ("ne prenderemo atto il prima possibile").

import type { SupportedLanguage } from '../../../models/index.js'
import { markResolved } from '../../state-transitions.js'
import { type BranchHandler } from '../types.js'
import { t } from '../../localization.js'
import type { TranslationKey } from '../../localization.js'

function pickOutputLanguage(
  ar: { runtime: { settings?: { enabledLanguages?: SupportedLanguage[]; defaultLanguage?: SupportedLanguage } } },
  inputLang: SupportedLanguage,
): SupportedLanguage {
  const enabled = ar.runtime.settings?.enabledLanguages ?? []
  const fallback = ar.runtime.settings?.defaultLanguage ?? 'es'
  return enabled.includes(inputLang) ? inputLang : fallback
}

export const feedbackHandler: BranchHandler = async ({ ar, routerDetails, language }) => {
  const tenantLang = pickOutputLanguage(ar, language)
  const sentiment = routerDetails.sentiment === 'negative' ? 'negative' : 'positive'
  const i18nKey: TranslationKey = sentiment === 'positive' ? 'feedbackPositive' : 'feedbackNegative'
  const reply = t(i18nKey, tenantLang)
  markResolved(ar)
  return { reply, handoff: 'resolved' }
}
