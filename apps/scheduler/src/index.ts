import cron from 'node-cron'
import { connectDatabase, disconnectDatabase } from './config/database'
import { runJob } from './services/job-runner.service'
import {
  whatsappChallengeQueueJob,
  shortUrlsCleanupJob,
  blockedCustomersCleanupJob,
  unusedImagesCleanupJob,
  monthlyBillingJob,
  messagesArchiveJob,
} from './jobs'
import logger from './utils/logger'

// ShopME Scheduler Microservice
//
// Cron Jobs:
// 1. WhatsApp Challenge Queue  - every 3 minutes
// 2. Short URLs Cleanup        - daily at 23:00
// 3. Blocked Customers Cleanup - every 3 days at 23:01
// 4. Unused Images Cleanup     - daily at 23:02
// 5. Monthly Billing           - 1st of month at 12:00
// 6. Messages Archive          - weekly on Sunday at 03:00

async function main() {
  logger.info('🚀 Starting ShopME Scheduler...')

  // Connect to database
  await connectDatabase()

  // Job 1: WhatsApp Challenge Queue - every 3 minutes
  cron.schedule('*/3 * * * *', async () => {
    await runJob('whatsapp-challenge-queue', whatsappChallengeQueueJob)
  })

  // Job 2: Short URLs Cleanup - daily at 23:00
  cron.schedule('0 23 * * *', async () => {
    await runJob('short-urls-cleanup', shortUrlsCleanupJob)
  })

  // Job 3: Blocked Customers Cleanup - every 3 days at 23:01
  cron.schedule('1 23 */3 * *', async () => {
    await runJob('blocked-customers-cleanup', blockedCustomersCleanupJob)
  })

  // Job 4: Unused Images Cleanup - daily at 23:02
  cron.schedule('2 23 * * *', async () => {
    await runJob('unused-images-cleanup', unusedImagesCleanupJob)
  })

  // Job 5: Monthly Billing - 1st of each month at 12:00
  cron.schedule('0 12 1 * *', async () => {
    await runJob('monthly-billing', monthlyBillingJob)
  })

  // Job 6: Messages Archive - weekly on Sunday at 03:00
  // Moves messages older than 6 months to archive table
  cron.schedule('0 3 * * 0', async () => {
    await runJob('messages-archive', messagesArchiveJob)
  })

  logger.info('✅ Scheduler started successfully!')
  logger.info('📋 Scheduled jobs:')
  logger.info('   1. WhatsApp Challenge Queue  - every 3 minutes')
  logger.info('   2. Short URLs Cleanup        - daily at 23:00')
  logger.info('   3. Blocked Customers Cleanup - every 3 days at 23:01')
  logger.info('   4. Unused Images Cleanup     - daily at 23:02')
  logger.info('   5. Monthly Billing           - 1st of month at 12:00')
  logger.info('   6. Messages Archive          - weekly on Sunday at 03:00')

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down scheduler...')
    await disconnectDatabase()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    logger.info('Shutting down scheduler...')
    await disconnectDatabase()
    process.exit(0)
  })
}

main().catch((error) => {
  logger.error('Failed to start scheduler:', error)
  process.exit(1)
})
