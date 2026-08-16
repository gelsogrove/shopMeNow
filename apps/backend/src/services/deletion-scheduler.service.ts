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
   * Hard-delete all expired records.
   *
   * Runs as INDEPENDENT per-scope transactions (workspaces, customers,
   * orders, chat data, users) so one failing scope cannot silently block
   * the others — before this split, a single FK violation aborted the whole
   * job and "deleted" data was retained forever.
   *
   * SAFETY: every scope re-verifies deletedAt inside its own transaction,
   * so a record restored between discovery and deletion is never touched.
   */
  private async performHardDelete(
    expiredRecords: Record<string, string[]>,
    expiryDate: Date
  ): Promise<number> {
    let totalDeleted = 0
    totalDeleted += await this.runScope("workspaces", () => this.hardDeleteWorkspaces(expiryDate))
    totalDeleted += await this.runScope("customers", () => this.hardDeleteCustomers(expiryDate))
    totalDeleted += await this.runScope("orders", () => this.hardDeleteOrders(expiryDate))
    totalDeleted += await this.runScope("chatData", () => this.hardDeleteChatData(expiryDate))
    totalDeleted += await this.runScope("users", () => this.hardDeleteUsers(expiryDate))
    return totalDeleted
  }

  /**
   * Run one deletion scope, converting failures into loud error logs
   * instead of aborting the whole job.
   */
  private async runScope(name: string, fn: () => Promise<number>): Promise<number> {
    try {
      return await fn()
    } catch (error) {
      logger.error(`HARD_DELETE_SCOPE_FAILED: scope "${name}" was NOT deleted — data is being retained past its expiry`, {
        scope: name,
        error: error instanceof Error ? error.message : String(error),
      })
      return 0
    }
  }

  /**
   * Expired workspaces: full cascade of everything the workspace owns.
   * Children with RESTRICT FKs must go before their parents:
   * messages → chat_sessions, cart_items → carts, payment_details → orders,
   * appointments/late_cancellations → services & customers, usage → customers,
   * then all workspace-scoped tables, then the workspace row itself.
   */
  private async hardDeleteWorkspaces(expiryDate: Date): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const expired = await tx.workspace.findMany({
        where: { deletedAt: { not: null, lt: expiryDate } },
        select: { id: true },
      })
      if (expired.length === 0) return 0
      const W = { in: expired.map((w) => w.id) }

      await tx.message.deleteMany({ where: { chatSession: { workspaceId: W } } })
      await tx.cartItems.deleteMany({ where: { cart: { workspaceId: W } } })
      await tx.paymentDetails.deleteMany({ where: { order: { workspaceId: W } } })
      await tx.appointment.deleteMany({ where: { workspaceId: W } })
      await tx.lateCancellationAttempt.deleteMany({ where: { workspaceId: W } })
      await tx.usage.deleteMany({ where: { workspaceId: W } })
      await tx.chatSession.deleteMany({ where: { workspaceId: W } })
      await tx.carts.deleteMany({ where: { workspaceId: W } })
      await tx.orders.deleteMany({ where: { workspaceId: W } })
      await tx.customers.deleteMany({ where: { workspaceId: W } })
      await tx.products.deleteMany({ where: { workspaceId: W } })
      await tx.offers.deleteMany({ where: { workspaceId: W } })
      await tx.categories.deleteMany({ where: { workspaceId: W } })
      await tx.sales.deleteMany({ where: { workspaceId: W } })
      await tx.languages.deleteMany({ where: { workspaceId: W } })
      await tx.services.deleteMany({ where: { workspaceId: W } })
      await tx.secureToken.deleteMany({ where: { workspaceId: W } })
      await tx.billing.deleteMany({ where: { workspaceId: W } })
      await tx.searchConversations.deleteMany({ where: { workspaceId: W } })
      await tx.userWorkspace.deleteMany({ where: { workspaceId: W } })
      await tx.whatsappSettings.deleteMany({ where: { workspaceId: W } })

      const result = await tx.workspace.deleteMany({
        where: { id: W, deletedAt: { not: null, lt: expiryDate } },
      })

      // Audit trail: soft_delete_audit_logs has a required CASCADE FK to
      // Workspace, so a DB audit row for a hard-deleted workspace cannot
      // exist (it would be cascade-deleted with it). The application log is
      // the audit record for this scope.
      logger.info("HARD_DELETE_AUDIT: workspaces permanently deleted", {
        entityType: "SCHEDULER_HARD_DELETE",
        reason: "SCHEDULED_CLEANUP",
        deletedWorkspaceIds: expired.map((w) => w.id),
        deletedCount: result.count,
      })

      return result.count
    })
  }

  /**
   * Individually soft-deleted customers whose workspace is still alive.
   * A hard-deleted customer takes their orders, carts, sessions, usage and
   * appointments with them (GDPR erasure semantics).
   */
  private async hardDeleteCustomers(expiryDate: Date): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const expired = await tx.customers.findMany({
        where: { deletedAt: { not: null, lt: expiryDate } },
        select: { id: true },
      })
      if (expired.length === 0) return 0
      const C = { in: expired.map((c) => c.id) }

      await tx.message.deleteMany({ where: { chatSession: { customerId: C } } })
      await tx.cartItems.deleteMany({ where: { cart: { customerId: C } } })
      await tx.paymentDetails.deleteMany({ where: { order: { customerId: C } } })
      await tx.appointment.deleteMany({ where: { customerId: C } })
      await tx.usage.deleteMany({ where: { clientId: C } })
      await tx.chatSession.deleteMany({ where: { customerId: C } })
      await tx.carts.deleteMany({ where: { customerId: C } })
      await tx.orders.deleteMany({ where: { customerId: C } })

      const result = await tx.customers.deleteMany({
        where: { id: C, deletedAt: { not: null, lt: expiryDate } },
      })
      return result.count
    })
  }

  /**
   * Individually soft-deleted orders (payment_details FK is RESTRICT).
   */
  private async hardDeleteOrders(expiryDate: Date): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const expired = await tx.orders.findMany({
        where: { deletedAt: { not: null, lt: expiryDate } },
        select: { id: true },
      })
      if (expired.length === 0) return 0
      const O = { in: expired.map((o) => o.id) }

      await tx.paymentDetails.deleteMany({ where: { orderId: O } })
      const result = await tx.orders.deleteMany({
        where: { id: O, deletedAt: { not: null, lt: expiryDate } },
      })
      return result.count
    })
  }

  /**
   * Individually soft-deleted messages and chat sessions
   * (messages FK to chat_sessions is RESTRICT — messages first).
   */
  private async hardDeleteChatData(expiryDate: Date): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      let count = 0

      const messages = await tx.message.deleteMany({
        where: { deletedAt: { not: null, lt: expiryDate } },
      })
      count += messages.count

      const expiredSessions = await tx.chatSession.findMany({
        where: { deletedAt: { not: null, lt: expiryDate } },
        select: { id: true },
      })
      if (expiredSessions.length > 0) {
        const S = { in: expiredSessions.map((s) => s.id) }
        await tx.message.deleteMany({ where: { chatSessionId: S } })
        const sessions = await tx.chatSession.deleteMany({
          where: { id: S, deletedAt: { not: null, lt: expiryDate } },
        })
        count += sessions.count
      }

      return count
    })
  }

  /**
   * Individually soft-deleted users. Their memberships, password resets and
   * sent invitations go with them. Users still referenced by business
   * records with RESTRICT FKs (support tickets, 2FA admin trail) make this
   * scope fail loudly via runScope — that is intentional: unlinking those
   * records is a business decision, not something this job may improvise.
   */
  private async hardDeleteUsers(expiryDate: Date): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const expired = await tx.user.findMany({
        where: { deletedAt: { not: null, lt: expiryDate } },
        select: { id: true },
      })
      if (expired.length === 0) return 0
      const U = { in: expired.map((u) => u.id) }

      await tx.userWorkspace.deleteMany({ where: { userId: U } })
      await tx.passwordReset.deleteMany({ where: { userId: U } })
      await tx.workspaceInvitation.deleteMany({ where: { invitedById: U } })

      const result = await tx.user.deleteMany({
        where: { id: U, deletedAt: { not: null, lt: expiryDate } },
      })
      return result.count
    })
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
