/**
 * Push Controller Unit Tests
 *
 * Tests system notification flow (unified):
 * - CHATBOT_REACTIVATED
 * - ACCOUNT_ACTIVATED
 * - DISCOUNT_CHANGED
 */

import { Request, Response } from "express"
import { PushController } from "../../../src/interfaces/http/controllers/push.controller"

// Mock dependencies
jest.mock("@prisma/client")
jest.mock("../../../src/utils/logger")

describe("PushController - sendSystemNotification", () => {
  let pushController: PushController
  let mockPrisma: any
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let mockLLMRouterService: any
  let mockWhatsAppQueueService: any

  beforeEach(() => {
    // Setup mocks
    mockPrisma = {
      customers: {
        findUnique: jest.fn(),
      },
      chatSession: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    } as any

    mockLLMRouterService = {
      routeMessage: jest.fn(),
    }

    mockWhatsAppQueueService = {
      enqueue: jest.fn().mockResolvedValue({ id: "queue-123" }),
    }

    // Create controller with mocked dependencies
    pushController = new PushController(
      mockPrisma,
      mockLLMRouterService,
      mockWhatsAppQueueService
    )

    mockRequest = {
      params: {
        workspaceId: "workspace-123",
      },
      body: {
        type: "CHATBOT_REACTIVATED",
        customerIds: ["customer-456"],
      },
    }

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("Happy Path: Admin clicks 'Yes, notify user'", () => {
    it("should send WhatsApp notification to customer when admin confirms", async () => {
      // Arrange: Setup customer data
      const mockCustomer = {
        id: "customer-456",
        phone: "+34666777888",
        name: "Maria Garcia",
        language: "ESP", // Spanish
      }

      const mockChatSession = {
        id: "session-789",
        customerId: "customer-456",
        workspaceId: "workspace-123",
        status: "active",
      }

      const mockRouterResponse = {
        response:
          "🤖 ¡Hola Maria Garcia, el chatbot ya está disponible, ¿cómo puedo ayudarte hoy?",
        agentUsed: "SYSTEM_NOTIFICATION",
        tokensUsed: 2000,
        executionTimeMs: 500,
        wasFAQ: false,
        isBlocked: false,
      }

      mockPrisma.customers.findUnique.mockResolvedValue(mockCustomer as any)
      mockPrisma.chatSession.findFirst.mockResolvedValue(mockChatSession as any)
      mockLLMRouterService.routeMessage.mockResolvedValue(mockRouterResponse)

      // Act: Admin clicks "Yes, notify user"
      await pushController.sendSystemNotification(
        mockRequest as Request,
        mockResponse as Response
      )

      // Assert: Verify customer was fetched
      expect(mockPrisma.customers.findUnique).toHaveBeenCalledWith({
        where: { id: "customer-456", workspaceId: "workspace-123" },
        select: {
          id: true,
          phone: true,
          name: true,
          language: true,
        },
      })

      // Assert: Verify chat session was found/created
      expect(mockPrisma.chatSession.findFirst).toHaveBeenCalledWith({
        where: {
          customerId: "customer-456",
          workspaceId: "workspace-123",
          status: "active",
        },
      })

      // Assert: Verify llmRouterService.routeMessage was called with correct params
      expect(mockLLMRouterService.routeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "workspace-123",
          customerId: "customer-456",
          conversationId: "session-789",
          messageId: expect.stringContaining("system-chatbot_reactivated-"),
          message:
            "🤖 Ciao Maria Garcia, da questo momento la tua chat è attiva. Sono qui per aiutarti!",
          customerLanguage: "ESP",
          customerName: "Maria Garcia",
          isSystemMessage: true, // 🚀 Fast-path: Skip Router/SubLLM
        })
      )

      // Assert: Verify WhatsApp queue message
      expect(mockWhatsAppQueueService.enqueue).toHaveBeenCalledWith({
        workspaceId: "workspace-123",
        customerId: "customer-456",
        phoneNumber: "+34666777888",
        messageContent:
          "🤖 ¡Hola Maria Garcia, el chatbot ya está disponible, ¿cómo puedo ayudarte hoy?",
      })

      // Assert: Verify response sent to frontend
      expect(mockResponse.status).toHaveBeenCalledWith(200)
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        sent: 1,
        failed: 0,
        errors: [],
      })
    })

    it("should translate message to customer's language (Spanish)", async () => {
      // Arrange
      const mockCustomer = {
        id: "customer-456",
        phone: "+34666777888",
        name: "Maria Garcia",
        language: "ESP",
      }

      const mockChatSession = {
        id: "session-789",
        customerId: "customer-456",
        workspaceId: "workspace-123",
        status: "active",
      }

      // Router returns SPANISH translation
      const mockRouterResponse = {
        response:
          "🤖 ¡Hola Maria Garcia, el chatbot ya está disponible, ¿cómo puedo ayudarte hoy?",
        agentUsed: "SYSTEM_NOTIFICATION",
        tokensUsed: 2000,
        executionTimeMs: 500,
        wasFAQ: false,
        isBlocked: false,
      }

      mockPrisma.customers.findUnique.mockResolvedValue(mockCustomer as any)
      mockPrisma.chatSession.findFirst.mockResolvedValue(mockChatSession as any)
      mockLLMRouterService.routeMessage.mockResolvedValue(mockRouterResponse)

      // Act
      await pushController.sendSystemNotification(
        mockRequest as Request,
        mockResponse as Response
      )

      // Assert: Message was in Italian (base) → SafetyTranslationAgent translates to Spanish
      expect(mockLLMRouterService.routeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Ciao Maria Garcia"), // Italian input
          customerLanguage: "ESP", // Spanish target
          isSystemMessage: true, // Goes through SafetyTranslationAgent
        })
      )

      // Assert: Response is in Spanish
      const routerCall = mockLLMRouterService.routeMessage.mock.calls[0][0]
      expect(routerCall.customerLanguage).toBe("ESP")
    })

    it("should create chat session if not exists", async () => {
      // Arrange
      const mockCustomer = {
        id: "customer-456",
        phone: "+34666777888",
        name: "Maria Garcia",
        language: "ESP",
      }

      const newChatSession = {
        id: "new-session-999",
        customerId: "customer-456",
        workspaceId: "workspace-123",
        status: "active",
      }

      mockPrisma.customers.findUnique.mockResolvedValue(mockCustomer as any)
      mockPrisma.chatSession.findFirst.mockResolvedValue(null) // No existing session
      mockPrisma.chatSession.create.mockResolvedValue(newChatSession as any)
      mockLLMRouterService.routeMessage.mockResolvedValue({
        response: "Test response",
        agentUsed: "SYSTEM_NOTIFICATION",
        tokensUsed: 2000,
        executionTimeMs: 500,
        wasFAQ: false,
        isBlocked: false,
      })

      // Act
      await pushController.sendSystemNotification(
        mockRequest as Request,
        mockResponse as Response
      )

      // Assert: Chat session was created
      expect(mockPrisma.chatSession.create).toHaveBeenCalledWith({
        data: {
          customerId: "customer-456",
          workspaceId: "workspace-123",
          status: "active",
          context: {},
        },
      })

      // Assert: New session ID was used in routeMessage
      expect(mockLLMRouterService.routeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: "new-session-999",
        })
      )
    })
  })

  describe("Edge Cases", () => {
    it("should skip customer if phone number is missing", async () => {
      // Arrange: Customer without phone
      const mockCustomer = {
        id: "customer-456",
        phone: null, // Missing phone!
        name: "Maria Garcia",
        language: "ESP",
      }

      mockPrisma.customers.findUnique.mockResolvedValue(mockCustomer as any)

      // Act
      await pushController.sendSystemNotification(
        mockRequest as Request,
        mockResponse as Response
      )

      // Assert: llmRouterService was NOT called
      expect(mockLLMRouterService.routeMessage).not.toHaveBeenCalled()

      // Assert: Error was logged
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        sent: 0,
        failed: 1,
        errors: ["Customer Maria Garcia: Missing phone number"],
      })
    })

    it("should handle customer not found", async () => {
      // Arrange: Customer doesn't exist
      mockPrisma.customers.findUnique.mockResolvedValue(null)

      // Act
      await pushController.sendSystemNotification(
        mockRequest as Request,
        mockResponse as Response
      )

      // Assert: llmRouterService was NOT called
      expect(mockLLMRouterService.routeMessage).not.toHaveBeenCalled()

      // Assert: Error was logged
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        sent: 0,
        failed: 1,
        errors: ["Customer customer-456: Not found"],
      })
    })

    it("should handle security block (isBlocked=true)", async () => {
      // Arrange
      const mockCustomer = {
        id: "customer-456",
        phone: "+34666777888",
        name: "Maria Garcia",
        language: "ESP",
      }

      const mockChatSession = {
        id: "session-789",
        customerId: "customer-456",
        workspaceId: "workspace-123",
        status: "active",
      }

      mockPrisma.customers.findUnique.mockResolvedValue(mockCustomer as any)
      mockPrisma.chatSession.findFirst.mockResolvedValue(mockChatSession as any)

      // Router blocks message (security issue)
      mockLLMRouterService.routeMessage.mockResolvedValue({
        response: "",
        agentUsed: "SYSTEM_NOTIFICATION",
        tokensUsed: 0,
        executionTimeMs: 100,
        wasFAQ: false,
        isBlocked: true, // 🚨 Blocked!
      })

      // Act
      await pushController.sendSystemNotification(
        mockRequest as Request,
        mockResponse as Response
      )

      // Assert: Counted as failed
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        sent: 0,
        failed: 1,
        errors: ["Customer Maria Garcia: Message blocked by security"],
      })
    })

    it("should handle multiple customers (batch notification)", async () => {
      // Arrange: 2 customers
      mockRequest.body.customerIds = ["customer-1", "customer-2"]

      const customer1 = {
        id: "customer-1",
        phone: "+34111222333",
        name: "Customer One",
        language: "IT",
      }

      const customer2 = {
        id: "customer-2",
        phone: "+34444555666",
        name: "Customer Two",
        language: "ESP",
      }

      const session1 = {
        id: "session-1",
        customerId: "customer-1",
        workspaceId: "workspace-123",
        status: "active",
      }

      const session2 = {
        id: "session-2",
        customerId: "customer-2",
        workspaceId: "workspace-123",
        status: "active",
      }

      mockPrisma.customers.findUnique
        .mockResolvedValueOnce(customer1 as any)
        .mockResolvedValueOnce(customer2 as any)

      mockPrisma.chatSession.findFirst
        .mockResolvedValueOnce(session1 as any)
        .mockResolvedValueOnce(session2 as any)

      mockLLMRouterService.routeMessage.mockResolvedValue({
        response: "Notification sent",
        agentUsed: "SYSTEM_NOTIFICATION",
        tokensUsed: 2000,
        executionTimeMs: 500,
        wasFAQ: false,
        isBlocked: false,
      })

      // Act
      await pushController.sendSystemNotification(
        mockRequest as Request,
        mockResponse as Response
      )

      // Assert: Both customers notified
      expect(mockLLMRouterService.routeMessage).toHaveBeenCalledTimes(2)
      expect(mockWhatsAppQueueService.enqueue).toHaveBeenCalledTimes(2)
      expect(mockWhatsAppQueueService.enqueue).toHaveBeenNthCalledWith(1, {
        workspaceId: "workspace-123",
        customerId: "customer-1",
        phoneNumber: "+34111222333",
        messageContent: "Notification sent",
      })
      expect(mockWhatsAppQueueService.enqueue).toHaveBeenNthCalledWith(2, {
        workspaceId: "workspace-123",
        customerId: "customer-2",
        phoneNumber: "+34444555666",
        messageContent: "Notification sent",
      })
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        sent: 2,
        failed: 0,
        errors: [],
      })
    })
  })

  describe("Validation", () => {
    it("should return 400 if workspaceId is missing", async () => {
      // Arrange
      mockRequest.params.workspaceId = undefined as any

      // Act
      await pushController.sendSystemNotification(
        mockRequest as Request,
        mockResponse as Response
      )

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Invalid request",
        message: "workspaceId, type, and customerIds array are required",
      })
    })

    it("should return 400 if customerIds is not an array", async () => {
      // Arrange
      mockRequest.body.customerIds = "not-an-array"

      // Act
      await pushController.sendSystemNotification(
        mockRequest as Request,
        mockResponse as Response
      )

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Invalid request",
        message: "workspaceId, type, and customerIds array are required",
      })
    })
  })
})
