/**
 * demoam — the Human Support hand-off, end to end.
 *
 * Andrea 2026-08-06 (flow shape updated 2026-08-07: one combined check), the
 * sequence he asked to have locked down:
 *
 *   every road to a human  →  Human Support FLOW (ONE combined check: wifi
 *                              active + cut scheduling enabled + battery
 *                              charged — corrective LOOP on "No"; powered-on
 *                              is never asked, wifi implies it)
 *                          →  the customer's NAME (free text: the flow
 *                              engine classifies fixed edge labels, so it
 *                              cannot capture this)
 *                          →  the HAND-OFF MESSAGE, dictated from settings
 *                          →  escalate_to_operator fires → the host mails
 *                              the operator and sets activeChatbot: false
 *
 * ...with ONE exception, also his: an unhappy customer (complaint), a
 * question no FAQ answers, or a bare "put me through to a person" skips the
 * flow entirely. There is no device to diagnose, so the only question is the
 * name.
 *
 * These tests pin the STRUCTURE, not the wording — the wording is settings
 * and the flow graph is the DB. What must not drift is: who asks what, in
 * which order, and that the hand-off cannot be reached without the checks.
 */
import fs from 'fs'
import path from 'path'

import { caseShapeFor, nextPreOperatorAction } from '../../custom-demoam/gate'

const MODULE_DIR = path.join(__dirname, '..', '..', 'custom-demoam')
const agentSource = fs.readFileSync(path.join(MODULE_DIR, 'agent.ts'), 'utf8')

describe('demoam Human Support — the flow runs before any hand-off', () => {
  it('escalate_to_operator forces the Human Support flow on a technical case', () => {
    // The guarantee is code, not a line in the prompt (CLAUDE.md §16): the
    // tool REFUSES and names start_flow, rather than asking the model nicely.
    expect(agentSource).toMatch(/human_support_flow_required/)
    expect(agentSource).toMatch(/force_tool: 'start_flow'/)
  })

  it('does not force it again once the flow has been walked', () => {
    // Without this the flow's own ESCALATE terminal would tell the model to
    // call escalate_to_operator, which would send it straight back into the
    // same flow — forever.
    expect(agentSource).toMatch(/humanSupportFlowDone/)
  })

  it('marks the flow done on BOTH of its exits', () => {
    // A flow can end at a terminal node, or on a triggersEscalation edge
    // that never visits one. Both must record it, or the second path loops.
    const marks = agentSource.match(/humanSupportFlowDone: true/g) ?? []
    expect(marks.length).toBeGreaterThanOrEqual(2)
  })
})

describe('demoam Human Support — what the gate still owns', () => {
  const QUESTIONS = {
    serialNumber: 'Serial number?',
    problemDescription: "What's happening?",
    problemStartedWhen: 'When did it start?',
    name: 'Your name?',
  }

  it('asks the name last, so it is the final step before the hand-off', () => {
    const state = {
      serialNumber: 'HK123',
      collectedData: { problemDescription: 'x', problemStartedWhen: 'today' },
    }
    const action = nextPreOperatorAction(state, QUESTIONS, {}, 'technical')

    expect(action.kind === 'ask' && action.field).toBe('name')
    expect(action.kind === 'ask' && action.isLastStep).toBe(true)
  })

  it('escalates as soon as the name is known — nothing else stands in the way', () => {
    const state = {
      serialNumber: 'HK123',
      name: 'Andrea',
      collectedData: { problemDescription: 'x', problemStartedWhen: 'today' },
    }

    expect(nextPreOperatorAction(state, QUESTIONS, {}, 'technical').kind).toBe('escalate')
  })

  it('leaves the technical checks to the flow', () => {
    // 2026-08-07: the flow's check is now ONE combined question (fieldKey
    // technicalChecksOk: wifi + cut scheduling + battery); the retired
    // booleans stay guarded so they cannot creep back into the gate as dead
    // config.
    const settings = JSON.parse(fs.readFileSync(path.join(MODULE_DIR, 'settings.json'), 'utf8'))

    for (const owned of [
      'robotPoweredOn',
      'wifiActive',
      'cutSchedulingActive',
      'batterySufficient',
      'technicalChecksOk',
    ]) {
      expect(settings.gateQuestions[owned]).toBeUndefined()
    }
  })
})

describe('demoam Human Support — the unhappy customer goes straight through', () => {
  const QUESTIONS = {
    serialNumber: 'Serial number?',
    problemDescription: "What's happening?",
    problemStartedWhen: 'When did it start?',
    name: 'Your name?',
  }

  it.each(['complaint', 'faq_not_found', 'requested_operator'])(
    '%s is a no_device case — no flow, no serial, no technical checks',
    (reason) => {
      expect(caseShapeFor(reason)).toBe('no_device')

      const action = nextPreOperatorAction({}, QUESTIONS, {}, 'no_device')
      expect(action.kind === 'ask' && action.field).toBe('name')
      expect(action.kind === 'ask' && action.isLastStep).toBe(true)
    },
  )

  it('only the technical shape is sent through the flow', () => {
    // The forcing guard is gated on shape === 'technical'; if that ever
    // widened, a complaint would be interrogated about wifi and battery.
    expect(agentSource).toMatch(/shape === 'technical'/)
  })
})

describe('demoam Human Support — the hand-off message is dictated, not improvised', () => {
  it('escalate_to_operator returns the configured text as dictated', () => {
    // It used to reach the customer only through handoffFallback, i.e. ONLY
    // when the model produced no text of its own — so in the normal case the
    // customer read an improvised farewell while the configured sentence sat
    // unused.
    expect(agentSource).toMatch(/handoffMessage/)
    expect(agentSource).toMatch(/substituteCustomerName\(ctx\.handoffMessage/)
  })

  it('substitutes {{customerName}} at escalation time, not before', () => {
    // The name is normally collected DURING the escalating turn (it is the
    // last gate step), so resolving it when the context is built would blank
    // the placeholder in exactly the case the message needs it.
    expect(agentSource).toMatch(/substituteCustomerName\(ctx\.handoffMessage, state\.name\)/)
  })

  it('keeps the wording in settings, never in the module', () => {
    const settings = JSON.parse(fs.readFileSync(path.join(MODULE_DIR, 'settings.json'), 'utf8'))
    expect(settings.humanSupportMessage).toBeTruthy()
  })
})

describe('demoam Human Support — the escalation cannot be silently dropped', () => {
  it('refuses an empty summary', () => {
    // The host only mails the operator and switches the chatbot off when
    // BOTH shouldEscalate and escalationSummary are present — an empty
    // summary would leave the bot answering after promising it would stop.
    expect(agentSource).toMatch(/summary is required and must be a non-empty string/)
  })

  it('still carries a summary on the tool-hop-exhausted path', () => {
    // That path never goes through escalate_to_operator, so the guard above
    // does not cover it: it needs its own non-empty default.
    expect(agentSource).toMatch(/escalated \(no briefing captured\)/)
  })
})
