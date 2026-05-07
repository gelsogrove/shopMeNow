// Standalone unit test (NO LLM) — autoExtractFacts contract.
//
// PURPOSE: pin down the contract of the deterministic extractor:
//   - Multi-fact extraction in a single message (R5)
//   - Idempotency: applying the extractor twice on the same message
//     yields the same state (R4)
//   - Sticky preservation: location / customerName / language are
//     immutable once set (R1)
//   - Display state always updates if a new code is present
//   - First-mention semantics: machineType/machineNumber stick once set,
//     are not overwritten by intent guesses (R2 — intent is LLM)
//
// Run with:
//   node --import tsx __tests__/unit/extract-facts.test.ts

import { autoExtractFacts } from '../../utils/agent-extract.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'
import { loadTestRuntime, getCachedTestRuntime } from './_helpers.js'

function makeAr(): AgentRuntime {
  return {
    state: createInitialState(),
    runtime: getCachedTestRuntime(),
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
}

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  // ── R5: Multi-fact extraction ───────────────────────────────────────────
  {
    name: 'R5: single message with multiple facts → all extracted',
    run: () => {
      const ar = makeAr()
      ar.state.turnCount = 1
      autoExtractFacts(ar, 'estoy en Goya con la lavadora 5 y aparece SEL')

      assertEq(ar.state.location, 'Goya', 'location extracted')
      assertEq(ar.state.machineType, 'washer', 'machineType extracted')
      assertEq(ar.state.machineNumber, '5', 'machineNumber extracted')
      assertEq(ar.state.displayState, 'SEL', 'displayState extracted')
    },
  },
  {
    name: 'R5: italian multi-fact ("a Goya con la lavatrice 7 SEL")',
    run: () => {
      const ar = makeAr()
      ar.state.turnCount = 1
      autoExtractFacts(ar, 'sono a Goya con la lavatrice 7 e mi appare SEL')

      assertEq(ar.state.location, 'Goya', 'location from IT')
      assertEq(ar.state.machineType, 'washer', 'machineType from "lavatrice"')
      assertEq(ar.state.machineNumber, '7', 'machineNumber from IT')
      assertEq(ar.state.displayState, 'SEL', 'displayState from IT')
    },
  },

  // ── R4: Idempotency ─────────────────────────────────────────────────────
  {
    name: 'R4: applying the extractor twice on same message → same state',
    run: () => {
      const ar = makeAr()
      ar.state.turnCount = 1

      autoExtractFacts(ar, 'lavadora 5 a Goya con SEL')
      const snapshot1 = JSON.stringify({
        loc: ar.state.location,
        mt: ar.state.machineType,
        mn: ar.state.machineNumber,
        ds: ar.state.displayState,
      })

      autoExtractFacts(ar, 'lavadora 5 a Goya con SEL')
      const snapshot2 = JSON.stringify({
        loc: ar.state.location,
        mt: ar.state.machineType,
        mn: ar.state.machineNumber,
        ds: ar.state.displayState,
      })

      assertEq(snapshot1, snapshot2, 'state unchanged after re-extract')
    },
  },

  // ── R1: Sticky preservation ─────────────────────────────────────────────
  {
    name: 'R1: location is immutable once set (a second location name does NOT overwrite)',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'

      // Customer message later mentions Pineda — location must not change.
      // (Real machine switching across laundries is not a flow we support;
      // the customer is in ONE laundry per session. If they truly mean a
      // different one, the LLM gathers the correction explicitly.)
      autoExtractFacts(ar, 'no funciona la lavadora en Pineda')

      assertEq(ar.state.location, 'Goya', 'location preserved')
    },
  },
  {
    name: 'R1: customerName preserved across extractions',
    run: () => {
      const ar = makeAr()
      ar.state.customerName = 'Andrea'
      ar.state.location = 'Goya'

      autoExtractFacts(ar, 'la secadora 3 no calienta')

      assertEq(ar.state.customerName, 'Andrea', 'customerName preserved')
      assertEq(ar.state.location, 'Goya', 'location preserved')
      assertEq(ar.state.machineType, 'dryer', 'new machineType extracted')
      assertEq(ar.state.machineNumber, '3', 'new machineNumber extracted')
    },
  },

  // ── displayState updates on every new code ──────────────────────────────
  {
    name: 'displayState updates when a NEW code is in the message',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'SEL'

      autoExtractFacts(ar, 'ahora me dice DOOR')

      assertEq(ar.state.displayState, 'DOOR', 'displayState updated SEL → DOOR')
    },
  },
  {
    name: 'displayState stays put when message has no display code',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'SEL'

      autoExtractFacts(ar, 'sigue sin funcionar')

      assertEq(ar.state.displayState, 'SEL', 'displayState unchanged')
    },
  },

  // ── Contextual display capture (all 3 facts known) ─────────────────────
  // RULE: when location + machineType + machineNumber are all set and
  // displayState is still empty, the bot has just asked "qué aparece en la
  // pantalla?". Any short (1-3 char) non-yesno token is the display code.
  // Covers the gap where customers type bare digits or short error codes that
  // are NOT in the known-token whitelist (SEL/PUSH/ERR+digits/4+letters).
  {
    name: 'contextual display: bare digit "4" captured when all 3 facts known',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Hortes'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '3'
      // displayState is empty — bot just asked "qué aparece en la pantalla?"

      autoExtractFacts(ar, '4')

      assertEq(ar.state.displayState, '4', 'bare digit accepted as display code')
    },
  },
  {
    name: 'contextual display: "E3" (letter+digit) captured when all 3 facts known',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'dryer'
      ar.state.machineNumber = '2'

      autoExtractFacts(ar, 'E3')

      assertEq(ar.state.displayState, 'E3', 'letter+digit code accepted')
    },
  },
  {
    name: 'contextual display: "F5" accepted; "12" accepted; "AB" accepted',
    run: () => {
      for (const [input, expected] of [['F5', 'F5'], ['12', '12'], ['AB', 'AB']] as const) {
        const ar = makeAr()
        ar.state.location = 'Pineda'
        ar.state.machineType = 'washer'
        ar.state.machineNumber = '7'
        autoExtractFacts(ar, input)
        assertEq(ar.state.displayState, expected, `contextual display: "${input}" → "${expected}"`)
      }
    },
  },
  {
    name: 'contextual display: yes/no tokens rejected even in full context',
    run: () => {
      // RULE: yesNoUppercase anti-pattern always wins over contextual capture.
      // "no" / "sí" / "ok" / "oui" / "non" / "sim" / "val" must NEVER become display codes.
      for (const yesNo of ['no', 'sí', 'OK', 'YES', 'oui', 'NON', 'SIM', 'VAL', 'NOPE']) {
        const ar = makeAr()
        ar.state.location = 'Alemanya'
        ar.state.machineType = 'washer'
        ar.state.machineNumber = '5'
        autoExtractFacts(ar, yesNo)
        assertEq(ar.state.displayState, '', `"${yesNo}" must NOT become a display code`)
      }
    },
  },
  {
    name: 'contextual display: NOT captured when machineNumber missing (context incomplete)',
    run: () => {
      // RULE: all 3 facts must be known. If machineNumber is absent, the bot
      // hasn't asked "qué aparece en la pantalla?" yet — don't pre-capture.
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      // machineNumber NOT set

      autoExtractFacts(ar, '4')

      assertEq(ar.state.displayState, '', '"4" must NOT be captured as display when machineNumber is missing')
    },
  },
  {
    name: 'contextual display: NOT captured when location missing',
    run: () => {
      const ar = makeAr()
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '3'
      // location NOT set

      autoExtractFacts(ar, '4')

      assertEq(ar.state.displayState, '', '"4" must NOT be captured as display when location is missing')
    },
  },
  {
    name: 'contextual display: long tokens (>3 chars) NOT captured by context branch',
    run: () => {
      // RULE: tokens >3 chars fall back to shouldAcceptAsDisplay (e.g. displayLongCode ≥4 pure letters).
      // Pure digit "1234" or mixed "E123" (4 chars) — neither captured as display by ANY path
      // since they exceed the contextual limit and don't match other patterns.
      const ar = makeAr()
      ar.state.location = 'Hortes'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '3'

      autoExtractFacts(ar, '1234')

      assertEq(ar.state.displayState, '', '"1234" (4 digits) not captured — beyond context limit')
    },
  },

  // ── machineType/machineNumber: first-mention sticky ─────────────────────
  {
    name: 'machineType is set on first mention; subsequent mentions do not overwrite',
    run: () => {
      const ar = makeAr()
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'

      // The customer says "secadora" later in the conversation. The
      // extractor does NOT guess this is a switch — that intent decision
      // belongs to the LLM, which calls mark_resolved + set_machine_facts.
      autoExtractFacts(ar, 'la secadora también no anda')

      assertEq(ar.state.machineType, 'washer', 'machineType not overwritten by extractor')
      assertEq(ar.state.machineNumber, '5', 'machineNumber not overwritten')
    },
  },

  // ── Empty / whitespace input ────────────────────────────────────────────
  {
    name: 'empty / whitespace input → no-op, state unchanged',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'

      autoExtractFacts(ar, '   ')
      autoExtractFacts(ar, '')

      assertEq(ar.state.location, 'Goya', 'no change on empty input')
      assertEq(ar.state.machineType, 'washer', 'no change on whitespace')
    },
  },

  // ── Post-escalation re-entry (regression for "Tranquilo te ayudo" bug) ──
  {
    name: 'caso 8 trigger after a previous escalation clears blocking flags',
    run: () => {
      const ar = makeAr()
      // Simulate the state right after a Caso 8 closure: escalation flags set,
      // sticky facts (location, name) still populated. Without the fix this
      // would prevent guardCaso8AskCode from firing on the next trigger.
      ar.state.operatorRequested = true
      ar.state.customerNameRequested = true
      ar.state.escalationReason = 'Caso 8 — código válido'
      ar.state.pendingClosure = 'escalated'
      ar.pendingEscalation = { reason: 'Caso 8 — código válido' }
      ar.state.customerName = 'Andrea'
      ar.state.location = 'Alemanya'

      autoExtractFacts(ar, 'tengo un codigo y no se donde ponerlo')

      assertEq(ar.state.pendingFlow, 'caso8-ask-code', 'new caso 8 trigger registered')
      assertEq(ar.state.operatorRequested, false, 'operatorRequested cleared')
      assertEq(ar.state.customerNameRequested, false, 'customerNameRequested cleared')
      assertEq(ar.state.escalationReason, '', 'escalationReason cleared')
      assertEq(ar.state.pendingClosure, null, 'pendingClosure cleared')
      assertEq(ar.pendingEscalation, null, 'pendingEscalation cleared')
      // Sticky facts that survive across cases stay intact.
      assertEq(ar.state.customerName, 'Andrea', 'customerName preserved')
      assertEq(ar.state.location, 'Alemanya', 'location preserved')
    },
  },

  {
    name: 'caso 8 phrasing variants ("donde ponerlo" / "donde lo pongo") all trigger',
    run: () => {
      for (const msg of [
        'tengo un codigo y no se como usarlo',
        'tengo un codigo y no se donde ponerlo',
        'tengo un codigo y no se donde lo pongo',
        'tengo un codigo y no se donde meterlo',
      ]) {
        const ar = makeAr()
        autoExtractFacts(ar, msg)
        assertEq(ar.state.pendingFlow, 'caso8-ask-code', `triggered by: "${msg}"`)
      }
    },
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
  await loadTestRuntime()
  let passed = 0
  let failed = 0
  for (const c of cases) {
    try {
      c.run()
      passed += 1
      console.log(`\x1b[32m  ✓\x1b[0m ${c.name}`)
    } catch (err) {
      failed += 1
      const reason = err instanceof Error ? err.message : String(err)
      console.log(`\x1b[31m  ✗\x1b[0m ${c.name}\n      ${reason}`)
    }
  }

  console.log(`\n${passed} passed, ${failed} failed (out of ${cases.length})\n`)
  if (failed > 0) process.exit(1)
}

main()
