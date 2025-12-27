"use strict";
/**
 * DeletionSchedulerService - Hard-deletes expired soft-deleted records
 *
 * Runs daily at 11:20 AM
 * Finds records with deletedAt < (now - SOFT_DELETE_RETENTION_DAYS)
 * Hard-deletes in transaction with audit logging
 *
 * SAFETY: Uses SchedulerJobStatus to prevent duplicate runs
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
exports.DeletionSchedulerService = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const soft_delete_helper_1 = require("../utils/soft-delete.helper");
class DeletionSchedulerService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Run hard-delete job (called daily at 11:20 AM)
     */
    runHardDeleteJob() {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            const jobName = "soft-delete-hard-delete";
            try {
                // 1. Check if job is enabled
                const jobStatus = yield this.prisma.schedulerJobStatus.upsert({
                    where: { jobName },
                    update: {},
                    create: {
                        jobName,
                        isActive: true,
                        lastStatus: "NEVER_RUN",
                    },
                });
                if (!jobStatus.isActive) {
                    logger_1.default.info(`Hard-delete job disabled, skipping run`);
                    return {
                        success: true,
                        message: "Job disabled",
                        totalRecordsDeleted: 0,
                        duration: Date.now() - startTime,
                        nextRun: this.getNextRunTime(),
                    };
                }
                // 2. Prevent duplicate runs (check if already running today)
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const lastRunToday = jobStatus.lastRunAt && jobStatus.lastRunAt > today;
                if (lastRunToday) {
                    logger_1.default.info(`Hard-delete job already ran today, skipping`);
                    return {
                        success: true,
                        message: "Already ran today",
                        totalRecordsDeleted: 0,
                        duration: Date.now() - startTime,
                        nextRun: this.getNextRunTime(),
                    };
                }
                // 3. Find expired records
                const retentionDays = (0, soft_delete_helper_1.getRetentionDaysConfig)();
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() - retentionDays);
                const expiredRecords = yield this.findExpiredRecords(expiryDate);
                const totalCount = Object.values(expiredRecords).reduce((a, b) => a + b.length, 0);
                if (totalCount === 0) {
                    logger_1.default.info(`No expired soft-deleted records found`);
                    yield this.updateJobStatus(jobName, "SUCCESS", null, Date.now() - startTime);
                    return {
                        success: true,
                        message: "No expired records",
                        totalRecordsDeleted: 0,
                        duration: Date.now() - startTime,
                        nextRun: this.getNextRunTime(),
                    };
                }
                // 4. Hard-delete in transaction
                const deletedCount = yield this.performHardDelete(expiredRecords, expiryDate);
                // 5. Update job status
                yield this.updateJobStatus(jobName, "SUCCESS", null, Date.now() - startTime);
                logger_1.default.info(`Hard-delete job completed: ${deletedCount} records deleted`, {
                    recordsByType: expiredRecords,
                });
                return {
                    success: true,
                    message: `Hard-deleted ${deletedCount} expired records`,
                    totalRecordsDeleted: deletedCount,
                    duration: Date.now() - startTime,
                    nextRun: this.getNextRunTime(),
                };
            }
            catch (error) {
                logger_1.default.error("Hard-delete job failed", error);
                yield this.updateJobStatus(jobName, "FAILED", String(error), Date.now() - startTime);
                return {
                    success: false,
                    message: `Job failed: ${error}`,
                    totalRecordsDeleted: 0,
                    duration: Date.now() - startTime,
                    nextRun: this.getNextRunTime(),
                };
            }
        });
    }
    /**
     * Find all expired records by entity type
     * SAFETY: Explicitly checks deletedAt is NOT null before comparing
     */
    findExpiredRecords(expiryDate) {
        return __awaiter(this, void 0, void 0, function* () {
            const [users, workspaces, customers, orders, messages, sessions] = yield Promise.all([
                this.prisma.user.findMany({
                    where: {
                        deletedAt: { not: null, lt: expiryDate }
                    },
                    select: { id: true },
                }),
                this.prisma.workspace.findMany({
                    where: {
                        deletedAt: { not: null, lt: expiryDate }
                    },
                    select: { id: true },
                }),
                this.prisma.customers.findMany({
                    where: {
                        deletedAt: { not: null, lt: expiryDate }
                    },
                    select: { id: true },
                }),
                this.prisma.orders.findMany({
                    where: {
                        deletedAt: { not: null, lt: expiryDate }
                    },
                    select: { id: true },
                }),
                this.prisma.message.findMany({
                    where: {
                        deletedAt: { not: null, lt: expiryDate }
                    },
                    select: { id: true },
                }),
                this.prisma.chatSession.findMany({
                    where: {
                        deletedAt: { not: null, lt: expiryDate }
                    },
                    select: { id: true },
                }),
            ]);
            return {
                users: users.map((u) => u.id),
                workspaces: workspaces.map((w) => w.id),
                customers: customers.map((c) => c.id),
                orders: orders.map((o) => o.id),
                messages: messages.map((m) => m.id),
                chatSessions: sessions.map((s) => s.id),
            };
        });
    }
    /**
     * Hard-delete all expired records in transaction
     * SAFETY: Explicitly checks deletedAt is NOT null before deleting
     */
    performHardDelete(expiredRecords, expiryDate) {
        return __awaiter(this, void 0, void 0, function* () {
            let totalDeleted = 0;
            yield this.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Delete by type (order matters due to foreign keys)
                // CRITICAL: Always check deletedAt is not null to prevent accidental deletion
                if (expiredRecords.messages.length > 0) {
                    totalDeleted += yield tx.message.deleteMany({
                        where: { deletedAt: { not: null, lt: expiryDate } },
                    }).then((r) => r.count);
                }
                if (expiredRecords.chatSessions.length > 0) {
                    totalDeleted += yield tx.chatSession.deleteMany({
                        where: { deletedAt: { not: null, lt: expiryDate } },
                    }).then((r) => r.count);
                }
                if (expiredRecords.orders.length > 0) {
                    totalDeleted += yield tx.orders.deleteMany({
                        where: { deletedAt: { not: null, lt: expiryDate } },
                    }).then((r) => r.count);
                }
                if (expiredRecords.customers.length > 0) {
                    totalDeleted += yield tx.customers.deleteMany({
                        where: { deletedAt: { not: null, lt: expiryDate } },
                    }).then((r) => r.count);
                }
                if (expiredRecords.workspaces.length > 0) {
                    totalDeleted += yield tx.workspace.deleteMany({
                        where: { deletedAt: { not: null, lt: expiryDate } },
                    }).then((r) => r.count);
                }
                if (expiredRecords.users.length > 0) {
                    totalDeleted += yield tx.user.deleteMany({
                        where: { deletedAt: { not: null, lt: expiryDate } },
                    }).then((r) => r.count);
                }
                // Log audit trail with all deleted IDs
                for (const workspace of expiredRecords.workspaces) {
                    yield tx.softDeleteAuditLog.create({
                        data: {
                            workspaceId: workspace,
                            entityType: "SCHEDULER_HARD_DELETE",
                            deletedIds: [
                                ...expiredRecords.users,
                                ...expiredRecords.workspaces,
                                ...expiredRecords.customers,
                                ...expiredRecords.orders,
                                ...expiredRecords.messages,
                                ...expiredRecords.chatSessions,
                            ],
                            deletedIdCount: totalDeleted,
                            reason: "SCHEDULED_CLEANUP",
                            deletedByUserId: null, // Scheduler-initiated
                        },
                    });
                }
            }));
            return totalDeleted;
        });
    }
    /**
     * Update job status in SchedulerJobStatus
     */
    updateJobStatus(jobName, status, error, duration) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.prisma.schedulerJobStatus.update({
                where: { jobName },
                data: {
                    lastRunAt: new Date(),
                    lastStatus: status,
                    lastError: error,
                    lastDuration: duration,
                    nextRunAt: this.getNextRunTime(),
                },
            });
        });
    }
    /**
     * Calculate next run time (next day at 11:20 AM)
     */
    getNextRunTime() {
        const next = new Date();
        next.setDate(next.getDate() + 1);
        next.setHours(11, 20, 0, 0);
        return next;
    }
}
exports.DeletionSchedulerService = DeletionSchedulerService;
//# sourceMappingURL=deletion-scheduler.service.js.map