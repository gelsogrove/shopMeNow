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
  const { nodes, edges, attachments, flowCategoryId } = input

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
    // An answer hands over to a node OR to another flow, never both: the
    // runtime picks one destination, so two would make the branch ambiguous.
    if (edge.targetNodeId && edge.targetFlowId) {
      errors.push({
        code: 'edge_targets_both_node_and_flow',
        message: `Edge ${edge.id} targets both a node and a flow — pick one.`,
        nodeId: edge.sourceNodeId,
        edgeId: edge.id,
      })
    }
    // Handing over to the flow you are already in restarts it from its root
    // forever. Cross-flow cycles are caught at runtime by the visited-flow
    // guard; this catches the one case that is always a mistake.
    if (edge.targetFlowId && input.flowId && edge.targetFlowId === input.flowId) {
      errors.push({
        code: 'edge_targets_self_flow',
        message: `Edge ${edge.id} hands over to the flow it belongs to.`,
        nodeId: edge.sourceNodeId,
        edgeId: edge.id,
      })
    }
  }

  // An edge with a blank label can never be matched by advance() (it compares
  // the customer's classified answer against edge.label) — the runtime then
  // has outgoingEdges but nothing the model can legally answer with, and
  // formatFlowStepBlock treats the node as if it had none, silently dropping
  // the dictated question while state.currentNodeId is still set. The
  // customer-visible symptom is the model improvising past that node instead
  // of following the flow (seen live 2026-08-05, AmRobots ERROR 001 flow: a
  // "(empty)" edge on the "is it flashing continuously?" node).
  for (const edge of edges) {
    if (!edge.label.trim()) {
      errors.push({
        code: 'empty_edge_label',
        message: `Edge ${edge.id} from node ${edge.sourceNodeId} has no label — every edge needs one.`,
        nodeId: edge.sourceNodeId,
        edgeId: edge.id,
      })
    }
  }

  // Two edges from the same node with the same label are ambiguous once a
  // runtime state machine picks a branch by label match: advance() would take
  // whichever edge happens to come first, silently. Blocking here so it can
  // never reach that point (flow-runtime.md §0 — prerequisite for advance()).
  // Compared trimmed + lowercased: "Sì" and " sì " are the same answer.
  const edgesByNode = groupBy(edges, (e) => e.sourceNodeId)
  for (const [nodeId, nodeEdges] of edgesByNode) {
    const seenLabels = new Map<string, string>()
    for (const edge of nodeEdges) {
      const normalized = edge.label.trim().toLowerCase()
      if (!normalized) continue
      const firstEdgeId = seenLabels.get(normalized)
      if (firstEdgeId) {
        errors.push({
          code: 'duplicate_edge_label',
          message: `Node ${nodeId} has two edges labelled "${edge.label}" (edges ${firstEdgeId} and ${edge.id}).`,
          nodeId,
          edgeId: edge.id,
        })
      } else {
        seenLabels.set(normalized, edge.id)
      }
    }
  }

  // Two edges from the same node with DIFFERENT labels but the SAME
  // destination make the question pointless: whatever the customer answers,
  // the conversation goes to the identical next node, so the branch carries
  // no information (seen live 2026-08-05, AmRobots ERROR 005 flow: "Sì" and
  // "No" both led to "hai provato ad aumentare la sensibilità?"). A real
  // branch point must actually branch.
  for (const [nodeId, nodeEdges] of edgesByNode) {
    const seenNodeTargets = new Map<string, string>()
    const seenFlowTargets = new Map<string, string>()
    for (const edge of nodeEdges) {
      if (edge.targetNodeId) {
        const firstEdgeId = seenNodeTargets.get(edge.targetNodeId)
        if (firstEdgeId) {
          errors.push({
            code: 'converging_edge_targets',
            message: `Node ${nodeId} has two edges with different labels (edges ${firstEdgeId} and ${edge.id}) both leading to node ${edge.targetNodeId} — every answer must lead somewhere different.`,
            nodeId,
            edgeId: edge.id,
          })
        } else {
          seenNodeTargets.set(edge.targetNodeId, edge.id)
        }
      } else if (edge.targetFlowId) {
        const firstEdgeId = seenFlowTargets.get(edge.targetFlowId)
        if (firstEdgeId) {
          errors.push({
            code: 'converging_edge_targets',
            message: `Node ${nodeId} has two edges with different labels (edges ${firstEdgeId} and ${edge.id}) both leading to flow ${edge.targetFlowId} — every answer must lead somewhere different.`,
            nodeId,
            edgeId: edge.id,
          })
        } else {
          seenFlowTargets.set(edge.targetFlowId, edge.id)
        }
      }
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

  if (flowCategoryId !== undefined) {
    for (const attachment of attachments) {
      if (attachment.flowCategoryId !== flowCategoryId) {
        errors.push({
          code: 'attachment_wrong_model',
          message: `Attachment on node ${attachment.nodeId} references an asset from a different FlowCategory.`,
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
  const targetedNodeIds = new Set(input.edges.map((e) => e.targetNodeId).filter((id): id is string => !!id))
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

  // Andrea 2026-08-02: number the steps. `order` is already topological, but
  // the rendered prompt used to express transitions by repeating the target's
  // question text, which left the sequence implicit — the model had to infer
  // where it was from prose. Explicit step numbers ("go to STEP 3") make the
  // path unambiguous and let the model state its position, so following the
  // tree in order stops depending on careful reading.
  const stepByNodeId = new Map(order.map((node, index) => [node.id, index + 1]))
  const stepOf = (nodeId: string) => stepByNodeId.get(nodeId)

  // Andrea 2026-08-02: the description states WHEN this flow applies. A title
  // alone can be operator shorthand ("ERROR 001") that says nothing about the
  // situation, so without this the executing model has no framing for the
  // questions it is about to ask. Omitted entirely when absent — an empty
  // "WHEN TO USE" header would be noise, and would also change the hash of
  // every existing flow for no reason.
  const lines: string[] = [`## FLOW: ${input.flowTitle}`, '']

  if (input.flowDescription?.trim()) {
    lines.push(`WHEN TO USE: ${input.flowDescription.trim()}`, '')
  }

  lines.push(
    'Steps are NUMBERED and must be followed in the order the branches dictate.',
    'Ask ONE step at a time, then follow the branch matching the answer.',
    '',
  )

  for (const node of order) {
    lines.push(`### STEP ${stepOf(node.id)} — Q: ${node.question}`)
    if (node.fieldKey) {
      lines.push(`(collect as: ${node.fieldKey}${node.fieldType ? `, type: ${node.fieldType}` : ''})`)
    }

    const outgoing = outgoingByNode.get(node.id) ?? []
    for (const edge of outgoing) {
      const target = edge.targetNodeId ? order.find((n) => n.id === edge.targetNodeId) : null
      if (edge.triggersEscalation) {
        lines.push(`- If "${edge.label}" → call escalate_to_operator immediately.`)
      } else if (edge.targetFlowId) {
        lines.push(`- If "${edge.label}" → continue in another flow: "${edge.targetFlowTitle ?? edge.targetFlowId}"`)
      } else if (target) {
        lines.push(`- If "${edge.label}" → go to STEP ${stepOf(target.id)}: "${target.question}"`)
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
  // Andrea 2026-08-02: the highest-value text in this document. A title like
  // "ERROR 001" embeds almost nothing a customer would ever write; the
  // description carries the symptom wording ("lampeggia rosso, non parte")
  // that an incoming WhatsApp message actually resembles. Placed before the
  // keywords/questions because it is prose, not a token list.
  if (input.flowDescription?.trim()) {
    parts.push(input.flowDescription.trim())
  }
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
