import { prisma } from '../config/database'
import logger from '../utils/logger'

/**
 * Authentication Attempts Cleanup Job
 * Runs daily at 23:42
 * 
 * Deletes AuthenticationAttempt records older than 90 days in batches.
 * These are login/2FA/registration attempt logs used for rate limiting
 * and security auditing. After 90 days they are no longer relevant.
 * 
 * Batch approach: deletes BATCH_SIZE records per cycle.
 */

const RETENTION_DAYS = 90
const BATCH_SIZE = 1000

export async function authAttemptsCleanupJob(): Promise<void> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS)

  logger.info(`🧹 [AUTH-ATTEMPTS-CLEANUP] Starting (deleting before ${cutoffDate.toISOString()})`)

  let totalDeleted = 0
  let hasMore = true

  while (hasMore) {
    const oldAttempts = await prisma.authenticationAttempt.findMany({
      where: {
        timestamp: { lt: cutoffDate },
      },
      select: { id: true },
      take: BATCH_SIZE,
    })

    if (oldAttempts.length === 0) {
      hasMore = false
      break
    }

    const result = await prisma.authenticationAttempt.deleteMany({
      where: {
        id: { in: oldAttempts.map((a) => a.id) },
      },
    })

    totalDeleted += result.count

    logger.info(`🧹 [AUTH-ATTEMPTS-CLEANUP] Deleted batch: ${result.count} (total: ${totalDeleted})`)

    if (oldAttempts.length < BATCH_SIZE) {
      hasMore = false
    }
  }

  if (totalDeleted > 0) {
    logger.info(`✅ [AUTH-ATTEMPTS-CLEANUP] Completed: ${totalDeleted} attempts deleted (older than ${RETENTION_DAYS} days)`)
  } else {
    logger.info(`✅ [AUTH-ATTEMPTS-CLEANUP] No attempts to delete (all newer than ${RETENTION_DAYS} days)`)
  }
}
