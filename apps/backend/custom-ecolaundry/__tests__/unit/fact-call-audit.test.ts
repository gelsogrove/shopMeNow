// Standalone unit test (NO LLM) — fact-call audit logger.
//
// SCENARIO:
//   `auditFactDiscipline` is the deterministic backstop replacing the
//   prompt rule "NEVER skip a set_* tool when the fact is in the
//   customer's words" (rule #1 — no behavioural patches in agent.txt).
//
//   The architectural front-line is `autoExtractFacts` (pre-LLM), which
//   pre-populates state from regex patterns. The audit runs AFTER the LLM
//   has produced its final reply and detects when state gained a fact
//   during the turn but the LLM did not call the matching set_*.
//
//   This test pins:
//     - snapshotFacts copies the 5 tracked fields
//     - collectInvokedSetTools picks set_* names from assistant tool_calls
//     - auditFactDiscipline does NOT log when state was sticky (before==after)
//     - auditFactDiscipline does NOT log when LLM called the matching tool
//     - auditFactDiscipline DOES log when state changed but tool was missed
//
// Run with:
//   node --import tsx __tests__/unit/fact-call-audit.test.ts

import {
  auditFactDiscipline,
  collectInvokedSetTools,
  snapshotFacts,
  type FactSnapshot,
} from '../../utils/fact-call-audit.js'
import { logger } from '../../utils/logger.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentMessage } from '../../models/index.js'

interface Case {
  name: string
  run: () => void
}

/** Capture warnings emitted by `logger.warn` during the body of `fn`. */
function captureWarnings(fn: () => void): Array<{ msg: string; meta: unknown }> {
  const original = logger.warn.bind(logger)
  const captured: Array<{ msg: string; meta: unknown }> = []
  ;(logger as unknown as { warn: (msg: string, meta?: unknown) => void }).warn =
    (msg: string, meta?: unknown) => {
      captured.push({ msg, meta })
    }
  try {
    fn()
  } finally {
    ;(logger as unknown as { warn: (msg: string, meta?: unknown) => void }).warn = original
  }
  return captured
}

const cases: Case[] = [
  {
    name: 'snapshotFacts captures the 5 tracked fields',
    run: () => {
      const s = createInitialState()
      s.location = 'Goya'
      s.machineType = 'washer'
      s.machineNumber = '5'
      s.displayState = 'PUSH PROG'
      s.paymentCompleted = true
      const snap = snapshotFacts(s)
      if (snap.location !== 'Goya') throw new Error('location not captured')
      if (snap.machineType !== 'washer') throw new Error('machineType not captured')
      if (snap.machineNumber !== '5') throw new Error('machineNumber not captured')
      if (snap.displayState !== 'PUSH PROG') throw new Error('displayState not captured')
      if (snap.paymentCompleted !== true) throw new Error('paymentCompleted not captured')
    },
  },
  {
    name: 'snapshotFacts normalises empty values to null',
    run: () => {
      const s = createInitialState()
      const snap = snapshotFacts(s)
      if (snap.location !== null) throw new Error('empty location must be null')
      if (snap.machineType !== null) throw new Error('empty machineType must be null')
      if (snap.machineNumber !== null) throw new Error('empty machineNumber must be null')
      if (snap.displayState !== null) throw new Error('empty displayState must be null')
      if (snap.paymentCompleted !== null) throw new Error('paymentCompleted defaults to null')
    },
  },
  {
    name: 'collectInvokedSetTools extracts tool names from assistant messages',
    run: () => {
      const messages: AgentMessage[] = [
        { role: 'system', content: '' },
        { role: 'user', content: 'Goya' },
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            { id: '1', type: 'function', function: { name: 'set_location', arguments: '{"location":"Goya"}' } },
          ],
        },
      ]
      const tools = collectInvokedSetTools(messages)
      if (!tools.has('set_location')) throw new Error('set_location not detected')
      if (tools.size !== 1) throw new Error(`expected 1 tool, got ${tools.size}`)
    },
  },
  {
    name: 'collectInvokedSetTools ignores non-set_* tools',
    run: () => {
      const messages: AgentMessage[] = [
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            { id: '1', type: 'function', function: { name: 'mark_resolved', arguments: '{}' } },
            { id: '2', type: 'function', function: { name: 'escalate_to_operator', arguments: '{}' } },
          ],
        },
      ]
      const tools = collectInvokedSetTools(messages)
      if (tools.size !== 0) throw new Error(`expected 0 set_* tools, got ${tools.size}`)
    },
  },
  {
    name: 'audit silent when state did not change (sticky facts)',
    run: () => {
      const before: FactSnapshot = {
        location: 'Goya',
        machineType: 'washer',
        machineNumber: '5',
        displayState: null,
        paymentCompleted: null,
      }
      const after = { ...before }
      const warnings = captureWarnings(() => {
        auditFactDiscipline(before, after, new Set(), { turnCount: 3 })
      })
      if (warnings.length !== 0) {
        throw new Error(`expected no warning, got ${warnings.length}`)
      }
    },
  },
  {
    name: 'audit silent when LLM called the matching set_*',
    run: () => {
      const before: FactSnapshot = {
        location: null,
        machineType: null,
        machineNumber: null,
        displayState: null,
        paymentCompleted: null,
      }
      const after: FactSnapshot = { ...before, location: 'Goya' }
      const warnings = captureWarnings(() => {
        auditFactDiscipline(before, after, new Set(['set_location']), { turnCount: 1 })
      })
      if (warnings.length !== 0) {
        throw new Error(`expected no warning when set_location was called, got ${warnings.length}`)
      }
    },
  },
  {
    name: 'audit warns when state gained location but LLM skipped set_location',
    run: () => {
      const before: FactSnapshot = {
        location: null,
        machineType: null,
        machineNumber: null,
        displayState: null,
        paymentCompleted: null,
      }
      const after: FactSnapshot = { ...before, location: 'Goya' }
      const warnings = captureWarnings(() => {
        auditFactDiscipline(before, after, new Set(), { turnCount: 1 })
      })
      if (warnings.length !== 1) {
        throw new Error(`expected 1 warning, got ${warnings.length}`)
      }
      const meta = warnings[0].meta as { drift: Array<{ field: string; expectedTool: string }> }
      if (meta.drift[0].field !== 'location') throw new Error('drift field must be location')
      if (meta.drift[0].expectedTool !== 'set_location') throw new Error('expected set_location')
    },
  },
  {
    name: 'audit warns when state gained machineType+machineNumber but skipped set_machine_facts',
    run: () => {
      const before: FactSnapshot = {
        location: 'Goya',
        machineType: null,
        machineNumber: null,
        displayState: null,
        paymentCompleted: null,
      }
      const after: FactSnapshot = { ...before, machineType: 'washer', machineNumber: '5' }
      const warnings = captureWarnings(() => {
        auditFactDiscipline(before, after, new Set(), { turnCount: 2 })
      })
      // Single warning aggregates both drifts (one warn call, two drift entries).
      if (warnings.length !== 1) {
        throw new Error(`expected 1 warning, got ${warnings.length}`)
      }
      const meta = warnings[0].meta as { drift: Array<{ field: string }> }
      if (meta.drift.length !== 2) {
        throw new Error(`expected 2 drift entries (machineType + machineNumber), got ${meta.drift.length}`)
      }
    },
  },
  {
    name: 'audit warns on paymentCompleted drift',
    run: () => {
      const before: FactSnapshot = {
        location: 'Goya',
        machineType: 'washer',
        machineNumber: '5',
        displayState: null,
        paymentCompleted: null,
      }
      const after: FactSnapshot = { ...before, paymentCompleted: true }
      const warnings = captureWarnings(() => {
        auditFactDiscipline(before, after, new Set(), { turnCount: 4 })
      })
      if (warnings.length !== 1) {
        throw new Error(`expected 1 warning, got ${warnings.length}`)
      }
      const meta = warnings[0].meta as { drift: Array<{ field: string; expectedTool: string }> }
      if (meta.drift[0].expectedTool !== 'set_payment_facts') {
        throw new Error('expected set_payment_facts')
      }
    },
  },
]

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
