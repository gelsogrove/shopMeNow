// Localised strings for system-generated questions and deterministic replies.
//
// PRINCIPLE: every string the bot can possibly send to the customer is keyed
// in `json/i18n/<lang>.json`, one file per supported language. The TS code
// only exposes `t(key, lang)` / `tt(key, lang, vars)` lookup helpers.
//
// Anti-hardcode rule: customer-facing canned strings live in JSON, never as
// TypeScript constants. Adding a key = adding it to ALL six i18n files
// (validated at boot — missing keys are a fail-fast error, never a silent
// fallback).
//
// At boot, `utils/runtime.ts → loadRuntime()` calls `setI18nCatalogue(...)`
// to install the parsed catalogue. Until that happens, `t()` falls back to
// the key name itself (so unit tests that bypass loadRuntime still see
// deterministic identifiers, never `undefined`).

import type { I18nCatalogue, I18nMap, SupportedLanguage } from '../models/index.js'

type Lang = SupportedLanguage

const BASE_LANG: Lang = 'es'

let CATALOGUE: I18nCatalogue = {}
let BASE_KEYS: ReadonlyArray<string> = []

/**
 * Install the i18n catalogue. Called once at boot from `loadRuntime()`.
 * Subsequent calls overwrite the previous catalogue (useful for tests that
 * load a synthetic catalogue without booting the full runtime).
 */
export function setI18nCatalogue(catalogue: I18nCatalogue): void {
  CATALOGUE = catalogue
  const baseMap = catalogue[BASE_LANG]
  BASE_KEYS = baseMap ? Object.keys(baseMap) : []
}

/** Returns the active catalogue (test-only convenience). */
export function getI18nCatalogue(): I18nCatalogue {
  return CATALOGUE
}

/**
 * The set of translation keys the codebase can refer to. We can't make this
 * a literal union at compile time (the keys live in JSON), so we expose it
 * as a string alias. Validation at boot guarantees every BASE_LANG key is
 * present in every language map.
 */
export type TranslationKey = string

/** Pick the localised string for the customer's current language. Falls
 *  back to Spanish when the requested language is missing. Returns the key
 *  name itself when the catalogue has not been loaded yet (e.g. in unit
 *  tests that exercise pure regex extraction without booting runtime), so
 *  callers always receive a string, never `undefined`. */
export function t(key: TranslationKey, lang: Lang | undefined): string {
  const baseMap: I18nMap | undefined = CATALOGUE[BASE_LANG]
  const effective: Lang = (lang && CATALOGUE[lang]) ? lang : BASE_LANG
  const map = CATALOGUE[effective] || baseMap
  if (!map) return key
  const value = map[key]
  if (value !== undefined) return value
  // Per-language map exists but lacks this specific key — fall back to base.
  if (baseMap && baseMap[key] !== undefined) return baseMap[key]
  return key
}

/** Same as `t()` but interpolates `{placeholder}` occurrences. */
export function tt(
  key: TranslationKey,
  lang: Lang | undefined,
  vars: Record<string, string | number> = {},
): string {
  const text = t(key, lang)
  return Object.entries(vars).reduce(
    (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
    text,
  )
}

/** Test helper: list all keys declared in the base catalogue. Used by the
 *  unit tests to assert no consumer references a stale/typo key. */
export function listBaseKeys(): ReadonlyArray<string> {
  return BASE_KEYS
}
