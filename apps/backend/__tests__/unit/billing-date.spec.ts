/**
 * Unit Tests for Billing Date Logic
 * Feature 198: Billing Owner Refactor
 *
 * Tests for the "1st of next month" billing date rule:
 * - All users pay on the 1st of each month
 * - Upgrade/downgrade takes effect immediately but billing is on 1st of next month
 */

import { SubscriptionBillingRepository } from "../../src/repositories/subscription-billing.repository"

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
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
  products: {
    count: jest.fn(),
  },
  customers: {
    count: jest.fn(),
  },
  $transaction: jest.fn((callback: any) => callback(mockPrisma)),
}

describe("Billing Date Logic - 1st of Next Month (Feature 198)", () => {
  let repository: SubscriptionBillingRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repository = new SubscriptionBillingRepository(mockPrisma as any)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe("getFirstOfNextMonth (internal method)", () => {
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
    })

    it("should return 1st of next month when upgrading on 1st day of month", () => {
      // Mock current date: November 1, 2025
      const mockDate = new Date(2025, 10, 1)
      jest.useFakeTimers().setSystemTime(mockDate)

      const result = (repository as any).getFirstOfNextMonth()

      // Should be December 1, 2025
      expect(result.getFullYear()).toBe(2025)
      expect(result.getMonth()).toBe(11)
      expect(result.getDate()).toBe(1)
    })

    it("should handle year rollover correctly (December → January)", () => {
      // Mock current date: December 15, 2025
      const mockDate = new Date(2025, 11, 15)
      jest.useFakeTimers().setSystemTime(mockDate)

      const result = (repository as any).getFirstOfNextMonth()

      // Should be January 1, 2026
      expect(result.getFullYear()).toBe(2026)
      expect(result.getMonth()).toBe(0) // January
      expect(result.getDate()).toBe(1)
    })

    it("should handle February correctly (leap year)", () => {
      // Mock current date: February 15, 2024 (leap year)
      const mockDate = new Date(2024, 1, 15)
      jest.useFakeTimers().setSystemTime(mockDate)

      const result = (repository as any).getFirstOfNextMonth()

      // Should be March 1, 2024
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(2) // March
      expect(result.getDate()).toBe(1)
    })
  })

  describe("upgradeOwnerPlan - nextBillingDate calculation", () => {
    const mockUserId = "test-user-id"

    beforeEach(() => {
      // Setup common mocks
      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        planType: "BASIC",
        creditBalance: 50,
        subscriptionStatus: "ACTIVE",
      })
      mockPrisma.planConfiguration.findUnique.mockResolvedValue({
        planType: "PREMIUM",
        displayName: "Premium",
        monthlyFee: 49,
        maxChannels: 10,
        maxCustomers: 2000,
        maxTeamMembers: 9999,
      })
      mockPrisma.user.update.mockResolvedValue({
        id: mockUserId,
        planType: "PREMIUM",
      })
      mockPrisma.billingTransaction.create.mockResolvedValue({ id: "tx-1" })
    })

    it("should set nextBillingDate to 1st of next month on upgrade", async () => {
      // Mock current date: November 27, 2025
      const mockDate = new Date(2025, 10, 27)
      jest.useFakeTimers().setSystemTime(mockDate)

      await repository.upgradeOwnerPlan(mockUserId, "PREMIUM")

      // Verify user update was called with correct nextBillingDate
      expect(mockPrisma.user.update).toHaveBeenCalled()
      const updateCall = mockPrisma.user.update.mock.calls[0][0]
      const nextBillingDate = updateCall.data.nextBillingDate

      // Should be December 1, 2025
      expect(nextBillingDate.getFullYear()).toBe(2025)
      expect(nextBillingDate.getMonth()).toBe(11)
      expect(nextBillingDate.getDate()).toBe(1)
    })

    it("should clear trialEndsAt when upgrading from FREE_TRIAL", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        planType: "FREE_TRIAL",
        creditBalance: 30,
        subscriptionStatus: "ACTIVE",
        trialEndsAt: new Date(2025, 11, 15),
      })

      await repository.upgradeOwnerPlan(mockUserId, "BASIC")

      expect(mockPrisma.user.update).toHaveBeenCalled()
      const updateCall = mockPrisma.user.update.mock.calls[0][0]
      expect(updateCall.data.trialEndsAt).toBeNull()
    })
  })
})
