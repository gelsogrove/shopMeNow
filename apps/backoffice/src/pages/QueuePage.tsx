import { useEffect, useMemo, useState } from "react"
import { RefreshCw, HelpCircle } from "lucide-react"
import { api } from "@/services/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type QueueMessage = {
  id: string
  workspaceId: string
  customerId: string
  phoneNumber: string
  messageContent: string
  status: string
  errorMessage?: string | null
  createdAt: string
  deliveredAt?: string | null
  channel: string
  visitorId?: string | null
  isAnonymous?: boolean
  responsePayload?: any | null
  workspace?: { id: string; name: string; whatsappPhoneNumber?: string | null }
  customer?: { id: string; name: string; email: string; phone?: string | null }
}

export function QueuePage() {
  const [items, setItems] = useState<QueueMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState("all")
  const [channelFilter, setChannelFilter] = useState("all")
  const [workspaceFilter, setWorkspaceFilter] = useState("all")
  const [timeRange, setTimeRange] = useState("24h")
  const [searchTerm, setSearchTerm] = useState("")

  const loadQueue = async () => {
    setLoading(true)
    setError(null)
    const response = await api.users.getQueue()
    if (!response.success || !response.data) {
      setError(response.error || "Failed to load queue")
      setLoading(false)
      return
    }
    setItems(response.data)
    setLoading(false)
  }

  useEffect(() => {
    loadQueue()
  }, [])

  const statusOptions = useMemo(() => {
    const map = new Map<string, string>()
    items.forEach((item) => {
      const value = (item.status || "").trim().toLowerCase()
      if (!value) return
      if (!map.has(value)) {
        map.set(value, item.status)
      }
    })
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [items])

  const channelOptions = useMemo(() => {
    const map = new Map<string, string>()
    items.forEach((item) => {
      const value = (item.channel || "").trim().toLowerCase()
      if (!value) return
      if (!map.has(value)) {
        map.set(value, item.channel)
      }
    })
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [items])

  const workspaceOptions = useMemo(() => {
    const map = new Map<string, string>()
    items.forEach((item) => {
      if (!item.workspaceId) return
      if (!map.has(item.workspaceId)) {
        map.set(item.workspaceId, item.workspace?.name || item.workspaceId)
      }
    })
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [items])

  const timeRangeLabel = useMemo(() => {
    if (timeRange === "7d") return "last 7 days"
    if (timeRange === "all") return "all time"
    return "last 24 hours"
  }, [timeRange])

  // Filter messages based on selected filters
  const rows = useMemo(() => {
    const now = new Date()
    const rangeCutoff =
      timeRange === "7d"
        ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        : timeRange === "24h"
          ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
          : null

    const normalizedSearch = searchTerm.trim().toLowerCase()

    return items.filter((item) => {
      if (rangeCutoff) {
        const createdAt = new Date(item.createdAt)
        if (createdAt < rangeCutoff) return false
      }

      if (statusFilter !== "all") {
        const statusValue = (item.status || "").trim().toLowerCase()
        if (statusValue !== statusFilter) return false
      }

      if (channelFilter !== "all") {
        const channelValue = (item.channel || "").trim().toLowerCase()
        if (channelValue !== channelFilter) return false
      }

      if (workspaceFilter !== "all" && item.workspaceId !== workspaceFilter) {
        return false
      }

      if (normalizedSearch) {
        const haystack = [
          item.messageContent,
          item.phoneNumber,
          item.customer?.name,
          item.customer?.email,
          item.workspace?.name,
          item.workspaceId,
          item.visitorId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()

        if (!haystack.includes(normalizedSearch)) return false
      }

      return true
    })
  }, [
    items,
    channelFilter,
    searchTerm,
    statusFilter,
    timeRange,
    workspaceFilter,
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Queue</h1>
          <p className="text-sm text-gray-500">
            Messages from {timeRangeLabel} across workspaces (WhatsApp + Widget).
          </p>
        </div>
        <Button onClick={loadQueue} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px]">
            <div className="text-xs font-semibold uppercase text-gray-500">
              Status
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[160px]">
            <div className="text-xs font-semibold uppercase text-gray-500">
              Channel
            </div>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {channelOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[180px]">
            <div className="text-xs font-semibold uppercase text-gray-500">
              Workspace
            </div>
            <Select value={workspaceFilter} onValueChange={setWorkspaceFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All workspaces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All workspaces</SelectItem>
                {workspaceOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[150px]">
            <div className="text-xs font-semibold uppercase text-gray-500">
              Time range
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Last 24 hours" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[220px] flex-1">
            <div className="text-xs font-semibold uppercase text-gray-500">
              Search
            </div>
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Message, customer, phone, workspace..."
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setStatusFilter("all")
                setChannelFilter("all")
                setWorkspaceFilter("all")
                setTimeRange("24h")
                setSearchTerm("")
              }}
            >
              Clear filters
            </Button>
            <div className="text-xs text-gray-500">
              {rows.length} / {items.length}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Workspace</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={8}>
                    Loading queue messages...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={8}>
                    No queue messages found.
                  </td>
                </tr>
              ) : (
                rows.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{item.channel}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{item.workspace?.name || "—"}</div>
                      <div className="text-xs text-gray-500">{item.workspaceId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{item.customer?.name || "—"}</div>
                      <div className="text-xs text-gray-500">{item.customer?.email || "—"}</div>
                    </td>
                    <td className="px-4 py-3">{item.phoneNumber || "—"}</td>
                    <td className="px-4 py-3 max-w-xs">
                      {item.responsePayload ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-start gap-2 cursor-help">
                                <div className="line-clamp-3 text-gray-700 flex-1">
                                  {item.messageContent}
                                </div>
                                <HelpCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-1" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent 
                              side="left" 
                              className="max-w-sm bg-blue-50 border-blue-200 text-gray-900 max-h-64 overflow-y-auto"
                            >
                              <div className="space-y-2">
                                <div className="font-semibold text-blue-900">💬 LLM Response:</div>
                                <div className="text-sm whitespace-pre-wrap">
                                  {typeof item.responsePayload === 'string'
                                    ? item.responsePayload
                                    : JSON.stringify(item.responsePayload, null, 2)}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <div className="line-clamp-3 text-gray-700">{item.messageContent}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-red-600">
                      {item.errorMessage || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
