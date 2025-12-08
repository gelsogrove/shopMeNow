/**
 * CartManagementAgent - SERVICE Cart Tests
 *
 * Verifies that services can be added to cart correctly.
 *
 * Tests:
 * 1. addToCart with type=SERVICE finds service by code
 * 2. Service not found returns error
 * 3. Inactive service returns error
 * 4. Service skips stock check (always available)
 * 5. Cart item created with itemType="SERVICE"
 * 6. Backward compatibility - old productId format still works
 */

import { CartManagementAgent } from "../../../application/agents/CartManagementAgent"
import { CartRepository } from "../../../repositories/cart.repository"
import { OrderRepository } from "../../../repositories/order.repository"
import { ProductRepository } from "../../../repositories/product.repository"
import { ServiceRepository } from "../../../repositories/service.repository"

// Mock repositories
jest.mock("../../../repositories/cart.repository")
jest.mock("../../../repositories/product.repository")
jest.mock("../../../repositories/service.repository")
jest.mock("../../../repositories/order.repository")

describe("CartManagementAgent - SERVICE Cart", () => {
  let agent: CartManagementAgent
  let mockCartRepo: jest.Mocked<CartRepository>
  let mockProductRepo: jest.Mocked<ProductRepository>
  let mockServiceRepo: jest.Mocked<ServiceRepository>
  let mockOrderRepo: jest.Mocked<OrderRepository>

  const mockContext = {
    workspaceId: "ws-123",
    customerId: "cust-456",
    customerName: "Andrea",
    language: "it",
  }

  const mockService = {
    id: "service-id-123",
    code: "GFT001",
    name: "Confezione regalo",
    description: "Servizio di confezione regalo elegante",
    price: 5.0,
    currency: "EUR",
    isActive: true,
    workspaceId: "ws-123",
    duration: 15,
  }

  const mockCart = {
    id: "cart-123",
    customerId: "cust-456",
    workspaceId: "ws-123",
    items: [],
  }

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Initialize mocked repositories
    mockCartRepo = new CartRepository() as jest.Mocked<CartRepository>
    mockProductRepo = new ProductRepository() as jest.Mocked<ProductRepository>
    mockServiceRepo = new ServiceRepository() as jest.Mocked<ServiceRepository>
    mockOrderRepo = new OrderRepository() as jest.Mocked<OrderRepository>

    // Initialize agent
    agent = new CartManagementAgent(
      mockCartRepo,
      mockProductRepo,
      mockServiceRepo,
      mockOrderRepo
    )
  })

  describe("addToCart with type=SERVICE", () => {
    it("should find service by code and add to cart", async () => {
      // Mock service found
      mockServiceRepo.findByServiceCode = jest
        .fn()
        .mockResolvedValue(mockService)
      mockCartRepo.getOrCreateCart = jest.fn().mockResolvedValue(mockCart)
      mockCartRepo.addItem = jest.fn().mockResolvedValue(undefined)

      // Mock getCart to return updated cart
      const mockUpdatedCart = {
        cart: {
          id: "cart-123",
          items: [
            {
              id: "item-1",
              itemType: "SERVICE",
              serviceId: "service-id-123", // SERVICE uses serviceId
              quantity: 1,
            },
          ],
        },
      }
      agent.getCart = jest.fn().mockResolvedValue(mockUpdatedCart)

      const result = await agent.addToCart(mockContext, {
        productId: "GFT001", // Service code
        quantity: 1,
        type: "SERVICE",
      })

      // Verify service repository called
      expect(mockServiceRepo.findByServiceCode).toHaveBeenCalledWith(
        "GFT001",
        "ws-123"
      )

      // Verify product repository NOT called
      expect(mockProductRepo.findBySku).not.toHaveBeenCalled()

      // Verify cart item added with correct type
      // CRITICAL: SERVICE items use serviceId, PRODUCT items use productId
      expect(mockCartRepo.addItem).toHaveBeenCalledWith("cart-123", {
        itemType: "SERVICE", // ✅ Correct type
        productId: undefined, // SERVICE doesn't use productId
        serviceId: "service-id-123", // SERVICE uses serviceId
        quantity: 1, // Services always quantity 1
        notes: undefined,
      })

      // Verify success response
      expect(result.success).toBe(true)
      expect(result.message).toContain("Confezione regalo")
      expect(result.item?.type).toBe("SERVICE")
    })

    it("should return error when service not found", async () => {
      mockServiceRepo.findByServiceCode = jest.fn().mockResolvedValue(null)

      const result = await agent.addToCart(mockContext, {
        productId: "INVALID-CODE",
        quantity: 1,
        type: "SERVICE",
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("SERVICE_NOT_FOUND")
      expect(result.message).toContain("INVALID-CODE")
    })

    it("should return error when service is inactive", async () => {
      const inactiveService = { ...mockService, isActive: false }
      mockServiceRepo.findByServiceCode = jest
        .fn()
        .mockResolvedValue(inactiveService)

      const result = await agent.addToCart(mockContext, {
        productId: "GFT001",
        quantity: 1,
        type: "SERVICE",
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("SERVICE_UNAVAILABLE")
      expect(result.message).toContain("currently unavailable")
    })

    it("should NOT check stock for services (always available)", async () => {
      // Services don't have stock field, so no stock check should happen
      mockServiceRepo.findByServiceCode = jest
        .fn()
        .mockResolvedValue(mockService)
      mockCartRepo.getOrCreateCart = jest.fn().mockResolvedValue(mockCart)
      mockCartRepo.addItem = jest.fn().mockResolvedValue(undefined)

      const mockUpdatedCart = {
        cart: {
          id: "cart-123",
          items: [
            {
              id: "item-1",
              itemType: "SERVICE",
              serviceId: "service-id-123", // SERVICE uses serviceId
              quantity: 1, // Services always quantity 1 (enforced by code)
            },
          ],
        },
      }
      agent.getCart = jest.fn().mockResolvedValue(mockUpdatedCart)

      const result = await agent.addToCart(mockContext, {
        productId: "GFT001",
        quantity: 100, // Large quantity
        type: "SERVICE",
      })

      // Should succeed - services always have quantity 1 (enforced by code)
      expect(result.success).toBe(true)
      expect(mockCartRepo.addItem).toHaveBeenCalledWith("cart-123", {
        itemType: "SERVICE",
        productId: undefined, // SERVICE doesn't use productId
        serviceId: "service-id-123", // SERVICE uses serviceId
        quantity: 1, // Services always quantity 1 (enforced by code)
        notes: undefined,
      })
    })
  })

  describe("Backward compatibility - PRODUCT type", () => {
    it("should still work with old productId format (type=PRODUCT)", async () => {
      const mockProduct = {
        id: "product-id-456",
        code: "SALUMI-006",
        name: "Prosciutto Crudo",
        price: 15.0,
        isActive: true,
        stock: 10,
      }

      mockProductRepo.findBySku = jest
        .fn()
        .mockResolvedValue(mockProduct)
      mockCartRepo.getOrCreateCart = jest.fn().mockResolvedValue(mockCart)
      mockCartRepo.addItem = jest.fn().mockResolvedValue(undefined)

      const mockUpdatedCart = {
        cart: {
          id: "cart-123",
          items: [
            {
              id: "item-1",
              itemType: "PRODUCT",
              productId: "product-id-456",
              quantity: 2,
            },
          ],
        },
      }
      agent.getCart = jest.fn().mockResolvedValue(mockUpdatedCart)

      const result = await agent.addToCart(mockContext, {
        productId: "SALUMI-006",
        quantity: 2,
        type: "PRODUCT", // Explicit type
      })

      // Verify product repository called
      expect(mockProductRepo.findBySku).toHaveBeenCalledWith(
        "SALUMI-006",
        "ws-123"
      )

      // Verify service repository NOT called
      expect(mockServiceRepo.findByServiceCode).not.toHaveBeenCalled()

      // Verify cart item added with PRODUCT type
      expect(mockCartRepo.addItem).toHaveBeenCalledWith("cart-123", {
        itemType: "PRODUCT",
        productId: "product-id-456",
        quantity: 2,
        notes: undefined,
      })

      expect(result.success).toBe(true)
    })

    it("should default to PRODUCT when type not specified (legacy support)", async () => {
      const mockProduct = {
        id: "product-id-789",
        code: "FORMAGGI-001",
        name: "Pecorino Romano",
        price: 12.0,
        isActive: true,
        stock: 5,
      }

      mockProductRepo.findBySku = jest
        .fn()
        .mockResolvedValue(mockProduct)
      mockCartRepo.getOrCreateCart = jest.fn().mockResolvedValue(mockCart)
      mockCartRepo.addItem = jest.fn().mockResolvedValue(undefined)

      const mockUpdatedCart = {
        cart: {
          id: "cart-123",
          items: [
            {
              id: "item-1",
              itemType: "PRODUCT",
              productId: "product-id-789",
              quantity: 1,
            },
          ],
        },
      }
      agent.getCart = jest.fn().mockResolvedValue(mockUpdatedCart)

      // Old format - no type parameter
      const result = await agent.addToCart(mockContext, {
        productId: "FORMAGGI-001",
        quantity: 1,
        // type: undefined ← default should be "PRODUCT"
      })

      // Should default to PRODUCT search
      expect(mockProductRepo.findBySku).toHaveBeenCalled()
      expect(mockServiceRepo.findByServiceCode).not.toHaveBeenCalled()

      // Verify cart item uses PRODUCT type
      expect(mockCartRepo.addItem).toHaveBeenCalledWith("cart-123", {
        itemType: "PRODUCT",
        productId: "product-id-789",
        quantity: 1,
        notes: undefined,
      })

      expect(result.success).toBe(true)
    })
  })

  describe("Invalid quantity validation", () => {
    it("should reject quantity <= 0 for both PRODUCT and SERVICE", async () => {
      const resultProduct = await agent.addToCart(mockContext, {
        productId: "SALUMI-006",
        quantity: 0,
        type: "PRODUCT",
      })

      expect(resultProduct.success).toBe(false)
      expect(resultProduct.error).toBe("INVALID_QUANTITY")

      const resultService = await agent.addToCart(mockContext, {
        productId: "GFT001",
        quantity: -1,
        type: "SERVICE",
      })

      expect(resultService.success).toBe(false)
      expect(resultService.error).toBe("INVALID_QUANTITY")
    })
  })
})
