/**
 * Scheduler for eChatbot Background Jobs
 *
 * Uses node-cron to run periodic maintenance tasks:
 * 1. Mark expired search conversations (every 5 minutes)
 * 2. Delete old search conversations >30 days (weekly)
 * 3. Month-end billing: invoice + PayPal charge for the PREVIOUS month
 *    (1st of each month, 23:30 Europe/Rome)
 *
 * Usage:
 * - Import and call startScheduler() in index.ts
 * - All tasks run in background, non-blocking
 * - Errors logged but don't crash the application
 *
 * Cron syntax: [minute] [hour] [day] [month] [day-of-week]
 * Examples:
 * - Every 5 minutes: asterisk-slash-5 space asterisk space asterisk space asterisk space asterisk
 * - Every Sunday at 3:00 AM: 0 3 asterisk asterisk 0
 */

import cron from "node-cron"
import { prisma } from "@echatbot/database"
import { SearchConversationRepository } from "./repositories/searchConversation.repository"
import { WorkspaceRepository } from "./repositories/workspace.repository"
import { runMonthEndBilling } from "./services/month-end-billing.service"
import { WhatsAppRetentionService } from "./services/whatsapp-retention.service"
import logger from "./utils/logger"

const searchConversationRepo = new SearchConversationRepository()
const workspaceRepo = new WorkspaceRepository()

/**
 * Job 1: Mark expired search conversations
 * Runs every 5 minutes
 * Changes ACTIVE conversations past expiresAt to EXPIRED
 * 🔒 SECURITY: Iterates over ALL workspaces to maintain isolation
 */
const markExpiredConversationsJob = cron.schedule("*/5 * * * *", async () => {
  try {
    logger.info("⏰ Running job: Mark expired search conversations")
    
    // 🔒 Get all workspaces and process each one
    const workspaces = await workspaceRepo.findAll()
    let totalMarked = 0
    
    for (const workspace of workspaces) {
      try {
        const count = await searchConversationRepo.markExpired(workspace.id)
        if (count > 0) {
          logger.info(`✅ Marked ${count} conversations as expired in workspace ${workspace.id}`)
          totalMarked += count
        }
      } catch (error) {
        logger.error(`❌ Error marking expired conversations for workspace ${workspace.id}:`, error)
      }
    }
    
    if (totalMarked > 0) {
      logger.info(`✅ Total: Marked ${totalMarked} search conversations as expired across all workspaces`)
    }
  } catch (error) {
    logger.error("❌ Error in markExpiredConversationsJob:", error)
  }
})

/**
 * Job 2: Delete old search conversations
 * Runs every Sunday at 3:00 AM
 * Deletes conversations older than 30 days
 * 🔒 SECURITY: Iterates over ALL workspaces to maintain isolation
 */
const deleteOldConversationsJob = cron.schedule("0 3 * * 0", async () => {
  try {
    logger.info("⏰ Running job: Delete old search conversations")
    
    // 🔒 Get all workspaces and process each one
    const workspaces = await workspaceRepo.findAll()
    let totalDeleted = 0
    
    for (const workspace of workspaces) {
      try {
        const count = await searchConversationRepo.deleteOld(30, workspace.id)
        if (count > 0) {
          logger.info(`✅ Deleted ${count} conversations older than 30 days in workspace ${workspace.id}`)
          totalDeleted += count
        }
      } catch (error) {
        logger.error(`❌ Error deleting old conversations for workspace ${workspace.id}:`, error)
      }
    }
    
    if (totalDeleted > 0) {
      logger.info(`✅ Total: Deleted ${totalDeleted} search conversations across all workspaces`)
    }
  } catch (error) {
    logger.error("❌ Error in deleteOldConversationsJob:", error)
  }
})

/**
 * Job 3: Month-end billing
 * Runs on the 1st of each month at 23:30 (Europe/Rome).
 * ALWAYS bills the PREVIOUS month: one invoice per owner
 * (subscription + recharges), then one automatic PayPal charge.
 * If the charge fails the invoice stays FAILED and surfaces in the
 * backoffice Collections page for manual operator retries (soft block).
 */
const monthEndBillingJob = cron.schedule(
  "30 23 1 * *",
  async () => {
    try {
      logger.info("⏰ Running job: Month-end billing")
      await runMonthEndBilling()
    } catch (error) {
      logger.error("❌ Error in monthEndBillingJob:", error)
    }
  },
  { timezone: "Europe/Rome" }
)

/**
 * Job 4: WhatsApp retention cleanup
 * Runs daily at 4:00 AM.
 * Purges webhook dedup events >30 days and terminal-status queue rows
 * >30 days (plus expired anonymous widget sessions) — see
 * WhatsAppRetentionService for the exact rules.
 */
const whatsappRetentionService = new WhatsAppRetentionService(prisma)
const whatsappRetentionJob = cron.schedule("0 4 * * *", async () => {
  try {
    logger.info("⏰ Running job: WhatsApp retention cleanup")
    await whatsappRetentionService.cleanup()
  } catch (error) {
    logger.error("❌ Error in whatsappRetentionJob:", error)
  }
})

/**
 * Start all scheduled jobs
 * Call this function in index.ts after server startup
 */
export function startScheduler(): void {
  // Heroku scale-out guard: cron jobs must run on exactly ONE process, or
  // scaling the web formation to 2+ dynos would fire every job once per dyno
  // (the month-end billing charges real money — the atomic attempt claims
  // would hold, but only one scheduler instance should exist by design).
  // Heroku sets DYNO (web.1, web.2, …); locally it is undefined → start.
  const dyno = process.env.DYNO
  if (dyno && dyno !== "web.1") {
    logger.info(`⏭️ Scheduler skipped on ${dyno} — cron jobs run on web.1 only`)
    return
  }

  logger.info("🚀 Starting background scheduler...")

  // Start all jobs
  markExpiredConversationsJob.start()
  deleteOldConversationsJob.start()
  monthEndBillingJob.start()
  whatsappRetentionJob.start()

  logger.info("✅ Scheduler started successfully")
  logger.info("  - Mark expired conversations: Every 5 minutes")
  logger.info("  - Delete old conversations: Every Sunday at 3:00 AM")
  logger.info("  - Month-end billing: 1st of month at 23:30 (Europe/Rome)")
  logger.info("  - WhatsApp retention cleanup: Every day at 4:00 AM")
}

/**
 * Stop all scheduled jobs
 * Call this for graceful shutdown
 */
export function stopScheduler(): void {
  logger.info("⏹️ Stopping background scheduler...")

  markExpiredConversationsJob.stop()
  deleteOldConversationsJob.stop()
  monthEndBillingJob.stop()

  logger.info("✅ Scheduler stopped successfully")
}

/**
 * Get scheduler status
 * Useful for monitoring/health checks
 */
export function getSchedulerStatus(): {
  markExpiredJob: { running: boolean; schedule: string }
  deleteOldJob: { running: boolean; schedule: string }
  monthEndBillingJob: { running: boolean; schedule: string }
} {
  return {
    markExpiredJob: {
      running: markExpiredConversationsJob.getStatus() === "scheduled",
      schedule: "*/5 * * * *",
    },
    deleteOldJob: {
      running: deleteOldConversationsJob.getStatus() === "scheduled",
      schedule: "0 3 * * 0",
    },
    monthEndBillingJob: {
      running: monthEndBillingJob.getStatus() === "scheduled",
      schedule: "30 23 1 * * (Europe/Rome)",
    },
  }
}
