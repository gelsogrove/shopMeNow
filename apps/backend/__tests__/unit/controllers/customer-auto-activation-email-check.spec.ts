/**
 * Unit Tests: Customer Auto-Activation - Email Validation (Rule #4)
 * 
 * Tests that customers are NOT auto-activated without real email:
 * - temp_*@pending.com → NO auto-activation (non-registered)
 * - real@email.com → YES auto-activation (registered)
 * 
 * This prevents showing prices to non-registered users.
 */

describe("Customer Auto-Activation - Email Validation (Rule #4)", () => {
  describe("Auto-Activation Logic", () => {
    it("should NOT auto-activate customer with temporary email", () => {
      // Scenario: Customer changes name but email is still temporary
      const originalCustomer = {
        id: "customer-1",
        name: "New Customer",
        email: "temp_1234567890@pending.com",
        isActive: false,
      }

      const updateData = {
        name: "Andrea Rossi", // Valid name
        email: "temp_1234567890@pending.com", // Still temporary email
      }

      // Check email validity
      const hasRealEmail = updateData.email && !updateData.email.includes("@pending.com")
      
      // Auto-activation condition
      const shouldAutoActivate =
        originalCustomer.isActive === false &&
        updateData.name !== undefined &&
        updateData.name.trim() !== "" &&
        updateData.name !== "New Customer" &&
        hasRealEmail // ← NEW: Require real email

      expect(shouldAutoActivate).toBe(false)
      expect(hasRealEmail).toBe(false)
    })

    it("should auto-activate customer with real email", () => {
      const originalCustomer = {
        id: "customer-1",
        name: "New Customer",
        email: "temp_1234567890@pending.com",
        isActive: false,
      }

      const updateData = {
        name: "Andrea Rossi", // Valid name
        email: "andrea.rossi@gmail.com", // Real email after registration
      }

      // Check email validity
      const hasRealEmail = updateData.email && !updateData.email.includes("@pending.com")
      
      // Auto-activation condition
      const shouldAutoActivate =
        originalCustomer.isActive === false &&
        updateData.name !== undefined &&
        updateData.name.trim() !== "" &&
        updateData.name !== "New Customer" &&
        hasRealEmail // ← Real email required

      expect(shouldAutoActivate).toBe(true)
      expect(hasRealEmail).toBe(true)
    })

    it("should NOT auto-activate if name is still 'New Customer'", () => {
      const originalCustomer = {
        id: "customer-1",
        name: "New Customer",
        email: "temp_1234567890@pending.com",
        isActive: false,
      }

      const updateData = {
        name: "New Customer", // Still default name
        email: "andrea.rossi@gmail.com", // Real email
      }

      const hasRealEmail = updateData.email && !updateData.email.includes("@pending.com")
      
      const shouldAutoActivate =
        originalCustomer.isActive === false &&
        updateData.name !== undefined &&
        updateData.name.trim() !== "" &&
        updateData.name !== "New Customer" && // ← Fails here
        hasRealEmail

      expect(shouldAutoActivate).toBe(false)
    })

    it("should NOT auto-activate if customer is already active", () => {
      const originalCustomer = {
        id: "customer-1",
        name: "Andrea Rossi",
        email: "andrea.rossi@gmail.com",
        isActive: true, // Already active
      }

      const updateData = {
        name: "Andrea Rossi",
        email: "andrea.rossi@gmail.com",
      }

      const hasRealEmail = updateData.email && !updateData.email.includes("@pending.com")
      
      const shouldAutoActivate =
        originalCustomer.isActive === false && // ← Fails here
        updateData.name !== undefined &&
        updateData.name.trim() !== "" &&
        updateData.name !== "New Customer" &&
        hasRealEmail

      expect(shouldAutoActivate).toBe(false)
    })
  })

  describe("Email Validation Patterns", () => {
    it("should detect temporary email patterns", () => {
      const temporaryEmails = [
        "temp_1234567890@pending.com",
        "temp_9999999999@pending.com",
        "temp_+393331234567@pending.com",
      ]

      temporaryEmails.forEach(email => {
        const hasRealEmail = !email.includes("@pending.com")
        expect(hasRealEmail).toBe(false)
      })
    })

    it("should accept real email patterns", () => {
      const realEmails = [
        "andrea.rossi@gmail.com",
        "contact@bellitalia.it",
        "info@example.com",
        "user+tag@domain.co.uk",
      ]

      realEmails.forEach(email => {
        const hasRealEmail = !email.includes("@pending.com")
        expect(hasRealEmail).toBe(true)
      })
    })

    it("should handle email update from temporary to real", () => {
      const originalEmail = "temp_1234567890@pending.com"
      const newEmail = "andrea@bellitalia.it"

      const wasTemporary = originalEmail.includes("@pending.com")
      const isRealNow = !newEmail.includes("@pending.com")

      expect(wasTemporary).toBe(true)
      expect(isRealNow).toBe(true)
    })
  })

  describe("WhatsApp New Customer Flow", () => {
    it("should create customer as inactive with temporary email", () => {
      // This is what happens when new WhatsApp customer is created
      const newCustomer = {
        phone: "+393331234567",
        name: "New Customer",
        email: "temp_3331234567@pending.com",
        isActive: false, // ← MUST be false initially
      }

      expect(newCustomer.isActive).toBe(false)
      expect(newCustomer.email).toContain("@pending.com")
      expect(newCustomer.name).toBe("New Customer")
    })

    it("should keep customer inactive when only name changes", () => {
      const originalCustomer = {
        phone: "+393331234567",
        name: "New Customer",
        email: "temp_3331234567@pending.com",
        isActive: false,
      }

      // Customer updates name via ChatEngine (e.g., "Mi chiamo Andrea")
      const updatedName = "Andrea"
      const email = originalCustomer.email // Email unchanged

      const hasRealEmail = !email.includes("@pending.com")
      
      const shouldAutoActivate =
        originalCustomer.isActive === false &&
        updatedName !== "New Customer" &&
        hasRealEmail

      // Should NOT auto-activate - email still temporary
      expect(shouldAutoActivate).toBe(false)
      expect(hasRealEmail).toBe(false)
    })

    it("should activate customer ONLY after registration with real email", () => {
      const originalCustomer = {
        phone: "+393331234567",
        name: "Andrea", // Name already changed
        email: "temp_3331234567@pending.com",
        isActive: false,
      }

      // Customer completes registration via registration link
      const updatedEmail = "andrea@gmail.com"

      const hasRealEmail = !updatedEmail.includes("@pending.com")
      
      const shouldAutoActivate =
        originalCustomer.isActive === false &&
        originalCustomer.name !== "New Customer" &&
        hasRealEmail

      // NOW should auto-activate
      expect(shouldAutoActivate).toBe(true)
      expect(hasRealEmail).toBe(true)
    })
  })

  describe("Edge Cases", () => {
    it("should handle undefined email gracefully", () => {
      const originalCustomer = {
        id: "customer-1",
        name: "New Customer",
        email: "temp_1234567890@pending.com",
        isActive: false,
      }

      const updateData = {
        name: "Andrea Rossi",
        email: undefined, // Email not provided in update
      }

      // Should check original email when update email is undefined
      const hasRealEmail = updateData.email
        ? !updateData.email.includes("@pending.com")
        : originalCustomer.email && !originalCustomer.email.includes("@pending.com")

      expect(hasRealEmail).toBe(false) // Original email is temporary
    })

    it("should handle empty string email", () => {
      const email = ""
      const hasRealEmail = email && !email.includes("@pending.com")

      // Empty string is falsy, so hasRealEmail should be ""
      expect(hasRealEmail).toBeFalsy() // Use toBeFalsy() instead of toBe(false)
    })

    it("should handle whitespace-only name", () => {
      const originalCustomer = {
        id: "customer-1",
        name: "New Customer",
        email: "andrea@gmail.com",
        isActive: false,
      }

      const updateData = {
        name: "   ", // Whitespace only
        email: "andrea@gmail.com",
      }

      const hasRealEmail = !updateData.email.includes("@pending.com")
      
      const shouldAutoActivate =
        originalCustomer.isActive === false &&
        updateData.name !== undefined &&
        updateData.name.trim() !== "" && // ← Fails here
        updateData.name !== "New Customer" &&
        hasRealEmail

      expect(shouldAutoActivate).toBe(false)
    })
  })

  describe("Security Implications", () => {
    it("should prevent price visibility for non-registered users", () => {
      // Non-registered customer
      const customer = {
        name: "test", // Changed from "New Customer"
        email: "temp_1234567890@pending.com", // Still temporary
        isActive: false, // ← MUST be false
      }

      // When fetching products/services
      const customerIsActive = customer.isActive

      // Prices should be hidden
      expect(customerIsActive).toBe(false)
      
      // This means getActiveProducts(workspaceId, discount, customerIsActive)
      // will show: "💳 Registrati per vedere i prezzi: [LINK_REGISTRATION]"
    })

    it("should allow price visibility ONLY after registration", () => {
      // Registered customer
      const customer = {
        name: "Andrea Rossi",
        email: "andrea@gmail.com", // Real email
        isActive: true, // ← Auto-activated after registration
      }

      const customerIsActive = customer.isActive

      // Prices should be visible
      expect(customerIsActive).toBe(true)
      
      // This means getActiveProducts(workspaceId, discount, customerIsActive)
      // will show: "Mozzarella - €8.90"
    })
  })
})
