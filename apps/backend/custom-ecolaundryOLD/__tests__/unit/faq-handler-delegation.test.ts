// Unit test for Regola-A (F101 Fase 1) — faqHandler delegation.
//
// WHAT: verifies that faqHandler returns `delegate-to-legacy` for every
// non-empty pendingFlow value, including faq-* gather steps, non-faq flows
// (discount-code-*, invoice-*, no-change-*, double-charge-*, photo-await,
// display-reask-pending, loyalty-card-await-location, etc.).
//
// WHY: Regola-A (F101) replaces the previous two enumerated blocks with a
// single deterministic `if (pending) return delegate-to-legacy`. This test
// pins that contract so future additions of pendingFlow values don't silently
// regress — any new flow that forgets to route through the legacy pipeline
// will be caught here.
//
// Run with:
//   node --import tsx __tests__/unit/faq-handler-delegation.test.ts

import { loadTestRuntime } from './_helpers.js'
import { faqHandler } from '../../utils/branches/faq/handler.js'
import { createInitialState } from '../../utils/state.js'
import type { Runtime } from '../../models/index.js'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function makeAr(runtime: Runtime, pendingFlow: string) {
  const state = createInitialState()
  state.pendingFlow = pendingFlow as typeof state.pendingFlow
  state.language = 'es'
  return { state, runtime }
}

// ---------------------------------------------------------------------------
// known pendingFlow values — every non-empty value MUST delegate
// ---------------------------------------------------------------------------

const PENDING_FLOWS = [
  // faq gather steps (Caso 12 T2+)
  'faq-prices-await-location',
  'faq-hours-await-location',
  'faq-programs-await-location',
  'faq-how-to-use-await-location',
  'faq-prices-await-dryer-confirm',
  'faq-prices-await-washer-confirm',
  // non-faq flows (F-Caso8 pattern)
  'discount-code-ask',
  'discount-code-await',
  'discount-code-await-name',
  'discount-code-await-location',
  'discount-code-await-machine',
  'discount-code-await-door',
  'no-change-ask',
  'no-change-await-confirm',
  'no-change-await-confirmation',
  'invoice-ask-location',
  'invoice-ask-company-name',
  'invoice-ask-machine-type',
  'invoice-ask-address',
  'invoice-ask-tax-id',
  'invoice-ask-date',
  'invoice-ask-coste',
  'invoice-ask-email',
  'invoice-ask-notes',
  'invoice-ask-name',
  'photo-await-decision',
  'numeric-code-ask-letters',
  'numeric-code-await-answer',
  'double-charge-ask',
  'double-charge-ask-used',
  'double-charge-ask-narrative',
  'double-charge-ask-number',
  'double-charge-ask-type',
  'double-charge-ask-card-digits',
  'double-charge-ask-receipt',
  'double-charge-await-name',
  // loyalty card gather (Regola-A must also cover this — F101 pin)
  'loyalty-card-await-location',
  // display flows
  'display-reask-pending',
]

// ---------------------------------------------------------------------------
// test runner
// ---------------------------------------------------------------------------

let passed = 0
let failed = 0
const errors: string[] = []

async function run() {
  const runtime = await loadTestRuntime()

  for (const flow of PENDING_FLOWS) {
    const ar = makeAr(runtime, flow)
    let result: Awaited<ReturnType<typeof faqHandler>>
    try {
      result = await faqHandler({
        message: 'algún mensaje del cliente',
        ar,
        routerDetails: {},
        language: 'es',
      })
    } catch (err) {
      failed++
      errors.push(`  ✗ pendingFlow='${flow}' → threw: ${err}`)
      continue
    }

    if (result.handoff === 'delegate-to-legacy' && result.reply === '') {
      passed++
      console.log(`  ✓ pendingFlow='${flow}' → delegate-to-legacy`)
    } else {
      failed++
      errors.push(
        `  ✗ pendingFlow='${flow}' → expected delegate-to-legacy, got handoff='${result.handoff}' reply='${result.reply}'`,
      )
    }
  }

  // empty pendingFlow MUST NOT delegate (bot processes the FAQ normally)
  {
    const ar = makeAr(runtime, '')
    let result: Awaited<ReturnType<typeof faqHandler>>
    try {
      result = await faqHandler({
        message: 'algún mensaje del cliente',
        ar,
        routerDetails: {},
        language: 'es',
      })
      // with empty pendingFlow and no faqKey the handler hits the unknownKey
      // dead-end — that's fine, the important thing is it does NOT delegate
      if (result.handoff === 'delegate-to-legacy') {
        failed++
        errors.push(`  ✗ pendingFlow='' should NOT delegate, but got delegate-to-legacy`)
      } else {
        passed++
        console.log(`  ✓ pendingFlow='' → NOT delegated (handoff='${result.handoff}') — correct`)
      }
    } catch (err) {
      // handler may throw if runtime is incomplete — not what we're testing
      failed++
      errors.push(`  ✗ pendingFlow='' → threw: ${err}`)
    }
  }

  // summary
  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  if (errors.length) {
    for (const e of errors) console.error(e)
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
