// Standalone unit test (NO LLM) — F57 escalation category scoping.
//
// SCENARIO (real CLI session reported by Andrea 2026-05-15):
//   Customer opens a Caso 2 DOOR trouble flow (lavadora 5, DOOR), abandons it
//   without resolving (no "sí funciona"), then pivots to a Caso 8 discount
//   code escalation. The LLM-driven operator briefing was citing
//   "lavadora número 5 + DOOR" facts inherited from the unrelated trouble
//   flow, polluting the discount-code escalation summary.
//
// FIX (F57): `getEscalationCategory(state)` classifies the current escalation
// into one of:
//   - 'discount-code': customer + location + discountCode are the only
//     relevant facts.
//   - 'invoice': customer + location + invoiceData are relevant.
//   - 'non-trouble': customer + location + nonTroubleshootingIncident.
//   - 'machine-trouble' (default): machineType + machineNumber + displayLabel
//     + displayHistory are relevant.
//
// The category drives which STATE_FACTS lines are included in the LLM briefing
// payload — facts from unrelated flows are explicitly marked as "(not
// applicable ...)" so the LLM ignores them even if they appear in
// CONVERSATION_HISTORY.
//
// Run with:
//   node --import tsx __tests__/unit/escalation-category.test.ts

import { getEscalationCategory } from '../../utils/operator-briefing.js'
import { createInitialState } from '../../utils/state.js'

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  // ── 'discount-code' detection (3 paths) ─────────────────────────────────
  {
    name: 'F57: discountCodeData.letters present → discount-code',
    run: () => {
      const state = createInitialState()
      state.discountCodeData = {
        letters: 'SAU',
        fechaIso: '2026-05-15',
        importe: '6',
        doorClosed: true,
      }
      const c = getEscalationCategory(state)
      if (c !== 'discount-code') throw new Error(`expected discount-code, got ${c}`)
    },
  },
  {
    name: 'F57: pendingFlow starts with "discount-code-" → discount-code',
    run: () => {
      const state = createInitialState()
      state.pendingFlow = 'discount-code-await-name'
      const c = getEscalationCategory(state)
      if (c !== 'discount-code') throw new Error(`expected discount-code, got ${c}`)
    },
  },
  {
    name: 'F57: escalationReason mentions "código de descuento" → discount-code',
    run: () => {
      const state = createInitialState()
      state.escalationReason = 'código de descuento — código con formato no reconocido'
      const c = getEscalationCategory(state)
      if (c !== 'discount-code') throw new Error(`expected discount-code, got ${c}`)
    },
  },

  // ── 'invoice' detection (3 paths) ───────────────────────────────────────
  {
    name: 'F57: invoiceData.email present → invoice',
    run: () => {
      const state = createInitialState()
      state.invoiceData = {
        razonSocial: 'Acme SL',
        direccion: 'C/ Test 1',
        cif: 'B12345678',
        fecha: '15/5/2026',
        fechaIso: '2026-05-15',
        costeTotal: '6€',
        email: 'test@example.com',
        notes: '',
      }
      const c = getEscalationCategory(state)
      if (c !== 'invoice') throw new Error(`expected invoice, got ${c}`)
    },
  },
  {
    name: 'F57: pendingFlow starts with "invoice-" → invoice',
    run: () => {
      const state = createInitialState()
      state.pendingFlow = 'invoice-ask-email'
      const c = getEscalationCategory(state)
      if (c !== 'invoice') throw new Error(`expected invoice, got ${c}`)
    },
  },
  {
    name: 'F57: escalationReason "Invoice request" → invoice',
    run: () => {
      const state = createInitialState()
      state.escalationReason = 'Invoice request from customer'
      const c = getEscalationCategory(state)
      if (c !== 'invoice') throw new Error(`expected invoice, got ${c}`)
    },
  },

  // ── 'non-trouble' detection ─────────────────────────────────────────────
  {
    name: 'F57: nonTroubleshootingIncident set → non-trouble',
    run: () => {
      const state = createInitialState()
      state.nonTroubleshootingIncident = 'refund-demand'
      const c = getEscalationCategory(state)
      if (c !== 'non-trouble') throw new Error(`expected non-trouble, got ${c}`)
    },
  },

  // ── 'machine-trouble' default ────────────────────────────────────────────
  {
    name: 'F57: fresh state, no incident markers → machine-trouble (default)',
    run: () => {
      const state = createInitialState()
      const c = getEscalationCategory(state)
      if (c !== 'machine-trouble') throw new Error(`expected machine-trouble, got ${c}`)
    },
  },
  {
    name: 'F57: trouble state (machineType+displayState) → machine-trouble',
    run: () => {
      const state = createInitialState()
      state.machineType = 'washer'
      state.machineNumber = '5'
      state.displayState = 'DOOR'
      state.displayLabel = 'DOOR'
      const c = getEscalationCategory(state)
      if (c !== 'machine-trouble') throw new Error(`expected machine-trouble, got ${c}`)
    },
  },

  // ── Critical regression: state pollution does NOT prevent category swap ──
  {
    name: 'F57 REGRESSION: discount-code wins over polluted machine facts',
    run: () => {
      // Simulate the real bug: customer abandoned a trouble flow (machineType
      // / machineNumber / displayLabel / displayHistory still sticky) then
      // pivoted to a discount-code escalation. Category must be discount-code
      // (not machine-trouble), so the briefing scopes correctly.
      const state = createInitialState()
      state.machineType = 'washer'
      state.machineNumber = '5'
      state.displayState = 'DOOR'
      state.displayLabel = 'DOOR'
      state.displayHistory = ['DOOR']
      // Now the discount-code escalation triggers:
      state.escalationReason = 'código de descuento — formato no reconocido'
      const c = getEscalationCategory(state)
      if (c !== 'discount-code') {
        throw new Error(
          `F57 REGRESSION: polluted machine facts must NOT override discount-code category, got ${c}`,
        )
      }
    },
  },
  {
    name: 'F57 REGRESSION: invoice wins over polluted machine facts',
    run: () => {
      const state = createInitialState()
      state.machineType = 'washer'
      state.machineNumber = '5'
      state.displayState = 'DOOR'
      state.invoiceData = {
        razonSocial: 'Acme SL',
        direccion: '',
        cif: '',
        fecha: '',
        fechaIso: '',
        costeTotal: '',
        email: 'test@example.com',
        notes: '',
      }
      const c = getEscalationCategory(state)
      if (c !== 'invoice') {
        throw new Error(`F57 REGRESSION: invoice category must win, got ${c}`)
      }
    },
  },

  // ── Priority order: discount-code > invoice > non-trouble > machine-trouble ──
  {
    name: 'F57 priority: discount-code > invoice when both signals present',
    run: () => {
      // Edge case: state has BOTH discount-code AND invoice markers (e.g.
      // operator briefing fired during a transition). discount-code wins
      // because it appears first in the category check chain.
      const state = createInitialState()
      state.discountCodeData = {
        letters: 'SAU',
        fechaIso: '2026-05-15',
        importe: '6',
        doorClosed: true,
      }
      state.invoiceData = {
        razonSocial: 'Acme',
        direccion: '',
        cif: '',
        fecha: '',
        fechaIso: '',
        costeTotal: '',
        email: 'test@example.com',
        notes: '',
      }
      const c = getEscalationCategory(state)
      if (c !== 'discount-code') throw new Error(`expected discount-code priority, got ${c}`)
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
