/**
 * Database Cleanup Jobs - Unit Tests
 *
 * Tests for 5 new cleanup jobs that prevent unbounded DB growth:
 * 1. ConversationMessage cleanup (90 days retention, batch delete)
 * 2. AgentConversationLog cleanup (180 days retention, batch delete)
 * 3. WhatsappWebhookEvent cleanup (30 days retention, batch delete)
 * 4. AuthenticationAttempt cleanup (90 days retention, batch delete)
 * 5. ReminderLock cleanup (expired locks, bulk delete)
 */

// === MOCKS MUST BE DECLARED BEFORE ANY IMPORTS ===

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

const mockPrisma: Record<string, any> = {
  conversationMessage: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  agentConversationLog: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  whatsappWebhookEvent: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  authenticationAttempt: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  reminderLock: {
    deleteMany: jest.fn(),
  },
}

jest.mock('../src/config/database', () => ({
  prisma: mockPrisma,
}))

// === NOW IMPORT MODULES ===
import { conversationMessagesCleanupJob } from '../src/jobs/conversation-messages-cleanup.job'
import { agentLogsCleanupJob } from '../src/jobs/agent-logs-cleanup.job'
import { webhookEventsCleanupJob } from '../src/jobs/webhook-events-cleanup.job'
import { authAttemptsCleanupJob } from '../src/jobs/auth-attempts-cleanup.job'
import { reminderLocksCleanupJob } from '../src/jobs/reminder-locks-cleanup.job'

describe('Database Cleanup Jobs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ═══════════════════════════════════════════════════════════════
  // 1. CONVERSATION MESSAGES CLEANUP (90 days)
  // ═══════════════════════════════════════════════════════════════
  describe('conversationMessagesCleanupJob', () => {
    it('should delete nothing when no old messages exist', async () => {
      // SCENARIO: All conversation messages are recent (< 90 days)
      // RULE: Job should log "no messages to delete" and not call deleteMany
      mockPrisma.conversationMessage.findMany.mockResolvedValue([])

      await conversationMessagesCleanupJob()

      expect(mockPrisma.conversationMessage.findMany).toHaveBeenCalledWith({
        where: { createdAt: { lt: expect.any(Date) } },
        select: { id: true },
        take: 1000,
      })
      expect(mockPrisma.conversationMessage.deleteMany).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('No messages to delete')
      )
    })

    it('should delete old messages in a single batch when count < BATCH_SIZE', async () => {
      // SCENARIO: 3 messages older than 90 days exist
      // RULE: Job deletes them in one batch, then stops
      const oldMessages = [
        { id: 'msg-1' },
        { id: 'msg-2' },
        { id: 'msg-3' },
      ]
      mockPrisma.conversationMessage.findMany
        .mockResolvedValueOnce(oldMessages) // First call: 3 messages
        // No second call needed since 3 < 1000 (BATCH_SIZE)

      mockPrisma.conversationMessage.deleteMany.mockResolvedValue({ count: 3 })

      await conversationMessagesCleanupJob()

      // RULE: deleteMany called with the IDs from findMany
      expect(mockPrisma.conversationMessage.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['msg-1', 'msg-2', 'msg-3'] } },
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('3 messages deleted')
      )
    })

    it('should process multiple batches when data exceeds BATCH_SIZE', async () => {
      // SCENARIO: 1500 old messages (BATCH_SIZE=1000, so 2 batches)
      // RULE: Job loops until findMany returns less than BATCH_SIZE
      const batch1 = Array.from({ length: 1000 }, (_, i) => ({ id: `msg-${i}` }))
      const batch2 = Array.from({ length: 500 }, (_, i) => ({ id: `msg-${1000 + i}` }))

      mockPrisma.conversationMessage.findMany
        .mockResolvedValueOnce(batch1)  // First batch: 1000 (= BATCH_SIZE → continue)
        .mockResolvedValueOnce(batch2)  // Second batch: 500 (< BATCH_SIZE → stop)

      mockPrisma.conversationMessage.deleteMany
        .mockResolvedValueOnce({ count: 1000 })
        .mockResolvedValueOnce({ count: 500 })

      await conversationMessagesCleanupJob()

      // RULE: deleteMany called twice (two batches)
      expect(mockPrisma.conversationMessage.deleteMany).toHaveBeenCalledTimes(2)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('1500 messages deleted')
      )
    })

    it('should use 90-day cutoff date', async () => {
      // SCENARIO: Verify the cutoff date is exactly 90 days ago
      // RULE: Only messages older than 90 days are selected for deletion
      mockPrisma.conversationMessage.findMany.mockResolvedValue([])

      const beforeExec = new Date()
      await conversationMessagesCleanupJob()

      const callArgs = mockPrisma.conversationMessage.findMany.mock.calls[0][0]
      const cutoffDate = callArgs.where.createdAt.lt as Date

      // Cutoff should be ~90 days before now (within 1 second tolerance)
      const expectedCutoff = new Date(beforeExec)
      expectedCutoff.setDate(expectedCutoff.getDate() - 90)
      const diffMs = Math.abs(cutoffDate.getTime() - expectedCutoff.getTime())
      expect(diffMs).toBeLessThan(1000) // Within 1 second
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // 2. AGENT CONVERSATION LOGS CLEANUP (180 days)
  // ═══════════════════════════════════════════════════════════════
  describe('agentLogsCleanupJob', () => {
    it('should delete nothing when no old logs exist', async () => {
      // SCENARIO: All agent logs are recent (< 180 days)
      // RULE: Job logs "no logs to delete"
      mockPrisma.agentConversationLog.findMany.mockResolvedValue([])

      await agentLogsCleanupJob()

      expect(mockPrisma.agentConversationLog.deleteMany).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('No logs to delete')
      )
    })

    it('should delete old agent logs in batches', async () => {
      // SCENARIO: 5 agent logs older than 180 days
      // RULE: Deletes in single batch (5 < 1000)
      const oldLogs = [
        { id: 'log-1' },
        { id: 'log-2' },
        { id: 'log-3' },
        { id: 'log-4' },
        { id: 'log-5' },
      ]
      mockPrisma.agentConversationLog.findMany.mockResolvedValueOnce(oldLogs)
      mockPrisma.agentConversationLog.deleteMany.mockResolvedValue({ count: 5 })

      await agentLogsCleanupJob()

      expect(mockPrisma.agentConversationLog.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['log-1', 'log-2', 'log-3', 'log-4', 'log-5'] } },
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('5 logs deleted')
      )
    })

    it('should use 180-day cutoff date', async () => {
      // SCENARIO: Verify the cutoff is 180 days (not 90)
      // RULE: Agent logs retained longer than messages for audit compliance
      mockPrisma.agentConversationLog.findMany.mockResolvedValue([])

      const beforeExec = new Date()
      await agentLogsCleanupJob()

      const callArgs = mockPrisma.agentConversationLog.findMany.mock.calls[0][0]
      const cutoffDate = callArgs.where.createdAt.lt as Date
      const expectedCutoff = new Date(beforeExec)
      expectedCutoff.setDate(expectedCutoff.getDate() - 180)
      const diffMs = Math.abs(cutoffDate.getTime() - expectedCutoff.getTime())
      expect(diffMs).toBeLessThan(1000)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // 3. WEBHOOK EVENTS CLEANUP (30 days)
  // ═══════════════════════════════════════════════════════════════
  describe('webhookEventsCleanupJob', () => {
    it('should delete nothing when no old events exist', async () => {
      // SCENARIO: All webhook events are recent (< 30 days)
      // RULE: Job logs "no events to delete"
      mockPrisma.whatsappWebhookEvent.findMany.mockResolvedValue([])

      await webhookEventsCleanupJob()

      expect(mockPrisma.whatsappWebhookEvent.deleteMany).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('No events to delete')
      )
    })

    it('should delete old webhook events', async () => {
      // SCENARIO: 2 webhook events older than 30 days (used for deduplication only)
      // RULE: Safe to delete - no risk of duplicate webhook processing after 30 days
      const oldEvents = [{ id: 'evt-1' }, { id: 'evt-2' }]
      mockPrisma.whatsappWebhookEvent.findMany.mockResolvedValueOnce(oldEvents)
      mockPrisma.whatsappWebhookEvent.deleteMany.mockResolvedValue({ count: 2 })

      await webhookEventsCleanupJob()

      expect(mockPrisma.whatsappWebhookEvent.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['evt-1', 'evt-2'] } },
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('2 events deleted')
      )
    })

    it('should use receivedAt field (not createdAt) for cutoff', async () => {
      // SCENARIO: WhatsappWebhookEvent uses receivedAt (not createdAt)
      // RULE: Must filter by receivedAt to match the schema
      mockPrisma.whatsappWebhookEvent.findMany.mockResolvedValue([])

      await webhookEventsCleanupJob()

      const callArgs = mockPrisma.whatsappWebhookEvent.findMany.mock.calls[0][0]
      expect(callArgs.where).toHaveProperty('receivedAt')
      expect(callArgs.where).not.toHaveProperty('createdAt')
    })

    it('should use 30-day cutoff date', async () => {
      // SCENARIO: Verify cutoff is 30 days (shortest retention — dedup only)
      mockPrisma.whatsappWebhookEvent.findMany.mockResolvedValue([])

      const beforeExec = new Date()
      await webhookEventsCleanupJob()

      const callArgs = mockPrisma.whatsappWebhookEvent.findMany.mock.calls[0][0]
      const cutoffDate = callArgs.where.receivedAt.lt as Date
      const expectedCutoff = new Date(beforeExec)
      expectedCutoff.setDate(expectedCutoff.getDate() - 30)
      const diffMs = Math.abs(cutoffDate.getTime() - expectedCutoff.getTime())
      expect(diffMs).toBeLessThan(1000)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // 4. AUTH ATTEMPTS CLEANUP (90 days)
  // ═══════════════════════════════════════════════════════════════
  describe('authAttemptsCleanupJob', () => {
    it('should delete nothing when no old attempts exist', async () => {
      // SCENARIO: All auth attempts are recent (< 90 days)
      // RULE: Job logs "no attempts to delete"
      mockPrisma.authenticationAttempt.findMany.mockResolvedValue([])

      await authAttemptsCleanupJob()

      expect(mockPrisma.authenticationAttempt.deleteMany).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('No attempts to delete')
      )
    })

    it('should delete old auth attempts', async () => {
      // SCENARIO: 4 login attempts older than 90 days
      // RULE: Deletes them — rate limiting only needs recent data
      const oldAttempts = [
        { id: 'att-1' }, { id: 'att-2' }, { id: 'att-3' }, { id: 'att-4' },
      ]
      mockPrisma.authenticationAttempt.findMany.mockResolvedValueOnce(oldAttempts)
      mockPrisma.authenticationAttempt.deleteMany.mockResolvedValue({ count: 4 })

      await authAttemptsCleanupJob()

      expect(mockPrisma.authenticationAttempt.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['att-1', 'att-2', 'att-3', 'att-4'] } },
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('4 attempts deleted')
      )
    })

    it('should use timestamp field (not createdAt) for cutoff', async () => {
      // SCENARIO: AuthenticationAttempt uses timestamp field (not createdAt)
      // RULE: Must filter by timestamp to match the schema
      mockPrisma.authenticationAttempt.findMany.mockResolvedValue([])

      await authAttemptsCleanupJob()

      const callArgs = mockPrisma.authenticationAttempt.findMany.mock.calls[0][0]
      expect(callArgs.where).toHaveProperty('timestamp')
      expect(callArgs.where).not.toHaveProperty('createdAt')
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // 5. REMINDER LOCKS CLEANUP (expired)
  // ═══════════════════════════════════════════════════════════════
  describe('reminderLocksCleanupJob', () => {
    it('should delete nothing when no expired locks exist', async () => {
      // SCENARIO: All reminder locks are still valid (expiresAt > now)
      // RULE: Job logs "no expired locks"
      mockPrisma.reminderLock.deleteMany.mockResolvedValue({ count: 0 })

      await reminderLocksCleanupJob()

      expect(mockPrisma.reminderLock.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('No expired locks')
      )
    })

    it('should delete expired locks', async () => {
      // SCENARIO: 10 reminder locks have expired (expiresAt < now)
      // RULE: Simple bulk delete (no batching needed — locks are small)
      mockPrisma.reminderLock.deleteMany.mockResolvedValue({ count: 10 })

      await reminderLocksCleanupJob()

      expect(mockPrisma.reminderLock.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('10 expired locks deleted')
      )
    })

    it('should use expiresAt field for cleanup (not time-based retention)', async () => {
      // SCENARIO: ReminderLock has its own expiresAt field
      // RULE: Unlike other jobs, this uses expiresAt < now (not createdAt - N days)
      mockPrisma.reminderLock.deleteMany.mockResolvedValue({ count: 0 })

      await reminderLocksCleanupJob()

      const callArgs = mockPrisma.reminderLock.deleteMany.mock.calls[0][0]
      expect(callArgs.where).toHaveProperty('expiresAt')
      expect(callArgs.where).not.toHaveProperty('createdAt')
    })
  })
})
