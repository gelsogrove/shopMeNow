/**
 * WasenderAPI QR String Cleanup Job — Unit Tests
 *
 * SCENARIOS TESTED:
 * 1. Normal operation: clears stale QR strings older than TTL
 * 2. Does NOT clear QR if session is already connected
 * 3. Does NOT touch workspaces without QR string
 * 4. Handles zero records gracefully
 * 5. Error propagation on DB failure
 */

// ─── Mock logger FIRST ────────────────────────────────────────────────────────
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}
jest.mock('../../../src/utils/logger', () => ({ __esModule: true, default: mockLogger }))

// ─── Mock Prisma ──────────────────────────────────────────────────────────────
const mockPrisma = {
  workspace: {
    updateMany: jest.fn(),
  },
}
jest.mock('../../../src/config/database', () => ({ prisma: mockPrisma }))

import { wasenderQrCleanupJob } from '../../../src/jobs/wasender-qr-cleanup.job'

describe('wasenderQrCleanupJob', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset env var so TTL is predictable in tests (5 minutes = default)
    delete process.env.WASENDER_QR_TTL_MINUTES
  })

  it('should clear stale QR strings for non-connected sessions', async () => {
    // SCENARIO: 3 workspaces have old QR strings (pending scan, timed out after 5m)
    // RULE: wasenderQrString and wasenderQrGeneratedAt must be nulled out
    mockPrisma.workspace.updateMany.mockResolvedValue({ count: 3 })

    await wasenderQrCleanupJob()

    expect(mockPrisma.workspace.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          wasenderQrString: { not: null },
          wasenderSessionStatus: { not: 'connected' },
        }),
        data: {
          wasenderQrString: null,
          wasenderQrGeneratedAt: null,
        },
      })
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Cleared 3 stale QR strings')
    )
  })

  it('should use TTL cutoff older than 5 minutes (default)', async () => {
    // SCENARIO: default TTL is 5 minutes
    // RULE: wasenderQrGeneratedAt < (now - 5min) → should be cleared
    mockPrisma.workspace.updateMany.mockResolvedValue({ count: 0 })

    const before = new Date(Date.now() - 5 * 60 * 1000)
    await wasenderQrCleanupJob()
    const after = new Date(Date.now() - 5 * 60 * 1000)

    const callArg = mockPrisma.workspace.updateMany.mock.calls[0][0]
    const ttlDate: Date = callArg.where.wasenderQrGeneratedAt.lt

    // TTL date should be within the 5-minute window
    expect(ttlDate.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000)
    expect(ttlDate.getTime()).toBeLessThanOrEqual(after.getTime() + 1000)
  })

  it('should NOT clear QR for sessions that are already connected', async () => {
    // SCENARIO: a workspace has wasenderQrString still set but status = 'connected'
    // RULE: connected sessions must never have their QR touched — they no longer need it
    //       but removing it while active could cause UI confusion
    mockPrisma.workspace.updateMany.mockResolvedValue({ count: 0 })

    await wasenderQrCleanupJob()

    const callArg = mockPrisma.workspace.updateMany.mock.calls[0][0]
    expect(callArg.where.wasenderSessionStatus).toEqual({ not: 'connected' })
  })

  it('should log 0 cleared when no stale QR strings exist', async () => {
    // SCENARIO: all sessions are either connected or have no QR string — nothing to clean
    mockPrisma.workspace.updateMany.mockResolvedValue({ count: 0 })

    await wasenderQrCleanupJob()

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Cleared 0 stale QR strings')
    )
  })

  it('should propagate error and log it when DB call fails', async () => {
    // SCENARIO: database is unreachable during cleanup
    // RULE: must throw (so scheduler marks job as FAILED) and log error
    const dbError = new Error('DB connection lost')
    mockPrisma.workspace.updateMany.mockRejectedValue(dbError)

    await expect(wasenderQrCleanupJob()).rejects.toThrow('DB connection lost')
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed'),
      dbError
    )
  })

  it('should respect custom TTL from environment variable', async () => {
    // SCENARIO: operator sets WASENDER_QR_TTL_MINUTES=2 for tighter security
    // RULE: TTL must reflect env var value, not hardcoded default
    // NOTE: module must be re-required because TTL is read at module load time
    jest.resetModules()

    const mockPrisma2 = { workspace: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } }
    jest.mock('../../../src/config/database', () => ({ prisma: mockPrisma2 }))
    jest.mock('../../../src/utils/logger', () => ({ __esModule: true, default: mockLogger }))

    process.env.WASENDER_QR_TTL_MINUTES = '2'
    const { wasenderQrCleanupJob: freshJob } = await import('../../../src/jobs/wasender-qr-cleanup.job')

    const before = new Date(Date.now() - 2 * 60 * 1000)
    await freshJob()
    const after = new Date(Date.now() - 2 * 60 * 1000)

    const callArg = mockPrisma2.workspace.updateMany.mock.calls[0][0]
    const ttlDate: Date = callArg.where.wasenderQrGeneratedAt.lt

    expect(ttlDate.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000)
    expect(ttlDate.getTime()).toBeLessThanOrEqual(after.getTime() + 1000)

    delete process.env.WASENDER_QR_TTL_MINUTES
  })
})
