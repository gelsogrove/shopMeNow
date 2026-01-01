/**
 * Subscription Billing Repository
 * Feature 185: Subscription & Billing System
 * Feature 198: Owner-based billing (credit shared across all workspaces)
 *
 * Handles all database operations for:
 * - User (Owner) billing (credit balance, plan type)
 * - Billing transactions history
 * - Plan configurations
 *
 * CRITICAL (Feature 198): Billing is per OWNER (User), NOT per Workspace
 * - creditBalance, planType, subscriptionStatus are on User model
 * - workspaceId is optional in transactions (for tracking which channel)
 */

import { PlanType, PrismaClient, TransactionType, Prisma, SubscriptionStatus } from "@echatbot/database"
import logger from "../utils/logger"

export interface BillingInfo {
  planType: PlanType
  creditBalance: number
  trialEndsAt: Date | null
  planStartedAt: Date
  nextBillingDate: Date | null
  isTrialExpired: boolean
  daysUntilTrialExpires: number | null
  totalRecharges: number
  subscriptionStatus: SubscriptionStatus
}

export interface PlanLimits {
  maxChannels: number
  maxProducts: number
  maxCustomers: number
  messageCost: number
  orderCost: number
  pushCost: number
  lowBalanceThreshold: number
  monthlyFee: number
}

export interface TransactionRecord {
  id: string
  type: TransactionType
  amount: number
  balanceAfter: number
  description: string
  referenceId: string | null
  createdAt: Date
  workspaceId: string | null
  workspaceName: string | null
}

export class SubscriptionBillingRepository {
  constructor(private prisma: PrismaClient) {}

  // ============================================================================
  // OWNER (USER) BILLING - Feature 198
  // ============================================================================

  /**
   * Get owner billing information by userId
   * Feature 198: Billing is on User (Owner) level
   */
  async getOwnerBilling(userId: string): Promise<BillingInfo | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        creditBalance: true,
        planType: true,
        trialEndsAt: true,
        planStartedAt: true,
        nextBillingDate: true,
        subscriptionStatus: true,
      },
    })

    if (!user) {
      return null
    }

    const creditBalance = Number(user.creditBalance)

    // Calculate recharges for CURRENT month (from 1st of current month to now)
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    
    const rechargeSum = await this.prisma.billingTransaction.aggregate({
      where: {
        userId,
        type: 'RECHARGE',
        amount: { gt: 0 },
        createdAt: {
          gte: currentMonthStart,
          lte: now,
        },
      },
      _sum: { amount: true },
    })
    const totalRecharges = Number(rechargeSum._sum.amount || 0)

    const isTrialExpired =
      user.planType === "FREE_TRIAL" &&
      user.trialEndsAt !== null &&
      user.trialEndsAt < now

    let daysUntilTrialExpires: number | null = null
    if (
      user.planType === "FREE_TRIAL" &&
      user.trialEndsAt &&
      !isTrialExpired
    ) {
      const diffTime = user.trialEndsAt.getTime() - now.getTime()
      daysUntilTrialExpires = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    }

    return {
      planType: user.planType,
      creditBalance,
      trialEndsAt: user.trialEndsAt,
      planStartedAt: user.planStartedAt,
      nextBillingDate: user.nextBillingDate,
      isTrialExpired,
      daysUntilTrialExpires,
      totalRecharges,
      subscriptionStatus: user.subscriptionStatus,
    }
  }

  /**
   * Get owner billing from workspaceId (for backward compatibility)
   * Looks up the workspace owner and gets their billing
   * @deprecated Use getOwnerBilling(userId) directly when possible
   */
  async getWorkspaceBilling(workspaceId: string): Promise<BillingInfo | null> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    })

    if (!workspace?.ownerId) {
      return null
    }

    return this.getOwnerBilling(workspace.ownerId)
  }

  /**
   * Get plan configuration/limits from database
   * NO user/workspace needed - plans are global
   */
  async getPlanConfiguration(planType: PlanType): Promise<PlanLimits | null> {
    const config = await this.prisma.planConfiguration.findUnique({
      where: { planType },
    })

    if (!config) {
      return null
    }

    return {
      maxChannels: config.maxChannels,
      maxProducts: config.maxProducts,
      maxCustomers: config.maxCustomers,
      messageCost: Number(config.messageCost),
      orderCost: Number(config.orderCost),
      pushCost: Number(config.pushCost),
      lowBalanceThreshold: Number(config.lowBalanceThreshold),
      monthlyFee: Number(config.monthlyFee),
    }
  }

  /**
   * Get all plan configurations for comparison
   */
  async getAllPlanConfigurations() {
    return this.prisma.planConfiguration.findMany({
      where: { isActive: true },
      orderBy: { monthlyFee: "asc" },
    })
  }

  /**
   * Get current credit balance for owner (user)
   * Feature 198: Credit is on User level
   */
  async getOwnerCreditBalance(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    })

    return user ? Number(user.creditBalance) : 0
  }

  /**
   * Get credit balance from workspaceId (backward compatibility)
   * @deprecated Use getOwnerCreditBalance(userId) directly when possible
   */
  async getCreditBalance(workspaceId: string): Promise<number> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    })

    if (!workspace?.ownerId) {
      return 0
    }

    return this.getOwnerCreditBalance(workspace.ownerId)
  }

  // ============================================================================
  // CREDIT OPERATIONS - Feature 198 (Owner-based)
  // ============================================================================

  /**
   * Deduct credit from owner balance
   * ATOMIC TRANSACTION: Updates user balance and creates transaction record
   * Feature 198: Credit is on User level, workspaceId is optional for tracking
   *
   * @param userId - Owner's user ID
   * @param amount - Amount to deduct (positive number)
   * @param type - Transaction type
   * @param description - Human-readable description
   * @param workspaceId - Optional: which workspace/channel originated the charge
   * @param referenceId - Optional: reference to order, message, etc.
   * @param referenceType - Optional: type of reference
   * @returns New balance after deduction, or error if would go below -€10
   */
  async deductCredit(
    userId: string,
    amount: number,
    type: TransactionType,
    description: string,
    workspaceId?: string,
    referenceId?: string,
    referenceType?: string
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    // Feature 197: Credit can go negative up to -€10
    const CREDIT_MIN_THRESHOLD = -10

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Get current balance with lock
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { creditBalance: true, planType: true },
        })

        if (!user) {
          return { success: false, newBalance: 0, error: "User not found" }
        }

        const currentBalance = Number(user.creditBalance)
        const newBalance = currentBalance - amount

        // Feature 197: Allow negative balance up to -€10
        if (newBalance < CREDIT_MIN_THRESHOLD) {
          logger.warn(
            `[BILLING] ⚠️ Credit exhausted: €${currentBalance.toFixed(2)} - €${amount.toFixed(2)} = €${newBalance.toFixed(2)} < €${CREDIT_MIN_THRESHOLD} (user: ${userId})`
          )
          return {
            success: false,
            newBalance: currentBalance,
            error: `Credito esaurito. Saldo: €${currentBalance.toFixed(2)}. Il saldo non può scendere sotto €${CREDIT_MIN_THRESHOLD}.`,
          }
        }

        // Update user balance (can be negative)
        await tx.user.update({
          where: { id: userId },
          data: { creditBalance: new Prisma.Decimal(newBalance.toFixed(2)) },
        })

        // Create transaction record
        await tx.billingTransaction.create({
          data: {
            userId,
            workspaceId: workspaceId || null, // Optional: track which channel
            type,
            amount: new Prisma.Decimal((-amount).toFixed(2)), // Negative for deductions
            balanceAfter: new Prisma.Decimal(newBalance.toFixed(2)),
            description,
            referenceId,
            referenceType,
          },
        })

        const channelInfo = workspaceId ? `, channel: ${workspaceId}` : ''
        logger.info(
          `[BILLING] 💰 Deducted €${amount.toFixed(2)}: €${currentBalance.toFixed(2)} → €${newBalance.toFixed(2)} (${type}, user: ${userId}${channelInfo})`
        )

        return { success: true, newBalance }
      })
    } catch (error) {
      logger.error(`[BILLING] ❌ Failed to deduct credit:`, error)
      throw error
    }
  }

  /**
   * Add credit to owner balance (recharge)
   * ATOMIC TRANSACTION: Updates user balance and creates transaction record
   * Feature 198: Credit is on User level
   */
  async addCredit(
    userId: string,
    amount: number,
    type: TransactionType,
    description: string,
    workspaceId?: string
  ): Promise<{ success: boolean; newBalance: number }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Get current balance
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { creditBalance: true },
        })

        if (!user) {
          throw new Error("User not found")
        }

        const currentBalance = Number(user.creditBalance)
        const newBalance = currentBalance + amount

        // Update user balance
        await tx.user.update({
          where: { id: userId },
          data: { creditBalance: new Prisma.Decimal(newBalance.toFixed(2)) },
        })

        // Create transaction record
        await tx.billingTransaction.create({
          data: {
            userId,
            workspaceId: workspaceId || null, // Optional: track which channel
            type,
            amount: new Prisma.Decimal(amount.toFixed(2)), // Positive for credits
            balanceAfter: new Prisma.Decimal(newBalance.toFixed(2)),
            description,
          },
        })

        logger.info(
          `[BILLING] 💰 Added €${amount.toFixed(2)}: €${currentBalance.toFixed(2)} → €${newBalance.toFixed(2)} (${type}, user: ${userId})`
        )

        return { success: true, newBalance }
      })
    } catch (error) {
      logger.error(`[BILLING] ❌ Failed to add credit:`, error)
      throw error
    }
  }

  // ============================================================================
  // TRANSACTION HISTORY - Feature 198 (Owner-based)
  // ============================================================================

  /**
   * Get transaction history for owner
   * Feature 198: Transactions are per User (Owner)
   */
  async getOwnerTransactionHistory(
    userId: string,
    options: {
      limit?: number
      offset?: number
      type?: TransactionType
      startDate?: Date
      endDate?: Date
    } = {}
  ): Promise<{ transactions: TransactionRecord[]; total: number }> {
    const { limit = 20, offset = 0, type, startDate, endDate } = options

    // Get owner's workspaces for workspace name lookup
    const ownerWorkspaces = await this.prisma.workspace.findMany({
      where: { ownerId: userId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
    })
    const workspaceNameMap = new Map(ownerWorkspaces.map(w => [w.id, w.name]))

    // Build where clause for owner's transactions
    const where: Prisma.BillingTransactionWhereInput = { userId }

    if (type) {
      where.type = type
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = startDate
      if (endDate) where.createdAt.lte = endDate
    }

    const [transactions, total] = await Promise.all([
      this.prisma.billingTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          type: true,
          amount: true,
          balanceAfter: true,
          description: true,
          referenceId: true,
          createdAt: true,
          workspaceId: true,
        },
      }),
      this.prisma.billingTransaction.count({ where }),
    ])

    return {
      transactions: transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
        balanceAfter: Number(t.balanceAfter),
        workspaceName: t.workspaceId ? workspaceNameMap.get(t.workspaceId) || null : null,
      })),
      total,
    }
  }

  /**
   * Get transaction history from workspaceId (backward compatibility)
   * @deprecated Use getOwnerTransactionHistory(userId) directly when possible
   */
  async getTransactionHistory(
    workspaceId: string,
    options: {
      limit?: number
      offset?: number
      type?: TransactionType
      startDate?: Date
      endDate?: Date
    } = {}
  ): Promise<{ transactions: TransactionRecord[]; total: number }> {
    // Get workspace owner
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    })

    if (!workspace?.ownerId) {
      return { transactions: [], total: 0 }
    }

    return this.getOwnerTransactionHistory(workspace.ownerId, options)
  }

  // ============================================================================
  // PLAN MANAGEMENT - Feature 198 (Owner-based)
  // ============================================================================

  /**
   * Calculate next billing date:
   * - If today is 1st of month AND before 23:30 → today at 23:30 (charge happens today)
   * - Otherwise → 1st of next month at 23:30
   * 
   * Scheduler runs at 23:30 on the 1st of each month
   */
  private getFirstOfNextMonth(): Date {
    const now = new Date()
    const today = now.getDate()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    
    // If it's the 1st of the month AND before 23:30, next charge is TODAY at 23:30
    if (today === 1 && (currentHour < 23 || (currentHour === 23 && currentMinute < 30))) {
      const todayCharge = new Date(now.getFullYear(), now.getMonth(), 1)
      todayCharge.setHours(23, 30, 0, 0)
      return todayCharge
    }
    
    // Otherwise, next charge is 1st of next month at 23:30
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    nextMonth.setHours(23, 30, 0, 0)
    return nextMonth
  }

  /**
   * Upgrade owner plan
   * Feature 198: Plan is on User level
   */
  async upgradeOwnerPlan(
    userId: string,
    newPlanType: PlanType
  ): Promise<{ success: boolean; nextBillingDate: Date }> {
    const nextBillingDate = this.getFirstOfNextMonth()

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        planType: newPlanType,
        planStartedAt: new Date(),
        nextBillingDate,
        trialEndsAt: null, // Clear trial when upgrading
      },
    })

    logger.info(
      `[BILLING] 📈 Plan upgraded to ${newPlanType} (user: ${userId}, next billing: ${nextBillingDate.toISOString()})`
    )

    return { success: true, nextBillingDate }
  }

  /**
   * Upgrade plan from workspaceId (backward compatibility)
   * @deprecated Use upgradeOwnerPlan(userId) directly when possible
   */
  async upgradePlan(
    workspaceId: string,
    newPlanType: PlanType
  ): Promise<{ success: boolean; nextBillingDate: Date }> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    })

    if (!workspace?.ownerId) {
      throw new Error("Workspace owner not found")
    }

    return this.upgradeOwnerPlan(workspace.ownerId, newPlanType)
  }

  // ============================================================================
  // USAGE TRACKING - Feature 198 (Aggregated across owner's workspaces)
  // ============================================================================

  /**
   * Get owner usage counts (aggregated across ALL owned workspaces)
   * Feature 198: Products/Customers are aggregated per Owner
   */
  async getOwnerUsage(userId: string): Promise<{
    productsCount: number
    customersCount: number
    channelsCount: number
  }> {
    // Get all workspaces owned by this user (exclude soft-deleted)
    const ownerWorkspaces = await this.prisma.workspace.findMany({
      where: { ownerId: userId, isActive: true, deletedAt: null },
      select: { id: true },
    })

    const ownerWorkspaceIds = ownerWorkspaces.map(w => w.id)

    if (ownerWorkspaceIds.length === 0) {
      return { productsCount: 0, customersCount: 0, channelsCount: 0 }
    }

    // Aggregate counts across ALL owner's workspaces
    const [productsCount, customersCount] = await Promise.all([
      this.prisma.products.count({
        where: { workspaceId: { in: ownerWorkspaceIds }, isActive: true },
      }),
      this.prisma.customers.count({
        where: { workspaceId: { in: ownerWorkspaceIds }, isActive: true },
      }),
    ])

    return {
      productsCount,
      customersCount,
      channelsCount: ownerWorkspaces.length,
    }
  }

  /**
   * Get workspace usage from workspaceId (backward compatibility)
   * @deprecated Use getOwnerUsage(userId) directly when possible
   */
  async getWorkspaceUsage(workspaceId: string): Promise<{
    productsCount: number
    customersCount: number
    channelsCount: number
  }> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    })

    if (!workspace?.ownerId) {
      // Fallback: count only for this workspace
      const [productsCount, customersCount] = await Promise.all([
        this.prisma.products.count({
          where: { workspaceId, isActive: true },
        }),
        this.prisma.customers.count({
          where: { workspaceId, isActive: true },
        }),
      ])
      return { productsCount, customersCount, channelsCount: 1 }
    }

    return this.getOwnerUsage(workspace.ownerId)
  }

  // ============================================================================
  // LOW BALANCE NOTIFICATIONS - Feature 198 (Owner-based)
  // ============================================================================

  /**
   * Update low balance notification timestamp for owner
   */
  async updateOwnerLowBalanceNotification(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lowBalanceNotifiedAt: new Date() },
    })
  }

  /**
   * Update low balance notification from workspaceId (backward compatibility)
   * @deprecated Use updateOwnerLowBalanceNotification(userId) directly
   */
  async updateLowBalanceNotification(workspaceId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    })

    if (workspace?.ownerId) {
      await this.updateOwnerLowBalanceNotification(workspace.ownerId)
    }
  }

  /**
   * Check if low balance notification was sent recently (within 24h) for owner
   */
  async shouldSendOwnerLowBalanceNotification(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lowBalanceNotifiedAt: true },
    })

    if (!user?.lowBalanceNotifiedAt) {
      return true
    }

    const hoursSinceLastNotification =
      (Date.now() - user.lowBalanceNotifiedAt.getTime()) / (1000 * 60 * 60)

    return hoursSinceLastNotification >= 24
  }

  /**
   * Check low balance notification from workspaceId (backward compatibility)
   * @deprecated Use shouldSendOwnerLowBalanceNotification(userId) directly
   */
  async shouldSendLowBalanceNotification(workspaceId: string): Promise<boolean> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    })

    if (!workspace?.ownerId) {
      return true
    }

    return this.shouldSendOwnerLowBalanceNotification(workspace.ownerId)
  }

  // ============================================================================
  // SUBSCRIPTION STATUS - Feature 198 (Owner-based)
  // ============================================================================

  /**
   * Get owner subscription status
   */
  async getOwnerSubscriptionStatus(userId: string): Promise<{
    status: SubscriptionStatus
    pausedAt: Date | null
    pauseRequestedAt: Date | null
    pendingPlanType: PlanType | null
    pendingPlanEffectiveDate: Date | null
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        pausedAt: true,
        pauseRequestedAt: true,
        pendingPlanType: true,
        pendingPlanEffectiveDate: true,
      },
    })

    if (!user) {
      return null
    }

    return {
      status: user.subscriptionStatus,
      pausedAt: user.pausedAt,
      pauseRequestedAt: user.pauseRequestedAt,
      pendingPlanType: user.pendingPlanType,
      pendingPlanEffectiveDate: user.pendingPlanEffectiveDate,
    }
  }

  /**
   * Update owner subscription status
   */
  async updateOwnerSubscriptionStatus(
    userId: string,
    data: {
      subscriptionStatus?: SubscriptionStatus
      pausedAt?: Date | null
      pauseRequestedAt?: Date | null
      pendingPlanType?: PlanType | null
      pendingPlanEffectiveDate?: Date | null
      lastPaymentFailedAt?: Date | null
      paymentFailureCount?: number
    }
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data,
    })
  }
}
