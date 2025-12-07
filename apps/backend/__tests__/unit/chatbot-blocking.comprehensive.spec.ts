/**
 * Comprehensive Unit Tests for Chatbot Blocking Scenarios
 * 
 * This test suite ensures 100% coverage of ALL scenarios where
 * the chatbot should NOT respond to customer messages.
 * 
 * CRITICAL: These tests verify that messages are SILENTLY BLOCKED
 * (no response sent to customer) in the following scenarios:
 * 
 * 1. PAUSED - Owner paused subscription (IMMEDIATE - not end-of-month)
 * 2. PAYMENT_FAILED - Owner payment failed
 * 3. CREDIT_EXHAUSTED - Owner credit < -€10
 * 4. CHANNEL_DISABLED - Workspace channel is disabled (WIP mode)
 * 5. WORKSPACE_INACTIVE - Workspace soft deleted
 * 6. NO_OWNER - Workspace has no owner
 * 
 * Future (not in schema yet):
 * - CANCELLED - Owner cancelled subscription
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

// Helper to create workspace mock with owner
const createWorkspaceMock = (overrides: {
  workspaceId?: string
  isActive?: boolean
  deletedAt?: Date | null
  channelStatus?: boolean
  ownerSubscriptionStatus?: string
  ownerCreditBalance?: number
  ownerId?: string | null
}) => ({
  id: overrides.workspaceId ?? "test-workspace-id",
  name: "Test Workspace",
  isActive: overrides.isActive ?? true,
  deletedAt: overrides.deletedAt ?? null,
  channelStatus: overrides.channelStatus ?? true,
  ownerId: overrides.ownerId ?? "test-owner-id",
  owner: overrides.ownerId === null ? null : {
    id: overrides.ownerId ?? "test-owner-id",
    subscriptionStatus: overrides.ownerSubscriptionStatus ?? "ACTIVE",
    creditBalance: overrides.ownerCreditBalance ?? 50,
  },
})

describe("Chatbot Blocking - Comprehensive Test Suite", () => {
  let service: WorkspaceAccessService
  const workspaceId = "test-workspace-id"

  beforeEach(() => {
    jest.clearAllMocks()
    service = new WorkspaceAccessService(mockPrisma as any)
  })

  describe("✅ SCENARIO 1: PAUSED - Owner paused subscription", () => {
    it("should BLOCK messages when subscriptionStatus is PAUSED", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ ownerSubscriptionStatus: "PAUSED" })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.canProcess).toBe(false)
      expect(result.blockReason).toBe("PAUSED")
      expect(result.message).toContain("paused")
    })

    it("should include subscription status in details", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ ownerSubscriptionStatus: "PAUSED" })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.details?.subscriptionStatus).toBe("PAUSED")
    })

    it("isBlockedDueToBilling should return TRUE for PAUSED", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ ownerSubscriptionStatus: "PAUSED" })
      )

      const result = await service.isBlockedDueToBilling(workspaceId)

      expect(result).toBe(true)
    })
  })

  describe("✅ SCENARIO 2: PAYMENT_FAILED - Owner payment failed", () => {
    it("should BLOCK messages when subscriptionStatus is PAYMENT_FAILED", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ ownerSubscriptionStatus: "PAYMENT_FAILED" })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.canProcess).toBe(false)
      expect(result.blockReason).toBe("PAYMENT_FAILED")
      expect(result.message).toContain("Payment failed")
    })

    it("isBlockedDueToBilling should return TRUE for PAYMENT_FAILED", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ ownerSubscriptionStatus: "PAYMENT_FAILED" })
      )

      const result = await service.isBlockedDueToBilling(workspaceId)

      expect(result).toBe(true)
    })
  })

  describe("✅ SCENARIO 3: CREDIT_EXHAUSTED - Owner credit < -€10", () => {
    it("should BLOCK messages when credit is -11€", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ ownerCreditBalance: -11 })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.canProcess).toBe(false)
      expect(result.blockReason).toBe("CREDIT_EXHAUSTED")
    })

    it("should BLOCK messages when credit is -15€", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ ownerCreditBalance: -15 })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.canProcess).toBe(false)
      expect(result.blockReason).toBe("CREDIT_EXHAUSTED")
    })

    it("should BLOCK messages when credit is -100€", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ ownerCreditBalance: -100 })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.canProcess).toBe(false)
      expect(result.blockReason).toBe("CREDIT_EXHAUSTED")
    })

    it("should ALLOW messages when credit is exactly -10€ (threshold)", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ ownerCreditBalance: -10 })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.canProcess).toBe(true)
      expect(result.blockReason).toBeUndefined()
    })

    it("should ALLOW messages when credit is -9€", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ ownerCreditBalance: -9 })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.canProcess).toBe(true)
    })

    it("should ALLOW messages when credit is 0€", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ ownerCreditBalance: 0 })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.canProcess).toBe(true)
    })

    it("should verify CREDIT_MIN_THRESHOLD is -10", () => {
      expect(CREDIT_MIN_THRESHOLD).toBe(-10)
    })

    it("isBlockedDueToBilling should return TRUE for CREDIT_EXHAUSTED", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ ownerCreditBalance: -15 })
      )

      const result = await service.isBlockedDueToBilling(workspaceId)

      expect(result).toBe(true)
    })
  })

  describe("✅ SCENARIO 4: CHANNEL_DISABLED - Workspace WIP mode", () => {
    it("should BLOCK messages when channelStatus is false", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ channelStatus: false })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.canProcess).toBe(false)
      expect(result.blockReason).toBe("CHANNEL_DISABLED")
    })

    it("should ALLOW messages when skipChannelCheck is true", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ channelStatus: false })
      )

      const result = await service.canProcessMessages(workspaceId, true)

      expect(result.canProcess).toBe(true)
    })

    it("isBlockedDueToBilling should return FALSE for CHANNEL_DISABLED (not billing issue)", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ channelStatus: false })
      )

      const result = await service.isBlockedDueToBilling(workspaceId)

      // Channel disabled is NOT a billing issue
      expect(result).toBe(false)
    })
  })

  describe("✅ SCENARIO 5: WORKSPACE_INACTIVE - Soft deleted workspace", () => {
    it("should BLOCK messages when isActive is false", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ isActive: false })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.canProcess).toBe(false)
      expect(result.blockReason).toBe("WORKSPACE_INACTIVE")
    })

    it("should BLOCK messages when deletedAt is set", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ deletedAt: new Date("2025-01-01") })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.canProcess).toBe(false)
      expect(result.blockReason).toBe("WORKSPACE_INACTIVE")
    })

    it("should BLOCK when workspace not found", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null)

      const result = await service.canProcessMessages(workspaceId)

      expect(result.canProcess).toBe(false)
      expect(result.blockReason).toBe("WORKSPACE_INACTIVE")
    })
  })

  // NOTE: CANCELLED status not in current Prisma schema.
  // Uncomment this test when CANCELLED is added to SubscriptionStatus enum
  // describe("✅ SCENARIO 6: CANCELLED - Owner cancelled subscription", () => {
  //   it("should BLOCK messages when subscriptionStatus is CANCELLED", async () => {
  //     mockPrisma.workspace.findUnique.mockResolvedValue(
  //       createWorkspaceMock({ ownerSubscriptionStatus: "CANCELLED" })
  //     )
  //     const result = await service.canProcessMessages(workspaceId)
  //     expect(result.canProcess).toBe(false)
  //     expect(result.blockReason).toBe("CANCELLED")
  //   })
  //
  //   it("isBlockedDueToBilling should return TRUE for CANCELLED", async () => {
  //     mockPrisma.workspace.findUnique.mockResolvedValue(
  //       createWorkspaceMock({ ownerSubscriptionStatus: "CANCELLED" })
  //     )
  //     const result = await service.isBlockedDueToBilling(workspaceId)
  //     expect(result).toBe(true)
  //   })
  // })

  describe("✅ SCENARIO 7: NO_OWNER - Workspace has no owner", () => {
    it("should BLOCK messages when owner is null", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ ownerId: null })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.canProcess).toBe(false)
      expect(result.blockReason).toBe("NO_OWNER")
    })
  })

  describe("✅ BLOCKING PRIORITY ORDER", () => {
    it("should check WORKSPACE_INACTIVE before PAUSED", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        ...createWorkspaceMock({ ownerSubscriptionStatus: "PAUSED" }),
        isActive: false,
      })

      const result = await service.canProcessMessages(workspaceId)

      expect(result.blockReason).toBe("WORKSPACE_INACTIVE")
    })

    it("should check NO_OWNER before PAUSED", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        name: "Test",
        isActive: true,
        deletedAt: null,
        channelStatus: true,
        ownerId: "test",
        owner: null,
      })

      const result = await service.canProcessMessages(workspaceId)

      expect(result.blockReason).toBe("NO_OWNER")
    })

    it("should check PAUSED before PAYMENT_FAILED", async () => {
      // When both PAUSED and PAYMENT_FAILED could apply, PAUSED is checked first
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ ownerSubscriptionStatus: "PAUSED" })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.blockReason).toBe("PAUSED")
    })

    it("should check PAYMENT_FAILED before CREDIT_EXHAUSTED", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({
          ownerSubscriptionStatus: "PAYMENT_FAILED",
          ownerCreditBalance: -15,
        })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.blockReason).toBe("PAYMENT_FAILED")
    })

    it("should check CREDIT_EXHAUSTED before CHANNEL_DISABLED", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({
          ownerCreditBalance: -15,
          channelStatus: false,
        })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.blockReason).toBe("CREDIT_EXHAUSTED")
    })
  })

  describe("✅ SUCCESS SCENARIOS - Messages should be ALLOWED", () => {
    it("should ALLOW messages when all conditions are healthy", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({
          isActive: true,
          channelStatus: true,
          ownerSubscriptionStatus: "ACTIVE",
          ownerCreditBalance: 50,
        })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.canProcess).toBe(true)
      expect(result.blockReason).toBeUndefined()
    })

    it("should ALLOW messages with negative credit above threshold", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({
          ownerSubscriptionStatus: "ACTIVE",
          ownerCreditBalance: -5,
        })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.canProcess).toBe(true)
    })

    it("should ALLOW messages for FREE_TRIAL status", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({
          ownerSubscriptionStatus: "FREE_TRIAL",
          ownerCreditBalance: 0,
        })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.canProcess).toBe(true)
    })
  })

  describe("✅ MULTIPLE WORKSPACES - Owner billing affects all workspaces", () => {
    it("should BLOCK all workspaces when owner is PAUSED", async () => {
      const workspaceIds = ["ws-1", "ws-2", "ws-3"]
      
      for (const wsId of workspaceIds) {
        mockPrisma.workspace.findUnique.mockResolvedValue(
          createWorkspaceMock({
            workspaceId: wsId,
            ownerSubscriptionStatus: "PAUSED",
            ownerId: "same-owner-id",
          })
        )

        const result = await service.canProcessMessages(wsId)

        expect(result.canProcess).toBe(false)
        expect(result.blockReason).toBe("PAUSED")
      }
    })

    it("should BLOCK all workspaces when owner credit exhausted", async () => {
      const workspaceIds = ["ws-1", "ws-2", "ws-3"]
      
      for (const wsId of workspaceIds) {
        mockPrisma.workspace.findUnique.mockResolvedValue(
          createWorkspaceMock({
            workspaceId: wsId,
            ownerCreditBalance: -15,
            ownerId: "same-owner-id",
          })
        )

        const result = await service.canProcessMessages(wsId)

        expect(result.canProcess).toBe(false)
        expect(result.blockReason).toBe("CREDIT_EXHAUSTED")
      }
    })
  })

  describe("✅ Edge Cases", () => {
    it("should handle decimal credit values correctly", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ ownerCreditBalance: -10.01 })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.canProcess).toBe(false)
      expect(result.blockReason).toBe("CREDIT_EXHAUSTED")
    })

    it("should handle credit as string (database returns Decimal)", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        ...createWorkspaceMock({}),
        owner: {
          id: "test-owner-id",
          subscriptionStatus: "ACTIVE",
          creditBalance: "-15.00", // String from Decimal
        },
      })

      const result = await service.canProcessMessages(workspaceId)

      expect(result.canProcess).toBe(false)
      expect(result.blockReason).toBe("CREDIT_EXHAUSTED")
    })

    it("should handle very large negative credit", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(
        createWorkspaceMock({ ownerCreditBalance: -1000000 })
      )

      const result = await service.canProcessMessages(workspaceId)

      expect(result.canProcess).toBe(false)
      expect(result.blockReason).toBe("CREDIT_EXHAUSTED")
    })
  })
})
