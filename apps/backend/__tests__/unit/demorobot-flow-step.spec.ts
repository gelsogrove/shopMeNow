/**
 * demorobot — flow step: currentNodeId as state, not inference
 *
 * Andrea 2026-08-03 (flow-runtime.md §2-5). Two properties pinned here:
 *
 *   1. startFlow, when loadFlow supplies a graph, sets currentNodeId to the
 *      graph's root and freezes the graph into the session — the same
 *      "edit-proof" guarantee compiledPrompt already had.
 *   2. formatFlowStepBlock dictates ONE question verbatim and forbids the
 *      model from composing its own — the same pattern as formatIntakeBlock,
 *      which is the one part of the module that never hallucinated.
 */
import { formatFlowStepBlock, startFlow } from "../../custom-demorobot/flow-selection"
import { getState, resetState } from "../../custom-demorobot/state"

const FLOWS = [{ flowId: "flow-err-001", title: "ERROR 001" }]

describe("startFlow — attaching the graph", () => {
  const sessionId = "sess-flow-graph-1"

  beforeEach(() => {
    resetState(sessionId)
  })

  it("sets currentNodeId to the graph's root node when loadFlow supplies nodes", async () => {
    const ctx = {
      sessionId,
      workspaceId: "ws-1",
      availableFlows: FLOWS,
      loadFlow: async () => ({
        compiledPrompt: "## FLOW\n### Q: il robot e' acceso?",
        hash: "h1",
        nodes: [
          {
            id: "n1",
            question: "Il robot è acceso?",
            terminalType: null,
            outgoingEdges: [{ label: "Sì", targetNodeId: "n2" }],
          },
          {
            id: "n2",
            question: "Check falliti, serve un tecnico.",
            terminalType: "ESCALATE",
            outgoingEdges: [],
          },
        ],
      }),
    }

    const result = await startFlow(ctx, { flowId: "flow-err-001" })
    expect(result.ok).toBe(true)

    const state = getState(sessionId)
    expect(state.currentNodeId).toBe("n1")
    expect(state.activeFlowGraphSnapshot).toHaveLength(2)
  })

  it("leaves currentNodeId unset when loadFlow supplies no graph (older flow, no nodes saved)", async () => {
    // Same shape as before this change — a loadFlow that returns only
    // compiledPrompt/hash must keep working exactly as it did.
    const ctx = {
      sessionId,
      workspaceId: "ws-1",
      availableFlows: FLOWS,
      loadFlow: async () => ({ compiledPrompt: "## FLOW\n### Q: il robot e' acceso?", hash: "h1" }),
    }

    const result = await startFlow(ctx, { flowId: "flow-err-001" })
    expect(result.ok).toBe(true)

    const state = getState(sessionId)
    expect(state.currentNodeId).toBeUndefined()
    expect(state.activeFlowGraphSnapshot).toBeUndefined()
    // The flow still attaches from compiledPrompt alone.
    expect(state.activeFlowPromptSnapshot).toContain("il robot e' acceso?")
  })

  it("leaves currentNodeId unset when loadFlow supplies an empty nodes array", async () => {
    const ctx = {
      sessionId,
      workspaceId: "ws-1",
      availableFlows: FLOWS,
      loadFlow: async () => ({ compiledPrompt: "## FLOW", hash: "h1", nodes: [] }),
    }

    const result = await startFlow(ctx, { flowId: "flow-err-001" })
    expect(result.ok).toBe(true)
    expect(getState(sessionId).currentNodeId).toBeUndefined()
  })
})

describe("formatFlowStepBlock", () => {
  it("dictates the question verbatim and forbids composing a new one", () => {
    const block = formatFlowStepBlock("Il robot è acceso?", ["Sì", "No"])

    expect(block).toContain("Il robot è acceso?")
    expect(block).toMatch(/do not invent options/i)
    expect(block).toMatch(/THE QUESTION TO ASK NOW/)
  })

  it("names answer_step and the exact valid labels, so the model can't call it with an invented one", () => {
    const block = formatFlowStepBlock("Il wifi è connesso?", ["Sì", "No"])

    expect(block).toMatch(/answer_step/)
    expect(block).toContain("Sì | No")
  })

  it("tells the model to ask for clarification, not move on, when the answer doesn't match", () => {
    const block = formatFlowStepBlock("Il led è rosso?", ["Sì", "No"])
    expect(block).toMatch(/do not guess/i)
  })

  it("mentions abandon_flow as the way out when the customer changes subject", () => {
    const block = formatFlowStepBlock("Il led è rosso?", ["Sì", "No"])
    expect(block).toMatch(/abandon_flow/)
  })

  // A node with no outgoing edges is a terminal — nothing to ask here, the
  // caller (agent.ts) routes by terminalType instead of showing a dead block.
  it("returns null when there are no valid labels to answer with", () => {
    expect(formatFlowStepBlock("Check falliti.", [])).toBeNull()
  })
})
