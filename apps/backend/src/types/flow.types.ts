// Flow Engine types for ChannelMode.FLOW workspaces
// Used by FlowEngineService, FlowAgentLLM, and FlowWorkspaceStrategy

export type FlowNodeType = "CHOICE" | "ACTION" | "INFO" | "CONFIRMATION" | "FREE_TEXT";

export interface FlowNode {
  type: FlowNodeType;
  prompt: string;
  transitions?: Record<string, string>;
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
}
