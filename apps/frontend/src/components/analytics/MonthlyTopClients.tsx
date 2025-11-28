import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import {
    DateRange,
    getMonthlyTopClients,
    MonthlyTopClient,
} from "@/services/analyticsApi"
import { Building2, Calendar, TrendingUp } from "lucide-react"
import React, { useEffect, useState } from "react"

interface MonthlyTopClientsProps {
  dateRange: DateRange
}

export const MonthlyTopClients: React.FC<MonthlyTopClientsProps> = ({
  dateRange,
}) => {
  const { workspace: currentWorkspace } = useWorkspace()
  const [monthlyData, setMonthlyData] = useState<MonthlyTopClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!currentWorkspace?.id) return

      try {
        setLoading(true)
        setError(null)
        const data = await getMonthlyTopClients(currentWorkspace.id, dateRange)
        setMonthlyData(data)
      } catch (err) {
        logger.error("Error fetching monthly top clients:", err)
        setError("Failed to load monthly top clients data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [currentWorkspace?.id, dateRange])

  const getMonthName = (month: string) => {
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ]
    return monthNames[parseInt(month) - 1] || month
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-purple-600" />
            Top Clients by Month
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
            <Building2 className="h-5 w-5 text-purple-600" />
            Top Clients by Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Building2 className="h-8 w-8 text-red-400 mx-auto mb-2" />
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
          <Building2 className="h-5 w-5 text-purple-600" />
          Top Clients by Month
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
                    {monthData.clients.length} clients
                  </Badge>
                </div>

                {monthData.clients.length > 0 ? (
                  <div className="space-y-3">
                    {monthData.clients.slice(0, 3).map((client, index) => (
                      <div
                        key={client.id}
                        className="flex items-center justify-between p-3 bg-purple-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-700">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {client.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {client.email}
                            </p>
                            {client.company && (
                              <p className="text-xs text-purple-600 font-medium">
                                {client.company}
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
                            }).format(client.totalSpent)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {client.totalOrders} orders
                          </p>
                          <p className="text-xs text-gray-400">
                            Avg:{" "}
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: "EUR",
                              minimumFractionDigits: 0,
                            }).format(client.averageOrderValue)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <TrendingUp className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">
                      No active clients this month
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Building2 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">
              No data available for the selected period
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
