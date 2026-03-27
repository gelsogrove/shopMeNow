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

// Mock SubscriptionBillingService (avoid real billing logic)
jest.mock("../../src/application/services/subscription-billing.service", () => {
  return {
    SubscriptionBillingService: jest.fn().mockImplementation(() => ({
      deductOwnerMessageCredit: jest.fn().mockResolvedValue({
        success: true,
        newBalance: 0,
      }),
      deductMessageCredit: jest.fn().mockResolvedValue({
        success: true,
        newBalance: 0,
      }),
    })),
  }
})

// Mock WhatsAppProviderFactory to return mock provider
jest.mock("../../src/services/whatsapp/whatsapp-provider.factory", () => {
  return {
    WhatsAppProviderFactory: {
      isConfigured: jest.fn().mockReturnValue(true),
      getProviderDisplayName: jest.fn().mockReturnValue("Meta Business API"),
      create: jest.fn().mockReturnValue({
        sendTextMessage: jest.fn().mockResolvedValue({
          success: true,
          messageId: "wamid_test_123",
        }),
        getProviderName: jest.fn().mockReturnValue("Meta"),
      }),
    },
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
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  conversationMessage: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  chatSession: {
    findFirst: jest.fn(),
  },
  workspace: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient

describe("WhatsAppQueueService - Unit Tests", () => {
  let service: WhatsAppQueueService

  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
      debugMode: false,
      name: "Test",
      wipMessage: null,
      ownerId: "owner-1",
      channelStatus: true,
      ultraMsgInstanceId: "161048",
      ultraMsgToken: "test_token",
      whatsappProvider: "ultramsg",
    })
    mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
      creditBalance: 0,
      subscriptionStatus: "ACTIVE",
    })
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
        conversationMessageId: null,
      }

      // Mock workspace with WhatsApp configuration
      mockPrisma.workspace.findUnique.mockResolvedValueOnce({
        id: "ws1",
        whatsappProvider: "meta",
        whatsappApiKey: "test_key",
        whatsappPhoneNumber: "+1234567890",
      })

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
      // Duplicate outside time window should not be found
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
      expect(mockPrisma.whatsAppQueue.create).toHaveBeenCalled()
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⚙️ PROCESSING LOGIC TESTS (4 tests)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Processing Logic", () => {
    it("should update status to sent on successful send", async () => {
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
      mockPrisma.workspace.findUnique = jest.fn()
        .mockResolvedValueOnce({
          debugMode: false,
          name: "Test",
          ownerId: "owner-1",
          channelStatus: true,
        })
        .mockResolvedValueOnce({
          id: "ws1",
          whatsappProvider: "meta",
          whatsappApiKey: "test_key",
          whatsappPhoneNumber: "+1234567890",
        })
      mockPrisma.whatsAppQueue.findMany = jest.fn().mockResolvedValue([mockMessage])
      mockPrisma.whatsAppQueue.update = jest.fn().mockResolvedValue({
        ...mockMessage,
        status: "sent",
      })
      mockPrisma.conversationMessage.findFirst = jest.fn().mockResolvedValue(null)
      mockPrisma.conversationMessage.findUnique = jest.fn().mockResolvedValue(null)
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(null)
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        creditBalance: 100,
        subscriptionStatus: "ACTIVE",
      })

      await service.processPendingMessages("ws1")

      expect(mockPrisma.whatsAppQueue.update).toHaveBeenCalledWith({
        where: { id: "msg1" },
        data: expect.objectContaining({
          status: "sent",
        }),
      })
    })

    it("should mark message failed when subscription is not ACTIVE", async () => {
      const mockMessage = {
        id: "msg-sub-inactive",
        workspaceId: "ws1",
        customerId: "cust1",
        phoneNumber: "+393331234567",
        messageContent: "Test message",
        status: "pending" as const,
        errorMessage: null,
        createdAt: new Date(),
        deliveredAt: null,
      }

      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        debugMode: false,
        name: "Test",
        ownerId: "owner-1",
        channelStatus: true,
      })
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        creditBalance: 0,
        subscriptionStatus: "INACTIVE",
      })
      mockPrisma.whatsAppQueue.findMany = jest.fn().mockResolvedValue([mockMessage])
      mockPrisma.whatsAppQueue.update = jest.fn().mockResolvedValue({
        ...mockMessage,
        status: "failed",
        errorMessage: "SUBSCRIPTION_INACTIVE",
      })

      const validateSpy = jest.spyOn(service as any, "validateAndSend")

      await service.processPendingMessages("ws1")

      expect(mockPrisma.whatsAppQueue.update).toHaveBeenCalledWith({
        where: { id: "msg-sub-inactive" },
        data: expect.objectContaining({
          status: "failed",
          errorMessage: "SUBSCRIPTION_INACTIVE",
        }),
      })
      expect(validateSpy).not.toHaveBeenCalled()
    })

    it("should mark message failed when credit is below threshold", async () => {
      const mockMessage = {
        id: "msg-low-credit",
        workspaceId: "ws1",
        customerId: "cust1",
        phoneNumber: "+393331234567",
        messageContent: "Test message",
        status: "pending" as const,
        errorMessage: null,
        createdAt: new Date(),
        deliveredAt: null,
      }

      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        debugMode: false,
        name: "Test",
        ownerId: "owner-1",
        channelStatus: true,
      })
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        creditBalance: -10.01,
        subscriptionStatus: "ACTIVE",
      })
      mockPrisma.whatsAppQueue.findMany = jest.fn().mockResolvedValue([mockMessage])
      mockPrisma.whatsAppQueue.update = jest.fn().mockResolvedValue({
        ...mockMessage,
        status: "failed",
        errorMessage: "INSUFFICIENT_CREDIT",
      })

      const validateSpy = jest.spyOn(service as any, "validateAndSend")

      await service.processPendingMessages("ws1")

      expect(mockPrisma.whatsAppQueue.update).toHaveBeenCalledWith({
        where: { id: "msg-low-credit" },
        data: expect.objectContaining({
          status: "failed",
          errorMessage: "INSUFFICIENT_CREDIT",
        }),
      })
      expect(validateSpy).not.toHaveBeenCalled()
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

      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        debugMode: false,
        name: "Test",
        ownerId: "owner-1",
        channelStatus: true,
      })
      mockPrisma.whatsAppQueue.findMany = jest.fn().mockResolvedValue([mockMessage])
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

      mockPrisma.workspace.findUnique = jest.fn()
        .mockResolvedValueOnce({
          debugMode: false,
          name: "Test",
          ownerId: "owner-1",
          channelStatus: true,
        })
        .mockResolvedValueOnce({
          id: "ws1",
          whatsappProvider: "meta",
          whatsappApiKey: "test_key",
          whatsappPhoneNumber: "+1234567890",
        })
      mockPrisma.whatsAppQueue.findMany = jest.fn().mockResolvedValue([mockMessage])
      mockPrisma.whatsAppQueue.update = jest.fn().mockResolvedValue({
        ...mockMessage,
        status: "sent",
      })
      mockPrisma.conversationMessage.findFirst = jest
        .fn()
        .mockResolvedValue(mockConversationMessage)
      mockPrisma.conversationMessage.findUnique = jest.fn().mockResolvedValue(null)
      mockPrisma.conversationMessage.update = jest.fn().mockResolvedValue({
        ...mockConversationMessage,
        deliveredAt: new Date(),
      })
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(null)
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        creditBalance: 100,
        subscriptionStatus: "ACTIVE",
      })

      await service.processPendingMessages("ws1")

      expect(mockPrisma.conversationMessage.update).toHaveBeenCalledWith({
        where: { id: "conv-msg-1" },
        data: { deliveredAt: expect.any(Date), deliveryStatus: "sent" },
      })
    })

    it("should not process if no pending messages", async () => {
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        debugMode: false,
        name: "Test",
        ownerId: "owner-1",
        channelStatus: true,
      })
      mockPrisma.whatsAppQueue.findMany = jest.fn().mockResolvedValue([])

      await service.processPendingMessages("ws1")

      expect(mockPrisma.whatsAppQueue.update).not.toHaveBeenCalled()
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
        where: { workspaceId: "ws1" },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          workspace: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
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

      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        debugMode: false,
        name: "Test",
        ownerId: "owner-1",
        channelStatus: true,
      })
      mockPrisma.whatsAppQueue.findMany = jest.fn().mockResolvedValue([mockMessage])
      mockPrisma.whatsAppQueue.update = jest.fn().mockResolvedValue({
        ...mockMessage,
        status: "sent",
      })
      mockPrisma.conversationMessage.findFirst = jest.fn().mockResolvedValue(null)
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(null)

      await service.processPendingMessages("ws1")

      expect(mockPrisma.whatsAppQueue.findMany).toHaveBeenCalledWith({
        where: { workspaceId: "ws1", status: "pending" },
        include: {
          customer: {
            select: {
              id: true,
              language: true,
              name: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 1,
      })
    })

    it("should verify workspace ownership before deleting message", async () => {
      mockPrisma.whatsAppQueue.deleteMany = jest.fn().mockResolvedValue({ count: 0 })

      const result = await service.deleteMessage("msg1", "ws1")
      expect(result).toBe(false)
      expect(mockPrisma.whatsAppQueue.deleteMany).toHaveBeenCalledWith({
        where: { id: "msg1", workspaceId: "ws1" },
      })
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
        conversationMessageId: "conv-msg-1",
      }

      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        debugMode: false,
        name: "Test",
        ownerId: "owner-1",
        channelStatus: true,
      })
      mockPrisma.whatsAppQueue.findMany = jest.fn().mockResolvedValue([mockMessage])
      mockPrisma.whatsAppQueue.update = jest.fn().mockResolvedValue({
        ...mockMessage,
        status: "sent",
      })
      mockPrisma.conversationMessage.findUnique = jest.fn().mockResolvedValue({
        id: "conv-msg-1",
        debugInfo: null,
      })
      mockPrisma.conversationMessage.update = jest.fn().mockResolvedValue({
        id: "conv-msg-1",
        debugInfo: JSON.stringify({ steps: [] }),
      })

      await service.processPendingMessages("ws1")

      expect(mockPrisma.conversationMessage.update).toHaveBeenCalled()
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
        conversationMessageId: "conv-msg-1",
      }

      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        debugMode: false,
        name: "Test",
        ownerId: "owner-1",
        channelStatus: true,
      })
      mockPrisma.whatsAppQueue.findMany = jest.fn().mockResolvedValue([mockMessage])
      mockPrisma.whatsAppQueue.update = jest.fn().mockResolvedValue({
        ...mockMessage,
        status: "error",
        errorMessage: "Invalid phone number format: invalid",
      })
      await service.processPendingMessages("ws1")

      expect(mockPrisma.conversationMessage.update).not.toHaveBeenCalled()
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📈 STATISTICS TESTS (Bonus)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Statistics", () => {
    it("should return correct queue statistics", async () => {
      mockPrisma.whatsAppQueue.count = jest.fn().mockImplementation(({ where }) => {
        if (where.status === "pending") return Promise.resolve(2)
        if (where.status === "sent") return Promise.resolve(1)
        if (where.status === "error") return Promise.resolve(3)
        if (where.status?.in?.includes("error")) return Promise.resolve(3)
        return Promise.resolve(6)
      })

      const stats = await service.getStatistics("ws1")

      expect(stats.pending).toBe(2)
      expect(stats.sent).toBe(1)
      expect(stats.error).toBe(3)
      expect(stats.total).toBe(6)
    })
  })
})
