"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappQueueCleanupJob = whatsappQueueCleanupJob;
const database_1 = require("../config/database");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * WhatsApp Queue Cleanup Job
 * Runs daily at 23:05
 * Deletes WhatsApp queue messages with status 'error' older than 7 days
 *
 * Purpose: Keep the queue table clean by removing old error messages
 * that are no longer relevant for debugging or retry
 */
async function whatsappQueueCleanupJob() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    // Delete error messages older than 7 days
    const errorResult = await database_1.prisma.whatsAppQueue.deleteMany({
        where: {
            status: 'error',
            createdAt: {
                lt: oneWeekAgo,
            },
        },
    });
    // Also delete sent messages older than 7 days (they're just logs at this point)
    const sentResult = await database_1.prisma.whatsAppQueue.deleteMany({
        where: {
            status: 'sent',
            createdAt: {
                lt: oneWeekAgo,
            },
        },
    });
    const totalDeleted = errorResult.count + sentResult.count;
    if (totalDeleted > 0) {
        logger_1.default.info(`🗑️ WhatsApp Queue Cleanup: Deleted ${errorResult.count} error messages and ${sentResult.count} sent messages (older than 7 days)`);
    }
    else {
        logger_1.default.info(`🗑️ WhatsApp Queue Cleanup: No old messages to delete`);
    }
}
//# sourceMappingURL=whatsapp-queue-cleanup.job.js.map