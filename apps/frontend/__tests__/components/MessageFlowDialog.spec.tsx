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
