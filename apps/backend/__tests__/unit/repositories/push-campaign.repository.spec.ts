/**
 * PushCampaignRepository Unit Tests
 * Tests repository operations for push campaigns with workspace isolation
 */

import { PushCampaignRepository, CreatePushCampaignInput, UpdatePushCampaignInput, RecipientCreateInput } from '../../../src/repositories/push-campaign.repository'
import { PrismaClient, PushCampaignStatus, PushCampaignRecipientStatus, CampaignFrequency, CampaignTargetType } from '@echatbot/database'

// Mock Prisma client
const mockPrismaClient = {
  pushCampaign: {
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  pushCampaignRecipient: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient

describe('PushCampaignRepository', () => {
  let repository: PushCampaignRepository
  const WORKSPACE_ID_A = 'workspace-a'
  const WORKSPACE_ID_B = 'workspace-b'
  const USER_ID = 'user-1'
  const CAMPAIGN_ID = 'campaign-1'

  beforeEach(() => {
    repository = new PushCampaignRepository(mockPrismaClient)
    jest.clearAllMocks()
  })

  describe('createCampaign', () => {
    it('should create campaign with recipients in a single operation', async () => {
      // SCENARIO: Admin creates push campaign with 3 recipients
      // RULE: Campaign and recipients created in single Prisma operation (transaction-like)
      const campaignData: CreatePushCampaignInput = {
        workspaceId: WORKSPACE_ID_A,
        createdByUserId: USER_ID,
        name: 'Black Friday Sale',
        status: PushCampaignStatus.DRAFT,
        frequency: CampaignFrequency.ONCE,
        targetingType: CampaignTargetType.ALL,
        message: 'Get 50% off this Black Friday!',
        sendAt: new Date('2026-11-27T10:00:00Z'),
        costPerMessage: 0.1,
      }

      const recipients: RecipientCreateInput[] = [
        {
          workspaceId: WORKSPACE_ID_A,
          customerId: 'customer-1',
          phone: '+393331234567',
          status: PushCampaignRecipientStatus.PENDING,
        },
        {
          workspaceId: WORKSPACE_ID_A,
          customerId: 'customer-2',
          phone: '+393337654321',
          status: PushCampaignRecipientStatus.PENDING,
        },
        {
          workspaceId: WORKSPACE_ID_A,
          customerId: 'customer-3',
          phone: '+393339876543',
          status: PushCampaignRecipientStatus.PENDING,
        },
      ]

      const mockCreatedCampaign = {
        id: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID_A,
        createdByUserId: USER_ID,
        name: 'Black Friday Sale',
        status: PushCampaignStatus.DRAFT,
        frequency: CampaignFrequency.ONCE,
        isActive: true,
        targetingType: CampaignTargetType.ALL,
        targetCustomerIds: [],
        tagId: null,
        message: 'Get 50% off this Black Friday!',
        sendAt: new Date('2026-11-27T10:00:00Z'),
        nextRunAt: null,
        lastRunAt: null,
        templateId: null,
        templateLocale: null,
        bodyPreview: null,
        mediaUrl: null,
        targetTags: [],
        costPerMessage: 0.1,
        throttlePerSecond: null,
        batchSize: null,
        expectedRecipients: 3,
        actualSent: 0,
        actualFailed: 0,
        actualSkipped: 0,
        billingStatus: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }

      ;(mockPrismaClient.pushCampaign.create as jest.Mock).mockResolvedValue(mockCreatedCampaign)

      const result = await repository.createCampaign(campaignData, recipients)

      // VERIFICATION: Prisma create called with nested recipients
      expect(mockPrismaClient.pushCampaign.create).toHaveBeenCalledWith({
        data: {
          workspaceId: WORKSPACE_ID_A,
          createdByUserId: USER_ID,
          name: 'Black Friday Sale',
          status: PushCampaignStatus.DRAFT,
          frequency: CampaignFrequency.ONCE,
          isActive: true,
          targetingType: CampaignTargetType.ALL,
          targetCustomerIds: [],
          tagId: undefined,
          message: 'Get 50% off this Black Friday!',
          sendAt: new Date('2026-11-27T10:00:00Z'),
          nextRunAt: undefined,
          lastRunAt: undefined,
          templateId: undefined,
          templateLocale: undefined,
          bodyPreview: undefined,
          mediaUrl: undefined,
          targetTags: [],
          costPerMessage: 0.1,
          throttlePerSecond: undefined,
          batchSize: undefined,
          expectedRecipients: 3,
          recipients: {
            createMany: {
              data: [
                {
                  workspaceId: WORKSPACE_ID_A,
                  customerId: 'customer-1',
                  phone: '+393331234567',
                  status: PushCampaignRecipientStatus.PENDING,
                  errorCode: undefined,
                  errorMessage: undefined,
                  isBlacklisted: false,
                  isBlocked: false,
                  isFake: false,
                  optOutAt: undefined,
                },
                {
                  workspaceId: WORKSPACE_ID_A,
                  customerId: 'customer-2',
                  phone: '+393337654321',
                  status: PushCampaignRecipientStatus.PENDING,
                  errorCode: undefined,
                  errorMessage: undefined,
                  isBlacklisted: false,
                  isBlocked: false,
                  isFake: false,
                  optOutAt: undefined,
                },
                {
                  workspaceId: WORKSPACE_ID_A,
                  customerId: 'customer-3',
                  phone: '+393339876543',
                  status: PushCampaignRecipientStatus.PENDING,
                  errorCode: undefined,
                  errorMessage: undefined,
                  isBlacklisted: false,
                  isBlocked: false,
                  isFake: false,
                  optOutAt: undefined,
                },
              ],
              skipDuplicates: true,
            },
          },
        },
        include: {
          recipients: false,
        },
      })

      expect(result).toEqual(mockCreatedCampaign)
      expect(result.expectedRecipients).toBe(3)
    })

    it('should create campaign with default values when optional fields omitted', async () => {
      // SCENARIO: Admin creates minimal campaign without optional fields
      // RULE: Repository applies defaults (status=DRAFT, frequency=ONCE, targetingType=ALL, isActive=true)
      const minimalData: CreatePushCampaignInput = {
        workspaceId: WORKSPACE_ID_A,
        name: 'Minimal Campaign',
      }

      const mockCreatedCampaign = {
        id: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID_A,
        name: 'Minimal Campaign',
        status: PushCampaignStatus.DRAFT,
        frequency: CampaignFrequency.ONCE,
        isActive: true,
        targetingType: CampaignTargetType.ALL,
        expectedRecipients: 0,
      }

      ;(mockPrismaClient.pushCampaign.create as jest.Mock).mockResolvedValue(mockCreatedCampaign)

      const result = await repository.createCampaign(minimalData, [])

      // VERIFICATION: Defaults applied correctly
      expect(mockPrismaClient.pushCampaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PushCampaignStatus.DRAFT,
            frequency: CampaignFrequency.ONCE,
            isActive: true,
            targetingType: CampaignTargetType.ALL,
            targetCustomerIds: [],
            targetTags: [],
            expectedRecipients: 0,
          }),
        })
      )

      expect(result.status).toBe(PushCampaignStatus.DRAFT)
      expect(result.isActive).toBe(true)
    })

    it('should create campaign with recipients having error flags', async () => {
      // SCENARIO: Admin creates campaign with recipients marked as blacklisted/blocked/fake
      // RULE: Recipients can have validation flags set during creation
      const campaignData: CreatePushCampaignInput = {
        workspaceId: WORKSPACE_ID_A,
        name: 'Test Campaign',
      }

      const recipients: RecipientCreateInput[] = [
        {
          workspaceId: WORKSPACE_ID_A,
          customerId: 'customer-1',
          phone: '+393331234567',
          status: PushCampaignRecipientStatus.PENDING,
        },
        {
          workspaceId: WORKSPACE_ID_A,
          customerId: null,
          phone: '+393337654321',
          status: PushCampaignRecipientStatus.SKIPPED,
          isBlacklisted: true,
        },
        {
          workspaceId: WORKSPACE_ID_A,
          customerId: null,
          phone: '+393339876543',
          status: PushCampaignRecipientStatus.FAILED,
          isFake: true,
          errorMessage: 'Invalid phone number',
        },
      ]

      const mockCreatedCampaign = {
        id: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID_A,
        expectedRecipients: 3,
      }

      ;(mockPrismaClient.pushCampaign.create as jest.Mock).mockResolvedValue(mockCreatedCampaign)

      await repository.createCampaign(campaignData, recipients)

      // VERIFICATION: Recipients created with correct flags
      const createCall = (mockPrismaClient.pushCampaign.create as jest.Mock).mock.calls[0][0]
      const recipientsData = createCall.data.recipients.createMany.data

      expect(recipientsData[1].isBlacklisted).toBe(true)
      expect(recipientsData[2].isFake).toBe(true)
      expect(recipientsData[2].errorMessage).toBe('Invalid phone number')
    })
  })

  describe('updateCampaign', () => {
    it('should update campaign fields with workspace isolation', async () => {
      // SCENARIO: Admin updates campaign name and message in workspace A
      // RULE: Update MUST filter by both campaignId AND workspaceId
      const updateData: UpdatePushCampaignInput = {
        name: 'Updated Campaign Name',
        message: 'Updated message content',
      }

      const mockUpdatedCampaign = {
        id: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID_A,
        name: 'Updated Campaign Name',
        message: 'Updated message content',
        status: PushCampaignStatus.DRAFT,
      }

      ;(mockPrismaClient.pushCampaign.update as jest.Mock).mockResolvedValue(mockUpdatedCampaign)

      const result = await repository.updateCampaign(CAMPAIGN_ID, WORKSPACE_ID_A, updateData)

      // VERIFICATION: Update filters by BOTH id and workspaceId
      expect(mockPrismaClient.pushCampaign.update).toHaveBeenCalledWith({
        where: { id: CAMPAIGN_ID, workspaceId: WORKSPACE_ID_A },
        data: updateData,
      })

      expect(result.name).toBe('Updated Campaign Name')
    })

    it('should prevent updating campaign from different workspace', async () => {
      // SCENARIO: Admin in workspace B tries to update campaign from workspace A
      // RULE: Prisma will throw NOT_FOUND because where clause requires BOTH id + workspaceId match
      const updateData: UpdatePushCampaignInput = {
        name: 'Hacked Name',
      }

      ;(mockPrismaClient.pushCampaign.update as jest.Mock).mockRejectedValue(
        new Error('Record to update not found.')
      )

      await expect(
        repository.updateCampaign(CAMPAIGN_ID, WORKSPACE_ID_B, updateData)
      ).rejects.toThrow('Record to update not found.')

      // VERIFICATION: Where clause includes workspaceId (prevents cross-workspace updates)
      expect(mockPrismaClient.pushCampaign.update).toHaveBeenCalledWith({
        where: { id: CAMPAIGN_ID, workspaceId: WORKSPACE_ID_B },
        data: updateData,
      })
    })

    it('should update campaign status and scheduling fields', async () => {
      // SCENARIO: Admin schedules campaign by updating status and sendAt
      // RULE: Can update status from DRAFT → SCHEDULED with sendAt timestamp
      const updateData: UpdatePushCampaignInput = {
        status: PushCampaignStatus.SCHEDULED,
        sendAt: new Date('2026-12-01T15:00:00Z'),
      }

      const mockUpdatedCampaign = {
        id: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID_A,
        status: PushCampaignStatus.SCHEDULED,
        sendAt: new Date('2026-12-01T15:00:00Z'),
      }

      ;(mockPrismaClient.pushCampaign.update as jest.Mock).mockResolvedValue(mockUpdatedCampaign)

      const result = await repository.updateCampaign(CAMPAIGN_ID, WORKSPACE_ID_A, updateData)

      expect(result.status).toBe(PushCampaignStatus.SCHEDULED)
      expect(result.sendAt).toEqual(new Date('2026-12-01T15:00:00Z'))
    })
  })

  describe('deleteCampaign', () => {
    it('should delete campaign with workspace isolation', async () => {
      // SCENARIO: Admin deletes campaign from their workspace
      // RULE: Delete MUST filter by both campaignId AND workspaceId
      const mockDeletedCampaign = {
        id: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID_A,
        name: 'Deleted Campaign',
      }

      ;(mockPrismaClient.pushCampaign.delete as jest.Mock).mockResolvedValue(mockDeletedCampaign)

      const result = await repository.deleteCampaign(CAMPAIGN_ID, WORKSPACE_ID_A)

      // VERIFICATION: Delete filters by BOTH id and workspaceId
      expect(mockPrismaClient.pushCampaign.delete).toHaveBeenCalledWith({
        where: { id: CAMPAIGN_ID, workspaceId: WORKSPACE_ID_A },
      })

      expect(result.id).toBe(CAMPAIGN_ID)
    })

    it('should prevent deleting campaign from different workspace', async () => {
      // SCENARIO: Admin in workspace B tries to delete campaign from workspace A
      // RULE: Prisma will throw NOT_FOUND because where clause requires BOTH id + workspaceId match
      ;(mockPrismaClient.pushCampaign.delete as jest.Mock).mockRejectedValue(
        new Error('Record to delete does not exist.')
      )

      await expect(
        repository.deleteCampaign(CAMPAIGN_ID, WORKSPACE_ID_B)
      ).rejects.toThrow('Record to delete does not exist.')

      // VERIFICATION: Where clause includes workspaceId (prevents cross-workspace deletion)
      expect(mockPrismaClient.pushCampaign.delete).toHaveBeenCalledWith({
        where: { id: CAMPAIGN_ID, workspaceId: WORKSPACE_ID_B },
      })
    })
  })

  describe('listByWorkspace', () => {
    it('should return only campaigns from specified workspace', async () => {
      // SCENARIO: Admin views campaign list in their workspace
      // RULE: Query MUST filter by workspaceId, return newest first
      const mockCampaigns = [
        {
          id: 'campaign-1',
          name: 'Campaign 1',
          workspaceId: WORKSPACE_ID_A,
          status: PushCampaignStatus.COMPLETED,
          frequency: CampaignFrequency.ONCE,
          isActive: true,
          targetingType: CampaignTargetType.ALL,
          sendAt: new Date('2026-11-01T10:00:00Z'),
          expectedRecipients: 100,
          actualSent: 95,
          actualFailed: 5,
          actualSkipped: 0,
          createdAt: new Date('2026-10-30T10:00:00Z'),
          updatedAt: new Date('2026-11-01T11:00:00Z'),
        },
        {
          id: 'campaign-2',
          name: 'Campaign 2',
          workspaceId: WORKSPACE_ID_A,
          status: PushCampaignStatus.DRAFT,
          frequency: CampaignFrequency.WEEKLY,
          isActive: false,
          targetingType: CampaignTargetType.TAG,
          sendAt: null,
          expectedRecipients: 0,
          actualSent: 0,
          actualFailed: 0,
          actualSkipped: 0,
          createdAt: new Date('2026-10-28T10:00:00Z'),
          updatedAt: new Date('2026-10-28T10:00:00Z'),
        },
      ]

      ;(mockPrismaClient.pushCampaign.findMany as jest.Mock).mockResolvedValue(mockCampaigns)

      const result = await repository.listByWorkspace(WORKSPACE_ID_A)

      // VERIFICATION: Query filters by workspaceId and orders by createdAt desc
      expect(mockPrismaClient.pushCampaign.findMany).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID_A },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          status: true,
          frequency: true,
          isActive: true,
          targetingType: true,
          sendAt: true,
          nextRunAt: true,
          lastRunAt: true,
          expectedRecipients: true,
          actualSent: true,
          actualFailed: true,
          actualSkipped: true,
          billingStatus: true,
          costPerMessage: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      expect(result).toHaveLength(2)
      expect(result[0].workspaceId).toBe(WORKSPACE_ID_A)
      expect(result[1].workspaceId).toBe(WORKSPACE_ID_A)
    })

    it('should return empty array if workspace has no campaigns', async () => {
      // SCENARIO: New workspace with no campaigns created yet
      // RULE: Return empty array, not null
      ;(mockPrismaClient.pushCampaign.findMany as jest.Mock).mockResolvedValue([])

      const result = await repository.listByWorkspace(WORKSPACE_ID_B)

      expect(result).toEqual([])
      expect(mockPrismaClient.pushCampaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: WORKSPACE_ID_B },
        })
      )
    })
  })

  describe('findById', () => {
    it('should return campaign when id and workspaceId match', async () => {
      // SCENARIO: Admin views campaign details in their workspace
      // RULE: Query MUST filter by both id AND workspaceId
      const mockCampaign = {
        id: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID_A,
        name: 'Black Friday Sale',
        status: PushCampaignStatus.SCHEDULED,
        message: 'Get 50% off!',
        expectedRecipients: 500,
      }

      ;(mockPrismaClient.pushCampaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign)

      const result = await repository.findById(CAMPAIGN_ID, WORKSPACE_ID_A)

      // VERIFICATION: Query filters by BOTH id and workspaceId
      expect(mockPrismaClient.pushCampaign.findFirst).toHaveBeenCalledWith({
        where: { id: CAMPAIGN_ID, workspaceId: WORKSPACE_ID_A },
        include: {
          recipients: false,
        },
      })

      expect(result).toEqual(mockCampaign)
    })

    it('should return null when campaign exists but workspace mismatch', async () => {
      // SCENARIO: Admin in workspace B tries to access campaign from workspace A
      // RULE: findFirst returns null when where clause doesn't match (workspace isolation)
      ;(mockPrismaClient.pushCampaign.findFirst as jest.Mock).mockResolvedValue(null)

      const result = await repository.findById(CAMPAIGN_ID, WORKSPACE_ID_B)

      // VERIFICATION: Query includes workspaceId filter (prevents cross-workspace access)
      expect(mockPrismaClient.pushCampaign.findFirst).toHaveBeenCalledWith({
        where: { id: CAMPAIGN_ID, workspaceId: WORKSPACE_ID_B },
        include: {
          recipients: false,
        },
      })

      expect(result).toBeNull()
    })

    it('should return null when campaign does not exist', async () => {
      // SCENARIO: Admin tries to view non-existent campaign
      // RULE: Return null, not throw error
      ;(mockPrismaClient.pushCampaign.findFirst as jest.Mock).mockResolvedValue(null)

      const result = await repository.findById('non-existent-id', WORKSPACE_ID_A)

      expect(result).toBeNull()
    })
  })

  describe('updateStatus', () => {
    it('should update status with workspace isolation', async () => {
      // SCENARIO: Scheduler transitions campaign from SCHEDULED → RUNNING
      // RULE: updateMany MUST filter by both id AND workspaceId
      ;(mockPrismaClient.pushCampaign.updateMany as jest.Mock).mockResolvedValue({ count: 1 })

      await repository.updateStatus(CAMPAIGN_ID, WORKSPACE_ID_A, PushCampaignStatus.RUNNING)

      // VERIFICATION: updateMany filters by BOTH id and workspaceId
      expect(mockPrismaClient.pushCampaign.updateMany).toHaveBeenCalledWith({
        where: { id: CAMPAIGN_ID, workspaceId: WORKSPACE_ID_A },
        data: { status: PushCampaignStatus.RUNNING, sendAt: undefined },
      })
    })

    it('should update status and sendAt timestamp together', async () => {
      // SCENARIO: Admin reschedules campaign with new sendAt time
      // RULE: Can update both status and sendAt in single operation
      const newSendAt = new Date('2026-12-25T12:00:00Z')

      ;(mockPrismaClient.pushCampaign.updateMany as jest.Mock).mockResolvedValue({ count: 1 })

      await repository.updateStatus(CAMPAIGN_ID, WORKSPACE_ID_A, PushCampaignStatus.SCHEDULED, newSendAt)

      expect(mockPrismaClient.pushCampaign.updateMany).toHaveBeenCalledWith({
        where: { id: CAMPAIGN_ID, workspaceId: WORKSPACE_ID_A },
        data: { status: PushCampaignStatus.SCHEDULED, sendAt: newSendAt },
      })
    })

    it('should handle status transitions DRAFT → SCHEDULED → RUNNING → COMPLETED', async () => {
      // SCENARIO: Campaign lifecycle status transitions
      // RULE: Each status update filters by workspaceId for security
      const statusFlow = [
        PushCampaignStatus.DRAFT,
        PushCampaignStatus.SCHEDULED,
        PushCampaignStatus.RUNNING,
        PushCampaignStatus.COMPLETED,
      ]

      ;(mockPrismaClient.pushCampaign.updateMany as jest.Mock).mockResolvedValue({ count: 1 })

      for (const status of statusFlow) {
        await repository.updateStatus(CAMPAIGN_ID, WORKSPACE_ID_A, status)

        expect(mockPrismaClient.pushCampaign.updateMany).toHaveBeenCalledWith({
          where: { id: CAMPAIGN_ID, workspaceId: WORKSPACE_ID_A },
          data: expect.objectContaining({ status }),
        })
      }

      expect(mockPrismaClient.pushCampaign.updateMany).toHaveBeenCalledTimes(4)
    })

    it('should return count 0 when campaign not found in workspace', async () => {
      // SCENARIO: Admin tries to update status of campaign from different workspace
      // RULE: updateMany returns { count: 0 } when where clause doesn't match
      ;(mockPrismaClient.pushCampaign.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

      const result = await repository.updateStatus(CAMPAIGN_ID, WORKSPACE_ID_B, PushCampaignStatus.RUNNING)

      expect(result.count).toBe(0)
    })
  })

  describe('updateCounts', () => {
    it('should update actualSent count after sending messages', async () => {
      // SCENARIO: Scheduler updates sent count after processing batch of recipients
      // RULE: Update actualSent field to track progress
      const mockUpdatedCampaign = {
        id: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID_A,
        actualSent: 50,
        actualFailed: 0,
        actualSkipped: 0,
      }

      ;(mockPrismaClient.pushCampaign.update as jest.Mock).mockResolvedValue(mockUpdatedCampaign)

      const result = await repository.updateCounts(CAMPAIGN_ID, WORKSPACE_ID_A, {
        actualSent: 50,
      })

      // VERIFICATION: Update by campaign id AND workspaceId (security fix applied)
      // RULE: Workspace isolation - all updates must filter by workspaceId
      expect(mockPrismaClient.pushCampaign.update).toHaveBeenCalledWith({
        where: { id: CAMPAIGN_ID, workspaceId: WORKSPACE_ID_A },
        data: { actualSent: 50 },
      })

      expect(result.actualSent).toBe(50)
    })

    it('should update actualFailed count after processing errors', async () => {
      // SCENARIO: Scheduler updates failed count after error handling
      // RULE: Track failed deliveries separately
      const mockUpdatedCampaign = {
        id: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID_A,
        actualSent: 45,
        actualFailed: 5,
        actualSkipped: 0,
      }

      ;(mockPrismaClient.pushCampaign.update as jest.Mock).mockResolvedValue(mockUpdatedCampaign)

      const result = await repository.updateCounts(CAMPAIGN_ID, WORKSPACE_ID_A, {
        actualFailed: 5,
      })

      expect(result.actualFailed).toBe(5)
    })

    it('should update actualSkipped count for filtered recipients', async () => {
      // SCENARIO: Scheduler counts skipped recipients (blacklisted, blocked, fake)
      // RULE: Track skipped deliveries for reporting
      const mockUpdatedCampaign = {
        id: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID_A,
        actualSent: 90,
        actualFailed: 5,
        actualSkipped: 5,
      }

      ;(mockPrismaClient.pushCampaign.update as jest.Mock).mockResolvedValue(mockUpdatedCampaign)

      const result = await repository.updateCounts(CAMPAIGN_ID, WORKSPACE_ID_A, {
        actualSkipped: 5,
      })

      expect(result.actualSkipped).toBe(5)
    })

    it('should update multiple counts in single operation', async () => {
      // SCENARIO: Scheduler updates all counts after campaign completion
      // RULE: Can update sent/failed/skipped together
      const mockUpdatedCampaign = {
        id: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID_A,
        actualSent: 450,
        actualFailed: 30,
        actualSkipped: 20,
      }

      ;(mockPrismaClient.pushCampaign.update as jest.Mock).mockResolvedValue(mockUpdatedCampaign)

      const result = await repository.updateCounts(CAMPAIGN_ID, WORKSPACE_ID_A, {
        actualSent: 450,
        actualFailed: 30,
        actualSkipped: 20,
      })

      expect(mockPrismaClient.pushCampaign.update).toHaveBeenCalledWith({
        where: { id: CAMPAIGN_ID, workspaceId: WORKSPACE_ID_A },
        data: {
          actualSent: 450,
          actualFailed: 30,
          actualSkipped: 20,
        },
      })

      expect(result.actualSent).toBe(450)
      expect(result.actualFailed).toBe(30)
      expect(result.actualSkipped).toBe(20)
    })
  })

  describe('listRecipients', () => {
    it('should return paginated recipients with workspace isolation', async () => {
      // SCENARIO: Admin views first page of campaign recipients (50 per page)
      // RULE: Query MUST filter by both campaignId AND workspaceId, paginate with skip/take
      const mockRecipients = Array(50)
        .fill(null)
        .map((_, i) => ({
          id: `recipient-${i}`,
          campaignId: CAMPAIGN_ID,
          workspaceId: WORKSPACE_ID_A,
          customerId: `customer-${i}`,
          phone: `+39333000000${i}`,
          status: PushCampaignRecipientStatus.PENDING,
          errorCode: null,
          errorMessage: null,
          createdAt: new Date(),
        }))

      ;(mockPrismaClient.pushCampaignRecipient.findMany as jest.Mock).mockResolvedValue(mockRecipients)

      const result = await repository.listRecipients(CAMPAIGN_ID, WORKSPACE_ID_A, 0, 50)

      // VERIFICATION: Query filters by BOTH campaignId and workspaceId, paginates correctly
      expect(mockPrismaClient.pushCampaignRecipient.findMany).toHaveBeenCalledWith({
        where: {
          campaignId: CAMPAIGN_ID,
          workspaceId: WORKSPACE_ID_A,
        },
        orderBy: { createdAt: 'asc' },
        skip: 0,
        take: 50,
      })

      expect(result).toHaveLength(50)
      expect(result[0].workspaceId).toBe(WORKSPACE_ID_A)
    })

    it('should return second page of recipients with skip offset', async () => {
      // SCENARIO: Admin views page 2 of recipients (skip 50, take 50)
      // RULE: Use skip/take for pagination
      const mockRecipients = Array(50)
        .fill(null)
        .map((_, i) => ({
          id: `recipient-${50 + i}`,
          campaignId: CAMPAIGN_ID,
          workspaceId: WORKSPACE_ID_A,
          phone: `+39333000050${i}`,
          status: PushCampaignRecipientStatus.SENT,
        }))

      ;(mockPrismaClient.pushCampaignRecipient.findMany as jest.Mock).mockResolvedValue(mockRecipients)

      const result = await repository.listRecipients(CAMPAIGN_ID, WORKSPACE_ID_A, 50, 50)

      expect(mockPrismaClient.pushCampaignRecipient.findMany).toHaveBeenCalledWith({
        where: {
          campaignId: CAMPAIGN_ID,
          workspaceId: WORKSPACE_ID_A,
        },
        orderBy: { createdAt: 'asc' },
        skip: 50,
        take: 50,
      })

      expect(result).toHaveLength(50)
    })

    it('should filter recipients by status (FAILED only)', async () => {
      // SCENARIO: Admin views only failed recipients to investigate errors
      // RULE: Add status filter to where clause when provided
      const mockFailedRecipients = [
        {
          id: 'recipient-1',
          campaignId: CAMPAIGN_ID,
          workspaceId: WORKSPACE_ID_A,
          phone: '+393331234567',
          status: PushCampaignRecipientStatus.FAILED,
          errorCode: 'INVALID_PHONE',
          errorMessage: 'Phone number is invalid',
        },
        {
          id: 'recipient-2',
          campaignId: CAMPAIGN_ID,
          workspaceId: WORKSPACE_ID_A,
          phone: '+393337654321',
          status: PushCampaignRecipientStatus.FAILED,
          errorCode: 'BLOCKED',
          errorMessage: 'Customer blocked messages',
        },
      ]

      ;(mockPrismaClient.pushCampaignRecipient.findMany as jest.Mock).mockResolvedValue(mockFailedRecipients)

      const result = await repository.listRecipients(
        CAMPAIGN_ID,
        WORKSPACE_ID_A,
        0,
        50,
        PushCampaignRecipientStatus.FAILED
      )

      // VERIFICATION: Query includes status filter
      expect(mockPrismaClient.pushCampaignRecipient.findMany).toHaveBeenCalledWith({
        where: {
          campaignId: CAMPAIGN_ID,
          workspaceId: WORKSPACE_ID_A,
          status: PushCampaignRecipientStatus.FAILED,
        },
        orderBy: { createdAt: 'asc' },
        skip: 0,
        take: 50,
      })

      expect(result).toHaveLength(2)
      expect(result[0].status).toBe(PushCampaignRecipientStatus.FAILED)
      expect(result[1].status).toBe(PushCampaignRecipientStatus.FAILED)
    })

    it('should filter recipients by status (SENT only)', async () => {
      // SCENARIO: Admin views successfully sent recipients
      // RULE: Status filter works for any PushCampaignRecipientStatus value
      const mockSentRecipients = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: `recipient-${i}`,
          campaignId: CAMPAIGN_ID,
          workspaceId: WORKSPACE_ID_A,
          status: PushCampaignRecipientStatus.SENT,
        }))

      ;(mockPrismaClient.pushCampaignRecipient.findMany as jest.Mock).mockResolvedValue(mockSentRecipients)

      const result = await repository.listRecipients(
        CAMPAIGN_ID,
        WORKSPACE_ID_A,
        0,
        50,
        PushCampaignRecipientStatus.SENT
      )

      expect(mockPrismaClient.pushCampaignRecipient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: PushCampaignRecipientStatus.SENT,
          }),
        })
      )

      expect(result).toHaveLength(10)
    })

    it('should use default pagination values (skip=0, take=50)', async () => {
      // SCENARIO: Admin calls listRecipients without pagination params
      // RULE: Default to first page (skip=0, take=50)
      ;(mockPrismaClient.pushCampaignRecipient.findMany as jest.Mock).mockResolvedValue([])

      await repository.listRecipients(CAMPAIGN_ID, WORKSPACE_ID_A)

      expect(mockPrismaClient.pushCampaignRecipient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 50,
        })
      )
    })

    it('should return empty array when no recipients found', async () => {
      // SCENARIO: Admin views recipients for empty campaign or different workspace
      // RULE: Return empty array, not null
      ;(mockPrismaClient.pushCampaignRecipient.findMany as jest.Mock).mockResolvedValue([])

      const result = await repository.listRecipients(CAMPAIGN_ID, WORKSPACE_ID_B)

      expect(result).toEqual([])
    })

    it('should order recipients by createdAt ascending (FIFO)', async () => {
      // SCENARIO: Recipients displayed in order they were added (oldest first)
      // RULE: Always order by createdAt asc for consistent pagination
      ;(mockPrismaClient.pushCampaignRecipient.findMany as jest.Mock).mockResolvedValue([])

      await repository.listRecipients(CAMPAIGN_ID, WORKSPACE_ID_A)

      expect(mockPrismaClient.pushCampaignRecipient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        })
      )
    })
  })
})
