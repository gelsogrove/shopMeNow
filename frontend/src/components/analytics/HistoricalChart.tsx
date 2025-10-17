import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardAnalytics } from "@/services/analyticsApi"
import { TrendingUp } from "lucide-react"
import React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { getAdminPageTexts } from "../../utils/adminPageTranslations"
import type { PeriodPreset } from "./DateRangeSelector"
import { TopSearchedProductsChart } from "./TopSearchedProductsChart"

interface HistoricalChartProps {
  analytics: DashboardAnalytics
  chartType?: "line" | "bar"
  period?: PeriodPreset
  loading?: boolean
}

export const HistoricalChart: React.FC<HistoricalChartProps> = ({
  analytics,
  chartType = "line",
  period,
  loading,
}) => {
  const t = getAdminPageTexts()

  // Format data for charts - Merge all trends by month name
  const allMonths = new Set<string>()
  analytics.trends.orders.forEach((d) => allMonths.add(d.month))
  analytics.trends.customers.forEach((d) => allMonths.add(d.month))
  analytics.trends.usageCost.forEach((d) => allMonths.add(d.month))

  console.log("📊 [HistoricalChart] Raw trends data:", {
    orders: analytics.trends.orders,
    customers: analytics.trends.customers,
    usageCost: analytics.trends.usageCost,
  })

  const chartData = Array.from(allMonths).map((month) => {
    const orderData = analytics.trends.orders.find((d) => d.month === month)
    const customerData = analytics.trends.customers.find(
      (d) => d.month === month
    )
    const usageCostData = analytics.trends.usageCost.find(
      (d) => d.month === month
    )

    return {
      month,
      orders: orderData?.value || 0,
      customers: customerData?.value || 0,
      usageCost: usageCostData?.value || 0,
    }
  })

  console.log("📊 [HistoricalChart] Chart data merged:", chartData)

  // Prepare category pie chart data - aggregate all months
  const categoryTotals: { [categoryName: string]: number } = {}
  analytics.trends.categories.forEach((monthData) => {
    Object.entries(monthData.categories).forEach(([categoryName, count]) => {
      categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + count
    })
  })

  const categoryPieData = Object.entries(categoryTotals).map(
    ([name, value]) => ({
      name,
      value,
    })
  )

  // Define colors for pie chart
  const PIE_COLORS = [
    "#3b82f6", // blue
    "#22c55e", // green
    "#f97316", // orange
    "#a855f7", // purple
    "#ec4899", // pink
    "#14b8a6", // teal
    "#f59e0b", // amber
    "#ef4444", // red
  ]

  console.log("📊 [HistoricalChart] Category pie data:", categoryPieData)

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600">{entry.name}:</span>
              <span className="font-medium text-gray-900">
                {entry.dataKey === "usageCost"
                  ? new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "EUR",
                      minimumFractionDigits: 3,
                    }).format(entry.value)
                  : entry.value.toLocaleString("en-US")}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  if (!chartData || chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Historical Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No historical data available</p>
              <p className="text-sm text-gray-400">
                Data will appear here once you have more orders over time
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Grafico 1: Orders e Customers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            {t.historicalTrends}
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">{t.historicalTrendsDesc}</p>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "bar" ? (
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#666" }}
                    tickLine={{ stroke: "#e0e0e0" }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#666" }}
                    tickLine={{ stroke: "#e0e0e0" }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: "14px", fontWeight: "500" }}
                  />
                  <Bar
                    dataKey="orders"
                    name={t.ordersLabel}
                    fill="#22c55e"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="customers"
                    name="Clienti"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              ) : (
                <LineChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#666" }}
                    tickLine={{ stroke: "#e0e0e0" }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#666" }}
                    tickLine={{ stroke: "#e0e0e0" }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: "14px", fontWeight: "500" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    name={t.ordersLabel}
                    stroke="#22c55e"
                    strokeWidth={3}
                    dot={{ fill: "#22c55e", strokeWidth: 2, r: 6 }}
                    activeDot={{ r: 8, stroke: "#22c55e", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="customers"
                    name="Clienti"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ fill: "#3b82f6", strokeWidth: 2, r: 6 }}
                    activeDot={{ r: 8, stroke: "#3b82f6", strokeWidth: 2 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Grafico 2: Costi LLM - SEMPRE A BARRE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-orange-600" />
            Costi LLM nel Tempo
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Andamento dei costi di utilizzo del sistema LLM
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#666" }}
                  tickLine={{ stroke: "#e0e0e0" }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#666" }}
                  tickLine={{ stroke: "#e0e0e0" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: "14px", fontWeight: "500" }}
                />
                <Bar
                  dataKey="usageCost"
                  name="Costi LLM (€)"
                  fill="#f97316"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ROW 2: Pie Chart Categorie + Top Searched Products (50% + 50%) */}
      <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Grafico 3: Pie Chart Categorie */}
        {categoryPieData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                Distribuzione per Categoria
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Totale ordini per categoria prodotto
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryPieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryPieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Searched Products Chart */}
        {period && (
          <TopSearchedProductsChart period={period} parentLoading={loading} />
        )}
      </div>
    </div>
  )
}
