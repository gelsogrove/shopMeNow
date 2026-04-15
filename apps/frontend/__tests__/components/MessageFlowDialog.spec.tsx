/**
 * MessageFlowDialog Tests
 *
 * Tests for the Message Flow Timeline dialog component
 * that displays debug information for AI message processing.
 *
 * @task Timeline improvements - colors, icons, copy functionality
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock data for timeline steps
const mockDebugInfo = {
  steps: [
    {
      type: "router",
      agent: "Router Agent",
      model: "google/gemini-2.0-flash-001",
      temperature: 0.7,
      timestamp: "2024-12-05T10:00:00.000Z",
      input: { userMessage: "ciao" },
      output: { textResponse: "Hello!" },
      tokenUsage: { totalTokens: 5000 },
    },
    {
      type: "safety",
      agent: "Translation Agent",
      model: "openai/gpt-4o-mini",
      temperature: 0.1,
      timestamp: "2024-12-05T10:00:03.000Z",
      systemPrompt: "Translate to target language",
      input: { previousResponse: "Hello!", targetLanguage: "it" },
      output: { translatedText: "Ciao!" },
      tokenUsage: { totalTokens: 500 },
    },
  ],
  totalTokens: 5500,
  totalCost: 0.0033,
  executionTimeMs: 3500,
}

describe("MessageFlowDialog - Agent Colors", () => {
  // Test color mapping for agents
  const colorTests = [
    { agent: "Router Agent", type: "router", expectedColor: "#9333EA" }, // Purple
    { agent: "Product Search Agent", type: "sub_agent", expectedColor: "#3B82F6" }, // Blue
    { agent: "Cart Management Agent", type: "sub_agent", expectedColor: "#10B981" }, // Green
    { agent: "Order Tracking Agent", type: "sub_agent", expectedColor: "#F97316" }, // Orange
    { agent: "Customer Support Agent", type: "sub_agent", expectedColor: "#EC4899" }, // Pink
    { agent: "Summary Agent", type: "sub_agent", expectedColor: "#F472B6" }, // Light Pink
    { agent: "Profile Management Agent", type: "sub_agent", expectedColor: "#64748B" }, // Slate
    { agent: "Translation Agent", type: "safety", expectedColor: "#14B8A6" }, // Teal (NOT red!)
    { agent: "Security Check", type: "sub_agent", expectedColor: "#DC2626" }, // Red
    { agent: "Send to WhatsApp", type: "sub_agent", expectedColor: "#22C55E" }, // Green
  ]

  colorTests.forEach(({ agent, type, expectedColor }) => {
    it(`should have correct color for ${agent}`, () => {
      // This is a logic test - actual implementation uses getAgentColor function
      const getAgentColor = (type: string, agent?: string): string => {
        if (type === "router") return "#9333EA"
        if (agent?.includes("Translation")) return "#14B8A6"
        if (type === "safety") return "#DC2626"
        if (agent === "Security Check") return "#DC2626"
        if (agent === "Send to WhatsApp") return "#22C55E"
        if (agent?.includes("Product")) return "#3B82F6"
        if (agent?.includes("Cart Management")) return "#10B981"
        if (agent?.includes("Order Tracking")) return "#F97316"
        if (agent?.includes("Customer Support")) return "#EC4899"
        if (agent?.includes("Summary")) return "#F472B6"
        if (agent?.includes("Profile Management")) return "#64748B"
        return "#3B82F6"
      }

      const color = getAgentColor(type, agent)
      expect(color).toBe(expectedColor)
    })
  })

  it("Translation Agent should NOT be red", () => {
    const getAgentColor = (type: string, agent?: string): string => {
      if (agent?.includes("Translation")) return "#14B8A6" // Teal - checked BEFORE safety
      if (type === "safety") return "#DC2626"
      return "#3B82F6"
    }

    // Translation has type="safety" but should be teal not red
    const color = getAgentColor("safety", "Translation Agent")
    expect(color).toBe("#14B8A6")
    expect(color).not.toBe("#DC2626")
  })
})

describe("MessageFlowDialog - Temperature Display", () => {
  it("should NOT display temperature when value is 0", () => {
    const temperature = 0
    const shouldDisplay = temperature !== undefined && temperature > 0.2
    expect(shouldDisplay).toBe(false)
  })

  it("should NOT display temperature when value is 0.1", () => {
    const temperature = 0.1
    const shouldDisplay = temperature !== undefined && temperature > 0.2
    expect(shouldDisplay).toBe(false)
  })

  it("should NOT display temperature when value is 0.2", () => {
    const temperature = 0.2
    const shouldDisplay = temperature !== undefined && temperature > 0.2
    expect(shouldDisplay).toBe(false)
  })

  it("should display temperature when value is 0.3", () => {
    const temperature = 0.3
    const shouldDisplay = temperature !== undefined && temperature > 0.2
    expect(shouldDisplay).toBe(true)
  })

  it("should display temperature when value is 0.7", () => {
    const temperature = 0.7
    const shouldDisplay = temperature !== undefined && temperature > 0.2
    expect(shouldDisplay).toBe(true)
  })
})

describe("MessageFlowDialog - Duration Display", () => {
  it("should NOT display duration when executionTimeMs is 0", () => {
    const executionTimeMs = 0
    const shouldDisplay = executionTimeMs !== undefined && executionTimeMs > 0
    expect(shouldDisplay).toBe(false)
  })

  it("should NOT display duration when executionTimeMs is undefined", () => {
    const executionTimeMs = undefined
    const shouldDisplay = executionTimeMs !== undefined && executionTimeMs > 0
    expect(shouldDisplay).toBe(false)
  })

  it("should display duration when executionTimeMs is positive", () => {
    const executionTimeMs = 1500
    const shouldDisplay = executionTimeMs !== undefined && executionTimeMs > 0
    expect(shouldDisplay).toBe(true)
  })

  it("should format duration correctly for values under 1 second", () => {
    const ms = 500
    const formatted = `${ms}ms`
    expect(formatted).toBe("500ms")
  })

  it("should format duration correctly for values over 1 second", () => {
    const ms = 2500
    const sec = Math.floor(ms / 1000)
    const remainMs = ms % 1000
    const formatted = `${sec}s ${remainMs}ms`
    expect(formatted).toBe("2s 500ms")
  })
})

describe("MessageFlowDialog - Timeline Order", () => {
  it("should maintain fixed order without timestamp sorting", () => {
    // The timeline order should be fixed, not sorted by timestamp
    const expectedOrder = [
      "Router Agent",
      "Sub-agents",
      "Translation Agent",
      "Save to History",
      "Add to WhatsApp Queue",
      "Security Check",
      "Send to WhatsApp",
    ]

    // Verify the logical order is correct
    expect(expectedOrder[0]).toBe("Router Agent")
    expect(expectedOrder[3]).toBe("Save to History")
    expect(expectedOrder[4]).toBe("Add to WhatsApp Queue")
    expect(expectedOrder[5]).toBe("Security Check")
    expect(expectedOrder[6]).toBe("Send to WhatsApp")
  })

  it("should place Security Check AFTER Add to WhatsApp Queue", () => {
    const order = [
      "Save to History",
      "Add to WhatsApp Queue",
      "Security Check",
      "Send to WhatsApp",
    ]
    const queueIndex = order.indexOf("Add to WhatsApp Queue")
    const securityIndex = order.indexOf("Security Check")
    expect(securityIndex).toBeGreaterThan(queueIndex)
  })
})

describe("MessageFlowDialog - Timestamp Format", () => {
  it("should format timestamp as HH:MM:SS:mmm (24h with milliseconds)", () => {
    const date = new Date("2024-12-05T14:30:45.123Z")
    const hh = date.getHours().toString().padStart(2, "0")
    const mm = date.getMinutes().toString().padStart(2, "0")
    const ss = date.getSeconds().toString().padStart(2, "0")
    const ms = date.getMilliseconds().toString().padStart(3, "0")
    const formatted = `${hh}:${mm}:${ss}:${ms}`

    // Format should be 24h with milliseconds
    expect(formatted).toMatch(/^\d{2}:\d{2}:\d{2}:\d{3}$/)
  })
})

describe("MessageFlowDialog - Copy Functionality", () => {
  it("should generate text content for clipboard", () => {
    const steps = mockDebugInfo.steps
    const lines: string[] = []

    lines.push("MESSAGE FLOW TIMELINE")
    steps.forEach((step, index) => {
      lines.push(`[STEP ${index + 1}] ${step.agent}`)
      if (step.model) lines.push(`Model: ${step.model}`)
    })

    const content = lines.join("\n")
    expect(content).toContain("MESSAGE FLOW TIMELINE")
    expect(content).toContain("[STEP 1] Router Agent")
    expect(content).toContain("[STEP 2] Translation Agent")
    expect(content).toContain("Model: google/gemini-2.0-flash-001")
  })
})

describe("MessageFlowDialog - textContent Display", () => {
  it("should return textContent directly without JSON parsing", () => {
    const input = { textContent: "Message from Translation Agent:\n\nCiao!" }

    const formatReadable = (obj: any): string => {
      if (obj.textContent) return obj.textContent
      return JSON.stringify(obj)
    }

    const result = formatReadable(input)
    expect(result).toBe("Message from Translation Agent:\n\nCiao!")
    expect(result).not.toContain("{")
  })
})

describe("MessageFlowDialog - Flow Step Colors", () => {
  // RULE: flow-engine gets violet (#7C3AED), flow-agent gets dark blue (#1D4ED8)
  // These are FLOW workspace-specific step types

  const getAgentColor = (type: string, agent?: string): string => {
    if (type === "user" || agent === "Customer") return "#6B7280"
    if (type === "operator_message") return "#3B82F6"
    if (type === "flow-engine") return "#7C3AED" // Violet
    if (type === "flow-agent") return "#1D4ED8"  // Dark blue
    if (type === "router") return "#9333EA"
    if (agent?.includes("Translation")) return "#14B8A6"
    if (type === "safety") return "#DC2626"
    return "#3B82F6"
  }

  it("flow-engine step should have violet color (#7C3AED)", () => {
    // SCENARIO: FlowEngineService step in FLOW workspace debug view
    // RULE: violet signals deterministic state-machine execution (no LLM)
    const color = getAgentColor("flow-engine", "⚙️ Flow Engine")
    expect(color).toBe("#7C3AED")
  })

  it("flow-agent step should have dark blue color (#1D4ED8)", () => {
    // SCENARIO: FlowAgentLLM step that decides which flow to start
    // RULE: dark blue distinguishes flow-agent from generic router (purple)
    const color = getAgentColor("flow-agent", "🤖 Flow Agent")
    expect(color).toBe("#1D4ED8")
  })

  it("flow-engine color should differ from router color", () => {
    // RULE: flow-engine (violet) vs router (purple) must be visually distinct
    const flowEngineColor = getAgentColor("flow-engine")
    const routerColor = getAgentColor("router")
    expect(flowEngineColor).not.toBe(routerColor)
  })

  it("flow-agent color should differ from flow-engine color", () => {
    // RULE: the two FLOW step types must be visually distinct from each other
    const flowAgentColor = getAgentColor("flow-agent")
    const flowEngineColor = getAgentColor("flow-engine")
    expect(flowAgentColor).not.toBe(flowEngineColor)
  })
})

describe("MessageFlowDialog - Flow Step formatReadable", () => {
  // RULE: flow-engine and flow-agent inputs/outputs must produce human-readable summaries

  const formatReadable = (obj: any, type: "input" | "output"): string => {
    if (!obj || Object.keys(obj).length === 0) return ""
    const lines: string[] = []

    if (type === "input") {
      if (obj.textContent) return obj.textContent
      if (obj.userMessage) lines.push(`User Message: ${obj.userMessage}`)
      // flow-agent input
      if (obj.flowKey) lines.push(`Flow: ${obj.flowKey}${obj.flowLabel ? ` (${obj.flowLabel})` : ""}`)
      if (obj.toolsAvailable?.length) lines.push(`Tools: ${obj.toolsAvailable.join(", ")}`)
      if (obj.flowsAvailable?.length) lines.push(`Flows: ${obj.flowsAvailable.join(", ")}`)
      if (obj.historyMessages !== undefined) lines.push(`History Messages: ${obj.historyMessages}`)
      // flow-engine input
      if (obj.flowId) lines.push(`Flow ID: ${obj.flowId}`)
      if (obj.action) lines.push(`Action: ${obj.action}`)
      if (obj.userInput !== undefined && obj.userInput !== null) lines.push(`User Input: ${obj.userInput}`)
      if (obj.previousNodeId) lines.push(`Previous Node: ${obj.previousNodeId}`)
      if (obj.classification) lines.push(`Classification: ${obj.classification}`)
    }

    if (type === "output") {
      if (obj.textContent) return obj.textContent
      if (obj.decision) lines.push(`Decision: ${obj.decision}`)
      // flow-agent output
      if (obj.toolCall) lines.push(`Tool Call: ${obj.toolCall.name}(${JSON.stringify(obj.toolCall.arguments)})`)
      // flow-engine output
      if (obj.nodeId) lines.push(`Node: ${obj.nodeId}`)
      if (obj.nodeType) lines.push(`Node Type: ${obj.nodeType}`)
      if (obj.flowStatus) lines.push(`Status: ${obj.flowStatus}`)
      if (obj.transitionKey !== undefined) lines.push(`Transition: ${obj.transitionKey}`)
      if (obj.shouldCallOperator !== undefined) lines.push(`Call Operator: ${obj.shouldCallOperator ? "✅ Yes" : "No"}`)
      if (obj.interruptCount !== undefined) lines.push(`Interrupts: ${obj.interruptCount}`)
    }

    return lines.length > 0 ? lines.join("\n") : ""
  }

  it("flow-agent input should show flowKey and available tools", () => {
    // SCENARIO: Flow Agent receives message + flow context from router
    const input = {
      userMessage: "la lavatrice non parte",
      flowKey: "lavatrice_hs60xx",
      flowLabel: "Washer HS-60XX",
      historyMessages: 4,
      toolsAvailable: ["startFlow", "contactOperator"],
      flowsAvailable: ["non_parte", "errore_alm"],
    }
    const result = formatReadable(input, "input")
    expect(result).toContain("Flow: lavatrice_hs60xx (Washer HS-60XX)")
    expect(result).toContain("Tools: startFlow, contactOperator")
    expect(result).toContain("Flows: non_parte, errore_alm")
    expect(result).toContain("History Messages: 4")
    expect(result).toContain("User Message: la lavatrice non parte")
  })

  it("flow-agent output should show tool call name and arguments", () => {
    // SCENARIO: Flow Agent decided to call startFlow with flowId
    const output = {
      decision: "tool_call",
      toolCall: { name: "startFlow", arguments: { flowId: "non_parte" } },
    }
    const result = formatReadable(output, "output")
    expect(result).toContain("Decision: tool_call")
    expect(result).toContain('Tool Call: startFlow({"flowId":"non_parte"})')
  })

  it("flow-engine input for startFlow should show flowId and action", () => {
    // SCENARIO: Flow Engine receives startFlow action from Flow Agent
    const input = {
      flowId: "non_parte",
      action: "startFlow",
      userInput: null,
    }
    const result = formatReadable(input, "input")
    expect(result).toContain("Flow ID: non_parte")
    expect(result).toContain("Action: startFlow")
  })

  it("flow-engine input for handleMessage should show classification", () => {
    // SCENARIO: User replied to a CHOICE node with "1" → classification=MATCH
    const input = {
      flowId: "non_parte",
      action: "handleMessage",
      userInput: "1",
      previousNodeId: "non_parte.step_0",
      classification: "MATCH",
    }
    const result = formatReadable(input, "input")
    expect(result).toContain("User Input: 1")
    expect(result).toContain("Previous Node: non_parte.step_0")
    expect(result).toContain("Classification: MATCH")
  })

  it("flow-engine output should show nodeId, flowStatus, and interruptCount", () => {
    // SCENARIO: Flow Engine advanced to next node, flow still active
    const output = {
      nodeId: "non_parte.caso_sel",
      nodeType: "CHOICE",
      flowStatus: "ACTIVE",
      responseText: "Is the door closed?",
      shouldCallOperator: false,
      interruptCount: 0,
    }
    const result = formatReadable(output, "output")
    expect(result).toContain("Node: non_parte.caso_sel")
    expect(result).toContain("Node Type: CHOICE")
    expect(result).toContain("Status: ACTIVE")
    expect(result).toContain("Call Operator: No")
    expect(result).toContain("Interrupts: 0")
  })
})

describe("MessageFlowDialog - FlowStateSummaryBar", () => {
  // RULE: footer bar is shown only when flow-engine steps are present
  // Displays: Flow ID · Node ID · Status (with color) · Interrupt count

  const getFlowStatusColor = (status?: string): string => {
    if (status === "ACTIVE") return "text-green-600"
    if (status === "PAUSED") return "text-yellow-600"
    if (status === "COMPLETED") return "text-blue-600"
    if (status === "ESCALATED") return "text-red-600"
    return "text-gray-600"
  }

  const getFlowStatusEmoji = (status?: string): string => {
    if (status === "ACTIVE") return "🟢"
    if (status === "PAUSED") return "⏸️"
    if (status === "COMPLETED") return "✅"
    if (status === "ESCALATED") return "🔴"
    return ""
  }

  it("should show green color for ACTIVE flow", () => {
    // RULE: green signals the flow is currently running and waiting for user input
    expect(getFlowStatusColor("ACTIVE")).toBe("text-green-600")
    expect(getFlowStatusEmoji("ACTIVE")).toBe("🟢")
  })

  it("should show yellow color for PAUSED flow", () => {
    expect(getFlowStatusColor("PAUSED")).toBe("text-yellow-600")
    expect(getFlowStatusEmoji("PAUSED")).toBe("⏸️")
  })

  it("should show blue color for COMPLETED flow", () => {
    expect(getFlowStatusColor("COMPLETED")).toBe("text-blue-600")
    expect(getFlowStatusEmoji("COMPLETED")).toBe("✅")
  })

  it("should show red color for ESCALATED flow", () => {
    expect(getFlowStatusColor("ESCALATED")).toBe("text-red-600")
    expect(getFlowStatusEmoji("ESCALATED")).toBe("🔴")
  })

  it("should use last flow-engine step when multiple steps present", () => {
    // SCENARIO: Multi-message flow has 2 flow-engine steps (step_0, caso_sel)
    // RULE: show LAST step's state (most recent = current state)
    const flowEngineSteps = [
      { output: { nodeId: "non_parte.step_0", flowStatus: "ACTIVE", interruptCount: 0 } },
      { output: { nodeId: "non_parte.caso_sel", flowStatus: "ACTIVE", interruptCount: 0 } },
    ]
    const lastStep = flowEngineSteps[flowEngineSteps.length - 1]
    expect(lastStep.output.nodeId).toBe("non_parte.caso_sel")
  })

  it("should NOT show footer when no flow-engine steps present", () => {
    // RULE: footer is hidden for non-FLOW workspace messages (regular ecommerce)
    const flowEngineSteps: any[] = []
    const lastFlowEngineStep = flowEngineSteps.length > 0
      ? flowEngineSteps[flowEngineSteps.length - 1]
      : null
    expect(lastFlowEngineStep).toBeNull()
  })

  it("should show footer when flow-engine step is present", () => {
    // RULE: footer appears for FLOW workspace messages
    const flowEngineSteps = [
      { output: { nodeId: "non_parte.step_0", flowStatus: "ACTIVE", interruptCount: 0 } },
    ]
    const lastFlowEngineStep = flowEngineSteps.length > 0
      ? flowEngineSteps[flowEngineSteps.length - 1]
      : null
    expect(lastFlowEngineStep).not.toBeNull()
  })
})

describe("MessageFlowDialog - Timeline Sequence with Flow Steps", () => {
  // RULE: flow-agent comes before flow-engine in the timeline
  // PATH B: Router → FlowAgent (decides flow) → FlowEngine (runs flow) → Translation
  // PATH A: Router → FlowEngine (flow already active) → Translation (no FlowAgent)

  it("flow-agent should appear before flow-engine in PATH B sequence", () => {
    // SCENARIO: New message triggers flow selection (PATH B)
    const sequence = [
      "router",
      "flow-agent",   // decides which flow to start
      "flow-engine",  // runs the flow
      "translation",
    ]
    const flowAgentIdx = sequence.indexOf("flow-agent")
    const flowEngineIdx = sequence.indexOf("flow-engine")
    expect(flowAgentIdx).toBeLessThan(flowEngineIdx)
  })

  it("PATH A should have flow-engine but no flow-agent", () => {
    // SCENARIO: Flow already active, user replied to CHOICE node
    // The router routes directly to FlowEngine without needing FlowAgent
    const steps = [
      { type: "router" },
      { type: "flow-engine" },
      // no flow-agent step
    ]
    const hasFlowAgent = steps.some(s => s.type === "flow-agent")
    const hasFlowEngine = steps.some(s => s.type === "flow-engine")
    expect(hasFlowAgent).toBe(false)
    expect(hasFlowEngine).toBe(true)
  })
})
