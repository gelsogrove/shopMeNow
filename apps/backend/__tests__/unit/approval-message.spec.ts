/**
 * Tests for the approval message flow
 *
 * SCENARIO: When admin approves a customer (requireManualApproval=true),
 * the system must send a translated WhatsApp notification via the proper pipeline:
 *   1. Get English approval message from workspace.approvalMessage or default
 *   2. Replace [nome] placeholder with customer first name
 *   3. Translate via Security & Translation layer (LLMService.translateSystemMessage)
 *   4. Send via WhatsAppQueueService.enqueue() (with dedup check, NOT raw prisma.create)
 *   5. Save to conversationMessage history
 *
 * RULE: Approval messages must follow the SAME pipeline as after-registration messages.
 * RULE: No hardcoded Italian fallback — default message is in English.
 * RULE: If customer has no phone, skip WA send but don't crash.
 */

// Mock @echatbot/database before any imports
jest.mock("@echatbot/database", () => {
  const mockPrisma = {
    customers: {
      findUnique: jest.fn(),
    },
    workspace: {
      findUnique: jest.fn(),
    },
    chatSession: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    conversationMessage: {
      create: jest.fn(),
    },
    whatsAppQueue: {
      create: jest.fn(),
    },
  }
  return {
    prisma: mockPrisma,
    PrismaClient: jest.fn(() => mockPrisma),
  }
})

// Mock WhatsAppDirectSendService
jest.mock("../../src/services/whatsapp-direct-send.service", () => ({
  WhatsAppDirectSendService: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({ success: true }),
  })),
}))

// Mock MessageRepository
jest.mock("../../src/repositories/message.repository", () => ({
  MessageRepository: jest.fn().mockImplementation(() => ({
    getWorkspaceSettings: jest.fn().mockResolvedValue({}),
  })),
}))

// Mock LLMService.translateSystemMessage
const mockTranslateSystemMessage = jest.fn()
jest.mock("../../src/services/llm.service", () => ({
  LLMService: jest.fn().mockImplementation(() => ({
    translateSystemMessage: mockTranslateSystemMessage,
  })),
}))

import { RegistrationService } from "../../src/application/services/registration.service"
import { prisma } from "@echatbot/database"

describe("Approval Message Flow", () => {
  let registrationService: RegistrationService

  const mockCustomer = {
    id: "cust-1",
    name: "Marco Rossi",
    phone: "+393331234567",
    email: "marco@test.com",
    language: "Italian",
    workspaceId: "ws-1",
    workspace: {
      id: "ws-1",
      name: "Test Shop",
      approvalMessage: null, // No custom message, use default
      whatsappApiKey: "test-key",
      whatsappPhoneNumber: "+39000000",
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    registrationService = new RegistrationService()

    // Default mocks
    ;(prisma.customers.findUnique as jest.Mock).mockResolvedValue(mockCustomer)
    ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
      whatsappApiKey: "test-key",
      whatsappPhoneNumber: "+39000000",
    })
    ;(prisma.chatSession.findFirst as jest.Mock).mockResolvedValue({
      id: "session-1",
    })
    ;(prisma.conversationMessage.create as jest.Mock).mockResolvedValue({
      id: "msg-1",
    })

    // Translation returns Italian version of the message
    mockTranslateSystemMessage.mockResolvedValue(
      "🎉 Ciao Marco, la tua registrazione è stata approvata!"
    )
  })

  // SCENARIO: Approval message goes through full Security & Translation pipeline
  // RULE: Must call LLMService.translateSystemMessage (not raw prisma.create)
  it("should translate approval message via Security & Translation layer", async () => {
    const result = await registrationService.sendApprovalMessage("cust-1")

    // ASSERT: translateSystemMessage was called with English message and customer language
    expect(mockTranslateSystemMessage).toHaveBeenCalledWith(
      expect.stringContaining("Marco"), // Name replaced
      "ws-1", // workspaceId
      "it", // normalized language code
      undefined,
      "approval_confirmation" // stage
    )
    expect(result).toBe(true)
  })

  // SCENARIO: Default approval message is in ENGLISH (not Italian)
  // RULE: No hardcoded Italian fallbacks
  it("should use English default message when workspace.approvalMessage is null", async () => {
    await registrationService.sendApprovalMessage("cust-1")

    // ASSERT: The English template was passed to translator (before translation)
    const callArgs = mockTranslateSystemMessage.mock.calls[0]
    const messagePassedToTranslator = callArgs[0]

    // Must contain English words, not Italian
    expect(messagePassedToTranslator).toContain("approved")
    expect(messagePassedToTranslator).not.toContain("approvata")
    expect(messagePassedToTranslator).not.toContain("registrazione")
  })

  // SCENARIO: Custom workspace approval message is used when set
  // RULE: Database-first architecture — always prefer DB values
  it("should use workspace.approvalMessage when configured", async () => {
    const customMessage =
      "Welcome [nome]! Your account has been approved, start shopping now."
    const customerWithCustomMsg = {
      ...mockCustomer,
      workspace: {
        ...mockCustomer.workspace,
        approvalMessage: customMessage,
      },
    }
    ;(prisma.customers.findUnique as jest.Mock).mockResolvedValue(
      customerWithCustomMsg
    )

    await registrationService.sendApprovalMessage("cust-1")

    // ASSERT: Custom message (with [nome] replaced) was passed to translator
    const callArgs = mockTranslateSystemMessage.mock.calls[0]
    expect(callArgs[0]).toContain("Marco")
    expect(callArgs[0]).toContain("start shopping now")
  })

  // SCENARIO: Customer has no phone number
  // RULE: Don't crash, just skip WA and return false
  it("should return false if customer has no phone number", async () => {
    const noPhoneCustomer = { ...mockCustomer, phone: null }
    ;(prisma.customers.findUnique as jest.Mock).mockResolvedValue(
      noPhoneCustomer
    )

    const result = await registrationService.sendApprovalMessage("cust-1")

    expect(result).toBe(false)
    // Should NOT attempt translation or queue
    expect(mockTranslateSystemMessage).not.toHaveBeenCalled()
  })

  // SCENARIO: Translated message must be saved to conversationMessage history
  // RULE: All bot messages must appear in chat history for frontend display
  it("should save translated message to conversationMessage table", async () => {
    await registrationService.sendApprovalMessage("cust-1")

    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "ws-1",
        customerId: "cust-1",
        role: "assistant",
        content: "🎉 Ciao Marco, la tua registrazione è stata approvata!",
        agentType: "APPROVAL_CONFIRMATION",
      }),
    })
  })

  // SCENARIO: Customer not found
  // RULE: Return false, don't crash
  it("should return false if customer not found", async () => {
    ;(prisma.customers.findUnique as jest.Mock).mockResolvedValue(null)

    const result = await registrationService.sendApprovalMessage("nonexistent")

    expect(result).toBe(false)
    expect(mockTranslateSystemMessage).not.toHaveBeenCalled()
  })

  // SCENARIO: [nome] placeholder is replaced with first name
  // RULE: Personalize all messages before sending
  it("should replace [nome] placeholder with customer first name", async () => {
    await registrationService.sendApprovalMessage("cust-1")

    const callArgs = mockTranslateSystemMessage.mock.calls[0]
    const messagePassedToTranslator = callArgs[0]

    expect(messagePassedToTranslator).toContain("Marco")
    expect(messagePassedToTranslator).not.toContain("[nome]")
  })
})
