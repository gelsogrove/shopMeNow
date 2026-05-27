// Standalone unit test (NO LLM) — Caso 12.4 FAQ programs guards (F81).
//
// WHAT: Tests the two guards that implement FAQ programs flow:
//   - guardFaqPrograms    (T1): detects programs intent, asks location if unknown,
//                               renders programs from locations.json if location known.
//   - guardFaqProgramsAwaitLocation (T2): fires when pendingFlow is armed and
//                               location-extractor captured a location this turn.
//
// WHY: Rule #5 — every guard must have a sibling unit test.
//      Rule #7 — all data from json/locations.json, never hardcoded.
//      F81 — programs feature; regression guard for future changes.
//
// Run with:
//   node --import tsx __tests__/unit/faq-programs.test.ts

import { guardFaqPrograms, guardFaqProgramsAwaitLocation } from '../../utils/guards/faq-programs.js'
import { detectProgramsIntent } from '../../utils/intent.js'
import {
  formatWasherPrograms,
  formatDryerPrograms,
} from '../../utils/faq-location-formatter.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'
import { getCachedTestRuntime, loadTestRuntime } from './_helpers.js'

await loadTestRuntime()

const baseRuntime = getCachedTestRuntime()

// Fixture with programs data covering:
// - Goya: numbered washers (1-4) + dryers
// - Hortes: unnumbered washers (number: null) + dryers
// - Escala: 5 washer programs, different order
// - NoPrograms: location without programs (fallback test)
const runtimeWithPrograms = {
  ...baseRuntime,
  locations: {
    locations: {
      Goya: {
        pueblo: 'Mataró',
        displayName: 'Goya',
        metadata: {
          hours: '8:00-22:00',
          programs: {
            washers: [
              { number: 1, nameKey: 'programMuyCaliente', temp: '60º' },
              { number: 2, nameKey: 'programCaliente', temp: '40º' },
              { number: 3, nameKey: 'programTemplado', temp: '30º' },
              { number: 4, nameKey: 'programFrio', temp: '*' },
            ],
            dryers: [
              { nameKey: 'programAltaTemp' },
              { nameKey: 'programMediaTemp' },
              { nameKey: 'programBajaTemp' },
            ],
          },
        },
      },
      Hortes: {
        pueblo: 'Granollers',
        displayName: 'Hortes (Granollers)',
        metadata: {
          hours: '8:00-22:00',
          programs: {
            washers: [
              { number: null, nameKey: 'programMuyCaliente', temp: '60º' },
              { number: null, nameKey: 'programCaliente', temp: '40º' },
              { number: null, nameKey: 'programTemplado', temp: '30º' },
              { number: null, nameKey: 'programFrio', temp: '*' },
            ],
            dryers: [
              { nameKey: 'programAltaTemp' },
              { nameKey: 'programMediaTemp' },
              { nameKey: 'programBajaTemp' },
            ],
          },
        },
      },
      LEscala: {
        pueblo: "L'Escala",
        displayName: "L'Escala",
        metadata: {
          hours: '7:00-23:00',
          programs: {
            washers: [
              { number: 1, nameKey: 'programFrio', temp: '*' },
              { number: 2, nameKey: 'programTemplado', temp: '30º' },
              { number: 3, nameKey: 'programCaliente', temp: '40º' },
              { number: 4, nameKey: 'programMuyCaliente', temp: '60º' },
              { number: 5, nameKey: 'programCentrifugado', temp: null },
            ],
            dryers: [
              { nameKey: 'programAltaTemp' },
              { nameKey: 'programMediaTemp' },
              { nameKey: 'programBajaTemp' },
            ],
          },
        },
      },
      NoPrograms: {
        pueblo: 'Test',
        displayName: 'No Programs',
        metadata: { hours: '8:00-22:00' },
      },
    },
  },
} as typeof baseRuntime

function makeAr(location = ''): AgentRuntime {
  const ar: AgentRuntime = {
    state: createInitialState(),
    runtime: runtimeWithPrograms,
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
  ar.state.location = location
  return ar
}

// Simple translate function for tests — returns the key itself so we can assert on key names
const translate = (key: string) => key

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  // ── detectProgramsIntent — 6 languages ───────────────────────────────────
  {
    name: 'F81 detectProgramsIntent: ES "¿qué programas tiene la lavadora?" → true',
    run: () => {
      if (!detectProgramsIntent('¿qué programas tiene la lavadora?'))
        throw new Error('ES program query not detected')
    },
  },
  {
    name: 'F81 detectProgramsIntent: ES "qué temperatura se usa" → true',
    run: () => {
      if (!detectProgramsIntent('qué temperatura se usa'))
        throw new Error('ES temperature query not detected')
    },
  },
  {
    name: 'F81 detectProgramsIntent: IT "quali programmi ha?" → true',
    run: () => {
      if (!detectProgramsIntent('quali programmi ha?'))
        throw new Error('IT program query not detected')
    },
  },
  {
    name: 'F81 detectProgramsIntent: EN "what programs does it have?" → true',
    run: () => {
      if (!detectProgramsIntent('what programs does it have?'))
        throw new Error('EN program query not detected')
    },
  },
  {
    name: 'F81 detectProgramsIntent: CA "quins programes té?" → true',
    run: () => {
      if (!detectProgramsIntent('quins programes té?'))
        throw new Error('CA program query not detected')
    },
  },
  {
    name: 'F81 detectProgramsIntent: PT "que programas tem?" → true',
    run: () => {
      if (!detectProgramsIntent('que programas tem?'))
        throw new Error('PT program query not detected')
    },
  },
  {
    name: 'F81 detectProgramsIntent: FR "quels programmes a la machine?" → true',
    run: () => {
      if (!detectProgramsIntent('quels programmes a la machine?'))
        throw new Error('FR program query not detected')
    },
  },
  {
    name: 'F81 detectProgramsIntent: "mi lavadora no funciona" → false (negative)',
    run: () => {
      if (detectProgramsIntent('mi lavadora no funciona'))
        throw new Error('trouble message incorrectly detected as programs intent')
    },
  },
  {
    name: 'F81 detectProgramsIntent: "" (empty) → false',
    run: () => {
      if (detectProgramsIntent(''))
        throw new Error('empty string incorrectly detected as programs intent')
    },
  },

  // ── formatWasherPrograms ─────────────────────────────────────────────────
  {
    name: 'F81 formatWasherPrograms: Goya (numbered) → "**1** — " format',
    run: () => {
      const result = formatWasherPrograms('Goya', runtimeWithPrograms, translate)
      if (!result) throw new Error('expected non-null result for Goya')
      if (!result.includes('**1**')) throw new Error(`expected "**1**" in result, got: ${result}`)
      if (!result.includes('(60º)')) throw new Error(`expected "(60º)" in result, got: ${result}`)
      if (!result.includes('programMuyCaliente')) throw new Error(`expected nameKey in result, got: ${result}`)
    },
  },
  {
    name: 'F81 formatWasherPrograms: Hortes (no numbers) → "**programName**" format (no number prefix)',
    run: () => {
      const result = formatWasherPrograms('Hortes', runtimeWithPrograms, translate)
      if (!result) throw new Error('expected non-null result for Hortes')
      // Should NOT contain a number prefix like "**1**"
      if (/\*\*\d+\*\*/.test(result)) throw new Error(`Hortes should have no number prefix, got: ${result}`)
      if (!result.includes('**programMuyCaliente**')) throw new Error(`expected bold name without number, got: ${result}`)
    },
  },
  {
    name: 'F81 formatWasherPrograms: LEscala (5 programs, Frío first) → 5 lines, first is Frío',
    run: () => {
      const result = formatWasherPrograms('LEscala', runtimeWithPrograms, translate)
      if (!result) throw new Error('expected non-null result for LEscala')
      const lines = result.split('\n').filter(l => l.startsWith('- '))
      if (lines.length !== 5) throw new Error(`expected 5 program lines, got ${lines.length}: ${result}`)
      if (!lines[0].includes('programFrio')) throw new Error(`first program should be Frío, got: ${lines[0]}`)
      if (!lines[4].includes('programCentrifugado')) throw new Error(`last program should be Centrifugado, got: ${lines[4]}`)
    },
  },
  {
    name: 'F81 formatWasherPrograms: NoPrograms location → null',
    run: () => {
      const result = formatWasherPrograms('NoPrograms', runtimeWithPrograms, translate)
      if (result !== null) throw new Error(`expected null for location without programs, got: ${result}`)
    },
  },

  // ── formatDryerPrograms ──────────────────────────────────────────────────
  {
    name: 'F81 formatDryerPrograms: Goya → 3 dryer programs, no numbers',
    run: () => {
      const result = formatDryerPrograms('Goya', runtimeWithPrograms, translate)
      if (!result) throw new Error('expected non-null result for Goya dryers')
      const lines = result.split('\n').filter(l => l.startsWith('- '))
      if (lines.length !== 3) throw new Error(`expected 3 dryer lines, got ${lines.length}: ${result}`)
      if (/\*\*\d+\*\*/.test(result)) throw new Error(`dryers should have no numbers, got: ${result}`)
      if (!result.includes('programAltaTemp')) throw new Error(`expected programAltaTemp in result, got: ${result}`)
    },
  },
  {
    name: 'F81 formatDryerPrograms: NoPrograms location → null',
    run: () => {
      const result = formatDryerPrograms('NoPrograms', runtimeWithPrograms, translate)
      if (result !== null) throw new Error(`expected null for location without programs, got: ${result}`)
    },
  },

  // ── guardFaqPrograms T1: no location → ask ───────────────────────────────
  {
    name: 'F81 guardFaqPrograms T1: "¿qué programas tiene?" + no location → ask & arm pendingFlow',
    run: () => {
      const ar = makeAr()
      const out = guardFaqPrograms(ar, '¿qué programas tiene?')
      if (!out) throw new Error('expected guard to fire')
      if (out.reason !== 'faq-programs-ask-location') throw new Error(`expected ask-location reason, got "${out.reason}"`)
      if (ar.state.pendingFlow !== 'faq-programs-await-location') {
        throw new Error(`expected pendingFlow=faq-programs-await-location, got "${ar.state.pendingFlow}"`)
      }
    },
  },
  {
    name: 'F81 guardFaqPrograms T1: intent + known location → render immediately',
    run: () => {
      const ar = makeAr('Goya')
      const out = guardFaqPrograms(ar, '¿qué programas tiene?')
      if (!out) throw new Error('expected guard to fire')
      if (out.reason !== 'faq-programs') throw new Error(`expected reason=faq-programs, got "${out.reason}"`)
      if (ar.state.pendingFlow !== '') throw new Error(`pendingFlow must NOT be set on direct answer`)
      if (ar.state.lastResolvedIntent !== 'faq') throw new Error('lastResolvedIntent must be faq')
      if (ar.state.lastFaqKey !== 'programs') throw new Error('lastFaqKey must be programs')
    },
  },
  {
    name: 'F81 guardFaqPrograms T1: no programs intent → null',
    run: () => {
      const ar = makeAr('Goya')
      const out = guardFaqPrograms(ar, 'mi lavadora no funciona')
      if (out !== null) throw new Error(`expected null, got ${JSON.stringify(out)}`)
    },
  },
  {
    name: 'F81 guardFaqPrograms T1: gated when operatorRequested → null',
    run: () => {
      const ar = makeAr('Goya')
      ar.state.operatorRequested = true
      const out = guardFaqPrograms(ar, '¿qué programas tiene?')
      if (out !== null) throw new Error(`expected null when operator pending, got ${JSON.stringify(out)}`)
    },
  },

  // ── guardFaqProgramsAwaitLocation T2 ────────────────────────────────────
  {
    name: 'F81 guardFaqProgramsAwaitLocation T2: pendingFlow armed + location captured → render & clear',
    run: () => {
      const ar = makeAr('Goya')
      ar.state.pendingFlow = 'faq-programs-await-location'
      const out = guardFaqProgramsAwaitLocation(ar, '')
      if (!out) throw new Error('expected guard to fire')
      if (out.reason !== 'faq-programs-resolved') throw new Error(`expected reason=faq-programs-resolved, got "${out.reason}"`)
      if (ar.state.pendingFlow !== '') throw new Error(`pendingFlow must be cleared after T2, got "${ar.state.pendingFlow}"`)
      if (ar.state.lastResolvedIntent !== 'faq') throw new Error('lastResolvedIntent must be faq')
    },
  },
  {
    name: 'F81 guardFaqProgramsAwaitLocation T2: pendingFlow NOT armed → null',
    run: () => {
      const ar = makeAr('Goya')
      ar.state.pendingFlow = ''
      const out = guardFaqProgramsAwaitLocation(ar, '')
      if (out !== null) throw new Error(`expected null when not armed, got ${JSON.stringify(out)}`)
    },
  },
  {
    name: 'F81 guardFaqProgramsAwaitLocation T2: pendingFlow armed but no location yet → null',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'faq-programs-await-location'
      const out = guardFaqProgramsAwaitLocation(ar, '')
      if (out !== null) throw new Error(`expected null when location still missing, got ${JSON.stringify(out)}`)
    },
  },
]

// ── Runner ────────────────────────────────────────────────────────────────────
let passed = 0
let failed = 0
for (const c of cases) {
  try {
    c.run()
    console.log(`  ✅ ${c.name}`)
    passed++
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`  ❌ ${c.name}\n     ${msg}`)
    failed++
  }
}
console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
