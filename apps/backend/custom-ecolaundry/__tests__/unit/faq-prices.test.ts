// Standalone unit test (NO LLM) — Caso 12 FAQ guards (hours + prices).
//
// SCENARIO:
//   The 4 guards in utils/guards/faq-location-context.ts implement Caso 12
//   (Horarios y precios por location). State-level checks here:
//     - T1 detects intent; if location missing → asks + arms pendingFlow.
//     - T1 detects intent; if location set    → renders answer immediately.
//     - T2 (pendingFlow=faq-{prices,hours}-await-location) → clears flag,
//       renders answer once the location-extractor capture lands on state.
//     - Negative cases: no intent → null; gated when operator/name pending.
//
// Run with:
//   node --import tsx __tests__/unit/faq-location-context.test.ts

import { guardFaqHours, guardFaqHoursAwaitLocation } from '../../utils/guards/faq-hours.js'
import {
  guardFaqPrices,
  guardFaqPricesAwaitLocation,
  guardFaqPricesAwaitDryerConfirm,
} from '../../utils/guards/faq-prices.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'
import { getCachedTestRuntime, loadTestRuntime } from './_helpers.js'

await loadTestRuntime()

// Build a Runtime override that injects a small locations fixture so the
// formatters return real strings. We do NOT mutate the cached runtime — we
// shallow-clone and add locations only for this test file.
const baseRuntime = getCachedTestRuntime()
const runtimeWithLocations = {
  ...baseRuntime,
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
              { number: 'L4', weightKg: 13, fidelity: '5€', cash: '5€' },
            ],
            dryers: [{ number: 'S5', fidelity: '3€/20min', cash: '3€/20min' }],
          },
        },
      },
      LEscala: {
        pueblo: "L'Escala",
        displayName: "L'Escala",
        metadata: { hours: '7:00-23:00', machines: { washers: [], dryers: [] } },
      },
    },
  },
} as typeof baseRuntime

function makeAr(): AgentRuntime {
  return {
    state: createInitialState(),
    runtime: runtimeWithLocations,
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
}

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  // ── guardFaqHours T1: intent + missing location → ask ────────────────────
  {
    name: 'guardFaqHours T1: "¿cuáles son los horarios?" + no location → ask & arm pendingFlow',
    run: () => {
      const ar = makeAr()
      const out = guardFaqHours(ar, '¿cuáles son los horarios?')
      if (!out) throw new Error('expected guard to fire')
      if (!/lavandería|pueblo/i.test(out.reply)) throw new Error(`expected location ask, got "${out.reply}"`)
      if (out.reason !== 'faq-hours-ask-location') throw new Error(`expected ask-location reason, got "${out.reason}"`)
      if (ar.state.pendingFlow !== 'faq-hours-await-location') {
        throw new Error(`expected pendingFlow=faq-hours-await-location, got "${ar.state.pendingFlow}"`)
      }
    },
  },
  {
    name: 'guardFaqHours T1: intent + known location → render hours immediately',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'PlatjaDAro'
      const out = guardFaqHours(ar, '¿qué horarios?')
      if (!out) throw new Error('expected guard to fire')
      if (!/8:00.*22:00/.test(out.reply)) throw new Error(`expected hours rendered, got "${out.reply}"`)
      if (out.reason !== 'faq-hours') throw new Error(`expected reason=faq-hours, got "${out.reason}"`)
      if (ar.state.pendingFlow !== '') throw new Error(`pendingFlow must NOT be set on direct answer, got "${ar.state.pendingFlow}"`)
    },
  },
  {
    name: 'guardFaqHours: no hours intent → null (let other guards run)',
    run: () => {
      const ar = makeAr()
      const out = guardFaqHours(ar, 'mi lavadora no funciona')
      if (out !== null) throw new Error(`expected null, got ${JSON.stringify(out)}`)
    },
  },
  {
    name: 'guardFaqHours: gated when operatorRequested → null',
    run: () => {
      const ar = makeAr()
      ar.state.operatorRequested = true
      const out = guardFaqHours(ar, '¿cuáles son los horarios?')
      if (out !== null) throw new Error('must NOT fire during operator handover')
    },
  },

  // ── guardFaqHoursAwaitLocation T2: location captured → render answer ─────
  {
    name: 'guardFaqHoursAwaitLocation T2: pendingFlow set + location captured → render + clear',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'faq-hours-await-location'
      ar.state.location = 'PlatjaDAro' // simulate autoExtractFacts having set it
      const out = guardFaqHoursAwaitLocation(ar, "Platja d'Aro")
      if (!out) throw new Error('expected guard to fire')
      if (!/8:00.*22:00/.test(out.reply)) throw new Error(`expected hours rendered, got "${out.reply}"`)
      if (ar.state.pendingFlow !== '') throw new Error('pendingFlow must be cleared')
    },
  },
  {
    name: 'guardFaqHoursAwaitLocation: pendingFlow set but location still null → null (other guards ask)',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'faq-hours-await-location'
      ar.state.location = '' // location not extracted yet
      const out = guardFaqHoursAwaitLocation(ar, 'no entiendo')
      if (out !== null) throw new Error('must NOT fire while waiting for location')
      if (ar.state.pendingFlow !== 'faq-hours-await-location') throw new Error('pendingFlow must persist')
    },
  },
  {
    name: 'guardFaqHoursAwaitLocation: no pendingFlow → null (does not interfere)',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'PlatjaDAro'
      const out = guardFaqHoursAwaitLocation(ar, 'una pregunta')
      if (out !== null) throw new Error('must NOT fire outside the await phase')
    },
  },

  // ── guardFaqPrices T1: intent + missing location → ask ──────────────────
  {
    name: 'guardFaqPrices T1: "¿cuánto cuesta la lavadora?" + no location → ask & arm pendingFlow',
    run: () => {
      const ar = makeAr()
      const out = guardFaqPrices(ar, '¿cuánto cuesta la lavadora?')
      if (!out) throw new Error('expected guard to fire')
      if (!/lavandería|pueblo/i.test(out.reply)) throw new Error(`expected location ask, got "${out.reply}"`)
      if (out.reason !== 'faq-prices-ask-location') throw new Error(`expected reason, got "${out.reason}"`)
      if (ar.state.pendingFlow !== 'faq-prices-await-location') {
        throw new Error(`expected pendingFlow=faq-prices-await-location, got "${ar.state.pendingFlow}"`)
      }
    },
  },
  {
    name: 'guardFaqPrices T1: regression for "cuanto costa" (no accent — F46-style) → fires',
    run: () => {
      const ar = makeAr()
      const out = guardFaqPrices(ar, 'cuanto costa lavare la roba?')
      if (!out) throw new Error('expected guard to fire on accent-stripped variant')
      if (ar.state.pendingFlow !== 'faq-prices-await-location') {
        throw new Error('pendingFlow must be armed')
      }
    },
  },
  {
    name: 'guardFaqPrices T1: intent + location + washer mention → washer prices rendered',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'PlatjaDAro'
      const out = guardFaqPrices(ar, '¿cuánto cuesta la lavadora?')
      if (!out) throw new Error('expected guard to fire')
      if (!/\*\*L1\*\*/.test(out.reply)) throw new Error(`expected bold L1 in reply, got "${out.reply}"`)
      if (!/20kg/.test(out.reply)) throw new Error('expected L1 weight in reply')
      if (out.reason !== 'faq-prices-washer') throw new Error(`expected reason=faq-prices-washer, got "${out.reason}"`)
    },
  },
  {
    name: 'guardFaqPrices T1: intent + location + dryer mention → dryer prices rendered',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'PlatjaDAro'
      const out = guardFaqPrices(ar, '¿cuánto cuesta la secadora?')
      if (!out) throw new Error('expected guard to fire')
      if (!/\*\*S5\*\*/.test(out.reply)) throw new Error(`expected bold S5, got "${out.reply}"`)
      if (out.reason !== 'faq-prices-dryer') throw new Error(`expected reason=faq-prices-dryer`)
    },
  },
  {
    // F53 (Andrea 2026-05-14): usecases.md §12.2 updated to Option B —
    // the bot renders washer prices AND appends the explicit dryer-hint
    // question. This gives the follow-up "sí" semantic context (prior
    // silent-arm design caused out-of-context "sí" to trigger dryer
    // prices unexpectedly).
    name: 'guardFaqPrices T1: intent + location, no machine type → washer list + dryer hint',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'PlatjaDAro'
      const out = guardFaqPrices(ar, '¿cuánto cuesta?')
      if (!out) throw new Error('expected guard to fire')
      if (!/\*\*L1\*\*/.test(out.reply)) throw new Error('expected washer list')
      // Option B: the reply MUST include the dryer-hint question so the
      // follow-up "sí" has explicit context.
      if (!/secadora/i.test(out.reply)) {
        throw new Error(`F53: reply must mention secadora (dryer hint question): "${out.reply}"`)
      }
      // T3 follow-up armed so "sí" / "Y la secadora" works.
      if (ar.state.pendingFlow !== 'faq-prices-await-dryer-confirm') {
        throw new Error('pendingFlow must be armed for T3 follow-up')
      }
    },
  },
  {
    name: 'guardFaqPrices: no price intent → null',
    run: () => {
      const ar = makeAr()
      const out = guardFaqPrices(ar, 'hola')
      if (out !== null) throw new Error(`expected null, got ${JSON.stringify(out)}`)
    },
  },
  {
    name: 'guardFaqPrices: gated when customerNameRequested → null',
    run: () => {
      const ar = makeAr()
      ar.state.customerNameRequested = true
      const out = guardFaqPrices(ar, '¿cuánto cuesta?')
      if (out !== null) throw new Error('must NOT fire during name capture')
    },
  },

  // ── guardFaqPricesAwaitLocation T2 ───────────────────────────────────────
  {
    name: 'guardFaqPricesAwaitLocation T2: pendingFlow + location → washer prices + arms dryer-confirm',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'faq-prices-await-location'
      ar.state.location = 'PlatjaDAro'
      const out = guardFaqPricesAwaitLocation(ar, "Platja d'Aro")
      if (!out) throw new Error('expected guard to fire')
      if (!/\*\*L1\*\*/.test(out.reply)) throw new Error(`expected L1 prices, got "${out.reply}"`)
      // F53: T2 with no machine type mention falls into the washer-default
      // branch which renders washer prices + explicit dryer-hint question
      // ("¿También quieres información de secadora?"). The T3 follow-up
      // "sí" then has semantic context.
      if (!/secadora/i.test(out.reply)) {
        throw new Error(`F53: expected dryer-hint question in reply, got "${out.reply}"`)
      }
      if (ar.state.pendingFlow !== 'faq-prices-await-dryer-confirm') {
        throw new Error(`expected dryer-confirm armed, got "${ar.state.pendingFlow}"`)
      }
    },
  },
  {
    name: 'guardFaqPricesAwaitLocation: no pendingFlow → null',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'PlatjaDAro'
      const out = guardFaqPricesAwaitLocation(ar, "Platja d'Aro")
      if (out !== null) throw new Error('must NOT fire outside the await phase')
    },
  },
  {
    name: 'guardFaqPricesAwaitLocation: pendingFlow set but no location → null (await persists)',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'faq-prices-await-location'
      ar.state.location = ''
      const out = guardFaqPricesAwaitLocation(ar, 'no sé')
      if (out !== null) throw new Error('must NOT fire while waiting')
      if (ar.state.pendingFlow !== 'faq-prices-await-location') throw new Error('pendingFlow must persist')
    },
  },

  // ── guardFaqPricesAwaitDryerConfirm (T3 — Andrea 2026-05-14) ─────────────
  {
    name: 'T1 washer-default arms dryer-confirm pendingFlow',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'PlatjaDAro'
      const out = guardFaqPrices(ar, '¿cuánto cuesta?') // no machine type → fallback path
      if (!out) throw new Error('expected guard to fire')
      if (ar.state.pendingFlow !== 'faq-prices-await-dryer-confirm') {
        throw new Error(`expected dryer-confirm armed, got "${ar.state.pendingFlow}"`)
      }
    },
  },
  {
    name: 'guardFaqPricesAwaitDryerConfirm: "sí" → render dryer prices + clear flag',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'faq-prices-await-dryer-confirm'
      ar.state.location = 'PlatjaDAro'
      const out = guardFaqPricesAwaitDryerConfirm(ar, 'sí')
      if (!out) throw new Error('expected guard to fire on "sí"')
      if (!/\*\*S5\*\*/.test(out.reply)) throw new Error(`expected bold S5 dryer, got: ${out.reply}`)
      if (ar.state.pendingFlow !== '') throw new Error('pendingFlow must clear after confirm')
      if (out.reason !== 'faq-prices-dryer-confirm') throw new Error('reason mismatch')
    },
  },
  {
    name: 'guardFaqPricesAwaitDryerConfirm: "si" (no accent) → render dryer prices',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'faq-prices-await-dryer-confirm'
      ar.state.location = 'PlatjaDAro'
      const out = guardFaqPricesAwaitDryerConfirm(ar, 'si')
      if (!out) throw new Error('expected "si" to confirm')
      if (!/\*\*S5\*\*/.test(out.reply)) throw new Error('expected dryer prices')
    },
  },
  {
    name: 'guardFaqPricesAwaitDryerConfirm: "yes" (EN) → render dryer prices',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'faq-prices-await-dryer-confirm'
      ar.state.location = 'PlatjaDAro'
      const out = guardFaqPricesAwaitDryerConfirm(ar, 'yes')
      if (!out) throw new Error('expected "yes" to confirm')
    },
  },
  {
    // usecases.md §12.2: "Y la secadora" is the documented T3 trigger.
    name: 'guardFaqPricesAwaitDryerConfirm: "Y la secadora" → render dryer prices',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'faq-prices-await-dryer-confirm'
      ar.state.location = 'PlatjaDAro'
      const out = guardFaqPricesAwaitDryerConfirm(ar, 'Y la secadora')
      if (!out) throw new Error('expected dryer mention to confirm')
      if (!/\*\*S5\*\*/.test(out.reply)) throw new Error('expected dryer prices rendered')
    },
  },
  {
    name: 'guardFaqPricesAwaitDryerConfirm: bare "secadora" → render dryer prices',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'faq-prices-await-dryer-confirm'
      ar.state.location = 'PlatjaDAro'
      const out = guardFaqPricesAwaitDryerConfirm(ar, 'secadora')
      if (!out) throw new Error('expected dryer mention to confirm')
    },
  },
  {
    name: 'guardFaqPricesAwaitDryerConfirm: non-affirmative reply clears flag + returns null',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'faq-prices-await-dryer-confirm'
      ar.state.location = 'PlatjaDAro'
      const out = guardFaqPricesAwaitDryerConfirm(ar, 'gracias, eso es todo')
      if (out !== null) throw new Error('non-affirmative must NOT fire dryer render')
      if (ar.state.pendingFlow !== '') throw new Error('pendingFlow must clear to release control')
    },
  },
  {
    name: 'guardFaqPricesAwaitDryerConfirm: no pendingFlow → null',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'PlatjaDAro'
      const out = guardFaqPricesAwaitDryerConfirm(ar, 'sí')
      if (out !== null) throw new Error('must NOT fire outside the confirm phase')
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
