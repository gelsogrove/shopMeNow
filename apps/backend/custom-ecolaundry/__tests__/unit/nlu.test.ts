// Standalone unit test (NO LLM) — utils/nlu.ts: NLU runtime API.
//
// SCENARIO:
//   nlu.ts is a thin wrapper over json/nlu-patterns.json. It compiles regex
//   patterns lazily, caches the result, picks the right per-language source
//   when the pattern is `byLanguage`, and throws on unknown pattern ids
//   (fail-fast on typos). This file pins those contracts.
//
// Run with:
//   node --import tsx __tests__/unit/nlu.test.ts

import {
  _resetNluCacheForTests,
  getPattern,
  getPatternDefinition,
  matchPattern,
} from '../../utils/nlu.js'
import type { Runtime } from '../../models/index.js'

function makeRuntime(): Runtime {
  // Synthetic runtime with a small set of patterns covering every code path:
  //   - simple `regex` source
  //   - `byLanguage` source with es/it/en
  //   - explicit `flags`
  //   - missing source (validation runs at boot, but the runtime API still
  //     guards against bad config)
  return {
    settings: {} as Runtime['settings'],
    locations: {} as Runtime['locations'],
    displayFlows: {} as Runtime['displayFlows'],
    faqs: {},
    nluPatterns: {
      _schemaVersion: 1,
      patterns: [
        {
          id: 'greeting-only',
          kind: 'sanitize',
          regex: '^(hola|ciao|hi)$',
          flags: 'i',
        },
        {
          id: 'angry-tone',
          kind: 'anti-pattern',
          byLanguage: {
            es: '(siempre falla|esto es un desastre)',
            it: '(non funziona mai|che disastro)',
            en: '(this always fails|what a disaster)',
          },
          flags: 'i',
        },
      ],
    },
  }
}

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  {
    name: 'getPattern: simple regex source compiles',
    run: () => {
      _resetNluCacheForTests()
      const r = getPattern(makeRuntime(), 'greeting-only')
      if (!(r instanceof RegExp)) throw new Error('expected RegExp')
      if (!r.test('hola')) throw new Error('"hola" must match')
      if (r.test('hola, no funciona')) throw new Error('only-form regex must NOT match longer text')
    },
  },
  {
    name: 'getPattern: byLanguage selects ES when lang=es',
    run: () => {
      _resetNluCacheForTests()
      const r = getPattern(makeRuntime(), 'angry-tone', 'es')
      if (!r.test('siempre falla')) throw new Error('ES pattern must match ES text')
      if (r.test('non funziona mai')) throw new Error('ES pattern must NOT match IT text')
    },
  },
  {
    name: 'getPattern: byLanguage selects IT when lang=it',
    run: () => {
      _resetNluCacheForTests()
      const r = getPattern(makeRuntime(), 'angry-tone', 'it')
      if (!r.test('non funziona mai')) throw new Error('IT pattern must match IT text')
      if (r.test('siempre falla')) throw new Error('IT pattern must NOT match ES text')
    },
  },
  {
    name: 'getPattern: byLanguage falls back to ES when lang has no entry',
    run: () => {
      _resetNluCacheForTests()
      const r = getPattern(makeRuntime(), 'angry-tone', 'pt')
      // PT is not in byLanguage → falls back to ES.
      if (!r.test('siempre falla')) throw new Error('fallback must use ES pattern')
    },
  },
  {
    name: 'getPattern: throws on unknown id',
    run: () => {
      _resetNluCacheForTests()
      let threw = false
      try {
        getPattern(makeRuntime(), 'this-id-does-not-exist')
      } catch (err) {
        threw = true
        if (!(err instanceof Error) || !/unknown pattern/i.test(err.message)) {
          throw new Error(`unexpected error: ${err}`)
        }
      }
      if (!threw) throw new Error('getPattern must throw on unknown id')
    },
  },
  {
    name: 'matchPattern: returns true/false directly',
    run: () => {
      _resetNluCacheForTests()
      const rt = makeRuntime()
      if (!matchPattern(rt, 'greeting-only', 'hola')) {
        throw new Error('"hola" must match greeting-only')
      }
      if (matchPattern(rt, 'greeting-only', 'hola, no funciona')) {
        throw new Error('full-line greeting must NOT match longer text')
      }
    },
  },
  {
    name: 'matchPattern: respects per-language selection',
    run: () => {
      _resetNluCacheForTests()
      const rt = makeRuntime()
      if (!matchPattern(rt, 'angry-tone', 'siempre falla', 'es')) {
        throw new Error('ES match expected')
      }
      if (matchPattern(rt, 'angry-tone', 'siempre falla', 'it')) {
        throw new Error('IT pattern must not match ES text')
      }
    },
  },
  {
    name: 'getPatternDefinition: returns the entry with metadata',
    run: () => {
      const def = getPatternDefinition(makeRuntime(), 'angry-tone')
      if (def.id !== 'angry-tone') throw new Error('id mismatch')
      if (def.kind !== 'anti-pattern') throw new Error('kind mismatch')
    },
  },
  {
    name: 'getPatternDefinition: throws on unknown id (typo guard)',
    run: () => {
      let threw = false
      try {
        getPatternDefinition(makeRuntime(), 'misspelled-id')
      } catch {
        threw = true
      }
      if (!threw) throw new Error('must throw on unknown id')
    },
  },
  {
    name: 'cache: subsequent calls return the same compiled instance',
    run: () => {
      _resetNluCacheForTests()
      const rt = makeRuntime()
      const r1 = getPattern(rt, 'greeting-only')
      const r2 = getPattern(rt, 'greeting-only')
      if (r1 !== r2) throw new Error('cache must return identical RegExp instance')
    },
  },
  {
    name: 'cache: different language keys produce different compiled regex',
    run: () => {
      _resetNluCacheForTests()
      const rt = makeRuntime()
      const es = getPattern(rt, 'angry-tone', 'es')
      const it = getPattern(rt, 'angry-tone', 'it')
      if (es === it) {
        throw new Error('different language scopes must compile to different RegExp')
      }
    },
  },
]

let passed = 0
let failed = 0
for (const c of cases) {
  try {
    c.run()
    passed += 1
    console.log(`\x1b[32m  ✓\x1b[0m ${c.name}`)
  } catch (err) {
    failed += 1
    const reason = err instanceof Error ? err.message : String(err)
    console.log(`\x1b[31m  ✗\x1b[0m ${c.name}\n      ${reason}`)
  }
}
console.log(`\n${passed} passed, ${failed} failed (out of ${cases.length})\n`)
if (failed > 0) process.exit(1)
