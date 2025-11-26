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
  upgradePlan,
  getBillingOverview,
  Transaction,
  PlanType,
  BillingOverview,
} from "@/services/subscriptionBillingApi"
import { toast } from "@/lib/toast"
import {
  CreditCard,
  TrendingUp,
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
} from "lucide-react"

// ============================================================================
// TYPES
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

  // Load transactions when history dialog opens or filters change
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

  const handleUpgrade = async (newPlan: PlanType) => {
    if (!effectiveWorkspaceId) return

    setIsUpgrading(true)
    try {
      const result = await upgradePlan(effectiveWorkspaceId, newPlan as "BASIC" | "PREMIUM")

      toast.success(`Successfully upgraded to ${result.newPlan}!`)

      // Close dialog
      setShowUpgradeDialog(false)

      // Refresh overview to get new plan info
      await refreshOverview()
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "Failed to upgrade plan"
      toast.error(errorMessage)
    } finally {
      setIsUpgrading(false)
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
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Your Plan
              </CardTitle>
              <CardDescription>
                Manage your subscription and credit
              </CardDescription>
            </div>
            <Badge
              variant={getPlanBadgeVariant(billing.planType) as any}
              className="text-sm px-3 py-1"
            >
              {planConfig.displayName}
              {isTrialPlan &&
                billing.daysUntilTrialExpires !== null &&
                !billing.isTrialExpired && (
                  <span className="ml-1">
                    ({billing.daysUntilTrialExpires}d)
                  </span>
                )}
            </Badge>
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
              <span className="text-sm text-muted-foreground">
                Plan Details
              </span>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subscription:</span>
                  <span className="font-medium">
                    {planConfig.displayName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Message cost:</span>
                  <span className="font-medium">
                    {formatCurrency(limits.messageCost)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order cost:</span>
                  <span className="font-medium">
                    {formatCurrency(limits.orderCost)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Advertising cost:</span>
                  <span className="font-medium">
                    {formatCurrency(limits.pushCost)}
                  </span>
                </div>
                {billing.nextBillingDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Next renewal:
                    </span>
                    <span className="font-medium">
                      {new Date(billing.nextBillingDate).toLocaleDateString(
                        "en-US"
                      )}
                    </span>
                  </div>
                )}
              </div>
              {isSuperAdmin && billing.planType !== "ENTERPRISE" && (
                <Button
                  variant="outline"
                  onClick={() => setShowUpgradeDialog(true)}
                  className="w-full gap-2"
                >
                  <TrendingUp className="h-4 w-4" />
                  Upgrade Plan
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Usage Limits</CardTitle>
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

      {/* Transaction History Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => setShowHistoryDialog(true)}
          className="gap-2"
        >
          <History className="h-4 w-4" />
          Transaction History
        </Button>
      </div>

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

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Upgrade Plan</DialogTitle>
            <DialogDescription>
              Choose the plan that best suits your needs. The subscription
              will start in 30 days.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-3 py-4">
            {/* Basic Plan */}
            <Card
              className={`cursor-pointer transition-all ${
                billing.planType === "BASIC"
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/50"
              }`}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Basic
                  {billing.planType === "BASIC" && (
                    <Badge variant="secondary">Current</Badge>
                  )}
                </CardTitle>
                <div className="text-2xl font-bold">€29/month</div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>✓ 1 WhatsApp channel</div>
                <div>✓ 50 products</div>
                <div>✓ 50 customers</div>
                <div>✓ Multi-language support</div>
                <div>✓ Analytics dashboard</div>
                {billing.planType !== "BASIC" &&
                  billing.planType !== "PREMIUM" &&
                  billing.planType !== "ENTERPRISE" && (
                    <Button
                      className="w-full mt-4"
                      onClick={() => handleUpgrade("BASIC")}
                      disabled={isUpgrading}
                    >
                      {isUpgrading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Choose Basic"
                      )}
                    </Button>
                  )}
              </CardContent>
            </Card>

            {/* Premium Plan */}
            <Card
              className={`cursor-pointer transition-all ${
                billing.planType === "PREMIUM"
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/50"
              }`}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Premium
                  {billing.planType === "PREMIUM" && (
                    <Badge variant="secondary">Current</Badge>
                  )}
                </CardTitle>
                <div className="text-2xl font-bold">€59/month</div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>✓ 2 WhatsApp channels</div>
                <div>✓ 100 products</div>
                <div>✓ 100 customers</div>
                <div>✓ Multi-language support</div>
                <div>✓ Advanced analytics</div>
                <div>✓ Brand customization</div>
                <div>✓ Priority support</div>
                {billing.planType !== "PREMIUM" &&
                  billing.planType !== "ENTERPRISE" && (
                    <Button
                      className="w-full mt-4"
                      onClick={() => handleUpgrade("PREMIUM")}
                      disabled={isUpgrading}
                    >
                      {isUpgrading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Choose Premium"
                      )}
                    </Button>
                  )}
              </CardContent>
            </Card>

            {/* Enterprise Plan */}
            <Card
              className={`cursor-pointer transition-all ${
                billing.planType === "ENTERPRISE"
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/50"
              }`}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Enterprise
                  {billing.planType === "ENTERPRISE" && (
                    <Badge variant="secondary">Current</Badge>
                  )}
                </CardTitle>
                <div className="text-2xl font-bold">€199/month</div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>✓ Unlimited WhatsApp channels</div>
                <div>✓ Unlimited products</div>
                <div>✓ Unlimited customers</div>
                <div>✓ Multi-language support</div>
                <div>✓ Advanced analytics</div>
                <div>✓ Brand customization</div>
                <div>✓ Priority support</div>
                <div>✓ Dedicated account manager</div>
                <div>✓ Custom integrations</div>
                {billing.planType !== "ENTERPRISE" && (
                  <Button
                    className="w-full mt-4"
                    onClick={() => handleUpgrade("ENTERPRISE")}
                    disabled={isUpgrading}
                  >
                    {isUpgrading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Choose Enterprise"
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
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

            {/* Transaction count */}
            <div className="ml-auto text-sm text-muted-foreground">
              {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
            </div>
          </div>

          <div className="flex-1 overflow-auto min-h-[400px]">
            {isLoadingTransactions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No transactions found for the selected filters
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Date</TableHead>
                    <TableHead className="w-[120px]">Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right w-[100px]">Amount</TableHead>
                    <TableHead className="text-right w-[100px]">Balance</TableHead>
                    <TableHead className="text-center w-[80px]">Invoice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => {
                    const typeInfo = getTransactionTypeInfo(tx.type)
                    const isRecharge = tx.type === "RECHARGE"
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
                        <TableCell className="text-center">
                          {isRecharge ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                toast.info("Invoice download coming soon")
                              }}
                            >
                              <Download className="h-4 w-4 text-muted-foreground hover:text-primary" />
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
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
    </div>
  )
}

export default BillingSection
