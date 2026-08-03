// custom-demoam/flow-machine.ts is a direct port of custom-demorobot's — same
// mechanism, same guarantee: the position in a troubleshooting flow is STATE
// (currentNodeId), never re-inferred from prose. These tests mirror
// demorobot-flow-machine.spec.ts exactly, since the module is unmodified
// beyond its import path (steps.md 2-C.3: "lo stesso motore deterministico
// già in produzione in custom-demorobot").

import { advance, allowedLabels, buildFlowGraph, currentNode, rootNodeId } from '../../custom-demoam/flow-machine'
import type { FlowGraphNodeSnapshot } from '../../custom-demoam/state'

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
      fieldKey: 'wifiActive',
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
    nodes[2].outgoingEdges.push({ label: 'retry', targetNodeId: 'n1' })
    const graph = buildFlowGraph(nodes)
    expect(rootNodeId(graph)).toBeNull()
  })

  it('returns null on an empty graph', () => {
    expect(rootNodeId(buildFlowGraph([]))).toBeNull()
  })

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

  it('returns null when the label matches no outgoing edge of this node', () => {
    const graph = buildFlowGraph(threeNodeFixture())
    expect(advance(graph, 'n1', 'maybe')).toBeNull()
  })

  it('returns null for an unknown node id', () => {
    const graph = buildFlowGraph(threeNodeFixture())
    expect(advance(graph, 'does-not-exist', 'Sì')).toBeNull()
  })

  it('signals escalate with no next node, regardless of what the edge would otherwise target', () => {
    const graph = buildFlowGraph(threeNodeFixture())
    expect(advance(graph, 'n1', 'No')).toEqual({ nextNodeId: null, escalate: true })
  })

  it('matches labels trimmed and lowercased, same normalisation as the compiler’s duplicate check', () => {
    const graph = buildFlowGraph(threeNodeFixture())
    expect(advance(graph, 'n1', ' SÌ ')).toEqual({ nextNodeId: 'n2', escalate: false })
  })

  it('only ever looks at edges FROM the given node, never edges of other nodes', () => {
    const graph = buildFlowGraph(threeNodeFixture())
    expect(advance(graph, 'n1', 'Sì')?.nextNodeId).toBe('n2')
    expect(advance(graph, 'n2', 'Sì')?.nextNodeId).toBe('n3')
  })
})
