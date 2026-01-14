/**
 * Test Suite: WIP Channel Handling
 *
 * Verifies that when workspace debugMode=true (chatbot disabled):
 * 1. WIP message is returned in customer's language
 * 2. User message is saved (INBOUND)
 * 3. WIP response is saved (OUTBOUND)
 * 4. NO LLM API calls are made
 *
 * @requirement Feature 126: P2 - Maintenance Mode
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
      create: jest.fn(),
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

describe("WIP Channel Handling - P2 Maintenance Mode", () => {
  let service: LLMRouterService
  let mockPrisma: any

  const workspaceId = "ws-test-123"
  const customerId = "cust-test-123"
  const conversationId = "conv-test-123"

  const multiLanguageWipMessages = {
    en: "Work in progress. Please contact us later.",
    it: "Servizio in manutenzione. Riprova più tardi.",
    es: "Servicio en mantenimiento. Por favor, inténtelo más tarde.",
    pt: "Serviço em manutenção. Tente novamente mais tarde.",
    fr: "Service en maintenance. Veuillez réessayer plus tard.",
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma = new PrismaClient()
    service = new LLMRouterService(mockPrisma)

    // Default: Customer is NOT blocked
    mockPrisma.customers.findFirst.mockResolvedValue({
      id: customerId,
      name: "Test Customer",
      isBlacklisted: false,
      workspaceId,
    })
  })

  describe("getChannelDisabled()", () => {
    it("should return WIP message when debugMode=true", async () => {
      // Setup: Channel is DISABLED
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        name: "Test Workspace",
        debugMode: true, // DISABLED
        wipMessage: multiLanguageWipMessages,
      })

      const result = await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Hello, can I order?",
        customerLanguage: "en",
      })

      // Assert: WIP message returned
      expect(result.response).toBe(multiLanguageWipMessages.en)
      expect(result.agentUsed).toBe("ROUTER")
      expect(result.tokensUsed).toBe(0)
    })

    it("should return WIP message in Italian when customerLanguage=it", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        debugMode: true,
        wipMessage: multiLanguageWipMessages,
      })

      const result = await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Ciao, posso ordinare?",
        customerLanguage: "it",
      })

      expect(result.response).toBe(multiLanguageWipMessages.it)
    })

    it("should return WIP message in Spanish when customerLanguage=es", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        debugMode: true,
        wipMessage: multiLanguageWipMessages,
      })

      const result = await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Hola, puedo pedir?",
        customerLanguage: "es",
      })

      expect(result.response).toBe(multiLanguageWipMessages.es)
    })

    it("should fallback to English when customer language not in wipMessage", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        debugMode: true,
        wipMessage: { en: "Default WIP message" }, // Only English available
      })

      const result = await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Guten tag",
        customerLanguage: "de", // German - not available
      })

      expect(result.response).toBe("Default WIP message")
    })

    it("should fallback to default message when wipMessage is empty", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        debugMode: true,
        wipMessage: null, // No custom message
      })

      const result = await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Hello",
        customerLanguage: "en",
      })

      // Default fallback message
      expect(result.response).toBe("Work in progress. Please contact us later.")
    })

    it("should proceed normally when debugMode=false", async () => {
      // Setup: Channel is ACTIVE
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        debugMode: false, // ACTIVE
      })

      // Setup customer with full data
      mockPrisma.customers.findFirst.mockResolvedValue({
        id: customerId,
        name: "Test Customer",
        isBlacklisted: false,
        workspaceId,
        discount: 0,
        sales: null,
      })

      // Will fail later in the flow (missing agent config)
      // But WIP check should PASS and continue
      await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Hello",
      }).catch(() => {
        // Expected to fail after WIP check
      })

      // Assert: Logged that WIP check passed
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Routing message"),
        expect.any(Object)
      )
    })
  })

  describe("WIP Channel - Message Saving", () => {
    beforeEach(() => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        debugMode: true,
        wipMessage: multiLanguageWipMessages,
      })
    })

    it("should save user message (INBOUND) when channel is WIP", async () => {
      await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Can I order?",
        customerLanguage: "en",
      })

      // Verify user message was saved
      expect(mockPrisma.conversationMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: "Can I order?",
            role: "user",
            conversationId,
          }),
        })
      )
    })

    it("should save WIP response (OUTBOUND) when channel is WIP", async () => {
      await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Can I order?",
        customerLanguage: "en",
      })

      // Verify WIP response was saved
      expect(mockPrisma.conversationMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: multiLanguageWipMessages.en,
            role: "assistant",
            conversationId,
          }),
        })
      )
    })
  })

  describe("WIP Channel - Zero LLM Usage", () => {
    beforeEach(() => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        debugMode: true,
        wipMessage: multiLanguageWipMessages,
      })
    })

    it("should use ZERO tokens when channel is WIP", async () => {
      const result = await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Hello",
        customerLanguage: "en",
      })

      expect(result.tokensUsed).toBe(0)
    })

    it("should NOT call any LLM API when channel is WIP", async () => {
      const axios = require("axios")

      await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Hello",
        customerLanguage: "en",
      })

      // Assert: NO axios calls made (no LLM API)
      expect(axios.post).not.toHaveBeenCalled()
    })

    it("should have fast execution time when channel is WIP", async () => {
      const result = await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Hello",
        customerLanguage: "en",
      })

      // Should be very fast (no LLM call)
      expect(result.executionTimeMs).toBeLessThan(100)
    })

    it("should log WIP message being sent", async () => {
      await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Hello",
        customerLanguage: "en",
      })

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("P2: Sending WIP message"),
        expect.objectContaining({
          workspaceId,
          language: "en",
        })
      )
    })
  })

  describe("Priority Order: P1 (Blocked) > P2 (WIP)", () => {
    it("should check blocked status BEFORE WIP status", async () => {
      // Customer is blocked AND channel is WIP
      mockPrisma.customers.findFirst.mockResolvedValue({
        id: customerId,
        isBlacklisted: true, // BLOCKED
        workspaceId,
      })

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        debugMode: true, // WIP
        wipMessage: multiLanguageWipMessages,
      })

      const result = await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Hello",
      })

      // P1 (blocked) takes priority - no response at all
      expect(result.isBlocked).toBe(true)
      expect(result.response).toBe("")

      // WIP message should NOT be sent for blocked user
      expect(result.response).not.toBe(multiLanguageWipMessages.en)
    })
  })

  describe("WIP Channel - wasFAQ Flag", () => {
    beforeEach(() => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        debugMode: true,
        wipMessage: multiLanguageWipMessages,
      })
    })

    it("should return wasFAQ: false for WIP response", async () => {
      const result = await service.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        messageId: "msg-123",
        message: "Hello",
        customerLanguage: "en",
      })

      expect(result.wasFAQ).toBe(false)
    })
  })
})
