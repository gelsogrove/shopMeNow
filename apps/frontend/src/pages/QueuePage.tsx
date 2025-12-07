import { PageLayout } from "@/components/layout/PageLayout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
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
import { toast } from "@/lib/toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ListChecks, Trash2, AlertTriangle, Bug } from "lucide-react"
import { useEffect, useState } from "react"

interface QueueMessage {
  id: string
  workspaceId: string
  customerId: string
  phoneNumber: string
  messageContent: string
  status: "pending" | "sent" | "error" | "blocked"
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
  const [filterMode, setFilterMode] = useState<"all" | "pending" | "error">("pending")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [messageToDelete, setMessageToDelete] = useState<QueueMessage | null>(null)
  const [showDeleteMessageDialog, setShowDeleteMessageDialog] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [isUpdatingDebugMode, setIsUpdatingDebugMode] = useState(false)

  // Fetch debug mode status on mount
  useEffect(() => {
    if (!workspace?.id) return

    const fetchDebugMode = async () => {
      try {
        const response = await api.get(
          `/workspaces/${workspace.id}/whatsapp-queue/status`
        )
        if (response.data.success) {
          setDebugMode(response.data.debugMode ?? false)
        }
      } catch (error) {
        logger.error("Failed to fetch debug mode status:", error)
      }
    }

    fetchDebugMode()
  }, [workspace?.id])

  // Handle debug mode toggle
  const handleDebugModeToggle = async (newValue: boolean) => {
    if (!workspace?.id || isUpdatingDebugMode) return

    setIsUpdatingDebugMode(true)
    try {
      const response = await api.put(
        `/workspaces/${workspace.id}/whatsapp-queue/debug-mode`,
        { debugMode: newValue }
      )
      if (response.data.success) {
        setDebugMode(newValue)
        toast.success(
          newValue 
            ? "Debug Mode enabled - messages will NOT be sent" 
            : "Debug Mode disabled - messages will be sent normally",
          { duration: 3000 }
        )
      } else {
        toast.error("Failed to update debug mode", { duration: 2000 })
      }
    } catch (error) {
      logger.error("Failed to update debug mode:", error)
      toast.error("Failed to update debug mode", { duration: 2000 })
    } finally {
      setIsUpdatingDebugMode(false)
    }
  }

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
      case "blocked":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-400">
            🚫 Blocked
          </Badge>
        )
    }
  }

  // Filter messages by search term AND filter mode
  const filteredMessages = messages.filter((msg) => {
    const matchesSearch =
      msg.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.phoneNumber.includes(searchTerm) ||
      msg.messageContent.toLowerCase().includes(searchTerm.toLowerCase())

    if (filterMode === "all") return matchesSearch
    if (filterMode === "pending") return matchesSearch && msg.status === "pending"
    if (filterMode === "error") return matchesSearch && msg.status === "error"
    return matchesSearch
  })

  // Handle clearing all queue messages
  const handleClearQueue = async () => {
    if (!workspace?.id) return

    try {
      setIsDeleting(true)
      const response = await api.delete(`/workspaces/${workspace.id}/whatsapp-queue`)
      
      if (response.data.success) {
        setMessages([])
        toast.success("Queue cleared successfully", { duration: 2000 })
        setShowDeleteDialog(false)
      } else {
        toast.error(response.data.error || "Failed to clear queue", { duration: 1000 })
      }
    } catch (error) {
      logger.error("Error clearing queue:", error)
      toast.error("Failed to clear queue", { duration: 1000 })
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle deleting a single message
  const handleDeleteMessage = async (messageId: string) => {
    if (!workspace?.id) return

    try {
      setIsDeleting(true)
      const response = await api.delete(
        `/workspaces/${workspace.id}/whatsapp-queue/${messageId}`
      )

      if (response.data.success) {
        setMessages(messages.filter((m) => m.id !== messageId))
        toast.success("Message deleted successfully", { duration: 2000 })
        setShowDeleteMessageDialog(false)
        setMessageToDelete(null)
      } else {
        toast.error(response.data.error || "Failed to delete message", { duration: 1000 })
      }
    } catch (error) {
      logger.error("Error deleting message:", error)
      toast.error("Failed to delete message", { duration: 1000 })
    } finally {
      setIsDeleting(false)
    }
  }

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
              <h1 className="text-2xl font-bold text-green-600">
                WhatsApp Queue
              </h1>
              <p className="text-sm text-gray-500">
                Monitor pending messages • Auto-refresh every 5s
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Debug Mode Toggle */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border">
              <Bug className={`h-4 w-4 ${debugMode ? "text-orange-500" : "text-gray-400"}`} />
              <span className="text-sm text-gray-600">Debug Mode</span>
              <Switch
                checked={debugMode}
                onCheckedChange={handleDebugModeToggle}
                disabled={isUpdatingDebugMode}
              />
            </div>
            {debugMode && (
              <Badge className="bg-orange-100 text-orange-700 border-orange-300">
                ⚠️ Messages NOT being sent
              </Badge>
            )}
            {/* Clear Queue Button */}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear Queue
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-4">
              <Input
                placeholder="Search by customer, phone, or message..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
              <Button
                variant={filterMode === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterMode("all")}
              >
                All ({messages.length})
              </Button>
              <Button
                variant={filterMode === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterMode("pending")}
                className={filterMode === "pending" ? "bg-yellow-600 hover:bg-yellow-700" : ""}
              >
                Pending ({messages.filter((m) => m.status === "pending").length})
              </Button>
              <Button
                variant={filterMode === "error" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterMode("error")}
                className={filterMode === "error" ? "bg-red-600 hover:bg-red-700" : ""}
              >
                Error ({messages.filter((m) => m.status === "error").length})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
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
                    <TableHead className="w-16 text-right">Action</TableHead>
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
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setMessageToDelete(msg)
                            setShowDeleteMessageDialog(true)
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Queue Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <AlertDialogTitle>Clear Entire Queue?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="mt-4">
              This action will permanently delete <strong>all {messages.length} messages</strong> from the queue, including pending and error messages.
              <br />
              <br />
              <strong>⚠️ This cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleClearQueue}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? "Clearing..." : "Delete All Messages"}
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Single Message Dialog */}
      <AlertDialog open={showDeleteMessageDialog} onOpenChange={setShowDeleteMessageDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <AlertDialogTitle>Delete Message?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="mt-4">
              {messageToDelete && (
                <>
                  You are about to delete the message from <strong>{messageToDelete.customer.name}</strong> ({messageToDelete.phoneNumber}).
                  <br />
                  <br />
                  <div className="bg-gray-50 p-3 rounded-md my-3 text-sm text-gray-700">
                    "{messageToDelete.messageContent.substring(0, 150)}{messageToDelete.messageContent.length > 150 && "..."}"
                  </div>
                  <strong>⚠️ This cannot be undone.</strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => messageToDelete && handleDeleteMessage(messageToDelete.id)}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? "Deleting..." : "Delete Message"}
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}

