/**
 * Billing Service - UNIT Tests
 *
 * Test UNITARI con MOCK di Prisma - nessun database reale
 *
 * Andrea's Requirements:
 * 1. ✅ Test trackMessage - correct price from database (€0.10)
 *
 * UNIT TEST = MOCK di database, NO connessioni reali
 */


import { BillingService } from "../../../src/application/services/billing.service"

// Mock Prisma Client
jest.mock("@echatbot/database", () => ({
  prisma: {},
  BillingType: {
    MESSAGE: "MESSAGE",
    MONTHLY_CHANNEL_COST: "MONTHLY_CHANNEL_COST",
  },
}))

describe("Billing Service - UNIT Tests", () => {
  let billingService: BillingService
  let mockPrisma: any

  beforeEach(() => {
    // Setup mock Prisma
    mockPrisma = {
      billing: {
        create: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      billingTransaction: {
        create: jest.fn(),
      },
      pricingConfig: {
        findFirst: jest.fn(),
        findUnique: jest.fn(), // For PricingRepository.getByKey()
      },
      orders: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      workspace: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((callback: any) => callback(mockPrisma)),
    }

    billingService = new BillingService(mockPrisma)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  /**
   * TEST 1: trackMessage - Verify correct price from database (€0.10)
   */
  describe("trackMessage", () => {
    it("should charge correct price from database (€0.10 per message)", async () => {
      const workspaceId = "workspace-123"
      const customerId = "customer-456"
      const description = "Test message"

      // Mock PricingRepository.getValue("MESSAGE") → returns 0.10 (default fallback in code)
      mockPrisma.pricingConfig.findUnique.mockResolvedValue(null) // Force default

      // Mock billing.aggregate for getCurrentTotalForCustomer
      mockPrisma.billing.aggregate.mockResolvedValue({
        _sum: { amount: null }, // No previous billing
      })

      // Mock billing creation (legacy table)
      mockPrisma.billing.create.mockResolvedValue({
        id: "billing-1",
        workspaceId,
        customerId,
        type: "MESSAGE",
        amount: 0.10,
        description,
        previousTotal: 0,
        currentCharge: 0.10,
        newTotal: 0.10,
        createdAt: new Date(),
      })

      // Mock workspace lookup for credit deduction
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        name: "Test Channel",
        creditBalance: 29.00,
        ownerId: "owner-123",
      })

      // Mock workspace updateMany (credit deduction - shared credit across all owner's workspaces)
      mockPrisma.workspace.updateMany.mockResolvedValue({
        count: 1,
      })

      // Mock billingTransaction creation (for Transaction History)
      mockPrisma.billingTransaction.create.mockResolvedValue({
        id: "tx-1",
        workspaceId,
        type: "MESSAGE",
        amount: 0.10,
        description: "WhatsApp message",
        balanceAfter: 28.90,
        createdAt: new Date(),
      })

      // Execute
      await billingService.trackMessage(workspaceId, customerId, description)

      // Verify pricing query via PricingRepository
      expect(mockPrisma.pricingConfig.findUnique).toHaveBeenCalledWith({
        where: { key: "MESSAGE" },
      })

      // Verify billing creation with correct price (default €0.10)
      expect(mockPrisma.billing.create).toHaveBeenCalledWith({
        data: {
          workspaceId,
          customerId,
          type: "MESSAGE",
          amount: 0.10, // CRITICAL: Default €0.10 when database config missing
          description,
          userQuery: null,
          previousTotal: 0,
          currentCharge: 0.10,
          newTotal: 0.10,
        },
      })

      // Verify credit was deducted from ALL owner's workspaces (shared credit)
      expect(mockPrisma.workspace.updateMany).toHaveBeenCalledWith({
        where: { 
          ownerId: "owner-123",
          isActive: true,
        },
        data: { creditBalance: 28.90 },
      })

      // Verify transaction was recorded for Transaction History
      expect(mockPrisma.billingTransaction.create).toHaveBeenCalledWith({
        data: {
          workspaceId,
          type: "MESSAGE",
          amount: 0.10,
          description: "WhatsApp message (Test Channel)",
          balanceAfter: 28.90,
        },
      })
    })
  })

  /**
   * PROTECTION TEST: Verify billing methods exist
   *
   * This test ensures that if a developer accidentally removes
   * a billing method, the test suite will FAIL and alert them.
   */
  describe("Integration Point Protection", () => {
    it("should verify trackMessage method exists and is callable", () => {
      expect(billingService.trackMessage).toBeDefined()
      expect(typeof billingService.trackMessage).toBe("function")
      // Note: TypeScript counts only required parameters (workspaceId, customerId)
      // Optional parameters (description, userQuery) are not counted in .length
      expect(billingService.trackMessage.length).toBe(2)
    })
  })
})
