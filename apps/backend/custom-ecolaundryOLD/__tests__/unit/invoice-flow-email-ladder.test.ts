// F111 — Standalone unit test (NO LLM) for the invoice-ask-email 3-strikes ladder.
//
// PURPOSE
// =======
// Iron rule #10 corollary: every gather step has a retry ladder.
// Before F111, the `invoice-ask-email` case in guardInvoiceFlow stayed on
// the same step forever when the customer kept providing invalid emails
// (no counter, no escalate). A malicious or confused customer could loop
// the bot indefinitely.
//
// Post-F111: counter `invoiceEmailAskAttempts` on the state, advanced
// via the shared `nextRetryLadderStep` helper (same primitive used by
// force-display, force-machine-number, discount-code, double-charge).
//   attempts=0 → first invalid → re-ask `invoiceAskEmailRetry`,    counter=1
//   attempts=1 → second invalid → re-ask `invoiceAskEmailRetry`,   counter=2
//   attempts=2 → third invalid → escalate, requireCustomerName, counter resets
//                emit `invoiceEmailRetryEscalate + customerNameAsk`
//   valid email → counter resets to 0, advance to invoice-ask-notes
//
// SCOPE: state + reply assertions on the guard. No LLM, no full pipeline.
//
// Run with:
//   node --import tsx __tests__/unit/invoice-flow-email-ladder.test.ts

import { guardInvoiceFlow } from '../../utils/guards/invoice-flow.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'
import { getCachedTestRuntime, loadTestRuntime } from './_helpers.js'

function makeAr(): AgentRuntime {
  const ar: AgentRuntime = {
    state: createInitialState(),
    runtime: getCachedTestRuntime(),
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
  // Drop the customer straight into the email gather step so the test
  // doesn't have to drive 6 prior turns.
  ar.state.pendingFlow = 'invoice-ask-email'
  ar.state.language = 'es'
  return ar
}

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  {
    name: 'attempt 1 — invalid email → re-ask, counter advances to 1, pendingFlow stays on email',
    run: () => {
      const ar = makeAr()
      const out = guardInvoiceFlow(ar, 'not an email')
      if (!out) throw new Error('expected guard outcome, got null')
      if (ar.state.invoiceEmailAskAttempts !== 1) {
        throw new Error(`counter must be 1, got ${ar.state.invoiceEmailAskAttempts}`)
      }
      if (ar.state.pendingFlow !== 'invoice-ask-email') {
        throw new Error(`pendingFlow must stay 'invoice-ask-email', got '${ar.state.pendingFlow}'`)
      }
      if (out.reason !== 'invoice') {
        throw new Error(`expected reason 'invoice', got '${out.reason}'`)
      }
      if (ar.pendingEscalation) {
        throw new Error('must not escalate on first invalid')
      }
    },
  },
  {
    name: 'attempt 2 — invalid email → re-ask, counter advances to 2',
    run: () => {
      const ar = makeAr()
      ar.state.invoiceEmailAskAttempts = 1
      const out = guardInvoiceFlow(ar, 'still not valid')
      if (!out) throw new Error('expected guard outcome')
      if (ar.state.invoiceEmailAskAttempts !== 2) {
        throw new Error(`counter must be 2, got ${ar.state.invoiceEmailAskAttempts}`)
      }
      if (ar.state.pendingFlow !== 'invoice-ask-email') {
        throw new Error(`pendingFlow must stay 'invoice-ask-email', got '${ar.state.pendingFlow}'`)
      }
      if (ar.pendingEscalation) {
        throw new Error('must not escalate on second invalid')
      }
    },
  },
  {
    name: 'attempt 3 — invalid email → escalate, requireCustomerName, counter reset, pendingFlow cleared',
    run: () => {
      const ar = makeAr()
      ar.state.invoiceEmailAskAttempts = 2
      const out = guardInvoiceFlow(ar, 'garbage 3rd time')
      if (!out) throw new Error('expected guard outcome')
      if (out.reason !== 'invoice-email-retry-exhausted') {
        throw new Error(`expected reason 'invoice-email-retry-exhausted', got '${out.reason}'`)
      }
      if (!ar.pendingEscalation) {
        throw new Error('expected pendingEscalation to be set after 3rd invalid')
      }
      if (ar.state.customerNameRequested !== true) {
        throw new Error('expected customerNameRequested=true (requireCustomerName)')
      }
      if (ar.state.invoiceEmailAskAttempts !== 0) {
        throw new Error(`counter must reset to 0 on escalate, got ${ar.state.invoiceEmailAskAttempts}`)
      }
      if (ar.state.pendingFlow !== '') {
        throw new Error(`pendingFlow must clear on escalate, got '${ar.state.pendingFlow}'`)
      }
    },
  },
  {
    name: 'valid email → advance to invoice-ask-notes, counter reset to 0',
    run: () => {
      const ar = makeAr()
      ar.state.invoiceEmailAskAttempts = 1
      const out = guardInvoiceFlow(ar, 'cliente@dominio.com')
      if (!out) throw new Error('expected guard outcome')
      if (ar.state.invoiceData.email !== 'cliente@dominio.com') {
        throw new Error(`email must be captured, got '${ar.state.invoiceData.email}'`)
      }
      if (ar.state.invoiceEmailAskAttempts !== 0) {
        throw new Error(`counter must reset to 0 on valid, got ${ar.state.invoiceEmailAskAttempts}`)
      }
      if (ar.state.pendingFlow !== 'invoice-ask-notes') {
        throw new Error(`pendingFlow must advance to 'invoice-ask-notes', got '${ar.state.pendingFlow}'`)
      }
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
  if (failed > 0) process.exit(1)
}

void main()
