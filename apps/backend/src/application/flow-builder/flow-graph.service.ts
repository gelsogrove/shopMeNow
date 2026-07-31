import { prisma } from '@echatbot/database'
import { compileFlow } from './flow-compiler.service'
import { CompilerFlowEdge, CompilerFlowNode, CompileFlowResult } from './flow-compiler.types'
import { EmbeddingProvider } from './embedding-provider'

// specs/flow-graph-editor + specs/flow-compiler: a single "Save" action
// compiles, validates, and — only if valid — persists atomically and makes
// the Flow immediately reachable by retrieval. No draft/published split
// (analisi.md §12).

export interface SaveGraphNodeInput {
  id: string
  question: string
  positionX: number
  positionY: number
  fieldKey?: string | null
  fieldType?: string | null
  terminalType: CompilerFlowNode['terminalType']
  attachmentAssetIds?: string[]
}

export interface SaveGraphEdgeInput {
  id: string
  sourceNodeId: string
  targetNodeId: string | null
  label: string
  triggersEscalation?: boolean
}

export interface SaveGraphInput {
  title: string
  description?: string
  keywords?: string[]
  nodes: SaveGraphNodeInput[]
  edges: SaveGraphEdgeInput[]
}

export interface SaveGraphResult {
  ok: boolean
  flow?: Awaited<ReturnType<typeof prisma.flow.findFirst>>
  validationReport?: CompileFlowResult['validationReport']
  warnings?: CompileFlowResult['warnings']
}

export async function listFlows(workspaceId: string, flowCategoryId: string | null) {
  return prisma.flow.findMany({
    where: { workspaceId, flowCategoryId },
    orderBy: { createdAt: 'asc' },
  })
}

export async function createFlow(workspaceId: string, flowCategoryId: string | null, title: string, description?: string) {
  // Compile immediately with an empty graph so the row is never in a
  // "never compiled" limbo state — it will fail validation (no root node)
  // until the user adds content, which is expected and surfaced in the UI.
  const empty = compileFlow({ nodes: [], edges: [], attachments: [], flowCategoryId, flowTitle: title })
  return prisma.flow.create({
    data: {
      workspaceId,
      flowCategoryId,
      title,
      description,
      keywords: [],
      retrievalDocument: empty.retrievalDocument,
      compiledPrompt: empty.compiledPrompt,
      hash: empty.hash || 'unsaved',
      embedding: [],
    },
  })
}

export async function deleteFlow(workspaceId: string, flowId: string): Promise<boolean> {
  const existing = await prisma.flow.findFirst({ where: { id: flowId, workspaceId } })
  if (!existing) return false
  await prisma.flow.delete({ where: { id: flowId } })
  return true
}

export async function getFlowGraph(workspaceId: string, flowId: string) {
  const flow = await prisma.flow.findFirst({ where: { id: flowId, workspaceId } })
  if (!flow) return null
  const nodes = await prisma.flowNode.findMany({
    where: { flowId },
    include: { attachments: true },
    orderBy: { createdAt: 'asc' },
  })
  const nodeIds = nodes.map((n) => n.id)
  const edges = nodeIds.length > 0 ? await prisma.flowEdge.findMany({ where: { sourceNodeId: { in: nodeIds } } }) : []
  return { flow, nodes, edges }
}

export async function saveFlowGraph(
  workspaceId: string,
  flowId: string,
  input: SaveGraphInput,
  embeddingProvider: EmbeddingProvider,
): Promise<SaveGraphResult> {
  const existingFlow = await prisma.flow.findFirst({ where: { id: flowId, workspaceId } })
  if (!existingFlow) return { ok: false }

  // Resolve attachment -> FlowCategory ownership for compiler validation.
  const assetIds = Array.from(new Set(input.nodes.flatMap((n) => n.attachmentAssetIds ?? [])))
  const assets = assetIds.length > 0 ? await prisma.asset.findMany({ where: { id: { in: assetIds } } }) : []
  const assetById = new Map(assets.map((a) => [a.id, a]))

  const compilerNodes: CompilerFlowNode[] = input.nodes.map((n) => ({
    id: n.id,
    question: n.question,
    fieldKey: n.fieldKey,
    fieldType: n.fieldType as CompilerFlowNode['fieldType'],
    terminalType: n.terminalType,
  }))
  const compilerEdges: CompilerFlowEdge[] = input.edges.map((e) => ({
    id: e.id,
    sourceNodeId: e.sourceNodeId,
    targetNodeId: e.targetNodeId,
    label: e.label,
    triggersEscalation: e.triggersEscalation,
  }))
  const compilerAttachments = input.nodes.flatMap((n) =>
    (n.attachmentAssetIds ?? []).map((assetId) => ({
      nodeId: n.id,
      assetId,
      flowCategoryId: assetById.get(assetId)?.flowCategoryId ?? '__unknown__',
    })),
  )

  const compiled = compileFlow({
    nodes: compilerNodes,
    edges: compilerEdges,
    attachments: compilerAttachments,
    flowCategoryId: existingFlow.flowCategoryId,
    flowTitle: input.title,
    flowKeywords: input.keywords,
  })

  if (compiled.validationReport.length > 0) {
    // specs/flow-compiler "Invalid graph save is rejected": reject, keep
    // last valid content, never persist a partially-invalid graph.
    return { ok: false, validationReport: compiled.validationReport, warnings: compiled.warnings }
  }

  // Only recompute the embedding if retrievalDocument actually changed
  // (design.md Decision 2 — determinism target is the retrievalDocument,
  // not the graph).
  let embedding = existingFlow.embedding
  if (compiled.retrievalDocument !== existingFlow.retrievalDocument) {
    try {
      embedding = await embeddingProvider.embed(compiled.retrievalDocument)
    } catch {
      // Graceful degradation: keep the previous embedding rather than
      // blocking the save — the flow is still valid and online, just with
      // a stale embedding until the next successful save.
      embedding = existingFlow.embedding
    }
  }

  const savedFlow = await prisma.$transaction(async (tx) => {
    // Replace the node/edge graph atomically. Deleting FlowNodes cascades
    // to their FlowEdges/FlowNodeAttachments (schema onDelete: Cascade).
    await tx.flowNode.deleteMany({ where: { flowId } })

    // Andrea 2026-07-31 (performance): these used to be per-row create() calls
    // inside for-loops — a 50-node flow meant 130+ sequential round-trips inside
    // the transaction, which is what made saving feel slow on a remote database.
    // createMany sends each set as a single statement, so cost scales with the
    // number of TABLES touched (3) instead of the number of rows.
    //
    // Ordering still matters: edges reference nodes, attachments reference both,
    // so the three inserts stay sequential even though each is now one query.
    await tx.flowNode.createMany({
      data: input.nodes.map((n) => ({
        id: n.id,
        flowId,
        question: n.question,
        positionX: n.positionX,
        positionY: n.positionY,
        fieldKey: n.fieldKey,
        fieldType: n.fieldType,
        terminalType: n.terminalType,
      })),
    })

    await tx.flowEdge.createMany({
      data: input.edges.map((e) => ({
        id: e.id,
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        label: e.label,
        triggersEscalation: !!e.triggersEscalation,
      })),
    })

    const attachments = input.nodes.flatMap((n) =>
      (n.attachmentAssetIds ?? []).map((assetId) => ({ nodeId: n.id, assetId })),
    )
    if (attachments.length > 0) {
      await tx.flowNodeAttachment.createMany({ data: attachments })
    }

    return tx.flow.update({
      where: { id: flowId },
      data: {
        title: input.title,
        description: input.description,
        keywords: input.keywords ?? [],
        retrievalDocument: compiled.retrievalDocument,
        compiledPrompt: compiled.compiledPrompt,
        hash: compiled.hash,
        embedding,
      },
    })
  })

  return { ok: true, flow: savedFlow, warnings: compiled.warnings }
}
