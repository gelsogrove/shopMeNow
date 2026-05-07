// Unit tests for isPureGreeting — the boundary-signal detector used by
// guardPureGreeting to intercept turn-1 salutations before they reach the LLM.
//
// WHY this test exists: the LLM responds to bare greetings with phrases like
// "Tranquilo, te ayudo" that presuppose a problem before we know the intent.
// The guard short-circuits that path; these tests pin the detector's contract.
//
// Run: node --import tsx __tests__/unit/greeting.test.ts

import { isPureGreeting } from '../../utils/greeting.js'

let pass = 0
let fail = 0

function check(label: string, input: string, expected: boolean): void {
  const actual = isPureGreeting(input)
  if (actual === expected) {
    console.log(`  ✓ ${label}`)
    pass++
  } else {
    console.log(`  ✗ ${label}\n      input: ${JSON.stringify(input)}\n      expected: ${expected}, got: ${actual}`)
    fail++
  }
}

console.log('isPureGreeting — happy paths (must return true)')

// SCENARIO: Customer opens with only a Spanish greeting
check('ES plain hola', 'hola', true)
check('ES hola with exclamation', '¡Hola!', true)
check('ES buenos días', 'Buenos días', true)
check('ES buenas tardes', 'Buenas tardes', true)
check('ES buenas noches', 'Buenas noches', true)
check('ES informal buenas', 'Buenas', true)

// SCENARIO: Italian customer (e.g., user types "Ciao" — the bug Andrea reported)
check('IT ciao lowercase', 'ciao', true)
check('IT Ciao capitalised', 'Ciao', true)
check('IT ciao with exclamation', 'Ciao!', true)
check('IT buongiorno', 'Buongiorno', true)
check('IT buonasera', 'Buonasera', true)
check('IT salve', 'Salve', true)

// SCENARIO: English-speaking customer
check('EN hi', 'hi', true)
check('EN Hi with dot', 'Hi.', true)
check('EN hello', 'hello', true)
check('EN Hello!', 'Hello!', true)
check('EN hey', 'hey', true)
check('EN good morning', 'Good morning', true)
check('EN good afternoon', 'Good afternoon', true)
check('EN good evening', 'Good evening', true)

// SCENARIO: Catalan customer
check('CA hola (same token as ES)', 'hola', true)
check('CA bon dia', 'Bon dia', true)
check('CA bona tarda', 'Bona tarda', true)

// SCENARIO: Portuguese customer
check('PT olá', 'Olá', true)
check('PT ola', 'Ola', true)
check('PT oi', 'oi', true)
check('PT bom dia', 'Bom dia', true)
check('PT boa tarde', 'Boa tarde', true)

// SCENARIO: French customer
check('FR bonjour', 'bonjour', true)
check('FR Bonjour!', 'Bonjour!', true)
check('FR bonsoir', 'Bonsoir', true)
check('FR salut', 'salut', true)
check('FR bonne nuit', 'Bonne nuit', true)

// SCENARIO: Leading/trailing whitespace should be ignored
check('whitespace around greeting', '  Ciao  ', true)

console.log('\nisPureGreeting — negative cases (must return false)')

// RULE: A message with operational content is NOT a pure greeting.
// The LLM must process it normally so it can extract intent + facts.
check('ES greeting + problem description', 'Hola, mi lavadora no arranca', false)
check('ES greeting + question', 'Hola, ¿cuánto cuesta?', false)
check('IT greeting + question', 'Ciao, dove si trova la lavanderia?', false)
check('EN greeting + content', 'Hello, the machine took my money', false)

// RULE: Standalone words that happen to look like greetings but are mid-sentence
// cannot reach this function (the caller provides the full message), but confirm
// the regex anchors work correctly.
check('word "ciao" inside a sentence', 'Ok ciao ci vediamo dopo', false)
check('word "hola" in context', 'dile hola de mi parte', false)

// RULE: Empty or whitespace-only input is not a greeting.
check('empty string', '', false)
check('whitespace only', '   ', false)

// RULE: Pure numbers or codes are not greetings.
check('numeric input', '1234', false)
check('display code', 'E4', false)

console.log(`\n${pass} passed, ${fail} failed (out of ${pass + fail})`)
if (fail > 0) process.exit(1)
