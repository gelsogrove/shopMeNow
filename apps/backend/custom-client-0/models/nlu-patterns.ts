// Declarative NLU (Natural Language Understanding) patterns.
//
// Each entry is a named regex used by the deterministic extractors / guards
// to detect customer intent before the LLM is called. Centralising them in
// a JSON file means:
//   - product owners can review / tweak phrasing without TypeScript changes
//   - new languages can be added by extending an entry, not by editing code
//   - regex compilation is validated at boot (fail-fast on malformed input)
//   - tests can iterate the file to assert each pattern behaves as documented
//
// Anti-hardcode rule: any "detect customer intent X by regex" MUST live here,
// never as a `const RegExp` literal in TS. The TS code only consumes the
// patterns through utils/nlu.ts.
//
// Schema/validation contract is enforced by `validateNluPatternsFile` at
// boot in `utils/runtime.ts`.

export type NluPatternKind =
  | 'display-token'
  | 'topic-switch'
  | 'switch-hint'
  | 'anti-pattern'
  | 'confirmation'
  | 'sanitize'

export interface NluPatternDefinition {
  /** Stable id, used as the lookup key. Must match `^[a-zA-Z][a-zA-Z0-9_-]*$`. */
  id: string
  /** Coarse classification — drives how callers interpret the result. */
  kind: NluPatternKind
  /** Free-form description shown only to humans reading the JSON. */
  description?: string
  /**
   * The regex source. Mixed-language patterns (the current state of the
   * codebase) live as a single string. When a pattern needs language scoping,
   * use `byLanguage` instead. Exactly one of `regex` or `byLanguage` must be
   * set.
   */
  regex?: string
  /** Per-language regex sources. Keys are SupportedLanguage values. */
  byLanguage?: Record<string, string>
  /** Regex flags (`i`, `g`, `m`, `s`, `u`, `y`). Defaults to `i`. */
  flags?: string
  /** Optional incident tag to set in `state.nonTroubleshootingIncident`. */
  incidentTag?: string
}

export interface NluPatternsFile {
  _principle?: string
  _schemaVersion: 1
  patterns: NluPatternDefinition[]
}

const ID_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/
const VALID_KINDS: ReadonlySet<NluPatternKind> = new Set([
  'display-token',
  'topic-switch',
  'switch-hint',
  'anti-pattern',
  'confirmation',
  'sanitize',
])
const VALID_FLAGS = /^[gimsuy]*$/

/**
 * Validate a parsed nlu-patterns file. Throws on the first violation so the
 * process fails fast at boot rather than misbehaving at runtime.
 */
export function validateNluPatternsFile(raw: unknown): NluPatternsFile {
  if (!raw || typeof raw !== 'object') {
    throw new Error('nlu-patterns.json: root must be an object')
  }
  const root = raw as Record<string, unknown>
  if (root._schemaVersion !== 1) {
    throw new Error(`nlu-patterns.json: _schemaVersion must be 1, got ${String(root._schemaVersion)}`)
  }
  if (!Array.isArray(root.patterns)) {
    throw new Error('nlu-patterns.json: "patterns" must be an array')
  }

  const seenIds = new Set<string>()
  const patterns: NluPatternDefinition[] = root.patterns.map((entry, index) => {
    const ctx = `nlu-patterns.json[${index}]`
    if (!entry || typeof entry !== 'object') throw new Error(`${ctx}: must be an object`)
    const p = entry as Record<string, unknown>

    if (typeof p.id !== 'string' || !ID_RE.test(p.id)) {
      throw new Error(`${ctx}: id must match ${ID_RE.source}`)
    }
    if (seenIds.has(p.id)) throw new Error(`${ctx}: duplicate id "${p.id}"`)
    seenIds.add(p.id)

    if (typeof p.kind !== 'string' || !VALID_KINDS.has(p.kind as NluPatternKind)) {
      throw new Error(`${ctx}: kind must be one of ${[...VALID_KINDS].join(', ')}`)
    }

    const flags = p.flags === undefined ? 'i' : p.flags
    if (typeof flags !== 'string' || !VALID_FLAGS.test(flags)) {
      throw new Error(`${ctx}: flags must contain only [gimsuy], got "${String(flags)}"`)
    }

    const hasRegex = typeof p.regex === 'string'
    const hasByLanguage = p.byLanguage && typeof p.byLanguage === 'object'
    if (hasRegex === hasByLanguage) {
      throw new Error(`${ctx}: exactly one of "regex" or "byLanguage" must be set`)
    }

    if (hasRegex) {
      // Compile to surface malformed patterns at boot time.
      // eslint-disable-next-line no-new
      new RegExp(p.regex as string, flags)
    } else {
      const map = p.byLanguage as Record<string, unknown>
      for (const [lang, src] of Object.entries(map)) {
        if (typeof src !== 'string') {
          throw new Error(`${ctx}.byLanguage.${lang}: must be a string, got ${typeof src}`)
        }
        // eslint-disable-next-line no-new
        new RegExp(src, flags)
      }
    }

    if (p.incidentTag !== undefined && typeof p.incidentTag !== 'string') {
      throw new Error(`${ctx}.incidentTag: must be a string when present`)
    }
    if (p.description !== undefined && typeof p.description !== 'string') {
      throw new Error(`${ctx}.description: must be a string when present`)
    }

    return {
      id: p.id,
      kind: p.kind as NluPatternKind,
      description: typeof p.description === 'string' ? p.description : undefined,
      regex: typeof p.regex === 'string' ? p.regex : undefined,
      byLanguage: hasByLanguage ? (p.byLanguage as Record<string, string>) : undefined,
      flags,
      incidentTag: typeof p.incidentTag === 'string' ? p.incidentTag : undefined,
    }
  })

  return {
    _principle: typeof root._principle === 'string' ? root._principle : undefined,
    _schemaVersion: 1,
    patterns,
  }
}
