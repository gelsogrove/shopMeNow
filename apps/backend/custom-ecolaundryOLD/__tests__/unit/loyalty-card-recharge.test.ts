// Standalone unit test (NO LLM) — Caso 11 loyalty-card-recharge RECARGA_TOPIC.
//
// F68 (Andrea 2026-05-21): real chat "Como puedo recargar la targeta de
// fidelización" → bot asked for lavadora/secadora. Two gaps in RECARGA_TOPIC:
//   (a) "c[oó]mo recargo" required 1st-person conjugation, missed infinitive
//       after modal ("puedo recargar", "quiero recargar").
//   (b) "targeta" typo (g/j swap) not covered; added tar[gj]eta variant.
//
// F99 (Andrea demo CLI 2026-05-24): IT "Come posso ricaricare la tessera?" and
// EN "How can I recharge my loyalty card?" not matched → bot routed IT to
// trouble-machine (asked location in ES), EN to loyaltyCardBuy (replied 20€).
// RECARGA_TOPIC extended with IT (ricaricare/ricarico + tessera/carta fedeltà),
// EN "recharge" standalone variants ("how can I", "recharge my card"),
// PT (recarregar + cartão) and FR (recharger + carte). Iron rule #8.
//
// Run with:
//   node --import tsx __tests__/unit/loyalty-card-recharge.test.ts

import assert from 'node:assert/strict'

// Re-export RECARGA_TOPIC for testing — keep in sync with the regex in
// utils/guards/loyalty-card-recharge.ts (both must be identical).
const RECARGA_TOPIC = /(c[oó]mo\s+(?:puedo\s+|se\s+)?recarg[ao]|(?:puedo|quiero|necesito|quisiera)\s+recargar|(?:re)?cargar(?:la|lo)?\s+(?:la\s+)?tar[gj]eta|recarga(?:r|rla|rlo)?\s+(?:de\s+)?(?:la\s+)?tar[gj]eta|recargarla|recargarlo|no\s+s[eé]\s+(?:c[oó]mo\s+)?recargar(?:la|lo)?|how\s+(?:(?:do|can|to)\s+(?:i\s+)?|to\s+)?(?:re)?charge\s+(?:(?:my|the|a)\s+)?(?:loyalty\s+)?card|recharge\s+(?:(?:my|the|a)\s+)?(?:loyalty\s+)?card|(?:i\s+(?:want|need)|i'd\s+like)\s+to\s+recharge|com\s+(?:puc\s+|vull\s+|necessito\s+|voldria\s+)?recarregar|recarreg(?:ar|o|a|ar-la|ar-lo)\s+(?:la\s+)?tar[gj]eta|no\s+s[ée]\s+com\s+recarregar|ricaric(?:are|o|a|hi)\s+(?:(?:la|il|una?)\s+)?(?:tess?era|carta(?:\s+fedelt[aà])?)|come\s+(?:posso|si\s+)?ricaric(?:are|a)|voglio\s+ricaricare|ho\s+bisogno\s+di\s+ricaricare|recarregar\s+(?:(?:o|a|meu|minha)\s+)?cart[aã]o|como\s+(?:posso\s+)?recarregar|recharg(?:er|ez|e)\s+(?:(?:ma|la|une?)\s+)?carte)/i

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

// ── F99 — EN "how can I recharge" and standalone "recharge" variants ─────────

console.log('\n── F99: EN modal variants (how can I, recharge standalone) ──')

test('F99 EN real-bug: "How can I recharge my loyalty card?" → match', () => {
  // Root bug from Andrea demo 2026-05-24: was routed to loyaltyCardBuy (20€ reply)
  assert.ok(RECARGA_TOPIC.test('How can I recharge my loyalty card?'))
})
test('F99 EN: "recharge my loyalty card" → match', () => {
  assert.ok(RECARGA_TOPIC.test('recharge my loyalty card'))
})
test('F99 EN: "I want to recharge" → match', () => {
  assert.ok(RECARGA_TOPIC.test('I want to recharge'))
})
test('F99 EN: "I need to recharge" → match', () => {
  assert.ok(RECARGA_TOPIC.test('I need to recharge'))
})

// ── F99 — IT (ricaricare/ricarico + tessera) ──────────────────────────────────

console.log('\n── F99: IT ricaricare patterns ──')

test('F99 IT real-bug: "Come posso ricaricare la tessera?" → match', () => {
  // Root bug: bot asked location in ES instead of returning loyaltyCardRecharge
  assert.ok(RECARGA_TOPIC.test('Come posso ricaricare la tessera?'))
})
test('F99 IT: "come ricarico la tessera" → match', () => {
  assert.ok(RECARGA_TOPIC.test('come ricarico la tessera'))
})
test('F99 IT: "voglio ricaricare" → match', () => {
  assert.ok(RECARGA_TOPIC.test('voglio ricaricare'))
})
test('F99 IT: "come si ricarica la tessera" → match', () => {
  assert.ok(RECARGA_TOPIC.test('come si ricarica la tessera'))
})
test('F99 IT: "ricaricare la carta fedeltà" → match', () => {
  assert.ok(RECARGA_TOPIC.test('ricaricare la carta fedeltà'))
})

// ── F99 — PT (recarregar + cartão) ───────────────────────────────────────────

console.log('\n── F99: PT recarregar patterns ──')

test('F99 PT: "como recarregar o cartão" → match', () => {
  assert.ok(RECARGA_TOPIC.test('como recarregar o cartão'))
})
test('F99 PT: "recarregar o cartão de fidelidade" → match', () => {
  assert.ok(RECARGA_TOPIC.test('recarregar o cartão de fidelidade'))
})

// ── F99 — FR (recharger + carte) ─────────────────────────────────────────────

console.log('\n── F99: FR recharger patterns ──')

test('F99 FR: "recharger ma carte" → match', () => {
  assert.ok(RECARGA_TOPIC.test('recharger ma carte'))
})
test('F99 FR: "comment recharger la carte" → match', () => {
  assert.ok(RECARGA_TOPIC.test('comment recharger la carte'))
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
test('F99 neg: "tessera elettorale" → no match (not loyalty tessera)', () => {
  // IT: "tessera" alone without loyalty context must NOT match
  assert.ok(!RECARGA_TOPIC.test('ho perso la tessera elettorale'))
})
test('Empty string → no match', () => {
  assert.ok(!RECARGA_TOPIC.test(''))
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
