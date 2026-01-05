/**
 * Unit Tests: Welcome Message Logic
 * 
 * Tests the first-message detection and welcome message delivery:
 * - First message → Returns welcome message WITHOUT calling LLM
 * - Second message → Goes through normal LLM processing
 * - Multilingual support (it, en, es, pt)
 * - Edge cases (missing language, fallback to Italian)
 * 
 * BUG FIX: Count from conversationMessage table (not message table)
 */

const workspaceStore = new Map<string, any>()
const customerStore = new Map<string, any>()
const chatSessionStore = new Map<string, any>()
const messageStore: Array<{
  id: string
  workspaceId: string
  customerId: string
  conversationId: string
  role: "user" | "assistant"
  content: string
}> = []
let messageIdCounter = 1

const mockPrisma = {
  workspace: {
    upsert: jest.fn(async ({ where, create, update }) => {
      const existing = workspaceStore.get(where.id)
      const next = existing ? { ...existing, ...update } : { ...create }
      workspaceStore.set(where.id, next)
      return next
    }),
    create: jest.fn(async ({ data }) => {
      workspaceStore.set(data.id, { ...data })
      return data
    }),
    findUnique: jest.fn(async ({ where }) => {
      return workspaceStore.get(where.id) || null
    }),
    delete: jest.fn(async ({ where }) => {
      workspaceStore.delete(where.id)
      return { id: where.id }
    }),
  },
  customers: {
    upsert: jest.fn(async ({ where, create, update }) => {
      const existing = customerStore.get(where.id)
      const next = existing ? { ...existing, ...update } : { ...create }
      customerStore.set(where.id, next)
      return next
    }),
    create: jest.fn(async ({ data }) => {
      customerStore.set(data.id, { ...data })
      return data
    }),
    update: jest.fn(async ({ where, data }) => {
      const existing = customerStore.get(where.id)
      const next = { ...existing, ...data }
      customerStore.set(where.id, next)
      return next
    }),
    deleteMany: jest.fn(async ({ where }) => {
      for (const [id, customer] of customerStore.entries()) {
        if (customer.workspaceId === where.workspaceId) {
          customerStore.delete(id)
        }
      }
      return { count: 0 }
    }),
  },
  chatSession: {
    upsert: jest.fn(async ({ where, create, update }) => {
      const existing = chatSessionStore.get(where.id)
      const next = existing ? { ...existing, ...update } : { ...create }
      chatSessionStore.set(where.id, next)
      return next
    }),
    create: jest.fn(async ({ data }) => {
      chatSessionStore.set(data.id, { ...data })
      return data
    }),
    findFirst: jest.fn(async () => null),
    deleteMany: jest.fn(async ({ where }) => {
      for (const [id, session] of chatSessionStore.entries()) {
        if (session.workspaceId === where.workspaceId) {
          chatSessionStore.delete(id)
        }
      }
      return { count: 0 }
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
        role: data.role,
        content: data.content,
        workspaceId: data.workspaceId,
        customerId: data.customerId,
        conversationId: data.conversationId,
      })
      return { id }
    }),
    update: jest.fn(async () => ({ id: "mock-message" })),
    deleteMany: jest.fn(async ({ where }) => {
      for (let index = messageStore.length - 1; index >= 0; index -= 1) {
        if (messageStore[index].workspaceId === where.workspaceId) {
          messageStore.splice(index, 1)
        }
      }
      return { count: 0 }
    }),
  },
  searchConversations: {
    findUnique: jest.fn(async () => null),
  },
}

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

jest.mock("../../src/services/conversation-manager.service", () => {
  return {
    ConversationManager: class {
      constructor() {}
      async loadHistory() {
        return []
      }
      async saveUserMessage(params: {
        workspaceId: string
        customerId: string
        conversationId: string
        content: string
      }) {
        messageStore.push({
          id: `msg-${messageIdCounter++}`,
          role: "user",
          content: params.content,
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          conversationId: params.conversationId,
        })
      }
      async saveAssistantMessage(params: {
        workspaceId: string
        customerId: string
        conversationId: string
        content: string
      }) {
        const id = `msg-${messageIdCounter++}`
        messageStore.push({
          id,
          role: "assistant",
          content: params.content,
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          conversationId: params.conversationId,
        })
        return id
      }
    },
  }
})

jest.mock("../../src/application/agents/TranslationAgent", () => ({
  TranslationAgent: jest.fn().mockImplementation(() => ({
    process: jest.fn(async ({ message, targetLanguage }) => ({
      message,
      translated: false,
      tokensUsed: 0,
      targetLanguage,
      model: "mock",
    })),
  })),
}))

import { ChatEngineService } from "../../src/application/chat-engine/chat-engine.service"
import { ConversationManager } from "../../src/services/conversation-manager.service"

const makeChatEngine = (intentType: string = "GREETING") => {
  const chatEngine = new ChatEngineService(mockPrisma as any)
  ;(chatEngine as any).intentParser = {
    parse: jest.fn().mockResolvedValue({
      intent: { type: intentType },
      confidence: "HIGH",
      source: "PATTERN",
      processingTimeMs: 0,
    }),
  }
  return chatEngine
}

describe("ChatEngine - Welcome Message Logic", () => {
  const testWorkspaceId = "test-workspace-welcome"
  const testCustomerId = "test-customer-welcome"
  const testConversationId = "test-conversation-welcome"

  beforeAll(async () => {
    // Create test workspace with multilingual welcome message
    await mockPrisma.workspace.upsert({
      where: { id: testWorkspaceId },
      create: {
        id: testWorkspaceId,
        name: "Test Workspace Welcome",
        sellsProductsAndServices: true,
        welcomeMessage: {
          it: "Benvenuto! Sono il tuo assistente AI.",
          en: "Welcome! I'm your AI assistant.",
          es: "¡Bienvenido! Soy tu asistente de IA.",
          pt: "Bem-vindo! Sou o seu assistente de IA.",
        },
      },
      update: {
        welcomeMessage: {
          it: "Benvenuto! Sono il tuo assistente AI.",
          en: "Welcome! I'm your AI assistant.",
          es: "¡Bienvenido! Soy tu asistente de IA.",
          pt: "Bem-vindo! Sou o seu assistente de IA.",
        },
      },
    })

    // Create test customer
    await mockPrisma.customers.upsert({
      where: { id: testCustomerId },
      create: {
        id: testCustomerId,
        workspaceId: testWorkspaceId,
        phone: "+1234567890",
        name: "Test Customer",
        language: "en", // English customer
      },
      update: {
        language: "en",
      },
    })

    // Create chat session
    await mockPrisma.chatSession.upsert({
      where: { id: testConversationId },
      create: {
        id: testConversationId,
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        status: "active",
      },
      update: {
        status: "active",
      },
    })
  })

  afterAll(async () => {
    // Cleanup: Delete all test data
    await mockPrisma.conversationMessage.deleteMany({
      where: { workspaceId: testWorkspaceId },
    })
    await mockPrisma.chatSession.deleteMany({
      where: { workspaceId: testWorkspaceId },
    })
    await mockPrisma.customers.deleteMany({
      where: { workspaceId: testWorkspaceId },
    })
    await mockPrisma.workspace.delete({
      where: { id: testWorkspaceId },
    })
    // Don't disconnect - let Jest handle it
  })

  beforeEach(async () => {
    // Clear conversation messages before each test
    await mockPrisma.conversationMessage.deleteMany({
      where: { workspaceId: testWorkspaceId },
    })
  })

  describe("First Message Detection", () => {
    it("should return welcome message on first interaction (count=0)", async () => {
      const chatEngine = makeChatEngine()

      const result = await chatEngine.routeMessage({
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        conversationId: testConversationId,
        message: "Ciao",
        customerLanguage: "en",
        customerName: "Test Customer",
      })

      // Should return welcome message
      expect(result.response).toBe("Welcome! I'm your AI assistant.")
      expect(result.agentUsed).toBe("WELCOME")
      expect(result.tokensUsed).toBe(0) // No LLM call
      expect(result.llmUsed).toBeUndefined()
    })

    it("should NOT return welcome message on second interaction (count>0)", async () => {
      const chatEngine = makeChatEngine()
      const conversationManager = new ConversationManager(mockPrisma as any)

      // Simulate first message already sent (save to conversationMessage)
      await conversationManager.saveUserMessage({
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        conversationId: testConversationId,
        content: "Ciao",
      })

      await conversationManager.saveAssistantMessage({
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        conversationId: testConversationId,
        content: "Welcome! I'm your AI assistant.",
        agentType: "WELCOME",
      })

      // Now send second message
      const result = await chatEngine.routeMessage({
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        conversationId: testConversationId,
        message: "Mostra i prodotti",
        customerLanguage: "it",
        customerName: "Test Customer",
      })

      // Should NOT return welcome message (should go through normal LLM flow)
      expect(result.response).not.toBe("Welcome! I'm your AI assistant.")
      expect(result.agentUsed).not.toBe("WELCOME")
      expect(result.agentUsed).not.toBe("WELCOME")
    })
  })

  describe("Multilingual Welcome Message", () => {
    it("should return Italian welcome message for Italian customer", async () => {
      // Update customer language to Italian
      await mockPrisma.customers.update({
        where: { id: testCustomerId },
        data: { language: "it" },
      })

      const chatEngine = makeChatEngine()

      const result = await chatEngine.routeMessage({
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        conversationId: testConversationId,
        message: "Ciao",
        customerLanguage: "it",
        customerName: "Test Customer",
      })

      expect(result.response).toBe("Benvenuto! Sono il tuo assistente AI.")
      expect(result.agentUsed).toBe("WELCOME")
    })

    it("should return Spanish welcome message for Spanish customer", async () => {
      await mockPrisma.customers.update({
        where: { id: testCustomerId },
        data: { language: "es" },
      })

      const chatEngine = makeChatEngine()

      const result = await chatEngine.routeMessage({
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        conversationId: testConversationId,
        message: "Hola",
        customerLanguage: "es",
        customerName: "Test Customer",
      })

      expect(result.response).toBe("¡Bienvenido! Soy tu asistente de IA.")
      expect(result.agentUsed).toBe("WELCOME")
    })

    it("should return Portuguese welcome message for Portuguese customer", async () => {
      await mockPrisma.customers.update({
        where: { id: testCustomerId },
        data: { language: "pt" },
      })

      const chatEngine = makeChatEngine()

      const result = await chatEngine.routeMessage({
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        conversationId: testConversationId,
        message: "Olá",
        customerLanguage: "pt",
        customerName: "Test Customer",
      })

      expect(result.response).toBe("Bem-vindo! Sou o seu assistente de IA.")
      expect(result.agentUsed).toBe("WELCOME")
    })

    it("should fallback to Italian if customer language not in welcomeMessage", async () => {
      await mockPrisma.customers.update({
        where: { id: testCustomerId },
        data: { language: "fr" }, // French not configured
      })

      const chatEngine = makeChatEngine()

      const result = await chatEngine.routeMessage({
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        conversationId: testConversationId,
        message: "Bonjour",
        customerLanguage: "fr",
        customerName: "Test Customer",
      })

      // Should fallback to Italian (first fallback)
      expect(result.response).toBe("Benvenuto! Sono il tuo assistente AI.")
      expect(result.agentUsed).toBe("WELCOME")
    })
  })

  describe("Edge Cases", () => {
    it("should handle string-format welcomeMessage (legacy)", async () => {
      // Create workspace with string welcomeMessage
      const legacyWorkspaceId = "test-workspace-legacy"
      await mockPrisma.workspace.create({
        data: {
          id: legacyWorkspaceId,
          name: "Legacy Workspace",
          sellsProductsAndServices: true,
          welcomeMessage: "Simple welcome message", // String format
        },
      })

      const legacyCustomerId = "test-customer-legacy"
      await mockPrisma.customers.create({
        data: {
          id: legacyCustomerId,
          workspaceId: legacyWorkspaceId,
          phone: "+9876543210",
          name: "Legacy Customer",
          language: "en",
        },
      })

      const legacyConversationId = "test-conversation-legacy"
      await mockPrisma.chatSession.create({
        data: {
          id: legacyConversationId,
          workspaceId: legacyWorkspaceId,
          customerId: legacyCustomerId,
          status: "active",
        },
      })

      const chatEngine = makeChatEngine()

      const result = await chatEngine.routeMessage({
        workspaceId: legacyWorkspaceId,
        customerId: legacyCustomerId,
        conversationId: legacyConversationId,
        message: "Hello",
        customerLanguage: "en",
        customerName: "Legacy Customer",
      })

      expect(result.response).toBe("Simple welcome message")
      expect(result.agentUsed).toBe("WELCOME")

      // Cleanup
      await mockPrisma.conversationMessage.deleteMany({
        where: { workspaceId: legacyWorkspaceId },
      })
      await mockPrisma.chatSession.deleteMany({
        where: { workspaceId: legacyWorkspaceId },
      })
      await mockPrisma.customers.deleteMany({
        where: { workspaceId: legacyWorkspaceId },
      })
      await mockPrisma.workspace.delete({
        where: { id: legacyWorkspaceId },
      })
    })

    it("should skip welcome message if not configured in workspace", async () => {
      // Create workspace WITHOUT welcomeMessage
      const noWelcomeWorkspaceId = "test-workspace-no-welcome"
      await mockPrisma.workspace.create({
        data: {
          id: noWelcomeWorkspaceId,
          name: "No Welcome Workspace",
          sellsProductsAndServices: true,
          welcomeMessage: null, // No welcome message
        },
      })

      const noWelcomeCustomerId = "test-customer-no-welcome"
      await mockPrisma.customers.create({
        data: {
          id: noWelcomeCustomerId,
          workspaceId: noWelcomeWorkspaceId,
          phone: "+1112223333",
          name: "No Welcome Customer",
          language: "en",
        },
      })

      const noWelcomeConversationId = "test-conversation-no-welcome"
      await mockPrisma.chatSession.create({
        data: {
          id: noWelcomeConversationId,
          workspaceId: noWelcomeWorkspaceId,
          customerId: noWelcomeCustomerId,
          status: "active",
        },
      })

      const chatEngine = makeChatEngine()

      const result = await chatEngine.routeMessage({
        workspaceId: noWelcomeWorkspaceId,
        customerId: noWelcomeCustomerId,
        conversationId: noWelcomeConversationId,
        message: "Ciao",
        customerLanguage: "it",
        customerName: "No Welcome Customer",
      })

      // Should skip welcome message and go to normal LLM flow
      expect(result.agentUsed).not.toBe("WELCOME")
      expect(result.agentUsed).not.toBe("WELCOME")

      // Cleanup
      await mockPrisma.conversationMessage.deleteMany({
        where: { workspaceId: noWelcomeWorkspaceId },
      })
      await mockPrisma.chatSession.deleteMany({
        where: { workspaceId: noWelcomeWorkspaceId },
      })
      await mockPrisma.customers.deleteMany({
        where: { workspaceId: noWelcomeWorkspaceId },
      })
      await mockPrisma.workspace.delete({
        where: { id: noWelcomeWorkspaceId },
      })
    })
  })
})
