import { prisma } from "@echatbot/database"
import logger from "../../utils/logger"

export interface DashboardAnalytics {
  overview: {
    totalOrders: number
    totalRevenue: number
    totalCustomers: number
    totalMessages: number
    averageOrderValue: number
    usageCost: number // Andrea's €0.005 per LLM message tracking
  }
  trends: {
    orders: MonthlyData[]
    revenue: MonthlyData[]
    customers: MonthlyData[]
    messages: MonthlyData[]
    usageCost: MonthlyData[] // Add LLM usage cost trends
    categories: CategoryTrendData[] // Categories sales over time
  }
  topProducts: ProductAnalytics[]
  topCustomers: CustomerAnalytics[]
  topSellers: SellerAnalytics[]
  logs: LogEntry[] // System logs with all billing details
}

export interface CategoryTrendData {
  month: string
  year: number
  categories: { [categoryName: string]: number } // { "Pasta": 5, "Olio": 3 }
}

export interface MonthlyData {
  month: string
  year: number
  value: number
  label: string // e.g., "Jan 2024"
}

export interface ProductAnalytics {
  id: string
  name: string
  formato?: string
  totalSold: number
  revenue: number
  stock: number
}

export interface CustomerAnalytics {
  id: string
  name: string
  email: string
  phone?: string
  company?: string
  totalOrders: number
  totalSpent: number
  lastOrderDate?: string
  averageOrderValue: number
}

export interface SellerAnalytics {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  totalCustomers: number
  totalOrders: number
  totalRevenue: number
}

export interface LogEntry {
  id: string
  type: string // MESSAGE, CUSTOMER, HUMAN_SUPPORT
  typeLabel: string // Translated label
  customerId: string | null
  customerName: string | null
  customerEmail: string | null
  description: string
  userQuery: string | null
  amount: number // Current charge
  previousTotal: number
  newTotal: number
  timestamp: Date
}

export class AnalyticsService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = prisma
  }

  async getDashboardAnalytics(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DashboardAnalytics> {
    try {
      // Get basic data - NOW USING BILLING TABLE INSTEAD OF USAGE
      const [orders, customers, messages, billingRecords] = await Promise.all([
        this.getOrdersInDateRange(workspaceId, startDate, endDate),
        this.getCustomersInDateRange(workspaceId, startDate, endDate),
        this.getMessagesInDateRange(workspaceId, startDate, endDate),
        this.getBillingInDateRange(workspaceId, startDate, endDate),
      ])

      // Calculate overview metrics
      const totalOrders = orders.length
      const totalCustomers = customers.length
      const totalMessages = messages.length
      const totalRevenue = orders.reduce(
        (sum, order) => sum + (order.totalAmount || 0),
        0
      )
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

      // 💰 NEW: Calculate from Billing table with progressive totals
      const usageCost = billingRecords.reduce(
        (sum, record) => sum + (record.amount || 0),
        0
      )

      logger.info(
        `[ANALYTICS] 💰 Total cost from Billing: €${usageCost.toFixed(2)} (from ${billingRecords.length} records)`
      )

      // Generate historical trends - REAL DATA
      const [
        orderTrends,
        revenueTrends,
        customerTrends,
        messageTrends,
        usageCostTrends,
        categoryTrends,
      ] = await Promise.all([
        this.generateOrderTrends(workspaceId, startDate, endDate),
        this.generateRevenueTrends(workspaceId, startDate, endDate),
        this.generateCustomerTrends(workspaceId, startDate, endDate),
        this.generateMessageTrends(workspaceId, startDate, endDate),
        this.generateUsageCostTrends(workspaceId, startDate, endDate),
        this.generateCategoryTrends(workspaceId, startDate, endDate),
      ])

      // Get top products, top customers, top sellers and system logs
      const [topProducts, topCustomers, topSellers, logs] = await Promise.all([
        this.getTopProducts(workspaceId, startDate, endDate),
        this.getTopCustomers(workspaceId, startDate, endDate),
        this.getTopSellers(workspaceId, startDate, endDate),
        this.getSystemLogs(workspaceId, startDate, endDate),
      ])

      return {
        overview: {
          totalOrders,
          totalRevenue,
          totalCustomers,
          totalMessages,
          averageOrderValue,
          usageCost,
        },
        trends: {
          orders: orderTrends,
          revenue: revenueTrends,
          customers: customerTrends,
          messages: messageTrends,
          usageCost: usageCostTrends,
          categories: categoryTrends,
        },
        topProducts,
        topCustomers,
        topSellers,
        logs,
      }
    } catch (error) {
      logger.error("Analytics error:", error)
      throw error
    }
  }

  // Generate monthly trends for orders
  private async generateOrderTrends(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<MonthlyData[]> {
    const monthlyData = (await this.prisma.$queryRaw`
      SELECT 
        EXTRACT(YEAR FROM "createdAt") as year,
        EXTRACT(MONTH FROM "createdAt") as month,
        COUNT(*) as count
      FROM "orders" 
      WHERE "workspaceId" = ${workspaceId}
        AND "createdAt" >= ${startDate}
        AND "createdAt" <= ${endDate}
      GROUP BY EXTRACT(YEAR FROM "createdAt"), EXTRACT(MONTH FROM "createdAt")
      ORDER BY year, month
    `) as { year: number; month: number; count: bigint }[]

    return this.formatMonthlyData(monthlyData)
  }

  // Generate monthly trends for revenue
  private async generateRevenueTrends(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<MonthlyData[]> {
    const monthlyData = (await this.prisma.$queryRaw`
      SELECT 
        EXTRACT(YEAR FROM "createdAt") as year,
        EXTRACT(MONTH FROM "createdAt") as month,
        COALESCE(SUM("totalAmount"), 0) as total
      FROM "orders" 
      WHERE "workspaceId" = ${workspaceId}
        AND "createdAt" >= ${startDate}
        AND "createdAt" <= ${endDate}
      GROUP BY EXTRACT(YEAR FROM "createdAt"), EXTRACT(MONTH FROM "createdAt")
      ORDER BY year, month
    `) as { year: number; month: number; total: number }[]

    return monthlyData.map((item) => ({
      month: this.getMonthName(item.month),
      year: item.year,
      value: Number(item.total) || 0,
      label: `${this.getMonthName(item.month)} ${item.year}`,
    }))
  }

  // Generate monthly trends for customers
  private async generateCustomerTrends(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<MonthlyData[]> {
    const monthlyData = (await this.prisma.$queryRaw`
      SELECT 
        EXTRACT(YEAR FROM "createdAt") as year,
        EXTRACT(MONTH FROM "createdAt") as month,
        COUNT(*) as count
      FROM "customers" 
      WHERE "workspaceId" = ${workspaceId}
        AND "createdAt" >= ${startDate}
        AND "createdAt" <= ${endDate}
      GROUP BY EXTRACT(YEAR FROM "createdAt"), EXTRACT(MONTH FROM "createdAt")
      ORDER BY year, month
    `) as { year: number; month: number; count: bigint }[]

    return this.formatMonthlyData(monthlyData)
  }

  // Generate monthly trends for messages
  private async generateMessageTrends(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<MonthlyData[]> {
    const monthlyData = (await this.prisma.$queryRaw`
      SELECT 
        EXTRACT(YEAR FROM m."createdAt") as year,
        EXTRACT(MONTH FROM m."createdAt") as month,
        COUNT(*) as count
      FROM "messages" m
      JOIN "chat_sessions" cs ON m."chatSessionId" = cs.id
      WHERE cs."workspaceId" = ${workspaceId}
        AND m."createdAt" >= ${startDate}
        AND m."createdAt" <= ${endDate}
      GROUP BY EXTRACT(YEAR FROM m."createdAt"), EXTRACT(MONTH FROM m."createdAt")
      ORDER BY year, month
    `) as { year: number; month: number; count: bigint }[]

    return this.formatMonthlyData(monthlyData)
  }

  // Generate monthly trends for usage cost - NOW FROM BILLING TABLE
  private async generateUsageCostTrends(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<MonthlyData[]> {
    const monthlyData = (await this.prisma.$queryRaw`
      SELECT 
        EXTRACT(YEAR FROM b."createdAt") as year,
        EXTRACT(MONTH FROM b."createdAt") as month,
        COALESCE(SUM(b.amount), 0) as total_cost
      FROM "Billing" b
      WHERE b."workspaceId" = ${workspaceId}
        AND b."createdAt" >= ${startDate}
        AND b."createdAt" <= ${endDate}
      GROUP BY EXTRACT(YEAR FROM b."createdAt"), EXTRACT(MONTH FROM b."createdAt")
      ORDER BY year, month
    `) as { year: number; month: number; total_cost: number }[]

    return monthlyData.map((item) => ({
      month: this.getMonthName(item.month),
      year: item.year,
      value: Number(item.total_cost) || 0,
      label: `${this.getMonthName(item.month)} ${item.year}`,
    }))
  }

  // Generate category sales trends over time
  private async generateCategoryTrends(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CategoryTrendData[]> {
    const categoryData = (await this.prisma.$queryRaw`
      SELECT 
        EXTRACT(YEAR FROM o."createdAt") as year,
        EXTRACT(MONTH FROM o."createdAt") as month,
        COALESCE(c.name, 'Senza Categoria') as category_name,
        COUNT(DISTINCT o.id) as order_count
      FROM "orders" o
      INNER JOIN "order_items" oi ON o.id = oi."orderId"
      INNER JOIN "products" p ON oi."productId" = p.id
      LEFT JOIN "categories" c ON p."categoryId" = c.id
      WHERE o."workspaceId" = ${workspaceId}
        AND o."createdAt" >= ${startDate}
        AND o."createdAt" <= ${endDate}
      GROUP BY EXTRACT(YEAR FROM o."createdAt"), EXTRACT(MONTH FROM o."createdAt"), c.name
      ORDER BY year, month, order_count DESC
    `) as {
      year: number
      month: number
      category_name: string
      order_count: bigint
    }[]

    // Group by month and aggregate categories
    const monthMap = new Map<string, CategoryTrendData>()

    categoryData.forEach((row) => {
      const monthKey = `${row.year}-${row.month}`
      const monthName = this.getMonthName(row.month)

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: monthName,
          year: row.year,
          categories: {},
        })
      }

      const trendData = monthMap.get(monthKey)!
      trendData.categories[row.category_name] = Number(row.order_count) || 0
    })

    return Array.from(monthMap.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      const monthOrder = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ]
      return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
    })
  }

  // Get top selling products
  private async getTopProducts(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProductAnalytics[]> {
    try {
      const topProducts = (await this.prisma.$queryRaw`
        SELECT 
          p.id,
          p.name,
          p.formato,
          COALESCE(SUM(oi.quantity), 0) as total_sold,
          COALESCE(SUM(oi."unitPrice" * oi.quantity), 0) as revenue,
          p.stock
        FROM "products" p
        LEFT JOIN "order_items" oi ON p.id = oi."productId"
        LEFT JOIN "orders" o ON oi."orderId" = o.id
        WHERE p."workspaceId" = ${workspaceId}
          AND (o."createdAt" IS NULL OR (o."createdAt" >= ${startDate} AND o."createdAt" <= ${endDate}))
        GROUP BY p.id, p.name, p.formato, p.stock
        ORDER BY total_sold DESC, revenue DESC
        LIMIT 5
      `) as {
        id: string
        name: string
        formato: string | null
        total_sold: bigint
        revenue: number
        stock: number
      }[]

      return topProducts.map((product) => ({
        id: product.id,
        name: product.name,
        formato: product.formato || undefined,
        totalSold: Number(product.total_sold) || 0,
        revenue: Number(product.revenue) || 0,
        stock: product.stock || 0,
      }))
    } catch (error) {
      logger.error("Error getting top products:", error)
      return []
    }
  }

  // Get top customers by total spending
  private async getTopCustomers(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CustomerAnalytics[]> {
    try {
      const topCustomers = (await this.prisma.$queryRaw`
        SELECT 
          c.id,
          c.name,
          c.email,
          c.phone,
          c.company,
          COUNT(o.id) as total_orders,
          COALESCE(SUM(o."totalAmount"), 0) as total_spent,
          MAX(o."createdAt") as last_order_date,
          CASE 
            WHEN COUNT(o.id) > 0 THEN COALESCE(SUM(o."totalAmount"), 0) / COUNT(o.id) 
            ELSE 0 
          END as average_order_value
        FROM "customers" c
        LEFT JOIN "orders" o ON c.id = o."customerId" 
          AND o."createdAt" >= ${startDate} 
          AND o."createdAt" <= ${endDate}
        WHERE c."workspaceId" = ${workspaceId}
          AND c."isActive" = true
        GROUP BY c.id, c.name, c.email, c.phone, c.company
        ORDER BY total_spent DESC, total_orders DESC
        LIMIT 5
      `) as {
        id: string
        name: string
        email: string
        phone: string | null
        company: string | null
        total_orders: bigint
        total_spent: number
        last_order_date: Date | null
        average_order_value: number
      }[]

      return topCustomers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone || undefined,
        company: customer.company || undefined,
        totalOrders: Number(customer.total_orders) || 0,
        totalSpent: Number(customer.total_spent) || 0,
        lastOrderDate: customer.last_order_date
          ? customer.last_order_date.toISOString()
          : undefined,
        averageOrderValue: Number(customer.average_order_value) || 0,
      }))
    } catch (error) {
      logger.error("Error getting top customers:", error)
      return []
    }
  }

  // Get top sellers by total revenue and customers
  private async getTopSellers(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SellerAnalytics[]> {
    try {
      const topSellers = (await this.prisma.$queryRaw`
        SELECT 
          s.id,
          s."firstName",
          s."lastName",
          s.email,
          s.phone,
          COUNT(DISTINCT c.id) as total_customers,
          COUNT(DISTINCT o.id) as total_orders,
          COALESCE(SUM(o."totalAmount"), 0) as total_revenue
        FROM "sales" s
        LEFT JOIN "customers" c ON s.id = c."salesId"
        LEFT JOIN "orders" o ON c.id = o."customerId" 
          AND o."createdAt" >= ${startDate} 
          AND o."createdAt" <= ${endDate}
        WHERE s."workspaceId" = ${workspaceId}
          AND s."isActive" = true
        GROUP BY s.id, s."firstName", s."lastName", s.email, s.phone
        ORDER BY total_revenue DESC, total_orders DESC, total_customers DESC
        LIMIT 5
      `) as {
        id: string
        firstName: string
        lastName: string
        email: string
        phone: string | null
        total_customers: bigint
        total_orders: bigint
        total_revenue: number
      }[]

      return topSellers.map((seller) => ({
        id: seller.id,
        firstName: seller.firstName,
        lastName: seller.lastName,
        email: seller.email,
        phone: seller.phone || undefined,
        totalCustomers: Number(seller.total_customers) || 0,
        totalOrders: Number(seller.total_orders) || 0,
        totalRevenue: Number(seller.total_revenue) || 0,
      }))
    } catch (error) {
      logger.error("Error getting top sellers:", error)
      return []
    }
  }

  // Helper method to format monthly data
  private formatMonthlyData(
    data: { year: number; month: number; count: bigint }[]
  ): MonthlyData[] {
    return data.map((item) => ({
      month: this.getMonthName(item.month),
      year: item.year,
      value: Number(item.count) || 0,
      label: `${this.getMonthName(item.month)} ${item.year}`,
    }))
  }

  // Helper method to get month name in English
  private getMonthName(monthNumber: number): string {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ]
    return months[monthNumber - 1] || "Unknown"
  }

  async getDetailedMetrics(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
    metric: string
  ): Promise<any> {
    switch (metric) {
      case "orders":
        return await this.getDetailedOrderMetrics(
          workspaceId,
          startDate,
          endDate
        )
      case "customers":
        return await this.getDetailedCustomerMetrics(
          workspaceId,
          startDate,
          endDate
        )
      case "products":
        return await this.getDetailedProductMetrics(
          workspaceId,
          startDate,
          endDate
        )
      default:
        throw new Error(`Unknown metric: ${metric}`)
    }
  }

  private async getOrdersInDateRange(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ) {
    return await this.prisma.orders.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    })
  }

  private async getCustomersInDateRange(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ) {
    return await this.prisma.customers.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    })
  }

  private async getMessagesInDateRange(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ) {
    return await this.prisma.message.findMany({
      where: {
        chatSession: {
          workspaceId,
        },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    })
  }

  // 💰 NEW: Get billing records instead of usage
  private async getBillingInDateRange(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ) {
    return await this.prisma.billing.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    })
  }

  // 📋 NEW: Get system logs with full details and translations
  private async getSystemLogs(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<LogEntry[]> {
    const billingRecords = await this.prisma.billing.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc", // Most recent first
      },
    })

    // Translate type labels
    const typeLabels: Record<string, string> = {
      MESSAGE: "💬 Message",
      CUSTOMER: "👤 New Customer",
      HUMAN_SUPPORT: "🤝 Human Support",
      NEW_CUSTOMER: "👤 New Customer",
    }

    // 💰 RECALCULATE progressive totals for WORKSPACE (not per customer)
    // Sort by createdAt ASC for calculation, then reverse to DESC for display
    const sortedForCalculation = [...billingRecords].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    )

    let runningTotal = 0
    const withProgressiveTotals = sortedForCalculation.map((record) => {
      const previousWorkspaceTotal = runningTotal
      runningTotal += record.amount

      return {
        id: record.id,
        type: record.type,
        typeLabel: typeLabels[record.type] || record.type,
        customerId: record.customerId,
        customerName: record.customer?.name || null,
        customerEmail: record.customer?.email || null,
        description: record.description,
        userQuery: record.userQuery,
        amount: record.amount,
        previousTotal: previousWorkspaceTotal, // WORKSPACE total, not customer total
        newTotal: runningTotal, // WORKSPACE cumulative total
        timestamp: record.createdAt,
      }
    })

    // Return in DESC order (most recent first)
    return withProgressiveTotals.reverse()
  }

  // Keep old method for backward compatibility (deprecated)
  private async getUsageInDateRange(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ) {
    return await this.prisma.usage.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    })
  }

  private async getDetailedOrderMetrics(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ) {
    return await this.prisma.orders.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })
  }

  private async getDetailedCustomerMetrics(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ) {
    return await this.prisma.customers.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })
  }

  private async getDetailedProductMetrics(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ) {
    return await this.prisma.products.findMany({
      where: {
        workspaceId,
      },
    })
  }

  // Get monthly top customers breakdown
  async getMonthlyTopCustomers(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ) {
    try {
      // Generate array of months between startDate and endDate
      const months = this.generateMonthsArray(startDate, endDate)
      const monthlyData = []

      for (const monthInfo of months) {
        const monthStart = new Date(monthInfo.year, monthInfo.month - 1, 1)
        const monthEnd = new Date(
          monthInfo.year,
          monthInfo.month,
          0,
          23,
          59,
          59,
          999
        )

        const topCustomers = await this.getTopCustomers(
          workspaceId,
          monthStart,
          monthEnd
        )

        monthlyData.push({
          month: monthInfo.month.toString().padStart(2, "0"),
          year: monthInfo.year,
          customers: topCustomers,
        })
      }

      return monthlyData
    } catch (error) {
      logger.error("Error getting monthly top customers:", error)
      throw error
    }
  }

  // Get monthly top clients breakdown (clients = customers with company field)
  async getMonthlyTopClients(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ) {
    try {
      // Generate array of months between startDate and endDate
      const months = this.generateMonthsArray(startDate, endDate)
      const monthlyData = []

      for (const monthInfo of months) {
        const monthStart = new Date(monthInfo.year, monthInfo.month - 1, 1)
        const monthEnd = new Date(
          monthInfo.year,
          monthInfo.month,
          0,
          23,
          59,
          59,
          999
        )

        // Get top customers that have a company (i.e., clients)
        const topClients = await this.getTopClients(
          workspaceId,
          monthStart,
          monthEnd
        )

        monthlyData.push({
          month: monthInfo.month.toString().padStart(2, "0"),
          year: monthInfo.year,
          clients: topClients,
        })
      }

      return monthlyData
    } catch (error) {
      logger.error("Error getting monthly top clients:", error)
      throw error
    }
  }

  // Helper method to generate array of months between two dates
  private generateMonthsArray(
    startDate: Date,
    endDate: Date
  ): { year: number; month: number }[] {
    const months = []
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1)

    while (current <= end) {
      months.push({
        year: current.getFullYear(),
        month: current.getMonth() + 1,
      })
      current.setMonth(current.getMonth() + 1)
    }

    return months
  }

  // Get top clients (customers with company field)
  private async getTopClients(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CustomerAnalytics[]> {
    try {
      const topClients = (await this.prisma.$queryRaw`
        SELECT 
          c.id,
          c.name,
          c.email,
          c.phone,
          c.company,
          COUNT(o.id) as total_orders,
          COALESCE(SUM(o."totalAmount"), 0) as total_spent,
          MAX(o."createdAt") as last_order_date,
          CASE 
            WHEN COUNT(o.id) > 0 THEN COALESCE(SUM(o."totalAmount"), 0) / COUNT(o.id) 
            ELSE 0 
          END as average_order_value
        FROM "customers" c
        LEFT JOIN "orders" o ON c.id = o."customerId" 
          AND o."createdAt" >= ${startDate} 
          AND o."createdAt" <= ${endDate}
        WHERE c."workspaceId" = ${workspaceId}
          AND c."isActive" = true
          AND c.company IS NOT NULL
          AND c.company != ''
        GROUP BY c.id, c.name, c.email, c.phone, c.company
        ORDER BY total_spent DESC, total_orders DESC
        LIMIT 10
      `) as {
        id: string
        name: string
        email: string
        phone: string | null
        company: string | null
        total_orders: bigint
        total_spent: number
        last_order_date: Date | null
        average_order_value: number
      }[]

      return topClients.map((client) => ({
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone || undefined,
        company: client.company || undefined,
        totalOrders: Number(client.total_orders) || 0,
        totalSpent: Number(client.total_spent) || 0,
        lastOrderDate: client.last_order_date
          ? client.last_order_date.toISOString()
          : undefined,
        averageOrderValue: Number(client.average_order_value) || 0,
      }))
    } catch (error) {
      logger.error("Error fetching top clients:", error)
      return []
    }
  }

  /**
   * Get top searched products
   */
  async getTopSearchedProducts(
    workspaceId: string,
    period: string = "7days",
    limit: number = 10
  ) {
    try {
      logger.info("📊 Fetching top searched products", {
        workspaceId,
        period,
        limit,
      })

      // Calculate date filter
      const now = new Date()
      let dateFrom: Date

      switch (period) {
        case "7days":
          dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case "30days":
          dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case "alltime":
          dateFrom = new Date(0)
          break
        default:
          dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      }

      // Query top searched products
      const topSearches = await this.prisma.$queryRaw<
        Array<{ productName: string; searchCount: bigint }>
      >`
        SELECT 
          query as "productName",
          COUNT(*) as "searchCount"
        FROM "product_searches"
        WHERE "workspaceId" = ${workspaceId}
          AND "createdAt" >= ${dateFrom}
        GROUP BY query
        ORDER BY "searchCount" DESC
        LIMIT ${limit}
      `

      // Get total for percentage
      const totalResult = await this.prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT COUNT(*) as total
        FROM "product_searches"
        WHERE "workspaceId" = ${workspaceId}
          AND "createdAt" >= ${dateFrom}
      `

      const total = Number(totalResult[0]?.total || 0)

      // Format with rankings and percentages
      return topSearches.map((item, index) => ({
        rank: index + 1,
        productName: item.productName,
        searchCount: Number(item.searchCount),
        percentage:
          total > 0 ? Math.round((Number(item.searchCount) / total) * 100) : 0,
      }))
    } catch (error) {
      logger.error("❌ Error fetching top searched products:", error)
      return []
    }
  }

  /**
   * Get search trends over time (daily aggregation)
   */
  async getSearchTrends(workspaceId: string, period: string = "7days") {
    try {
      logger.info("📈 Fetching search trends", {
        workspaceId,
        period,
      })

      // Calculate date filter
      const now = new Date()
      let dateFrom: Date

      switch (period) {
        case "7days":
          dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case "30days":
          dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case "alltime":
          dateFrom = new Date(0)
          break
        default:
          dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      }

      // Query trends by date
      const trends = await this.prisma.$queryRaw<
        Array<{ date: Date; searchCount: bigint }>
      >`
        SELECT 
          DATE("createdAt") as date,
          COUNT(*) as "searchCount"
        FROM "product_searches"
        WHERE "workspaceId" = ${workspaceId}
          AND "createdAt" >= ${dateFrom}
        GROUP BY DATE("createdAt")
        ORDER BY date DESC
      `

      // Format dates and convert bigint
      return trends.map((item) => ({
        date: new Date(item.date).toISOString().split("T")[0],
        searchCount: Number(item.searchCount),
      }))
    } catch (error) {
      logger.error("❌ Error fetching search trends:", error)
      return []
    }
  }
}
