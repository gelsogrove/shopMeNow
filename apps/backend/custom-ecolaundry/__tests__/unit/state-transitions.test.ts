// Standalone unit test (NO LLM) — atomic state transitions.
//
// SCENARIO (Iron rule #4 from CLAUDE.md):
//   Mutations of pendingClosure / operatorRequested / pendingEscalation /
//   customerNameRequested / escalationReason MUST go through
//   utils/state-transitions.ts. This file verifies that each transition
//   sets exactly the fields it claims, and that round-trips (markResolved
//   ↔ undoResolved) are clean.
//
// Run with:
//   node --import tsx __tests__/unit/state-transitions.test.ts

import {
  captureCustomerName,
  closeAsEscalated,
  escalate,
  markResolved,
  requireCustomerName,
  resetForNewIncident,
  resetPostEscalationFlags,
  startNewFlow,
  undoResolved,
} from '../../utils/state-transitions.js'
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

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  {
    name: 'markResolved sets resolved=true and pendingClosure=resolved',
    run: () => {
      const ar = makeAr()
      markResolved(ar)
      if (ar.resolved !== true) throw new Error('resolved must be true')
      if (ar.state.pendingClosure !== 'resolved') {
        throw new Error(`pendingClosure must be "resolved", got "${ar.state.pendingClosure}"`)
      }
    },
  },
  // F36 (Andrea 2026-05-11): markResolved must ALSO clear escalation flags.
  // Without this, when mark_resolved fires mid-name-capture (customer said
  // "si funciona" while operatorRequested=true), the residual flags pollute
  // the next turn — bug surfaced when customer asked for a factura right
  // after a resolution: bot captured "posso" (first word of "posso avere
  // la fattura") as the customer name and appended the OLD handover summary.
  {
    name: 'markResolved F36: clears operatorRequested + customerNameRequested + pendingEscalation',
    run: () => {
      const ar = makeAr()
      // Simulate an in-flight escalation when mark_resolved fires.
      ar.state.operatorRequested = true
      ar.state.customerNameRequested = true
      ar.state.escalationReason = 'Some prior escalation reason'
      ar.pendingEscalation = { reason: 'Some prior escalation reason' }
      markResolved(ar)
      if (ar.state.operatorRequested !== false) {
        throw new Error('operatorRequested must be cleared after markResolved')
      }
      if (ar.state.customerNameRequested !== false) {
        throw new Error('customerNameRequested must be cleared after markResolved')
      }
      if (ar.state.escalationReason !== '') {
        throw new Error(`escalationReason must be cleared, got "${ar.state.escalationReason}"`)
      }
      if (ar.pendingEscalation !== null) {
        throw new Error('pendingEscalation must be null after markResolved')
      }
    },
  },
  {
    name: 'undoResolved reverts markResolved',
    run: () => {
      const ar = makeAr()
      markResolved(ar)
      undoResolved(ar)
      if (ar.resolved !== false) throw new Error('resolved must be false')
      if (ar.state.pendingClosure !== null) {
        throw new Error('pendingClosure must be null after undo')
      }
    },
  },
  {
    name: 'undoResolved preserves a non-resolved closure (e.g. escalated)',
    run: () => {
      const ar = makeAr()
      ar.state.pendingClosure = 'escalated'
      ar.resolved = true
      undoResolved(ar)
      // resolved is cleared, but the escalated closure must NOT be wiped.
      if (ar.resolved !== false) throw new Error('resolved must be false')
      if (ar.state.pendingClosure !== 'escalated') {
        throw new Error('escalated closure must be preserved across undoResolved')
      }
    },
  },
  {
    name: 'escalate sets escalationReason + operatorRequested + pendingEscalation',
    run: () => {
      const ar = makeAr()
      escalate(ar, 'caso 5 — AL001 persists')
      if (ar.state.escalationReason !== 'caso 5 — AL001 persists') {
        throw new Error(`escalationReason mismatch: ${ar.state.escalationReason}`)
      }
      if (ar.state.operatorRequested !== true) throw new Error('operatorRequested must be true')
      if (!ar.pendingEscalation || ar.pendingEscalation.reason !== 'caso 5 — AL001 persists') {
        throw new Error('pendingEscalation.reason mismatch')
      }
    },
  },
  {
    name: 'requireCustomerName sets customerNameRequested=true',
    run: () => {
      const ar = makeAr()
      requireCustomerName(ar)
      if (ar.state.customerNameRequested !== true) throw new Error('flag must be true')
    },
  },
  {
    name: 'captureCustomerName stores the name AND clears the request flag',
    run: () => {
      const ar = makeAr()
      requireCustomerName(ar)
      captureCustomerName(ar, 'Andrea')
      if (ar.state.customerName !== 'Andrea') throw new Error('customerName not stored')
      if (ar.state.customerNameRequested !== false) {
        throw new Error('customerNameRequested must be false after capture')
      }
    },
  },
  {
    name: 'closeAsEscalated sets pendingClosure=escalated and nothing else',
    run: () => {
      const ar = makeAr()
      closeAsEscalated(ar)
      if (ar.state.pendingClosure !== 'escalated') {
        throw new Error(`pendingClosure must be "escalated", got "${ar.state.pendingClosure}"`)
      }
      // Sanity: closeAsEscalated alone does NOT touch operatorRequested or
      // pendingEscalation — those are set earlier by escalate(). This test
      // pins the separation.
      if (ar.state.operatorRequested !== false) {
        throw new Error('closeAsEscalated must NOT set operatorRequested')
      }
    },
  },
  {
    name: 'resetPostEscalationFlags clears every escalation flag',
    run: () => {
      const ar = makeAr()
      escalate(ar, 'some reason')
      requireCustomerName(ar)
      closeAsEscalated(ar)
      resetPostEscalationFlags(ar)
      if (ar.state.operatorRequested !== false) throw new Error('operatorRequested')
      if (ar.state.customerNameRequested !== false) throw new Error('customerNameRequested')
      if (ar.state.escalationReason !== '') throw new Error('escalationReason')
      if (ar.state.pendingClosure !== null) throw new Error('pendingClosure')
      if (ar.pendingEscalation !== null) throw new Error('pendingEscalation')
    },
  },
  {
    name: 'startNewFlow binds activeFlowId, clears stepId + escalation flags',
    run: () => {
      const ar = makeAr()
      escalate(ar, 'old reason')
      requireCustomerName(ar)
      ar.state.activeStepId = 'old-step'
      startNewFlow(ar, 'alm-door-blocked')
      if (ar.state.activeFlowId !== 'alm-door-blocked') throw new Error('activeFlowId mismatch')
      if (ar.state.activeStepId !== null) throw new Error('activeStepId must be null')
      if (ar.state.operatorRequested !== false) throw new Error('operatorRequested must be cleared')
      if (ar.state.customerNameRequested !== false) {
        throw new Error('customerNameRequested must be cleared')
      }
      if (ar.pendingEscalation !== null) {
        throw new Error('pendingEscalation must be null on new flow')
      }
    },
  },
  {
    name: 'startNewFlow preserves sticky customer facts (name, location)',
    run: () => {
      const ar = makeAr()
      ar.state.customerName = 'María'
      ar.state.location = 'Pineda'
      startNewFlow(ar, 'al001-sequence-error')
      if (ar.state.customerName !== 'María') throw new Error('customerName lost')
      if (ar.state.location !== 'Pineda') throw new Error('location lost')
    },
  },
  {
    name: 'resetForNewIncident wipes machine facts but keeps customer + location',
    run: () => {
      const ar = makeAr()
      ar.state.customerName = 'María'
      ar.state.location = 'Pineda'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'PUSH'
      resetForNewIncident(ar)
      if (ar.state.customerName !== 'María') throw new Error('customerName must persist')
      if (ar.state.location !== 'Pineda') throw new Error('location must persist')
      if (ar.state.machineType !== null && ar.state.machineType !== '') {
        throw new Error('machineType must be wiped')
      }
      if (ar.state.machineNumber !== null && ar.state.machineNumber !== '') {
        throw new Error('machineNumber must be wiped')
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
