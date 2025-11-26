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
import {
  formatCurrency,
  getTransactionTypeInfo,
  rechargeCredit,
  getTransactions,
  changePlan,
  getBillingOverview,
  Transaction,
  PlanType,
  BillingOverview,
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
  Calendar,
  Filter,
  Check,
  X,
  FileText,
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
}

export function BillingSection({ workspaceId: propWorkspaceId }: BillingSectionProps) {
  const { workspace } = useWorkspace()
  // Use prop workspaceId if provided, otherwise fall back to context workspace
  const effectiveWorkspaceId = propWorkspaceId || workspace?.id
  const { isSuperAdmin } = useWorkspaceRole(effectiveWorkspaceId)
  
  // Use context billing if no prop workspaceId, otherwise use local state
  const contextBilling = useBilling()
  
  // Local billing state (used when workspaceId prop is provided)
  const [localBillingOverview, setLocalBillingOverview] = useState<BillingOverview | null>(null)
  const [localIsLoading, setLocalIsLoading] = useState(false)
  
  // Determine which billing data to use
  const billingOverview = propWorkspaceId ? localBillingOverview : contextBilling.billingOverview
  const isLoadingOverview = propWorkspaceId ? localIsLoading : contextBilling.isLoadingOverview

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
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
  
  // Transaction history filters
  const [dateFilter, setDateFilter] = useState<"week" | "month" | "3months" | "all">("month")
  const [typeFilter, setTypeFilter] = useState<string>("all")

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

  // Update balance locally
  const updateBalanceLocally = (newBalance: number) => {
    if (propWorkspaceId && localBillingOverview) {
      setLocalBillingOverview({
        ...localBillingOverview,
        billing: { ...localBillingOverview.billing, creditBalance: newBalance }
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

  // 🔄 Load transactions on component mount (for totals display)
  useEffect(() => {
    if (effectiveWorkspaceId && transactions.length === 0) {
      loadTransactions()
    }
  }, [effectiveWorkspaceId])

  // Reload transactions when history dialog opens or filters change
  useEffect(() => {
    if (showHistoryDialog && effectiveWorkspaceId) {
      loadTransactions()
    }
  }, [showHistoryDialog, effectiveWorkspaceId, dateFilter, typeFilter])

  const getDateRange = () => {
    const now = new Date()
    // Add 1 day to include all of today's transactions
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const endDate = tomorrow.toISOString().split('T')[0]
    let startDate: string | undefined
    
    switch (dateFilter) {
      case "week":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        startDate = weekAgo.toISOString().split('T')[0]
        break
      case "month":
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        startDate = monthAgo.toISOString().split('T')[0]
        break
      case "3months":
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
        startDate = threeMonthsAgo.toISOString().split('T')[0]
        break
      case "all":
      default:
        startDate = undefined
    }
    
    return { startDate, endDate }
  }

  const loadTransactions = async () => {
    if (!effectiveWorkspaceId) return

    setIsLoadingTransactions(true)
    try {
      const { startDate, endDate } = getDateRange()
      console.log('[BillingSection] Loading transactions:', { 
        workspaceId: effectiveWorkspaceId, 
        startDate, 
        endDate, 
        typeFilter 
      })
      const data = await getTransactions(effectiveWorkspaceId, { 
        limit: 50,
        startDate,
        endDate,
        type: typeFilter !== "all" ? typeFilter as any : undefined
      })
      console.log('[BillingSection] Loaded transactions:', data.transactions.length)
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

      // Update local balance
      updateBalanceLocally(result.newBalance)

      // Close dialog and reset
      setShowRechargeDialog(false)
      setCustomAmount("")
      setRechargeAmount(25)

      // Refresh full overview
      await refreshOverview()
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

      // Refresh overview to get new plan info
      await refreshOverview()
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
                Subscription & Billing
              </CardTitle>
              <CardDescription>
                Manage your subscription and credit
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistoryDialog(true)}
                className="gap-1 text-muted-foreground hover:text-foreground"
              >
                <History className="h-4 w-4" />
                History
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInvoicesDialog(true)}
                className="gap-1 text-muted-foreground hover:text-foreground"
              >
                <FileText className="h-4 w-4" />
                Invoices
              </Button>
              {isSuperAdmin && billing.planType !== "FREE_TRIAL" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUpgradeDialog(true)}
                  className="gap-1 text-muted-foreground hover:text-foreground"
                >
                  <TrendingUp className="h-4 w-4" />
                  Change Plan
                </Button>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border border-emerald-200 dark:border-emerald-800 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  {planConfig.displayName}
                  {isTrialPlan &&
                    billing.daysUntilTrialExpires !== null &&
                    !billing.isTrialExpired && (
                      <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                        ({billing.daysUntilTrialExpires}d)
                      </span>
                    )}
                </span>
              </div>
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
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
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">
                  {formatCurrency(billing.creditBalance)}
                </span>
              </div>
              {isSuperAdmin && (
                <Button
                  onClick={() => setShowRechargeDialog(true)}
                  className="w-full gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Recharge Credit
                </Button>
              )}
            </div>

            {/* Plan Details */}
            <div className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subscription:</span>
                  <span className="font-medium text-emerald-600">
                    {formatCurrency(planConfig.monthlyFee)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total recharges:</span>
                  <span className="font-medium text-emerald-600">
                    {formatCurrency(
                      transactions
                        .filter(tx => tx.type === 'RECHARGE' && tx.amount > 0)
                        .reduce((sum, tx) => sum + tx.amount, 0)
                    )}
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
                          planConfig.monthlyFee +
                          transactions
                            .filter(tx => tx.type === 'RECHARGE' && tx.amount > 0)
                            .reduce((sum, tx) => sum + tx.amount, 0)
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

      {/* Usage Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <TrendingUp className="h-5 w-5" />
            Usage Limits
          </CardTitle>
          <CardDescription>
            Current usage of your {planConfig.displayName} plan. Upgrade to increase limits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <div className="grid gap-6 md:grid-cols-3">
              {/* Products */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span>Products</span>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Maximum products you can create.</p>
                        <p className="text-xs text-muted-foreground">
                          When limit is reached, you cannot add new products.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className={`font-medium ${usage.productsPercentage >= 100 ? "text-red-600" : ""}`}>
                    {usage.productsCount}/{limits.maxProducts}
                  </span>
                </div>
                <Progress
                  value={usage.productsPercentage}
                  className={`h-2 ${getUsageColor(usage.productsPercentage)}`}
                />
                {usage.productsPercentage >= 90 && (
                  <p className="text-xs text-amber-600">
                    {usage.productsPercentage >= 100 
                      ? "⚠️ Limit reached - upgrade to add more" 
                      : "Approaching limit"}
                  </p>
                )}
              </div>

              {/* Customers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>Customers</span>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Maximum customers in your CRM.</p>
                        <p className="text-xs text-muted-foreground">
                          When limit is reached, new customers cannot be added.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className={`font-medium ${usage.customersPercentage >= 100 ? "text-red-600" : ""}`}>
                    {usage.customersCount}/{limits.maxCustomers}
                  </span>
                </div>
                <Progress
                  value={usage.customersPercentage}
                  className={`h-2 ${getUsageColor(usage.customersPercentage)}`}
                />
                {usage.customersPercentage >= 90 && (
                  <p className="text-xs text-amber-600">
                    {usage.customersPercentage >= 100 
                      ? "⚠️ Limit reached - upgrade to add more" 
                      : "Approaching limit"}
                  </p>
                )}
              </div>

              {/* Channels */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-muted-foreground" />
                    <span>WhatsApp Channels</span>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>WhatsApp phone numbers connected.</p>
                        <p className="text-xs text-muted-foreground">
                          Premium: 2 channels, Enterprise: unlimited.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className={`font-medium ${usage.channelsPercentage >= 100 ? "text-red-600" : ""}`}>
                    {usage.channelsCount}/{limits.maxChannels}
                  </span>
                </div>
                <Progress
                  value={usage.channelsPercentage}
                  className={`h-2 ${getUsageColor(usage.channelsPercentage)}`}
                />
                {usage.channelsPercentage >= 100 && (
                  <p className="text-xs text-amber-600">
                    ⚠️ Limit reached - upgrade to add more channels
                  </p>
                )}
              </div>
            </div>
          </TooltipProvider>
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
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Change Plan</DialogTitle>
            <DialogDescription>
              Choose the plan that best suits your needs. The subscription
              will start in 30 days.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 md:grid-cols-3 py-4">
            {/* Render plans dynamically from PLAN_CONFIGS */}
            {(["BASIC", "PREMIUM", "ENTERPRISE"] as const).map((planKey) => {
              const planConfig = PLAN_CONFIGS[planKey]
              const isCurrentPlan = billing.planType === planKey
              const isDowngrade = PLAN_ORDER[billing.planType] > PLAN_ORDER[planKey]
              const downgradeCheck = isDowngrade ? checkCanDowngrade(usage, planKey) : { canDowngrade: true, reasons: [] }
              const canSelect = !isCurrentPlan && (isDowngrade ? downgradeCheck.canDowngrade : true)
              const features = getPlanFeaturesWithText(planKey)
              
              return (
                <div
                  key={planKey}
                  className={`relative rounded-2xl border-2 p-6 flex flex-col ${
                    isCurrentPlan
                      ? "border-blue-500 bg-gradient-to-br from-blue-50 to-green-50 shadow-xl"
                      : "border-gray-200 bg-white hover:border-blue-300 transition-all"
                  }`}
                >
                  {isCurrentPlan && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500">
                      Current Plan
                    </Badge>
                  )}
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{planConfig.name}</h3>
                    <div className="mb-2">
                      <span className="text-3xl font-bold text-gray-900">{planConfig.priceLabel}</span>
                      <span className="text-gray-600">/month</span>
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
        </DialogContent>
      </Dialog>

      {/* Transaction History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Transaction History
            </DialogTitle>
            <DialogDescription>
              View and filter your account transactions
            </DialogDescription>
          </DialogHeader>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 py-3 border-b">
            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="border rounded-md px-3 py-1.5 text-sm bg-background"
              >
                <option value="week">Last 7 days</option>
                <option value="month">Last month</option>
                <option value="3months">Last 3 months</option>
                <option value="all">All time</option>
              </select>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border rounded-md px-3 py-1.5 text-sm bg-background"
              >
                <option value="all">All types</option>
                <option value="MESSAGE">Messages</option>
                <option value="PUSH_NOTIFICATION">Push Notifications</option>
              </select>
            </div>

            {/* Transaction count - filter out 0€ transactions */}
            <div className="ml-auto text-sm text-muted-foreground">
              {transactions.filter(tx => tx.amount !== 0).length} transaction{transactions.filter(tx => tx.amount !== 0).length !== 1 ? "s" : ""}
            </div>
          </div>

          <div className="flex-1 overflow-auto min-h-[400px]">
            {isLoadingTransactions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.filter(tx => tx.amount !== 0).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No transactions found for the selected filters
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Date</TableHead>
                    <TableHead className="w-[140px]">Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right w-[100px]">Amount</TableHead>
                    <TableHead className="text-right w-[100px]">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.filter(tx => tx.amount !== 0).map((tx) => {
                    const typeInfo = getTransactionTypeInfo(tx.type)
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(tx.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
                        <TableCell
                          className={`text-right font-medium ${
                            tx.amount < 0 ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {tx.amount > 0 ? "+" : ""}
                          {formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(tx.balanceAfter)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
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
      <Dialog open={showInvoicesDialog} onOpenChange={setShowInvoicesDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Monthly Invoices
            </DialogTitle>
            <DialogDescription>
              Download your monthly billing invoices
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  // Generate monthly invoices from transactions
                  const monthlyData = transactions.reduce((acc, tx) => {
                    // Only count deductions (MESSAGE, PUSH_NOTIFICATION)
                    if (tx.amount >= 0) return acc
                    
                    const date = new Date(tx.createdAt)
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                    
                    if (!acc[monthKey]) {
                      acc[monthKey] = {
                        period: monthKey,
                        totalAmount: 0,
                      }
                    }
                    
                    acc[monthKey].totalAmount += Math.abs(tx.amount)
                    
                    return acc
                  }, {} as Record<string, { period: string; totalAmount: number }>)
                  
                  const sortedMonths = Object.values(monthlyData).sort((a, b) => 
                    b.period.localeCompare(a.period)
                  )
                  
                  if (sortedMonths.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No invoices available yet. Invoices are generated based on your usage.
                        </TableCell>
                      </TableRow>
                    )
                  }
                  
                  return sortedMonths.map((month, index) => {
                    const [year, monthNum] = month.period.split('-')
                    const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('en-US', { 
                      month: 'long' 
                    })
                    const invoiceNumber = `INV-${year}${monthNum}`
                    
                    return (
                      <TableRow key={month.period}>
                        <TableCell className="font-mono text-sm">{invoiceNumber}</TableCell>
                        <TableCell className="font-medium">{monthName} {year}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(month.totalAmount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              toast.info(`Invoice ${invoiceNumber} - Coming soon`)
                            }}
                          >
                            <Download className="h-4 w-4 text-muted-foreground hover:text-primary" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                })()}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
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
