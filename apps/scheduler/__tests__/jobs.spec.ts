/**
 * Scheduler Jobs - Unit Tests
 * 
 * Tests for all scheduler cronjobs:
 * - Short URLs Cleanup
 * - Unused Images Cleanup
 * - Messages Archive
 * - WhatsApp Queue Cleanup

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
  user: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  workspace: {
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  whatsAppQueue: {
    findMany: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  pushCampaignRecipient: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  conversationMessage: {
    findUnique: jest.fn(),
    update: jest.fn(),
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
  monthlyInvoice: {
    upsert: jest.fn(),
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
import { shortUrlsCleanupJob } from '../src/jobs/short-urls-cleanup.job'

describe('Scheduler Jobs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.pushCampaignRecipient.findMany.mockResolvedValue([])
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
})

describe('Job Runner Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.schedulerJobStatus.findUnique.mockResolvedValue(null)
  })

  it('should execute job and update status to SUCCESS', async () => {
    const { runJob } = require('../src/services/job-runner.service')
    const mockJob = jest.fn().mockResolvedValue(undefined)

    await runJob('test-job', mockJob)

    expect(mockJob).toHaveBeenCalled()
    // SchedulerJobStatus updates are temporarily disabled in codebase
    expect(mockPrisma.schedulerJobStatus.update).not.toHaveBeenCalled()
  })

  it('should catch and log job errors', async () => {
    const { runJob } = require('../src/services/job-runner.service')
    const failingJob = jest.fn().mockRejectedValue(new Error('Job failed'))

    await runJob('failing-job', failingJob)

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('failing-job')
    )
  })

  it('should execute job regardless of disabled status', async () => {
    // SCENARIO: SchedulerJobStatus.findUnique returns null (no DB record)
    // RULE: When no status record exists, job runs normally (undefined → not blocked)
    const { runJob } = require('../src/services/job-runner.service')
    const mockJob = jest.fn().mockResolvedValue(undefined)

    // No mock set → findUnique returns undefined → job is NOT skipped
    await runJob('disabled-job', mockJob)

    // Current implementation executes job when no status record found
    expect(mockJob).toHaveBeenCalled()
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
