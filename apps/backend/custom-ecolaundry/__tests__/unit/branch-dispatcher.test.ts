// Standalone unit test (NO live LLM) — branch dispatcher.
//
// SCENARIO:
//   utils/branches/index.ts is the entry point of the new branch-router
//   architecture. This file pins the deterministic parts:
//     - state.activeBranch is set after T1 dispatch
//     - handler-less branches return { handled: false } (legacy-pipeline fallback)
//     - applyHandoff('topic-switch') stashes activeBranch in previousBranch
//     - applyHandoff('resolved') releases the sticky branch
//   The router LLM call is bypassed by directly invoking the handlers
//   that are exported from each branch module.
//
// Run with:
//   node --import tsx __tests__/unit/branch-dispatcher.test.ts

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { dispatchSubsequentTurn } from '../../utils/branches/index.js'
import { faqHandler } from '../../utils/branches/faq/handler.js'
import { greetingHandler } from '../../utils/branches/greeting/handler.js'
import { troubleMachineHandler } from '../../utils/branches/trouble-machine/handler.js'
import { invoiceHandler } from '../../utils/branches/invoice/handler.js'
import { loyaltyHandler } from '../../utils/branches/loyalty/handler.js'
import { escalationHandler } from '../../utils/branches/escalation/handler.js'
import { createInitialState } from '../../utils/state.js'
import { setFaqs } from '../../utils/runtime.js'
import type { AgentRuntime } from '../../models/index.js'
import { getCachedTestRuntime, loadTestRuntime } from './_helpers.js'

// Load real json/faqs.json so the FAQ handler can resolve known keys.
const __here = path.dirname(fileURLToPath(import.meta.url))
const __faqsPath = path.resolve(__here, '..', '..', 'json', 'faqs.json')
setFaqs(JSON.parse(readFileSync(__faqsPath, 'utf8')))

function makeAr(): AgentRuntime {
  const ar: AgentRuntime = {
    state: createInitialState(),
    runtime: getCachedTestRuntime(),
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
  return ar
}

interface Case {
  name: string
  run: () => Promise<void>
}

const cases: Case[] = [
  {
    name: 'greetingHandler: returns open question + topic-switch handoff',
    run: async () => {
      const ar = makeAr()
      const out = await greetingHandler({
        message: 'ciao',
        ar,
        routerDetails: {},
        language: 'es',
      })
      if (!out.reply || !out.reply.includes('?')) {
        throw new Error(`expected an open question, got: ${out.reply}`)
      }
      if (out.handoff !== 'topic-switch') {
        throw new Error(`expected handoff="topic-switch", got "${out.handoff}"`)
      }
    },
  },
  {
    name: 'greetingHandler: ES output regardless of input language (tenant lock)',
    run: async () => {
      // Customer wrote in IT, but Ecolaundry is ES-only — output must be ES.
      const ar = makeAr()
      const out = await greetingHandler({
        message: 'ciao',
        ar,
        routerDetails: {},
        language: 'it',
      })
      // ES greetingOpen contains "Cuéntame", IT contains "Dimmi".
      if (!/Cu[eé]ntame|qu[eé]/i.test(out.reply)) {
        throw new Error(`expected ES output, got: ${out.reply}`)
      }
    },
  },
  {
    name: 'faqHandler: known faqKey → returns FAQ answer',
    run: async () => {
      const ar = makeAr()
      const out = await faqHandler({
        message: 'che orari avete?',
        ar,
        routerDetails: { faqKey: 'openingHours' },
        language: 'it',
      })
      if (!/8:00|22:00|horario/i.test(out.reply)) {
        throw new Error(`expected hours answer, got: ${out.reply}`)
      }
      if (out.handoff !== 'topic-switch') {
        throw new Error(`expected handoff="topic-switch", got "${out.handoff}"`)
      }
      // The handler must also flag intent so a "thanks" on the next turn
      // can be closed by the FAQ closure logic.
      if (ar.state.lastResolvedIntent !== 'faq') {
        throw new Error('lastResolvedIntent must be set to "faq"')
      }
    },
  },
  {
    name: 'faqHandler: unknown faqKey → unknownKey reply + topic-switch',
    run: async () => {
      const ar = makeAr()
      const out = await faqHandler({
        message: 'something irrelevant',
        ar,
        routerDetails: { faqKey: 'thisDoesNotExistInFaqs' },
        language: 'es',
      })
      if (!/no estoy seguro|reformul/i.test(out.reply)) {
        throw new Error(`expected unknownKey fallback, got: ${out.reply}`)
      }
      if (out.handoff !== 'topic-switch') {
        throw new Error('handoff must be topic-switch on unknown FAQ')
      }
    },
  },
  {
    name: 'faqHandler: missing faqKey → unknownKey reply (router could not extract)',
    run: async () => {
      const ar = makeAr()
      const out = await faqHandler({
        message: 'something',
        ar,
        routerDetails: {},  // no faqKey
        language: 'es',
      })
      if (!/no estoy seguro|reformul/i.test(out.reply)) {
        throw new Error('expected unknownKey fallback when faqKey missing')
      }
    },
  },
  {
    name: 'dispatchSubsequentTurn: no active branch → handled=false (legacy pipeline)',
    run: async () => {
      const ar = makeAr()
      ar.state.activeBranch = null
      const result = await dispatchSubsequentTurn(ar, 'whatever', 'es')
      if (result.handled !== false) {
        throw new Error('expected handled=false when no active branch')
      }
    },
  },
  {
    name: 'dispatchSubsequentTurn: branch with no handler in map → handled=false',
    run: async () => {
      // The "unknown" branch never has a handler — the dispatcher must
      // fall through cleanly so the legacy pipeline handles the turn.
      const ar = makeAr()
      ar.state.activeBranch = 'unknown'
      const result = await dispatchSubsequentTurn(ar, 'whatever', 'es')
      if (result.handled !== false) {
        throw new Error('expected handled=false when no handler is registered')
      }
    },
  },
  {
    name: 'dispatchSubsequentTurn: activeBranch="faq" + faqKey → handler runs',
    run: async () => {
      const ar = makeAr()
      ar.state.activeBranch = 'faq'
      // Note: T2+ dispatch does NOT re-run the router, so routerDetails is
      // empty. The faq handler then takes the unknownKey fallback path
      // (legitimate behaviour: T2+ within "faq" branch is rare; usually
      // the FAQ branch hands off after T1).
      const result = await dispatchSubsequentTurn(ar, 'whatever', 'es')
      if (result.handled !== true) {
        throw new Error('expected handled=true when activeBranch has a handler')
      }
      if (!result.output?.reply) {
        throw new Error('expected a reply')
      }
    },
  },
  {
    name: 'topic-switch handoff: previousBranch is stashed, activeBranch cleared',
    run: async () => {
      const ar = makeAr()
      ar.state.activeBranch = 'faq'
      await dispatchSubsequentTurn(ar, 'whatever', 'es')
      // The faq handler returns handoff: 'topic-switch'; the dispatcher
      // applies that to state.
      if (ar.state.previousBranch !== 'faq') {
        throw new Error(
          `expected previousBranch="faq", got "${ar.state.previousBranch}"`,
        )
      }
      if (ar.state.activeBranch !== null) {
        throw new Error(
          `expected activeBranch=null after topic-switch, got "${ar.state.activeBranch}"`,
        )
      }
    },
  },

  // ── Thin handlers (delegate-to-legacy) ──────────────────────────────────
  // These four handlers capture the routing benefit (T1 LLM picks the
  // branch in any of 6 supported languages) but defer the actual reply
  // to the existing guard pipeline + LLM loop.
  {
    name: 'troubleMachineHandler: seeds locationHint when known + returns delegate-to-legacy',
    run: async () => {
      const ar = makeAr()
      const out = await troubleMachineHandler({
        message: 'no funciona la lavadora 5 en Goya, sale PUSH PROG',
        ar,
        routerDetails: { locationHint: 'Goya', displayHint: 'PUSH PROG' },
        language: 'es',
      })
      if (out.handoff !== 'delegate-to-legacy') {
        throw new Error(`expected delegate-to-legacy, got "${out.handoff}"`)
      }
      if (ar.state.location !== 'Goya') {
        throw new Error(`expected state.location="Goya", got "${ar.state.location}"`)
      }
      if (ar.state.displayState !== 'PUSH') {
        throw new Error(`expected state.displayState="PUSH", got "${ar.state.displayState}"`)
      }
    },
  },
  {
    name: 'troubleMachineHandler: never overwrites already-set sticky facts',
    run: async () => {
      const ar = makeAr()
      ar.state.location = 'Pineda'
      ar.state.displayState = 'SEL'
      await troubleMachineHandler({
        message: 'whatever',
        ar,
        routerDetails: { locationHint: 'Goya', displayHint: 'PUSH PROG' },
        language: 'es',
      })
      if (ar.state.location !== 'Pineda') {
        throw new Error('locationHint must NOT overwrite an existing location')
      }
      if (ar.state.displayState !== 'SEL') {
        throw new Error('displayHint must NOT overwrite an existing displayState')
      }
    },
  },
  {
    name: 'troubleMachineHandler: ignores unknown locations from the hint',
    run: async () => {
      const ar = makeAr()
      await troubleMachineHandler({
        message: 'whatever',
        ar,
        routerDetails: { locationHint: 'Girona' },  // not in laundromat list
        language: 'es',
      })
      if (ar.state.location !== '') {
        throw new Error('unknown location must NOT be stored as sticky fact')
      }
    },
  },

  {
    name: 'invoiceHandler: returns delegate-to-legacy without pre-setting pendingFlow',
    // pendingFlow is intentionally NOT set: pre-setting it caused the legacy
    // guardInvoiceFlow to process T1 ("Quiero una factura") as the location answer.
    // The legacy guard detects the trigger via detectInvoiceIntent and calls
    // nextCaso9Step to decide the first question.
    run: async () => {
      const ar = makeAr()
      const out = await invoiceHandler({
        message: 'quiero una factura',
        ar,
        routerDetails: {},
        language: 'es',
      })
      if (out.handoff !== 'delegate-to-legacy') {
        throw new Error(`expected delegate-to-legacy, got "${out.handoff}"`)
      }
      if (ar.state.pendingFlow !== '') {
        throw new Error(`pendingFlow must remain empty (legacy guard owns the entry), got "${ar.state.pendingFlow}"`)
      }
      if (ar.state.faqTopic !== 'invoice') {
        throw new Error('faqTopic must be set to "invoice" for legacy guard handover')
      }
    },
  },
  {
    name: 'invoiceHandler: keeps existing invoice pendingFlow (do not reset mid-flow)',
    run: async () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'invoice-ask-cif'  // mid-flow already
      await invoiceHandler({
        message: 'whatever',
        ar,
        routerDetails: {},
        language: 'es',
      })
      if (ar.state.pendingFlow !== 'invoice-ask-cif') {
        throw new Error('handler must NOT reset an in-progress invoice flow')
      }
    },
  },

  {
    name: 'loyaltyHandler: returns delegate-to-legacy without state mutation',
    run: async () => {
      const ar = makeAr()
      const out = await loyaltyHandler({
        message: 'cómo recargo la tarjeta?',
        ar,
        routerDetails: {},
        language: 'es',
      })
      if (out.handoff !== 'delegate-to-legacy') {
        throw new Error(`expected delegate-to-legacy, got "${out.handoff}"`)
      }
      // Loyalty branch does not seed any sticky state — the legacy
      // TARJETA_TOPIC / RECARGA_TOPIC regex distinguishes buy vs recharge.
    },
  },

  {
    name: 'escalationHandler: seeds nonTroubleshootingIncident from incidentType hint',
    run: async () => {
      const ar = makeAr()
      const out = await escalationHandler({
        message: 'mirad las cámaras',
        ar,
        routerDetails: { incidentType: 'cameras-or-ajax' },
        language: 'es',
      })
      if (out.handoff !== 'delegate-to-legacy') {
        throw new Error(`expected delegate-to-legacy, got "${out.handoff}"`)
      }
      if (ar.state.nonTroubleshootingIncident !== 'cameras-or-ajax') {
        throw new Error(
          `expected nonTroubleshootingIncident="cameras-or-ajax", got "${ar.state.nonTroubleshootingIncident}"`,
        )
      }
    },
  },
  {
    name: 'escalationHandler: rejects unknown incidentType from the router (defensive)',
    run: async () => {
      const ar = makeAr()
      await escalationHandler({
        message: 'something',
        ar,
        routerDetails: { incidentType: 'this-is-not-a-known-incident' },
        language: 'es',
      })
      if (ar.state.nonTroubleshootingIncident !== '') {
        throw new Error(
          'invalid incidentType must NOT be stored — the validator rejects it',
        )
      }
    },
  },

  // ── Dispatcher x delegate-to-legacy contract ─────────────────────────────
  {
    name: 'dispatchSubsequentTurn: handoff="delegate-to-legacy" → handled=false, branch sticky',
    run: async () => {
      const ar = makeAr()
      ar.state.activeBranch = 'trouble-machine'
      const result = await dispatchSubsequentTurn(ar, 'whatever', 'es')
      // Even though a handler exists for trouble-machine, it returns
      // delegate-to-legacy → caller falls through to the legacy pipeline.
      if (result.handled !== false) {
        throw new Error('delegate-to-legacy must surface as handled=false')
      }
      // But the branch stays sticky — no re-routing on the next turn.
      if (ar.state.activeBranch !== 'trouble-machine') {
        throw new Error('activeBranch must remain sticky after delegate-to-legacy')
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
      await c.run()
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
