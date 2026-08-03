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
import { formatFlowsBlock, formatPreOperatorInstruction, nextPreOperatorStep, startFlow } from '../../custom-demoam/gate'
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

describe('demoam pre-operator gate — 7-field order', () => {
  const QUESTIONS = {
    serialNumber: 'Serial number?',
    problemDescription: "What's happening?",
    robotPoweredOn: 'Is it powered on?',
    wifiActive: 'Is wifi active?',
    cutSchedulingActive: 'On schedule cutting?',
    batterySufficient: 'Battery sufficient?',
    name: 'Your name?',
  }

  it('asks the 7 fields in the order confirmed with Andrea', () => {
    const order: string[] = []
    let state: SessionState = {}

    for (let i = 0; i < 7; i++) {
      const step = nextPreOperatorStep(state, QUESTIONS, {})
      if (!step) break
      order.push(step.field)
      if (step.field === 'serialNumber') state = { ...state, serialNumber: 'HK123' }
      else if (step.field === 'name') state = { ...state, name: 'Andrea' }
      else state = { ...state, collectedData: { ...(state.collectedData ?? {}), [step.field]: 'x' } }
    }

    expect(order).toEqual([
      'serialNumber',
      'problemDescription',
      'robotPoweredOn',
      'wifiActive',
      'cutSchedulingActive',
      'batterySufficient',
      'name',
    ])
  })

  it('returns null once every field is answered', () => {
    const state: SessionState = {
      serialNumber: 'HK123',
      name: 'Andrea',
      collectedData: {
        problemDescription: 'x',
        robotPoweredOn: 'yes',
        wifiActive: 'yes',
        cutSchedulingActive: 'no',
        batterySufficient: 'yes',
      },
    }

    expect(nextPreOperatorStep(state, QUESTIONS, {})).toBeNull()
  })

  it('never re-asks a field already answered', () => {
    const state: SessionState = { serialNumber: 'HK123' }
    const step = nextPreOperatorStep(state, QUESTIONS, {})

    expect(step?.field).not.toBe('serialNumber')
    expect(step?.field).toBe('problemDescription')
  })

  it('treats a field with no configured wording as satisfied — fails toward silence', () => {
    const partialQuestions = { ...QUESTIONS, robotPoweredOn: undefined }
    const state: SessionState = { serialNumber: 'HK1', collectedData: { problemDescription: 'x' } }

    const step = nextPreOperatorStep(state, partialQuestions, {})
    // Skips the unconfigured robotPoweredOn and moves to the next real one.
    expect(step?.field).toBe('wifiActive')
  })

  it('skips a field once it has been asked maxAsks times', () => {
    const state: SessionState = { serialNumber: 'HK1', collectedData: { problemDescription: 'x' } }
    const askedCounts = { robotPoweredOn: 2 }

    const step = nextPreOperatorStep(state, QUESTIONS, askedCounts, { maxAsks: 2 })

    // robotPoweredOn is skipped (asked twice already, the customer won't/can't answer).
    expect(step?.field).toBe('wifiActive')
  })

  it('asks nothing when no questions are configured at all', () => {
    expect(nextPreOperatorStep({}, undefined, {})).toBeNull()
    expect(nextPreOperatorStep({}, {}, {})).toBeNull()
  })
})

describe('demoam pre-operator gate — FAQ-not-found short-circuit (steps.md 2-B.3)', () => {
  const QUESTIONS = {
    serialNumber: 'Serial number?',
    problemDescription: "What's happening?",
    robotPoweredOn: 'Is it powered on?',
    wifiActive: 'Is wifi active?',
    cutSchedulingActive: 'On schedule cutting?',
    batterySufficient: 'Battery sufficient?',
    name: 'Your name?',
  }

  it('asks ONLY the name, skipping all 6 technical fields', () => {
    const step = nextPreOperatorStep({}, QUESTIONS, {}, { skipTechnical: true })

    expect(step?.field).toBe('name')
  })

  it('still returns null once the name is known — no technical fields sneak back in', () => {
    const state: SessionState = { name: 'Andrea' }
    const step = nextPreOperatorStep(state, QUESTIONS, {}, { skipTechnical: true })

    expect(step).toBeNull()
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
