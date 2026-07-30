// Types for the demoRobot two-step retrieval layer.
// See apps/backend/custom-demorobot/docs/analisi.md §8 and
// openspec/changes/demorobot-flow-chatbot/specs/flow-retrieval/spec.md.

export const MIN_SERIAL_NUMBER_LENGTH = 12

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
