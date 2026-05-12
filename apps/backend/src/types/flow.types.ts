/**
 * @deprecated F50 — Andrea 2026-05-13 — Visual Flow Builder deprecated.
 * Replaced by code-based custom chatbot modules (apps/backend/custom-<name>/).
 * Types kept temporarily for compatibility while we measure production
 * usage. Pending physical removal in a dedicated cleanup session.
 */
// Flow Engine types for ChannelMode.FLOW workspaces
// Used by FlowEngineService, FlowAgentLLM, and FlowWorkspaceStrategy

export type FlowNodeType = "CHOICE" | "ACTION" | "INFO" | "CONFIRMATION" | "FREE_TEXT";

export interface FlowNode {
  type: FlowNodeType;
  prompt: string;
  transitions?: Record<string, string>;
  /** LLM-readable descriptions for each transition key — used by Sub-LLM to classify free-text user input */
  transitionDescriptions?: Record<string, string>;
  isTerminal?: boolean;
  action?: "escalate" | "resolve";
  onInterruptFallback?: string;
}

export interface FlowDefinition {
  [nodeId: string]: FlowNode;
}

export interface FlowMap {
  [flowId: string]: FlowDefinition;
}

export type FlowStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "ESCALATED";

export interface FlowState {
  flowId: string;
  currentNodeId: string;
  flowStatus: FlowStatus;
  interruptCount: number;
  lastInterruptType?: string | null;
  lastValidStepAt: string; // ISO timestamp
}

export interface GatherState {
  locale?: string;           // "Goya" | "Pineda" | "L'Escala" | "Alemanya" | "Hortes"
  machineType?: string;      // "lavatrice" | "asciugatrice"
  machineNumber?: string;    // "42"
  retryCount: number;        // escalate after 3 failed attempts
}

export interface ChatContext {
  flowKey?: string;
  flowNumber?: string;
  flowState?: FlowState;
  gatherState?: GatherState; // accumulated info during router gather phase
}

export interface FlowStepResult {
  responseText: string;
  nextNodeId: string | null;
  flowStatus: FlowStatus;
  shouldCallOperator: boolean;
  isFaqInterrupt?: boolean;   // true → strategy must answer FAQ via LLM then append responseText
  /** true → CHOICE node got AMBIGUOUS input; strategy should call Sub-LLM to classify then re-feed */
  isAmbiguousChoice?: boolean;
  /** transition descriptions for LLM classification (only set when isAmbiguousChoice=true) */
  choiceTransitionDescriptions?: Record<string, string>;
  /** raw user input that was ambiguous (for re-classification) */
  ambiguousInput?: string;
  // DebugFlow — populated by FlowEngineService for rich debug traces
  debug?: {
    classification: string;       // MATCH | HARD_BREAK | SOFT_BREAK | INTERRUPT_FAQ | AMBIGUOUS
    normalizedInput?: string;     // "YES" | "NO" | "1" | "2" etc.
    previousNodeId: string;       // node before transition
    transitionKey?: string;       // the transition key used (e.g. "YES", "3", "default")
    nodeType?: string;            // type of the resolved node (CHOICE, CONFIRMATION, etc.)
    interruptCount?: number;
  };
}
