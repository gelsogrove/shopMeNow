import cron from 'node-cron'
import { connectDatabase, disconnectDatabase } from './config/database'
import { runJob } from './services/job-runner.service'
import {
  whatsappChannelQueueJob,
  shortUrlsCleanupJob,
  unusedImagesCleanupJob,
  monthlyBillingJob,
  messagesArchiveJob,
  whatsappQueueCleanupJob,
  softDeleteCleanupJob,
} from './jobs'
import { widgetTimeoutCleanupJob } from './jobs/widget-timeout-cleanup.job'
import logger from './utils/logger'

// eChatbot Scheduler Microservice
//
// Cron Jobs (ordered by execution time):
// 1. WhatsApp Channel Queue   - every 5 SECONDS (parallel send, with lock)
// 1.5. Widget Timeout Cleanup  - every 30 SECONDS (mark timed-out widget messages)
// 2. Short URLs Cleanup         - daily at 23:00
// 3. Storage Cleanup            - daily at 23:05 (unused images + temp + invoices)
// 4. Messages Archive           - daily at 23:10 (archive messages older than 6 months)
// 5. WhatsApp Queue Cleanup     - daily at 23:15 (delete errors/sent older than 7 days)
// 6. Soft Delete Cleanup        - daily at 23:20 (hard-delete records after retention period)
// 7. Monthly Billing            - 1st of month at 23:30
//
// HOW TO ENABLE/DISABLE JOBS:
// - From Backoffice: /schedulers page → toggle isActive
// - Jobs check isActive flag before running (skip if disabled)

async function main() {
  logger.info('🚀 Starting eChatbot Scheduler...')

  // Connect to database
  await connectDatabase()

  // ═══════════════════════════════════════════════════════════════════════════
  // Job 1: WhatsApp Channel Queue - every 5 seconds
  // Uses in-memory lock: if previous job is still running, skip
  // Sends messages in PARALLEL (safe for different customers)
  // ═══════════════════════════════════════════════════════════════════════════
  cron.schedule('*/5 * * * * *', async () => {
    await runJob('whatsapp-channel-queue', whatsappChannelQueueJob)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Job 1.5: Widget Timeout Cleanup - every 30 seconds
  // Marks widget messages as timed out after 30 polling attempts (15 seconds)
  // ═══════════════════════════════════════════════════════════════════════════
  cron.schedule('*/30 * * * * *', async () => {
    await runJob('widget-timeout-cleanup', widgetTimeoutCleanupJob)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Job 2: Short URLs Cleanup - daily at 23:00
  // Deletes expired short URLs
  // ═══════════════════════════════════════════════════════════════════════════
  cron.schedule('0 23 * * *', async () => {
    await runJob('short-urls-cleanup', shortUrlsCleanupJob)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Job 3: Storage Cleanup - daily at 23:05
  // Removes orphaned images + temp files + cancelled invoices
  // ═══════════════════════════════════════════════════════════════════════════
  cron.schedule('5 23 * * *', async () => {
    await runJob('unused-images-cleanup', unusedImagesCleanupJob)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Job 4: Messages Archive - daily at 23:10
  // Archives messages older than 6 months to reduce main table size
  // ═══════════════════════════════════════════════════════════════════════════
  cron.schedule('10 23 * * *', async () => {
    await runJob('messages-archive', messagesArchiveJob)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Job 5: WhatsApp Queue Cleanup - daily at 23:15
  // Deletes error and sent messages older than 7 days
  // ═══════════════════════════════════════════════════════════════════════════
  cron.schedule('15 23 * * *', async () => {
    await runJob('whatsapp-queue-cleanup', whatsappQueueCleanupJob)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Job 6: Soft Delete Cleanup - daily at 23:20
  // Hard-deletes soft-deleted records after retention period (default 90 days)
  // Feature 196 - Soft Delete System
  // ═══════════════════════════════════════════════════════════════════════════
  cron.schedule('20 23 * * *', async () => {
    await runJob('soft-delete-cleanup', softDeleteCleanupJob)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Job 7: Monthly Billing - 1st of each month at 23:30
  // Generates billing records for the previous month
  // ═══════════════════════════════════════════════════════════════════════════
  cron.schedule('30 23 1 * *', async () => {
    await runJob('monthly-billing', monthlyBillingJob)
  })

  logger.info('✅ Scheduler started successfully!')
  logger.info('📋 Scheduled jobs:')
  logger.info('   1. WhatsApp Channel Queue   - every 5 SECONDS')
  logger.info('   2. Short URLs Cleanup         - daily at 23:00')
  logger.info('   3. Unused Images Cleanup      - daily at 23:05')
  logger.info('   4. Messages Archive           - daily at 23:10')
  logger.info('   5. WhatsApp Queue Cleanup     - daily at 23:15')
  logger.info('   6. Soft Delete Cleanup        - daily at 23:20')
  logger.info('   7. Monthly Billing            - 1st of month at 23:30')

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
