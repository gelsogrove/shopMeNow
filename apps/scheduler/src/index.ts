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
  supportAttachmentsCleanupJob,
  pushCampaignsJob,
  wasenderQrCleanupJob,
  appointmentReminderJob,
} from './jobs'
import logger from './utils/logger'

// eChatbot Scheduler Microservice
//
// Cron Jobs (ordered by execution time):
// 1. WhatsApp Channel Queue    - every 5 SECONDS (parallel send, with lock)
// 2. Push Campaigns Runner     - every minute
// 3. Wasender QR Cleanup       - every 10 minutes (clears expired QR codes)
// 4. Short URLs Cleanup        - daily at 23:00
// 5. Storage Cleanup           - daily at 23:05 (unused images + temp + invoices)
// 6. Messages Archive          - daily at 23:10 (archive messages older than 6 months)
// 7. WhatsApp Queue Cleanup    - daily at 23:15 (delete errors/sent older than 7 days)
// 8. Soft Delete Cleanup       - daily at 23:20 (hard-delete records after retention period)
// 9. Support Attachments Cleanup- daily at 23:25
// 10. Monthly Billing          - 1st of month at 23:30
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

  // Push Campaigns runner - every minute
  cron.schedule('0 * * * * *', async () => {
    await runJob('push-campaigns', pushCampaignsJob)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Job 2: Wasender QR Cleanup - every 10 minutes
  // Clears expired Wasender QR codes (older than 5 minutes)
  // ═══════════════════════════════════════════════════════════════════════════
  cron.schedule('*/10 * * * *', async () => {
    await runJob('wasender-qr-cleanup', wasenderQrCleanupJob)
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
  // Job 7: Support Attachments Cleanup - daily at 23:25
  // Deletes attachments from closed support tickets older than retention period
  // ═══════════════════════════════════════════════════════════════════════════
  cron.schedule('25 23 * * *', async () => {
    await runJob('support-attachments-cleanup', supportAttachmentsCleanupJob)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Job 8: Monthly Billing - 1st of each month at 23:30
  // Generates billing records for the previous month
  // ═══════════════════════════════════════════════════════════════════════════
  cron.schedule('30 23 1 * *', async () => {
    await runJob('monthly-billing', monthlyBillingJob)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Job 9: Appointment Reminders - every 15 minutes
  // Sends 24h and 1h reminder notifications for confirmed appointments
  // WhatsApp: €0.50/reminder | Email: free
  // ═══════════════════════════════════════════════════════════════════════════
  cron.schedule('*/15 * * * *', async () => {
    await runJob('appointment-reminder', appointmentReminderJob)
  })

  logger.info('✅ Scheduler started successfully!')
  logger.info('📋 Scheduled jobs:')
  logger.info('   1. WhatsApp Channel Queue       - every 5 SECONDS')
  logger.info('   2. Push Campaigns Runner        - every minute')
  logger.info('   3. Wasender QR Cleanup          - every 10 minutes')
  logger.info('   4. Short URLs Cleanup           - daily at 23:00')
  logger.info('   5. Unused Images Cleanup        - daily at 23:05')
  logger.info('   6. Messages Archive             - daily at 23:10')
  logger.info('   7. WhatsApp Queue Cleanup       - daily at 23:15')
  logger.info('   8. Soft Delete Cleanup          - daily at 23:20')
  logger.info('   9. Support Attachments Cleanup  - daily at 23:25')
  logger.info('   10. Monthly Billing            - 1st of month at 23:30')
  logger.info('   11. Appointment Reminders      - every 15 minutes')

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
