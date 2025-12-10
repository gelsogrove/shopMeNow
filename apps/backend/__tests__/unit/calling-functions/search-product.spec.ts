/**
 * Unit tests for SearchProduct calling function
 *
 * Tests cover:
 * 1. Parameter validation
 * 2. Product name validation (length, empty string)
 * 3. Database save operation
 * 4. Error handling
 *
 * @see apps/backend/src/domain/calling-functions/searchProduct.ts
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

// Mock Prisma
const mockProductSearchCreate = jest.fn()
const mockDisconnect = jest.fn()

jest.mock("@echatbot/database", () => ({

  prisma: {
    productSearch: {
      create: mockProductSearchCreate,
    },
    $disconnect: mockDisconnect,
  },
}))

import { searchProduct } from "../../../src/domain/calling-functions/searchProduct"

describe("SearchProduct Calling Function", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Parameter Validation", () => {
    it("should return error when customerId is missing", async () => {
      const result = await searchProduct({
        customerId: "",
        workspaceId: "workspace-456",
        productName: "Mozzarella",
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Parametri richiesti mancanti")
    })

    it("should return error when workspaceId is missing", async () => {
      const result = await searchProduct({
        customerId: "customer-123",
        workspaceId: "",
        productName: "Mozzarella",
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Parametri richiesti mancanti")
    })

    it("should return error when productName is missing", async () => {
      const result = await searchProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        productName: "",
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Parametri richiesti mancanti")
    })
  })

  describe("Product Name Validation", () => {
    it("should return error when productName exceeds 255 characters", async () => {
      const longName = "A".repeat(256)
      const result = await searchProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        productName: longName,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("troppo lungo")
    })

    it("should accept productName with exactly 255 characters", async () => {
      const exactLengthName = "A".repeat(255)
      mockProductSearchCreate.mockResolvedValue({
        id: "search-123",
        query: exactLengthName,
      })

      const result = await searchProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        productName: exactLengthName,
      })

      expect(result.success).toBe(true)
    })

    it("should return error when productName is only whitespace", async () => {
      const result = await searchProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        productName: "   ",
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Nome prodotto vuoto")
    })

    it("should trim whitespace from productName before saving", async () => {
      mockProductSearchCreate.mockResolvedValue({
        id: "search-123",
        query: "Mozzarella",
      })

      await searchProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        productName: "  Mozzarella  ",
      })

      expect(mockProductSearchCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          query: "Mozzarella", // Trimmed
        }),
      })
    })
  })

  describe("Successful Search Registration", () => {
    it("should save search to database successfully", async () => {
      mockProductSearchCreate.mockResolvedValue({
        id: "search-123",
        query: "Panettone italiano",
        customerId: "customer-123",
        workspaceId: "workspace-456",
      })

      const result = await searchProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        productName: "Panettone italiano",
      })

      expect(result.success).toBe(true)
      expect(result.searchId).toBe("search-123")
      expect(result.message).toContain("Panettone italiano")
      expect(result.timestamp).toBeDefined()
    })

    it("should call prisma with correct parameters", async () => {
      mockProductSearchCreate.mockResolvedValue({
        id: "search-123",
      })

      await searchProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        productName: "Vino rosso",
      })

      expect(mockProductSearchCreate).toHaveBeenCalledWith({
        data: {
          query: "Vino rosso",
          customerId: "customer-123",
          workspaceId: "workspace-456",
        },
      })
    })

    it("should disconnect from prisma after operation", async () => {
      mockProductSearchCreate.mockResolvedValue({
        id: "search-123",
      })

      await searchProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        productName: "Burrata",
      })

      expect(mockDisconnect).toHaveBeenCalled()
    })
  })

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      mockProductSearchCreate.mockRejectedValue(
        new Error("Database connection failed")
      )

      const result = await searchProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        productName: "Mozzarella",
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Database connection failed")
      expect(result.message).toContain("Errore nel salvataggio")
    })

    it("should disconnect from prisma even on error", async () => {
      mockProductSearchCreate.mockRejectedValue(new Error("Database error"))

      await searchProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        productName: "Mozzarella",
      })

      expect(mockDisconnect).toHaveBeenCalled()
    })

    it("should include timestamp in error response", async () => {
      mockProductSearchCreate.mockRejectedValue(new Error("Database error"))

      const result = await searchProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        productName: "Mozzarella",
      })

      expect(result.timestamp).toBeDefined()
      expect(new Date(result.timestamp).getTime()).toBeGreaterThan(0)
    })
  })

  describe("Analytics Use Case", () => {
    it("should register search for products that exist", async () => {
      mockProductSearchCreate.mockResolvedValue({
        id: "search-123",
        query: "Mozzarella di Bufala",
      })

      const result = await searchProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        productName: "Mozzarella di Bufala",
      })

      expect(result.success).toBe(true)
    })

    it("should register search for products that do not exist", async () => {
      mockProductSearchCreate.mockResolvedValue({
        id: "search-124",
        query: "Prodotto non esistente",
      })

      // This is a valid use case - we track searches even for non-existent products
      const result = await searchProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        productName: "Prodotto non esistente",
      })

      expect(result.success).toBe(true)
      expect(result.searchId).toBe("search-124")
    })
  })
})
