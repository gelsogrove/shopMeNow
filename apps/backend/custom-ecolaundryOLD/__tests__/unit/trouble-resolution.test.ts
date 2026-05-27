// F109 Opt C — detectTroubleResolution sibling test.
//
// Pins the contract: detectTroubleResolution returns true when the customer
// explicitly signals the trouble has been resolved ("ora funziona", "ahora
// funciona", "now it works"). Multi-language (es/it/en/ca/pt/fr).
//
// Negative coverage: must NOT false-positive on noun-only mentions, neutral
// questions, names, locations, codes. These would silently markResolve() a
// trouble that's still ongoing.
//
// Bug origin: Andrea CLI demo 2026-05-26. After fixing the F109 escalation
// regression (releaseActiveFlow), T9 still received the bot repeating DOOR
// guidance because sticky displayState + machineNumber re-armed
// guardAutoStartMachineFlow. Root cause: nobody detected "ora funziona" as
// an explicit resolution → no markResolved → sticky machine facts persisted.
//
// Run with:
//   node --import tsx __tests__/unit/trouble-resolution.test.ts

import { detectTroubleResolution } from '../../utils/intent.js'

type Case = { label: string; message: string; expected: boolean }

const cases: Case[] = [
  // ── ES positive (3 forms) ───────────────────────────────────────────────
  { label: 'ES — ahora funciona',     message: 'ahora funciona',               expected: true },
  { label: 'ES — ahora sí funciona',  message: 'ahora sí funciona la lavadora', expected: true },
  { label: 'ES — ya funciona',        message: 'ya funciona',                  expected: true },
  { label: 'ES — ya está solucionado',message: 'ya está solucionado',          expected: true },

  // ── IT positive (4 forms) ───────────────────────────────────────────────
  { label: 'IT — ora funziona',       message: 'ora funziona',                 expected: true },
  { label: 'IT — adesso funziona',    message: 'adesso funziona',              expected: true },
  { label: 'IT — è risolto',          message: 'è risolto',                    expected: true },
  // The original Andrea CLI bug message — combined resolution + FAQ pivot.
  // The resolution part MUST be detected so markResolved fires before the
  // FAQ branch handles the second part of the message.
  { label: 'IT — Andrea CLI 2026-05-26 (resolution + FAQ pivot)',
    message: 'ora funziona, dimmi una cosa ho una tessera di fidelizzazione come la uso?',
    expected: true },

  // ── EN positive ─────────────────────────────────────────────────────────
  { label: 'EN — now it works',       message: 'now it works',                 expected: true },
  { label: 'EN — its fixed',          message: "it's fixed",                   expected: true },
  { label: 'EN — all good',           message: 'all good',                     expected: true },

  // ── CA positive ─────────────────────────────────────────────────────────
  { label: 'CA — ara funciona',       message: 'ara funciona',                 expected: true },
  { label: 'CA — ja funciona',        message: 'ja funciona',                  expected: true },
  { label: 'CA — ja està resolt',     message: 'ja està resolt',               expected: true },

  // ── PT positive ─────────────────────────────────────────────────────────
  { label: 'PT — agora funciona',     message: 'agora funciona',               expected: true },
  { label: 'PT — ja funciona',        message: 'ja funciona',                  expected: true },

  // ── FR positive ─────────────────────────────────────────────────────────
  { label: 'FR — maintenant ça marche', message: 'maintenant ça marche',       expected: true },
  { label: 'FR — c est réglé',         message: "c'est réglé",                 expected: true },

  // ── Negative coverage (must NOT false-positive) ─────────────────────────
  // The detector gates markResolved — false positives would silently close
  // legitimate ongoing trouble cases.
  { label: 'NEG — non funziona',                   message: 'non funziona',                expected: false },
  { label: 'NEG — no funciona',                    message: 'no funciona',                 expected: false },
  { label: 'NEG — la lavadora',                    message: 'la lavadora',                 expected: false },
  { label: 'NEG — neutral question',               message: 'qué lavadora es?',            expected: false },
  { label: 'NEG — numeric reply',                  message: '5',                           expected: false },
  { label: 'NEG — confirmation',                   message: 'sí',                          expected: false },
  { label: 'NEG — empty',                          message: '',                            expected: false },
  { label: 'NEG — customer name',                  message: 'Carlos',                      expected: false },
  { label: 'NEG — location reply',                 message: 'Goya',                        expected: false },
  { label: 'NEG — does it work? (question)',       message: 'ahora funciona?',             expected: false }, // ❌ question, not statement
  { label: 'NEG — long sentence about no funciona',message: 'todo bien con la factura pero la lavadora no funciona', expected: false },
]

async function main(): Promise<void> {
  let passed = 0
  let failed = 0
  for (const c of cases) {
    try {
      const actual = detectTroubleResolution(c.message)
      if (actual !== c.expected) {
        throw new Error(`expected=${c.expected}, got=${actual}`)
      }
      passed += 1
      console.log(`\x1b[32m  ✓\x1b[0m ${c.label} — "${c.message.slice(0, 60)}"`)
    } catch (err) {
      failed += 1
      const reason = err instanceof Error ? err.message : String(err)
      console.log(`\x1b[31m  ✗\x1b[0m ${c.label}\n      message="${c.message}"\n      ${reason}`)
    }
  }
  console.log(`\n${passed} passed, ${failed} failed (out of ${cases.length})\n`)
  // eslint-disable-next-line no-undef
  if (failed > 0) (globalThis as { process?: { exit: (code: number) => void } }).process?.exit(1)
}

void main()
