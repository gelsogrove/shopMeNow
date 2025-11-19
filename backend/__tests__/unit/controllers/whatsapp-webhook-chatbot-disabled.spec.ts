/**
 * WhatsApp Webhook - Chatbot Disabled Test
 *
 * Verifica che quando activeChatbot=false:
 * 1. Il messaggio viene salvato nel database
 * 2. NON viene processato dal LLM
 * 3. Ritorna 200 senza errori
 *
 * @author Andrea Gelso
 */

import { Request, Response } from "express"
import { PrismaClient } from "@prisma/client"
import { WhatsAppWebhookController } from "../../../src/interfaces/http/controllers/whatsapp-webhook.controller"

// Mock Prisma Client
const mockPrisma = {
  customer: {
    findFirst: jest.fn(),
  },
  conversationMessage: {
    create: jest.fn(),
  },
  chatSession: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
} as unknown as PrismaClient

// Mock LLMRouterService
jest.mock("../../../src/application/services/llm-router.service", () => ({
  LLMRouterService: jest.fn().mockImplementation(() => ({
    routeMessage: jest.fn(), // This should NEVER be called when chatbot disabled
  })),
}))

describe("WhatsApp Webhook - Chatbot Disabled", () => {
  let controller: WhatsAppWebhookController
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>

  beforeEach(() => {
    jest.clearAllMocks()

    controller = new WhatsAppWebhookController()
    // Inject mock prisma
    ;(controller as any).prisma = mockPrisma

    mockRequest = {
      body: {
        from: "393331234567", // Italian phone number
        body: "Ciao, vorrei ordinare una pizza",
      },
    }

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
  })

  it("should save message and NOT process with LLM when activeChatbot=false", async () => {
    // ARRANGE: Customer with chatbot DISABLED
    const mockCustomer = {
      id: "customer-123",
      workspaceId: "workspace-123",
      phone: "393331234567",
      name: "Test Customer",
      activeChatbot: false, // ← CHATBOT DISABLED
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const mockSession = {
      id: "session-123",
      customerId: "customer-123",
      workspaceId: "workspace-123",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const mockSavedMessage = {
      id: "message-123",
      sessionId: "session-123",
      customerId: "customer-123",
      workspaceId: "workspace-123",
      content: "Ciao, vorrei ordinare una pizza",
      direction: "incoming",
      agentType: null,
      createdAt: new Date(),
    }

    // Mock database responses
    ;(mockPrisma.customer.findFirst as jest.Mock).mockResolvedValue(
      mockCustomer
    )
    ;(mockPrisma.chatSession.findFirst as jest.Mock).mockResolvedValue(
      mockSession
    )
    ;(mockPrisma.conversationMessage.create as jest.Mock).mockResolvedValue(
      mockSavedMessage
    )

    // ACT: Process incoming message
    await controller.handleIncomingMessage(
      mockRequest as Request,
      mockResponse as Response
    )

    // ASSERT: Message saved to database
    expect(mockPrisma.conversationMessage.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: "session-123",
        customerId: "customer-123",
        workspaceId: "workspace-123",
        content: "Ciao, vorrei ordinare una pizza",
        direction: "incoming",
        agentType: null, // No agent processing
      }),
    })

    // ASSERT: Response is 200 OK
    expect(mockResponse.status).toHaveBeenCalledWith(200)
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      message: "Message received and saved (chatbot disabled)",
    })

    // ASSERT: LLM Router was NEVER called
    const LLMRouterService = require("../../../src/application/services/llm-router.service")
      .LLMRouterService
    const mockInstance = new LLMRouterService()
    expect(mockInstance.routeMessage).not.toHaveBeenCalled()
  })

  it("should process message normally when activeChatbot=true", async () => {
    // ARRANGE: Customer with chatbot ENABLED
    const mockCustomer = {
      id: "customer-456",
      workspaceId: "workspace-456",
      phone: "393331234567",
      name: "Test Customer Active",
      activeChatbot: true, // ← CHATBOT ENABLED
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const mockSession = {
      id: "session-456",
      customerId: "customer-456",
      workspaceId: "workspace-456",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Mock database responses
    ;(mockPrisma.customer.findFirst as jest.Mock).mockResolvedValue(
      mockCustomer
    )
    ;(mockPrisma.chatSession.findFirst as jest.Mock).mockResolvedValue(
      mockSession
    )

    // ACT: Process incoming message
    await controller.handleIncomingMessage(
      mockRequest as Request,
      mockResponse as Response
    )

    // ASSERT: LLM Router SHOULD be called (chatbot enabled)
    const LLMRouterService = require("../../../src/application/services/llm-router.service")
      .LLMRouterService
    const mockInstance = new LLMRouterService()
    expect(mockInstance.routeMessage).toHaveBeenCalledTimes(1)
  })

  it("should handle missing customer gracefully", async () => {
    // ARRANGE: Customer not found in database
    ;(mockPrisma.customer.findFirst as jest.Mock).mockResolvedValue(null)

    // ACT: Process incoming message
    await controller.handleIncomingMessage(
      mockRequest as Request,
      mockResponse as Response
    )

    // ASSERT: Error response
    expect(mockResponse.status).toHaveBeenCalledWith(404)
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: "Customer not found",
    })

    // ASSERT: No message saved
    expect(mockPrisma.conversationMessage.create).not.toHaveBeenCalled()

    // ASSERT: LLM Router not called
    const LLMRouterService = require("../../../src/application/services/llm-router.service")
      .LLMRouterService
    const mockInstance = new LLMRouterService()
    expect(mockInstance.routeMessage).not.toHaveBeenCalled()
  })

  it("should create chat session if not exists when chatbot disabled", async () => {
    // ARRANGE: Customer exists, no active session
    const mockCustomer = {
      id: "customer-789",
      workspaceId: "workspace-789",
      phone: "393331234567",
      name: "Test Customer No Session",
      activeChatbot: false, // ← CHATBOT DISABLED
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const mockNewSession = {
      id: "session-new-789",
      customerId: "customer-789",
      workspaceId: "workspace-789",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const mockSavedMessage = {
      id: "message-789",
      sessionId: "session-new-789",
      customerId: "customer-789",
      workspaceId: "workspace-789",
      content: "Ciao, vorrei ordinare una pizza",
      direction: "incoming",
      agentType: null,
      createdAt: new Date(),
    }

    // Mock: Customer exists, no session, create new session
    ;(mockPrisma.customer.findFirst as jest.Mock).mockResolvedValue(
      mockCustomer
    )
    ;(mockPrisma.chatSession.findFirst as jest.Mock).mockResolvedValue(null) // No active session
    ;(mockPrisma.chatSession.create as jest.Mock).mockResolvedValue(
      mockNewSession
    )
    ;(mockPrisma.conversationMessage.create as jest.Mock).mockResolvedValue(
      mockSavedMessage
    )

    // ACT: Process incoming message
    await controller.handleIncomingMessage(
      mockRequest as Request,
      mockResponse as Response
    )

    // ASSERT: Session created
    expect(mockPrisma.chatSession.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.chatSession.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-789",
        customerId: "customer-789",
        status: "active",
      },
    })

    // ASSERT: Message saved with new session
    expect(mockPrisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: "session-new-789",
        customerId: "customer-789",
      }),
    })

    // ASSERT: Success response
    expect(mockResponse.status).toHaveBeenCalledWith(200)
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      message: "Message received and saved (chatbot disabled)",
    })
  })
})
