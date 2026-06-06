import { connectDatabase, disconnectDatabase } from './config/database'
import logger from './utils/logger'

// eChatbot Scheduler — Manual Job Runner
//
// ARCHITECTURE (2026-05-18):
// The continuous cron-based scheduler has been replaced by on-demand execution.
// All jobs are now run manually via:
//
//   npx ts-node src/scripts/run-job.ts <job-name>
//
// or via the npm scripts in package.json (e.g. npm run job:monthly-billing).
//
// WHY:
//   The only high-frequency job was whatsapp-channel-queue (every 5 sec) which
//   delivered WhatsApp messages from the queue. That job was removed because
//   messages are now sent synchronously via WhatsAppDirectSendService at call time.
//   With no sub-minute jobs remaining, a continuously running Heroku dyno is
//   wasteful — all remaining jobs are daily/monthly and can be triggered manually
//   or via Heroku Scheduler one-off dynos.
//
// EXCEPTION — Push Campaigns:
//   Push campaigns still write to WhatsAppQueue (bulk, rate-limited delivery).
//   The push-campaigns job must be run periodically when campaigns are active.
//   The whatsapp-queue-cleanup job should be run periodically to purge old records.
//
// Available jobs (run via: npx ts-node src/scripts/run-job.ts <name>):
//
//   push-campaigns              - Send pending push campaign messages
//   whatsapp-queue-cleanup      - Purge push campaign queue entries older than 7 days
//   short-urls-cleanup          - Delete expired short URLs
//   unused-images-cleanup       - Remove orphaned images and temp files
//   messages-archive            - Archive messages older than 6 months
//   soft-delete-cleanup         - Hard-delete soft-deleted records after retention period
//   support-attachments-cleanup - Delete attachments from old closed support tickets
//   monthly-billing             - Generate billing records for the previous month
//   conversation-messages-cleanup - Delete LLM context messages older than 90 days
//   agent-logs-cleanup          - Delete agent audit logs older than 180 days
//   webhook-events-cleanup      - Delete WhatsApp webhook dedup events older than 30 days
//   auth-attempts-cleanup       - Delete login/2FA attempt logs older than 90 days
//   reminder-locks-cleanup      - Delete expired appointment reminder dedup locks
//   appointment-reminder        - Send 24h and 1h appointment reminder notifications
//   wasender-qr-cleanup         - Clear expired Wasender QR codes
//   tts-audio-cleanup           - Delete TTS MP3 files older than 4h from Cloudinary

async function main() {
  logger.info('eChatbot Scheduler — no continuous jobs configured.')
  logger.info('Run jobs manually: npx ts-node src/scripts/run-job.ts <job-name>')

  await connectDatabase()

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
