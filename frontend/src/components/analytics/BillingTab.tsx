import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import {
  CurrentMonthBilling,
  getMonthDetail,
  getMonthlyBreakdown,
  MonthlyBilling,
} from "@/services/billingApi"
import {
  Activity,
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { useEffect, useState } from "react"

const BILLING_TYPE_LABELS: Record<string, string> = {
  MONTHLY_CHANNEL: "Monthly Subscription",
  MESSAGE: "Messages",
  NEW_CUSTOMER: "New Customers",
  NEW_ORDER: "New Orders",
  HUMAN_SUPPORT: "Human Support",
  PUSH_CAMPAIGN: "Push Notifications",
}

const BILLING_TYPE_COLORS: Record<string, string> = {
  MONTHLY_CHANNEL: "text-purple-600 bg-purple-50",
  MESSAGE: "text-blue-600 bg-blue-50",
  NEW_CUSTOMER: "text-green-600 bg-green-50",
  NEW_ORDER: "text-orange-600 bg-orange-50",
  HUMAN_SUPPORT: "text-red-600 bg-red-50",
  PUSH_CAMPAIGN: "text-pink-600 bg-pink-50",
}

export function BillingTab() {
  const { workspace: currentWorkspace } = useWorkspace()
  const [currentMonth, setCurrentMonth] = useState<CurrentMonthBilling | null>(
    null
  )
  const [history, setHistory] = useState<MonthlyBilling[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)
  const [monthDetails, setMonthDetails] = useState<Record<string, any>>({})
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>(
    {}
  )

  useEffect(() => {
    loadBillingData()
  }, [currentWorkspace?.id])

  const loadBillingData = async () => {
    if (!currentWorkspace?.id) return

    try {
      setLoading(true)
      setError(null)

      logger.info(
        `[BILLING-TAB] Loading monthly breakdown for workspace ${currentWorkspace.id}`
      )

      const response = await getMonthlyBreakdown(currentWorkspace.id)

      setCurrentMonth(response.data.currentMonth)
      setHistory(response.data.history)

      logger.info(
        `[BILLING-TAB] Loaded billing data: current month €${response.data.currentMonth.total.toFixed(2)}, ${response.data.history.length} months history`
      )
    } catch (err) {
      logger.error("[BILLING-TAB] Error loading billing data:", err)
      setError("Error loading billing data")
    } finally {
      setLoading(false)
    }
  }

  const toggleMonthDetail = async (year: number, month: number) => {
    const key = `${year}-${month}`

    // If already expanded, collapse it
    if (expandedMonth === key) {
      setExpandedMonth(null)
      return
    }

    // Expand and load details if not already loaded
    setExpandedMonth(key)

    if (!monthDetails[key] && currentWorkspace?.id) {
      setLoadingDetails((prev) => ({ ...prev, [key]: true }))
      try {
        const response = await getMonthDetail(
          currentWorkspace.id,
          year,
          month
        )
        setMonthDetails((prev) => ({
          ...prev,
          [key]: response.data.records,
        }))
      } catch (err) {
        logger.error(`[BILLING-TAB] Error loading details for ${key}:`, err)
      } finally {
        setLoadingDetails((prev) => ({ ...prev, [key]: false }))
      }
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!currentMonth) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-gray-500">No billing data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Single Table with Current Month + History */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-gray-600" />
            <CardTitle>Monthly Billing Breakdown</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600 w-8"></th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Month
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Total
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Operations
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Breakdown
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* CURRENT MONTH ROW (always first) */}
                {(() => {
                  const totalOperations = Object.values(
                    currentMonth.byType
                  ).reduce((sum, type) => sum + type.count, 0)
                  const hasData = currentMonth.total > 0
                  const monthKey = `${currentMonth.year}-${currentMonth.month}`
                  const isExpanded = expandedMonth === monthKey
                  const details = monthDetails[monthKey]
                  const isLoadingDetails = loadingDetails[monthKey]

                  return (
                    <>
                      <tr
                        key={monthKey}
                        className={`border-b-2 border-blue-200 bg-blue-50 ${
                          hasData ? "hover:bg-blue-100 cursor-pointer" : ""
                        }`}
                        onClick={() =>
                          hasData &&
                          toggleMonthDetail(
                            currentMonth.year,
                            currentMonth.month
                          )
                        }
                      >
                        <td className="py-3 px-4">
                          {hasData &&
                            (isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-blue-600" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-blue-600" />
                            ))}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-600" />
                            <div>
                              <span className="font-bold text-blue-600">
                                {currentMonth.monthName} {currentMonth.year}
                              </span>
                              <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                                Current
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-lg font-bold text-blue-600">
                            €{currentMonth.total.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm text-gray-600">
                            {totalOperations}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {hasData ? (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(currentMonth.byType)
                                .sort(([, a], [, b]) => b.cost - a.cost)
                                .slice(0, 3)
                                .map(([type, data]) => (
                                  <span
                                    key={type}
                                    className={`text-xs px-2 py-1 rounded ${BILLING_TYPE_COLORS[type] || "bg-gray-100"}`}
                                  >
                                    {BILLING_TYPE_LABELS[type] || type}: €
                                    {data.cost.toFixed(2)}
                                  </span>
                                ))}
                              {Object.keys(currentMonth.byType).length > 3 && (
                                <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                                  +{Object.keys(currentMonth.byType).length - 3}{" "}
                                  more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">
                              No operations yet
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Detail Row for Current Month */}
                      {isExpanded && (
                        <tr className="bg-blue-50 border-b-2 border-blue-200">
                          <td colSpan={5} className="py-4 px-8">
                            {isLoadingDetails ? (
                              <div className="text-center py-4">
                                <Skeleton className="h-20 w-full" />
                              </div>
                            ) : details && details.length > 0 ? (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-gray-700 mb-3">
                                  Operation Details - {currentMonth.monthName}{" "}
                                  {currentMonth.year}
                                </h4>
                                <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
                                  <div className="max-h-96 overflow-y-auto">
                                    <table className="w-full text-sm">
                                      <thead className="bg-gray-100 sticky top-0 z-10">
                                        <tr>
                                          <th className="text-left py-2 px-3 font-medium text-gray-600">
                                            Date
                                          </th>
                                          <th className="text-left py-2 px-3 font-medium text-gray-600">
                                            Type
                                          </th>
                                          <th className="text-left py-2 px-3 font-medium text-gray-600">
                                            Description
                                          </th>
                                          <th className="text-left py-2 px-3 font-medium text-gray-600">
                                            Customer
                                          </th>
                                          <th className="text-right py-2 px-3 font-medium text-gray-600">
                                            Amount
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-200">
                                        {details.map((record: any) => (
                                          <tr
                                            key={record.id}
                                            className="hover:bg-gray-50"
                                          >
                                            <td className="py-2 px-3 text-gray-600">
                                              {new Date(
                                                record.date
                                              ).toLocaleDateString("en-US", {
                                                day: "2-digit",
                                                month: "2-digit",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              })}
                                            </td>
                                            <td className="py-2 px-3">
                                              <span
                                                className={`text-xs px-2 py-1 rounded ${BILLING_TYPE_COLORS[record.type] || "bg-gray-100"}`}
                                              >
                                                {BILLING_TYPE_LABELS[
                                                  record.type
                                                ] || record.type}
                                              </span>
                                            </td>
                                            <td className="py-2 px-3 text-gray-700 max-w-md truncate">
                                              {record.description}
                                            </td>
                                            <td className="py-2 px-3 text-gray-600">
                                              {record.customerName || "-"}
                                            </td>
                                            <td className="py-2 px-3 text-right font-semibold text-green-600">
                                              €{record.amount.toFixed(2)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-gray-500 text-center py-4">
                                No details available
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })()}

                {/* HISTORY ROWS */}
                {history.map((month) => {
                  const totalOperations = Object.values(month.byType).reduce(
                    (sum, type) => sum + type.count,
                    0
                  )
                  const hasData = month.total > 0
                  const monthKey = `${month.year}-${month.month}`
                  const isExpanded = expandedMonth === monthKey
                  const details = monthDetails[monthKey]
                  const isLoadingDetails = loadingDetails[monthKey]

                  return (
                    <>
                      <tr
                        key={monthKey}
                        className={`border-b border-gray-100 ${
                          hasData
                            ? "hover:bg-gray-50 cursor-pointer"
                            : "opacity-50"
                        }`}
                        onClick={() =>
                          hasData && toggleMonthDetail(month.year, month.month)
                        }
                      >
                        <td className="py-3 px-4">
                          {hasData &&
                            (isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-gray-600" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            ))}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="font-medium">
                              {month.monthName} {month.year}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {hasData ? (
                            <span className="text-lg font-bold text-gray-900">
                              €{month.total.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-400">€0.00</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {hasData ? (
                            <span className="text-sm text-gray-600">
                              {totalOperations}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {hasData ? (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(month.byType)
                                .sort(([, a], [, b]) => b.cost - a.cost)
                                .slice(0, 3)
                                .map(([type, data]) => (
                                  <span
                                    key={type}
                                    className={`text-xs px-2 py-1 rounded ${BILLING_TYPE_COLORS[type] || "bg-gray-100"}`}
                                  >
                                    {BILLING_TYPE_LABELS[type] || type}: €
                                    {data.cost.toFixed(2)}
                                  </span>
                                ))}
                              {Object.keys(month.byType).length > 3 && (
                                <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                                  +{Object.keys(month.byType).length - 3} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">
                              No operations
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Detail Row */}
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={5} className="py-4 px-8">
                            {isLoadingDetails ? (
                              <div className="text-center py-4">
                                <Skeleton className="h-20 w-full" />
                              </div>
                            ) : details && details.length > 0 ? (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-gray-700 mb-3">
                                  Operation Details - {month.monthName}{" "}
                                  {month.year}
                                </h4>
                                <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
                                  <div className="max-h-96 overflow-y-auto">
                                    <table className="w-full text-sm">
                                      <thead className="bg-gray-100 sticky top-0 z-10">
                                        <tr>
                                          <th className="text-left py-2 px-3 font-medium text-gray-600">
                                            Date
                                          </th>
                                          <th className="text-left py-2 px-3 font-medium text-gray-600">
                                            Type
                                          </th>
                                          <th className="text-left py-2 px-3 font-medium text-gray-600">
                                            Description
                                          </th>
                                          <th className="text-left py-2 px-3 font-medium text-gray-600">
                                            Customer
                                          </th>
                                          <th className="text-right py-2 px-3 font-medium text-gray-600">
                                            Amount
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-200">
                                        {details.map((record: any) => (
                                          <tr
                                            key={record.id}
                                            className="hover:bg-gray-50"
                                          >
                                            <td className="py-2 px-3 text-gray-600">
                                              {new Date(
                                                record.date
                                              ).toLocaleDateString("en-US", {
                                                day: "2-digit",
                                                month: "2-digit",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              })}
                                            </td>
                                            <td className="py-2 px-3">
                                              <span
                                                className={`text-xs px-2 py-1 rounded ${BILLING_TYPE_COLORS[record.type] || "bg-gray-100"}`}
                                              >
                                                {BILLING_TYPE_LABELS[
                                                  record.type
                                                ] || record.type}
                                              </span>
                                            </td>
                                            <td className="py-2 px-3 text-gray-700 max-w-md truncate">
                                              {record.description}
                                            </td>
                                            <td className="py-2 px-3 text-gray-600">
                                              {record.customerName || "-"}
                                            </td>
                                            <td className="py-2 px-3 text-right font-semibold text-green-600">
                                              €{record.amount.toFixed(2)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-gray-500 text-center py-4">
                                No details available
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
