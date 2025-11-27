/**
 * Usage Limits Card Component
 * Feature 185: Subscription & Billing System
 *
 * Displays usage limits for:
 * - Products (count / max)
 * - Customers (count / max)
 * - Channels (count / max)
 */

import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getBillingOverview, BillingOverview } from "@/services/subscriptionBillingApi"
import { Package, Users, Radio, Loader2 } from "lucide-react"

interface UsageLimitsCardProps {
  workspaceId: string
}

export function UsageLimitsCard({ workspaceId }: UsageLimitsCardProps) {
  const [billingOverview, setBillingOverview] = useState<BillingOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getBillingOverview(workspaceId)
        setBillingOverview(data)
      } catch (error) {
        console.error("Failed to load billing overview:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [workspaceId])

  if (isLoading || !billingOverview) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  const { usage, limits } = billingOverview

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500"
    if (percentage >= 75) return "bg-amber-500"
    return "bg-emerald-500"
  }

  const usageItems = [
    {
      icon: Package,
      label: "Products",
      count: usage.productsCount,
      max: limits.maxProducts,
      percentage: usage.productsPercentage,
    },
    {
      icon: Users,
      label: "Customers",
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
  ]

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium text-green-600">
          Usage Limits
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
              <span className="font-medium">
                {item.count} / {item.max}
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div 
                className={`h-full transition-all ${getProgressColor(item.percentage)}`}
                style={{ width: `${Math.min(item.percentage, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
