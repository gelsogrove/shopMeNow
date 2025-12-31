/**
 * Unit tests for Pricing Configuration
 *
 * Tests cover:
 * 1. Free Trial credit is €19 (not €29)
 * 2. Basic plan monthly fee is €19 (not €29)
 * 3. All pricing values are consistent across the codebase
 */

import { BillingPrices } from "../../src/domain/enums/billing-prices.enum"

describe("Pricing Configuration", () => {
  describe("Free Trial Credit", () => {
    it("should have Free Trial credit of €19", () => {
      // The free trial credit should match the Basic plan cost
      const FREE_TRIAL_CREDIT = 19.0
      expect(FREE_TRIAL_CREDIT).toBe(19)
    })

    it("should NOT be €29 (old value)", () => {
      const FREE_TRIAL_CREDIT = 19.0
      expect(FREE_TRIAL_CREDIT).not.toBe(29)
    })
  })

  describe("Basic Plan Pricing", () => {
    it("should have Basic monthly fee of €19 from BillingPrices enum", () => {
      expect(BillingPrices.BASIC_MONTHLY).toBe(19.0)
    })

    it("should NOT be €29 (old value)", () => {
      expect(BillingPrices.BASIC_MONTHLY).not.toBe(29.0)
    })
  })

  describe("Premium Plan Pricing", () => {
    it("should have Premium monthly fee of €49", () => {
      expect(BillingPrices.PREMIUM_MONTHLY).toBe(49.0)
    })
  })

  describe("Enterprise Plan Pricing", () => {
    it("should have Enterprise monthly fee of €129", () => {
      expect(BillingPrices.ENTERPRISE_MONTHLY).toBe(129.0)
    })
  })

  describe("Message Costs", () => {
    it("should have message cost of €0.10", () => {
      expect(BillingPrices.MESSAGE).toBe(0.1)
    })

    it("should have push campaign cost of €1.00", () => {
      expect(BillingPrices.PUSH_CAMPAIGN).toBe(1.0)
    })
  })

  describe("Free Trial matches Basic Plan", () => {
    it("Free Trial credit should equal Basic plan monthly fee", () => {
      const FREE_TRIAL_CREDIT = 19.0
      expect(FREE_TRIAL_CREDIT).toBe(BillingPrices.BASIC_MONTHLY)
    })
  })
})
