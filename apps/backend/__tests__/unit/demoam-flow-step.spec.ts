/**
 * demoam — flow step: currentNodeId as state, not inference
 *
 * Same guarantee as custom-demorobot (flow-runtime.md §2-5), reused verbatim
 * per steps.md 2-C.3: startFlow sets currentNodeId to the graph's root and
 * freezes the graph into the session; formatFlowStepBlock dictates ONE
 * question verbatim and forbids the model from composing its own.
 */
import { formatFlowStepBlock, startFlow } from '../../custom-demoam/gate'
import { getState, resetState } from '../../custom-demoam/state'

const FLOWS = [{ flowId: 'flow-no-power', title: 'Device does not power on' }]

describe('startFlow — attaching the graph', () => {
  const sessionId = 'sess-flow-graph-1'

  beforeEach(() => {
    resetState(sessionId)
  })

  it("sets currentNodeId to the graph's root node", async () => {
    const ctx = {
      sessionId,
      workspaceId: 'ws-1',
      availableFlows: FLOWS,
      loadFlow: async () => ({
        hash: 'h1',
        nodes: [
          { id: 'n1', question: 'Is it powered on?', terminalType: null, outgoingEdges: [{ label: 'No', targetNodeId: 'n2' }] },
          { id: 'n2', question: 'Check the power cable.', terminalType: 'SELF_SERVICE', outgoingEdges: [] },
        ],
      }),
    }

    const result = await startFlow(ctx, { flowId: 'flow-no-power' })
    expect(result.ok).toBe(true)

    const state = getState(sessionId)
    expect(state.currentNodeId).toBe('n1')
    expect(state.activeFlowGraphSnapshot).toHaveLength(2)
  })

  it('leaves currentNodeId unset when loadFlow supplies an empty nodes array', async () => {
    const ctx = {
      sessionId,
      workspaceId: 'ws-1',
      availableFlows: FLOWS,
      loadFlow: async () => ({ hash: 'h1', nodes: [] }),
    }

    const result = await startFlow(ctx, { flowId: 'flow-no-power' })
    expect(result.ok).toBe(false)
    expect(getState(sessionId).currentNodeId).toBeUndefined()
  })
})

describe('formatFlowStepBlock', () => {
  it('dictates the question verbatim and forbids composing a new one', () => {
    const block = formatFlowStepBlock('Is it powered on?', ['Yes', 'No'])

    expect(block).toContain('Is it powered on?')
    expect(block).toMatch(/do not invent options/i)
    expect(block).toMatch(/THE QUESTION TO ASK NOW/)
  })

  it("names answer_step and the exact valid labels, so the model can't call it with an invented one", () => {
    const block = formatFlowStepBlock('Is wifi active?', ['Yes', 'No'])

    expect(block).toMatch(/answer_step/)
    expect(block).toContain('Yes | No')
  })

  it("tells the model to ask for clarification, not move on, when the answer doesn't match", () => {
    const block = formatFlowStepBlock('Is the light red?', ['Yes', 'No'])
    expect(block).toMatch(/do not guess/i)
  })

  it('mentions abandon_flow as the way out when the customer changes subject', () => {
    const block = formatFlowStepBlock('Is the light red?', ['Yes', 'No'])
    expect(block).toMatch(/abandon_flow/)
  })

  it('returns null when there are no valid labels to answer with', () => {
    expect(formatFlowStepBlock('Checks failed.', [])).toBeNull()
  })
})
