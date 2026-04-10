import { prisma } from '../config/database'
import logger from '../utils/logger'

/**
 * Conversation Messages Cleanup Job
 * Runs daily at 23:30
 * 
 * Deletes ConversationMessage records older than 90 days in batches.
 * These are LLM context messages (user/assistant/function/system roles)
 * used for conversation history. After 90 days they are no longer needed
 * for LLM context (which only looks at recent messages).
 * 
 * Batch approach: deletes BATCH_SIZE records per cycle to avoid
 * locking the table for too long. The job runs daily so it gradually
 * catches up with old data.
 */

const RETENTION_DAYS = 90
const BATCH_SIZE = 1000

export async function conversationMessagesCleanupJob(): Promise<void> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS)

  logger.info(`🧹 [CONVERSATION-MESSAGES-CLEANUP] Starting (deleting before ${cutoffDate.toISOString()})`)

  let totalDeleted = 0
  let hasMore = true

  while (hasMore) {
    // Find IDs of old messages (batch)
    const oldMessages = await prisma.conversationMessage.findMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
      select: { id: true },
      take: BATCH_SIZE,
    })

    if (oldMessages.length === 0) {
      hasMore = false
      break
    }

    // Delete batch by IDs
    const result = await prisma.conversationMessage.deleteMany({
      where: {
        id: { in: oldMessages.map((m) => m.id) },
      },
    })

    totalDeleted += result.count

    logger.info(`🧹 [CONVERSATION-MESSAGES-CLEANUP] Deleted batch: ${result.count} (total: ${totalDeleted})`)

    // If we got less than batch size, we're done
    if (oldMessages.length < BATCH_SIZE) {
      hasMore = false
    }
  }

  if (totalDeleted > 0) {
    logger.info(`✅ [CONVERSATION-MESSAGES-CLEANUP] Completed: ${totalDeleted} messages deleted (older than ${RETENTION_DAYS} days)`)
  } else {
    logger.info(`✅ [CONVERSATION-MESSAGES-CLEANUP] No messages to delete (all newer than ${RETENTION_DAYS} days)`)
  }
}
