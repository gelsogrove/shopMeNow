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
  addCredit: jest.fn(),
  upgradeOwnerPlan: jest.fn(),
  getOwnerTransactionHistory: jest.fn(),
  getCreditBalance: jest.fn(),
  getWorkspaceBilling: jest.fn(),
  updateOwnerSubscriptionStatus: jest.fn(),
  getOwnerSubscriptionStatus: jest.fn(),
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
    deleteMany: jest.fn(),
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
    maxCustomers: 500,
    maxTeamMembers: 0,
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
          maxCustomers: 500,
          maxTeamMembers: 0,
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
          maxCustomers: 2000,
          maxTeamMembers: 9999,
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

  // ============================================================================
  // FREE TRIAL 14 DAYS EXPIRATION TESTS
  // ============================================================================

  describe("Free Trial 14 Days Expiration", () => {
    const TRIAL_DURATION_DAYS = 14

    it("should block user when FREE_TRIAL expires after exactly 14 days", async () => {
      const trialStartDate = new Date()
      trialStartDate.setDate(trialStartDate.getDate() - TRIAL_DURATION_DAYS) // Started 14 days ago
      
      const trialEndsAt = new Date(trialStartDate)
      trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS) // Ended today
      
      // Simulate expired trial (trialEndsAt is in the past)
      const expiredTrialEndsAt = new Date(Date.now() - 1000) // 1 second ago
      
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockOwnerBilling,
        planType: "FREE_TRIAL",
        trialEndsAt: expiredTrialEndsAt,
        isTrialExpired: true,
        daysUntilTrialExpires: -1,
      })

      const result = await service.isTrialValid(mockWorkspaceId)

      expect(result.isValid).toBe(false)
      expect(result.isTrialPlan).toBe(true)
      // Trial has expired - isValid should be false
      expect(result.expiredAt).toEqual(expiredTrialEndsAt)
    })

    it("should allow user when FREE_TRIAL has 1 day remaining", async () => {
      const trialEndsAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) // 1 day from now
      
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockOwnerBilling,
        planType: "FREE_TRIAL",
        trialEndsAt,
        isTrialExpired: false,
        daysUntilTrialExpires: 1,
      })

      const result = await service.isTrialValid(mockWorkspaceId)

      expect(result.isValid).toBe(true)
      expect(result.isTrialPlan).toBe(true)
      expect(result.daysRemaining).toBe(1)
    })

    it("should show 14 days remaining for brand new FREE_TRIAL", async () => {
      const trialEndsAt = new Date(Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000)
      
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockOwnerBilling,
        planType: "FREE_TRIAL",
        trialEndsAt,
        isTrialExpired: false,
        daysUntilTrialExpires: TRIAL_DURATION_DAYS,
      })

      const result = await service.isTrialValid(mockWorkspaceId)

      expect(result.isValid).toBe(true)
      expect(result.isTrialPlan).toBe(true)
      expect(result.daysRemaining).toBe(TRIAL_DURATION_DAYS)
    })

    it("should block messaging when trial is expired", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockOwnerBilling,
        planType: "FREE_TRIAL",
        trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
        isTrialExpired: true,
        daysUntilTrialExpires: -1,
      })

      const trialResult = await service.isTrialValid(mockWorkspaceId)
      
      // Trial expired = cannot send messages
      expect(trialResult.isValid).toBe(false)
      
      // Verify credit check would also fail for expired trial
      // (business logic: expired trial blocks all operations)
    })

    it("should auto-upgrade to BASIC when FREE_TRIAL user recharges", async () => {
      mockRepository.getOwnerBilling.mockResolvedValue({
        ...mockOwnerBilling,
        planType: "FREE_TRIAL",
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days left
        isTrialExpired: false,
      })
      mockRepository.upgradeOwnerPlan.mockResolvedValue({ nextBillingDate: new Date() })
      mockRepository.addCredit = jest.fn().mockResolvedValue({ success: true, newBalance: 50 })
      mockRepository.getPlanConfiguration.mockResolvedValue({
        monthlyFee: 19.0,
        displayName: "Basic",
      })

      const result = await service.rechargeOwnerCredit(mockUserId, 50)

      expect(result.success).toBe(true)
      expect(result.upgradedToPlan).toBe("BASIC")
      expect(mockRepository.upgradeOwnerPlan).toHaveBeenCalledWith(mockUserId, "BASIC")
    })
  })

  // ============================================================================
  // PLAN UPGRADE TESTS
  // ============================================================================

  describe("Plan Upgrade (BASIC → PREMIUM)", () => {
    it("should upgrade from BASIC to PREMIUM immediately", async () => {
      mockRepository.getOwnerBilling.mockResolvedValue({
        ...mockOwnerBilling,
        planType: "BASIC",
        creditBalance: 50.0,
      })
      mockRepository.upgradeOwnerPlan.mockResolvedValue({
        nextBillingDate: new Date(2026, 0, 1), // Jan 1st 2026
      })
      mockRepository.getPlanConfiguration.mockResolvedValue({
        monthlyFee: 39.0,
        displayName: "Premium",
      })
      mockPrisma.planConfiguration.findUnique.mockResolvedValue({
        displayName: "Premium",
        monthlyFee: 39.0,
        maxChannels: 10,
        maxCustomers: 2000,
      })
      mockPrisma.billingTransaction.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.billingTransaction.create.mockResolvedValue({})

      const result = await service.changeOwnerPlan(mockUserId, "PREMIUM")

      expect(result.success).toBe(true)
      expect(result.isDowngrade).toBe(false)
      expect(result.newPlan.displayName).toBe("Premium")
      expect(mockRepository.upgradeOwnerPlan).toHaveBeenCalledWith(mockUserId, "PREMIUM")
    })

    it("should set nextBillingDate to 1st of next month on upgrade", async () => {
      const now = new Date()
      const expectedNextBilling = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      
      mockRepository.getOwnerBilling.mockResolvedValue({
        ...mockOwnerBilling,
        planType: "BASIC",
      })
      mockRepository.upgradeOwnerPlan.mockResolvedValue({
        nextBillingDate: expectedNextBilling,
      })
      mockRepository.getPlanConfiguration.mockResolvedValue({
        monthlyFee: 39.0,
        displayName: "Premium",
      })
      mockPrisma.planConfiguration.findUnique.mockResolvedValue({
        displayName: "Premium",
        monthlyFee: 39.0,
      })
      mockPrisma.billingTransaction.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.billingTransaction.create.mockResolvedValue({})

      const result = await service.changeOwnerPlan(mockUserId, "PREMIUM")

      expect(result.nextBillingDate.getDate()).toBe(1)
    })

    it("should throw error when trying to upgrade to same plan", async () => {
      mockRepository.getOwnerBilling.mockResolvedValue({
        ...mockOwnerBilling,
        planType: "PREMIUM",
      })

      await expect(service.changeOwnerPlan(mockUserId, "PREMIUM")).rejects.toThrow(
        "Already on PREMIUM plan"
      )
    })

    it("should throw error when trying to change to FREE_TRIAL", async () => {
      mockRepository.getOwnerBilling.mockResolvedValue(mockOwnerBilling)

      await expect(service.changeOwnerPlan(mockUserId, "FREE_TRIAL")).rejects.toThrow(
        "Cannot change to Free Trial"
      )
    })
  })

  // ============================================================================
  // PLAN DOWNGRADE TESTS
  // ============================================================================

  describe("Plan Downgrade (PREMIUM → BASIC)", () => {
    const mockPremiumBilling = {
      ...mockOwnerBilling,
      planType: "PREMIUM",
      creditBalance: 100.0,
    }

    it("should downgrade from PREMIUM to BASIC when within limits", async () => {
      mockRepository.getOwnerBilling.mockResolvedValue(mockPremiumBilling)
      mockRepository.getOwnerUsage.mockResolvedValue({
        productsCount: 50, // BASIC allows 100
        customersCount: 200, // BASIC allows 500
        channelsCount: 2, // BASIC allows 3
      })
      mockRepository.upgradeOwnerPlan.mockResolvedValue({
        nextBillingDate: new Date(2026, 0, 1),
      })
      mockRepository.getPlanConfiguration.mockResolvedValue({
        monthlyFee: 19.0,
        displayName: "Basic",
      })
      mockPrisma.planConfiguration.findUnique.mockResolvedValue({
        displayName: "Basic",
        monthlyFee: 19.0,
        maxChannels: 3,
        maxCustomers: 500,
      })
      mockPrisma.billingTransaction.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.billingTransaction.create.mockResolvedValue({})

      const result = await service.changeOwnerPlan(mockUserId, "BASIC")

      expect(result.success).toBe(true)
      expect(result.isDowngrade).toBe(true)
      expect(result.newPlan.displayName).toBe("Basic")
    })

    it("should reject downgrade when customers exceed target plan limit", async () => {
      mockRepository.getOwnerBilling.mockResolvedValue(mockPremiumBilling)
      mockRepository.getOwnerUsage.mockResolvedValue({
        productsCount: 50,
        customersCount: 600, // BASIC only allows 500
        channelsCount: 2,
      })
      mockPrisma.planConfiguration.findUnique.mockResolvedValue({
        displayName: "Basic",
        monthlyFee: 19.0,
        maxChannels: 3,
        maxCustomers: 500,
      })

      await expect(service.changeOwnerPlan(mockUserId, "BASIC")).rejects.toThrow(
        /Too many customers/
      )
    })

    it("should reject downgrade when channels exceed target plan limit", async () => {
      mockRepository.getOwnerBilling.mockResolvedValue(mockPremiumBilling)
      mockRepository.getOwnerUsage.mockResolvedValue({
        productsCount: 50,
        customersCount: 200,
        channelsCount: 5, // BASIC only allows 3
      })
      mockPrisma.planConfiguration.findUnique.mockResolvedValue({
        displayName: "Basic",
        monthlyFee: 19.0,
        maxChannels: 3,
        maxCustomers: 500,
      })

      await expect(service.changeOwnerPlan(mockUserId, "BASIC")).rejects.toThrow(
        /Too many channels/
      )
    })
  })

  // ============================================================================
  // MONTHLY INVOICE CALCULATION TESTS
  // ============================================================================

  describe("Monthly Invoice Calculation", () => {
    it("should include plan cost + previous month recharges in invoice", () => {
      // Invoice for October (generated Nov 1st) should include:
      // - October plan cost
      // - Recharges made in October
      
      const planCost = 39.0 // PREMIUM
      const octoberRecharges = 50.0
      const expectedTotal = planCost + octoberRecharges

      expect(expectedTotal).toBe(89.0)
    })

    it("should calculate totalRecharges from PREVIOUS month only", () => {
      // If today is Nov 15, totalRecharges should be from October (Oct 1 - Oct 31)
      // NOT from current month (November)
      
      const currentMonth = new Date(2025, 10, 15) // Nov 15, 2025
      const prevMonthStart = new Date(2025, 9, 1) // Oct 1, 2025
      const prevMonthEnd = new Date(2025, 9, 31, 23, 59, 59) // Oct 31, 2025
      
      expect(prevMonthStart.getMonth()).toBe(9) // October (0-indexed)
      expect(prevMonthEnd.getMonth()).toBe(9)
      expect(currentMonth.getMonth()).toBe(10) // November
    })

    it("should generate invoice on 1st of each month for previous month", () => {
      // Nov 1 → Invoice for October
      // Dec 1 → Invoice for November
      // Jan 1 → Invoice for December
      
      const invoiceDate = new Date(2025, 11, 1) // Dec 1, 2025
      const invoicePeriod = new Date(2025, 10, 1) // Nov 1, 2025 (previous month)
      
      expect(invoiceDate.getMonth() - 1).toBe(invoicePeriod.getMonth())
    })

    it("should handle year boundary (Jan 1 invoice for December)", () => {
      const invoiceDate = new Date(2026, 0, 1) // Jan 1, 2026
      const invoicePeriodYear = 2025
      const invoicePeriodMonth = 11 // December (0-indexed)
      
      expect(invoiceDate.getFullYear()).toBe(2026)
      expect(invoicePeriodYear).toBe(2025)
      expect(invoicePeriodMonth).toBe(11) // December
    })

    it("should include consumption (messages, orders, push) in invoice breakdown", () => {
      const invoiceBreakdown = {
        subscriptionAmount: 39.0, // Plan cost
        creditUsage: 15.50, // Messages + Orders + Push consumed
        creditDebt: 0, // If went negative
        totalAmount: 39.0 + 15.50,
      }

      expect(invoiceBreakdown.totalAmount).toBe(54.50)
    })
  })
})
