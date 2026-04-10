import { prisma } from '../config/database'
import logger from '../utils/logger'

/**
 * Reminder Locks Cleanup Job
 * Runs daily at 23:44
 * 
 * Deletes expired ReminderLock records (where expiresAt < now).
 * These are deduplication locks for appointment reminders (24h/1h).
 * Once expired, they are no longer needed to prevent duplicate sends.
 * 
 * Uses simple deleteMany since expired locks are safe to bulk-remove.
 */

export async function reminderLocksCleanupJob(): Promise<void> {
  const now = new Date()

  logger.info(`🧹 [REMINDER-LOCKS-CLEANUP] Starting (deleting expired before ${now.toISOString()})`)

  const result = await prisma.reminderLock.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  })

  if (result.count > 0) {
    logger.info(`✅ [REMINDER-LOCKS-CLEANUP] Completed: ${result.count} expired locks deleted`)
  } else {
    logger.info(`✅ [REMINDER-LOCKS-CLEANUP] No expired locks to delete`)
  }
}
