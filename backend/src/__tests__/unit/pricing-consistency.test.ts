/**
 * PRICING CONSISTENCY TEST
 *
 * This test verifies that pricing configuration from database is correct.
 * All pricing now comes from PricingConfig table (single source of truth).
 *
 * CRITICAL: If this test fails, check seed data in prisma/data/pricingConfig.ts
 *
 * NOTE: Human Support is FREE - messages during support are charged at MESSAGE rate (€0.15)
 */

import { BillingType, PrismaClient } from "@prisma/client"
import { PricingRepository } from "../../repositories/pricing.repository"

const prisma = new PrismaClient()
const pricingRepo = new PricingRepository(prisma)

describe("Pricing Consistency Tests", () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe("PricingConfig Database", () => {
    it("should have all required pricing configurations", async () => {
      const all = await pricingRepo.getAll()
      expect(all.length).toBeGreaterThanOrEqual(13) // 5 plans + 4 usage + 4+ thresholds
    })

    it("should have correct PLAN pricing", async () => {
      const plans = await pricingRepo.getByType("PLAN")
      const planMap = plans.reduce(
        (acc, p) => {
          acc[p.key] = p.value
          return acc
        },
        {} as Record<string, number>
      )

      expect(planMap.FREE_MONTHLY).toBe(0)
      expect(planMap.BASIC_MONTHLY).toBe(29)
      expect(planMap.PREMIUM_MONTHLY).toBe(59)
      expect(planMap.ENTERPRISE_MONTHLY).toBe(199)
      expect(planMap.MONTHLY_CHANNEL_COST).toBe(59)
    })

    it("should have correct USAGE pricing", async () => {
      const usage = await pricingRepo.getByType("USAGE")
      const usageMap = usage.reduce(
        (acc, p) => {
          acc[p.key] = p.value
          return acc
        },
        {} as Record<string, number>
      )

      expect(usageMap.MESSAGE).toBe(0.15)
      expect(usageMap.NEW_CUSTOMER).toBe(1.5)
      expect(usageMap.NEW_ORDER).toBe(1.5)
      expect(usageMap.PUSH_CAMPAIGN).toBe(1.0)
    })

    it("should have correct THRESHOLD values", async () => {
      const thresholds = await pricingRepo.getByType("THRESHOLD")
      const thresholdMap = thresholds.reduce(
        (acc, p) => {
          acc[p.key] = p.value
          return acc
        },
        {} as Record<string, number>
      )

      expect(thresholdMap.FREE_MESSAGES).toBe(200)
      expect(thresholdMap.FREE_PRODUCTS).toBe(50)
      expect(thresholdMap.FREE_CLIENTS).toBe(50)
    })

    it("should NOT contain HUMAN_SUPPORT pricing (free - covered by MESSAGE)", async () => {
      const humanSupport = await pricingRepo.getByKey("HUMAN_SUPPORT")
      expect(humanSupport).toBeNull()
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

  describe("PricingRepository Methods", () => {
    it("should return grouped pricing correctly", async () => {
      const grouped = await pricingRepo.getAllGrouped()

      expect(grouped.plans).toBeDefined()
      expect(grouped.usage).toBeDefined()
      expect(grouped.thresholds).toBeDefined()

      expect(Object.keys(grouped.plans).length).toBeGreaterThan(0)
      expect(Object.keys(grouped.usage).length).toBe(4)
      expect(Object.keys(grouped.thresholds).length).toBeGreaterThan(0)
    })

    it("should retrieve pricing by key", async () => {
      const messagePricing = await pricingRepo.getByKey("MESSAGE")
      expect(messagePricing).not.toBeNull()
      expect(messagePricing?.value).toBe(0.15)
      expect(messagePricing?.type).toBe("USAGE")
    })

    it("should retrieve pricing value directly", async () => {
      const messageValue = await pricingRepo.getValue("MESSAGE")
      expect(messageValue).toBe(0.15)
    })
  })
})
