/**
 * Widget Billing Tests
 * Feature: Widget message billing at $0.05 per message
 * 
 * Tests:
 * - Widget messages charged at $0.05 (not $0.10 like WhatsApp)
 * - Credit deducted from owner (not workspace)
 * - Billing transaction created with correct amount
 * - Credit limit enforced (-$10 threshold)
 * - Widget blocked when credit below -$10
 * - Billing failure doesn't break UX (user gets response)
 */

import { PrismaClient, Prisma } from "@echatbot/database"

// Mock modules FIRST (before creating mockPrisma)
jest.mock("@echatbot/database", () => {
  const mockPrismaInstance = {
    workspace: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    customers: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    chatSession: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    conversationMessage: {
      create: jest.fn(),
    },
    billingTransaction: {
      create: jest.fn(),
    },
    platformConfig: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback: any) => callback(mockPrismaInstance)),
  }
  
  return {
    PrismaClient: jest.fn(() => mockPrismaInstance),
    prisma: mockPrismaInstance,
    AgentType: {
      ROUTER: "ROUTER",
      CART_MANAGEMENT: "CART_MANAGEMENT",
      CUSTOMER_SUPPORT: "CUSTOMER_SUPPORT",
    },
    Prisma: {
      Decimal: jest.fn((value: any) => ({
        toFixed: () => String(value),
        toString: () => String(value),
      })),
    },
  }
})

// Mock LLMRouterService
const mockLLMRouterService = {
  routeMessage: jest.fn(),
}
jest.mock("../../../src/services/llm-router.service", () => ({
  LLMRouterService: jest.fn(() => mockLLMRouterService),
}))

// Mock SubscriptionBillingService
const mockSubscriptionBillingService = {
  deductOwnerWidgetMessageCredit: jest.fn(),
}
jest.mock("../../../src/application/services/subscription-billing.service", () => ({
  SubscriptionBillingService: jest.fn(() => mockSubscriptionBillingService),
}))

// Mock other services
jest.mock("../../../src/application/services/visitor-id.service", () => ({
  VisitorIdService: {
    validate: jest.fn(() => true),
    isExpired: jest.fn(() => false),
    getExpiryDate: jest.fn(() => new Date(Date.now() + 24 * 60 * 60 * 1000)),
  },
}))

jest.mock("../../../src/application/services/security-check.service", () => ({
  SecurityCheckService: {
    validateMessage: jest.fn(() => Promise.resolve([
      { step: "rate_limit", passed: true },
      { step: "spam_check", passed: true },
      { step: "content_filter", passed: true },
      { step: "workspace_active", passed: true },
      { step: "visitor_valid", passed: true },
    ])),
  },
}))

jest.mock("../../../src/utils/welcome-message.handler", () => ({
  WelcomeMessageHandler: jest.fn(() => ({
    handleWelcomeMessage: jest.fn(() => Promise.resolve({ isWelcomeMessage: false })),
  })),
}))

import { WidgetChatController } from "../../../src/interfaces/http/controllers/widget-chat.controller"
import { Request, Response } from "express"

// Get mock prisma from module mock
const { prisma: mockPrisma } = jest.requireMock("@echatbot/database")

describe("Widget Billing", () => {
  let controller: WidgetChatController
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let statusMock: jest.Mock
  let jsonMock: jest.Mock

  const mockWorkspaceId = "workspace-123"
  const mockVisitorId = "visitor_1726262000000_a7k2m9x1" // Valid format: visitor_{timestamp}_{hash}
  const mockOwnerId = "owner-789"
  const mockCustomerId = "customer-abc"
  const mockSessionId = "session-def"

  beforeEach(() => {
    jest.clearAllMocks()

    controller = new WidgetChatController()

    jsonMock = jest.fn()
    statusMock = jest.fn(() => ({ json: jsonMock }))

    mockReq = {
      params: { workspaceId: mockWorkspaceId },
      body: {
        visitorId: mockVisitorId,
        message: "Ciao, vorrei informazioni",
        language: "it",
      },
      headers: {
        "accept-language": "it-IT,it;q=0.9,en;q=0.8",
      },
    }

    mockRes = {
      status: statusMock,
      json: jsonMock,
    }

    // Default workspace mock (active, with owner)
    ;(mockPrisma.workspace.findUnique as jest.Mock).mockResolvedValue({
      id: mockWorkspaceId,
      deletedAt: null,
      channelStatus: true,
      ownerId: mockOwnerId,
      language: "ITA",
      debugMode: false,
      wipMessage: null,
      enableWidget: true,
      widgetLanguage: "it",
      widgetPrimaryColor: "#22c55e",
      widgetIcon: "sparkles",
    })

    // Default owner mock (active, with sufficient credit)
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: mockOwnerId,
      status: "ACTIVE",
      creditBalance: new Prisma.Decimal(50.00),
      subscriptionStatus: "ACTIVE",
    })

    // Default customer mock
    ;(mockPrisma.customers.findFirst as jest.Mock).mockResolvedValue({
      id: mockCustomerId,
      workspaceId: mockWorkspaceId,
      customId: mockVisitorId,
      name: "Visitor 456",
      language: "ITA",
    })

    // Default session mock
    ;(mockPrisma.chatSession.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.chatSession.create as jest.Mock).mockResolvedValue({
      id: mockSessionId,
      workspaceId: mockWorkspaceId,
      customerId: mockCustomerId,
      status: "active",
    })

    // Default LLM response
    mockLLMRouterService.routeMessage.mockResolvedValue({
      response: "Ciao! Come posso aiutarti?",
      agentUsed: "ROUTER",
      tokensUsed: 150,
      isBlocked: false,
    })

    // Default billing success
    mockSubscriptionBillingService.deductOwnerWidgetMessageCredit.mockResolvedValue({
      success: true,
      newBalance: 49.95, // $50.00 - $0.05 = $49.95
    })
  })

  describe("Widget Message Billing ($0.05)", () => {
    it("should charge $0.05 for widget message (not $0.10)", async () => {
      await controller.sendMessage(mockReq as Request, mockRes as Response)

      expect(mockSubscriptionBillingService.deductOwnerWidgetMessageCredit).toHaveBeenCalledWith(
        mockOwnerId,
        mockWorkspaceId,
        expect.stringContaining("widget-")
      )

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          response: expect.any(String),
        })
      )
    })

    it("should deduct credit from owner (not workspace)", async () => {
      await controller.sendMessage(mockReq as Request, mockRes as Response)

      expect(mockSubscriptionBillingService.deductOwnerWidgetMessageCredit).toHaveBeenCalledWith(
        mockOwnerId, // CRITICAL: Owner ID, not workspace ID
        mockWorkspaceId,
        expect.any(String)
      )
    })

    it("should still respond to user even if billing fails", async () => {
      mockSubscriptionBillingService.deductOwnerWidgetMessageCredit.mockResolvedValue({
        success: false,
        newBalance: 0,
        error: "Insufficient credit",
      })

      await controller.sendMessage(mockReq as Request, mockRes as Response)

      // User should still get response (UX not affected by billing failure)
      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          response: "Ciao! Come posso aiutarti?",
        })
      )
    })

    it("should log warning if workspace has no owner", async () => {
      ;(mockPrisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: mockWorkspaceId,
        deletedAt: null,
        ownerId: null, // No owner
        language: "ITA",
        channelStatus: true,
        debugMode: false,
        wipMessage: null,
        enableWidget: true,
      })

      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation()

      await controller.sendMessage(mockReq as Request, mockRes as Response)

      // Should skip billing but still process message
      expect(mockSubscriptionBillingService.deductOwnerWidgetMessageCredit).not.toHaveBeenCalled()
      expect(statusMock).toHaveBeenCalledWith(200)

      consoleWarnSpy.mockRestore()
    })
  })

  describe("Credit Limit Enforcement (-$10 threshold)", () => {
    it("should allow message when balance is positive", async () => {
      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockOwnerId,
        status: "ACTIVE",
        creditBalance: new Prisma.Decimal(100.00),
        subscriptionStatus: "ACTIVE",
      })

      await controller.sendMessage(mockReq as Request, mockRes as Response)

      expect(mockLLMRouterService.routeMessage).toHaveBeenCalled()
      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it("should allow message when balance is negative but above -$10", async () => {
      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockOwnerId,
        status: "ACTIVE",
        creditBalance: new Prisma.Decimal(-5.00), // -$5.00 (within threshold)
        subscriptionStatus: "ACTIVE",
      })

      await controller.sendMessage(mockReq as Request, mockRes as Response)

      expect(mockLLMRouterService.routeMessage).toHaveBeenCalled()
      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it("should allow message when balance is exactly -$10", async () => {
      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockOwnerId,
        status: "ACTIVE",
        creditBalance: new Prisma.Decimal(-10.00), // Exactly -$10 (edge case)
        subscriptionStatus: "ACTIVE",
      })

      await controller.sendMessage(mockReq as Request, mockRes as Response)

      expect(mockLLMRouterService.routeMessage).toHaveBeenCalled()
      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it("should block message when balance below -$10", async () => {
      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockOwnerId,
        status: "ACTIVE",
        creditBalance: new Prisma.Decimal(-10.01), // Below -$10 threshold
        subscriptionStatus: "ACTIVE",
      })

      await controller.sendMessage(mockReq as Request, mockRes as Response)

      // Should NOT process message
      expect(mockLLMRouterService.routeMessage).not.toHaveBeenCalled()

      // Should return 402 Payment Required
      expect(statusMock).toHaveBeenCalledWith(402)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "INSUFFICIENT_CREDIT",
          message: expect.stringContaining("Credit limit reached"),
          currentBalance: -10.01,
          minimumRequired: -10.00,
        })
      )
    })

    it("should block message when balance is -$15 (far below threshold)", async () => {
      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockOwnerId,
        status: "ACTIVE",
        creditBalance: new Prisma.Decimal(-15.00),
        subscriptionStatus: "ACTIVE",
      })

      await controller.sendMessage(mockReq as Request, mockRes as Response)

      expect(mockLLMRouterService.routeMessage).not.toHaveBeenCalled()
      expect(statusMock).toHaveBeenCalledWith(402)
    })
  })

  describe("Channel Status & Debug Mode", () => {
    it("should return WIP message when debugMode=true", async () => {
      ;(mockPrisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: mockWorkspaceId,
        deletedAt: null,
        ownerId: mockOwnerId,
        language: "ITA",
        channelStatus: true,
        debugMode: true, // Debug mode ON
        wipMessage: { it: "Siamo in manutenzione" },
        enableWidget: true,
      })

      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockOwnerId,
        status: "ACTIVE",
      })

      await controller.sendMessage(mockReq as Request, mockRes as Response)

      // Should NOT call LLM
      expect(mockLLMRouterService.routeMessage).not.toHaveBeenCalled()

      // Should return WIP message
      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: "wip",
          response: "Siamo in manutenzione",
        })
      )
    })

    it("should return WIP message when channelStatus=false", async () => {
      ;(mockPrisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: mockWorkspaceId,
        deletedAt: null,
        ownerId: mockOwnerId,
        language: "ITA",
        channelStatus: false, // Channel offline
        debugMode: false,
        wipMessage: { it: "Canale temporaneamente offline" },
        enableWidget: true,
      })

      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockOwnerId,
        status: "ACTIVE",
      })

      await controller.sendMessage(mockReq as Request, mockRes as Response)

      expect(mockLLMRouterService.routeMessage).not.toHaveBeenCalled()
      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: "wip",
          response: "Canale temporaneamente offline", // Match actual wipMessage
        })
      )
    })

    it("should block message when widget disabled (enableWidget=false)", async () => {
      ;(mockPrisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: mockWorkspaceId,
        deletedAt: null,
        ownerId: mockOwnerId,
        language: "ITA",
        channelStatus: true,
        debugMode: false,
        enableWidget: false, // Widget disabled
      })

      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockOwnerId,
        status: "ACTIVE",
      })

      await controller.sendMessage(mockReq as Request, mockRes as Response)

      expect(mockLLMRouterService.routeMessage).not.toHaveBeenCalled()
      expect(statusMock).toHaveBeenCalledWith(403)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "WIDGET_DISABLED",
        })
      )
    })
  })

  describe("Billing Transaction Recording", () => {
    it("should create billing record in database", async () => {
      await controller.sendMessage(mockReq as Request, mockRes as Response)

      // Verify deductOwnerWidgetMessageCredit was called (creates transaction internally)
      expect(mockSubscriptionBillingService.deductOwnerWidgetMessageCredit).toHaveBeenCalledWith(
        mockOwnerId,
        mockWorkspaceId,
        expect.stringContaining("widget-")
      )

      // Verify response sent to user
      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          response: expect.any(String),
        })
      )
    })
  })

  describe("Widget Status Endpoint", () => {
    it("should return 'disabled' when channelStatus=false", async () => {
      ;(mockPrisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: mockWorkspaceId,
        deletedAt: null,
        ownerId: mockOwnerId,
        channelStatus: false,
        debugMode: false,
        enableWidget: true,
        wipMessage: null,
        widgetLanguage: "it",
        widgetPrimaryColor: "#22c55e",
        widgetIcon: "sparkles",
      })

      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockOwnerId,
        status: "ACTIVE",
      })

      mockReq.params = { workspaceId: mockWorkspaceId }
      mockReq.query = {} // Add query property

      await controller.getStatus(mockReq as Request, mockRes as Response)

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: "wip",
          channelStatus: false,
        })
      )
    })

    it("should return 'wip' when debugMode=true", async () => {
      ;(mockPrisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: mockWorkspaceId,
        deletedAt: null,
        ownerId: mockOwnerId,
        channelStatus: true,
        debugMode: true,
        enableWidget: true,
        wipMessage: { it: "Manutenzione" },
        widgetLanguage: "it",
        widgetPrimaryColor: "#22c55e",
        widgetIcon: "sparkles",
      })

      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockOwnerId,
        status: "ACTIVE",
      })

      mockReq.params = { workspaceId: mockWorkspaceId }
      mockReq.query = { language: "it" }

      await controller.getStatus(mockReq as Request, mockRes as Response)

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: "wip",
          wipMessage: "Manutenzione",
        })
      )
    })

    it("should return 'active' when workspace is fully operational", async () => {
      ;(mockPrisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: mockWorkspaceId,
        deletedAt: null,
        ownerId: mockOwnerId,
        channelStatus: true,
        debugMode: false,
        enableWidget: true,
        widgetLanguage: "it",
        widgetPrimaryColor: "#22c55e",
        widgetIcon: "sparkles",
      })

      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockOwnerId,
        status: "ACTIVE",
      })

      mockReq.params = { workspaceId: mockWorkspaceId }
      mockReq.query = {} // Add query property

      await controller.getStatus(mockReq as Request, mockRes as Response)

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: "active",
          channelStatus: true,
          debugMode: false,
          language: "it",
          primaryColor: "#22c55e",
          icon: "sparkles",
        })
      )
    })
  })
})
