/**
 * Unit Tests: ChatEngine blocked customer handling
 * - Blocked customers should short-circuit without translation or message saves.
 */

const customerStore = new Map<string, any>()

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
  customers: {
    findFirst: jest.fn(async ({ where }) => {
      const customer = customerStore.get(where.id)
      if (!customer) return null
      if (customer.workspaceId !== where.workspaceId) return null
      return customer
    }),
  },
  conversationMessage: {
    create: jest.fn(async () => ({ id: "msg-1" })),
    update: jest.fn(async () => ({ id: "msg-1" })),
  },
} as const

import { ChatEngineService } from "../../../src/application/chat-engine/chat-engine.service"

describe("ChatEngine - Blocked Customer", () => {
  const testWorkspaceId = "test-workspace-blocked"
  const testCustomerId = "test-customer-blocked"

  beforeEach(() => {
    customerStore.clear()
    translationProcessMock.mockClear()
    ;(mockPrisma.customers.findFirst as jest.Mock).mockClear()
    ;(mockPrisma.conversationMessage.create as jest.Mock).mockClear()
  })

  it("should short-circuit blocked customers without saving messages", async () => {
    customerStore.set(testCustomerId, {
      id: testCustomerId,
      workspaceId: testWorkspaceId,
      isBlacklisted: true,
    })

    const chatEngine = new ChatEngineService(mockPrisma as any)
    const result = await chatEngine.routeMessage({
      message: "hello",
      customerId: testCustomerId,
      workspaceId: testWorkspaceId,
      customerLanguage: "it",
    })

    expect(result.isBlocked).toBe(true)
    expect(result.message).toBe("")
    expect(result.response).toBe("")
    expect(translationProcessMock).not.toHaveBeenCalled()
    expect(mockPrisma.conversationMessage.create).not.toHaveBeenCalled()
  })
})
