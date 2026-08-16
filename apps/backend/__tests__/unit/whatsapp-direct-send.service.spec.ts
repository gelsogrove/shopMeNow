/**
 * WhatsAppDirectSendService - Unit Tests
 *
 * WHAT: verifies the final outbound gate for chat replies — the service every
 * webhook controller (Meta, UltraMsg, Wasender) calls to actually deliver a
 * message: security check → provider send → delivery status → billing.
 *
 * WHY: this is the LAST code that runs before a message reaches a customer on
 * WhatsApp. A regression here silently breaks every conversation on every
 * provider, and its security check is the final LLM safety layer before send —
 * so each gate (playground, phone, security block, fail-open, config, provider
 * failure, billing) must be pinned individually.
 *
 * Test Coverage:
 * - Playground short-circuit (1 test)
 * - Input validation: missing phone (1 test)
 * - Security gate: block, fail-open, skip (3 tests)
 * - Workspace/config gates (2 tests)
 * - Provider send: failure and success paths (2 tests)
 *
 * Total: 9 tests
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals"

// Security agent mock: per-test control over safe/unsafe/throw
const mockSecurityProcess = jest.fn() as any
jest.mock("../../src/application/agents/SecurityAgent", () => ({
  SecurityAgent: jest.fn().mockImplementation(() => ({
    process: mockSecurityProcess,
  })),
}))

// Billing mock: deduction result controlled per test
const mockDeductMessageCredit = jest.fn() as any
jest.mock("../../src/application/services/subscription-billing.service", () => ({
  SubscriptionBillingService: jest.fn().mockImplementation(() => ({
    deductMessageCredit: mockDeductMessageCredit,
  })),
}))

// Provider factory mock: sendTextMessage result controlled per test
const mockSendTextMessage = jest.fn() as any
const mockIsConfigured = jest.fn() as any
jest.mock("../../src/services/whatsapp/whatsapp-provider.factory", () => ({
  WhatsAppProviderFactory: {
    isConfigured: (...args: any[]) => mockIsConfigured(...args),
    getProviderDisplayName: jest.fn().mockReturnValue("Meta Business API"),
    create: jest.fn().mockReturnValue({
      sendTextMessage: (...args: any[]) => mockSendTextMessage(...args),
      getProviderName: jest.fn().mockReturnValue("Meta"),
    }),
  },
}))

// TTS + attachment repo are out of scope here (text-only tests)
jest.mock("../../src/services/tts-elevenlabs.service", () => ({
  generateSpeech: jest.fn(),
}))
jest.mock("../../src/repositories/message-attachment.repository", () => ({
  messageAttachmentRepository: { create: jest.fn() },
}))

import { WhatsAppDirectSendService } from "../../src/services/whatsapp-direct-send.service"

const mockPrisma = {
  workspace: { findUnique: jest.fn() as any },
  conversationMessage: {
    findUnique: jest.fn() as any,
    update: jest.fn() as any,
  },
} as any

const baseParams = {
  workspaceId: "ws1",
  customerId: "cust1",
  phoneNumber: "+393331234567",
  messageContent: "Hello!",
}

describe("WhatsAppDirectSendService - Unit Tests", () => {
  let service: WhatsAppDirectSendService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new WhatsAppDirectSendService(mockPrisma)

    // Defaults: everything succeeds — individual tests override one gate each
    mockSecurityProcess.mockResolvedValue({ safe: true })
    mockDeductMessageCredit.mockResolvedValue({ success: true, newBalance: 10 })
    mockIsConfigured.mockReturnValue(true)
    mockSendTextMessage.mockResolvedValue({ success: true, messageId: "wamid_1" })
    mockPrisma.workspace.findUnique.mockResolvedValue({
      id: "ws1",
      whatsappProvider: "meta",
      metaPhoneNumberId: "p1",
      metaAccessToken: "t1",
    })
    mockPrisma.conversationMessage.findUnique.mockResolvedValue(null)
    mockPrisma.conversationMessage.update.mockResolvedValue({})
  })

  it("should short-circuit in playground mode without sending", async () => {
    // WHY: playground messages must never reach a real customer nor be billed.
    const result = await service.send({ ...baseParams, isPlayground: true })
    expect(result).toEqual({ success: true })
    expect(mockSendTextMessage).not.toHaveBeenCalled()
    expect(mockDeductMessageCredit).not.toHaveBeenCalled()
  })

  it("should fail when destination phone number is missing", async () => {
    const result = await service.send({ ...baseParams, phoneNumber: "" })
    expect(result.success).toBe(false)
    expect(result.error).toBe("Missing destination phone number")
    expect(mockSendTextMessage).not.toHaveBeenCalled()
  })

  it("should block the message when the security check says unsafe", async () => {
    // WHY: this is the FINAL safety layer before a message reaches WhatsApp —
    // an unsafe LLM response must never be delivered, and must not be billed.
    mockSecurityProcess.mockResolvedValue({
      safe: false,
      blockedReason: "sql_injection",
    })

    const result = await service.send(baseParams)

    expect(result.success).toBe(false)
    expect(result.blocked).toBe(true)
    expect(result.error).toBe("sql_injection")
    expect(mockSendTextMessage).not.toHaveBeenCalled()
    expect(mockDeductMessageCredit).not.toHaveBeenCalled()
  })

  it("should fail-open and still send when the security check throws", async () => {
    // WHY: documented fail-open policy — an OpenRouter outage must not mute
    // the whole chatbot; a technical failure of the checker is not a verdict.
    mockSecurityProcess.mockRejectedValue(new Error("OpenRouter timeout"))

    const result = await service.send(baseParams)

    expect(result.success).toBe(true)
    expect(mockSendTextMessage).toHaveBeenCalled()
  })

  it("should skip the security check when skipSecurityCheck is true", async () => {
    // WHY: trusted system-generated content (welcome/WIP/operator notices)
    // bypasses the LLM check by design — but ONLY via this explicit flag.
    const result = await service.send({ ...baseParams, skipSecurityCheck: true })

    expect(result.success).toBe(true)
    expect(mockSecurityProcess).not.toHaveBeenCalled()
    expect(mockSendTextMessage).toHaveBeenCalled()
  })

  it("should fail when the workspace does not exist", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(null)

    const result = await service.send(baseParams)

    expect(result).toEqual({ success: false, error: "Workspace not found" })
    expect(mockSendTextMessage).not.toHaveBeenCalled()
  })

  it("should fail when no WhatsApp provider is configured", async () => {
    mockIsConfigured.mockReturnValue(false)

    const result = await service.send(baseParams)

    expect(result.success).toBe(false)
    expect(result.error).toContain("WhatsApp not configured")
    expect(mockSendTextMessage).not.toHaveBeenCalled()
  })

  it("should return failure and NOT bill when the provider send fails", async () => {
    // WHY: deliver-then-bill policy — a message that never left must never
    // be charged to the tenant.
    mockSendTextMessage.mockResolvedValue({ success: false, error: "timeout" })

    const result = await service.send(baseParams)

    expect(result.success).toBe(false)
    expect(result.error).toBe("timeout")
    expect(mockDeductMessageCredit).not.toHaveBeenCalled()
  })

  it("should send, update delivery status and deduct credit on success", async () => {
    const result = await service.send({
      ...baseParams,
      conversationMessageId: "cm1",
    })

    expect(result).toEqual({ success: true, messageId: "wamid_1" })
    expect(mockSendTextMessage).toHaveBeenCalledWith("+393331234567", "Hello!")
    // Delivery status + wamid persisted for reaction forwarding
    expect(mockPrisma.conversationMessage.update).toHaveBeenCalledWith({
      where: { id: "cm1" },
      data: expect.objectContaining({
        deliveryStatus: "sent",
        whatsappMessageId: "wamid_1",
      }),
    })
    // Billing runs AFTER successful delivery (deliver-then-bill)
    expect(mockDeductMessageCredit).toHaveBeenCalledWith("ws1", "cm1")
  })
})
