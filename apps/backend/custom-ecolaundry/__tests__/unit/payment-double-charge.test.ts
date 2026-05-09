// Standalone unit test (NO LLM) — payment-double-charge guards.
//
// SCENARIO:
//   The Caso 6 (doble cobro) flow has two branching decision points:
//
//   A) `guardDoubleChargeAskNarrative` consumes the answer to "¿podido
//      lavar/secar?" and branches:
//        "Sí" → Scenario 6.1 (continue to relato + 4 digits + receipt)
//        "No" → Scenario 6.4 (escalate immediately)
//
//   B) `guardDoubleChargeAskReceipt` consumes the customer's reply to
//      "últimos 4 dígitos de la tarjeta" and validates it:
//        4 digits exactly → continue to receipt + closure
//        invalid (3, 5, no digits, etc.) → re-ask politely
//        2nd invalid in a row → escalate
//
// This file pins both branches so a regression in either is caught
// before reaching production.
//
// Run with:
//   node --import tsx __tests__/unit/payment-double-charge.test.ts

import {
  guardDoubleChargeAskNarrative,
  guardDoubleChargeAskReceipt,
} from '../../utils/guards/payment-double-charge.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'
import { loadTestRuntime, getCachedTestRuntime } from './_helpers.js'

function makeAr(): AgentRuntime {
  const ar: AgentRuntime = {
    state: createInitialState(),
    runtime: getCachedTestRuntime(),
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
  ar.state.location = 'Goya'
  ar.state.machineType = 'washer'
  ar.state.machineNumber = '5'
  ar.state.turnCount = 4
  return ar
}

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  // ── guardDoubleChargeAskNarrative — branch on yes/no ──────────────────────
  {
    name: 'narrative branch: "Sí, he lavado" → continue (relato gather, no escalation)',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'double-charge-ask-narrative'
      const out = guardDoubleChargeAskNarrative(ar, 'Sí, he lavado')
      if (!out) throw new Error('guard must fire on yes branch')
      if (out.reason !== 'double-charge-ask-narrative') {
        throw new Error(`expected continue (ask-narrative), got ${out.reason}`)
      }
      if (ar.state.pendingFlow !== 'double-charge-ask-card-digits') {
        throw new Error(`pendingFlow must advance to ask-card-digits, got ${ar.state.pendingFlow}`)
      }
      if (ar.pendingEscalation) throw new Error('no escalation on yes branch')
      if (!/used service: yes/.test(ar.state.issueSummary || '')) {
        throw new Error(`issueSummary must record "used service: yes": ${ar.state.issueSummary}`)
      }
    },
  },
  {
    name: 'narrative branch: "no" → escalation immediata (Scenario 6.4)',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'double-charge-ask-narrative'
      const out = guardDoubleChargeAskNarrative(ar, 'no')
      if (!out) throw new Error('guard must fire on no branch')
      if (out.reason !== 'double-charge-not-used-escalate') {
        throw new Error(`expected escalation, got ${out.reason}`)
      }
      if (!ar.state.operatorRequested) throw new Error('escalation must be triggered')
      if (!/used service: no/.test(ar.state.issueSummary || '')) {
        throw new Error(`issueSummary must record "used service: no": ${ar.state.issueSummary}`)
      }
    },
  },
  {
    name: 'narrative branch: "no he podido" (long phrasing) → still escalates',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'double-charge-ask-narrative'
      const out = guardDoubleChargeAskNarrative(ar, 'no he podido usar la lavadora')
      if (!out || out.reason !== 'double-charge-not-used-escalate') {
        throw new Error(`expected escalation on "no he podido…", got ${out?.reason}`)
      }
    },
  },

  // ── guardDoubleChargeAskReceipt — 4-digit validation ──────────────────────
  {
    name: 'digits VALID: "4821" → continue to receipt + closure',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'double-charge-ask-receipt'
      ar.state.issueSummary = 'double charge — used service: yes'
      const out = guardDoubleChargeAskReceipt(ar, '4821')
      if (!out) throw new Error('guard must fire on valid digits')
      if (out.reason !== 'double-charge-ask-receipt') {
        throw new Error(`expected receipt step, got ${out.reason}`)
      }
      if (!ar.state.operatorRequested) {
        throw new Error('receipt step also escalates (refund handover)')
      }
    },
  },
  {
    name: 'digits VALID: "los últimos son 4821, gracias" (narrative around) → accepted',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'double-charge-ask-receipt'
      ar.state.issueSummary = 'double charge — used service: yes'
      const out = guardDoubleChargeAskReceipt(ar, 'los últimos son 4821, gracias')
      if (out?.reason !== 'double-charge-ask-receipt') {
        throw new Error(`narrative + 4 digits must be accepted, got ${out?.reason}`)
      }
    },
  },
  {
    name: 'digits INVALID: "48215" (5 digits) → retry, counter = 1',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'double-charge-ask-receipt'
      const out = guardDoubleChargeAskReceipt(ar, '48215')
      if (!out) throw new Error('guard must fire on invalid digits')
      if (out.reason !== 'double-charge-card-digits-retry') {
        throw new Error(`expected retry, got ${out.reason}`)
      }
      if (ar.state.cardDigitsAskAttempts !== 1) {
        throw new Error(`counter must be 1, got ${ar.state.cardDigitsAskAttempts}`)
      }
      if (ar.state.pendingFlow !== 'double-charge-ask-receipt') {
        throw new Error('pendingFlow must stay so guard fires again next turn')
      }
      if (ar.state.operatorRequested) throw new Error('NO escalation on first invalid')
    },
  },
  {
    name: 'digits INVALID: "482" (3 digits) → retry',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'double-charge-ask-receipt'
      const out = guardDoubleChargeAskReceipt(ar, '482')
      if (out?.reason !== 'double-charge-card-digits-retry') {
        throw new Error(`expected retry on 3 digits, got ${out?.reason}`)
      }
    },
  },
  {
    name: 'digits INVALID: "no me acuerdo" (no digits) → retry',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'double-charge-ask-receipt'
      const out = guardDoubleChargeAskReceipt(ar, 'no me acuerdo')
      if (out?.reason !== 'double-charge-card-digits-retry') {
        throw new Error(`expected retry on no-digits, got ${out?.reason}`)
      }
    },
  },
  {
    name: 'digits INVALID: "1234 5678" (8 digits = 2 chunks) → retry (ambiguous)',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'double-charge-ask-receipt'
      const out = guardDoubleChargeAskReceipt(ar, '1234 5678')
      if (out?.reason !== 'double-charge-card-digits-retry') {
        throw new Error(`ambiguous (2 4-digit chunks) must retry, got ${out?.reason}`)
      }
    },
  },
  {
    name: 'digits 2ND INVALID: counter reaches 2 → escalate',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'double-charge-ask-receipt'
      ar.state.cardDigitsAskAttempts = 1 // already retried once
      const out = guardDoubleChargeAskReceipt(ar, '482')
      if (!out) throw new Error('guard must fire')
      if (out.reason !== 'double-charge-card-digits-escalate') {
        throw new Error(`expected escalation on 2nd invalid, got ${out.reason}`)
      }
      if (!ar.state.operatorRequested) throw new Error('operator must be flagged')
      if (!ar.state.customerNameRequested) throw new Error('name capture must follow')
      if (ar.state.cardDigitsAskAttempts !== 0) {
        throw new Error(`counter must reset on escalation, got ${ar.state.cardDigitsAskAttempts}`)
      }
    },
  },
  {
    name: 'digits VALID after retry: counter resets, flow continues',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'double-charge-ask-receipt'
      ar.state.cardDigitsAskAttempts = 1 // retried once already
      ar.state.issueSummary = 'double charge — used service: yes'
      const out = guardDoubleChargeAskReceipt(ar, '4821')
      if (out?.reason !== 'double-charge-ask-receipt') {
        throw new Error(`valid digits after retry must continue, got ${out?.reason}`)
      }
      if (ar.state.cardDigitsAskAttempts !== 0) {
        throw new Error(`counter must reset on success, got ${ar.state.cardDigitsAskAttempts}`)
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

main()
