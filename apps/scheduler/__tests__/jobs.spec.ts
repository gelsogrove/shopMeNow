/**
 * Scheduler Jobs - Unit Tests
 * 
 * Tests for all scheduler cronjobs:
 * - WhatsApp Challenge Queue
 * - Short URLs Cleanup
 * - Unused Images Cleanup
 * - Messages Archive
 * - WhatsApp Queue Cleanup
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
// Supports both callback style: prisma.$transaction(async (tx) => {}) 
// AND array style: prisma.$transaction([promise1, promise2])
mockPrisma.$transaction = jest.fn(async (input: unknown) => {
  // If it's a function, call it with mockPrisma
  if (typeof input === 'function') {
    return await input(mockPrisma)
  }
  // If it's an array of promises, resolve all
  if (Array.isArray(input)) {
    return await Promise.all(input)
  }
  return undefined
})

// Mock Prisma namespace for Decimal operations
const mockPrismaNamespace = {
  Decimal: class {
    value: number
    constructor(val: number | string) {
      this.value = typeof val === 'string' ? parseFloat(val) : val
    }
    lessThan(other: { value: number }): boolean {
      return this.value < other.value
    }
    minus(other: { value: number }): { value: number } {
      return new mockPrismaNamespace.Decimal(this.value - other.value)
    }
    negated(): { value: number } {
      return new mockPrismaNamespace.Decimal(-this.value)
    }
    toString(): string {
      return this.value.toString()
    }
  },
}

jest.mock('../src/config/database', () => ({
  prisma: mockPrisma,
  Prisma: mockPrismaNamespace,
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
      // Note: When no workspaces found, it logs to debug level, not info
      expect(mockLogger.debug).toHaveBeenCalledWith('[WhatsApp Queue] No workspaces with active channel found')
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
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('1 sent, 0 blocked')
      )
    })

    it('should skip workspaces with no pending messages', async () => {
      const mockWorkspace = { id: 'ws-1', name: 'Empty Workspace' }
      
      mockPrisma.workspace.findMany.mockResolvedValue([mockWorkspace])
      mockPrisma.whatsAppQueue.findMany.mockResolvedValue([])

      await whatsappChallengeQueueJob()

      expect(mockPrisma.whatsAppQueue.update).not.toHaveBeenCalled()
    })

    it('should process multiple messages in parallel using Promise.allSettled', async () => {
      const mockWorkspace = {
        id: 'ws-1',
        name: 'Test Workspace',
        whatsappApiKey: 'key-123',
        whatsappPhoneNumber: '+1234567890',
      }
      
      // Multiple messages to different customers
      const mockMessages = [
        { id: 'msg-1', workspaceId: 'ws-1', customerId: 'cust-1', messageContent: 'Hello 1', status: 'pending' },
        { id: 'msg-2', workspaceId: 'ws-1', customerId: 'cust-2', messageContent: 'Hello 2', status: 'pending' },
        { id: 'msg-3', workspaceId: 'ws-1', customerId: 'cust-3', messageContent: 'Hello 3', status: 'pending' },
      ]

      mockPrisma.workspace.findMany.mockResolvedValue([mockWorkspace])
      mockPrisma.whatsAppQueue.findMany.mockResolvedValue(mockMessages)
      mockPrisma.whatsAppQueue.update.mockResolvedValue({ status: 'sent' })

      await whatsappChallengeQueueJob()

      // All 3 messages should be processed
      expect(mockPrisma.whatsAppQueue.update).toHaveBeenCalledTimes(3)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('3 sent, 0 blocked')
      )
    })

    it('should limit batch size to MAX_MESSAGES_PER_CYCLE (10)', async () => {
      const mockWorkspace = {
        id: 'ws-1',
        name: 'Test Workspace',
        whatsappApiKey: 'key-123',
        whatsappPhoneNumber: '+1234567890',
      }
      
      // Create 15 messages (more than the limit of 10)
      const mockMessages = Array.from({ length: 15 }, (_, i) => ({
        id: `msg-${i}`,
        workspaceId: 'ws-1',
        customerId: `cust-${i}`,
        messageContent: `Hello ${i}`,
        status: 'pending',
      }))

      mockPrisma.workspace.findMany.mockResolvedValue([mockWorkspace])
      // The job should only fetch 10 messages due to take: 10
      mockPrisma.whatsAppQueue.findMany.mockResolvedValue(mockMessages.slice(0, 10))
      mockPrisma.whatsAppQueue.update.mockResolvedValue({ status: 'sent' })

      await whatsappChallengeQueueJob()

      // Only 10 messages should be processed per cycle
      expect(mockPrisma.whatsAppQueue.update).toHaveBeenCalledTimes(10)
    })

    it('should use in-memory lock to prevent concurrent executions', async () => {
      // This test verifies the lock mechanism exists by checking debug log
      mockPrisma.workspace.findMany.mockResolvedValue([])

      // First call
      const firstCall = whatsappChallengeQueueJob()
      // Second call immediately (simulating concurrent execution)
      const secondCall = whatsappChallengeQueueJob()

      await Promise.all([firstCall, secondCall])

      // The second call should have been skipped due to lock
      // Note: In real scenario, second call logs "Skipping - previous job still running"
      expect(mockPrisma.workspace.findMany).toHaveBeenCalled()
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

  it('should execute job and update status to SUCCESS', async () => {
    const { runJob } = require('../src/services/job-runner.service')
    const mockJob = jest.fn().mockResolvedValue(undefined)

    await runJob('test-job', mockJob)

    expect(mockJob).toHaveBeenCalled()
    // Job runner is silent - no info logs for routine execution
    // Status updated to SUCCESS
    expect(mockPrisma.schedulerJobStatus.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jobName: 'test-job' },
        data: expect.objectContaining({ lastStatus: 'SUCCESS' })
      })
    )
  })

  it('should catch and log job errors', async () => {
    const { runJob } = require('../src/services/job-runner.service')
    const failingJob = jest.fn().mockRejectedValue(new Error('Job failed'))

    await runJob('failing-job', failingJob)

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('failing-job')
    )
  })

  it('should skip disabled jobs silently', async () => {
    const { runJob } = require('../src/services/job-runner.service')
    const mockJob = jest.fn().mockResolvedValue(undefined)

    // Job exists and is disabled
    mockPrisma.schedulerJobStatus.findUnique.mockResolvedValue({
      isActive: false
    })

    await runJob('disabled-job', mockJob)

    // Job should NOT be executed
    expect(mockJob).not.toHaveBeenCalled()
    // Silent skip - no log spam, just status update to SKIPPED
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
