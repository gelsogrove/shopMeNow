/**
 * Billing Service - UNIT Tests
 * Feature 198: Billing Owner Refactor
 *
 * Test UNITARI con MOCK di Prisma - nessun database reale
 *
 * Tests:
 * 1. trackMessage - deducts from owner, records transaction with userId
 * 2. chargeMonthlyChannelCost - charges monthly fee
 */

import { BillingService } from "../../../src/application/services/billing.service"

// Mock Prisma Client
const mockPrisma = {
  billing: {
    create: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    findFirst: jest.fn(),
  },
  billingTransaction: {
    create: jest.fn(),
  },
  pricingConfig: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  orders: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: {
    update: jest.fn(),
    findUnique: jest.fn(), // ✅ Add findUnique mock for transaction
  },
  // 🔒 Mock $transaction for atomic operations
  $transaction: jest.fn(async (callback: (tx: typeof mockPrisma) => Promise<any>) => {
    // Execute the callback with the mock prisma as transaction client
    return callback(mockPrisma)
  }),
}

// Mock PricingRepository
jest.mock("../../../src/repositories/pricing.repository", () => ({
  PricingRepository: jest.fn().mockImplementation(() => ({
    getValue: jest.fn().mockResolvedValue(0.10),
  })),
}))

describe("Billing Service - Feature 198 Owner-Based Billing", () => {
  let billingService: BillingService

  const mockWorkspaceId = "test-workspace-id"
  const mockCustomerId = "test-customer-id"
  const mockOwnerId = "test-owner-id"

  beforeEach(() => {
    jest.clearAllMocks()
    billingService = new BillingService(mockPrisma as any)
  })

  describe("trackMessage - Feature 198", () => {
    beforeEach(() => {
      // Mock workspace with owner
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: mockWorkspaceId,
        name: "Test Workspace",
        creditBalance: 50,
        ownerId: mockOwnerId,
      })

      // ✅ Mock user.findUnique for FRESH balance inside transaction
      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockOwnerId,
        creditBalance: 50,
      })

      // Mock aggregate for previous total
      mockPrisma.billing.aggregate.mockResolvedValue({
        _sum: { amount: 10 },
      })
    })

    it("should deduct message cost from owner credit balance", async () => {
      await billingService.trackMessage(mockWorkspaceId, mockCustomerId, "Test message")

      // Should update USER (owner) credit balance, not workspace
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockOwnerId },
        data: { creditBalance: expect.any(Number) },
      })
    })

    it("should create billing transaction with userId (Feature 198)", async () => {
      await billingService.trackMessage(mockWorkspaceId, mockCustomerId, "Test message")

      // billingTransaction must include userId (required in Feature 198)
      expect(mockPrisma.billingTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockOwnerId,
          workspaceId: mockWorkspaceId,
          type: "MESSAGE",
        }),
      })
    })

    it("should record in legacy billing table for analytics", async () => {
      await billingService.trackMessage(mockWorkspaceId, mockCustomerId, "Test message")

      // Legacy billing table for analytics
      expect(mockPrisma.billing.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: mockWorkspaceId,
          customerId: mockCustomerId,
          type: "MESSAGE",
        }),
      })
    })

    it("should use MESSAGE cost from pricing config (€0.10)", async () => {
      await billingService.trackMessage(mockWorkspaceId, mockCustomerId, "Test message")

      // Credit balance should be reduced by message cost
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockOwnerId },
        data: { creditBalance: 49.9 }, // 50 - 0.10
      })
    })
  })

  describe("trackMessage - method signature", () => {
    it("should verify trackMessage method exists and is callable", () => {
      expect(billingService.trackMessage).toBeDefined()
      expect(typeof billingService.trackMessage).toBe("function")
    })
  })
})
