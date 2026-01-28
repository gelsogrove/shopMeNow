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
  type: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  productType: {
    findMany: jest.fn(),
  },
  carts: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}

// Mock repositories
jest.mock("../../../src/repositories/type.repository", () => ({
  TypeRepository: jest.fn().mockImplementation(() => ({
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
    const { TypeRepository } = require("../../../src/repositories/type.repository")
    const { CartRepository } = require("../../../src/repositories/cart.repository")

    mockTransportRepo = new TypeRepository()
    mockCartRepo = new CartRepository()

    service = new OrderOptimizationService(mockPrisma as any)
    // Replace internal repos with mocks
    ;(service as any).typeRepo = mockTransportRepo
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
    const mockTypes = [
      { id: "transport-1", name: "Temperatura Ambiente", price: 8, isActive: true },
      { id: "transport-2", name: "Refrigerato", price: 12, isActive: true },
      { id: "transport-3", name: "Congelato", price: 15, isActive: true },
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

    const mockProductTypes = [
      { productId: "prod-1", type: { id: "transport-1", name: "Temperatura Ambiente", price: 8 } },
      { productId: "prod-2", type: { id: "transport-3", name: "Congelato", price: 15 } },
    ]

    beforeEach(() => {
      mockTransportRepo.hasConfiguredPrices.mockResolvedValue(true)
      mockTransportRepo.findActiveWithPrices.mockResolvedValue(mockTypes)
      mockCartRepo.getOrCreateCart.mockResolvedValue(mockCart)
      mockPrisma.productType.findMany.mockResolvedValue(mockProductTypes)
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

      const ambientTransport = result.transports.find(t => t.typeName === "Temperatura Ambiente")
      expect(ambientTransport).toBeDefined()
      expect(ambientTransport!.transportPrice).toBe(8)
      expect(ambientTransport!.totalQuantity).toBe(2) // 2x Pasta

      const frozenTransport = result.transports.find(t => t.typeName === "Congelato")
      expect(frozenTransport).toBeDefined()
      expect(frozenTransport!.transportPrice).toBe(15)
      expect(frozenTransport!.totalQuantity).toBe(1) // 1x Gelato
    })

    it("should calculate correct totals with rounding", async () => {
      const result = await service.analyzeCart(WORKSPACE_ID, CUSTOMER_ID)

      // Products: 2×10 + 1×25 = 45
      expect(result.totalProductsCost).toBe(45)

      // Transport: highest requirement (Frozen) = 15
      expect(result.totalTransportCost).toBe(15)
      expect(result.selectedTypeName).toBe("Congelato")

      // Grand total: 45 + 15 = 60
      expect(result.grandTotal).toBe(60)

      // Total units: 2 + 1 = 3
      expect(result.totalUnits).toBe(3)

      // Shipping per unit: 15 / 3 = 5
      expect(result.shippingCostPerUnit).toBe(5)
    })

    it("should calculate IVA 22% correctly", async () => {
      const result = await service.analyzeCart(WORKSPACE_ID, CUSTOMER_ID)

      // grandTotal = 60
      // netTotal = 60 / 1.22 ≈ 49.18 → rounded to 49.18 (~49.18 but service rounds to 2 decimals)
      expect(result.netTotal).toBeCloseTo(49.18, 2)
      expect(result.ivaAmount).toBeCloseTo(10.82, 2)
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
      mockPrisma.productType.findMany.mockResolvedValue([
        { productId: "prod-1", type: { id: "transport-1", name: "Temperatura Ambiente", price: 8 } },
        { productId: "prod-2", type: { id: "transport-1", name: "Temperatura Ambiente", price: 8 } },
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
        selectedTypeId: null,
        selectedTypeName: null,
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
        selectedTypeId: null,
        selectedTypeName: null,
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
            typeId: "t1",
            typeName: "Congelato",
            transportPrice: 15,
            productCount: 1,
            totalQuantity: 2,
            products: [],
            subtotal: 30,
          },
          {
            typeId: "t2",
            typeName: "Refrigerato",
            transportPrice: 12,
            productCount: 1,
            totalQuantity: 1,
            products: [],
            subtotal: 20,
          },
        ],
        totalUnits: 3,
        totalProductsCost: 50,
        totalTransportCost: 15,
        grandTotal: 65,
        shippingCostPerUnit: 5,
        ivaAmount: 12,
        netTotal: 53,
        allocationByItem: [],
        isConfigured: true,
        isEmpty: false,
        selectedTypeId: "t1",
        selectedTypeName: "Congelato",
      }

      const result = service.formatAnalysisForDisplay(analysis)

      // Check structure
      expect(result).toContain("Riepilogo Trasporti")
      expect(result).toContain("🧊") // Frozen emoji
      expect(result).toContain("❄️") // Refrigerated emoji
      expect(result).toContain("€15.00")
      expect(result).toContain("€12.00")
      expect(result).toContain("Spedizione applicata")
      expect(result).toContain("Subtotale prodotti")
      expect(result).toContain("€50.00")
      expect(result).toContain("Totale spedizione")
      expect(result).toContain("€15.00")
      expect(result).toContain("Totale ordine")
      expect(result).toContain("€65.00")
      expect(result).toContain("IVA 22%")
      expect(result).toContain("€15.00")
    })
  })
})
