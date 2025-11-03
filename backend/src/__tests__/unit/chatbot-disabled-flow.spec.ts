/**
 * Chatbot Disabled Flow Unit Tests
 *
 * CRITICAL: Verifica che quando activeChatbot = false:
 * 1. Il messaggio del cliente viene SEMPRE salvato in history
 * 2. LLM Router NON viene chiamato (nessun processing)
 * 3. Sistema ritorna flag chatbotDisabled = true
 * 4. Nessuna risposta viene inviata su WhatsApp
 *
 * @critical DO NOT MODIFY without Andrea's approval
 */

import { LLMService } from "../../services/llm.service"

// Mock PrismaClient
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    customers: {
      findFirst: jest.fn(),
    },
    workspaces: {
      findUnique: jest.fn(),
    },
    agentConfig: {
      findFirst: jest.fn(),
    },
  })),
}))

// Mock MessageRepository
const mockMessageRepo = {
  findCustomerByPhone: jest.fn(),
  isCustomerBlacklisted: jest.fn(),
  saveMessage: jest.fn(),
  getActiveFaqs: jest.fn(),
  getActiveServices: jest.fn(),
  getActiveCategories: jest.fn(),
  getActiveOffers: jest.fn(),
  getActiveProducts: jest.fn(),
  getLinkCounts: jest.fn(),
  getRecentMessagesByTime: jest.fn(),
}

jest.mock("../../repositories/message.repository", () => ({
  MessageRepository: jest.fn().mockImplementation(() => mockMessageRepo),
}))

// Mock workspace service
const mockWorkspaceService = {
  getById: jest.fn(),
  getActivePromptByWorkspaceId: jest.fn(),
}

jest.mock("../../services/workspace.service", () => ({
  workspaceService: mockWorkspaceService,
}))

describe("🚨 CRITICAL: activeChatbot = false Flow", () => {
  let llmService: LLMService

  beforeEach(() => {
    jest.clearAllMocks()
    llmService = new LLMService()
  })

  describe("✅ Message Saving When Chatbot Disabled", () => {
    it("should SAVE customer message to history when activeChatbot = false", async () => {
      // Mock customer with chatbot DISABLED
      const mockCustomer = {
        id: "customer-1",
        phone: "+393331234567",
        name: "Mario Rossi",
        workspaceId: "workspace-1",
        language: "it",
        discount: 10,
        activeChatbot: false, // 🚨 CHATBOT DISABLED
        isBlacklisted: false,
        sales: {
          firstName: "Agent",
          lastName: "Support",
          phone: "+393331111111",
          email: "agent@example.com",
        },
      }

      const mockWorkspace = {
        id: "workspace-1",
        name: "Test Workspace",
        language: "it",
        maxTokens: 2000,
        url: "http://localhost:3000",
      }

      // Setup mocks
      mockMessageRepo.findCustomerByPhone.mockResolvedValue(mockCustomer)
      mockMessageRepo.isCustomerBlacklisted.mockResolvedValue(false)
      mockMessageRepo.saveMessage.mockResolvedValue({
        id: "message-1",
        content: "ciao",
        direction: "INBOUND",
      })
      mockWorkspaceService.getById.mockResolvedValue(mockWorkspace)

      // Execute
      const result = await llmService.handleMessage({
        chatInput: "ciao, come stai?",
        workspaceId: "workspace-1",
        customerid: "customer-1",
        phone: "+393331234567",
        language: "it",
        sessionId: "session-1",
        maxTokens: 2000,
        model: "openai/gpt-4o-mini",
        messages: [],
        prompt: "",
      })

      // ✅ ASSERTIONS: Verify message was saved
      expect(mockMessageRepo.saveMessage).toHaveBeenCalledTimes(1)
      expect(mockMessageRepo.saveMessage).toHaveBeenCalledWith({
        customerId: "customer-1",
        workspaceId: "workspace-1",
        direction: "INBOUND",
        content: "ciao, come stai?",
        type: "TEXT",
        aiGenerated: false,
        metadata: {
          chatbotDisabled: true,
          savedAt: expect.any(String),
        },
      })

      // ✅ Verify result indicates chatbot disabled
      expect(result.success).toBe(true)
      expect(result.chatbotDisabled).toBe(true)
      expect(result.output).toContain("chatbot disabled")

      console.log("✅ Message saved to history when chatbot disabled")
    })

    it("should NOT call LLM Router when activeChatbot = false", async () => {
      const mockCustomer = {
        id: "customer-1",
        phone: "+393331234567",
        activeChatbot: false, // 🚨 DISABLED
        isBlacklisted: false,
        workspaceId: "workspace-1",
      }

      const mockWorkspace = {
        id: "workspace-1",
        maxTokens: 2000,
      }

      mockMessageRepo.findCustomerByPhone.mockResolvedValue(mockCustomer)
      mockMessageRepo.isCustomerBlacklisted.mockResolvedValue(false)
      mockMessageRepo.saveMessage.mockResolvedValue({ id: "msg-1" })
      mockWorkspaceService.getById.mockResolvedValue(mockWorkspace)

      // Spy on fetch to verify LLM is NOT called
      const fetchSpy = jest.spyOn(global, "fetch")

      await llmService.handleMessage({
        chatInput: "test message",
        workspaceId: "workspace-1",
        customerid: "customer-1",
        phone: "+393331234567",
        language: "it",
        sessionId: "session-1",
        maxTokens: 2000,
        model: "openai/gpt-4o-mini",
        messages: [],
        prompt: "",
      })

      // ✅ CRITICAL: Verify LLM was NOT called
      expect(fetchSpy).not.toHaveBeenCalled()

      // ✅ Verify no FAQ/Products/Services were fetched (LLM not needed)
      expect(mockMessageRepo.getActiveFaqs).not.toHaveBeenCalled()
      expect(mockMessageRepo.getActiveProducts).not.toHaveBeenCalled()
      expect(mockMessageRepo.getActiveServices).not.toHaveBeenCalled()

      fetchSpy.mockRestore()
      console.log("✅ LLM Router NOT called when chatbot disabled")
    })

    it("should return immediately after saving message (no processing)", async () => {
      const mockCustomer = {
        id: "customer-1",
        phone: "+393331234567",
        activeChatbot: false,
        isBlacklisted: false,
        workspaceId: "workspace-1",
      }

      const mockWorkspace = { id: "workspace-1", maxTokens: 2000 }

      mockMessageRepo.findCustomerByPhone.mockResolvedValue(mockCustomer)
      mockMessageRepo.isCustomerBlacklisted.mockResolvedValue(false)
      mockMessageRepo.saveMessage.mockResolvedValue({ id: "msg-1" })
      mockWorkspaceService.getById.mockResolvedValue(mockWorkspace)

      const startTime = Date.now()

      const result = await llmService.handleMessage({
        chatInput: "test",
        workspaceId: "workspace-1",
        customerid: "customer-1",
        phone: "+393331234567",
        language: "it",
        sessionId: "session-1",
        maxTokens: 2000,
        model: "openai/gpt-4o-mini",
        messages: [],
        prompt: "",
      })

      const executionTime = Date.now() - startTime

      // ✅ Should be very fast (< 100ms) since no LLM processing
      expect(executionTime).toBeLessThan(100)
      expect(result.success).toBe(true)
      expect(result.chatbotDisabled).toBe(true)

      console.log(`✅ Fast execution when chatbot disabled: ${executionTime}ms`)
    })
  })

  describe("❌ Blacklisted Customer (Different Behavior)", () => {
    it("should NOT save message when customer is blacklisted", async () => {
      const mockCustomer = {
        id: "customer-1",
        phone: "+393331234567",
        activeChatbot: true, // Chatbot enabled
        isBlacklisted: true, // 🚨 BLACKLISTED
        workspaceId: "workspace-1",
      }

      const mockWorkspace = { id: "workspace-1" }

      mockMessageRepo.findCustomerByPhone.mockResolvedValue(mockCustomer)
      mockMessageRepo.isCustomerBlacklisted.mockResolvedValue(true)
      mockWorkspaceService.getById.mockResolvedValue(mockWorkspace)

      const result = await llmService.handleMessage({
        chatInput: "test",
        workspaceId: "workspace-1",
        customerid: "customer-1",
        phone: "+393331234567",
        language: "it",
        sessionId: "session-1",
        maxTokens: 2000,
        model: "openai/gpt-4o-mini",
        messages: [],
        prompt: "",
      })

      // ✅ CRITICAL: Blacklisted customers should NOT have messages saved
      expect(mockMessageRepo.saveMessage).not.toHaveBeenCalled()
      expect(result.success).toBe(false)
      expect(result.output).toContain("blocked")

      console.log("✅ Blacklisted customer: message NOT saved")
    })
  })

  describe("✅ Normal Flow (activeChatbot = true)", () => {
    it("should process normally when activeChatbot = true", async () => {
      const mockCustomer = {
        id: "customer-1",
        phone: "+393331234567",
        name: "Mario Rossi",
        activeChatbot: true, // 🚨 ENABLED
        isBlacklisted: false,
        workspaceId: "workspace-1",
        language: "it",
        discount: 10,
        sales: {
          firstName: "Agent",
          lastName: "Support",
        },
      }

      const mockWorkspace = {
        id: "workspace-1",
        maxTokens: 2000,
        url: "http://localhost:3000",
        agentConfigs: [
          {
            model: "openai/gpt-4o-mini",
          },
        ],
      }

      mockMessageRepo.findCustomerByPhone.mockResolvedValue(mockCustomer)
      mockMessageRepo.isCustomerBlacklisted.mockResolvedValue(false)
      mockWorkspaceService.getById.mockResolvedValue(mockWorkspace)
      mockWorkspaceService.getActivePromptByWorkspaceId.mockResolvedValue(
        "You are a helpful assistant"
      )
      mockMessageRepo.getActiveFaqs.mockResolvedValue("FAQ list")
      mockMessageRepo.getActiveServices.mockResolvedValue("Services list")
      mockMessageRepo.getActiveCategories.mockResolvedValue("Categories")
      mockMessageRepo.getActiveOffers.mockResolvedValue("Offers")
      mockMessageRepo.getActiveProducts.mockResolvedValue("Products")
      mockMessageRepo.getLinkCounts.mockResolvedValue({})
      mockMessageRepo.getRecentMessagesByTime.mockResolvedValue([])

      // Mock fetch for LLM call
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: "assistant",
                content: "Ciao! Come posso aiutarti?",
              },
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
        }),
      }) as any

      const result = await llmService.handleMessage({
        chatInput: "ciao",
        workspaceId: "workspace-1",
        customerid: "customer-1",
        phone: "+393331234567",
        language: "it",
        sessionId: "session-1",
        maxTokens: 2000,
        model: "openai/gpt-4o-mini",
        messages: [],
        prompt: "",
      })

      // ✅ With chatbot enabled, LLM should be called
      expect(global.fetch).toHaveBeenCalled()
      expect(mockMessageRepo.getActiveFaqs).toHaveBeenCalled()
      expect(mockMessageRepo.getActiveProducts).toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.chatbotDisabled).toBeUndefined() // Not disabled

      console.log("✅ Normal flow processes with LLM when chatbot enabled")
    })
  })

  describe("🔄 Transition Scenarios", () => {
    it("should handle transition from enabled to disabled gracefully", async () => {
      const mockCustomer = {
        id: "customer-1",
        phone: "+393331234567",
        activeChatbot: false, // Just disabled
        isBlacklisted: false,
        workspaceId: "workspace-1",
      }

      const mockWorkspace = { id: "workspace-1", maxTokens: 2000 }

      mockMessageRepo.findCustomerByPhone.mockResolvedValue(mockCustomer)
      mockMessageRepo.isCustomerBlacklisted.mockResolvedValue(false)
      mockMessageRepo.saveMessage.mockResolvedValue({ id: "msg-1" })
      mockWorkspaceService.getById.mockResolvedValue(mockWorkspace)

      // Simulate multiple messages after disabling
      for (let i = 0; i < 3; i++) {
        const result = await llmService.handleMessage({
          chatInput: `Message ${i + 1}`,
          workspaceId: "workspace-1",
          customerid: "customer-1",
          phone: "+393331234567",
          language: "it",
          sessionId: "session-1",
          maxTokens: 2000,
          model: "openai/gpt-4o-mini",
          messages: [],
          prompt: "",
        })

        expect(result.chatbotDisabled).toBe(true)
        expect(mockMessageRepo.saveMessage).toHaveBeenCalled()
      }

      // All 3 messages should be saved
      expect(mockMessageRepo.saveMessage).toHaveBeenCalledTimes(3)

      console.log(
        "✅ All messages saved correctly during transition to disabled"
      )
    })
  })
})
