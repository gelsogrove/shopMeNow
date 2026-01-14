/**
 * Scheduler Jobs - Critical Data Deletion Tests
 * 
 * Ensures all scheduler jobs correctly DELETE data:
 * ✅ Short URLs Cleanup
 * ✅ WhatsApp Queue Cleanup  
 * ✅ Messages Archive (with deletion)
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
  whatsAppQueue: {
    deleteMany: jest.fn(),
  },
  message: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  messageArchive: {
    create: jest.fn(),
  },
  $transaction: jest.fn(async (callback: any) => {
    if (typeof callback === 'function') {
      return await callback({
        message: mockPrisma.message,
        messageArchive: mockPrisma.messageArchive,
      })
    }
    return null
  }),
}

jest.mock('../../../src/config/database', () => ({
  prisma: mockPrisma,
}))

import { shortUrlsCleanupJob } from '../../../src/jobs/short-urls-cleanup.job'
import { whatsappQueueCleanupJob } from '../../../src/jobs/whatsapp-queue-cleanup.job'
import { messagesArchiveJob } from '../../../src/jobs/messages-archive.job'

describe('Scheduler Jobs - Critical Data Deletion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ═══════════════════════════════════════════════════════════════
  // SHORT URLs CLEANUP - Deletes expired links
  // ═══════════════════════════════════════════════════════════════

  describe('Short URLs Cleanup', () => {
    it('should delete expired short URLs and log count', async () => {
      mockPrisma.shortUrls.deleteMany.mockResolvedValueOnce({ count: 42 })

      await shortUrlsCleanupJob()

      // ✅ VERIFY DELETION
      expect(mockPrisma.shortUrls.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date), // Current date
          },
        },
      })

      // ✅ VERIFY LOGGING
      expect(mockLogger.info).toHaveBeenCalledWith('Deleted 42 expired short URLs')
    })

    it('should handle zero expired URLs', async () => {
      mockPrisma.shortUrls.deleteMany.mockResolvedValueOnce({ count: 0 })

      await shortUrlsCleanupJob()

      expect(mockLogger.info).toHaveBeenCalledWith('Deleted 0 expired short URLs')
    })

    it('should use current date as cutoff', async () => {
      const beforeTest = new Date()
      mockPrisma.shortUrls.deleteMany.mockResolvedValueOnce({ count: 5 })

      await shortUrlsCleanupJob()

      const afterTest = new Date()
      const usedDate = mockPrisma.shortUrls.deleteMany.mock.calls[0][0].where.expiresAt.lt

      // Date should be between beforeTest and afterTest
      expect(usedDate.getTime()).toBeGreaterThanOrEqual(beforeTest.getTime())
      expect(usedDate.getTime()).toBeLessThanOrEqual(afterTest.getTime())
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // WhatsApp QUEUE CLEANUP - Deletes old error/sent messages
  // ═══════════════════════════════════════════════════════════════

  describe('WhatsApp Queue Cleanup', () => {
    it('should delete error messages older than 7 days', async () => {
      mockPrisma.whatsAppQueue.deleteMany
        .mockResolvedValueOnce({ count: 15 }) // errors
        .mockResolvedValueOnce({ count: 8 }) // sent

      await whatsappQueueCleanupJob()

      const calls = mockPrisma.whatsAppQueue.deleteMany.mock.calls

      // ✅ VERIFY ERROR DELETION
      expect(calls[0][0]).toEqual({
        where: {
          status: 'error',
          createdAt: {
            lt: expect.any(Date),
          },
        },
      })

      // ✅ VERIFY SENT DELETION
      expect(calls[1][0]).toEqual({
        where: {
          status: 'sent',
          createdAt: {
            lt: expect.any(Date),
          },
        },
      })

      // ✅ VERIFY LOGGING
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Deleted 15 error messages and 8 sent messages')
      )
    })

    it('should handle no messages to delete', async () => {
      mockPrisma.whatsAppQueue.deleteMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 })

      await whatsappQueueCleanupJob()

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('No old messages to delete')
      )
    })

    it('should delete only messages older than 7 days', async () => {
      mockPrisma.whatsAppQueue.deleteMany
        .mockResolvedValueOnce({ count: 5 })
        .mockResolvedValueOnce({ count: 3 })

      await whatsappQueueCleanupJob()

      const calls = mockPrisma.whatsAppQueue.deleteMany.mock.calls
      const sevenDaysAgo = calls[0][0].where.createdAt.lt

      // Verify it's approximately 7 days ago (within 1 second)
      const expectedDate = new Date()
      expectedDate.setDate(expectedDate.getDate() - 7)

      expect(Math.abs(sevenDaysAgo.getTime() - expectedDate.getTime())).toBeLessThan(1000)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // MESSAGES ARCHIVE - Archives old messages and DELETES them
  // ═══════════════════════════════════════════════════════════════

  describe('Messages Archive Job', () => {
    it('should archive AND delete old messages (atomic operation)', async () => {
      const oldDate = new Date()
      oldDate.setMonth(oldDate.getMonth() - 7)

      const mockMessage = {
        id: 'msg-1',
        direction: 'incoming',
        content: 'Old message',
        type: 'text',
        status: 'delivered',
        aiGenerated: false,
        metadata: null,
        read: true,
        createdAt: oldDate,
        updatedAt: oldDate,
        chatSessionId: 'session-1',
        functionCallsDebug: null,
        processingSource: 'llm',
        translatedQuery: null,
        processedPrompt: null,
        debugInfo: null,
        whatsappStatus: null,
        whatsappError: null,
        whatsappMessageId: null,
        sentBy: null,
        chatSession: {
          workspaceId: 'ws-1',
          customerId: 'customer-1',
        },
      }

      // First call returns old messages, second call returns empty (stop)
      mockPrisma.message.findMany
        .mockResolvedValueOnce([mockMessage])
        .mockResolvedValueOnce([])

      await messagesArchiveJob()

      // ✅ VERIFY TRANSACTION USED (atomicity guarantee)
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)

      // ✅ VERIFY ARCHIVE CREATED
      expect(mockPrisma.messageArchive.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            originalId: 'msg-1',
            content: 'Old message',
            chatSessionId: 'session-1',
          }),
        })
      )

      // ✅ VERIFY OLD MESSAGE DELETED
      expect(mockPrisma.message.deleteMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['msg-1'],
          },
        },
      })

      // ✅ VERIFY LOGGING
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Messages archive completed: 1 messages archived')
      )
    })

    it('should handle no messages to archive', async () => {
      mockPrisma.message.findMany.mockResolvedValueOnce([])

      await messagesArchiveJob()

      // ✅ NO TRANSACTION NEEDED
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()

      // ✅ NO DELETION OCCURS
      expect(mockPrisma.message.deleteMany).not.toHaveBeenCalled()

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('No messages to archive')
      )
    })

    it('should use 6-month cutoff date', async () => {
      mockPrisma.message.findMany.mockResolvedValueOnce([])

      await messagesArchiveJob()

      const usedDate = mockPrisma.message.findMany.mock.calls[0][0].where.createdAt.lt

      // Should be approximately 6 months ago
      const expectedDate = new Date()
      expectedDate.setMonth(expectedDate.getMonth() - 6)

      // Allow 1 second tolerance for test execution time
      expect(Math.abs(usedDate.getTime() - expectedDate.getTime())).toBeLessThan(1000)
    })
  })
})
