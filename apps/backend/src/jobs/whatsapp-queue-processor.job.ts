// External dependencies
import cron from "node-cron"
import { prisma } from "@echatbot/database"

// Services
import { WhatsAppQueueService } from "../services/whatsapp-queue.service"

// Internal core
import logger from "../utils/logger"

// prisma imported
let isProcessing = false // Cron lock to prevent concurrent execution

/**
 * WhatsApp Queue Processor - Cron Job
 *
 * Runs every minute to process pending messages from the queue
 * - Fetches ONE pending message per workspace per cycle (FIFO order)
 * - Validates and "sends" message (console.log placeholder)
 * - Deletes from queue on success OR marks as error on failure
 * - Marks deliveredAt timestamp in conversation history
 *
 * Locking mechanism prevents concurrent runs
 */
export function startWhatsAppQueueProcessor() {
  logger.info("[WhatsApp Queue Processor] Starting cron job (every 2 minutes)...")

  // Schedule: runs every 2 minutes
  // Format: */2 * * * * = every 2 minutes
  cron.schedule("*/2 * * * *", async () => {
    // Check lock
    if (isProcessing) {
      logger.debug(
        "[WhatsApp Queue Processor] Skipping - previous job still running"
      )
      return
    }

    isProcessing = true
    const startTime = Date.now()

    try {
      // Get all active workspaces WHERE channel is active (channelStatus = true)
      // channelStatus replaces whatsappQueueEnabled - single flag for channel active state
      const workspaces = await prisma.workspace.findMany({
        where: { 
          deletedAt: null,
          channelStatus: true, // ✅ Only process if channel is ACTIVE
        },
        select: { id: true, name: true },
      })

      if (workspaces.length === 0) {
        logger.debug("[WhatsApp Queue Processor] No active workspaces with active channel found")
        return
      }

      // Process each workspace sequentially
      for (const workspace of workspaces) {
        try {
          const service = new WhatsAppQueueService(prisma)
          await service.processPendingMessages(workspace.id)
        } catch (error) {
          logger.error(
            `[WhatsApp Queue Processor] Error processing workspace ${workspace.id}:`,
            error
          )
          // Continue with next workspace
        }
      }

      const duration = Date.now() - startTime
      logger.debug(
        `[WhatsApp Queue Processor] Cycle completed in ${duration}ms (processed ${workspaces.length} workspaces)`
      )
    } catch (error) {
      logger.error("[WhatsApp Queue Processor] Cron job error:", error)
    } finally {
      isProcessing = false
    }
  })

  logger.info("✅ [WhatsApp Queue Processor] Cron job started - processing every minute")
}

/**
 * WhatsApp Queue Cleanup - Cron Job (runs daily at 2 AM)
 *
 * Deletes messages from whatsapp_queue table that are older than 30 days
 * Keeps recent messages for history/audit purposes
 * 🔒 SECURITY: Iterates per workspace to maintain isolation
 */
export function startWhatsAppQueueCleanup() {
  logger.info("[WhatsApp Queue Cleanup] Starting cron job (daily at 2 AM)...")

  // Schedule: runs every day at 2 AM (02:00:00)
  // Format: 0 0 2 * * * = at 2:00 AM every day
  cron.schedule("0 0 2 * * *", async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      logger.info(
        `[WhatsApp Queue Cleanup] Starting cleanup - deleting messages older than ${thirtyDaysAgo.toISOString()}`
      )

      // 🔒 Get all active workspaces and cleanup each one
      const workspaces = await prisma.workspace.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
      })

      let totalDeleted = 0

      for (const workspace of workspaces) {
        try {
          const deleted = await prisma.whatsAppQueue.deleteMany({
            where: {
              workspaceId: workspace.id,
              createdAt: {
                lt: thirtyDaysAgo,
              },
            },
          })

          if (deleted.count > 0) {
            logger.info(
              `[WhatsApp Queue Cleanup] Workspace ${workspace.id}: deleted ${deleted.count} messages older than 30 days`
            )
            totalDeleted += deleted.count
          }
        } catch (error) {
          logger.error(
            `[WhatsApp Queue Cleanup] Error cleaning workspace ${workspace.id}:`,
            error
          )
          // Continue with next workspace
        }
      }

      logger.info(
        `[WhatsApp Queue Cleanup] Cleanup completed - deleted ${totalDeleted} messages across all workspaces`
      )
    } catch (error) {
      logger.error("[WhatsApp Queue Cleanup] Error during cleanup:", error)
    }
  })

  logger.info("✅ [WhatsApp Queue Cleanup] Cron job started - runs daily at 2 AM")
}

/**
 * Stop cron job (for graceful shutdown)
 */
export function stopWhatsAppQueueProcessor() {
  logger.info("[WhatsApp Queue Processor] Stopping cron job...")
  // node-cron doesn't expose stop method directly for schedule
  // The cron will stop when process exits
}
