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

export interface ChatContext {
  flowKey?: string;
  flowNumber?: string;
  flowState?: FlowState;
}

export interface FlowStepResult {
  responseText: string;
  nextNodeId: string | null;
  flowStatus: FlowStatus;
  shouldCallOperator: boolean;
}
