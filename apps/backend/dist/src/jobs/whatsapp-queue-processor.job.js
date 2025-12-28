"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWhatsAppQueueProcessor = startWhatsAppQueueProcessor;
exports.startWhatsAppQueueCleanup = startWhatsAppQueueCleanup;
exports.stopWhatsAppQueueProcessor = stopWhatsAppQueueProcessor;
// External dependencies
const node_cron_1 = __importDefault(require("node-cron"));
const database_1 = require("@echatbot/database");
// Services
const whatsapp_queue_service_1 = require("../services/whatsapp-queue.service");
// Internal core
const logger_1 = __importDefault(require("../utils/logger"));
// prisma imported
let isProcessing = false; // Cron lock to prevent concurrent execution
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
function startWhatsAppQueueProcessor() {
    logger_1.default.info("[WhatsApp Queue Processor] Starting cron job (every 2 minutes)...");
    // Schedule: runs every 2 minutes
    // Format: */2 * * * * = every 2 minutes
    node_cron_1.default.schedule("*/2 * * * *", () => __awaiter(this, void 0, void 0, function* () {
        // Check lock
        if (isProcessing) {
            logger_1.default.debug("[WhatsApp Queue Processor] Skipping - previous job still running");
            return;
        }
        isProcessing = true;
        const startTime = Date.now();
        try {
            // Get all active workspaces WHERE channel is active (channelStatus = true)
            // channelStatus replaces whatsappQueueEnabled - single flag for channel active state
            const workspaces = yield database_1.prisma.workspace.findMany({
                where: {
                    isActive: true,
                    channelStatus: true, // ✅ Only process if channel is ACTIVE
                },
                select: { id: true, name: true },
            });
            if (workspaces.length === 0) {
                logger_1.default.debug("[WhatsApp Queue Processor] No active workspaces with active channel found");
                return;
            }
            // Process each workspace sequentially
            for (const workspace of workspaces) {
                try {
                    const service = new whatsapp_queue_service_1.WhatsAppQueueService(database_1.prisma);
                    yield service.processPendingMessages(workspace.id);
                }
                catch (error) {
                    logger_1.default.error(`[WhatsApp Queue Processor] Error processing workspace ${workspace.id}:`, error);
                    // Continue with next workspace
                }
            }
            const duration = Date.now() - startTime;
            logger_1.default.debug(`[WhatsApp Queue Processor] Cycle completed in ${duration}ms (processed ${workspaces.length} workspaces)`);
        }
        catch (error) {
            logger_1.default.error("[WhatsApp Queue Processor] Cron job error:", error);
        }
        finally {
            isProcessing = false;
        }
    }));
    logger_1.default.info("✅ [WhatsApp Queue Processor] Cron job started - processing every minute");
}
/**
 * WhatsApp Queue Cleanup - Cron Job (runs daily at 2 AM)
 *
 * Deletes messages from whatsapp_queue table that are older than 30 days
 * Keeps recent messages for history/audit purposes
 * 🔒 SECURITY: Iterates per workspace to maintain isolation
 */
function startWhatsAppQueueCleanup() {
    logger_1.default.info("[WhatsApp Queue Cleanup] Starting cron job (daily at 2 AM)...");
    // Schedule: runs every day at 2 AM (02:00:00)
    // Format: 0 0 2 * * * = at 2:00 AM every day
    node_cron_1.default.schedule("0 0 2 * * *", () => __awaiter(this, void 0, void 0, function* () {
        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            logger_1.default.info(`[WhatsApp Queue Cleanup] Starting cleanup - deleting messages older than ${thirtyDaysAgo.toISOString()}`);
            // 🔒 Get all active workspaces and cleanup each one
            const workspaces = yield database_1.prisma.workspace.findMany({
                where: { isActive: true },
                select: { id: true, name: true },
            });
            let totalDeleted = 0;
            for (const workspace of workspaces) {
                try {
                    const deleted = yield database_1.prisma.whatsAppQueue.deleteMany({
                        where: {
                            workspaceId: workspace.id,
                            createdAt: {
                                lt: thirtyDaysAgo,
                            },
                        },
                    });
                    if (deleted.count > 0) {
                        logger_1.default.info(`[WhatsApp Queue Cleanup] Workspace ${workspace.id}: deleted ${deleted.count} messages older than 30 days`);
                        totalDeleted += deleted.count;
                    }
                }
                catch (error) {
                    logger_1.default.error(`[WhatsApp Queue Cleanup] Error cleaning workspace ${workspace.id}:`, error);
                    // Continue with next workspace
                }
            }
            logger_1.default.info(`[WhatsApp Queue Cleanup] Cleanup completed - deleted ${totalDeleted} messages across all workspaces`);
        }
        catch (error) {
            logger_1.default.error("[WhatsApp Queue Cleanup] Error during cleanup:", error);
        }
    }));
    logger_1.default.info("✅ [WhatsApp Queue Cleanup] Cron job started - runs daily at 2 AM");
}
/**
 * Stop cron job (for graceful shutdown)
 */
function stopWhatsAppQueueProcessor() {
    logger_1.default.info("[WhatsApp Queue Processor] Stopping cron job...");
    // node-cron doesn't expose stop method directly for schedule
    // The cron will stop when process exits
}
//# sourceMappingURL=whatsapp-queue-processor.job.js.map