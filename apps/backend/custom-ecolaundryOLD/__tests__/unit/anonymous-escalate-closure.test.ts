// F112 — guardAnonymousEscalateClosure sibling test.
//
// Recognises closure tokens (gracias/grazie/thanks/merci/obrigado/gracies)
// when customerNameRequested=true → emits localised polite closure +
// finalises escalation as anonymous.
//
// Pinned:
//   (a) does NOT fire when customerNameRequested=false
//   (b) does NOT fire inside discount-code-await-name (own ladder)
//   (c) does NOT fire inside double-charge-await-name (own ladder)
//   (d) DOES fire on the 6 closure tokens (one per language)
//   (e) does NOT fire on a real name like "Andrea"
//
// Run with:
//   node --import tsx __tests__/unit/anonymous-escalate-closure.test.ts

import { guardAnonymousEscalateClosure } from '../../utils/guards/anonymous-escalate-closure.js'
import { createInitialState } from '../../utils/state.js'
import { loadTestRuntime, getCachedTestRuntime } from './_helpers.js'
import type { AgentRuntime } from '../../models/index.js'

function makeAr(opts: {
  language?: string
  customerNameRequested?: boolean
  pendingFlow?: string
} = {}): AgentRuntime {
  const state = createInitialState()
  state.language = (opts.language ?? 'es') as typeof state.language
  state.preferredLanguage = state.language
  if (opts.customerNameRequested) state.customerNameRequested = true
  if (opts.pendingFlow) state.pendingFlow = opts.pendingFlow
  return {
    state,
    runtime: getCachedTestRuntime(),
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
}

interface Case { name: string; run: () => void }

const cases: Case[] = [
  {
    name: 'does NOT fire when customerNameRequested=false',
    run: () => {
      const ar = makeAr({ customerNameRequested: false })
      const r = guardAnonymousEscalateClosure(ar, 'gracias')
      if (r !== null) throw new Error('must not fire without customerNameRequested')
    },
  },
  {
    name: 'does NOT fire on a real name',
    run: () => {
      const ar = makeAr({ customerNameRequested: true })
      const r = guardAnonymousEscalateClosure(ar, 'Andrea')
      if (r !== null) throw new Error('must not fire on a real name')
    },
  },
  {
    name: 'does NOT fire inside discount-code-await-name (own ladder)',
    run: () => {
      const ar = makeAr({ customerNameRequested: true, pendingFlow: 'discount-code-await-name' })
      const r = guardAnonymousEscalateClosure(ar, 'gracias')
      if (r !== null) throw new Error('must not fire inside discount-code-await-name')
    },
  },
  {
    name: 'does NOT fire inside double-charge-await-name (own ladder)',
    run: () => {
      const ar = makeAr({ customerNameRequested: true, pendingFlow: 'double-charge-await-name' })
      const r = guardAnonymousEscalateClosure(ar, 'gracias')
      if (r !== null) throw new Error('must not fire inside double-charge-await-name')
    },
  },
  // Positive cases — closure tokens trigger the guard in all 6 languages.
  ...['gracias', 'grazie', 'thanks', 'merci', 'obrigado', 'gracies'].map((token, idx) => {
    const langs = ['es', 'it', 'en', 'fr', 'pt', 'ca'] as const
    return {
      name: `fires on "${token}" (${langs[idx]})`,
      run: () => {
        const ar = makeAr({ language: langs[idx], customerNameRequested: true })
        const r = guardAnonymousEscalateClosure(ar, token)
        if (r === null) throw new Error(`must fire on "${token}"`)
        if (!r.reply) throw new Error('reply must be non-empty')
        if (ar.state.customerNameRequested) throw new Error('customerNameRequested must be cleared')
        if (ar.state.pendingClosure !== 'escalated') throw new Error('pendingClosure must be "escalated"')
      },
    }
  }),
  {
    name: 'tolerates trailing punctuation',
    run: () => {
      const ar = makeAr({ language: 'es', customerNameRequested: true })
      const r = guardAnonymousEscalateClosure(ar, '¡Gracias!')
      if (r === null) throw new Error('must fire on "¡Gracias!" with punctuation')
    },
  },
]

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
  // eslint-disable-next-line no-undef
  if (failed > 0) (globalThis as { process?: { exit: (code: number) => void } }).process?.exit(1)
}

void main()
