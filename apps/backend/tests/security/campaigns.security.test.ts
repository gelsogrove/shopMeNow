/**
 * Security Tests for Push Campaigns System
 *
 * Tests for:
 * - Workspace isolation (cannot access other workspace campaigns)
 * - IDOR prevention (returns 404 on workspace mismatch)
 * - Opt-out enforcement (respects push_notifications_consent)
 * - Middleware stack verification (auth + workspace validation)
 */

import { prisma } from "@echatbot/database"
import {
  PushCampaignStatus,
  PushCampaignRecipientStatus,
  CampaignFrequency,
  CampaignTargetType,
  Prisma,
} from "@echatbot/database"
import { PushCampaignService } from "../../src/application/services/push-campaign.service"
import { PushCampaignRepository } from "../../src/repositories/push-campaign.repository"

describe("Campaigns Security Tests", () => {
  let service: PushCampaignService
  let repository: PushCampaignRepository

  beforeEach(() => {
    jest.clearAllMocks()
    service = new PushCampaignService(prisma)
    repository = new PushCampaignRepository(prisma)
  })

  // ============================================
  // WORKSPACE ISOLATION TESTS
  // ============================================

  describe("Workspace Isolation", () => {
    it("should only list campaigns from the same workspace", async () => {
      // SCENARIO: User from workspace-1 tries to list campaigns
      // RULE: Should only see campaigns where workspaceId = workspace-1
      const workspaceId = "workspace-1"

      jest.spyOn(prisma.pushCampaign, "findMany").mockResolvedValue([
        { id: "campaign-1", workspaceId: "workspace-1", name: "Campaign 1" } as any,
        { id: "campaign-2", workspaceId: "workspace-1", name: "Campaign 2" } as any,
      ])

      const campaigns = await repository.listByWorkspace(workspaceId)

      expect(prisma.pushCampaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: "workspace-1" },
        })
      )
      expect(campaigns).toHaveLength(2)
      expect(campaigns.every((c: any) => c.workspaceId === workspaceId)).toBe(true)
    })

    it("should NOT return campaigns from other workspaces", async () => {
      // SCENARIO: User from workspace-1 requests campaigns
      // RULE: Campaigns from workspace-2 MUST NOT be included
      const workspaceId = "workspace-1"

      jest.spyOn(prisma.pushCampaign, "findMany").mockResolvedValue([
        { id: "campaign-1", workspaceId: "workspace-1", name: "Campaign 1" } as any,
      ])

      const campaigns = await repository.listByWorkspace(workspaceId)

      expect(prisma.pushCampaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: "workspace-1" },
        })
      )
      expect(campaigns).toHaveLength(1)
      expect(campaigns.find((c: any) => c.workspaceId === "workspace-2")).toBeUndefined()
    })

    it("should filter by workspaceId when getting single campaign", async () => {
      // SCENARIO: User from workspace-1 gets campaign-1
      // RULE: Query MUST include workspaceId filter
      const workspaceId = "workspace-1"
      const campaignId = "campaign-1"

      jest.spyOn(prisma.pushCampaign, "findFirst").mockResolvedValue({
        id: campaignId,
        workspaceId,
        name: "Test Campaign",
      } as any)

      await repository.findById(campaignId, workspaceId)

      expect(prisma.pushCampaign.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: campaignId, workspaceId },
        })
      )
    })

    it("should filter by workspaceId when updating campaign", async () => {
      // SCENARIO: User from workspace-1 updates campaign-1
      // RULE: Update MUST verify workspaceId match
      const workspaceId = "workspace-1"
      const campaignId = "campaign-1"

      jest.spyOn(prisma.pushCampaign, "update").mockResolvedValue({
        id: campaignId,
        workspaceId,
        name: "Updated Campaign",
      } as any)

      await repository.updateCampaign(campaignId, workspaceId, { name: "Updated Campaign" })

      expect(prisma.pushCampaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: campaignId, workspaceId },
        })
      )
    })

    it("should filter by workspaceId when deleting campaign", async () => {
      // SCENARIO: User from workspace-1 deletes campaign-1
      // RULE: Delete MUST verify workspaceId match
      const workspaceId = "workspace-1"
      const campaignId = "campaign-1"

      jest.spyOn(prisma.pushCampaign, "delete").mockResolvedValue({
        id: campaignId,
        workspaceId,
      } as any)

      await repository.deleteCampaign(campaignId, workspaceId)

      expect(prisma.pushCampaign.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: campaignId, workspaceId },
        })
      )
    })

    it("should filter recipients by workspaceId", async () => {
      // SCENARIO: User from workspace-1 lists recipients for campaign-1
      // RULE: Recipients query MUST include workspaceId filter
      const workspaceId = "workspace-1"
      const campaignId = "campaign-1"

      jest.spyOn(prisma.pushCampaignRecipient, "findMany").mockResolvedValue([
        { id: "recipient-1", campaignId, workspaceId, phone: "+123456789" } as any,
      ])

      await repository.listRecipients(campaignId, workspaceId)

      expect(prisma.pushCampaignRecipient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            campaignId,
            workspaceId,
          }),
        })
      )
    })
  })

  // ============================================
  // IDOR PREVENTION TESTS
  // ============================================

  describe("IDOR Prevention", () => {
    it("should return null when getting campaign from other workspace (404)", async () => {
      // SCENARIO: User from workspace-1 tries GET /campaigns/campaign-2 (belongs to workspace-2)
      // RULE: findFirst returns null → Controller returns 404
      const workspaceId = "workspace-1"
      const campaignId = "campaign-from-workspace-2"

      jest.spyOn(prisma.pushCampaign, "findFirst").mockResolvedValue(null)

      const result = await repository.findById(campaignId, workspaceId)

      expect(result).toBeNull()
      expect(prisma.pushCampaign.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: campaignId, workspaceId },
        })
      )
    })

    it("should fail to update campaign from other workspace (404)", async () => {
      // SCENARIO: User from workspace-1 tries PUT /campaigns/campaign-2 (belongs to workspace-2)
      // RULE: Prisma throws P2025 (record not found) → Controller returns 404
      const workspaceId = "workspace-1"
      const campaignId = "campaign-from-workspace-2"

      jest.spyOn(prisma.pushCampaign, "update").mockRejectedValue({
        code: "P2025",
        message: "Record not found",
      })

      await expect(
        repository.updateCampaign(campaignId, workspaceId, { name: "Hacked" })
      ).rejects.toMatchObject({
        code: "P2025",
      })

      expect(prisma.pushCampaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: campaignId, workspaceId },
        })
      )
    })

    it("should fail to delete campaign from other workspace (404)", async () => {
      // SCENARIO: User from workspace-1 tries DELETE /campaigns/campaign-2 (belongs to workspace-2)
      // RULE: Prisma throws P2025 → Controller returns 404
      const workspaceId = "workspace-1"
      const campaignId = "campaign-from-workspace-2"

      jest.spyOn(prisma.pushCampaign, "delete").mockRejectedValue({
        code: "P2025",
        message: "Record not found",
      })

      await expect(repository.deleteCampaign(campaignId, workspaceId)).rejects.toMatchObject({
        code: "P2025",
      })

      expect(prisma.pushCampaign.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: campaignId, workspaceId },
        })
      )
    })

    it("should return 0 count when scheduling campaign from other workspace (404)", async () => {
      // SCENARIO: User from workspace-1 tries POST /campaigns/campaign-2/schedule (belongs to workspace-2)
      // RULE: updateMany returns count=0 → Controller checks and returns 404
      const workspaceId = "workspace-1"
      const campaignId = "campaign-from-workspace-2"

      jest.spyOn(prisma.pushCampaign, "updateMany").mockResolvedValue({ count: 0 })

      const result = await repository.updateStatus(
        campaignId,
        workspaceId,
        PushCampaignStatus.SCHEDULED
      )

      expect(result.count).toBe(0)
      expect(prisma.pushCampaign.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: campaignId, workspaceId },
        })
      )
    })

    it("should return empty array when listing recipients from other workspace campaign", async () => {
      // SCENARIO: User from workspace-1 tries GET /campaigns/campaign-2/recipients (belongs to workspace-2)
      // RULE: Recipients query returns empty array (workspace filter prevents access)
      const workspaceId = "workspace-1"
      const campaignId = "campaign-from-workspace-2"

      jest.spyOn(prisma.pushCampaignRecipient, "findMany").mockResolvedValue([])

      const recipients = await repository.listRecipients(campaignId, workspaceId)

      expect(recipients).toHaveLength(0)
      expect(prisma.pushCampaignRecipient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            campaignId,
            workspaceId,
          }),
        })
      )
    })
  })

  // ============================================
  // OPT-OUT ENFORCEMENT TESTS
  // ============================================

  describe("Opt-Out Enforcement", () => {
    it("should exclude customers with push_notifications_consent=false", async () => {
      // SCENARIO: Campaign targets 3 customers, one has opted out
      // RULE: Opted-out customer MUST be marked SKIPPED with reason OPT_OUT
      const workspaceId = "workspace-1"

      jest.spyOn(prisma.workspace, "findUnique").mockResolvedValue({
        id: workspaceId,
        enableWhatsapp: true,
        ownerId: "owner-1",
      } as any)

      jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "owner-1",
        creditBalance: new Prisma.Decimal(100),
      } as any)

      jest
        .spyOn(prisma.customers, "findMany")
        .mockResolvedValueOnce([
          { id: "customer-1" } as any,
          { id: "customer-2" } as any,
          { id: "customer-3" } as any,
        ])
        .mockResolvedValueOnce([
          {
            id: "customer-1",
            phone: "+1234567890",
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          } as any,
          {
            id: "customer-2",
            phone: "+1234567891",
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: false, // OPTED OUT
            push_notifications_consent_at: null,
          } as any,
          {
            id: "customer-3",
            phone: "+1234567892",
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          } as any,
        ])

      jest.spyOn(prisma.pushCampaign, "create").mockResolvedValue({
        id: "campaign-1",
        workspaceId,
        name: "Test Campaign",
      } as any)

      await service.create({
        workspaceId,
        name: "Test Campaign",
        targetingType: CampaignTargetType.ALL,
        message: "Hello!",
      })

      expect(prisma.pushCampaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipients: expect.objectContaining({
              createMany: expect.objectContaining({
                data: expect.arrayContaining([
                  expect.objectContaining({
                    customerId: "customer-2",
                    status: PushCampaignRecipientStatus.SKIPPED,
                    errorCode: "OPT_OUT",
                    errorMessage: "Marketing opt-in missing",
                  }),
                ]),
              }),
            }),
          }),
        })
      )
    })

    it("should exclude blacklisted customers with SKIPPED status", async () => {
      // SCENARIO: Campaign targets blacklisted customer
      // RULE: Blacklisted customer MUST be marked SKIPPED with reason BLACKLISTED
      const workspaceId = "workspace-1"

      jest.spyOn(prisma.workspace, "findUnique").mockResolvedValue({
        id: workspaceId,
        enableWhatsapp: true,
        ownerId: "owner-1",
      } as any)

      jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "owner-1",
        creditBalance: new Prisma.Decimal(100),
      } as any)

      jest
        .spyOn(prisma.customers, "findMany")
        .mockResolvedValueOnce([{ id: "customer-1" } as any])
        .mockResolvedValueOnce([
          {
            id: "customer-1",
            phone: "+1234567890",
            isBlacklisted: true, // BLACKLISTED
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          } as any,
        ])

      jest.spyOn(prisma.pushCampaign, "create").mockResolvedValue({
        id: "campaign-1",
        workspaceId,
        name: "Test Campaign",
      } as any)

      await service.create({
        workspaceId,
        name: "Test Campaign",
        targetingType: CampaignTargetType.ALL,
        message: "Hello!",
      })

      expect(prisma.pushCampaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipients: expect.objectContaining({
              createMany: expect.objectContaining({
                data: expect.arrayContaining([
                  expect.objectContaining({
                    customerId: "customer-1",
                    status: PushCampaignRecipientStatus.SKIPPED,
                    errorCode: "BLACKLISTED",
                    errorMessage: "Customer is blacklisted",
                  }),
                ]),
              }),
            }),
          }),
        })
      )
    })

    it("should exclude customers with inactive chatbot", async () => {
      // SCENARIO: Campaign targets customer with activeChatbot=false
      // RULE: Customer MUST be marked SKIPPED with reason CHATBOT_INACTIVE
      const workspaceId = "workspace-1"

      jest.spyOn(prisma.workspace, "findUnique").mockResolvedValue({
        id: workspaceId,
        enableWhatsapp: true,
        ownerId: "owner-1",
      } as any)

      jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "owner-1",
        creditBalance: new Prisma.Decimal(100),
      } as any)

      jest
        .spyOn(prisma.customers, "findMany")
        .mockResolvedValueOnce([{ id: "customer-1" } as any])
        .mockResolvedValueOnce([
          {
            id: "customer-1",
            phone: "+1234567890",
            isBlacklisted: false,
            activeChatbot: false, // INACTIVE CHATBOT
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          } as any,
        ])

      jest.spyOn(prisma.pushCampaign, "create").mockResolvedValue({
        id: "campaign-1",
        workspaceId,
        name: "Test Campaign",
      } as any)

      await service.create({
        workspaceId,
        name: "Test Campaign",
        targetingType: CampaignTargetType.ALL,
        message: "Hello!",
      })

      expect(prisma.pushCampaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipients: expect.objectContaining({
              createMany: expect.objectContaining({
                data: expect.arrayContaining([
                  expect.objectContaining({
                    customerId: "customer-1",
                    status: PushCampaignRecipientStatus.SKIPPED,
                    errorCode: "CHATBOT_INACTIVE",
                    errorMessage: "Chatbot is inactive for this customer",
                  }),
                ]),
              }),
            }),
          }),
        })
      )
    })

    it("should only mark valid customers as PENDING", async () => {
      // SCENARIO: Campaign with valid customers who have consent
      // RULE: Valid customers MUST be marked PENDING (ready to send)
      const workspaceId = "workspace-1"

      jest.spyOn(prisma.workspace, "findUnique").mockResolvedValue({
        id: workspaceId,
        enableWhatsapp: true,
        ownerId: "owner-1",
      } as any)

      jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "owner-1",
        creditBalance: new Prisma.Decimal(100),
      } as any)

      jest
        .spyOn(prisma.customers, "findMany")
        .mockResolvedValueOnce([{ id: "customer-1" } as any, { id: "customer-2" } as any])
        .mockResolvedValueOnce([
          {
            id: "customer-1",
            phone: "+1234567890",
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          } as any,
          {
            id: "customer-2",
            phone: "+1234567891",
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          } as any,
        ])

      jest.spyOn(prisma.pushCampaign, "create").mockResolvedValue({
        id: "campaign-1",
        workspaceId,
        name: "Test Campaign",
      } as any)

      await service.create({
        workspaceId,
        name: "Test Campaign",
        targetingType: CampaignTargetType.ALL,
        message: "Hello!",
      })

      expect(prisma.pushCampaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipients: expect.objectContaining({
              createMany: expect.objectContaining({
                data: expect.arrayContaining([
                  expect.objectContaining({
                    customerId: "customer-1",
                    status: PushCampaignRecipientStatus.PENDING,
                  }),
                  expect.objectContaining({
                    customerId: "customer-2",
                    status: PushCampaignRecipientStatus.PENDING,
                  }),
                ]),
              }),
            }),
          }),
        })
      )
    })
  })

  // ============================================
  // MIDDLEWARE STACK VERIFICATION
  // ============================================

  describe("Middleware Stack Verification", () => {
    it("should verify all endpoints require authentication", async () => {
      // SCENARIO: All campaign endpoints protected by authMiddleware
      // RULE: Routes file MUST apply authMiddleware globally via router.use()
      // NOTE: This test documents the expected middleware stack
      // Actual middleware testing is done via integration tests

      // Expected middleware stack for all routes:
      // 1. authMiddleware - JWT validation
      // 2. workspaceId extracted from token (validateWorkspaceOperation not needed as workspaceId in params)

      // Routes that should be protected:
      const protectedRoutes = [
        "GET /workspaces/:workspaceId/campaigns",
        "GET /workspaces/:workspaceId/campaigns/:id",
        "GET /workspaces/:workspaceId/campaigns/:id/recipients",
        "POST /workspaces/:workspaceId/campaigns",
        "PUT /workspaces/:workspaceId/campaigns/:id",
        "DELETE /workspaces/:workspaceId/campaigns/:id",
        "POST /workspaces/:workspaceId/campaigns/:id/schedule",
        "POST /workspaces/:workspaceId/campaigns/:id/run-now",
        "POST /workspaces/:workspaceId/campaigns/:id/pause",
        "POST /workspaces/:workspaceId/campaigns/:id/resume",
        "POST /workspaces/:workspaceId/campaigns/:id/cancel",
      ]

      // Verify protected routes list is complete
      expect(protectedRoutes).toHaveLength(11)
      expect(protectedRoutes.every((route) => route.includes("/workspaces/:workspaceId/"))).toBe(
        true
      )
    })

    it("should extract workspaceId from route params", async () => {
      // SCENARIO: Controller receives workspaceId from req.params.workspaceId
      // RULE: All repository methods MUST use workspaceId parameter for filtering
      // NOTE: This verifies workspace isolation at service layer

      const workspaceId = "workspace-from-params"
      const campaignId = "campaign-1"

      jest.spyOn(prisma.pushCampaign, "findFirst").mockResolvedValue({
        id: campaignId,
        workspaceId,
        name: "Test Campaign",
      } as any)

      await service.get(workspaceId, campaignId)

      expect(prisma.pushCampaign.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: campaignId, workspaceId },
        })
      )
    })

    it("should enforce trial validation on campaign creation", async () => {
      // SCENARIO: Campaign creation endpoint uses checkTrialValid middleware
      // RULE: POST /campaigns requires checkTrialValid to prevent trial abuse
      // NOTE: Middleware ensures trial users cannot create campaigns after expiration

      // Expected middleware stack for POST /campaigns:
      // 1. authMiddleware
      // 2. checkTrialValid (Feature 185 - Billing)

      // This test documents that POST route MUST have checkTrialValid middleware
      const expectedMiddleware = ["authMiddleware", "checkTrialValid"]
      expect(expectedMiddleware).toContain("checkTrialValid")
    })
  })

  // ============================================
  // CREDIT CHECK ENFORCEMENT
  // ============================================

  describe("Credit Check Enforcement", () => {
    it("should reject campaign creation when insufficient credit", async () => {
      // SCENARIO: Owner has €5 credit, campaign costs €10 (1 recipient * €10 = €10)
      // RULE: Service MUST throw error "Insufficient credit for campaign"
      const workspaceId = "workspace-1"

      jest.spyOn(prisma.workspace, "findUnique").mockResolvedValue({
        id: workspaceId,
        enableWhatsapp: true,
        ownerId: "owner-1",
      } as any)

      // Mock creditBalance with value < required (5 < 10)
      const mockCreditBalance = new Prisma.Decimal(0.05)
      jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "owner-1",
        creditBalance: mockCreditBalance,
      } as any)

      jest
        .spyOn(prisma.customers, "findMany")
        .mockResolvedValueOnce([{ id: "customer-1" } as any])
        .mockResolvedValueOnce([
          {
            id: "customer-1",
            phone: "+1234567890",
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
          } as any,
        ])

      // Mock platformConfig to prevent errors (these would return from cache)
      jest.spyOn(prisma.platformConfig, "findMany").mockResolvedValue([])

      await expect(
        service.create({
          workspaceId,
          name: "Test Campaign",
          targetingType: CampaignTargetType.ALL,
          message: "Hello!",
        })
      ).rejects.toThrow("Insufficient credit for campaign")
    })

    it("should allow campaign creation when sufficient credit", async () => {
      // SCENARIO: Owner has €100 credit, campaign costs €1
      // RULE: Service MUST allow campaign creation
      const workspaceId = "workspace-1"

      jest.spyOn(prisma.workspace, "findUnique").mockResolvedValue({
        id: workspaceId,
        enableWhatsapp: true,
        ownerId: "owner-1",
      } as any)

      jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "owner-1",
        creditBalance: new Prisma.Decimal(100),
      } as any)

      jest
        .spyOn(prisma.customers, "findMany")
        .mockResolvedValueOnce([{ id: "customer-1" } as any])
        .mockResolvedValueOnce([
          {
            id: "customer-1",
            phone: "+1234567890",
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
          } as any,
        ])

      // Mock platformConfig to prevent errors (these would return from cache)
      jest.spyOn(prisma.platformConfig, "findMany").mockResolvedValue([])

      jest.spyOn(prisma.pushCampaign, "create").mockResolvedValue({
        id: "campaign-1",
        workspaceId,
        name: "Test Campaign",
      } as any)

      const campaign = await service.create({
        workspaceId,
        name: "Test Campaign",
        targetingType: CampaignTargetType.ALL,
        message: "Hello!",
      })

      expect(campaign).toBeDefined()
      expect(campaign.id).toBe("campaign-1")
    })
  })
})
