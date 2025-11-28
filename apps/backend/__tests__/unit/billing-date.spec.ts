/**
 * Unit Tests for Billing Date Logic
 * Feature 185: Subscription & Billing System
 *
 * Tests for the "1st of next month" billing date rule:
 * - All users pay on the 1st of each month
 * - Upgrade/downgrade takes effect immediately but billing is on 1st of next month
 */

import { SubscriptionBillingRepository } from "../../src/repositories/subscription-billing.repository"

// Mock Prisma
const mockPrisma = {
  workspace: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  planConfiguration: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  billingTransaction: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  $transaction: jest.fn((callback: any) => callback(mockPrisma)),
}

describe("Billing Date Logic - 1st of Next Month", () => {
  let repository: SubscriptionBillingRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repository = new SubscriptionBillingRepository(mockPrisma as any)
  })

  describe("getFirstOfNextMonth", () => {
    it("should return 1st of next month when upgrading mid-month", () => {
      // Mock current date: November 27, 2025
      const mockDate = new Date(2025, 10, 27) // Month is 0-indexed
      jest.useFakeTimers().setSystemTime(mockDate)

      // Access private method through reflection
      const result = (repository as any).getFirstOfNextMonth()

      // Should be December 1, 2025
      expect(result.getFullYear()).toBe(2025)
      expect(result.getMonth()).toBe(11) // December (0-indexed)
      expect(result.getDate()).toBe(1)
      expect(result.getHours()).toBe(0)
      expect(result.getMinutes()).toBe(0)
      expect(result.getSeconds()).toBe(0)

      jest.useRealTimers()
    })

    it("should return 1st of next month when upgrading on last day of month", () => {
      // Mock current date: November 30, 2025
      const mockDate = new Date(2025, 10, 30)
      jest.useFakeTimers().setSystemTime(mockDate)

      const result = (repository as any).getFirstOfNextMonth()

      // Should be December 1, 2025
      expect(result.getFullYear()).toBe(2025)
      expect(result.getMonth()).toBe(11)
      expect(result.getDate()).toBe(1)

      jest.useRealTimers()
    })

    it("should return 1st of next month when upgrading on 1st day of month", () => {
      // Mock current date: December 1, 2025
      const mockDate = new Date(2025, 11, 1)
      jest.useFakeTimers().setSystemTime(mockDate)

      const result = (repository as any).getFirstOfNextMonth()

      // Should be January 1, 2026
      expect(result.getFullYear()).toBe(2026)
      expect(result.getMonth()).toBe(0) // January
      expect(result.getDate()).toBe(1)

      jest.useRealTimers()
    })

    it("should handle year rollover correctly (December → January)", () => {
      // Mock current date: December 15, 2025
      const mockDate = new Date(2025, 11, 15)
      jest.useFakeTimers().setSystemTime(mockDate)

      const result = (repository as any).getFirstOfNextMonth()

      // Should be January 1, 2026
      expect(result.getFullYear()).toBe(2026)
      expect(result.getMonth()).toBe(0)
      expect(result.getDate()).toBe(1)

      jest.useRealTimers()
    })

    it("should handle February correctly (leap year)", () => {
      // Mock current date: January 15, 2024 (2024 is a leap year)
      const mockDate = new Date(2024, 0, 15)
      jest.useFakeTimers().setSystemTime(mockDate)

      const result = (repository as any).getFirstOfNextMonth()

      // Should be February 1, 2024
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(1) // February
      expect(result.getDate()).toBe(1)

      jest.useRealTimers()
    })
  })

  describe("upgradePlan with 1st of next month billing", () => {
    it("should set nextBillingDate to 1st of next month on upgrade", async () => {
      // Mock current date: November 27, 2025
      const mockDate = new Date(2025, 10, 27)
      jest.useFakeTimers().setSystemTime(mockDate)

      mockPrisma.workspace.update.mockResolvedValue({ id: "workspace-1" })

      const result = await repository.upgradePlan("workspace-1", "PREMIUM" as any)

      expect(result.success).toBe(true)
      expect(result.nextBillingDate.getFullYear()).toBe(2025)
      expect(result.nextBillingDate.getMonth()).toBe(11) // December
      expect(result.nextBillingDate.getDate()).toBe(1)

      // Verify prisma was called with correct date
      expect(mockPrisma.workspace.update).toHaveBeenCalledWith({
        where: { id: "workspace-1" },
        data: expect.objectContaining({
          planType: "PREMIUM",
          nextBillingDate: expect.any(Date),
        }),
      })

      jest.useRealTimers()
    })

    it("should clear trialEndsAt when upgrading", async () => {
      const mockDate = new Date(2025, 10, 27)
      jest.useFakeTimers().setSystemTime(mockDate)

      mockPrisma.workspace.update.mockResolvedValue({ id: "workspace-1" })

      await repository.upgradePlan("workspace-1", "BASIC" as any)

      expect(mockPrisma.workspace.update).toHaveBeenCalledWith({
        where: { id: "workspace-1" },
        data: expect.objectContaining({
          trialEndsAt: null,
        }),
      })

      jest.useRealTimers()
    })
  })
})

describe("Billing Date - Edge Cases", () => {
  let repository: SubscriptionBillingRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repository = new SubscriptionBillingRepository(mockPrisma as any)
  })

  it("should handle upgrade on January 31 correctly", () => {
    // January 31 → February 1
    const mockDate = new Date(2025, 0, 31)
    jest.useFakeTimers().setSystemTime(mockDate)

    const result = (repository as any).getFirstOfNextMonth()

    expect(result.getMonth()).toBe(1) // February
    expect(result.getDate()).toBe(1)

    jest.useRealTimers()
  })

  it("should handle upgrade during daylight saving time change", () => {
    // March 9, 2025 is DST start in US
    const mockDate = new Date(2025, 2, 9, 10, 0, 0)
    jest.useFakeTimers().setSystemTime(mockDate)

    const result = (repository as any).getFirstOfNextMonth()

    expect(result.getMonth()).toBe(3) // April
    expect(result.getDate()).toBe(1)
    expect(result.getHours()).toBe(0)

    jest.useRealTimers()
  })
})
