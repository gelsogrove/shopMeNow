/**
 * 🧪 Greeting Fast-Path Tests - THE BIBLE
 * 
 * CRITICAL: These tests prevent regression bugs in greeting handling.
 * NEVER modify greeting logic without updating these tests!
 * 
 * Coverage:
 * - Greeting detection (ciao, hello, hi, hola, etc.)
 * - Welcome message from workspace.welcomeMessage (multilingual)
 * - NO Router LLM calls (0 tokens, fast response)
 * - Fallback handling when welcome message missing
 * - Debug timeline shows "🤝 Greeting Fast-Path" step
 * 
 * History:
 * - v278: Bug - Router called RESET_ACTIVE_AGENT in loop for greetings (8 iterations → timeout)
 * - v279: Fixed with greeting fast-path (P3 priority check)
 * - v280: Enhanced to use workspace.welcomeMessage instead of hardcoded responses
 */

import { LLMRouterService } from "../../../src/services/llm-router.service"

const mockSaveUserMessage = jest.fn()
const mockSaveAssistantMessage = jest.fn()
const mockLoadHistory = jest.fn().mockResolvedValue([])

jest.mock("../../../src/services/conversation-manager.service", () => ({
  ConversationManager: jest.fn().mockImplementation(() => ({
    saveUserMessage: mockSaveUserMessage,
    saveAssistantMessage: mockSaveAssistantMessage,
    loadHistory: mockLoadHistory,
  })),
}))

jest.mock("../../../src/application/services/template-loader.service", () => ({
  TemplateLoaderService: {
    getInstance: jest.fn(() => ({
      loadAndRenderTemplate: jest.fn().mockResolvedValue(""),
    })),
  },
}))

jest.mock("../../../src/services/agent-logger.service", () => ({
  AgentLoggerService: jest.fn().mockImplementation(() => ({
    logAgentInteraction: jest.fn().mockResolvedValue(undefined),
  })),
}))

jest.mock("../../../src/repositories/agent-conversation-log.repository", () => ({
  AgentConversationLogRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({}),
  })),
}))

jest.mock("../../../src/application/services/link-replacement.service", () => ({
  LinkReplacementService: jest.fn().mockImplementation(() => ({
    replaceTokens: jest.fn().mockResolvedValue({ success: true, response: "" }),
  })),
}))

jest.mock("../../../src/services/function-executor.service", () => ({
  FunctionExecutor: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({}),
  })),
}))

jest.mock("../../../src/repositories/searchConversation.repository", () => ({
  SearchConversationRepository: jest.fn().mockImplementation(() => ({
    findBySessionId: jest.fn().mockResolvedValue(null),
  })),
}))

describe("LLMRouterService - Greeting Fast-Path (THE BIBLE)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("🤝 Greeting Detection", () => {
    it("should detect Italian greetings (ciao, buongiorno, buonasera)", async () => {
      const prismaMock: any = {
        workspace: {
          findUnique: jest.fn().mockResolvedValue({
            id: "ws-1",
            sellsProductsAndServices: true,
            welcomeMessage: {
              it: "Ciao! 😊 Benvenuto su eChatbot!",
              en: "Hello! 😊 Welcome to eChatbot!",
            },
          }),
        },
        customers: {
          findFirst: jest.fn().mockResolvedValue({ discount: 0, isActive: true }),
        },
      }

      const service = new LLMRouterService(prismaMock)

      const greetings = ["ciao", "Ciao!", "buongiorno", "buonasera", "salve"]

      for (const greeting of greetings) {
        mockSaveAssistantMessage.mockClear()

        const result = await service.routeMessage({
          workspaceId: "ws-1",
          customerId: "cust-1",
          conversationId: "conv-1",
          messageId: "msg-1",
          message: greeting,
          customerLanguage: "it",
          customerName: "Andrea",
          channel: "whatsapp",
        })

        expect(result.response).toBe("Ciao! 😊 Benvenuto su eChatbot!")
        expect(result.tokensUsed).toBe(0) // NO Router LLM call!
        expect(result.executionTimeMs).toBeLessThan(100) // Fast!
      }
    })

    it("should detect English greetings (hello, hi, hey)", async () => {
      const prismaMock: any = {
        workspace: {
          findUnique: jest.fn().mockResolvedValue({
            id: "ws-1",
            sellsProductsAndServices: true,
            welcomeMessage: {
              it: "Ciao! 😊 Benvenuto!",
              en: "Hello! 😊 Welcome to our store!",
            },
          }),
        },
        customers: {
          findFirst: jest.fn().mockResolvedValue({ discount: 0, isActive: true }),
        },
      }

      const service = new LLMRouterService(prismaMock)

      const greetings = ["hello", "Hello!", "hi", "Hi", "hey", "Hey!"]

      for (const greeting of greetings) {
        mockSaveAssistantMessage.mockClear()

        const result = await service.routeMessage({
          workspaceId: "ws-1",
          customerId: "cust-1",
          conversationId: "conv-1",
          messageId: "msg-1",
          message: greeting,
          customerLanguage: "en",
          customerName: "John",
          channel: "whatsapp",
        })

        expect(result.response).toBe("Hello! 😊 Welcome to our store!")
        expect(result.tokensUsed).toBe(0)
      }
    })

    it("should detect Spanish and Portuguese greetings", async () => {
      const prismaMock: any = {
        workspace: {
          findUnique: jest.fn().mockResolvedValue({
            id: "ws-1",
            sellsProductsAndServices: true,
            welcomeMessage: {
              es: "¡Hola! 😊 ¡Bienvenido!",
              pt: "Olá! 😊 Bem-vindo!",
            },
          }),
        },
        customers: {
          findFirst: jest.fn().mockResolvedValue({ discount: 0, isActive: true }),
        },
      }

      const service = new LLMRouterService(prismaMock)

      // Spanish
      const resultES = await service.routeMessage({
        workspaceId: "ws-1",
        customerId: "cust-1",
        conversationId: "conv-1",
        messageId: "msg-1",
        message: "hola",
        customerLanguage: "es",
        customerName: "Carlos",
        channel: "whatsapp",
      })
      expect(resultES.response).toBe("¡Hola! 😊 ¡Bienvenido!")

      // Portuguese
      mockSaveAssistantMessage.mockClear()
      const resultPT = await service.routeMessage({
        workspaceId: "ws-1",
        customerId: "cust-1",
        conversationId: "conv-1",
        messageId: "msg-1",
        message: "olá",
        customerLanguage: "pt",
        customerName: "João",
        channel: "whatsapp",
      })
      expect(resultPT.response).toBe("Olá! 😊 Bem-vindo!")
    })
  })

  describe("📝 Welcome Message Priority", () => {
    it("CRITICAL: should use workspace.welcomeMessage[customerLanguage]", async () => {
      // SCENARIO: Workspace has multilingual welcome messages
      // RULE: Use customer's language from welcomeMessage object
      const prismaMock: any = {
        workspace: {
          findUnique: jest.fn().mockResolvedValue({
            id: "ws-1",
            sellsProductsAndServices: true,
            welcomeMessage: {
              it: "Messaggio italiano",
              en: "English message",
              es: "Mensaje español",
              pt: "Mensagem portuguesa",
            },
          }),
        },
        customers: {
          findFirst: jest.fn().mockResolvedValue({ discount: 0, isActive: true }),
        },
      }

      const service = new LLMRouterService(prismaMock)

      // Test each language
      const languages = [
        { code: "it", expected: "Messaggio italiano" },
        { code: "en", expected: "English message" },
        { code: "es", expected: "Mensaje español" },
        { code: "pt", expected: "Mensagem portuguesa" },
      ]

      for (const lang of languages) {
        mockSaveAssistantMessage.mockClear()

        const result = await service.routeMessage({
          workspaceId: "ws-1",
          customerId: "cust-1",
          conversationId: "conv-1",
          messageId: "msg-1",
          message: "ciao",
          customerLanguage: lang.code,
          customerName: "Test",
          channel: "whatsapp",
        })

        expect(result.response).toBe(lang.expected)
      }
    })

    it("should fallback to English if customer language not available", async () => {
      // SCENARIO: Workspace has IT and EN, customer speaks FR
      // RULE: Fallback order: customer lang → EN → IT → first available
      const prismaMock: any = {
        workspace: {
          findUnique: jest.fn().mockResolvedValue({
            id: "ws-1",
            sellsProductsAndServices: true,
            welcomeMessage: {
              it: "Messaggio italiano",
              en: "English fallback message",
            },
          }),
        },
        customers: {
          findFirst: jest.fn().mockResolvedValue({ discount: 0, isActive: true }),
        },
      }

      const service = new LLMRouterService(prismaMock)

      const result = await service.routeMessage({
        workspaceId: "ws-1",
        customerId: "cust-1",
        conversationId: "conv-1",
        messageId: "msg-1",
        message: "hello", // Use English greeting (in pattern), customer lang is FR
        customerLanguage: "fr", // French customer
        customerName: "Pierre",
        channel: "whatsapp",
      })

      expect(result.response).toBe("English fallback message")
    })

    it("should fallback to Italian if only Italian available", async () => {
      const prismaMock: any = {
        workspace: {
          findUnique: jest.fn().mockResolvedValue({
            id: "ws-1",
            sellsProductsAndServices: true,
            welcomeMessage: {
              it: "Solo italiano disponibile",
            },
          }),
        },
        customers: {
          findFirst: jest.fn().mockResolvedValue({ discount: 0, isActive: true }),
        },
      }

      const service = new LLMRouterService(prismaMock)

      const result = await service.routeMessage({
        workspaceId: "ws-1",
        customerId: "cust-1",
        conversationId: "conv-1",
        messageId: "msg-1",
        message: "hello",
        customerLanguage: "en",
        customerName: "John",
        channel: "whatsapp",
      })

      expect(result.response).toBe("Solo italiano disponibile")
    })

    it("should use hardcoded fallback if workspace.welcomeMessage is empty", async () => {
      // SCENARIO: Workspace has NO welcome message configured
      // RULE: Use hardcoded fallback based on customer language
      const prismaMock: any = {
        workspace: {
          findUnique: jest.fn().mockResolvedValue({
            id: "ws-1",
            sellsProductsAndServices: true,
            welcomeMessage: {}, // Empty object
          }),
        },
        customers: {
          findFirst: jest.fn().mockResolvedValue({ discount: 0, isActive: true }),
        },
      }

      const service = new LLMRouterService(prismaMock)

      // Italian fallback
      const resultIT = await service.routeMessage({
        workspaceId: "ws-1",
        customerId: "cust-1",
        conversationId: "conv-1",
        messageId: "msg-1",
        message: "ciao",
        customerLanguage: "it",
        customerName: "Andrea",
        channel: "whatsapp",
      })
      expect(resultIT.response).toBe("Ciao! 😊 Come posso aiutarti?")

      // English fallback
      mockSaveAssistantMessage.mockClear()
      const resultEN = await service.routeMessage({
        workspaceId: "ws-1",
        customerId: "cust-1",
        conversationId: "conv-1",
        messageId: "msg-1",
        message: "hello",
        customerLanguage: "en",
        customerName: "John",
        channel: "whatsapp",
      })
      expect(resultEN.response).toBe("Hello! 😊 How can I help you?")
    })
  })

  describe("⚡ Performance & Token Optimization", () => {
    it("CRITICAL: should NOT call Router LLM (0 tokens)", async () => {
      // SCENARIO: User sends greeting
      // RULE: Bypass Router LLM completely → 0 tokens, instant response
      const prismaMock: any = {
        workspace: {
          findUnique: jest.fn().mockResolvedValue({
            id: "ws-1",
            sellsProductsAndServices: true,
            welcomeMessage: { it: "Welcome!" },
          }),
        },
        customers: {
          findFirst: jest.fn().mockResolvedValue({ discount: 0, isActive: true }),
        },
      }

      const service = new LLMRouterService(prismaMock)

      const result = await service.routeMessage({
        workspaceId: "ws-1",
        customerId: "cust-1",
        conversationId: "conv-1",
        messageId: "msg-1",
        message: "ciao",
        customerLanguage: "it",
        customerName: "Andrea",
        channel: "whatsapp",
      })

      expect(result.tokensUsed).toBe(0)
      expect(result.agentUsed).toBe("ROUTER")
      expect(result.confidence).toBe(1.0)
    })

    it("should execute in <100ms (fast-path performance)", async () => {
      const prismaMock: any = {
        workspace: {
          findUnique: jest.fn().mockResolvedValue({
            id: "ws-1",
            sellsProductsAndServices: true,
            welcomeMessage: { it: "Welcome!" },
          }),
        },
        customers: {
          findFirst: jest.fn().mockResolvedValue({ discount: 0, isActive: true }),
        },
      }

      const service = new LLMRouterService(prismaMock)

      const startTime = Date.now()
      await service.routeMessage({
        workspaceId: "ws-1",
        customerId: "cust-1",
        conversationId: "conv-1",
        messageId: "msg-1",
        message: "hello",
        customerLanguage: "en",
        customerName: "Test",
        channel: "whatsapp",
      })
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(100) // Should be instant
    })
  })

  describe("🔍 Debug Timeline", () => {
    it("should show '🤝 Greeting Fast-Path' in debug steps", async () => {
      const prismaMock: any = {
        workspace: {
          findUnique: jest.fn().mockResolvedValue({
            id: "ws-1",
            sellsProductsAndServices: true,
            welcomeMessage: { it: "Welcome!" },
          }),
        },
        customers: {
          findFirst: jest.fn().mockResolvedValue({ discount: 0, isActive: true }),
        },
      }

      const service = new LLMRouterService(prismaMock)

      await service.routeMessage({
        workspaceId: "ws-1",
        customerId: "cust-1",
        conversationId: "conv-1",
        messageId: "msg-1",
        message: "ciao",
        customerLanguage: "it",
        customerName: "Andrea",
        channel: "whatsapp",
      })

      expect(mockSaveAssistantMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          debugInfo: expect.objectContaining({
            steps: expect.arrayContaining([
              expect.objectContaining({
                type: "router",
                agent: "🤝 Greeting Fast-Path",
                model: "N/A",
                tokenUsage: expect.objectContaining({
                  totalTokens: 0,
                }),
              }),
            ]),
            totalTokens: 0,
          }),
        })
      )
    })
  })

  describe("🚨 REGRESSION PREVENTION (Historical Bugs)", () => {
    it("REGRESSION v278: NEVER call RESET_ACTIVE_AGENT for greetings", async () => {
      // BUG HISTORY:
      // v278: Router called RESET_ACTIVE_AGENT in loop for "ciao" → 8 iterations → timeout
      // Root cause: tool_choice="required" forced Router to call a function
      // Fix: Greeting fast-path bypasses Router completely
      const prismaMock: any = {
        workspace: {
          findUnique: jest.fn().mockResolvedValue({
            id: "ws-1",
            sellsProductsAndServices: true,
            welcomeMessage: { it: "Welcome!" },
          }),
        },
        customers: {
          findFirst: jest.fn().mockResolvedValue({ discount: 0, isActive: true }),
        },
      }

      const service = new LLMRouterService(prismaMock)

      const result = await service.routeMessage({
        workspaceId: "ws-1",
        customerId: "cust-1",
        conversationId: "conv-1",
        messageId: "msg-1",
        message: "ciao",
        customerLanguage: "it",
        customerName: "Andrea",
        channel: "whatsapp",
      })

      // Should NOT loop, should NOT timeout
      expect(result.tokensUsed).toBe(0)
      expect(result.executionTimeMs).toBeLessThan(100)
      expect(result.response).not.toContain("elaborando") // No timeout message
      expect(result.response).not.toContain("tempo del previsto")
    })

    it("REGRESSION v279: MUST use workspace.welcomeMessage (not hardcoded)", async () => {
      // BUG HISTORY:
      // v279: Fast-path used hardcoded "Ciao! 😊 Come posso aiutarti?"
      // Fix: Use workspace.welcomeMessage with language fallback
      const prismaMock: any = {
        workspace: {
          findUnique: jest.fn().mockResolvedValue({
            id: "ws-1",
            sellsProductsAndServices: true,
            welcomeMessage: {
              it: "Messaggio personalizzato dal workspace!",
            },
          }),
        },
        customers: {
          findFirst: jest.fn().mockResolvedValue({ discount: 0, isActive: true }),
        },
      }

      const service = new LLMRouterService(prismaMock)

      const result = await service.routeMessage({
        workspaceId: "ws-1",
        customerId: "cust-1",
        conversationId: "conv-1",
        messageId: "msg-1",
        message: "ciao",
        customerLanguage: "it",
        customerName: "Andrea",
        channel: "whatsapp",
      })

      expect(result.response).toBe("Messaggio personalizzato dal workspace!")
      expect(result.response).not.toBe("Ciao! 😊 Come posso aiutarti?") // Not hardcoded
    })
  })
})
