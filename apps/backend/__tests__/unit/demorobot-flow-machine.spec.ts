// flow-machine.ts is the mechanism that makes the documented production bug
// structurally impossible: "le lame girano normalmente?" was a question that
// existed in no FlowNode, produced by the LLM inferring its position from
// prose every turn instead of the position being real state. These tests
// pin down rootNodeId/advance/allowedLabels as pure, total functions — same
// input always gives the same answer, and every input either resolves to a
// real edge or returns null, never a silent guess.

import { advance, allowedLabels, buildFlowGraph, currentNode, rootNodeId } from '../../custom-demorobot/flow-machine'
import type { FlowGraphNodeSnapshot } from '../../custom-demorobot/state'

// Mirrors the three-node fixture already used in flow-compiler.spec.ts:
// robot-acceso? -> wifi-on? -> escalate.
function threeNodeFixture(): FlowGraphNodeSnapshot[] {
  return [
    {
      id: 'n1',
      question: 'Il robot è acceso?',
      terminalType: null,
      outgoingEdges: [
        { label: 'Sì', targetNodeId: 'n2' },
        { label: 'No', targetNodeId: 'n3', triggersEscalation: true },
      ],
    },
    {
      id: 'n2',
      question: 'Il wifi è connesso?',
      fieldKey: 'wifiStatus',
      terminalType: null,
      outgoingEdges: [{ label: 'Sì', targetNodeId: 'n3' }],
    },
    {
      id: 'n3',
      question: 'Check falliti, serve un tecnico.',
      terminalType: 'ESCALATE',
      outgoingEdges: [],
    },
  ]
}

describe('rootNodeId', () => {
  it('finds the one node that is never the target of any edge', () => {
    const graph = buildFlowGraph(threeNodeFixture())
    expect(rootNodeId(graph)).toBe('n1')
  })

  it('returns null when every node is targeted (no unambiguous root)', () => {
    const nodes = threeNodeFixture()
    // Close n3 -> n1, so n1 is now targeted too — no root left.
    nodes[2].outgoingEdges.push({ label: 'retry', targetNodeId: 'n1' })
    const graph = buildFlowGraph(nodes)
    expect(rootNodeId(graph)).toBeNull()
  })

  it('returns null on an empty graph', () => {
    expect(rootNodeId(buildFlowGraph([]))).toBeNull()
  })

  // Mirrors the compiler's own carve-out (flow-compiler.service.ts
  // validateGraph): a LOOP node's own back-edge must not disqualify its
  // target from being the root, otherwise a valid "retry from the top" loop
  // would look indistinguishable from "no root at all".
  it('ignores a LOOP node’s own back-edge when finding the root', () => {
    const nodes: FlowGraphNodeSnapshot[] = [
      { id: 'n1', question: 'Start', terminalType: null, outgoingEdges: [{ label: 'go', targetNodeId: 'n2' }] },
      { id: 'n2', question: 'Retry?', terminalType: 'LOOP', outgoingEdges: [{ label: 'retry', targetNodeId: 'n1' }] },
    ]
    const graph = buildFlowGraph(nodes)
    expect(rootNodeId(graph)).toBe('n1')
  })
})

describe('currentNode', () => {
  it('returns the node for a known id', () => {
    const graph = buildFlowGraph(threeNodeFixture())
    expect(currentNode(graph, 'n2')?.question).toBe('Il wifi è connesso?')
  })

  it('returns null for an unknown id', () => {
    const graph = buildFlowGraph(threeNodeFixture())
    expect(currentNode(graph, 'does-not-exist')).toBeNull()
  })
})

describe('allowedLabels', () => {
  it('lists exactly the labels of the current node’s outgoing edges', () => {
    const graph = buildFlowGraph(threeNodeFixture())
    expect(allowedLabels(graph, 'n1')).toEqual(['Sì', 'No'])
  })

  it('is empty for a terminal node with no outgoing edges', () => {
    const graph = buildFlowGraph(threeNodeFixture())
    expect(allowedLabels(graph, 'n3')).toEqual([])
  })

  it('is empty for an unknown node id', () => {
    const graph = buildFlowGraph(threeNodeFixture())
    expect(allowedLabels(graph, 'does-not-exist')).toEqual([])
  })
})

describe('advance', () => {
  it('moves to the target node when the label matches an edge', () => {
    const graph = buildFlowGraph(threeNodeFixture())
    expect(advance(graph, 'n1', 'Sì')).toEqual({ nextNodeId: 'n2', escalate: false })
  })

  // The core guarantee: a label that matches no edge of THIS node returns
  // null, not a guess. The caller (agent.ts) must ask for clarification on
  // the same node — this is what makes an invented branch structurally
  // impossible instead of merely discouraged.
  it('returns null when the label matches no outgoing edge of this node', () => {
    const graph = buildFlowGraph(threeNodeFixture())
    expect(advance(graph, 'n1', 'maybe')).toBeNull()
  })

  it('returns null for an unknown node id', () => {
    const graph = buildFlowGraph(threeNodeFixture())
    expect(advance(graph, 'does-not-exist', 'Sì')).toBeNull()
  })

  // nextNodeId is null on an escalating edge on purpose: escalation ends the
  // flow right there (flow-runtime.md §8-9 — the gate takes over, start_flow
  // and the flow's own questions are no longer relevant), so there is no
  // "next question" to move to. The caller detaches the flow rather than
  // advancing currentNodeId to a node it will never ask.
  it('signals escalate with no next node, regardless of what the edge would otherwise target', () => {
    const graph = buildFlowGraph(threeNodeFixture())
    // n1 --No--> n3 is marked triggersEscalation: true.
    expect(advance(graph, 'n1', 'No')).toEqual({ nextNodeId: null, escalate: true })
  })

  it('matches labels trimmed and lowercased, same normalisation as the compiler’s duplicate check', () => {
    const graph = buildFlowGraph(threeNodeFixture())
    expect(advance(graph, 'n1', ' SÌ ')).toEqual({ nextNodeId: 'n2', escalate: false })
  })

  it('only ever looks at edges FROM the given node, never edges of other nodes', () => {
    // n2 also has a "Sì" edge, but pointing elsewhere (-> n3). Answering
    // "Sì" while at n1 must resolve via n1's own edge, not n2's.
    const graph = buildFlowGraph(threeNodeFixture())
    expect(advance(graph, 'n1', 'Sì')?.nextNodeId).toBe('n2')
    expect(advance(graph, 'n2', 'Sì')?.nextNodeId).toBe('n3')
  })
})
