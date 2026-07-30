import { compileFlow } from '../../../application/demorobot/flow-compiler.service'
import { CompileFlowInput } from '../../../application/demorobot/flow-compiler.types'

// Fixture: robot-acceso? -> wifi-on? -> escalate (analisi.md §6-style flow).
// WHAT: three-node linear diagnostic ending in escalation.
// WHY snapshot-tested: the compiler contract requires byte-for-byte
// determinism (analisi.md §4) — a snapshot catches any accidental change to
// traversal order or rendering without hand-verifying the whole text.
function threeNodeEscalationFixture(): CompileFlowInput {
  return {
    flowTitle: 'Rumore strano',
    flowKeywords: ['vibra', 'cigola'],
    robotModelId: 'model_1',
    nodes: [
      { id: 'n1', question: 'Il robot è acceso?', terminalType: null },
      { id: 'n2', question: 'Il wifi è connesso?', terminalType: null, fieldKey: 'wifiStatus', fieldType: 'boolean' },
      { id: 'n3', question: 'Check falliti, serve un tecnico.', terminalType: 'ESCALATE' },
    ],
    edges: [
      { id: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', label: 'Sì' },
      { id: 'e2', sourceNodeId: 'n2', targetNodeId: 'n3', label: 'Sì' },
    ],
    attachments: [],
  }
}

describe('compileFlow', () => {
  it('compiles a valid graph deterministically (snapshot)', () => {
    const result = compileFlow(threeNodeEscalationFixture())
    expect(result.validationReport).toEqual([])
    expect(result.compiledPrompt).toMatchSnapshot()
    expect(result.retrievalDocument).toMatchSnapshot()
  })

  it('produces the same compiledPrompt and hash across repeated compilations', () => {
    const fixture = threeNodeEscalationFixture()
    const a = compileFlow(fixture)
    const b = compileFlow(fixture)
    expect(a.compiledPrompt).toBe(b.compiledPrompt)
    expect(a.hash).toBe(b.hash)
  })

  it('excludes conditional operational instructions from retrievalDocument', () => {
    const result = compileFlow(threeNodeEscalationFixture())
    expect(result.retrievalDocument).not.toContain('If "Sì"')
    expect(result.compiledPrompt).toContain('If "Sì"')
  })

  it('rejects a graph with no root node (every node is targeted by some edge)', () => {
    const fixture = threeNodeEscalationFixture()
    // n3 -> n1 closes the chain into a ring: every node now has an incoming edge, so there is no root.
    fixture.edges.push({ id: 'e3', sourceNodeId: 'n3', targetNodeId: 'n1', label: 'loop' })
    const result = compileFlow(fixture)
    expect(result.validationReport.length).toBeGreaterThan(0)
    expect(result.validationReport.some((e) => e.code === 'no_root_node')).toBe(true)
    expect(result.compiledPrompt).toBe('')
  })

  it('rejects a cycle reachable from a real root when the closing node lacks terminalType LOOP', () => {
    const fixture: CompileFlowInput = {
      flowTitle: 'Cycle without loop marker',
      nodes: [
        { id: 'n1', question: 'Start', terminalType: null },
        { id: 'n2', question: 'Middle', terminalType: null },
        { id: 'n3', question: 'Loop back point', terminalType: null },
      ],
      edges: [
        { id: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', label: 'go' },
        { id: 'e2', sourceNodeId: 'n2', targetNodeId: 'n3', label: 'next' },
        // n3 -> n2 closes a cycle NOT involving the root n1, so n1 stays the sole root.
        { id: 'e3', sourceNodeId: 'n3', targetNodeId: 'n2', label: 'retry' },
      ],
      attachments: [],
    }
    const result = compileFlow(fixture)
    expect(result.validationReport.some((e) => e.code === 'unexpected_cycle')).toBe(true)
  })

  it('rejects a graph with a path that never reaches a terminal', () => {
    const fixture = threeNodeEscalationFixture()
    // n3 no longer terminal, no outgoing edge -> dead end.
    fixture.nodes[2].terminalType = null
    const result = compileFlow(fixture)
    expect(result.validationReport.some((e) => e.code === 'unreachable_terminal')).toBe(true)
  })

  it('allows a cycle only through a node marked terminalType LOOP', () => {
    const fixture: CompileFlowInput = {
      flowTitle: 'Loop flow',
      nodes: [
        { id: 'n1', question: 'Start', terminalType: null },
        { id: 'n2', question: 'Retry?', terminalType: 'LOOP' },
      ],
      edges: [
        { id: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', label: 'go' },
        { id: 'e2', sourceNodeId: 'n2', targetNodeId: 'n1', label: 'retry' },
      ],
      attachments: [],
    }
    const result = compileFlow(fixture)
    expect(result.validationReport).toEqual([])
  })

  it('rejects an attachment referencing another RobotModel', () => {
    const fixture = threeNodeEscalationFixture()
    fixture.attachments = [{ nodeId: 'n1', assetId: 'asset_1', robotModelId: 'other_model' }]
    const result = compileFlow(fixture)
    expect(result.validationReport.some((e) => e.code === 'attachment_wrong_model')).toBe(true)
  })

  it('accepts an attachment belonging to the correct RobotModel', () => {
    const fixture = threeNodeEscalationFixture()
    fixture.attachments = [{ nodeId: 'n1', assetId: 'asset_1', robotModelId: 'model_1' }]
    const result = compileFlow(fixture)
    expect(result.validationReport).toEqual([])
    expect(result.assetIds).toEqual(['asset_1'])
  })

  it('emits a non-blocking warning for a duplicate fieldKey', () => {
    const fixture = threeNodeEscalationFixture()
    fixture.nodes[0].fieldKey = 'wifiStatus'
    const result = compileFlow(fixture)
    expect(result.warnings.some((w) => w.code === 'duplicate_field_key')).toBe(true)
  })

  it('marks an escalating edge with an immediate escalation instruction, independent of node terminalType', () => {
    const fixture = threeNodeEscalationFixture()
    fixture.nodes[1].terminalType = null
    fixture.edges[1] = { ...fixture.edges[1], triggersEscalation: true }
    const result = compileFlow(fixture)
    expect(result.compiledPrompt).toContain('call escalate_to_operator immediately')
  })

  it('derives allowed tools from terminalType via the shared mapping, not a hardcoded switch', () => {
    const fixture = threeNodeEscalationFixture()
    const result = compileFlow(fixture)
    expect(result.compiledPrompt).toContain('allowed tools: remember, escalate_to_operator')
  })
})
