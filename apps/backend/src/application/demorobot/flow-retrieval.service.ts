import {
  FindRelevantFlowsInput,
  FlowCandidate,
  MIN_SERIAL_NUMBER_LENGTH,
} from './flow-retrieval.types'

// Step 0 (specs/flow-retrieval "Serial number format pre-check"): a
// serialNumber under 12 chars is treated as NOT PROVIDED, never attempted
// against the lookup, and never classified as unknown_model.
export function isPlausibleSerialNumber(serialNumber: string | undefined | null): boolean {
  if (!serialNumber) return false
  return serialNumber.trim().length >= MIN_SERIAL_NUMBER_LENGTH
}

// Cosine similarity computed in Node (not pgvector — see design.md
// "Vector storage" decision: candidates are already narrowed by
// robotModelId before this runs, so this is cheap at the expected scale of
// hundreds of flows per model, not millions).
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Step 2 (specs/flow-retrieval "Two-step flow resolution"): semantic search
// scoped to candidates already narrowed to `robotModelId OR robotModelId IS
// NULL` (the workspace-generic fallback, analisi.md §5/§6) by the caller.
// Returns topK candidates sorted by descending similarity — the caller
// (not this function) decides the single-best-match attachment contract
// (specs/flow-retrieval "Single best-match attachment").
export function findRelevantFlows(input: FindRelevantFlowsInput): FlowCandidate[] {
  const scored = input.candidateFlows
    .filter((f) => f.robotModelId === input.robotModelId || f.robotModelId === null)
    .map((f) => ({ flowId: f.id, similarity: cosineSimilarity(input.queryEmbedding, f.embedding) }))
    .sort((a, b) => b.similarity - a.similarity)

  return scored.slice(0, input.k)
}

// specs/flow-retrieval "Single best-match attachment": only the top
// candidate above threshold is attached; runners-up are diagnostic-only.
export function selectBestFlow(
  candidates: FlowCandidate[],
  threshold: number,
): { flowId: string; similarity: number } | null {
  const best = candidates[0]
  if (!best || best.similarity < threshold) return null
  return { flowId: best.flowId, similarity: best.similarity }
}
