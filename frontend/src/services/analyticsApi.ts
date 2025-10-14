import { api } from "./api"

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
  timestamp: string
}

export interface DashboardAnalytics {
  overview: {
    totalOrders: number
    totalRevenue: number
    totalCustomers: number
    totalMessages: number
    averageOrderValue: number
    usageCost: number
  }
  trends: {
    orders: MonthlyData[]
    revenue: MonthlyData[]
    customers: MonthlyData[]
    messages: MonthlyData[]
    usageCost: MonthlyData[] // Add LLM usage cost trends
  }
  topProducts: ProductAnalytics[]
  topCustomers: {
    id: string
    name: string
    email: string
    phone?: string
    company?: string
    totalOrders: number
    totalSpent: number
    lastOrderDate?: string
    averageOrderValue: number
  }[]
  topSellers: SellerAnalytics[]
  logs: LogEntry[] // System logs with all billing details
}

export interface MonthlyData {
  month: string
  year: number
  value: number
  label: string
}

export interface ProductAnalytics {
  id: string
  name: string
  formato?: string
  totalSold: number
  revenue: number
  stock: number
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

export interface AnalyticsResponse {
  success: boolean
  data: DashboardAnalytics
  dateRange: {
    startDate: string
    endDate: string
    isDefault: boolean
    note?: string
  }
}

export interface DateRange {
  startDate: Date
  endDate: Date
}

/**
 * Get dashboard analytics data with optional date range
 * @param workspaceId - The workspace ID
 * @param dateRange - Optional date range, if not provided uses default (last 3 months excluding current)
 */
export const getDashboardAnalytics = async (
  workspaceId: string,
  dateRange?: DateRange
): Promise<AnalyticsResponse> => {
  const params = new URLSearchParams()

  if (dateRange) {
    params.append("startDate", dateRange.startDate.toISOString())
    params.append("endDate", dateRange.endDate.toISOString())
  }

  const response = await api.get(
    `/analytics/${workspaceId}/dashboard?${params.toString()}`
  )
  return response.data
}

/**
 * Get detailed metrics for specific analysis
 */
export const getDetailedMetrics = async (
  workspaceId: string,
  metric: string,
  dateRange: DateRange
): Promise<any> => {
  const params = new URLSearchParams({
    startDate: dateRange.startDate.toISOString(),
    endDate: dateRange.endDate.toISOString(),
    metric,
  })

  const response = await api.get(
    `/analytics/${workspaceId}/detailed?${params.toString()}`
  )
  return response.data
}

export interface MonthlyTopCustomer {
  month: string
  year: number
  customers: {
    id: string
    name: string
    email: string
    phone?: string
    company?: string
    totalOrders: number
    totalSpent: number
    averageOrderValue: number
  }[]
}

export interface MonthlyTopClient {
  month: string
  year: number
  clients: {
    id: string
    name: string
    email: string
    phone?: string
    company?: string
    totalOrders: number
    totalSpent: number
    averageOrderValue: number
  }[]
}

/**
 * Get monthly top customers breakdown
 */
export const getMonthlyTopCustomers = async (
  workspaceId: string,
  dateRange: DateRange
): Promise<MonthlyTopCustomer[]> => {
  const params = new URLSearchParams({
    startDate: dateRange.startDate.toISOString(),
    endDate: dateRange.endDate.toISOString(),
  })

  const response = await api.get(
    `/analytics/${workspaceId}/monthly-top-customers?${params.toString()}`
  )
  return response.data
}

/**
 * Get monthly top clients breakdown
 */
export const getMonthlyTopClients = async (
  workspaceId: string,
  dateRange: DateRange
): Promise<MonthlyTopClient[]> => {
  const params = new URLSearchParams({
    startDate: dateRange.startDate.toISOString(),
    endDate: dateRange.endDate.toISOString(),
  })

  const response = await api.get(
    `/analytics/${workspaceId}/monthly-top-clients?${params.toString()}`
  )
  return response.data
}

/**
 * Get default date range: last 3 complete months excluding current month
 */
export const getDefaultDateRange = (): DateRange => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-based (0 = January)

  // End of previous month (last day)
  const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999)

  // Start of 3 months before the previous month (first day)
  const startDate = new Date(currentYear, currentMonth - 3, 1, 0, 0, 0, 0)

  return { startDate, endDate }
}

/**
 * Format date for display in Italian format
 */
export const formatDateForDisplay = (date: Date): string => {
  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/**
 * Get readable description of date range
 */
export const getDateRangeDescription = (dateRange: DateRange): string => {
  const startFormatted = formatDateForDisplay(dateRange.startDate)
  const endFormatted = formatDateForDisplay(dateRange.endDate)
  return `${startFormatted} - ${endFormatted}`
}
