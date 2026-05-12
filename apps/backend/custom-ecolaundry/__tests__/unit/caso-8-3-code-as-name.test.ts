// F46 — usecases.md §8.3 pin: customer typed a discount code in the name field.
//
// PURPOSE
// =======
// Real chat (Andrea, 2026-05-12):
//   bot: ¡Gracias! ¿Cuál es tu nombre?
//   usr: SAU2904266           ← another discount code, NOT a name
//   bot: ¿En qué pueblo / lavandería?   ← BUG: accepted as name, advanced
//
// Pre-F46: `validateCustomerName` only refused confirmation words / digit-
// only / <2-char tokens; an alphanumeric uppercase token like "SAU2904266"
// passed.
//
// Post-F46: `validateCustomerName(raw, { discountCodePrefix })` composes
// `looksLikeDiscountCode` — a token matching the tenant code shape is
// rejected with a deterministic reason. The guard `guardDiscountCodeAwaitName`
// (state-level) keeps `pendingFlow='discount-code-await-name'`, increments
// `awaitNameAskAttempts`, and re-asks via `t('customerNameAsk', lang)`.
// After 2 invalid attempts the existing retry ladder escalates.
//
// This test pins:
//   1. Single-turn rejection: validator says invalid + reason mentions code.
//   2. State-level ladder via the guard: 1st invalid → re-ask, 2nd invalid →
//      escalate + requireCustomerName.
//
// Run with:
//   node --import tsx __tests__/unit/caso-8-3-code-as-name.test.ts

import { guardDiscountCodeAwaitName } from '../../utils/guards/discount-code-flow.js'
import { validateCustomerName } from '../../utils/customer-name.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'
import { getCachedTestRuntime, loadTestRuntime } from './_helpers.js'

function makeAr(): AgentRuntime {
  return {
    state: createInitialState(),
    runtime: getCachedTestRuntime(),
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
}

let pass = 0
let fail = 0

function check(label: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`)
    pass += 1
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? `\n      ${detail}` : ''}`)
    fail += 1
  }
}

async function main(): Promise<void> {
  await loadTestRuntime()
  console.log('caso 8.3 — code-shaped token in name field (F46)')

  // ── Single-turn validator behaviour ───────────────────────────────────
  console.log('\nvalidator-level')
  {
    const r = validateCustomerName('SAU2904266', { discountCodePrefix: 'SAU' })
    check(
      'rejects "SAU2904266" with reason mentioning "discount code"',
      r.valid === false && /discount code/i.test(r.reason),
      `got: ${JSON.stringify(r)}`,
    )
  }
  {
    const r = validateCustomerName('Andrea', { discountCodePrefix: 'SAU' })
    check(
      'still accepts "Andrea" as a name (no false positive)',
      r.valid === true && r.name === 'Andrea',
      `got: ${JSON.stringify(r)}`,
    )
  }

  // ── Guard-level state ladder ─────────────────────────────────────────
  console.log('\nguard-level (state ladder)')

  // Conversación A — recovered on the 2nd reply
  {
    const ar = makeAr()
    ar.state.pendingFlow = 'discount-code-await-name'
    ar.state.discountCodeData = { letters: 'SAU', fechaIso: '2026-04-29', importe: '6', doorClosed: false }

    // 1st invalid: code-shaped token → re-ask, counter incremented to 1, flow stays.
    const r1 = guardDiscountCodeAwaitName(ar, 'SAU2904266')
    check(
      'A: 1st invalid (code-shape) → guard re-asks the name',
      r1 !== null && r1.reason === 'discount-code-await-name-reask',
      `got: ${JSON.stringify(r1)}`,
    )
    check(
      'A: 1st invalid → pendingFlow stays discount-code-await-name',
      ar.state.pendingFlow === 'discount-code-await-name',
    )
    check(
      'A: 1st invalid → awaitNameAskAttempts === 1',
      ar.state.awaitNameAskAttempts === 1,
      `got: ${ar.state.awaitNameAskAttempts}`,
    )
    check(
      'A: 1st invalid → no escalation flags set yet',
      ar.state.operatorRequested === false && ar.state.customerNameRequested === false,
    )

    // 2nd reply: a real name → captured, counter resets, flow advances.
    const r2 = guardDiscountCodeAwaitName(ar, 'Andrea')
    check(
      'A: 2nd reply with real name → captureCustomerName + flow advances',
      r2 !== null && ar.state.customerName === 'Andrea' && ar.state.awaitNameAskAttempts === 0,
      `got: ${JSON.stringify(r2)} customerName=${ar.state.customerName} attempts=${ar.state.awaitNameAskAttempts}`,
    )
  }

  // Conversación B — escalation after the 3rd invalid attempt
  // (3-strikes ladder via nextRetryLadderStep: 1st & 2nd → re-ask, 3rd → escalate).
  {
    const ar = makeAr()
    ar.state.pendingFlow = 'discount-code-await-name'
    ar.state.discountCodeData = { letters: 'SAU', fechaIso: '2026-04-29', importe: '6', doorClosed: false }

    const r1 = guardDiscountCodeAwaitName(ar, 'SAU2904266')
    check(
      'B: 1st invalid (code-shape) → re-ask',
      r1 !== null && r1.reason === 'discount-code-await-name-reask',
    )

    const r2 = guardDiscountCodeAwaitName(ar, 'sau2904266')
    check(
      'B: 2nd invalid (code-shape lowercase) → re-ask',
      r2 !== null && r2.reason === 'discount-code-await-name-reask',
      `got: ${JSON.stringify(r2)}`,
    )

    // 3rd invalid → escalation via retry ladder.
    const r3 = guardDiscountCodeAwaitName(ar, 'SAU2904266')
    check(
      'B: 3rd invalid → escalate',
      r3 !== null && r3.reason === 'discount-code-await-name-escalate',
      `got: ${JSON.stringify(r3)}`,
    )
    check(
      'B: 3rd invalid → operatorRequested + customerNameRequested set by escalation',
      ar.state.operatorRequested === true && ar.state.customerNameRequested === true,
    )
    check(
      'B: 3rd invalid → pendingFlow cleared (no longer in await-name)',
      ar.state.pendingFlow === '',
    )
  }

  console.log(`\n${pass} passed, ${fail} failed (out of ${pass + fail})`)
  if (fail > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
