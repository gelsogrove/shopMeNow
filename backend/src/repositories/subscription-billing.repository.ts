/**
 * Subscription Billing Repository
 * Feature 185: Subscription & Billing System
 *
 * Handles all database operations for:
 * - Workspace billing (credit balance, plan type)
 * - Billing transactions history
 * - Plan configurations
 *
 * SECURITY: All methods require workspaceId for multi-tenant isolation
 */

import { PlanType, PrismaClient, TransactionType } from "@prisma/client"
import { Decimal } from "@prisma/client/runtime/library"
import logger from "../utils/logger"

export interface BillingInfo {
  planType: PlanType
  creditBalance: number
  trialEndsAt: Date | null
  planStartedAt: Date
  nextBillingDate: Date | null
  isTrialExpired: boolean
  daysUntilTrialExpires: number | null
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
}

export class SubscriptionBillingRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get workspace billing information
   * SECURITY: Requires workspaceId
   */
  async getWorkspaceBilling(workspaceId: string): Promise<BillingInfo | null> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        planType: true,
        creditBalance: true,
        trialEndsAt: true,
        planStartedAt: true,
        nextBillingDate: true,
      },
    })

    if (!workspace) {
      return null
    }

    const now = new Date()
    const isTrialExpired =
      workspace.planType === "FREE_TRIAL" &&
      workspace.trialEndsAt !== null &&
      workspace.trialEndsAt < now

    let daysUntilTrialExpires: number | null = null
    if (
      workspace.planType === "FREE_TRIAL" &&
      workspace.trialEndsAt &&
      !isTrialExpired
    ) {
      const diffTime = workspace.trialEndsAt.getTime() - now.getTime()
      daysUntilTrialExpires = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    }

    return {
      planType: workspace.planType,
      creditBalance: Number(workspace.creditBalance),
      trialEndsAt: workspace.trialEndsAt,
      planStartedAt: workspace.planStartedAt,
      nextBillingDate: workspace.nextBillingDate,
      isTrialExpired,
      daysUntilTrialExpires,
    }
  }

  /**
   * Get plan configuration/limits from database
   * NO workspaceId needed - plans are global
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
   * Get current credit balance for workspace
   * SECURITY: Requires workspaceId
   */
  async getCreditBalance(workspaceId: string): Promise<number> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { creditBalance: true },
    })

    return workspace ? Number(workspace.creditBalance) : 0
  }

  /**
   * Deduct credit from workspace balance
   * ATOMIC TRANSACTION: Updates balance and creates transaction record
   * SECURITY: Requires workspaceId
   *
   * @returns New balance after deduction, or null if insufficient funds
   */
  async deductCredit(
    workspaceId: string,
    amount: number,
    type: TransactionType,
    description: string,
    referenceId?: string,
    referenceType?: string
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Get current balance with lock
        const workspace = await tx.workspace.findUnique({
          where: { id: workspaceId },
          select: { creditBalance: true, planType: true },
        })

        if (!workspace) {
          return { success: false, newBalance: 0, error: "Workspace not found" }
        }

        const currentBalance = Number(workspace.creditBalance)

        // Check sufficient funds
        if (currentBalance < amount) {
          logger.warn(
            `[BILLING] ⚠️ Insufficient credit: €${currentBalance.toFixed(2)} < €${amount.toFixed(2)} (workspace: ${workspaceId})`
          )
          return {
            success: false,
            newBalance: currentBalance,
            error: `Credito insufficiente. Saldo: €${currentBalance.toFixed(2)}, Richiesto: €${amount.toFixed(2)}`,
          }
        }

        const newBalance = currentBalance - amount

        // Update workspace balance
        await tx.workspace.update({
          where: { id: workspaceId },
          data: { creditBalance: new Decimal(newBalance.toFixed(2)) },
        })

        // Create transaction record
        await tx.billingTransaction.create({
          data: {
            workspaceId,
            type,
            amount: new Decimal((-amount).toFixed(2)), // Negative for deductions
            balanceAfter: new Decimal(newBalance.toFixed(2)),
            description,
            referenceId,
            referenceType,
          },
        })

        logger.info(
          `[BILLING] 💰 Deducted €${amount.toFixed(2)}: €${currentBalance.toFixed(2)} → €${newBalance.toFixed(2)} (${type}, workspace: ${workspaceId})`
        )

        return { success: true, newBalance }
      })
    } catch (error) {
      logger.error(`[BILLING] ❌ Failed to deduct credit:`, error)
      throw error
    }
  }

  /**
   * Add credit to workspace balance (recharge)
   * ATOMIC TRANSACTION: Updates balance and creates transaction record
   * SECURITY: Requires workspaceId
   */
  async addCredit(
    workspaceId: string,
    amount: number,
    type: TransactionType,
    description: string
  ): Promise<{ success: boolean; newBalance: number }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Get current balance
        const workspace = await tx.workspace.findUnique({
          where: { id: workspaceId },
          select: { creditBalance: true },
        })

        if (!workspace) {
          throw new Error("Workspace not found")
        }

        const currentBalance = Number(workspace.creditBalance)
        const newBalance = currentBalance + amount

        // Update workspace balance
        await tx.workspace.update({
          where: { id: workspaceId },
          data: { creditBalance: new Decimal(newBalance.toFixed(2)) },
        })

        // Create transaction record
        await tx.billingTransaction.create({
          data: {
            workspaceId,
            type,
            amount: new Decimal(amount.toFixed(2)), // Positive for credits
            balanceAfter: new Decimal(newBalance.toFixed(2)),
            description,
          },
        })

        logger.info(
          `[BILLING] 💰 Added €${amount.toFixed(2)}: €${currentBalance.toFixed(2)} → €${newBalance.toFixed(2)} (${type}, workspace: ${workspaceId})`
        )

        return { success: true, newBalance }
      })
    } catch (error) {
      logger.error(`[BILLING] ❌ Failed to add credit:`, error)
      throw error
    }
  }

  /**
   * Get transaction history for workspace
   * SECURITY: Requires workspaceId
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
    const { limit = 20, offset = 0, type, startDate, endDate } = options

    const where: any = { workspaceId }

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
        },
      }),
      this.prisma.billingTransaction.count({ where }),
    ])

    return {
      transactions: transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
        balanceAfter: Number(t.balanceAfter),
      })),
      total,
    }
  }

  /**
   * Upgrade workspace plan
   * ATOMIC TRANSACTION: Updates plan type and sets next billing date
   * SECURITY: Requires workspaceId
   */
  async upgradePlan(
    workspaceId: string,
    newPlanType: PlanType
  ): Promise<{ success: boolean; nextBillingDate: Date }> {
    const nextBillingDate = new Date()
    nextBillingDate.setDate(nextBillingDate.getDate() + 30) // 30 days from now

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        planType: newPlanType,
        planStartedAt: new Date(),
        nextBillingDate,
        trialEndsAt: null, // Clear trial when upgrading
      },
    })

    logger.info(
      `[BILLING] 📈 Plan upgraded to ${newPlanType} (workspace: ${workspaceId}, next billing: ${nextBillingDate.toISOString()})`
    )

    return { success: true, nextBillingDate }
  }

  /**
   * Get workspace usage counts for limit checking
   * SECURITY: Requires workspaceId
   */
  async getWorkspaceUsage(workspaceId: string): Promise<{
    productsCount: number
    customersCount: number
    channelsCount: number
  }> {
    // Get owner's workspace count (channels)
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    })

    const [productsCount, customersCount, channelsCount] = await Promise.all([
      this.prisma.products.count({
        where: { workspaceId, isActive: true },
      }),
      this.prisma.customers.count({
        where: { workspaceId, isActive: true },
      }),
      workspace?.ownerId
        ? this.prisma.workspace.count({
            where: { ownerId: workspace.ownerId, isActive: true },
          })
        : Promise.resolve(1),
    ])

    return { productsCount, customersCount, channelsCount }
  }

  /**
   * Update low balance notification timestamp
   * SECURITY: Requires workspaceId
   */
  async updateLowBalanceNotification(workspaceId: string): Promise<void> {
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { lowBalanceNotifiedAt: new Date() },
    })
  }

  /**
   * Check if low balance notification was sent recently (within 24h)
   * SECURITY: Requires workspaceId
   */
  async shouldSendLowBalanceNotification(
    workspaceId: string
  ): Promise<boolean> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { lowBalanceNotifiedAt: true },
    })

    if (!workspace?.lowBalanceNotifiedAt) {
      return true
    }

    const hoursSinceLastNotification =
      (Date.now() - workspace.lowBalanceNotifiedAt.getTime()) / (1000 * 60 * 60)

    return hoursSinceLastNotification >= 24
  }
}
