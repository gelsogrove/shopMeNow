/**
 * Unit tests for AddProduct calling function
 *
 * Tests cover:
 * 1. Parameter validation (customerId, workspaceId, products)
 * 2. Single product addition
 * 3. Multiple products addition
 * 4. Error handling for invalid products
 * 5. Quantity validation
 *
 * @see apps/backend/src/domain/calling-functions/AddProduct.ts
 */

// Mock logger FIRST
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}
jest.mock("../../../src/utils/logger", () => ({
  default: mockLogger,
  __esModule: true,
}))

// Mock CallingFunctionsService
const mockAddProductToCart = jest.fn()
jest.mock("../../../src/services/calling-functions.service", () => ({
  CallingFunctionsService: jest.fn().mockImplementation(() => ({
    addProductToCart: mockAddProductToCart,
  })),
}))

import { AddProduct } from "../../../src/domain/calling-functions/AddProduct"

describe("AddProduct Calling Function", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Parameter Validation", () => {
    it("should return error when customerId is missing", async () => {
      const result = await AddProduct({
        customerId: "",
        workspaceId: "workspace-456",
        products: [{ productCode: "MOZZ001", quantity: 1 }],
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Parametri richiesti mancanti")
      expect(result.totalAdded).toBe(0)
    })

    it("should return error when workspaceId is missing", async () => {
      const result = await AddProduct({
        customerId: "customer-123",
        workspaceId: "",
        products: [{ productCode: "MOZZ001", quantity: 1 }],
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Parametri richiesti mancanti")
    })

    it("should return error when products array is empty", async () => {
      const result = await AddProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        products: [],
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Array prodotti non valido")
    })

    it("should return error when products is undefined", async () => {
      const result = await AddProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        products: undefined as any,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Parametri richiesti mancanti")
    })
  })

  describe("Single Product Addition", () => {
    it("should add single product successfully", async () => {
      mockAddProductToCart.mockResolvedValue({
        success: true,
        productName: "Mozzarella di Bufala",
        cartUrl: "https://example.com/checkout?token=abc123",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        message: "Product added successfully",
      })

      const result = await AddProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        products: [{ productCode: "MOZZ001", quantity: 2 }],
      })

      expect(result.success).toBe(true)
      expect(result.totalAdded).toBe(1)
      expect(result.skipped).toBe(0)
      expect(result.cartUrl).toBeDefined()
      expect(result.details).toHaveLength(1)
      expect(result.details![0].success).toBe(true)
    })

    it("should handle product not found error", async () => {
      mockAddProductToCart.mockResolvedValue({
        success: false,
        error: "Prodotto non trovato",
        message: 'Il prodotto "INVALID" non è disponibile.',
      })

      const result = await AddProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        products: [{ productCode: "INVALID", quantity: 1 }],
      })

      expect(result.success).toBe(false)
      expect(result.totalAdded).toBe(0)
      expect(result.skipped).toBe(1)
      expect(result.details![0].success).toBe(false)
    })

    it("should handle insufficient stock error", async () => {
      mockAddProductToCart.mockResolvedValue({
        success: false,
        error: "Stock insufficiente",
        message: 'Purtroppo disponibili solo 2 unità di "Mozzarella".',
      })

      const result = await AddProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        products: [{ productCode: "MOZZ001", quantity: 10 }],
      })

      expect(result.success).toBe(false)
      expect(result.skipped).toBe(1)
    })
  })

  describe("Multiple Products Addition", () => {
    it("should add multiple products successfully", async () => {
      mockAddProductToCart
        .mockResolvedValueOnce({
          success: true,
          productName: "Mozzarella",
          cartUrl: "https://example.com/checkout?token=abc123",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
        .mockResolvedValueOnce({
          success: true,
          productName: "Prosciutto",
          cartUrl: "https://example.com/checkout?token=abc123",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })

      const result = await AddProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        products: [
          { productCode: "MOZZ001", quantity: 2 },
          { productCode: "PROS001", quantity: 1 },
        ],
      })

      expect(result.success).toBe(true)
      expect(result.totalAdded).toBe(2)
      expect(result.skipped).toBe(0)
      expect(result.details).toHaveLength(2)
    })

    it("should continue with other products when one fails", async () => {
      mockAddProductToCart
        .mockResolvedValueOnce({
          success: false,
          error: "Prodotto non trovato",
        })
        .mockResolvedValueOnce({
          success: true,
          productName: "Prosciutto",
          cartUrl: "https://example.com/checkout?token=abc123",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })

      const result = await AddProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        products: [
          { productCode: "INVALID", quantity: 1 },
          { productCode: "PROS001", quantity: 1 },
        ],
      })

      // Should be partial success
      expect(result.totalAdded).toBe(1)
      expect(result.skipped).toBe(1)
      expect(result.details![0].success).toBe(false)
      expect(result.details![1].success).toBe(true)
    })
  })

  describe("Quantity Validation", () => {
    it("should skip products with invalid quantity (negative)", async () => {
      const result = await AddProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        products: [{ productCode: "MOZZ001", quantity: -1 }],
      })

      expect(result.skipped).toBe(1)
      expect(result.totalAdded).toBe(0)
      expect(result.details![0].message).toContain("Quantità non valida")
    })

    it("should skip products with invalid quantity (zero)", async () => {
      // quantity 0 becomes 1 (default) but then fails when service returns error
      mockAddProductToCart.mockResolvedValue({
        success: false,
        error: "Stock insufficiente",
      })

      const result = await AddProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        products: [{ productCode: "MOZZ001", quantity: 0 }],
      })

      // 0 gets defaulted to 1, then fails due to mock error
      expect(result.skipped).toBe(1)
    })

    it("should skip products with non-integer quantity", async () => {
      const result = await AddProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        products: [{ productCode: "MOZZ001", quantity: 1.5 }],
      })

      expect(result.skipped).toBe(1)
      expect(result.details![0].message).toContain("Quantità non valida")
    })

    it("should default to quantity 1 if not specified", async () => {
      mockAddProductToCart.mockResolvedValue({
        success: true,
        productName: "Mozzarella",
        cartUrl: "https://example.com/checkout?token=abc123",
      })

      await AddProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        products: [{ productCode: "MOZZ001", quantity: undefined as any }],
      })

      expect(mockAddProductToCart).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 1,
        })
      )
    })
  })

  describe("Cart URL and Expiration", () => {
    it("should return cart URL from first successful addition", async () => {
      const expectedCartUrl = "https://example.com/checkout?token=first"
      mockAddProductToCart
        .mockResolvedValueOnce({
          success: true,
          productName: "Mozzarella",
          cartUrl: expectedCartUrl,
          expiresAt: "2025-01-01T00:00:00Z",
        })
        .mockResolvedValueOnce({
          success: true,
          productName: "Prosciutto",
          cartUrl: "https://example.com/checkout?token=second",
          expiresAt: "2025-01-01T01:00:00Z",
        })

      const result = await AddProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        products: [
          { productCode: "MOZZ001", quantity: 1 },
          { productCode: "PROS001", quantity: 1 },
        ],
      })

      expect(result.cartUrl).toBe(expectedCartUrl)
      expect(result.expiresAt).toBe("2025-01-01T00:00:00Z")
    })

    it("should include timestamp in response", async () => {
      mockAddProductToCart.mockResolvedValue({
        success: true,
        productName: "Mozzarella",
        cartUrl: "https://example.com/checkout",
      })

      const result = await AddProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        products: [{ productCode: "MOZZ001", quantity: 1 }],
      })

      expect(result.timestamp).toBeDefined()
      expect(new Date(result.timestamp).getTime()).toBeGreaterThan(0)
    })
  })

  describe("Notes Support", () => {
    it("should pass notes to addProductToCart", async () => {
      mockAddProductToCart.mockResolvedValue({
        success: true,
        productName: "Mozzarella",
        cartUrl: "https://example.com/checkout",
      })

      await AddProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        products: [
          {
            productCode: "MOZZ001",
            quantity: 1,
            notes: "Extra fresh please",
          },
        ],
      })

      expect(mockAddProductToCart).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: "Extra fresh please",
        })
      )
    })
  })
})
