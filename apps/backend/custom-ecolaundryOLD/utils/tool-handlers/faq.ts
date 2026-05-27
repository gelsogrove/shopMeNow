// FAQ tool handler — apply_faq_override returns the per-location override
// when one exists for the requested key, plus the base FAQ as a fallback.

import { getFaqs } from '../runtime.js'
import { getLocalisedFaqOverride } from '../faq-overrides.js'
import { lang } from '../guards/helpers.js'
import { asTrimmedString, rejectInvalidArg } from './arg-coercion.js'
import type { ToolHandler } from './types.js'

export const applyFaqOverride: ToolHandler = async (ar, args) => {
  const key = asTrimmedString(args.faqKey)
  if (!key) {
    return rejectInvalidArg(
      'apply_faq_override',
      'faqKey',
      args.faqKey,
      'a non-empty string',
    )
  }
  // F-Caso10 (Andrea 2026-05-23): faqOverrides values can be either a legacy
  // ES string or a multi-lang object {es,ca,en,...}. The helper picks the
  // session-language answer with ES fallback. Direct `.faqOverrides[key]`
  // read here used to return an object verbatim for migrated entries (e.g.
  // Goya.buy-loyalty-card), which crashed the LLM tool consumer with
  // `[object Object]`.
  const overrideAnswer = getLocalisedFaqOverride(ar, key, lang(ar))
  // Base FAQs live in a module-level singleton populated by
  // runtime.ts:loadRuntime() → setFaqs(). They are NOT on the Runtime
  // object itself.
  const baseAnswer = getFaqs()[key] || ''
  return {
    ok: true,
    data: {
      faqKey: key,
      locationKey: ar.state.location || null,
      override: overrideAnswer || null,
      base: baseAnswer || null,
      // The agent should prefer the override when present.
      textToUse: overrideAnswer || baseAnswer || null,
    },
  }
}
