/**
 * Billing Context
 * Feature 185: Subscription & Billing System
 *
 * Global state for billing information:
 * - Credit balance (for header display)
 * - Plan type and limits
 * - Trial info
 *
 * SECURITY: Only fetches data for authenticated user's workspace
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { useWorkspace } from "./WorkspaceContext"
import {
  getBalance,
  getBillingOverview,
  BillingOverview,
  BalanceResponse,
  PlanType,
} from "../services/subscriptionBillingApi"

// ============================================================================
// TYPES
// ============================================================================

interface BillingContextState {
  // Balance info (quick load)
  creditBalance: number
  isLowBalance: boolean
  isTrialPlan: boolean
  trialDaysRemaining: number | null
  isTrialExpired: boolean
  planType: PlanType | null

  // Full overview (lazy load)
  billingOverview: BillingOverview | null

  // Loading states
  isLoadingBalance: boolean
  isLoadingOverview: boolean
  error: string | null

  // Actions
  refreshBalance: () => Promise<void>
  refreshOverview: () => Promise<void>
  updateBalanceLocally: (newBalance: number) => void
}

const defaultState: BillingContextState = {
  creditBalance: 0,
  isLowBalance: false,
  isTrialPlan: false,
  trialDaysRemaining: null,
  isTrialExpired: false,
  planType: null,
  billingOverview: null,
  isLoadingBalance: false,
  isLoadingOverview: false,
  error: null,
  refreshBalance: async () => {},
  refreshOverview: async () => {},
  updateBalanceLocally: () => {},
}

// ============================================================================
// CONTEXT
// ============================================================================

const BillingContext = createContext<BillingContextState>(defaultState)

export const useBilling = () => {
  const context = useContext(BillingContext)
  if (!context) {
    throw new Error("useBilling must be used within a BillingProvider")
  }
  return context
}

// ============================================================================
// PROVIDER
// ============================================================================

interface BillingProviderProps {
  children: ReactNode
}

export const BillingProvider: React.FC<BillingProviderProps> = ({ children }) => {
  const { workspace } = useWorkspace()
  const workspaceId = workspace?.id

  // Balance state (quick load for header)
  const [creditBalance, setCreditBalance] = useState(0)
  const [isLowBalance, setIsLowBalance] = useState(false)
  const [isTrialPlan, setIsTrialPlan] = useState(false)
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null)
  const [isTrialExpired, setIsTrialExpired] = useState(false)
  const [planType, setPlanType] = useState<PlanType | null>(null)

  // Full overview state (lazy load)
  const [billingOverview, setBillingOverview] = useState<BillingOverview | null>(null)

  // Loading states
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [isLoadingOverview, setIsLoadingOverview] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch quick balance info (for header)
   */
  const refreshBalance = useCallback(async () => {
    if (!workspaceId) return

    setIsLoadingBalance(true)
    setError(null)

    try {
      const data = await getBalance(workspaceId)
      setCreditBalance(data.creditBalance)
      setIsLowBalance(data.isLowBalance)
      setPlanType(data.planType) // Now included in balance response

      if (data.trialInfo) {
        setIsTrialPlan(data.trialInfo.isTrialPlan)
        setTrialDaysRemaining(data.trialInfo.daysRemaining)
        setIsTrialExpired(data.trialInfo.isExpired)
      } else {
        setIsTrialPlan(false)
        setTrialDaysRemaining(null)
        setIsTrialExpired(false)
      }
    } catch (err) {
      console.error("[BillingContext] Error fetching balance:", err)
      setError(err instanceof Error ? err.message : "Error loading balance")
    } finally {
      setIsLoadingBalance(false)
    }
  }, [workspaceId])

  /**
   * Fetch full billing overview (for profile page)
   */
  const refreshOverview = useCallback(async () => {
    if (!workspaceId) return

    setIsLoadingOverview(true)
    setError(null)

    try {
      const data = await getBillingOverview(workspaceId)
      setBillingOverview(data)

      // Also update quick balance state from overview
      setCreditBalance(data.billing.creditBalance)
      setIsLowBalance(data.billing.creditBalance < data.limits.lowBalanceThreshold)
      setPlanType(data.billing.planType)
      setIsTrialPlan(data.billing.planType === "FREE_TRIAL")
      setTrialDaysRemaining(data.billing.daysUntilTrialExpires)
      setIsTrialExpired(data.billing.isTrialExpired)
    } catch (err) {
      console.error("[BillingContext] Error fetching overview:", err)
      setError(err instanceof Error ? err.message : "Error loading billing info")
    } finally {
      setIsLoadingOverview(false)
    }
  }, [workspaceId])

  /**
   * Update balance locally (after recharge without refetch)
   */
  const updateBalanceLocally = useCallback((newBalance: number) => {
    setCreditBalance(newBalance)
    setIsLowBalance(newBalance < 5) // Default threshold
  }, [])

  // Fetch balance on workspace change
  useEffect(() => {
    if (workspaceId) {
      refreshBalance()
    } else {
      // Reset state when no workspace
      setCreditBalance(0)
      setIsLowBalance(false)
      setIsTrialPlan(false)
      setTrialDaysRemaining(null)
      setIsTrialExpired(false)
      setPlanType(null)
      setBillingOverview(null)
    }
  }, [workspaceId, refreshBalance])

  // Auto-refresh balance every 60 seconds when tab is active
  useEffect(() => {
    if (!workspaceId) return

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshBalance()
      }
    }, 60000) // 60 seconds

    return () => clearInterval(interval)
  }, [workspaceId, refreshBalance])

  const value: BillingContextState = {
    creditBalance,
    isLowBalance,
    isTrialPlan,
    trialDaysRemaining,
    isTrialExpired,
    planType,
    billingOverview,
    isLoadingBalance,
    isLoadingOverview,
    error,
    refreshBalance,
    refreshOverview,
    updateBalanceLocally,
  }

  return (
    <BillingContext.Provider value={value}>
      {children}
    </BillingContext.Provider>
  )
}

export default BillingContext
