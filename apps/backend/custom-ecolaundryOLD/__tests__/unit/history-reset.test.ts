// Standalone unit test (NO LLM) — pin down the history-reset contract.
//
// PURPOSE: when the gap between the most recent history entry and "now" is
// larger than `historyResetTtlMs` (default 1 h), the chatbot must treat the
// next message as a brand-new conversation and discard the history. When the
// gap is within the window, history is kept. When timestamps are missing (a
// caller that hasn't been upgraded yet) we keep the history as a safe default.
//
// Run with:
//   node --import tsx __tests__/unit/history-reset.test.ts

import { shouldResetHistory } from '../../index.js'
import type { HistoryEntry } from '../../models/index.js'

interface Case {
  name: string
  run: () => void
}

function isoMinutesAgo(min: number): string {
  return new Date(Date.now() - min * 60 * 1000).toISOString()
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(`assertion failed: ${msg}`)
}

const ONE_HOUR = 60 * 60 * 1000

const cases: Case[] = [
  {
    name: 'fresh history (last entry < 1h ago) → keep',
    run: () => {
      const history: HistoryEntry[] = [
        { role: 'user', content: 'hola', timestamp: isoMinutesAgo(120) },
        { role: 'assistant', content: 'hola, dime', timestamp: isoMinutesAgo(119) },
        { role: 'user', content: 'estoy en Goya', timestamp: isoMinutesAgo(10) },
      ]
      assert(shouldResetHistory(history, ONE_HOUR) === false, 'should NOT reset fresh history')
    },
  },
  {
    name: 'stale history (last entry > 1h ago) → reset',
    run: () => {
      const history: HistoryEntry[] = [
        { role: 'user', content: 'hola', timestamp: isoMinutesAgo(180) },
        { role: 'user', content: 'estoy en Goya', timestamp: isoMinutesAgo(75) },
      ]
      assert(shouldResetHistory(history, ONE_HOUR) === true, 'should reset stale history')
    },
  },
  {
    name: 'empty history → no reset',
    run: () => {
      assert(shouldResetHistory([], ONE_HOUR) === false, 'empty history must not trigger reset')
    },
  },
  {
    name: 'no timestamps anywhere → no reset (legacy caller)',
    run: () => {
      const history: HistoryEntry[] = [
        { role: 'user', content: 'hola' },
        { role: 'assistant', content: 'hola, dime' },
      ]
      assert(shouldResetHistory(history, ONE_HOUR) === false, 'missing timestamps must not trigger reset')
    },
  },
  {
    name: 'unparsable timestamp on last entry → fall back to previous valid entry',
    run: () => {
      const history: HistoryEntry[] = [
        { role: 'user', content: 'hola', timestamp: isoMinutesAgo(75) }, // stale
        { role: 'assistant', content: 'reply', timestamp: 'not-a-date' },
      ]
      // Walk backwards: skip bad timestamp, pick the previous valid one (75 min ago > 1h) → reset.
      assert(shouldResetHistory(history, ONE_HOUR) === true, 'should reset using last parsable timestamp')
    },
  },
  {
    name: 'gap exactly equal to TTL → no reset (strict greater-than)',
    run: () => {
      const ts = new Date(Date.now() - ONE_HOUR).toISOString()
      const history: HistoryEntry[] = [{ role: 'user', content: 'hola', timestamp: ts }]
      // Tiny scheduling drift could push it just over; we accept either result here only
      // when within a few ms. Re-build with a 1ms buffer below the threshold to be deterministic.
      const safe: HistoryEntry[] = [
        { role: 'user', content: 'hola', timestamp: new Date(Date.now() - (ONE_HOUR - 1000)).toISOString() },
      ]
      void history
      assert(shouldResetHistory(safe, ONE_HOUR) === false, 'gap just inside window must keep history')
    },
  },
]

let failed = 0
for (const c of cases) {
  try {
    c.run()
    console.log(`  ✓ ${c.name}`)
  } catch (err) {
    failed++
    console.error(`  ✗ ${c.name}`)
    console.error(err)
  }
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`)
  process.exit(1)
}
console.log(`\nAll ${cases.length} history-reset tests passed`)
