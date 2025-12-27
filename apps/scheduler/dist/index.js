"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const database_1 = require("./config/database");
const job_runner_service_1 = require("./services/job-runner.service");
const jobs_1 = require("./jobs");
const storage_cleanup_1 = require("./jobs/storage-cleanup");
const logger_1 = __importDefault(require("./utils/logger"));
// eChatbot Scheduler Microservice
//
// Cron Jobs (ordered by execution time):
// 1. WhatsApp Challenge Queue   - every 3 SECONDS (parallel send, with lock)
// 2. Short URLs Cleanup         - daily at 23:00
// 3. Unused Images Cleanup      - daily at 23:05
// 4. Messages Archive           - daily at 23:10 (archive messages older than 6 months)
// 5. WhatsApp Queue Cleanup     - daily at 23:15 (delete errors/sent older than 7 days)
// 6. Soft Delete Cleanup        - daily at 23:20 (hard-delete records after retention period)
// 7. Monthly Billing            - 1st of month at 23:30
//
// HOW TO ENABLE/DISABLE JOBS:
// - From Backoffice: /schedulers page → toggle isActive
// - Jobs check isActive flag before running (skip if disabled)
async function main() {
    logger_1.default.info('🚀 Starting eChatbot Scheduler...');
    // Connect to database
    await (0, database_1.connectDatabase)();
    // Setup storage cleanup jobs
    (0, storage_cleanup_1.setupStorageCleanup)();
    // ═══════════════════════════════════════════════════════════════════════════
    // Job 1: WhatsApp Challenge Queue - every 3 seconds
    // Uses in-memory lock: if previous job is still running, skip
    // Sends messages in PARALLEL (safe for different customers)
    // ═══════════════════════════════════════════════════════════════════════════
    node_cron_1.default.schedule('*/3 * * * * *', async () => {
        await (0, job_runner_service_1.runJob)('whatsapp-challenge-queue', jobs_1.whatsappChallengeQueueJob);
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // Job 2: Short URLs Cleanup - daily at 23:00
    // Deletes expired short URLs
    // ═══════════════════════════════════════════════════════════════════════════
    node_cron_1.default.schedule('0 23 * * *', async () => {
        await (0, job_runner_service_1.runJob)('short-urls-cleanup', jobs_1.shortUrlsCleanupJob);
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // Job 3: Unused Images Cleanup - daily at 23:05
    // Removes orphaned images from uploads folder
    // ═══════════════════════════════════════════════════════════════════════════
    node_cron_1.default.schedule('5 23 * * *', async () => {
        await (0, job_runner_service_1.runJob)('unused-images-cleanup', jobs_1.unusedImagesCleanupJob);
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // Job 4: Messages Archive - daily at 23:10
    // Archives messages older than 6 months to reduce main table size
    // ═══════════════════════════════════════════════════════════════════════════
    node_cron_1.default.schedule('10 23 * * *', async () => {
        await (0, job_runner_service_1.runJob)('messages-archive', jobs_1.messagesArchiveJob);
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // Job 5: WhatsApp Queue Cleanup - daily at 23:15
    // Deletes error and sent messages older than 7 days
    // ═══════════════════════════════════════════════════════════════════════════
    node_cron_1.default.schedule('15 23 * * *', async () => {
        await (0, job_runner_service_1.runJob)('whatsapp-queue-cleanup', jobs_1.whatsappQueueCleanupJob);
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // Job 6: Soft Delete Cleanup - daily at 23:20
    // Hard-deletes soft-deleted records after retention period (default 90 days)
    // Feature 196 - Soft Delete System
    // ═══════════════════════════════════════════════════════════════════════════
    node_cron_1.default.schedule('20 23 * * *', async () => {
        await (0, job_runner_service_1.runJob)('soft-delete-cleanup', jobs_1.softDeleteCleanupJob);
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // Job 7: Monthly Billing - 1st of each month at 23:30
    // Generates billing records for the previous month
    // ═══════════════════════════════════════════════════════════════════════════
    node_cron_1.default.schedule('30 23 1 * *', async () => {
        await (0, job_runner_service_1.runJob)('monthly-billing', jobs_1.monthlyBillingJob);
    });
    logger_1.default.info('✅ Scheduler started successfully!');
    logger_1.default.info('📋 Scheduled jobs:');
    logger_1.default.info('   1. WhatsApp Challenge Queue   - every 3 SECONDS');
    logger_1.default.info('   2. Short URLs Cleanup         - daily at 23:00');
    logger_1.default.info('   3. Unused Images Cleanup      - daily at 23:05');
    logger_1.default.info('   4. Messages Archive           - daily at 23:10');
    logger_1.default.info('   5. WhatsApp Queue Cleanup     - daily at 23:15');
    logger_1.default.info('   6. Soft Delete Cleanup        - daily at 23:20');
    logger_1.default.info('   7. Monthly Billing            - 1st of month at 23:30');
    logger_1.default.info('   8. Orphaned Files Cleanup     - daily at 03:00');
    logger_1.default.info('   9. Temp Files Cleanup         - every hour');
    logger_1.default.info('  10. Invoice Cleanup            - daily at 04:00');
    // Graceful shutdown
    process.on('SIGINT', async () => {
        logger_1.default.info('Shutting down scheduler...');
        await (0, database_1.disconnectDatabase)();
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        logger_1.default.info('Shutting down scheduler...');
        await (0, database_1.disconnectDatabase)();
        process.exit(0);
    });
}
main().catch((error) => {
    logger_1.default.error('Failed to start scheduler:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map