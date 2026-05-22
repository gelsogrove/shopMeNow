// Deterministic replay of the exact chat Andrea reported on 2026-05-23.
//
// Original buggy transcript:
//   USER: come funziona?
//   BOT:  [hardcoded global 4-step howToUse, ignoring location]
//   USER: ok ma quanto costa
//   BOT:  ¡Genial! 👍 Si hay algo más en lo que pueda ayudarte…
//
// Expected fixed transcript:
//   USER: come funziona?
//   BOT:  ¿En qué pueblo o lavandería estás? Las instrucciones varían según el local.
//   USER: Goya
//   BOT:  En **Goya (Mataró)**, … (per-location 5-step instructions including "confirma el inicio")
//   USER: ok ma quanto costa
//   BOT:  [pricing flow — closure must NOT swallow this]
//
// This file simulates only the guard pipeline (no LLM), running the exact
// guards that would fire for each turn.

import assert from 'node:assert/strict'
import { guardFaqHowToUse, guardFaqHowToUseAwaitLocation } from '../../utils/guards/faq-how-to-use.js'
import { guardFaqClosure } from '../../utils/guards/faq-closure.js'
import { guardFaqPrices } from '../../utils/guards/faq-prices.js'
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

console.log('\n── Replay: bug 2026-05-23 chat sequence ──')

const ar = makeAr()

test('TURN 1 — "come funziona?" → asks location (NOT global hardcoded answer)', () => {
  const out = guardFaqHowToUse(ar, 'come funziona?')
  assert.ok(out !== null, 'guard must fire')
  assert.equal(out!.reason, 'faq-how-to-use-ask-location')
  assert.match(out!.reply, /pueblo|lavander/i)
  assert.equal(ar.state.pendingFlow, 'faq-how-to-use-await-location')
  console.log(`     BOT → ${out!.reply}`)
})

test('TURN 2 — user replies "Goya", state.location set → render Goya override', () => {
  // Simulate what auto-extract / location-resolution would do.
  ar.state.location = 'Goya'
  const out = guardFaqHowToUseAwaitLocation(ar, 'Goya')
  assert.ok(out !== null, 'await-location guard must fire')
  assert.equal(out!.reason, 'faq-how-to-use')
  assert.match(out!.reply, /Goya/i, 'reply must mention Goya')
  assert.match(out!.reply, /confirma el inicio/i, 'Goya is in the "confirm start" group')
  assert.equal(ar.state.pendingFlow, '')
  assert.equal(ar.state.lastResolvedIntent, 'faq')
  assert.equal(ar.state.lastFaqKey, 'howToUse')
  console.log(`     BOT → ${out!.reply.split('\n')[0]}…`)
})

test('TURN 3 — "ok ma quanto costa" → closure does NOT fire (the original bug)', () => {
  const out = guardFaqClosure(ar, 'ok ma quanto costa')
  assert.equal(out, null, 'closure must NOT swallow "ok ma quanto costa"')
  console.log('     guardFaqClosure correctly returned null (falls through)')
})

test('TURN 3 — "ok ma quanto costa" → guardFaqPrices fires next (asks location, location set → render)', () => {
  // Location is already set from TURN 2, so guardFaqPrices renders directly.
  const out = guardFaqPrices(ar, 'ok ma quanto costa')
  assert.ok(out !== null, 'price guard must fire')
  assert.match(out!.reply, /€|euro|price|prezzo|precio/i, 'reply must contain a price')
  console.log(`     BOT → ${out!.reply.split('\n')[0]}…`)
})

console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
