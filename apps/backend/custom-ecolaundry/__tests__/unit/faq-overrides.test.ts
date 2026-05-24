// Standalone unit test (NO LLM) — faq-overrides helper.
//
// Iron rule #8: multi-language by design. The helper resolves a
// faqOverrides entry to the session-language answer with ES fallback.
// Supports two shapes for backward-compat during the migration:
//   - legacy string (ES-only)
//   - new multi-lang object {es?, ca?, en?, ...}
//
// Regression context (Andrea 2026-05-23 Caso 10):
//   Goya.buy-loyalty-card migrated to {es,ca,en} crashed the unmigrated
//   readers (tool-handlers/faq.ts, branches/faq/handler.ts,
//   faq-how-to-use.ts, loyalty-card-buy.ts) which cast to Record<string,
//   string> and called `.trim()` on the object. The helper makes the
//   migration safe by accepting both shapes.
//
// Run with:
//   node --import tsx __tests__/unit/faq-overrides.test.ts

import {
  getLocalisedFaqOverride,
  getLocalisedFaqOverrideFromBlock,
} from '../../utils/faq-overrides.js'
import type { AgentRuntime } from '../../models/index.js'

// Helper: build a minimal AgentRuntime with a single location override.
function buildAr(
  location: string | null,
  faqOverrides: Record<string, unknown> | undefined,
): AgentRuntime {
  return {
    runtime: {
      // Only locations is read by getLocalisedFaqOverride — other runtime
      // fields can stay undefined-as-any for this test.
      locations: location && faqOverrides
        ? {
            locations: {
              [location]: { faqOverrides },
            },
          }
        : undefined,
    },
    state: {
      location: location ?? '',
    },
  } as unknown as AgentRuntime
}

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  {
    name: 'legacy string entry: returned verbatim regardless of lang',
    run: () => {
      const ar = buildAr('Goya', { 'buy-loyalty-card': 'En Goya, paga 20€...' })
      const es = getLocalisedFaqOverride(ar, 'buy-loyalty-card', 'es')
      const ca = getLocalisedFaqOverride(ar, 'buy-loyalty-card', 'ca')
      const en = getLocalisedFaqOverride(ar, 'buy-loyalty-card', 'en')
      if (es !== 'En Goya, paga 20€...') throw new Error(`es: ${es}`)
      if (ca !== 'En Goya, paga 20€...') throw new Error(`ca: ${ca}`)
      if (en !== 'En Goya, paga 20€...') throw new Error(`en: ${en}`)
    },
  },
  {
    name: 'multi-lang object: exact lang match wins',
    run: () => {
      const ar = buildAr('Goya', {
        'buy-loyalty-card': {
          es: 'En Goya, paga 20€ ES',
          ca: 'A Goya, paga 20€ CA',
          en: 'At Goya, pay 20€ EN',
        },
      })
      if (getLocalisedFaqOverride(ar, 'buy-loyalty-card', 'es') !== 'En Goya, paga 20€ ES') {
        throw new Error('es mismatch')
      }
      if (getLocalisedFaqOverride(ar, 'buy-loyalty-card', 'ca') !== 'A Goya, paga 20€ CA') {
        throw new Error('ca mismatch')
      }
      if (getLocalisedFaqOverride(ar, 'buy-loyalty-card', 'en') !== 'At Goya, pay 20€ EN') {
        throw new Error('en mismatch')
      }
    },
  },
  {
    name: 'multi-lang object: missing target lang falls back to ES',
    run: () => {
      const ar = buildAr('Goya', {
        'buy-loyalty-card': { es: 'ES only' },
      })
      if (getLocalisedFaqOverride(ar, 'buy-loyalty-card', 'ca') !== 'ES only') {
        throw new Error('ca should fall back to ES')
      }
      if (getLocalisedFaqOverride(ar, 'buy-loyalty-card', 'en') !== 'ES only') {
        throw new Error('en should fall back to ES')
      }
    },
  },
  {
    name: 'multi-lang object: no ES, falls back to any present lang',
    run: () => {
      const ar = buildAr('Goya', {
        'buy-loyalty-card': { en: 'EN only' },
      })
      // Looking for CA, no CA, no ES → falls through to the first present.
      const out = getLocalisedFaqOverride(ar, 'buy-loyalty-card', 'ca')
      if (out !== 'EN only') throw new Error(`expected 'EN only', got: ${out}`)
    },
  },
  {
    name: 'empty string entry treated as missing',
    run: () => {
      const ar = buildAr('Goya', { 'buy-loyalty-card': '' })
      if (getLocalisedFaqOverride(ar, 'buy-loyalty-card', 'es') !== null) {
        throw new Error('empty string must resolve to null')
      }
    },
  },
  {
    name: 'whitespace-only string entry treated as missing',
    run: () => {
      const ar = buildAr('Goya', { 'buy-loyalty-card': '   ' })
      if (getLocalisedFaqOverride(ar, 'buy-loyalty-card', 'es') !== null) {
        throw new Error('whitespace-only string must resolve to null')
      }
    },
  },
  {
    name: 'missing key returns null',
    run: () => {
      const ar = buildAr('Goya', { 'recharge-loyalty-card': 'something' })
      if (getLocalisedFaqOverride(ar, 'buy-loyalty-card', 'es') !== null) {
        throw new Error('missing key must resolve to null')
      }
    },
  },
  {
    name: 'no state.location returns null',
    run: () => {
      const ar = buildAr(null, undefined)
      if (getLocalisedFaqOverride(ar, 'buy-loyalty-card', 'es') !== null) {
        throw new Error('no location must resolve to null')
      }
    },
  },
  {
    name: 'getLocalisedFaqOverrideFromBlock: same resolution from explicit block',
    run: () => {
      const out = getLocalisedFaqOverrideFromBlock(
        {
          faqOverrides: {
            'buy-loyalty-card': { es: 'ES', ca: 'CA', en: 'EN' },
          },
        },
        'buy-loyalty-card',
        'ca',
      )
      if (out !== 'CA') throw new Error(`expected 'CA', got: ${out}`)
    },
  },
  {
    name: 'getLocalisedFaqOverrideFromBlock: null/undefined block returns null',
    run: () => {
      if (getLocalisedFaqOverrideFromBlock(null, 'k', 'es') !== null) {
        throw new Error('null block must resolve to null')
      }
      if (getLocalisedFaqOverrideFromBlock(undefined, 'k', 'es') !== null) {
        throw new Error('undefined block must resolve to null')
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
