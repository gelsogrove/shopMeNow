// Standalone unit test (NO LLM) for utils/mixed-signal.ts.
// Run: node --import tsx __tests__/unit/mixed-signal.test.ts

import { detectMixedSignal } from '../../utils/mixed-signal.js'

let pass = 0
let fail = 0

function check(label: string, message: string, expectDetected: boolean): void {
  const result = detectMixedSignal(message)
  const ok = result.detected === expectDetected
  if (ok) {
    console.log(`  ✓ ${label}`)
    pass += 1
  } else {
    console.log(`  ✗ ${label}\n      message: ${JSON.stringify(message)}\n      got: ${JSON.stringify(result)}`)
    fail += 1
  }
}

console.log('mixed-signal')

// Detected — multilingual "yes-but-X"
check('ES — sí arranca pero hay un sonido raro', 'sí arranca pero hay un sonido raro', true)
check('ES — funciona pero huele mal', 'funciona pero huele mal', true)
check('ES — ahora va pero sigue ese ruido', 'ahora va pero sigue ese ruido', true)
check('IT — ora funziona ma c\'è un rumore strano', "ora funziona ma c'è un rumore strano", true)
check('IT — parte però fa fumo', 'parte però fa fumo', true)
check('EN — yes it started but there\'s a strange noise', "yes it started but there's a strange noise", true)
check('EN — it works but it still smells', 'it works but it still smells', true)
check('CA — sí va però fa un soroll estrany', 'sí va però fa un soroll estrany', true)
check('PT — sim funciona mas faz um barulho estranho', 'sim funciona mas faz um barulho estranho', true)
check('FR — oui ça marche mais il y a un bruit bizarre', 'oui ça marche mais il y a un bruit bizarre', true)

// NOT detected — clean confirmations or pure complaints
check('clean ES confirmation', 'sí ahora arranca, gracias', false)
check('clean IT confirmation', 'ora funziona perfettamente', false)
check('clean EN confirmation', 'yes it works now', false)
check('pure complaint without "yes"', 'no funciona, hay un ruido raro', false)
check('connector without complaint after it', 'arranca pero ya está', false)
check('complaint BEFORE the connector (different scenario)', 'hay ruido pero arranca', false)
check('empty message', '', false)
check('whitespace only', '   ', false)
check('non-string input', 42 as unknown as string, false)

// Edge: connector at end
check('connector at end with no clause after', 'funciona pero', false)

// Edge: only confirmation, no contrast
check('"funciona" without "pero" / "but"', 'ya funciona perfecto', false)

console.log(`\n${pass} passed, ${fail} failed (out of ${pass + fail})`)
if (fail > 0) process.exit(1)
