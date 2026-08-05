// Types for the demoRobot flow compiler.
// See apps/backend/custom-demorobot/docs/analisi.md §4-5 and
// openspec/changes/demorobot-flow-chatbot/specs/flow-compiler/spec.md.

export type TerminalType = 'SELF_SERVICE' | 'ESCALATE' | 'END' | 'LOOP' | null

export interface CompilerFlowNode {
  id: string
  question: string
  fieldKey?: string | null
  fieldType?: 'string' | 'number' | 'boolean' | 'date' | 'enum' | null
  terminalType?: TerminalType
}

export interface CompilerFlowEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string | null
  /** Hands over to another flow instead of a node here. Excludes targetNodeId. */
  targetFlowId?: string | null
  targetFlowTitle?: string | null
  label: string
  triggersEscalation?: boolean
}

export interface CompilerAttachmentRef {
  nodeId: string
  assetId: string
  flowCategoryId: string
}

export interface CompileFlowInput {
  nodes: CompilerFlowNode[]
  edges: CompilerFlowEdge[]
  attachments: CompilerAttachmentRef[]
  // The FlowCategory every attachment must belong to. Undefined for the
  // workspace-generic flow (flowCategoryId: null, analisi.md §6).
  flowCategoryId?: string | null
  flowTitle: string
  // One or two sentences describing WHEN this flow applies, in the customer's
  // own terms ("il robot lampeggia rosso e non parte"), not the operator's
  // shorthand ("ERROR 001"). Feeds both the retrievalDocument — where it is the
  // main thing that makes a real WhatsApp message match a terse title — and the
  // compiledPrompt header, so the executing LLM knows what case it is handling.
  // Usually LLM-generated from the graph (flow-description-generator.service),
  // then editable by the user.
  flowDescription?: string | null
  flowKeywords?: string[]
  /** Id of the flow being compiled — lets validation reject an edge that hands over to itself. */
  flowId?: string | null
}

export interface ValidationError {
  code:
    | 'no_root_node'
    | 'multiple_root_nodes'
    | 'unreachable_terminal'
    | 'unexpected_cycle'
    | 'dangling_edge'
    | 'duplicate_edge_label'
    | 'converging_edge_targets'
    | 'empty_edge_label'
    | 'edge_targets_both_node_and_flow'
    | 'edge_targets_self_flow'
    | 'attachment_wrong_model'
    | 'attachment_missing'
    | 'size_limit_exceeded'
  message: string
  nodeId?: string
  edgeId?: string
}

export interface CompileFlowWarning {
  code: 'unreachable_node' | 'duplicate_field_key' | 'approaching_size_limit'
  message: string
  nodeId?: string
}

export const ALLOWED_TOOLS_BY_TERMINAL_TYPE: Record<Exclude<TerminalType, null>, string[]> = {
  SELF_SERVICE: ['remember'],
  END: ['remember'],
  ESCALATE: ['remember', 'escalate_to_operator'],
  LOOP: ['remember'],
}

export interface CompileFlowResult {
  compiledPrompt: string
  retrievalDocument: string
  hash: string
  assetIds: string[]
  validationReport: ValidationError[]
  warnings: CompileFlowWarning[]
}

// Non-final v1 guardrails (analisi.md §5 "Limiti dimensionali" — indicative,
// to be tuned once real usage data exists).
export const FLOW_SIZE_LIMITS = {
  maxNodesWarning: 80,
  maxNodesHard: 150,
  maxAttachmentsPerNodeWarning: 5,
  maxCompiledPromptCharsWarning: 40_000,
  maxCompiledPromptCharsHard: 80_000,
}
