"use strict";
/**
 * SoftDeleteHelper - Utility functions for soft delete filtering
 * Provides consistent filter builders for all soft-delete queries across the system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSoftDeleteFilter = buildSoftDeleteFilter;
exports.buildTrashFilter = buildTrashFilter;
exports.buildRetentionExpiredFilter = buildRetentionExpiredFilter;
exports.buildRetentionActiveFilter = buildRetentionActiveFilter;
exports.getDaysUntilPermanentDelete = getDaysUntilPermanentDelete;
exports.isWithinRetentionWindow = isWithinRetentionWindow;
exports.getRetentionDaysConfig = getRetentionDaysConfig;
/**
 * Build filter to exclude soft-deleted records from normal queries
 * Usage: { ...buildSoftDeleteFilter(), otherField: value }
 * Returns: { deletedAt: null }
 */
function buildSoftDeleteFilter() {
    return {
        deletedAt: null,
    };
}
/**
 * Build filter to ONLY show soft-deleted records (for trash views)
 * Usage: { ...buildTrashFilter(), workspaceId: id }
 * Returns: { deletedAt: { not: null } }
 */
function buildTrashFilter() {
    return {
        deletedAt: {
            not: null,
        },
    };
}
/**
 * Build filter for records that expired retention window (for hard-delete scheduler)
 * Usage: { ...buildRetentionExpiredFilter(90), workspaceId: id }
 * Returns: { deletedAt: { lt: dateMinusDays } }
 */
function buildRetentionExpiredFilter(retentionDays) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - retentionDays);
    return {
        deletedAt: {
            lt: expiryDate,
        },
    };
}
/**
 * Build filter for records within retention window (not yet ready for hard-delete)
 * Usage: { ...buildRetentionActiveFilter(90), workspaceId: id }
 * Returns: { deletedAt: { gte: dateMinusDays, not: null } }
 */
function buildRetentionActiveFilter(retentionDays) {
    const retentionStartDate = new Date();
    retentionStartDate.setDate(retentionStartDate.getDate() - retentionDays);
    return {
        AND: [
            { deletedAt: { not: null } },
            { deletedAt: { gte: retentionStartDate } },
        ],
    };
}
/**
 * Calculate days remaining until hard-delete
 * Returns: number of days left (0 if already expired)
 */
function getDaysUntilPermanentDelete(deletedAt, retentionDays = 90) {
    const now = new Date();
    const expiryDate = new Date(deletedAt);
    expiryDate.setDate(expiryDate.getDate() + retentionDays);
    const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysRemaining);
}
/**
 * Check if a deleted item is still within retention window
 */
function isWithinRetentionWindow(deletedAt, retentionDays = 90) {
    return getDaysUntilPermanentDelete(deletedAt, retentionDays) > 0;
}
/**
 * Parse retention days from environment variable or use default
 */
function getRetentionDaysConfig() {
    const envValue = process.env.SOFT_DELETE_RETENTION_DAYS;
    if (!envValue)
        return 90;
    const parsed = parseInt(envValue, 10);
    if (isNaN(parsed) || parsed < 1) {
        console.warn(`Invalid SOFT_DELETE_RETENTION_DAYS: ${envValue}, using default 90`);
        return 90;
    }
    return parsed;
}
//# sourceMappingURL=soft-delete.helper.js.map