// Declarative i18n catalogue.
//
// Each translation key lives in `json/i18n/<lang>.json` as a flat
// `{ key: "string" }` map. At boot, `validateI18nCatalogue` merges the
// six language files into a single typed catalogue and verifies:
//   - every key declared in the BASE language (Spanish) is present in all
//     the other locales — no silent fallback to ES at runtime
//   - every value is a string (no nested objects, no arrays)
//
// Anti-hardcode rule: customer-facing canned strings live in JSON, never as
// TypeScript constants. `utils/localization.ts` only exposes `t()`/`tt()`
// helpers that look up the catalogue. Adding a new key = adding it to all
// six JSON files + reference it via t('newKey', lang).

import type { SupportedLanguage } from './runtime.js'

export type I18nMap = Record<string, string>

export type I18nCatalogue = Partial<Record<SupportedLanguage, I18nMap>>

const ALL_LANGS: SupportedLanguage[] = ['es', 'it', 'ca', 'en', 'pt', 'fr']
const BASE_LANG: SupportedLanguage = 'es'

/**
 * Validate the per-language i18n maps as a single catalogue. Throws on the
 * first violation so the process fails fast at boot.
 *
 * Contract: every key in the BASE_LANG ("es") map must exist in every other
 * language map. We use ES as the source of truth because the tenant
 * (cliente-0) operates in Spanish; new keys are written in ES first and the
 * other languages must mirror the schema. We do NOT auto-fall-back missing
 * keys at runtime — that would mask a missing translation in production.
 */
export function validateI18nCatalogue(
  raw: Partial<Record<SupportedLanguage, unknown>>,
): I18nCatalogue {
  const catalogue: I18nCatalogue = {}
  for (const lang of ALL_LANGS) {
    const map = raw[lang]
    if (map === undefined) continue
    if (!map || typeof map !== 'object' || Array.isArray(map)) {
      throw new Error(`i18n/${lang}.json: root must be an object`)
    }
    const out: I18nMap = {}
    for (const [key, value] of Object.entries(map as Record<string, unknown>)) {
      if (key.startsWith('_')) continue // metadata fields like _comment
      if (typeof value !== 'string') {
        throw new Error(`i18n/${lang}.json: "${key}" must be a string, got ${typeof value}`)
      }
      out[key] = value
    }
    catalogue[lang] = out
  }

  const baseMap = catalogue[BASE_LANG]
  if (!baseMap) {
    throw new Error(`i18n/${BASE_LANG}.json: base catalogue is required`)
  }
  const baseKeys = Object.keys(baseMap)
  for (const lang of ALL_LANGS) {
    if (lang === BASE_LANG) continue
    const map = catalogue[lang]
    if (!map) continue // language not provided is acceptable; t() falls back to ES
    for (const key of baseKeys) {
      if (!(key in map)) {
        throw new Error(
          `i18n/${lang}.json: missing key "${key}" (declared in i18n/${BASE_LANG}.json)`,
        )
      }
    }
  }
  return catalogue
}
