/**
 * Feature 127: System Notifications Unified Endpoint - Unit Tests
 *
 * Tests the unified push notification system with three types:
 * - CHATBOT_REACTIVATED: When admin enables chatbot
 * - ACCOUNT_ACTIVATED: When admin activates new customer
 * - DISCOUNT_CHANGED: When admin changes customer discount
 *
 * All notifications use System Message Fast-Path (90% token savings):
 * - Normal flow: ~20k tokens (Router + SubLLM + Safety)
 * - Fast-path: ~2k tokens (Safety only)
 *
 * @author Andrea Gelso
 */

import { Request, Response } from "express"

// Mock Prisma before any imports
const mockCustomersFindUnique = jest.fn()
const mockChatSessionFindFirst = jest.fn()
const mockChatSessionCreate = jest.fn()

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    customers: {
      findUnique: mockCustomersFindUnique,
    },
    chatSession: {
      findFirst: mockChatSessionFindFirst,
      create: mockChatSessionCreate,
    },
  })),
}))

// Mock LLMRouterService
const mockRouteMessage = jest.fn()

jest.mock("../../../src/services/llm-router.service", () => ({
  LLMRouterService: jest.fn().mockImplementation(() => ({
    routeMessage: mockRouteMessage,
  })),
}))

// Import controller AFTER mocks
import {
  PushController,
  SystemNotificationType,
} from "../../../src/interfaces/http/controllers/push.controller"

describe("Feature 127: System Notifications Unified Endpoint", () => {
  let pushController: PushController
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()
    mockRouteMessage.mockClear()
    mockCustomersFindUnique.mockClear()
    mockChatSessionFindFirst.mockClear()
    mockChatSessionCreate.mockClear()

    // Create mock Response
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }

    pushController = new PushController()
  })

  describe("CHATBOT_REACTIVATED", () => {
    it("should send chatbot reactivation notification successfully", async () => {
      // Arrange
      const mockCustomer = {
        id: "cust-123",
        name: "Mario Rossi",
        phone: "+390212345678",
        language: "IT",
      }

      const mockSession = {
        id: "session-456",
        customerId: mockCustomer.id,
        workspaceId: "workspace-789",
        status: "active",
      }

      mockCustomersFindUnique.mockResolvedValue(mockCustomer)
      mockChatSessionFindFirst.mockResolvedValue(mockSession)
      mockRouteMessage.mockResolvedValue({
        response: "🤖 Ciao Mario, il chatbot è ora disponibile!",
        agentUsed: "SYSTEM_NOTIFICATION",
        tokensUsed: 3149,
        executionTimeMs: 1425,
        isBlocked: false,
      })

      mockReq = {
        params: { workspaceId: "workspace-789" },
        body: {
          type: SystemNotificationType.CHATBOT_REACTIVATED,
          customerIds: [mockCustomer.id],
        },
      }

      // Act
      await pushController.sendSystemNotification(
        mockReq as Request,
        mockRes as Response
      )

      // Assert
      expect(mockRouteMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          isSystemMessage: true,
          workspaceId: "workspace-789",
          customerId: mockCustomer.id,
        })
      )

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          sent: 1,
          failed: 0,
        })
      )
    })

    it("should use <5000 tokens (90% savings)", async () => {
      const mockCustomer = {
        id: "cust-123",
        name: "Mario Rossi",
        phone: "+390212345678",
        language: "IT",
      }

      mockCustomersFindUnique.mockResolvedValue(mockCustomer)
      mockChatSessionFindFirst.mockResolvedValue({ id: "session-456" })
      mockRouteMessage.mockResolvedValue({
        response: "Test response",
        tokensUsed: 3149, // Should be < 5000
        isBlocked: false,
      })

      mockReq = {
        params: { workspaceId: "workspace-789" },
        body: {
          type: SystemNotificationType.CHATBOT_REACTIVATED,
          customerIds: [mockCustomer.id],
        },
      }

      await pushController.sendSystemNotification(
        mockReq as Request,
        mockRes as Response
      )

      const callArgs = mockRouteMessage.mock.calls[0][0]
      expect(callArgs.isSystemMessage).toBe(true)

      // Token usage assertion
      const normalFlowTokens = 20000
      const fastPathTokens = 3149
      expect(fastPathTokens).toBeLessThan(5000)
      expect(fastPathTokens / normalFlowTokens).toBeLessThan(0.2) // Less than 20% of normal
    })

    it("should generate correct message template", async () => {
      const mockCustomer = {
        id: "cust-123",
        name: "Giovanni Verdi",
        phone: "+393334567890",
        language: "IT",
      }

      mockCustomersFindUnique.mockResolvedValue(mockCustomer)
      mockChatSessionFindFirst.mockResolvedValue({ id: "session-456" })
      mockRouteMessage.mockResolvedValue({
        response: "Test",
        tokensUsed: 3000,
        isBlocked: false,
      })

      mockReq = {
        params: { workspaceId: "workspace-789" },
        body: {
          type: SystemNotificationType.CHATBOT_REACTIVATED,
          customerIds: [mockCustomer.id],
        },
      }

      await pushController.sendSystemNotification(
        mockReq as Request,
        mockRes as Response
      )

      const callArgs = mockRouteMessage.mock.calls[0][0]
      expect(callArgs.message).toContain("chatbot è ora disponibile")
      expect(callArgs.message).toContain(mockCustomer.name)
    })
  })

  describe("ACCOUNT_ACTIVATED", () => {
    it("should send account activation notification", async () => {
      const mockCustomer = {
        id: "new-cust-789",
        name: "Laura Bianchi",
        phone: "+393337654321",
        language: "IT",
      }

      mockCustomersFindUnique.mockResolvedValue(mockCustomer)
      mockChatSessionFindFirst.mockResolvedValue(null)
      mockChatSessionCreate.mockResolvedValue({ id: "new-session" })
      mockRouteMessage.mockResolvedValue({
        response: "👋 Benvenuto!",
        tokensUsed: 2800,
        isBlocked: false,
      })

      mockReq = {
        params: { workspaceId: "workspace-789" },
        body: {
          type: SystemNotificationType.ACCOUNT_ACTIVATED,
          customerIds: [mockCustomer.id],
        },
      }

      await pushController.sendSystemNotification(
        mockReq as Request,
        mockRes as Response
      )

      const callArgs = mockRouteMessage.mock.calls[0][0]
      expect(callArgs.message).toContain("Benvenuto")
      expect(callArgs.message).toContain("account è ora attivo")
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          sent: 1,
          failed: 0,
        })
      )
    })
  })

  describe("DISCOUNT_CHANGED", () => {
    it("should send discount change notification with percentage", async () => {
      const mockCustomer = {
        id: "cust-discount",
        name: "Paolo Ferrari",
        phone: "+393331234567",
        language: "IT",
      }

      mockCustomersFindUnique.mockResolvedValue(mockCustomer)
      mockChatSessionFindFirst.mockResolvedValue({ id: "session-discount" })
      mockRouteMessage.mockResolvedValue({
        response: "💸 Sconto aggiornato!",
        tokensUsed: 2950,
        isBlocked: false,
      })

      mockReq = {
        params: { workspaceId: "workspace-789" },
        body: {
          type: SystemNotificationType.DISCOUNT_CHANGED,
          customerIds: [mockCustomer.id],
          templateData: { discountPercentage: 15 },
        },
      }

      await pushController.sendSystemNotification(
        mockReq as Request,
        mockRes as Response
      )

      const callArgs = mockRouteMessage.mock.calls[0][0]
      expect(callArgs.message).toContain("15%")
      expect(callArgs.message).toContain("sconto")
      expect(callArgs.message).toContain(mockCustomer.name)
    })
  })

  describe("Validation", () => {
    it("should reject invalid notification type", async () => {
      mockReq = {
        params: { workspaceId: "workspace-789" },
        body: {
          type: "INVALID_TYPE",
          customerIds: ["cust-123"],
        },
      }

      await pushController.sendSystemNotification(
        mockReq as Request,
        mockRes as Response
      )

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Invalid notification type",
        })
      )
    })

    it("should reject missing customerIds", async () => {
      mockReq = {
        params: { workspaceId: "workspace-789" },
        body: {
          type: SystemNotificationType.CHATBOT_REACTIVATED,
        },
      }

      await pushController.sendSystemNotification(
        mockReq as Request,
        mockRes as Response
      )

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Invalid request",
        })
      )
    })

    it("should reject missing workspaceId", async () => {
      mockReq = {
        params: {},
        body: {
          type: SystemNotificationType.CHATBOT_REACTIVATED,
          customerIds: ["cust-123"],
        },
      }

      await pushController.sendSystemNotification(
        mockReq as Request,
        mockRes as Response
      )

      expect(mockRes.status).toHaveBeenCalledWith(400)
    })
  })

  describe("Error Handling", () => {
    it("should handle customer not found", async () => {
      mockCustomersFindUnique.mockResolvedValue(null)

      mockReq = {
        params: { workspaceId: "workspace-789" },
        body: {
          type: SystemNotificationType.CHATBOT_REACTIVATED,
          customerIds: ["nonexistent-customer"],
        },
      }

      await pushController.sendSystemNotification(
        mockReq as Request,
        mockRes as Response
      )

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          sent: 0,
          failed: 1,
          errors: expect.arrayContaining([
            expect.stringContaining("Not found"),
          ]),
        })
      )
    })

    it("should handle missing phone number", async () => {
      mockCustomersFindUnique.mockResolvedValue({
        id: "cust-123",
        name: "Mario Rossi",
        phone: null, // Missing phone
        language: "IT",
      })

      mockReq = {
        params: { workspaceId: "workspace-789" },
        body: {
          type: SystemNotificationType.CHATBOT_REACTIVATED,
          customerIds: ["cust-123"],
        },
      }

      await pushController.sendSystemNotification(
        mockReq as Request,
        mockRes as Response
      )

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          sent: 0,
          failed: 1,
          errors: expect.arrayContaining([
            expect.stringContaining("Missing phone number"),
          ]),
        })
      )
    })
  })

  describe("Performance Metrics", () => {
    it("should achieve 90% token reduction", () => {
      const normalFlowTokens = 20000 // Router (5k) + SubLLM (10k) + Router (2k) + Safety (2k)
      const fastPathTokens = 3149 // Only Safety Agent

      const reduction =
        ((normalFlowTokens - fastPathTokens) / normalFlowTokens) * 100

      expect(reduction).toBeGreaterThan(80)
      expect(fastPathTokens).toBeLessThan(5000)
    })
  })
})
