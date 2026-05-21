// Standalone unit test (NO LLM) — Caso 11 loyalty-card-recharge RECARGA_TOPIC.
//
// F68 (Andrea 2026-05-21): real chat "Como puedo recargar la targeta de
// fidelización" → bot asked for lavadora/secadora. Two gaps in RECARGA_TOPIC:
//   (a) "c[oó]mo recargo" required 1st-person conjugation, missed infinitive
//       after modal ("puedo recargar", "quiero recargar").
//   (b) "targeta" typo (g/j swap) not covered; added tar[gj]eta variant.
//
// Run with:
//   node --import tsx __tests__/unit/loyalty-card-recharge.test.ts

import assert from 'node:assert/strict'

// Re-export RECARGA_TOPIC for testing — extract the regex inline here
// to avoid coupling to the guard's private constant. We test the same
// regex string that lives in the guard file.
const RECARGA_TOPIC = /(c[oó]mo\s+(?:puedo\s+|se\s+)?recarg[ao]|(?:puedo|quiero|necesito|quisiera)\s+recargar|(?:re)?cargar(?:la|lo)?\s+(?:la\s+)?tar[gj]eta|recarga(?:r|rla|rlo)?\s+(?:de\s+)?(?:la\s+)?tar[gj]eta|recargarla|recargarlo|no\s+s[eé]\s+(?:c[oó]mo\s+)?recargar(?:la|lo)?|how\s+(?:do\s+i\s+|to\s+)?(?:re)?charge\s+(?:the\s+)?(?:loyalty\s+)?card)/i

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

// ── Pre-F68 patterns (must still work) ───────────────────────────────────────

console.log('\n── Pre-F68 canonical patterns ──')

test('ES "¿cómo recargo la tarjeta?" → match', () => {
  assert.ok(RECARGA_TOPIC.test('¿cómo recargo la tarjeta?'))
})
test('ES "recargar la tarjeta" → match', () => {
  assert.ok(RECARGA_TOPIC.test('recargar la tarjeta'))
})
test('ES "cargar la tarjeta" → match', () => {
  assert.ok(RECARGA_TOPIC.test('cargar la tarjeta'))
})
test('ES "recargarla" → match', () => {
  assert.ok(RECARGA_TOPIC.test('recargarla'))
})
test('ES "no sé cómo recargarla" → match', () => {
  assert.ok(RECARGA_TOPIC.test('no sé cómo recargarla'))
})
test('EN "how do I recharge the loyalty card" → match', () => {
  assert.ok(RECARGA_TOPIC.test('how do I recharge the loyalty card'))
})
test('EN "how to charge the card" → match', () => {
  assert.ok(RECARGA_TOPIC.test('how to charge the card'))
})

// ── F68 new patterns ──────────────────────────────────────────────────────────

console.log('\n── F68: modal + infinitive patterns ──')

test('F68 real-bug: "Como puedo recargar la targeta de fidelización" → match', () => {
  assert.ok(RECARGA_TOPIC.test('Como puedo recargar la targeta de fidelización'))
})
test('F68 "puedo recargar" (modal + inf) → match', () => {
  assert.ok(RECARGA_TOPIC.test('puedo recargar la tarjeta'))
})
test('F68 "quiero recargar" → match', () => {
  assert.ok(RECARGA_TOPIC.test('quiero recargar la tarjeta'))
})
test('F68 "necesito recargar" → match', () => {
  assert.ok(RECARGA_TOPIC.test('necesito recargar mi tarjeta'))
})
test('F68 "quisiera recargar" → match', () => {
  assert.ok(RECARGA_TOPIC.test('quisiera recargar la tarjeta'))
})
test('F68 "cómo se recarga" → match', () => {
  assert.ok(RECARGA_TOPIC.test('cómo se recarga la tarjeta'))
})

console.log('\n── F68: typo "targeta" (g/j swap) ──')

test('F68 "recargar la targeta" (typo) → match', () => {
  assert.ok(RECARGA_TOPIC.test('recargar la targeta'))
})
test('F68 "cargar la targeta" (typo) → match', () => {
  assert.ok(RECARGA_TOPIC.test('cargar la targeta'))
})
test('F68 "recarga de la targeta" (typo) → match', () => {
  assert.ok(RECARGA_TOPIC.test('recarga de la targeta'))
})

// ── Negatives ─────────────────────────────────────────────────────────────────

console.log('\n── Negatives ──')

test('Unrelated "la lavadora no funciona" → no match', () => {
  assert.ok(!RECARGA_TOPIC.test('la lavadora no funciona'))
})
test('Unrelated "¿cuánto cuesta?" → no match', () => {
  assert.ok(!RECARGA_TOPIC.test('¿cuánto cuesta?'))
})
test('Unrelated "quiero la tarjeta" (buy, not recharge) → no match', () => {
  // "quiero la tarjeta" without recargar/cargar should NOT match recharge
  assert.ok(!RECARGA_TOPIC.test('quiero la tarjeta'))
})
test('Empty string → no match', () => {
  assert.ok(!RECARGA_TOPIC.test(''))
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
