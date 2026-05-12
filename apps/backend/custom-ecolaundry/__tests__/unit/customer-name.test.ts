// Standalone unit test (NO LLM) for utils/customer-name.ts.
// Run: node --import tsx __tests__/unit/customer-name.test.ts

import { validateCustomerName, type ValidateCustomerNameOptions } from '../../utils/customer-name.js'

let pass = 0
let fail = 0

function check(
  label: string,
  raw: unknown,
  expectedValid: boolean,
  expectedName?: string,
  options?: ValidateCustomerNameOptions,
): void {
  const result = validateCustomerName(raw, options)
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

// ── F46 — discount-code-shaped tokens rejected when prefix supplied ──────
// SCENARIO (Andrea, 2026-05-12): production chat — the bot asked the
// customer for their name; the customer typed "SAU2904266" (a second
// discount code). Without the prefix option the validator accepted it
// (alphanumeric, len>=2, not a confirmation word) → bot drifted into the
// pueblo/machine gather. With the prefix option we refuse code-shaped
// tokens and the caller re-asks the name.
// RULE: when callers know the tenant prefix (guards read it from settings,
// the tool handler from the runtime), they MUST pass it in.
const sau: ValidateCustomerNameOptions = { discountCodePrefix: 'SAU' }

check('F46 — rejects "SAU2904266" when prefix=SAU (real chat case)', 'SAU2904266', false, undefined, sau)
check('F46 — rejects "SAU2904266636363" (long amount tail)', 'SAU2904266636363', false, undefined, sau)
// Customer typed the code in lowercase: validator first-word normaliser is
// case-insensitive via looksLikeDiscountCode (uppercases internally).
check('F46 — rejects "sau2904266" (lowercase variant of the real chat case)', 'sau2904266', false, undefined, sau)

// Plain names from each supported language MUST still pass with the option set.
check('F46 — accepts "Andrea" (ES) with prefix supplied', 'Andrea', true, 'Andrea', sau)
check('F46 — accepts "Marco" (IT) with prefix supplied', 'Marco', true, 'Marco', sau)
check('F46 — accepts "John" (EN) with prefix supplied', 'John', true, 'John', sau)
check('F46 — accepts "Pedro" (PT) with prefix supplied', 'Pedro', true, 'Pedro', sau)
check('F46 — accepts "Marc" (CA) with prefix supplied', 'Marc', true, 'Marc', sau)
check('F46 — accepts "Jean" (FR) with prefix supplied', 'Jean', true, 'Jean', sau)

// Edge case: name that happens to share letters with a code but is not one.
check('F46 — accepts "Saul" (starts with SAU but no digits)', 'Saul', true, 'Saul', sau)

// Without the option, backwards-compat: code-shaped tokens still PASS
// (callers that don't supply the prefix get the pre-F46 behaviour).
check('backwards-compat — "SAU2904266" passes WITHOUT prefix option', 'SAU2904266', true, 'SAU2904266')

// Different tenant prefix: SAU-shaped token must pass when prefix=ABCD.
check(
  'F46 — accepts "SAU2904266" when tenant prefix is ABCD',
  'SAU2904266',
  true,
  'SAU2904266',
  { discountCodePrefix: 'ABCD' },
)

console.log(`\n${pass} passed, ${fail} failed (out of ${pass + fail})`)
if (fail > 0) process.exit(1)
