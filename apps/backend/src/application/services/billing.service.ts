import { BillingType, PrismaClient } from "@prisma/client"
import { PricingRepository } from "../../repositories/pricing.repository"
import logger from "../../utils/logger"

export class BillingService {
  private pricingRepository: PricingRepository

  constructor(private prisma: PrismaClient) {
    this.pricingRepository = new PricingRepository(prisma)
  }

  /**
   * Charge the monthly channel cost on the first day of each month
   */
  async chargeMonthlyChannelCost(workspaceId: string): Promise<void> {
    try {
      // Get current price from database
      const monthlyChannelCost =
        (await this.pricingRepository.getValue("MONTHLY_CHANNEL_COST")) ?? 49

      await this.prisma.billing.create({
        data: {
          workspaceId,
          amount: monthlyChannelCost,
          type: BillingType.MONTHLY_CHANNEL,
          description: "Monthly channel subscription cost",
        },
      })
      logger.info(`Charged monthly channel cost for workspace ${workspaceId}`)
    } catch (error) {
      logger.error(
        `Failed to charge monthly channel cost for workspace ${workspaceId}`,
        error
      )
      throw error
    }
  }

  /**
   * Track message cost (€0.10) - used for all message interactions
   * This deducts from ALL workspace credits (shared across owner's channels)
   * AND records in billingTransactions for Transaction History
   */
  async trackMessage(
    workspaceId: string,
    customerId: string,
    description: string = "Message interaction",
    userQuery?: string
  ): Promise<void> {
    try {
      // Get current price from database (fallback to 0.10 for safety)
      const messageCost =
        (await this.pricingRepository.getValue("MESSAGE")) ?? 0.10

      // Get current total for this customer (for legacy billing table)
      const previousTotal = await this.getCurrentTotalForCustomer(
        workspaceId,
        customerId
      )
      const currentCharge = messageCost
      const newTotal = previousTotal + currentCharge

      // 1️⃣ Write to legacy billing table (for Analytics)
      await this.prisma.billing.create({
        data: {
          workspaceId,
          customerId,
          amount: currentCharge,
          type: BillingType.MESSAGE,
          description,
          userQuery: userQuery || null,
          previousTotal,
          currentCharge,
          newTotal,
        },
      })

      // 2️⃣ Get workspace and owner to update ALL owner's workspaces
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { creditBalance: true, ownerId: true, name: true },
      })

      if (workspace && workspace.ownerId) {
        const newBalance = Number(workspace.creditBalance) - messageCost

        // Update ALL workspaces of this owner with the new balance (shared credit)
        await this.prisma.workspace.updateMany({
          where: { 
            ownerId: workspace.ownerId,
            isActive: true,
          },
          data: { creditBalance: newBalance },
        })

        // 3️⃣ Record in billingTransactions for Transaction History (with channel name)
        await this.prisma.billingTransaction.create({
          data: {
            workspaceId,
            type: "MESSAGE",
            amount: messageCost,
            description: `WhatsApp message (${workspace.name})`,
            balanceAfter: newBalance,
          },
        })

        logger.info(
          `[BILLING] 💰 Message: €${messageCost.toFixed(2)} deducted from all owner workspaces. New balance: €${newBalance.toFixed(2)}`
        )
      }
    } catch (error) {
      logger.error(
        `Failed to charge message cost for workspace ${workspaceId}, customer ${customerId}`,
        error
      )
      throw error
    }
  }

  /**
   * Get billing summary for a workspace
   */
  async getBillingSummary(
    workspaceId: string,
    days: number = 30
  ): Promise<{
    totalCost: number
    billingByType: Record<string, { count: number; cost: number }>
    recentBilling: any[]
  }> {
    try {
      const since = new Date()
      since.setDate(since.getDate() - days)

      const billings = await this.prisma.billing.findMany({
        where: {
          workspaceId,
          createdAt: {
            gte: since,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      const totalCost = billings.reduce(
        (sum, billing) => sum + billing.amount,
        0
      )

      const billingByType = billings.reduce(
        (acc, billing) => {
          const type = billing.type
          if (!acc[type]) {
            acc[type] = { count: 0, cost: 0 }
          }
          acc[type].count += 1
          acc[type].cost += billing.amount
          return acc
        },
        {} as Record<string, { count: number; cost: number }>
      )

      return {
        totalCost,
        billingByType,
        recentBilling: billings.slice(0, 50), // Last 50 billing records
      }
    } catch (error) {
      logger.error(
        `Failed to get billing summary for workspace ${workspaceId}`,
        error
      )
      throw error
    }
  }

  /**
   * Get current total billing cost for a workspace
   */
  async getCurrentTotal(workspaceId: string): Promise<number> {
    try {
      const result = await this.prisma.billing.aggregate({
        where: {
          workspaceId,
        },
        _sum: {
          amount: true,
        },
      })

      return result._sum.amount
        ? parseFloat(result._sum.amount.toString())
        : 0.0
    } catch (error) {
      logger.error(
        `Failed to get current total for workspace ${workspaceId}`,
        error
      )
      throw error
    }
  }

  /**
   * Get current total billing cost for a workspace and specific customer
   */
  async getCurrentTotalForCustomer(
    workspaceId: string,
    customerId: string
  ): Promise<number> {
    try {
      const result = await this.prisma.billing.aggregate({
        where: {
          workspaceId,
          customerId,
        },
        _sum: {
          amount: true,
        },
      })

      return result._sum.amount
        ? parseFloat(result._sum.amount.toString())
        : 0.0
    } catch (error) {
      logger.error(
        `Failed to get current total for workspace ${workspaceId}, customer ${customerId}`,
        error
      )
      throw error
    }
  }

  /**
   * Get monthly billing breakdown for current month + ALL historical months
   * Returns data organized by calendar months with breakdown by type
   */
  async getMonthlyBreakdown(workspaceId: string): Promise<{
    currentMonth: {
      year: number
      month: number
      monthName: string
      total: number
      byType: Record<string, { count: number; cost: number }>
      isComplete: boolean
    }
    history: Array<{
      year: number
      month: number
      monthName: string
      total: number
      byType: Record<string, { count: number; cost: number }>
    }>
  }> {
    try {
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1 // 1-12

      logger.info(
        `[BILLING] 📊 Getting monthly breakdown for workspace ${workspaceId} (all history)`
      )

      // Get ALL billing records (no date limit)
      const billings = await this.prisma.billing.findMany({
        where: {
          workspaceId,
        },
        orderBy: {
          createdAt: "asc",
        },
      })

      logger.info(
        `[BILLING] Found ${billings.length} billing records for breakdown`
      )

      // Group by month
      const monthlyMap = new Map<
        string,
        {
          year: number
          month: number
          total: number
          byType: Record<string, { count: number; cost: number }>
        }
      >()

      billings.forEach((billing) => {
        const date = new Date(billing.createdAt)
        const year = date.getFullYear()
        const month = date.getMonth() + 1 // 1-12
        const key = `${year}-${month.toString().padStart(2, "0")}`

        if (!monthlyMap.has(key)) {
          monthlyMap.set(key, {
            year,
            month,
            total: 0,
            byType: {},
          })
        }

        const monthData = monthlyMap.get(key)!
        monthData.total += billing.amount

        const type = billing.type
        if (!monthData.byType[type]) {
          monthData.byType[type] = { count: 0, cost: 0 }
        }
        monthData.byType[type].count += 1
        monthData.byType[type].cost += billing.amount
      })

      // Get current month data
      const currentMonthKey = `${currentYear}-${currentMonth.toString().padStart(2, "0")}`
      const currentMonthData = monthlyMap.get(currentMonthKey) || {
        year: currentYear,
        month: currentMonth,
        total: 0,
        byType: {},
      }

      // Get history (ALL complete months, excluding current, sorted by date DESC)
      const history: Array<{
        year: number
        month: number
        monthName: string
        total: number
        byType: Record<string, { count: number; cost: number }>
      }> = []

      // Build history from all months in the map except current
      for (const [key, data] of monthlyMap.entries()) {
        const [year, month] = key.split("-").map(Number)

        // Skip current month
        if (year === currentYear && month === currentMonth) {
          continue
        }

        history.push({
          year: data.year,
          month: data.month,
          monthName: this.getMonthName(data.month),
          total: data.total,
          byType: data.byType,
        })
      }

      // Sort history by date DESC (most recent first)
      history.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year
        return b.month - a.month
      })

      logger.info(
        `[BILLING] 💰 Current month (${currentMonth}/${currentYear}): €${currentMonthData.total.toFixed(2)}`
      )
      logger.info(`[BILLING] 📋 History: ${history.length} months`)

      return {
        currentMonth: {
          year: currentMonthData.year,
          month: currentMonthData.month,
          monthName: this.getMonthName(currentMonthData.month),
          total: currentMonthData.total,
          byType: currentMonthData.byType,
          isComplete: false, // Current month is never complete
        },
        history,
      }
    } catch (error) {
      logger.error(
        `Failed to get monthly breakdown for workspace ${workspaceId}`,
        error
      )
      throw error
    }
  }

  /**
   * Helper to get month name from month number (1-12)
   */
  private getMonthName(month: number): string {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ]
    return months[month - 1]
  }

  /**
   * Get detailed billing records for a specific month
   */
  async getMonthDetail(
    workspaceId: string,
    year: number,
    month: number
  ): Promise<
    Array<{
      id: string
      date: Date
      type: string
      amount: number
      description: string
      customerName: string | null
      customerEmail: string | null
    }>
  > {
    try {
      // Start and end of the month
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 1)

      logger.info(
        `[BILLING] 📋 Getting detail for ${year}-${month} (workspace ${workspaceId})`
      )

      const billings = await this.prisma.billing.findMany({
        where: {
          workspaceId,
          createdAt: {
            gte: startDate,
            lt: endDate,
          },
        },
        include: {
          customer: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      return billings.map((b) => ({
        id: b.id,
        date: b.createdAt,
        type: b.type,
        amount: b.amount,
        description: b.description || "",
        customerName: b.customer?.name || null,
        customerEmail: b.customer?.email || null,
      }))
    } catch (error) {
      logger.error(
        `Failed to get month detail for workspace ${workspaceId}, ${year}-${month}`,
        error
      )
      throw error
    }
  }
}
