// F79 — Landmark-based location resolution (utils/locations-landmarks.ts).
//
// SCENARIO:
//   Customers identify the laundromat by a nearby reference point
//   ("Mercadona", "Carrefour", "Aldi") instead of typing a pueblo name.
//   The resolver reads landmark data from json/locations.json:metadata.landmarks
//   (single source of truth) and returns canonical location keys.
//
// TEST DESIGN:
//   Tests are PARAMETRIC over the runtime data — they compute landmark
//   uniqueness at test time instead of hardcoding "Mercadona maps to Goya".
//   This makes the suite robust to data evolution: if OLGA adds "Mercadona"
//   to a second pueblo tomorrow, the unique-landmark test naturally re-targets
//   itself or skips. Hardcoded asserts (e.g. for Mercadona's current
//   uniqueness) are placed in a separate F79 sentinel block so a future
//   data change makes the bug surface immediately as a failing assertion
//   instead of a false-positive green.
//
// Run with:
//   node --import tsx __tests__/unit/locations-landmarks.test.ts

import {
  findLandmarksInMessage,
  listAllLandmarks,
  resolveLocationByLandmarks,
} from '../../utils/locations-landmarks.js'
import { loadTestRuntime } from './_helpers.js'

const runtime = await loadTestRuntime()
const locations = runtime.locations

// Helper: find any landmark used by exactly N locations (parametric test data).
function findLandmarkUsedBy(n: number): { landmark: string; canonical: string[] } | null {
  const all = listAllLandmarks(locations)
  for (const landmark of all) {
    const owners: string[] = []
    for (const [canonical, override] of Object.entries(locations.locations)) {
      const lms = (override.metadata?.landmarks as string[] | undefined) || []
      if (lms.some((l) => l.toLowerCase() === landmark.toLowerCase())) {
        owners.push(canonical)
      }
    }
    if (owners.length === n) return { landmark, canonical: owners }
  }
  return null
}

const cases: Array<{ name: string; run: () => void }> = [
  // ── listAllLandmarks ────────────────────────────────────────────────────
  {
    name: 'listAllLandmarks: returns non-empty list when CSV data is loaded',
    run: () => {
      const all = listAllLandmarks(locations)
      if (all.length === 0) {
        throw new Error('expected non-empty landmark list (locals.csv data missing?)')
      }
    },
  },
  {
    name: 'listAllLandmarks: dedupes landmarks shared across locations',
    run: () => {
      const all = listAllLandmarks(locations)
      const lowered = all.map((l) => l.toLowerCase())
      const uniq = new Set(lowered)
      if (lowered.length !== uniq.size) {
        throw new Error(`expected deduped list, got duplicates: ${all.join(', ')}`)
      }
    },
  },
  {
    name: 'listAllLandmarks: returns alphabetically sorted output',
    run: () => {
      const all = listAllLandmarks(locations)
      const sorted = [...all].sort((a, b) => a.localeCompare(b))
      if (JSON.stringify(all) !== JSON.stringify(sorted)) {
        throw new Error(`expected sorted, got ${all.join(', ')}`)
      }
    },
  },

  // ── findLandmarksInMessage ──────────────────────────────────────────────
  {
    name: 'findLandmarksInMessage: empty message returns empty array',
    run: () => {
      const r = findLandmarksInMessage('', locations)
      if (r.length !== 0) throw new Error(`expected [], got ${r.join(',')}`)
    },
  },
  {
    name: 'findLandmarksInMessage: case-insensitive single-word match',
    run: () => {
      const unique = findLandmarkUsedBy(1)
      if (!unique) return // skip if no unique landmark in data
      const lower = unique.landmark.toLowerCase()
      const r = findLandmarksInMessage(`estoy cerca del ${lower}`, locations)
      if (!r.some((l) => l.toLowerCase() === lower)) {
        throw new Error(`expected to find "${unique.landmark}", got [${r.join(',')}]`)
      }
    },
  },
  {
    name: 'findLandmarksInMessage: accent-insensitive match (uppercase + accent stripped)',
    run: () => {
      // "Plaça de les Hortes" → normalise both sides → match.
      // Customer who reads the Catalan sign types it back as-is, possibly
      // ALL CAPS or with lost cedilla — all of these must still match.
      const variants = [
        'estoy en la PLAÇA DE LES HORTES',
        'soy a placa de les hortes',
        'plaça de les hortes ahora',
      ]
      for (const msg of variants) {
        const r = findLandmarksInMessage(msg, locations)
        const found = r.find((l) => /pla[çc]a de les hortes/i.test(l))
        if (!found) {
          throw new Error(
            `expected "Plaça de les Hortes" to match in "${msg}", got [${r.join(',')}]`,
          )
        }
      }
    },
  },
  {
    name: 'findLandmarksInMessage: multi-word landmark needs full phrase (substring)',
    run: () => {
      // "Plaça de les Hortes" should NOT fire on bare "plaza"
      const r = findLandmarksInMessage('estoy en la plaza mayor', locations)
      if (r.some((l) => /hortes/i.test(l))) {
        throw new Error(`bare "plaza" must not match "Plaça de les Hortes": got [${r.join(',')}]`)
      }
    },
  },
  {
    name: 'findLandmarksInMessage: single-word landmark needs word boundary (no false positive in substring)',
    run: () => {
      // "Aldi" must NOT match inside "Aldine" or "Maldive"
      const r = findLandmarksInMessage('vou a aldine para comprar', locations)
      if (r.some((l) => l.toLowerCase() === 'aldi')) {
        throw new Error(`bare substring "aldi" inside "aldine" must not match (got Aldi): [${r.join(',')}]`)
      }
    },
  },
  {
    name: 'findLandmarksInMessage: no landmark in message returns empty',
    run: () => {
      const r = findLandmarksInMessage('no funciona la lavadora', locations)
      if (r.length !== 0) {
        throw new Error(`expected [], got [${r.join(',')}]`)
      }
    },
  },

  // ── resolveLocationByLandmarks ──────────────────────────────────────────
  {
    name: 'resolveLocationByLandmarks: no landmark → canonical null + empty candidates',
    run: () => {
      const r = resolveLocationByLandmarks('lavadora 3 no arranca', locations)
      if (r.canonical !== null || r.candidates.length !== 0 || r.hits.length !== 0) {
        throw new Error(`expected empty resolution, got ${JSON.stringify(r)}`)
      }
    },
  },
  {
    name: 'resolveLocationByLandmarks: unique landmark → canonical set',
    run: () => {
      const unique = findLandmarkUsedBy(1)
      if (!unique) return
      const r = resolveLocationByLandmarks(`vicino al ${unique.landmark}`, locations)
      if (r.canonical !== unique.canonical[0]) {
        throw new Error(
          `expected canonical=${unique.canonical[0]}, got ${r.canonical} (${JSON.stringify(r)})`,
        )
      }
    },
  },
  {
    name: 'resolveLocationByLandmarks: ambiguous landmark → canonical null + multiple candidates',
    run: () => {
      const ambiguous = findLandmarkUsedBy(2) || findLandmarkUsedBy(3)
      if (!ambiguous) return // skip if no ambiguous landmark in current data
      const r = resolveLocationByLandmarks(`estoy en ${ambiguous.landmark}`, locations)
      if (r.canonical !== null) {
        throw new Error(`expected null canonical (ambiguous), got ${r.canonical}`)
      }
      if (r.candidates.length < 2) {
        throw new Error(
          `expected ≥2 candidates, got ${r.candidates.length}: [${r.candidates.join(',')}]`,
        )
      }
    },
  },
  {
    name: 'resolveLocationByLandmarks: hits preserve canonical landmark spelling',
    run: () => {
      const unique = findLandmarkUsedBy(1)
      if (!unique) return
      // Customer types lowercase, hits should preserve the canonical-cased JSON value.
      const r = resolveLocationByLandmarks(
        `cerca del ${unique.landmark.toLowerCase()}`,
        locations,
      )
      if (!r.hits.includes(unique.landmark)) {
        throw new Error(
          `expected hits to include canonical "${unique.landmark}", got [${r.hits.join(',')}]`,
        )
      }
    },
  },
  {
    name: 'resolveLocationByLandmarks: empty locations.locations returns empty resolution',
    run: () => {
      const r = resolveLocationByLandmarks('Mercadona', { locations: {} })
      if (r.canonical !== null || r.candidates.length !== 0) {
        throw new Error(`empty runtime should return empty resolution, got ${JSON.stringify(r)}`)
      }
    },
  },

  // ── F79 data sentinels: detect a future data change that would mute the
  //    resolver. These are the only HARDCODED assertions; they pin the
  //    current CSV state. If a value below changes, audit the CSV diff to
  //    decide whether the test or the data must adapt.
  {
    name: 'F79 sentinel — Mercadona is unique to Goya',
    run: () => {
      const r = resolveLocationByLandmarks('estoy cerca del Mercadona', locations)
      if (r.canonical !== 'Goya') {
        throw new Error(
          `Mercadona should resolve to Goya (current CSV state). If OLGA added Mercadona to another pueblo, update locals.csv tests. got: ${r.canonical}`,
        )
      }
    },
  },
  {
    name: 'F79 sentinel — Carrefour is ambiguous (Pineda + L\'Escala + PlatjaDAro)',
    run: () => {
      const r = resolveLocationByLandmarks('vicino al Carrefour', locations)
      if (r.canonical !== null) {
        throw new Error(`Carrefour should be ambiguous, got canonical=${r.canonical}`)
      }
      const expected = ['Pineda', "L'Escala", 'PlatjaDAro']
      for (const exp of expected) {
        if (!r.candidates.includes(exp)) {
          throw new Error(
            `Carrefour candidates missing ${exp}: got [${r.candidates.join(',')}]`,
          )
        }
      }
    },
  },

  // ── F79 landmark ack — extractor sets locationAckPending on unique match ──
  // These pins exercise the wiring between resolveLocationByLandmarks and the
  // L5 ack prepend (consumed by agent.ts:applyGuardOutcome). Detailed L5 reply
  // composition lives in agent.ts; here we pin the extractor responsibility:
  // (a) unique landmark → state.location + state.locationAckPending both set,
  // (b) ambiguous landmark → neither field touched,
  // (c) canonical name typed directly → state.location set BUT ackPending stays
  //     null (no surprising deduction to acknowledge).
  {
    name: 'F79 ack — agent-extract: unique landmark sets location AND locationAckPending',
    run: async () => {
      const { autoExtractFacts } = await import('../../utils/agent-extract.js')
      const { createInitialState } = await import('../../utils/state.js')
      const ar = {
        state: createInitialState(),
        runtime,
        pendingEscalation: null,
        resolved: false,
        photoRequested: false,
      }
      autoExtractFacts(ar as Parameters<typeof autoExtractFacts>[0], 'estoy cerca del Mercadona')
      if (ar.state.location !== 'Goya') {
        throw new Error(`expected location='Goya', got '${ar.state.location}'`)
      }
      if (ar.state.locationAckPending !== 'Goya') {
        throw new Error(`expected locationAckPending='Goya', got '${ar.state.locationAckPending}'`)
      }
    },
  },
  {
    name: 'F79 ack — agent-extract: ambiguous landmark leaves locationAckPending null',
    run: async () => {
      const { autoExtractFacts } = await import('../../utils/agent-extract.js')
      const { createInitialState } = await import('../../utils/state.js')
      const ar = {
        state: createInitialState(),
        runtime,
        pendingEscalation: null,
        resolved: false,
        photoRequested: false,
      }
      autoExtractFacts(ar as Parameters<typeof autoExtractFacts>[0], 'vicino al Carrefour')
      if (ar.state.location !== '') {
        throw new Error(`expected location empty (ambiguous), got '${ar.state.location}'`)
      }
      if (ar.state.locationAckPending !== null) {
        throw new Error(
          `ambiguous match must NOT set ackPending, got '${ar.state.locationAckPending}'`,
        )
      }
    },
  },
  {
    name: 'F79 ack — agent-extract: canonical name typed directly does NOT trigger ack',
    run: async () => {
      const { autoExtractFacts } = await import('../../utils/agent-extract.js')
      const { createInitialState } = await import('../../utils/state.js')
      const ar = {
        state: createInitialState(),
        runtime,
        pendingEscalation: null,
        resolved: false,
        photoRequested: false,
      }
      // Customer types the canonical name → resolveKnownLocation captures it
      // upstream of the landmark resolver; ackPending must stay null because
      // there's nothing surprising to confirm.
      autoExtractFacts(ar as Parameters<typeof autoExtractFacts>[0], 'Goya')
      if (ar.state.location !== 'Goya') {
        throw new Error(`expected location='Goya', got '${ar.state.location}'`)
      }
      if (ar.state.locationAckPending !== null) {
        throw new Error(
          `canonical name must NOT set ackPending (would be verbose), got '${ar.state.locationAckPending}'`,
        )
      }
    },
  },
]

let passed = 0
let failed = 0
for (const c of cases) {
  try {
    // run() may be sync or async (F79 ack pins use async imports for agent-extract).
    await c.run()
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
