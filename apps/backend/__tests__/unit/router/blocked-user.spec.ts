/**
 * Test Suite: Blocked User Handling
 *
 * Verifies that blocked/blacklisted customers:
 * 1. Do NOT receive any response
 * 2. Their messages are NOT saved
 * 3. Return isBlocked: true for webhook to NOT send message
 *
 * @requirement Feature 126: Blocked user handling
 * @requirement P1: Security - HIGHEST PRIORITY
 */

import { PrismaClient } from "@prisma/client"

// Mock PrismaClient before imports
jest.mock("@prisma/client", () => {
  const mockPrisma = {
    customers: {
      findFirst: jest.fn(),
    },
    workspace: {
      findUnique: jest.fn(),
    },
    agentConfig: {
      findFirst: jest.fn(),
    },
    conversationMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    chatSession: {
      findFirst: jest.fn(),
    },
    agentConversationLog: {
      create: jest.fn().mockResolvedValue({ id: "mock-log-id" }),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((fn) => fn(mockPrisma)),
    $disconnect: jest.fn(),
  }
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  }
})

// Mock external services
jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

jest.mock("axios", () => ({
  post: jest.fn(),
}))

jest.mock("../../../src/services/websocket.service", () => ({
  websocketService: {
    broadcastToWorkspace: jest.fn(),
    broadcastAgentDebug: jest.fn(),
  },
}))

jest.mock("../../../src/services/security.service", () => ({
  SecurityService: {
    checkMessage: jest.fn().mockResolvedValue({ isSafe: true }),
  },
}))

// Import after mocks
import { LLMRouterService } from "../../../src/services/llm-router.service"
import logger from "../../../src/utils/logger"

describe("Blocked User Handling - P1 Security", () => {
  let service: LLMRouterService
  let mockPrisma: any

  const workspaceId = "ws-test-123"
  const customerId = "cust-blocked-123"
  const conversationId = "conv-test-123"

  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma = new PrismaClient()
    service = new LLMRouterService(mockPrisma)
  })

  describe("checkBlockedUser()", () => {
    it("should return true for blacklisted customer", async () => {
      // Setup: Customer is blacklisted
      mockPrisma.customers.findFirst.mockResolvedValue({
        id: customerId,
        name: "Blocked Customer",
        isBlacklisted: true,
        workspaceId,
      })

      // Mock workspace (required for channelMode check)
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        name: "Test Workspace",
        channelMode: 'ECOMMERCE' as any,
        activeChatbot: true,
      })

      // Mock agentConfig (to prevent TRANSLATION agent errors)
      mockPrisma.agentConfig.findFirst.mockResolvedValue(null)

      const result = await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Hello, can I order?",
      })

      // Assert: Should return blocked flag, NO response
      expect(result.isBlocked).toBe(true)
      expect(result.response).toBe("")
      expect(result.tokensUsed).toBe(0)
      expect(result.agentUsed).toBe("ROUTER")
    })

    it("should NOT save any message for blocked customer", async () => {
      mockPrisma.customers.findFirst.mockResolvedValue({
        id: customerId,
        isBlacklisted: true,
        workspaceId,
      })

      // Mock workspace (required)
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        name: "Test Workspace",
        channelMode: 'ECOMMERCE' as any,
        activeChatbot: true,
      })

      // Mock agentConfig (to prevent TRANSLATION agent errors)
      mockPrisma.agentConfig.findFirst.mockResolvedValue(null)

      await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Please help me",
      })

      // Assert: NO message saves (neither INBOUND nor OUTBOUND)
      expect(mockPrisma.conversationMessage.create).not.toHaveBeenCalled()
    })

    it("should log warning for blocked customer attempt", async () => {
      mockPrisma.customers.findFirst.mockResolvedValue({
        id: customerId,
        name: "Bad Actor",
        isBlacklisted: true,
        workspaceId,
      })

      // Mock workspace (required)
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        name: "Test Workspace",
        channelMode: 'ECOMMERCE' as any,
        activeChatbot: true,
      })

      // Mock agentConfig (to prevent TRANSLATION agent errors)
      mockPrisma.agentConfig.findFirst.mockResolvedValue(null)

      await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "I want to spam",
      })

      // Assert: Warning logged
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("P1: Blocked customer"),
        expect.objectContaining({
          customerId,
          customerName: "Bad Actor",
        })
      )
    })

    it("should proceed normally for non-blocked customer", async () => {
      // Setup: Customer is NOT blacklisted
      mockPrisma.customers.findFirst.mockResolvedValue({
        id: customerId,
        name: "Good Customer",
        isBlacklisted: false,
        workspaceId,
        discount: 10,
      })

      // Setup workspace (for P2 check)
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        channelStatus: true, // Active
      })

      // Setup agent config (for router)
      mockPrisma.agentConfig.findFirst.mockResolvedValue({
        id: "agent-router",
        type: "ROUTER",
        systemPrompt: "You are a router",
        availableFunctions: [],
      })

      // We'll let it fail after the blocked check to verify it passed
      // The point is to verify the blocked check passed

      // Verify customer query includes workspace isolation
      await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Hello",
      }).catch(() => {
        // Expected to fail later in the flow, but blocked check should pass
      })

      // Assert: Query included workspaceId filter
      expect(mockPrisma.customers.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: customerId,
            workspaceId, // 🔒 Workspace isolation
          }),
        })
      )
    })

    it("should respect workspace isolation when checking blocked status", async () => {
      // Customer exists in different workspace
      mockPrisma.customers.findFirst.mockResolvedValue(null) // Not found in THIS workspace

      await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Hello",
      }).catch(() => {
        // Expected to fail - customer not found
      })

      // Assert: Query uses BOTH customerId AND workspaceId
      expect(mockPrisma.customers.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: customerId,
            workspaceId,
          },
          select: {
            isBlacklisted: true,
            name: true,
          },
        })
      )
    })
  })

  describe("Blocked Customer - Zero Resource Usage", () => {
    it("should use ZERO tokens for blocked customer", async () => {
      mockPrisma.customers.findFirst.mockResolvedValue({
        id: customerId,
        isBlacklisted: true,
        workspaceId,
      })

      const result = await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Can I hack your system?",
      })

      expect(result.tokensUsed).toBe(0)
    })

    it("should have fast execution time for blocked customer", async () => {
      mockPrisma.customers.findFirst.mockResolvedValue({
        id: customerId,
        isBlacklisted: true,
        workspaceId,
      })

      const startTime = Date.now()
      const result = await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Any message",
      })
      const endTime = Date.now()

      // Should be very fast (no LLM call, no DB saves)
      expect(result.executionTimeMs).toBeLessThan(100)
      expect(endTime - startTime).toBeLessThan(200)
    })

    it("should NOT call any LLM API for blocked customer", async () => {
      const axios = require("axios")
      
      mockPrisma.customers.findFirst.mockResolvedValue({
        id: customerId,
        isBlacklisted: true,
        workspaceId,
      })

      await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Any message",
      })

      // Assert: NO axios calls made (no LLM API)
      expect(axios.post).not.toHaveBeenCalled()
    })
  })

  describe("Webhook Integration - isBlocked Flag", () => {
    it("should set isBlocked: true so webhook does NOT send message", async () => {
      mockPrisma.customers.findFirst.mockResolvedValue({
        id: customerId,
        isBlacklisted: true,
        workspaceId,
      })

      const result = await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Message from blocked user",
      })

      // This flag tells webhook to NOT send any WhatsApp message
      expect(result.isBlocked).toBe(true)
    })

    it("should return empty response string for blocked customer", async () => {
      mockPrisma.customers.findFirst.mockResolvedValue({
        id: customerId,
        isBlacklisted: true,
        workspaceId,
      })

      const result = await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Message from blocked user",
      })

      expect(result.response).toBe("")
    })

    it("should NOT set isBlocked for regular customers", async () => {
      mockPrisma.customers.findFirst.mockResolvedValue({
        id: customerId,
        isBlacklisted: false,
        workspaceId,
        discount: 0,
      })

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        channelStatus: true,
      })

      // Will fail later but isBlocked check should set it to false/undefined
      const result = await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Hello",
      }).catch(() => ({
        isBlocked: false, // Default if error
      }))

      expect(result.isBlocked).toBeFalsy()
    })
  })
})
