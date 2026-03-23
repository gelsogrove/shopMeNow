import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardAnalytics } from "@/services/analyticsApi"
import {
  Euro,
  Minus,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react"
import React from "react"
import { getAdminPageTexts } from "../../utils/adminPageTranslations"

interface MetricsOverviewProps {
  analytics: DashboardAnalytics
  previousPeriodAnalytics?: DashboardAnalytics
}

interface MetricCardProps {
  title: string
  value: number
  icon: React.ReactNode
  formatter: (value: number) => string
  trend?: number
  description?: string
  t: any // Add translations prop
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  formatter,
  trend,
  description,
  t,
}) => {
  const getTrendIcon = () => {
    if (trend === undefined || trend === 0) return <Minus className="h-3 w-3" />
    return trend > 0 ? (
      <TrendingUp className="h-3 w-3" />
    ) : (
      <TrendingDown className="h-3 w-3" />
    )
  }

  const getTrendColor = () => {
    if (trend === undefined || trend === 0) return "text-gray-500"
    return trend > 0 ? "text-green-600" : "text-red-600"
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="flex-1">
        <div className="text-2xl font-bold">{formatter(value)}</div>
        {trend !== undefined && (
          <div
            className={`flex items-center space-x-1 text-xs ${getTrendColor()}`}
          >
            {getTrendIcon()}
            <span>
              {Math.abs(trend).toFixed(1)}%
              {trend > 0
                ? ` ${t.increase}`
                : trend < 0
                ? ` ${t.decrease}`
                : ` ${t.unchanged}`}
            </span>
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({
  analytics,
  previousPeriodAnalytics,
}) => {
  // Get translations
  const t = getAdminPageTexts()

  // Calculate trends if previous period data is available
  const calculateTrend = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatNumber = (value: number): string => {
    return new Intl.NumberFormat("it-IT").format(value)
  }

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`
  }

  const formatUsageCost = (value: number): string => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  // Calculate conversion rate and revenue per order
  const conversionRate = analytics.overview.totalCustomers > 0 
    ? (analytics.overview.totalOrders / analytics.overview.totalCustomers) * 100 
    : 0
  
  const revenuePerOrder = analytics.overview.totalOrders > 0
    ? analytics.overview.totalRevenue / analytics.overview.totalOrders
    : 0

  const metrics = [
    {
      title: t.totalRevenue,
      value: analytics.overview.totalRevenue,
      icon: <Euro className="h-4 w-4 text-green-600" />,
      formatter: formatCurrency,
      trend: previousPeriodAnalytics
        ? calculateTrend(
            analytics.overview.totalRevenue,
            previousPeriodAnalytics.overview.totalRevenue
          )
        : undefined,
      description: t.totalRevenueDesc || "Total sales revenue",
    },
    {
      title: t.totalOrders,
      value: analytics.overview.totalOrders,
      icon: <ShoppingCart className="h-4 w-4 text-blue-600" />,
      formatter: formatNumber,
      trend: previousPeriodAnalytics
        ? calculateTrend(
            analytics.overview.totalOrders,
            previousPeriodAnalytics.overview.totalOrders
          )
        : undefined,
      description: t.totalOrdersDesc,
    },
    {
      title: t.clients,
      value: analytics.overview.totalCustomers,
      icon: <Users className="h-4 w-4 text-purple-600" />,
      formatter: formatNumber,
      trend: previousPeriodAnalytics
        ? calculateTrend(
            analytics.overview.totalCustomers,
            previousPeriodAnalytics.overview.totalCustomers
          )
        : undefined,
      description: t.activeClientsDesc,
    },
    {
      title: "Conversione",
      value: conversionRate,
      icon: <TrendingUp className="h-4 w-4 text-emerald-600" />,
      formatter: formatPercentage,
      trend: undefined,
      description: "Ordini per cliente",
    },
    {
      title: "Valore Medio Ordine",
      value: revenuePerOrder,
      icon: <Euro className="h-4 w-4 text-amber-600" />,
      formatter: formatCurrency,
      trend: previousPeriodAnalytics
        ? calculateTrend(
            analytics.overview.averageOrderValue,
            previousPeriodAnalytics.overview.averageOrderValue
          )
        : undefined,
      description: "Revenue / ordini",
    },
    {
      title: "Costo LLM",
      value: analytics.overview.usageCost,
      icon: <Euro className="h-4 w-4 text-orange-500" />,
      formatter: formatUsageCost,
      trend: previousPeriodAnalytics
        ? calculateTrend(
            analytics.overview.usageCost,
            previousPeriodAnalytics.overview.usageCost
          )
        : undefined,
      description: "Costi AI messaggi",
    },
  ]

  // Engagement metrics removed as requested by Andrea

  return (
    <div className="space-y-6">
      {/* Main Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-4">{t.mainMetrics}</h3>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.title}
              title={metric.title}
              value={metric.value}
              icon={metric.icon}
              formatter={metric.formatter}
              trend={metric.trend}
              description={metric.description}
              t={t}
            />
          ))}
        </div>
      </div>

      {/* Engagement Metrics section removed as requested by Andrea */}
    </div>
  )
}
