/**
 * @jest-environment node
 * 
 * Unit tests for LLM Router Identity Question Pre-Check
 * 
 * WHAT IS TESTED:
 * - Identity questions bypass LLM and return direct response
 * - All 4 languages (IT/EN/ES/PT) are supported
 * - Variables (chatbotName, botIdentityResponse) are correctly replaced
 * - Works in both ecommerce and informational modes
 * - No function calling occurs for identity questions
 * 
 * WHY THIS IS CRITICAL:
 * - GPT-4-mini was calling RESET_ACTIVE_AGENT in loop instead of responding
 * - Pre-check ensures instant, correct identity responses
 * - Prevents wasted tokens and poor UX
 */

import { PrismaClient } from "@prisma/client"
import { LLMRouterService } from "../../../src/services/llm-router.service"

describe("LLM Router - Identity Question Pre-Check", () => {
  let prisma: PrismaClient
  let llmRouterService: LLMRouterService

  beforeAll(() => {
    prisma = new PrismaClient()
    llmRouterService = new LLMRouterService(prisma)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe("Identity Pattern Detection", () => {
    const identityQuestions = {
      IT: [
        "come ti chiami?",
        "Come ti chiami",
        "qual è il tuo nome?",
        "chi sei?",
        "Chi sei",
        "nome tuo",
      ],
      EN: [
        "what's your name?",
        "What is your name",
        "who are you?",
        "Who are you",
        "your name is",
      ],
      ES: [
        "cómo te llamas?",
        "Como te llamas",
        "quién eres?",
        "Quien eres",
        "cuál es tu nombre?",
      ],
      PT: [
        "qual é seu nome?",
        "Qual e seu nome",
        "quem é você?",
        "Quem e voce",
        "seu nome é",
      ],
    }

    Object.entries(identityQuestions).forEach(([lang, questions]) => {
      describe(`${lang} Language`, () => {
        questions.forEach((question) => {
          it(`should detect "${question}" as identity question`, async () => {
            const workspaceId = "test-workspace-identity"
            const customerId = "test-customer-identity"

            // Create test workspace with chatbotName
            await prisma.workspace.upsert({
              where: { id: workspaceId },
              create: {
                id: workspaceId,
                name: "Test Identity Workspace",
                chatbotName: "TestBot",
                botIdentityResponse: "I'm a test bot for identity checks",
                notificationEmail: "test@identity.com",
                sellsProductsAndServices: true, // Test ecommerce mode
                debugMode: false,
              },
              update: {
                chatbotName: "TestBot",
                botIdentityResponse: "I'm a test bot for identity checks",
              },
            })

            // Create test customer
            await prisma.customers.upsert({
              where: { id: customerId },
              create: {
                id: customerId,
                workspaceId,
                name: "Test Customer",
                phone: "+1234567890",
                language: lang.toLowerCase(),
                isActive: true,
              },
              update: {
                language: lang.toLowerCase(),
              },
            })

            // Create conversation
            const conversationId = `conv-identity-${lang}-${Date.now()}`
            await prisma.searchConversations.create({
              data: {
                sessionId: conversationId,
                workspaceId,
                customerId,
                status: "active",
              },
            })

            // Call router with identity question
            const response = await llmRouterService.routeMessage({
              workspaceId,
              customerId,
              conversationId,
              message: question,
              customerName: "Test Customer",
              customerLanguage: lang.toLowerCase(),
            })

            // Assertions
            expect(response).toBeDefined()
            expect(response.response).toBeDefined()
            expect(response.response).toContain("TestBot") // Bot name must be in response

            // Verify no function calling occurred (tokensUsed should be low)
            expect(response.tokensUsed).toBeLessThan(100) // Direct response uses ~50 tokens

            // Language-specific response validation
            if (lang === "IT") {
              expect(response.response).toMatch(/Mi chiamo TestBot/)
            } else if (lang === "EN") {
              expect(response.response).toMatch(/My name is TestBot/)
            } else if (lang === "ES") {
              expect(response.response).toMatch(/Me llamo TestBot/)
            } else if (lang === "PT") {
              expect(response.response).toMatch(/Meu nome é TestBot/)
            }

            // Cleanup
            await prisma.searchConversations.delete({
              where: { sessionId: conversationId },
            })
          }, 30000) // 30s timeout for each test
        })
      })
    })
  })

  describe("Variable Replacement in Identity Response", () => {
    it("should replace {{chatbotName}} with actual bot name", async () => {
      const workspaceId = "test-workspace-variables"
      const customerId = "test-customer-variables"

      await prisma.workspace.upsert({
        where: { id: workspaceId },
        create: {
          id: workspaceId,
          name: "Variable Test Company",
          chatbotName: "VariableBot",
          botIdentityResponse: "I assist with product recommendations",
          notificationEmail: "test@variables.com",
          sellsProductsAndServices: false, // Test informational mode
        },
        update: {
          chatbotName: "VariableBot",
          botIdentityResponse: "I assist with product recommendations",
        },
      })

      await prisma.customers.upsert({
        where: { id: customerId },
        create: {
          id: customerId,
          workspaceId,
          name: "Variable Test Customer",
          phone: "+9876543210",
          language: "it",
          isActive: true,
        },
        update: {},
      })

      const conversationId = `conv-variables-${Date.now()}`
      await prisma.searchConversations.create({
        data: {
          sessionId: conversationId,
          workspaceId,
          customerId,
          status: "active",
        },
      })

      const response = await llmRouterService.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        message: "come ti chiami?",
        customerName: "Variable Test Customer",
        customerLanguage: "it",
      })

      // Verify chatbotName is present
      expect(response.response).toContain("VariableBot")

      // Verify botIdentityResponse is present
      expect(response.response).toContain("I assist with product recommendations")

      // Verify no placeholder/variable remains
      expect(response.response).not.toMatch(/\{\{.*\}\}/)
      expect(response.response).not.toMatch(/\[.*\]/)

      // Cleanup
      await prisma.searchConversations.delete({
        where: { sessionId: conversationId },
      })
    }, 30000)
  })

  describe("Mode Compatibility", () => {
    it("should work in ECOMMERCE mode (sellsProductsAndServices = true)", async () => {
      const workspaceId = "test-workspace-ecommerce"
      const customerId = "test-customer-ecommerce"

      await prisma.workspace.upsert({
        where: { id: workspaceId },
        create: {
          id: workspaceId,
          name: "Ecommerce Test Shop",
          chatbotName: "ShopBot",
          botIdentityResponse: "I help you find and buy products",
          notificationEmail: "test@shop.com",
          sellsProductsAndServices: true, // ECOMMERCE MODE
        },
        update: {
          chatbotName: "ShopBot",
          botIdentityResponse: "I help you find and buy products",
          sellsProductsAndServices: true,
        },
      })

      await prisma.customers.upsert({
        where: { id: customerId },
        create: {
          id: customerId,
          workspaceId,
          name: "Shop Customer",
          phone: "+1111111111",
          language: "en",
          isActive: true,
        },
        update: {},
      })

      const conversationId = `conv-ecommerce-${Date.now()}`
      await prisma.searchConversations.create({
        data: {
          sessionId: conversationId,
          workspaceId,
          customerId,
          status: "active",
        },
      })

      const response = await llmRouterService.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        message: "what's your name?",
        customerName: "Shop Customer",
        customerLanguage: "en",
      })

      expect(response.response).toContain("ShopBot")
      expect(response.response).toMatch(/My name is ShopBot/)
      expect(response.tokensUsed).toBeLessThan(100)

      // Cleanup
      await prisma.searchConversations.delete({
        where: { sessionId: conversationId },
      })
    }, 30000)

    it("should work in INFORMATIONAL mode (sellsProductsAndServices = false)", async () => {
      const workspaceId = "test-workspace-informational"
      const customerId = "test-customer-informational"

      await prisma.workspace.upsert({
        where: { id: workspaceId },
        create: {
          id: workspaceId,
          name: "Info Test Company",
          chatbotName: "InfoBot",
          botIdentityResponse: "I provide information and support",
          notificationEmail: "test@info.com",
          sellsProductsAndServices: false, // INFORMATIONAL MODE
        },
        update: {
          chatbotName: "InfoBot",
          botIdentityResponse: "I provide information and support",
          sellsProductsAndServices: false,
        },
      })

      await prisma.customers.upsert({
        where: { id: customerId },
        create: {
          id: customerId,
          workspaceId,
          name: "Info Customer",
          phone: "+2222222222",
          language: "it",
          isActive: true,
        },
        update: {},
      })

      const conversationId = `conv-informational-${Date.now()}`
      await prisma.searchConversations.create({
        data: {
          sessionId: conversationId,
          workspaceId,
          customerId,
          status: "active",
        },
      })

      const response = await llmRouterService.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        message: "chi sei?",
        customerName: "Info Customer",
        customerLanguage: "it",
      })

      expect(response.response).toContain("InfoBot")
      expect(response.response).toMatch(/Mi chiamo InfoBot/)
      expect(response.tokensUsed).toBeLessThan(100)

      // Cleanup
      await prisma.searchConversations.delete({
        where: { sessionId: conversationId },
      })
    }, 30000)
  })

  describe("Non-Identity Questions", () => {
    it("should NOT bypass LLM for non-identity questions", async () => {
      const workspaceId = "test-workspace-normal"
      const customerId = "test-customer-normal"

      await prisma.workspace.upsert({
        where: { id: workspaceId },
        create: {
          id: workspaceId,
          name: "Normal Test Workspace",
          chatbotName: "NormalBot",
          botIdentityResponse: "I'm a normal bot",
          notificationEmail: "test@normal.com",
          sellsProductsAndServices: true,
        },
        update: {},
      })

      await prisma.customers.upsert({
        where: { id: customerId },
        create: {
          id: customerId,
          workspaceId,
          name: "Normal Customer",
          phone: "+3333333333",
          language: "it",
          isActive: true,
        },
        update: {},
      })

      const conversationId = `conv-normal-${Date.now()}`
      await prisma.searchConversations.create({
        data: {
          sessionId: conversationId,
          workspaceId,
          customerId,
          status: "active",
        },
      })

      const response = await llmRouterService.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        message: "ciao, come stai?", // NOT an identity question
        customerName: "Normal Customer",
        customerLanguage: "it",
      })

      // Should use more tokens (LLM was called)
      expect(response.tokensUsed).toBeGreaterThan(100)

      // Cleanup
      await prisma.searchConversations.delete({
        where: { sessionId: conversationId },
      })
    }, 30000)
  })

  describe("Edge Cases", () => {
    it("should fallback to LLM if chatbotName is NOT configured", async () => {
      const workspaceId = "test-workspace-no-name"
      const customerId = "test-customer-no-name"

      await prisma.workspace.upsert({
        where: { id: workspaceId },
        create: {
          id: workspaceId,
          name: "No Name Workspace",
          chatbotName: null, // NO chatbotName configured
          botIdentityResponse: "I'm a bot without a name",
          notificationEmail: "test@noname.com",
          sellsProductsAndServices: true,
        },
        update: {
          chatbotName: null,
        },
      })

      await prisma.customers.upsert({
        where: { id: customerId },
        create: {
          id: customerId,
          workspaceId,
          name: "No Name Customer",
          phone: "+4444444444",
          language: "it",
          isActive: true,
        },
        update: {},
      })

      const conversationId = `conv-no-name-${Date.now()}`
      await prisma.searchConversations.create({
        data: {
          sessionId: conversationId,
          workspaceId,
          customerId,
          status: "active",
        },
      })

      const response = await llmRouterService.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        message: "come ti chiami?",
        customerName: "No Name Customer",
        customerLanguage: "it",
      })

      // Should use more tokens (LLM was called, not bypassed)
      expect(response.tokensUsed).toBeGreaterThan(100)

      // Cleanup
      await prisma.searchConversations.delete({
        where: { sessionId: conversationId },
      })
    }, 30000)
  })
})
