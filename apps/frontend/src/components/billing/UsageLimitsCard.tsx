/**
 * Usage Limits Card Component
 * Feature 185: Subscription & Billing System
 *
 * Displays usage limits for:
 * - Products (count / max)
 * - Customers (count / max)
 * - Channels (count / max)
 * 
 * OPTIMIZED: Receives billingOverview as prop to avoid duplicate API calls
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PLAN_CONFIGS } from "@/config/planFeatures"
import { BillingOverview } from "@/services/subscriptionBillingApi"
import { Users, Radio, Loader2, Users2 } from "lucide-react"

interface UsageLimitsCardProps {
  workspaceId: string
  billingOverview?: BillingOverview | null
  isLoading?: boolean
}

export function UsageLimitsCard({ billingOverview, isLoading = false }: UsageLimitsCardProps) {
  if (isLoading || !billingOverview) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  const { usage, limits, billing, planConfig } = billingOverview

  const planName =
    planConfig?.displayName ||
    PLAN_CONFIGS[billing.planType as keyof typeof PLAN_CONFIGS]?.name ||
    billing.planType
  const usageTitle = planName ? `${planName} Usage Limits` : "Usage Limits"

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500"
    if (percentage >= 75) return "bg-amber-500"
    return "bg-emerald-500"
  }

  const usageItems = [
    {
      icon: Users,
      label: "Customers/Leads",
      count: usage.customersCount,
      max: limits.maxCustomers,
      percentage: usage.customersPercentage,
    },
    {
      icon: Radio,
      label: "Channels",
      count: usage.channelsCount,
      max: limits.maxChannels,
      percentage: usage.channelsPercentage,
    },
    {
      icon: Users2,
      label: "Team Members",
      count: usage.teamMembersCount,
      max: limits.maxTeamMembers,
      percentage: usage.teamMembersPercentage,
    },
  ]

  // Helper to format limit display (∞ for unlimited plans)
  const formatLimit = (limit: number | null): string => {
    if (limit === null || limit >= 999) return "∞"
    return limit.toString()
  }
  const getDisplayPercentage = (
    count: number,
    limit: number | null,
    percentage: number
  ): number => {
    if (limit === null || limit >= 999) {
      return Math.min(100, Math.max(4, Math.round(count)))
    }
    return percentage
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium text-green-600">
          {usageTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {usageItems.map((item) => (
          <div key={item.label} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
              </div>
              <span className="font-semibold text-lg">
                {item.count} / {formatLimit(item.max)}
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
              {(() => {
                const displayPercentage = getDisplayPercentage(
                  item.count,
                  item.max,
                  item.percentage
                )
                return (
              <div 
                    className={`h-full transition-all ${getProgressColor(displayPercentage)}`}
                    style={{ width: `${Math.min(displayPercentage, 100)}%` }}
              />
                )
              })()}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
