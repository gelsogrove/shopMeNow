/**
 * Unit tests for ResetCart calling function
 *
 * Tests cover:
 * 1. Parameter validation (customerId, workspaceId)
 * 2. Customer not found scenario
 * 3. Empty cart scenario
 * 4. Successful cart reset with items
 * 5. Database error handling
 *
 * @see apps/backend/src/domain/calling-functions/ResetCart.ts
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
const mockCustomerFindFirst = jest.fn()
const mockCartFindFirst = jest.fn()
const mockCartItemsDeleteMany = jest.fn()
const mockDisconnect = jest.fn()

jest.mock("@echatbot/database", () => ({

  prisma: {
    customers: {
      findFirst: mockCustomerFindFirst,
    },
    carts: {
      findFirst: mockCartFindFirst,
    },
    cartItems: {
      deleteMany: mockCartItemsDeleteMany,
    },
    $disconnect: mockDisconnect,
  },
}))

import { ResetCart } from "../../../src/domain/calling-functions/ResetCart"

describe("ResetCart Calling Function", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Parameter Validation", () => {
    it("should return error when customerId is missing", async () => {
      const result = await ResetCart({
        customerId: "",
        workspaceId: "workspace-456",
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Parametri richiesti mancanti")
      expect(result.message).toContain("problema tecnico")
    })

    it("should return error when workspaceId is missing", async () => {
      const result = await ResetCart({
        customerId: "customer-123",
        workspaceId: "",
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Parametri richiesti mancanti")
    })

    it("should include timestamp in validation error response", async () => {
      const result = await ResetCart({
        customerId: "",
        workspaceId: "workspace-456",
      })

      expect(result.timestamp).toBeDefined()
      expect(new Date(result.timestamp).getTime()).toBeGreaterThan(0)
    })
  })

  describe("Customer Validation", () => {
    it("should return error when customer not found", async () => {
      mockCustomerFindFirst.mockResolvedValue(null)

      const result = await ResetCart({
        customerId: "nonexistent-customer",
        workspaceId: "workspace-456",
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Cliente non trovato")
      expect(mockDisconnect).toHaveBeenCalled()
    })

    it("should return error when customer exists in different workspace", async () => {
      mockCustomerFindFirst.mockResolvedValue(null) // Customer not found in this workspace

      const result = await ResetCart({
        customerId: "customer-123",
        workspaceId: "wrong-workspace",
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Cliente non trovato")
    })
  })

  describe("Empty Cart Scenarios", () => {
    it("should handle case when no cart exists", async () => {
      mockCustomerFindFirst.mockResolvedValue({ id: "customer-123" })
      mockCartFindFirst.mockResolvedValue(null)

      const result = await ResetCart({
        customerId: "customer-123",
        workspaceId: "workspace-456",
      })

      expect(result.success).toBe(true)
      expect(result.itemsRemoved).toBe(0)
      expect(result.message).toContain("già vuoto")
    })

    it("should handle case when cart exists but has no items", async () => {
      mockCustomerFindFirst.mockResolvedValue({ id: "customer-123" })
      mockCartFindFirst.mockResolvedValue({
        id: "cart-123",
        items: [],
      })

      const result = await ResetCart({
        customerId: "customer-123",
        workspaceId: "workspace-456",
      })

      expect(result.success).toBe(true)
      expect(result.itemsRemoved).toBe(0)
      expect(result.message).toContain("già vuoto")
    })
  })

  describe("Successful Cart Reset", () => {
    it("should delete all items from cart", async () => {
      mockCustomerFindFirst.mockResolvedValue({ id: "customer-123" })
      mockCartFindFirst.mockResolvedValue({
        id: "cart-123",
        items: [
          { id: "item-1" },
          { id: "item-2" },
          { id: "item-3" },
        ],
      })
      mockCartItemsDeleteMany.mockResolvedValue({ count: 3 })

      const result = await ResetCart({
        customerId: "customer-123",
        workspaceId: "workspace-456",
      })

      expect(result.success).toBe(true)
      expect(result.itemsRemoved).toBe(3)
      expect(mockCartItemsDeleteMany).toHaveBeenCalledWith({
        where: { cartId: "cart-123" },
      })
    })

    it("should return success message with item count", async () => {
      mockCustomerFindFirst.mockResolvedValue({ id: "customer-123" })
      mockCartFindFirst.mockResolvedValue({
        id: "cart-123",
        items: [{ id: "item-1" }, { id: "item-2" }],
      })
      mockCartItemsDeleteMany.mockResolvedValue({ count: 2 })

      const result = await ResetCart({
        customerId: "customer-123",
        workspaceId: "workspace-456",
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain("svuotato il carrello")
      expect(result.message).toContain("2 prodotto/i")
    })

    it("should disconnect from prisma after successful operation", async () => {
      mockCustomerFindFirst.mockResolvedValue({ id: "customer-123" })
      mockCartFindFirst.mockResolvedValue({
        id: "cart-123",
        items: [{ id: "item-1" }],
      })
      mockCartItemsDeleteMany.mockResolvedValue({ count: 1 })

      await ResetCart({
        customerId: "customer-123",
        workspaceId: "workspace-456",
      })

      expect(mockDisconnect).toHaveBeenCalled()
    })
  })

  describe("Error Handling", () => {
    it("should handle database error during customer lookup", async () => {
      mockCustomerFindFirst.mockRejectedValue(
        new Error("Database connection failed")
      )

      const result = await ResetCart({
        customerId: "customer-123",
        workspaceId: "workspace-456",
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Database connection failed")
      expect(mockDisconnect).toHaveBeenCalled()
    })

    it("should handle database error during cart deletion", async () => {
      mockCustomerFindFirst.mockResolvedValue({ id: "customer-123" })
      mockCartFindFirst.mockResolvedValue({
        id: "cart-123",
        items: [{ id: "item-1" }],
      })
      mockCartItemsDeleteMany.mockRejectedValue(
        new Error("Delete operation failed")
      )

      const result = await ResetCart({
        customerId: "customer-123",
        workspaceId: "workspace-456",
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Delete operation failed")
    })

    it("should always disconnect from prisma on error", async () => {
      mockCustomerFindFirst.mockResolvedValue({ id: "customer-123" })
      mockCartFindFirst.mockRejectedValue(new Error("Query error"))

      await ResetCart({
        customerId: "customer-123",
        workspaceId: "workspace-456",
      })

      expect(mockDisconnect).toHaveBeenCalled()
    })
  })

  describe("Message Templates", () => {
    it("should include user variables in success message", async () => {
      mockCustomerFindFirst.mockResolvedValue({ id: "customer-123" })
      mockCartFindFirst.mockResolvedValue({
        id: "cart-123",
        items: [{ id: "item-1" }],
      })
      mockCartItemsDeleteMany.mockResolvedValue({ count: 1 })

      const result = await ResetCart({
        customerId: "customer-123",
        workspaceId: "workspace-456",
      })

      // Check that message contains placeholders for later replacement
      expect(result.message).toContain("{{nameUser}}")
      expect(result.message).toContain("{{discountUser}}")
    })

    it("should include user variables in empty cart message", async () => {
      mockCustomerFindFirst.mockResolvedValue({ id: "customer-123" })
      mockCartFindFirst.mockResolvedValue(null)

      const result = await ResetCart({
        customerId: "customer-123",
        workspaceId: "workspace-456",
      })

      expect(result.message).toContain("{{nameUser}}")
      expect(result.message).toContain("{{discountUser}}")
    })

    it("should include support contact info in error messages", async () => {
      mockCustomerFindFirst.mockResolvedValue(null)

      const result = await ResetCart({
        customerId: "nonexistent",
        workspaceId: "workspace-456",
      })

      expect(result.message).toContain("{{agentPhone}}")
    })
  })
})
