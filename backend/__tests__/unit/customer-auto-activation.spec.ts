/**
 * Unit tests for Customer Auto-Activation Feature
 *
 * When a new customer arrives via WhatsApp, they are created with:
 * - name: "New Customer" (temporary)
 * - email: temp_xxx@pending.com (temporary)
 * - isActive: false
 *
 * When the admin updates the customer with a valid name (not "New Customer"),
 * the system should automatically set isActive: true so they appear in Clients list.
 */

describe("Customer Auto-Activation", () => {
  // Mock dependencies
  const mockCustomerService = {
    getById: jest.fn(),
    update: jest.fn(),
  }

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
  }

  // Helper to simulate the auto-activation logic from customers.controller.ts
  function shouldAutoActivate(
    originalCustomer: { isActive: boolean },
    updateData: { name?: string; isActive?: boolean }
  ): boolean {
    const { name, isActive } = updateData

    if (
      originalCustomer.isActive === false &&
      isActive === undefined &&
      name !== undefined &&
      name.trim() !== "" &&
      name !== "New Customer"
    ) {
      return true
    }
    return false
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Auto-activation conditions", () => {
    it("should auto-activate when updating inactive customer with valid name", () => {
      const originalCustomer = { isActive: false }
      const updateData = { name: "Mario Rossi" }

      expect(shouldAutoActivate(originalCustomer, updateData)).toBe(true)
    })

    it("should NOT auto-activate when customer is already active", () => {
      const originalCustomer = { isActive: true }
      const updateData = { name: "Mario Rossi" }

      expect(shouldAutoActivate(originalCustomer, updateData)).toBe(false)
    })

    it("should NOT auto-activate when name is still 'New Customer'", () => {
      const originalCustomer = { isActive: false }
      const updateData = { name: "New Customer" }

      expect(shouldAutoActivate(originalCustomer, updateData)).toBe(false)
    })

    it("should NOT auto-activate when name is empty string", () => {
      const originalCustomer = { isActive: false }
      const updateData = { name: "" }

      expect(shouldAutoActivate(originalCustomer, updateData)).toBe(false)
    })

    it("should NOT auto-activate when name is whitespace only", () => {
      const originalCustomer = { isActive: false }
      const updateData = { name: "   " }

      expect(shouldAutoActivate(originalCustomer, updateData)).toBe(false)
    })

    it("should NOT auto-activate when isActive is explicitly set to false", () => {
      const originalCustomer = { isActive: false }
      const updateData = { name: "Mario Rossi", isActive: false }

      expect(shouldAutoActivate(originalCustomer, updateData)).toBe(false)
    })

    it("should NOT auto-activate when name is not provided", () => {
      const originalCustomer = { isActive: false }
      const updateData = { email: "test@example.com" }

      expect(shouldAutoActivate(originalCustomer, updateData)).toBe(false)
    })
  })

  describe("Edge cases", () => {
    it("should auto-activate with name containing special characters", () => {
      const originalCustomer = { isActive: false }
      const updateData = { name: "José María O'Connor" }

      expect(shouldAutoActivate(originalCustomer, updateData)).toBe(true)
    })

    it("should auto-activate with name containing numbers", () => {
      const originalCustomer = { isActive: false }
      const updateData = { name: "Company 123 Ltd" }

      expect(shouldAutoActivate(originalCustomer, updateData)).toBe(true)
    })

    it("should auto-activate with single character name", () => {
      const originalCustomer = { isActive: false }
      const updateData = { name: "X" }

      expect(shouldAutoActivate(originalCustomer, updateData)).toBe(true)
    })

    it("should auto-activate even if email is still temporary", () => {
      // This is the key fix - we don't require valid email anymore
      const originalCustomer = { isActive: false }
      const updateData = {
        name: "Mario Rossi",
        email: "temp_393123456789@pending.com",
      }

      expect(shouldAutoActivate(originalCustomer, updateData)).toBe(true)
    })

    it("should NOT auto-activate with case-sensitive 'New Customer'", () => {
      const originalCustomer = { isActive: false }

      // Exact match required
      expect(
        shouldAutoActivate(originalCustomer, { name: "New Customer" })
      ).toBe(false)

      // Different case should activate
      expect(
        shouldAutoActivate(originalCustomer, { name: "new customer" })
      ).toBe(true)
      expect(
        shouldAutoActivate(originalCustomer, { name: "NEW CUSTOMER" })
      ).toBe(true)
    })
  })

  describe("Integration scenario", () => {
    it("should handle typical WhatsApp new customer flow", () => {
      // Step 1: New customer created via WhatsApp webhook
      const newCustomer = {
        id: "cust-123",
        name: "New Customer",
        email: "temp_393123456789@pending.com",
        phone: "+393123456789",
        isActive: false,
        workspaceId: "ws-123",
      }

      // Step 2: Admin opens chat, updates customer name
      const updateData = { name: "Mario Rossi" }

      // Step 3: System should auto-activate
      expect(shouldAutoActivate(newCustomer, updateData)).toBe(true)
    })

    it("should handle customer with name updated but then deactivated", () => {
      // Customer was activated, then admin explicitly deactivated
      const deactivatedCustomer = {
        id: "cust-123",
        name: "Mario Rossi",
        isActive: false,
      }

      // Admin updates something else (not name)
      const updateData = { notes: "VIP customer" }

      // Should NOT auto-activate (name wasn't changed this time)
      expect(shouldAutoActivate(deactivatedCustomer, updateData)).toBe(false)
    })
  })
})
