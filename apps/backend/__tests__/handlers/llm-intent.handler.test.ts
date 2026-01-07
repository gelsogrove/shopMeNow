/**
 * T012: Unit tests for LLMIntentHandler
 * Test delegation to LLMRouterService for unknown intents
 */

import { LLMIntentHandler } from "../../../src/application/chat-engine/handlers/llm-intent.handler"
import { Intent, HandlerResult } from "../../../src/domain/entities/routing.entity"
import { LLMIntentHandlerContext } from "../../../src/domain/entities/handler-context.entity"

describe("LLMIntentHandler", () => {
  let handler: LLMIntentHandler
  let mockLLMRouterService: any
  let mockContext: LLMIntentHandlerContext

  beforeEach(() => {
    mockLLMRouterService = {
      routeMessage: jest.fn().mockResolvedValue({
        message: "Risposta da specialist agent",
        agentUsed: "PRODUCT_SEARCH",
      }),
    }

    handler = new LLMIntentHandler(mockLLMRouterService)

    mockContext = {
      message: "Qual è il miglior prodotto?",
      customerId: "cust-123",
      conversationId: "conv-456",
      workspaceId: "ws-789",
      workspace: {
        workspaceId: "ws-789",
        enableProducts: true,
        enableFAQ: true,
        enableServices: true,
        enableOffers: true,
        defaultPath: "LLM",
        preferredLanguage: "it",
      },
      loadedData: {
        products: [],
        faqs: [],
        services: [],
        offers: [],
      },
    }
  })

  describe("handle()", () => {
    it("should delegate INCOMPREHENSIBLE intent to LLMRouterService", async () => {
      const intent: Intent = {
        type: "INCOMPREHENSIBLE",
        confidence: 0,
        source: "LLM",
      }

      const result: HandlerResult = await handler.handle(intent, mockContext)

      expect(mockLLMRouterService.routeMessage).toHaveBeenCalledWith({
        message: mockContext.message,
        customerId: mockContext.customerId,
        conversationId: mockContext.conversationId,
        workspaceId: mockContext.workspaceId,
        conversationHistory: mockContext.conversationHistory,
      })

      expect(result.agentUsed).toBe("LLM")
      expect(result.message).toBe("Risposta da specialist agent")
    })

    it("should include delegated agent info in metadata", async () => {
      const intent: Intent = {
        type: "INCOMPREHENSIBLE",
        confidence: 0,
        source: "LLM",
      }

      const result: HandlerResult = await handler.handle(intent, mockContext)

      expect(result.metadata?.delegatedAgent).toBe("PRODUCT_SEARCH")
      expect(result.metadata?.source).toBe("LLM")
    })

    it("should preserve workspace and customer IDs in response", async () => {
      const intent: Intent = {
        type: "INCOMPREHENSIBLE",
        confidence: 0,
        source: "LLM",
      }

      const result: HandlerResult = await handler.handle(intent, mockContext)

      expect(result.workspaceId).toBe(mockContext.workspaceId)
      expect(result.customerId).toBe(mockContext.customerId)
      expect(result.conversationId).toBe(mockContext.conversationId)
    })

    it("should pass conversation history to LLMRouter", async () => {
      const history = [
        { role: "customer" as const, content: "Ciao" },
        { role: "bot" as const, content: "Ciao! Come posso aiutarti?" },
      ]

      const contextWithHistory = {
        ...mockContext,
        conversationHistory: history,
      }

      const intent: Intent = {
        type: "INCOMPREHENSIBLE",
        confidence: 0,
        source: "LLM",
      }

      await handler.handle(intent, contextWithHistory)

      expect(mockLLMRouterService.routeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationHistory: history,
        })
      )
    })

    it("should return HandlerResult with all required fields", async () => {
      const intent: Intent = {
        type: "INCOMPREHENSIBLE",
        confidence: 0,
        source: "LLM",
      }

      const result: HandlerResult = await handler.handle(intent, mockContext)

      expect(result).toHaveProperty("message")
      expect(result).toHaveProperty("agentUsed")
      expect(result).toHaveProperty("workspaceId")
      expect(result).toHaveProperty("customerId")
      expect(result).toHaveProperty("conversationId")
      expect(result).toHaveProperty("confidence")
      expect(result).toHaveProperty("metadata")
    })

    it("should throw error if LLMRouterService not injected", async () => {
      const handlerWithoutRouter = new LLMIntentHandler(undefined)

      const intent: Intent = {
        type: "INCOMPREHENSIBLE",
        confidence: 0,
        source: "LLM",
      }

      await expect(
        handlerWithoutRouter.handle(intent, mockContext)
      ).rejects.toThrow("LLMRouterService not injected")
    })

    it("should handle LLMRouterService errors gracefully", async () => {
      const errorService = {
        routeMessage: jest.fn().mockRejectedValue(new Error("Router failed")),
      }

      const errorHandler = new LLMIntentHandler(errorService)

      const intent: Intent = {
        type: "INCOMPREHENSIBLE",
        confidence: 0,
        source: "LLM",
      }

      await expect(errorHandler.handle(intent, mockContext)).rejects.toThrow(
        "Router failed"
      )
    })
  })

  describe("Response structure", () => {
    it("should set agentUsed to LLM", async () => {
      const intent: Intent = {
        type: "INCOMPREHENSIBLE",
        confidence: 0,
        source: "LLM",
      }

      const result: HandlerResult = await handler.handle(intent, mockContext)

      expect(result.agentUsed).toBe("LLM")
    })

    it("should preserve confidence from intent", async () => {
      mockLLMRouterService.routeMessage.mockResolvedValue({
        message: "Risposta",
        agentUsed: "PRODUCT_SEARCH",
      })

      const intent: Intent = {
        type: "INCOMPREHENSIBLE",
        confidence: 0.5, // Even though confidence is 0 for INCOMPREHENSIBLE
        source: "LLM",
      }

      const result: HandlerResult = await handler.handle(intent, mockContext)

      expect(result.confidence).toBe(0.5)
    })
  })
})
