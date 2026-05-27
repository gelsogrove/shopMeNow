// F47 — Standalone unit test (NO LLM) for utils/intent.ts:detectPaymentMention.
//
// PURPOSE
// =======
// Sibling detector of `detectPaidNotActivatedIntent`. Used by the AL001 →
// Caso 4 pivot in agent-extract.ts. Returns true on a bare past-tense payment
// mention; the failure context is provided by the calling site
// (`activeFlowId === 'al001-sequence-error'`), so the detector itself does
// NOT need to see a failure verb.
//
// MULTI-LANGUAGE COVERAGE (Iron rule #8)
// ======================================
// All 6 supported languages: es, it, en, pt, ca, fr. Each language asserts:
//   1. positive: a real past-tense mention is detected
//   2. negative: a denial / future tense is NOT detected (false-positive guard)
//
// Run with:
//   node --import tsx __tests__/unit/payment-mention-detector.test.ts

import { detectPaymentMention } from '../../utils/intent.js'

let pass = 0
let fail = 0

function check(label: string, raw: string, expected: boolean): void {
  const result = detectPaymentMention(raw)
  if (result === expected) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`)
    pass += 1
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${label}\n      input: "${raw}"  got: ${result}  expected: ${expected}`)
    fail += 1
  }
}

console.log('detectPaymentMention')

// ── ES — Spanish ─────────────────────────────────────────────────────────
console.log('\nES')
check('positive: "He pagado y apretado el numero" (real chat F47)', 'He pagado y apretado el numero de la lavadora', true)
check('positive: "Ya he pagado pero nada"', 'Ya he pagado pero nada', true)
check('positive: "Pagué con tarjeta"', 'Pagué con tarjeta', true)
check('positive: "está pagada"', 'la lavadora está pagada', true)
check('negative: "no he pagado"', 'no he pagado todavía', false)
check('negative: "voy a pagar"', 'voy a pagar ahora', false)
check('negative: "¿puedo pagar con tarjeta?" (question, no past form)', '¿puedo pagar con tarjeta?', false)

// ── IT — Italian ─────────────────────────────────────────────────────────
console.log('\nIT')
check('positive: "ho pagato e premuto il numero"', 'ho pagato e premuto il numero', true)
check('positive: "ho già pagato"', 'ho già pagato', true)
check('positive: bare "pagato" with surrounding ctx', 'già pagato e niente', true)
check('negative: "non ho pagato"', 'non ho pagato ancora', false)
check('negative: "devo pagare"', 'devo pagare adesso', false)

// ── EN — English ─────────────────────────────────────────────────────────
console.log('\nEN')
check('positive: "I paid and the machine didn\'t activate"', "I paid and the machine didn't activate", true)
check('positive: "I have paid"', 'I have paid already', true)
check("positive: \"I've paid\"", "I've paid with the card", true)
check('negative: "I haven\'t paid"', "I haven't paid yet", false)
check('negative: "did not pay"', 'I did not pay because the card was declined', false)
check('negative: "I will pay"', 'I will pay later', false)

// ── PT — Portuguese ──────────────────────────────────────────────────────
console.log('\nPT')
check('positive: "já paguei"', 'já paguei com o cartão', true)
check('positive: "paguei e não funciona"', 'paguei e não funciona', true)
check('positive: "tenho pago"', 'tenho pago e nada', true)
check('negative: "não paguei"', 'não paguei nada ainda', false)
check('negative: "vou pagar"', 'vou pagar quando funcionar', false)

// ── CA — Catalan ─────────────────────────────────────────────────────────
console.log('\nCA')
check('positive: "he pagat amb targeta"', 'he pagat amb targeta', true)
check('positive: "ja he pagat"', 'ja he pagat i res', true)
check('positive: bare "pagat" with context', 'tot pagat i res', true)
check('negative: "no he pagat"', 'no he pagat encara', false)

// ── FR — French ──────────────────────────────────────────────────────────
console.log('\nFR')
check("positive: \"j'ai payé\"", "j'ai payé et rien ne marche", true)
check('positive: "ai payé"', "j' ai payé avec ma carte", true)
check('positive: "payé" with context', 'tout payé et rien', true)
check("negative: \"je n'ai pas payé\"", "je n'ai pas payé encore", false)
check('negative: "vais payer"', 'je vais payer après', false)

// ── Generic negatives — must not over-match ──────────────────────────────
console.log('\nedge cases')
check('negative: empty string', '', false)
check('negative: only whitespace', '   ', false)
check('negative: random text without payment vocab', 'hola que tal', false)
check('negative: "AL001"', 'AL001', false)

console.log(`\n${pass} passed, ${fail} failed (out of ${pass + fail})`)
if (fail > 0) process.exit(1)
