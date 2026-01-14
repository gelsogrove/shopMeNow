/**
 * WhatsApp Queue Cleanup Job - Unit Tests
 * Tests deletion of old error and sent messages
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

// Mock prisma
const mockPrisma = {
  whatsAppQueue: {
    deleteMany: jest.fn(),
  },
}

jest.mock('../../../src/config/database', () => ({
  prisma: mockPrisma,
}))

import { whatsappQueueCleanupJob } from '../../../src/jobs/whatsapp-queue-cleanup.job'

describe('WhatsApp Queue Cleanup Job', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should delete error messages older than 7 days', async () => {
    mockPrisma.whatsAppQueue.deleteMany
      .mockResolvedValueOnce({ count: 15 }) // error messages
      .mockResolvedValueOnce({ count: 0 }) // sent messages

    await whatsappQueueCleanupJob()

    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    // Should delete error messages
    expect(mockPrisma.whatsAppQueue.deleteMany).toHaveBeenNthCalledWith(1, {
      where: {
        status: 'error',
        createdAt: {
          lt: expect.any(Date),
        },
      },
    })

    // Should delete sent messages
    expect(mockPrisma.whatsAppQueue.deleteMany).toHaveBeenNthCalledWith(2, {
      where: {
        status: 'sent',
        createdAt: {
          lt: expect.any(Date),
        },
      },
    })

    // Should log deletion
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Deleted 15 error messages and 0 sent messages')
    )
  })

  it('should delete sent messages older than 7 days', async () => {
    mockPrisma.whatsAppQueue.deleteMany
      .mockResolvedValueOnce({ count: 0 }) // error messages
      .mockResolvedValueOnce({ count: 42 }) // sent messages

    await whatsappQueueCleanupJob()

    expect(mockPrisma.whatsAppQueue.deleteMany).toHaveBeenCalledTimes(2)
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Deleted 0 error messages and 42 sent messages')
    )
  })

  it('should delete both error and sent messages', async () => {
    mockPrisma.whatsAppQueue.deleteMany
      .mockResolvedValueOnce({ count: 25 }) // error messages
      .mockResolvedValueOnce({ count: 100 }) // sent messages

    await whatsappQueueCleanupJob()

    expect(mockPrisma.whatsAppQueue.deleteMany).toHaveBeenCalledTimes(2)
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Deleted 25 error messages and 100 sent messages')
    )
  })

  it('should handle no messages to delete', async () => {
    mockPrisma.whatsAppQueue.deleteMany
      .mockResolvedValueOnce({ count: 0 }) // error messages
      .mockResolvedValueOnce({ count: 0 }) // sent messages

    await whatsappQueueCleanupJob()

    expect(mockPrisma.whatsAppQueue.deleteMany).toHaveBeenCalledTimes(2)
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('No old messages to delete')
    )
  })

  it('should use correct date calculation for 7 days ago', async () => {
    const beforeTest = new Date()
    beforeTest.setDate(beforeTest.getDate() - 7)

    mockPrisma.whatsAppQueue.deleteMany
      .mockResolvedValueOnce({ count: 10 })
      .mockResolvedValueOnce({ count: 5 })

    await whatsappQueueCleanupJob()

    const afterTest = new Date()
    afterTest.setDate(afterTest.getDate() - 7)

    // Verify the date passed to deleteMany is approximately 7 days ago
    const firstCall = mockPrisma.whatsAppQueue.deleteMany.mock.calls[0][0]
    const usedDate = firstCall.where.createdAt.lt

    // Should be within 1 second of 7 days ago (to account for test execution time)
    expect(Math.abs(usedDate.getTime() - beforeTest.getTime())).toBeLessThan(1000)
  })
})
