/**
 * Scheduler for ShopME Background Jobs
 *
 * Uses node-cron to run periodic maintenance tasks:
 * 1. Mark expired search conversations (every 5 minutes)
 * 2. Delete old search conversations >30 days (weekly)
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
import { SearchConversationRepository } from "./repositories/searchConversation.repository"
import logger from "./utils/logger"

const searchConversationRepo = new SearchConversationRepository()

/**
 * Job 1: Mark expired search conversations
 * Runs every 5 minutes
 * Changes ACTIVE conversations past expiresAt to EXPIRED
 */
const markExpiredConversationsJob = cron.schedule("*/5 * * * *", async () => {
  try {
    logger.info("⏰ Running job: Mark expired search conversations")
    const count = await searchConversationRepo.markExpired()
    if (count > 0) {
      logger.info(`✅ Marked ${count} search conversations as expired`)
    }
  } catch (error) {
    logger.error("❌ Error in markExpiredConversationsJob:", error)
  }
})

/**
 * Job 2: Delete old search conversations
 * Runs every Sunday at 3:00 AM
 * Deletes conversations older than 30 days
 */
const deleteOldConversationsJob = cron.schedule("0 3 * * 0", async () => {
  try {
    logger.info("⏰ Running job: Delete old search conversations")
    const count = await searchConversationRepo.deleteOld(30)
    if (count > 0) {
      logger.info(`✅ Deleted ${count} search conversations older than 30 days`)
    }
  } catch (error) {
    logger.error("❌ Error in deleteOldConversationsJob:", error)
  }
})

/**
 * Start all scheduled jobs
 * Call this function in index.ts after server startup
 */
export function startScheduler(): void {
  logger.info("🚀 Starting background scheduler...")

  // Start all jobs
  markExpiredConversationsJob.start()
  deleteOldConversationsJob.start()

  logger.info("✅ Scheduler started successfully")
  logger.info("  - Mark expired conversations: Every 5 minutes")
  logger.info("  - Delete old conversations: Every Sunday at 3:00 AM")
}

/**
 * Stop all scheduled jobs
 * Call this for graceful shutdown
 */
export function stopScheduler(): void {
  logger.info("⏹️ Stopping background scheduler...")

  markExpiredConversationsJob.stop()
  deleteOldConversationsJob.stop()

  logger.info("✅ Scheduler stopped successfully")
}

/**
 * Get scheduler status
 * Useful for monitoring/health checks
 */
export function getSchedulerStatus(): {
  markExpiredJob: { running: boolean; schedule: string }
  deleteOldJob: { running: boolean; schedule: string }
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
  }
}
