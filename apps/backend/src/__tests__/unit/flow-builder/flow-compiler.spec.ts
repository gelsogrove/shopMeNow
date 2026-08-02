import { compileFlow } from '../../../application/flow-builder/flow-compiler.service'
import { CompileFlowInput } from '../../../application/flow-builder/flow-compiler.types'

// Fixture: robot-acceso? -> wifi-on? -> escalate (analisi.md §6-style flow).
// WHAT: three-node linear diagnostic ending in escalation.
// WHY snapshot-tested: the compiler contract requires byte-for-byte
// determinism (analisi.md §4) — a snapshot catches any accidental change to
// traversal order or rendering without hand-verifying the whole text.
function threeNodeEscalationFixture(): CompileFlowInput {
  return {
    flowTitle: 'Rumore strano',
    flowKeywords: ['vibra', 'cigola'],
    flowCategoryId: 'model_1',
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

  // ── flowDescription (Andrea 2026-08-02) ──────────────────────────────────
  // WHY these exist: the description is the text that makes a flow with an
  // operator-shorthand title ("ERROR 001") matchable against a real customer
  // message. It has to reach BOTH artifacts — the retrievalDocument (so the
  // embedding carries the symptom wording) and the compiledPrompt (so the
  // executing model knows which case it is handling) — and it must stay
  // optional, because every flow created before this feature has none.

  it('includes flowDescription in the retrievalDocument, where retrieval matches it', () => {
    const fixture = threeNodeEscalationFixture()
    fixture.flowDescription = 'Il robot lampeggia rosso e non parte dalla base.'
    const result = compileFlow(fixture)
    expect(result.retrievalDocument).toContain('Il robot lampeggia rosso e non parte dalla base.')
  })

  it('includes flowDescription in the compiledPrompt under a WHEN TO USE header', () => {
    const fixture = threeNodeEscalationFixture()
    fixture.flowDescription = 'Il robot lampeggia rosso e non parte dalla base.'
    const result = compileFlow(fixture)
    expect(result.compiledPrompt).toContain('WHEN TO USE: Il robot lampeggia rosso e non parte dalla base.')
  })

  // Guards the retro-compatibility of every flow saved before this feature:
  // no description must mean no header at all, not an empty one — an empty
  // "WHEN TO USE:" line would be noise AND would change every stored hash.
  it('omits the WHEN TO USE header entirely when no description is given', () => {
    const withoutDescription = compileFlow(threeNodeEscalationFixture())
    expect(withoutDescription.compiledPrompt).not.toContain('WHEN TO USE')

    // A blank/whitespace-only description is treated the same as none.
    const blank = threeNodeEscalationFixture()
    blank.flowDescription = '   '
    expect(compileFlow(blank).compiledPrompt).not.toContain('WHEN TO USE')
    expect(compileFlow(blank).compiledPrompt).toBe(withoutDescription.compiledPrompt)
  })

  // The description changes what is embedded, so it MUST change the hash —
  // otherwise saveFlowGraph's "only re-embed when retrievalDocument changed"
  // optimisation would keep serving an embedding that predates the new text.
  it('changes hash and retrievalDocument when the description changes', () => {
    const base = compileFlow(threeNodeEscalationFixture())

    const described = threeNodeEscalationFixture()
    described.flowDescription = 'Il robot lampeggia rosso e non parte dalla base.'
    const result = compileFlow(described)

    expect(result.hash).not.toBe(base.hash)
    expect(result.retrievalDocument).not.toBe(base.retrievalDocument)
  })

  it('keeps compilation deterministic with a description present', () => {
    const fixture = threeNodeEscalationFixture()
    fixture.flowDescription = 'Il robot lampeggia rosso e non parte dalla base.'
    const a = compileFlow(fixture)
    const b = compileFlow(fixture)
    expect(a.compiledPrompt).toBe(b.compiledPrompt)
    expect(a.hash).toBe(b.hash)
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

  it('rejects an attachment referencing another FlowCategory', () => {
    const fixture = threeNodeEscalationFixture()
    fixture.attachments = [{ nodeId: 'n1', assetId: 'asset_1', flowCategoryId: 'other_model' }]
    const result = compileFlow(fixture)
    expect(result.validationReport.some((e) => e.code === 'attachment_wrong_model')).toBe(true)
  })

  it('accepts an attachment belonging to the correct FlowCategory', () => {
    const fixture = threeNodeEscalationFixture()
    fixture.attachments = [{ nodeId: 'n1', assetId: 'asset_1', flowCategoryId: 'model_1' }]
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
