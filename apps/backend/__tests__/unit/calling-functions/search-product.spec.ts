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

    it("should trim whitespace from productName before logging", async () => {
      const result = await searchProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        productName: "  Mozzarella  ",
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain("Mozzarella") // Trimmed
    })
  })

  describe("Successful Search Registration", () => {
    it("should log search successfully without database write", async () => {
      const result = await searchProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        productName: "Panettone italiano",
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain("Panettone italiano")
      expect(result.timestamp).toBeDefined()
      // NOTE: No database write anymore - search is only logged in memory
    })

    it("should return success without calling database", async () => {
      const result = await searchProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        productName: "Vino rosso",
      })

      expect(result.success).toBe(true)
      expect(mockProductSearchCreate).not.toHaveBeenCalled()
      // NOTE: productSearch table removed - no DB writes for search tracking
    })

    it("should NOT call prisma.$disconnect() (BUG#7 regression — shared instance must never disconnect)", async () => {
      // BUG WAS: searchProduct called prisma.$disconnect() on the global shared instance,
      // which killed the connection pool for ALL concurrent requests.
      // RULE: Domain functions must never disconnect the shared Prisma singleton.
      await searchProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        productName: "Burrata",
      })

      expect(mockDisconnect).not.toHaveBeenCalled()
    })
  })

  describe("Error Handling", () => {
    it("should handle validation errors gracefully", async () => {
      const result = await searchProduct({
        customerId: "", // Empty string is validation error
        workspaceId: "workspace-456",
        productName: "Mozzarella",
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Parametri richiesti mancanti")
    })

    it("should NOT call prisma.$disconnect() on validation errors (BUG#7 regression)", async () => {
      // RULE: Even on early return paths, the shared Prisma instance must not be disconnected.
      await searchProduct({
        customerId: "",
        workspaceId: "workspace-456",
        productName: "Mozzarella",
      })

      expect(mockDisconnect).not.toHaveBeenCalled()
    })

    it("should include timestamp in error response", async () => {
      const result = await searchProduct({
        customerId: "",
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
      // This is a valid use case - we track searches even for non-existent products
      const result = await searchProduct({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        productName: "Prodotto non esistente",
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain("Prodotto non esistente")
      expect(result.searchId).toBeUndefined()
      expect(mockProductSearchCreate).not.toHaveBeenCalled()
    })
  })
})
