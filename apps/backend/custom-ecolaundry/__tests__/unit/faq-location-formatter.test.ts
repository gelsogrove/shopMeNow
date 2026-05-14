// Standalone unit test (NO LLM) — Caso 12 pure formatters.
//
// SCENARIO:
//   utils/faq-location-formatter.ts reads metadata.hours and
//   metadata.machines.{washers,dryers} from runtime.locations and produces
//   customer-facing strings. Mistakes here either invent prices or fail to
//   render valid data — both are forbidden (Iron rule #7: settings are law).
//
// Run with:
//   node --import tsx __tests__/unit/faq-location-formatter.test.ts

import {
  formatHours,
  formatWasherPrices,
  formatDryerPrices,
} from '../../utils/faq-location-formatter.js'
import type { Runtime } from '../../models/runtime.js'

// ── Test fixture ──────────────────────────────────────────────────────────────
//
// Minimal Runtime stub with two locations:
//   - PlatjaDAro: 4 washers, 2 dryers, standard 8-22 hours
//   - LEscala: 4 washers, 2 dryers, EXTENDED 7-23 hours
//   - MataroUmbrella: no machines (Mataró-style umbrella location)
const runtime = {
  locations: {
    locations: {
      PlatjaDAro: {
        pueblo: "Platja d'Aro",
        displayName: "Platja d'Aro",
        metadata: {
          hours: '8:00-22:00',
          machines: {
            washers: [
              { number: 'L1', weightKg: 20, fidelity: '10€', cash: '10€' },
              { number: 'L2', weightKg: 15, fidelity: '8€', cash: '8€' },
              { number: 'L4', weightKg: 13, fidelity: '5€', cash: '5€' },
            ],
            dryers: [
              { number: 'S5', weightKg: null, fidelity: '3€/20min', cash: '3€/20min' },
            ],
          },
        },
      },
      // F54 fixture: Pineda has 2 dryers with IDENTICAL specs → should collapse
      // into one line under plural label "Secadoras", AND 2 washers with
      // identical specs (L4/L5 both 20kg 6,5€/7€) → "Lavadoras 20kg" line.
      Pineda: {
        pueblo: 'Pineda',
        displayName: 'Pineda',
        metadata: {
          hours: '8:00-22:00',
          machines: {
            washers: [
              { number: 'L4', weightKg: 20, fidelity: '6,5€', cash: '7€' },
              { number: 'L5', weightKg: 20, fidelity: '6,5€', cash: '7€' },
              { number: 'L6', weightKg: 10, fidelity: '3,5€', cash: '4€' },
            ],
            dryers: [
              { number: 'S4', weightKg: 20, fidelity: '2€/15min', cash: '2€/15min' },
              { number: 'S5', weightKg: 20, fidelity: '2€/15min', cash: '2€/15min' },
            ],
          },
        },
      },
      LEscala: {
        pueblo: "L'Escala",
        displayName: "L'Escala",
        metadata: {
          hours: '7:00-23:00',
          machines: {
            washers: [
              { number: 'L1', weightKg: 18, fidelity: '9€', cash: '10€' }, // different prices
            ],
            dryers: [],
          },
        },
      },
      MataroUmbrella: {
        pueblo: 'Mataró',
        displayName: 'Mataró',
        metadata: {
          hours: '8:00-22:00',
          // No machines block — this is an umbrella (Goya/Alemanya have them)
        },
      },
    },
  },
} as unknown as Runtime

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  // ── formatHours ──────────────────────────────────────────────────────────
  {
    name: 'formatHours: Platja d\'Aro → "8:00 a 22:00 todos los días"',
    run: () => {
      const r = formatHours('PlatjaDAro', runtime)
      if (!r) throw new Error('expected formatted hours, got null')
      if (!/8:00.*22:00/.test(r)) throw new Error(`expected 8:00-22:00, got "${r}"`)
      if (!/todos los días/.test(r)) throw new Error(`expected "todos los días", got "${r}"`)
      if (!/Platja d'Aro/.test(r)) throw new Error(`expected location name, got "${r}"`)
    },
  },
  {
    name: 'formatHours: L\'Escala → 7:00-23:00 (exception location)',
    run: () => {
      const r = formatHours('LEscala', runtime)
      if (!r) throw new Error('expected formatted hours, got null')
      if (!/7:00.*23:00/.test(r)) throw new Error(`expected 7:00-23:00, got "${r}"`)
      if (!/L'Escala/.test(r)) throw new Error(`expected L'Escala in output, got "${r}"`)
    },
  },
  {
    name: 'formatHours: unknown location → null',
    run: () => {
      const r = formatHours('Nonexistent', runtime)
      if (r !== null) throw new Error(`expected null for unknown location, got "${r}"`)
    },
  },

  // ── formatWasherPrices ───────────────────────────────────────────────────
  {
    name: 'formatWasherPrices: Platja d\'Aro → bold L1/L2/L4 with kg + price',
    run: () => {
      const r = formatWasherPrices('PlatjaDAro', runtime)
      if (!r) throw new Error('expected washer prices, got null')
      if (!/\*\*L1\*\*/.test(r)) throw new Error('expected bold L1')
      if (!/\*\*L2\*\*/.test(r)) throw new Error('expected bold L2')
      if (!/\*\*L4\*\*/.test(r)) throw new Error('expected bold L4')
      if (!/20kg/.test(r)) throw new Error('expected L1 weight 20kg')
      if (!/10€/.test(r)) throw new Error('expected L1 price 10€')
      if (!/Platja d'Aro/.test(r)) throw new Error('expected location header')
    },
  },
  {
    name: 'formatWasherPrices: same fidelity/cash renders single price (no fidelidad/efectivo labels)',
    run: () => {
      // Platja d'Aro L1: fidelity 10€ === cash 10€ → "**L1** 20kg: 10€"
      const r = formatWasherPrices('PlatjaDAro', runtime)!
      if (!/\*\*L1\*\* 20kg: 10€$/m.test(r)) {
        throw new Error(`L1 should render single 10€ price without labels, got: "${r}"`)
      }
      // and must NOT contain "fidelidad" when prices match
      const l1Line = r.split('\n').find((l) => l.includes('**L1**'))!
      if (/fidelidad/.test(l1Line)) {
        throw new Error(`L1 line should NOT mention fidelidad when prices are equal, got: "${l1Line}"`)
      }
    },
  },
  {
    name: 'formatWasherPrices: L\'Escala L1 different prices → renders fidelidad/efectivo labels',
    run: () => {
      // L'Escala L1: fidelity 9€, cash 10€ → "**L1** 18kg: 9€ (fidelidad) / 10€ (efectivo)"
      const r = formatWasherPrices('LEscala', runtime)!
      if (!/9€\s*\(fidelidad\)/.test(r)) {
        throw new Error(`expected fidelidad 9€ label, got: "${r}"`)
      }
      if (!/10€\s*\(efectivo\)/.test(r)) {
        throw new Error(`expected efectivo 10€ label, got: "${r}"`)
      }
    },
  },
  {
    name: 'formatWasherPrices: location with no washers (Mataró umbrella) → null',
    run: () => {
      const r = formatWasherPrices('MataroUmbrella', runtime)
      if (r !== null) throw new Error(`expected null when no washers, got "${r}"`)
    },
  },
  {
    name: 'formatWasherPrices: unknown location → null',
    run: () => {
      const r = formatWasherPrices('Nonexistent', runtime)
      if (r !== null) throw new Error(`expected null for unknown location, got "${r}"`)
    },
  },

  // ── formatDryerPrices ────────────────────────────────────────────────────
  {
    name: 'formatDryerPrices: Platja d\'Aro S5 → no weight + "3€/20min"',
    run: () => {
      const r = formatDryerPrices('PlatjaDAro', runtime)
      if (!r) throw new Error('expected dryer prices, got null')
      if (!/\*\*S5\*\*/.test(r)) throw new Error('expected bold S5')
      if (!/3€\/20min/.test(r)) throw new Error('expected duration-priced 3€/20min')
      // Dryer has no weight — line must NOT contain "kg"
      const s5Line = r.split('\n').find((l) => l.includes('**S5**'))!
      if (/\dkg/.test(s5Line)) throw new Error(`dryer line should NOT have kg, got: "${s5Line}"`)
    },
  },
  {
    name: 'formatDryerPrices: L\'Escala empty dryers array → null',
    run: () => {
      const r = formatDryerPrices('LEscala', runtime)
      if (r !== null) throw new Error(`expected null when dryers array empty, got "${r}"`)
    },
  },
  {
    name: 'formatDryerPrices: location with no machines block (Mataró) → null',
    run: () => {
      const r = formatDryerPrices('MataroUmbrella', runtime)
      if (r !== null) throw new Error(`expected null, got "${r}"`)
    },
  },

  // ── F54 — collapse identical-spec machines into plural label ─────────────
  {
    name: 'F54: 2 dryers with identical specs → 1 line "Secadoras 20kg: 2€/15min" (no individual S4/S5)',
    run: () => {
      const r = formatDryerPrices('Pineda', runtime)!
      // Must contain the plural label and the spec line
      if (!/\*\*Secadoras\*\*\s+20kg:\s+2€\/15min/.test(r)) {
        throw new Error(`F54: expected "**Secadoras** 20kg: 2€/15min", got: "${r}"`)
      }
      // Must NOT list individual S4/S5 as separate bold labels when collapsed
      if (/\*\*S4\*\*/.test(r) || /\*\*S5\*\*/.test(r)) {
        throw new Error(`F54: collapsed group must NOT list individual numbers, got: "${r}"`)
      }
      // Exactly 1 bullet line for the collapsed dryer group
      const bulletCount = (r.match(/^- \*\*/gm) || []).length
      if (bulletCount !== 1) {
        throw new Error(`F54: expected exactly 1 collapsed line, got ${bulletCount}: "${r}"`)
      }
    },
  },
  {
    name: 'F54: 2 washers identical + 1 different → "Lavadoras 20kg" + "L6 10kg"',
    run: () => {
      const r = formatWasherPrices('Pineda', runtime)!
      // L4/L5 identical → collapsed under "Lavadoras 20kg"
      if (!/\*\*Lavadoras\*\*\s+20kg:\s+6,5€\s+\(fidelidad\)/.test(r)) {
        throw new Error(`F54: expected "**Lavadoras** 20kg: 6,5€ ...", got: "${r}"`)
      }
      // L6 is unique → keep its number
      if (!/\*\*L6\*\*\s+10kg:\s+3,5€/.test(r)) {
        throw new Error(`F54: expected unique "**L6** 10kg: 3,5€", got: "${r}"`)
      }
      // Exactly 2 bullet lines (1 grouped + 1 single)
      const bulletCount = (r.match(/^- \*\*/gm) || []).length
      if (bulletCount !== 2) {
        throw new Error(`F54: expected exactly 2 lines, got ${bulletCount}: "${r}"`)
      }
      // L4/L5 numbers must not appear as bold labels
      if (/\*\*L4\*\*/.test(r) || /\*\*L5\*\*/.test(r)) {
        throw new Error(`F54: L4/L5 numbers should disappear in collapsed group, got: "${r}"`)
      }
    },
  },
  {
    name: 'F54: all machines different (Platja d\'Aro washers) → no collapse, 1 line each',
    run: () => {
      // Platja d'Aro: L1 20kg/10€, L2 15kg/8€, L4 13kg/5€ — all different
      const r = formatWasherPrices('PlatjaDAro', runtime)!
      // All 3 unique numbers must appear as bold labels
      if (!/\*\*L1\*\*/.test(r)) throw new Error('F54: L1 must remain when unique')
      if (!/\*\*L2\*\*/.test(r)) throw new Error('F54: L2 must remain when unique')
      if (!/\*\*L4\*\*/.test(r)) throw new Error('F54: L4 must remain when unique')
      // Plural label "Lavadoras" must NOT appear when all are different
      if (/\*\*Lavadoras\*\*/.test(r)) {
        throw new Error(`F54: plural label must NOT appear when all specs differ, got: "${r}"`)
      }
      const bulletCount = (r.match(/^- \*\*/gm) || []).length
      if (bulletCount !== 3) throw new Error(`F54: expected 3 lines, got ${bulletCount}`)
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
