// FlowEngineService — deterministic flow execution engine.
//
// PRINCIPLE: This service NEVER calls an LLM.
// It reads a FlowMap (JSON from FlowNodeConfig.flows), reads ChatSession.context.flowState,
// and applies deterministic transitions based on user input classification.
//
// LLM is involved only BEFORE this service (FlowAgentLLM decides which startFlow() to call)
// and AFTER this service (TranslationAgent translates the responseText).

import { FlowMap, FlowState, FlowNode, ChatContext, FlowStepResult, FlowStatus } from "../../types/flow.types";
import { classifyInput, normalizeInput } from "./flow-classifier.service";

const INTERRUPT_SOFT_LIMIT = 3;   // at interrupt 3: "let's solve the machine issue first"
const INTERRUPT_HARD_LIMIT = 4;   // at interrupt 4+: escalate to operator
const FLOW_TTL_MINUTES = 30;      // reset interruptCount after 30 min of inactivity

export class FlowEngineService {
  constructor(private flows: FlowMap) {}

  // ---------------------------------------------------------------------------
  // startFlow — called by FlowAgentLLM after tool_call "startFlow(flowId)"
  // ---------------------------------------------------------------------------

  startFlow(flowId: string, context: ChatContext): { responseText: string; context: ChatContext } {
    const flow = this.flows[flowId];
    if (!flow) throw new Error(`Flow "${flowId}" not found in FlowNodeConfig`);

    const firstNodeId = `${flowId}.step_0`;
    const firstNode = this.resolveNode(firstNodeId);

    context.flowState = {
      flowId,
      currentNodeId: firstNodeId,
      flowStatus: "ACTIVE",
      interruptCount: 0,
      lastInterruptType: null,
      lastValidStepAt: new Date().toISOString(),
    };

    return { responseText: firstNode.prompt, context };
  }

  // ---------------------------------------------------------------------------
  // handleMessage — called by FlowWorkspaceStrategy when flowState is ACTIVE
  // ---------------------------------------------------------------------------

  handleMessage(input: string, context: ChatContext): FlowStepResult {
    const state = context.flowState;
    if (!state || state.flowStatus !== "ACTIVE") {
      throw new Error("FlowEngineService.handleMessage: no active flow in context");
    }

    // Reset interruptCount if TTL has expired (user walked away and came back)
    if (this.isTTLExpired(state)) {
      state.interruptCount = 0;
      state.lastValidStepAt = new Date().toISOString();
    }

    const node = this.resolveNode(state.currentNodeId);
    const classification = classifyInput(input);

    // 🔴 HARD_BREAK — immediate escalation
    if (classification === "HARD_BREAK") {
      return this.escalate(state, context, "I'm connecting you with an operator 👍");
    }

    // 🟡 SOFT_BREAK — pause flow, keep state so user can resume
    if (classification === "SOFT_BREAK") {
      state.flowStatus = "PAUSED";
      return {
        responseText: "OK 👍 I'm here whenever you need me.",
        nextNodeId: state.currentNodeId,
        flowStatus: "PAUSED",
        shouldCallOperator: false,
      };
    }

    // 🔵 MATCH — advance to next node via transition table
    if (classification === "MATCH") {
      return this.applyTransition(input, node, state, context);
    }

    // 🟣 INTERRUPT_FAQ — off-topic question while flow is active
    if (classification === "INTERRUPT_FAQ") {
      state.interruptCount++;
      state.lastInterruptType = "FAQ";

      if (state.interruptCount >= INTERRUPT_SOFT_LIMIT) {
        return {
          responseText: "Let's sort out the machine issue first 🔧 — then I'll help you with everything else.",
          nextNodeId: state.currentNodeId,
          flowStatus: "ACTIVE",
          shouldCallOperator: false,
        };
      }

      // Return FAQ signal — FlowWorkspaceStrategy will pass to FlowAgentLLM for FAQ answer,
      // then append node.onInterruptFallback to resume the flow
      return {
        responseText: node.onInterruptFallback ?? node.prompt,
        nextNodeId: state.currentNodeId,
        flowStatus: "ACTIVE",
        shouldCallOperator: false,
      };
    }

    // ⚪ AMBIGUOUS — ask for clarification or escalate after too many attempts
    return this.handleAmbiguous(node, state, context);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private applyTransition(
    input: string,
    node: FlowNode,
    state: FlowState,
    context: ChatContext
  ): FlowStepResult {
    const key = normalizeInput(input);

    const nextNodeId =
      node.transitions?.[key] ||
      node.transitions?.[key.toUpperCase()] ||
      node.transitions?.["default"];

    if (!nextNodeId) {
      return this.handleAmbiguous(node, state, context);
    }

    const nextNode = this.resolveNode(nextNodeId);

    state.currentNodeId = nextNodeId;
    state.lastValidStepAt = new Date().toISOString();
    state.interruptCount = 0;
    state.lastInterruptType = null;

    // Check if this node triggers operator escalation
    const shouldCallOperator = nextNode.action === "escalate";

    if (nextNode.isTerminal) {
      state.flowStatus = shouldCallOperator ? "ESCALATED" : "COMPLETED";
    }

    return {
      responseText: nextNode.prompt,
      nextNodeId,
      flowStatus: state.flowStatus,
      shouldCallOperator,
    };
  }

  private handleAmbiguous(
    node: FlowNode,
    state: FlowState,
    context: ChatContext
  ): FlowStepResult {
    state.interruptCount++;
    state.lastInterruptType = "AMBIGUOUS";

    if (state.interruptCount >= INTERRUPT_HARD_LIMIT) {
      return this.escalate(state, context, "Let me connect you with an operator 👍");
    }

    return {
      responseText: node.onInterruptFallback ?? "I didn't quite understand 🤔 — could you try again?",
      nextNodeId: state.currentNodeId,
      flowStatus: "ACTIVE",
      shouldCallOperator: false,
    };
  }

  private escalate(
    state: FlowState,
    _context: ChatContext,
    message: string
  ): FlowStepResult {
    state.flowStatus = "ESCALATED";
    return {
      responseText: message,
      nextNodeId: null,
      flowStatus: "ESCALATED",
      shouldCallOperator: true,
    };
  }

  /**
   * Resolves a "flowId.nodeId" string to a FlowNode.
   * Example: "non_parte.caso_door" → flows["non_parte"]["caso_door"]
   */
  private resolveNode(nodeId: string): FlowNode {
    const dotIndex = nodeId.indexOf(".");
    if (dotIndex === -1) {
      throw new Error(`Invalid nodeId format: "${nodeId}" — expected "flowId.nodeId"`);
    }
    const flowId = nodeId.slice(0, dotIndex);
    const nId    = nodeId.slice(dotIndex + 1);

    const node = this.flows[flowId]?.[nId];
    if (!node) {
      throw new Error(`Node "${nId}" not found in flow "${flowId}"`);
    }
    return node;
  }

  private isTTLExpired(state: FlowState): boolean {
    if (!state.lastValidStepAt) return false;
    const elapsed = Date.now() - new Date(state.lastValidStepAt).getTime();
    return elapsed > FLOW_TTL_MINUTES * 60 * 1000;
  }
}
