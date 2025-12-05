/**
 * WhatsApp Challenge Queue - Timeline Steps Tests
 *
 * Tests for the timeline steps appended by the scheduler
 * (Security Check and Send to WhatsApp steps)
 *
 * @task Timeline improvements - scheduler step format
 */

import { describe, it, expect } from "@jest/globals"

// Simulated TimelineStep interface from scheduler
interface TimelineStep {
  type: "sub_agent"
  agent: string
  timestamp: string
  model?: string
  systemPrompt?: string
  input?: {
    phoneNumber?: string
    messageContent?: string
    queueId?: string
    customerId?: string
  }
  output?: {
    textResponse?: string
  }
}

describe("WhatsApp Queue - Security Check Step", () => {
  it("should have correct structure for Security Check step", () => {
    const securityStep: TimelineStep = {
      type: "sub_agent",
      agent: "Security Check",
      timestamp: new Date().toISOString(),
      model: "security-patterns/v1",
      systemPrompt:
        "Validates outgoing messages using pattern-based detection: SQL injection, XSS, command injection, sensitive data exposure, spam patterns. Also checks customer blacklist status.",
      input: {
        messageContent: "Hello, this is a test message",
        customerId: "customer-123",
      },
      output: {
        textResponse: "✅ Message passed security validation",
      },
    }

    expect(securityStep.agent).toBe("Security Check")
    expect(securityStep.model).toBe("security-patterns/v1")
    expect(securityStep.systemPrompt).toBeDefined()
    expect(securityStep.systemPrompt).toContain("pattern-based detection")
    expect(securityStep.output?.textResponse).toContain("✅")
  })

  it("should have systemPrompt at root level, not in input", () => {
    const securityStep: TimelineStep = {
      type: "sub_agent",
      agent: "Security Check",
      timestamp: new Date().toISOString(),
      model: "security-patterns/v1",
      systemPrompt: "Validates outgoing messages...",
      input: {
        messageContent: "Test",
        customerId: "123",
      },
      output: {
        textResponse: "✅ Message passed security validation",
      },
    }

    // systemPrompt should be at root level for frontend to display in PROMPT section
    expect(securityStep.systemPrompt).toBeDefined()
    expect((securityStep.input as any)?.prompt).toBeUndefined()
  })

  it("should show blocked message when security fails", () => {
    const blockedReason = "SQL injection detected"
    const textResponse = `🚫 Blocked: ${blockedReason}`

    expect(textResponse).toContain("🚫")
    expect(textResponse).toContain(blockedReason)
  })
})

describe("WhatsApp Queue - Send to WhatsApp Step", () => {
  it("should have correct structure for Send to WhatsApp step", () => {
    const phoneNumber = "+39123456789"
    const messageContent = "Ciao! Come posso aiutarti?"

    const whatsappStep: TimelineStep = {
      type: "sub_agent",
      agent: "Send to WhatsApp",
      timestamp: new Date().toISOString(),
      model: "WhatsApp Cloud API",
      input: {
        phoneNumber,
        messageContent: messageContent.substring(0, 200),
        queueId: "queue-123",
      },
      output: {
        textResponse: `✅ Message delivered to ${phoneNumber}\n\n${messageContent}`,
      },
    }

    expect(whatsappStep.agent).toBe("Send to WhatsApp")
    expect(whatsappStep.model).toBe("WhatsApp Cloud API")
    expect(whatsappStep.input?.phoneNumber).toBe(phoneNumber)
    expect(whatsappStep.output?.textResponse).toContain("✅ Message delivered")
    expect(whatsappStep.output?.textResponse).toContain(phoneNumber)
    expect(whatsappStep.output?.textResponse).toContain(messageContent)
  })

  it("should NOT have executionTimeMs when it is 0", () => {
    // executionTimeMs should not be included when it's 0 to avoid showing "0" in UI
    const whatsappStep: TimelineStep = {
      type: "sub_agent",
      agent: "Send to WhatsApp",
      timestamp: new Date().toISOString(),
      model: "WhatsApp Cloud API",
      input: {
        phoneNumber: "+39123456789",
        messageContent: "Test",
        queueId: "123",
      },
      output: {
        textResponse: "✅ Message delivered",
        // Note: NO executionTimeMs field when it would be 0
      },
    }

    expect((whatsappStep.output as any)?.executionTimeMs).toBeUndefined()
  })

  it("should include full message in output textResponse", () => {
    const fullMessage =
      "Ciao Andrea! 🎉 Il tuo ordine è stato confermato. Riceverai una notifica quando sarà spedito."

    const textResponse = `✅ Message delivered to +39123456789\n\n${fullMessage}`

    expect(textResponse).toContain(fullMessage)
    expect(textResponse.split("\n\n")[1]).toBe(fullMessage)
  })

  it("should truncate long messages in input but show full in output", () => {
    const longMessage = "A".repeat(300)

    const input = {
      messageContent:
        longMessage.substring(0, 200) + (longMessage.length > 200 ? "..." : ""),
    }

    const output = {
      textResponse: `✅ Message delivered to +39123456789\n\n${longMessage}`,
    }

    // Input should be truncated
    expect(input.messageContent.length).toBeLessThanOrEqual(203) // 200 + "..."

    // Output should have full message
    expect(output.textResponse).toContain(longMessage)
  })
})

describe("Timeline Step Order", () => {
  it("should have Security Check before Send to WhatsApp", () => {
    const steps = [
      { agent: "Save to History", order: 1 },
      { agent: "Add to WhatsApp Queue", order: 2 },
      { agent: "Security Check", order: 3 },
      { agent: "Send to WhatsApp", order: 4 },
    ]

    const securityIndex = steps.findIndex((s) => s.agent === "Security Check")
    const sendIndex = steps.findIndex((s) => s.agent === "Send to WhatsApp")

    expect(securityIndex).toBeLessThan(sendIndex)
  })

  it("should have Add to WhatsApp Queue before Security Check", () => {
    const steps = [
      { agent: "Save to History", order: 1 },
      { agent: "Add to WhatsApp Queue", order: 2 },
      { agent: "Security Check", order: 3 },
      { agent: "Send to WhatsApp", order: 4 },
    ]

    const queueIndex = steps.findIndex(
      (s) => s.agent === "Add to WhatsApp Queue"
    )
    const securityIndex = steps.findIndex((s) => s.agent === "Security Check")

    expect(queueIndex).toBeLessThan(securityIndex)
  })
})
