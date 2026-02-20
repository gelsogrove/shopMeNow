/**
 * Push Campaigns Scheduler Job - Unit Tests
 *
 * SCENARIOS TESTED:
 * 1. Campaign discovery (sendAt/nextRunAt scheduling)
 * 2. Workspace validation (WhatsApp enabled, owner exists)
 * 3. Credit system (owner-level balance checks, exhaustion pauses)
 * 4. Variable replacement ({{name}}, {{firstName}}, etc.)
 * 5. Translation to customer language
 * 6. Recipient filtering (blacklisted, inactive, no phone)
 * 7. Recurring campaigns (nextRunAt calculation)
 * 8. Campaign completion (SCHEDULED → RUNNING → COMPLETED/SCHEDULED)
 * 9. Batch processing with throttling
 * 10. Transaction safety (queue + recipient update)
 */

// Mock logger FIRST
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: mockLogger,
}))

// Mock translation service
const mockTranslationService = {
  translateMessage: jest.fn(),
}
jest.mock('../../../src/services/translation.service', () => ({
  translationService: mockTranslationService,
}))

// Mock prisma with full transaction support
const mockPrisma = {
  pushCampaign: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
  },
  pushCampaignRecipient: {
    count: jest.fn(),
    findMany: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  customers: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  whatsAppQueue: {
    create: jest.fn(),
    upsert: jest.fn(),
  },
  conversationMessage: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
}

jest.mock('../../../src/config/database', () => ({
  prisma: mockPrisma,
  Prisma: {
    Decimal: class Decimal {
      private value: number
      constructor(value: number | string) {
        this.value = typeof value === 'string' ? parseFloat(value) : value
      }
      lt(other: any): boolean {
        const otherVal = other instanceof Decimal ? other.value : other
        return this.value < otherVal
      }
      valueOf(): number {
        return this.value
      }
      toString(): string {
        return String(this.value)
      }
      toNumber(): number {
        return this.value
      }
    },
  },
  CampaignFrequency: {
    ONCE: 'ONCE',
    WEEKLY: 'WEEKLY',
    MONTHLY: 'MONTHLY',
    QUARTERLY: 'QUARTERLY',
    SEMIANNUAL: 'SEMIANNUAL',
  },
  CampaignTargetType: {
    ALL: 'ALL',
    MANUAL: 'MANUAL',
    TAGS: 'TAGS',
  },
  PushCampaignStatus: {
    DRAFT: 'DRAFT',
    SCHEDULED: 'SCHEDULED',
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
  },
  PushCampaignRecipientStatus: {
    PENDING: 'PENDING',
    SENT: 'SENT',
    FAILED: 'FAILED',
    SKIPPED: 'SKIPPED',
  },
}))

import { pushCampaignsJob, __test } from '../../../src/jobs/push-campaigns.job'
import { Prisma } from '../../../src/config/database'

describe('Push Campaigns Job', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset transaction mock to pass-through by default
    mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma))
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'owner-default',
      creditBalance: new Prisma.Decimal(100.0),
    })
    mockPrisma.conversationMessage.create.mockResolvedValue({
      id: 'conv-msg-1',
      conversationId: 'conv_customer1',
    })
    mockPrisma.conversationMessage.findFirst.mockResolvedValue(null)
    mockPrisma.whatsAppQueue.upsert.mockResolvedValue({ id: 'queue-1' })
  })

  describe('Campaign Discovery', () => {
    it('should find campaigns with sendAt <= now and lastRunAt null', async () => {
      // SCENARIO: First-time campaign scheduled for the past
      // RULE: Should pick up campaign when sendAt is reached and lastRunAt is null

      const now = new Date('2026-02-10T10:00:00Z')
      jest.useFakeTimers().setSystemTime(now)

      mockPrisma.pushCampaign.findMany.mockResolvedValue([])

      await pushCampaignsJob()

      expect(mockPrisma.pushCampaign.findMany).toHaveBeenCalledWith({
        where: {
          status: 'SCHEDULED',
          isActive: true,
          OR: [
            { sendAt: { lte: expect.any(Date) }, lastRunAt: null },
            { nextRunAt: { lte: expect.any(Date) } },
          ],
        },
        orderBy: { createdAt: 'asc' },
      })

      jest.useRealTimers()
    })

    it('should find campaigns with nextRunAt <= now (recurring)', async () => {
      // SCENARIO: Weekly recurring campaign with next run scheduled
      // RULE: Should pick up campaigns where nextRunAt has passed

      const now = new Date('2026-02-10T10:00:00Z')
      const nextRunAt = new Date('2026-02-10T09:00:00Z') // 1 hour ago
      jest.useFakeTimers().setSystemTime(now)

      const mockCampaign = {
        id: 'campaign-1',
        workspaceId: 'ws-1',
        status: 'SCHEDULED',
        isActive: true,
        frequency: 'WEEKLY',
        nextRunAt,
        batchSize: 50,
        throttlePerSecond: 10,
        costPerMessage: new Prisma.Decimal(1.0),
        message: 'Test message',
      }

      mockPrisma.pushCampaign.findMany.mockResolvedValue([mockCampaign])
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'owner-1',
        name: 'Test Workspace',
        enableWhatsapp: true,
      })
      mockPrisma.pushCampaignRecipient.count.mockResolvedValue(0)
      mockPrisma.pushCampaignRecipient.findMany.mockResolvedValue([])
      mockPrisma.pushCampaign.update.mockResolvedValue(mockCampaign)
      mockPrisma.customers.findMany.mockResolvedValue([])

      await pushCampaignsJob()

      expect(mockPrisma.pushCampaign.findMany).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 scheduled campaigns')
      )

      jest.useRealTimers()
    })

    it('should skip inactive campaigns (isActive=false)', async () => {
      // SCENARIO: Campaign with isActive=false
      // RULE: Only process campaigns where isActive=true

      const now = new Date('2026-02-10T10:00:00Z')
      jest.useFakeTimers().setSystemTime(now)

      mockPrisma.pushCampaign.findMany.mockResolvedValue([])

      await pushCampaignsJob()

      // Verify query includes isActive: true filter
      expect(mockPrisma.pushCampaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        })
      )

      jest.useRealTimers()
    })
  })

  describe('Workspace Validation', () => {
    it('should fail campaign if WhatsApp not enabled', async () => {
      // SCENARIO: Campaign for workspace with enableWhatsapp=false
      // RULE: Mark campaign as FAILED with appropriate error message

      const mockCampaign = {
        id: 'campaign-1',
        workspaceId: 'ws-1',
        status: 'SCHEDULED',
        isActive: true,
        frequency: 'ONCE',
        costPerMessage: new Prisma.Decimal(1.0),
      }

      mockPrisma.pushCampaign.findMany.mockResolvedValue([mockCampaign])
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'owner-1',
        name: 'Test Workspace',
        enableWhatsapp: false, // WhatsApp disabled
      })

      await pushCampaignsJob()

      expect(mockPrisma.pushCampaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
        data: {
          status: 'FAILED',
          lastError: 'WhatsApp not enabled for workspace',
        },
      })
    })

    it('should fail campaign if workspace owner not found', async () => {
      // SCENARIO: Workspace without ownerId
      // RULE: Cannot process campaign without owner for billing

      const mockCampaign = {
        id: 'campaign-2',
        workspaceId: 'ws-2',
        status: 'SCHEDULED',
        isActive: true,
        frequency: 'ONCE',
        costPerMessage: new Prisma.Decimal(1.0),
      }

      mockPrisma.pushCampaign.findMany.mockResolvedValue([mockCampaign])
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-2',
        ownerId: null, // No owner
        name: 'Orphan Workspace',
        enableWhatsapp: true,
      })

      await pushCampaignsJob()

      expect(mockPrisma.pushCampaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-2' },
        data: {
          status: 'FAILED',
          lastError: 'Workspace owner not found',
        },
      })
    })
  })

  describe('Credit System', () => {
    it('should check credit before each message', async () => {
      // SCENARIO: Owner has sufficient credit for campaign
      // RULE: Verify credit balance before processing each recipient

      const mockCampaign = {
        id: 'campaign-1',
        workspaceId: 'ws-1',
        status: 'SCHEDULED',
        isActive: true,
        frequency: 'ONCE',
        batchSize: 50,
        throttlePerSecond: 10,
        costPerMessage: new Prisma.Decimal(1.0),
        message: 'Hello {{name}}',
      }

      const mockRecipient = {
        id: 'recipient-1',
        campaignId: 'campaign-1',
        customerId: 'customer-1',
        phone: '+393331234567',
        status: 'PENDING',
        createdAt: new Date(),
      }

      const mockCustomer = {
        id: 'customer-1',
        name: 'Mario Rossi',
        email: 'mario@example.com',
        phone: '+393331234567',
        language: 'it',
        isBlacklisted: false,
        isActive: true,
      }

      mockPrisma.pushCampaign.findMany.mockResolvedValue([mockCampaign])
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'owner-1',
        name: 'Test Workspace',
        enableWhatsapp: true,
      })
      mockPrisma.pushCampaignRecipient.count
        .mockResolvedValueOnce(1) // Initial check: has pending
        .mockResolvedValueOnce(0) // After processing: none pending
      mockPrisma.pushCampaignRecipient.findMany.mockResolvedValue([mockRecipient])
      mockPrisma.customers.findFirst.mockResolvedValue(mockCustomer)
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        creditBalance: new Prisma.Decimal(100.0), // Sufficient credit
      })
      mockTranslationService.translateMessage.mockResolvedValue('Ciao Mario Rossi')
      mockPrisma.pushCampaign.update.mockResolvedValue(mockCampaign)

      // Mock transaction to execute callback
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrisma)
      })
      mockPrisma.whatsAppQueue.create.mockResolvedValue({
        id: 'queue-1',
        workspaceId: 'ws-1',
        customerId: 'customer-1',
        phoneNumber: '+393331234567',
        messageContent: 'Ciao Mario Rossi',
        status: 'pending',
      })

      await pushCampaignsJob()

      // Verify credit check happened
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'owner-1' },
        select: { creditBalance: true },
      })
    })

    it('should pause campaign when credit exhausted', async () => {
      // SCENARIO: Owner runs out of credit during campaign
      // RULE: Pause campaign with status PAUSED and error message

      const mockCampaign = {
        id: 'campaign-1',
        workspaceId: 'ws-1',
        status: 'SCHEDULED',
        isActive: true,
        frequency: 'WEEKLY',
        batchSize: 50,
        throttlePerSecond: 10,
        costPerMessage: new Prisma.Decimal(1.0),
        message: 'Test',
      }

      const mockRecipient = {
        id: 'recipient-1',
        campaignId: 'campaign-1',
        customerId: 'customer-1',
        phone: '+393331234567',
        status: 'PENDING',
        createdAt: new Date(),
      }

      const mockCustomer = {
        id: 'customer-1',
        name: 'Test User',
        phone: '+393331234567',
        language: 'it',
        isBlacklisted: false,
        isActive: true,
      }

      mockPrisma.pushCampaign.findMany.mockResolvedValue([mockCampaign])
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'owner-1',
        name: 'Test Workspace',
        enableWhatsapp: true,
      })
      mockPrisma.pushCampaignRecipient.count.mockResolvedValue(1)
      mockPrisma.pushCampaignRecipient.findMany.mockResolvedValue([mockRecipient])
      mockPrisma.customers.findFirst.mockResolvedValue(mockCustomer)
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        creditBalance: new Prisma.Decimal(0.5), // Insufficient credit
      })
      mockPrisma.pushCampaign.update.mockResolvedValue(mockCampaign)

      await pushCampaignsJob()

      expect(mockPrisma.pushCampaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
        data: {
          status: 'PAUSED',
          lastError: 'Insufficient credit',
        },
      })
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('paused due to insufficient credit')
      )
    })
  })

  describe('Variable Replacement', () => {
    it('should replace {{name}}, {{firstName}}, {{lastName}} variables', async () => {
      // SCENARIO: Campaign message with customer name variables
      // RULE: Replace {{name}} with full name, {{firstName}} with first part, {{lastName}} with rest

      const customer = {
        name: 'Mario Rossi',
        email: 'mario@example.com',
        phone: '+393331234567',
        company: 'Test Corp',
        language: 'it',
      }

      const campaign = {
        message: 'Hello {{firstName}} {{lastName}}, welcome {{name}}!',
        bodyPreview: null,
      }

      const result = await __test.buildMessageContent({
        campaign,
        customer,
        workspaceName: 'Test Workspace',
        workspaceLanguage: 'it',
      })

      // Note: Translation service will be called, so we just verify the input to translation
      expect(mockTranslationService.translateMessage).toHaveBeenCalledWith(
        'Hello Mario Rossi, welcome Mario Rossi!',
        'it'
      )
    })

    it('should replace {{email}}, {{phone}}, {{company}}, {{workspace}} variables', async () => {
      // SCENARIO: Campaign with contact and workspace variables
      // RULE: Replace all supported variables with customer data

      const customer = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '+393331234567',
        company: 'ACME Corp',
        language: 'en',
      }

      const campaign = {
        message: 'Contact: {{email}}, {{phone}}, {{company}} via {{workspace}}',
        bodyPreview: null,
      }

      mockTranslationService.translateMessage.mockResolvedValue(
        'Contact: test@example.com, +393331234567, ACME Corp via Test Shop'
      )

      const result = await __test.buildMessageContent({
        campaign,
        customer,
        workspaceName: 'Test Shop',
        workspaceLanguage: 'it',
      })

      expect(mockTranslationService.translateMessage).toHaveBeenCalledWith(
        'Contact: test@example.com, +393331234567, ACME Corp via Test Shop',
        'en'
      )
    })

    it('should handle missing variables gracefully', async () => {
      // SCENARIO: Customer has incomplete profile data
      // RULE: Use fallback values (empty string or "Customer")

      const customer = {
        name: null,
        email: null,
        phone: '+393331234567',
        company: null,
        language: 'it',
      }

      const campaign = {
        message: 'Hello {{name}}, email: {{email}}, company: {{company}}',
        bodyPreview: null,
      }

      mockTranslationService.translateMessage.mockResolvedValue('Hello Customer')

      await __test.buildMessageContent({
        campaign,
        customer,
        workspaceName: 'Test',
        workspaceLanguage: 'it',
      })

      expect(mockTranslationService.translateMessage).toHaveBeenCalledWith(
        'Hello Customer, email: , company: ',
        'it'
      )
    })
  })

  describe('Translation', () => {
    it('should translate message to customer language', async () => {
      // SCENARIO: Italian campaign message sent to English customer
      // RULE: Use translation service to convert message to target language

      const customer = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+447700123456',
        company: null,
        language: 'en', // English customer
      }

      const campaign = {
        message: 'Ciao {{name}}, benvenuto!',
        bodyPreview: null,
      }

      mockTranslationService.translateMessage.mockResolvedValue('Hello John Doe, welcome!')

      const result = await __test.buildMessageContent({
        campaign,
        customer,
        workspaceName: 'Shop',
        workspaceLanguage: 'it',
      })

      expect(mockTranslationService.translateMessage).toHaveBeenCalledWith(
        'Ciao John Doe, benvenuto!',
        'en'
      )
      expect(result).toBe('Hello John Doe, welcome!')
    })

    it('should handle translation failure gracefully', async () => {
      // SCENARIO: Translation service throws error
      // RULE: Return original message if translation fails

      const customer = {
        name: 'Test',
        language: 'es',
      }

      const campaign = {
        message: 'Test message',
        bodyPreview: null,
      }

      mockTranslationService.translateMessage.mockRejectedValue(
        new Error('Translation API error')
      )

      const result = await __test.buildMessageContent({
        campaign,
        customer,
        workspaceName: 'Shop',
        workspaceLanguage: 'es',
      })

      expect(result).toBe('Test message')
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Translation failed'),
        expect.any(Error)
      )
    })

    it('should normalize language codes correctly', () => {
      // SCENARIO: Different language code formats
      // RULE: Normalize to standard codes (it, en, es, pt)

      expect(__test.normalizeLanguage('en')).toBe('en')
      expect(__test.normalizeLanguage('EN')).toBe('en')
      expect(__test.normalizeLanguage('en-US')).toBe('en')
      expect(__test.normalizeLanguage('en_GB')).toBe('en')
      expect(__test.normalizeLanguage('es')).toBe('es')
      expect(__test.normalizeLanguage('es-ES')).toBe('es')
      expect(__test.normalizeLanguage('pt')).toBe('pt')
      expect(__test.normalizeLanguage('pt-BR')).toBe('pt')
      expect(__test.normalizeLanguage('it')).toBe('it')
      expect(__test.normalizeLanguage('IT')).toBe('it')
      expect(__test.normalizeLanguage('fr')).toBe('fr') // French supported
      expect(__test.normalizeLanguage('fr-FR')).toBe('fr')
      expect(__test.normalizeLanguage(null)).toBe('en') // Default → English (system default)
      expect(__test.normalizeLanguage(undefined)).toBe('en') // Default → English (system default)
      expect(__test.normalizeLanguage('de')).toBe('en') // Unsupported fallback → English
    })
  })

  describe('Recipient Filtering', () => {
    it('should skip blacklisted customers', async () => {
      // SCENARIO: Recipient is marked as blacklisted
      // RULE: Skip recipient with status SKIPPED, errorCode BLACKLISTED

      const mockCampaign = {
        id: 'campaign-1',
        workspaceId: 'ws-1',
        status: 'SCHEDULED',
        isActive: true,
        frequency: 'ONCE',
        batchSize: 50,
        throttlePerSecond: 10,
        costPerMessage: new Prisma.Decimal(1.0),
        message: 'Test',
      }

      const mockRecipient = {
        id: 'recipient-1',
        campaignId: 'campaign-1',
        customerId: 'customer-1',
        phone: '+393331234567',
        status: 'PENDING',
        createdAt: new Date(),
      }

      const mockCustomer = {
        id: 'customer-1',
        name: 'Blacklisted User',
        phone: '+393331234567',
        language: 'it',
        isBlacklisted: true, // Blacklisted
        isActive: true,
      }

      mockPrisma.pushCampaign.findMany.mockResolvedValue([mockCampaign])
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'owner-1',
        name: 'Test',
        enableWhatsapp: true,
      })
      mockPrisma.pushCampaignRecipient.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
      mockPrisma.pushCampaignRecipient.findMany.mockResolvedValue([mockRecipient])
      mockPrisma.customers.findFirst.mockResolvedValue(mockCustomer)
      mockPrisma.pushCampaign.update.mockResolvedValue(mockCampaign)

      await pushCampaignsJob()

      expect(mockPrisma.pushCampaignRecipient.update).toHaveBeenCalledWith({
        where: { id: 'recipient-1' },
        data: {
          status: 'SKIPPED',
          errorCode: 'BLACKLISTED',
          errorMessage: 'Customer is blacklisted',
        },
      })
    })

    it('should skip inactive customers', async () => {
      // SCENARIO: Customer marked as inactive
      // RULE: Skip with errorCode INACTIVE

      const mockCampaign = {
        id: 'campaign-1',
        workspaceId: 'ws-1',
        status: 'SCHEDULED',
        isActive: true,
        frequency: 'ONCE',
        batchSize: 50,
        throttlePerSecond: 10,
        costPerMessage: new Prisma.Decimal(1.0),
        message: 'Test',
      }

      const mockRecipient = {
        id: 'recipient-1',
        campaignId: 'campaign-1',
        customerId: 'customer-1',
        phone: '+393331234567',
        status: 'PENDING',
        createdAt: new Date(),
      }

      const mockCustomer = {
        id: 'customer-1',
        name: 'Inactive User',
        phone: '+393331234567',
        language: 'it',
        isBlacklisted: false,
        isActive: false, // Inactive
      }

      mockPrisma.pushCampaign.findMany.mockResolvedValue([mockCampaign])
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'owner-1',
        name: 'Test',
        enableWhatsapp: true,
      })
      mockPrisma.pushCampaignRecipient.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
      mockPrisma.pushCampaignRecipient.findMany.mockResolvedValue([mockRecipient])
      mockPrisma.customers.findFirst.mockResolvedValue(mockCustomer)
      mockPrisma.pushCampaign.update.mockResolvedValue(mockCampaign)

      await pushCampaignsJob()

      expect(mockPrisma.pushCampaignRecipient.update).toHaveBeenCalledWith({
        where: { id: 'recipient-1' },
        data: {
          status: 'SKIPPED',
          errorCode: 'INACTIVE',
          errorMessage: 'Customer is inactive',
        },
      })
    })

    it('should skip recipients without phone number', async () => {
      // SCENARIO: Customer profile missing phone number
      // RULE: Skip with errorCode NO_PHONE

      const mockCampaign = {
        id: 'campaign-1',
        workspaceId: 'ws-1',
        status: 'SCHEDULED',
        isActive: true,
        frequency: 'ONCE',
        batchSize: 50,
        throttlePerSecond: 10,
        costPerMessage: new Prisma.Decimal(1.0),
        message: 'Test',
      }

      const mockRecipient = {
        id: 'recipient-1',
        campaignId: 'campaign-1',
        customerId: 'customer-1',
        phone: null, // No phone in recipient
        status: 'PENDING',
        createdAt: new Date(),
      }

      const mockCustomer = {
        id: 'customer-1',
        name: 'No Phone User',
        phone: null, // No phone in customer
        language: 'it',
        isBlacklisted: false,
        isActive: true,
      }

      mockPrisma.pushCampaign.findMany.mockResolvedValue([mockCampaign])
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'owner-1',
        name: 'Test',
        enableWhatsapp: true,
      })
      mockPrisma.pushCampaignRecipient.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
      mockPrisma.pushCampaignRecipient.findMany.mockResolvedValue([mockRecipient])
      mockPrisma.customers.findFirst.mockResolvedValue(mockCustomer)
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        creditBalance: new Prisma.Decimal(100.0),
      })
      mockPrisma.pushCampaign.update.mockResolvedValue(mockCampaign)

      await pushCampaignsJob()

      expect(mockPrisma.pushCampaignRecipient.update).toHaveBeenCalledWith({
        where: { id: 'recipient-1' },
        data: {
          status: 'SKIPPED',
          errorCode: 'NO_PHONE',
          errorMessage: 'Missing phone',
        },
      })
    })

    it('should skip if customer not found', async () => {
      // SCENARIO: Recipient references non-existent customer
      // RULE: Skip with errorCode NO_CUSTOMER

      const mockCampaign = {
        id: 'campaign-1',
        workspaceId: 'ws-1',
        status: 'SCHEDULED',
        isActive: true,
        frequency: 'ONCE',
        batchSize: 50,
        throttlePerSecond: 10,
        costPerMessage: new Prisma.Decimal(1.0),
        message: 'Test',
      }

      const mockRecipient = {
        id: 'recipient-1',
        campaignId: 'campaign-1',
        customerId: 'customer-999',
        phone: '+393331234567',
        status: 'PENDING',
        createdAt: new Date(),
      }

      mockPrisma.pushCampaign.findMany.mockResolvedValue([mockCampaign])
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'owner-1',
        name: 'Test',
        enableWhatsapp: true,
      })
      mockPrisma.pushCampaignRecipient.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
      mockPrisma.pushCampaignRecipient.findMany.mockResolvedValue([mockRecipient])
      mockPrisma.customers.findFirst.mockResolvedValue(null) // Customer not found
      mockPrisma.pushCampaign.update.mockResolvedValue(mockCampaign)

      await pushCampaignsJob()

      expect(mockPrisma.pushCampaignRecipient.update).toHaveBeenCalledWith({
        where: { id: 'recipient-1' },
        data: {
          status: 'SKIPPED',
          errorCode: 'NO_CUSTOMER',
          errorMessage: 'Customer not found or inactive',
        },
      })
    })
  })

  describe('Recurring Campaigns', () => {
    it('should calculate nextRunAt for WEEKLY frequency', () => {
      // SCENARIO: Weekly recurring campaign
      // RULE: Next run should be +7 days from last run

      const lastRun = new Date('2026-02-10T10:00:00Z')
      const nextRun = __test.calculateNextRunAt('WEEKLY', lastRun)

      expect(nextRun).toEqual(new Date('2026-02-17T10:00:00Z'))
    })

    it('should calculate nextRunAt for MONTHLY frequency', () => {
      // SCENARIO: Monthly recurring campaign
      // RULE: Next run should be +1 month from last run

      const lastRun = new Date('2026-02-10T10:00:00Z')
      const nextRun = __test.calculateNextRunAt('MONTHLY', lastRun)

      expect(nextRun).toEqual(new Date('2026-03-10T10:00:00Z'))
    })

    it('should calculate nextRunAt for QUARTERLY frequency', () => {
      // SCENARIO: Quarterly recurring campaign
      // RULE: Next run should be +3 months from last run

      const lastRun = new Date('2026-02-10T10:00:00Z')
      const nextRun = __test.calculateNextRunAt('QUARTERLY', lastRun)

      // Date manipulation with setMonth can shift hours due to DST, verify month and day match
      expect(nextRun).toBeDefined()
      expect(nextRun?.getUTCMonth()).toBe(4) // May (0-indexed)
      expect(nextRun?.getUTCDate()).toBe(10)
    })

    it('should calculate nextRunAt for SEMIANNUAL frequency', () => {
      // SCENARIO: Semi-annual recurring campaign
      // RULE: Next run should be +6 months from last run

      const lastRun = new Date('2026-02-10T10:00:00Z')
      const nextRun = __test.calculateNextRunAt('SEMIANNUAL', lastRun)

      // Date manipulation with setMonth can shift hours due to DST, verify month and day match
      expect(nextRun).toBeDefined()
      expect(nextRun?.getUTCMonth()).toBe(7) // August (0-indexed)
      expect(nextRun?.getUTCDate()).toBe(10)
    })

    it('should return null for ONCE frequency', () => {
      // SCENARIO: One-time campaign
      // RULE: No next run for ONCE frequency

      const lastRun = new Date('2026-02-10T10:00:00Z')
      const nextRun = __test.calculateNextRunAt('ONCE', lastRun)

      expect(nextRun).toBeNull()
    })

    it('should update nextRunAt for recurring campaigns', async () => {
      // SCENARIO: Weekly campaign completes all recipients
      // RULE: Update status to SCHEDULED and set nextRunAt for next week

      const mockCampaign = {
        id: 'campaign-1',
        workspaceId: 'ws-1',
        status: 'SCHEDULED',
        isActive: true,
        frequency: 'WEEKLY',
        batchSize: 50,
        throttlePerSecond: 10,
        costPerMessage: new Prisma.Decimal(1.0),
        message: 'Weekly update',
      }

      mockPrisma.pushCampaign.findMany.mockResolvedValue([mockCampaign])
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'owner-1',
        name: 'Test',
        enableWhatsapp: true,
      })
      mockPrisma.pushCampaignRecipient.count
        .mockResolvedValueOnce(0) // No pending recipients initially → triggers populateRecipientsForRun
        .mockResolvedValueOnce(0) // Re-check after populate: still 0 → noEligibleRecipientsWarning set
        .mockResolvedValueOnce(0) // Skipped count query
        .mockResolvedValueOnce(0) // Final stillPending check after processing loop
      mockPrisma.pushCampaignRecipient.findMany.mockResolvedValue([])
      mockPrisma.customers.findMany.mockResolvedValue([])
      mockPrisma.pushCampaign.update.mockResolvedValue(mockCampaign)

      await pushCampaignsJob()

      // RULE: Recurring campaigns with 0 recipients keep SCHEDULED with nextRunAt,
      // but also set lastError so the user sees the issue in the UI
      expect(mockPrisma.pushCampaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'campaign-1' },
          data: expect.objectContaining({
            status: 'SCHEDULED',
            nextRunAt: expect.any(Date),
            lastError: expect.stringContaining('No eligible recipients'),
          }),
        })
      )
    })
  })

  describe('Campaign Completion', () => {
    it('should mark ONCE campaign as COMPLETED when finished', () => {
      // SCENARIO: One-time campaign finishes all recipients
      // RULE: Status should be COMPLETED, isActive should be false, nextRunAt null

      const campaign = {
        frequency: 'ONCE',
      }

      const result = __test.computeCompletionUpdate(campaign, new Date())

      expect(result.finalStatus).toBe('COMPLETED')
      expect(result.nextRunAt).toBeNull()
      expect(result.shouldDeactivate).toBe(true)
    })

    it('should reschedule recurring campaign when finished', () => {
      // SCENARIO: Weekly campaign finishes current batch
      // RULE: Status should be SCHEDULED, nextRunAt set, isActive unchanged

      const campaign = {
        frequency: 'WEEKLY',
      }

      const now = new Date('2026-02-10T10:00:00Z')
      const result = __test.computeCompletionUpdate(campaign, now)

      expect(result.finalStatus).toBe('SCHEDULED')
      expect(result.nextRunAt).toEqual(new Date('2026-02-17T10:00:00Z'))
      expect(result.shouldDeactivate).toBe(false)
    })

    it('should keep campaign SCHEDULED if recipients still pending', async () => {
      // SCENARIO: Campaign has more recipients to process (throttled)
      // RULE: Keep status as SCHEDULED to continue in next run

      const mockCampaign = {
        id: 'campaign-1',
        workspaceId: 'ws-1',
        status: 'SCHEDULED',
        isActive: true,
        frequency: 'ONCE',
        batchSize: 50,
        throttlePerSecond: 10,
        costPerMessage: new Prisma.Decimal(1.0),
        message: 'Test',
      }

      mockPrisma.pushCampaign.findMany.mockResolvedValue([mockCampaign])
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'owner-1',
        name: 'Test',
        enableWhatsapp: true,
      })
      mockPrisma.pushCampaignRecipient.count
        .mockResolvedValueOnce(10) // Has pending recipients
        .mockResolvedValueOnce(5) // Still has pending after batch
      mockPrisma.pushCampaignRecipient.findMany.mockResolvedValue([])
      mockPrisma.pushCampaign.update.mockResolvedValue(mockCampaign)

      await pushCampaignsJob()

      // Should update to SCHEDULED, not COMPLETED
      const lastUpdateCall = mockPrisma.pushCampaign.update.mock.calls.find(
        (call) => call[0].data.status === 'SCHEDULED'
      )
      expect(lastUpdateCall).toBeDefined()
    })
  })

  describe('Batch Processing', () => {
    it('should respect batchSize limit', async () => {
      // SCENARIO: Campaign with batchSize=2
      // RULE: Process maximum 2 recipients per run

      const mockCampaign = {
        id: 'campaign-1',
        workspaceId: 'ws-1',
        status: 'SCHEDULED',
        isActive: true,
        frequency: 'ONCE',
        batchSize: 2, // Only 2 per run
        throttlePerSecond: 10,
        costPerMessage: new Prisma.Decimal(1.0),
        message: 'Test',
      }

      mockPrisma.pushCampaign.findMany.mockResolvedValue([mockCampaign])
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'owner-1',
        name: 'Test',
        enableWhatsapp: true,
      })
      mockPrisma.pushCampaignRecipient.count.mockResolvedValue(5) // 5 pending
      mockPrisma.pushCampaignRecipient.findMany.mockResolvedValue([])
      mockPrisma.pushCampaign.update.mockResolvedValue(mockCampaign)

      await pushCampaignsJob()

      // Verify findMany was called with take: 2
      expect(mockPrisma.pushCampaignRecipient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 2,
        })
      )
    })

    it('should respect throttlePerSecond limit', async () => {
      // SCENARIO: Campaign with throttlePerSecond=3 and batchSize=10
      // RULE: Process only 3 recipients (min of batch and throttle)

      const mockCampaign = {
        id: 'campaign-1',
        workspaceId: 'ws-1',
        status: 'SCHEDULED',
        isActive: true,
        frequency: 'ONCE',
        batchSize: 10,
        throttlePerSecond: 3, // Throttle is lower
        costPerMessage: new Prisma.Decimal(1.0),
        message: 'Test',
      }

      mockPrisma.pushCampaign.findMany.mockResolvedValue([mockCampaign])
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'owner-1',
        name: 'Test',
        enableWhatsapp: true,
      })
      mockPrisma.pushCampaignRecipient.count.mockResolvedValue(10)
      mockPrisma.pushCampaignRecipient.findMany.mockResolvedValue([])
      mockPrisma.pushCampaign.update.mockResolvedValue(mockCampaign)

      await pushCampaignsJob()

      // Verify findMany was called with take: 3 (throttle limit)
      expect(mockPrisma.pushCampaignRecipient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 3,
        })
      )
    })
  })

  describe('Transaction Safety', () => {
    it('should execute queue creation and recipient update in transaction', async () => {
      // SCENARIO: Successful message send
      // RULE: Queue + recipient update must happen atomically in transaction

      const mockCampaign = {
        id: 'campaign-1',
        workspaceId: 'ws-1',
        status: 'SCHEDULED',
        isActive: true,
        frequency: 'ONCE',
        batchSize: 50,
        throttlePerSecond: 10,
        costPerMessage: new Prisma.Decimal(1.0),
        message: 'Test',
      }

      const mockRecipient = {
        id: 'recipient-1',
        campaignId: 'campaign-1',
        customerId: 'customer-1',
        phone: '+393331234567',
        status: 'PENDING',
        createdAt: new Date(),
      }

      const mockCustomer = {
        id: 'customer-1',
        name: 'Test User',
        phone: '+393331234567',
        language: 'it',
        isBlacklisted: false,
        isActive: true,
      }

      mockPrisma.pushCampaign.findMany.mockResolvedValue([mockCampaign])
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'owner-1',
        name: 'Test',
        enableWhatsapp: true,
      })
      mockPrisma.pushCampaignRecipient.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
      mockPrisma.pushCampaignRecipient.findMany.mockResolvedValue([mockRecipient])
      mockPrisma.customers.findFirst.mockResolvedValue(mockCustomer)
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        creditBalance: new Prisma.Decimal(100.0),
      })
      mockTranslationService.translateMessage.mockResolvedValue('Test message')
      mockPrisma.pushCampaign.update.mockResolvedValue(mockCampaign)

      // Mock transaction execution
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrisma)
      })
      mockPrisma.whatsAppQueue.create.mockResolvedValue({
        id: 'queue-1',
      })

      await pushCampaignsJob()

      // Verify transaction was used
      expect(mockPrisma.$transaction).toHaveBeenCalled()

      // Verify operations inside transaction (upsert dedupe)
      expect(mockPrisma.whatsAppQueue.upsert).toHaveBeenCalledWith({
        where: { pushCampaignRecipientId: 'recipient-1' },
        update: expect.objectContaining({
          workspaceId: 'ws-1',
          customerId: 'customer-1',
          phoneNumber: '+393331234567',
          messageContent: 'Test message',
          status: 'pending',
          channel: 'whatsapp',
          pushCampaignId: 'campaign-1',
        }),
        create: expect.objectContaining({
          workspaceId: 'ws-1',
          customerId: 'customer-1',
          phoneNumber: '+393331234567',
          messageContent: 'Test message',
          status: 'pending',
          channel: 'whatsapp',
          pushCampaignId: 'campaign-1',
          pushCampaignRecipientId: 'recipient-1',
        }),
      })

      expect(mockPrisma.pushCampaignRecipient.update).toHaveBeenCalledWith({
        where: { id: 'recipient-1' },
        data: expect.objectContaining({
          status: 'SENT',
          messageId: 'queue-1',
        }),
      })
    })

    it('should handle transaction failure gracefully', async () => {
      // SCENARIO: Transaction fails during queue creation/update
      // RULE: Mark recipient as FAILED, log error, continue with other recipients

      const mockCampaign = {
        id: 'campaign-1',
        workspaceId: 'ws-1',
        status: 'SCHEDULED',
        isActive: true,
        frequency: 'ONCE',
        batchSize: 50,
        throttlePerSecond: 10,
        costPerMessage: new Prisma.Decimal(1.0),
        message: 'Test',
      }

      const mockRecipient = {
        id: 'recipient-1',
        campaignId: 'campaign-1',
        customerId: 'customer-1',
        phone: '+393331234567',
        status: 'PENDING',
        createdAt: new Date(),
      }

      const mockCustomer = {
        id: 'customer-1',
        name: 'Test',
        phone: '+393331234567',
        language: 'it',
        isBlacklisted: false,
        isActive: true,
      }

      mockPrisma.pushCampaign.findMany.mockResolvedValue([mockCampaign])
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'owner-1',
        name: 'Test',
        enableWhatsapp: true,
      })
      mockPrisma.pushCampaignRecipient.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
      mockPrisma.pushCampaignRecipient.findMany.mockResolvedValue([mockRecipient])
      mockPrisma.customers.findFirst.mockResolvedValue(mockCustomer)
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        creditBalance: new Prisma.Decimal(100.0),
      })
      mockTranslationService.translateMessage.mockResolvedValue('Test')
      mockPrisma.pushCampaign.update.mockResolvedValue(mockCampaign)

      // Mock transaction to throw error
      mockPrisma.$transaction.mockRejectedValue(new Error('Database error'))

      await pushCampaignsJob()

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending to recipient'),
        expect.any(Error)
      )

      // Verify recipient was marked as FAILED
      expect(mockPrisma.pushCampaignRecipient.update).toHaveBeenCalledWith({
        where: { id: 'recipient-1' },
        data: {
          status: 'FAILED',
          errorCode: 'SEND_ERROR',
          errorMessage: 'Database error',
        },
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle campaign processing error', async () => {
      // SCENARIO: Unexpected error during campaign processing
      // RULE: Mark campaign as FAILED with error message, continue with other campaigns

      const mockCampaign = {
        id: 'campaign-1',
        workspaceId: 'ws-1',
        status: 'SCHEDULED',
        isActive: true,
        frequency: 'ONCE',
        costPerMessage: new Prisma.Decimal(1.0),
      }

      mockPrisma.pushCampaign.findMany.mockResolvedValue([mockCampaign])
      mockPrisma.workspace.findUnique.mockRejectedValue(new Error('Database connection lost'))

      await pushCampaignsJob()

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Campaign campaign-1 error'),
        expect.any(Error)
      )

      expect(mockPrisma.pushCampaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
        data: {
          status: 'FAILED',
          lastError: 'Database connection lost',
        },
      })
    })

    it('should handle no campaigns to process', async () => {
      // SCENARIO: No scheduled campaigns found
      // RULE: Exit silently without error

      mockPrisma.pushCampaign.findMany.mockResolvedValue([])

      await pushCampaignsJob()

      expect(mockPrisma.workspace.findUnique).not.toHaveBeenCalled()
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Found')
      )
    })
  })

  describe('No Eligible Recipients (push_notifications_consent missing)', () => {
    it('should mark ONCE campaign as FAILED and log warning when all recipients lack push consent', async () => {
      // SCENARIO: ONCE campaign where all target customers have push_notifications_consent=false
      // RULE: Job must NOT silently complete. Campaign must be marked FAILED with a clear lastError
      // so the user can see WHY nothing was sent in the campaign dashboard.
      // ROOT CAUSE this test protects against: silent failure where campaign goes to COMPLETED
      // with 0 messages sent and no visible error, leaving the user confused.

      const mockCampaign = {
        id: 'campaign-silent',
        workspaceId: 'ws-1',
        status: 'SCHEDULED',
        isActive: true,
        frequency: 'ONCE',
        batchSize: 50,
        throttlePerSecond: 10,
        costPerMessage: new Prisma.Decimal(1.0),
        message: 'Hello {{name}}',
        targetingType: 'ALL',
      }

      mockPrisma.pushCampaign.findMany.mockResolvedValue([mockCampaign])
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'owner-1',
        name: 'Test',
        enableWhatsapp: true,
      })
      mockPrisma.pushCampaignRecipient.count
        .mockResolvedValueOnce(0)  // Initial check: 0 PENDING → triggers populateRecipientsForRun
        .mockResolvedValueOnce(0)  // Re-check after populate: still 0 PENDING → warning triggered
        .mockResolvedValueOnce(3)  // Skipped count: 3 customers skipped (no consent)
      // populateRecipientsForRun finds no eligible customers (all lack consent)
      mockPrisma.customers.findMany.mockResolvedValue([]) // No consent customers found
      mockPrisma.pushCampaignRecipient.findMany.mockResolvedValue([]) // No existing recipients to reset
      mockPrisma.pushCampaign.update.mockResolvedValue(mockCampaign)

      await pushCampaignsJob()

      // RULE: ONCE campaign with 0 eligible recipients → FAILED (not COMPLETED)
      expect(mockPrisma.pushCampaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-silent' },
        data: {
          status: 'FAILED',
          isActive: false,
          lastError: expect.stringContaining('No eligible recipients'),
        },
      })

      // RULE: Warning must be logged so Heroku logs show the root cause
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('campaign-silent'),
        // Message must mention push_notifications_consent for diagnosability
      )
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('push_notifications_consent')
      )
    })

    it('should keep WEEKLY campaign SCHEDULED but set lastError when no eligible recipients', async () => {
      // SCENARIO: Recurring WEEKLY campaign where all customers lack push consent
      // RULE: Recurring campaigns should NOT be failed permanently (consent may be granted later)
      // But lastError MUST be set so user sees the problem in the dashboard.

      const mockCampaign = {
        id: 'campaign-weekly-no-consent',
        workspaceId: 'ws-1',
        status: 'SCHEDULED',
        isActive: true,
        frequency: 'WEEKLY',
        batchSize: 50,
        throttlePerSecond: 10,
        costPerMessage: new Prisma.Decimal(1.0),
        message: 'Weekly promo',
        targetingType: 'ALL',
      }

      mockPrisma.pushCampaign.findMany.mockResolvedValue([mockCampaign])
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'owner-1',
        name: 'Test',
        enableWhatsapp: true,
      })
      mockPrisma.pushCampaignRecipient.count
        .mockResolvedValueOnce(0)  // Initial check: 0 PENDING
        .mockResolvedValueOnce(0)  // Re-check after populate: still 0
        .mockResolvedValueOnce(5)  // Skipped count: 5 customers without consent
        .mockResolvedValueOnce(0)  // Final stillPending check after processing loop
      mockPrisma.customers.findMany.mockResolvedValue([]) // No eligible
      mockPrisma.pushCampaignRecipient.findMany.mockResolvedValue([])
      mockPrisma.pushCampaign.update.mockResolvedValue(mockCampaign)

      await pushCampaignsJob()

      // RULE: Recurring campaign keeps SCHEDULED with nextRunAt for retry next week
      // AND sets lastError to make the issue visible in the UI
      expect(mockPrisma.pushCampaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'campaign-weekly-no-consent' },
          data: expect.objectContaining({
            status: 'SCHEDULED',
            nextRunAt: expect.any(Date),
            lastError: expect.stringContaining('No eligible recipients'),
          }),
        })
      )

      // RULE: Must NOT be marked as FAILED (recurring can recover when consent is granted)
      const failedCall = mockPrisma.pushCampaign.update.mock.calls.find(
        (call) => call[0].data.status === 'FAILED'
      )
      expect(failedCall).toBeUndefined()
    })

    it('should log warning in populateRecipientsForRun when no customers have push consent', async () => {
      // SCENARIO: populateRecipientsForRun is called but all customers have push_notifications_consent=false
      // RULE: Must log a warning to make Heroku logs diagnosable — silent return is not acceptable
      // This is the key diagnostic log that allows understanding WHY a campaign sends 0 messages

      const campaign = {
        id: 'camp-no-consent',
        workspaceId: 'ws-1',
        targetingType: 'ALL',
        targetCustomerIds: [],
      }

      // ALL targeting: customers found but NONE have consent
      mockPrisma.customers.findMany
        .mockResolvedValueOnce([{ id: 'c1' }, { id: 'c2' }]) // First query: active customers (no consent filter)
        .mockResolvedValueOnce([])                            // Second query: consent filter → empty

      mockPrisma.pushCampaignRecipient.findMany.mockResolvedValue([])

      await __test.populateRecipientsForRun(campaign)

      // RULE: Must log warning with campaign ID and targeting type
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('camp-no-consent'),
      )
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('push_notifications_consent')
      )
    })
  })

  describe('Idempotent recipients and history', () => {
    it('populateRecipientsForRun resets existing recipients and adds missing (manual)', async () => {
      const campaign = {
        id: 'camp-1',
        workspaceId: 'ws-1',
        targetingType: 'MANUAL',
        targetCustomerIds: ['c1', 'c2'],
      }

      mockPrisma.customers.findMany.mockResolvedValue([
        { id: 'c1', phone: '+1' },
        { id: 'c2', phone: '+2' },
      ])
      mockPrisma.pushCampaignRecipient.findMany.mockResolvedValue([
        { id: 'r1', customerId: 'c1' },
      ])

      await __test.populateRecipientsForRun(campaign)

      expect(mockPrisma.pushCampaignRecipient.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['r1'] } },
        data: {
          status: 'PENDING',
          errorCode: null,
          errorMessage: null,
          messageId: null,
        },
      })
      expect(mockPrisma.pushCampaignRecipient.createMany).toHaveBeenCalledWith({
        data: [
          {
            workspaceId: 'ws-1',
            campaignId: 'camp-1',
            customerId: 'c2',
            phone: '+2',
            status: 'PENDING',
          },
        ],
      })
    })

    it('pushCampaignsJob creates conversationMessage and links queue', async () => {
      const now = new Date('2026-02-10T10:00:00Z')
      jest.useFakeTimers().setSystemTime(now)

      const mockCampaign = {
        id: 'campaign-1',
        workspaceId: 'ws-1',
        status: 'SCHEDULED',
        isActive: true,
        frequency: 'ONCE',
        nextRunAt: now,
        batchSize: 10,
        throttlePerSecond: 10,
        costPerMessage: new Prisma.Decimal(1.0),
        message: 'Hi {{name}}',
      }

      mockPrisma.pushCampaign.findMany.mockResolvedValue([mockCampaign])
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'owner-1',
        name: 'Test Workspace',
        enableWhatsapp: true,
        defaultLanguage: 'it',
      })
      mockPrisma.pushCampaignRecipient.count.mockResolvedValue(1)
      mockPrisma.pushCampaignRecipient.findMany.mockResolvedValue([
        { id: 'rec-1', customerId: 'cust-1', phone: '+39', status: 'PENDING' },
      ])
      mockPrisma.customers.findFirst.mockResolvedValue({
        id: 'cust-1',
        name: 'Mario Rossi',
        email: 'mario@example.com',
        company: 'Acme',
        phone: '+39',
        language: 'it',
        isBlacklisted: false,
        isActive: true,
      })
      mockPrisma.pushCampaignRecipient.update.mockResolvedValue(null)
      mockPrisma.pushCampaign.update.mockResolvedValue(mockCampaign)

      await pushCampaignsJob()

      expect(mockPrisma.conversationMessage.create).toHaveBeenCalledTimes(1)
      const convoCreateArgs = mockPrisma.conversationMessage.create.mock.calls[0][0]
      expect(convoCreateArgs.data.agentType).toBe('PUSH_CAMPAIGN')

      expect(mockPrisma.whatsAppQueue.upsert).toHaveBeenCalledTimes(1)
      const queueArgs = mockPrisma.whatsAppQueue.upsert.mock.calls[0][0]
      expect(queueArgs.create.conversationMessageId).toBe('conv-msg-1')
      expect(queueArgs.create.pushCampaignRecipientId).toBe('rec-1')

      jest.useRealTimers()
    })
  })
})
