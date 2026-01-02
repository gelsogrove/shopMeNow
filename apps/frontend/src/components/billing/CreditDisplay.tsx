/**
 * Credit Display Component
 * Feature 185: Subscription & Billing System
 *
 * Displays in header:
 * - Current credit balance
 * - Low balance warning (if < $6)
 * - Trial badge with days remaining
 * - Clickable to navigate to billing page
 */

import { AlertTriangle, CreditCard, Clock } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useBilling } from "@/contexts/BillingContext"
import { useLanguage } from "@/contexts/LanguageContext"
import { formatCurrency } from "@/services/subscriptionBillingApi"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface CreditDisplayProps {
  className?: string
  showPlanBadge?: boolean
}

export function CreditDisplay({ className, showPlanBadge = true }: CreditDisplayProps) {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const {
    creditBalance,
    isLowBalance,
    isTrialPlan,
    trialDaysRemaining,
    isTrialExpired,
    planType,
    isLoadingBalance,
  } = useBilling()

  // Don't render if still loading initial data
  if (isLoadingBalance && creditBalance === 0) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <CreditCard className="h-4 w-4 animate-pulse" />
        <span>...</span>
      </div>
    )
  }

  const getPlanDisplayName = () => {
    if (!planType) return ""
    const names: Record<string, string> = {
      FREE_TRIAL: "Trial",
      BASIC: "Basic",
      PREMIUM: "Premium",
      ENTERPRISE: "Enterprise",
    }
    return names[planType] || planType
  }

  const getBadgeVariant = () => {
    if (!planType) return "secondary"
    if (planType === "FREE_TRIAL") return isTrialExpired ? "destructive" : "warning"
    if (planType === "PREMIUM") return "default"
    if (planType === "ENTERPRISE") return "default"
    return "secondary"
  }

  const handleClick = () => {
    navigate("/billing")
  }

  return (
    <TooltipProvider>
      <div 
        className={cn("flex items-center gap-3 cursor-pointer", className)}
        onClick={handleClick}
      >
        {/* Plan Badge */}
        {showPlanBadge && planType && (
          <Badge 
            variant={getBadgeVariant() as any}
            className={cn(
              "text-xs font-medium",
              planType === "PREMIUM" && "bg-purple-500 hover:bg-purple-600",
              planType === "ENTERPRISE" && "bg-indigo-600 hover:bg-indigo-700"
            )}
          >
            {getPlanDisplayName()}
            {isTrialPlan && trialDaysRemaining !== null && !isTrialExpired && (
              <span className="ml-1">
                ({trialDaysRemaining}d)
              </span>
            )}
          </Badge>
        )}

        {/* Credit Balance */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium transition-colors hover:opacity-80",
                isLowBalance
                  ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
              )}
            >
              {isLowBalance ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              <span>{formatCurrency(creditBalance)}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{t("billing.availableCredit")}</p>
              {isLowBalance && (
                <p className="text-sm text-amber-600">
                  ⚠️ {t("billing.lowCreditWarning")}
                </p>
              )}
              {isTrialPlan && !isTrialExpired && trialDaysRemaining !== null && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {trialDaysRemaining} {t("billing.daysRemaining")}
                </p>
              )}
              {isTrialExpired && (
                <p className="text-sm text-red-600">
                  ⛔ {t("billing.trialExpiredWarning")}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {t("billing.clickToManage")}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Trial Expired Warning */}
        {isTrialExpired && (
          <Badge variant="destructive" className="text-xs animate-pulse">
            {t("billing.trialExpired")}
          </Badge>
        )}
      </div>
    </TooltipProvider>
  )
}

export default CreditDisplay
