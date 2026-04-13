/**
 * Unit Tests: Welcome Message DebugInfo
 */

const workspaceStore = new Map<string, any>()
const customerStore = new Map<string, any>()
const messageStore: Array<{ id: string; workspaceId: string; customerId: string; conversationId: string; role: string; content: string }> = []
let messageIdCounter = 1

const translationProcessMock = jest.fn(async ({ message, targetLanguage }) => ({
  message,
  translated: false,
  tokensUsed: 0,
  targetLanguage,
  model: "mock",
}))

jest.mock("../../../src/application/agents/TranslationAgent", () => ({
  TranslationAgent: jest.fn().mockImplementation(() => ({
    process: translationProcessMock,
  })),
}))

const mockPrisma = {
  workspace: {
    findUnique: jest.fn(async ({ where }) => workspaceStore.get(where.id) || null),
  },
  customers: {
    findFirst: jest.fn(async ({ where }) => {
      const customer = customerStore.get(where.id)
      if (!customer) return null
      if (customer.workspaceId !== where.workspaceId) return null
      return customer
    }),
  },
  chatSession: {
    findMany: jest.fn(async () => []),
    findFirst: jest.fn(async () => null),
  },
  conversationMessage: {
    count: jest.fn(async ({ where }) => {
      return messageStore.filter(
        (message) =>
          message.workspaceId === where.workspaceId &&
          message.customerId === where.customerId &&
          message.role === where.role
      ).length
    }),
    create: jest.fn(async ({ data }) => {
      const id = `msg-${messageIdCounter++}`
      messageStore.push({
        id,
        workspaceId: data.workspaceId,
        customerId: data.customerId,
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
      })
      return { id }
    }),
    update: jest.fn(async () => ({ id: "mock-message" })),
  },
} as const

import { ChatEngineService } from "../../../src/application/chat-engine/chat-engine.service"

describe("ChatEngine - Welcome DebugInfo", () => {
  const testWorkspaceId = "test-workspace-welcome-debug"
  const testCustomerId = "test-customer-welcome-debug"

  beforeEach(() => {
    workspaceStore.clear()
    customerStore.clear()
    messageStore.length = 0
    messageIdCounter = 1
    translationProcessMock.mockClear()
    ;(mockPrisma.conversationMessage.update as jest.Mock).mockClear()
  })

  it("should include debugInfo for welcome message", async () => {
    workspaceStore.set(testWorkspaceId, {
      id: testWorkspaceId,
      name: "Test Workspace",
      channelMode: 'ECOMMERCE' as any,
      welcomeMessage: "Benvenuto!",
      chatbotName: "AI Assistant",
      botIdentityResponse: "I am an AI assistant",
      customAiRules: "",
      address: "123 Test St",
      toneOfVoice: "professional",
    })

    customerStore.set(testCustomerId, {
      id: testCustomerId,
      workspaceId: testWorkspaceId,
      isBlacklisted: false,
      name: "Test Customer",
      email: "test@example.com",
      phone: "+1234567890",
      discount: 0,
      isActive: true,
      language: "it",
      company: "",
      push_notifications_consent: false,
    })

    const chatEngine = new ChatEngineService(mockPrisma as any)

    const result = await chatEngine.routeMessage({
      message: "ciao",
      customerId: testCustomerId,
      workspaceId: testWorkspaceId,
      customerLanguage: "it",
    })

    expect(result.debugInfo?.steps?.length).toBeGreaterThan(0)
    expect(mockPrisma.conversationMessage.update).toHaveBeenCalled()
    const updateArgs = (mockPrisma.conversationMessage.update as jest.Mock).mock.calls[0][0]
    expect(updateArgs.data.debugInfo).toBeDefined()
  })
})
