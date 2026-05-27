// Standalone unit test (NO LLM) — Caso 34 FAQ detergente/jabón.
//
// WHAT: detectDetergentFaqIntent (L3 detector) + guardFaqDetergents (L4 guard).
//
// WHY (F67, Andrea 2026-05-21): customer "No veo jabón" was classified as
// trouble-machine → bot asked for display. Root cause: router had no examples.
// Fix: detector covers all 6 languages for two semantic clusters:
//   A) visible absence report: "no veo jabón / non vedo il sapone / no soap"
//   B) generic enquiry: "¿hay jabón? / is there detergent? / c'è il sapone?"
//   C) bare mention in question form: "jabón?" / "soap?"
//   Exclusion: post-cycle foam ("poca espuma después del lavado") → false
//
// Run with:
//   node --import tsx __tests__/unit/faq-detergents.test.ts

import assert from 'node:assert/strict'
import { detectDetergentFaqIntent } from '../../utils/intent.js'
import { guardFaqDetergents } from '../../utils/guards/faq-detergents.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'
import { getCachedTestRuntime, loadTestRuntime } from './_helpers.js'

await loadTestRuntime()

const runtime = getCachedTestRuntime()

function makeRuntime(overrides: Partial<AgentRuntime> = {}): AgentRuntime {
  return { ...runtime, state: createInitialState(), ...overrides } as AgentRuntime
}

function makeAr(stateOverrides: Partial<ReturnType<typeof createInitialState>> = {}): AgentRuntime {
  const ar = makeRuntime()
  Object.assign(ar.state, stateOverrides)
  return ar
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

// ── detectDetergentFaqIntent — Cluster A (absence report) ────────────────────

console.log('\n── Cluster A: absence report ──')

test('ES real-bug: "No veo jabón" → true', () => {
  assert.equal(detectDetergentFaqIntent('No veo jabón'), true)
})
test('ES "no hay detergente" → true', () => {
  assert.equal(detectDetergentFaqIntent('no hay detergente'), true)
})
test('ES "no encuentro el suavizante" → true', () => {
  assert.equal(detectDetergentFaqIntent('no encuentro el suavizante'), true)
})
test('IT "non vedo il sapone" → true', () => {
  assert.equal(detectDetergentFaqIntent('non vedo il sapone'), true)
})
test('IT "non c\'è il detersivo" → true', () => {
  assert.equal(detectDetergentFaqIntent("non c'è il detersivo"), true)
})
test('EN "no soap" → true', () => {
  assert.equal(detectDetergentFaqIntent('no soap'), true)
})
test('EN "can\'t see detergent" → true', () => {
  assert.equal(detectDetergentFaqIntent("can't see detergent"), true)
})
test('PT "não vejo sabão" → true', () => {
  assert.equal(detectDetergentFaqIntent('não vejo sabão'), true)
})
test('CA "no veig sabó" → true', () => {
  assert.equal(detectDetergentFaqIntent('no veig sabó'), true)
})
test('FR "pas de savon" → true', () => {
  assert.equal(detectDetergentFaqIntent('pas de savon'), true)
})

// ── detectDetergentFaqIntent — Cluster B (generic enquiry) ───────────────────

console.log('\n── Cluster B: generic enquiry ──')

test('ES "¿hay jabón en las máquinas?" → true', () => {
  assert.equal(detectDetergentFaqIntent('¿hay jabón en las máquinas?'), true)
})
test('ES "¿traigo detergente?" → true', () => {
  assert.equal(detectDetergentFaqIntent('¿traigo detergente?'), true)
})
test('ES "el jabón viene incluido" → true', () => {
  assert.equal(detectDetergentFaqIntent('el jabón viene incluido'), true)
})
test('IT "c\'è il sapone?" → true', () => {
  assert.equal(detectDetergentFaqIntent("c'è il sapone?"), true)
})
test('IT "devo portare il detersivo?" → true', () => {
  assert.equal(detectDetergentFaqIntent('devo portare il detersivo?'), true)
})
test('EN "is there soap?" → true', () => {
  assert.equal(detectDetergentFaqIntent('is there soap?'), true)
})
test('EN "do I need to bring detergent?" → true', () => {
  assert.equal(detectDetergentFaqIntent('do I need to bring detergent?'), true)
})
test('PT "tem sabão?" → true', () => {
  assert.equal(detectDetergentFaqIntent('tem sabão?'), true)
})
test('CA "hi ha sabó?" → true', () => {
  assert.equal(detectDetergentFaqIntent('hi ha sabó?'), true)
})
test('FR "y a-t-il du savon?" → true', () => {
  assert.equal(detectDetergentFaqIntent('y a-t-il du savon?'), true)
})

// ── detectDetergentFaqIntent — Cluster C (bare mention) ──────────────────────

console.log('\n── Cluster C: bare mention ──')

test('ES bare "jabón?" → true', () => {
  assert.equal(detectDetergentFaqIntent('jabón?'), true)
})
test('ES bare "¿jabón?" → true', () => {
  assert.equal(detectDetergentFaqIntent('¿jabón?'), true)
})
test('IT bare "sapone?" → true', () => {
  assert.equal(detectDetergentFaqIntent('sapone?'), true)
})
test('EN bare "soap?" → true', () => {
  assert.equal(detectDetergentFaqIntent('soap?'), true)
})

// ── detectDetergentFaqIntent — post-cycle foam EXCLUDED ──────────────────────

console.log('\n── Exclusion: post-cycle foam belongs to flow-engine ──')

test('ES "poca espuma después del lavado" → false (post-cycle, flow-engine handles)', () => {
  assert.equal(detectDetergentFaqIntent('hay poca espuma después del lavado'), false)
})
test('IT "non c\'è schiuma dopo il lavaggio" → false', () => {
  assert.equal(detectDetergentFaqIntent("non c'è schiuma dopo il lavaggio"), false)
})
test('EN "no foam after the wash" → false', () => {
  assert.equal(detectDetergentFaqIntent('no foam after the wash'), false)
})

// ── detectDetergentFaqIntent — negatives ─────────────────────────────────────

console.log('\n── Negatives ──')

test('Unrelated: "la lavadora no funciona" → false', () => {
  assert.equal(detectDetergentFaqIntent('la lavadora no funciona'), false)
})
test('Unrelated: "¿cuánto cuesta?" → false', () => {
  assert.equal(detectDetergentFaqIntent('¿cuánto cuesta?'), false)
})
test('Unrelated: "hola" → false', () => {
  assert.equal(detectDetergentFaqIntent('hola'), false)
})
test('Empty string → false', () => {
  assert.equal(detectDetergentFaqIntent(''), false)
})

// ── guardFaqDetergents — guard behaviour ─────────────────────────────────────

console.log('\n── guardFaqDetergents: guard behaviour ──')

test('T1 cold start: fires on "No veo jabón", sets lastResolvedIntent=faq', () => {
  const ar = makeAr()
  const out = guardFaqDetergents(ar, 'No veo jabón')
  assert.ok(out, 'guard should fire')
  assert.equal(out!.reason, 'faq-detergents')
  assert.ok(out!.reply.length > 0, 'reply must be non-empty')
  assert.equal(ar.state.lastResolvedIntent, 'faq')
})

test('mid-flow pivot: fires even when location+machineType are set (DOOR flow active type)', () => {
  const ar = makeAr({ location: 'Goya', machineType: 'washer', machineNumber: '5', displayState: 'DOOR' })
  const out = guardFaqDetergents(ar, '¿hay jabón?')
  assert.ok(out, 'guard must fire mid-flow')
  assert.equal(out!.reason, 'faq-detergents')
})

test('gated when operatorRequested → null', () => {
  const ar = makeAr({ operatorRequested: true })
  assert.equal(guardFaqDetergents(ar, '¿hay jabón?'), null)
})

test('gated when customerNameRequested → null', () => {
  const ar = makeAr({ customerNameRequested: true })
  assert.equal(guardFaqDetergents(ar, 'no veo jabón'), null)
})

test('does not fire on unrelated message → null', () => {
  const ar = makeAr()
  assert.equal(guardFaqDetergents(ar, 'la puerta no cierra'), null)
})

test('reply contains "automáticamente" (key content from detergents FAQ)', () => {
  const ar = makeAr()
  const out = guardFaqDetergents(ar, 'no veo el jabón')
  assert.ok(out?.reply.includes('automáticamente') || out?.reply.includes('automatically') || out?.reply.includes('automaticamente'),
    `FAQ reply should mention automatic dispensing, got: ${out?.reply}`)
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
