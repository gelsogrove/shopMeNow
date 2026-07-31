import {
  FindRelevantFlowsInput,
  FlowCandidate,
  SERIAL_NUMBER_LENGTH,
} from './flow-retrieval.types'

// Real serial format confirmed by the client: exactly 19 chars, e.g.
// HKX3EB100JD25070076 / HKA4OB100LQ26050197. Fixed positional schema
// (true = letter position, false = digit position), 0-indexed:
//   0-2 HKX/HKA (letters), 3 digit, 4-5 letters, 6-8 digits,
//   9-10 letters, 11-18 digits (encodes the year at 11-12).
const SERIAL_POSITION_IS_LETTER: boolean[] = [
  true, true, true, // 0-2: H K X/A
  false,            // 3
  true, true,       // 4-5
  false, false, false, // 6-8
  true, true,       // 9-10
  false, false, false, false, false, false, false, false, // 11-18
]

// Users frequently mistype 0<->O. Safe to normalize because each position
// has a fixed expected kind (letter or digit) — never a blind global
// replace, which would corrupt real digits like the encoded year.
export function normalizeSerialNumber(serialNumber: string): string {
  const upper = serialNumber.trim().toUpperCase()
  const chars = upper.split('')
  for (let i = 0; i < chars.length && i < SERIAL_POSITION_IS_LETTER.length; i++) {
    const expectsLetter = SERIAL_POSITION_IS_LETTER[i]
    if (expectsLetter && chars[i] === '0') chars[i] = 'O'
    else if (!expectsLetter && chars[i] === 'O') chars[i] = '0'
  }
  return chars.join('')
}

// Step 0 (specs/flow-retrieval "Serial number format pre-check"): must be
// exactly SERIAL_NUMBER_LENGTH chars with the HKX/HKA prefix (after
// normalizing the common 0/O typo) to be attempted against the lookup.
// Anything else is treated as NOT PROVIDED, never classified as
// unknown_model — that reason is reserved for a plausible serial that
// simply doesn't match any known RobotModel.
export function isPlausibleSerialNumber(serialNumber: string | undefined | null): boolean {
  if (!serialNumber) return false
  const normalized = normalizeSerialNumber(serialNumber)
  if (normalized.length !== SERIAL_NUMBER_LENGTH) return false
  return /^HK[XA]/.test(normalized)
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
