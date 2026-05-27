// Standalone unit test (NO LLM) — Caso 35 faq-how-to-use.
//
// F69 (Andrea 2026-05-21): operator (Olga) requested that customers asking
// "how do I use the laundromat" receive the canonical instructions directly,
// without asking for location.
//
// Covers:
//   - detectHowToUseIntent: Cluster A (how to use/how it works), B (steps/
//     what do I do), C (first time/never used) across 6 languages
//   - Negatives: troubleshooting phrases must NOT match
//   - guardFaqHowToUse: state mutations, guard skip conditions
//
// Run with:
//   node --import tsx __tests__/unit/faq-how-to-use.test.ts

import assert from 'node:assert/strict'
import { detectHowToUseIntent } from '../../utils/intent.js'
import {
  guardFaqHowToUse,
  guardFaqHowToUseAwaitLocation,
} from '../../utils/guards/faq-how-to-use.js'
import { createInitialState } from '../../utils/state.js'
import { getCachedTestRuntime, loadTestRuntime } from './_helpers.js'
import type { AgentRuntime } from '../../models/index.js'

await loadTestRuntime()

function makeAr(): AgentRuntime {
  return {
    state: createInitialState(),
    runtime: getCachedTestRuntime(),
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
}

let pass = 0
let fail = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    pass++
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${(e as Error).message}`)
    fail++
  }
}

// ── Cluster A — how to use / how it works ─────────────────────────────────────

console.log('\n── Cluster A: how to use / how it works ──')

test('ES "¿Cómo se usa la lavandería?" → match', () => {
  assert.ok(detectHowToUseIntent('¿Cómo se usa la lavandería?'))
})
test('ES "¿Cómo funciona la lavadora?" → match', () => {
  assert.ok(detectHowToUseIntent('¿Cómo funciona la lavadora?'))
})
test('ES "¿Cómo se lava la ropa aquí?" → match', () => {
  assert.ok(detectHowToUseIntent('¿Cómo se lava la ropa aquí?'))
})
test('IT "come si usa la lavatrice?" → match', () => {
  assert.ok(detectHowToUseIntent('come si usa la lavatrice?'))
})
test('IT "come funziona la lavanderia?" → match', () => {
  assert.ok(detectHowToUseIntent('come funziona la lavanderia?'))
})
test('EN "how do I use the washing machine?" → match', () => {
  assert.ok(detectHowToUseIntent('how do I use the washing machine?'))
})
test('EN "how does it work?" → match', () => {
  assert.ok(detectHowToUseIntent('how does it work?'))
})
test('EN "how to wash my clothes?" → match', () => {
  assert.ok(detectHowToUseIntent('how to wash my clothes?'))
})
test('PT "como se usa a lavanderia?" → match', () => {
  assert.ok(detectHowToUseIntent('como se usa a lavanderia?'))
})
test('CA "com s\'usa la rentadora?" → match', () => {
  assert.ok(detectHowToUseIntent("com s'usa la rentadora?"))
})
test('FR "comment utiliser la machine?" → match', () => {
  assert.ok(detectHowToUseIntent('comment utiliser la machine?'))
})
test('FR "comment ça marche?" → match', () => {
  assert.ok(detectHowToUseIntent('comment ça marche?'))
})

// ── Cluster B — what do I do / steps / instructions ───────────────────────────

console.log('\n── Cluster B: steps / what do I do ──')

test('ES "¿qué hago para lavar?" → match', () => {
  assert.ok(detectHowToUseIntent('¿qué hago para lavar?'))
})
test('ES "¿qué pasos tengo que seguir?" → match', () => {
  assert.ok(detectHowToUseIntent('¿qué pasos tengo que seguir?'))
})
test('ES "instrucciones para lavar la ropa" → match', () => {
  assert.ok(detectHowToUseIntent('instrucciones para lavar la ropa'))
})
test('IT "cosa devo fare?" → match', () => {
  assert.ok(detectHowToUseIntent('cosa devo fare?'))
})
test('IT "quali passi devo seguire?" → match', () => {
  assert.ok(detectHowToUseIntent('quali passi devo seguire?'))
})
test('IT "istruzioni per lavare" → match', () => {
  assert.ok(detectHowToUseIntent('istruzioni per lavare'))
})
test('EN "what do I do?" → match', () => {
  assert.ok(detectHowToUseIntent('what do I do?'))
})
test('EN "what are the steps to use the machine?" → match', () => {
  assert.ok(detectHowToUseIntent('what are the steps to use the machine?'))
})
test('EN "instructions for washing" → match', () => {
  assert.ok(detectHowToUseIntent('instructions for washing'))
})
test('PT "o que faço?" → match', () => {
  assert.ok(detectHowToUseIntent('o que faço?'))
})
test('CA "quins passos he de seguir?" → match', () => {
  assert.ok(detectHowToUseIntent('quins passos he de seguir?'))
})
test('FR "que dois-je faire?" → match', () => {
  assert.ok(detectHowToUseIntent('que dois-je faire?'))
})
test('FR "mode d\'emploi" → match', () => {
  assert.ok(detectHowToUseIntent("mode d'emploi"))
})

// ── Cluster C — first time / never used ───────────────────────────────────────

console.log('\n── Cluster C: first time / never used ──')

test('ES "es mi primera vez aquí" → match', () => {
  assert.ok(detectHowToUseIntent('es mi primera vez aquí'))
})
test('ES "nunca he usado una lavandería" → match', () => {
  assert.ok(detectHowToUseIntent('nunca he usado una lavandería'))
})
test('ES "no sé cómo usar la lavadora" → match', () => {
  assert.ok(detectHowToUseIntent('no sé cómo usar la lavadora'))
})
test('IT "è la prima volta che vengo" → match', () => {
  assert.ok(detectHowToUseIntent('è la prima volta che vengo'))
})
test('IT "non ho mai usato una lavanderia" → match', () => {
  assert.ok(detectHowToUseIntent('non ho mai usato una lavanderia'))
})
test('EN "first time using a laundromat" → match', () => {
  assert.ok(detectHowToUseIntent('first time using a laundromat'))
})
test('EN "never used one before" → match', () => {
  assert.ok(detectHowToUseIntent("never used one before"))
})
test('PT "é a primeira vez que venho" → match', () => {
  assert.ok(detectHowToUseIntent('é a primeira vez que venho'))
})
test('CA "és la primera vegada que vinc" → match', () => {
  assert.ok(detectHowToUseIntent('és la primera vegada que vinc'))
})
test('FR "première fois ici" → match', () => {
  assert.ok(detectHowToUseIntent('première fois ici'))
})
test('FR "je ne sais pas comment utiliser" → match', () => {
  assert.ok(detectHowToUseIntent('je ne sais pas comment utiliser'))
})

// ── Negatives ─────────────────────────────────────────────────────────────────

console.log('\n── Negatives ──')

test('Unrelated "la lavadora no funciona" → no match', () => {
  assert.ok(!detectHowToUseIntent('la lavadora no funciona'))
})
test('Unrelated "¿cuánto cuesta?" → no match', () => {
  assert.ok(!detectHowToUseIntent('¿cuánto cuesta?'))
})
test('Unrelated "hola" → no match', () => {
  assert.ok(!detectHowToUseIntent('hola'))
})
test('Unrelated "sale PUSH PROG" → no match', () => {
  assert.ok(!detectHowToUseIntent('sale PUSH PROG'))
})
test('Unrelated "quiero la factura" → no match', () => {
  assert.ok(!detectHowToUseIntent('quiero la factura'))
})
test('Empty string → no match', () => {
  assert.ok(!detectHowToUseIntent(''))
})

// ── Guard behaviour ────────────────────────────────────────────────────────────

console.log('\n── Guard behaviour ──')

// F95 — without location, guard asks for location first (instructions vary
// per laundry; see CSV docs/csv/instruccions-us.csv).
test('T1 without location → asks for location + arms pendingFlow', () => {
  const ar = makeAr()
  const out = guardFaqHowToUse(ar, '¿Cómo se usa la lavandería?')
  assert.ok(out !== null, 'guard must fire')
  assert.equal(out!.reason, 'faq-how-to-use-ask-location')
  assert.ok(out!.reply.length > 0, 'reply must be non-empty')
  assert.equal(ar.state.pendingFlow, 'faq-how-to-use-await-location')
})

// F95 — once location is known, render per-location override.
test('T1 with known location → renders per-location howToUse override (Goya)', () => {
  const ar = makeAr()
  ar.state.location = 'Goya'
  const out = guardFaqHowToUse(ar, '¿Cómo se usa la lavandería?')
  assert.ok(out !== null, 'guard must fire')
  assert.equal(out!.reason, 'faq-how-to-use')
  assert.match(out!.reply, /Goya/i, 'reply must mention the location (override)')
  assert.match(out!.reply, /confirma el inicio/i, 'Goya is in the "confirm start" group')
  assert.equal(ar.state.lastResolvedIntent, 'faq')
  assert.equal(ar.state.lastFaqKey, 'howToUse')
})

// F95 — the two groups in the CSV have different step counts.
test('T1 with L\'Escala → renders no-confirm-start override (5 steps)', () => {
  const ar = makeAr()
  ar.state.location = "L'Escala"
  const out = guardFaqHowToUse(ar, '¿Cómo se usa la lavandería?')
  assert.ok(out !== null)
  assert.match(out!.reply, /L'Escala/i)
  assert.ok(
    !/confirma el inicio/i.test(out!.reply),
    "L'Escala laundromats start automatically — no 'confirm start' step",
  )
})

// F95 — T2: location supplied on follow-up turn.
test('T2 with pendingFlow + location captured → renders override', () => {
  const ar = makeAr()
  ar.state.pendingFlow = 'faq-how-to-use-await-location'
  ar.state.location = 'Pineda'
  const out = guardFaqHowToUseAwaitLocation(ar, 'Pineda')
  assert.ok(out !== null, 'await-location guard must fire')
  assert.equal(out!.reason, 'faq-how-to-use')
  assert.match(out!.reply, /Pineda/i)
  assert.equal(ar.state.pendingFlow, '', 'pendingFlow must clear after render')
})

// F95 — T2 guard skips when pendingFlow is not the await-location marker.
test('T2 skips when no pendingFlow marker', () => {
  const ar = makeAr()
  ar.state.location = 'Goya'
  assert.equal(guardFaqHowToUseAwaitLocation(ar, 'Goya'), null)
})

// F95 — T2 guard skips when location still empty.
test('T2 skips when pendingFlow set but location still empty', () => {
  const ar = makeAr()
  ar.state.pendingFlow = 'faq-how-to-use-await-location'
  assert.equal(guardFaqHowToUseAwaitLocation(ar, 'no sé'), null)
})

test('Guard skips when operatorRequested', () => {
  const ar = makeAr()
  ar.state.operatorRequested = true
  assert.equal(guardFaqHowToUse(ar, '¿Cómo se usa?'), null)
})
test('Guard skips when customerNameRequested', () => {
  const ar = makeAr()
  ar.state.customerNameRequested = true
  assert.equal(guardFaqHowToUse(ar, '¿Cómo se usa?'), null)
})
test('Guard skips on unrelated input', () => {
  const ar = makeAr()
  assert.equal(guardFaqHowToUse(ar, 'la lavadora no funciona'), null)
})
test('Per-location reply contains step markers (numbered list)', () => {
  const ar = makeAr()
  ar.state.location = 'Hortes'
  const out = guardFaqHowToUse(ar, 'instrucciones para lavar la ropa')
  assert.ok(out !== null)
  assert.ok(/1\.|2\.|3\./.test(out!.reply), 'reply must contain numbered steps')
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
