import { WidgetChatController } from "../../../src/interfaces/http/controllers/widget-chat.controller"
import { prisma, AgentType } from "@echatbot/database"
import { WelcomeMessageHandler } from "../../../src/utils/welcome-message.handler"
import { SecurityCheckService } from "../../../src/application/services/security-check.service"

jest.mock("@echatbot/database", () => {
  const mockPrisma = {
    workspace: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    customers: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    chatSession: { findFirst: jest.fn(), create: jest.fn() },
    conversationMessage: { count: jest.fn(), create: jest.fn() },
  }
  return {
    prisma: mockPrisma,
    PrismaClient: jest.fn(),
    AgentType: { ROUTER: "ROUTER" },
  }
})

jest.mock("../../../src/application/services/security-check.service", () => ({
  SecurityCheckService: {
    validateMessage: jest.fn(),
  },
}))

jest.mock("../../../src/application/services/visitor-id.service", () => ({
  VisitorIdService: {
    validate: jest.fn().mockReturnValue(true),
    isExpired: jest.fn().mockReturnValue(false),
    getExpiryDate: jest.fn().mockReturnValue(new Date(Date.now() + 3600_000)),
  },
}))

jest.mock("../../../src/services/llm-router.service", () => ({
  LLMRouterService: jest.fn().mockImplementation(() => ({
    routeMessage: jest.fn().mockResolvedValue({
      response: "LLM RESPONSE",
      agentUsed: "ROUTER",
      tokensUsed: 1,
    }),
  })),
}))

describe("WidgetChatController - welcome flow", () => {
  const controller = new WidgetChatController()
  const mockHandleWelcome = jest.spyOn(
    WelcomeMessageHandler.prototype,
    "handleWelcomeMessage"
  )

  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
      id: "ws-1",
      deletedAt: null,
      channelStatus: true,
      ownerId: "owner-1",
      language: "it",
      debugMode: false,
      wipMessage: null,
      enableWidget: true,
    })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "owner-1",
      status: "ACTIVE",
    })
    ;(SecurityCheckService.validateMessage as jest.Mock).mockResolvedValue([
      { step: "RATE_LIMIT", passed: true },
      { step: "CONTENT_SAFETY", passed: true },
    ])
    ;(prisma.customers.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.customers.create as jest.Mock).mockResolvedValue({
      id: "cust-1",
      workspaceId: "ws-1",
      customId: "visitor_1726262000000_abc123",
      language: "it",
      name: "Visitor",
    })
    ;(prisma.chatSession.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.chatSession.create as jest.Mock).mockResolvedValue({
      id: "sess-1",
    })
    ;(prisma.conversationMessage.count as jest.Mock).mockResolvedValue(0)
    ;(prisma.conversationMessage.create as jest.Mock).mockResolvedValue({})
    mockHandleWelcome.mockResolvedValue({
      isWelcomeMessage: false,
    })
  })

  it("skips welcome for widget channel and proceeds to LLM", async () => {
    const req: any = {
      params: { workspaceId: "ws-1" },
      body: {
        visitorId: "visitor_1726262000000_abc123",
        message: "ciao",
        language: "it",
        sessionId: null,
      },
      headers: {},
    }

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }

    await controller.sendMessage(req, res)

    expect(mockHandleWelcome).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "cust-1",
        workspaceId: "ws-1",
        channel: "widget",
      })
    )
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        response: "LLM RESPONSE",
        status: "ready",
      })
    )
    expect(prisma.conversationMessage.create).toHaveBeenCalled()
  })
})
