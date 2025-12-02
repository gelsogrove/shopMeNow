import { prisma } from '../config/database'
import logger from '../utils/logger'

/**
 * WhatsApp Queue Cleanup Job
 * Runs daily at 23:05
 * Deletes WhatsApp queue messages with status 'error' older than 7 days
 * 
 * Purpose: Keep the queue table clean by removing old error messages
 * that are no longer relevant for debugging or retry
 */
export async function whatsappQueueCleanupJob(): Promise<void> {
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  // Delete error messages older than 7 days
  const errorResult = await prisma.whatsAppQueue.deleteMany({
    where: {
      status: 'error',
      createdAt: {
        lt: oneWeekAgo,
      },
    },
  })

  // Also delete sent messages older than 7 days (they're just logs at this point)
  const sentResult = await prisma.whatsAppQueue.deleteMany({
    where: {
      status: 'sent',
      createdAt: {
        lt: oneWeekAgo,
      },
    },
  })

  const totalDeleted = errorResult.count + sentResult.count

  if (totalDeleted > 0) {
    logger.info(`🗑️ WhatsApp Queue Cleanup: Deleted ${errorResult.count} error messages and ${sentResult.count} sent messages (older than 7 days)`)
  } else {
    logger.info(`🗑️ WhatsApp Queue Cleanup: No old messages to delete`)
  }
}
