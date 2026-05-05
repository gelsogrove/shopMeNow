// NLU (Natural Language Understanding) runtime API.
//
// Centralised consumer of `json/nlu-patterns.json`. Files that previously
// declared `const FOO = /.../` regex literals must import these helpers
// instead. Anti-hardcode rule: regex for "detect customer intent X" lives
// in nlu-patterns.json, the TS code only consumes them through here.
//
// The runtime keeps a compiled-RegExp cache keyed by `${id}:${lang||*}`
// so each pattern compiles at most once even though guards may call
// matchPattern() thousands of times per turn.

import type {
  NluPatternDefinition,
  Runtime,
  SupportedLanguage,
} from '../models/index.js'

const compiledCache = new Map<string, RegExp>()

function patternIndex(runtime: Runtime): Map<string, NluPatternDefinition> {
  // Recomputing the index per call is fine — `runtime.nluPatterns.patterns`
  // is small (~15 entries) and stable for the lifetime of the process.
  const map = new Map<string, NluPatternDefinition>()
  for (const p of runtime.nluPatterns.patterns) map.set(p.id, p)
  return map
}

function compileFor(
  pattern: NluPatternDefinition,
  lang?: SupportedLanguage,
): RegExp | null {
  const key = `${pattern.id}:${lang ?? '*'}`
  const cached = compiledCache.get(key)
  if (cached) return cached

  let source: string | undefined
  if (pattern.regex !== undefined) {
    source = pattern.regex
  } else if (pattern.byLanguage) {
    source = lang
      ? pattern.byLanguage[lang] ?? pattern.byLanguage.es
      : pattern.byLanguage.es ?? Object.values(pattern.byLanguage)[0]
  }
  if (!source) return null

  const compiled = new RegExp(source, pattern.flags ?? 'i')
  compiledCache.set(key, compiled)
  return compiled
}

/** Get the compiled regex for an NLU pattern. Throws if the id is unknown
 *  — callers must reference patterns that exist in nlu-patterns.json so a
 *  typo at the call site fails fast at first invocation. */
export function getPattern(
  runtime: Runtime,
  id: string,
  lang?: SupportedLanguage,
): RegExp {
  const pattern = patternIndex(runtime).get(id)
  if (!pattern) {
    throw new Error(`nlu-patterns.json: unknown pattern id "${id}"`)
  }
  const compiled = compileFor(pattern, lang)
  if (!compiled) {
    throw new Error(`nlu-patterns.json: pattern "${id}" has no usable source`)
  }
  return compiled
}

/** Convenience wrapper: returns true if `text` matches the named pattern. */
export function matchPattern(
  runtime: Runtime,
  id: string,
  text: string,
  lang?: SupportedLanguage,
): boolean {
  return getPattern(runtime, id, lang).test(text)
}

/** Returns the entry object so callers needing metadata (e.g. incidentTag)
 *  can read it without re-grepping the JSON. */
export function getPatternDefinition(
  runtime: Runtime,
  id: string,
): NluPatternDefinition {
  const pattern = patternIndex(runtime).get(id)
  if (!pattern) {
    throw new Error(`nlu-patterns.json: unknown pattern id "${id}"`)
  }
  return pattern
}

/** Test-only: drops the compiled-regex cache. Used by unit tests that
 *  swap in a synthetic Runtime. Production code never needs this. */
export function _resetNluCacheForTests(): void {
  compiledCache.clear()
}
