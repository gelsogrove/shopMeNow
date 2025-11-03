/**
 * LLM Router Flow Unit Tests
 *
 * CRITICAL: These tests ensure the multi-agent architecture flow is NEVER broken!
 *
 * CORRECT FLOW:
 * 1. Router LLM (iteration 1) → Delegates to sub-agent
 * 2. Sub-Agent LLM → Processes and returns response
 * 3. Router LLM (iteration 2) → Receives sub-agent response
 * 4. Safety & Translation → Translates to target language
 * 5. Link Replacement → Replaces tokens with real URLs
 *
 * @critical DO NOT MODIFY THESE TESTS without Andrea's approval
 */

import { PrismaClient } from "@prisma/client"
import { LLMRouterService } from "../../services/llm-router.service"

// Mock PrismaClient
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    agentConfig: {
      findFirst: jest.fn(),
    },
    customers: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    conversations: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    conversationMessages: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    products: {
      findMany: jest.fn(),
    },
    categories: {
      findMany: jest.fn(),
    },
    faq: {
      findMany: jest.fn(),
    },
  })),
}))

// Mock external services
jest.mock("../../application/agents/SafetyTranslationAgent")
jest.mock("../../application/services/link-replacement.service")
jest.mock("axios")

describe("LLM Router Multi-Agent Flow", () => {
  let prisma: any
  let routerService: LLMRouterService

  beforeEach(() => {
    jest.clearAllMocks()
    prisma = new PrismaClient()
    routerService = new LLMRouterService(prisma)
  })

  describe("🎯 CRITICAL: Complete Flow Validation", () => {
    it("should follow correct flow: Router → Sub-Agent → Router → Safety → Link Replacement", async () => {
      // Mock data
      const mockRouterAgent = {
        id: "router-1",
        type: "ROUTER",
        systemPrompt: "You are a router agent",
        model: "openai/gpt-4o-mini",
        temperature: 0.7,
        maxTokens: 2000,
        isActive: true,
      }

      const mockCustomer = {
        id: "customer-1",
        name: "Mario Rossi",
        phone: "+393331234567",
        workspaceId: "workspace-1",
        language: "it",
        sales: { name: "Sales Agent" },
      }

      const mockConversation = {
        id: "conversation-1",
        customerId: "customer-1",
        workspaceId: "workspace-1",
      }

      // Setup mocks
      prisma.agentConfig.findFirst.mockResolvedValue(mockRouterAgent)
      prisma.customers.findUnique.mockResolvedValue(mockCustomer)
      prisma.customers.findFirst.mockResolvedValue(null) // No FAQ match
      prisma.conversations.findFirst.mockResolvedValue(mockConversation)
      prisma.conversationMessages.findMany.mockResolvedValue([])
      prisma.conversationMessages.create.mockResolvedValue({})
      prisma.products.findMany.mockResolvedValue([])
      prisma.categories.findMany.mockResolvedValue([])
      prisma.faq.findMany.mockResolvedValue([])

      // Mock axios for LLM calls
      const axios = require("axios")

      // Router iteration 1: Delegates to productSearchAgent
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                function_call: {
                  name: "productSearchAgent",
                  arguments: JSON.stringify({ query: "burrata" }),
                },
              },
              finish_reason: "function_call",
            },
          ],
          usage: { total_tokens: 100 },
        },
      })

      // Router iteration 2: Receives sub-agent response and returns final text
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                role: "assistant",
                content:
                  "Yes! We have Burrata Pugliese €7.38. Add to cart? [LINK_CHECKOUT_WITH_TOKEN]",
                function_call: null,
              },
              finish_reason: "stop",
            },
          ],
          usage: { total_tokens: 150 },
        },
      })

      // Mock SafetyTranslationAgent
      const SafetyTranslationAgent =
        require("../../application/agents/SafetyTranslationAgent").SafetyTranslationAgent
      SafetyTranslationAgent.mockImplementation(() => ({
        process: jest.fn().mockResolvedValue({
          safe: true,
          translatedText:
            "Sì! Abbiamo Burrata Pugliese €7.38. Aggiungere al carrello? [LINK_CHECKOUT_WITH_TOKEN]",
          tokensUsed: 50,
          executionTimeMs: 200,
        }),
      }))

      // Mock LinkReplacementService
      const {
        LinkReplacementService,
      } = require("../../application/services/link-replacement.service")
      jest
        .spyOn(LinkReplacementService.prototype, "replaceTokens")
        .mockResolvedValue({
          success: true,
          response:
            "Sì! Abbiamo Burrata Pugliese €7.38. Aggiungere al carrello? https://shopme.com/cart?token=xyz123",
          linkType: "cart",
          generatedLink: "https://shopme.com/cart?token=xyz123",
        })

      // Execute
      const result = await routerService.routeMessage({
        workspaceId: "workspace-1",
        customerId: "customer-1",
        conversationId: "conversation-1",
        messageId: "msg-1",
        message: "hai la burrata?",
        customerLanguage: "it",
        customerName: "Mario Rossi",
      })

      // ✅ ASSERTIONS: Validate complete flow
      expect(result).toBeDefined()
      expect(result.response).toContain("https://shopme.com/cart?token=") // Token replaced
      expect(result.response).toContain("Burrata Pugliese") // Translated to Italian

      // Validate debug steps
      expect(result.debugInfo?.steps).toBeDefined()
      const steps = result.debugInfo!.steps

      // Should have all required steps
      const routerSteps = steps.filter((s) => s.type === "router")
      const subAgentSteps = steps.filter((s) => (s as any).isSubAgent)
      const safetySteps = steps.filter((s) => s.type === "safety")
      const linkReplacementSteps = steps.filter(
        (s) => s.type === "token-replacement"
      )

      expect(routerSteps.length).toBeGreaterThanOrEqual(2) // Iteration 1 + Iteration 2
      expect(subAgentSteps.length).toBeGreaterThanOrEqual(1) // Sub-agent execution
      expect(safetySteps.length).toBe(1) // Safety & Translation
      expect(linkReplacementSteps.length).toBe(1) // Link Replacement

      console.log("✅ Complete flow validated successfully!")
    })

    it("should ensure Router iteration 2 receives sub-agent response", async () => {
      // This test specifically validates that after sub-agent returns,
      // Router LLM is called AGAIN (iteration 2) to process the response

      const mockRouterAgent = {
        id: "router-1",
        type: "ROUTER",
        systemPrompt: "You are a router agent",
        model: "openai/gpt-4o-mini",
        temperature: 0.7,
        maxTokens: 2000,
        isActive: true,
      }

      prisma.agentConfig.findFirst.mockResolvedValue(mockRouterAgent)
      prisma.customers.findUnique.mockResolvedValue({
        id: "customer-1",
        name: "Mario Rossi",
        workspaceId: "workspace-1",
        language: "it",
        sales: { name: "Agent" },
      })
      prisma.customers.findFirst.mockResolvedValue(null)
      prisma.conversations.findFirst.mockResolvedValue({ id: "conv-1" })
      prisma.conversationMessages.findMany.mockResolvedValue([])
      prisma.conversationMessages.create.mockResolvedValue({})
      prisma.products.findMany.mockResolvedValue([])
      prisma.categories.findMany.mockResolvedValue([])
      prisma.faq.findMany.mockResolvedValue([])

      const axios = require("axios")
      let callCount = 0

      axios.post.mockImplementation(() => {
        callCount++

        if (callCount === 1) {
          // Router iteration 1: Delegate
          return Promise.resolve({
            data: {
              choices: [
                {
                  message: {
                    role: "assistant",
                    function_call: {
                      name: "productSearchAgent",
                      arguments: JSON.stringify({ query: "test" }),
                    },
                  },
                },
              ],
              usage: { total_tokens: 100 },
            },
          })
        } else if (callCount === 2) {
          // Router iteration 2: Receive and process
          return Promise.resolve({
            data: {
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: "Processed response from sub-agent",
                  },
                },
              ],
              usage: { total_tokens: 100 },
            },
          })
        }
      })

      const SafetyTranslationAgent =
        require("../../application/agents/SafetyTranslationAgent").SafetyTranslationAgent
      SafetyTranslationAgent.mockImplementation(() => ({
        process: jest.fn().mockResolvedValue({
          safe: true,
          translatedText: "Risposta tradotta",
          tokensUsed: 50,
        }),
      }))

      const {
        LinkReplacementService,
      } = require("../../application/services/link-replacement.service")
      jest
        .spyOn(LinkReplacementService.prototype, "replaceTokens")
        .mockResolvedValue({
          success: true,
          response: "Risposta finale",
        })

      await routerService.routeMessage({
        workspaceId: "workspace-1",
        customerId: "customer-1",
        conversationId: "conv-1",
        messageId: "msg-1",
        message: "test",
        customerLanguage: "it",
        customerName: "Mario",
      })

      // ✅ CRITICAL ASSERTION: Router LLM should be called TWICE
      // Once for delegation, once to process sub-agent response
      expect(callCount).toBe(2)
      console.log(
        "✅ Router iteration 2 validated: Router processes sub-agent response"
      )
    })
  })

  describe("🔧 Debug Steps Validation", () => {
    it("should create debug step for Router iteration 1 (delegation)", async () => {
      // Test that Router iteration 1 creates proper debug step
      const mockAgent = {
        id: "1",
        type: "ROUTER",
        systemPrompt: "Router prompt",
        model: "openai/gpt-4o-mini",
        temperature: 0.7,
        maxTokens: 2000,
        isActive: true,
      }

      prisma.agentConfig.findFirst.mockResolvedValue(mockAgent)
      prisma.customers.findUnique.mockResolvedValue({
        id: "c1",
        name: "Test",
        workspaceId: "w1",
        language: "it",
        sales: {},
      })
      prisma.customers.findFirst.mockResolvedValue(null)
      prisma.conversations.findFirst.mockResolvedValue({ id: "conv1" })
      prisma.conversationMessages.findMany.mockResolvedValue([])
      prisma.conversationMessages.create.mockResolvedValue({})
      prisma.products.findMany.mockResolvedValue([])
      prisma.categories.findMany.mockResolvedValue([])
      prisma.faq.findMany.mockResolvedValue([])

      const axios = require("axios")
      axios.post
        .mockResolvedValueOnce({
          data: {
            choices: [
              {
                message: {
                  function_call: {
                    name: "productSearchAgent",
                    arguments: JSON.stringify({ query: "test" }),
                  },
                },
              },
            ],
            usage: { total_tokens: 100 },
          },
        })
        .mockResolvedValueOnce({
          data: {
            choices: [
              {
                message: {
                  content: "Final response",
                },
              },
            ],
            usage: { total_tokens: 100 },
          },
        })

      const SafetyTranslationAgent =
        require("../../application/agents/SafetyTranslationAgent").SafetyTranslationAgent
      SafetyTranslationAgent.mockImplementation(() => ({
        process: jest.fn().mockResolvedValue({
          safe: true,
          translatedText: "Risposta",
          tokensUsed: 50,
        }),
      }))

      const {
        LinkReplacementService,
      } = require("../../application/services/link-replacement.service")
      jest
        .spyOn(LinkReplacementService.prototype, "replaceTokens")
        .mockResolvedValue({
          success: true,
          response: "Final",
        })

      const result = await routerService.routeMessage({
        workspaceId: "w1",
        customerId: "c1",
        conversationId: "conv1",
        messageId: "msg1",
        message: "test",
        customerLanguage: "it",
        customerName: "Test",
      })

      const routerIteration1 = result.debugInfo?.steps.find(
        (s) => s.type === "router" && s.output?.decision === "call_function"
      )

      expect(routerIteration1).toBeDefined()
      expect(routerIteration1?.output?.functionCall).toBe("productSearchAgent")
      console.log("✅ Router iteration 1 debug step validated")
    })

    it("should create debug step for sub-agent execution", async () => {
      const mockAgent = {
        id: "1",
        type: "ROUTER",
        systemPrompt: "Router",
        model: "openai/gpt-4o-mini",
        temperature: 0.7,
        maxTokens: 2000,
        isActive: true,
      }

      prisma.agentConfig.findFirst.mockResolvedValue(mockAgent)
      prisma.customers.findUnique.mockResolvedValue({
        id: "c1",
        workspaceId: "w1",
        language: "it",
        sales: {},
      })
      prisma.customers.findFirst.mockResolvedValue(null)
      prisma.conversations.findFirst.mockResolvedValue({ id: "conv1" })
      prisma.conversationMessages.findMany.mockResolvedValue([])
      prisma.conversationMessages.create.mockResolvedValue({})
      prisma.products.findMany.mockResolvedValue([])
      prisma.categories.findMany.mockResolvedValue([])
      prisma.faq.findMany.mockResolvedValue([])

      const axios = require("axios")
      axios.post
        .mockResolvedValueOnce({
          data: {
            choices: [
              {
                message: {
                  function_call: {
                    name: "productSearchAgent",
                    arguments: JSON.stringify({ query: "test" }),
                  },
                },
              },
            ],
            usage: { total_tokens: 100 },
          },
        })
        .mockResolvedValueOnce({
          data: {
            choices: [
              {
                message: { content: "Response" },
              },
            ],
            usage: { total_tokens: 100 },
          },
        })

      const SafetyTranslationAgent =
        require("../../application/agents/SafetyTranslationAgent").SafetyTranslationAgent
      SafetyTranslationAgent.mockImplementation(() => ({
        process: jest.fn().mockResolvedValue({
          safe: true,
          translatedText: "Risposta",
          tokensUsed: 50,
        }),
      }))

      const {
        LinkReplacementService,
      } = require("../../application/services/link-replacement.service")
      jest
        .spyOn(LinkReplacementService.prototype, "replaceTokens")
        .mockResolvedValue({
          success: true,
          response: "Final",
        })

      const result = await routerService.routeMessage({
        workspaceId: "w1",
        customerId: "c1",
        conversationId: "conv1",
        messageId: "msg1",
        message: "test",
        customerLanguage: "it",
        customerName: "Test",
      })

      const subAgentStep = result.debugInfo?.steps.find(
        (s) => (s as any).isSubAgent
      )

      expect(subAgentStep).toBeDefined()
      expect((subAgentStep as any).subAgentType).toBe("PRODUCT_SEARCH")
      console.log("✅ Sub-agent debug step validated")
    })

    it("should create debug step for Safety & Translation", async () => {
      // Similar setup...
      const mockAgent = {
        id: "1",
        type: "ROUTER",
        systemPrompt: "Router",
        model: "openai/gpt-4o-mini",
        temperature: 0.7,
        maxTokens: 2000,
        isActive: true,
      }

      prisma.agentConfig.findFirst.mockResolvedValue(mockAgent)
      prisma.customers.findUnique.mockResolvedValue({
        id: "c1",
        workspaceId: "w1",
        language: "it",
        sales: {},
      })
      prisma.customers.findFirst.mockResolvedValue(null)
      prisma.conversations.findFirst.mockResolvedValue({ id: "conv1" })
      prisma.conversationMessages.findMany.mockResolvedValue([])
      prisma.conversationMessages.create.mockResolvedValue({})
      prisma.products.findMany.mockResolvedValue([])
      prisma.categories.findMany.mockResolvedValue([])
      prisma.faq.findMany.mockResolvedValue([])

      const axios = require("axios")
      axios.post
        .mockResolvedValueOnce({
          data: {
            choices: [
              {
                message: {
                  function_call: {
                    name: "productSearchAgent",
                    arguments: "{}",
                  },
                },
              },
            ],
            usage: { total_tokens: 100 },
          },
        })
        .mockResolvedValueOnce({
          data: {
            choices: [{ message: { content: "English response" } }],
            usage: { total_tokens: 100 },
          },
        })

      const SafetyTranslationAgent =
        require("../../application/agents/SafetyTranslationAgent").SafetyTranslationAgent
      SafetyTranslationAgent.mockImplementation(() => ({
        process: jest.fn().mockResolvedValue({
          safe: true,
          translatedText: "Risposta italiana",
          tokensUsed: 50,
        }),
      }))

      const {
        LinkReplacementService,
      } = require("../../application/services/link-replacement.service")
      jest
        .spyOn(LinkReplacementService.prototype, "replaceTokens")
        .mockResolvedValue({
          success: true,
          response: "Final",
        })

      const result = await routerService.routeMessage({
        workspaceId: "w1",
        customerId: "c1",
        conversationId: "conv1",
        messageId: "msg1",
        message: "test",
        customerLanguage: "it",
        customerName: "Test",
      })

      const safetyStep = result.debugInfo?.steps.find(
        (s) => s.type === "safety"
      )

      expect(safetyStep).toBeDefined()
      expect(safetyStep?.output?.translatedText).toBe("Risposta italiana")
      console.log("✅ Safety & Translation debug step validated")
    })

    it("should create debug step for Link Replacement", async () => {
      const mockAgent = {
        id: "1",
        type: "ROUTER",
        systemPrompt: "Router",
        model: "openai/gpt-4o-mini",
        temperature: 0.7,
        maxTokens: 2000,
        isActive: true,
      }

      prisma.agentConfig.findFirst.mockResolvedValue(mockAgent)
      prisma.customers.findUnique.mockResolvedValue({
        id: "c1",
        workspaceId: "w1",
        language: "it",
        sales: {},
      })
      prisma.customers.findFirst.mockResolvedValue(null)
      prisma.conversations.findFirst.mockResolvedValue({ id: "conv1" })
      prisma.conversationMessages.findMany.mockResolvedValue([])
      prisma.conversationMessages.create.mockResolvedValue({})
      prisma.products.findMany.mockResolvedValue([])
      prisma.categories.findMany.mockResolvedValue([])
      prisma.faq.findMany.mockResolvedValue([])

      const axios = require("axios")
      axios.post
        .mockResolvedValueOnce({
          data: {
            choices: [
              {
                message: {
                  function_call: {
                    name: "productSearchAgent",
                    arguments: "{}",
                  },
                },
              },
            ],
            usage: { total_tokens: 100 },
          },
        })
        .mockResolvedValueOnce({
          data: {
            choices: [
              {
                message: {
                  content: "Response with [LINK_CHECKOUT_WITH_TOKEN]",
                },
              },
            ],
            usage: { total_tokens: 100 },
          },
        })

      const SafetyTranslationAgent =
        require("../../application/agents/SafetyTranslationAgent").SafetyTranslationAgent
      SafetyTranslationAgent.mockImplementation(() => ({
        process: jest.fn().mockResolvedValue({
          safe: true,
          translatedText: "Risposta con [LINK_CHECKOUT_WITH_TOKEN]",
          tokensUsed: 50,
        }),
      }))

      const {
        LinkReplacementService,
      } = require("../../application/services/link-replacement.service")
      jest
        .spyOn(LinkReplacementService.prototype, "replaceTokens")
        .mockResolvedValue({
          success: true,
          response: "Risposta con https://shopme.com/cart?token=xyz",
        })

      const result = await routerService.routeMessage({
        workspaceId: "w1",
        customerId: "c1",
        conversationId: "conv1",
        messageId: "msg1",
        message: "test",
        customerLanguage: "it",
        customerName: "Test",
      })

      const linkReplacementStep = result.debugInfo?.steps.find(
        (s) => s.type === "token-replacement"
      )

      expect(linkReplacementStep).toBeDefined()
      expect(linkReplacementStep?.input?.tokensDetected).toContain(
        "[LINK_CHECKOUT_WITH_TOKEN]"
      )
      console.log("✅ Link Replacement debug step validated")
    })
  })

  describe("🚨 CRITICAL: Flow Order Validation", () => {
    it("should execute steps in EXACT order: Router → Sub-Agent → Router → Safety → Link", async () => {
      const mockAgent = {
        id: "1",
        type: "ROUTER",
        systemPrompt: "Router",
        model: "openai/gpt-4o-mini",
        temperature: 0.7,
        maxTokens: 2000,
        isActive: true,
      }

      prisma.agentConfig.findFirst.mockResolvedValue(mockAgent)
      prisma.customers.findUnique.mockResolvedValue({
        id: "c1",
        workspaceId: "w1",
        language: "it",
        sales: {},
      })
      prisma.customers.findFirst.mockResolvedValue(null)
      prisma.conversations.findFirst.mockResolvedValue({ id: "conv1" })
      prisma.conversationMessages.findMany.mockResolvedValue([])
      prisma.conversationMessages.create.mockResolvedValue({})
      prisma.products.findMany.mockResolvedValue([])
      prisma.categories.findMany.mockResolvedValue([])
      prisma.faq.findMany.mockResolvedValue([])

      const axios = require("axios")
      axios.post
        .mockResolvedValueOnce({
          data: {
            choices: [
              {
                message: {
                  function_call: {
                    name: "productSearchAgent",
                    arguments: "{}",
                  },
                },
              },
            ],
            usage: { total_tokens: 100 },
          },
        })
        .mockResolvedValueOnce({
          data: {
            choices: [{ message: { content: "Final [LINK_TOKEN]" } }],
            usage: { total_tokens: 100 },
          },
        })

      const SafetyTranslationAgent =
        require("../../application/agents/SafetyTranslationAgent").SafetyTranslationAgent
      SafetyTranslationAgent.mockImplementation(() => ({
        process: jest.fn().mockResolvedValue({
          safe: true,
          translatedText: "Finale [LINK_TOKEN]",
          tokensUsed: 50,
        }),
      }))

      const {
        LinkReplacementService,
      } = require("../../application/services/link-replacement.service")
      jest
        .spyOn(LinkReplacementService.prototype, "replaceTokens")
        .mockResolvedValue({
          success: true,
          response: "Finale https://link",
        })

      const result = await routerService.routeMessage({
        workspaceId: "w1",
        customerId: "c1",
        conversationId: "conv1",
        messageId: "msg1",
        message: "test",
        customerLanguage: "it",
        customerName: "Test",
      })

      const steps = result.debugInfo!.steps

      // Find step indices
      const routerIterationIndices = steps
        .map((s, idx) => (s.type === "router" ? idx : -1))
        .filter((idx) => idx !== -1)

      const subAgentIndex = steps.findIndex((s) => (s as any).isSubAgent)
      const safetyIndex = steps.findIndex((s) => s.type === "safety")
      const linkReplacementIndex = steps.findIndex(
        (s) => s.type === "token-replacement"
      )

      // ✅ CRITICAL: Validate order
      expect(routerIterationIndices.length).toBeGreaterThanOrEqual(2)
      expect(routerIterationIndices[0]).toBeLessThan(subAgentIndex) // Router iteration 1 before sub-agent
      expect(subAgentIndex).toBeLessThan(routerIterationIndices[1]) // Sub-agent before Router iteration 2
      expect(routerIterationIndices[1]).toBeLessThan(safetyIndex) // Router iteration 2 before Safety
      expect(safetyIndex).toBeLessThan(linkReplacementIndex) // Safety before Link Replacement

      console.log(
        "✅ Step order validated: Router → Sub-Agent → Router → Safety → Link"
      )
    })
  })
})
