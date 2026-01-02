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
  | "INVOICE_PAID"

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
 * @param amount - Amount in USD (min $12, max $1176)
 * If on FREE_TRIAL, auto-upgrades to BASIC
 */
export const rechargeCredit = async (
  workspaceId: string,
  amount: number
): Promise<{ newBalance: number; amountCharged: number; upgradedToPlan?: string }> => {
  if (!workspaceId) {
    throw new Error("Workspace ID is required")
  }

  if (amount < 12 || amount > 1176) {
    throw new Error("Amount must be between $12 and $1176")
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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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
    INVOICE_PAID: { label: "Invoice", color: "green", icon: "🧾" },
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

// ============================================================================
// FEATURE 197: Subscription Management Types & Functions
// ============================================================================

export type SubscriptionStatus = "ACTIVE" | "PAUSE_PENDING" | "PAUSED" | "PAYMENT_FAILED"

export type BlockReason = "PAUSED" | "PAYMENT_FAILED" | "CREDIT_EXHAUSTED" | "CHANNEL_DISABLED"

export interface SubscriptionStatusResponse {
  subscriptionStatus: SubscriptionStatus
  creditBalance: number
  channelStatus: boolean
  isBlocked: boolean
  blockReason: BlockReason | null
  pausedAt: string | null
  pauseRequestedAt: string | null
  pendingPlanType: PlanType | null
  pendingPlanEffectiveDate: string | null
  lastPaymentFailedAt: string | null
  paymentFailureCount: number
  nextBillingDate: string | null
  planType: PlanType
}

export interface PauseResponse {
  effectiveDate: string
  currentStatus: SubscriptionStatus
}

export interface ResumeResponse {
  currentStatus: SubscriptionStatus
}

export interface DowngradeResponse {
  currentPlan: PlanType
  pendingPlan: PlanType
  effectiveDate: string
}

/**
 * Get subscription status
 * Feature 197: Subscription Management
 */
export const getSubscriptionStatus = async (
  workspaceId: string
): Promise<SubscriptionStatusResponse> => {
  const response = await api.get(
    `/workspaces/${workspaceId}/billing/subscription/status`
  )
  return response.data.data
}

/**
 * Pause subscription (effective next month)
 * Feature 197: Subscription Management
 */
export const pauseSubscription = async (
  workspaceId: string
): Promise<PauseResponse> => {
  const response = await api.post(
    `/workspaces/${workspaceId}/billing/subscription/pause`
  )
  return response.data.data
}

/**
 * Resume subscription
 * Feature 197: Subscription Management
 */
export const resumeSubscription = async (
  workspaceId: string
): Promise<ResumeResponse> => {
  const response = await api.post(
    `/workspaces/${workspaceId}/billing/subscription/resume`
  )
  return response.data.data
}

/**
 * Schedule plan downgrade (effective next month)
 * Feature 197: Subscription Management
 */
export const scheduleDowngrade = async (
  workspaceId: string,
  newPlan: PlanType
): Promise<DowngradeResponse> => {
  const response = await api.post(
    `/workspaces/${workspaceId}/billing/plan/downgrade`,
    { newPlan }
  )
  return response.data.data
}

/**
 * Cancel pending plan change
 * Feature 197: Subscription Management
 */
export const cancelPendingPlanChange = async (
  workspaceId: string
): Promise<{ cancelledPlan: PlanType }> => {
  const response = await api.delete(
    `/workspaces/${workspaceId}/billing/plan/pending`
  )
  return response.data.data
}

/**
 * Get subscription status display info
 */
export const getSubscriptionStatusInfo = (
  status: SubscriptionStatus
): { label: string; color: string; icon: string } => {
  const statusMap: Record<SubscriptionStatus, { label: string; color: string; icon: string }> = {
    ACTIVE: { label: "Attivo", color: "emerald", icon: "✓" },
    PAUSE_PENDING: { label: "Pausa programmata", color: "yellow", icon: "⏸" },
    PAUSED: { label: "In pausa", color: "gray", icon: "⏸" },
    PAYMENT_FAILED: { label: "Pagamento fallito", color: "red", icon: "⚠" },
  }
  return statusMap[status] || { label: status, color: "gray", icon: "?" }
}

// ============================================================================
// FEATURE 198: Owner-Based Billing API (NO WORKSPACEID REQUIRED)
// ============================================================================
// These functions use userId from JWT token automatically
// Credit and subscription are SHARED across all owner's workspaces

// 🔒 Owner billing cache
let ownerBillingCache: { data: BillingOverview; timestamp: number } | null = null
let ownerBalanceCache: { data: BalanceResponse; timestamp: number } | null = null
let ownerStatusCache: { data: SubscriptionStatusResponse; timestamp: number } | null = null
let pendingOwnerBillingRequest: Promise<BillingOverview> | null = null
let pendingOwnerBalanceRequest: Promise<BalanceResponse> | null = null
let pendingOwnerStatusRequest: Promise<SubscriptionStatusResponse> | null = null

/**
 * Clear owner billing caches (call after recharge/upgrade/pause/resume)
 */
export const clearOwnerBillingCaches = () => {
  ownerBillingCache = null
  ownerBalanceCache = null
  ownerStatusCache = null
}

/**
 * Get billing overview for authenticated owner (no workspaceId needed)
 * Feature 198: Owner-based billing
 */
export const getOwnerBillingOverview = async (
  forceRefresh = false
): Promise<BillingOverview> => {
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    if (ownerBillingCache && Date.now() - ownerBillingCache.timestamp < CACHE_TTL) {
      return ownerBillingCache.data
    }
    if (pendingOwnerBillingRequest) {
      return pendingOwnerBillingRequest
    }
  }

  // Create new request
  pendingOwnerBillingRequest = api.get("/subscription-billing").then(response => {
    const data = response.data.data
    ownerBillingCache = { data, timestamp: Date.now() }
    return data
  }).finally(() => {
    pendingOwnerBillingRequest = null
  })

  return pendingOwnerBillingRequest
}

/**
 * Get credit balance for authenticated owner (no workspaceId needed)
 * Feature 198: Owner-based billing
 */
export const getOwnerBalance = async (
  forceRefresh = false
): Promise<BalanceResponse> => {
  if (!forceRefresh) {
    if (ownerBalanceCache && Date.now() - ownerBalanceCache.timestamp < CACHE_TTL) {
      return ownerBalanceCache.data
    }
    if (pendingOwnerBalanceRequest) {
      return pendingOwnerBalanceRequest
    }
  }

  pendingOwnerBalanceRequest = api.get("/subscription-billing/balance").then(response => {
    const data = response.data.data
    ownerBalanceCache = { data, timestamp: Date.now() }
    return data
  }).finally(() => {
    pendingOwnerBalanceRequest = null
  })

  return pendingOwnerBalanceRequest
}

/**
 * Get subscription status for authenticated owner (no workspaceId needed)
 * Feature 198: Owner-based billing
 */
export const getOwnerSubscriptionStatus = async (
  forceRefresh = false
): Promise<SubscriptionStatusResponse> => {
  if (!forceRefresh) {
    if (ownerStatusCache && Date.now() - ownerStatusCache.timestamp < CACHE_TTL) {
      return ownerStatusCache.data
    }
    if (pendingOwnerStatusRequest) {
      return pendingOwnerStatusRequest
    }
  }

  pendingOwnerStatusRequest = api.get("/subscription-billing/status").then(response => {
    const data = response.data.data
    ownerStatusCache = { data, timestamp: Date.now() }
    return data
  }).finally(() => {
    pendingOwnerStatusRequest = null
  })

  return pendingOwnerStatusRequest
}

/**
 * Get transaction history for authenticated owner (no workspaceId needed)
 * Feature 198: Owner-based billing
 */
export const getOwnerTransactions = async (
  options: {
    page?: number
    limit?: number
    type?: TransactionType
    startDate?: string
    endDate?: string
  } = {}
): Promise<TransactionHistoryResponse> => {
  const params = new URLSearchParams()
  if (options.page) params.append("page", String(options.page))
  if (options.limit) params.append("limit", String(options.limit))
  if (options.type) params.append("type", options.type)
  if (options.startDate) params.append("startDate", options.startDate)
  if (options.endDate) params.append("endDate", options.endDate)

  const queryString = params.toString()
  const url = queryString ? `/subscription-billing/transactions?${queryString}` : "/subscription-billing/transactions"
  
  const response = await api.get(url)
  return {
    transactions: response.data.transactions || [],
    total: response.data.pagination?.total || 0,
    page: response.data.pagination?.page || 1,
    totalPages: response.data.pagination?.totalPages || 1,
  }
}

/**
 * Recharge credit for authenticated owner (no workspaceId needed)
 * Feature 198: Owner-based billing
 * @param amount - Amount in USD (min $12, max $1176)
 */
export const rechargeOwnerCredit = async (
  amount: number
): Promise<{ newBalance: number; amountCharged: number; upgradedToPlan?: string }> => {
  if (amount < 12 || amount > 1176) {
    throw new Error("Amount must be between $12 and $1176")
  }

  const response = await api.post("/subscription-billing/recharge", { amount })
  clearOwnerBillingCaches()
  return response.data.data
}

/**
 * Pause subscription for authenticated owner (no workspaceId needed)
 * Feature 198: Owner-based billing
 * Effective from 1st of next month
 */
export const pauseOwnerSubscription = async (): Promise<PauseResponse> => {
  const response = await api.post("/subscription-billing/pause")
  clearOwnerBillingCaches()
  return response.data.data
}

/**
 * Resume subscription for authenticated owner (no workspaceId needed)
 * Feature 198: Owner-based billing
 */
export const resumeOwnerSubscription = async (): Promise<ResumeResponse> => {
  const response = await api.post("/subscription-billing/resume")
  clearOwnerBillingCaches()
  return response.data.data
}

/**
 * Upgrade plan for authenticated owner (no workspaceId needed)
 * Feature 198: Owner-based billing
 * Immediate effect
 */
export const upgradeOwnerPlan = async (
  planType: "BASIC" | "PREMIUM" | "ENTERPRISE"
): Promise<{
  newPlan: { displayName: string; monthlyFee: number }
  nextBillingDate: string
}> => {
  const response = await api.post("/subscription-billing/upgrade", { planType })
  clearOwnerBillingCaches()
  return response.data.data
}

/**
 * Schedule downgrade for authenticated owner (no workspaceId needed)
 * Feature 198: Owner-based billing
 * Effective next billing cycle
 */
export const scheduleOwnerDowngrade = async (
  newPlan: PlanType
): Promise<DowngradeResponse> => {
  const response = await api.post("/subscription-billing/downgrade", { newPlan })
  clearOwnerBillingCaches()
  return response.data.data
}

/**
 * Cancel pending plan change for authenticated owner (no workspaceId needed)
 * Feature 198: Owner-based billing
 */
export const cancelOwnerPendingChange = async (): Promise<{ message: string }> => {
  const response = await api.delete("/subscription-billing/pending-change")
  clearOwnerBillingCaches()
  return response.data
}

// ============================================================================
// INVOICE API FUNCTIONS (Feature 197)
// ============================================================================

export type InvoiceStatus = "DRAFT" | "PENDING" | "PAID" | "FAILED" | "CANCELLED"

export interface ConsumptionBreakdown {
  messages: { count: number; amount: number }
  orders: { count: number; amount: number }
  pushNotifications: { count: number; amount: number }
  adjustments: { count: number; amount: number }
  totalConsumption: number
}

export interface Invoice {
  id: string
  userId: string
  periodStart: string
  periodEnd: string
  periodMonth: number
  periodYear: number
  subscriptionAmount: number
  creditUsage: number
  creditDebt: number
  totalAmount: number
  status: InvoiceStatus
  paidAt: string | null
  planType: PlanType
  itemsBreakdown: ConsumptionBreakdown
  createdAt: string
  updatedAt: string
}

export interface InvoicesResponse {
  invoices: Invoice[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * Get invoice history for authenticated owner
 * Feature 197: Monthly invoices
 */
export const getOwnerInvoices = async (
  page: number = 1,
  limit: number = 12
): Promise<InvoicesResponse> => {
  const response = await api.get("/subscription-billing/invoices", {
    params: { page, limit },
  })
  return {
    invoices: response.data.data,
    pagination: response.data.pagination,
  }
}

/**
 * Get current month's draft invoice with real-time consumption breakdown
 * Feature 197: Monthly invoices
 */
export const getCurrentInvoice = async (): Promise<Invoice> => {
  const response = await api.get("/subscription-billing/invoices/current")
  return response.data.data
}

/**
 * Get specific invoice by ID
 * Feature 197: Monthly invoices
 */
export const getInvoiceById = async (invoiceId: string): Promise<Invoice> => {
  const response = await api.get(`/subscription-billing/invoices/${invoiceId}`)
  return response.data.data
}
