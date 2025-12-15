/**
 * Feature 127: System Notifications Unified Endpoint - Unit Tests
 */

const mockCustomersFindUnique = jest.fn()
const mockChatSessionFindFirst = jest.fn()
const mockChatSessionCreate = jest.fn()

const mockPrisma = {
  customers: {
    findUnique: mockCustomersFindUnique,
  },
  chatSession: {
    findFirst: mockChatSessionFindFirst,
    create: mockChatSessionCreate,
  },
}

jest.mock("@echatbot/database", () => ({
  prisma: mockPrisma,
}))

const mockRouteMessage = jest.fn()

jest.mock("../../../src/services/llm-router.service", () => ({
  LLMRouterService: jest.fn().mockImplementation(() => ({
    routeMessage: mockRouteMessage,
  })),
}))

const mockEnqueue = jest.fn().mockResolvedValue({ id: "queue-123" })

jest.mock("../../../src/services/whatsapp-queue.service", () => ({
  WhatsAppQueueService: jest.fn().mockImplementation(() => ({
    enqueue: mockEnqueue,
  })),
}))

import { Request, Response } from "express"
import {
  PushController,
  SystemNotificationType,
} from "../../../src/interfaces/http/controllers/push.controller"

describe("Feature 127: System Notifications Unified Endpoint", () => {
  let pushController: PushController
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>

  beforeEach(() => {
    jest.clearAllMocks()
    mockRouteMessage.mockClear()
    mockCustomersFindUnique.mockClear()
    mockChatSessionFindFirst.mockClear()
    mockChatSessionCreate.mockClear()

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }

    pushController = new PushController(mockPrisma as any)
  })

  describe("CHATBOT_REACTIVATED", () => {
    it("should send chatbot reactivation notification successfully", async () => {
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

      await pushController.sendSystemNotification(
        mockReq as Request,
        mockRes as Response
      )

      expect(mockRouteMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          isSystemMessage: true,
          workspaceId: "workspace-789",
          customerId: mockCustomer.id,
        })
      )

      expect(mockEnqueue).toHaveBeenCalledWith({
        workspaceId: "workspace-789",
        customerId: mockCustomer.id,
        phoneNumber: "+390212345678",
        messageContent: "🤖 Ciao Mario, il chatbot è ora disponibile!",
      })

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          sent: 1,
          failed: 0,
        })
      )
    })
  })
})
