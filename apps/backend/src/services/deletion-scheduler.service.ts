/**
 * DeletionSchedulerService - Hard-deletes expired soft-deleted records
 *
 * Runs daily at 11:20 AM
 * Finds records with deletedAt < (now - SOFT_DELETE_RETENTION_DAYS)
 * Hard-deletes in transaction with audit logging
 *
 * SAFETY: Uses SchedulerJobStatus to prevent duplicate runs
 */

import { PrismaClient } from "@echatbot/database"
import logger from "../utils/logger"
import { getRetentionDaysConfig } from "../utils/soft-delete.helper"

interface SchedulerResult {
  success: boolean
  message: string
  totalRecordsDeleted: number
  duration: number // milliseconds
  nextRun: Date
}

export class DeletionSchedulerService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Run hard-delete job (called daily at 11:20 AM)
   */
  async runHardDeleteJob(): Promise<SchedulerResult> {
    const startTime = Date.now()
    const jobName = "soft-delete-hard-delete"

    try {
      // 1. Check if job is enabled
      const jobStatus = await this.prisma.schedulerJobStatus.upsert({
        where: { jobName },
        update: {},
        create: {
          jobName,
          isActive: true,
          lastStatus: "NEVER_RUN",
        },
      })

      if (!jobStatus.isActive) {
        logger.info(`Hard-delete job disabled, skipping run`)
        return {
          success: true,
          message: "Job disabled",
          totalRecordsDeleted: 0,
          duration: Date.now() - startTime,
          nextRun: this.getNextRunTime(),
        }
      }

      // 2. Prevent duplicate runs (check if already running today)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const lastRunToday = jobStatus.lastRunAt && jobStatus.lastRunAt > today

      if (lastRunToday) {
        logger.info(`Hard-delete job already ran today, skipping`)
        return {
          success: true,
          message: "Already ran today",
          totalRecordsDeleted: 0,
          duration: Date.now() - startTime,
          nextRun: this.getNextRunTime(),
        }
      }

      // 3. Find expired records
      const retentionDays = getRetentionDaysConfig()
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() - retentionDays)

      const expiredRecords = await this.findExpiredRecords(expiryDate)
      const totalCount = Object.values(expiredRecords).reduce((a, b) => a + b.length, 0)

      if (totalCount === 0) {
        logger.info(`No expired soft-deleted records found`)
        await this.updateJobStatus(jobName, "SUCCESS", null, Date.now() - startTime)

        return {
          success: true,
          message: "No expired records",
          totalRecordsDeleted: 0,
          duration: Date.now() - startTime,
          nextRun: this.getNextRunTime(),
        }
      }

      // 4. Hard-delete in transaction
      const deletedCount = await this.performHardDelete(expiredRecords, expiryDate)

      // 5. Update job status
      await this.updateJobStatus(jobName, "SUCCESS", null, Date.now() - startTime)

      logger.info(`Hard-delete job completed: ${deletedCount} records deleted`, {
        recordsByType: expiredRecords,
      })

      return {
        success: true,
        message: `Hard-deleted ${deletedCount} expired records`,
        totalRecordsDeleted: deletedCount,
        duration: Date.now() - startTime,
        nextRun: this.getNextRunTime(),
      }
    } catch (error) {
      logger.error("Hard-delete job failed", error)
      await this.updateJobStatus(jobName, "FAILED", String(error), Date.now() - startTime)

      return {
        success: false,
        message: `Job failed: ${error}`,
        totalRecordsDeleted: 0,
        duration: Date.now() - startTime,
        nextRun: this.getNextRunTime(),
      }
    }
  }

  /**
   * Find all expired records by entity type
   * SAFETY: Explicitly checks deletedAt is NOT null before comparing
   */
  private async findExpiredRecords(expiryDate: Date): Promise<Record<string, any[]>> {
    const [users, workspaces, customers, orders, messages, sessions] = await Promise.all([
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
    ])

    return {
      users: users.map((u) => u.id),
      workspaces: workspaces.map((w) => w.id),
      customers: customers.map((c) => c.id),
      orders: orders.map((o) => o.id),
      messages: messages.map((m) => m.id),
      chatSessions: sessions.map((s) => s.id),
    }
  }

  /**
   * Hard-delete all expired records in transaction
   * SAFETY: Explicitly checks deletedAt is NOT null before deleting
   */
  private async performHardDelete(
    expiredRecords: Record<string, string[]>,
    expiryDate: Date
  ): Promise<number> {
    let totalDeleted = 0

    await this.prisma.$transaction(async (tx) => {
      // Delete by type (order matters due to foreign keys)
      // CRITICAL: Always check deletedAt is not null to prevent accidental deletion
      if (expiredRecords.messages.length > 0) {
        totalDeleted += await tx.message.deleteMany({
          where: { deletedAt: { not: null, lt: expiryDate } },
        }).then((r) => r.count)
      }

      if (expiredRecords.chatSessions.length > 0) {
        totalDeleted += await tx.chatSession.deleteMany({
          where: { deletedAt: { not: null, lt: expiryDate } },
        }).then((r) => r.count)
      }

      if (expiredRecords.orders.length > 0) {
        totalDeleted += await tx.orders.deleteMany({
          where: { deletedAt: { not: null, lt: expiryDate } },
        }).then((r) => r.count)
      }

      if (expiredRecords.customers.length > 0) {
        totalDeleted += await tx.customers.deleteMany({
          where: { deletedAt: { not: null, lt: expiryDate } },
        }).then((r) => r.count)
      }

      if (expiredRecords.workspaces.length > 0) {
        totalDeleted += await tx.workspace.deleteMany({
          where: { deletedAt: { not: null, lt: expiryDate } },
        }).then((r) => r.count)
      }

      if (expiredRecords.users.length > 0) {
        totalDeleted += await tx.user.deleteMany({
          where: { deletedAt: { not: null, lt: expiryDate } },
        }).then((r) => r.count)
      }

      // Log audit trail with all deleted IDs
      for (const workspace of expiredRecords.workspaces) {
        await tx.softDeleteAuditLog.create({
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
        })
      }
    })

    return totalDeleted
  }

  /**
   * Update job status in SchedulerJobStatus
   */
  private async updateJobStatus(
    jobName: string,
    status: "SUCCESS" | "FAILED" | "RUNNING",
    error: string | null,
    duration: number
  ): Promise<void> {
    await this.prisma.schedulerJobStatus.update({
      where: { jobName },
      data: {
        lastRunAt: new Date(),
        lastStatus: status,
        lastError: error,
        lastDuration: duration,
        nextRunAt: this.getNextRunTime(),
      },
    })
  }

  /**
   * Calculate next run time (next day at 11:20 AM)
   */
  private getNextRunTime(): Date {
    const next = new Date()
    next.setDate(next.getDate() + 1)
    next.setHours(11, 20, 0, 0)
    return next
  }
}
