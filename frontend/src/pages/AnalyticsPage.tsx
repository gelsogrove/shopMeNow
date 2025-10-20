import { BillingTab } from "@/components/analytics/BillingTab"
import DateRangeSelector, {
  PeriodPreset,
  getDateRangeFromPeriod,
} from "@/components/analytics/DateRangeSelector"
import { HistoricalChart } from "@/components/analytics/HistoricalChart"
import { MetricsOverview } from "@/components/analytics/MetricsOverview"
import { PricingList } from "@/components/analytics/PricingList"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useWorkspace } from "@/hooks/use-workspace"
import { useAnalyticsPeriod } from "@/hooks/useAnalyticsPeriod"
import { logger } from "@/lib/logger"
import {
  AnalyticsResponse,
  DashboardAnalytics,
  getDashboardAnalytics,
} from "@/services/analyticsApi"
import { getAdminPageTexts } from "@/utils/adminPageTranslations"
import {
  Activity,
  AlertCircle,
  BarChart3,
  Euro,
  TrendingUp,
  Users,
} from "lucide-react"
import { useEffect, useState } from "react"

export function AnalyticsPage() {
  const { workspace: currentWorkspace } = useWorkspace()
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { selectedPeriod, setSelectedPeriod, isInitialized } =
    useAnalyticsPeriod()
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("all")
  const [activeTab, setActiveTab] = useState<
    "analytics" | "billing" | "pricing"
  >("analytics")

  // Get translations
  const t = getAdminPageTexts()

  // Dynamic page title based on active tab
  const pageTitle =
    activeTab === "analytics"
      ? t.analyticsTitle
      : activeTab === "billing"
      ? "Billing"
      : "Pricing"

  const pageSubtitle =
    activeTab === "analytics"
      ? t.analyticsSubtitle
      : activeTab === "billing"
      ? "Monthly billing breakdown and cost tracking"
      : "Transparent pricing for all ShopMe services"

  const loadAnalytics = async (period: PeriodPreset) => {
    if (!currentWorkspace?.id) return

    try {
      setLoading(true)
      setError(null)

      const dateRange = getDateRangeFromPeriod(period)
      const response: AnalyticsResponse = await getDashboardAnalytics(
        currentWorkspace.id,
        dateRange
      )

      if (response.success) {
        setAnalytics(response.data)
      } else {
        setError(t.loadingError)
      }
    } catch (err) {
      logger.error("Analytics loading error:", err)
      setError(t.dataError)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isInitialized) {
      loadAnalytics(selectedPeriod)
    }
  }, [currentWorkspace?.id, selectedPeriod, isInitialized])

  const handlePeriodChange = (period: PeriodPreset) => {
    setSelectedPeriod(period)
  }

  const handleRetry = () => {
    loadAnalytics(selectedPeriod)
  }

  if (!currentWorkspace) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">{t.noWorkspace}</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={handleRetry} variant="outline">
              {t.retry}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-blue-600" />
              {pageTitle}
            </h1>
          </div>
          <p className="text-gray-600 mt-1">{pageSubtitle}</p>
        </div>

        {/* Period Selector - Only show for Analytics tab */}
        {activeTab === "analytics" && (
          <DateRangeSelector
            selectedPeriod={selectedPeriod}
            onPeriodChange={handlePeriodChange}
          />
        )}
      </div>

      {loading ? (
        // Loading State
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      ) : analytics ? (
        // Data Loaded - Now with Tabs
        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as "analytics" | "billing" | "pricing")
          }
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2">
              <Euro className="h-4 w-4" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="pricing" className="flex items-center gap-2">
              <Euro className="h-4 w-4" />
              Pricing
            </TabsTrigger>
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Metrics Overview */}
            <MetricsOverview analytics={analytics} />

            {/* Historical Chart (include Top Searched Products affiancato a Distribuzione Categorie) */}
            <HistoricalChart
              analytics={analytics}
              period={selectedPeriod}
              loading={loading}
            />

            {/* Additional Analytics Cards - All in one row (3 columns) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Top Products */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    {t.topProducts}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.topProducts && analytics.topProducts.length > 0 ? (
                    <div className="space-y-3">
                      {analytics.topProducts.map((product, index) => (
                        <div
                          key={product.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-xs font-bold text-green-700">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {product.name}
                              </p>
                              {product.formato && (
                                <p className="text-sm text-blue-600 font-medium">
                                  {t.format}: {product.formato}
                                </p>
                              )}
                              <p className="text-sm text-gray-500">
                                {product.totalSold} {t.sold}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">
                              {new Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: "EUR",
                                minimumFractionDigits: 0,
                              }).format(product.revenue)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {t.stock}: {product.stock}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <TrendingUp className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">{t.noProductData}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Customers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    {t.topCustomers}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.topCustomers &&
                  analytics.topCustomers.length > 0 ? (
                    <div className="space-y-3">
                      {analytics.topCustomers.map((customer, index) => (
                        <div
                          key={customer.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-700">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {customer.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {customer.email}
                              </p>
                              {customer.company && (
                                <p className="text-xs text-gray-400">
                                  {customer.company}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-blue-600">
                              {new Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: "EUR",
                                minimumFractionDigits: 0,
                              }).format(customer.totalSpent)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {customer.totalOrders} {t.orders}
                            </p>
                            <p className="text-xs text-gray-400">
                              {t.average}:{" "}
                              {new Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: "EUR",
                                minimumFractionDigits: 0,
                              }).format(customer.averageOrderValue)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Activity className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">{t.noCustomerData}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Sellers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    {t.topSellers}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.topSellers && analytics.topSellers.length > 0 ? (
                    <div className="space-y-3">
                      {analytics.topSellers.map((seller, index) => (
                        <div
                          key={seller.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-700">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {seller.firstName} {seller.lastName}
                              </p>
                              <p className="text-sm text-gray-500">
                                {seller.email}
                              </p>
                              {seller.phone && (
                                <p className="text-xs text-gray-400">
                                  {seller.phone}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-purple-600">
                              {new Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: "EUR",
                                minimumFractionDigits: 0,
                              }).format(seller.totalRevenue)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {seller.totalOrders} {t.orders}
                            </p>
                            <p className="text-xs text-gray-400">
                              {seller.totalCustomers} {t.clients}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">{t.noSellerData}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Pricing List - Moved to top 
          <PricingList />*/}

            {/* System Logs - Full Width 
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  📋 System Logs
                </CardTitle>
                {analytics.logs &&
                  analytics.logs.length > 0 &&
                  (() => {
                    // Extract unique customers
                    const uniqueCustomers = Array.from(
                      new Map(
                        analytics.logs
                          .filter((log) => log.customerId && log.customerName)
                          .map((log) => [
                            log.customerId,
                            {
                              id: log.customerId!,
                              name: log.customerName!,
                              email: log.customerEmail!,
                            },
                          ])
                      ).values()
                    )

                    return (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          Filter by customer:
                        </span>
                        <select
                          value={selectedCustomerId}
                          onChange={(e) =>
                            setSelectedCustomerId(e.target.value)
                          }
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                          <option value="all">
                            🌐 All customers ({analytics.logs.length})
                          </option>
                          {uniqueCustomers.map((customer) => {
                            const customerLogsCount = analytics.logs.filter(
                              (log) => log.customerId === customer.id
                            ).length
                            return (
                              <option key={customer.id} value={customer.id}>
                                👤 {customer.name} ({customerLogsCount})
                              </option>
                            )
                          })}
                        </select>
                      </div>
                    )
                  })()}
              </div>
            </CardHeader>
            <CardContent>
              {analytics.logs && analytics.logs.length > 0 ? (
                (() => {
                  // Filter logs based on selected customer
                  const filteredLogs =
                    selectedCustomerId === "all"
                      ? analytics.logs
                      : analytics.logs.filter(
                          (log) => log.customerId === selectedCustomerId
                        )

                  // Recalculate progressive totals for filtered logs
                  let logsWithRecalculatedTotals
                  if (selectedCustomerId === "all") {
                    // Use totals from backend (already calculated correctly)
                    logsWithRecalculatedTotals = filteredLogs
                  } else {
                    // For filtered customer, recalculate totals in chronological order
                    const sortedByDateAsc = [...filteredLogs].sort(
                      (a, b) =>
                        new Date(a.timestamp).getTime() -
                        new Date(b.timestamp).getTime()
                    )
                    let runningTotal = 0
                    const recalculated = sortedByDateAsc.map((log) => {
                      const previousTotal = runningTotal
                      runningTotal += log.amount
                      return { ...log, previousTotal, newTotal: runningTotal }
                    })
                    // Return in DESC order for display (most recent first)
                    logsWithRecalculatedTotals = recalculated.reverse()
                  }

                  return (
                    <div>
                      {selectedCustomerId !== "all" && (
                        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                          ℹ️ Showing <strong>{filteredLogs.length}</strong>{" "}
                          records for this customer. Formula is recalculated for
                          their records only.
                        </div>
                      )}
                      <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b sticky top-0 z-10">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold text-gray-700 bg-gray-50">
                                Date/Time
                              </th>
                              <th className="px-4 py-3 text-left font-semibold text-gray-700 bg-gray-50">
                                Type
                              </th>
                              <th className="px-4 py-3 text-left font-semibold text-gray-700 bg-gray-50">
                                Customer
                              </th>
                              <th className="px-4 py-3 text-left font-semibold text-gray-700 bg-gray-50">
                                Details
                              </th>
                              <th className="px-4 py-3 text-right font-semibold text-gray-700 bg-gray-50">
                                Cost
                              </th>
                              <th className="px-4 py-3 text-right font-semibold text-gray-700 bg-gray-50">
                                Formula
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {logsWithRecalculatedTotals.map((log) => (
                              <tr key={log.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-gray-600">
                                  {new Date(log.timestamp).toLocaleString(
                                    "it-IT",
                                    {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {log.typeLabel}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {log.customerName ? (
                                    <div>
                                      <p className="font-medium text-gray-900">
                                        {log.customerName}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {log.customerEmail}
                                      </p>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-xs">
                                      -
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 max-w-md">
                                  <p className="text-gray-700">
                                    {log.description}
                                  </p>
                                  {log.userQuery && (
                                    <p className="text-xs text-gray-500 mt-1 italic truncate">
                                      "{log.userQuery}"
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-green-600">
                                  €{log.amount.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-xs text-gray-600">
                                  €{log.previousTotal.toFixed(2)} + €
                                  {log.amount.toFixed(2)} = €
                                  {log.newTotal.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gradient-to-r from-green-50 to-blue-50 border-t-2 border-green-600 sticky bottom-0 z-10">
                            <tr>
                              <td
                                colSpan={4}
                                className="px-4 py-4 text-right font-bold text-gray-900 text-base bg-gradient-to-r from-green-50 to-blue-50"
                              >
                                💰 GRAND TOTAL:
                              </td>
                              <td className="px-4 py-4 text-right bg-gradient-to-r from-green-50 to-blue-50">
                                <span className="text-xl font-bold text-green-600">
                                  €
                                  {filteredLogs
                                    .reduce((sum, log) => sum + log.amount, 0)
                                    .toFixed(2)}
                                </span>
                                <p className="text-xs text-gray-500 mt-1">
                                  {filteredLogs.length}{" "}
                                  {filteredLogs.length === 1
                                    ? "operation"
                                    : "operations"}
                                </p>
                              </td>
                              <td className="px-4 py-4 text-right bg-gradient-to-r from-green-50 to-blue-50">
                                <span className="text-base font-bold text-blue-600 font-mono">
                                  = €
                                  {logsWithRecalculatedTotals[
                                    logsWithRecalculatedTotals.length - 1
                                  ]?.newTotal.toFixed(2) || "0.00"}
                                </span>
                                <p className="text-xs text-gray-500 mt-1">
                                  Final total
                                </p>
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )
                })()
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">📋</div>
                  <p className="text-gray-500">No logs available</p>
                </div>
              )}
            </CardContent>
          </Card>
          */}
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing">
            <BillingTab />
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing">
            <PricingList />
          </TabsContent>
        </Tabs>
      ) : (
        // No Data State
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">{t.noAnalyticsData}</p>
          </div>
        </div>
      )}
    </div>
  )
}
