// Standalone unit test (NO LLM) — nlu-patterns.json contract.
//
// PURPOSE: each pattern in json/nlu-patterns.json is exercised here with
// positive and negative test strings. The aim is twofold:
//   1. Lock down the public contract: if someone edits the JSON and the
//      regex stops accepting a documented input (or accepts something it
//      shouldn't), this test catches it.
//   2. Document by example: reading these cases is the fastest way to
//      learn what each pattern is for, without parsing a hairy regex.
//
// When you add a new pattern in nlu-patterns.json, ALSO add at least one
// positive and one negative case here. The test suite is part of the JSON
// contract.
//
// Run with:
//   node --import tsx __tests__/unit/nlu-patterns.test.ts

import { matchPattern } from '../../utils/nlu.js'
import { loadTestRuntime, getCachedTestRuntime } from './_helpers.js'

interface PatternCase {
  name: string
  patternId: string
  positive: string[]
  negative: string[]
}

const cases: PatternCase[] = [
  {
    name: 'displayKnownToken — recognised display tokens',
    patternId: 'displayKnownToken',
    positive: ['SEL', 'PUSH', 'PUSH PROG', 'DOOR', 'ALM', 'ALM/DOOR', 'ALM DOOR', 'ALN', 'ALN A', 'AL001', 'AL 001', '001', 'END BAL', 'FILTRO', 'STOP'],
    negative: ['hello', 'lavadora', '5', 'OK', 'sí', 'AL00X', 'PUSH something extra'],
  },
  {
    name: 'displayErrCode — generic ERR codes',
    patternId: 'displayErrCode',
    positive: ['ERR 52', 'ERR-52', 'ERR52', 'err 7', 'ERR 100'],
    negative: ['ERR', 'ERR 1234', 'ERROR', 'PUSH', '52'],
  },
  {
    name: 'displayLongCode — uppercase 4-15 char codes',
    patternId: 'displayLongCode',
    positive: ['ERROR', 'TIMEOUT', 'FAILURE', 'ABCDE'],
    negative: ['error', 'ABC', 'ABCDEFGHIJKLMNOP', 'AbCdE', 'A1B2C3'],
  },
  {
    name: 'yesNoUppercase — should NOT be classified as display (all 6 languages)',
    patternId: 'yesNoUppercase',
    // es: sí/si/no/ok  it: sì/no/ok  en: yes/no/ok  ca: val/no  pt: sim/não  fr: oui/non
    positive: ['OK', 'NO', 'SI', 'YES', 'sí', 'Sí', 'no', 'yes', 'OUI', 'NON', 'SIM', 'VAL', 'NOPE', 'oui', 'non', 'sim', 'val'],
    negative: ['SEL', 'AL001', 'PUSH', 'lavadora', 'E3', '4', 'F5'],
  },
  {
    name: 'displayContextCode — short alphanumeric accepted in full context',
    patternId: 'displayContextCode',
    // 1-3 alphanumeric chars (no spaces) — paired with yesNoUppercase to exclude yes/no
    positive: ['4', '12', '3', 'E3', 'F5', 'A2', 'AB', 'EC', 'E32', 'F12', 'ABC', 'E3F'],
    negative: ['', 'ABCD', '1234', 'E 3', 'SEL CODE', 'ABCDE'],
  },
  {
    name: 'topicPayment — datafono / cobro / €',
    patternId: 'topicPayment',
    positive: ['el datáfono me ha cobrado 10€', 'datafono', 'tpv', 'me ha cobrado mal', 'charged me 20', '15 €'],
    negative: ['la lavadora no funciona', 'aparece SEL', 'estoy en Goya'],
  },
  {
    name: 'topicOps — cameras / ajax / soporte técnico',
    patternId: 'topicOps',
    positive: ['las cámaras no funcionan', 'el sistema ajax', 'necesito soporte técnico'],
    negative: ['la lavadora arranca', 'el datáfono', 'AL001'],
  },
  {
    name: 'topicCardFail — cannot pay with card',
    patternId: 'topicCardFail',
    positive: ['no puedo pagar con la tarjeta', 'la tarjeta no funciona para pagar', 'tarjeta rechazada', "card doesn't work"],
    negative: ['datáfono cobrado', 'aparece SEL', 'la puerta está cerrada'],
  },
  {
    name: 'topicRefundDemand — immediate refund demand',
    patternId: 'topicRefundDemand',
    positive: ['devuélvanme el dinero', 'devolución inmediata', 'quiero que me devolváis', 'reembolso ya'],
    negative: ['estoy en Goya', 'la lavadora no funciona'],
  },
  {
    name: 'topicCompensation — specific compensation demand',
    patternId: 'topicCompensation',
    positive: ['quiero una secadora gratis', 'lavadora gratis', 'un código nuevo', 'compensación', 'free dryer'],
    negative: ['no funciona la lavadora', 'estoy en Pineda'],
  },
  {
    name: 'switchHint — generic "wait, actually" particle',
    patternId: 'switchHint',
    positive: ['anzi', 'aspetta', 'wait', 'en realidad', 'de verdad'],
    negative: ['lavadora', 'AL001', 'estoy en Goya'],
  },
  {
    name: 'topicCorrectionContext — domain words paired with switchHint',
    patternId: 'topicCorrectionContext',
    positive: ['el código', 'tengo el ticket', 'la factura', 'la tarjeta', 'datafono', 'cobrado', 'el pago', 'el cambio'],
    negative: ['lavadora', 'secadora', 'puerta'],
  },
  {
    name: 'topicContradictoryNarrative — Caso 28 contradictory T1',
    patternId: 'topicContradictoryNarrative',
    positive: [
      'me han cobrado dos veces aunque también pagué con monedas',
      'cobró dos veces, creo, no sé bien',
    ],
    negative: [
      'me han cobrado dos veces',
      'la lavadora no funciona',
      'no sé qué hacer',
    ],
  },
]

function assertEq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `[${label}] expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    )
  }
}

async function main(): Promise<void> {
  const runtime = await loadTestRuntime()
  // Sanity: getCachedTestRuntime must agree with the awaited instance — they
  // are the same object via the helper's cache.
  if (getCachedTestRuntime() !== runtime) {
    throw new Error('helper cache returned a different runtime')
  }

  let passed = 0
  let failed = 0
  for (const c of cases) {
    let caseFailures = 0
    for (const text of c.positive) {
      try {
        assertEq(matchPattern(runtime, c.patternId, text), true, `${c.patternId} should match "${text}"`)
      } catch (err) {
        caseFailures += 1
        const reason = err instanceof Error ? err.message : String(err)
        console.log(`\x1b[31m  ✗\x1b[0m ${c.name}\n      ${reason}`)
      }
    }
    for (const text of c.negative) {
      try {
        assertEq(matchPattern(runtime, c.patternId, text), false, `${c.patternId} should NOT match "${text}"`)
      } catch (err) {
        caseFailures += 1
        const reason = err instanceof Error ? err.message : String(err)
        console.log(`\x1b[31m  ✗\x1b[0m ${c.name}\n      ${reason}`)
      }
    }
    if (caseFailures === 0) {
      passed += 1
      console.log(`\x1b[32m  ✓\x1b[0m ${c.name} (${c.positive.length} pos, ${c.negative.length} neg)`)
    } else {
      failed += 1
    }
  }

  console.log(`\n${passed} passed, ${failed} failed (out of ${cases.length})\n`)
  if (failed > 0) process.exit(1)
}

main()
