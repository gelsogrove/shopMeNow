// Standalone unit test (NO LLM) — fuzzy matching for machineType typos.
//
// SCENARIO (real CLI session reported by Andrea):
//   Customer types "non me funciona la lavaroda" (typo for "lavadora",
//   r↔d swapped). Today the regex in normalizeMachineType requires
//   "lavador" as substring → "lavaroda" fails → bot asks "lavadora o
//   secadora?" even though the answer is in the message.
//
// FIX: tolerate small typos (Levenshtein distance ≤ 2) against the canonical
// vocabulary [lavadora, lavatrice, washer, secadora, asciugatrice, dryer,
// rentadora, assecadora, lave-linge, sèche-linge].
//
// Run with:
//   node --import tsx __tests__/unit/machine-type-fuzzy.test.ts

import { normalizeMachineType } from '../../utils/intent.js'

interface Case {
  input: string
  expected: '' | 'washer' | 'dryer'
  why: string
}

const cases: Case[] = [
  // ── Exact matches (regression baseline) ────────────────────────────────────
  { input: 'lavadora',     expected: 'washer', why: 'exact ES washer' },
  { input: 'lavatrice',    expected: 'washer', why: 'exact IT washer' },
  { input: 'washer',       expected: 'washer', why: 'exact EN washer' },
  { input: 'secadora',     expected: 'dryer',  why: 'exact ES dryer' },
  { input: 'asciugatrice', expected: 'dryer',  why: 'exact IT dryer' },
  { input: 'dryer',        expected: 'dryer',  why: 'exact EN dryer' },

  // ── Typos that must now succeed (the bug Andrea hit) ───────────────────────
  { input: 'lavaroda',  expected: 'washer', why: 'r↔d swap, distance 2' },
  { input: 'lavdora',   expected: 'washer', why: 'missing letter, distance 1' },
  { input: 'lavadroa',  expected: 'washer', why: 'transposition, distance 2' },
  { input: 'lavadira',  expected: 'washer', why: 'one-letter substitution' },
  { input: 'secadra',   expected: 'dryer',  why: 'missing o, distance 1' },
  { input: 'sercadora', expected: 'dryer',  why: 'extra r, distance 1' },
  { input: 'asciuagtrice', expected: 'dryer',  why: 'IT typo, transposition' },

  // ── False positives that must NOT be matched ───────────────────────────────
  { input: 'lavanderia', expected: '',       why: 'laundry place, NOT a machine type' },
  { input: 'lavar',      expected: '',       why: 'verb, too short' },
  { input: 'gato',       expected: '',       why: 'unrelated word, distance > 2' },
  { input: 'goya',       expected: '',       why: 'location name, NOT a machine' },
  { input: '5',          expected: '',       why: 'machine number, NOT a type' },
  { input: '',           expected: '',       why: 'empty input' },
]

let passed = 0
let failed = 0
for (const c of cases) {
  const actual = normalizeMachineType(c.input)
  if (actual === c.expected) {
    passed += 1
    console.log(`\x1b[32m  ✓\x1b[0m "${c.input}" → ${c.expected || '(none)'}  \x1b[2m(${c.why})\x1b[0m`)
  } else {
    failed += 1
    console.log(`\x1b[31m  ✗\x1b[0m "${c.input}" → expected ${c.expected || '(none)'}, got ${actual || '(none)'}  \x1b[2m(${c.why})\x1b[0m`)
  }
}

console.log(`\n${passed} passed, ${failed} failed (out of ${cases.length})\n`)
if (failed > 0) process.exit(1)
