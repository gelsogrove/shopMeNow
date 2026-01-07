/**
 * T019: Multi-workspace isolation test
 * Validates: No data bleeding between 3+ workspaces
 */

import { UnifiedRoutingService } from "../../../src/application/services/unified-routing.service"
import { Intent } from "../../../src/domain/entities/routing.entity"

describe("Multi-workspace Isolation", () => {
  let service: UnifiedRoutingService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      workspace: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const workspaceId = where.id
          const workspaces: Record<string, any> = {
            "ws-1": {
              id: "ws-1",
              preferredLanguage: "it",
              enableProducts: true,
            },
            "ws-2": {
              id: "ws-2",
              preferredLanguage: "en",
              enableProducts: true,
            },
            "ws-3": {
              id: "ws-3",
              preferredLanguage: "es",
              enableProducts: false,
            },
          }
          return Promise.resolve(workspaces[workspaceId])
        }),
      },
      products: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          const workspaceId = where.workspaceId
          const products: Record<string, any[]> = {
            "ws-1": [
              { id: "p1", workspaceId: "ws-1", name: "Prodotto WS1" },
            ],
            "ws-2": [
              { id: "p2", workspaceId: "ws-2", name: "Product WS2" },
            ],
            "ws-3": [],
          }
          return Promise.resolve(products[workspaceId] || [])
        }),
      },
      fAQ: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          const workspaceId = where.workspaceId
          const faqs: Record<string, any[]> = {
            "ws-1": [
              {
                id: "faq1",
                workspaceId: "ws-1",
                question: "Domanda WS1?",
              },
            ],
            "ws-2": [
              {
                id: "faq2",
                workspaceId: "ws-2",
                question: "Question WS2?",
              },
            ],
            "ws-3": [
              {
                id: "faq3",
                workspaceId: "ws-3",
                question: "Pregunta WS3?",
              },
            ],
          }
          return Promise.resolve(faqs[workspaceId] || [])
        }),
      },
      services: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          const workspaceId = where.workspaceId
          const services: Record<string, any[]> = {
            "ws-1": [{ id: "s1", workspaceId: "ws-1", name: "Servizio WS1" }],
            "ws-2": [{ id: "s2", workspaceId: "ws-2", name: "Service WS2" }],
            "ws-3": [],
          }
          return Promise.resolve(services[workspaceId] || [])
        }),
      },
      offers: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          const workspaceId = where.workspaceId
          const offers: Record<string, any[]> = {
            "ws-1": [
              { id: "o1", workspaceId: "ws-1", name: "Offerta WS1" },
            ],
            "ws-2": [{ id: "o2", workspaceId: "ws-2", name: "Offer WS2" }],
            "ws-3": [],
          }
          return Promise.resolve(offers[workspaceId] || [])
        }),
      },
    }

    service = new UnifiedRoutingService(mockPrisma)
  })

  describe("Data isolation", () => {
    it("should load workspace-1 data without interference", async () => {
      const intent: Intent = {
        type: "SHOW_PRODUCTS",
        confidence: 0.95,
        source: "PATTERN",
      }

      const workspace = await service.getWorkspace("ws-1")
      const data = await service.loadDataForIntent(workspace, intent)

      expect(data.products).toHaveLength(1)
      expect(data.products[0].workspaceId).toBe("ws-1")
      expect(data.products[0].name).toBe("Prodotto WS1")
    })

    it("should load workspace-2 data without interference", async () => {
      const intent: Intent = {
        type: "SHOW_PRODUCTS",
        confidence: 0.95,
        source: "PATTERN",
      }

      const workspace = await service.getWorkspace("ws-2")
      const data = await service.loadDataForIntent(workspace, intent)

      expect(data.products).toHaveLength(1)
      expect(data.products[0].workspaceId).toBe("ws-2")
      expect(data.products[0].name).toBe("Product WS2")
    })

    it("should load workspace-3 data (disabled products)", async () => {
      const intent: Intent = {
        type: "SHOW_PRODUCTS",
        confidence: 0.95,
        source: "PATTERN",
      }

      const workspace = await service.getWorkspace("ws-3")
      const data = await service.loadDataForIntent(workspace, intent)

      expect(data.products).toHaveLength(0) // Disabled
    })

    it("should not mix data between workspaces", async () => {
      const intent: Intent = {
        type: "SHOW_PRODUCTS",
        confidence: 0.95,
        source: "PATTERN",
      }

      // Load WS1 and WS2 products
      const ws1 = await service.getWorkspace("ws-1")
      const ws1Data = await service.loadDataForIntent(ws1, intent)

      const ws2 = await service.getWorkspace("ws-2")
      const ws2Data = await service.loadDataForIntent(ws2, intent)

      // Verify no cross-contamination
      expect(ws1Data.products.every((p: any) => p.workspaceId === "ws-1")).toBe(
        true
      )
      expect(ws2Data.products.every((p: any) => p.workspaceId === "ws-2")).toBe(
        true
      )
    })
  })

  describe("Multi-language support isolation", () => {
    it("should preserve workspace language preference (IT)", async () => {
      const workspace = await service.getWorkspace("ws-1")
      expect(workspace.preferredLanguage).toBe("it")
    })

    it("should preserve workspace language preference (EN)", async () => {
      const workspace = await service.getWorkspace("ws-2")
      expect(workspace.preferredLanguage).toBe("en")
    })

    it("should preserve workspace language preference (ES)", async () => {
      const workspace = await service.getWorkspace("ws-3")
      expect(workspace.preferredLanguage).toBe("es")
    })
  })

  describe("Concurrent multi-workspace requests", () => {
    it("should handle concurrent requests from 3 workspaces", async () => {
      const intent: Intent = {
        type: "SHOW_PRODUCTS",
        confidence: 0.95,
        source: "PATTERN",
      }

      const [ws1, ws2, ws3] = await Promise.all([
        service.getWorkspace("ws-1"),
        service.getWorkspace("ws-2"),
        service.getWorkspace("ws-3"),
      ])

      expect(ws1.id).toBe("ws-1")
      expect(ws2.id).toBe("ws-2")
      expect(ws3.id).toBe("ws-3")

      // Each should have their own data
      const [data1, data2, data3] = await Promise.all([
        service.loadDataForIntent(ws1, intent),
        service.loadDataForIntent(ws2, intent),
        service.loadDataForIntent(ws3, intent),
      ])

      expect(data1.products[0].workspaceId).toBe("ws-1")
      expect(data2.products[0].workspaceId).toBe("ws-2")
      expect(data3.products).toHaveLength(0) // Disabled
    })

    it("should verify workspace isolation in queries", async () => {
      const intent: Intent = {
        type: "SHOW_PRODUCTS",
        confidence: 0.95,
        source: "PATTERN",
      }

      const ws1 = await service.getWorkspace("ws-1")
      await service.loadDataForIntent(ws1, intent)

      // Check that findMany was called with workspaceId filter
      expect(mockPrisma.products.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: "ws-1",
          }),
        })
      )

      const ws2 = await service.getWorkspace("ws-2")
      await service.loadDataForIntent(ws2, intent)

      // Check that findMany was called with workspaceId filter for ws-2
      expect(mockPrisma.products.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: "ws-2",
          }),
        })
      )
    })
  })

  describe("Workspace feature toggles", () => {
    it("should respect workspace-level feature flags", async () => {
      const ws1 = await service.getWorkspace("ws-1")
      expect(ws1.enableProducts).toBe(true)

      const ws3 = await service.getWorkspace("ws-3")
      expect(ws3.enableProducts).toBe(false)
    })
  })
})
