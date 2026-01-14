/**
 * Unit Tests for Workspace Access Service
 * Feature 198: Billing Owner Refactor
 *
 * Tests for centralized workspace access control
 * 
 * CRITICAL CHANGE (Feature 198):
 * - subscriptionStatus and creditBalance are now on OWNER (User), not Workspace
 * - Mocks must include owner relation with billing fields
 */

import {
  WorkspaceAccessService,
  CREDIT_MIN_THRESHOLD,
} from "../../src/application/services/workspace-access.service"

// Mock Prisma
const mockPrisma = {
  workspace: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
}

// Helper to create workspace mock with owner (Feature 198)
const createWorkspaceMock = (overrides: {
  workspaceId?: string
  isActive?: boolean
  deletedAt?: Date | null
  debugMode?: boolean
  ownerSubscriptionStatus?: string
  ownerCreditBalance?: number
  ownerPaymentFailureCount?: number
  ownerId?: string
}) => ({
  id: overrides.workspaceId ?? "test-workspace-id",
  name: "Test Workspace",
  isActive: overrides.isActive ?? true,
  deletedAt: overrides.deletedAt ?? null,
  debugMode: overrides.debugMode ?? false,
  ownerId: overrides.ownerId ?? "test-owner-id",
  owner: {
    id: overrides.ownerId ?? "test-owner-id",
    subscriptionStatus: overrides.ownerSubscriptionStatus ?? "ACTIVE",
    creditBalance: overrides.ownerCreditBalance ?? 50,
    paymentFailureCount: overrides.ownerPaymentFailureCount ?? 0,
  },
})

describe("WorkspaceAccessService", () => {
  let service: WorkspaceAccessService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new WorkspaceAccessService(mockPrisma as any)
  })

  describe("CREDIT_MIN_THRESHOLD", () => {
    it("should be -10 (allow negative balance up to -€10)", () => {
      expect(CREDIT_MIN_THRESHOLD).toBe(-10)
    })
  })

  describe("canProcessMessages", () => {
    const workspaceId = "test-workspace-id"

    describe("workspace not found", () => {
      it("should return canProcess false with WORKSPACE_INACTIVE", async () => {
        mockPrisma.workspace.findUnique.mockResolvedValue(null)

        const result = await service.canProcessMessages(workspaceId)

        expect(result.canProcess).toBe(false)
        expect(result.blockReason).toBe("WORKSPACE_INACTIVE")
      })
    })

    describe("owner not found", () => {
      it("should return canProcess false with NO_OWNER", async () => {
        mockPrisma.workspace.findUnique.mockResolvedValue({
          id: workspaceId,
          name: "Test Workspace",
          isActive: true,
          deletedAt: null,
          debugMode: false,
          ownerId: "test-owner-id",
          owner: null, // No owner!
        })

        const result = await service.canProcessMessages(workspaceId)

        expect(result.canProcess).toBe(false)
        expect(result.blockReason).toBe("NO_OWNER")
      })
    })

    describe("workspace inactive (soft deleted)", () => {
      it("should block when isActive is false", async () => {
        mockPrisma.workspace.findUnique.mockResolvedValue(
          createWorkspaceMock({ isActive: false })
        )

        const result = await service.canProcessMessages(workspaceId)

        expect(result.canProcess).toBe(false)
        expect(result.blockReason).toBe("WORKSPACE_INACTIVE")
      })

      it("should block when deletedAt is set", async () => {
        mockPrisma.workspace.findUnique.mockResolvedValue(
          createWorkspaceMock({ deletedAt: new Date() })
        )

        const result = await service.canProcessMessages(workspaceId)

        expect(result.canProcess).toBe(false)
        expect(result.blockReason).toBe("WORKSPACE_INACTIVE")
      })
    })

    describe("owner subscription status - PAUSED (Feature 198)", () => {
      it("should block when owner subscriptionStatus is PAUSED", async () => {
        mockPrisma.workspace.findUnique.mockResolvedValue(
          createWorkspaceMock({ ownerSubscriptionStatus: "PAUSED" })
        )

        const result = await service.canProcessMessages(workspaceId)

        expect(result.canProcess).toBe(false)
        expect(result.blockReason).toBe("PAUSED")
        expect(result.message).toContain("paused")
      })
    })

    describe("owner subscription status - PAYMENT_FAILED (Feature 198)", () => {
      it("should block when owner subscriptionStatus is PAYMENT_FAILED and failures >= 3", async () => {
        mockPrisma.workspace.findUnique.mockResolvedValue(
          createWorkspaceMock({
            ownerSubscriptionStatus: "PAYMENT_FAILED",
            ownerPaymentFailureCount: 3,
          })
        )

        const result = await service.canProcessMessages(workspaceId)

        expect(result.canProcess).toBe(false)
        expect(result.blockReason).toBe("PAYMENT_FAILED")
        expect(result.message).toContain("Payment failed")
      })

      it("should allow processing when owner subscriptionStatus is PAYMENT_FAILED but failures < 3", async () => {
        mockPrisma.workspace.findUnique.mockResolvedValue(
          createWorkspaceMock({
            ownerSubscriptionStatus: "PAYMENT_FAILED",
            ownerPaymentFailureCount: 2,
          })
        )

        const result = await service.canProcessMessages(workspaceId)

        expect(result.canProcess).toBe(true)
        expect(result.blockReason).toBeUndefined()
      })
    })

    describe("owner credit exhausted (Feature 198)", () => {
      it("should block when owner credit < -€10", async () => {
        mockPrisma.workspace.findUnique.mockResolvedValue(
          createWorkspaceMock({ ownerCreditBalance: -15 })
        )

        const result = await service.canProcessMessages(workspaceId)

        expect(result.canProcess).toBe(false)
        expect(result.blockReason).toBe("CREDIT_EXHAUSTED")
      })

      it("should allow processing when owner credit is exactly -€10", async () => {
        mockPrisma.workspace.findUnique.mockResolvedValue(
          createWorkspaceMock({ ownerCreditBalance: -10 })
        )

        const result = await service.canProcessMessages(workspaceId)

        expect(result.canProcess).toBe(true)
        expect(result.blockReason).toBeUndefined()
      })

      it("should allow processing when owner credit is negative but above -€10", async () => {
        mockPrisma.workspace.findUnique.mockResolvedValue(
          createWorkspaceMock({ ownerCreditBalance: -5 })
        )

        const result = await service.canProcessMessages(workspaceId)

        expect(result.canProcess).toBe(true)
      })

      it("should block when owner credit is -€11", async () => {
        mockPrisma.workspace.findUnique.mockResolvedValue(
          createWorkspaceMock({ ownerCreditBalance: -11 })
        )

        const result = await service.canProcessMessages(workspaceId)

        expect(result.canProcess).toBe(false)
        expect(result.blockReason).toBe("CREDIT_EXHAUSTED")
      })

      it("should allow processing when owner credit is zero", async () => {
        mockPrisma.workspace.findUnique.mockResolvedValue(
          createWorkspaceMock({ ownerCreditBalance: 0 })
        )

        const result = await service.canProcessMessages(workspaceId)

        expect(result.canProcess).toBe(true)
      })
    })

    describe("channel disabled (WIP mode)", () => {
      it("should block when debugMode is true (test mode)", async () => {
        mockPrisma.workspace.findUnique.mockResolvedValue(
          createWorkspaceMock({ debugMode: true })
        )

        const result = await service.canProcessMessages(workspaceId)

        expect(result.canProcess).toBe(false)
        expect(result.blockReason).toBe("CHANNEL_DISABLED")
      })
    })

    describe("successful access", () => {
      it("should allow processing when all conditions are met", async () => {
        mockPrisma.workspace.findUnique.mockResolvedValue(
          createWorkspaceMock({
            isActive: true,
            debugMode: false,
            ownerSubscriptionStatus: "ACTIVE",
            ownerCreditBalance: 50,
          })
        )

        const result = await service.canProcessMessages(workspaceId)

        expect(result.canProcess).toBe(true)
        expect(result.blockReason).toBeUndefined()
      })
    })

    describe("priority order of blocking conditions", () => {
      it("should check workspace active before owner subscription", async () => {
        mockPrisma.workspace.findUnique.mockResolvedValue({
          ...createWorkspaceMock({ ownerSubscriptionStatus: "PAUSED" }),
          isActive: false,
        })

        const result = await service.canProcessMessages(workspaceId)

        // Should return WORKSPACE_INACTIVE, not PAUSED
        expect(result.blockReason).toBe("WORKSPACE_INACTIVE")
      })

      it("should check owner subscription before credit", async () => {
        mockPrisma.workspace.findUnique.mockResolvedValue(
          createWorkspaceMock({
            ownerSubscriptionStatus: "PAUSED",
            ownerCreditBalance: -15,
          })
        )

        const result = await service.canProcessMessages(workspaceId)

        // Should return PAUSED, not CREDIT_EXHAUSTED
        expect(result.blockReason).toBe("PAUSED")
      })
    })
  })

  describe("isBlockedDueToBilling (Feature 198)", () => {
    const workspaceId = "test-workspace-id"

    it("should return false when workspace not found", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null)

      const result = await service.isBlockedDueToBilling(workspaceId)

      expect(result).toBe(false)
    })

    it("should return true when owner is PAUSED", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ ownerSubscriptionStatus: "PAUSED" })
      )

      const result = await service.isBlockedDueToBilling(workspaceId)

      expect(result).toBe(true)
    })

    it("should return true when owner PAYMENT_FAILED and failures >= 3", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({
          ownerSubscriptionStatus: "PAYMENT_FAILED",
          ownerPaymentFailureCount: 3,
        })
      )

      const result = await service.isBlockedDueToBilling(workspaceId)

      expect(result).toBe(true)
    })

    it("should return false when owner PAYMENT_FAILED but failures < 3", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({
          ownerSubscriptionStatus: "PAYMENT_FAILED",
          ownerPaymentFailureCount: 2,
        })
      )

      const result = await service.isBlockedDueToBilling(workspaceId)

      expect(result).toBe(false)
    })

    it("should return true when owner CREDIT_EXHAUSTED", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ ownerCreditBalance: -15 })
      )

      const result = await service.isBlockedDueToBilling(workspaceId)

      expect(result).toBe(true)
    })

    it("should return false when CHANNEL_DISABLED (not billing issue)", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ debugMode: true })
      )

      const result = await service.isBlockedDueToBilling(workspaceId)

      // Channel disabled is NOT a billing issue
      expect(result).toBe(false)
    })

    it("should return false when all is OK", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({
          ownerSubscriptionStatus: "ACTIVE",
          ownerCreditBalance: 50,
        })
      )

      const result = await service.isBlockedDueToBilling(workspaceId)

      expect(result).toBe(false)
    })
  })

  describe("getAccessStatus (Feature 198)", () => {
    const workspaceId = "test-workspace-id"

    it("should return active status for healthy workspace with owner", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({
          ownerSubscriptionStatus: "ACTIVE",
          ownerCreditBalance: 50,
        })
      )

      const result = await service.getAccessStatus(workspaceId)

      expect(result.status).toBe("active")
      expect(result.canProcessMessages).toBe(true)
      expect(result.creditBalance).toBe(50)
      expect(result.subscriptionStatus).toBe("ACTIVE")
    })

    it("should return paused status when owner is paused", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ ownerSubscriptionStatus: "PAUSED" })
      )

      const result = await service.getAccessStatus(workspaceId)

      expect(result.status).toBe("paused")
      expect(result.canProcessMessages).toBe(false)
      expect(result.blockReason).toBe("PAUSED")
    })

    it("should return payment_failed status when owner payment failed and failures >= 3", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({
          ownerSubscriptionStatus: "PAYMENT_FAILED",
          ownerPaymentFailureCount: 3,
        })
      )

      const result = await service.getAccessStatus(workspaceId)

      expect(result.status).toBe("payment_failed")
      expect(result.canProcessMessages).toBe(false)
      expect(result.blockReason).toBe("PAYMENT_FAILED")
    })

    it("should return credit_exhausted status when owner credit below threshold", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ ownerCreditBalance: -15 })
      )

      const result = await service.getAccessStatus(workspaceId)

      expect(result.status).toBe("credit_exhausted")
      expect(result.canProcessMessages).toBe(false)
      expect(result.blockReason).toBe("CREDIT_EXHAUSTED")
    })

    it("should return wip status for channel disabled", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ debugMode: true })
      )

      const result = await service.getAccessStatus(workspaceId)

      expect(result.status).toBe("wip")
      expect(result.canProcessMessages).toBe(false)
      expect(result.blockReason).toBe("CHANNEL_DISABLED")
    })

    it("should throw error when workspace not found", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null)

      await expect(service.getAccessStatus(workspaceId)).rejects.toThrow(
        "Workspace not found"
      )
    })

    it("should return no_owner status when owner not found", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        name: "Test Workspace",
        isActive: true,
        deletedAt: null,
        debugMode: false,
        ownerId: "test-owner-id",
        owner: null,
      })

      const result = await service.getAccessStatus(workspaceId)
      
      expect(result.status).toBe("no_owner")
      expect(result.canProcessMessages).toBe(false)
    })
  })

  describe("canOwnerProcessMessages (Feature 198)", () => {
    const userId = "test-owner-id"

    it("should return canProcess true when owner is ACTIVE with credit", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        subscriptionStatus: "ACTIVE",
        creditBalance: 50,
      })

      const result = await service.canOwnerProcessMessages(userId)

      expect(result.canProcess).toBe(true)
      expect(result.blockReason).toBeUndefined()
    })

    it("should return canProcess false when owner is PAUSED", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        subscriptionStatus: "PAUSED",
        creditBalance: 50,
      })

      const result = await service.canOwnerProcessMessages(userId)

      expect(result.canProcess).toBe(false)
      expect(result.blockReason).toBe("PAUSED")
    })

    it("should return canProcess false when owner credit exhausted", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        subscriptionStatus: "ACTIVE",
        creditBalance: -15,
      })

      const result = await service.canOwnerProcessMessages(userId)

      expect(result.canProcess).toBe(false)
      expect(result.blockReason).toBe("CREDIT_EXHAUSTED")
    })

    it("should return canProcess false when owner not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const result = await service.canOwnerProcessMessages(userId)

      expect(result.canProcess).toBe(false)
      expect(result.blockReason).toBe("OWNER_NOT_FOUND")
    })
  })

  describe("getOwnerAccessStatus (Feature 198)", () => {
    const userId = "test-owner-id"

    it("should return active status for healthy owner", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        subscriptionStatus: "ACTIVE",
        creditBalance: 50,
      })

      const result = await service.getOwnerAccessStatus(userId)

      expect(result.status).toBe("active")
      expect(result.canProcessMessages).toBe(true)
      expect(result.creditBalance).toBe(50)
      expect(result.subscriptionStatus).toBe("ACTIVE")
    })

    it("should throw error when owner not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      await expect(service.getOwnerAccessStatus(userId)).rejects.toThrow(
        "Owner not found"
      )
    })
  })
})
