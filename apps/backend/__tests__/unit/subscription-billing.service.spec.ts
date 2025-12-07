/**
 * Unit Tests for Subscription Billing Service
 * Feature 198: Billing Owner Refactor
 *
 * Tests for owner-based billing:
 * - Credit balance checks on User (Owner)
 * - Billing overview for owner
 * - Plan upgrades
 * - Credit recharge
 */

import { SubscriptionBillingService } from "../../src/application/services/subscription-billing.service"

// Mock Repository
const mockRepository = {
  getOwnerBilling: jest.fn(),
  getOwnerUsage: jest.fn(),
  getOwnerCreditBalance: jest.fn(),
  getPlanConfiguration: jest.fn(),
  getAllPlanConfigurations: jest.fn(),
  deductOwnerCredit: jest.fn(),
  addOwnerCredit: jest.fn(),
  upgradeOwnerPlan: jest.fn(),
  getOwnerTransactionHistory: jest.fn(),
  getCreditBalance: jest.fn(),
  getWorkspaceBilling: jest.fn(),
}

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  products: {
    count: jest.fn(),
  },
  customers: {
    count: jest.fn(),
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

// Mock the repository module
jest.mock("../../src/repositories/subscription-billing.repository", () => ({
  SubscriptionBillingRepository: jest.fn().mockImplementation(() => mockRepository),
}))

describe("SubscriptionBillingService - Feature 198 Owner-Based Billing", () => {
  let service: SubscriptionBillingService

  const mockUserId = "test-user-id"
  const mockWorkspaceId = "test-workspace-id"

  const mockOwnerBilling = {
    planType: "BASIC",
    creditBalance: 50.0,
    trialEndsAt: null,
    planStartedAt: new Date(),
    nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    isTrialExpired: false,
    daysUntilTrialExpires: null,
    totalRecharges: 100.0,
    subscriptionStatus: "ACTIVE",
  }

  const mockPlanLimits = {
    maxChannels: 3,
    maxProducts: 100,
    maxCustomers: 500,
    messageCost: 0.1,
    orderCost: 1.0,
    pushCost: 1.0,
    lowBalanceThreshold: 5.0,
    monthlyFee: 19.0,
  }

  const mockOwnerUsage = {
    productsCount: 25,
    customersCount: 100,
    channelsCount: 2,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    service = new SubscriptionBillingService(mockPrisma as any)
    ;(service as any).repository = mockRepository
  })

  describe("getOwnerCreditBalance", () => {
    it("should return owner credit balance", async () => {
      mockRepository.getOwnerCreditBalance.mockResolvedValue(50.0)

      const result = await service.getOwnerCreditBalance(mockUserId)

      expect(result).toBe(50.0)
      expect(mockRepository.getOwnerCreditBalance).toHaveBeenCalledWith(mockUserId)
    })
  })

  describe("getCreditBalance (backward compatibility)", () => {
    it("should return owner credit balance from workspaceId", async () => {
      mockRepository.getCreditBalance.mockResolvedValue(50.0)

      const result = await service.getCreditBalance(mockWorkspaceId)

      expect(result).toBe(50.0)
      expect(mockRepository.getCreditBalance).toHaveBeenCalledWith(mockWorkspaceId)
    })
  })

  describe("checkOwnerCredit", () => {
    const CREDIT_MIN_THRESHOLD = -10

    it("should return hasSufficientCredit true when balance is enough", async () => {
      mockRepository.getOwnerCreditBalance.mockResolvedValue(50.0)

      const result = await service.checkOwnerCredit(mockUserId, 10.0)

      expect(result.hasSufficientCredit).toBe(true)
      expect(result.currentBalance).toBe(50.0)
      expect(result.requiredAmount).toBe(10.0)
      expect(result.deficit).toBeUndefined()
    })

    it("should return hasSufficientCredit true when deduction results in negative balance above threshold", async () => {
      mockRepository.getOwnerCreditBalance.mockResolvedValue(5.0)

      const result = await service.checkOwnerCredit(mockUserId, 10.0)

      // Balance after: 5 - 10 = -5, which is >= -10 threshold
      expect(result.hasSufficientCredit).toBe(true)
      expect(result.currentBalance).toBe(5.0)
    })

    it("should return hasSufficientCredit true when balance after equals exactly -€10", async () => {
      mockRepository.getOwnerCreditBalance.mockResolvedValue(0)

      const result = await service.checkOwnerCredit(mockUserId, 10.0)

      // Balance after: 0 - 10 = -10, which is >= -10 threshold
      expect(result.hasSufficientCredit).toBe(true)
    })

    it("should return hasSufficientCredit false when deduction would go below -€10", async () => {
      mockRepository.getOwnerCreditBalance.mockResolvedValue(-5.0)

      const result = await service.checkOwnerCredit(mockUserId, 10.0)

      // Balance after: -5 - 10 = -15, which is < -10 threshold
      expect(result.hasSufficientCredit).toBe(false)
      expect(result.deficit).toBe(5.0) // Need 5 more to reach -10
    })
  })

  describe("getOwnerBillingOverview", () => {
    it("should return complete billing overview for owner", async () => {
      mockRepository.getOwnerBilling.mockResolvedValue(mockOwnerBilling)
      mockRepository.getOwnerUsage.mockResolvedValue(mockOwnerUsage)
      mockRepository.getPlanConfiguration.mockResolvedValue(mockPlanLimits)
      mockPrisma.planConfiguration.findUnique.mockResolvedValue({
        displayName: "Basic Plan",
        monthlyFee: 19.0,
        features: JSON.stringify(["Feature 1", "Feature 2"]),
      })

      const result = await service.getOwnerBillingOverview(mockUserId)

      expect(result.billing.planType).toBe("BASIC")
      expect(result.billing.creditBalance).toBe(50.0)
      expect(result.usage.productsCount).toBe(25)
      expect(result.usage.productsPercentage).toBe(25) // 25/100 * 100
      expect(result.limits.maxProducts).toBe(100)
      expect(result.planConfig.displayName).toBe("Basic Plan")
    })

    it("should throw error when user not found", async () => {
      mockRepository.getOwnerBilling.mockResolvedValue(null)

      await expect(service.getOwnerBillingOverview(mockUserId)).rejects.toThrow(
        "User not found"
      )
    })
  })

  describe("getBillingOverview (backward compatibility)", () => {
    it("should get owner billing from workspaceId", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ ownerId: mockUserId })
      mockRepository.getOwnerBilling.mockResolvedValue(mockOwnerBilling)
      mockRepository.getOwnerUsage.mockResolvedValue(mockOwnerUsage)
      mockRepository.getPlanConfiguration.mockResolvedValue(mockPlanLimits)
      mockPrisma.planConfiguration.findUnique.mockResolvedValue({
        displayName: "Basic Plan",
        monthlyFee: 19.0,
        features: JSON.stringify([]),
      })

      const result = await service.getBillingOverview(mockWorkspaceId)

      expect(result.billing.creditBalance).toBe(50.0)
      expect(mockPrisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: mockWorkspaceId },
        select: { ownerId: true },
      })
    })

    it("should throw error when workspace has no owner", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ ownerId: null })

      await expect(service.getBillingOverview(mockWorkspaceId)).rejects.toThrow(
        "Workspace not found or has no owner"
      )
    })
  })

  describe("isTrialValid", () => {
    it("should return valid for active trial", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockOwnerBilling,
        planType: "FREE_TRIAL",
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        isTrialExpired: false,
        daysUntilTrialExpires: 7,
      })

      const result = await service.isTrialValid(mockWorkspaceId)

      expect(result.isValid).toBe(true)
      expect(result.isTrialPlan).toBe(true)
      expect(result.daysRemaining).toBe(7)
    })

    it("should return invalid for expired trial", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockOwnerBilling,
        planType: "FREE_TRIAL",
        trialEndsAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        isTrialExpired: true,
        daysUntilTrialExpires: -1,
      })

      const result = await service.isTrialValid(mockWorkspaceId)

      expect(result.isValid).toBe(false)
      expect(result.isTrialPlan).toBe(true)
    })

    it("should return valid for paid plans", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue(mockOwnerBilling)

      const result = await service.isTrialValid(mockWorkspaceId)

      expect(result.isValid).toBe(true)
      expect(result.isTrialPlan).toBe(false)
    })
  })

  describe("getAvailablePlans", () => {
    it("should return all available plans", async () => {
      mockRepository.getAllPlanConfigurations.mockResolvedValue([
        {
          planType: "BASIC",
          displayName: "Basic",
          monthlyFee: 19.0,
          maxChannels: 3,
          maxProducts: 100,
          maxCustomers: 500,
          messageCost: 0.1,
          orderCost: 1.0,
          pushCost: 1.0,
          features: JSON.stringify(["Feature 1"]),
        },
        {
          planType: "PREMIUM",
          displayName: "Premium",
          monthlyFee: 49.0,
          maxChannels: 10,
          maxProducts: 500,
          maxCustomers: 2000,
          messageCost: 0.08,
          orderCost: 0.8,
          pushCost: 0.8,
          features: JSON.stringify(["Feature 1", "Feature 2"]),
        },
      ])

      const result = await service.getAvailablePlans()

      expect(result).toHaveLength(2)
      expect(result[0].planType).toBe("BASIC")
      expect(result[1].planType).toBe("PREMIUM")
      expect(result[0].monthlyFee).toBe(19.0)
    })
  })

  describe("requestOwnerPause - Immediate Pause (Feature 198)", () => {
    it("should pause subscription IMMEDIATELY (not PAUSE_PENDING)", async () => {
      mockRepository.getOwnerBilling.mockResolvedValue({
        ...mockOwnerBilling,
        subscriptionStatus: "ACTIVE",
      })
      mockRepository.updateOwnerSubscriptionStatus = jest.fn().mockResolvedValue(true)

      const result = await service.requestOwnerPause(mockUserId)

      expect(result.success).toBe(true)
      expect(result.effectiveDate).toBeInstanceOf(Date)
      // Verify effectiveDate is NOW (not end of month)
      const now = new Date()
      expect(result.effectiveDate.getTime()).toBeGreaterThanOrEqual(now.getTime() - 1000)
      expect(result.effectiveDate.getTime()).toBeLessThanOrEqual(now.getTime() + 1000)

      // Verify status is PAUSED, not PAUSE_PENDING
      expect(mockRepository.updateOwnerSubscriptionStatus).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          subscriptionStatus: "PAUSED",
          pausedAt: expect.any(Date),
          pauseRequestedAt: expect.any(Date),
        })
      )
    })

    it("should throw error if already paused", async () => {
      mockRepository.getOwnerBilling.mockResolvedValue({
        ...mockOwnerBilling,
        subscriptionStatus: "PAUSED",
      })

      await expect(service.requestOwnerPause(mockUserId)).rejects.toThrow(
        "Subscription is already paused"
      )
    })

    it("should throw error if user not found", async () => {
      mockRepository.getOwnerBilling.mockResolvedValue(null)

      await expect(service.requestOwnerPause(mockUserId)).rejects.toThrow("User not found")
    })
  })

  describe("resumeOwnerSubscription - Free Resume (Feature 198)", () => {
    it("should resume subscription immediately with NO charges", async () => {
      mockRepository.getOwnerBilling.mockResolvedValue({
        ...mockOwnerBilling,
        subscriptionStatus: "PAUSED",
        pausedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      })
      mockRepository.updateOwnerSubscriptionStatus = jest.fn().mockResolvedValue(true)

      const result = await service.resumeOwnerSubscription(mockUserId)

      expect(result.success).toBe(true)
      // Verify status set to ACTIVE
      expect(mockRepository.updateOwnerSubscriptionStatus).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          subscriptionStatus: "ACTIVE",
          pausedAt: null,
          pauseRequestedAt: null,
        })
      )
      // Verify NO deduction was called (resume is FREE)
      expect(mockRepository.deductOwnerCredit).not.toHaveBeenCalled()
    })

    it("should calculate nextBillingDate as 1st of next month", async () => {
      mockRepository.getOwnerBilling.mockResolvedValue({
        ...mockOwnerBilling,
        subscriptionStatus: "PAUSED",
      })
      mockRepository.updateOwnerSubscriptionStatus = jest.fn().mockResolvedValue(true)

      const result = await service.resumeOwnerSubscription(mockUserId)

      const now = new Date()
      const expectedNextBilling = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      expectedNextBilling.setHours(0, 0, 0, 0)

      expect(result.nextBillingDate.getFullYear()).toBe(expectedNextBilling.getFullYear())
      expect(result.nextBillingDate.getMonth()).toBe(expectedNextBilling.getMonth())
      expect(result.nextBillingDate.getDate()).toBe(1)
    })

    it("should throw error if already active", async () => {
      mockRepository.getOwnerBilling.mockResolvedValue({
        ...mockOwnerBilling,
        subscriptionStatus: "ACTIVE",
      })

      await expect(service.resumeOwnerSubscription(mockUserId)).rejects.toThrow(
        "Subscription is already active"
      )
    })

    it("should throw error if user not found", async () => {
      mockRepository.getOwnerBilling.mockResolvedValue(null)

      await expect(service.resumeOwnerSubscription(mockUserId)).rejects.toThrow(
        "User not found"
      )
    })
  })

  describe("getOwnerSubscriptionStatus", () => {
    it("should return PAUSED status with pausedAt timestamp", async () => {
      const pausedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      mockRepository.getOwnerSubscriptionStatus = jest.fn().mockResolvedValue({
        status: "PAUSED",
        pausedAt,
        pauseRequestedAt: pausedAt,
      })

      const result = await service.getOwnerSubscriptionStatus(mockUserId)

      expect(result.status).toBe("PAUSED")
      expect(result.pausedAt).toEqual(pausedAt)
      expect(result.pauseEffectiveDate).toEqual(pausedAt)
    })

    it("should return ACTIVE status with null paused fields", async () => {
      mockRepository.getOwnerSubscriptionStatus = jest.fn().mockResolvedValue({
        status: "ACTIVE",
        pausedAt: null,
        pauseRequestedAt: null,
      })

      const result = await service.getOwnerSubscriptionStatus(mockUserId)

      expect(result.status).toBe("ACTIVE")
      expect(result.pausedAt).toBeNull()
      expect(result.pauseEffectiveDate).toBeNull()
    })
  })
})
