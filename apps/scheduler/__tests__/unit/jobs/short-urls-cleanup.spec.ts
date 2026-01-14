/**
 * Short URLs Cleanup Job - Unit Tests
 * Tests deletion of expired short URLs
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
  shortUrls: {
    deleteMany: jest.fn(),
  },
}

jest.mock('../../../src/config/database', () => ({
  prisma: mockPrisma,
}))

import { shortUrlsCleanupJob } from '../../../src/jobs/short-urls-cleanup.job'

describe('Short URLs Cleanup Job', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should delete expired short URLs', async () => {
    mockPrisma.shortUrls.deleteMany.mockResolvedValueOnce({ count: 25 })

    await shortUrlsCleanupJob()

    // Should delete expired URLs
    expect(mockPrisma.shortUrls.deleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: {
          lt: expect.any(Date),
        },
      },
    })

    // Should log deletion count
    expect(mockLogger.info).toHaveBeenCalledWith('Deleted 25 expired short URLs')
  })

  it('should handle no expired URLs', async () => {
    mockPrisma.shortUrls.deleteMany.mockResolvedValueOnce({ count: 0 })

    await shortUrlsCleanupJob()

    expect(mockPrisma.shortUrls.deleteMany).toHaveBeenCalledTimes(1)
    expect(mockLogger.info).toHaveBeenCalledWith('Deleted 0 expired short URLs')
  })

  it('should use current date for expiration check', async () => {
    const beforeTest = new Date()
    
    mockPrisma.shortUrls.deleteMany.mockResolvedValueOnce({ count: 10 })

    await shortUrlsCleanupJob()

    const afterTest = new Date()

    // Verify the date passed is current date
    const usedDate = mockPrisma.shortUrls.deleteMany.mock.calls[0][0].where.expiresAt.lt

    // Should be within 1 second of now (to account for test execution time)
    expect(usedDate.getTime()).toBeGreaterThanOrEqual(beforeTest.getTime())
    expect(usedDate.getTime()).toBeLessThanOrEqual(afterTest.getTime())
  })

  it('should handle large number of expired URLs', async () => {
    mockPrisma.shortUrls.deleteMany.mockResolvedValueOnce({ count: 1000 })

    await shortUrlsCleanupJob()

    expect(mockPrisma.shortUrls.deleteMany).toHaveBeenCalledTimes(1)
    expect(mockLogger.info).toHaveBeenCalledWith('Deleted 1000 expired short URLs')
  })

  it('should handle database errors gracefully', async () => {
    const error = new Error('Database connection failed')
    mockPrisma.shortUrls.deleteMany.mockRejectedValueOnce(error)

    await expect(shortUrlsCleanupJob()).rejects.toThrow('Database connection failed')

    expect(mockPrisma.shortUrls.deleteMany).toHaveBeenCalledTimes(1)
  })
})
