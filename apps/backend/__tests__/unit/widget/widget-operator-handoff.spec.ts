/**
 * Widget Operator Handoff — LLM Block Tests
 *
 * RULE 1: When activeChatbot=false (operator has taken over), the backend MUST
 * block the LLM entirely and return { activeChatbot: false, blocked: true }.
 * The widget must NOT show any bot response while an operator is active.
 *
 * RULE 2: Widget messages when activeChatbot=false MUST be relayed to the
 * operator's WhatsApp number via OperatorRelayService.relayCustomerMessageToOperator().
 * This closes the gap where widget customers' messages wouldn't reach the operator.
 *
 * SCENARIO: Customer asks for human operator → CF contactOperator fires →
 *   activeChatbot=false in DB. Customer sends another message → LLM must NOT respond,
 *   but message IS saved and relayed to operator WhatsApp.
 */

import { WidgetChatController } from "../../../src/interfaces/http/controllers/widget-chat.controller"
import { Request, Response } from "express"

// ─── Module mocks ─────────────────────────────────────────────────────────────
jest.mock("@echatbot/database", () => {
  const mockPrismaInstance = {
    workspace: { findUnique: jest.fn(), findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    customers: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    chatSession: { findFirst: jest.fn(), create: jest.fn() },
    conversationMessage: { count: jest.fn(), create: jest.fn() },
  }
  return {
    prisma: mockPrismaInstance,
    PrismaClient: jest.fn(() => mockPrismaInstance),
    AgentType: { ROUTER: "ROUTER" },
    Prisma: {
      Decimal: jest.fn((v: any) => ({ toFixed: () => String(v), toString: () => String(v) })),
    },
  }
})

jest.mock("../../../src/application/services/visitor-id.service", () => ({
  VisitorIdService: {
    validate: jest.fn(() => true),
    isExpired: jest.fn(() => false),
    getExpiryDate: jest.fn(() => new Date(Date.now() + 24 * 60 * 60 * 1000)),
  },
}))

jest.mock("../../../src/application/services/security-check.service", () => ({
  SecurityCheckService: {
    validateMessage: jest.fn(() =>
      Promise.resolve([
        { step: "rate_limit", passed: true },
        { step: "content_filter", passed: true },
      ])
    ),
  },
}))

// NOTE: `let` is used (not `const`) so the variable exists at the time the
// jest.mock factory closure captures it. The actual object is assigned in
// beforeEach, which runs before `new WidgetChatController()` is called.
let mockRouteMessage: jest.Mock
jest.mock("../../../src/services/llm-router.service", () => ({
  LLMRouterService: jest.fn().mockImplementation(() => ({
    routeMessage: (...args: any[]) => mockRouteMessage(...args),
  })),
}))

// Mock getChatEngine (controller uses this now)
let mockChatEngineRouteMessage: jest.Mock
jest.mock("../../../src/application/chat-engine", () => ({
  getChatEngine: jest.fn().mockImplementation(() => ({
    routeMessage: (...args: any[]) => mockChatEngineRouteMessage(...args),
  })),
}))

jest.mock("../../../src/application/services/subscription-billing.service", () => ({
  SubscriptionBillingService: jest.fn(() => ({
    deductOwnerWidgetMessageCredit: jest.fn().mockResolvedValue({ success: true, newBalance: 50 }),
  })),
}))

let mockCanProcessMessages: jest.Mock
jest.mock("../../../src/application/services/workspace-access.service", () => ({
  WorkspaceAccessService: jest.fn().mockImplementation(() => ({
    canProcessMessages: (...args: any[]) => mockCanProcessMessages(...args),
  })),
}))

jest.mock("../../../src/utils/welcome-message.handler", () => ({
  WelcomeMessageHandler: jest.fn(() => ({
    handleWelcomeMessage: jest.fn(() => Promise.resolve({ isWelcomeMessage: false })),
  })),
}))

jest.mock("../../../src/services/registration-prompt.service", () => ({
  registrationPromptService: {
    getPromptLevel: jest.fn().mockReturnValue(0),
    shouldBlockUser: jest.fn().mockReturnValue(false),
  },
}))

// RELAY TUNNEL: Mock OperatorRelayService to verify widget messages are relayed
let mockRelayCustomerMessageToOperator: jest.Mock
jest.mock("../../../src/application/services/operator-relay.service", () => ({
  OperatorRelayService: jest.fn().mockImplementation(() => ({
    relayCustomerMessageToOperator: (...args: any[]) =>
      mockRelayCustomerMessageToOperator(...args),
  })),
}))

// ─── Test setup ──────────────────────────────────────────────────────────────
const { prisma: mockPrisma } = jest.requireMock("@echatbot/database")

const WORKSPACE_ID = "workspace-123"
const VISITOR_ID = "visitor_1726262000000_abc123"
const OWNER_ID = "owner-456"
const CUSTOMER_ID = "customer-789"

describe("Widget sendMessage — Operator Handoff Guard", () => {
  let controller: WidgetChatController
  let jsonMock: jest.Mock
  let statusMock: jest.Mock
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new WidgetChatController()

    jsonMock = jest.fn()
    statusMock = jest.fn(() => ({ json: jsonMock }))
    mockRes = { status: statusMock, json: jsonMock }

    mockReq = {
      params: { workspaceId: WORKSPACE_ID },
      body: { visitorId: VISITOR_ID, message: "ciao", language: "en" },
      headers: {},
    }

    // Workspace active — includes all fields that the sendMessage guard checks
    ;(mockPrisma.workspace.findFirst as jest.Mock).mockResolvedValue({
      id: WORKSPACE_ID,
      deletedAt: null,
      channelStatus: true,
      enableWidget: true,     // REQUIRED: widget enabled check in controller
      ownerId: OWNER_ID,
      debugMode: false,
      language: "en",
      defaultLanguage: "en",
      widgetAutoSuggestionsEnabled: false,
      widgetQuickReplies: [],
      websiteUrl: null,          // null = allow all origins (skip origin check)
      allowedExternalLinks: null,
      wipMessage: null,
      welcomeMessage: null,
    })

    // Owner is active
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ status: "ACTIVE" })

    mockRouteMessage = jest.fn()
    mockChatEngineRouteMessage = jest.fn().mockResolvedValue({
      message: "Hello! How can I help?",
      response: "Hello! How can I help?",
      agentUsed: "ROUTER",
      tokensUsed: 100,
    })
    mockCanProcessMessages = jest.fn().mockResolvedValue({ canProcess: true })
    mockRelayCustomerMessageToOperator = jest.fn().mockResolvedValue(undefined)
  })

  it("BLOCKS LLM when activeChatbot=false (operator has taken over)", async () => {
    // SCENARIO: contactOperator CF already fired → activeChatbot=false in DB.
    // User sends a new message. LLM must NOT be called. Backend must return blocked signal.

    ;(mockPrisma.customers.findFirst as jest.Mock).mockResolvedValue({
      id: CUSTOMER_ID,
      workspaceId: WORKSPACE_ID,
      customId: VISITOR_ID,
      name: "Test User",
      language: "en",
      isActive: false,
      // CRITICAL: operator handoff was triggered — chatbot is off
      activeChatbot: false,
    })

    await controller.sendMessage(mockReq as Request, mockRes as Response)

    // RULE: LLM must NOT be called
    expect(mockChatEngineRouteMessage).not.toHaveBeenCalled()

    // RULE: Response must be 200 (not error) with activeChatbot:false + blocked:true
    expect(statusMock).toHaveBeenCalledWith(200)
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        activeChatbot: false,
        blocked: true,
      })
    )
  })

  it("ALLOWS LLM when activeChatbot=true (normal mode)", async () => {
    // SCENARIO: Normal mode — chatbot is active, LLM should respond.

    ;(mockPrisma.customers.findFirst as jest.Mock).mockResolvedValue({
      id: CUSTOMER_ID,
      workspaceId: WORKSPACE_ID,
      customId: VISITOR_ID,
      name: "Test User",
      language: "en",
      isActive: false,
      activeChatbot: true, // Chatbot active
    })

    ;(mockPrisma.chatSession.findFirst as jest.Mock).mockResolvedValue({
      id: "session-111",
      customerId: CUSTOMER_ID,
      status: "active",
    })
    ;(mockPrisma.conversationMessage.count as jest.Mock).mockResolvedValue(1)
    ;(mockPrisma.conversationMessage.create as jest.Mock).mockResolvedValue({})
    ;(mockPrisma.customers.findUnique as jest.Mock).mockResolvedValue({ activeChatbot: true })

    mockChatEngineRouteMessage.mockResolvedValue({
      response: "Hello! How can I help?",
      agentUsed: "ROUTER",
      tokensUsed: 10,
    })

    await controller.sendMessage(mockReq as Request, mockRes as Response)

    // RULE: LLM must be called
    expect(mockChatEngineRouteMessage).toHaveBeenCalled()
    expect(statusMock).toHaveBeenCalledWith(200)
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, response: "Hello! How can I help?" })
    )
  })

  it("BLOCKS LLM even when customer sends multiple messages in operator mode", async () => {
    // SCENARIO: Customer keeps sending messages — none should trigger LLM

    ;(mockPrisma.customers.findFirst as jest.Mock).mockResolvedValue({
      id: CUSTOMER_ID,
      workspaceId: WORKSPACE_ID,
      customId: VISITOR_ID,
      name: "Test User",
      language: "en",
      isActive: false,
      activeChatbot: false, // Operator mode
    })

    // Send 3 messages — all should be blocked
    for (let i = 0; i < 3; i++) {
      jsonMock.mockClear()
      statusMock.mockClear()
      statusMock.mockReturnValue({ json: jsonMock })
      await controller.sendMessage(mockReq as Request, mockRes as Response)

      expect(mockChatEngineRouteMessage).not.toHaveBeenCalled()
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ activeChatbot: false, blocked: true }))
    }
  })

  it("RELAYS widget message to operator WhatsApp when activeChatbot=false", async () => {
    // SCENARIO: Widget customer sends message while operator has taken over
    // RULE: Message saved to ConversationMessage (so operator sees it in backoffice)
    //       AND relayed to operator's WhatsApp number (gap fix — widget was missing this)
    // WHY THIS MATTERS: Without relay, widget customers' messages only appear in backoffice
    //   but the operator on WhatsApp would miss them entirely

    ;(mockPrisma.customers.findFirst as jest.Mock).mockResolvedValue({
      id: CUSTOMER_ID,
      workspaceId: WORKSPACE_ID,
      customId: VISITOR_ID,
      name: "Widget User",
      language: "en",
      isActive: false,
      activeChatbot: false, // Operator has taken over
    })

    // Active session exists so message can be saved
    ;(mockPrisma.chatSession.findFirst as jest.Mock).mockResolvedValue({
      id: "session-op-mode",
      customerId: CUSTOMER_ID,
      status: "active",
    })
    ;(mockPrisma.conversationMessage.create as jest.Mock).mockResolvedValue({})

    await controller.sendMessage(mockReq as Request, mockRes as Response)

    // RULE: LLM must NOT be called
    expect(mockChatEngineRouteMessage).not.toHaveBeenCalled()

    // RULE: Relay to operator WhatsApp must be called
    expect(mockRelayCustomerMessageToOperator).toHaveBeenCalledWith(
      WORKSPACE_ID,
      expect.objectContaining({ id: CUSTOMER_ID }),
      "ciao" // message from mockReq.body
    )
  })
})
