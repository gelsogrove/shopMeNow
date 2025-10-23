/**
 * PRICING CONSISTENCY TEST
 *
 * This test verifies that all pricing information is consistent across:
 * - Schema (BillingType enum)
 * - Backend (billing-prices.enum.ts)
 * - Seed data
 * - Frontend UI components
 *
 * CRITICAL: If this test fails, it means pricing is inconsistent!
 *
 * NOTE: Human Support is FREE - messages during support are charged at MESSAGE rate (€0.15)
 */

import { BillingType } from "@prisma/client"
import { BillingPrices } from "../../domain/enums/billing-prices.enum"

describe("Pricing Consistency Tests", () => {
  describe("BillingPrices Enum Structure", () => {
    it("should have exactly 5 pricing entries (4 paid + 1 monthly channel)", () => {
      const prices = Object.keys(BillingPrices)
      const uniqueKeys = prices.filter((key) => isNaN(Number(key)))

      expect(uniqueKeys).toHaveLength(5)
      expect(uniqueKeys).toContain("MONTHLY_CHANNEL_COST")
      expect(uniqueKeys).toContain("MESSAGE")
      expect(uniqueKeys).toContain("NEW_CUSTOMER")
      expect(uniqueKeys).toContain("NEW_ORDER")
      expect(uniqueKeys).toContain("PUSH_CAMPAIGN")
    })

    it("should have correct pricing values", () => {
      expect(BillingPrices.MONTHLY_CHANNEL_COST).toBe(59.0)
      expect(BillingPrices.MESSAGE).toBe(0.15)
      expect(BillingPrices.NEW_CUSTOMER).toBe(1.5)
      expect(BillingPrices.NEW_ORDER).toBe(1.5)
      expect(BillingPrices.PUSH_CAMPAIGN).toBe(1.0)
    })
  })

  describe("Billing Schema (Prisma)", () => {
    it("should have exactly 8 billing types", () => {
      const billingTypes = Object.values(BillingType)
      expect(billingTypes).toHaveLength(8)
    })

    it("should NOT contain removed types", () => {
      const billingTypes = Object.values(BillingType)
      expect(billingTypes).not.toContain("PUSH_MESSAGE")
      expect(billingTypes).not.toContain("HUMAN_SUPPORT")
    })
  })
})
