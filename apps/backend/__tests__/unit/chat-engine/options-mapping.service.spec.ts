/**
 * OptionsMappingService Unit Tests
 *
 * Tests for the cleanLabel function used to normalize option labels
 * before database queries.
 *
 * @see apps/backend/src/application/chat-engine/options-mapping.service.ts
 */

import { OptionsMappingService } from "../../../src/application/chat-engine/options-mapping.service"

describe("OptionsMappingService", () => {
  describe("cleanLabel", () => {
    // =========================================================================
    // UT-OM-1: Strip # prefix from order codes
    // =========================================================================
    describe("order codes with # prefix", () => {
      it("should strip # prefix from order code #ORD-048-2025-9", () => {
        const input = "#ORD-048-2025-9"
        const result = OptionsMappingService.cleanLabel(input)
        expect(result).toBe("ORD-048-2025-9")
      })

      it("should strip # prefix from order code with date format", () => {
        const input = "#ORD-001-2024-12"
        const result = OptionsMappingService.cleanLabel(input)
        expect(result).toBe("ORD-001-2024-12")
      })

      it("should strip # prefix from order code with additional info", () => {
        const input = "#ORD-048-2025-9 - 15/12/2024 - €450,00"
        const result = OptionsMappingService.cleanLabel(input)
        expect(result).toBe("ORD-048-2025-9 - 15/12/2024")
      })
    })

    // =========================================================================
    // UT-OM-2: Handle order codes without # prefix
    // =========================================================================
    describe("order codes without # prefix", () => {
      it("should preserve order code without # prefix", () => {
        const input = "ORD-048-2025-9"
        const result = OptionsMappingService.cleanLabel(input)
        expect(result).toBe("ORD-048-2025-9")
      })

      it("should preserve simple order code", () => {
        const input = "ORD-001-2024-1"
        const result = OptionsMappingService.cleanLabel(input)
        expect(result).toBe("ORD-001-2024-1")
      })
    })

    // =========================================================================
    // UT-OM-3: Preserve other label formats (products, categories)
    // =========================================================================
    describe("product and category labels", () => {
      it("should clean category with product count", () => {
        const input = "Formaggi (7 prodotti)"
        const result = OptionsMappingService.cleanLabel(input)
        expect(result).toBe("Formaggi")
      })

      it("should clean category with emoji and count", () => {
        const input = "Condimenti (6 prodotti) 🥫"
        const result = OptionsMappingService.cleanLabel(input)
        expect(result).toBe("Condimenti")
      })

      it("should clean product with SKU and price", () => {
        const input = "Mozzarella (FORM-001) - €12.50 [Formaggi]"
        const result = OptionsMappingService.cleanLabel(input)
        expect(result).toBe("Mozzarella")
      })

      it("should clean product with long name, SKU, price and category", () => {
        const input = "Carciofi alla Romana Surgelati (FROZ-CAR-001) - €8.50 [Surgelati]"
        const result = OptionsMappingService.cleanLabel(input)
        expect(result).toBe("Carciofi alla Romana Surgelati")
      })

      it("should clean product with items count", () => {
        const input = "Pasta Fresca (4 items)"
        const result = OptionsMappingService.cleanLabel(input)
        expect(result).toBe("Pasta Fresca")
      })

      it("should clean service with servizi count", () => {
        const input = "Trasporti (3 servizi)"
        const result = OptionsMappingService.cleanLabel(input)
        expect(result).toBe("Trasporti")
      })

      it("should preserve simple product name", () => {
        const input = "Parmigiano Reggiano"
        const result = OptionsMappingService.cleanLabel(input)
        expect(result).toBe("Parmigiano Reggiano")
      })

      it("should remove multiple emojis", () => {
        const input = "🍕 Pizza Margherita 🔥"
        const result = OptionsMappingService.cleanLabel(input)
        expect(result).toBe("Pizza Margherita")
      })
    })

    // =========================================================================
    // Edge cases
    // =========================================================================
    describe("edge cases", () => {
      it("should handle empty string", () => {
        const input = ""
        const result = OptionsMappingService.cleanLabel(input)
        expect(result).toBe("")
      })

      it("should handle string with only #", () => {
        const input = "#"
        const result = OptionsMappingService.cleanLabel(input)
        expect(result).toBe("")
      })

      it("should not strip # in the middle of string", () => {
        const input = "Product #1 Special"
        const result = OptionsMappingService.cleanLabel(input)
        expect(result).toBe("Product #1 Special")
      })

      it("should handle multiple spaces", () => {
        const input = "  Formaggi (7 prodotti)  "
        const result = OptionsMappingService.cleanLabel(input)
        expect(result).toBe("Formaggi")
      })
    })
  })
})
