/**
 * T014: Integration test for handler routing
 * End-to-end routing: intent → handler selection → response
 */

import { SimpleIntentHandler } from "../../../src/application/chat-engine/handlers/simple-intent.handler"
import { LLMIntentHandler } from "../../../src/application/chat-engine/handlers/llm-intent.handler"
import { Intent, HandlerResult } from "../../../src/domain/entities/routing.entity"
import {
  SimpleIntentHandlerContext,
  LLMIntentHandlerContext,
} from "../../../src/domain/entities/handler-context.entity"

describe("Handler Routing Integration", () => {
  let simpleHandler: SimpleIntentHandler
  let llmHandler: LLMIntentHandler
  let mockLLMRouter: any

  beforeEach(() => {
    simpleHandler = new SimpleIntentHandler()

    mockLLMRouter = {
      routeMessage: jest.fn().mockResolvedValue({
        message: "Risposta da agent",
        agentUsed: "SPECIALIST",
      }),
    }

    llmHandler = new LLMIntentHandler(mockLLMRouter)
  })

  describe("Simple Intent Routing", () => {
    it("should route SHOW_PRODUCTS through SimpleHandler", async () => {
      const intent: Intent = {
        type: "SHOW_PRODUCTS",
        confidence: 0.95,
        source: "PATTERN",
      }

      const context: SimpleIntentHandlerContext = {
        message: "mostra prodotti",
        customerId: "cust-1",
        conversationId: "conv-1",
        workspaceId: "ws-1",
        workspace: {
          workspaceId: "ws-1",
          enableProducts: true,
          enableFAQ: true,
          enableServices: true,
          enableOffers: true,
          defaultPath: "LLM",
          preferredLanguage: "it",
        },
        loadedData: {
          products: [
            { id: "p1", name: "Prodotto 1", price: 100 },
            { id: "p2", name: "Prodotto 2", price: 200 },
          ],
          faqs: [],
          services: [],
          offers: [],
        },
      }

      const result: HandlerResult = await simpleHandler.handle(intent, context)

      expect(result.agentUsed).toBe("SIMPLE")
      expect(result.message).toContain("prodotti")
      expect(result.confidence).toBe(0.95)
    })

    it("should route ADD_TO_CART through SimpleHandler", async () => {
      const intent: Intent = {
        type: "ADD_TO_CART",
        confidence: 0.9,
        source: "PATTERN",
      }

      const context: SimpleIntentHandlerContext = {
        message: "aggiungi 2 prodotti al carrello",
        customerId: "cust-1",
        conversationId: "conv-1",
        workspaceId: "ws-1",
        workspace: {
          workspaceId: "ws-1",
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

      const result: HandlerResult = await simpleHandler.handle(intent, context)

      expect(result.agentUsed).toBe("SIMPLE")
      expect(result.message).toContain("carrello")
    })

    it("should route REPEAT_ORDER through SimpleHandler", async () => {
      const intent: Intent = {
        type: "REPEAT_ORDER",
        confidence: 0.88,
        source: "PATTERN",
      }

      const context: SimpleIntentHandlerContext = {
        message: "ripeti ordine",
        customerId: "cust-1",
        conversationId: "conv-1",
        workspaceId: "ws-1",
        workspace: {
          workspaceId: "ws-1",
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

      const result: HandlerResult = await simpleHandler.handle(intent, context)

      expect(result.agentUsed).toBe("SIMPLE")
      expect(result.message).toContain("ordine")
    })

    it("should route VIEW_CART through SimpleHandler", async () => {
      const intent: Intent = {
        type: "VIEW_CART",
        confidence: 0.85,
        source: "KEYWORD",
      }

      const context: SimpleIntentHandlerContext = {
        message: "vedi carrello",
        customerId: "cust-1",
        conversationId: "conv-1",
        workspaceId: "ws-1",
        workspace: {
          workspaceId: "ws-1",
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

      const result: HandlerResult = await simpleHandler.handle(intent, context)

      expect(result.agentUsed).toBe("SIMPLE")
      expect(result.message).toContain("carrello")
    })

    it("should route CONTINUE_CHECKOUT through SimpleHandler", async () => {
      const intent: Intent = {
        type: "CONTINUE_CHECKOUT",
        confidence: 0.9,
        source: "PATTERN",
      }

      const context: SimpleIntentHandlerContext = {
        message: "procedi pagamento",
        customerId: "cust-1",
        conversationId: "conv-1",
        workspaceId: "ws-1",
        workspace: {
          workspaceId: "ws-1",
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

      const result: HandlerResult = await simpleHandler.handle(intent, context)

      expect(result.agentUsed).toBe("SIMPLE")
      expect(result.message).toContain("pagamento")
    })
  })

  describe("LLM Intent Routing", () => {
    it("should route INCOMPREHENSIBLE through LLMHandler", async () => {
      const intent: Intent = {
        type: "INCOMPREHENSIBLE",
        confidence: 0,
        source: "LLM",
      }

      const context: LLMIntentHandlerContext = {
        message: "Qual è il miglior prodotto per me?",
        customerId: "cust-1",
        conversationId: "conv-1",
        workspaceId: "ws-1",
        workspace: {
          workspaceId: "ws-1",
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

      const result: HandlerResult = await llmHandler.handle(intent, context)

      expect(result.agentUsed).toBe("LLM")
      expect(mockLLMRouter.routeMessage).toHaveBeenCalled()
    })
  })

  describe("Response Structure Consistency", () => {
    it("should ensure all handlers return consistent HandlerResult", async () => {
      const simpleIntent: Intent = {
        type: "SHOW_PRODUCTS",
        confidence: 0.9,
        source: "PATTERN",
      }

      const simpleContext: SimpleIntentHandlerContext = {
        message: "mostra prodotti",
        customerId: "cust-1",
        conversationId: "conv-1",
        workspaceId: "ws-1",
        workspace: {
          workspaceId: "ws-1",
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

      const llmIntent: Intent = {
        type: "INCOMPREHENSIBLE",
        confidence: 0,
        source: "LLM",
      }

      const llmContext: LLMIntentHandlerContext = {
        message: "Aiutami a scegliere",
        customerId: "cust-1",
        conversationId: "conv-1",
        workspaceId: "ws-1",
        workspace: {
          workspaceId: "ws-1",
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

      const simpleResult = await simpleHandler.handle(simpleIntent, simpleContext)
      const llmResult = await llmHandler.handle(llmIntent, llmContext)

      // Both should have same structure
      expect(simpleResult).toHaveProperty("message")
      expect(simpleResult).toHaveProperty("agentUsed")
      expect(simpleResult).toHaveProperty("workspaceId")
      expect(simpleResult).toHaveProperty("customerId")
      expect(simpleResult).toHaveProperty("conversationId")
      expect(simpleResult).toHaveProperty("confidence")
      expect(simpleResult).toHaveProperty("metadata")

      expect(llmResult).toHaveProperty("message")
      expect(llmResult).toHaveProperty("agentUsed")
      expect(llmResult).toHaveProperty("workspaceId")
      expect(llmResult).toHaveProperty("customerId")
      expect(llmResult).toHaveProperty("conversationId")
      expect(llmResult).toHaveProperty("confidence")
      expect(llmResult).toHaveProperty("metadata")
    })
  })

  describe("Workspace Isolation", () => {
    it("should preserve workspace IDs across different intents", async () => {
      const intent1: Intent = {
        type: "SHOW_PRODUCTS",
        confidence: 0.9,
        source: "PATTERN",
      }

      const context1: SimpleIntentHandlerContext = {
        message: "mostra",
        customerId: "cust-ws1",
        conversationId: "conv-ws1",
        workspaceId: "ws-workspace-1",
        workspace: {
          workspaceId: "ws-workspace-1",
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

      const result1 = await simpleHandler.handle(intent1, context1)
      expect(result1.workspaceId).toBe("ws-workspace-1")

      const intent2: Intent = {
        type: "SHOW_PRODUCTS",
        confidence: 0.9,
        source: "PATTERN",
      }

      const context2: SimpleIntentHandlerContext = {
        message: "mostra",
        customerId: "cust-ws2",
        conversationId: "conv-ws2",
        workspaceId: "ws-workspace-2",
        workspace: {
          workspaceId: "ws-workspace-2",
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

      const result2 = await simpleHandler.handle(intent2, context2)
      expect(result2.workspaceId).toBe("ws-workspace-2")

      // Ensure no data leakage
      expect(result1.workspaceId).not.toBe(result2.workspaceId)
    })
  })
})
