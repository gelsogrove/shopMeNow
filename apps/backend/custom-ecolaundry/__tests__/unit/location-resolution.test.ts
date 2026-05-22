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
  // ── F79: landmark enumeration appended when customer says "no lo sé" ────
  {
    name: 'F79 insistLocation: "no lo sé" reply appends landmark enumeration (Mercadona, Carrefour, …)',
    run: () => {
      const ar = makeAr(2)
      const out = guardInsistLocation(ar, 'no lo sé')
      if (!out) throw new Error('expected reply, got null')
      if (!/Mercadona/i.test(out.reply)) {
        throw new Error(`expected reply to enumerate Mercadona landmark, got: ${out.reply}`)
      }
      if (!/Carrefour/i.test(out.reply)) {
        throw new Error(`expected reply to enumerate Carrefour landmark, got: ${out.reply}`)
      }
    },
  },
  {
    name: 'F79 insistLocation: enumeration preserves base followUp before landmarks',
    run: () => {
      const ar = makeAr(2)
      const out = guardInsistLocation(ar, 'no lo sé')
      if (!out) throw new Error('expected reply, got null')
      // Base i18n followUp ("Para poder ayudarte…") MUST appear before the
      // landmark list — semantically the followUp frames the question and
      // the landmark line is the actionable hint.
      const followUpIdx = out.reply.indexOf('Para poder ayudarte')
      const landmarkIdx = out.reply.indexOf('Mercadona')
      if (followUpIdx === -1 || landmarkIdx === -1) {
        throw new Error(`expected both followUp and landmark, got: ${out.reply}`)
      }
      if (followUpIdx > landmarkIdx) {
        throw new Error(`followUp must precede landmark enumeration, got: ${out.reply}`)
      }
    },
  },
  // ── F79: dontKnow regex covers all 6 languages ───────────────────────────
  {
    name: 'F79 insistLocation: IT "non lo so" → fires (was missing before F79)',
    run: () => {
      const ar = makeAr(2)
      const out = guardInsistLocation(ar, 'non lo so')
      if (!out) throw new Error('expected insist on "non lo so" (IT)')
    },
  },
  {
    name: 'F79 insistLocation: EN "I don\'t know" → fires',
    run: () => {
      const ar = makeAr(2)
      const out = guardInsistLocation(ar, "i don't know")
      if (!out) throw new Error("expected insist on \"i don't know\" (EN)")
    },
  },
  {
    name: 'F79 insistLocation: FR "je ne sais pas" → fires',
    run: () => {
      const ar = makeAr(2)
      const out = guardInsistLocation(ar, 'je ne sais pas')
      if (!out) throw new Error('expected insist on "je ne sais pas" (FR)')
    },
  },
  {
    name: 'F79 insistLocation: PT "não sei" → fires',
    run: () => {
      const ar = makeAr(2)
      const out = guardInsistLocation(ar, 'não sei')
      if (!out) throw new Error('expected insist on "não sei" (PT)')
    },
  },
  {
    name: 'F79 insistLocation: CA "no ho sé" → fires',
    run: () => {
      const ar = makeAr(2)
      const out = guardInsistLocation(ar, 'no ho sé')
      if (!out) throw new Error('expected insist on "no ho sé" (CA)')
    },
  },
  {
    name: 'F79 insistLocation: tenant with no landmarks → legacy single-sentence reply (no enumeration appended)',
    run: () => {
      const ar = makeAr(2)
      // Override runtime.locations to empty so listAllLandmarks returns [].
      // This exercises the graceful fallback when a future tenant ships
      // without landmark data.
      ar.runtime = { ...ar.runtime, locations: { locations: {} } }
      const out = guardInsistLocation(ar, 'no lo sé')
      if (!out) throw new Error('expected reply, got null')
      if (/Mercadona|Carrefour|Aldi/i.test(out.reply)) {
        throw new Error(`empty landmarks must NOT append enumeration, got: ${out.reply}`)
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
