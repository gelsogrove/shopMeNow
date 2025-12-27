"use strict";
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
exports.startScheduler = startScheduler;
exports.stopScheduler = stopScheduler;
exports.getSchedulerStatus = getSchedulerStatus;
const node_cron_1 = __importDefault(require("node-cron"));
const searchConversation_repository_1 = require("./repositories/searchConversation.repository");
const workspace_repository_1 = require("./repositories/workspace.repository");
const logger_1 = __importDefault(require("./utils/logger"));
const searchConversationRepo = new searchConversation_repository_1.SearchConversationRepository();
const workspaceRepo = new workspace_repository_1.WorkspaceRepository();
/**
 * Job 1: Mark expired search conversations
 * Runs every 5 minutes
 * Changes ACTIVE conversations past expiresAt to EXPIRED
 * 🔒 SECURITY: Iterates over ALL workspaces to maintain isolation
 */
const markExpiredConversationsJob = node_cron_1.default.schedule("*/5 * * * *", () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        logger_1.default.info("⏰ Running job: Mark expired search conversations");
        // 🔒 Get all workspaces and process each one
        const workspaces = yield workspaceRepo.findAll();
        let totalMarked = 0;
        for (const workspace of workspaces) {
            try {
                const count = yield searchConversationRepo.markExpired(workspace.id);
                if (count > 0) {
                    logger_1.default.info(`✅ Marked ${count} conversations as expired in workspace ${workspace.id}`);
                    totalMarked += count;
                }
            }
            catch (error) {
                logger_1.default.error(`❌ Error marking expired conversations for workspace ${workspace.id}:`, error);
            }
        }
        if (totalMarked > 0) {
            logger_1.default.info(`✅ Total: Marked ${totalMarked} search conversations as expired across all workspaces`);
        }
    }
    catch (error) {
        logger_1.default.error("❌ Error in markExpiredConversationsJob:", error);
    }
}));
/**
 * Job 2: Delete old search conversations
 * Runs every Sunday at 3:00 AM
 * Deletes conversations older than 30 days
 * 🔒 SECURITY: Iterates over ALL workspaces to maintain isolation
 */
const deleteOldConversationsJob = node_cron_1.default.schedule("0 3 * * 0", () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        logger_1.default.info("⏰ Running job: Delete old search conversations");
        // 🔒 Get all workspaces and process each one
        const workspaces = yield workspaceRepo.findAll();
        let totalDeleted = 0;
        for (const workspace of workspaces) {
            try {
                const count = yield searchConversationRepo.deleteOld(30, workspace.id);
                if (count > 0) {
                    logger_1.default.info(`✅ Deleted ${count} conversations older than 30 days in workspace ${workspace.id}`);
                    totalDeleted += count;
                }
            }
            catch (error) {
                logger_1.default.error(`❌ Error deleting old conversations for workspace ${workspace.id}:`, error);
            }
        }
        if (totalDeleted > 0) {
            logger_1.default.info(`✅ Total: Deleted ${totalDeleted} search conversations across all workspaces`);
        }
    }
    catch (error) {
        logger_1.default.error("❌ Error in deleteOldConversationsJob:", error);
    }
}));
/**
 * Start all scheduled jobs
 * Call this function in index.ts after server startup
 */
function startScheduler() {
    logger_1.default.info("🚀 Starting background scheduler...");
    // Start all jobs
    markExpiredConversationsJob.start();
    deleteOldConversationsJob.start();
    logger_1.default.info("✅ Scheduler started successfully");
    logger_1.default.info("  - Mark expired conversations: Every 5 minutes");
    logger_1.default.info("  - Delete old conversations: Every Sunday at 3:00 AM");
}
/**
 * Stop all scheduled jobs
 * Call this for graceful shutdown
 */
function stopScheduler() {
    logger_1.default.info("⏹️ Stopping background scheduler...");
    markExpiredConversationsJob.stop();
    deleteOldConversationsJob.stop();
    logger_1.default.info("✅ Scheduler stopped successfully");
}
/**
 * Get scheduler status
 * Useful for monitoring/health checks
 */
function getSchedulerStatus() {
    return {
        markExpiredJob: {
            running: markExpiredConversationsJob.getStatus() === "scheduled",
            schedule: "*/5 * * * *",
        },
        deleteOldJob: {
            running: deleteOldConversationsJob.getStatus() === "scheduled",
            schedule: "0 3 * * 0",
        },
    };
}
//# sourceMappingURL=scheduler.js.map