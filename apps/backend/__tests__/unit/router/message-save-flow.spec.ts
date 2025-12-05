/**
 * Test Suite: Message Save Flow
 *
 * Verifies that ALL messages go through ConversationManager:
 * 1. User messages (INBOUND) are saved
 * 2. Assistant messages (OUTBOUND) are saved
 * 3. Messages include debugInfo
 * 4. WorkspaceId is ALWAYS filtered
 *
 * @requirement Rule-2: Workspace Isolation
 * @requirement All messages must be persisted for audit
 */

// Mock dependencies BEFORE imports
const mockConversationRepo = {
  saveMessage: jest.fn().mockResolvedValue(undefined),
  getHistoryByTime: jest.fn().mockResolvedValue([]),
}

const mockWhatsAppQueueService = {
  enqueue: jest.fn().mockResolvedValue(undefined),
}

jest.mock("../../../src/repositories/conversation-message.repository", () => ({
  ConversationMessageRepository: jest.fn().mockImplementation(() => mockConversationRepo),
}))

jest.mock("../../../src/services/whatsapp-queue.service", () => ({
  WhatsAppQueueService: jest.fn().mockImplementation(() => mockWhatsAppQueueService),
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

// Mock PrismaClient
const mockPrisma = {
  customers: {
    findFirst: jest.fn(),
  },
  conversationMessage: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $disconnect: jest.fn(),
}

jest.mock("@echatbot/database", () => ({

  prisma: mockPrisma,
}))

// Import after mocks
import { ConversationManager } from "../../../src/services/conversation-manager.service"
import { PrismaClient } from "@echatbot/database"
import logger from "../../../src/utils/logger"

describe("Message Save Flow", () => {
  let conversationManager: ConversationManager
  const workspaceId = "ws-test-123"
  const customerId = "cust-test-123"
  const conversationId = "conv-test-123"

  beforeEach(() => {
    jest.clearAllMocks()
    conversationManager = new ConversationManager(mockPrisma as unknown as PrismaClient, 10)

    // Default customer with phone
    mockPrisma.customers.findFirst.mockResolvedValue({
      id: customerId,
      phone: "+393331234567",
      workspaceId,
    })
  })

  describe("saveUserMessage()", () => {
    it("should save user message with role=user", async () => {
      await conversationManager.saveUserMessage({
        workspaceId,
        customerId,
        conversationId,
        content: "Hello, I want to order",
      })

      expect(mockConversationRepo.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          customerId,
          conversationId,
          role: "user",
          content: "Hello, I want to order",
        })
      )
    })

    it("should include workspaceId in user message save", async () => {
      await conversationManager.saveUserMessage({
        workspaceId,
        customerId,
        conversationId,
        content: "Test message",
      })

      expect(mockConversationRepo.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId, // 🔒 Must include workspaceId
        })
      )
    })

    it("should log debug message on successful save", async () => {
      await conversationManager.saveUserMessage({
        workspaceId,
        customerId,
        conversationId,
        content: "Test",
      })

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("User message saved"),
        expect.any(Object)
      )
    })

    it("should handle save errors gracefully", async () => {
      mockConversationRepo.saveMessage.mockRejectedValueOnce(new Error("DB error"))

      // Should not throw
      await expect(
        conversationManager.saveUserMessage({
          workspaceId,
          customerId,
          conversationId,
          content: "Test",
        })
      ).resolves.not.toThrow()

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to save user message"),
        expect.any(Error)
      )
    })
  })

  describe("saveAssistantMessage()", () => {
    it("should save assistant message with role=assistant", async () => {
      await conversationManager.saveAssistantMessage({
        workspaceId,
        customerId,
        conversationId,
        content: "Here are our products...",
        agentType: "ROUTER",
      })

      expect(mockConversationRepo.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          customerId,
          conversationId,
          role: "assistant",
          content: "Here are our products...",
        })
      )
    })

    it("should include agentType in assistant message", async () => {
      await conversationManager.saveAssistantMessage({
        workspaceId,
        customerId,
        conversationId,
        content: "Product search results",
        agentType: "PRODUCT_SEARCH",
      })

      expect(mockConversationRepo.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          agentType: "PRODUCT_SEARCH",
        })
      )
    })

    it("should include tokensUsed in assistant message", async () => {
      await conversationManager.saveAssistantMessage({
        workspaceId,
        customerId,
        conversationId,
        content: "Response",
        tokensUsed: 1500,
      })

      expect(mockConversationRepo.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          tokensUsed: 1500,
        })
      )
    })

    it("should include debugInfo in assistant message", async () => {
      const debugInfo = {
        steps: [{ type: "router", agent: "ROUTER" }],
        totalTokens: 1500,
        executionTimeMs: 200,
        timestamp: new Date().toISOString(),
      }

      await conversationManager.saveAssistantMessage({
        workspaceId,
        customerId,
        conversationId,
        content: "Response",
        debugInfo,
      })

      expect(mockConversationRepo.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          debugInfo,
        })
      )
    })

    it("should NOT save empty messages", async () => {
      await conversationManager.saveAssistantMessage({
        workspaceId,
        customerId,
        conversationId,
        content: "", // Empty
      })

      expect(mockConversationRepo.saveMessage).not.toHaveBeenCalled()
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Empty message content detected"),
        expect.any(Object)
      )
    })

    it("should NOT save whitespace-only messages", async () => {
      await conversationManager.saveAssistantMessage({
        workspaceId,
        customerId,
        conversationId,
        content: "   \n\t  ", // Only whitespace
      })

      expect(mockConversationRepo.saveMessage).not.toHaveBeenCalled()
    })
  })

  describe("WhatsApp Queue Integration", () => {
    it("should enqueue assistant message to WhatsApp queue", async () => {
      await conversationManager.saveAssistantMessage({
        workspaceId,
        customerId,
        conversationId,
        content: "Your order is confirmed!",
        agentType: "ORDER_TRACKING",
      })

      expect(mockWhatsAppQueueService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          customerId,
          phoneNumber: "+393331234567",
          messageContent: "Your order is confirmed!",
        })
      )
    })

    it("should NOT enqueue blocked messages to WhatsApp queue", async () => {
      await conversationManager.saveAssistantMessage({
        workspaceId,
        customerId,
        conversationId,
        content: "Security blocked message",
        deliveryStatus: "blocked",
      })

      expect(mockWhatsAppQueueService.enqueue).not.toHaveBeenCalled()
    })

    it("should NOT enqueue REGISTRATION_FLOW messages to WhatsApp", async () => {
      await conversationManager.saveAssistantMessage({
        workspaceId,
        customerId,
        conversationId,
        content: "Welcome!",
        agentType: "REGISTRATION_FLOW",
      })

      expect(mockWhatsAppQueueService.enqueue).not.toHaveBeenCalled()
    })

    it("should skip WhatsApp queue if customer has no phone", async () => {
      mockPrisma.customers.findFirst.mockResolvedValue({
        id: customerId,
        phone: null, // No phone
        workspaceId,
      })

      await conversationManager.saveAssistantMessage({
        workspaceId,
        customerId,
        conversationId,
        content: "Test message",
      })

      expect(mockWhatsAppQueueService.enqueue).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Customer has no phone number"),
        expect.any(Object)
      )
    })

    it("should filter customer by workspaceId when getting phone", async () => {
      await conversationManager.saveAssistantMessage({
        workspaceId,
        customerId,
        conversationId,
        content: "Test",
      })

      expect(mockPrisma.customers.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: customerId,
            workspaceId, // 🔒 Workspace isolation
          },
        })
      )
    })
  })

  describe("loadHistory()", () => {
    it("should load history from repository", async () => {
      mockConversationRepo.getHistoryByTime.mockResolvedValue([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ])

      const history = await conversationManager.loadHistory(workspaceId, conversationId)

      expect(history).toHaveLength(2)
      expect(history[0]).toEqual({ role: "user", content: "Hello" })
    })

    it("should call repository with workspaceId and cutoff time", async () => {
      await conversationManager.loadHistory(workspaceId, conversationId)

      expect(mockConversationRepo.getHistoryByTime).toHaveBeenCalledWith(
        workspaceId, // 🔒 Workspace isolation
        conversationId,
        expect.any(Date)
      )
    })

    it("should return empty array on error", async () => {
      mockConversationRepo.getHistoryByTime.mockRejectedValueOnce(new Error("DB error"))

      const history = await conversationManager.loadHistory(workspaceId, conversationId)

      expect(history).toEqual([])
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load conversation history"),
        expect.any(Error)
      )
    })

    it("should use configured history window (10 minutes)", async () => {
      // Manager configured with 10 minutes window
      const manager = new ConversationManager(mockPrisma as unknown as PrismaClient, 10)

      await manager.loadHistory(workspaceId, conversationId)

      const callArgs = mockConversationRepo.getHistoryByTime.mock.calls[0]
      const cutoffTime = callArgs[2] as Date

      // Cutoff should be approximately 10 minutes ago
      const now = new Date()
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000)

      // Allow 1 second tolerance
      expect(Math.abs(cutoffTime.getTime() - tenMinutesAgo.getTime())).toBeLessThan(1000)
    })
  })

  describe("Workspace Isolation in All Operations", () => {
    it("saveUserMessage should include workspaceId", async () => {
      await conversationManager.saveUserMessage({
        workspaceId,
        customerId,
        conversationId,
        content: "Test",
      })

      expect(mockConversationRepo.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId })
      )
    })

    it("saveAssistantMessage should include workspaceId", async () => {
      await conversationManager.saveAssistantMessage({
        workspaceId,
        customerId,
        conversationId,
        content: "Response",
      })

      expect(mockConversationRepo.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId })
      )
    })

    it("loadHistory should filter by workspaceId", async () => {
      await conversationManager.loadHistory(workspaceId, conversationId)

      expect(mockConversationRepo.getHistoryByTime).toHaveBeenCalledWith(
        workspaceId, // First param is workspaceId
        expect.any(String),
        expect.any(Date)
      )
    })
  })
})
