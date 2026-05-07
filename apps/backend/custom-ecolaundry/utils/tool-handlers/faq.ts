// FAQ tool handler — apply_faq_override returns the per-location override
// when one exists for the requested key, plus the base FAQ as a fallback.

import { getFaqs, getLocationOverride } from '../runtime.js'
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
  const override = getLocationOverride(ar.runtime, ar.state.location)
  const overrideAnswer = override?.faqOverrides?.[key]
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
