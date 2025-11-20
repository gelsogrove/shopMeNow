import { PageLayout } from "@/components/layout/PageLayout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import { api } from "@/services/api"
import { ListChecks } from "lucide-react"
import { useEffect, useState } from "react"

interface QueueMessage {
  id: string
  workspaceId: string
  customerId: string
  phoneNumber: string
  messageContent: string
  status: "pending" | "sent" | "error"
  errorMessage: string | null
  createdAt: string
  deliveredAt: string | null
  customer: {
    name: string
    email: string | null
  }
}

export function QueuePage() {
  const { workspace } = useWorkspace()
  const [messages, setMessages] = useState<QueueMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!workspace?.id) return

    const fetchMessages = async () => {
      try {
        const response = await api.get(
          `/workspaces/${workspace.id}/whatsapp-queue`
        )
        // API returns array directly, not wrapped in {success, data}
        setMessages(Array.isArray(response.data) ? response.data : [])
      } catch (error) {
        logger.error("Failed to fetch queue messages:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMessages()
    const interval = setInterval(fetchMessages, 5000) // Refresh every 5s

    return () => clearInterval(interval)
  }, [workspace?.id])

  const getStatusBadge = (status: QueueMessage["status"]) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-yellow-50 text-yellow-700 border-yellow-300">
            ⏳ Pending
          </Badge>
        )
      case "sent":
        return (
          <Badge className="bg-green-50 text-green-700 border-green-300">
            ✅ Sent
          </Badge>
        )
      case "error":
        return (
          <Badge className="bg-red-50 text-red-700 border-red-300">
            ❌ Error
          </Badge>
        )
    }
  }

  // Filter messages by search term
  const filteredMessages = messages.filter(
    (msg) =>
      msg.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.phoneNumber.includes(searchTerm) ||
      msg.messageContent.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <PageLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <ListChecks className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                WhatsApp Queue
              </h1>
              <p className="text-sm text-gray-500">
                Monitor pending messages • Auto-refresh every 5s
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <Input
              placeholder="Search by customer, phone, or message..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-gray-500">
                Loading queue...
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="py-12 text-center">
                <ListChecks className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  {searchTerm ? "No messages found" : "Queue is empty"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMessages.map((msg) => (
                    <TableRow key={msg.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{msg.customer.name}</div>
                          <div className="text-sm text-gray-500">
                            {msg.phoneNumber}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div
                          className="max-w-md truncate"
                          title={msg.messageContent}
                        >
                          {msg.messageContent.substring(0, 100)}
                          {msg.messageContent.length > 100 && "..."}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          {getStatusBadge(msg.status)}
                          {msg.errorMessage && (
                            <div
                              className="text-xs text-red-600 mt-1 max-w-xs truncate"
                              title={msg.errorMessage}
                            >
                              {msg.errorMessage}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600">
                          {new Date(msg.createdAt).toLocaleString("it-IT", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}

