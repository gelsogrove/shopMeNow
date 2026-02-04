/**
 * Unit test: Informational workspace should force service intents to FAQ.
 */

const workspaceStore = new Map<string, any>()
const customerStore = new Map<string, any>()
const messageStore: Array<{ id: string; workspaceId: string; customerId: string; role: string; content: string }> = []
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
    findUnique: jest.fn(async ({ where }) => {
      return customerStore.get(where.id) || null
    }),
  },
  chatSession: {
    findFirst: jest.fn(async () => ({
      id: "mock-session",
      workspaceId: "info-workspace",
      customerId: "info-customer",
      status: "active",
    })),
  },
  blacklistedCustomers: {
    findUnique: jest.fn(async () => null), // Customer NOT blacklisted
  },
  agentConfig: {
    findFirst: jest.fn(async ({ where }) => {
      if (where.agentType === "CUSTOMER_SUPPORT") {
        return {
          id: "mock-faq-config",
          workspaceId: "info-workspace",
          agentType: "CUSTOMER_SUPPORT",
          systemPrompt: "Mock FAQ prompt",
          responseFormat: "FAQ_RESPONSE",
          isActive: true,
        }
      }
      return null
    }),
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
        role: data.role,
        content: data.content,
      })
      return { id }
    }),
    update: jest.fn(async () => ({ id: "mock-message" })),
  },
} as const

import { ChatEngineService } from "../../../src/application/chat-engine/chat-engine.service"

const loadForIntentMock = jest.fn(async () => ({
  type: "FAQ",
  faqs: [{ question: "Q1", answer: "A1" }],
}))

const responseBuilderMock = {
  build: jest.fn(() => ({
    type: "FAQ",
    data: { faqs: [{ question: "Q1", answer: "A1" }] },
    formatting: { showNumbers: false, showPrices: false, showTotal: false, groupByCategory: false, includeEmoji: false, maxItemsBeforeGroup: 5, showStock: false },
    context: { intentType: "ASK_FAQ", customerLanguage: "it", hasDiscount: false, discountPercent: 0 },
  })),
}

const formatterMock = {
  format: jest.fn(async () => ({ text: "FAQ RESPONSE", cached: true, tokensUsed: 0 })),
}

const optionsMappingServiceMock = {
  loadMapping: jest.fn(async () => null),
  clearPendingAction: jest.fn(async () => {}),
}

const conversationStateServiceMock = {
  getState: jest.fn(async () => null),
  setState: jest.fn(async () => {}),
}

describe("ChatEngine - Informational services routing", () => {
  const testWorkspaceId = "info-workspace"
  const testCustomerId = "info-customer"

  beforeEach(() => {
    workspaceStore.clear()
    customerStore.clear()
    messageStore.length = 0
    messageIdCounter = 1
    loadForIntentMock.mockClear()
    responseBuilderMock.build.mockClear()
    formatterMock.format.mockClear()
    translationProcessMock.mockClear()
    ;(mockPrisma.workspace.findUnique as jest.Mock).mockClear()
    ;(mockPrisma.customers.findFirst as jest.Mock).mockClear()
  })


})
