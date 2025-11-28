/**
 * Top Searched Products Analytics Component
 * Displays top 10 searched products with horizontal bar chart
 * Uses period from parent AnalyticsPage
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useWorkspace } from "@/hooks/use-workspace"
import {
  getTopSearchedProducts,
  type TopSearchedProduct,
} from "@/services/analyticsApi"
import { useEffect, useState } from "react"
import type { PeriodPreset } from "./DateRangeSelector"

type AnalyticsPeriodType = "7days" | "30days" | "alltime"

interface TopSearchedProductsChartProps {
  period: PeriodPreset
  parentLoading?: boolean
}

// Convert PeriodPreset to analytics period
function convertToAnalyticsPeriod(period: PeriodPreset): AnalyticsPeriodType {
  switch (period) {
    case "week":
      return "7days"
    case "30days":
      return "30days"
    case "3months":
    case "6months":
    case "1year":
      return "alltime"
    default:
      return "7days"
  }
}

export function TopSearchedProductsChart({
  period,
  parentLoading = false,
}: TopSearchedProductsChartProps) {
  const { workspace } = useWorkspace()
  const [products, setProducts] = useState<TopSearchedProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const analyticsPeriod = convertToAnalyticsPeriod(period)

  const fetchData = async () => {
    if (!workspace?.id) return

    try {
      setLoading(true)
      setError(null)
      const data = await getTopSearchedProducts(
        workspace.id,
        analyticsPeriod,
        10
      )
      setProducts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
      logger.error("Error fetching top searched products:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [analyticsPeriod, workspace?.id])

  if (!workspace) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔍 Top Searched Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500">Please select a workspace</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔍 Top Searched Products
        </CardTitle>
        <p className="text-sm text-gray-500 mt-2">
          Top 10 products searched by customers
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {!loading && !error && products.length > 0 && (
          <>
            {/* Table View */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">
                      Rank
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">
                      Product
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">
                      Searches
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">
                      % Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr
                      key={product.productName}
                      className="border-b border-gray-200 hover:bg-gray-50 transition"
                    >
                      <td className="px-4 py-3 text-gray-900 font-semibold">
                        {product.rank === 1 && "🥇"}
                        {product.rank === 2 && "🥈"}
                        {product.rank === 3 && "🥉"}
                        {product.rank > 3 && `#${product.rank}`}
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {product.productName}
                      </td>
                      <td className="px-4 py-3 text-right text-blue-600 font-semibold">
                        {product.searchCount}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${product.percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-gray-600 font-medium w-12 text-right">
                            {product.percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && !error && products.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">📭 No searches found for this period</p>
            <p className="text-sm mt-2">Customer searches will appear here</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
