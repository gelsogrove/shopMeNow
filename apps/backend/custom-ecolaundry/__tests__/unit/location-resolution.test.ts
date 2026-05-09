// Standalone unit test (NO LLM) — location-resolution guards.
//
// SCENARIO:
//   `guardForceLocation` is the architectural plug for the
//   "fact-out-of-order" hole. Without it, a customer who reports the
//   display BEFORE the location triggers this cascade:
//     - guardForce* skip (gated on !displayState)
//     - guardDisplayFlowStart skips (location missing in `requires`)
//     - guardInsist/UnknownLocation skip (only fire after a
//       clarification round)
//     → no guard wins, the LLM improvises, the bot drifts.
//
//   guardForceLocation MUST fire whenever location is empty after T2,
//   regardless of which other facts the customer has volunteered. The
//   only exemptions are escalation-style incidents that don't need
//   location (cameras / refund / compensation) and the active customer-
//   name capture phase.
//
// Run with:
//   node --import tsx __tests__/unit/location-resolution.test.ts

import {
  guardForceLocation,
  guardInsistLocation,
} from '../../utils/guards/location-resolution.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'
import { loadTestRuntime, getCachedTestRuntime } from './_helpers.js'

function makeAr(turnCount = 2): AgentRuntime {
  const ar: AgentRuntime = {
    state: createInitialState(),
    runtime: getCachedTestRuntime(),
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
  ar.state.turnCount = turnCount
  return ar
}

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  // ── guardForceLocation: catch-all for missing location ───────────────────
  {
    name: 'forceLocation: location empty + turnCount 2 → fires (asks location)',
    run: () => {
      const ar = makeAr(2)
      const out = guardForceLocation(ar, '')
      if (!out) throw new Error('expected location ask, got null')
      if (out.reason !== 'force-location') {
        throw new Error(`expected reason "force-location", got "${out.reason}"`)
      }
    },
  },
  {
    name: 'forceLocation: location set → null (no re-ask)',
    run: () => {
      const ar = makeAr(2)
      ar.state.location = 'Goya'
      const out = guardForceLocation(ar, '')
      if (out !== null) throw new Error('must skip when location is already set')
    },
  },
  {
    // REGRESSION: previous version skipped on turnCount<2 to "leave the
    // welcome path alone". But the LLM exploited that gap to improvise
    // a gather question on T1 when pendingFlow was set by autoExtract
    // (e.g. "Me habéis cobrado dos veces" → pendingFlow=
    // double-charge-ask-used → LLM jumped straight to "¿has podido
    // lavar?"). Now the guard fires from T1 too; the welcome paragraph
    // is prepended by applyGuardOutcome → shouldShowWelcome.
    name: 'forceLocation: T1 (turnCount=1) ALSO fires (rule #10 — close the LLM-improvise gap)',
    run: () => {
      const ar = makeAr(1)
      const out = guardForceLocation(ar, '')
      if (!out) throw new Error('REGRESSION: guard must fire on T1 to prevent LLM from improvising gather questions')
      if (out.reason !== 'force-location') {
        throw new Error(`expected reason "force-location", got "${out.reason}"`)
      }
    },
  },

  {
    // REGRESSION the bug closed (2026-05-09 evening): customer T1 says
    // "me han cobrado dos veces", autoExtract sets pendingFlow=
    // double-charge-ask-used. The deterministic guardDoubleChargeAskUsed
    // can't fire because location is still empty. forceLocation MUST
    // fire BEFORE the LLM gets a turn — otherwise the LLM improvises
    // "¿has podido lavar?" out of canonical order and the guard later
    // re-asks the same question once location arrives.
    name: 'forceLocation: T1 with pendingFlow=double-charge-ask-used → fires (no LLM improvise)',
    run: () => {
      const ar = makeAr(1)
      ar.state.pendingFlow = 'double-charge-ask-used'
      const out = guardForceLocation(ar, '')
      if (!out) {
        throw new Error('REGRESSION: forceLocation must fire when location is empty even at T1, regardless of pendingFlow')
      }
    },
  },

  // ── PATTERN A: display first, no location (the original bug) ─────────────
  {
    name: 'PATTERN A: displayState=AL001, location empty → fires (the bug fix)',
    run: () => {
      const ar = makeAr(2)
      ar.state.displayState = 'AL001'
      const out = guardForceLocation(ar, '')
      if (!out) {
        throw new Error('REGRESSION — bug 1 is back: forceLocation must fire when display is set without location')
      }
    },
  },

  // ── PATTERN B: type first, no location ───────────────────────────────────
  {
    name: 'PATTERN B: machineType=washer, location empty → fires',
    run: () => {
      const ar = makeAr(2)
      ar.state.machineType = 'washer'
      const out = guardForceLocation(ar, '')
      if (!out) throw new Error('forceLocation must fire when type is set without location')
    },
  },

  // ── PATTERN C: number first, no location ─────────────────────────────────
  {
    name: 'PATTERN C: machineNumber=5, location empty → fires',
    run: () => {
      const ar = makeAr(2)
      ar.state.machineNumber = '5'
      const out = guardForceLocation(ar, '')
      if (!out) throw new Error('forceLocation must fire when number is set without location')
    },
  },

  // ── PATTERN D: all three facts, no location ──────────────────────────────
  {
    name: 'PATTERN D: type+number+display, location empty → fires',
    run: () => {
      const ar = makeAr(2)
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'PUSH PROG'
      const out = guardForceLocation(ar, '')
      if (!out) throw new Error('forceLocation must fire even when all other facts are set')
    },
  },

  // ── Escape hatches: incidents that don't need location ──────────────────
  {
    name: 'forceLocation: nonTroubleshootingIncident=cameras-or-ajax → null (escalation path)',
    run: () => {
      const ar = makeAr(2)
      ar.state.nonTroubleshootingIncident = 'cameras-or-ajax'
      const out = guardForceLocation(ar, '')
      if (out !== null) throw new Error('cameras-or-ajax incident must NOT trigger location ask')
    },
  },
  {
    name: 'forceLocation: nonTroubleshootingIncident=refund-demand → null',
    run: () => {
      const ar = makeAr(2)
      ar.state.nonTroubleshootingIncident = 'refund-demand'
      const out = guardForceLocation(ar, '')
      if (out !== null) throw new Error('refund-demand must NOT trigger location ask')
    },
  },
  {
    name: 'forceLocation: nonTroubleshootingIncident=compensation-demand → null',
    run: () => {
      const ar = makeAr(2)
      ar.state.nonTroubleshootingIncident = 'compensation-demand'
      const out = guardForceLocation(ar, '')
      if (out !== null) throw new Error('compensation-demand must NOT trigger location ask')
    },
  },
  {
    name: 'forceLocation: nonTroubleshootingIncident=datafono-wrong-amount → fires (location IS needed)',
    run: () => {
      const ar = makeAr(2)
      ar.state.nonTroubleshootingIncident = 'datafono-wrong-amount'
      const out = guardForceLocation(ar, '')
      if (!out) throw new Error('datafono-wrong-amount NEEDS location for the operator')
    },
  },

  // ── Escape hatches: ongoing escalation ───────────────────────────────────
  {
    name: 'forceLocation: customerNameRequested → null (escalation in progress)',
    run: () => {
      const ar = makeAr(3)
      ar.state.customerNameRequested = true
      const out = guardForceLocation(ar, '')
      if (out !== null) throw new Error('must NOT interrupt name-capture')
    },
  },
  {
    name: 'forceLocation: operatorRequested → null (already escalated)',
    run: () => {
      const ar = makeAr(3)
      ar.state.operatorRequested = true
      const out = guardForceLocation(ar, '')
      if (out !== null) throw new Error('must NOT interrupt active operator handoff')
    },
  },
  {
    name: 'forceLocation: pendingFlow=invoice-ask-location → null (invoice owns the ask)',
    run: () => {
      const ar = makeAr(3)
      ar.state.pendingFlow = 'invoice-ask-location'
      const out = guardForceLocation(ar, '')
      if (out !== null) {
        throw new Error('invoice flow already asks location with its own copy — no double-ask')
      }
    },
  },

  // ── guardInsistLocation: unchanged behaviour (regression check) ─────────
  {
    name: 'insistLocation: customer says "no lo sé" → fires',
    run: () => {
      const ar = makeAr(2)
      const out = guardInsistLocation(ar, 'no lo sé')
      if (!out) throw new Error('expected insist on "no lo sé"')
    },
  },
  {
    name: 'insistLocation: customer says other text → null (forceLocation handles it)',
    run: () => {
      const ar = makeAr(2)
      const out = guardInsistLocation(ar, 'la lavadora no funciona')
      if (out !== null) throw new Error('insistLocation only fires on "no lo sé"-class replies')
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
