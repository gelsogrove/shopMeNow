/**
 * T017: Integration test for unified routing
 * Tests: Message → UnifiedRoutingService → Decision + Data Loading
 */

import { UnifiedRoutingService } from "../../../src/application/services/unified-routing.service"
import {
  Intent,
  RoutingContext,
  RoutingDecision,
} from "../../../src/domain/entities/routing.entity"

describe("UnifiedRoutingService Integration", () => {
  let service: UnifiedRoutingService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      workspace: {
        findUnique: jest.fn().mockResolvedValue({
          id: "ws-1",
          preferredLanguage: "it",
        }),
      },
      products: {
        findMany: jest.fn().mockResolvedValue([
          { id: "p1", name: "Prodotto 1", price: 100 },
          { id: "p2", name: "Prodotto 2", price: 200 },
        ]),
      },
      fAQ: {
        findMany: jest.fn().mockResolvedValue([
          { id: "faq1", question: "Domanda?", answer: "Risposta!" },
        ]),
      },
      services: {
        findMany: jest.fn().mockResolvedValue([
          { id: "s1", name: "Servizio 1" },
        ]),
      },
      offers: {
        findMany: jest.fn().mockResolvedValue([
          { id: "o1", name: "Offerta 1", discount: 10 },
        ]),
      },
    }

    service = new UnifiedRoutingService(mockPrisma)
  })

  describe("Unified routing flow", () => {
    it("should detect intent and load data for SHOW_PRODUCTS", async () => {
      const context: RoutingContext = {
        message: "mostra prodotti",
        customerId: "cust-1",
        conversationId: "conv-1",
        workspaceId: "ws-1",
      }

      // Detect intent
      const intent: Intent = await service.detectIntent(context)
      expect(intent.type).toBeDefined()

      // Select path
      const workspace = await service.getWorkspace("ws-1")
      const path = service.selectRoutingPath(workspace, intent)
      expect(path).toMatch(/SIMPLE|LLM|FAQ/)

      // Load data
      const loadedData = await service.loadDataForIntent(workspace, intent)
      expect(loadedData).toBeDefined()
    })

    it("should handle INCOMPREHENSIBLE intents routing to LLM", async () => {
      const intent: Intent = {
        type: "INCOMPREHENSIBLE",
        confidence: 0,
        source: "LLM",
      }

      const workspace = {
        workspaceId: "ws-1",
        enableProducts: true,
        enableFAQ: true,
        enableServices: true,
        enableOffers: true,
        defaultPath: "LLM" as const,
        preferredLanguage: "it",
      }

      const path = service.selectRoutingPath(workspace, intent)
      expect(path).toBe("LLM")
    })

    it("should route pattern-matched intents to SIMPLE", async () => {
      const intent: Intent = {
        type: "SHOW_PRODUCTS",
        confidence: 0.95,
        source: "PATTERN",
      }

      const workspace = {
        workspaceId: "ws-1",
        enableProducts: true,
        enableFAQ: true,
        enableServices: true,
        enableOffers: true,
        defaultPath: "LLM" as const,
        preferredLanguage: "it",
      }

      const path = service.selectRoutingPath(workspace, intent)
      expect(path).toBe("SIMPLE")
    })

    it("should load workspace with caching", async () => {
      // First call
      const workspace1 = await service.getWorkspace("ws-1")
      expect(mockPrisma.workspace.findUnique).toHaveBeenCalledTimes(1)

      // Second call should use cache
      const workspace2 = await service.getWorkspace("ws-1")
      expect(mockPrisma.workspace.findUnique).toHaveBeenCalledTimes(1) // Still 1
      expect(workspace1).toEqual(workspace2)
    })

    it("should load data selectively based on intent type", async () => {
      const workspace = {
        workspaceId: "ws-1",
        enableProducts: true,
        enableFAQ: true,
        enableServices: true,
        enableOffers: true,
        defaultPath: "LLM" as const,
        preferredLanguage: "it",
      }

      const showProductsIntent: Intent = {
        type: "SHOW_PRODUCTS",
        confidence: 0.95,
        source: "PATTERN",
      }

      const data = await service.loadDataForIntent(
        workspace,
        showProductsIntent
      )

      expect(data.products).toBeDefined()
      expect(mockPrisma.products.findMany).toHaveBeenCalled()
    })
  })

  describe("Structured logging", () => {
    it("should log complete routing decisions", async () => {
      const decision: RoutingDecision = {
        intent: {
          type: "SHOW_PRODUCTS",
          confidence: 0.95,
          source: "PATTERN",
        },
        path: "SIMPLE",
        workspace: {
          workspaceId: "ws-1",
          enableProducts: true,
          enableFAQ: true,
          enableServices: true,
          enableOffers: true,
          defaultPath: "LLM",
          preferredLanguage: "it",
        },
        confidence: 0.95,
        source: "PATTERN",
        timestamp: new Date(),
        dataLoaded: {
          workspace: true,
          products: true,
          faqs: false,
          services: false,
          offers: false,
        },
      }

      // Should not throw
      expect(() => service.logRoutingDecision(decision)).not.toThrow()
    })
  })

  describe("Workspace isolation", () => {
    it("should maintain workspace boundaries in queries", async () => {
      const workspace = {
        workspaceId: "ws-1",
        enableProducts: true,
        enableFAQ: true,
        enableServices: true,
        enableOffers: true,
        defaultPath: "LLM" as const,
        preferredLanguage: "it",
      }

      const intent: Intent = {
        type: "SHOW_PRODUCTS",
        confidence: 0.95,
        source: "PATTERN",
      }

      await service.loadDataForIntent(workspace, intent)

      // Verify workspaceId is in all queries
      expect(mockPrisma.products.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: "ws-1",
          }),
        })
      )
    })
  })
})
