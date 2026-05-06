// Standalone unit test (NO LLM) for utils/customer-name.ts.
// Run: node --import tsx __tests__/unit/customer-name.test.ts

import { validateCustomerName } from '../../utils/customer-name.js'

let pass = 0
let fail = 0

function check(label: string, raw: unknown, expectedValid: boolean, expectedName?: string): void {
  const result = validateCustomerName(raw)
  const okValid = result.valid === expectedValid
  const okName = !expectedName || (result.valid && result.name === expectedName)
  if (okValid && okName) {
    console.log(`  ✓ ${label}`)
    pass += 1
  } else {
    console.log(`  ✗ ${label}\n      got: ${JSON.stringify(result)}`)
    fail += 1
  }
}

console.log('customer-name')

// Valid names
check('plain first name', 'Andrea', true, 'Andrea')
check('full name → keeps only first word', 'Andrea Gelsomino', true, 'Andrea')
check('lowercase name', 'pepe', true, 'pepe')
check('name with surrounding whitespace', '  María  ', true, 'María')

// Invalid: confirmation words
check('rejects "si"', 'si', false)
check('rejects "sí"', 'sí', false)
check('rejects "vale"', 'vale', false)
check('rejects "gracias"', 'gracias', false)
check('rejects "ok"', 'ok', false)
check('rejects "no"', 'no', false)
check('rejects "perfecto" with punctuation', 'perfecto!', false)

// Invalid: numeric / too short
check('rejects pure digits', '12345', false)
check('rejects single character', 'A', false)
check('rejects empty string', '', false)
check('rejects whitespace only', '   ', false)

// Invalid: type
check('rejects null', null, false)
check('rejects undefined', undefined, false)
check('rejects number', 42, false)
check('rejects object', { name: 'Andrea' }, false)

console.log(`\n${pass} passed, ${fail} failed (out of ${pass + fail})`)
if (fail > 0) process.exit(1)
