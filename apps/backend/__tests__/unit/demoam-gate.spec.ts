/**
 * demoam — flow catalogue (start_flow) and the pre-operator gate
 *
 * Andrea 2026-08-04. steps.md's central design decision: complaint (A) and
 * troubleshooting-with-no-match (C) both fund into the SAME 7-field gate,
 * one definition (flow-runtime.md §8 "one gate, from every road" pattern,
 * reused from custom-demorobot). These tests pin down:
 *
 *   1. The flow catalogue block (same mechanism as demorobot's).
 *   2. The 7-field gate order confirmed with Andrea: serialNumber,
 *      problemDescription, robotPoweredOn, wifiActive, cutSchedulingActive,
 *      batterySufficient, name.
 *   3. The FAQ-not-found short-circuit (steps.md 2-B.3): only "name" is
 *      asked, not the full 7 fields — skipTechnical collapses the order.
 *   4. Per-field ask counters, so one ignored question does not wave the
 *      customer through on every remaining field (CLAUDE.md §14: counted,
 *      never phrase-detected).
 */
import { caseShapeFor, formatFlowsBlock, formatPreOperatorInstruction, nextPreOperatorAction, startFlow } from '../../custom-demoam/gate'
import { getState, resetState, SessionState } from '../../custom-demoam/state'

const FLOWS = [
  { flowId: 'flow-no-power', title: 'Device does not power on' },
  { flowId: 'flow-wifi', title: 'Wifi will not connect', hint: 'blinking light' },
]

describe('demoam flow catalogue block', () => {
  it('lists every flow with its id in square brackets', () => {
    const block = formatFlowsBlock(FLOWS)

    expect(block).toContain('[flow-no-power]')
    expect(block).toContain('Device does not power on')
    expect(block).toContain('[flow-wifi]')
  })

  it('includes the optional hint when a flow has one', () => {
    expect(formatFlowsBlock(FLOWS)).toContain('blinking light')
  })

  it('tells the model to go to the pre-operator checks when nothing matches', () => {
    const block = formatFlowsBlock(FLOWS)

    expect(block).toMatch(/pre-operator checks/i)
    expect(block).toMatch(/NEVER pick a flow that does not fit/i)
  })

  it('forbids improvising when the workspace has no flows at all', () => {
    const block = formatFlowsBlock([])

    expect(block).toMatch(/do not invent/i)
    expect(block).toMatch(/pre-operator[\s\S]*checks/i)
  })

  describe('grouping by category', () => {
    const MIXED = [
      { flowId: 'f1', title: 'No power', category: 'Power' },
      { flowId: 'f2', title: 'Cable cut', category: 'Cables' },
      { flowId: 'f3', title: 'Will not start', category: 'Power' },
    ]

    it('groups flows under their category heading', () => {
      const block = formatFlowsBlock(MIXED)

      expect(block).toContain('**Power**')
      expect(block).toContain('**Cables**')
      expect(block.split('**Power**')[1]).toContain('[f1]')
      expect(block.split('**Power**')[1]).toContain('[f3]')
    })

    it('keeps the list flat when every flow shares one category', () => {
      const block = formatFlowsBlock([
        { flowId: 'f1', title: 'No power', category: 'Power' },
        { flowId: 'f3', title: 'Will not start', category: 'Power' },
      ])

      expect(block).not.toContain('**Power**')
    })
  })
})

describe('demoam start_flow tool', () => {
  const sessionId = 'sess-flow-1'
  const baseCtx = {
    sessionId,
    workspaceId: 'ws-1',
    availableFlows: FLOWS,
    loadFlow: async () => ({
      hash: 'h1',
      nodes: [
        { id: 'n1', question: 'Is it powered on?', terminalType: null, outgoingEdges: [{ label: 'No', targetNodeId: 'n2', triggersEscalation: true }] },
        { id: 'n2', question: 'Escalate.', terminalType: 'ESCALATE', outgoingEdges: [] },
      ],
    }),
  }

  beforeEach(() => {
    resetState(sessionId)
  })

  it('attaches the flow and sets currentNodeId to the root when the id is in the catalogue', async () => {
    const result = await startFlow(baseCtx, { flowId: 'flow-no-power' })

    expect(result.ok).toBe(true)
    const state = getState(sessionId)
    expect(state.activeFlowId).toBe('flow-no-power')
    expect(state.currentNodeId).toBe('n1')
  })

  it('refuses an id that is not in the catalogue', async () => {
    const result = await startFlow(baseCtx, { flowId: 'flow-battery-check' })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('unknown_flow_id')
    expect(getState(sessionId).activeFlowId).toBeUndefined()
  })

  it('refuses a flow with no nodes (nothing to run deterministically)', async () => {
    const ctx = { ...baseCtx, loadFlow: async () => ({ hash: 'h', nodes: [] }) }

    const result = await startFlow(ctx, { flowId: 'flow-no-power' })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('flow_unavailable')
  })

  it('does not throw when the loader fails, and still refuses', async () => {
    const ctx = {
      ...baseCtx,
      loadFlow: async () => {
        throw new Error('db down')
      },
    }

    const result = await startFlow(ctx, { flowId: 'flow-no-power' })

    expect(result.ok).toBe(false)
    expect(getState(sessionId).activeFlowId).toBeUndefined()
  })
})

describe('demoam pre-operator gate — the fields the flow engine cannot ask', () => {
  // Narrowed 2026-08-06 (Andrea): the four technical booleans are nodes of
  // the Human Support flow now, which asks them with real branches and a
  // corrective LOOP on "No". What is left in the gate is exactly what the
  // flow engine cannot do: intake (it runs BEFORE a flow is chosen — it is
  // what the flow is chosen FROM) and `name` (free text, while answer_step
  // only classifies fixed edge labels).
  const QUESTIONS = {
    serialNumber: 'Serial number?',
    problemDescription: "What's happening?",
    problemStartedWhen: 'When did it start?',
    name: 'Your name?',
  }

  it('asks intake then the name, in that order — name last of all', () => {
    const order: string[] = []
    let state: SessionState = {}

    for (let i = 0; i < 8; i++) {
      const action = nextPreOperatorAction(state, QUESTIONS, {}, 'technical')
      if (action.kind !== 'ask') break
      order.push(action.field)
      if (action.field === 'serialNumber') state = { ...state, serialNumber: 'HK123' }
      else if (action.field === 'name') state = { ...state, name: 'Andrea' }
      else state = { ...state, collectedData: { ...(state.collectedData ?? {}), [action.field]: 'x' } }
    }

    expect(order).toEqual(['serialNumber', 'problemDescription', 'problemStartedWhen', 'name'])
  })

  it('never asks the four booleans the Human Support flow owns', () => {
    // Even when wording for them is configured, the gate must not ask them —
    // otherwise the customer gets the same question from two mechanisms.
    const withBooleans = {
      ...QUESTIONS,
      robotPoweredOn: 'Is it powered on?',
      wifiActive: 'Is wifi active?',
      cutSchedulingActive: 'On schedule cutting?',
      batterySufficient: 'Battery sufficient?',
    }
    const asked: string[] = []
    let state: SessionState = {}

    for (let i = 0; i < 10; i++) {
      const action = nextPreOperatorAction(state, withBooleans, {}, 'technical')
      if (action.kind !== 'ask') break
      asked.push(action.field)
      if (action.field === 'serialNumber') state = { ...state, serialNumber: 'HK123' }
      else if (action.field === 'name') state = { ...state, name: 'Andrea' }
      else state = { ...state, collectedData: { ...(state.collectedData ?? {}), [action.field]: 'x' } }
    }

    expect(asked).not.toContain('robotPoweredOn')
    expect(asked).not.toContain('wifiActive')
    expect(asked).not.toContain('cutSchedulingActive')
    expect(asked).not.toContain('batterySufficient')
  })

  it('escalates once every field is answered', () => {
    const state: SessionState = {
      serialNumber: 'HK123',
      name: 'Andrea',
      collectedData: { problemDescription: 'x', problemStartedWhen: 'today' },
    }

    expect(nextPreOperatorAction(state, QUESTIONS, {}, 'technical').kind).toBe('escalate')
  })

  it('never re-asks a field already answered', () => {
    const state: SessionState = { serialNumber: 'HK123' }
    const action = nextPreOperatorAction(state, QUESTIONS, {}, 'technical')

    expect(action.kind).toBe('ask')
    expect(action.kind === 'ask' && action.field).toBe('problemDescription')
  })

  it('treats a field with no configured wording as satisfied — fails toward silence', () => {
    const partialQuestions = { ...QUESTIONS, problemDescription: undefined }
    const state: SessionState = { serialNumber: 'HK1' }

    const action = nextPreOperatorAction(state, partialQuestions, {}, 'technical')
    // Skips the unconfigured problemDescription and moves to the next real one.
    expect(action.kind === 'ask' && action.field).toBe('problemStartedWhen')
  })

  it('skips a field once it has been asked maxAsks times', () => {
    const state: SessionState = { serialNumber: 'HK1' }
    const askedCounts = { problemDescription: 2 }

    const action = nextPreOperatorAction(state, QUESTIONS, askedCounts, 'technical', { maxAsks: 2 })

    // problemDescription is skipped: asked twice already, the customer won't
    // or can't answer, and an unanswered checkbox must not block a human.
    expect(action.kind === 'ask' && action.field).toBe('problemStartedWhen')
  })

  it('asks nothing when no questions are configured at all', () => {
    expect(nextPreOperatorAction({}, undefined, {}, 'technical').kind).toBe('escalate')
    expect(nextPreOperatorAction({}, {}, {}, 'technical').kind).toBe('escalate')
  })
})

describe('demoam pre-operator gate — FAQ-not-found short-circuit (steps.md 2-B.3)', () => {
  const QUESTIONS = {
    serialNumber: 'Serial number?',
    problemDescription: "What's happening?",
    robotPoweredOn: 'Is it powered on?',
    problemStartedWhen: 'When did it start?',
    name: 'Your name?',
  }

  // Andrea 2026-08-06: an unhappy customer goes STRAIGHT to the name, then
  // the hand-off message, then the chatbot is switched off. No serial, no
  // description, no technical checks — there is no device to diagnose, and
  // interrogating someone who is already annoyed is the wrong answer.
  it.each(['complaint', 'faq_not_found', 'requested_operator'])(
    'routes %s to the no_device shape — nothing to diagnose',
    (reason) => {
      expect(caseShapeFor(reason)).toBe('no_device')
    },
  )

  it('asks ONLY the name, skipping intake entirely', () => {
    const action = nextPreOperatorAction({}, QUESTIONS, {}, 'no_device')

    expect(action.kind === 'ask' && action.field).toBe('name')
  })

  it('marks the name as the last step, so the hand-off follows immediately', () => {
    const action = nextPreOperatorAction({}, QUESTIONS, {}, 'no_device')

    expect(action.kind === 'ask' && action.isLastStep).toBe(true)
  })

  it('escalates once the name is known — no intake field sneaks back in', () => {
    const state: SessionState = { name: 'Andrea' }
    const action = nextPreOperatorAction(state, QUESTIONS, {}, 'no_device')

    expect(action.kind).toBe('escalate')
  })

  it('a technical case keeps the full intake — the shortcut is only for no_device', () => {
    const action = nextPreOperatorAction({}, QUESTIONS, {}, 'technical')

    expect(action.kind === 'ask' && action.field).toBe('serialNumber')
  })
})

describe('formatPreOperatorInstruction', () => {
  it('dictates the question verbatim and names the remember() key', () => {
    const instruction = formatPreOperatorInstruction({ field: 'wifiActive', question: 'Is wifi active?' })

    expect(instruction).toContain('Is wifi active?')
    expect(instruction).toContain("remember({key:'wifiActive'")
    expect(instruction).toMatch(/Do NOT add other questions/i)
    expect(instruction).toMatch(/escalate_to_operator again IN THE SAME TURN/i)
  })
})
