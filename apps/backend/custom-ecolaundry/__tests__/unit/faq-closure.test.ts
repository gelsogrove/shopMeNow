// Unit test — guardFaqClosure regex semantics (F95).
//
// Reason for test: the original closure regex matched any message STARTING
// with an acknowledgement token ("ok", "vale", "gracias", …). That caused
// "ok ma quanto costa" (and any "<ack> + real follow-up question") to be
// swallowed by the closure ("¡Genial! 👍 Si hay algo más…") instead of
// routing to the pricing FAQ — see Andrea's chat 2026-05-23.
//
// F95 narrows the regex to messages that are ONLY an acknowledgement,
// optionally followed by a short polite tail ("ok gracias", "thanks merci").
// Anything else falls through so downstream FAQ guards can pick the real
// intent up.
//
// Run with:
//   node --import tsx __tests__/unit/faq-closure.test.ts

import assert from 'node:assert/strict'
import { guardFaqClosure } from '../../utils/guards/faq-closure.js'
import { createInitialState } from '../../utils/state.js'
import { getCachedTestRuntime, loadTestRuntime } from './_helpers.js'
import type { AgentRuntime } from '../../models/index.js'

await loadTestRuntime()

function makeArAfterFaq(): AgentRuntime {
  const state = createInitialState()
  state.lastResolvedIntent = 'faq'
  return {
    state,
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

// ── Closure SHOULD fire on bare acknowledgements ──────────────────────────────

console.log('\n── Bare acknowledgements (closure fires) ──')

for (const msg of [
  'ok',
  'vale',
  'gracias',
  'perfecto',
  'perfetto',
  'thanks',
  'grazie',
  'entendido',
  'capito',
  'd\'accordo',
  'ok gracias',
  'thanks merci',
]) {
  test(`"${msg}" → closure fires`, () => {
    const ar = makeArAfterFaq()
    const out = guardFaqClosure(ar, msg)
    assert.ok(out !== null, 'closure must fire on bare ack')
    assert.equal(out!.reason, 'faq-closure')
    assert.equal(ar.state.lastResolvedIntent, null, 'closure must clear lastResolvedIntent')
  })
}

// ── Closure must NOT fire when ack is followed by a real follow-up ────────────

console.log('\n── Ack + follow-up question (closure does NOT fire) ──')

for (const msg of [
  'ok ma quanto costa',          // the bug Andrea reported
  'ok y cuanto cuesta',
  'vale pero cuanto cuesta',
  'gracias y los horarios?',
  'perfecto, dimmi i prezzi',
  'thanks but how much',
  'ok la lavadora no funciona',
  'vale, tengo otra duda',
]) {
  test(`"${msg}" → closure does NOT fire (must fall through to FAQ router)`, () => {
    const ar = makeArAfterFaq()
    const out = guardFaqClosure(ar, msg)
    assert.equal(out, null, 'closure must NOT swallow a follow-up question')
    assert.equal(ar.state.lastResolvedIntent, 'faq', 'state must be untouched')
  })
}

// ── Closure must NOT fire outside FAQ context ─────────────────────────────────

console.log('\n── Outside FAQ context (closure skips) ──')

test('closure skips when lastResolvedIntent is null', () => {
  const state = createInitialState()
  const ar: AgentRuntime = {
    state,
    runtime: getCachedTestRuntime(),
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
  assert.equal(guardFaqClosure(ar, 'gracias'), null)
})

test('closure skips when operatorRequested', () => {
  const ar = makeArAfterFaq()
  ar.state.operatorRequested = true
  assert.equal(guardFaqClosure(ar, 'gracias'), null)
})

console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
