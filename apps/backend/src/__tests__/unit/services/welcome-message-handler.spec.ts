import { WelcomeMessageHandler } from "../../../utils/welcome-message.handler"

describe("WelcomeMessageHandler", () => {
  const workspaceId = "workspace-123"
  const customerId = "customer-123"
  const conversationId = "conversation-123"
  const userMessage = "ciao"

  let prisma: any
  let handler: WelcomeMessageHandler

  beforeEach(() => {
    prisma = {
      conversationMessage: {
        count: jest.fn(),
        create: jest.fn(),
      },
      workspace: {
        findUnique: jest.fn(),
      },
      customers: {
        findFirst: jest.fn(),
      },
    }

    handler = new WelcomeMessageHandler(prisma)
    jest.clearAllMocks()
  })

  it("returns welcome message on first user message and saves history", async () => {
    prisma.conversationMessage.count.mockResolvedValue(0)
    prisma.workspace.findUnique.mockResolvedValue({
      id: workspaceId,
      name: "Test Workspace",
      welcomeMessage: {
        it: "Benvenuto! Come posso aiutarti?",
        en: "Welcome! How can I help you?",
      },
    })
    prisma.customers.findFirst.mockResolvedValue({
      id: customerId,
      name: "Test Customer",
      email: "test@test.com",
      phone: "+1234567890",
      discount: 0,
      isActive: true,
      language: "it",
      company: "Test Company",
      push_notifications_consent: false,
      sales: null,
    })
    prisma.conversationMessage.create
      .mockResolvedValueOnce({ id: "user-msg-id" })
      .mockResolvedValueOnce({ id: "assistant-msg-id" })

    const result = await handler.handleWelcomeMessage({
      customerId,
      workspaceId,
      customerLanguage: "it",
      customerMessage: userMessage,
      conversationId,
    })

    expect(result.isWelcomeMessage).toBe(true)
    expect(result.welcomeText).toBe("Benvenuto! Come posso aiutarti?")
    expect(result.assistantMessageId).toBe("assistant-msg-id")
    expect(prisma.conversationMessage.create).toHaveBeenCalledTimes(2)
    expect(prisma.conversationMessage.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId,
          customerId,
          conversationId,
          role: "user",
          content: userMessage,
        }),
      })
    )
    expect(prisma.conversationMessage.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId,
          customerId,
          conversationId,
          role: "assistant",
          content: "Benvenuto! Come posso aiutarti?",
        }),
      })
    )
  })

  it("skips welcome message when user already has messages", async () => {
    prisma.conversationMessage.count.mockResolvedValue(2)

    const result = await handler.handleWelcomeMessage({
      customerId,
      workspaceId,
      customerLanguage: "it",
      customerMessage: userMessage,
      conversationId,
    })

    expect(result.isWelcomeMessage).toBe(false)
    expect(prisma.workspace.findUnique).not.toHaveBeenCalled()
    expect(prisma.conversationMessage.create).not.toHaveBeenCalled()
  })

  it("skips welcome message when no welcomeMessage is configured", async () => {
    prisma.conversationMessage.count.mockResolvedValue(0)
    prisma.workspace.findUnique.mockResolvedValue({
      welcomeMessage: null,
    })

    const result = await handler.handleWelcomeMessage({
      customerId,
      workspaceId,
      customerLanguage: "it",
      customerMessage: userMessage,
      conversationId,
    })

    expect(result.isWelcomeMessage).toBe(false)
    expect(prisma.conversationMessage.create).not.toHaveBeenCalled()
  })

  // E0a — enableWelcomeMessage flag tests
  it("E0a: skips welcome message when enableWelcomeMessage=false", async () => {
    // SCENARIO: Admin explicitly disables welcome message via settings toggle
    // RULE: enableWelcomeMessage===false → return {isWelcomeMessage: false} even if welcomeMessage is set
    prisma.conversationMessage.count.mockResolvedValue(0)
    prisma.workspace.findUnique.mockResolvedValue({
      welcomeMessage: "Welcome!",
      enableWelcomeMessage: false,
    })

    const result = await handler.handleWelcomeMessage({
      customerId,
      workspaceId,
      customerLanguage: "en",
      customerMessage: userMessage,
      conversationId,
    })

    expect(result.isWelcomeMessage).toBe(false)
    expect(prisma.conversationMessage.create).not.toHaveBeenCalled()
  })

  it("E0a: shows welcome message when enableWelcomeMessage=true (explicit)", async () => {
    // SCENARIO: Admin explicitly enables welcome message
    // RULE: enableWelcomeMessage===true → behave as normal (show welcome if message set)
    prisma.conversationMessage.count.mockResolvedValue(0)
    prisma.workspace.findUnique.mockResolvedValue({
      welcomeMessage: "Hello! How can I help?",
      enableWelcomeMessage: true,
      chatbotName: "Bot",
      botIdentityResponse: null,
      customAiRules: null,
    })
    prisma.customers.findFirst.mockResolvedValue({
      id: customerId,
      name: "Test",
      email: "t@t.com",
      phone: "+1",
      discount: 0,
      isActive: true,
      language: "en",
      company: null,
      push_notifications_consent: false,
      sales: null,
    })
    prisma.conversationMessage.create
      .mockResolvedValueOnce({ id: "u1" })
      .mockResolvedValueOnce({ id: "a1" })

    const result = await handler.handleWelcomeMessage({
      customerId,
      workspaceId,
      customerLanguage: "en",
      customerMessage: userMessage,
      conversationId,
    })

    expect(result.isWelcomeMessage).toBe(true)
  })

  it("E0a: shows welcome message when enableWelcomeMessage is undefined (default=true)", async () => {
    // SCENARIO: Legacy workspace without enableWelcomeMessage field in DB response
    // RULE: undefined is treated as true (default), so welcome message is shown
    prisma.conversationMessage.count.mockResolvedValue(0)
    prisma.workspace.findUnique.mockResolvedValue({
      welcomeMessage: "Hello!",
      enableWelcomeMessage: undefined, // field not present (legacy)
      chatbotName: "Bot",
      botIdentityResponse: null,
      customAiRules: null,
    })
    prisma.customers.findFirst.mockResolvedValue({
      id: customerId,
      name: "Test",
      email: "t@t.com",
      phone: "+1",
      discount: 0,
      isActive: true,
      language: "en",
      company: null,
      push_notifications_consent: false,
      sales: null,
    })
    prisma.conversationMessage.create
      .mockResolvedValueOnce({ id: "u2" })
      .mockResolvedValueOnce({ id: "a2" })

    const result = await handler.handleWelcomeMessage({
      customerId,
      workspaceId,
      customerLanguage: "en",
      customerMessage: userMessage,
      conversationId,
    })

    expect(result.isWelcomeMessage).toBe(true)
  })
})
