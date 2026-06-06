/**
 * Job Runner Script
 *
 * Runs a single scheduler job by name and exits.
 * Used to execute cleanup and campaign jobs as one-shot npm scripts
 * instead of a continuously running scheduler process.
 *
 * Usage:
 *   npx ts-node src/scripts/run-job.ts <job-name>
 *
 * Available jobs:
 *   push-campaigns            - Send pending push campaign messages
 *   whatsapp-queue-cleanup    - Delete old push campaign queue entries (>7 days)
 *   short-urls-cleanup        - Delete expired short URLs
 *   unused-images-cleanup     - Remove orphaned images and temp files
 *   messages-archive          - Archive messages older than 6 months
 *   soft-delete-cleanup       - Hard-delete soft-deleted records after retention period
 *   support-attachments-cleanup - Delete attachments from old closed support tickets
 *   monthly-billing           - Generate billing records for the previous month
 *   conversation-messages-cleanup - Delete LLM context messages older than 90 days
 *   agent-logs-cleanup        - Delete agent audit logs older than 180 days
 *   webhook-events-cleanup    - Delete WhatsApp webhook dedup events older than 30 days
 *   auth-attempts-cleanup     - Delete login/2FA attempt logs older than 90 days
 *   reminder-locks-cleanup    - Delete expired appointment reminder dedup locks
 *   appointment-reminder      - Send 24h and 1h appointment reminder notifications
 *   wasender-qr-cleanup       - Clear expired Wasender QR codes
 */

import { connectDatabase, disconnectDatabase } from '../config/database'
import logger from '../utils/logger'

const JOB_MAP: Record<string, () => Promise<void>> = {
  'push-campaigns': async () => {
    const { pushCampaignsJob } = await import('../jobs/push-campaigns.job')
    await pushCampaignsJob()
  },
  'whatsapp-queue-cleanup': async () => {
    const { whatsappQueueCleanupJob } = await import('../jobs/whatsapp-queue-cleanup.job')
    await whatsappQueueCleanupJob()
  },
  'short-urls-cleanup': async () => {
    const { shortUrlsCleanupJob } = await import('../jobs/short-urls-cleanup.job')
    await shortUrlsCleanupJob()
  },
  'unused-images-cleanup': async () => {
    const { unusedImagesCleanupJob } = await import('../jobs/unused-images-cleanup.job')
    await unusedImagesCleanupJob()
  },
  'messages-archive': async () => {
    const { messagesArchiveJob } = await import('../jobs/messages-archive.job')
    await messagesArchiveJob()
  },
  'soft-delete-cleanup': async () => {
    const { softDeleteCleanupJob } = await import('../jobs/soft-delete-cleanup.job')
    await softDeleteCleanupJob()
  },
  'support-attachments-cleanup': async () => {
    const { supportAttachmentsCleanupJob } = await import('../jobs/support-attachments-cleanup.job')
    await supportAttachmentsCleanupJob()
  },
  'monthly-billing': async () => {
    const { monthlyBillingJob } = await import('../jobs/monthly-billing.job')
    await monthlyBillingJob()
  },
  'conversation-messages-cleanup': async () => {
    const { conversationMessagesCleanupJob } = await import('../jobs/conversation-messages-cleanup.job')
    await conversationMessagesCleanupJob()
  },
  'agent-logs-cleanup': async () => {
    const { agentLogsCleanupJob } = await import('../jobs/agent-logs-cleanup.job')
    await agentLogsCleanupJob()
  },
  'webhook-events-cleanup': async () => {
    const { webhookEventsCleanupJob } = await import('../jobs/webhook-events-cleanup.job')
    await webhookEventsCleanupJob()
  },
  'auth-attempts-cleanup': async () => {
    const { authAttemptsCleanupJob } = await import('../jobs/auth-attempts-cleanup.job')
    await authAttemptsCleanupJob()
  },
  'reminder-locks-cleanup': async () => {
    const { reminderLocksCleanupJob } = await import('../jobs/reminder-locks-cleanup.job')
    await reminderLocksCleanupJob()
  },
  'appointment-reminder': async () => {
    const { appointmentReminderJob } = await import('../jobs/appointment-reminder.job')
    await appointmentReminderJob()
  },
  'wasender-qr-cleanup': async () => {
    const { wasenderQrCleanupJob } = await import('../jobs/wasender-qr-cleanup.job')
    await wasenderQrCleanupJob()
  },
  'tts-audio-cleanup': async () => {
    const { ttsAudioCleanupJob } = await import('../jobs/tts-audio-cleanup.job')
    await ttsAudioCleanupJob()
  },
}

async function main() {
  const jobName = process.argv[2]

  if (!jobName) {
    console.error('❌ Usage: npx ts-node src/scripts/run-job.ts <job-name>')
    console.error('   Available jobs:', Object.keys(JOB_MAP).join(', '))
    process.exit(1)
  }

  const job = JOB_MAP[jobName]
  if (!job) {
    console.error(`❌ Unknown job: "${jobName}"`)
    console.error('   Available jobs:', Object.keys(JOB_MAP).join(', '))
    process.exit(1)
  }

  logger.info(`🚀 Starting job: ${jobName}`)
  const startTime = Date.now()

  await connectDatabase()

  try {
    await job()
    const duration = Date.now() - startTime
    logger.info(`✅ Job "${jobName}" completed in ${duration}ms`)
  } catch (error) {
    logger.error(`❌ Job "${jobName}" failed:`, error)
    process.exitCode = 1
  } finally {
    await disconnectDatabase()
  }
}

main()
