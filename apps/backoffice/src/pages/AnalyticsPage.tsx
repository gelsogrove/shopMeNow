import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, DollarSign, Users } from 'lucide-react'
import { api } from '@/services/api'
import { roundMoney } from '@/utils/money'

interface MonthData {
  periodYear: number
  periodMonth: number
  revenue: number
  userCount: number
  whatsappMessages: number
  widgetMessages: number
  totalMessages: number
  pushCampaigns: number
  pushRecipients: number
}

interface RevenueStats {
  monthSeries: MonthData[]
  totals: {
    revenue: number
    whatsappMessages: number
    widgetMessages: number
    totalMessages: number
    pushCampaigns: number
    pushRecipients: number
  }
}

const formatMonth = (month: number, year: number) =>
  `${String(month).padStart(2, '0')}/${year}`

const formatUsd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(roundMoney(value))

const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-US').format(value)

export function AnalyticsPage() {
  const [data, setData] = useState<RevenueStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    setLoading(true)
    setError(null)
    const response = await api.users.getRevenueStats(12)
    if (!response.success || !response.data) {
      setError(response.error || 'Failed to load analytics')
      setLoading(false)
      return
    }
    setData(response.data)
    setLoading(false)
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const chartMetrics = useMemo(() => {
    if (!data || !data.monthSeries.length) return null

    const maxRevenue = Math.max(...data.monthSeries.map((m) => m.revenue), 0)
    const maxMessages = Math.max(...data.monthSeries.map((m) => m.totalMessages), 0)
    const maxPushRecipients = Math.max(...data.monthSeries.map((m) => m.pushRecipients), 0)

    return { maxRevenue, maxMessages, maxPushRecipients }
  }, [data])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Revenue & Usage Analytics</h1>
          <p className="text-sm text-gray-600">Incassi mensili e statistiche di utilizzo per tutti i canali.</p>
        </div>
        <Button variant="outline" onClick={fetchStats}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent className="py-4 text-sm text-red-600">{error}</CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="py-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-100 p-2">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Total Revenue (12 months)</div>
                  <div className="text-xl font-semibold text-gray-900">{formatUsd(data.totals.revenue)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-100 p-2">
                  <Users className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Avg Monthly Revenue</div>
                  <div className="text-xl font-semibold text-gray-900">
                    {formatUsd(data.totals.revenue / data.monthSeries.length)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <Card>
          <CardContent className="py-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Monthly Revenue</h3>
            {loading ? (
              <div className="text-sm text-gray-500">Loading chart...</div>
            ) : !data || data.monthSeries.length === 0 ? (
              <div className="text-sm text-gray-500">No data available.</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-2 items-end h-48">
                  {data.monthSeries.map((entry) => {
                    const height = chartMetrics?.maxRevenue
                      ? Math.max(8, (entry.revenue / chartMetrics.maxRevenue) * 180)
                      : 8
                    return (
                      <div key={`${entry.periodYear}-${entry.periodMonth}`} className="flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-md bg-emerald-500 hover:bg-emerald-600 transition-colors cursor-pointer"
                          style={{ height: `${height}px` }}
                          title={`${formatMonth(entry.periodMonth, entry.periodYear)}\n${formatUsd(entry.revenue)}\n${entry.userCount} users`}
                        />
                        <div className="text-[9px] text-gray-500 -rotate-45 origin-top-left mt-2">
                          {formatMonth(entry.periodMonth, entry.periodYear)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Messages Chart */}
        <Card>
          <CardContent className="py-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Messages (WhatsApp + Widget)</h3>
            {loading ? (
              <div className="text-sm text-gray-500">Loading chart...</div>
            ) : !data || data.monthSeries.length === 0 ? (
              <div className="text-sm text-gray-500">No data available.</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-2 items-end h-48">
                  {data.monthSeries.map((entry) => {
                    const totalHeight = chartMetrics?.maxMessages
                      ? Math.max(8, (entry.totalMessages / chartMetrics.maxMessages) * 180)
                      : 8
                    const whatsappHeight = entry.totalMessages > 0 
                      ? (entry.whatsappMessages / entry.totalMessages) * totalHeight 
                      : 0
                    
                    return (
                      <div key={`msg-${entry.periodYear}-${entry.periodMonth}`} className="flex flex-col items-center gap-1">
                        <div className="w-full relative" style={{ height: `${totalHeight}px` }}>
                          {/* Widget messages (bottom) */}
                          <div
                            className="absolute bottom-0 left-0 right-0 rounded-b-md bg-blue-400 hover:bg-blue-500 transition-colors"
                            style={{ height: `${totalHeight - whatsappHeight}px` }}
                            title={`Widget: ${entry.widgetMessages}`}
                          />
                          {/* WhatsApp messages (top) */}
                          <div
                            className="absolute top-0 left-0 right-0 rounded-t-md bg-green-500 hover:bg-green-600 transition-colors"
                            style={{ height: `${whatsappHeight}px` }}
                            title={`WhatsApp: ${entry.whatsappMessages}`}
                          />
                        </div>
                        <div className="text-[9px] text-gray-500 -rotate-45 origin-top-left mt-2">
                          {formatMonth(entry.periodMonth, entry.periodYear)}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center justify-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-green-500"></div>
                    <span>WhatsApp</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-blue-400"></div>
                    <span>Widget</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Push Campaigns Chart */}
        <Card>
          <CardContent className="py-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Push Campaign Recipients</h3>
            {loading ? (
              <div className="text-sm text-gray-500">Loading chart...</div>
            ) : !data || data.monthSeries.length === 0 ? (
              <div className="text-sm text-gray-500">No data available.</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-2 items-end h-48">
                  {data.monthSeries.map((entry) => {
                    const height = chartMetrics?.maxPushRecipients
                      ? Math.max(8, (entry.pushRecipients / chartMetrics.maxPushRecipients) * 180)
                      : 8
                    return (
                      <div key={`push-${entry.periodYear}-${entry.periodMonth}`} className="flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-md bg-purple-500 hover:bg-purple-600 transition-colors cursor-pointer"
                          style={{ height: `${height}px` }}
                          title={`${formatMonth(entry.periodMonth, entry.periodYear)}\n${entry.pushCampaigns} campaigns\n${formatNumber(entry.pushRecipients)} recipients`}
                        />
                        <div className="text-[9px] text-gray-500 -rotate-45 origin-top-left mt-2">
                          {formatMonth(entry.periodMonth, entry.periodYear)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Users Chart */}
        <Card>
          <CardContent className="py-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Active Paying Users</h3>
            {loading ? (
              <div className="text-sm text-gray-500">Loading chart...</div>
            ) : !data || data.monthSeries.length === 0 ? (
              <div className="text-sm text-gray-500">No data available.</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-2 items-end h-48">
                  {data.monthSeries.map((entry) => {
                    const maxUsers = Math.max(...data.monthSeries.map((m) => m.userCount), 1)
                    const height = Math.max(8, (entry.userCount / maxUsers) * 180)
                    return (
                      <div key={`users-${entry.periodYear}-${entry.periodMonth}`} className="flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-md bg-amber-500 hover:bg-amber-600 transition-colors cursor-pointer"
                          style={{ height: `${height}px` }}
                          title={`${formatMonth(entry.periodMonth, entry.periodYear)}\n${entry.userCount} paying users`}
                        />
                        <div className="text-[9px] text-gray-500 -rotate-45 origin-top-left mt-2">
                          {formatMonth(entry.periodMonth, entry.periodYear)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
