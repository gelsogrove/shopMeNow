// Per-location FAQ overrides reader (multi-language aware).
//
// Iron rule #7: settings/data is law — locations.json:faqOverrides is the
// single source of truth for location-specific FAQ answers.
// Iron rule #8: multi-language by design — entries may be either:
//   - a string (legacy: ES-only — backward compat as migration progresses)
//   - an object { es?, ca?, en?, it?, pt?, fr? } with the answer per language
//
// When the entry is an object, this reader picks the answer for the session
// language; if missing, it falls back to ES (default tenant lang), then to
// any present language in the SUPPORTED list, then to null.
//
// Iron rule #3: ONE responsibility — extract a localised override answer
// from the locations.json shape. Adding a new override key or a new
// language touches the data file, not this reader.

import type { AgentRuntime, SupportedLanguage } from '../models/index.js'

export type FaqOverrideValue = string | Partial<Record<SupportedLanguage, string>>

const SUPPORTED: SupportedLanguage[] = ['es', 'ca', 'en', 'it', 'pt', 'fr']

/** Pick the answer in `lang` from a possibly-multilingual override entry.
 *  Backward-compat: legacy `string` is returned verbatim. */
function resolveOverrideValue(
  value: FaqOverrideValue,
  lang: SupportedLanguage,
): string | null {
  if (typeof value === 'string') {
    return value.trim() ? value : null
  }
  if (value[lang] && value[lang]!.trim()) return value[lang]!
  if (value.es && value.es.trim()) return value.es
  for (const fallback of SUPPORTED) {
    if (value[fallback] && value[fallback]!.trim()) return value[fallback]!
  }
  return null
}

/**
 * Read the localised FAQ override for `key` at `state.location` for the
 * session language `lang`. Returns null when no location is set on state,
 * the location has no faqOverrides block, or the override for `key` is
 * missing/empty.
 *
 * Resolution order: session lang → ES (tenant default) → any other present
 * language → null.
 */
export function getLocalisedFaqOverride(
  ar: AgentRuntime,
  key: string,
  lang: SupportedLanguage,
): string | null {
  const location = ar.state.location
  if (!location) return null
  const loc = ar.runtime.locations?.locations?.[location] as
    | { faqOverrides?: Record<string, FaqOverrideValue> }
    | undefined
  const value = loc?.faqOverrides?.[key]
  if (!value) return null
  return resolveOverrideValue(value, lang)
}

/**
 * Same as getLocalisedFaqOverride but reads from an already-resolved
 * `locationOverride` object (e.g. from getLocationOverride(runtime, loc)).
 * Useful when the caller has the override block already in scope.
 */
export function getLocalisedFaqOverrideFromBlock(
  override: { faqOverrides?: Record<string, FaqOverrideValue> } | null | undefined,
  key: string,
  lang: SupportedLanguage,
): string | null {
  const value = override?.faqOverrides?.[key]
  if (!value) return null
  return resolveOverrideValue(value, lang)
}
