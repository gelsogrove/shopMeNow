"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shortUrlsCleanupJob = shortUrlsCleanupJob;
const database_1 = require("../config/database");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Short URLs Cleanup Job
 * Runs daily at 23:00
 * Deletes expired short URLs
 */
async function shortUrlsCleanupJob() {
    const result = await database_1.prisma.shortUrls.deleteMany({
        where: {
            expiresAt: {
                lt: new Date(),
            },
        },
    });
    logger_1.default.info(`Deleted ${result.count} expired short URLs`);
}
//# sourceMappingURL=short-urls-cleanup.job.js.map