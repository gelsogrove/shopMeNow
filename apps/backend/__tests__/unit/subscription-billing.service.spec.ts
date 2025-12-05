/**
 * Unit Tests for Subscription Billing Service
 * Feature 185: Subscription & Billing System
 *
 * Tests aligned with actual service implementation
 */

import { SubscriptionBillingService } from "../../src/application/services/subscription-billing.service"

// Create mock at module level
const mockRepository = {
  getWorkspaceBilling: jest.fn(),
  getWorkspaceUsage: jest.fn(),
  getPlanConfiguration: jest.fn(),
  getAllPlanConfigurations: jest.fn(),
  getCreditBalance: jest.fn(),
  deductCredit: jest.fn(),
  addCredit: jest.fn(),
  upgradePlan: jest.fn(),
  getTransactionHistory: jest.fn(),
  shouldSendLowBalanceNotification: jest.fn(),
  updateLowBalanceNotification: jest.fn(),
}

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
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn((callback: any) => callback(mockPrisma)),
}

// Mock Prisma TransactionType enum
jest.mock("@echatbot/database", () => ({

  ...jest.requireActual("@echatbot/database"),
  TransactionType: {
    MESSAGE: "MESSAGE",
    PUSH_NOTIFICATION: "PUSH_NOTIFICATION",
    RECHARGE: "RECHARGE",
    UPGRADE_FEE: "UPGRADE_FEE",
    MONTHLY_FEE: "MONTHLY_FEE",
  },
}))

// Mock the repository module
jest.mock("../../src/repositories/subscription-billing.repository", () => ({
  SubscriptionBillingRepository: jest.fn().mockImplementation(() => mockRepository),
}))

describe("SubscriptionBillingService", () => {
  let service: SubscriptionBillingService

  const mockWorkspaceId = "test-workspace-id"

  const mockBillingData = {
    planType: "FREE_TRIAL",
    creditBalance: 29.0,
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    planStartedAt: new Date(),
    nextBillingDate: null,
    isTrialExpired: false,
    daysUntilTrialExpires: 14,
  }

  const mockPlanLimits = {
    maxChannels: 1,
    maxProducts: 50,
    maxCustomers: 50,
    messageCost: 0.1,
    orderCost: 1.0,
    pushCost: 1.0,
    lowBalanceThreshold: 5.0,
  }

  const mockUsage = {
    productsCount: 10,
    customersCount: 5,
    channelsCount: 1,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    service = new SubscriptionBillingService(mockPrisma as any)
    // Inject mock repository
    ;(service as any).repository = mockRepository
  })

  describe("getCreditBalance", () => {
    it("should return credit balance for workspace", async () => {
      mockRepository.getCreditBalance.mockResolvedValue(25.5)

      const result = await service.getCreditBalance(mockWorkspaceId)

      expect(result).toBe(25.5)
      expect(mockRepository.getCreditBalance).toHaveBeenCalledWith(mockWorkspaceId)
    })
  })

  describe("checkCredit", () => {
    it("should return hasSufficientCredit true when credit is enough", async () => {
      mockRepository.getCreditBalance.mockResolvedValue(10.0)

      const result = await service.checkCredit(mockWorkspaceId, 5.0)

      expect(result.hasSufficientCredit).toBe(true)
      expect(result.currentBalance).toBe(10.0)
      expect(result.requiredAmount).toBe(5.0)
    })

    it("should return hasSufficientCredit false when credit is insufficient", async () => {
      mockRepository.getCreditBalance.mockResolvedValue(2.0)

      const result = await service.checkCredit(mockWorkspaceId, 5.0)

      expect(result.hasSufficientCredit).toBe(false)
      expect(result.deficit).toBe(3.0)
    })

    it("should return hasSufficientCredit false when credit is zero", async () => {
      mockRepository.getCreditBalance.mockResolvedValue(0)

      const result = await service.checkCredit(mockWorkspaceId, 0.1)

      expect(result.hasSufficientCredit).toBe(false)
    })

    it("should handle exact amount check (balance equals required)", async () => {
      mockRepository.getCreditBalance.mockResolvedValue(5.0)

      const result = await service.checkCredit(mockWorkspaceId, 5.0)

      expect(result.hasSufficientCredit).toBe(true)
      expect(result.deficit).toBeUndefined()
    })
  })

  describe("isTrialValid", () => {
    it("should return isValid false when workspace not found", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue(null)

      const result = await service.isTrialValid(mockWorkspaceId)

      expect(result.isValid).toBe(false)
      expect(result.isTrialPlan).toBe(false)
    })
    it("should return isValid true when trial is active", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "FREE_TRIAL",
        isTrialExpired: false,
        daysUntilTrialExpires: 7,
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })

      const result = await service.isTrialValid(mockWorkspaceId)

      expect(result.isValid).toBe(true)
      expect(result.isTrialPlan).toBe(true)
      expect(result.daysRemaining).toBe(7)
    })

    it("should return isValid false when trial has expired", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "FREE_TRIAL",
        isTrialExpired: true,
        daysUntilTrialExpires: null,
        trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })

      const result = await service.isTrialValid(mockWorkspaceId)

      expect(result.isValid).toBe(false)
      expect(result.isTrialPlan).toBe(true)
    })

    it("should return isValid true for paid plans", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "BASIC",
        trialEndsAt: null,
      })

      const result = await service.isTrialValid(mockWorkspaceId)

      expect(result.isValid).toBe(true)
      expect(result.isTrialPlan).toBe(false)
    })
  })

  describe("rechargeCredit", () => {
    it("should reject recharge with zero amount", async () => {
      await expect(service.rechargeCredit(mockWorkspaceId, 0)).rejects.toThrow(
        "Amount must be positive"
      )
    })

    it("should reject recharge with negative amount", async () => {
      await expect(service.rechargeCredit(mockWorkspaceId, -10)).rejects.toThrow(
        "Amount must be positive"
      )
    })

    it("should reject recharge above maximum €1000", async () => {
      await expect(service.rechargeCredit(mockWorkspaceId, 1500)).rejects.toThrow(
        "Maximum recharge amount is €1000"
      )
    })

    it("should add credit and return success with new balance", async () => {
      const newBalance = 55.0

      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "BASIC", // Already on paid plan, no auto-upgrade
      })

      mockRepository.addCredit.mockResolvedValue({
        success: true,
        newBalance: newBalance,
      })

      const result = await service.rechargeCredit(mockWorkspaceId, 50)

      expect(result.success).toBe(true)
      expect(result.newBalance).toBe(newBalance)
      expect(result.upgradedToPlan).toBeUndefined()
      expect(mockRepository.addCredit).toHaveBeenCalledWith(
        mockWorkspaceId,
        50,
        "RECHARGE",
        "Credit recharge: €50.00"
      )
    })

    it("should auto-upgrade from FREE_TRIAL to BASIC on recharge", async () => {
      const newBalance = 79.0 // 29 (initial) + 50 (recharge)

      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "FREE_TRIAL",
      })

      mockRepository.upgradePlan.mockResolvedValue({
        success: true,
        nextBillingDate: new Date(),
      })

      mockRepository.addCredit.mockResolvedValue({
        success: true,
        newBalance: newBalance,
      })

      const result = await service.rechargeCredit(mockWorkspaceId, 50)

      expect(result.success).toBe(true)
      expect(result.newBalance).toBe(newBalance)
      expect(result.upgradedToPlan).toBe("BASIC")
      expect(mockRepository.upgradePlan).toHaveBeenCalledWith(mockWorkspaceId, "BASIC")
    })

    it("should NOT auto-upgrade when already on PREMIUM", async () => {
      const newBalance = 150.0

      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "PREMIUM",
      })

      mockRepository.addCredit.mockResolvedValue({
        success: true,
        newBalance: newBalance,
      })

      const result = await service.rechargeCredit(mockWorkspaceId, 100)

      expect(result.success).toBe(true)
      expect(result.upgradedToPlan).toBeUndefined()
      expect(mockRepository.upgradePlan).not.toHaveBeenCalled()
    })

    it("should NOT auto-upgrade when already on BASIC", async () => {
      const newBalance = 79.0

      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "BASIC",
      })

      mockRepository.addCredit.mockResolvedValue({
        success: true,
        newBalance: newBalance,
      })

      const result = await service.rechargeCredit(mockWorkspaceId, 50)

      expect(result.success).toBe(true)
      expect(result.upgradedToPlan).toBeUndefined()
      expect(mockRepository.upgradePlan).not.toHaveBeenCalled()
    })

    it("should handle upgradePlan failure during auto-upgrade gracefully", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "FREE_TRIAL",
      })

      mockRepository.upgradePlan.mockRejectedValue(new Error("Upgrade failed"))

      await expect(service.rechargeCredit(mockWorkspaceId, 50)).rejects.toThrow("Upgrade failed")
    })

    it("should handle addCredit failure", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "BASIC",
      })

      mockRepository.addCredit.mockRejectedValue(new Error("Database error"))

      await expect(service.rechargeCredit(mockWorkspaceId, 50)).rejects.toThrow("Database error")
    })

    it("should throw error when workspace not found", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue(null)

      await expect(service.rechargeCredit(mockWorkspaceId, 50)).rejects.toThrow()
    })
  })

  describe("upgradePlan", () => {
    it("should reject upgrade to FREE_TRIAL", async () => {
      await expect(service.upgradePlan(mockWorkspaceId, "FREE_TRIAL" as any)).rejects.toThrow(
        "Cannot upgrade to Free Trial"
      )
    })

    it("should reject downgrade from PREMIUM to BASIC", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "PREMIUM",
      })

      await expect(service.upgradePlan(mockWorkspaceId, "BASIC")).rejects.toThrow(
        "Cannot downgrade or stay on same plan"
      )
    })

    it("should upgrade from FREE_TRIAL to BASIC", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "FREE_TRIAL",
      })
      
      mockPrisma.planConfiguration.findUnique.mockResolvedValue({
        displayName: "Basic",
        monthlyFee: 29,
      })
      
      mockRepository.upgradePlan.mockResolvedValue({
        nextBillingDate: new Date(),
      })
      
      mockPrisma.billingTransaction.create.mockResolvedValue({ id: "tx-upgrade" })

      const result = await service.upgradePlan(mockWorkspaceId, "BASIC")

      expect(result.success).toBe(true)
      expect(result.newPlan.displayName).toBe("Basic")
      expect(result.nextBillingDate).toBeDefined()
    })
  })

  describe("changePlan", () => {
    it("should reject change to FREE_TRIAL", async () => {
      await expect(service.changePlan(mockWorkspaceId, "FREE_TRIAL" as any)).rejects.toThrow(
        "Cannot change to Free Trial"
      )
    })

    it("should reject change to same plan", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "PREMIUM",
      })

      await expect(service.changePlan(mockWorkspaceId, "PREMIUM")).rejects.toThrow(
        "Already on PREMIUM plan"
      )
    })

    it("should allow downgrade from ENTERPRISE to PREMIUM when within limits", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "ENTERPRISE",
        creditBalance: 100,
      })
      
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        productsCount: 50,
        customersCount: 50,
        channelsCount: 1,
      })
      
      mockPrisma.planConfiguration.findUnique.mockResolvedValue({
        displayName: "Premium",
        monthlyFee: 59,
        maxChannels: 2,
        maxProducts: 100,
        maxCustomers: 100,
      })
      
      mockRepository.upgradePlan.mockResolvedValue({
        nextBillingDate: new Date(),
      })
      
      mockPrisma.billingTransaction.create.mockResolvedValue({ id: "tx-downgrade" })

      const result = await service.changePlan(mockWorkspaceId, "PREMIUM")

      expect(result.success).toBe(true)
      expect(result.isDowngrade).toBe(true)
      expect(result.newPlan.displayName).toBe("Premium")
    })

    it("should reject downgrade from ENTERPRISE to BASIC when over limits", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "ENTERPRISE",
      })
      
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        productsCount: 80,  // Over BASIC limit of 50
        customersCount: 30,
        channelsCount: 1,
      })
      
      mockPrisma.planConfiguration.findUnique.mockResolvedValue({
        displayName: "Basic",
        monthlyFee: 29,
        maxChannels: 1,
        maxProducts: 50,
        maxCustomers: 50,
      })

      await expect(service.changePlan(mockWorkspaceId, "BASIC")).rejects.toThrow(
        "Cannot downgrade to BASIC: Too many products: 80/50"
      )
    })

    it("should upgrade from BASIC to PREMIUM", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "BASIC",
        creditBalance: 100,
      })
      
      mockPrisma.planConfiguration.findUnique.mockResolvedValue({
        displayName: "Premium",
        monthlyFee: 59,
      })
      
      mockRepository.upgradePlan.mockResolvedValue({
        nextBillingDate: new Date(),
      })
      
      mockPrisma.billingTransaction.create.mockResolvedValue({ id: "tx-upgrade" })

      const result = await service.changePlan(mockWorkspaceId, "PREMIUM")

      expect(result.success).toBe(true)
      expect(result.isDowngrade).toBe(false)
      expect(result.newPlan.displayName).toBe("Premium")
    })

    it("should reject downgrade from PREMIUM to BASIC when too many customers", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "PREMIUM",
      })
      
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        productsCount: 30,
        customersCount: 80,  // Over BASIC limit of 50
        channelsCount: 1,
      })
      
      mockPrisma.planConfiguration.findUnique.mockResolvedValue({
        displayName: "Basic",
        monthlyFee: 29,
        maxChannels: 1,
        maxProducts: 50,
        maxCustomers: 50,
      })

      await expect(service.changePlan(mockWorkspaceId, "BASIC")).rejects.toThrow(
        "Cannot downgrade to BASIC: Too many customers: 80/50"
      )
    })

    it("should reject downgrade from PREMIUM to BASIC when too many channels", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "PREMIUM",
      })
      
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        productsCount: 30,
        customersCount: 30,
        channelsCount: 2,  // Over BASIC limit of 1
      })
      
      mockPrisma.planConfiguration.findUnique.mockResolvedValue({
        displayName: "Basic",
        monthlyFee: 29,
        maxChannels: 1,
        maxProducts: 50,
        maxCustomers: 50,
      })

      await expect(service.changePlan(mockWorkspaceId, "BASIC")).rejects.toThrow(
        "Cannot downgrade to BASIC: Too many channels: 2/1"
      )
    })

    it("should reject downgrade with multiple limit violations", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "ENTERPRISE",
      })
      
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        productsCount: 200,  // Over BASIC limit of 50
        customersCount: 150, // Over BASIC limit of 50
        channelsCount: 5,    // Over BASIC limit of 1
      })
      
      mockPrisma.planConfiguration.findUnique.mockResolvedValue({
        displayName: "Basic",
        monthlyFee: 29,
        maxChannels: 1,
        maxProducts: 50,
        maxCustomers: 50,
      })

      await expect(service.changePlan(mockWorkspaceId, "BASIC")).rejects.toThrow(
        /Cannot downgrade to BASIC:.*Too many products.*Too many customers.*Too many channels/
      )
    })

    it("should allow downgrade from PREMIUM to BASIC when exactly at limits", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "PREMIUM",
        creditBalance: 100,
      })
      
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        productsCount: 50,  // Exactly at BASIC limit
        customersCount: 50, // Exactly at BASIC limit
        channelsCount: 1,   // Exactly at BASIC limit
      })
      
      mockPrisma.planConfiguration.findUnique.mockResolvedValue({
        displayName: "Basic",
        monthlyFee: 29,
        maxChannels: 1,
        maxProducts: 50,
        maxCustomers: 50,
      })
      
      mockRepository.upgradePlan.mockResolvedValue({
        nextBillingDate: new Date(),
      })
      
      mockPrisma.billingTransaction.create.mockResolvedValue({ id: "tx-downgrade" })

      const result = await service.changePlan(mockWorkspaceId, "BASIC")

      expect(result.success).toBe(true)
      expect(result.isDowngrade).toBe(true)
      expect(result.newPlan.displayName).toBe("Basic")
      expect(result.newPlan.monthlyFee).toBe(29)
    })

    it("should allow downgrade from ENTERPRISE to BASIC when usage is minimal", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "ENTERPRISE",
        creditBalance: 500,
      })
      
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        productsCount: 10,
        customersCount: 5,
        channelsCount: 1,
      })
      
      mockPrisma.planConfiguration.findUnique.mockResolvedValue({
        displayName: "Basic",
        monthlyFee: 29,
        maxChannels: 1,
        maxProducts: 50,
        maxCustomers: 50,
      })
      
      mockRepository.upgradePlan.mockResolvedValue({
        nextBillingDate: new Date(),
      })
      
      mockPrisma.billingTransaction.create.mockResolvedValue({ id: "tx-downgrade" })

      const result = await service.changePlan(mockWorkspaceId, "BASIC")

      expect(result.success).toBe(true)
      expect(result.isDowngrade).toBe(true)
      expect(result.newPlan.displayName).toBe("Basic")
    })

    it("should log downgrade transaction with correct description", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "PREMIUM",
        creditBalance: 100,
      })
      
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        productsCount: 20,
        customersCount: 20,
        channelsCount: 1,
      })
      
      mockPrisma.planConfiguration.findUnique.mockResolvedValue({
        displayName: "Basic",
        monthlyFee: 29,
        maxChannels: 1,
        maxProducts: 50,
        maxCustomers: 50,
      })
      
      mockRepository.upgradePlan.mockResolvedValue({
        nextBillingDate: new Date("2025-12-26"),
      })
      
      mockPrisma.billingTransaction.create.mockResolvedValue({ id: "tx-downgrade" })

      await service.changePlan(mockWorkspaceId, "BASIC")

      expect(mockPrisma.billingTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: mockWorkspaceId,
          type: "UPGRADE_FEE",
          amount: 0,
          description: expect.stringContaining("Downgrade to Basic"),
        }),
      })
    })
  })

  describe("checkPlanLimits", () => {
    // =========================================================================
    // PRODUCTS LIMIT TESTS
    // =========================================================================
    it("should return withinLimits true when under product limit", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue(mockBillingData)
      mockRepository.getPlanConfiguration.mockResolvedValue(mockPlanLimits)
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        ...mockUsage,
        productsCount: 10,
      })

      const result = await service.checkPlanLimits(mockWorkspaceId, "products")

      expect(result.withinLimits).toBe(true)
      expect(result.current).toBe(10)
      expect(result.max).toBe(50)
      expect(result.limitType).toBe("products")
    })

    it("should return withinLimits false when at product limit (50/50)", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue(mockBillingData)
      mockRepository.getPlanConfiguration.mockResolvedValue(mockPlanLimits)
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        ...mockUsage,
        productsCount: 50,
      })

      const result = await service.checkPlanLimits(mockWorkspaceId, "products")

      expect(result.withinLimits).toBe(false)
      expect(result.current).toBe(50)
      expect(result.max).toBe(50)
    })

    it("should return withinLimits true at 49/50 products (edge case)", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue(mockBillingData)
      mockRepository.getPlanConfiguration.mockResolvedValue(mockPlanLimits)
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        ...mockUsage,
        productsCount: 49,
      })

      const result = await service.checkPlanLimits(mockWorkspaceId, "products")

      expect(result.withinLimits).toBe(true)
      expect(result.current).toBe(49)
    })

    // =========================================================================
    // CUSTOMERS LIMIT TESTS
    // =========================================================================
    it("should return withinLimits false when at customer limit (50/50)", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue(mockBillingData)
      mockRepository.getPlanConfiguration.mockResolvedValue(mockPlanLimits)
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        ...mockUsage,
        customersCount: 50,
      })

      const result = await service.checkPlanLimits(mockWorkspaceId, "customers")

      expect(result.withinLimits).toBe(false)
      expect(result.limitType).toBe("customers")
    })

    it("should return withinLimits true when under customer limit", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue(mockBillingData)
      mockRepository.getPlanConfiguration.mockResolvedValue(mockPlanLimits)
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        ...mockUsage,
        customersCount: 25,
      })

      const result = await service.checkPlanLimits(mockWorkspaceId, "customers")

      expect(result.withinLimits).toBe(true)
      expect(result.current).toBe(25)
      expect(result.max).toBe(50)
    })

    it("should return withinLimits true at 49/50 customers (edge case)", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue(mockBillingData)
      mockRepository.getPlanConfiguration.mockResolvedValue(mockPlanLimits)
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        ...mockUsage,
        customersCount: 49,
      })

      const result = await service.checkPlanLimits(mockWorkspaceId, "customers")

      expect(result.withinLimits).toBe(true)
      expect(result.current).toBe(49)
    })

    // =========================================================================
    // CHANNELS LIMIT TESTS
    // =========================================================================
    it("should return withinLimits false when at channel limit (1/1)", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue(mockBillingData)
      mockRepository.getPlanConfiguration.mockResolvedValue(mockPlanLimits) // maxChannels: 1
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        ...mockUsage,
        channelsCount: 1,
      })

      const result = await service.checkPlanLimits(mockWorkspaceId, "channels")

      expect(result.withinLimits).toBe(false)
      expect(result.current).toBe(1)
      expect(result.max).toBe(1)
      expect(result.limitType).toBe("channels")
    })

    it("should return withinLimits true when under channel limit (0/1)", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue(mockBillingData)
      mockRepository.getPlanConfiguration.mockResolvedValue(mockPlanLimits)
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        ...mockUsage,
        channelsCount: 0,
      })

      const result = await service.checkPlanLimits(mockWorkspaceId, "channels")

      expect(result.withinLimits).toBe(true)
      expect(result.current).toBe(0)
      expect(result.max).toBe(1)
    })

    it("should return withinLimits true for PREMIUM plan with 2 channels (1/2)", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "PREMIUM",
      })
      mockRepository.getPlanConfiguration.mockResolvedValue({
        ...mockPlanLimits,
        maxChannels: 2,
      })
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        ...mockUsage,
        channelsCount: 1,
      })

      const result = await service.checkPlanLimits(mockWorkspaceId, "channels")

      expect(result.withinLimits).toBe(true)
      expect(result.current).toBe(1)
      expect(result.max).toBe(2)
    })

    it("should return withinLimits false for PREMIUM plan at channel limit (2/2)", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "PREMIUM",
      })
      mockRepository.getPlanConfiguration.mockResolvedValue({
        ...mockPlanLimits,
        maxChannels: 2,
      })
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        ...mockUsage,
        channelsCount: 2,
      })

      const result = await service.checkPlanLimits(mockWorkspaceId, "channels")

      expect(result.withinLimits).toBe(false)
      expect(result.current).toBe(2)
      expect(result.max).toBe(2)
    })

    // =========================================================================
    // ERROR HANDLING TESTS
    // =========================================================================
    it("should throw error when workspace not found", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue(null)

      await expect(service.checkPlanLimits(mockWorkspaceId, "products")).rejects.toThrow(
        "Workspace not found"
      )
    })

    it("should throw error when plan configuration not found", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue(mockBillingData)
      mockRepository.getPlanConfiguration.mockResolvedValue(null)

      await expect(service.checkPlanLimits(mockWorkspaceId, "products")).rejects.toThrow(
        "Plan configuration not found"
      )
    })
  })

  describe("getAvailablePlans", () => {
    it("should return all plan configurations", async () => {
      const plans = [
        { planType: "FREE_TRIAL", displayName: "Free Trial", monthlyFee: 0, maxChannels: 1, maxProducts: 50, maxCustomers: 50, messageCost: 0.1, orderCost: 1, pushCost: 1, features: '["Feature 1"]' },
        { planType: "BASIC", displayName: "Basic", monthlyFee: 29, maxChannels: 1, maxProducts: 50, maxCustomers: 50, messageCost: 0.1, orderCost: 1, pushCost: 1, features: '["Feature 1"]' },
        { planType: "PREMIUM", displayName: "Premium", monthlyFee: 49, maxChannels: 2, maxProducts: 100, maxCustomers: 100, messageCost: 0.1, orderCost: 1, pushCost: 1, features: '["Feature 1"]' },
        { planType: "ENTERPRISE", displayName: "Enterprise", monthlyFee: 149, maxChannels: 999, maxProducts: 9999, maxCustomers: 9999, messageCost: 0.08, orderCost: 0.8, pushCost: 0.8, features: '["Feature 1"]' },
      ]
      mockRepository.getAllPlanConfigurations.mockResolvedValue(plans)

      const result = await service.getAvailablePlans()

      expect(result).toHaveLength(4)
      expect(result[0].planType).toBe("FREE_TRIAL")
      expect(result[1].monthlyFee).toBe(29)
    })
  })

  describe("deductMessageCredit", () => {
    it("should deduct message cost from balance", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue(mockBillingData)
      mockRepository.getPlanConfiguration.mockResolvedValue(mockPlanLimits)
      mockRepository.deductCredit.mockResolvedValue({
        success: true,
        newBalance: 9.9,
      })
      mockRepository.shouldSendLowBalanceNotification.mockResolvedValue(false)

      const result = await service.deductMessageCredit(mockWorkspaceId, "msg-123")

      expect(result.success).toBe(true)
      expect(result.newBalance).toBe(9.9)
      expect(mockRepository.deductCredit).toHaveBeenCalledWith(
        mockWorkspaceId,
        0.1, // messageCost
        "MESSAGE",
        "WhatsApp Message",
        "msg-123",
        "message"
      )
    })

    it("should return error when workspace not found", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue(null)

      const result = await service.deductMessageCredit(mockWorkspaceId, "msg-123")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Workspace not found")
    })
  })

  describe("getOperationCost", () => {
    it("should return message cost", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue(mockBillingData)
      mockRepository.getPlanConfiguration.mockResolvedValue(mockPlanLimits)

      const cost = await service.getOperationCost(mockWorkspaceId, "message")

      expect(cost).toBe(0.1)
    })

    it("should return push cost", async () => {
      mockRepository.getWorkspaceBilling.mockResolvedValue(mockBillingData)
      mockRepository.getPlanConfiguration.mockResolvedValue(mockPlanLimits)

      const cost = await service.getOperationCost(mockWorkspaceId, "push")

      expect(cost).toBe(1.0)
    })
  })

  describe("getWorkspaceUsage - Aggregated across all owner channels", () => {
    it("should aggregate products count across all owner workspaces", async () => {
      // Mock usage returned from repository (already aggregated)
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        productsCount: 148, // Sum: 48 + 50 + 50 from 3 channels
        customersCount: 84, // Sum: 4 + 30 + 50 from 3 channels
        channelsCount: 3,
      })

      mockRepository.getWorkspaceBilling.mockResolvedValue(mockBillingData)
      mockRepository.getPlanConfiguration.mockResolvedValue(mockPlanLimits)

      const result = await service.getBillingOverview(mockWorkspaceId)

      expect(result.usage.productsCount).toBe(148)
      expect(result.usage.customersCount).toBe(84)
      expect(result.usage.channelsCount).toBe(3)
    })

    it("should calculate correct percentages for aggregated usage", async () => {
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        productsCount: 50, // 50% of 100
        customersCount: 75, // 75% of 100
        channelsCount: 2, // 100% of 2
      })

      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "PREMIUM",
      })
      mockRepository.getPlanConfiguration.mockResolvedValue({
        ...mockPlanLimits,
        maxProducts: 100,
        maxCustomers: 100,
        maxChannels: 2,
      })

      const result = await service.getBillingOverview(mockWorkspaceId)

      expect(result.usage.productsPercentage).toBe(50)
      expect(result.usage.customersPercentage).toBe(75)
      expect(result.usage.channelsPercentage).toBe(100)
    })

    it("should show limit reached when aggregated usage exceeds plan limits", async () => {
      mockRepository.getWorkspaceUsage.mockResolvedValue({
        productsCount: 100, // At limit
        customersCount: 100, // At limit
        channelsCount: 2, // At limit
      })

      mockRepository.getWorkspaceBilling.mockResolvedValue({
        ...mockBillingData,
        planType: "PREMIUM",
      })
      mockRepository.getPlanConfiguration.mockResolvedValue({
        ...mockPlanLimits,
        maxProducts: 100,
        maxCustomers: 100,
        maxChannels: 2,
      })

      const result = await service.getBillingOverview(mockWorkspaceId)

      expect(result.usage.productsPercentage).toBe(100)
      expect(result.usage.customersPercentage).toBe(100)
      expect(result.usage.channelsPercentage).toBe(100)
    })
  })
})
