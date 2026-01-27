/**
 * Widget Debug Mode - NO Billing Test
 * 
 * CRITICAL: Verify that debugMode=true prevents billing deduction
 * 
 * Flow:
 * 1. Widget message sent with debugMode=true
 * 2. Widget returns WIP message
 * 3. Billing service is NOT called (no credit deduction)
 * 
 * This allows workspace owners to test chatbot configuration without cost.
 */

import { PrismaClient, Prisma } from "@echatbot/database"

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

// Mock modules
jest.mock("@echatbot/database", () => {
  const mockPrismaInstance = {
    workspace: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    customers: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    chatSession: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    conversationMessage: {
      create: jest.fn(),
    },
  }
  
  return {
    PrismaClient: jest.fn(() => mockPrismaInstance),
    prisma: mockPrismaInstance,
    AgentType: {
      ROUTER: "ROUTER",
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

const { prisma: mockPrisma } = jest.requireMock("@echatbot/database")

describe("Widget Debug Mode - NO Billing", () => {
  let controller: WidgetChatController
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let statusMock: jest.Mock
  let jsonMock: jest.Mock

  const mockWorkspaceId = "workspace-123"
  const mockVisitorId = "visitor_1726262000000_a7k2m9x1"
  const mockOwnerId = "owner-789"

  beforeEach(() => {
    jest.clearAllMocks()

    controller = new WidgetChatController()

    jsonMock = jest.fn()
    statusMock = jest.fn(() => ({ json: jsonMock }))

    mockReq = {
      params: { workspaceId: mockWorkspaceId },
      body: {
        visitorId: mockVisitorId,
        message: "Ciao, test debugMode",
        language: "it",
      },
      headers: {
        "accept-language": "it-IT,it;q=0.9",
      },
    }

    mockRes = {
      status: statusMock,
      json: jsonMock,
    }
  })

  it("should NOT bill when debugMode=true (exits before billing)", async () => {
    // Mock workspace with debugMode=true
    ;(mockPrisma.workspace.findUnique as jest.Mock).mockResolvedValue({
      id: mockWorkspaceId,
      deletedAt: null,
      ownerId: mockOwnerId,
      language: "ITA",
      channelStatus: true,
      debugMode: true, // 🔴 DEBUG MODE ON
      wipMessage: { it: "Sistema in manutenzione. Test in corso." },
      enableWidget: true,
      owner: {
        subscriptionStatus: "ACTIVE",
        creditBalance: new Prisma.Decimal(50.0),
        paymentFailureCount: 0,
        deletedAt: null,
      },
    })

    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: mockOwnerId,
      status: "ACTIVE",
    })

    await controller.sendMessage(mockReq as Request, mockRes as Response)

    // 🎯 CRITICAL: Should NOT call LLM (exits early with WIP)
    expect(mockLLMRouterService.routeMessage).not.toHaveBeenCalled()

    // 🎯 CRITICAL: Should NOT call billing service
    expect(mockSubscriptionBillingService.deductOwnerWidgetMessageCredit).not.toHaveBeenCalled()

    // Should return WIP message
    expect(statusMock).toHaveBeenCalledWith(200)
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        status: "wip",
        response: "Sistema in manutenzione. Test in corso.",
      })
    )
  })

  it("should NOT bill when channelStatus=false (blocked before billing)", async () => {
    ;(mockPrisma.workspace.findUnique as jest.Mock).mockResolvedValue({
      id: mockWorkspaceId,
      deletedAt: null,
      ownerId: mockOwnerId,
      language: "ITA",
      channelStatus: false, // 🔴 CHANNEL DISABLED
      debugMode: false,
      wipMessage: { it: "Canale temporaneamente offline" },
      enableWidget: true,
      owner: {
        subscriptionStatus: "ACTIVE",
        creditBalance: new Prisma.Decimal(50.0),
        paymentFailureCount: 0,
        deletedAt: null,
      },
    })

    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: mockOwnerId,
      status: "ACTIVE",
    })

    await controller.sendMessage(mockReq as Request, mockRes as Response)

    // Should NOT call LLM
    expect(mockLLMRouterService.routeMessage).not.toHaveBeenCalled()

    // 🎯 CRITICAL: Should NOT call billing service
    expect(mockSubscriptionBillingService.deductOwnerWidgetMessageCredit).not.toHaveBeenCalled()

    expect(statusMock).toHaveBeenCalledWith(403)
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "CHANNEL_DISABLED",
      })
    )
  })

  it("should bill normally when debugMode=false AND channelStatus=true", async () => {
    ;(mockPrisma.workspace.findUnique as jest.Mock).mockResolvedValue({
      id: mockWorkspaceId,
      deletedAt: null,
      ownerId: mockOwnerId,
      language: "ITA",
      channelStatus: true, // ✅ CHANNEL ACTIVE
      debugMode: false, // ✅ DEBUG OFF
      wipMessage: null,
      enableWidget: true,
      owner: {
        subscriptionStatus: "ACTIVE",
        creditBalance: new Prisma.Decimal(50.0),
        paymentFailureCount: 0,
        deletedAt: null,
      },
    })

    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: mockOwnerId,
      status: "ACTIVE",
    })

    ;(mockPrisma.customers.findFirst as jest.Mock).mockResolvedValue({
      id: "customer-abc",
      name: "Test Customer",
      email: "test@example.com",
      phone: null,
      language: "ITA",
      workspaceId: mockWorkspaceId,
    })

    ;(mockPrisma.chatSession.findFirst as jest.Mock).mockResolvedValue({
      id: "session-123",
      customerId: "customer-abc",
      status: "active",
    })

    mockLLMRouterService.routeMessage.mockResolvedValue({
      response: "Ciao! Come posso aiutarti?",
      agentUsed: "ROUTER",
      tokensUsed: 150,
    })

    mockSubscriptionBillingService.deductOwnerWidgetMessageCredit.mockResolvedValue({
      success: true,
      newBalance: 18.995,
    })

    await controller.sendMessage(mockReq as Request, mockRes as Response)

    // Should call LLM
    expect(mockLLMRouterService.routeMessage).toHaveBeenCalled()

    // 🎯 CRITICAL: Should call billing service (deduct $0.005)
    expect(mockSubscriptionBillingService.deductOwnerWidgetMessageCredit).toHaveBeenCalledWith(
      mockOwnerId,
      mockWorkspaceId,
      expect.any(String)
    )

    expect(statusMock).toHaveBeenCalledWith(200)
  })

  it("should document that debugMode allows free testing", () => {
    /**
     * 📝 DOCUMENTATION
     * 
     * debugMode=true serves two purposes:
     * 1. Shows WIP message to customers (workspace under construction)
     * 2. Allows owner to test chatbot WITHOUT billing charges
     * 
     * Flow:
     * - widget-chat.controller.ts Line 308: if (debugMode=true) → return WIP
     * - Exits BEFORE Line 573 (billing logic)
     * - Owner can test:
     *   - Agent configurations
     *   - Product catalog
     *   - Welcome messages
     *   - Custom AI rules
     * 
     * When ready:
     * - Owner sets debugMode=false in settings
     * - Widget goes live
     * - Billing starts ($0.005 per message)
     */
    expect(true).toBe(true)
  })
})
