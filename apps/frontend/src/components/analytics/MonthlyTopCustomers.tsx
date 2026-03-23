import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import {
    DateRange,
    getMonthlyTopCustomers,
    MonthlyTopCustomer,
} from "@/services/analyticsApi"
import { Calendar, TrendingUp, Users } from "lucide-react"
import React, { useEffect, useState } from "react"

interface MonthlyTopCustomersProps {
  dateRange: DateRange
}

export const MonthlyTopCustomers: React.FC<MonthlyTopCustomersProps> = ({
  dateRange,
}) => {
  const { workspace: currentWorkspace } = useWorkspace()
  const [monthlyData, setMonthlyData] = useState<MonthlyTopCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!currentWorkspace?.id) return

      try {
        setLoading(true)
        setError(null)
        const data = await getMonthlyTopCustomers(
          currentWorkspace.id,
          dateRange
        )
        setMonthlyData(data)
      } catch (err) {
        logger.error("Error fetching monthly top customers:", err)
        setError("Failed to load monthly top customers data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [currentWorkspace?.id, dateRange])

  const getMonthName = (month: string) => {
    const monthNames = [
      "Gennaio",
      "Febbraio",
      "Marzo",
      "Aprile",
      "Maggio",
      "Giugno",
      "Luglio",
      "Agosto",
      "Settembre",
      "Ottobre",
      "Novembre",
      "Dicembre",
    ]
    return monthNames[parseInt(month) - 1] || month
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Top Customers by Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Top Customers by Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Users className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-500">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          Top Customers by Month
        </CardTitle>
      </CardHeader>
      <CardContent>
        {monthlyData.length > 0 ? (
          <div className="space-y-6">
            {monthlyData.map((monthData) => (
              <div
                key={`${monthData.year}-${monthData.month}`}
                className="border rounded-lg p-4"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <h3 className="font-semibold text-lg">
                    {getMonthName(monthData.month)} {monthData.year}
                  </h3>
                  <Badge variant="outline" className="ml-auto">
                    {monthData.customers.length} customers
                  </Badge>
                </div>

                {monthData.customers.length > 0 ? (
                  <div className="space-y-3">
                    {monthData.customers.slice(0, 3).map((customer, index) => (
                      <div
                        key={customer.id}
                        className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
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
                            {customer.totalOrders} orders
                          </p>
                          <p className="text-xs text-gray-400">
                            Avg:{" "}
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
                  <div className="text-center py-4">
                    <TrendingUp className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">
                      No active customers this month
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">
              No data available for the selected period
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
