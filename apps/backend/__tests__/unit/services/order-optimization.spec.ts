/**
 * Unit tests for OrderOptimizationService
 *
 * Tests transport cost calculation, rounding logic, and workspace isolation.
 *
 * @feature optimize-transport (specs/optimize-transport/)
 */

import { OrderOptimizationService, TransportAnalysis } from "../../../src/application/services/order-optimization.service"

// Mock Prisma
const mockPrisma = {
  transportType: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  productTransportType: {
    findMany: jest.fn(),
  },
  carts: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}

// Mock repositories
jest.mock("../../../src/repositories/transport-type.repository", () => ({
  TransportTypeRepository: jest.fn().mockImplementation(() => ({
    hasConfiguredPrices: jest.fn(),
    findActiveWithPrices: jest.fn(),
  })),
}))

jest.mock("../../../src/repositories/cart.repository", () => ({
  CartRepository: jest.fn().mockImplementation(() => ({
    getOrCreateCart: jest.fn(),
  })),
}))

describe("OrderOptimizationService", () => {
  let service: OrderOptimizationService
  let mockTransportRepo: any
  let mockCartRepo: any

  const WORKSPACE_ID = "workspace-123"
  const CUSTOMER_ID = "customer-456"

  beforeEach(() => {
    jest.clearAllMocks()

    // Get mock instances
    const { TransportTypeRepository } = require("../../../src/repositories/transport-type.repository")
    const { CartRepository } = require("../../../src/repositories/cart.repository")

    mockTransportRepo = new TransportTypeRepository()
    mockCartRepo = new CartRepository()

    service = new OrderOptimizationService(mockPrisma as any)
    // Replace internal repos with mocks
    ;(service as any).transportTypeRepo = mockTransportRepo
    ;(service as any).cartRepo = mockCartRepo
  })

  describe("hasTransportPricesConfigured", () => {
    it("should return true when transport prices are configured", async () => {
      mockTransportRepo.hasConfiguredPrices.mockResolvedValue(true)

      const result = await service.hasTransportPricesConfigured(WORKSPACE_ID)

      expect(result).toBe(true)
      expect(mockTransportRepo.hasConfiguredPrices).toHaveBeenCalledWith(WORKSPACE_ID)
    })

    it("should return false when no transport prices are configured", async () => {
      mockTransportRepo.hasConfiguredPrices.mockResolvedValue(false)

      const result = await service.hasTransportPricesConfigured(WORKSPACE_ID)

      expect(result).toBe(false)
    })
  })

  describe("analyzeCart", () => {
    const mockTransportTypes = [
      { id: "transport-1", name: "Ambient Temperature", price: 8, isActive: true },
      { id: "transport-2", name: "Refrigerated", price: 12, isActive: true },
      { id: "transport-3", name: "Frozen", price: 15, isActive: true },
    ]

    const mockCart = {
      id: "cart-123",
      customerId: CUSTOMER_ID,
      workspaceId: WORKSPACE_ID,
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          quantity: 2,
          product: { id: "prod-1", name: "Pasta", price: 10, stock: 100, isActive: true },
        },
        {
          id: "item-2",
          productId: "prod-2",
          quantity: 1,
          product: { id: "prod-2", name: "Gelato", price: 25, stock: 50, isActive: true },
        },
      ],
    }

    const mockProductTransportTypes = [
      { productId: "prod-1", transportType: { id: "transport-1", name: "Ambient Temperature", price: 8 } },
      { productId: "prod-2", transportType: { id: "transport-3", name: "Frozen", price: 15 } },
    ]

    beforeEach(() => {
      mockTransportRepo.hasConfiguredPrices.mockResolvedValue(true)
      mockTransportRepo.findActiveWithPrices.mockResolvedValue(mockTransportTypes)
      mockCartRepo.getOrCreateCart.mockResolvedValue(mockCart)
      mockPrisma.productTransportType.findMany.mockResolvedValue(mockProductTransportTypes)
    })

    it("should return empty analysis when transport prices not configured", async () => {
      mockTransportRepo.hasConfiguredPrices.mockResolvedValue(false)

      const result = await service.analyzeCart(WORKSPACE_ID, CUSTOMER_ID)

      expect(result.isConfigured).toBe(false)
      expect(result.isEmpty).toBe(true)
      expect(result.transports).toHaveLength(0)
    })

    it("should return empty analysis when cart is empty", async () => {
      mockCartRepo.getOrCreateCart.mockResolvedValue({
        ...mockCart,
        items: [],
      })

      const result = await service.analyzeCart(WORKSPACE_ID, CUSTOMER_ID)

      expect(result.isEmpty).toBe(true)
      expect(result.isConfigured).toBe(true)
    })

    it("should calculate correct transport breakdown", async () => {
      const result = await service.analyzeCart(WORKSPACE_ID, CUSTOMER_ID)

      // 2 transport types used: Ambient (Pasta) and Frozen (Gelato)
      expect(result.transports).toHaveLength(2)

      const ambientTransport = result.transports.find(t => t.transportTypeName === "Ambient Temperature")
      expect(ambientTransport).toBeDefined()
      expect(ambientTransport!.transportPrice).toBe(8)
      expect(ambientTransport!.totalQuantity).toBe(2) // 2x Pasta

      const frozenTransport = result.transports.find(t => t.transportTypeName === "Frozen")
      expect(frozenTransport).toBeDefined()
      expect(frozenTransport!.transportPrice).toBe(15)
      expect(frozenTransport!.totalQuantity).toBe(1) // 1x Gelato
    })

    it("should calculate correct totals with rounding", async () => {
      const result = await service.analyzeCart(WORKSPACE_ID, CUSTOMER_ID)

      // Products: 2×10 + 1×25 = 45
      expect(result.totalProductsCost).toBe(45)

      // Transport: 8 (Ambient) + 15 (Frozen) = 23
      expect(result.totalTransportCost).toBe(23)

      // Grand total: 45 + 23 = 68
      expect(result.grandTotal).toBe(68)

      // Total units: 2 + 1 = 3
      expect(result.totalUnits).toBe(3)

      // Shipping per unit: 23 / 3 = 7.67 → rounded to 8
      expect(result.shippingCostPerUnit).toBe(8)
    })

    it("should calculate IVA 22% correctly", async () => {
      const result = await service.analyzeCart(WORKSPACE_ID, CUSTOMER_ID)

      // grandTotal = 68
      // netTotal = 68 / 1.22 = 55.74 → rounded to 56
      // ivaAmount = 68 - 56 = 12
      expect(result.netTotal).toBe(56)
      expect(result.ivaAmount).toBe(12)
    })

    it("should allocate shipping per item", async () => {
      const result = await service.analyzeCart(WORKSPACE_ID, CUSTOMER_ID)

      expect(result.allocationByItem).toHaveLength(2)

      // First item: Pasta 2x10 = 20, shipping 8×2 = 16
      const pastaAlloc = result.allocationByItem.find(a => a.productName === "Pasta")
      expect(pastaAlloc).toBeDefined()
      expect(pastaAlloc!.productTotal).toBe(20)
      expect(pastaAlloc!.quantity).toBe(2)

      // Second item (last): Gelato 1×25 = 25, gets remaining shipping
      const gelatoAlloc = result.allocationByItem.find(a => a.productName === "Gelato")
      expect(gelatoAlloc).toBeDefined()
      expect(gelatoAlloc!.productTotal).toBe(25)
    })

    it("should handle single transport type", async () => {
      // All products use same transport
      mockPrisma.productTransportType.findMany.mockResolvedValue([
        { productId: "prod-1", transportType: { id: "transport-1", name: "Ambient Temperature", price: 8 } },
        { productId: "prod-2", transportType: { id: "transport-1", name: "Ambient Temperature", price: 8 } },
      ])

      const result = await service.analyzeCart(WORKSPACE_ID, CUSTOMER_ID)

      // Only 1 transport type
      expect(result.transports).toHaveLength(1)
      expect(result.totalTransportCost).toBe(8) // Single transport cost
    })
  })

  describe("formatAnalysisForDisplay", () => {
    it("should format unconfigured transport message", () => {
      const analysis: TransportAnalysis = {
        workspaceId: WORKSPACE_ID,
        cartId: "cart-123",
        timestamp: new Date(),
        transports: [],
        totalUnits: 0,
        totalProductsCost: 0,
        totalTransportCost: 0,
        grandTotal: 0,
        shippingCostPerUnit: 0,
        ivaAmount: 0,
        netTotal: 0,
        allocationByItem: [],
        isConfigured: false,
        isEmpty: true,
      }

      const result = service.formatAnalysisForDisplay(analysis)

      expect(result).toContain("non posso calcolare i costi di spedizione")
      expect(result).toContain("non sono configurati")
    })

    it("should format empty cart message", () => {
      const analysis: TransportAnalysis = {
        workspaceId: WORKSPACE_ID,
        cartId: "cart-123",
        timestamp: new Date(),
        transports: [],
        totalUnits: 0,
        totalProductsCost: 0,
        totalTransportCost: 0,
        grandTotal: 0,
        shippingCostPerUnit: 0,
        ivaAmount: 0,
        netTotal: 0,
        allocationByItem: [],
        isConfigured: true,
        isEmpty: true,
      }

      const result = service.formatAnalysisForDisplay(analysis)

      expect(result).toContain("carrello è vuoto")
    })

    it("should format transport breakdown with emojis", () => {
      const analysis: TransportAnalysis = {
        workspaceId: WORKSPACE_ID,
        cartId: "cart-123",
        timestamp: new Date(),
        transports: [
          {
            transportTypeId: "t1",
            transportTypeName: "Frozen",
            transportPrice: 15,
            productCount: 1,
            totalQuantity: 2,
            products: [],
            subtotal: 30,
          },
          {
            transportTypeId: "t2",
            transportTypeName: "Refrigerated",
            transportPrice: 12,
            productCount: 1,
            totalQuantity: 1,
            products: [],
            subtotal: 20,
          },
        ],
        totalUnits: 3,
        totalProductsCost: 50,
        totalTransportCost: 27,
        grandTotal: 77,
        shippingCostPerUnit: 9,
        ivaAmount: 14,
        netTotal: 63,
        allocationByItem: [],
        isConfigured: true,
        isEmpty: false,
      }

      const result = service.formatAnalysisForDisplay(analysis)

      // Check structure
      expect(result).toContain("Riepilogo Trasporti")
      expect(result).toContain("🧊") // Frozen emoji
      expect(result).toContain("❄️") // Refrigerated emoji
      expect(result).toContain("€15.00")
      expect(result).toContain("€12.00")
      expect(result).toContain("Subtotale prodotti")
      expect(result).toContain("€50.00")
      expect(result).toContain("Totale spedizione")
      expect(result).toContain("€27.00")
      expect(result).toContain("Totale ordine")
      expect(result).toContain("€77.00")
      expect(result).toContain("IVA 22%")
      expect(result).toContain("€14.00")
    })
  })
})
