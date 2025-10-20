import { api } from "./api"

export interface BillingByType {
  count: number
  cost: number
}

export interface MonthlyBilling {
  year: number
  month: number
  monthName: string
  total: number
  byType: Record<string, BillingByType>
}

export interface CurrentMonthBilling extends MonthlyBilling {
  isComplete: boolean
}

export interface MonthlyBreakdownResponse {
  success: boolean
  data: {
    workspaceId: string
    currentMonth: CurrentMonthBilling
    history: MonthlyBilling[]
    currency: string
  }
}

/**
 * Get monthly billing breakdown for current month + last 12 months
 * SECURITY: Always requires workspaceId from authenticated context
 */
export const getMonthlyBreakdown = async (
  workspaceId: string
): Promise<MonthlyBreakdownResponse> => {
  if (!workspaceId) {
    throw new Error("Workspace ID is required for billing operations")
  }

  const response = await api.get(`/billing/${workspaceId}/monthly`)
  return response.data
}

/**
 * Get detailed billing records for a specific month
 */
export const getMonthDetail = async (
  workspaceId: string,
  year: number,
  month: number
): Promise<{
  success: boolean
  data: {
    workspaceId: string
    year: number
    month: number
    records: Array<{
      id: string
      date: string
      type: string
      amount: number
      description: string
      customerName: string | null
      customerEmail: string | null
    }>
    currency: string
  }
}> => {
  if (!workspaceId) {
    throw new Error("Workspace ID is required for billing operations")
  }

  const response = await api.get(
    `/billing/${workspaceId}/monthly/${year}/${month}`
  )
  return response.data
}

/**
 * Get current billing total for a workspace
 */
export const getCurrentTotal = async (
  workspaceId: string,
  customerId?: string
): Promise<{ currentTotal: string; currency: string }> => {
  if (!workspaceId) {
    throw new Error("Workspace ID is required for billing operations")
  }

  const params = new URLSearchParams()
  if (customerId) {
    params.append("customerId", customerId)
  }

  const response = await api.get(
    `/billing/${workspaceId}/totals?${params.toString()}`
  )
  return response.data.data
}

/**
 * Get billing summary for a workspace (last 30 days by default)
 */
export const getBillingSummary = async (
  workspaceId: string,
  days: number = 30
): Promise<{
  totalCost: number
  billingByType: Record<string, BillingByType>
  recentBilling: any[]
}> => {
  if (!workspaceId) {
    throw new Error("Workspace ID is required for billing operations")
  }

  const response = await api.get(`/billing/${workspaceId}/summary?days=${days}`)
  return response.data.data
}

/**
 * Get billing history with running totals
 */
export const getBillingHistory = async (
  workspaceId: string,
  options?: {
    customerId?: string
    limit?: number
  }
): Promise<any[]> => {
  if (!workspaceId) {
    throw new Error("Workspace ID is required for billing operations")
  }

  const params = new URLSearchParams()
  if (options?.customerId) {
    params.append("customerId", options.customerId)
  }
  if (options?.limit) {
    params.append("limit", options.limit.toString())
  }

  const response = await api.get(
    `/billing/${workspaceId}/history?${params.toString()}`
  )
  return response.data.data.history
}
