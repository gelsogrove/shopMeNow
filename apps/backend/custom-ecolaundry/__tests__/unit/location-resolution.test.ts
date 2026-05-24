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
  guardMataroStreet,
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

  // ── F89: guardInsistLocation fires at T1 (no turnCount gate) ────────────────
  // Regression: previously turnCount < 2 blocked the guard on the FIRST message.
  // Customer writing "i dont know" as their very first message must get the
  // landmark enumeration immediately, not the generic location ask.
  {
    name: 'F89 insistLocation: EN "i dont know" at T1 (no apostrophe) → fires',
    run: () => {
      const ar = makeAr(1)  // T1
      const out = guardInsistLocation(ar, 'i dont know')
      if (!out) throw new Error('F89: expected insist on "i dont know" at T1 (no apostrophe)')
    },
  },
  {
    name: "F89 insistLocation: EN \"i don't know\" at T1 (with apostrophe) → fires",
    run: () => {
      const ar = makeAr(1)  // T1
      const out = guardInsistLocation(ar, "i don't know")
      if (!out) throw new Error("F89: expected insist on \"i don't know\" at T1")
    },
  },
  {
    name: 'F89 insistLocation: ES "no lo sé" at T1 → fires',
    run: () => {
      const ar = makeAr(1)
      const out = guardInsistLocation(ar, 'no lo sé')
      if (!out) throw new Error('F89: expected insist on "no lo sé" at T1')
    },
  },

  // ── F82 — guardMataroStreet: "non lo so" shows Goya landmarks ───────────────
  {
    name: 'F82 guardMataroStreet: first ask → emits mataroStreet question',
    run: () => {
      const ar = makeAr(2)
      ar.state.location = 'Mataro'
      // locationStreetRequested is NOT yet set → first ask
      const out = guardMataroStreet(ar, 'Mataró')
      if (!out) throw new Error('expected mataroStreet reply on first ask')
      if (out.reason !== 'mataro-street') throw new Error(`expected reason=mataro-street, got "${out.reason}"`)
      if (!ar.state.locationStreetRequested) throw new Error('locationStreetRequested must be set after first ask')
    },
  },
  {
    name: 'F82 guardMataroStreet: already asked + "non lo so" → show Goya landmarks (Mercadona/Biblioteca)',
    run: () => {
      const ar = makeAr(3)
      ar.state.location = 'Mataro'
      ar.state.locationStreetRequested = true  // already asked
      const out = guardMataroStreet(ar, 'non lo so')
      if (!out) throw new Error('expected landmark reply on "non lo so"')
      if (out.reason !== 'mataro-street-insist') throw new Error(`expected reason=mataro-street-insist, got "${out.reason}"`)
      if (!/Mercadona|Biblioteca/i.test(out.reply)) {
        throw new Error(`F82: reply must mention Goya landmarks (Mercadona/Biblioteca), got: ${out.reply}`)
      }
    },
  },
  {
    name: 'F82 guardMataroStreet: already asked + "no lo sé" (ES) → show Goya landmarks',
    run: () => {
      const ar = makeAr(3)
      ar.state.location = 'Mataro'
      ar.state.locationStreetRequested = true
      const out = guardMataroStreet(ar, 'no lo sé')
      if (!out) throw new Error('expected reply on ES "no lo sé"')
      if (out.reason !== 'mataro-street-insist') throw new Error(`expected mataro-street-insist, got "${out.reason}"`)
    },
  },
  {
    name: 'F82 guardMataroStreet: locationStreet already known → null (guard skips)',
    run: () => {
      const ar = makeAr(3)
      ar.state.location = 'Mataro'
      ar.state.locationStreet = 'Goya'
      const out = guardMataroStreet(ar, 'non lo so')
      if (out !== null) throw new Error('must skip when locationStreet already known')
    },
  },
  {
    name: 'F82 guardMataroStreet: non-Mataro location → null',
    run: () => {
      const ar = makeAr(2)
      ar.state.location = 'Hortes'
      const out = guardMataroStreet(ar, 'non lo so')
      if (out !== null) throw new Error('must skip for non-Mataro location')
    },
  },

  // ── F100 — guardMataroStreet preserves loyalty topic across Mataró disambiguation ─
  // Real bug: IT "ciao sono a Mataró posso usare una tessera di fidelizzazione
  // comprata in un altra lavanderia?" + T2 "Goya" → bot improvised "no estoy
  // seguro" instead of emitting the per-location loyalty reply.
  // Root cause: guardMataroStreet won at T1 (Mataró ambiguous), pendingFlow and
  // faqTopic were NOT set → loyalty context lost. At T2 "Goya", neither
  // TARJETA_TOPIC.test("Goya") nor faqTopic matched → no guard fired.
  // Fix: guardMataroStreet sets state.faqTopic='buy-loyalty-card' when
  // TARJETA_TOPIC matches, so guardLoyaltyCardBuy fires at T2 via askedTarjeta.
  {
    name: 'F100 guardMataroStreet: loyalty message → sets faqTopic=buy-loyalty-card',
    run: () => {
      const ar = makeAr(2)
      ar.state.location = 'Mataró'
      const msg = 'posso usare una tessera di fidelizzazione comprata in un altra lavanderia?'
      const out = guardMataroStreet(ar, msg)
      if (!out) throw new Error('F100: expected mataroStreet reply on loyalty+Mataró message')
      if (ar.state.faqTopic !== 'buy-loyalty-card') {
        throw new Error(`F100: faqTopic must be 'buy-loyalty-card', got '${ar.state.faqTopic}'`)
      }
    },
  },
  {
    name: 'F100 guardMataroStreet: real-bug phrase IT → sets faqTopic and emits street ask',
    run: () => {
      const ar = makeAr(2)
      ar.state.location = 'Mataró'
      const msg = 'ciao sono a Mataró posso usare una tessera di fidelizzazione comprata in un altra lavanderia?'
      const out = guardMataroStreet(ar, msg)
      if (!out) throw new Error('F100: expected mataroStreet reply')
      if (out.reason !== 'mataro-street') throw new Error(`F100: expected reason mataro-street, got ${out.reason}`)
      if (ar.state.faqTopic !== 'buy-loyalty-card') {
        throw new Error(`F100: faqTopic must be preserved as 'buy-loyalty-card'`)
      }
      if (!ar.state.locationStreetRequested) {
        throw new Error('F100: locationStreetRequested must be set')
      }
    },
  },
  {
    name: 'F100 guardMataroStreet: non-loyalty Mataró message → faqTopic stays empty',
    run: () => {
      const ar = makeAr(2)
      ar.state.location = 'Mataró'
      const out = guardMataroStreet(ar, 'la lavadora no funciona')
      if (!out) throw new Error('F100: expected mataroStreet reply for non-loyalty')
      if (ar.state.faqTopic !== '') {
        throw new Error(`F100: faqTopic must stay empty for non-loyalty message, got '${ar.state.faqTopic}'`)
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
