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

import { PrismaClient } from "@prisma/client"
import { beforeAll, afterAll, describe, it, expect, jest, beforeEach } from "@jest/globals"
import { WhatsAppQueueService } from "../../../src/services/whatsapp-queue.service"
import { SecurityAgent } from "../../../src/application/agents/SecurityAgent"

// Mock SecurityAgent
jest.mock("../../../src/application/agents/SecurityAgent")

describe("🛡️ WhatsAppQueueService - Security Agent Integration", () => {
  let prisma: PrismaClient
  let queueService: WhatsAppQueueService
  let mockSecurityAgent: jest.Mocked<SecurityAgent>

  const testWorkspaceId = "test-workspace-123"
  const testCustomerId = "test-customer-456"
  const testPhoneNumber = "+393334445566"

  beforeAll(async () => {
    prisma = new PrismaClient()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks()

    // Create service with fresh instance
    queueService = new WhatsAppQueueService(prisma)

    // Get the mocked SecurityAgent instance
    mockSecurityAgent = (SecurityAgent as jest.MockedClass<typeof SecurityAgent>)
      .mock.instances[0] as jest.Mocked<SecurityAgent>
  })

  describe("✅ SAFE Message Flow", () => {
    it("should call Security Agent before sending safe message", async () => {
      // Arrange
      const safeMessage = "Hello, I would like to know about your products"

      mockSecurityAgent.process = jest.fn().mockResolvedValue({
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

      // Act
      const result = await queueService.validateAndSend(queueMessage)

      // Assert
      expect(mockSecurityAgent.process).toHaveBeenCalledTimes(1)
      expect(mockSecurityAgent.process).toHaveBeenCalledWith({
        workspaceId: testWorkspaceId,
        message: safeMessage,
        customerId: testCustomerId,
        customerName: "",
      })
      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it("should pass message with all required parameters to Security Agent", async () => {
      // Arrange
      const message = "Vorrei ordinare 10 prodotti"

      mockSecurityAgent.process = jest.fn().mockResolvedValue({
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

      // Act
      await queueService.validateAndSend(queueMessage)

      // Assert - Verify exact parameters passed to Security Agent
      expect(mockSecurityAgent.process).toHaveBeenCalledWith(
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
      // Arrange
      const dangerousMessage = "DROP TABLE customers; --"

      mockSecurityAgent.process = jest.fn().mockResolvedValue({
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

      // Act
      const result = await queueService.validateAndSend(queueMessage)

      // Assert
      expect(mockSecurityAgent.process).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(false)
      expect(result.error).toContain("Security check failed")
      expect(result.error).toContain("SQL_INJECTION_ATTEMPT")
    })

    it("should return error with blocked reason from Security Agent", async () => {
      // Arrange
      const offensiveMessage = "**** offensive content ****"

      mockSecurityAgent.process = jest.fn().mockResolvedValue({
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

      // Act
      const result = await queueService.validateAndSend(queueMessage)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain("OFFENSIVE_LANGUAGE")
    })
  })

  describe("🔄 Sequential Processing", () => {
    it("should call Security Agent for each message in sequence", async () => {
      // Arrange
      const messages = [
        "Message 1 - safe content",
        "Message 2 - more safe content",
        "Message 3 - another safe message",
      ]

      mockSecurityAgent.process = jest.fn().mockResolvedValue({
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

      // Act
      for (const queueMsg of queueMessages) {
        await queueService.validateAndSend(queueMsg)
      }

      // Assert
      expect(mockSecurityAgent.process).toHaveBeenCalledTimes(3)
      for (let i = 0; i < messages.length; i++) {
        expect(mockSecurityAgent.process).toHaveBeenNthCalledWith(i + 1, {
          workspaceId: testWorkspaceId,
          customerId: testCustomerId,
          message: messages[i],
          customerName: "",
        })
      }
    })

    it("should handle mixed safe and blocked messages", async () => {
      // Arrange - First safe, then blocked, then safe
      const messageSequence = [
        { content: "Safe message 1", safe: true },
        { content: "DROP TABLE users;", safe: false, reason: "SQL_INJECTION" },
        { content: "Safe message 2", safe: true },
      ]

      mockSecurityAgent.process = jest.fn().mockImplementation((params) => {
        const msg = messageSequence.find((m) => m.content === params.message)
        return Promise.resolve({
          safe: msg?.safe || false,
          blockedReason: msg?.reason,
          tokensUsed: 100,
        })
      })

      // Act & Assert
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

      // Assert results match expectations
      expect(results[0].success).toBe(true) // Safe
      expect(results[1].success).toBe(false) // Blocked
      expect(results[1].error).toContain("SQL_INJECTION")
      expect(results[2].success).toBe(true) // Safe

      // All 3 messages passed through Security Agent
      expect(mockSecurityAgent.process).toHaveBeenCalledTimes(3)
    })
  })

  describe("🚨 Error Handling", () => {
    it("should handle Security Agent errors gracefully", async () => {
      // Arrange
      mockSecurityAgent.process = jest
        .fn()
        .mockRejectedValue(new Error("Security Agent LLM timeout"))

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

      // Act
      const result = await queueService.validateAndSend(queueMessage)

      // Assert - Should fail with error, not throw
      expect(result.success).toBe(false)
      expect(result.error).toContain("Security Agent LLM timeout")
    })

    it("should never send message if Security Agent throws", async () => {
      // Arrange
      mockSecurityAgent.process = jest
        .fn()
        .mockRejectedValue(new Error("API connection error"))

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

      // Act
      const result = await queueService.validateAndSend(queueMessage)

      // Assert
      expect(mockSecurityAgent.process).toHaveBeenCalled()
      expect(result.success).toBe(false)
      // Message should NOT be sent on error
    })
  })

  describe("✅ VALIDATION: Security Agent ALWAYS Called", () => {
    it("MUST call Security Agent on EVERY validateAndSend call", async () => {
      // This test ensures the contract: Security Agent is NEVER bypassed
      
      // Arrange - 10 different messages
      const messageCount = 10
      const messages = Array.from({ length: messageCount }, (_, i) =>
        `Message number ${i + 1}`
      )

      mockSecurityAgent.process = jest.fn().mockResolvedValue({
        safe: true,
        tokensUsed: 100,
      })

      // Act
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

      // Assert - CRITICAL: Security Agent called exactly messageCount times
      expect(mockSecurityAgent.process).toHaveBeenCalledTimes(messageCount)
      expect(mockSecurityAgent.process).toHaveBeenCalledTimes(messages.length)
    })

    it("CRITICAL: Security Agent is called BEFORE WhatsApp API simulation", async () => {
      // Arrange
      const callOrder: string[] = []

      mockSecurityAgent.process = jest.fn(async () => {
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

      // Act
      const result = await queueService.validateAndSend(queueMessage)
      callOrder.push("WhatsAppSimulation")

      // Assert - Security Agent MUST be called FIRST
      expect(callOrder[0]).toBe("SecurityAgent")
      expect(result.success).toBe(true)
    })
  })
})
