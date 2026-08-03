// The flow graph as runtime STATE, not something re-inferred every turn.
// Identical mechanism to custom-demorobot/flow-machine.ts (steps.md 2-C.3:
// "lo stesso motore deterministico già in produzione in custom-demorobot").
//
// This file is the whole mechanism: a graph lookup type, and two pure
// functions. No I/O, no session access — advance() takes a nodeId and a
// label and returns where to go, nothing else. Testable in total isolation.

import type { FlowGraphNodeSnapshot } from './state.js'

/** The graph, indexed for O(1) lookups during a turn. */
export interface FlowGraph {
  /** nodeId -> node (question, fieldKey, terminalType). */
  nodes: Map<string, FlowGraphNodeSnapshot>
}

/** Builds a FlowGraph from the flat node list loadFlow returns. */
export function buildFlowGraph(nodes: FlowGraphNodeSnapshot[]): FlowGraph {
  return { nodes: new Map(nodes.map((n) => [n.id, n])) }
}

/**
 * The graph's root node: the only node that is never the target of an
 * outgoing edge. Not persisted anywhere: the compiler guarantees exactly one
 * root exists for a flow that passed validation.
 *
 * Returns null if the graph has no unambiguous root.
 */
export function rootNodeId(graph: FlowGraph): string | null {
  const loopNodeIds = new Set(
    [...graph.nodes.values()].filter((n) => n.terminalType === 'LOOP').map((n) => n.id),
  )
  const targeted = new Set<string>()
  for (const node of graph.nodes.values()) {
    if (loopNodeIds.has(node.id)) continue
    for (const edge of node.outgoingEdges) {
      if (edge.targetNodeId) targeted.add(edge.targetNodeId)
    }
  }
  const roots = [...graph.nodes.keys()].filter((id) => !targeted.has(id))
  return roots.length === 1 ? roots[0] : null
}

/** The node the conversation is currently at — its question, fieldKey, terminalType. */
export function currentNode(graph: FlowGraph, nodeId: string): FlowGraphNodeSnapshot | null {
  return graph.nodes.get(nodeId) ?? null
}

/**
 * The labels valid to answer with FROM this node right now — becomes the
 * enum of the answer_step tool schema, computed fresh every turn from the
 * graph. The model cannot pass a label that isn't here: it isn't in the
 * schema, so the API rejects the call before it ever reaches advance().
 */
export function allowedLabels(graph: FlowGraph, nodeId: string): string[] {
  return graph.nodes.get(nodeId)?.outgoingEdges.map((e) => e.label) ?? []
}

export interface AdvanceResult {
  /**
   * Node to move to, or null — either a dead end the compiler should have
   * rejected, or (the common case) escalate is true: an escalating edge ends
   * the flow right there, there is no "next question" to move to.
   */
  nextNodeId: string | null
  /** True when this specific answer escalates immediately, regardless of the target node's terminalType. */
  escalate: boolean
}

/**
 * Where to go from `nodeId` given the customer's answer was classified as
 * `label`. Pure and total: every input either resolves to a real edge or
 * returns null — there is no third outcome where the code guesses.
 *
 * Returns null when `label` matches no outgoing edge of `nodeId` — the
 * caller's job (agent.ts) is to ask for clarification on the SAME node, never
 * to advance on a guess.
 */
export function advance(graph: FlowGraph, nodeId: string, label: string): AdvanceResult | null {
  const node = graph.nodes.get(nodeId)
  if (!node) return null

  const normalized = label.trim().toLowerCase()
  const edge = node.outgoingEdges.find((e) => e.label.trim().toLowerCase() === normalized)
  if (!edge) return null

  if (edge.triggersEscalation) return { nextNodeId: null, escalate: true }
  return { nextNodeId: edge.targetNodeId, escalate: false }
}
