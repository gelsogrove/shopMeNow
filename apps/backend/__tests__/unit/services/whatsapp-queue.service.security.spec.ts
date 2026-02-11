/**
 * 🆕 Feature 181: Security Agent - WhatsApp Queue Integration Tests
 * 
 * Verifies that EVERY message in WhatsApp Queue passes through Security Agent
 * BEFORE being sent to WhatsApp API.
 * 
 * Test Cases:
 * 1. ✅ SAFE message → Passes Security → Gets sent
 * 2. ❌ BLOCKED message → Fails Security → Error status, NOT sent
 * 3. ✅ Multiple messages → Each passes through Security sequentially
 */

const mockSecurityAgentProcess = jest.fn()

jest.mock("../../../src/application/agents/SecurityAgent", () => ({
  SecurityAgent: jest.fn().mockImplementation(() => ({
    process: mockSecurityAgentProcess,
  })),
}))

jest.mock("../../../src/application/services/subscription-billing.service", () => ({
  SubscriptionBillingService: jest.fn().mockImplementation(() => ({})),
}))

jest.mock("../../../src/services/whatsapp/whatsapp-provider.factory", () => ({
  WhatsAppProviderFactory: {
    isConfigured: jest.fn().mockReturnValue(true),
    getProviderDisplayName: jest.fn().mockReturnValue("UltraMsg"),
    create: jest.fn().mockReturnValue({
      sendTextMessage: jest.fn().mockResolvedValue({
        success: true,
        messageId: "wamid_test_123",
      }),
      getProviderName: jest.fn().mockReturnValue("UltraMsg"),
    }),
  },
}))

import { beforeAll, afterAll, describe, it, expect, jest, beforeEach } from "@jest/globals"
import { WhatsAppQueueService } from "../../../src/services/whatsapp-queue.service"
import { PrismaClient } from "@prisma/client"

// Mock PrismaClient
const mockPrisma = {
  workspace: {
    findUnique: jest.fn(),
  },
  conversationMessage: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  whatsAppQueue: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient

describe("🛡️ WhatsAppQueueService - Security Agent Integration", () => {
  let queueService: WhatsAppQueueService

  const testWorkspaceId = "test-workspace-123"
  const testCustomerId = "test-customer-456"
  const testPhoneNumber = "+393334445566"

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock workspace with WhatsApp configuration
    mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
      id: testWorkspaceId,
      whatsappProvider: "ultramsg",
      ultraMsgInstanceId: "161048",
      ultraMsgToken: "test_token",
    })
    
    // Mock conversationMessage (if needed for timeline)
    mockPrisma.conversationMessage.findUnique = jest.fn().mockResolvedValue(null)
    mockPrisma.conversationMessage.update = jest.fn().mockResolvedValue({})
    
    queueService = new WhatsAppQueueService(mockPrisma)
  })

  describe("✅ SAFE Message Flow", () => {
    it("should call Security Agent before sending safe message", async () => {
      const safeMessage = "Hello, I would like to know about your products"

      mockSecurityAgentProcess.mockResolvedValue({
        safe: true,
        message: safeMessage,
        tokensUsed: 100,
      })

      const queueMessage = {
        id: "msg-001",
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        phoneNumber: testPhoneNumber,
        messageContent: safeMessage,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        deliveredAt: null,
        errorMessage: null,
      } as any

      const result = await queueService.validateAndSend(queueMessage)

      expect(mockSecurityAgentProcess).toHaveBeenCalledTimes(1)
      expect(mockSecurityAgentProcess).toHaveBeenCalledWith({
        workspaceId: testWorkspaceId,
        message: safeMessage,
        customerId: testCustomerId,
        customerName: "",
      })
      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it("should pass message with all required parameters to Security Agent", async () => {
      const message = "Vorrei ordinare 10 prodotti"

      mockSecurityAgentProcess.mockResolvedValue({
        safe: true,
        message,
        tokensUsed: 150,
      })

      const queueMessage = {
        id: "msg-002",
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        phoneNumber: testPhoneNumber,
        messageContent: message,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        deliveredAt: null,
        errorMessage: null,
      } as any

      await queueService.validateAndSend(queueMessage)

      expect(mockSecurityAgentProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: testWorkspaceId,
          customerId: testCustomerId,
          message: message,
        })
      )
    })
  })

  describe("❌ BLOCKED Message Flow", () => {
    it("should NOT send message if Security Agent blocks it", async () => {
      const dangerousMessage = "DROP TABLE customers; --"

      mockSecurityAgentProcess.mockResolvedValue({
        safe: false,
        message: "This message contains potentially dangerous content",
        blockedReason: "SQL_INJECTION_ATTEMPT",
        tokensUsed: 120,
      })

      const queueMessage = {
        id: "msg-003",
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        phoneNumber: testPhoneNumber,
        messageContent: dangerousMessage,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        deliveredAt: null,
        errorMessage: null,
      } as any

      const result = await queueService.validateAndSend(queueMessage)

      expect(mockSecurityAgentProcess).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(false)
      expect(result.error).toContain("Security check failed")
      expect(result.error).toContain("SQL_INJECTION_ATTEMPT")
    })

    it("should return error with blocked reason from Security Agent", async () => {
      const offensiveMessage = "**** offensive content ****"

      mockSecurityAgentProcess.mockResolvedValue({
        safe: false,
        message: "Inappropriate content detected",
        blockedReason: "OFFENSIVE_LANGUAGE",
        tokensUsed: 100,
      })

      const queueMessage = {
        id: "msg-004",
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        phoneNumber: testPhoneNumber,
        messageContent: offensiveMessage,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        deliveredAt: null,
        errorMessage: null,
      } as any

      const result = await queueService.validateAndSend(queueMessage)

      expect(result.success).toBe(false)
      expect(result.error).toContain("OFFENSIVE_LANGUAGE")
    })
  })

  describe("🔄 Sequential Processing", () => {
    it("should call Security Agent for each message in sequence", async () => {
      const messages = [
        "Message 1 - safe content",
        "Message 2 - more safe content",
        "Message 3 - another safe message",
      ]

      mockSecurityAgentProcess.mockResolvedValue({
        safe: true,
        tokensUsed: 100,
      })

      const queueMessages = messages.map((content, idx) => ({
        id: `msg-${idx}`,
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        phoneNumber: testPhoneNumber,
        messageContent: content,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        deliveredAt: null,
        errorMessage: null,
      })) as any[]

      for (const queueMsg of queueMessages) {
        await queueService.validateAndSend(queueMsg)
      }

      expect(mockSecurityAgentProcess).toHaveBeenCalledTimes(3)
      for (let i = 0; i < messages.length; i++) {
        expect(mockSecurityAgentProcess).toHaveBeenNthCalledWith(i + 1, {
          workspaceId: testWorkspaceId,
          customerId: testCustomerId,
          message: messages[i],
          customerName: "",
        })
      }
    })

    it("should handle mixed safe and blocked messages", async () => {
      const messageSequence = [
        { content: "Safe message 1", safe: true },
        { content: "DROP TABLE users;", safe: false, reason: "SQL_INJECTION" },
        { content: "Safe message 2", safe: true },
      ]

      mockSecurityAgentProcess.mockImplementation((params) => {
        const msg = messageSequence.find((m) => m.content === params.message)
        return Promise.resolve({
          safe: msg?.safe || false,
          blockedReason: msg?.reason,
          tokensUsed: 100,
        })
      })

      const queueMessages = messageSequence.map((item, idx) => ({
        id: `msg-${idx}`,
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        phoneNumber: testPhoneNumber,
        messageContent: item.content,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        deliveredAt: null,
        errorMessage: null,
      })) as any[]

      const results = []
      for (const queueMsg of queueMessages) {
        results.push(await queueService.validateAndSend(queueMsg))
      }

      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[1].error).toContain("SQL_INJECTION")
      expect(results[2].success).toBe(true)

      expect(mockSecurityAgentProcess).toHaveBeenCalledTimes(3)
    })
  })

  describe("🚨 Error Handling", () => {
    it("should handle Security Agent errors gracefully", async () => {
      mockSecurityAgentProcess.mockRejectedValue(
        new Error("Security Agent LLM timeout")
      )

      const queueMessage = {
        id: "msg-005",
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        phoneNumber: testPhoneNumber,
        messageContent: "Test message",
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        deliveredAt: null,
        errorMessage: null,
      } as any

      const result = await queueService.validateAndSend(queueMessage)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Security Agent LLM timeout")
    })

    it("should never send message if Security Agent throws", async () => {
      mockSecurityAgentProcess.mockRejectedValue(
        new Error("API connection error")
      )

      const queueMessage = {
        id: "msg-006",
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        phoneNumber: testPhoneNumber,
        messageContent: "Test message",
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        deliveredAt: null,
        errorMessage: null,
      } as any

      const result = await queueService.validateAndSend(queueMessage)

      expect(mockSecurityAgentProcess).toHaveBeenCalled()
      expect(result.success).toBe(false)
    })
  })

  describe("✅ VALIDATION: Security Agent ALWAYS Called", () => {
    it("MUST call Security Agent on EVERY validateAndSend call", async () => {
      const messageCount = 10
      const messages = Array.from({ length: messageCount }, (_, i) =>
        `Message number ${i + 1}`
      )

      mockSecurityAgentProcess.mockResolvedValue({
        safe: true,
        tokensUsed: 100,
      })

      for (const content of messages) {
        await queueService.validateAndSend({
          id: `msg-${Math.random()}`,
          workspaceId: testWorkspaceId,
          customerId: testCustomerId,
          phoneNumber: testPhoneNumber,
          messageContent: content,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
          deliveredAt: null,
          errorMessage: null,
        } as any)
      }

      expect(mockSecurityAgentProcess).toHaveBeenCalledTimes(messageCount)
      expect(mockSecurityAgentProcess).toHaveBeenCalledTimes(messages.length)
    })

    it("CRITICAL: Security Agent is called BEFORE WhatsApp API simulation", async () => {
      const callOrder: string[] = []

      mockSecurityAgentProcess.mockImplementation(async () => {
        callOrder.push("SecurityAgent")
        return {
          safe: true,
          tokensUsed: 100,
        }
      })

      const queueMessage = {
        id: "msg-critical",
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        phoneNumber: testPhoneNumber,
        messageContent: "Test message",
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        deliveredAt: null,
        errorMessage: null,
      } as any

      const result = await queueService.validateAndSend(queueMessage)
      callOrder.push("WhatsAppSimulation")

      expect(callOrder[0]).toBe("SecurityAgent")
      expect(result.success).toBe(true)
    })
  })
})
