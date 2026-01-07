const workspaceStore = new Map<string, any>()
const customerStore = new Map<string, any>()

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
    findFirst: jest.fn(async () => ({
      id: "mock-session",
      workspaceId: "ws-1",
      customerId: "cust-1",
      status: "active",
    })),
  },
  conversationMessage: {
    count: jest.fn(async () => 1),
    create: jest.fn(async () => ({ id: "msg-1" })),
    update: jest.fn(async () => ({ id: "msg-1" })),
  },
  searchConversations: {
    findUnique: jest.fn(async () => null),
  },
} as const

jest.mock("@echatbot/database", () => ({
  prisma: mockPrisma,
  PrismaClient: jest.fn(),
  AgentType: {
    ROUTER: "ROUTER",
    CART_MANAGEMENT: "CART_MANAGEMENT",
    PRODUCT_SEARCH: "PRODUCT_SEARCH",
    ORDER_TRACKING: "ORDER_TRACKING",
    CUSTOMER_SUPPORT: "CUSTOMER_SUPPORT",
  },
}))

jest.mock("../../../src/services/conversation-manager.service", () => ({
  ConversationManager: jest.fn().mockImplementation(() => ({
    loadHistory: jest.fn(async () => []),
  })),
}))

const saveMappingMock = jest.fn(async () => {})
jest.mock("../../../src/application/chat-engine/options-mapping.service", () => ({
  getOptionsMappingService: jest.fn(() => ({
    loadMapping: jest.fn(async () => null),
    saveMapping: saveMappingMock,
  })),
  OptionsMappingService: {
    cleanLabel: (value: string) => value,
  },
}))

jest.mock("../../../src/application/data-loader", () => ({
  getDataLoader: jest.fn(() => ({
    loadForIntent: jest.fn(async () => ({
      type: "CATEGORIES",
      items: [
        { number: 1, name: "Bevande" },
        { number: 2, name: "Formaggi" },
      ],
    })),
  })),
}))

jest.mock("../../../src/application/response-builder", () => ({
  getResponseBuilder: jest.fn(() => ({
    build: jest.fn(() => ({
      type: "CATEGORY_LIST",
      data: { items: [{ number: 1, name: "Bevande" }] },
    })),
  })),
}))

jest.mock("../../../src/application/llm-formatter", () => ({
  getLLMFormatter: jest.fn(() => ({
    format: jest.fn(async () => ({
      text: "1. Bevande\n2. Formaggi",
      cached: true,
      tokensUsed: 0,
    })),
  })),
}))

jest.mock("../../../src/services/message-preprocessor.service", () => ({
  messagePreprocessorService: {
    process: jest.fn(() => ({
      isShortInput: true,
      inputType: "number",
      extractedNumber: 5,
      extractedQuantity: null,
      enrichedMessage: "5",
    })),
  },
}))

jest.mock("../../../src/utils/welcome-message.handler", () => ({
  WelcomeMessageHandler: jest.fn().mockImplementation(() => ({
    handleWelcomeMessage: jest.fn(async () => ({
      isWelcomeMessage: false,
    })),
  })),
}))

jest.mock("../../../src/services/router-orchestration.service", () => ({
  RouterOrchestrationService: jest.fn().mockImplementation(() => ({})),
}))

jest.mock("../../../src/application/chat-engine/conversation-state.service", () => ({
  ConversationStateService: jest.fn().mockImplementation(() => ({
    getState: jest.fn(async () => ({ state: "IDLE", stateEnteredAt: new Date().toISOString() })),
    setState: jest.fn(async () => {}),
  })),
  ConversationState: { IDLE: "IDLE" },
}))

jest.mock("../../../src/application/agents/SafetyTranslationAgent", () => ({
  SafetyTranslationAgent: jest.fn().mockImplementation(() => ({
    process: jest.fn(async ({ response }) => ({
      safe: true,
      translatedText: response,
      tokensUsed: 0,
    })),
  })),
}))

jest.mock("../../../src/application/services/link-replacement.service", () => ({
  LinkReplacementService: jest.fn().mockImplementation(() => ({
    replaceTokens: jest.fn(async ({ response }) => ({
      success: true,
      response,
    })),
  })),
}))

import { ChatEngineService } from "../../../src/application/chat-engine/chat-engine.service"

describe.skip("ChatEngine - Expired numeric selection", () => {
  beforeEach(() => {
    workspaceStore.clear()
    customerStore.clear()
    saveMappingMock.mockClear()
  })

  it("republishes categories with welcome-back message when numeric selection has no mapping", async () => {
    workspaceStore.set("ws-1", {
      id: "ws-1",
      name: "BellItalia VIP",
      sellsProductsAndServices: true,
      hasSalesAgents: false,
      hasHumanSupport: true,
      adminEmail: "hello@echatbot.ai",
      welcomeMessage: {},
      botIdentityResponse: "Bot",
    })
    customerStore.set("cust-1", {
      id: "cust-1",
      workspaceId: "ws-1",
      name: "Sara",
      email: "sara@example.com",
      language: "it",
      discount: 0,
    })

    const chatEngine = new ChatEngineService(mockPrisma as any)
    const result = await (chatEngine as any).processMessageInternal({
      workspaceId: "ws-1",
      customerId: "cust-1",
      conversationId: "conv-1",
      message: "5",
      customerLanguage: "it",
      customerName: "Sara",
      customerDiscount: 0,
    })

    expect(result.message).toContain("Bentornato Sara")
    expect(result.message).toContain("Bevande")
    expect(saveMappingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        listType: "CATEGORIES",
      })
    )
  })
})
