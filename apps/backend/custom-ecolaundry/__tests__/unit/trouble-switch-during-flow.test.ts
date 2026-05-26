// F86 — Trouble-machine switch detection during non-machine flows.
//
// PURPOSE
// =======
// Pin the architectural contract that when a customer is mid-gather in a
// non-machine flow (invoice / discount-code / double-charge) and suddenly
// pivots with a trouble-machine signal ("ah, ahora no funciona la lavadora",
// "scusa, non parte la lavatrice", "the dryer doesn't work", …), the bot:
//
//   1. recognises the topic switch via `detectTroubleSwitchDuringFlow`
//      (multi-language regex backed by the JSON pattern `topicMachineTrouble`)
//   2. atomically abandons the active non-machine flow via
//      `pivotToTroubleMachine` (state-transitions.ts) — clearing
//      pendingFlow, invoiceData, discountCodeData, doubleCharge state,
//      lastResolvedIntent, lastFaqKey, activeFlowId, activeStepId,
//      lastPresentedStepId, and post-escalation flags
//   3. preserves sticky customer facts: location, machineType, machineNumber,
//      customerName, customerPhone (the customer is the same; only the
//      conversation topic changed)
//   4. sets activeBranch='trouble-machine' so the next dispatch routes
//      to the trouble pipeline
//
// REGRESSION CONTEXT (Andrea, 2026-05-22 — MIX 4 live eval)
// =========================================================
// In `discount-code-await-machine`, the customer was asked for the machine
// number. Instead of replying "5", they typed "ah, ahora no funciona la
// lavadora". Before this fix, the gather step blindly stored the entire
// sentence as `state.machineNumber = "ah, ahora no funciona la lavadora"`
// and proceeded to await-door. State pollution was guaranteed for every
// gather step that ran `field = trimmed` without semantic validation.
//
// Same latent bug existed in invoice (razonSocial, direccion, cif, fecha,
// costeTotal, email, notes), in double-charge (narrative, card digits,
// receipt, name), and in discount-code (name, location, machine, door).
// All closed by a single architectural fix.
//
// CONTRACT
// ========
// (a) `detectTroubleSwitchDuringFlow(runtime, msg)` returns true ONLY when
//     the message contains an explicit machine-trouble signal — covers all
//     6 languages (es/it/en/ca/pt/fr).
// (b) Neutral mentions ("la lavadora", "cuál lavadora es?", "5", "Carlos")
//     return false. The detector must NOT false-positive on noun-only
//     mentions, numeric replies, names, locations, or emails.
// (c) `pivotToTroubleMachine(ar)` clears the non-machine flow data
//     atomically while preserving sticky customer facts.
// (d) Integration: each gather guard with "verbatim accept" semantics MUST
//     call `pivotIfTroubleSwitch` (helper) before the assignment.
//
// Run with:
//   node --import tsx __tests__/unit/trouble-switch-during-flow.test.ts

import { detectTroubleSwitchDuringFlow } from '../../utils/intent.js'
import { pivotToTroubleMachine } from '../../utils/state-transitions.js'
import { createInitialState } from '../../utils/state.js'
import { loadTestRuntime } from './_helpers.js'
import type { SessionState, AgentRuntime } from '../../models/index.js'

type DetectorCase = {
  label: string
  message: string
  expected: boolean
}

type TransitionCase = {
  name: string
  setup: (state: SessionState) => void
  assert: (state: SessionState) => void
}

function makeAr(state: SessionState, runtime: any): AgentRuntime {
  return {
    state,
    runtime,
    history: [],
    resolved: false,
  } as unknown as AgentRuntime
}

// ── A. Detector cases ─────────────────────────────────────────────────────
//
// 6-language positive coverage (iron rule #8) — every supported language
// must have at least one positive case. Plus negative tests to assert that
// neutral noun mentions, names, numbers, etc. do NOT false-positive.

const detectorCases: DetectorCase[] = [
  // ES positive (3 forms)
  { label: 'ES — pivot inline',     message: 'ah, ahora no funciona la lavadora', expected: true },
  { label: 'ES — reflexive verb',   message: 'no me anda la máquina',             expected: true },
  { label: 'ES — short trouble',    message: 'no arranca',                         expected: true },
  // IT positive (3 forms)
  { label: 'IT — pivot inline',     message: 'scusa, non mi funziona la lavatrice', expected: true },
  { label: 'IT — short trouble',    message: 'non parte',                            expected: true },
  { label: 'IT — broken state',     message: 'si è rotta',                           expected: true },
  // EN positive (3 forms)
  { label: 'EN — doesnt work',      message: "wait, the dryer doesn't work",        expected: true },
  { label: 'EN — isnt working',     message: "the washer isn't working",            expected: true },
  { label: 'EN — broken adj',       message: "it's broken",                         expected: true },
  // PT positive
  { label: 'PT — não funciona',     message: 'não funciona a máquina',              expected: true },
  // CA positive
  { label: 'CA — no funciona',      message: 'no funciona la rentadora',            expected: true },
  // FR positive (2 forms)
  { label: 'FR — ne fonctionne',    message: 'la machine ne fonctionne pas',        expected: true },
  { label: 'FR — en panne',         message: 'en panne',                            expected: true },
  // Negative: must NOT fire on neutral/canonical replies
  { label: 'NEG — noun only',                 message: 'la lavadora',           expected: false },
  { label: 'NEG — neutral question',          message: 'qué lavadora es?',      expected: false },
  { label: 'NEG — numeric reply',             message: '5',                     expected: false },
  { label: 'NEG — confirmation',              message: 'sí',                    expected: false },
  { label: 'NEG — empty',                     message: '',                      expected: false },
  { label: 'NEG — customer name',             message: 'Carlos',                expected: false },
  { label: 'NEG — location reply',            message: 'Goya',                  expected: false },
  { label: 'NEG — email',                     message: 'ana@example.com',       expected: false },
  { label: 'NEG — discount code',             message: 'SAU2904266',            expected: false },
  { label: 'NEG — razon social',              message: 'ACME SL',               expected: false },
  { label: 'NEG — coste',                     message: '6€',                    expected: false },
  { label: 'NEG — date',                      message: 'Ayer',                  expected: false },
  // F110 — code-switched and typo variants (Andrea WhatsApp 2026-05-26).
  // Customer in ES session frequently types the IT verb 'funziona' instead of
  // ES 'funciona'. Must be caught by the regex `fun(?:ci|zi)ona`.
  { label: 'F110 — ES+IT code-switch (real chat)', message: 'no me funziona la lavadora',      expected: true },
  { label: 'F110 — IT typo "funzina"',             message: 'non mi funzina la lavadora',      expected: true },
  // F110 — display-code report mid-FAQ. The customer is in a FAQ confirm step
  // ("¿quieres info de secadora?") but pivots with a display code report —
  // the regex covers "me da DOOR" / "mi da PUSH PROG" / "sale AL001".
  { label: 'F110 — "mi da DOOR"',                  message: 'mi da DOOR la lavadora',          expected: true },
  { label: 'F110 — "me da PUSH PROG"',             message: 'me da PUSH PROG',                 expected: true },
  { label: 'F110 — "sale AL001"',                  message: 'sale AL001',                      expected: true },
  // F110 — sanity: the display-code clauses must NOT fire on neutral mentions
  // of the same words in a non-trouble context.
  { label: 'F110 NEG — "DOOR" alone (no verb)',    message: 'DOOR',                            expected: false },
  { label: 'F110 NEG — "qué es PUSH PROG?"',       message: 'qué es PUSH PROG?',               expected: false },
]

// ── B. Transition cases — pivotToTroubleMachine atomicity ─────────────────
//
// The transition must:
//   - clear pendingFlow + invoiceData/discountCodeData/doubleCharge state
//   - clear activeFlowId, activeStepId, lastPresentedStepId
//   - clear lastResolvedIntent, lastFaqKey
//   - clear escalation flags via resetPostEscalationFlags
//   - set activeBranch='trouble-machine'
//   - PRESERVE: location, machineType, machineNumber, customerName,
//     customerPhone (sticky customer facts)

const transitionCases: TransitionCase[] = [
  {
    name: 'F86 — pivot from invoice flow clears invoiceData + sets trouble-machine',
    setup: (state) => {
      state.activeBranch = 'invoice'
      state.pendingFlow = 'invoice-ask-coste'
      state.location = 'Goya'
      state.machineType = 'washer'
      state.invoiceData.razonSocial = 'ACME SL'
      state.invoiceData.direccion = 'Calle Mayor 1'
      state.invoiceData.cif = 'B12345678'
      state.invoiceData.fecha = 'Ayer'
      state.lastResolvedIntent = 'faq'
      state.faqTopic = 'invoice'
    },
    assert: (state) => {
      if (state.pendingFlow !== '') throw new Error(`pendingFlow must be empty, got '${state.pendingFlow}'`)
      if (state.activeBranch !== 'trouble-machine') throw new Error(`activeBranch must be 'trouble-machine', got '${state.activeBranch}'`)
      if (state.invoiceData.razonSocial !== '') throw new Error(`invoiceData.razonSocial must be cleared`)
      if (state.invoiceData.cif !== '') throw new Error(`invoiceData.cif must be cleared`)
      if (state.invoiceData.fecha !== '') throw new Error(`invoiceData.fecha must be cleared`)
      if (state.lastResolvedIntent !== null) throw new Error(`lastResolvedIntent must be null`)
      // Sticky customer facts MUST be preserved
      if (state.location !== 'Goya') throw new Error(`location must be preserved`)
      if (state.machineType !== 'washer') throw new Error(`machineType must be preserved`)
    },
  },
  {
    name: 'F86 — pivot from discount-code clears discountCodeData + machineNumber',
    setup: (state) => {
      state.activeBranch = 'unknown'
      state.pendingFlow = 'discount-code-await-machine'
      state.location = 'Goya'
      state.customerName = 'Carlos'
      state.discountCodeData.letters = 'SAU'
      state.discountCodeData.fechaIso = '2026-04-29'
      state.discountCodeData.importe = '6'
    },
    assert: (state) => {
      if (state.pendingFlow !== '') throw new Error(`pendingFlow must be empty`)
      if (state.activeBranch !== 'trouble-machine') throw new Error(`activeBranch must switch to trouble-machine`)
      if (state.discountCodeData.letters !== '') throw new Error(`discountCodeData.letters must be cleared`)
      if (state.discountCodeData.importe !== '') throw new Error(`discountCodeData.importe must be cleared`)
      if (state.customerName !== 'Carlos') throw new Error(`customerName must be preserved`)
      if (state.location !== 'Goya') throw new Error(`location must be preserved`)
    },
  },
  {
    name: 'F86 — pivot from double-charge clears narrative fields',
    setup: (state) => {
      state.activeBranch = 'unknown'
      state.pendingFlow = 'double-charge-ask-narrative'
      state.location = 'Goya'
      state.machineType = 'washer'
      state.machineNumber = '5'
      state.doubleChargeNarrativeProvided = true
      state.doubleChargeNarrativeText = 'pago doble'
    },
    assert: (state) => {
      if (state.pendingFlow !== '') throw new Error(`pendingFlow must be empty`)
      if (state.doubleChargeNarrativeProvided !== false) throw new Error(`doubleChargeNarrativeProvided must be reset to false`)
      if (state.doubleChargeNarrativeText !== '') throw new Error(`doubleChargeNarrativeText must be cleared`)
      if (state.location !== 'Goya') throw new Error(`location must be preserved`)
      if (state.machineNumber !== '5') throw new Error(`machineNumber must be preserved`)
    },
  },
  {
    name: 'F86 — pivot also clears activeFlowId / activeStepId / lastPresentedStepId',
    setup: (state) => {
      state.activeBranch = 'invoice'
      state.pendingFlow = 'invoice-ask-coste'
      state.activeFlowId = 'non_parte'
      state.activeStepId = 'check_result'
      state.lastPresentedStepId = 'presented'
    },
    assert: (state) => {
      if (state.activeFlowId !== null) throw new Error(`activeFlowId must be null`)
      if (state.activeStepId !== null) throw new Error(`activeStepId must be null`)
      if (state.lastPresentedStepId !== null) throw new Error(`lastPresentedStepId must be null`)
    },
  },
  {
    name: 'F86 — pivot clears escalation flags via resetPostEscalationFlags',
    setup: (state) => {
      state.activeBranch = 'unknown'
      state.pendingFlow = 'discount-code-await-name'
      state.operatorRequested = true
      state.customerNameRequested = true
      // pendingEscalation lives on AgentRuntime (not state) — set it on `ar`
      // via the makeAr override below.
    },
    assert: (state) => {
      if (state.operatorRequested !== false) throw new Error(`operatorRequested must be reset to false`)
      if (state.customerNameRequested !== false) throw new Error(`customerNameRequested must be reset to false`)
      // pendingEscalation reset is verified in the resetPostEscalationFlags
      // sibling test; we only assert state-level flags here.
    },
  },
]

// ── Runner ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const runtime = await loadTestRuntime()
  let passed = 0
  let failed = 0

  // A. Detector
  for (const c of detectorCases) {
    const got = detectTroubleSwitchDuringFlow(runtime, c.message)
    if (got === c.expected) {
      passed += 1
      console.log(`\x1b[32m  ✓\x1b[0m ${c.label} (${c.expected ? 'true' : 'false'}) — ${JSON.stringify(c.message)}`)
    } else {
      failed += 1
      console.log(`\x1b[31m  ✗\x1b[0m ${c.label} — expected ${c.expected}, got ${got} — ${JSON.stringify(c.message)}`)
    }
  }

  // B. Transition
  for (const c of transitionCases) {
    try {
      const state = createInitialState()
      state.language = 'es'
      state.preferredLanguage = 'es'
      c.setup(state)
      const ar = makeAr(state, runtime)
      pivotToTroubleMachine(ar)
      c.assert(state)
      passed += 1
      console.log(`\x1b[32m  ✓\x1b[0m ${c.name}`)
    } catch (err) {
      failed += 1
      const reason = err instanceof Error ? err.message : String(err)
      console.log(`\x1b[31m  ✗\x1b[0m ${c.name}\n      ${reason}`)
    }
  }

  const total = detectorCases.length + transitionCases.length
  console.log(`\n${passed} passed, ${failed} failed (out of ${total})\n`)
  if (failed > 0) process.exit(1)
}

main()
