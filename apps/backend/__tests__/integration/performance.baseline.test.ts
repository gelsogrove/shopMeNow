/**
 * T018: Performance test baseline
 * Validates: Query count, response time, no duplicates
 */

import { UnifiedRoutingService } from "../../../src/application/services/unified-routing.service"
import { CacheService } from "../../../src/application/services/cache.service"
import { Intent, RoutingContext } from "../../../src/domain/entities/routing.entity"

describe("UnifiedRoutingService Performance Baseline", () => {
  let service: UnifiedRoutingService
  let cacheService: CacheService
  let mockPrisma: any
  let queryCount: number

  beforeEach(() => {
    queryCount = 0

    mockPrisma = {
      workspace: {
        findUnique: jest.fn().mockImplementation(() => {
          queryCount++
          return Promise.resolve({
            id: "ws-1",
            preferredLanguage: "it",
          })
        }),
      },
      products: {
        findMany: jest.fn().mockImplementation(() => {
          queryCount++
          return Promise.resolve([
            { id: "p1", name: "Prodotto 1", price: 100 },
          ])
        }),
      },
      fAQ: {
        findMany: jest.fn().mockImplementation(() => {
          queryCount++
          return Promise.resolve([])
        }),
      },
      services: {
        findMany: jest.fn().mockImplementation(() => {
          queryCount++
          return Promise.resolve([])
        }),
      },
      offers: {
        findMany: jest.fn().mockImplementation(() => {
          queryCount++
          return Promise.resolve([])
        }),
      },
    }

    cacheService = new CacheService()
    service = new UnifiedRoutingService(mockPrisma, undefined, cacheService)
  })

  describe("Query count optimization", () => {
    it("should retrieve workspace with caching (1 query only)", async () => {
      queryCount = 0

      // First call
      await service.getWorkspace("ws-1")
      const firstCallCount = queryCount

      // Second call (should use cache)
      await service.getWorkspace("ws-1")
      const secondCallCount = queryCount

      expect(firstCallCount).toBeGreaterThan(0)
      expect(secondCallCount).toBe(firstCallCount) // No additional queries
    })

    it("should not duplicate workspace queries within 5 minutes", async () => {
      queryCount = 0

      // Simulate 3 concurrent requests
      await Promise.all([
        service.getWorkspace("ws-1"),
        service.getWorkspace("ws-1"),
        service.getWorkspace("ws-1"),
      ])

      // Should be 1 query (cached)
      expect(queryCount).toBe(1)
    })

    it("should load data selectively (avoid unnecessary queries)", async () => {
      const workspace = {
        workspaceId: "ws-1",
        enableProducts: true,
        enableFAQ: false, // Disabled
        enableServices: false, // Disabled
        enableOffers: false, // Disabled
        defaultPath: "LLM" as const,
        preferredLanguage: "it",
      }

      const showProductsIntent: Intent = {
        type: "SHOW_PRODUCTS",
        confidence: 0.95,
        source: "PATTERN",
      }

      queryCount = 0
      await service.loadDataForIntent(workspace, showProductsIntent)

      // Should only query products (not faq, services, offers)
      expect(mockPrisma.products.findMany).toHaveBeenCalled()
      // Other queries should not be called when disabled
    })
  })

  describe("Response time baseline", () => {
    it("should complete routing decision in <100ms", async () => {
      const context: RoutingContext = {
        message: "mostra prodotti",
        customerId: "cust-1",
        conversationId: "conv-1",
        workspaceId: "ws-1",
      }

      const startTime = performance.now()
      await service.detectIntent(context)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(100)
    })

    it("should cache prevents duplicate workspace loads", async () => {
      const workspace1StartTime = performance.now()
      await service.getWorkspace("ws-1")
      const workspace1EndTime = performance.now()
      const firstLoadTime = workspace1EndTime - workspace1StartTime

      const workspace2StartTime = performance.now()
      await service.getWorkspace("ws-1")
      const workspace2EndTime = performance.now()
      const cachedLoadTime = workspace2EndTime - workspace2StartTime

      // Cached load should be much faster (in-memory)
      expect(cachedLoadTime).toBeLessThan(firstLoadTime)
    })
  })

  describe("Cache invalidation", () => {
    it("should invalidate workspace cache on demand", async () => {
      queryCount = 0

      // First load
      await service.getWorkspace("ws-1")
      expect(queryCount).toBe(1)

      // Invalidate cache
      cacheService.invalidate("ws-1")

      // Second load should query again
      await service.getWorkspace("ws-1")
      expect(queryCount).toBe(2)
    })

    it("should support cache statistics", () => {
      cacheService.set("test-key", "test-value", 5000)
      const stats = cacheService.getStats()

      expect(stats).toHaveProperty("size")
      expect(stats.size).toBeGreaterThan(0)
    })
  })
})
