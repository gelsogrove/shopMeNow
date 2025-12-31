/**
 * Invoice Service
 * Feature 197: Monthly Invoice Management
 * 
 * Handles creation, retrieval, and management of monthly invoices.
 * Invoices are per OWNER (User), not per Workspace (Feature 198).
 * 
 * Key responsibilities:
 * - Create/update draft invoice for current month
 * - Calculate consumption breakdown from BillingTransactions
 * - Finalize invoice at month end
 * - Generate invoice data for display
 */

import { prisma, InvoiceStatus, PlanType, TransactionType, SubscriptionStatus } from '@echatbot/database'
import logger from '../../utils/logger'

interface ConsumptionBreakdown {
  messages: { count: number; amount: number }
  orders: { count: number; amount: number }
  pushNotifications: { count: number; amount: number }
  adjustments: { count: number; amount: number }
  totalConsumption: number
}

interface InvoiceData {
  id: string
  userId: string
  periodStart: Date
  periodEnd: Date
  periodMonth: number
  periodYear: number
  subscriptionAmount: number
  creditUsage: number
  creditDebt: number
  totalAmount: number
  status: InvoiceStatus
  paidAt: Date | null
  planType: PlanType
  itemsBreakdown: ConsumptionBreakdown
  createdAt: Date
  updatedAt: Date
}

export class InvoiceService {
  /**
   * Determine subscription fee for a billing period based on pause status.
   * - If paused before the period starts: no monthly fee.
   * - If paused within the period: charge full monthly fee.
   */
  private resolveSubscriptionAmount(
    subscriptionStatus: SubscriptionStatus | string,
    pausedAt: Date | null,
    periodStart: Date,
    monthlyFee: number
  ): number {
    if (subscriptionStatus !== "PAUSED") {
      return monthlyFee
    }

    if (!pausedAt) {
      return 0
    }

    return pausedAt <= periodStart ? 0 : monthlyFee
  }

  /**
   * Determine effective consumption window for paused users.
   * - If paused before period start: skip consumption.
   * - If paused within the period: cap consumption at pausedAt.
   */
  private resolveConsumptionEnd(
    subscriptionStatus: SubscriptionStatus | string,
    pausedAt: Date | null,
    periodStart: Date,
    periodEnd: Date
  ): Date | null {
    if (subscriptionStatus !== "PAUSED" || !pausedAt) {
      return periodEnd
    }

    if (pausedAt <= periodStart) {
      return null
    }

    return pausedAt < periodEnd ? pausedAt : periodEnd
  }

  /**
   * Get plan monthly fee from database (PlanConfiguration table)
   * NO HARDCODED VALUES - everything from database
   */
  private async getPlanMonthlyFee(planType: string): Promise<number> {
    const planConfig = await prisma.planConfiguration.findUnique({
      where: { planType: planType as any },
      select: { monthlyFee: true },
    })
    return planConfig ? Number(planConfig.monthlyFee) : 0
  }

  /**
   * Get or create the current month's draft invoice for an owner
   */
  async getOrCreateCurrentInvoice(userId: string): Promise<InvoiceData> {
    const now = new Date()
    const periodMonth = now.getMonth() + 1 // 1-12
    const periodYear = now.getFullYear()
    
    // Try to find existing invoice for this month
    let invoice = await prisma.monthlyInvoice.findUnique({
      where: {
        userId_periodYear_periodMonth: {
          userId,
          periodYear,
          periodMonth,
        },
      },
    })
    
    if (!invoice) {
      // Get user's plan type
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { planType: true, creditBalance: true, subscriptionStatus: true, pausedAt: true },
      })
      
      if (!user) {
        throw new Error('User not found')
      }
      
      // Get plan monthly fee from database (NO HARDCODED VALUES)
      const monthlyFee = await this.getPlanMonthlyFee(user.planType)
      const periodStart = new Date(periodYear, periodMonth - 1, 1, 0, 0, 0)
      const subscriptionAmount = this.resolveSubscriptionAmount(
        user.subscriptionStatus,
        user.pausedAt,
        periodStart,
        monthlyFee
      )
      
      // Calculate period dates
      const periodEnd = new Date(periodYear, periodMonth, 0, 23, 59, 59) // Last day of month
      
      // Create draft invoice
      invoice = await prisma.monthlyInvoice.create({
        data: {
          userId,
          periodStart,
          periodEnd,
          periodMonth,
          periodYear,
          subscriptionAmount,
          creditUsage: 0,
          creditDebt: 0,
          totalAmount: subscriptionAmount,
          status: 'DRAFT',
          planType: user.planType,
          itemsBreakdown: {
            messages: { count: 0, amount: 0 },
            orders: { count: 0, amount: 0 },
            pushNotifications: { count: 0, amount: 0 },
            adjustments: { count: 0, amount: 0 },
            totalConsumption: 0,
          } as any, // Cast to any for Prisma JSON compatibility
        },
      })
      
      logger.info(`[Invoice] Created draft invoice for user ${userId} - ${periodMonth}/${periodYear}`)
    }
    
    // Calculate current consumption from transactions
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { planType: true, subscriptionStatus: true, pausedAt: true },
    })

    if (!user) {
      throw new Error('User not found')
    }

    const monthlyFee = await this.getPlanMonthlyFee(user.planType)
    const subscriptionAmount = this.resolveSubscriptionAmount(
      user.subscriptionStatus,
      user.pausedAt,
      invoice.periodStart,
      monthlyFee
    )
    const consumptionEnd = this.resolveConsumptionEnd(
      user.subscriptionStatus,
      user.pausedAt,
      invoice.periodStart,
      invoice.periodEnd
    )
    const consumption = consumptionEnd
      ? await this.calculateConsumption(userId, invoice.periodStart, consumptionEnd)
      : {
          messages: { count: 0, amount: 0 },
          orders: { count: 0, amount: 0 },
          pushNotifications: { count: 0, amount: 0 },
          adjustments: { count: 0, amount: 0 },
          totalConsumption: 0,
        }
    
    // Update invoice with current consumption
    const updatedInvoice = await prisma.monthlyInvoice.update({
      where: { id: invoice.id },
      data: {
        creditUsage: consumption.totalConsumption,
        subscriptionAmount,
        itemsBreakdown: consumption as any, // Cast to any for Prisma JSON compatibility
        totalAmount: Number(subscriptionAmount) + consumption.totalConsumption,
      },
    })
    
    return this.mapToInvoiceData(updatedInvoice)
  }
  
  /**
   * Calculate consumption breakdown from BillingTransactions
   */
  async calculateConsumption(
    userId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<ConsumptionBreakdown> {
    // Get all debit transactions for this period
    const transactions = await prisma.billingTransaction.findMany({
      where: {
        userId,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        amount: { lt: 0 }, // Only debit transactions
      },
    })
    
    // Calculate breakdown by type
    const breakdown: ConsumptionBreakdown = {
      messages: { count: 0, amount: 0 },
      orders: { count: 0, amount: 0 },
      pushNotifications: { count: 0, amount: 0 },
      adjustments: { count: 0, amount: 0 },
      totalConsumption: 0,
    }
    
    for (const tx of transactions) {
      const amount = Math.abs(Number(tx.amount))
      
      switch (tx.type) {
        case 'MESSAGE':
          breakdown.messages.count++
          breakdown.messages.amount += amount
          break
        case 'NEW_ORDER':
          breakdown.orders.count++
          breakdown.orders.amount += amount
          break
        case 'PUSH_NOTIFICATION':
          breakdown.pushNotifications.count++
          breakdown.pushNotifications.amount += amount
          break
        case 'ADJUSTMENT':
          breakdown.adjustments.count++
          breakdown.adjustments.amount += amount
          break
        // Skip other types like RECHARGE, MONTHLY_FEE, etc.
      }
    }
    
    breakdown.totalConsumption = 
      breakdown.messages.amount +
      breakdown.orders.amount +
      breakdown.pushNotifications.amount +
      breakdown.adjustments.amount
    
    return breakdown
  }
  
  /**
   * Get all invoices for an owner (paginated)
   */
  async getInvoicesForOwner(
    userId: string,
    page: number = 1,
    limit: number = 12
  ): Promise<{ invoices: InvoiceData[]; total: number }> {
    const skip = (page - 1) * limit
    
    const [invoices, total] = await Promise.all([
      prisma.monthlyInvoice.findMany({
        where: { userId },
        orderBy: [
          { periodYear: 'desc' },
          { periodMonth: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.monthlyInvoice.count({ where: { userId } }),
    ])
    
    return {
      invoices: invoices.map(this.mapToInvoiceData),
      total,
    }
  }
  
  /**
   * Get a specific invoice by ID
   */
  async getInvoiceById(invoiceId: string, userId: string): Promise<InvoiceData | null> {
    const invoice = await prisma.monthlyInvoice.findFirst({
      where: {
        id: invoiceId,
        userId, // Security: ensure owner owns this invoice
      },
    })
    
    return invoice ? this.mapToInvoiceData(invoice) : null
  }
  
  /**
   * Finalize invoice at month end (called by scheduler)
   * Changes status from DRAFT to PENDING
   */
  async finalizeInvoice(invoiceId: string): Promise<void> {
    const invoice = await prisma.monthlyInvoice.findUnique({
      where: { id: invoiceId },
    })
    
    if (!invoice) {
      throw new Error('Invoice not found')
    }
    
    if (invoice.status !== 'DRAFT') {
      logger.warn(`[Invoice] Attempted to finalize non-draft invoice ${invoiceId}`)
      return
    }
    
    // Recalculate final consumption
    const user = await prisma.user.findUnique({
      where: { id: invoice.userId },
      select: { planType: true, creditBalance: true, subscriptionStatus: true, pausedAt: true },
    })

    if (!user) {
      throw new Error('User not found')
    }

    const monthlyFee = await this.getPlanMonthlyFee(user.planType)
    const subscriptionAmount = this.resolveSubscriptionAmount(
      user.subscriptionStatus,
      user.pausedAt,
      invoice.periodStart,
      monthlyFee
    )
    const consumptionEnd = this.resolveConsumptionEnd(
      user.subscriptionStatus,
      user.pausedAt,
      invoice.periodStart,
      invoice.periodEnd
    )
    const consumption = consumptionEnd
      ? await this.calculateConsumption(
          invoice.userId,
          invoice.periodStart,
          consumptionEnd
        )
      : {
          messages: { count: 0, amount: 0 },
          orders: { count: 0, amount: 0 },
          pushNotifications: { count: 0, amount: 0 },
          adjustments: { count: 0, amount: 0 },
          totalConsumption: 0,
        }
    
    // Get user's credit debt (if negative balance)
    const creditDebt = user.creditBalance < 0 ? Math.abs(Number(user.creditBalance)) : 0
    const totalAmount = Number(subscriptionAmount) + consumption.totalConsumption + creditDebt
    
    await prisma.monthlyInvoice.update({
      where: { id: invoiceId },
      data: {
        creditUsage: consumption.totalConsumption,
        subscriptionAmount,
        creditDebt,
        totalAmount,
        itemsBreakdown: consumption as any, // Cast to any for Prisma JSON compatibility
        status: 'PENDING',
      },
    })
    
    logger.info(`[Invoice] Finalized invoice ${invoiceId} - Total: €${totalAmount.toFixed(2)}`)
  }
  
  /**
   * Mark invoice as paid
   */
  async markInvoicePaid(invoiceId: string, paypalTransactionId?: string): Promise<void> {
    await prisma.monthlyInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paypalTransactionId,
      },
    })
    
    logger.info(`[Invoice] Marked invoice ${invoiceId} as PAID`)
  }
  
  /**
   * Mark invoice as failed
   */
  async markInvoiceFailed(invoiceId: string): Promise<void> {
    await prisma.monthlyInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'FAILED',
      },
    })
    
    logger.info(`[Invoice] Marked invoice ${invoiceId} as FAILED`)
  }
  
  /**
   * Map Prisma model to InvoiceData interface
   */
  private mapToInvoiceData(invoice: any): InvoiceData {
    return {
      id: invoice.id,
      userId: invoice.userId,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      periodMonth: invoice.periodMonth,
      periodYear: invoice.periodYear,
      subscriptionAmount: Number(invoice.subscriptionAmount),
      creditUsage: Number(invoice.creditUsage),
      creditDebt: Number(invoice.creditDebt),
      totalAmount: Number(invoice.totalAmount),
      status: invoice.status,
      paidAt: invoice.paidAt,
      planType: invoice.planType,
      itemsBreakdown: invoice.itemsBreakdown as ConsumptionBreakdown,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    }
  }
}

// Singleton instance
export const invoiceService = new InvoiceService()
