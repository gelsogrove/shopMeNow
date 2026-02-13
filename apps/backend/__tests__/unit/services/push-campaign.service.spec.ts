/**
 * PushCampaignService Unit Tests
 * Tests business logic for push campaign operations
 */

import { PushCampaignService } from '../../../src/application/services/push-campaign.service'
import { PushCampaignRepository } from '../../../src/repositories/push-campaign.repository'
import { platformConfigService } from '../../../src/services/platform-config.service'
import {
  PrismaClient,
  PushCampaignStatus,
  PushCampaignRecipientStatus,
  CampaignFrequency,
  CampaignTargetType,
  Prisma,
} from '@echatbot/database'

// Mock dependencies
jest.mock('../../../src/repositories/push-campaign.repository')
jest.mock('../../../src/services/platform-config.service')

describe('PushCampaignService', () => {
  let service: PushCampaignService
  let mockPrisma: jest.Mocked<PrismaClient>
  let mockRepo: jest.Mocked<PushCampaignRepository>
  let buildRecipientsSpy: jest.SpyInstance

  beforeEach(() => {
    // Mock Prisma client
    mockPrisma = {
      workspace: {
        findUnique: jest.fn(),
      },
      customers: {
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      pushCampaignRecipient: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
    } as any

    // Create service instance
    service = new PushCampaignService(mockPrisma)

    // Mock repository instance
    mockRepo = {
      createCampaign: jest.fn(),
      updateCampaign: jest.fn(),
      deleteCampaign: jest.fn(),
      listByWorkspace: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn(),
      listRecipients: jest.fn(),
      replaceRecipients: jest.fn(),
    } as any

    // Replace the internal repo with our mock
    ;(service as any).repo = mockRepo

    // Mock platform config service
    ;(platformConfigService.getPrice as jest.Mock).mockResolvedValue(1.0)
    ;(platformConfigService.getLimit as jest.Mock).mockResolvedValue(10)

    jest.clearAllMocks()
  })

  describe('create', () => {
    const baseInput = {
      workspaceId: 'workspace-1',
      createdByUserId: 'user-1',
      name: 'Test Campaign',
      targetingType: CampaignTargetType.ALL,
      message: 'Hello World',
      frequency: CampaignFrequency.ONCE,
    }

    const mockWorkspace = {
      id: 'workspace-1',
      enableWhatsapp: true,
      ownerId: 'owner-1',
    }

    const mockOwner = {
      id: 'owner-1',
      creditBalance: new Prisma.Decimal(100),
    }

    it('should create campaign with ALL targeting successfully', async () => {
      // SCENARIO: Admin creates campaign targeting ALL customers
      // RULE: Must filter out inactive chatbot, blacklisted, and non-consented customers

      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace)
      mockPrisma.user.findUnique.mockResolvedValue(mockOwner)

      // ALL targeting: returns active, non-blacklisted customers
      mockPrisma.customers.findMany
        .mockResolvedValueOnce([
          { id: 'customer-1' },
          { id: 'customer-2' },
        ] as any)
        .mockResolvedValueOnce([
          {
            id: 'customer-1',
            phone: '+393331234567',
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          },
          {
            id: 'customer-2',
            phone: '+393337654321',
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          },
        ] as any)

      const mockCampaign = {
        id: 'campaign-1',
        workspaceId: 'workspace-1',
        name: 'Test Campaign',
        status: PushCampaignStatus.SCHEDULED,
        expectedRecipients: 2,
      }

      mockRepo.createCampaign.mockResolvedValue(mockCampaign as any)

      const result = await service.create(baseInput)

      expect(result).toEqual(mockCampaign)
      expect(mockPrisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: 'workspace-1' },
        select: { enableWhatsapp: true, ownerId: true },
      })

      // Verify ALL targeting query filters correctly
      expect(mockPrisma.customers.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: 'workspace-1',
          activeChatbot: true,
          deletedAt: null,
          isBlacklisted: false,
        },
        select: { id: true },
      })

      // Verify recipients creation
      expect(mockRepo.createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-1',
          name: 'Test Campaign',
          targetingType: CampaignTargetType.ALL,
          status: PushCampaignStatus.SCHEDULED,
        }),
        expect.arrayContaining([
          expect.objectContaining({
            customerId: 'customer-1',
            phone: '+393331234567',
            status: PushCampaignRecipientStatus.PENDING,
          }),
          expect.objectContaining({
            customerId: 'customer-2',
            phone: '+393337654321',
            status: PushCampaignRecipientStatus.PENDING,
          }),
        ])
      )
    })

    it('should create campaign with MANUAL targeting successfully', async () => {
      // SCENARIO: Admin creates campaign with specific customer list
      // RULE: Only target specified customer IDs

      const manualInput = {
        ...baseInput,
        targetingType: CampaignTargetType.MANUAL,
        targetCustomerIds: ['customer-1', 'customer-3'],
      }

      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace)
      mockPrisma.user.findUnique.mockResolvedValue(mockOwner)

      // MANUAL targeting: returns only specified customers
      mockPrisma.customers.findMany.mockResolvedValue([
        {
          id: 'customer-1',
          phone: '+393331234567',
          isBlacklisted: false,
          activeChatbot: true,
          push_notifications_consent: true,
          push_notifications_consent_at: new Date(),
        },
        {
          id: 'customer-3',
          phone: '+393339999999',
          isBlacklisted: false,
          activeChatbot: true,
          push_notifications_consent: true,
          push_notifications_consent_at: new Date(),
        },
      ] as any)

      const mockCampaign = {
        id: 'campaign-2',
        workspaceId: 'workspace-1',
        name: 'Test Campaign',
        targetingType: CampaignTargetType.MANUAL,
        expectedRecipients: 2,
      }

      mockRepo.createCampaign.mockResolvedValue(mockCampaign as any)

      const result = await service.create(manualInput)

      expect(result).toEqual(mockCampaign)

      // Verify MANUAL targeting uses specified IDs
      expect(mockPrisma.customers.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: 'workspace-1',
          id: { in: ['customer-1', 'customer-3'] },
          deletedAt: null, // Skip soft-deleted customers
        },
        select: {
          id: true,
          phone: true,
          isBlacklisted: true,
          activeChatbot: true,
          push_notifications_consent: true,
          push_notifications_consent_at: true,
        },
      })

      expect(mockRepo.createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          targetingType: CampaignTargetType.MANUAL,
          targetCustomerIds: ['customer-1', 'customer-3'],
        }),
        expect.arrayContaining([
          expect.objectContaining({
            customerId: 'customer-1',
            status: PushCampaignRecipientStatus.PENDING,
          }),
          expect.objectContaining({
            customerId: 'customer-3',
            status: PushCampaignRecipientStatus.PENDING,
          }),
        ])
      )
    })

    it('should create campaign with TAGS targeting successfully', async () => {
      // SCENARIO: Admin creates campaign targeting customers with specific tag
      // RULE: Filter by tag ID AND active chatbot AND not blacklisted

      const tagInput = {
        ...baseInput,
        targetingType: CampaignTargetType.TAGS,
        tagId: 'tag-1',
      }

      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace)
      mockPrisma.user.findUnique.mockResolvedValue(mockOwner)

      // TAGS targeting: first query gets customers with tag
      mockPrisma.customers.findMany
        .mockResolvedValueOnce([
          { id: 'customer-1' },
          { id: 'customer-2' },
        ] as any)
        .mockResolvedValueOnce([
          {
            id: 'customer-1',
            phone: '+393331234567',
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          },
          {
            id: 'customer-2',
            phone: '+393337654321',
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          },
        ] as any)

      const mockCampaign = {
        id: 'campaign-3',
        workspaceId: 'workspace-1',
        name: 'Test Campaign',
        targetingType: CampaignTargetType.TAGS,
        tagId: 'tag-1',
        expectedRecipients: 2,
      }

      mockRepo.createCampaign.mockResolvedValue(mockCampaign as any)

      const result = await service.create(tagInput)

      expect(result).toEqual(mockCampaign)

      // Verify TAGS targeting query filters correctly
      expect(mockPrisma.customers.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: 'workspace-1',
          tags: { has: 'tag-1' },
          activeChatbot: true,
          deletedAt: null,
          isBlacklisted: false,
        },
        select: { id: true },
      })

      expect(mockRepo.createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          targetingType: CampaignTargetType.TAGS,
          tagId: 'tag-1',
        }),
        expect.any(Array)
      )
    })

    it('should exclude blacklisted customers from recipients', async () => {
      // SCENARIO: Campaign targets customers, some are blacklisted
      // RULE: Blacklisted customers get SKIPPED status with BLACKLISTED error code

      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace)
      mockPrisma.user.findUnique.mockResolvedValue(mockOwner)

      mockPrisma.customers.findMany
        .mockResolvedValueOnce([
          { id: 'customer-1' },
          { id: 'customer-2' },
        ] as any)
        .mockResolvedValueOnce([
          {
            id: 'customer-1',
            phone: '+393331234567',
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          },
          {
            id: 'customer-2',
            phone: '+393337654321',
            isBlacklisted: true, // Blacklisted
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          },
        ] as any)

      mockRepo.createCampaign.mockResolvedValue({
        id: 'campaign-1',
        expectedRecipients: 2,
      } as any)

      await service.create(baseInput)

      // Verify blacklisted customer is marked as SKIPPED
      expect(mockRepo.createCampaign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.arrayContaining([
          expect.objectContaining({
            customerId: 'customer-1',
            status: PushCampaignRecipientStatus.PENDING,
          }),
          expect.objectContaining({
            customerId: 'customer-2',
            phone: '+393337654321',
            status: PushCampaignRecipientStatus.SKIPPED,
            errorCode: 'BLACKLISTED',
            errorMessage: 'Customer is blacklisted',
          }),
        ])
      )
    })

    it('should exclude customers with inactive chatbot', async () => {
      // SCENARIO: Campaign targets customers, some have chatbot disabled
      // RULE: Inactive chatbot customers get SKIPPED status with CHATBOT_INACTIVE error code

      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace)
      mockPrisma.user.findUnique.mockResolvedValue(mockOwner)

      mockPrisma.customers.findMany
        .mockResolvedValueOnce([
          { id: 'customer-1' },
          { id: 'customer-2' },
        ] as any)
        .mockResolvedValueOnce([
          {
            id: 'customer-1',
            phone: '+393331234567',
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          },
          {
            id: 'customer-2',
            phone: '+393337654321',
            isBlacklisted: false,
            activeChatbot: false, // Chatbot inactive
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          },
        ] as any)

      mockRepo.createCampaign.mockResolvedValue({
        id: 'campaign-1',
        expectedRecipients: 2,
      } as any)

      await service.create(baseInput)

      // Verify inactive chatbot customer is marked as SKIPPED
      expect(mockRepo.createCampaign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.arrayContaining([
          expect.objectContaining({
            customerId: 'customer-1',
            status: PushCampaignRecipientStatus.PENDING,
          }),
          expect.objectContaining({
            customerId: 'customer-2',
            phone: '+393337654321',
            status: PushCampaignRecipientStatus.SKIPPED,
            errorCode: 'CHATBOT_INACTIVE',
            errorMessage: 'Chatbot is inactive for this customer',
          }),
        ])
      )
    })

    it('should exclude customers without marketing consent (opted-out)', async () => {
      // SCENARIO: Campaign targets customers, some have not consented to marketing
      // RULE: Customers without consent get SKIPPED status with OPT_OUT error code

      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace)
      mockPrisma.user.findUnique.mockResolvedValue(mockOwner)

      mockPrisma.customers.findMany
        .mockResolvedValueOnce([
          { id: 'customer-1' },
          { id: 'customer-2' },
        ] as any)
        .mockResolvedValueOnce([
          {
            id: 'customer-1',
            phone: '+393331234567',
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          },
          {
            id: 'customer-2',
            phone: '+393337654321',
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: false, // No consent
            push_notifications_consent_at: null,
          },
        ] as any)

      mockRepo.createCampaign.mockResolvedValue({
        id: 'campaign-1',
        expectedRecipients: 2,
      } as any)

      await service.create(baseInput)

      // Verify opted-out customer is marked as SKIPPED
      expect(mockRepo.createCampaign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.arrayContaining([
          expect.objectContaining({
            customerId: 'customer-1',
            status: PushCampaignRecipientStatus.PENDING,
          }),
          expect.objectContaining({
            customerId: 'customer-2',
            phone: '+393337654321',
            status: PushCampaignRecipientStatus.SKIPPED,
            errorCode: 'OPT_OUT',
            errorMessage: 'Marketing opt-in missing',
          }),
        ])
      )
    })

    it('should check workspace owner credit before creation', async () => {
      // SCENARIO: Admin attempts to create campaign but owner has insufficient credits
      // RULE: Must throw error if owner creditBalance < estimated cost

      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace)

      // Owner with insufficient credits
      const poorOwner = {
        id: 'owner-1',
        creditBalance: new Prisma.Decimal(0.5), // Only 0.5 credits
      }
      mockPrisma.user.findUnique.mockResolvedValue(poorOwner)

      mockPrisma.customers.findMany
        .mockResolvedValueOnce([
          { id: 'customer-1' },
          { id: 'customer-2' },
        ] as any)
        .mockResolvedValueOnce([
          {
            id: 'customer-1',
            phone: '+393331234567',
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          },
          {
            id: 'customer-2',
            phone: '+393337654321',
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          },
        ] as any)

      // Cost per message = 1.0, 2 recipients = 2.0 total
      // Owner only has 0.5 credits
      await expect(service.create(baseInput)).rejects.toThrow('Insufficient credit for campaign')
    })

    it('should enforce workspace isolation during creation', async () => {
      // SCENARIO: Admin from workspace-1 attempts to create campaign for workspace-2
      // RULE: Workspace validation happens at middleware level, but service must use correct workspaceId

      const isolatedInput = {
        ...baseInput,
        workspaceId: 'workspace-2',
      }

      const workspace2 = {
        id: 'workspace-2',
        enableWhatsapp: true,
        ownerId: 'owner-2',
      }

      mockPrisma.workspace.findUnique.mockResolvedValue(workspace2)
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-2',
        creditBalance: new Prisma.Decimal(100),
      })

      mockPrisma.customers.findMany
        .mockResolvedValueOnce([{ id: 'customer-3' }] as any)
        .mockResolvedValueOnce([
          {
            id: 'customer-3',
            phone: '+393338888888',
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          },
        ] as any)

      mockRepo.createCampaign.mockResolvedValue({
        id: 'campaign-2',
        workspaceId: 'workspace-2',
      } as any)

      await service.create(isolatedInput)

      // Verify all queries filter by correct workspaceId
      expect(mockPrisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: 'workspace-2' },
        select: { enableWhatsapp: true, ownerId: true },
      })

      expect(mockPrisma.customers.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: 'workspace-2',
          }),
        })
      )

      expect(mockRepo.createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-2',
        }),
        expect.any(Array)
      )
    })

    it('should calculate nextRunAt for recurring campaigns', async () => {
      // SCENARIO: Admin creates WEEKLY recurring campaign
      // RULE: nextRunAt should be sendAt + 7 days for WEEKLY frequency

      const recurringInput = {
        ...baseInput,
        frequency: CampaignFrequency.WEEKLY,
        sendAt: new Date('2024-01-01T10:00:00Z'),
      }

      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace)
      mockPrisma.user.findUnique.mockResolvedValue(mockOwner)

      mockPrisma.customers.findMany
        .mockResolvedValueOnce([{ id: 'customer-1' }] as any)
        .mockResolvedValueOnce([
          {
            id: 'customer-1',
            phone: '+393331234567',
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          },
        ] as any)

      mockRepo.createCampaign.mockResolvedValue({
        id: 'campaign-1',
        frequency: CampaignFrequency.WEEKLY,
        nextRunAt: new Date('2024-01-08T10:00:00Z'),
      } as any)

      await service.create(recurringInput)

      // Verify nextRunAt is calculated correctly (7 days after sendAt)
      expect(mockRepo.createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency: CampaignFrequency.WEEKLY,
          sendAt: new Date('2024-01-01T10:00:00Z'),
          nextRunAt: new Date('2024-01-08T10:00:00Z'),
        }),
        expect.any(Array)
      )
    })

    it('should set nextRunAt to null for ONCE campaigns', async () => {
      // SCENARIO: Admin creates one-time campaign
      // RULE: nextRunAt should be null for ONCE frequency

      const onceInput = {
        ...baseInput,
        frequency: CampaignFrequency.ONCE,
      }

      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace)
      mockPrisma.user.findUnique.mockResolvedValue(mockOwner)

      mockPrisma.customers.findMany
        .mockResolvedValueOnce([{ id: 'customer-1' }] as any)
        .mockResolvedValueOnce([
          {
            id: 'customer-1',
            phone: '+393331234567',
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          },
        ] as any)

      mockRepo.createCampaign.mockResolvedValue({
        id: 'campaign-1',
        frequency: CampaignFrequency.ONCE,
        nextRunAt: null,
      } as any)

      await service.create(onceInput)

      // Verify nextRunAt is null for one-time campaign
      expect(mockRepo.createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency: CampaignFrequency.ONCE,
          nextRunAt: null,
        }),
        expect.any(Array)
      )
    })

    it('should throw error if no valid recipients found', async () => {
      // SCENARIO: Campaign targeting returns no valid customers
      // RULE: Must throw error if recipient list is empty

      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace)
      mockPrisma.user.findUnique.mockResolvedValue(mockOwner)

      // No customers found
      mockPrisma.customers.findMany
        .mockResolvedValueOnce([] as any)

      await expect(service.create(baseInput)).rejects.toThrow(
        'No valid recipients found for the selected targeting'
      )
    })

    it('should throw error if workspace does not have WhatsApp enabled', async () => {
      // SCENARIO: Admin attempts to create campaign for workspace without WhatsApp
      // RULE: Push campaigns require WhatsApp enabled

      const noWhatsAppWorkspace = {
        id: 'workspace-1',
        enableWhatsapp: false,
        ownerId: 'owner-1',
      }

      mockPrisma.workspace.findUnique.mockResolvedValue(noWhatsAppWorkspace)

      await expect(service.create(baseInput)).rejects.toThrow(
        'Push campaigns are available only for WhatsApp-enabled workspaces'
      )
    })

    it('should sanitize phone numbers (remove spaces)', async () => {
      // SCENARIO: Customer phone numbers contain spaces
      // RULE: Phone numbers must be sanitized (spaces removed) before saving

      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace)
      mockPrisma.user.findUnique.mockResolvedValue(mockOwner)

      mockPrisma.customers.findMany
        .mockResolvedValueOnce([{ id: 'customer-1' }] as any)
        .mockResolvedValueOnce([
          {
            id: 'customer-1',
            phone: '+39 333 123 4567', // Phone with spaces
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          },
        ] as any)

      mockRepo.createCampaign.mockResolvedValue({
        id: 'campaign-1',
        expectedRecipients: 1,
      } as any)

      await service.create(baseInput)

      // Verify phone is sanitized (no spaces)
      expect(mockRepo.createCampaign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.arrayContaining([
          expect.objectContaining({
            phone: '+393331234567', // Spaces removed
          }),
        ])
      )
    })

    it('should use hardcoded defaults for cost and throttle', async () => {
      // SCENARIO: Campaign created without explicit cost/throttle settings
      // RULE: Must use hardcoded default values (1.0, 10, 50)

      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace)
      mockPrisma.user.findUnique.mockResolvedValue(mockOwner)

      mockPrisma.customers.findMany
        .mockResolvedValueOnce([{ id: 'customer-1' }] as any)
        .mockResolvedValueOnce([
          {
            id: 'customer-1',
            phone: '+393331234567',
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          },
        ] as any)

      mockRepo.createCampaign.mockResolvedValue({
        id: 'campaign-1',
      } as any)

      await service.create(baseInput)

      // Verify hardcoded defaults were used
      const call = (mockRepo.createCampaign as jest.Mock).mock.calls[0][0]

      // costPerMessage is converted to Decimal, so it may be string or number
      expect(Number(call.costPerMessage)).toBe(1.0) // Hardcoded default
      expect(call.throttlePerSecond).toBe(10) // Hardcoded default
      expect(call.batchSize).toBe(50) // Hardcoded default
    })

    it('should override defaults with explicit input values', async () => {
      // SCENARIO: Admin provides explicit cost/throttle settings
      // RULE: Explicit values should override platform defaults

      const customInput = {
        ...baseInput,
        throttlePerSecond: 5,
        batchSize: 25,
      }

      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace)
      mockPrisma.user.findUnique.mockResolvedValue(mockOwner)

      mockPrisma.customers.findMany
        .mockResolvedValueOnce([{ id: 'customer-1' }] as any)
        .mockResolvedValueOnce([
          {
            id: 'customer-1',
            phone: '+393331234567',
            isBlacklisted: false,
            activeChatbot: true,
            push_notifications_consent: true,
            push_notifications_consent_at: new Date(),
          },
        ] as any)

      mockRepo.createCampaign.mockResolvedValue({
        id: 'campaign-1',
      } as any)

      await service.create(customInput)

      // Verify custom values were used
      expect(mockRepo.createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          throttlePerSecond: 5,
          batchSize: 25,
        }),
        expect.any(Array)
      )
    })
  })

  describe('update', () => {
    // Spy on buildRecipients for update tests only
    beforeEach(() => {
      buildRecipientsSpy = jest
        .spyOn<any, any>(service as any, 'buildRecipients')
        .mockResolvedValue({
          recipients: [
            {
              workspaceId: 'workspace-1',
              customerId: 'c1',
              phone: '+1',
              status: PushCampaignRecipientStatus.PENDING,
            },
            {
              workspaceId: 'workspace-1',
              customerId: 'c2',
              phone: '+2',
              status: PushCampaignRecipientStatus.PENDING,
            },
          ],
          targetCustomerIds: ['c1', 'c2'],
        })
    })

    afterEach(() => {
      buildRecipientsSpy.mockRestore()
    })

    const existingCampaign = {
      id: 'camp-1',
      workspaceId: 'workspace-1',
      targetingType: CampaignTargetType.MANUAL,
      targetCustomerIds: ['c1'],
      expectedRecipients: 1,
    }

    const existingAllCampaign = {
      id: 'camp-2',
      workspaceId: 'workspace-1',
      targetingType: CampaignTargetType.ALL,
      targetCustomerIds: [],
      expectedRecipients: 3,
    }

    const existingTagCampaign = {
      id: 'camp-3',
      workspaceId: 'workspace-1',
      targetingType: CampaignTargetType.TAGS,
      tagId: 'tag-old',
      targetCustomerIds: [],
      expectedRecipients: 5,
    }

    it('rebuilds recipients when manual list changes (count or ids)', async () => {
      mockRepo.findById.mockResolvedValue(existingCampaign as any)
      mockRepo.replaceRecipients.mockResolvedValue({ id: 'camp-1' } as any)

      await service.update('workspace-1', 'camp-1', {
        targetingType: CampaignTargetType.MANUAL,
        targetCustomerIds: ['c1', 'c2'], // changed list/length
      })

      expect(buildRecipientsSpy).toHaveBeenCalledWith(
        'workspace-1',
        CampaignTargetType.MANUAL,
        ['c1', 'c2'],
        null
      )
      expect(mockRepo.replaceRecipients).toHaveBeenCalledWith(
        'camp-1',
        'workspace-1',
        expect.objectContaining({
          targetCustomerIds: ['c1', 'c2'],
          expectedRecipients: 2,
        }),
        expect.arrayContaining([
          expect.objectContaining({ customerId: 'c1' }),
          expect.objectContaining({ customerId: 'c2' }),
        ])
      )
      expect(mockRepo.updateCampaign).not.toHaveBeenCalled()
    })

    it('keeps simple update when manual list unchanged', async () => {
      mockRepo.findById.mockResolvedValue(existingCampaign as any)
      mockRepo.updateCampaign.mockResolvedValue({ id: 'camp-1' } as any)

      await service.update('workspace-1', 'camp-1', {
        name: 'New name',
      })

      expect(mockRepo.updateCampaign).toHaveBeenCalledWith(
        'camp-1',
        'workspace-1',
        expect.objectContaining({ name: 'New name' })
      )
      expect(mockRepo.replaceRecipients).not.toHaveBeenCalled()
    })

    it('forces rebuild when targeting ALL (refresh snapshot)', async () => {
      mockRepo.findById.mockResolvedValue(existingAllCampaign as any)
      mockRepo.replaceRecipients.mockResolvedValue({ id: 'camp-2' } as any)

      await service.update('workspace-1', 'camp-2', {
        targetingType: CampaignTargetType.ALL, // even unchanged, ALL triggers snapshot refresh
      })

      expect(buildRecipientsSpy).toHaveBeenCalledWith(
        'workspace-1',
        CampaignTargetType.ALL,
        [],
        null
      )
      expect(mockRepo.replaceRecipients).toHaveBeenCalledWith(
        'camp-2',
        'workspace-1',
        expect.objectContaining({
          expectedRecipients: 2, // from mocked buildRecipientsSpy result length
          targetCustomerIds: ['c1', 'c2'],
        }),
        expect.any(Array)
      )
      expect(mockRepo.updateCampaign).not.toHaveBeenCalled()
    })

    it('rebuilds recipients when tag changes in TAGS targeting', async () => {
      mockRepo.findById.mockResolvedValue(existingTagCampaign as any)
      mockRepo.replaceRecipients.mockResolvedValue({ id: 'camp-3' } as any)

      await service.update('workspace-1', 'camp-3', {
        targetingType: CampaignTargetType.TAGS,
        tagId: 'tag-new',
      })

      expect(buildRecipientsSpy).toHaveBeenCalledWith(
        'workspace-1',
        CampaignTargetType.TAGS,
        [],
        'tag-new'
      )
      expect(mockRepo.replaceRecipients).toHaveBeenCalledWith(
        'camp-3',
        'workspace-1',
        expect.objectContaining({
          tagId: 'tag-new',
          expectedRecipients: 2,
          targetCustomerIds: ['c1', 'c2'],
        }),
        expect.any(Array)
      )
      expect(mockRepo.updateCampaign).not.toHaveBeenCalled()
    })
  })

  describe('update', () => {
    it('should update campaign successfully', async () => {
      // SCENARIO: Admin updates campaign name and message
      // RULE: Must enforce workspace isolation

      const mockUpdated = {
        id: 'campaign-1',
        workspaceId: 'workspace-1',
        name: 'Updated Campaign',
        message: 'Updated message',
      }

      mockRepo.findById.mockResolvedValue(mockUpdated as any)
      mockRepo.updateCampaign.mockResolvedValue(mockUpdated as any)

      const result = await service.update('workspace-1', 'campaign-1', {
        name: 'Updated Campaign',
        message: 'Updated message',
      })

      expect(result).toEqual(mockUpdated)
      expect(mockRepo.updateCampaign).toHaveBeenCalledWith(
        'campaign-1',
        'workspace-1',
        {
          name: 'Updated Campaign',
          message: 'Updated message',
        }
      )
    })

    it('should recalculate nextRunAt when updating frequency and sendAt', async () => {
      // SCENARIO: Admin changes campaign frequency from ONCE to MONTHLY
      // RULE: nextRunAt must be recalculated when frequency changes

      const sendAt = new Date('2024-01-01T10:00:00Z')
      const expectedNextRun = new Date('2024-02-01T10:00:00Z') // 1 month later

      mockRepo.findById.mockResolvedValue({
        id: 'campaign-1',
        workspaceId: 'workspace-1',
      } as any)
      mockRepo.updateCampaign.mockResolvedValue({
        id: 'campaign-1',
        frequency: CampaignFrequency.MONTHLY,
        sendAt,
        nextRunAt: expectedNextRun,
      } as any)

      await service.update('workspace-1', 'campaign-1', {
        frequency: CampaignFrequency.MONTHLY,
        sendAt,
      })

      // Verify nextRunAt was calculated and included in update
      expect(mockRepo.updateCampaign).toHaveBeenCalledWith(
        'campaign-1',
        'workspace-1',
        expect.objectContaining({
          frequency: CampaignFrequency.MONTHLY,
          sendAt,
          nextRunAt: expectedNextRun,
        })
      )
    })
  })

  describe('delete', () => {
    it('should delete campaign successfully', async () => {
      // SCENARIO: Admin deletes campaign
      // RULE: Must enforce workspace isolation

      const mockDeleted = {
        id: 'campaign-1',
        workspaceId: 'workspace-1',
      }

      mockRepo.deleteCampaign.mockResolvedValue(mockDeleted as any)

      const result = await service.delete('workspace-1', 'campaign-1')

      expect(result).toEqual(mockDeleted)
      expect(mockRepo.deleteCampaign).toHaveBeenCalledWith('campaign-1', 'workspace-1')
    })
  })

  describe('list', () => {
    it('should list campaigns for workspace', async () => {
      // SCENARIO: Admin views all campaigns for workspace
      // RULE: Must filter by workspaceId

      const mockCampaigns = [
        {
          id: 'campaign-1',
          workspaceId: 'workspace-1',
          name: 'Campaign 1',
          status: PushCampaignStatus.SCHEDULED,
        },
        {
          id: 'campaign-2',
          workspaceId: 'workspace-1',
          name: 'Campaign 2',
          status: PushCampaignStatus.COMPLETED,
        },
      ]

      mockRepo.listByWorkspace.mockResolvedValue(mockCampaigns as any)
      // groupBy returns empty (no recipients)
      mockPrisma.pushCampaignRecipient.groupBy.mockResolvedValue([])

      const result = await service.list('workspace-1')

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'campaign-1',
            workspaceId: 'workspace-1',
            name: 'Campaign 1',
            status: PushCampaignStatus.SCHEDULED,
            recipientsTotal: 0,
            recipientsPending: 0,
            actualSent: 0,
            actualFailed: 0,
            actualSkipped: 0,
          }),
          expect.objectContaining({
            id: 'campaign-2',
            workspaceId: 'workspace-1',
            name: 'Campaign 2',
            status: PushCampaignStatus.COMPLETED,
          }),
        ])
      )
      expect(mockRepo.listByWorkspace).toHaveBeenCalledWith('workspace-1')
    })

    it('should return empty array if no campaigns exist', async () => {
      // SCENARIO: Workspace has no campaigns
      // RULE: Return empty array, not null

      mockRepo.listByWorkspace.mockResolvedValue([])

      const result = await service.list('workspace-1')

      expect(result).toEqual([])
      expect(mockRepo.listByWorkspace).toHaveBeenCalledWith('workspace-1')
    })
  })

  describe('get', () => {
    it('should get single campaign by ID', async () => {
      // SCENARIO: Admin views campaign details
      // RULE: Must enforce workspace isolation

      const mockCampaign = {
        id: 'campaign-1',
        workspaceId: 'workspace-1',
        name: 'Test Campaign',
        status: PushCampaignStatus.SCHEDULED,
      }

      mockRepo.findById.mockResolvedValue(mockCampaign as any)

      const result = await service.get('workspace-1', 'campaign-1')

      expect(result).toEqual(mockCampaign)
      expect(mockRepo.findById).toHaveBeenCalledWith('campaign-1', 'workspace-1')
    })

    it('should return null if campaign not found', async () => {
      // SCENARIO: Campaign does not exist or belongs to different workspace
      // RULE: Return null, not throw error

      mockRepo.findById.mockResolvedValue(null)

      const result = await service.get('workspace-1', 'nonexistent')

      expect(result).toBeNull()
      expect(mockRepo.findById).toHaveBeenCalledWith('nonexistent', 'workspace-1')
    })
  })

  describe('updateStatus', () => {
    it('should update campaign status successfully', async () => {
      // SCENARIO: Scheduler marks campaign as IN_PROGRESS
      // RULE: Must return true if update succeeds

      mockRepo.updateStatus.mockResolvedValue({ count: 1 } as any)

      const result = await service.updateStatus(
        'workspace-1',
        'campaign-1',
        PushCampaignStatus.IN_PROGRESS
      )

      expect(result).toBe(true)
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(
        'campaign-1',
        'workspace-1',
        PushCampaignStatus.IN_PROGRESS,
        undefined
      )
    })

    it('should return false if no campaign updated', async () => {
      // SCENARIO: Campaign not found or already updated
      // RULE: Return false if count is 0

      mockRepo.updateStatus.mockResolvedValue({ count: 0 } as any)

      const result = await service.updateStatus(
        'workspace-1',
        'nonexistent',
        PushCampaignStatus.IN_PROGRESS
      )

      expect(result).toBe(false)
    })
  })

  describe('listRecipients', () => {
    it('should list recipients with pagination', async () => {
      // SCENARIO: Admin views campaign recipients page by page
      // RULE: Support skip/take pagination

      const mockRecipients = [
        {
          id: 'recipient-1',
          campaignId: 'campaign-1',
          workspaceId: 'workspace-1',
          customerId: 'customer-1',
          phone: '+393331234567',
          status: PushCampaignRecipientStatus.PENDING,
        },
        {
          id: 'recipient-2',
          campaignId: 'campaign-1',
          workspaceId: 'workspace-1',
          customerId: 'customer-2',
          phone: '+393337654321',
          status: PushCampaignRecipientStatus.SENT,
        },
      ]

      mockRepo.listRecipients.mockResolvedValue(mockRecipients as any)

      const result = await service.listRecipients('workspace-1', 'campaign-1', 0, 50)

      expect(result).toEqual(mockRecipients)
      expect(mockRepo.listRecipients).toHaveBeenCalledWith(
        'campaign-1',
        'workspace-1',
        0,
        50,
        undefined
      )
    })

    it('should filter recipients by status', async () => {
      // SCENARIO: Admin views only FAILED recipients
      // RULE: Support status filtering

      const mockFailedRecipients = [
        {
          id: 'recipient-3',
          campaignId: 'campaign-1',
          workspaceId: 'workspace-1',
          customerId: 'customer-3',
          phone: '+393339999999',
          status: PushCampaignRecipientStatus.FAILED,
          errorMessage: 'Invalid phone number',
        },
      ]

      mockRepo.listRecipients.mockResolvedValue(mockFailedRecipients as any)

      const result = await service.listRecipients(
        'workspace-1',
        'campaign-1',
        0,
        50,
        PushCampaignRecipientStatus.FAILED
      )

      expect(result).toEqual(mockFailedRecipients)
      expect(mockRepo.listRecipients).toHaveBeenCalledWith(
        'campaign-1',
        'workspace-1',
        0,
        50,
        PushCampaignRecipientStatus.FAILED
      )
    })
  })

  describe('calculateNextRunAt', () => {
    it('should calculate next run for WEEKLY frequency', async () => {
      // SCENARIO: Recurring campaign runs weekly
      // RULE: Add 7 days to lastRun

      const lastRun = new Date('2024-01-01T10:00:00Z')
      const nextRun = (service as any).calculateNextRunAt(CampaignFrequency.WEEKLY, lastRun)

      expect(nextRun).toEqual(new Date('2024-01-08T10:00:00Z'))
    })

    it('should calculate next run for MONTHLY frequency', async () => {
      // SCENARIO: Recurring campaign runs monthly
      // RULE: Add 1 month to lastRun

      const lastRun = new Date('2024-01-15T10:00:00Z')
      const nextRun = (service as any).calculateNextRunAt(CampaignFrequency.MONTHLY, lastRun)

      expect(nextRun).toEqual(new Date('2024-02-15T10:00:00Z'))
    })

    it('should calculate next run for QUARTERLY frequency', async () => {
      // SCENARIO: Recurring campaign runs quarterly
      // RULE: Add 3 months to lastRun

      const lastRun = new Date('2024-01-15T10:00:00Z')
      const nextRun = (service as any).calculateNextRunAt(CampaignFrequency.QUARTERLY, lastRun)

      // Verify month and day are correct (hours may shift due to DST)
      expect(nextRun?.getUTCMonth()).toBe(3) // April (0-indexed)
      expect(nextRun?.getUTCDate()).toBe(15)
    })

    it('should calculate next run for SEMIANNUAL frequency', async () => {
      // SCENARIO: Recurring campaign runs every 6 months
      // RULE: Add 6 months to lastRun

      const lastRun = new Date('2024-01-15T10:00:00Z')
      const nextRun = (service as any).calculateNextRunAt(CampaignFrequency.SEMIANNUAL, lastRun)

      // Verify month and day are correct (hours may shift due to DST)
      expect(nextRun?.getUTCMonth()).toBe(6) // July (0-indexed)
      expect(nextRun?.getUTCDate()).toBe(15)
    })

    it('should return null for ONCE frequency', async () => {
      // SCENARIO: One-time campaign
      // RULE: No next run for one-time campaigns

      const lastRun = new Date('2024-01-01T10:00:00Z')
      const nextRun = (service as any).calculateNextRunAt(CampaignFrequency.ONCE, lastRun)

      expect(nextRun).toBeNull()
    })
  })

  describe('sanitizePhone', () => {
    it('should remove spaces from phone numbers', async () => {
      // SCENARIO: Phone number contains spaces
      // RULE: Remove all whitespace characters

      const sanitized = (service as any).sanitizePhone('+39 333 123 4567')
      expect(sanitized).toBe('+393331234567')
    })

    it('should handle phone without spaces', async () => {
      // SCENARIO: Phone already clean
      // RULE: Return unchanged

      const sanitized = (service as any).sanitizePhone('+393331234567')
      expect(sanitized).toBe('+393331234567')
    })

    it('should remove multiple consecutive spaces', async () => {
      // SCENARIO: Phone has multiple spaces
      // RULE: Remove all spaces

      const sanitized = (service as any).sanitizePhone('+39  333   123  4567')
      expect(sanitized).toBe('+393331234567')
    })
  })
})
