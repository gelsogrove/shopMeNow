/**
 * Scheduler for eChatbot Background Jobs
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
import { WorkspaceRepository } from "./repositories/workspace.repository"
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
