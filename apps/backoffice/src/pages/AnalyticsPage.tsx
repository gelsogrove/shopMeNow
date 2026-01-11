import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { api } from '@/services/api'
import { roundMoney } from '@/utils/money'

interface MonthlySummary {
  periodYear: number
  periodMonth: number
  totalAmount: number
  invoiceCount: number
  userCount: number
}

const formatMonth = (month: number, year: number) =>
  `${String(month).padStart(2, '0')}/${year}`

const formatUsd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(roundMoney(value))

export function AnalyticsPage() {
  const [data, setData] = useState<MonthlySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = async () => {
    setLoading(true)
    setError(null)
    const response = await api.users.getInvoiceSummary(12)
    if (!response.success || !response.data) {
      setError(response.error || 'Failed to load analytics')
      setLoading(false)
      return
    }
    setData(response.data)
    setLoading(false)
  }

  useEffect(() => {
    fetchSummary()
  }, [])

  const totals = useMemo(() => {
    const totalRevenue = data.reduce((sum, entry) => sum + entry.totalAmount, 0)
    const totalInvoices = data.reduce((sum, entry) => sum + entry.invoiceCount, 0)
    const averageRevenue = data.length ? totalRevenue / data.length : 0
    const lastMonth = data[data.length - 1]
    return {
      totalRevenue,
      totalInvoices,
      averageRevenue,
      lastMonth,
    }
  }, [data])

  const maxAmount = Math.max(...data.map((entry) => entry.totalAmount), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Monthly Trends</h1>
          <p className="text-sm text-gray-600">Paid invoice totals and active clients per month.</p>
        </div>
        <Button variant="outline" onClick={fetchSummary}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent className="py-4 text-sm text-red-600">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="py-5">
            <div className="text-xs text-gray-500">Total revenue (12 months)</div>
            <div className="text-2xl font-semibold text-gray-900">{formatUsd(totals.totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <div className="text-xs text-gray-500">Average monthly revenue</div>
            <div className="text-2xl font-semibold text-gray-900">{formatUsd(totals.averageRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <div className="text-xs text-gray-500">Invoices (12 months)</div>
            <div className="text-2xl font-semibold text-gray-900">{totals.totalInvoices}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-6">
          {loading ? (
            <div className="text-sm text-gray-500">Loading chart...</div>
          ) : data.length === 0 ? (
            <div className="text-sm text-gray-500">No paid invoices in the last 12 months.</div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">Last 12 months (paid invoices)</div>
              <div className="grid grid-cols-12 gap-3 items-end">
                {data.map((entry) => {
                  const height = maxAmount > 0 ? Math.max(6, (entry.totalAmount / maxAmount) * 160) : 6
                  return (
                    <div key={`${entry.periodYear}-${entry.periodMonth}`} className="flex flex-col items-center gap-2">
                      <div
                        className="w-8 rounded-md bg-emerald-500"
                        style={{ height: `${height}px` }}
                        title={`${formatUsd(entry.totalAmount)} • ${entry.userCount} users`}
                      />
                      <div className="text-[11px] text-gray-500">{formatMonth(entry.periodMonth, entry.periodYear)}</div>
                      <div className="text-[11px] text-gray-700">{entry.userCount} users</div>
                    </div>
                  )
                })}
              </div>
              {totals.lastMonth && (
                <div className="text-xs text-gray-500">
                  Latest month: {formatMonth(totals.lastMonth.periodMonth, totals.lastMonth.periodYear)} •
                  {` ${formatUsd(totals.lastMonth.totalAmount)} from ${totals.lastMonth.userCount} users`}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
