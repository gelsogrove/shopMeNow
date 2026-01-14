import { useEffect, useMemo, useState } from "react"
import { RefreshCw, HelpCircle } from "lucide-react"
import { api } from "@/services/api"
import { Button } from "@/components/ui/button"
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

  // Filter messages from last 24 hours
  const rows = useMemo(() => {
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    
    return items.filter(item => {
      const createdAt = new Date(item.createdAt)
      return createdAt >= oneDayAgo
    })
  }, [items])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Queue</h1>
          <p className="text-sm text-gray-500">
            Messages from last 24 hours across workspaces (WhatsApp + Widget).
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
