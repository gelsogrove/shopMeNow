import { LLMRouterService } from "../../../src/services/llm-router.service"

// 🔧 FIX: jest.mock() is hoisted BEFORE const declarations.
// We must define mock fns inside the factory or use lazy references.
const mockTranslationProcess = jest.fn().mockResolvedValue({
  message: "Hola!",
  translated: true,
  tokensUsed: 5,
})
const mockSecurityProcess = jest.fn().mockResolvedValue({
  message: "Hola!",
  safe: true,
  tokensUsed: 3,
})
const mockSaveAssistantMessage = jest.fn()

jest.mock("../../../src/application/agents/TranslationAgent", () => ({
  TranslationAgent: jest.fn().mockImplementation(() => ({
    process: (...args: any[]) => mockTranslationProcess(...args),
  })),
}))

jest.mock("../../../src/application/agents/SecurityAgent", () => ({
  SecurityAgent: jest.fn().mockImplementation(() => ({
    process: (...args: any[]) => mockSecurityProcess(...args),
  })),
}))

jest.mock("../../../src/services/conversation-manager.service", () => ({
  ConversationManager: jest.fn().mockImplementation(() => ({
    saveAssistantMessage: mockSaveAssistantMessage,
  })),
}))

jest.mock("../../../src/application/services/template-loader.service", () => ({
  TemplateLoaderService: {
    getInstance: jest.fn(() => ({
      loadAndRenderTemplate: jest.fn().mockResolvedValue(""),
    })),
  },
}))

describe("LLMRouterService - System message fast path", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("routes Widget system messages through Translation + Widget Security layers and saves history", async () => {
    /**
     * 🆕 UPDATED: Translation + Widget Security (2026)
     *
     * System messages on WIDGET channel should pass through Translation Layer
     * and then Widget Security Layer. WhatsApp skips Widget Security.
     * 
     * This test verifies Widget channel behavior.
     */
    const prismaMock: any = {
      workspace: {
        findUnique: jest.fn().mockResolvedValue({
          id: "ws-1",
          channelMode: 'ECOMMERCE' as any,
        }),
      },
      customers: {
        findFirst: jest.fn().mockImplementation(({ select }: any) => {
          if (select?.discount) {
            return { discount: 0 }
          }
          if (select?.isActive) {
            return { isActive: true }
          }
          return { discount: 0, isActive: true }
        }),
      },
    }

    const service = new LLMRouterService(prismaMock)

    const result = await service.routeMessage({
      workspaceId: "ws-1",
      customerId: "cust-1",
      conversationId: "conv-1",
      messageId: "msg-1",
      message: "Messaggio di sistema",
      customerLanguage: "es",
      customerName: "Juan",
      isSystemMessage: true,
      channel: "widget", // Widget channel: Security layer applied
    })

    expect(mockTranslationProcess).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      message: "Messaggio di sistema",
      targetLanguage: "es",
      customerName: "Juan",
      customerId: "cust-1",
      channel: "widget",
    })
    expect(mockSecurityProcess).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      message: "Hola!",
      customerName: "Juan",
      customerId: "cust-1",
    })
    expect(mockSaveAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        customerId: "cust-1",
        conversationId: "conv-1",
        content: "Hola!",
        agentType: "SYSTEM_NOTIFICATION",
      })
    )
    expect(result.response).toBe("Hola!")
    expect(result.agentUsed).toBe("SYSTEM_NOTIFICATION")
    expect(result.tokensUsed).toBe(8)
  })
})
