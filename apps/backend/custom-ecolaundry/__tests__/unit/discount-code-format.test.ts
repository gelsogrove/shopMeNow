// F46 — Standalone unit tests (NO LLM) for utils/discount-code-format.ts.
//
// PURPOSE
// =======
// The discount-code format helpers are the single source of truth for "what
// shape does a tenant discount code have" (Caso 8.1/8.2). They are consumed
// both by the discount-code guard (parse the customer's code) AND by the
// customer-name validator (refuse code-shaped tokens as a name).
//
// SCENARIO (Andrea, 2026-05-12)
// =============================
// Real production chat in ES:
//   bot: ¿Cuál es el código exacto tal como lo ves?
//   usr: SAU2904266636363   → bot accepts (valid format, prefix SAU)
//   bot: ¿Cómo te llamas?
//   usr: SAU2904266         → bot accepted as NAME ❌ (this F46 closes the bug)
//
// The pure helpers tested here don't know about names — they only know the
// code shape. The customer-name validator (tested separately) composes
// `looksLikeDiscountCode` to refuse code-shaped tokens.
//
// MULTI-LANGUAGE COVERAGE (Iron rule #8)
// ======================================
// The format itself is language-agnostic, BUT the customer's input can come
// with locale-specific punctuation / whitespace habits. We exercise the
// normaliser with samples from ES, IT, EN, PT, CA, FR.
//
// Run with:
//   node --import tsx __tests__/unit/discount-code-format.test.ts

import {
  buildDiscountCodeRegex,
  parseDiscountCode,
  looksLikeDiscountCode,
} from '../../utils/discount-code-format.js'

let pass = 0
let fail = 0

function check(label: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  ✓ ${label}`)
    pass += 1
  } else {
    console.log(`  ✗ ${label}${detail ? `\n      ${detail}` : ''}`)
    fail += 1
  }
}

console.log('discount-code-format')

// ── buildDiscountCodeRegex ────────────────────────────────────────────────
// RULE: prefix must be uppercase letters only. Reject lowercase, digits,
// empty, mixed case. Validator in runtime.ts:validateSettings enforces this
// at boot, but the helper itself must throw too (defence in depth).
console.log('\nbuildDiscountCodeRegex — prefix validation')
check(
  'accepts "SAU" prefix',
  (() => { try { buildDiscountCodeRegex('SAU'); return true } catch { return false } })(),
)
check(
  'accepts "ABC" prefix (any uppercase letters)',
  (() => { try { buildDiscountCodeRegex('ABC'); return true } catch { return false } })(),
)
check(
  'accepts single-letter prefix "X"',
  (() => { try { buildDiscountCodeRegex('X'); return true } catch { return false } })(),
)
check(
  'rejects empty prefix',
  (() => { try { buildDiscountCodeRegex(''); return false } catch { return true } })(),
)
check(
  'rejects lowercase prefix "sau"',
  (() => { try { buildDiscountCodeRegex('sau'); return false } catch { return true } })(),
)
check(
  'rejects digit prefix "S4U"',
  (() => { try { buildDiscountCodeRegex('S4U'); return false } catch { return true } })(),
)

// ── parseDiscountCode — happy path ───────────────────────────────────────
console.log('\nparseDiscountCode — happy path (prefix SAU)')
{
  const r = parseDiscountCode('SAU2904266', 'SAU')
  check(
    'SAU2904266 → parsed (letters=SAU, fecha=2026-04-29, importe=6)',
    r !== null && r.letters === 'SAU' && r.fechaIso === '2026-04-29' && r.importe === '6',
    `got: ${JSON.stringify(r)}`,
  )
}
{
  // Importe to 2 digits (Andrea: "puo' essere o a una cifra o a due cifre").
  const r = parseDiscountCode('SAU29042612', 'SAU')
  check(
    'SAU29042612 → parsed (importe=12, two-digit amount)',
    r !== null && r.importe === '12',
    `got: ${JSON.stringify(r)}`,
  )
}
{
  // ES customer pastes with surrounding punctuation: "sau-290426 6"
  const r = parseDiscountCode('sau-290426 6', 'SAU')
  check(
    'ES — "sau-290426 6" normalises to SAU2904266 → parsed',
    r !== null && r.letters === 'SAU' && r.importe === '6',
    `got: ${JSON.stringify(r)}`,
  )
}
{
  // IT customer with trailing punctuation
  const r = parseDiscountCode('SAU2904266!', 'SAU')
  check('IT — trailing "!" stripped, code parses', r !== null)
}
{
  // EN customer with question mark suffix
  const r = parseDiscountCode('SAU2904266?', 'SAU')
  check('EN — trailing "?" stripped, code parses', r !== null)
}
{
  // PT customer with comma
  const r = parseDiscountCode('SAU290426,6', 'SAU')
  check('PT — comma stripped, code parses', r !== null)
}
{
  // CA customer with extra surrounding whitespace
  const r = parseDiscountCode('   SAU2904266   ', 'SAU')
  check('CA — leading/trailing whitespace stripped, code parses', r !== null)
}
{
  // FR customer with inverted Spanish punctuation (rare but cleaned)
  const r = parseDiscountCode('¿SAU2904266?', 'SAU')
  check('FR/ES — leading "¿" and trailing "?" stripped, code parses', r !== null)
}

// ── parseDiscountCode — rejections ───────────────────────────────────────
console.log('\nparseDiscountCode — rejections (shape mismatch)')
check('null on wrong prefix length "SA2904266" (2 letters)', parseDiscountCode('SA2904266', 'SAU') === null)
check('null on wrong prefix "ABC2904266" when tenant is SAU', parseDiscountCode('ABC2904266', 'SAU') === null)
check('null on missing date digits "SAU29046"', parseDiscountCode('SAU29046', 'SAU') === null)
check('null on letters-only "SAU"', parseDiscountCode('SAU', 'SAU') === null)
check('null on digits-only "2904266"', parseDiscountCode('2904266', 'SAU') === null)
check('null on empty string', parseDiscountCode('', 'SAU') === null)
check('null on plain customer name "Andrea"', parseDiscountCode('Andrea', 'SAU') === null)
check('null on "Luis Pérez" (two-word name with accent)', parseDiscountCode('Luis Pérez', 'SAU') === null)

// ── parseDiscountCode — rejections (Andrea constraints F46) ──────────────
// Importe constrained to 1-2 digits (euros, not millions). Real chat case:
// SAU2904266636363 was previously parsed as importe=6636363 → fix.
console.log('\nparseDiscountCode — rejections (importe length / date sanity)')
check(
  'null on SAU2904266636363 (importe > 2 digits — real chat regression)',
  parseDiscountCode('SAU2904266636363', 'SAU') === null,
)
check(
  'null on SAU290426123 (importe = 3 digits, just over the cap)',
  parseDiscountCode('SAU290426123', 'SAU') === null,
)
// Calendar sanity: dd ∈ 01..31, mm ∈ 01..12.
check('null on SAU3204266 (dd=32 invalid)', parseDiscountCode('SAU3204266', 'SAU') === null)
check('null on SAU0004266 (dd=00 invalid)', parseDiscountCode('SAU0004266', 'SAU') === null)
check('null on SAU0113266 (mm=13 invalid)', parseDiscountCode('SAU0113266', 'SAU') === null)
check('null on SAU0100266 (mm=00 invalid)', parseDiscountCode('SAU0100266', 'SAU') === null)
// Boundary OK: dd=31, mm=12 must still parse.
{
  const r = parseDiscountCode('SAU3112269', 'SAU')
  check(
    'SAU3112269 → parsed (dd=31, mm=12 boundary OK)',
    r !== null && r.fechaIso === '2026-12-31' && r.importe === '9',
    `got: ${JSON.stringify(r)}`,
  )
}

// ── parseDiscountCode — different tenant prefix ──────────────────────────
console.log('\nparseDiscountCode — alternate tenant prefix')
{
  const r = parseDiscountCode('ABCD1503267', 'ABCD')
  check(
    'ABCD1503267 with prefix ABCD → parsed',
    r !== null && r.letters === 'ABCD' && r.fechaIso === '2026-03-15' && r.importe === '7',
    `got: ${JSON.stringify(r)}`,
  )
}
check(
  'ABCD-prefix code does NOT parse with SAU prefix',
  parseDiscountCode('ABCD1503267', 'SAU') === null,
)

// ── looksLikeDiscountCode — the F46 hook for the name validator ──────────
console.log('\nlooksLikeDiscountCode — used by validateCustomerName (F46)')
check('true for "SAU2904266" (the real chat case)', looksLikeDiscountCode('SAU2904266', 'SAU') === true)
check('true for "SAU29042612" (two-digit amount)', looksLikeDiscountCode('SAU29042612', 'SAU') === true)
// Post-F46 the 7-digit tail no longer qualifies as a code → returns false.
// The discount-code guard rejects it for format and re-asks; the name
// validator no longer needs to refuse it via this path. Plain alphanumeric
// names like "Andrea" remain accepted as before.
check('false for "SAU2904266636363" (importe > 2 digits, not a valid code)', looksLikeDiscountCode('SAU2904266636363', 'SAU') === false)
check('false for "Andrea" (plain ES name)', looksLikeDiscountCode('Andrea', 'SAU') === false)
check('false for "Luis" (plain ES name)', looksLikeDiscountCode('Luis', 'SAU') === false)
check('false for "Marco" (plain IT name)', looksLikeDiscountCode('Marco', 'SAU') === false)
check('false for "John" (plain EN name)', looksLikeDiscountCode('John', 'SAU') === false)
check('false for "Pedro" (plain PT name)', looksLikeDiscountCode('Pedro', 'SAU') === false)
check('false for "Marc" (plain CA name)', looksLikeDiscountCode('Marc', 'SAU') === false)
check('false for "Jean" (plain FR name)', looksLikeDiscountCode('Jean', 'SAU') === false)
check('false for "12345" (digits only — different rejection path)', looksLikeDiscountCode('12345', 'SAU') === false)
check('false for "SAU" alone (no date+amount)', looksLikeDiscountCode('SAU', 'SAU') === false)
check(
  'false for "SAU2904266" when tenant prefix is ABCD',
  looksLikeDiscountCode('SAU2904266', 'ABCD') === false,
)

console.log(`\n${pass} passed, ${fail} failed (out of ${pass + fail})`)
if (fail > 0) process.exit(1)
