/**
 * Subscription Billing API Service
 * Feature 185: Subscription & Billing System
 *
 * API client for:
 * - Billing overview (plan info, credit, usage)
 * - Transaction history
 * - Recharge credit
 * - Upgrade plan
 *
 * SECURITY: All workspace-scoped endpoints require valid authentication
 */

import { api } from "./api"

// ============================================================================
// TYPES
// ============================================================================

export type PlanType = "FREE_TRIAL" | "BASIC" | "PREMIUM" | "ENTERPRISE"

export type TransactionType =
  | "MESSAGE"
  | "PUSH_NOTIFICATION"
  | "RECHARGE"
  | "MONTHLY_FEE"
  | "UPGRADE_FEE"
  | "ADJUSTMENT"
  | "INITIAL_CREDIT"

export interface BillingInfo {
  planType: PlanType
  creditBalance: number
  trialEndsAt: string | null
  planStartedAt: string
  nextBillingDate: string | null
  isTrialExpired: boolean
  daysUntilTrialExpires: number | null
  totalRecharges: number
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

export interface UsageStats {
  productsCount: number
  customersCount: number
  channelsCount: number
  productsPercentage: number
  customersPercentage: number
  channelsPercentage: number
}

export interface PlanConfig {
  displayName: string
  monthlyFee: number
  features: string[]
}

export interface BillingOverview {
  billing: BillingInfo
  limits: PlanLimits
  usage: UsageStats
  planConfig: PlanConfig
}

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  balanceAfter: number
  description: string
  referenceId: string | null
  createdAt: string
  workspaceId: string
  workspaceName: string
}

export interface TransactionHistoryResponse {
  transactions: Transaction[]
  total: number
  page: number
  totalPages: number
}

export interface BalanceResponse {
  creditBalance: number
  planType: PlanType
  isLowBalance: boolean
  trialInfo: {
    isTrialPlan: boolean
    daysRemaining: number | null
    isExpired: boolean
  } | null
}

export interface PlanInfo {
  planType: PlanType
  displayName: string
  monthlyFee: number
  maxChannels: number
  maxProducts: number
  maxCustomers: number
  messageCost: number
  orderCost: number
  pushCost: number
  features: string[]
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

// 🔒 Cache to prevent duplicate API calls
const billingCache = new Map<string, { data: BillingOverview; timestamp: number }>()
const pendingBillingRequests = new Map<string, Promise<BillingOverview>>()
const CACHE_TTL = 30000 // 30 seconds cache

/**
 * Get complete billing overview for workspace
 * Includes: plan info, credit balance, usage stats, limits
 * Uses cache to prevent duplicate calls
 */
export const getBillingOverview = async (
  workspaceId: string,
  forceRefresh = false
): Promise<BillingOverview> => {
  if (!workspaceId) {
    throw new Error("Workspace ID is required")
  }

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = billingCache.get(workspaceId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }

    // Check if there's already a pending request
    const pending = pendingBillingRequests.get(workspaceId)
    if (pending) {
      return pending
    }
  }

  // Create new request
  const request = api.get(`/workspaces/${workspaceId}/subscription-billing`).then(response => {
    const data = response.data.data
    billingCache.set(workspaceId, { data, timestamp: Date.now() })
    return data
  }).finally(() => {
    pendingBillingRequests.delete(workspaceId)
  })

  pendingBillingRequests.set(workspaceId, request)
  return request
}

// 🔒 Balance cache
const balanceCache = new Map<string, { data: BalanceResponse; timestamp: number }>()
const pendingBalanceRequests = new Map<string, Promise<BalanceResponse>>()

/**
 * Get current credit balance (quick check for header)
 * Uses cache to prevent duplicate calls
 */
export const getBalance = async (
  workspaceId: string,
  forceRefresh = false
): Promise<BalanceResponse> => {
  if (!workspaceId) {
    throw new Error("Workspace ID is required")
  }

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = balanceCache.get(workspaceId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }

    // Check if there's already a pending request
    const pending = pendingBalanceRequests.get(workspaceId)
    if (pending) {
      return pending
    }
  }

  // Create new request
  const request = api.get(`/workspaces/${workspaceId}/subscription-billing/balance`).then(response => {
    const data = response.data.data
    balanceCache.set(workspaceId, { data, timestamp: Date.now() })
    return data
  }).finally(() => {
    pendingBalanceRequests.delete(workspaceId)
  })

  pendingBalanceRequests.set(workspaceId, request)
  return request
}

/**
 * Clear all billing caches (call after recharge/upgrade)
 */
export const clearAllBillingCaches = (workspaceId?: string) => {
  if (workspaceId) {
    billingCache.delete(workspaceId)
    balanceCache.delete(workspaceId)
  } else {
    billingCache.clear()
    balanceCache.clear()
  }
}

/**
 * Get transaction history with pagination
 */
export const getTransactions = async (
  workspaceId: string,
  options: {
    page?: number
    limit?: number
    type?: TransactionType
    startDate?: string
    endDate?: string
  } = {}
): Promise<TransactionHistoryResponse> => {
  if (!workspaceId) {
    throw new Error("Workspace ID is required")
  }

  const params = new URLSearchParams()
  if (options.page) params.append("page", String(options.page))
  if (options.limit) params.append("limit", String(options.limit))
  if (options.type) params.append("type", options.type)
  if (options.startDate) params.append("startDate", options.startDate)
  if (options.endDate) params.append("endDate", options.endDate)

  const response = await api.get(
    `/workspaces/${workspaceId}/subscription-billing/transactions?${params.toString()}`
  )
  return response.data.data
}

/**
 * Recharge credit (Owner only)
 * @param amount - Amount in EUR (min €10, max €1000)
 * If on FREE_TRIAL, auto-upgrades to BASIC
 */
export const rechargeCredit = async (
  workspaceId: string,
  amount: number
): Promise<{ newBalance: number; amountCharged: number; upgradedToPlan?: string }> => {
  if (!workspaceId) {
    throw new Error("Workspace ID is required")
  }

  if (amount < 10 || amount > 1000) {
    throw new Error("Amount must be between €10 and €1000")
  }

  const response = await api.post(`/workspaces/${workspaceId}/subscription-billing/recharge`, {
    amount,
  })
  return response.data.data
}

/**
 * Upgrade plan (Owner only)
 * @param planType - Target plan (BASIC, PREMIUM)
 */
export const upgradePlan = async (
  workspaceId: string,
  planType: "BASIC" | "PREMIUM" | "ENTERPRISE"
): Promise<{
  newPlan: { displayName: string; monthlyFee: number }
  nextBillingDate: string
}> => {
  if (!workspaceId) {
    throw new Error("Workspace ID is required")
  }

  const response = await api.post(`/workspaces/${workspaceId}/subscription-billing/upgrade`, {
    planType,
  })
  return response.data.data
}

/**
 * Change plan - upgrade or downgrade (Owner only)
 * For downgrade: validates current usage fits within target plan limits
 * @param planType - Target plan (BASIC, PREMIUM, ENTERPRISE)
 */
export const changePlan = async (
  workspaceId: string,
  planType: "BASIC" | "PREMIUM" | "ENTERPRISE"
): Promise<{
  newPlan: { displayName: string; monthlyFee: number }
  nextBillingDate: string
  isDowngrade: boolean
}> => {
  if (!workspaceId) {
    throw new Error("Workspace ID is required")
  }

  const response = await api.post(`/workspaces/${workspaceId}/subscription-billing/change-plan`, {
    planType,
  })
  return response.data.data
}

/**
 * Get all available plans (public)
 */
export const getAvailablePlans = async (): Promise<PlanInfo[]> => {
  const response = await api.get("/subscription/plans")
  return response.data.data
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format currency amount
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Get transaction type display name and color
 */
export const getTransactionTypeInfo = (
  type: TransactionType
): { label: string; color: string; icon: string } => {
  const typeMap: Record<TransactionType, { label: string; color: string; icon: string }> = {
    MESSAGE: { label: "Message", color: "blue", icon: "💬" },
    PUSH_NOTIFICATION: { label: "Push", color: "purple", icon: "🔔" },
    RECHARGE: { label: "Recharge", color: "emerald", icon: "💰" },
    MONTHLY_FEE: { label: "Subscription", color: "orange", icon: "📅" },
    UPGRADE_FEE: { label: "Upgrade", color: "indigo", icon: "⬆️" },
    ADJUSTMENT: { label: "Adjustment", color: "gray", icon: "🔧" },
    INITIAL_CREDIT: { label: "Initial Credit", color: "emerald", icon: "🎁" },
  }

  return typeMap[type] || { label: type, color: "gray", icon: "❓" }
}

/**
 * Get plan badge color
 */
export const getPlanBadgeColor = (planType: PlanType): string => {
  const colorMap: Record<PlanType, string> = {
    FREE_TRIAL: "yellow",
    BASIC: "blue",
    PREMIUM: "purple",
    ENTERPRISE: "indigo",
  }
  return colorMap[planType] || "gray"
}

/**
 * Check if balance is low
 */
export const isLowBalance = (balance: number, threshold: number = 5): boolean => {
  return balance < threshold
}
