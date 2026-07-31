// Types for the demoRobot two-step retrieval layer.
// See apps/backend/custom-demorobot/docs/analisi.md §8 and
// openspec/changes/demorobot-flow-chatbot/specs/flow-retrieval/spec.md.

// Real format confirmed by the client (resolves the §13 blocker): always 19
// characters, prefix HKX (2025 models) or HKA (2026 models), e.g.
// HKX3EB100JD25070076 / HKA4OB100LQ26050197. Kept as a length constant for
// backward-compat naming even though the check is now exact-length, not
// minimum — see isPlausibleSerialNumber in flow-retrieval.service.ts.
export const SERIAL_NUMBER_LENGTH = 19

export interface RetrievableFlow {
  id: string
  robotModelId: string | null
  embedding: number[]
}

export interface FlowCandidate {
  flowId: string
  similarity: number
}

export interface FindRelevantFlowsInput {
  robotModelId: string | null
  queryEmbedding: number[]
  candidateFlows: RetrievableFlow[]
  k: number
}

export interface RetrievalEvent {
  conversationId: string
  serialNumber?: string
  robotModelId?: string
  query: string
  candidates: FlowCandidate[]
  selectedFlowId?: string
}

export type ModelLookupOutcome =
  | { status: 'resolved'; robotModelId: string }
  | { status: 'not_found' } // reason: unknown_model
  | { status: 'serial_absent' } // below MIN_SERIAL_NUMBER_LENGTH, not attempted
  | { status: 'lookup_error' } // technical failure, distinct from not_found
