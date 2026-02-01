import { LLMRouterService } from "../../../src/services/llm-router.service"

const mockSafetyProcess = jest.fn().mockResolvedValue({
  translatedText: "Hola!",
  safe: true,
  tokensUsed: 5,
})
const mockSaveAssistantMessage = jest.fn()

jest.mock("../../../src/application/agents/SafetyTranslationAgent", () => ({
  SafetyTranslationAgent: jest.fn().mockImplementation(() => ({
    process: mockSafetyProcess,
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

  it("routes Widget system messages through SafetyTranslationAgent and saves history", async () => {
    /**
     * 🆕 UPDATED: Widget-only SafetyTranslationAgent (2025-01)
     * 
     * System messages on WIDGET channel should pass through SafetyTranslationAgent.
     * WhatsApp system messages SKIP SafetyTranslationAgent (scheduler handles).
     * 
     * This test verifies Widget channel behavior.
     */
    const prismaMock: any = {
      workspace: {
        findUnique: jest.fn().mockResolvedValue({
          id: "ws-1",
          sellsProductsAndServices: true,
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
      channel: "widget", // Widget channel: SafetyTranslationAgent applied
    })

    expect(mockSafetyProcess).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      response: "Messaggio di sistema",
      targetLanguage: "es",
      customerName: "Juan",
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
    expect(result.tokensUsed).toBe(5)
  })
})
