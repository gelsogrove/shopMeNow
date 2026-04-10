import { prisma } from '../config/database'
import logger from '../utils/logger'

/**
 * Agent Conversation Logs Cleanup Job
 * Runs daily at 23:35
 * 
 * Deletes AgentConversationLog records older than 180 days in batches.
 * These are audit trail entries tracking each agent execution step
 * (Router, ProductSearch, CartManagement, etc.). After 180 days they
 * are no longer useful for debugging or compliance.
 * 
 * Batch approach: deletes BATCH_SIZE records per cycle to avoid
 * locking the table for too long.
 */

const RETENTION_DAYS = 180
const BATCH_SIZE = 1000

export async function agentLogsCleanupJob(): Promise<void> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS)

  logger.info(`🧹 [AGENT-LOGS-CLEANUP] Starting (deleting before ${cutoffDate.toISOString()})`)

  let totalDeleted = 0
  let hasMore = true

  while (hasMore) {
    const oldLogs = await prisma.agentConversationLog.findMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
      select: { id: true },
      take: BATCH_SIZE,
    })

    if (oldLogs.length === 0) {
      hasMore = false
      break
    }

    const result = await prisma.agentConversationLog.deleteMany({
      where: {
        id: { in: oldLogs.map((l) => l.id) },
      },
    })

    totalDeleted += result.count

    logger.info(`🧹 [AGENT-LOGS-CLEANUP] Deleted batch: ${result.count} (total: ${totalDeleted})`)

    if (oldLogs.length < BATCH_SIZE) {
      hasMore = false
    }
  }

  if (totalDeleted > 0) {
    logger.info(`✅ [AGENT-LOGS-CLEANUP] Completed: ${totalDeleted} logs deleted (older than ${RETENTION_DAYS} days)`)
  } else {
    logger.info(`✅ [AGENT-LOGS-CLEANUP] No logs to delete (all newer than ${RETENTION_DAYS} days)`)
  }
}
