import { prisma } from '@echatbot/database'
import logger from '../../utils/logger'
import { EmbeddingProvider } from './embedding-provider'
import { findRelevantFlows, isPlausibleSerialNumber, selectBestFlow } from './flow-retrieval.service'
import { RetrievalEvent } from './flow-retrieval.types'
import { matchSerialNumberToCategory } from './flow-category-lookup.service'

// Orchestrates the full two-step retrieval (analisi.md §8) against real
// data: DB reads scoped by workspaceId (CLAUDE.md §2), embedding call via
// OpenRouter, RetrievalEvent logging. Pure logic (matching, similarity,
// scoring) lives in flow-retrieval.service.ts and is unit-tested there —
// this file is the I/O-bound glue, intentionally thin.

const DEFAULT_TOP_K = 3
const DEFAULT_SIMILARITY_THRESHOLD = 0.7 // conservative starting value, analisi.md §8 "Aperto"

export interface RunRetrievalInput {
  workspaceId: string
  conversationId: string
  serialNumber?: string
  query: string
  topK?: number
  similarityThreshold?: number
}

export interface RunRetrievalResult {
  selectedFlowId?: string
  flowCategoryId?: string
  reason?: 'unknown_model' | 'no_matching_flow'
  event: RetrievalEvent
}

export async function runRetrieval(
  input: RunRetrievalInput,
  embeddingProvider: EmbeddingProvider,
): Promise<RunRetrievalResult> {
  const topK = input.topK ?? DEFAULT_TOP_K
  const threshold = input.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD

  const event: RetrievalEvent = {
    conversationId: input.conversationId,
    serialNumber: input.serialNumber,
    query: input.query,
    candidates: [],
  }

  // Step 1: deterministic serialNumber -> FlowCategory (specs/flow-retrieval
  // "Two-step flow resolution"). A plausible-but-unmatched serial is
  // unknown_model; an implausible/absent one falls straight through to the
  // no-serial-number path (specs/flow-retrieval "No serial number does not
  // block the conversation").
  let flowCategoryId: string | null = null

  if (isPlausibleSerialNumber(input.serialNumber)) {
    try {
      const candidates = await prisma.flowCategory.findMany({
        where: { workspaceId: input.workspaceId },
        select: { id: true, slug: true, lookupRules: true },
      })
      const outcome = matchSerialNumberToCategory(
        input.serialNumber,
        candidates.map((c) => ({ id: c.id, slug: c.slug, lookupRules: c.lookupRules as Record<string, unknown> })),
      )
      if (outcome.status === 'resolved') {
        flowCategoryId = outcome.flowCategoryId
        event.flowCategoryId = flowCategoryId
      } else if (outcome.status === 'not_found') {
        logRetrievalEvent(event)
        return { reason: 'unknown_model', event }
      }
      // serial_absent falls through to generic-flow retrieval below.
    } catch (err) {
      // Graceful degradation (design.md Decision 14): a technical lookup
      // failure is NOT unknown_model — fall through to the generic flow
      // instead of failing the turn.
      logger.error('[demorobot] FlowCategory lookup failed, falling back to generic flow', err)
    }
  }

  // Step 2: semantic search, scoped to flowCategoryId OR the workspace-generic
  // flow (flowCategoryId: null). Embedding/DB failures degrade to "no match"
  // (-> generic flow / escalation upstream) rather than throwing.
  try {
    const queryEmbedding = await embeddingProvider.embed(input.query)

    const flows = await prisma.flow.findMany({
      where: {
        workspaceId: input.workspaceId,
        OR: [{ flowCategoryId }, { flowCategoryId: null }],
      },
      select: { id: true, flowCategoryId: true, embedding: true },
    })

    const candidates = findRelevantFlows({
      flowCategoryId,
      queryEmbedding,
      candidateFlows: flows,
      k: topK,
    })
    event.candidates = candidates

    const best = selectBestFlow(candidates, threshold)
    if (best) {
      event.selectedFlowId = best.flowId
      logRetrievalEvent(event)
      return { selectedFlowId: best.flowId, flowCategoryId: flowCategoryId ?? undefined, event }
    }

    logRetrievalEvent(event)
    return { reason: 'no_matching_flow', flowCategoryId: flowCategoryId ?? undefined, event }
  } catch (err) {
    logger.error('[demorobot] Retrieval (embedding/DB) failed, degrading to no_matching_flow', err)
    logRetrievalEvent(event)
    return { reason: 'no_matching_flow', flowCategoryId: flowCategoryId ?? undefined, event }
  }
}

// specs/flow-retrieval "Retrieval diagnostic logging": structured log,
// consumed both by ChatbotOutput.meta.debug and by §8.1 analytics queries.
// Not a dedicated table (analisi.md §8: "non necessariamente una tabella
// dedicata fin da subito").
function logRetrievalEvent(event: RetrievalEvent): void {
  logger.info('[demorobot][retrieval_event]', event)
}
