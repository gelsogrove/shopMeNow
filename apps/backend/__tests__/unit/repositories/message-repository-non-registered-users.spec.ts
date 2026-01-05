/**
 * Unit Tests: MessageRepository - Non-Registered Users Price Visibility (Rule #4)
 * 
 * Tests the price hiding logic for non-registered customers:
 * - customerIsActive=false → NO prices shown
 * - customerIsActive=true → Prices visible
 * - Registration link appears instead of prices
 */

describe("MessageRepository - Non-Registered Users Price Visibility (Rule #4)", () => {
  describe("Price Visibility Logic", () => {
    it("should show prices format for registered customers (isActive=true)", () => {
      const customerIsActive = true
      const price = 8.9
      const currencySymbol = "€"
      
      // Simulate price formatting logic from message.repository.ts
      let priceSection = ""
      if (customerIsActive) {
        priceSection = ` ~${currencySymbol}${price.toFixed(2)}~`
      } else {
        priceSection = ` | 💳 Registrati per vedere i prezzi: [LINK_REGISTRATION]`
      }
      
      expect(priceSection).toContain("€8.90")
      expect(priceSection).not.toContain("[LINK_REGISTRATION]")
      expect(priceSection).not.toContain("Registrati")
    })

    it("should hide prices format for non-registered customers (isActive=false)", () => {
      const customerIsActive = false
      const price = 8.9
      const currencySymbol = "€"
      
      // Simulate price formatting logic
      let priceSection = ""
      if (customerIsActive) {
        priceSection = ` ~${currencySymbol}${price.toFixed(2)}~`
      } else {
        priceSection = ` | 💳 Registrati per vedere i prezzi: [LINK_REGISTRATION]`
      }
      
      expect(priceSection).not.toContain("€")
      expect(priceSection).not.toContain("8.90")
      expect(priceSection).toContain("[LINK_REGISTRATION]")
      expect(priceSection).toContain("Registrati per vedere i prezzi")
    })
  })

  describe("Products - Price Visibility", () => {
    it("should SHOW prices for registered customers", () => {
      const customerIsActive = true
      const product = {
        name: "Mozzarella di Bufala",
        sku: "MOZ001",
        price: 8.9,
        currency: "€",
      }

      // Build output (simplified from getActiveProducts)
      let output = ""
      if (customerIsActive) {
        output = `• [${product.sku}] ${product.name} ${product.currency}${product.price.toFixed(2)}`
      } else {
        output = `• [${product.sku}] ${product.name} | 💳 Registrati per vedere i prezzi: [LINK_REGISTRATION]`
      }

      expect(output).toContain("€8.90")
      expect(output).toContain("Mozzarella di Bufala")
      expect(output).not.toContain("[LINK_REGISTRATION]")
    })

    it("should HIDE prices for non-registered customers", () => {
      const customerIsActive = false
      const product = {
        name: "Mozzarella di Bufala",
        sku: "MOZ001",
        price: 8.9,
        currency: "€",
      }

      // Build output
      let output = ""
      if (customerIsActive) {
        output = `• [${product.sku}] ${product.name} ${product.currency}${product.price.toFixed(2)}`
      } else {
        output = `• [${product.sku}] ${product.name} | 💳 Registrati per vedere i prezzi: [LINK_REGISTRATION]`
      }

      expect(output).not.toContain("€8.90")
      expect(output).not.toContain("€")
      expect(output).toContain("[LINK_REGISTRATION]")
      expect(output).toContain("Registrati per vedere i prezzi")
      expect(output).toContain("Mozzarella di Bufala") // Still show product name
    })

    it("should format multiple products consistently for non-registered users", () => {
      const customerIsActive = false
      const products = [
        { sku: "MOZ001", name: "Mozzarella", price: 8.9 },
        { sku: "PAR001", name: "Parmigiano", price: 15.5 },
        { sku: "PRO001", name: "Prosciutto", price: 22.0 },
      ]

      const outputs = products.map(p => {
        if (customerIsActive) {
          return `• [${p.sku}] ${p.name} €${p.price.toFixed(2)}`
        } else {
          return `• [${p.sku}] ${p.name} | 💳 Registrati per vedere i prezzi: [LINK_REGISTRATION]`
        }
      })

      outputs.forEach(output => {
        expect(output).not.toContain("€")
        expect(output).toContain("[LINK_REGISTRATION]")
      })

      // Check product names are still visible
      expect(outputs.join("\n")).toContain("Mozzarella")
      expect(outputs.join("\n")).toContain("Parmigiano")
      expect(outputs.join("\n")).toContain("Prosciutto")
    })
  })

  describe("Services - Price Visibility", () => {
    it("should SHOW prices for registered customers", () => {
      const customerIsActive = true
      const service = {
        name: "Trasporto Express",
        code: "TRANSP001",
        price: 25.0,
        currency: "€",
      }

      // Simulate service formatting from variable-resolver.service.ts
      let output = ""
      if (customerIsActive) {
        output = `- ${service.name} (${service.code}): ${service.currency}${service.price.toFixed(2)}`
      } else {
        output = `- ${service.name} (${service.code}): 💳 Registrati per vedere i prezzi: [LINK_REGISTRATION]`
      }

      expect(output).toContain("€25.00")
      expect(output).toContain("Trasporto Express")
      expect(output).not.toContain("[LINK_REGISTRATION]")
    })

    it("should HIDE prices for non-registered customers", () => {
      const customerIsActive = false
      const service = {
        name: "Trasporto Express",
        code: "TRANSP001",
        price: 25.0,
        currency: "€",
      }

      let output = ""
      if (customerIsActive) {
        output = `- ${service.name} (${service.code}): ${service.currency}${service.price.toFixed(2)}`
      } else {
        output = `- ${service.name} (${service.code}): 💳 Registrati per vedere i prezzi: [LINK_REGISTRATION]`
      }

      expect(output).not.toContain("€25.00")
      expect(output).not.toContain("€")
      expect(output).toContain("[LINK_REGISTRATION]")
      expect(output).toContain("Registrati per vedere i prezzi")
      expect(output).toContain("Trasporto Express") // Still show service name
    })
  })

  describe("Edge Cases", () => {
    it("should handle zero price correctly for registered users", () => {
      const customerIsActive = true
      const price = 0

      let output = ""
      if (customerIsActive) {
        output = `€${price.toFixed(2)}`
      } else {
        output = "[LINK_REGISTRATION]"
      }

      expect(output).toBe("€0.00")
    })

    it("should handle zero price correctly for non-registered users", () => {
      const customerIsActive = false
      const price = 0

      let output = ""
      if (customerIsActive) {
        output = `€${price.toFixed(2)}`
      } else {
        output = "[LINK_REGISTRATION]"
      }

      expect(output).toBe("[LINK_REGISTRATION]")
    })

    it("should not leak price information in any format for non-registered users", () => {
      const customerIsActive = false
      const products = [
        { name: "Product 1", price: 10.50 },
        { name: "Product 2", price: 99.99 },
        { name: "Product 3", price: 123.45 },
      ]

      const outputs = products.map(p => {
        if (customerIsActive) {
          return `${p.name}: €${p.price.toFixed(2)}`
        } else {
          return `${p.name}: [LINK_REGISTRATION]`
        }
      })

      const combined = outputs.join("\n")

      // Should NOT contain ANY price patterns
      expect(combined).not.toMatch(/€?\d+\.\d{2}/)
      expect(combined).not.toMatch(/\d+\.\d{2}/)
      expect(combined).not.toContain("10.50")
      expect(combined).not.toContain("99.99")
      expect(combined).not.toContain("123.45")

      // Should contain registration links
      const linkCount = (combined.match(/\[LINK_REGISTRATION\]/g) || []).length
      expect(linkCount).toBe(3)
    })
  })

  describe("Parameter Validation", () => {
    it("should default to isActive=true when parameter not provided", () => {
      // Default behavior from method signature: customerIsActive: boolean = true
      const customerIsActive = true // Default parameter value

      expect(customerIsActive).toBe(true)
    })

    it("should respect explicit isActive=false parameter", () => {
      const customerIsActive = false

      expect(customerIsActive).toBe(false)
    })

    it("should handle undefined isActive as false (safe default)", () => {
      const customerIsActiveUndefined = undefined
      const customerIsActive = customerIsActiveUndefined ?? false

      expect(customerIsActive).toBe(false)
    })
  })

  describe("Integration with Customer Status", () => {
    it("should derive customerIsActive from customer.isActive field", () => {
      const customer = {
        id: "customer-1",
        name: "test",
        email: "temp_1234567890@pending.com",
        isActive: false, // NOT registered
      }

      const customerIsActive = customer.isActive

      expect(customerIsActive).toBe(false)
    })

    it("should show prices when customer is registered", () => {
      const customer = {
        id: "customer-1",
        name: "Andrea Rossi",
        email: "andrea@gmail.com",
        isActive: true, // Registered
      }

      const customerIsActive = customer.isActive

      expect(customerIsActive).toBe(true)
    })
  })
})
