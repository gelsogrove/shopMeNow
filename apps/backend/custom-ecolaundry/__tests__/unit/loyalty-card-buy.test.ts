// Standalone unit test for TARJETA_TOPIC regex (Caso 10 trigger detection).
//
// SCENARIO:
//   Customer asks about the loyalty card with various phrasings. The
//   TARJETA_TOPIC regex must match the canonical patterns AND the
//   permissive verb-adjective variants Andrea reported (F44).
//
// F44 — Andrea 2026-05-11: bot ignored "quiero comprar una nueva tarjeta"
// because the previous regex required "tarjeta" immediately after
// "quiero" + article. The new regex allows an optional action verb
// (comprar/tener/conseguir/sacar/adquirir) AND an optional adjective
// (nueva/otra/mi) between the intent verb and "tarjeta".
//
// Run with:
//   node --import tsx __tests__/unit/loyalty-card-buy.test.ts

import { TARJETA_TOPIC } from '../../utils/guards/loyalty-card-buy.js'

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  // ── Canonical patterns (pre-F44 — must still match) ──────────────────────
  {
    name: 'canonical: "tarjeta de fidelización" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('quiero la tarjeta de fidelización')) {
        throw new Error('canonical "tarjeta de fidelización" must match')
      }
    },
  },
  {
    name: 'canonical: "tarjeta de descuento" → match (F25)',
    run: () => {
      if (!TARJETA_TOPIC.test('quiero la tarjeta de descuento')) {
        throw new Error('"tarjeta de descuento" must match (F25)')
      }
    },
  },
  {
    name: 'canonical: "loyalty card" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('I want a loyalty card')) {
        throw new Error('"loyalty card" must match')
      }
    },
  },
  {
    name: 'canonical: "cómo consigo la tarjeta" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('¿cómo consigo la tarjeta?')) {
        throw new Error('"cómo consigo la tarjeta" must match')
      }
    },
  },
  {
    name: 'canonical: "quiero la tarjeta" → match (F25)',
    run: () => {
      if (!TARJETA_TOPIC.test('quiero la tarjeta')) {
        throw new Error('"quiero la tarjeta" must match')
      }
    },
  },

  // ── F44 — verb + adjective between intent and "tarjeta" ─────────────────
  {
    name: 'F44: "quiero comprar una nueva tarjeta" → match (real customer chat)',
    run: () => {
      if (!TARJETA_TOPIC.test('quiero comprar una nueva tarjeta')) {
        throw new Error('F44: "quiero comprar una nueva tarjeta" must match')
      }
    },
  },
  {
    name: 'F44: "quiero comprar una tarjeta" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('quiero comprar una tarjeta')) {
        throw new Error('F44: "quiero comprar una tarjeta" must match')
      }
    },
  },
  {
    name: 'F44: "necesito una nueva tarjeta" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('necesito una nueva tarjeta')) {
        throw new Error('F44: "necesito una nueva tarjeta" must match')
      }
    },
  },
  {
    name: 'F44: "necesito sacar la tarjeta" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('necesito sacar la tarjeta')) {
        throw new Error('F44: "necesito sacar la tarjeta" must match')
      }
    },
  },
  {
    name: 'F44: "me gustaría tener una tarjeta" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('me gustaría tener una tarjeta')) {
        throw new Error('F44: "me gustaría tener una tarjeta" must match')
      }
    },
  },
  {
    name: 'F44: "quisiera conseguir otra tarjeta" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('quisiera conseguir otra tarjeta')) {
        throw new Error('F44: "quisiera conseguir otra tarjeta" must match')
      }
    },
  },

  // ── Negative cases — must NOT over-match ────────────────────────────────
  {
    name: 'negative: "no funciona la lavadora" → no match',
    run: () => {
      if (TARJETA_TOPIC.test('no funciona la lavadora')) {
        throw new Error('machine fault must NOT match tarjeta topic')
      }
    },
  },
  {
    name: 'negative: empty string → no match',
    run: () => {
      if (TARJETA_TOPIC.test('')) {
        throw new Error('empty string must NOT match')
      }
    },
  },
]

async function main(): Promise<void> {
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
}

main()
