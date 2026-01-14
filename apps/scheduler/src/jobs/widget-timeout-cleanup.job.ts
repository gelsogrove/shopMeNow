/**
 * Widget Timeout Cleanup Job
 * Marks widget messages as timed out after 30 polling attempts (15 seconds)
 * Runs every 30 seconds
 */

import { prisma } from '../config/database'
import logger from '../utils/logger'

let isProcessing = false

export async function widgetTimeoutCleanupJob(): Promise<void> {
  if (isProcessing) {
    logger.debug('[Widget Timeout] Job already running, skipping...')
    return
  }

  isProcessing = true

  try {
    logger.debug('[Widget Timeout] Starting cleanup...')

    // Find messages with >= 30 polling attempts (15+ seconds elapsed)
    const timedOutMessages = await prisma.whatsAppQueue.findMany({
      where: {
        channel: 'widget',
        status: 'pending',
        pollingAttempts: { gte: 30 },
      },
      take: 100, // Process 100 at a time
    })

    if (timedOutMessages.length === 0) {
      logger.debug('[Widget Timeout] No timed-out messages found')
      return
    }

    logger.warn(`⏰ Found ${timedOutMessages.length} timed-out widget messages`)

    // Mark as error
    const updatePromises = timedOutMessages.map((message) =>
      prisma.whatsAppQueue.update({
        where: { id: message.id },
        data: {
          status: 'error',
          errorMessage: 'Timeout: No response within 15 seconds',
        },
      })
    )

    await Promise.allSettled(updatePromises)

    logger.info(`✅ Marked ${timedOutMessages.length} widget messages as timed out`)
  } catch (error) {
    logger.error('❌ Error in widget timeout cleanup job:', error)
  } finally {
    isProcessing = false
  }
}
