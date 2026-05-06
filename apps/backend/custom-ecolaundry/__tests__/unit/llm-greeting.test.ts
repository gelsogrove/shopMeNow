// Standalone unit test (NO LLM) for the greeting-detection logic in agent.ts.
// Regression guard for the "double greeting" bug where the LLM inlined the
// greeting with the rest of the reply and the paragraph-based stripper
// missed it, causing the welcome to be prepended a second time.
//
// Run: node --import tsx __tests__/unit/llm-greeting.test.ts

import { __testing } from '../../agent.js'

const { llmAlreadyGreeted } = __testing

let pass = 0
let fail = 0

function check(label: string, reply: string, expected: boolean): void {
  const actual = llmAlreadyGreeted(reply)
  if (actual === expected) {
    console.log(`  ✓ ${label}`)
    pass += 1
  } else {
    console.log(`  ✗ ${label}\n      reply: ${JSON.stringify(reply)}\n      expected: ${expected}, got: ${actual}`)
    fail += 1
  }
}

console.log('llmAlreadyGreeted')

// Inline greetings (the bug Andrea reported)
check(
  'inline ES greeting + intro in one paragraph',
  '¡Hola! Soy Eco, tu asistente virtual de la lavandería. ¿En qué te ayudo?',
  true,
)
check('plain "Hola"', 'Hola, ¿en qué te puedo ayudar?', true)
check('IT "Ciao"', 'Ciao, sono Eco, come posso aiutarti?', true)
check('EN "Hi" with comma', 'Hi, I am the virtual assistant.', true)
check('EN "Hello"', 'Hello! How can I help?', true)
check('PT "Olá"', 'Olá, sou Eco.', true)
check('FR "Bonjour"', 'Bonjour, je suis Eco.', true)
check('ES with leading inverted exclamation', '¡Hola! ¿qué tal?', true)

// Paragraph-level greetings (covered by stripWelcomeParagraphs fallback)
check(
  'greeting as a separate paragraph followed by content',
  'Hola, soy Eco.\n\nYa tienes el código activado.',
  true,
)

// NOT greetings — must return false so the welcome IS prepended
check('reply without any greeting', '¿Cuál es tu nombre?', false)
check('reply asking for code only', 'Dame el código exacto, por favor.', false)
check('empty reply', '', false)
check('whitespace only', '   ', false)
check(
  'word "hola" inside the reply but not at the start',
  'Para confirmar, dime hola si todo funciona.',
  false,
)

console.log(`\n${pass} passed, ${fail} failed (out of ${pass + fail})`)
if (fail > 0) process.exit(1)
