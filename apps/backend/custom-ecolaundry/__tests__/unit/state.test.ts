// Standalone unit test (NO LLM) — state factory + resetMachineFacts.
//
// SCENARIO:
//   createInitialState() must return a SessionState with all required
//   fields initialised to safe defaults (no undefined, no leftover from a
//   previous session). resetMachineFacts() must wipe machine-incident
//   facts while preserving customer + location identity.
//
// Run with:
//   node --import tsx __tests__/unit/state.test.ts

import { createInitialState, resetMachineFacts } from '../../utils/state.js'

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  {
    name: 'createInitialState returns SessionState with required fields',
    run: () => {
      const s = createInitialState()
      // Identity / sticky facts
      if (s.location !== '') throw new Error('location must default to ""')
      if (s.customerName !== null) throw new Error('customerName must default to null')
      if (s.language !== 'en') throw new Error('language must default to "en"')
      // Conversation control flags
      if (s.operatorRequested !== false) throw new Error('operatorRequested must be false')
      if (s.customerNameRequested !== false) throw new Error('customerNameRequested must be false')
      if (s.pendingClosure !== null) throw new Error('pendingClosure must be null')
      if (s.pendingFlow !== '') throw new Error('pendingFlow must be ""')
      if (s.activeFlowId !== null) throw new Error('activeFlowId must be null')
      // Counters
      if (s.turnCount !== 0) throw new Error('turnCount must be 0')
      if (s.retryCount !== 0) throw new Error('retryCount must be 0')
      // Sub-objects
      if (typeof s.invoiceData !== 'object') throw new Error('invoiceData must be an object')
      if (s.invoiceData.email !== '') throw new Error('invoiceData.email must be ""')
      if (typeof s.discountCodeData !== 'object') throw new Error('discountCodeData must be an object')
      if (s.discountCodeData.doorClosed !== null) {
        throw new Error('discountCodeData.doorClosed must be null')
      }
    },
  },
  {
    name: 'createInitialState produces independent objects (no shared sub-object refs)',
    run: () => {
      const a = createInitialState()
      const b = createInitialState()
      a.invoiceData.email = 'foo@example.com'
      if (b.invoiceData.email === 'foo@example.com') {
        throw new Error('invoiceData reference is shared between fresh states')
      }
      a.discountCodeData.letters = 'SAU'
      if (b.discountCodeData.letters === 'SAU') {
        throw new Error('discountCodeData reference is shared between fresh states')
      }
    },
  },
  {
    name: 'resetMachineFacts wipes machine-incident facts',
    run: () => {
      const s = createInitialState()
      s.machineType = 'washer'
      s.machineNumber = '5'
      s.displayState = 'PUSH'
      s.paymentCompleted = true
      s.activeFlowId = 'al001-sequence-error'
      s.activeStepId = 'step-2'
      s.pendingFlow = 'no-change-await-confirm'
      s.displayUnreadable = true
      s.photoRequested = true
      s.mixedIncident = true
      s.nonTroubleshootingIncident = 'datafono-wrong-amount'
      s.retryCount = 3
      s.lastMissingFacts = ['displayState']

      resetMachineFacts(s)

      if (s.machineType !== '') throw new Error('machineType not wiped')
      if (s.machineNumber !== '') throw new Error('machineNumber not wiped')
      if (s.displayState !== '') throw new Error('displayState not wiped')
      if (s.paymentCompleted !== null) throw new Error('paymentCompleted not wiped')
      if (s.activeFlowId !== null) throw new Error('activeFlowId not wiped')
      if (s.activeStepId !== null) throw new Error('activeStepId not wiped')
      if (s.pendingFlow !== '') throw new Error('pendingFlow not wiped')
      if (s.displayUnreadable !== false) throw new Error('displayUnreadable not wiped')
      if (s.photoRequested !== false) throw new Error('photoRequested not wiped')
      if (s.mixedIncident !== false) throw new Error('mixedIncident not wiped')
      if (s.nonTroubleshootingIncident !== '') throw new Error('nonTroubleshootingIncident not wiped')
      if (s.retryCount !== 0) throw new Error('retryCount not wiped')
      if (s.lastMissingFacts.length !== 0) throw new Error('lastMissingFacts not wiped')
    },
  },
  {
    name: 'resetMachineFacts preserves customer + location identity',
    run: () => {
      const s = createInitialState()
      s.customerName = 'María'
      s.customerPhone = '+34600000000'
      s.location = 'Pineda'
      s.locationStreet = 'Calle Pineda'
      s.language = 'es'
      s.machineType = 'washer'
      s.displayState = 'PUSH'

      resetMachineFacts(s)

      if (s.customerName !== 'María') throw new Error('customerName must persist')
      if (s.customerPhone !== '+34600000000') throw new Error('customerPhone must persist')
      if (s.location !== 'Pineda') throw new Error('location must persist')
      if (s.locationStreet !== 'Calle Pineda') throw new Error('locationStreet must persist')
      if (s.language !== 'es') throw new Error('language must persist')
      // And machine fields are gone
      if (s.machineType !== '') throw new Error('machineType not wiped')
      if (s.displayState !== '') throw new Error('displayState not wiped')
    },
  },
  {
    name: 'resetMachineFacts is idempotent on a fresh state',
    run: () => {
      const s = createInitialState()
      resetMachineFacts(s)
      // Should not throw, and the state should still pass the initial-state contract.
      if (s.machineType !== '') throw new Error('machineType must remain ""')
      if (s.activeFlowId !== null) throw new Error('activeFlowId must remain null')
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
