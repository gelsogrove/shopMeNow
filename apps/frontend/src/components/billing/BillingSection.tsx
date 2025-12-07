/**
 * Billing Section Component
 * Feature 185: Subscription & Billing System
 *
 * Displays in Profile page:
 * - Current plan info
 * - Credit balance with recharge button
 * - Usage stats (products, customers, channels)
 * - Transaction history
 * - Upgrade button
 *
 * SECURITY: Recharge and Upgrade only visible to SUPER_ADMIN (Owner)
 */

import { useState, useEffect } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useBilling } from "@/contexts/BillingContext"
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { usePlatformConfig } from "@/hooks/usePlatformConfig"
import {
  formatCurrency,
  getTransactionTypeInfo,
  rechargeCredit,
  getTransactions,
  changePlan,
  getBillingOverview,
  pauseOwnerSubscription,
  resumeOwnerSubscription,
  getOwnerSubscriptionStatus,
  Transaction,
  PlanType,
  BillingOverview,
  SubscriptionStatusResponse,
} from "@/services/subscriptionBillingApi"
import { PLAN_CONFIGS, getPlanFeaturesWithText } from "@/config/planFeatures"
import { toast } from "@/lib/toast"
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  Radio,
  AlertTriangle,
  Loader2,
  History,
  Plus,
  Info,
  Download,
  Check,
  CheckCircle,
  X,
  FileText,
  Pause,
  Play,
  Calendar,
} from "lucide-react"

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

interface RechargeAmountOption {
  value: number
  label: string
}

const RECHARGE_OPTIONS: RechargeAmountOption[] = [
  { value: 10, label: "€10" },
  { value: 25, label: "€25" },
  { value: 50, label: "€50" },
  { value: 100, label: "€100" },
]

// Plan limits per type (used for downgrade validation)
interface PlanLimitsConfig {
  maxChannels: number
  maxProducts: number
  maxCustomers: number
}

const PLAN_LIMITS: Record<PlanType, PlanLimitsConfig> = {
  FREE_TRIAL: { maxChannels: 1, maxProducts: 50, maxCustomers: 50 },
  BASIC: { maxChannels: 1, maxProducts: 50, maxCustomers: 50 },
  PREMIUM: { maxChannels: 2, maxProducts: 100, maxCustomers: 100 },
  ENTERPRISE: { maxChannels: 999, maxProducts: 9999, maxCustomers: 9999 },
}

// Plan order for upgrade/downgrade logic
const PLAN_ORDER: Record<PlanType, number> = {
  FREE_TRIAL: 0,
  BASIC: 1,
  PREMIUM: 2,
  ENTERPRISE: 3,
}

// Check if user can downgrade to a target plan based on current usage
interface DowngradeCheck {
  canDowngrade: boolean
  reasons: string[]
}

function checkCanDowngrade(usage: { productsCount: number; customersCount: number; channelsCount: number }, targetPlan: PlanType): DowngradeCheck {
  const limits = PLAN_LIMITS[targetPlan]
  const reasons: string[] = []

  if (usage.productsCount > limits.maxProducts) {
    reasons.push(`Too many products: ${usage.productsCount}/${limits.maxProducts}`)
  }
  if (usage.customersCount > limits.maxCustomers) {
    reasons.push(`Too many customers: ${usage.customersCount}/${limits.maxCustomers}`)
  }
  if (usage.channelsCount > limits.maxChannels) {
    reasons.push(`Too many channels: ${usage.channelsCount}/${limits.maxChannels}`)
  }

  return {
    canDowngrade: reasons.length === 0,
    reasons,
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface BillingSectionProps {
  workspaceId?: string
  /** Optional callback to share billingOverview with parent/sibling components */
  onBillingOverviewLoaded?: (overview: BillingOverview | null) => void
  /** Optional: externally control the upgrade dialog open state */
  openUpgradeDialog?: boolean
  /** Optional: callback when upgrade dialog is closed */
  onUpgradeDialogClose?: () => void
  /** Optional: externally control the invoices dialog open state */
  openInvoicesDialog?: boolean
  /** Optional: callback when invoices dialog is closed */
  onInvoicesDialogClose?: () => void
}

export function BillingSection({ workspaceId: propWorkspaceId, onBillingOverviewLoaded, openUpgradeDialog, onUpgradeDialogClose, openInvoicesDialog, onInvoicesDialogClose }: BillingSectionProps) {
  const { workspace } = useWorkspace()
  // Use prop workspaceId if provided, otherwise fall back to context workspace
  const effectiveWorkspaceId = propWorkspaceId || workspace?.id
  const { isSuperAdmin } = useWorkspaceRole(effectiveWorkspaceId)
  
  // Use context billing if no prop workspaceId, otherwise use local state
  const contextBilling = useBilling()
  
  // Get prices from database for dynamic pricing
  const { getPriceWithOriginal } = usePlatformConfig()
  
  // Local billing state (used when workspaceId prop is provided)
  const [localBillingOverview, setLocalBillingOverview] = useState<BillingOverview | null>(null)
  const [localIsLoading, setLocalIsLoading] = useState(false)
  
  // Determine which billing data to use
  const billingOverview = propWorkspaceId ? localBillingOverview : contextBilling.billingOverview
  const isLoadingOverview = propWorkspaceId ? localIsLoading : contextBilling.isLoadingOverview

  // Notify parent when billing overview is loaded (only on data change, not callback change)
  useEffect(() => {
    if (onBillingOverviewLoaded && billingOverview) {
      onBillingOverviewLoaded(billingOverview)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billingOverview]) // Intentionally exclude onBillingOverviewLoaded to prevent loop

  // Local state
  const [showRechargeDialog, setShowRechargeDialog] = useState(false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)
  const [showInvoicesDialog, setShowInvoicesDialog] = useState(false)
  const [showPlanConfirmDialog, setShowPlanConfirmDialog] = useState(false)
  const [pendingPlanChange, setPendingPlanChange] = useState<PlanType | null>(null)
  const [rechargeAmount, setRechargeAmount] = useState(25)
  const [customAmount, setCustomAmount] = useState("")
  const [isRecharging, setIsRecharging] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [isPausingSubscription, setIsPausingSubscription] = useState(false)
  const [isResumingSubscription, setIsResumingSubscription] = useState(false)
  const [showResumeConfirmDialog, setShowResumeConfirmDialog] = useState(false)
  const [showPauseConfirmView, setShowPauseConfirmView] = useState(false)
  const [showResumeConfirmView, setShowResumeConfirmView] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatusResponse | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)

  // External control: open upgrade dialog when prop changes to true
  useEffect(() => {
    if (openUpgradeDialog) {
      setShowUpgradeDialog(true)
    }
  }, [openUpgradeDialog])

  // External control: open invoices dialog when prop changes to true
  useEffect(() => {
    if (openInvoicesDialog) {
      setShowInvoicesDialog(true)
    }
  }, [openInvoicesDialog])

  // Load subscription status
  const loadSubscriptionStatus = async () => {
    try {
      const status = await getOwnerSubscriptionStatus()
      setSubscriptionStatus(status)
    } catch (error) {
      console.error("Failed to load subscription status:", error)
    }
  }

  // Load subscription status on mount and when dialog opens
  useEffect(() => {
    loadSubscriptionStatus()
  }, [])

  useEffect(() => {
    if (showUpgradeDialog) {
      loadSubscriptionStatus()
    }
  }, [showUpgradeDialog])

  // Handle upgrade dialog close - notify parent
  const handleUpgradeDialogClose = (open: boolean) => {
    setShowUpgradeDialog(open)
    if (!open && onUpgradeDialogClose) {
      onUpgradeDialogClose()
    }
  }

  // Handle invoices dialog close - notify parent
  const handleInvoicesDialogClose = (open: boolean) => {
    setShowInvoicesDialog(open)
    if (!open && onInvoicesDialogClose) {
      onInvoicesDialogClose()
    }
  }

  // Refresh overview function - uses local or context depending on prop
  const refreshOverview = async () => {
    if (!effectiveWorkspaceId) return
    
    if (propWorkspaceId) {
      // Load directly when using prop workspaceId
      setLocalIsLoading(true)
      try {
        const data = await getBillingOverview(propWorkspaceId)
        setLocalBillingOverview(data)
      } catch (error) {
        console.error("Failed to load billing overview:", error)
      } finally {
        setLocalIsLoading(false)
      }
    } else {
      // Use context refresh
      contextBilling.refreshOverview()
    }
  }

  // Update balance and totalRecharges locally after a recharge
  const updateBalanceLocally = (newBalance: number, rechargeAmount?: number) => {
    if (propWorkspaceId && localBillingOverview) {
      const currentTotalRecharges = localBillingOverview.billing.totalRecharges || 0
      setLocalBillingOverview({
        ...localBillingOverview,
        billing: { 
          ...localBillingOverview.billing, 
          creditBalance: newBalance,
          // Update totalRecharges if rechargeAmount is provided
          totalRecharges: rechargeAmount 
            ? currentTotalRecharges + rechargeAmount 
            : currentTotalRecharges
        }
      })
    } else {
      contextBilling.updateBalanceLocally(newBalance)
    }
  }

  // 🔄 Load billing overview when component mounts
  useEffect(() => {
    if (effectiveWorkspaceId && !billingOverview && !isLoadingOverview) {
      refreshOverview()
    }
  }, [effectiveWorkspaceId, billingOverview, isLoadingOverview])

  // 🔄 Load transactions on mount (needed to check if Invoices button should show)
  useEffect(() => {
    if (effectiveWorkspaceId && transactions.length === 0) {
      loadTransactions()
    }
  }, [effectiveWorkspaceId])

  // Check if there are billable transactions (not just INITIAL_CREDIT)
  // Also show Invoices button if user has an active paid subscription
  const hasPaidSubscription = billingOverview?.billing?.planType && 
    billingOverview.billing.planType !== "FREE_TRIAL"
  
  const hasInvoiceableTransactions = hasPaidSubscription || transactions.some(tx => 
    tx.type !== "INITIAL_CREDIT" && 
    (tx.type === "RECHARGE" || tx.type === "MONTHLY_FEE" || tx.type === "UPGRADE_FEE" || tx.amount < 0)
  )

  const loadTransactions = async () => {
    if (!effectiveWorkspaceId) return

    setIsLoadingTransactions(true)
    try {
      const data = await getTransactions(effectiveWorkspaceId, { 
        limit: 200  // Load more transactions for full history
      })
      setTransactions(data.transactions)
    } catch (error) {
      console.error("Failed to load transactions:", error)
      toast.error("Failed to load transaction history")
    } finally {
      setIsLoadingTransactions(false)
    }
  }

  const handleRecharge = async () => {
    if (!effectiveWorkspaceId) return

    const amount = customAmount ? parseFloat(customAmount) : rechargeAmount

    if (amount < 10 || amount > 1000) {
      toast.error("Amount must be between €10 and €1000")
      return
    }

    setIsRecharging(true)
    try {
      const result = await rechargeCredit(effectiveWorkspaceId, amount)

      if (result.upgradedToPlan) {
        toast.success(`Credit recharged! Plan upgraded to ${result.upgradedToPlan}. New balance: ${formatCurrency(result.newBalance)}`)
      } else {
        toast.success(`Credit recharged! New balance: ${formatCurrency(result.newBalance)}`)
      }

      // Update local balance AND totalRecharges immediately with result from API
      updateBalanceLocally(result.newBalance, amount)

      // Close dialog and reset
      setShowRechargeDialog(false)
      setCustomAmount("")
      setRechargeAmount(25)

      // Refresh full overview to get updated transactions and totals
      // Use setTimeout to ensure backend has committed the transaction
      setTimeout(() => {
        refreshOverview()
      }, 500)
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "Failed to recharge credit"
      toast.error(errorMessage)
    } finally {
      setIsRecharging(false)
    }
  }

  const handlePlanChange = async (newPlan: PlanType) => {
    if (!effectiveWorkspaceId) return

    setIsUpgrading(true)
    try {
      const result = await changePlan(effectiveWorkspaceId, newPlan as "BASIC" | "PREMIUM" | "ENTERPRISE")

      const action = result.isDowngrade ? "downgraded" : "upgraded"
      toast.success(`Successfully ${action} to ${result.newPlan.displayName}!`)

      // Close dialogs
      setShowUpgradeDialog(false)
      setShowPlanConfirmDialog(false)
      setPendingPlanChange(null)

      // Refresh the entire page to update all components with new plan data
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error || "Failed to change plan"
      toast.error(errorMessage)
    } finally {
      setIsUpgrading(false)
    }
  }

  // Open confirmation dialog before plan change
  const initiatePlanChange = (newPlan: PlanType) => {
    setPendingPlanChange(newPlan)
    setShowPlanConfirmDialog(true)
  }

  // Confirm and execute plan change
  const confirmPlanChange = () => {
    if (pendingPlanChange) {
      handlePlanChange(pendingPlanChange)
    }
  }

  // Handle pause subscription
  const handlePauseSubscription = async () => {
    try {
      setIsPausingSubscription(true)
      await pauseOwnerSubscription()
      // Refresh billing data and subscription status - UI already shows confirmation page
      refreshOverview()
      loadSubscriptionStatus()
    } catch (error: any) {
      const message = error.response?.data?.error || "Error pausing subscription"
      toast.error(message)
    } finally {
      setIsPausingSubscription(false)
    }
  }

  // Handle resume subscription
  const handleResumeSubscription = async () => {
    try {
      setIsResumingSubscription(true)
      await resumeOwnerSubscription()
      // Refresh billing data and subscription status - UI already shows confirmation page
      refreshOverview()
      loadSubscriptionStatus()
    } catch (error: any) {
      const message = error.response?.data?.error || "Error resuming subscription"
      toast.error(message)
    } finally {
      setIsResumingSubscription(false)
    }
  }

  // Check if subscription is paused (PAUSE_PENDING no longer used - pause is IMMEDIATE)
  const isSubscriptionPaused = subscriptionStatus?.subscriptionStatus === "PAUSED"

  // Loading state
  if (isLoadingOverview || !billingOverview) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  const { billing, limits, usage, planConfig } = billingOverview
  const isTrialPlan = billing.planType === "FREE_TRIAL"
  const isCreditCritical = billing.creditBalance === 0
  const isCreditLow = billing.creditBalance > 0 && billing.creditBalance < limits.lowBalanceThreshold

  const getPlanBadgeVariant = (planType: PlanType) => {
    switch (planType) {
      case "FREE_TRIAL":
        return billing.isTrialExpired ? "destructive" : "warning"
      case "BASIC":
        return "secondary"
      case "PREMIUM":
        return "default"
      case "ENTERPRISE":
        return "default"
      default:
        return "secondary"
    }
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500"
    if (percentage >= 75) return "bg-amber-500"
    return "bg-emerald-500"
  }

  // Calculate estimated messages remaining
  const estimatedMessagesRemaining = Math.floor(billing.creditBalance / limits.messageCost)

  return (
    <div className="space-y-6">
      {/* 🔶 PAUSED: Subscription is paused */}
      {isSubscriptionPaused && (
        <div className="flex items-center gap-3 p-4 bg-orange-100 dark:bg-orange-950 rounded-lg border-2 border-orange-500">
          <Pause className="h-6 w-6 text-orange-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-orange-800 dark:text-orange-200 text-lg">
              ⏸️ Subscription PAUSED
            </p>
            <p className="text-sm text-orange-700 dark:text-orange-300">
              Your chatbot/s are not responding to customers. Click "Change Plan" to resume your subscription.
            </p>
          </div>
          {isSuperAdmin && (
            <Button
              onClick={() => setShowUpgradeDialog(true)}
              variant="outline"
              className="flex-shrink-0 border-orange-500 text-orange-700 hover:bg-orange-100"
            >
              <Play className="h-4 w-4 mr-2" />
              Resume
            </Button>
          )}
        </div>
      )}

      {/* 🚨 CRITICAL: Credit = 0 Warning - Chatbot is DISABLED */}
      {isCreditCritical && !billing.isTrialExpired && (
        <div className="flex items-center gap-3 p-4 bg-red-100 dark:bg-red-950 rounded-lg border-2 border-red-500 animate-pulse">
          <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-red-800 dark:text-red-200 text-lg">
              ⚠️ Your chatbot is DISABLED
            </p>
            <p className="text-sm text-red-700 dark:text-red-300">
              Credit balance is €0.00. Your chatbot will not respond to any customer messages until you recharge.
            </p>
          </div>
          {isSuperAdmin && (
            <Button
              onClick={() => setShowRechargeDialog(true)}
              variant="destructive"
              className="flex-shrink-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              Recharge Now
            </Button>
          )}
        </div>
      )}

      {/* ⚠️ Low Credit Warning */}
      {isCreditLow && !billing.isTrialExpired && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-400">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Low credit warning
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Only ~{estimatedMessagesRemaining} messages remaining. Recharge soon to avoid service interruption.
            </p>
          </div>
          {isSuperAdmin && (
            <Button
              onClick={() => setShowRechargeDialog(true)}
              variant="outline"
              className="border-amber-500 text-amber-700 hover:bg-amber-100"
            >
              <Plus className="h-4 w-4 mr-2" />
              Recharge
            </Button>
          )}
        </div>
      )}

      {/* Plan & Credit Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CreditCard className="h-5 w-5" />
                Plans
              </CardTitle>
              <CardDescription>
                Manage your plan and credit
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistoryDialog(true)}
                className="gap-1.5 text-green-600 border-green-600 hover:bg-green-50"
              >
                <History className="h-4 w-4" />
                History
              </Button>
              {isSuperAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUpgradeDialog(true)}
                  className="gap-1.5 text-green-600 border-green-600 hover:bg-green-50"
                >
                  <TrendingUp className="h-4 w-4" />
                  Change Plan
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Trial Expired Warning */}
          {billing.isTrialExpired && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div className="flex-1">
                <p className="font-medium text-red-800 dark:text-red-200">
                  ⚠️ Your trial has expired - Chatbot is DISABLED
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  Choose a plan to reactivate your chatbot
                </p>
              </div>
              {isSuperAdmin && (
                <Button
                  onClick={() => setShowUpgradeDialog(true)}
                  variant="destructive"
                >
                  Choose a Plan
                </Button>
              )}
            </div>
          )}

          {/* Credit & Plan Info */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Credit Balance */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Available Credit
                </span>
                {billing.creditBalance < limits.lowBalanceThreshold && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Low Credit
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-4xl font-bold">
                  {formatCurrency(billing.creditBalance)}
                </span>
                {isSuperAdmin && (
                  <Button
                    onClick={() => setShowRechargeDialog(true)}
                    className="gap-2"
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                    Recharge Credit
                  </Button>
                )}
              </div>
            </div>

            {/* Plan Details */}
            <div className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subscription {planConfig.displayName}:</span>
                  <span className="font-medium text-emerald-600">
                    {formatCurrency(planConfig.monthlyFee)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total recharges:</span>
                  <span className="font-medium text-emerald-600">
                    {formatCurrency(billing.totalRecharges || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxes:</span>
                  <span className="font-medium text-emerald-600">
                    22%
                  </span>
                </div>
                {billing.nextBillingDate && billing.planType !== "FREE_TRIAL" && (
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-muted-foreground">
                      Next renewal:
                    </span>
                    <div className="text-right">
                      <span className="font-medium">
                        {new Date(billing.nextBillingDate).toLocaleDateString("en-US")}
                      </span>
                      <span className="ml-2 text-green-600 font-bold">
                        {formatCurrency(
                          (planConfig.monthlyFee + (billing.totalRecharges || 0)) * 1.22
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recharge Dialog */}
      <Dialog open={showRechargeDialog} onOpenChange={setShowRechargeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recharge Credit</DialogTitle>
            <DialogDescription>
              Select an amount or enter a custom amount (min €10, max €1000)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Preset amounts */}
            <div className="grid grid-cols-4 gap-2">
              {RECHARGE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={
                    rechargeAmount === option.value && !customAmount
                      ? "default"
                      : "outline"
                  }
                  onClick={() => {
                    setRechargeAmount(option.value)
                    setCustomAmount("")
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            {/* Custom amount */}
            <div className="space-y-2">
              <Label htmlFor="customAmount">Custom Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  €
                </span>
                <Input
                  id="customAmount"
                  type="number"
                  min={10}
                  max={1000}
                  placeholder="Enter amount"
                  className="pl-7"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                />
              </div>
            </div>

            {/* Summary with messages estimate */}
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span>Recharge amount:</span>
                <span className="text-xl font-bold">
                  {formatCurrency(
                    customAmount ? parseFloat(customAmount) || 0 : rechargeAmount
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground border-t pt-2">
                <span>Estimated messages:</span>
                <span className="font-medium text-foreground">
                  ~{Math.floor((customAmount ? parseFloat(customAmount) || 0 : rechargeAmount) / limits.messageCost)} messages
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Based on {formatCurrency(limits.messageCost)} per message
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRechargeDialog(false)}
              disabled={isRecharging}
            >
              Cancel
            </Button>
            <Button onClick={handleRecharge} disabled={isRecharging}>
              {isRecharging ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Confirm Recharge
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={(open) => {
        handleUpgradeDialogClose(open)
        if (!open) {
          setShowPauseConfirmView(false)
          setShowResumeConfirmView(false)
        }
      }}>
        <DialogContent className={(showPauseConfirmView || showResumeConfirmView) ? "max-w-3xl" : "max-w-6xl max-h-[90vh] overflow-y-auto"}>
          {showPauseConfirmView ? (
            /* Pause Confirmation View */
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl text-orange-600 flex items-center gap-2">
                  <Pause className="h-6 w-6" />
                  Pause Subscription
                </DialogTitle>
                <DialogDescription>
                  Review what happens when you pause your subscription
                </DialogDescription>
              </DialogHeader>

              <div className="grid md:grid-cols-2 gap-6 py-4">
                {/* Left: Current Plan Card */}
                <div className="rounded-2xl border-2 border-orange-300 bg-orange-50 p-6">
                  <Badge className="mb-4 bg-orange-500">Current Plan</Badge>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {PLAN_CONFIGS[billing.planType]?.name || billing.planType}
                  </h3>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-gray-900">
                      €{planConfig?.monthlyFee || 0}
                    </span>
                    <span className="text-gray-600">/month</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {PLAN_CONFIGS[billing.planType]?.description}
                  </p>
                </div>

                {/* Right: What happens */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900">What will happen:</h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <X className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">Chatbot stops responding</p>
                        <p className="text-sm text-gray-600">All WhatsApp channels will be blocked. Customers won't receive any responses.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">Final invoice at month end</p>
                        <p className="text-sm text-gray-600">You'll be charged only for usage until pause date. No more charges after.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">Data is preserved</p>
                        <p className="text-sm text-gray-600">Products, customers, orders - everything stays safe.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Play className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">Reactivate anytime</p>
                        <p className="text-sm text-gray-600">You can resume your subscription whenever you want.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowPauseConfirmView(false)}
                  disabled={isPausingSubscription}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-orange-500 hover:bg-orange-600"
                  onClick={async () => {
                    await handlePauseSubscription()
                    setShowPauseConfirmView(false)
                    // Dialog stays open, shows updated state
                  }}
                  disabled={isPausingSubscription}
                >
                  {isPausingSubscription ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Pausing...
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Confirm Pause
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : showResumeConfirmView ? (
            /* Resume Confirmation View */
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl text-green-600 flex items-center gap-2">
                  <Play className="h-6 w-6" />
                  Resume Subscription
                </DialogTitle>
                <DialogDescription>
                  Review what happens when you resume your subscription
                </DialogDescription>
              </DialogHeader>

              <div className="grid md:grid-cols-2 gap-6 py-4">
                {/* Left: Current Plan Card */}
                <div className="rounded-2xl border-2 border-green-300 bg-green-50 p-6">
                  <Badge className="mb-4 bg-green-500">Your Plan</Badge>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {PLAN_CONFIGS[billing.planType]?.name || billing.planType}
                  </h3>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-gray-900">
                      €{planConfig?.monthlyFee || 0}
                    </span>
                    <span className="text-gray-600">/month</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {PLAN_CONFIGS[billing.planType]?.description}
                  </p>
                </div>

                {/* Right: What happens */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900">What will happen:</h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">Chatbot reactivated immediately</p>
                        <p className="text-sm text-gray-600">All WhatsApp channels will start responding to customers right away.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">Billing resumes on 1st of next month</p>
                        <p className="text-sm text-gray-600">An invoice will be generated for your {PLAN_CONFIGS[billing.planType]?.name || billing.planType} plan ({formatCurrency(planConfig?.monthlyFee || 0)}/month) plus any recharges you make.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">All your data is intact</p>
                        <p className="text-sm text-gray-600">Products, customers, orders - everything is still there, ready to go.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Pause className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">Pause again anytime</p>
                        <p className="text-sm text-gray-600">You can pause your subscription whenever you need to.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowResumeConfirmView(false)}
                  disabled={isResumingSubscription}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={async () => {
                    await handleResumeSubscription()
                    setShowResumeConfirmView(false)
                    // Dialog stays open, shows updated state
                  }}
                  disabled={isResumingSubscription}
                >
                  {isResumingSubscription ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Resuming...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Confirm Resume
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            /* Normal Plan Selection View */
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">Change Plan</DialogTitle>
                <DialogDescription>
                  Choose the plan that best suits your needs. The subscription
                  will start in 30 days.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 md:grid-cols-4 py-4">
                {/* Render plans dynamically from PLAN_CONFIGS */}
                {(["FREE_TRIAL", "BASIC", "PREMIUM", "ENTERPRISE"] as const).map((planKey) => {
                  const planConfig = PLAN_CONFIGS[planKey]
                  const isCurrentPlan = billing.planType === planKey
                  const isFreePlan = planKey === "FREE_TRIAL"
                  const isDowngrade = PLAN_ORDER[billing.planType] > PLAN_ORDER[planKey]
                  const downgradeCheck = isDowngrade ? checkCanDowngrade(usage, planKey) : { canDowngrade: true, reasons: [] }
                  // Free plan is never selectable for plan changes
                  const canSelect = !isFreePlan && !isCurrentPlan && (isDowngrade ? downgradeCheck.canDowngrade : true)
                  const features = getPlanFeaturesWithText(planKey)
                  
                  // Get dynamic price from database (Free plan has no price key)
                  const priceKey = isFreePlan ? null : `${planKey}_MONTHLY`
              const priceInfo = priceKey ? getPriceWithOriginal(priceKey) : { current: 0, original: null }
              
              return (
                <div
                  key={planKey}
                  className={`relative rounded-2xl border-2 p-6 flex flex-col ${
                    isCurrentPlan
                      ? "border-blue-500 bg-gradient-to-br from-blue-50 to-green-50 shadow-xl"
                      : isFreePlan
                        ? "border-gray-200 bg-gray-50 opacity-75"
                        : "border-gray-200 bg-white hover:border-blue-300 transition-all"
                  }`}
                >
                  {isCurrentPlan && (
                    <Badge className={`absolute -top-3 left-1/2 -translate-x-1/2 ${isSubscriptionPaused ? "bg-orange-500" : "bg-blue-500"}`}>
                      {isSubscriptionPaused ? "PAUSED" : "Current Plan"}
                    </Badge>
                  )}
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{planConfig.name}</h3>
                    <div className="mb-2">
                      {isFreePlan ? (
                        <>
                          <span className="text-3xl font-bold text-gray-900">€0</span>
                          <span className="text-gray-600">/14 days</span>
                        </>
                      ) : (
                        <>
                          {/* Show strikethrough original price if different from current */}
                          {priceInfo.original && priceInfo.original !== priceInfo.current && (
                            <span className="text-lg text-gray-400 line-through mr-2">
                              €{priceInfo.original}
                            </span>
                          )}
                          <span className={`text-3xl font-bold ${priceInfo.original && priceInfo.original !== priceInfo.current ? "text-green-600" : "text-gray-900"}`}>
                            €{priceInfo.current}
                          </span>
                          <span className="text-gray-600">/month</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{planConfig.description}</p>
                  </div>

                  <div className="flex-grow space-y-3 mb-6">
                    {features.map((feature) => (
                      <div key={feature.name} className="flex items-start gap-2">
                        {feature.included ? (
                          <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 flex-shrink-0" />
                        )}
                        <span className={`text-sm ${feature.included ? "text-gray-700" : "text-gray-400"}`}>
                          {feature.name}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Pause/Resume section for current plan */}
                  {isCurrentPlan && !isFreePlan && (
                    <div className="space-y-2">
                      {isSubscriptionPaused ? (
                        /* Resume flow - opens confirmation view */
                        <Button
                          className="w-full bg-orange-500 hover:bg-orange-600"
                          onClick={() => setShowResumeConfirmView(true)}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Resume Subscription
                        </Button>
                      ) : (
                        /* Pause flow - opens confirmation view */
                        <Button
                          variant="outline"
                          className="w-full text-orange-600 border-orange-300 hover:bg-orange-50"
                          onClick={() => setShowPauseConfirmView(true)}
                        >
                          <Pause className="h-4 w-4 mr-2" />
                          Pause Subscription
                        </Button>
                      )}
                    </div>
                  )}

                  {!isCurrentPlan && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Button
                              className={`w-full ${canSelect ? "bg-green-600 hover:bg-green-700" : "bg-gray-400 cursor-not-allowed"}`}
                              onClick={() => canSelect && initiatePlanChange(planKey)}
                              disabled={isUpgrading || !canSelect}
                            >
                              {isUpgrading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : isFreePlan ? (
                                "Only for new users"
                              ) : isDowngrade ? (
                                <>
                                  <TrendingDown className="h-4 w-4 mr-2" />
                                  Downgrade to {planConfig.name}
                                </>
                              ) : (
                                <>
                                  <TrendingUp className="h-4 w-4 mr-2" />
                                  Upgrade to {planConfig.name}
                                </>
                              )}
                            </Button>
                          </div>
                        </TooltipTrigger>
                        {isFreePlan && (
                          <TooltipContent side="bottom" className="max-w-xs">
                            <p className="text-sm">
                              The Free Trial is only available for new registrations.
                            </p>
                          </TooltipContent>
                        )}
                        {isDowngrade && !downgradeCheck.canDowngrade && (
                          <TooltipContent side="bottom" className="max-w-xs">
                            <p className="font-medium text-red-600">Cannot downgrade</p>
                            <ul className="text-sm mt-1">
                              {downgradeCheck.reasons.map((reason, i) => (
                                <li key={i}>• {reason}</li>
                              ))}
                            </ul>
                            <p className="text-xs mt-2 text-muted-foreground">
                              Reduce your usage first to downgrade.
                            </p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              )
            })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Transaction History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-6xl h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Transaction History
            </DialogTitle>
            <DialogDescription>
              Your account transactions grouped by month
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoadingTransactions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.filter(tx => tx.amount !== 0 || tx.type === "UPGRADE_FEE" || tx.type === "MONTHLY_FEE").length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No transactions found
              </div>
            ) : (
              <div className="space-y-6">
                {/* Group transactions by month, then aggregate messages by day */}
                {(() => {
                  // Include transactions with amount != 0 OR plan change transactions
                  const filteredTx = transactions.filter(tx => tx.amount !== 0 || tx.type === "UPGRADE_FEE" || tx.type === "MONTHLY_FEE")
                  
                  // Types that should be aggregated by day AND channel - only 2 types!
                  const AGGREGATABLE_TYPES = ["MESSAGE", "PUSH_CAMPAIGN"]
                  
                  const aggregateTransactionsByDay = (txList: Transaction[]) => {
                    // Group by type+day+channel: { "MESSAGE-2025-11-27-workspace123": {...} }
                    const groupedByTypeDayChannel: Record<string, { 
                      type: string
                      workspaceName: string
                      count: number
                      totalAmount: number
                      lastDate: Date
                      lastBalance: number 
                    }> = {}
                    const otherTransactions: Transaction[] = []
                    
                    txList.forEach(tx => {
                      if (AGGREGATABLE_TYPES.includes(tx.type)) {
                        const dayKey = new Date(tx.createdAt).toISOString().split('T')[0]
                        const groupKey = `${tx.type}-${dayKey}-${tx.workspaceId || 'unknown'}`
                        const txDate = new Date(tx.createdAt)
                        if (!groupedByTypeDayChannel[groupKey]) {
                          groupedByTypeDayChannel[groupKey] = { 
                            type: tx.type,
                            workspaceName: tx.workspaceName || 'Unknown',
                            count: 0, 
                            totalAmount: 0, 
                            lastDate: txDate, 
                            lastBalance: tx.balanceAfter 
                          }
                        }
                        groupedByTypeDayChannel[groupKey].count++
                        groupedByTypeDayChannel[groupKey].totalAmount += tx.amount
                        // Keep the most recent time and its balance
                        if (txDate > groupedByTypeDayChannel[groupKey].lastDate) {
                          groupedByTypeDayChannel[groupKey].lastDate = txDate
                          groupedByTypeDayChannel[groupKey].lastBalance = tx.balanceAfter
                        }
                      } else {
                        otherTransactions.push(tx)
                      }
                    })
                    
                    // Get description based on type, including channel name
                    const getAggregatedDescription = (type: string, count: number, channelName: string) => {
                      const channelSuffix = channelName ? ` (${channelName})` : ''
                      switch (type) {
                        case "MESSAGE":
                          return `${count} WhatsApp message${count > 1 ? 's' : ''}${channelSuffix}`
                        case "PUSH_CAMPAIGN":
                          return `${count} Push notification${count > 1 ? 's' : ''}${channelSuffix}`
                        default:
                          return `${count} ${type}${count > 1 ? 's' : ''}${channelSuffix}`
                      }
                    }
                    
                    // Convert aggregated items to pseudo-transactions
                    const aggregatedTransactions = Object.entries(groupedByTypeDayChannel).map(([groupKey, data]) => ({
                      id: `agg-${groupKey}`,
                      type: data.type as any,
                      amount: data.totalAmount,
                      description: getAggregatedDescription(data.type, data.count, data.workspaceName),
                      createdAt: data.lastDate.toISOString(),
                      balanceAfter: data.lastBalance,
                      workspaceId: '',
                      workspaceName: data.workspaceName,
                    }))
                    
                    // Combine and sort by date
                    return [...otherTransactions, ...aggregatedTransactions].sort(
                      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    )
                  }
                  
                  const grouped = filteredTx.reduce((acc, tx) => {
                    const date = new Date(tx.createdAt)
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                    const monthLabel = date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
                    if (!acc[monthKey]) {
                      acc[monthKey] = { label: monthLabel, transactions: [], income: 0, expenses: 0 }
                    }
                    acc[monthKey].transactions.push(tx)
                    // INITIAL_CREDIT is a gift - don't count as income
                    if (tx.amount > 0 && tx.type !== "INITIAL_CREDIT") {
                      acc[monthKey].income += tx.amount
                    } else if (tx.amount < 0) {
                      acc[monthKey].expenses += Math.abs(tx.amount)
                    }
                    return acc
                  }, {} as Record<string, { label: string; transactions: Transaction[]; income: number; expenses: number }>)

                  // Sort by date (newest first)
                  const sortedMonths = Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]))

                  return sortedMonths.map(([monthKey, data]) => {
                    // Aggregate transactions by day for this month
                    const displayTransactions = aggregateTransactionsByDay(data.transactions)
                    
                    return (
                    <div key={monthKey} className="border rounded-lg overflow-hidden">
                      {/* Month Header */}
                      <div className="bg-gray-50 px-4 py-3 border-b">
                        <h3 className="font-semibold text-lg capitalize">{data.label}</h3>
                      </div>

                      {/* Transactions Table */}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[130px]">Date</TableHead>
                            <TableHead className="w-[200px]">Type</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right w-[100px]"></TableHead>
                            <TableHead className="text-right w-[100px]"></TableHead>
                            <TableHead className="text-right w-[100px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayTransactions.map((tx) => {
                            const typeInfo = getTransactionTypeInfo(tx.type)
                            return (
                              <TableRow key={tx.id}>
                                <TableCell className="whitespace-nowrap text-sm">
                                  {new Date(tx.createdAt).toLocaleDateString("en-US", {
                                    day: "2-digit",
                                    month: "short",
                                  })}{" "}
                                  <span className="text-muted-foreground">
                                    {new Date(tx.createdAt).toLocaleTimeString("en-US", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: false,
                                    })}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="gap-1 text-xs">
                                    <span>{typeInfo.icon}</span>
                                    {typeInfo.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="max-w-[300px] truncate text-sm">
                                  {tx.description}
                                </TableCell>
                                <TableCell className="text-right font-medium text-emerald-600">
                                  {tx.amount > 0 && tx.type !== "INITIAL_CREDIT" ? `+${formatCurrency(tx.amount)}` : ""}
                                </TableCell>
                                <TableCell className="text-right font-medium text-red-600">
                                  {tx.amount < 0 ? `-${formatCurrency(Math.abs(tx.amount))}` : ""}
                                </TableCell>
                                <TableCell className="text-right text-sm font-medium">
                                  {tx.balanceAfter > 0 ? formatCurrency(tx.balanceAfter) : "—"}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )})
                })()}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowHistoryDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Monthly Invoices Dialog */}
      <Dialog open={showInvoicesDialog} onOpenChange={handleInvoicesDialogClose}>
        <DialogContent className="max-w-6xl h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Monthly Invoices
            </DialogTitle>
            <DialogDescription>
              Your monthly billing summary grouped by month
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoadingTransactions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  // Aggregate all transactions by month
                  const monthlyInvoices = transactions.reduce((acc, tx) => {
                    const date = new Date(tx.createdAt)
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                    const monthLabel = date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
                    
                    if (!acc[monthKey]) {
                      acc[monthKey] = {
                        label: monthLabel,
                        year: date.getFullYear(),
                        month: date.getMonth() + 1,
                        recharges: 0,
                        messages: 0,
                        messagesCount: 0,
                        pushNotifications: 0,
                        pushCount: 0,
                        subscriptionFee: 0,
                        otherExpenses: 0,
                      }
                    }
                    
                    // Categorize transactions
                    // INITIAL_CREDIT is a gift - don't count in invoices
                    if (tx.type === "RECHARGE") {
                      acc[monthKey].recharges += tx.amount
                    } else if (tx.type === "MESSAGE") {
                      acc[monthKey].messages += Math.abs(tx.amount)
                      acc[monthKey].messagesCount++
                    } else if (tx.type.startsWith("PUSH_") || tx.type === "PUSH_NOTIFICATION") {
                      acc[monthKey].pushNotifications += Math.abs(tx.amount)
                      acc[monthKey].pushCount++
                    } else if (tx.type === "MONTHLY_FEE" || tx.type === "UPGRADE_FEE") {
                      acc[monthKey].subscriptionFee += Math.abs(tx.amount)
                    } else if (tx.amount < 0) {
                      acc[monthKey].otherExpenses += Math.abs(tx.amount)
                    }
                    
                    return acc
                  }, {} as Record<string, {
                    label: string
                    year: number
                    month: number
                    recharges: number
                    messages: number
                    messagesCount: number
                    pushNotifications: number
                    pushCount: number
                    subscriptionFee: number
                    otherExpenses: number
                  }>)
                  
                  // Sort by date (newest first)
                  const sortedMonths = Object.entries(monthlyInvoices).sort((a, b) => b[0].localeCompare(a[0]))
                  
                  // 🔧 FIX: Filter out the current month - invoices only available for COMPLETED months
                  // An invoice is available from the 1st of the following month
                  const now = new Date()
                  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                  const completedMonths = sortedMonths.filter(([monthKey]) => monthKey < currentMonthKey)
                  
                  if (completedMonths.length === 0) {
                    return (
                      <div className="text-center py-12 text-muted-foreground">
                        <p>No invoices available yet</p>
                        <p className="text-sm mt-2">Invoices are generated at the end of each month</p>
                      </div>
                    )
                  }
                  
                  // Get current plan subscription fee
                  const currentPlanConfig = PLAN_CONFIGS[billing.planType as keyof typeof PLAN_CONFIGS]
                  const monthlySubscriptionFee = currentPlanConfig?.price || 0
                  
                  return completedMonths.map(([monthKey, data]) => {
                    const invoiceNumber = `INV-${data.year}${String(data.month).padStart(2, '0')}`
                    // Use recorded subscription fee from transactions OR current plan price
                    const subscriptionFee = data.subscriptionFee > 0 ? data.subscriptionFee : monthlySubscriptionFee
                    // Taxes 22% on (recharges + subscription fee)
                    const subtotal = data.recharges + subscriptionFee
                    const taxes = subtotal * 0.22
                    // Total = Recharges + Subscription Fee + Taxes
                    const totalWithTaxes = subtotal + taxes
                    
                    return (
                      <div key={monthKey} className="border rounded-lg overflow-hidden">
                        {/* Month Header */}
                        <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-lg capitalize">{data.label}</h3>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-muted-foreground font-mono">{invoiceNumber}</span>
                              {billing.nextBillingDate && (
                                <span className="text-sm text-muted-foreground">
                                  • Next Payment: {new Date(billing.nextBillingDate).toLocaleDateString("en-US", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric"
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                              toast.info(`Invoice ${invoiceNumber} - Coming soon`)
                            }}
                          >
                            <Download className="h-4 w-4" />
                            Download PDF
                          </Button>
                        </div>

                        {/* Invoice Details Table */}
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Description</TableHead>
                              <TableHead className="text-right w-[150px]">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {/* Recharges */}
                            {data.recharges > 0 && (
                              <TableRow>
                                <TableCell className="font-medium">💰 Credit Recharges</TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(data.recharges)}
                                </TableCell>
                              </TableRow>
                            )}
                            
                            {/* Subscription Fee - Always show current plan price */}
                            {subscriptionFee > 0 && (
                              <TableRow>
                                <TableCell className="font-medium">📋 Subscription Fee ({currentPlanConfig?.name || billing.planType})</TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(subscriptionFee)}
                                </TableCell>
                              </TableRow>
                            )}
                            
                            {/* Other Expenses */}
                            {data.otherExpenses > 0 && (
                              <TableRow>
                                <TableCell className="font-medium">📦 Other Charges</TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(data.otherExpenses)}
                                </TableCell>
                              </TableRow>
                            )}
                            
                            {/* Taxes */}
                            <TableRow>
                              <TableCell className="font-medium">Taxes (22% IVA)</TableCell>
                              <TableCell className="text-right font-medium text-emerald-600">
                                {taxes > 0 ? `+${formatCurrency(taxes)}` : '—'}
                              </TableCell>
                            </TableRow>
                            
                            {/* Grand Total */}
                            <TableRow className="bg-gray-50 font-bold">
                              <TableCell>Monthly Balance</TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(totalWithTaxes)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowInvoicesDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan Change Confirmation Dialog */}
      <Dialog open={showPlanConfirmDialog} onOpenChange={setShowPlanConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Plan Change
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to change your plan?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {pendingPlanChange && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Plan</p>
                    <p className="font-medium">{PLAN_CONFIGS[billing.planType as keyof typeof PLAN_CONFIGS]?.name || billing.planType}</p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">New Plan</p>
                    <p className="font-medium">{PLAN_CONFIGS[pendingPlanChange as keyof typeof PLAN_CONFIGS]?.name || pendingPlanChange}</p>
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>• The new plan will be applied immediately</p>
                  <p>• Your credit balance will remain unchanged</p>
                  <p>• Usage limits will be updated based on the new plan</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowPlanConfirmDialog(false)
                setPendingPlanChange(null)
              }}
              disabled={isUpgrading}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmPlanChange}
              disabled={isUpgrading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isUpgrading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing...
                </>
              ) : (
                "Yes, Change Plan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default BillingSection
