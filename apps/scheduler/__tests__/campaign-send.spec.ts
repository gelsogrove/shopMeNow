/**
 * Campaign Send Job - Unit Tests
 * 
 * Tests for the campaign-send scheduler job:
 * - Frequency calculation (daily, weekly, monthly, etc.)
 * - Customer targeting (ALL vs SELECTED)
 * - Message translation
 * - WhatsApp queue integration
 */

// === MOCKS MUST BE DECLARED BEFORE ANY IMPORTS ===

// Mock logger FIRST
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}
jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: mockLogger,
}))

// Mock translation service
const mockTranslateMessage = jest.fn()
jest.mock('../src/services/translation.service', () => ({
  translationService: {
    translateMessage: mockTranslateMessage,
  },
}))

const mockHasOwnerCredit = jest.fn()
jest.mock('../src/services/billing.service', () => ({
  BillingService: jest.fn().mockImplementation(() => ({
    hasOwnerCredit: mockHasOwnerCredit,
  })),
}))

// Mock prisma
const mockCampaignFindMany = jest.fn()
const mockCampaignUpdate = jest.fn()
const mockCustomersFindMany = jest.fn()
const mockCampaignSentFindFirst = jest.fn()
const mockCampaignSentCreate = jest.fn()
const mockWhatsAppQueueCreate = jest.fn()

jest.mock('../src/config/database', () => ({
  prisma: {
    campaign: {
      findMany: mockCampaignFindMany,
      update: mockCampaignUpdate,
    },
    customers: {
      findMany: mockCustomersFindMany,
    },
    campaignSent: {
      findFirst: mockCampaignSentFindFirst,
      create: mockCampaignSentCreate,
    },
    whatsAppQueue: {
      create: mockWhatsAppQueueCreate,
    },
  },
}))

// === NOW IMPORT MODULES ===
import { campaignSendJob } from '../src/jobs/campaign-send.job'

describe('Campaign Send Job', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset default mock behaviors
    mockTranslateMessage.mockImplementation((msg: string) => Promise.resolve(msg))
    mockHasOwnerCredit.mockResolvedValue(true)
  })

  describe('Campaign Discovery', () => {
    it('should find all active campaigns', async () => {
      mockCampaignFindMany.mockResolvedValue([])

      await campaignSendJob()

      expect(mockCampaignFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: expect.objectContaining({
          workspace: expect.any(Object),
        }),
      })
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Found 0 active campaigns'))
    })

    it('should skip campaigns for workspaces in debug mode', async () => {
      mockCampaignFindMany.mockResolvedValue([
        {
          id: 'camp-1',
          name: 'Test Campaign',
          workspace: {
            id: 'ws-1',
            name: 'Debug Workspace',
            debugMode: true, // Debug mode - skip campaigns
          },
        },
      ])

      await campaignSendJob()

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Skipping campaign Test Campaign - workspace in debug mode')
      )
    })
  
    it('should deactivate campaign when credit/subscription is insufficient', async () => {
      mockHasOwnerCredit.mockResolvedValue(false)
      mockCampaignFindMany.mockResolvedValue([
        {
          id: 'camp-1',
          name: 'Test Campaign',
          workspaceId: 'ws-1',
          messagePreview: 'Hello {{nome}}!',
          frequency: 'WEEKLY',
          lastRunAt: null,
          workspace: { id: 'ws-1', name: 'Test', debugMode: false },
        },
      ])

      await campaignSendJob()

      expect(mockCampaignUpdate).toHaveBeenCalledWith({
        where: { id: 'camp-1' },
        data: { isActive: false },
      })
      expect(mockCustomersFindMany).not.toHaveBeenCalled()
    })
  })

  describe('Frequency Logic', () => {
    it('should run campaign if never run before (lastRunAt is null)', async () => {
      mockCampaignFindMany.mockResolvedValue([
        {
          id: 'camp-1',
          name: 'New Campaign',
          workspaceId: 'ws-1',
          targetType: 'ALL',
          messagePreview: 'Ciao {{nome}}!',
          frequency: 'MONTHLY',
          lastRunAt: null, // Never run
          workspace: { id: 'ws-1', name: 'Test', debugMode: false },
        },
      ])

      mockCustomersFindMany.mockResolvedValue([
        { id: 'cust-1', name: 'Mario', phone: '+39123456789', language: 'IT' },
      ])
      mockCampaignSentFindFirst.mockResolvedValue(null)
      mockWhatsAppQueueCreate.mockResolvedValue({})
      mockCampaignSentCreate.mockResolvedValue({})
      mockCampaignUpdate.mockResolvedValue({})

      await campaignSendJob()

      expect(mockWhatsAppQueueCreate).toHaveBeenCalled()
      expect(mockCampaignUpdate).toHaveBeenCalledWith({
        where: { id: 'camp-1' },
        data: { lastRunAt: expect.any(Date) },
      })
    })

    it('should skip WEEKLY campaign if run less than 7 days ago', async () => {
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

      mockCampaignFindMany.mockResolvedValue([
        {
          id: 'camp-1',
          name: 'Weekly Campaign',
          frequency: 'WEEKLY',
          lastRunAt: threeDaysAgo, // Only 3 days ago
          workspace: { id: 'ws-1', debugMode: false },
        },
      ])

      await campaignSendJob()

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Skipping campaign Weekly Campaign - not time yet')
      )
      expect(mockCustomersFindMany).not.toHaveBeenCalled()
    })

    it('should run WEEKLY campaign after 7 days', async () => {
      const tenDaysAgo = new Date()
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)

      mockCampaignFindMany.mockResolvedValue([
        {
          id: 'camp-1',
          name: 'Weekly Campaign',
          workspaceId: 'ws-1',
          targetType: 'ALL',
          messagePreview: 'Weekly update!',
          frequency: 'WEEKLY',
          lastRunAt: tenDaysAgo,
          workspace: { id: 'ws-1', debugMode: false },
        },
      ])
      mockCustomersFindMany.mockResolvedValue([])

      await campaignSendJob()

      expect(mockCustomersFindMany).toHaveBeenCalled()
    })

    it('should respect QUARTERLY frequency (90 days)', async () => {
      const fiftyDaysAgo = new Date()
      fiftyDaysAgo.setDate(fiftyDaysAgo.getDate() - 50)

      mockCampaignFindMany.mockResolvedValue([
        {
          id: 'camp-1',
          name: 'Quarterly Campaign',
          frequency: 'QUARTERLY',
          lastRunAt: fiftyDaysAgo, // Only 50 days ago
          workspace: { id: 'ws-1', debugMode: false },
        },
      ])

      await campaignSendJob()

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('not time yet'))
    })

    it('should handle ONCE frequency correctly (999999 days)', async () => {
      mockCampaignFindMany.mockResolvedValue([
        {
          id: 'camp-1',
          name: 'One-time Campaign',
          frequency: 'ONCE',
          lastRunAt: new Date(), // Just ran
          workspace: { id: 'ws-1', debugMode: false },
        },
      ])

      await campaignSendJob()

      // ONCE campaigns should not run again after first run
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('not time yet'))
    })
  })

  describe('Customer Targeting', () => {
    const baseCampaign = {
      id: 'camp-1',
      name: 'Test Campaign',
      workspaceId: 'ws-1',
      messagePreview: 'Hello {{nome}}!',
      frequency: 'WEEKLY',
      lastRunAt: null,
      workspace: { id: 'ws-1', debugMode: false },
    }

    it('should get ALL eligible customers for targetType=ALL', async () => {
      mockCampaignFindMany.mockResolvedValue([{ ...baseCampaign, targetType: 'ALL' }])
      mockCustomersFindMany.mockResolvedValue([])

      await campaignSendJob()

      expect(mockCustomersFindMany).toHaveBeenCalledWith({
        where: {
          workspaceId: 'ws-1',
          isActive: true,
          isBlacklisted: false,
          push_notifications_consent: true,
          last_privacy_version_accepted: { not: null },
        },
        select: expect.objectContaining({
          id: true,
          name: true,
          phone: true,
          language: true,
        }),
      })
    })

    it('should filter by customerIds for targetType=SELECTED', async () => {
      mockCampaignFindMany.mockResolvedValue([
        { ...baseCampaign, targetType: 'SELECTED', customerIds: ['cust-1', 'cust-2'] },
      ])
      mockCustomersFindMany.mockResolvedValue([])

      await campaignSendJob()

      expect(mockCustomersFindMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: { in: ['cust-1', 'cust-2'] },
        }),
        select: expect.any(Object),
      })
    })

    it('should skip blacklisted customers', async () => {
      mockCampaignFindMany.mockResolvedValue([{ ...baseCampaign, targetType: 'ALL' }])
      mockCustomersFindMany.mockResolvedValue([])

      await campaignSendJob()

      // Verify isBlacklisted: false is in the query
      const findManyCall = mockCustomersFindMany.mock.calls[0][0]
      expect(findManyCall.where.isBlacklisted).toBe(false)
    })
  })

  describe('Message Translation', () => {
    const baseCampaign = {
      id: 'camp-1',
      name: 'Test Campaign',
      workspaceId: 'ws-1',
      messagePreview: 'Ciao {{nome}}! Scopri le novità.',
      frequency: 'WEEKLY',
      lastRunAt: null,
      targetType: 'ALL',
      workspace: { id: 'ws-1', debugMode: false },
    }

    it('should replace {{nome}} with customer name', async () => {
      mockCampaignFindMany.mockResolvedValue([baseCampaign])
      mockCustomersFindMany.mockResolvedValue([
        { id: 'cust-1', name: 'Mario Rossi', phone: '+39123', language: 'IT' },
      ])
      mockCampaignSentFindFirst.mockResolvedValue(null)
      mockWhatsAppQueueCreate.mockResolvedValue({})
      mockCampaignSentCreate.mockResolvedValue({})
      mockCampaignUpdate.mockResolvedValue({})

      await campaignSendJob()

      expect(mockTranslateMessage).toHaveBeenCalledWith(
        'Ciao Mario Rossi! Scopri le novità.',
        'IT'
      )
    })

    it('should translate message to customer language (EN)', async () => {
      mockTranslateMessage.mockResolvedValue('Hello John Doe! Discover the news.')

      mockCampaignFindMany.mockResolvedValue([baseCampaign])
      mockCustomersFindMany.mockResolvedValue([
        { id: 'cust-1', name: 'John Doe', phone: '+1234', language: 'EN' },
      ])
      mockCampaignSentFindFirst.mockResolvedValue(null)
      mockWhatsAppQueueCreate.mockResolvedValue({})
      mockCampaignSentCreate.mockResolvedValue({})
      mockCampaignUpdate.mockResolvedValue({})

      await campaignSendJob()

      expect(mockTranslateMessage).toHaveBeenCalledWith(expect.stringContaining('John Doe'), 'EN')
      expect(mockWhatsAppQueueCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          messageContent: 'Hello John Doe! Discover the news.',
        }),
      })
    })

    it('should use "Cliente" when customer name is null', async () => {
      mockCampaignFindMany.mockResolvedValue([baseCampaign])
      mockCustomersFindMany.mockResolvedValue([
        { id: 'cust-1', name: null, phone: '+39123', language: 'IT' },
      ])
      mockCampaignSentFindFirst.mockResolvedValue(null)
      mockWhatsAppQueueCreate.mockResolvedValue({})
      mockCampaignSentCreate.mockResolvedValue({})
      mockCampaignUpdate.mockResolvedValue({})

      await campaignSendJob()

      expect(mockTranslateMessage).toHaveBeenCalledWith(
        'Ciao Cliente! Scopri le novità.',
        'IT'
      )
    })
  })

  describe('Duplicate Prevention', () => {
    const baseCampaign = {
      id: 'camp-1',
      name: 'Test Campaign',
      workspaceId: 'ws-1',
      messagePreview: 'Hello!',
      frequency: 'WEEKLY',
      lastRunAt: null,
      targetType: 'ALL',
      workspace: { id: 'ws-1', debugMode: false },
    }

    it('should skip customer if already sent today', async () => {
      mockCampaignFindMany.mockResolvedValue([baseCampaign])
      mockCustomersFindMany.mockResolvedValue([
        { id: 'cust-1', name: 'Mario', phone: '+39123', language: 'IT' },
      ])
      mockCampaignSentFindFirst.mockResolvedValue({
        id: 'sent-1',
        campaignId: 'camp-1',
        customerId: 'cust-1',
        sentAt: new Date(),
      }) // Already sent today
      mockCampaignUpdate.mockResolvedValue({})

      await campaignSendJob()

      // Should NOT queue another message
      expect(mockWhatsAppQueueCreate).not.toHaveBeenCalled()
    })

    it('should queue message if not sent today', async () => {
      mockCampaignFindMany.mockResolvedValue([baseCampaign])
      mockCustomersFindMany.mockResolvedValue([
        { id: 'cust-1', name: 'Mario', phone: '+39123', language: 'IT' },
      ])
      mockCampaignSentFindFirst.mockResolvedValue(null) // Not sent yet
      mockWhatsAppQueueCreate.mockResolvedValue({})
      mockCampaignSentCreate.mockResolvedValue({})
      mockCampaignUpdate.mockResolvedValue({})

      await campaignSendJob()

      expect(mockWhatsAppQueueCreate).toHaveBeenCalled()
      expect(mockCampaignSentCreate).toHaveBeenCalledWith({
        data: {
          campaignId: 'camp-1',
          customerId: 'cust-1',
          workspaceId: 'ws-1',
        },
      })
    })
  })

  describe('WhatsApp Queue Integration', () => {
    it('should create WhatsApp queue entry with correct data', async () => {
      mockCampaignFindMany.mockResolvedValue([
        {
          id: 'camp-1',
          name: 'Test Campaign',
          workspaceId: 'ws-1',
          messagePreview: 'Promo speciale!',
          frequency: 'WEEKLY',
          lastRunAt: null,
          targetType: 'ALL',
          workspace: { id: 'ws-1', debugMode: false },
        },
      ])
      mockCustomersFindMany.mockResolvedValue([
        { id: 'cust-1', name: 'Mario', phone: '+39123456789', language: 'IT' },
      ])
      mockCampaignSentFindFirst.mockResolvedValue(null)
      mockWhatsAppQueueCreate.mockResolvedValue({})
      mockCampaignSentCreate.mockResolvedValue({})
      mockCampaignUpdate.mockResolvedValue({})

      await campaignSendJob()

      expect(mockWhatsAppQueueCreate).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws-1',
          customerId: 'cust-1',
          phoneNumber: '+39123456789',
          messageContent: 'Promo speciale!',
          status: 'pending',
        },
      })
    })
  })

  describe('Error Handling', () => {
    it('should continue processing other campaigns if one fails', async () => {
      mockCampaignFindMany.mockResolvedValue([
        {
          id: 'camp-fail',
          name: 'Failing Campaign',
          workspaceId: 'ws-1',
          messagePreview: 'Fail',
          frequency: 'WEEKLY',
          lastRunAt: null,
          targetType: 'ALL',
          workspace: { id: 'ws-1', debugMode: false },
        },
        {
          id: 'camp-success',
          name: 'Success Campaign',
          workspaceId: 'ws-2',
          messagePreview: 'Success',
          frequency: 'WEEKLY',
          lastRunAt: null,
          targetType: 'ALL',
          workspace: { id: 'ws-2', debugMode: false },
        },
      ])

      // First campaign fails
      mockCustomersFindMany
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce([{ id: 'cust-1', name: 'Test', phone: '+123', language: 'IT' }])

      mockCampaignSentFindFirst.mockResolvedValue(null)
      mockWhatsAppQueueCreate.mockResolvedValue({})
      mockCampaignSentCreate.mockResolvedValue({})
      mockCampaignUpdate.mockResolvedValue({})

      await campaignSendJob()

      // Should log error for first campaign
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing campaign camp-fail'),
        expect.any(Error)
      )

      // Should still process second campaign
      expect(mockWhatsAppQueueCreate).toHaveBeenCalled()
    })

    it('should continue with other customers if one message queue fails', async () => {
      mockCampaignFindMany.mockResolvedValue([
        {
          id: 'camp-1',
          name: 'Test Campaign',
          workspaceId: 'ws-1',
          messagePreview: 'Hello!',
          frequency: 'WEEKLY',
          lastRunAt: null,
          targetType: 'ALL',
          workspace: { id: 'ws-1', debugMode: false },
        },
      ])
      mockCustomersFindMany.mockResolvedValue([
        { id: 'cust-fail', name: 'Fail', phone: '+111', language: 'IT' },
        { id: 'cust-success', name: 'Success', phone: '+222', language: 'IT' },
      ])
      mockCampaignSentFindFirst.mockResolvedValue(null)

      // First customer fails, second succeeds
      mockWhatsAppQueueCreate
        .mockRejectedValueOnce(new Error('Queue error'))
        .mockResolvedValueOnce({})

      mockCampaignSentCreate.mockResolvedValue({})
      mockCampaignUpdate.mockResolvedValue({})

      await campaignSendJob()

      // Should log error for first customer
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error queueing message for customer cust-fail'),
        expect.any(Error)
      )

      // Should update lastRunAt (campaign still processed)
      expect(mockCampaignUpdate).toHaveBeenCalled()
    })
  })
})
