import { createHash } from 'crypto'
import {
  ALLOWED_TOOLS_BY_TERMINAL_TYPE,
  CompileFlowInput,
  CompileFlowResult,
  CompileFlowWarning,
  CompilerFlowEdge,
  CompilerFlowNode,
  FLOW_SIZE_LIMITS,
  ValidationError,
} from './flow-compiler.types'

// Compiles a demoRobot flow graph (nodes + edges) into the two artifacts the
// runtime and retrieval layers need. Pure function, no I/O — determinism
// (same input -> same compiledPrompt byte-for-byte) is the core contract
// (analisi.md §4, specs/flow-compiler §"Deterministic compilation").
export function compileFlow(input: CompileFlowInput): CompileFlowResult {
  const validationReport = validateGraph(input)
  const warnings: CompileFlowWarning[] = []

  if (validationReport.length > 0) {
    return {
      compiledPrompt: '',
      retrievalDocument: '',
      hash: '',
      assetIds: [],
      validationReport,
      warnings,
    }
  }

  collectSizeWarnings(input, warnings)
  collectDuplicateFieldKeyWarnings(input, warnings)
  collectUnreachableNodeWarnings(input, warnings)

  const order = topologicalOrder(input.nodes, input.edges)
  const compiledPrompt = renderCompiledPrompt(input, order)
  const retrievalDocument = renderRetrievalDocument(input, order)
  const hash = createHash('sha256').update(compiledPrompt).digest('hex')
  const assetIds = [...new Set(input.attachments.map((a) => a.assetId))]

  return { compiledPrompt, retrievalDocument, hash, assetIds, validationReport, warnings }
}

// ── Validation (specs/flow-compiler "Graph validation before save") ────────

function validateGraph(input: CompileFlowInput): ValidationError[] {
  const errors: ValidationError[] = []
  const { nodes, edges, attachments, robotModelId } = input

  const nodeIds = new Set(nodes.map((n) => n.id))
  // A LOOP node's own outgoing back-edge doesn't disqualify its target from
  // being the root — otherwise a valid "retry from the top" loop would look
  // indistinguishable from "no root at all". Root detection only counts
  // edges whose SOURCE is not itself a LOOP node.
  const loopNodeIds = new Set(nodes.filter((n) => n.terminalType === 'LOOP').map((n) => n.id))
  const targetedNodeIds = new Set(
    edges
      .filter((e) => !loopNodeIds.has(e.sourceNodeId))
      .map((e) => e.targetNodeId)
      .filter((id): id is string => !!id),
  )
  const roots = nodes.filter((n) => !targetedNodeIds.has(n.id))

  if (nodes.length === 0 || roots.length === 0) {
    errors.push({ code: 'no_root_node', message: 'Graph has no unambiguous root node.' })
  } else if (roots.length > 1) {
    errors.push({
      code: 'multiple_root_nodes',
      message: `Graph has ${roots.length} candidate root nodes, expected exactly one.`,
    })
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceNodeId)) {
      errors.push({ code: 'dangling_edge', message: `Edge ${edge.id} has an unknown sourceNodeId.`, edgeId: edge.id })
    }
    if (edge.targetNodeId && !nodeIds.has(edge.targetNodeId)) {
      errors.push({ code: 'dangling_edge', message: `Edge ${edge.id} has an unknown targetNodeId.`, edgeId: edge.id })
    }
  }

  // Every path must reach a terminal node (a node with no outgoing edges, or
  // explicitly typed as a terminal). Cycles are only allowed when the node
  // that closes the cycle is explicitly terminalType: 'LOOP'.
  const outgoingByNode = groupBy(edges, (e) => e.sourceNodeId)
  const visited = new Set<string>()
  const inStack = new Set<string>()

  // `fromNodeId` is the node whose outgoing edge is being followed into
  // `nodeId` — when that edge closes a cycle, it is the SOURCE's
  // terminalType that must be 'LOOP' (the node that "loops back"), not the
  // target being re-entered.
  function visit(nodeId: string, fromNodeId?: string): void {
    if (inStack.has(nodeId)) {
      const fromNode = fromNodeId ? nodes.find((n) => n.id === fromNodeId) : undefined
      if (fromNode?.terminalType !== 'LOOP') {
        errors.push({
          code: 'unexpected_cycle',
          message: `Cycle detected: node ${fromNodeId ?? '?'} loops back to ${nodeId} without terminalType: 'LOOP'.`,
          nodeId: fromNodeId ?? nodeId,
        })
      }
      return
    }
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    inStack.add(nodeId)

    const node = nodes.find((n) => n.id === nodeId)
    const outgoing = outgoingByNode.get(nodeId) ?? []

    if (outgoing.length === 0 && !node?.terminalType) {
      errors.push({
        code: 'unreachable_terminal',
        message: `Node ${nodeId} has no answers and no terminalType — path never reaches a terminal.`,
        nodeId,
      })
    }

    for (const edge of outgoing) {
      if (edge.targetNodeId) visit(edge.targetNodeId, nodeId)
    }
    inStack.delete(nodeId)
  }

  for (const root of roots) visit(root.id)

  if (robotModelId !== undefined) {
    for (const attachment of attachments) {
      if (attachment.robotModelId !== robotModelId) {
        errors.push({
          code: 'attachment_wrong_model',
          message: `Attachment on node ${attachment.nodeId} references an asset from a different RobotModel.`,
          nodeId: attachment.nodeId,
        })
      }
      if (!nodeIds.has(attachment.nodeId)) {
        errors.push({
          code: 'attachment_missing',
          message: `Attachment references unknown node ${attachment.nodeId}.`,
          nodeId: attachment.nodeId,
        })
      }
    }
  }

  if (nodes.length > FLOW_SIZE_LIMITS.maxNodesHard) {
    errors.push({
      code: 'size_limit_exceeded',
      message: `Flow has ${nodes.length} nodes, hard limit is ${FLOW_SIZE_LIMITS.maxNodesHard}.`,
    })
  }

  return errors
}

// ── Non-blocking warnings (specs/flow-compiler "Non-blocking warning") ─────

function collectSizeWarnings(input: CompileFlowInput, warnings: CompileFlowWarning[]): void {
  if (input.nodes.length > FLOW_SIZE_LIMITS.maxNodesWarning) {
    warnings.push({
      code: 'approaching_size_limit',
      message: `Flow has ${input.nodes.length} nodes, approaching the ${FLOW_SIZE_LIMITS.maxNodesHard} hard limit.`,
    })
  }
  const attachmentsByNode = groupBy(input.attachments, (a) => a.nodeId)
  for (const [nodeId, list] of attachmentsByNode) {
    if (list.length > FLOW_SIZE_LIMITS.maxAttachmentsPerNodeWarning) {
      warnings.push({
        code: 'approaching_size_limit',
        message: `Node ${nodeId} has ${list.length} attachments, above the recommended ${FLOW_SIZE_LIMITS.maxAttachmentsPerNodeWarning}.`,
        nodeId,
      })
    }
  }
}

function collectDuplicateFieldKeyWarnings(input: CompileFlowInput, warnings: CompileFlowWarning[]): void {
  const seen = new Map<string, string>()
  for (const node of input.nodes) {
    if (!node.fieldKey) continue
    const prior = seen.get(node.fieldKey)
    if (prior) {
      warnings.push({
        code: 'duplicate_field_key',
        message: `fieldKey "${node.fieldKey}" is used by both node ${prior} and node ${node.id}.`,
        nodeId: node.id,
      })
    } else {
      seen.set(node.fieldKey, node.id)
    }
  }
}

function collectUnreachableNodeWarnings(input: CompileFlowInput, warnings: CompileFlowWarning[]): void {
  const targetedNodeIds = new Set(input.edges.map((e) => e.sourceNodeId))
  const roots = input.nodes.filter((n) => !targetedNodeIds.has(n.id))
  const reachable = new Set<string>()
  const outgoingByNode = groupBy(input.edges, (e) => e.sourceNodeId)

  function walk(nodeId: string): void {
    if (reachable.has(nodeId)) return
    reachable.add(nodeId)
    for (const edge of outgoingByNode.get(nodeId) ?? []) {
      if (edge.targetNodeId) walk(edge.targetNodeId)
    }
  }
  for (const root of roots) walk(root.id)

  for (const node of input.nodes) {
    if (!reachable.has(node.id)) {
      warnings.push({ code: 'unreachable_node', message: `Node ${node.id} is never reached from the root.`, nodeId: node.id })
    }
  }
}

// ── Deterministic topological ordering ──────────────────────────────────────
// Stable given the same input: nodes are visited depth-first from the root,
// and at each node the outgoing edges are visited in their given array order
// (never re-sorted by anything non-deterministic like object key order or
// insertion timestamps).

function topologicalOrder(nodes: CompilerFlowNode[], edges: CompilerFlowEdge[]): CompilerFlowNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const outgoingByNode = groupBy(edges, (e) => e.sourceNodeId)
  const targetedNodeIds = new Set(edges.map((e) => e.targetNodeId).filter((id): id is string => !!id))
  const roots = nodes.filter((n) => !targetedNodeIds.has(n.id))

  const order: CompilerFlowNode[] = []
  const seen = new Set<string>()

  function visit(nodeId: string): void {
    if (seen.has(nodeId)) return
    seen.add(nodeId)
    const node = byId.get(nodeId)
    if (node) order.push(node)
    for (const edge of outgoingByNode.get(nodeId) ?? []) {
      if (edge.targetNodeId) visit(edge.targetNodeId)
    }
  }
  for (const root of roots) visit(root.id)

  return order
}

// ── compiledPrompt rendering (verbose, for LLM execution) ──────────────────

function renderCompiledPrompt(input: CompileFlowInput, order: CompilerFlowNode[]): string {
  const outgoingByNode = groupBy(input.edges, (e) => e.sourceNodeId)
  const attachmentsByNode = groupBy(input.attachments, (a) => a.nodeId)
  const lines: string[] = [`## FLOW: ${input.flowTitle}`, '']

  for (const node of order) {
    lines.push(`### Q: ${node.question}`)
    if (node.fieldKey) {
      lines.push(`(collect as: ${node.fieldKey}${node.fieldType ? `, type: ${node.fieldType}` : ''})`)
    }

    const outgoing = outgoingByNode.get(node.id) ?? []
    for (const edge of outgoing) {
      const target = edge.targetNodeId ? order.find((n) => n.id === edge.targetNodeId) : null
      if (edge.triggersEscalation) {
        lines.push(`- If "${edge.label}" → call escalate_to_operator immediately.`)
      } else if (target) {
        lines.push(`- If "${edge.label}" → continue to: "${target.question}"`)
      } else {
        lines.push(`- If "${edge.label}" → end of flow.`)
      }
    }

    if (node.terminalType) {
      const allowedTools = ALLOWED_TOOLS_BY_TERMINAL_TYPE[node.terminalType]
      lines.push(`(terminal: ${node.terminalType}, allowed tools: ${allowedTools.join(', ')})`)
    }

    const attachments = attachmentsByNode.get(node.id) ?? []
    if (attachments.length > 0) {
      lines.push(`(has ${attachments.length} attachment(s) available to offer at this node)`)
    }

    lines.push('')
  }

  return lines.join('\n').trimEnd() + '\n'
}

// ── retrievalDocument rendering (dense, embedding-only) ─────────────────────
// Deliberately excludes conditional operational instructions ("If NO ->
// respond X") — only title/symptom/synonym text, so the embedding isn't
// diluted (analisi.md §4, specs/flow-compiler "retrievalDocument excludes
// operational instructions").

function renderRetrievalDocument(input: CompileFlowInput, order: CompilerFlowNode[]): string {
  const parts: string[] = [input.flowTitle]
  if (input.flowKeywords && input.flowKeywords.length > 0) {
    parts.push(input.flowKeywords.join(', '))
  }
  for (const node of order) {
    parts.push(node.question)
  }
  return parts.join('\n')
}

// ── helpers ───────────────────────────────────────────────────────────────

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const list = map.get(key)
    if (list) list.push(item)
    else map.set(key, [item])
  }
  return map
}
