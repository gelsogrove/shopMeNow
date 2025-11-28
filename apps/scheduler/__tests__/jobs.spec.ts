/**
 * Scheduler Jobs - Unit Tests
 * 
 * Tests for all scheduler cronjobs:
 * - WhatsApp Challenge Queue
 * - Short URLs Cleanup
 * - Blocked Customers Cleanup
 * - Monthly Billing
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

// Mock prisma - declare with explicit type to avoid circular reference
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: Record<string, any> = {
  workspace: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  whatsAppQueue: {
    findMany: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  shortUrls: {
    deleteMany: jest.fn(),
  },
  customers: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  chatSession: {
    deleteMany: jest.fn(),
  },
  chatMessage: {
    deleteMany: jest.fn(),
  },
  products: {
    findMany: jest.fn(),
  },
  planConfiguration: {
    findMany: jest.fn(),
  },
  billingTransaction: {
    create: jest.fn(),
  },
  schedulerJobStatus: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
}
// Add $transaction separately to avoid circular type reference
mockPrisma.$transaction = jest.fn((fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma))
jest.mock('../src/config/database', () => ({
  prisma: mockPrisma,
  connectDatabase: jest.fn(),
  disconnectDatabase: jest.fn(),
}))

// Mock Security Agent Service
jest.mock('../src/services/security-agent.service', () => ({
  SecurityAgentService: jest.fn().mockImplementation(() => ({
    validateMessage: jest.fn().mockResolvedValue({ isSafe: true, reason: null }),
  })),
}))

// Mock email alert service
jest.mock('../src/services/email-alert.service', () => ({
  sendJobErrorAlert: jest.fn().mockResolvedValue(undefined),
}))

// === NOW IMPORT MODULES ===
import { whatsappChallengeQueueJob } from '../src/jobs/whatsapp-challenge-queue.job'
import { shortUrlsCleanupJob } from '../src/jobs/short-urls-cleanup.job'
import { blockedCustomersCleanupJob } from '../src/jobs/blocked-customers-cleanup.job'
import { monthlyBillingJob } from '../src/jobs/monthly-billing.job'

describe('Scheduler Jobs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('WhatsApp Challenge Queue Job', () => {
    it('should skip if no workspaces with active channel', async () => {
      mockPrisma.workspace.findMany.mockResolvedValue([])

      await whatsappChallengeQueueJob()

      expect(mockPrisma.workspace.findMany).toHaveBeenCalledWith({
        where: {
          channelStatus: true,
          isActive: true,
          isDelete: false,
        },
        select: expect.any(Object),
      })
      expect(mockLogger.info).toHaveBeenCalledWith('No workspaces with active channel found')
    })

    it('should process pending messages for active workspaces', async () => {
      const mockWorkspace = {
        id: 'ws-1',
        name: 'Test Workspace',
        whatsappApiKey: 'key-123',
        whatsappPhoneNumber: '+1234567890',
      }
      
      const mockMessage = {
        id: 'msg-1',
        workspaceId: 'ws-1',
        customerId: 'cust-1',
        messageContent: 'Hello World',
        status: 'pending',
      }

      mockPrisma.workspace.findMany.mockResolvedValue([mockWorkspace])
      mockPrisma.whatsAppQueue.findMany.mockResolvedValue([mockMessage])
      mockPrisma.whatsAppQueue.update.mockResolvedValue({ ...mockMessage, status: 'sent' })

      await whatsappChallengeQueueJob()

      expect(mockPrisma.whatsAppQueue.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: expect.objectContaining({ status: 'sent' }),
      })
      expect(mockLogger.info).toHaveBeenCalledWith('Queue processed: 1 sent, 0 blocked')
    })

    it('should skip workspaces with no pending messages', async () => {
      const mockWorkspace = { id: 'ws-1', name: 'Empty Workspace' }
      
      mockPrisma.workspace.findMany.mockResolvedValue([mockWorkspace])
      mockPrisma.whatsAppQueue.findMany.mockResolvedValue([])

      await whatsappChallengeQueueJob()

      expect(mockPrisma.whatsAppQueue.update).not.toHaveBeenCalled()
    })
  })

  describe('Short URLs Cleanup Job', () => {
    it('should delete expired short URLs', async () => {
      mockPrisma.shortUrls.deleteMany.mockResolvedValue({ count: 2 })

      await shortUrlsCleanupJob()

      expect(mockPrisma.shortUrls.deleteMany).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Deleted'))
    })

    it('should log when no expired URLs found', async () => {
      mockPrisma.shortUrls.deleteMany.mockResolvedValue({ count: 0 })

      await shortUrlsCleanupJob()

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Deleted 0'))
    })
  })

  describe('Blocked Customers Cleanup Job', () => {
    it('should unblock customers after cooldown period', async () => {
      const blockedCustomers = [
        { id: 'cust-1', phone: '+123', isBlacklisted: true, workspaceId: 'ws-1' },
        { id: 'cust-2', phone: '+456', isBlacklisted: true, workspaceId: 'ws-1' },
      ]

      mockPrisma.customers.findMany.mockResolvedValue(blockedCustomers)
      mockPrisma.customers.update.mockResolvedValue({})
      mockPrisma.chatSession.deleteMany.mockResolvedValue({ count: 2 })

      await blockedCustomersCleanupJob()

      expect(mockPrisma.customers.findMany).toHaveBeenCalledWith({
        where: {
          isBlacklisted: true,
        },
        select: expect.any(Object),
      })
    })
  })

  describe('Monthly Billing Job', () => {
    it('should skip free trial workspaces', async () => {
      mockPrisma.workspace.findMany.mockResolvedValue([])

      await monthlyBillingJob()

      expect(mockPrisma.workspace.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          planType: { not: 'FREE_TRIAL' },
        }),
        select: expect.any(Object),
      })
      expect(mockLogger.info).toHaveBeenCalledWith('No active paid workspaces found')
    })

    it('should charge monthly fee for paid workspaces', async () => {
      const mockWorkspace = {
        id: 'ws-1',
        name: 'Paid Workspace',
        planType: 'BASIC',
        creditBalance: 100.00,
      }

      const mockPlanConfig = {
        planType: 'BASIC',
        monthlyFee: 29.00,
        isActive: true,
      }

      mockPrisma.workspace.findMany.mockResolvedValue([mockWorkspace])
      mockPrisma.planConfiguration.findMany.mockResolvedValue([mockPlanConfig])
      mockPrisma.workspace.update.mockResolvedValue({ ...mockWorkspace, creditBalance: 71.00 })
      mockPrisma.billingTransaction.create.mockResolvedValue({})

      await monthlyBillingJob()

      expect(mockPrisma.workspace.update).toHaveBeenCalledWith({
        where: { id: 'ws-1' },
        data: expect.objectContaining({
          creditBalance: expect.any(Object), // Decimal
        }),
      })
      expect(mockPrisma.billingTransaction.create).toHaveBeenCalled()
    })
  })
})

describe('Job Runner Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default: job is active (or doesn't exist yet)
    mockPrisma.schedulerJobStatus.findUnique.mockResolvedValue(null)
  })

  it('should log job start and completion', async () => {
    const { runJob } = require('../src/services/job-runner.service')
    const mockJob = jest.fn().mockResolvedValue(undefined)

    await runJob('test-job', mockJob)

    expect(mockJob).toHaveBeenCalled()
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('test-job'))
  })

  it('should catch and log job errors', async () => {
    const { runJob } = require('../src/services/job-runner.service')
    const failingJob = jest.fn().mockRejectedValue(new Error('Job failed'))

    await runJob('failing-job', failingJob)

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('failing-job')
    )
  })

  it('should skip disabled jobs', async () => {
    const { runJob } = require('../src/services/job-runner.service')
    const mockJob = jest.fn().mockResolvedValue(undefined)

    // Job exists and is disabled
    mockPrisma.schedulerJobStatus.findUnique.mockResolvedValue({
      isActive: false
    })

    await runJob('disabled-job', mockJob)

    // Job should NOT be executed
    expect(mockJob).not.toHaveBeenCalled()
    // Should log skip message
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('SKIPPED'))
    // Should update status to SKIPPED
    expect(mockPrisma.schedulerJobStatus.update).toHaveBeenCalledWith({
      where: { jobName: 'disabled-job' },
      data: expect.objectContaining({ lastStatus: 'SKIPPED' })
    })
  })

  it('should run job if isActive is true', async () => {
    const { runJob } = require('../src/services/job-runner.service')
    const mockJob = jest.fn().mockResolvedValue(undefined)

    // Job exists and is active
    mockPrisma.schedulerJobStatus.findUnique.mockResolvedValue({
      isActive: true
    })

    await runJob('active-job', mockJob)

    // Job SHOULD be executed
    expect(mockJob).toHaveBeenCalled()
  })
})
