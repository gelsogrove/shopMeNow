/**
 * WhatsApp Queue Service - Unit Tests
 * 
 * Test Coverage:
 * - Validation (4 tests)
 * - Deduplication (3 tests)
 * - Processing Logic (4 tests)
 * - Workspace Isolation (4 tests)
 * - Timeline Integration (2 tests)
 * 
 * Total: 17 tests
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals"
import { PrismaClient } from "@prisma/client"
import { WhatsAppQueueService } from "../../src/services/whatsapp-queue.service"

// Mock SecurityAgent (🆕 Feature 181)
jest.mock("../../src/application/agents/SecurityAgent", () => {
  return {
    SecurityAgent: jest.fn().mockImplementation(() => ({
      process: jest.fn().mockResolvedValue({
        safe: true, // Default: all messages pass security in these tests
        message: "Message passed security check",
        tokensUsed: 100,
      }),
    })),
  }
})

// Mock PrismaClient
const mockPrisma = {
  whatsAppQueue: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  conversationMessage: {
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  chatSession: {
    findFirst: jest.fn(),
  },
  workspace: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient

describe("WhatsAppQueueService - Unit Tests", () => {
  let service: WhatsAppQueueService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new WhatsAppQueueService(mockPrisma)
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📝 VALIDATION TESTS (4 tests)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Validation", () => {
    it("should reject empty phone number", async () => {
      const message = {
        id: "msg1",
        workspaceId: "ws1",
        customerId: "cust1",
        phoneNumber: "",
        messageContent: "Test message",
        status: "pending" as const,
        errorMessage: null,
        createdAt: new Date(),
        deliveredAt: null,
      }

      const result = await service.validateAndSend(message)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid phone number")
    })

    it("should reject invalid phone format", async () => {
      const message = {
        id: "msg1",
        workspaceId: "ws1",
        customerId: "cust1",
        phoneNumber: "abc123", // Invalid format
        messageContent: "Test message",
        status: "pending" as const,
        errorMessage: null,
        createdAt: new Date(),
        deliveredAt: null,
      }

      const result = await service.validateAndSend(message)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid phone number format")
    })

    it("should reject empty message content", async () => {
      const message = {
        id: "msg1",
        workspaceId: "ws1",
        customerId: "cust1",
        phoneNumber: "+393331234567",
        messageContent: "", // Empty content
        status: "pending" as const,
        errorMessage: null,
        createdAt: new Date(),
        deliveredAt: null,
      }

      const result = await service.validateAndSend(message)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid message")
    })

    it("should accept valid phone and message", async () => {
      const message = {
        id: "msg1",
        workspaceId: "ws1",
        customerId: "cust1",
        phoneNumber: "+393331234567",
        messageContent: "Test message",
        status: "pending" as const,
        errorMessage: null,
        createdAt: new Date(),
        deliveredAt: null,
      }

      const result = await service.validateAndSend(message)

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔄 DEDUPLICATION TESTS (3 tests)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Deduplication", () => {
    it("should prevent duplicate message within 1 minute", async () => {
      // Mock duplicate found
      mockPrisma.whatsAppQueue.findFirst = jest.fn().mockResolvedValue({
        id: "existing-msg",
        customerId: "cust1",
        messageContent: "Test message",
        createdAt: new Date(Date.now() - 30000), // 30 seconds ago
      })

      const enqueueDto = {
        workspaceId: "ws1",
        customerId: "cust1",
        phoneNumber: "+393331234567",
        messageContent: "Test message",
      }

      await expect(service.enqueue(enqueueDto)).rejects.toThrow(
        "Duplicate message detected"
      )
    })

    it("should allow message if no duplicate found", async () => {
      // Mock no duplicate
      mockPrisma.whatsAppQueue.findFirst = jest.fn().mockResolvedValue(null)
      mockPrisma.whatsAppQueue.create = jest.fn().mockResolvedValue({
        id: "new-msg",
        workspaceId: "ws1",
        customerId: "cust1",
        phoneNumber: "+393331234567",
        messageContent: "Test message",
        status: "pending",
        createdAt: new Date(),
      })

      const enqueueDto = {
        workspaceId: "ws1",
        customerId: "cust1",
        phoneNumber: "+393331234567",
        messageContent: "Test message",
      }

      const result = await service.enqueue(enqueueDto)

      expect(result.id).toBe("new-msg")
      expect(mockPrisma.whatsAppQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: "ws1",
          customerId: "cust1",
          status: "pending",
        }),
      })
    })

    it("should allow duplicate if older than 1 minute", async () => {
      // Mock old duplicate (2 minutes ago)
      mockPrisma.whatsAppQueue.findFirst = jest.fn().mockResolvedValue({
        id: "old-msg",
        customerId: "cust1",
        messageContent: "Test message",
        createdAt: new Date(Date.now() - 120000), // 2 minutes ago
      })
      mockPrisma.whatsAppQueue.create = jest.fn().mockResolvedValue({
        id: "new-msg",
        workspaceId: "ws1",
        customerId: "cust1",
        phoneNumber: "+393331234567",
        messageContent: "Test message",
        status: "pending",
        createdAt: new Date(),
      })

      const enqueueDto = {
        workspaceId: "ws1",
        customerId: "cust1",
        phoneNumber: "+393331234567",
        messageContent: "Test message",
      }

      const result = await service.enqueue(enqueueDto)

      expect(result.id).toBe("new-msg")
      expect(mockPrisma.whatsAppQueue.create).toHaveBeenCalled()
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⚙️ PROCESSING LOGIC TESTS (4 tests)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Processing Logic", () => {
    it("should delete message from queue on successful send", async () => {
      const mockMessage = {
        id: "msg1",
        workspaceId: "ws1",
        customerId: "cust1",
        phoneNumber: "+393331234567",
        messageContent: "Test message",
        status: "pending" as const,
        errorMessage: null,
        createdAt: new Date(),
        deliveredAt: null,
      }

      // Mock repository methods
      mockPrisma.whatsAppQueue.findFirst = jest.fn().mockResolvedValue(mockMessage)
      mockPrisma.whatsAppQueue.delete = jest.fn().mockResolvedValue(mockMessage)
      mockPrisma.conversationMessage.findFirst = jest.fn().mockResolvedValue(null)
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(null)

      await service.processPendingMessages("ws1")

      expect(mockPrisma.whatsAppQueue.delete).toHaveBeenCalledWith({
        where: { id: "msg1" },
      })
    })

    it("should update status to error on validation failure", async () => {
      const mockMessage = {
        id: "msg1",
        workspaceId: "ws1",
        customerId: "cust1",
        phoneNumber: "invalid", // Invalid phone
        messageContent: "Test message",
        status: "pending" as const,
        errorMessage: null,
        createdAt: new Date(),
        deliveredAt: null,
      }

      mockPrisma.whatsAppQueue.findFirst = jest.fn().mockResolvedValue(mockMessage)
      mockPrisma.whatsAppQueue.update = jest.fn().mockResolvedValue({
        ...mockMessage,
        status: "error",
        errorMessage: "Invalid phone number format: invalid",
      })
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(null)

      await service.processPendingMessages("ws1")

      expect(mockPrisma.whatsAppQueue.update).toHaveBeenCalledWith({
        where: { id: "msg1" },
        data: expect.objectContaining({
          status: "error",
          errorMessage: expect.stringContaining("Invalid phone"),
        }),
      })
    })

    it("should mark deliveredAt in conversation history on success", async () => {
      const mockMessage = {
        id: "msg1",
        workspaceId: "ws1",
        customerId: "cust1",
        phoneNumber: "+393331234567",
        messageContent: "Test message",
        status: "pending" as const,
        errorMessage: null,
        createdAt: new Date(),
        deliveredAt: null,
      }

      const mockConversationMessage = {
        id: "conv-msg-1",
        customerId: "cust1",
        content: "Test message",
        deliveredAt: null,
        createdAt: new Date(),
      }

      mockPrisma.whatsAppQueue.findFirst = jest.fn().mockResolvedValue(mockMessage)
      mockPrisma.whatsAppQueue.delete = jest.fn().mockResolvedValue(mockMessage)
      mockPrisma.conversationMessage.findFirst = jest
        .fn()
        .mockResolvedValue(mockConversationMessage)
      mockPrisma.conversationMessage.update = jest.fn().mockResolvedValue({
        ...mockConversationMessage,
        deliveredAt: new Date(),
      })
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(null)

      await service.processPendingMessages("ws1")

      expect(mockPrisma.conversationMessage.update).toHaveBeenCalledWith({
        where: { id: "conv-msg-1" },
        data: { deliveredAt: expect.any(Date) },
      })
    })

    it("should not process if no pending messages", async () => {
      mockPrisma.whatsAppQueue.findFirst = jest.fn().mockResolvedValue(null)

      await service.processPendingMessages("ws1")

      expect(mockPrisma.whatsAppQueue.delete).not.toHaveBeenCalled()
      expect(mockPrisma.whatsAppQueue.update).not.toHaveBeenCalled()
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔒 WORKSPACE ISOLATION TESTS (4 tests)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Workspace Isolation", () => {
    it("should filter messages by workspaceId when getting queue status", async () => {
      mockPrisma.whatsAppQueue.findMany = jest.fn().mockResolvedValue([
        { id: "msg1", workspaceId: "ws1" },
        { id: "msg2", workspaceId: "ws1" },
      ])

      await service.getQueueStatus("ws1")

      expect(mockPrisma.whatsAppQueue.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ workspaceId: "ws1" }),
        include: { customer: true },
        orderBy: { createdAt: "asc" },
      })
    })

    it("should only process messages for specified workspace", async () => {
      const mockMessage = {
        id: "msg1",
        workspaceId: "ws1",
        customerId: "cust1",
        phoneNumber: "+393331234567",
        messageContent: "Test message",
        status: "pending" as const,
        errorMessage: null,
        createdAt: new Date(),
        deliveredAt: null,
      }

      mockPrisma.whatsAppQueue.findFirst = jest.fn().mockResolvedValue(mockMessage)
      mockPrisma.whatsAppQueue.delete = jest.fn().mockResolvedValue(mockMessage)
      mockPrisma.conversationMessage.findFirst = jest.fn().mockResolvedValue(null)
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(null)

      await service.processPendingMessages("ws1")

      expect(mockPrisma.whatsAppQueue.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({ workspaceId: "ws1", status: "pending" }),
        orderBy: { createdAt: "asc" },
        include: { customer: true },
      })
    })

    it("should verify workspace ownership before deleting message", async () => {
      mockPrisma.whatsAppQueue.findFirst = jest.fn().mockResolvedValue(null)

      await expect(service.deleteMessage("msg1", "ws1")).rejects.toThrow(
        "Message not found or access denied"
      )

      expect(mockPrisma.whatsAppQueue.delete).not.toHaveBeenCalled()
    })

    it("should include workspaceId in enqueue operation", async () => {
      mockPrisma.whatsAppQueue.findFirst = jest.fn().mockResolvedValue(null)
      mockPrisma.whatsAppQueue.create = jest.fn().mockResolvedValue({
        id: "new-msg",
        workspaceId: "ws1",
        customerId: "cust1",
        phoneNumber: "+393331234567",
        messageContent: "Test message",
        status: "pending",
        createdAt: new Date(),
      })

      const enqueueDto = {
        workspaceId: "ws1",
        customerId: "cust1",
        phoneNumber: "+393331234567",
        messageContent: "Test message",
      }

      await service.enqueue(enqueueDto)

      expect(mockPrisma.whatsAppQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: "ws1",
        }),
      })
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📊 TIMELINE INTEGRATION TESTS (2 tests)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Timeline Integration", () => {
    it("should add success timeline entry on successful send", async () => {
      const mockMessage = {
        id: "msg1",
        workspaceId: "ws1",
        customerId: "cust1",
        phoneNumber: "+393331234567",
        messageContent: "Test message",
        status: "pending" as const,
        errorMessage: null,
        createdAt: new Date(),
        deliveredAt: null,
      }

      const mockChatSession = {
        id: "session1",
        customerId: "cust1",
        workspaceId: "ws1",
        status: "active",
      }

      mockPrisma.whatsAppQueue.findFirst = jest.fn().mockResolvedValue(mockMessage)
      mockPrisma.whatsAppQueue.delete = jest.fn().mockResolvedValue(mockMessage)
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(mockChatSession)
      mockPrisma.conversationMessage.findFirst = jest.fn().mockResolvedValue(null)
      mockPrisma.conversationMessage.create = jest.fn().mockResolvedValue({
        id: "timeline-1",
        conversationId: "session1",
        customerId: "cust1",
        workspaceId: "ws1",
        role: "system",
        content: "✅ Message sent to WhatsApp successfully",
        agentType: "whatsapp_sent",
        createdAt: new Date(),
      })

      await service.processPendingMessages("ws1")

      expect(mockPrisma.conversationMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: "system",
          content: "✅ Message sent to WhatsApp successfully",
          agentType: "whatsapp_sent",
        }),
      })
    })

    it("should add error timeline entry on validation failure", async () => {
      const mockMessage = {
        id: "msg1",
        workspaceId: "ws1",
        customerId: "cust1",
        phoneNumber: "invalid",
        messageContent: "Test message",
        status: "pending" as const,
        errorMessage: null,
        createdAt: new Date(),
        deliveredAt: null,
      }

      const mockChatSession = {
        id: "session1",
        customerId: "cust1",
        workspaceId: "ws1",
        status: "active",
      }

      mockPrisma.whatsAppQueue.findFirst = jest.fn().mockResolvedValue(mockMessage)
      mockPrisma.whatsAppQueue.update = jest.fn().mockResolvedValue({
        ...mockMessage,
        status: "error",
        errorMessage: "Invalid phone number format: invalid",
      })
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(mockChatSession)
      mockPrisma.conversationMessage.create = jest.fn().mockResolvedValue({
        id: "timeline-1",
        conversationId: "session1",
        customerId: "cust1",
        workspaceId: "ws1",
        role: "system",
        content: "❌ WhatsApp Error: Invalid phone number format: invalid",
        agentType: "whatsapp_error",
        createdAt: new Date(),
      })

      await service.processPendingMessages("ws1")

      expect(mockPrisma.conversationMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: "system",
          agentType: "whatsapp_error",
          content: expect.stringContaining("❌ WhatsApp Error"),
        }),
      })
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📈 STATISTICS TESTS (Bonus)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Statistics", () => {
    it("should return correct queue statistics", async () => {
      mockPrisma.whatsAppQueue.findMany = jest.fn().mockImplementation(({ where }) => {
        if (where.status === "pending") return Promise.resolve([{}, {}]) // 2 pending
        if (where.status === "sent") return Promise.resolve([{}]) // 1 sent
        if (where.status === "error") return Promise.resolve([{}, {}, {}]) // 3 error
        return Promise.resolve([{}, {}, {}, {}, {}, {}]) // 6 total
      })

      const stats = await service.getStatistics("ws1")

      expect(stats.pending).toBe(2)
      expect(stats.sent).toBe(1)
      expect(stats.error).toBe(3)
      expect(stats.total).toBe(6)
    })
  })
})
