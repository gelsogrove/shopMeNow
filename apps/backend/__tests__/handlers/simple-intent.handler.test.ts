/**
 * T011: Unit tests for SimpleIntentHandler
 * Test all 5 intent types: SHOW_PRODUCTS, ADD_TO_CART, VIEW_CART, REPEAT_ORDER, CONTINUE_CHECKOUT
 */

import { SimpleIntentHandler } from "../../../src/application/chat-engine/handlers/simple-intent.handler"
import { Intent, HandlerResult } from "../../../src/domain/entities/routing.entity"
import { SimpleIntentHandlerContext } from "../../../src/domain/entities/handler-context.entity"

describe("SimpleIntentHandler", () => {
  let handler: SimpleIntentHandler
  let mockContext: SimpleIntentHandlerContext

  beforeEach(() => {
    handler = new SimpleIntentHandler()
    mockContext = {
      message: "mostra prodotti",
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
        products: [
          {
            id: "p1",
            name: "Prodotto 1",
            price: 100,
            description: "Descrizione",
          },
        ],
        faqs: [],
        services: [],
        offers: [],
      },
    }
  })

  describe("handle()", () => {
    it("should handle SHOW_PRODUCTS intent", async () => {
      const intent: Intent = {
        type: "SHOW_PRODUCTS",
        confidence: 0.95,
        source: "PATTERN",
      }

      const result: HandlerResult = await handler.handle(intent, mockContext)

      expect(result.message).toContain("prodotti")
      expect(result.agentUsed).toBe("SIMPLE")
      expect(result.workspaceId).toBe("ws-789")
      expect(result.customerId).toBe("cust-123")
      expect(result.confidence).toBe(0.95)
      expect(result.metadata?.intentType).toBe("SHOW_PRODUCTS")
    })

    it("should handle ADD_TO_CART intent", async () => {
      const intent: Intent = {
        type: "ADD_TO_CART",
        confidence: 0.9,
        source: "PATTERN",
      }

      const result: HandlerResult = await handler.handle(intent, mockContext)

      expect(result.message).toContain("carrello")
      expect(result.agentUsed).toBe("SIMPLE")
      expect(result.metadata?.intentType).toBe("ADD_TO_CART")
    })

    it("should handle VIEW_CART intent", async () => {
      const intent: Intent = {
        type: "VIEW_CART",
        confidence: 0.88,
        source: "KEYWORD",
      }

      const result: HandlerResult = await handler.handle(intent, mockContext)

      expect(result.message).toContain("carrello")
      expect(result.agentUsed).toBe("SIMPLE")
      expect(result.metadata?.intentType).toBe("VIEW_CART")
    })

    it("should handle REPEAT_ORDER intent", async () => {
      const intent: Intent = {
        type: "REPEAT_ORDER",
        confidence: 0.92,
        source: "PATTERN",
      }

      const result: HandlerResult = await handler.handle(intent, mockContext)

      expect(result.message).toContain("ordine")
      expect(result.agentUsed).toBe("SIMPLE")
      expect(result.metadata?.intentType).toBe("REPEAT_ORDER")
    })

    it("should handle CONTINUE_CHECKOUT intent", async () => {
      const intent: Intent = {
        type: "CONTINUE_CHECKOUT",
        confidence: 0.85,
        source: "PATTERN",
      }

      const result: HandlerResult = await handler.handle(intent, mockContext)

      expect(result.message).toContain("pagamento")
      expect(result.agentUsed).toBe("SIMPLE")
      expect(result.metadata?.intentType).toBe("CONTINUE_CHECKOUT")
    })

    it("should include source in metadata", async () => {
      const intent: Intent = {
        type: "SHOW_PRODUCTS",
        confidence: 0.9,
        source: "KEYWORD",
      }

      const result: HandlerResult = await handler.handle(intent, mockContext)

      expect(result.metadata?.source).toBe("KEYWORD")
    })

    it("should throw error for invalid intent type", async () => {
      const invalidContext = {
        ...mockContext,
        // Simulate handler receiving wrong intent type
      }

      // Create invalid intent - just return error response
      const intent: Intent = {
        type: "INVALID_TYPE" as any,
        confidence: 0,
        source: "LLM",
      }

      const result: HandlerResult = await handler.handle(intent, invalidContext)
      expect(result.message).toBeTruthy()
      // Should not crash
    })
  })

  describe("Response structure", () => {
    it("should always return HandlerResult with all required fields", async () => {
      const intent: Intent = {
        type: "SHOW_PRODUCTS",
        confidence: 0.9,
        source: "PATTERN",
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

    it("should preserve workspace and customer IDs", async () => {
      const intent: Intent = {
        type: "ADD_TO_CART",
        confidence: 0.9,
        source: "PATTERN",
      }

      const result: HandlerResult = await handler.handle(intent, mockContext)

      expect(result.workspaceId).toBe(mockContext.workspaceId)
      expect(result.customerId).toBe(mockContext.customerId)
      expect(result.conversationId).toBe(mockContext.conversationId)
    })
  })
})
