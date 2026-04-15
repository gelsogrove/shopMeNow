/**
 * 🎯 TEST: ContactOperator WhatsApp Notification - ChatSummary Scoping Fix
 *
 * SCENARIO: When a customer requests human support and the workspace uses
 * WhatsApp notifications (operatorContactMethod = "whatsapp"), the operator
 * should receive a WhatsApp message that includes the AI-generated chat summary.
 *
 * BUG FIXED: The `chatSummary` variable was declared twice:
 *   - OUTER scope (line ~131): `let chatSummary = ""` → used by WhatsApp notification
 *   - INNER scope (inside `if (session)`): `let chatSummary: string` → shadows the outer one
 *
 * The WhatsApp notification block was OUTSIDE `if (session)`, so it used the
 * OUTER `chatSummary` which was always empty "". The fix removes the inner
 * `let` declaration so all assignments update the outer variable.
 *
 * KEY RULES:
 * 1. WhatsApp notification message MUST include the generated chat summary
 * 2. Summary is generated inside `if (session)` but WhatsApp code is outside
 * 3. After fix, both email and WhatsApp use the same populated chatSummary
 */

// ---- Mocks ----

const mockCreate = jest.fn()
const mockFindFirst = jest.fn()
const mockFindUnique = jest.fn()
const mockFindMany = jest.fn()
const mockUpdate = jest.fn()
const mockDisconnect = jest.fn()

jest.mock("@echatbot/database", () => ({
  prisma: {
    customers: {
      findFirst: (...args: any[]) => mockFindFirst(...args),
      update: (...args: any[]) => mockUpdate(...args),
    },
    chatSession: {
      findFirst: (...args: any[]) => mockFindFirst(...args),
      update: jest.fn().mockResolvedValue({}),
    },
    conversationMessage: {
      findMany: (...args: any[]) => mockFindMany(...args),
    },
    workspace: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
    },
    whatsAppQueue: {
      create: (...args: any[]) => mockCreate(...args),
    },
    $disconnect: () => mockDisconnect(),
  },
}))

// Mock SummaryAgentLLM (loaded via require() inside the function)
const mockGenerateSummary = jest.fn()
jest.mock("../../../src/services/summary-agent-llm.service", () => ({
  SummaryAgentLLM: jest.fn().mockImplementation(() => ({
    generateSummary: mockGenerateSummary,
  })),
}))

// Mock TranslationAgent
jest.mock("../../../src/application/agents/TranslationAgent", () => ({
  TranslationAgent: jest.fn().mockImplementation(() => ({
    process: jest.fn().mockResolvedValue({
      translated: false,
      message: "Mock translated message",
    }),
  })),
}))

jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

import { contactOperator } from "../../../src/domain/calling-functions/contactOperator"

// ---- Tests ----

describe("ContactOperator WhatsApp Summary Fix", () => {
  // Track call order for findFirst (first call = customer, second = session)
  let findFirstCallCount: number

  beforeEach(() => {
    jest.clearAllMocks()
    findFirstCallCount = 0

    // Default: customer found
    mockFindFirst.mockImplementation((...args: any[]) => {
      findFirstCallCount++
      if (findFirstCallCount === 1) {
        // First call = customers.findFirst (find customer by phone)
        return Promise.resolve({
          id: "cust-123",
          name: "Mario Rossi",
          phone: "+393331234567",
          email: "mario@test.com",
          workspaceId: "ws-456",
          language: "it",
          salesId: null,
          sales: null,
        })
      } else {
        // Second call = chatSession.findFirst (find active session)
        return Promise.resolve({
          id: "session-789",
          customerId: "cust-123",
          status: "active",
          createdAt: new Date(),
        })
      }
    })

    // Default: workspace with WhatsApp operator method
    mockFindUnique.mockResolvedValue({
      name: "Test Shop",
      operatorContactMethod: "whatsapp",
      operatorWhatsappNumber: "+34654728753",
      operatorEmail: null,
      hasHumanSupport: true,
      hasSalesAgents: true, // Sales agent routing enabled for these tests
      humanSupportInstructions: "Hello {{nameUser}}, our team will contact you soon.",
      whatsappSettings: { adminEmail: "admin@test.com" },
    })

    // Default: messages in last hour
    mockFindMany.mockResolvedValue([
      {
        id: "msg-1",
        role: "user",
        content: "Ho un problema con il mio ordine",
        createdAt: new Date(),
      },
      {
        id: "msg-2",
        role: "assistant",
        content: "Capisco, posso aiutarti. Qual è il numero d'ordine?",
        createdAt: new Date(),
      },
      {
        id: "msg-3",
        role: "user",
        content: "Voglio parlare con un operatore umano",
        createdAt: new Date(),
      },
    ])

    // Default: summary generated successfully
    mockGenerateSummary.mockResolvedValue({
      success: true,
      summary: "Il cliente Mario Rossi ha un problema con un ordine e richiede assistenza operatore.",
    })

    // Default: queue create and update resolve
    mockCreate.mockResolvedValue({ id: "queue-123" })
    mockUpdate.mockResolvedValue({})
    mockDisconnect.mockResolvedValue(undefined)
  })

  it("should include AI-generated summary in WhatsApp notification message", async () => {
    // SCENARIO: Customer requests human support, workspace uses WhatsApp notifications.
    // RULE: The WhatsApp message queued for the operator MUST contain the summary
    // generated by SummaryAgentLLM, NOT an empty string.
    const result = await contactOperator({
      phoneNumber: "+393331234567",
      workspaceId: "ws-456",
      reason: "Problema con ordine",
    })

    expect(result.success).toBe(true)

    // ASSERT: WhatsApp queue was created
    expect(mockCreate).toHaveBeenCalled()

    // ASSERT: The messageContent contains the AI summary, NOT empty
    const createCall = mockCreate.mock.calls[0][0]
    const messageContent = createCall.data.messageContent

    // The message should contain the summary text
    expect(messageContent).toContain("Il cliente Mario Rossi ha un problema con un ordine")
    // The message should contain customer details
    expect(messageContent).toContain("Mario Rossi")
    expect(messageContent).toContain("+393331234567")
    // The message should NOT be just the template with empty summary
    expect(messageContent).not.toBe("")
    // Verify the summary section is populated (new compact format)
    expect(messageContent).toContain("*Riassunto*")
    // Verify END instruction is present
    expect(messageContent).toContain("Scrivi END quando hai finito")
  })

  it("should include fallback message list when summary generation fails", async () => {
    // SCENARIO: SummaryAgentLLM fails → fallback to "Riassunto non disponibile"
    // RULE: Task 2 requirement - NO message list fallback, only "Riassunto non disponibile"
    mockGenerateSummary.mockRejectedValue(new Error("LLM Service unavailable"))

    const result = await contactOperator({
      phoneNumber: "+393331234567",
      workspaceId: "ws-456",
    })

    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalled()

    const createCall = mockCreate.mock.calls[0][0]
    const messageContent = createCall.data.messageContent

    // Should contain fallback text (NOT message list)
    expect(messageContent).toContain("Riassunto non disponibile")
    // Should NOT contain raw messages (Andrea's requirement: "non voglio vedere gli ultimi messaggi")
    expect(messageContent).not.toContain("Ho un problema con il mio ordine")
    // Should still have operator instructions
    expect(messageContent).toContain("Scrivi END quando hai finito")
    // Should contain customer details
    expect(messageContent).toContain("Mario Rossi")
  })

  it("should include 'no messages' text when session has no recent messages", async () => {
    // SCENARIO: Session exists but no messages in last hour.
    // RULE: Summary should show "Riassunto non disponibile" (Task 2 requirement)
    mockFindMany.mockResolvedValue([]) // No messages

    const result = await contactOperator({
      phoneNumber: "+393331234567",
      workspaceId: "ws-456",
    })

    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalled()

    const createCall = mockCreate.mock.calls[0][0]
    const messageContent = createCall.data.messageContent

    // Should contain the "Riassunto non disponibile" fallback (consistent with failed summary)
    expect(messageContent).toContain("Riassunto non disponibile")
  })

  it("should send to operator WhatsApp number when customer has no assigned agent", async () => {
    // SCENARIO: Customer has no salesId → send to workspace.operatorWhatsappNumber
    // RULE: Priority: agent phone > generic operator phone
    const result = await contactOperator({
      phoneNumber: "+393331234567",
      workspaceId: "ws-456",
    })

    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalled()

    const createCall = mockCreate.mock.calls[0][0]
    // Should be sent to the operator's number
    expect(createCall.data.phoneNumber).toBe("+34654728753")
    expect(createCall.data.workspaceId).toBe("ws-456")
    expect(createCall.data.status).toBe("pending")
  })

  it("should send to agent phone when customer has assigned sales agent", async () => {
    // SCENARIO: Customer has salesId with phone → send to agent's phone
    // RULE: Agent phone takes priority over generic operator phone
    findFirstCallCount = 0
    mockFindFirst.mockImplementation(() => {
      findFirstCallCount++
      if (findFirstCallCount === 1) {
        return Promise.resolve({
          id: "cust-123",
          name: "Mario Rossi",
          phone: "+393331234567",
          email: "mario@test.com",
          workspaceId: "ws-456",
          language: "it",
          salesId: "agent-001",
          sales: {
            firstName: "Luca",
            lastName: "Bianchi",
            email: "luca@test.com",
            phone: "+393339876543",
          },
        })
      } else {
        return Promise.resolve({
          id: "session-789",
          customerId: "cust-123",
          status: "active",
          createdAt: new Date(),
        })
      }
    })

    const result = await contactOperator({
      phoneNumber: "+393331234567",
      workspaceId: "ws-456",
    })

    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalled()

    const createCall = mockCreate.mock.calls[0][0]
    // Should be sent to AGENT's phone, not generic operator
    expect(createCall.data.phoneNumber).toBe("+393339876543")
  })
})
