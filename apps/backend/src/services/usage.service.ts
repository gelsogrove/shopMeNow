import { PrismaClient } from "@prisma/client"
import { config } from "../config"
import logger from "../utils/logger"

const prisma = new PrismaClient()

export interface UsageData {
  workspaceId: string
  clientId: string
  price?: number
}

export interface UsageStatsQuery {
  workspaceId: string
  startDate?: Date
  endDate?: Date
  clientId?: string
}

export interface UsageStats {
  totalCost: number
  totalMessages: number
  dailyUsage: Array<{
    date: string
    cost: number
    messages: number
  }>
  topClients: Array<{
    clientId: string
    clientName: string
    clientPhone: string
    cost: number
    messages: number
  }>
  peakHours: Array<{
    hour: number
    messages: number
    cost: number
  }>
  monthlyComparison: {
    currentMonth: number
    previousMonth: number
    growth: number
  }
}

export const usageService = {
  /**
   * Track LLM usage - add 0.5 cents for each LLM response
   * This is called ONLY for registered users when LLM returns a message
   */
  async trackUsage(data: UsageData): Promise<void> {
    try {
      logger.info(
        `[USAGE-TRACKING] 💰 Adding usage record for workspace ${data.workspaceId}, client ${data.clientId}`
      )

      // Verify that the client (customer) exists and is registered
      const customer = await prisma.customers.findUnique({
        where: { id: data.clientId },
        select: {
          id: true,
          name: true,
          phone: true,
          workspaceId: true,
        },
      })

      if (!customer) {
        logger.warn(
          `[USAGE-TRACKING] ❌ Customer ${data.clientId} not found - no usage tracked`
        )
        return
      }

      if (customer.workspaceId !== data.workspaceId) {
        logger.warn(
          `[USAGE-TRACKING] ❌ Customer ${data.clientId} belongs to different workspace - no usage tracked`
        )
        return
      }

      // Create usage record with €0.005 cost per LLM or operator response (0.5 centesimi)
      await prisma.usage.create({
        data: {
          workspaceId: data.workspaceId,
          clientId: data.clientId,
          price: data.price || config.llm.defaultPrice, // Default LLM price from configuration
        },
      })

      logger.info(
        `[USAGE-TRACKING] ✅ Usage recorded: €${data.price ?? config.llm.defaultPrice} for customer ${customer.name} (${customer.phone})`
      )
    } catch (error) {
      logger.error(`[USAGE-TRACKING] ❌ Error tracking usage:`, error)
      // Don't throw error to avoid disrupting the main LLM flow
    }
  },

  /**
   * Get usage statistics for dashboard
   */
  async getUsageStats(query: UsageStatsQuery): Promise<UsageStats> {
    try {
      const { workspaceId, startDate, endDate, clientId } = query

      // Default to last 30 days if no date range provided
      const end = endDate || new Date()
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      logger.info(
        `[USAGE-STATS] 📊 Getting usage stats for workspace ${workspaceId} from ${start} to ${end}`
      )

      const whereClause: any = {
        workspaceId,
        createdAt: {
          gte: start,
          lte: end,
        },
      }

      if (clientId) {
        whereClause.clientId = clientId
      }

      // Get all usage records for the period
      const usageRecords = await prisma.usage.findMany({
        where: whereClause,
        include: {
          customer: {
            select: {
              name: true,
              phone: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      // Calculate total cost and messages
      const totalCost = usageRecords.reduce(
        (sum, record) => sum + record.price,
        0
      )
      const totalMessages = usageRecords.length

      // Calculate daily usage
      const dailyUsageMap = new Map<
        string,
        { cost: number; messages: number }
      >()
      usageRecords.forEach((record) => {
        const dateKey = record.createdAt.toISOString().split("T")[0]
        const existing = dailyUsageMap.get(dateKey) || { cost: 0, messages: 0 }
        dailyUsageMap.set(dateKey, {
          cost: existing.cost + record.price,
          messages: existing.messages + 1,
        })
      })

      const dailyUsage = Array.from(dailyUsageMap.entries())
        .map(([date, data]) => ({
          date,
          ...data,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))

      // Calculate top clients
      const clientUsageMap = new Map<
        string,
        {
          clientName: string
          clientPhone: string
          cost: number
          messages: number
        }
      >()

      usageRecords.forEach((record) => {
        const existing = clientUsageMap.get(record.clientId) || {
          clientName: record.customer.name,
          clientPhone: record.customer.phone,
          cost: 0,
          messages: 0,
        }
        clientUsageMap.set(record.clientId, {
          ...existing,
          cost: existing.cost + record.price,
          messages: existing.messages + 1,
        })
      })

      const topClients = Array.from(clientUsageMap.entries())
        .map(([clientId, data]) => ({ clientId, ...data }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10)

      // Calculate peak hours (0-23)
      const hourlyUsageMap = new Map<
        number,
        { messages: number; cost: number }
      >()
      usageRecords.forEach((record) => {
        const hour = record.createdAt.getHours()
        const existing = hourlyUsageMap.get(hour) || { messages: 0, cost: 0 }
        hourlyUsageMap.set(hour, {
          messages: existing.messages + 1,
          cost: existing.cost + record.price,
        })
      })

      const peakHours = Array.from(hourlyUsageMap.entries())
        .map(([hour, data]) => ({ hour, ...data }))
        .sort((a, b) => b.messages - a.messages)

      // Calculate monthly comparison (current vs previous month)
      const now = new Date()
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const previousMonthStart = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      )
      const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

      const [currentMonthUsage, previousMonthUsage] = await Promise.all([
        prisma.usage.aggregate({
          where: {
            workspaceId,
            createdAt: {
              gte: currentMonthStart,
              lte: now,
            },
          },
          _sum: { price: true },
        }),
        prisma.usage.aggregate({
          where: {
            workspaceId,
            createdAt: {
              gte: previousMonthStart,
              lte: previousMonthEnd,
            },
          },
          _sum: { price: true },
        }),
      ])

      const currentMonth = currentMonthUsage._sum.price || 0
      const previousMonth = previousMonthUsage._sum.price || 0
      const growth =
        previousMonth > 0
          ? ((currentMonth - previousMonth) / previousMonth) * 100
          : 0

      const monthlyComparison = {
        currentMonth,
        previousMonth,
        growth,
      }

      logger.info(
        `[USAGE-STATS] ✅ Stats calculated: €${totalCost.toFixed(4)} total, ${totalMessages} messages`
      )

      return {
        totalCost,
        totalMessages,
        dailyUsage,
        topClients,
        peakHours,
        monthlyComparison,
      }
    } catch (error) {
      logger.error(`[USAGE-STATS] ❌ Error getting usage stats:`, error)
      throw new Error(`Failed to get usage statistics: ${error.message}`)
    }
  },

  /**
   * Get usage summary for a specific period
   */
  async getUsageSummary(
    workspaceId: string,
    days: number = 30
  ): Promise<{
    totalCost: number
    totalMessages: number
    averageDailyCost: number
    averageDailyMessages: number
  }> {
    try {
      const endDate = new Date()
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      const result = await prisma.usage.aggregate({
        where: {
          workspaceId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: { price: true },
        _count: true,
      })

      const totalCost = result._sum.price || 0
      const totalMessages = result._count || 0
      const averageDailyCost = totalCost / days
      const averageDailyMessages = totalMessages / days

      return {
        totalCost,
        totalMessages,
        averageDailyCost,
        averageDailyMessages,
      }
    } catch (error) {
      logger.error(`[USAGE-SUMMARY] ❌ Error getting usage summary:`, error)
      throw new Error(`Failed to get usage summary: ${error.message}`)
    }
  },
}
