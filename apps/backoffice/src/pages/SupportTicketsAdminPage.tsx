/**
 * Support Tickets Admin Page - Backoffice
 *
 * Admin interface to manage customer support tickets:
 * - View all tickets
 * - Reply to customers
 * - Change ticket status
 * - View attachments
 */

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/lib/toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  MessageSquare,
  ArrowLeft,
  Send,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  Clock,
  User,
  Building2,
  CheckCircle,
  Trash2,
  Plus,
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import {
  SupportTicket,
  SupportMessage,
  SupportTicketStatus,
  SupportIssueType,
  getAllTickets,
  createAdminTicket,
  getTicket,
  addMessage,
  updateTicketStatus,
  deleteTicket,
  getIssueTypeLabel,
  getStatusColor,
  getStatusLabel,
} from "@/services/supportApi"
import { useAdminWebSocket } from "@/hooks/useAdminWebSocket"
import { api } from "@/services/api"

// Message Bubble Component
function MessageBubble({
  message,
  customerLabel,
  adminLabel,
}: {
  message: SupportMessage
  customerLabel: string
  adminLabel: string
}) {
  const isAdmin = message.senderType === "ADMIN"
  const senderLabel = isAdmin ? adminLabel : customerLabel

  return (
    <div className={`flex ${isAdmin ? "justify-end" : "justify-start"} mb-4`}>
      <div className="max-w-[80%]">
        <div
          className={`mb-1 flex items-center gap-2 text-xs ${
            isAdmin ? "justify-end text-purple-200" : "justify-start text-gray-500"
          }`}
        >
          <span className="font-medium">{senderLabel}</span>
          <span className="text-[10px] opacity-70">•</span>
          <span>{format(new Date(message.createdAt), "MMM d, yyyy h:mm a")}</span>
        </div>
        <div
          className={`rounded-2xl px-5 py-4 shadow-sm ${
            isAdmin
              ? "bg-purple-600 text-white rounded-br-sm"
              : "bg-gray-100 border border-gray-200 text-gray-900 rounded-bl-sm"
          }`}
        >
          <div
            className={`prose prose-sm max-w-none ${isAdmin ? "prose-invert [&_*]:text-white" : "[&_*]:text-gray-900"}`}
            style={{ fontSize: "0.95rem", lineHeight: "1.6" }}
            dangerouslySetInnerHTML={{ __html: message.content }}
          />

          {/* Attachments */}
          {message.attachments.length > 0 && (
            <div className={`mt-3 pt-3 border-t ${isAdmin ? "border-purple-400" : "border-gray-300"} space-y-2`}>
              {message.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 text-sm font-medium ${
                    isAdmin
                      ? "text-purple-100 hover:text-white"
                      : "text-blue-600 hover:text-blue-800"
                  }`}
                >
                  {att.mimeType.startsWith("image/") ? (
                    <ImageIcon className="w-4 h-4" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  {att.filename}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Ticket Detail View Component
function TicketDetailView({
  ticket,
  onBack,
  onStatusChange,
  onMessageSent,
  onDelete,
  deleting,
}: {
  ticket: SupportTicket
  onBack: () => void
  onStatusChange: (status: SupportTicketStatus) => void
  onMessageSent: (message: SupportMessage) => void
  onDelete: () => void
  deleting: boolean
}) {
  const [newMessage, setNewMessage] = useState("")
  const [attachments, setAttachments] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)

  const handleSend = async () => {
    if (!newMessage.trim() && attachments.length === 0) return

    setSending(true)
    try {
      const result = await addMessage(ticket.id, newMessage, attachments)
      onMessageSent(result.data)
      setNewMessage("")
      setAttachments([])
      toast.success("Reply sent successfully")
    } catch (error) {
      console.error("Failed to send message:", error)
      toast.error("Failed to send message")
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (newStatus: SupportTicketStatus) => {
    setChangingStatus(true)
    try {
      await updateTicketStatus(ticket.id, newStatus)
      onStatusChange(newStatus)
      toast.success(`Status updated to ${newStatus}`)
    } catch (error) {
      console.error("Failed to update status:", error)
      toast.error("Failed to update status")
    } finally {
      setChangingStatus(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter((f) => f.size <= 10 * 1024 * 1024) // 10MB max
    setAttachments((prev) => [...prev, ...validFiles].slice(0, 5)) // Max 5 files
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="flex items-start gap-4 pb-4 border-b">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold">{ticket.subject}</h2>
            <Badge className={getStatusColor(ticket.status)}>
              {getStatusLabel(ticket.status)}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {ticket.ticketCode}
            </span>
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {ticket.user.email}
            </span>
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {ticket.workspace?.name || "No Channel"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(ticket.createdAt))} ago
            </span>
          </div>
        </div>

        {/* Status Selector */}
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={deleting}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? "Deleting..." : "Delete"}
          </Button>
          <Select
            value={ticket.status}
            onValueChange={(v: string) => handleStatusChange(v as SupportTicketStatus)}
            disabled={changingStatus}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">
                <span className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-yellow-600" />
                  Pending
                </span>
              </SelectItem>
              <SelectItem value="IN_PROGRESS">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 text-blue-600" />
                  In Progress
                </span>
              </SelectItem>
              <SelectItem value="CLOSED">
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-gray-600" />
                  Closed
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Customer Info Card */}
      <div className="my-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-gray-500">Customer:</span>{" "}
            <strong>
              {ticket.user.firstName || ticket.user.lastName
                ? `${ticket.user.firstName || ""} ${ticket.user.lastName || ""}`.trim()
                : ticket.user.email}
            </strong>
          </div>
          <div>
            <span className="text-gray-500">Issue Type:</span>{" "}
            <Badge variant="outline">{getIssueTypeLabel(ticket.issueType)}</Badge>
          </div>
          <div>
            <span className="text-gray-500">Channel:</span>{" "}
            <span>{ticket.workspace?.name || "No Channel"}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4">
        {ticket.messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            customerLabel={
              [ticket.user?.firstName, ticket.user?.lastName].filter(Boolean).join(" ") ||
              ticket.user?.email ||
              "Customer"
            }
            adminLabel="Support"
          />
        ))}
      </div>

      {/* Reply Box */}
      <div className="border-t pt-4">
        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1 text-sm"
              >
                <span className="truncate max-w-[150px]">{file.name}</span>
                <button
                  onClick={() => removeAttachment(index)}
                  className="text-gray-500 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex-1">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your reply..."
              className="w-full min-h-[100px] p-2 border rounded"
            />
          </div>
          <div className="flex flex-col gap-2">
            <input
              type="file"
              id="attachments"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.txt"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => document.getElementById("attachments")?.click()}
              disabled={attachments.length >= 5}
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || (!newMessage.trim() && attachments.length === 0)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Ticket List Item Component
function TicketListItem({
  ticket,
  onClick,
}: {
  ticket: SupportTicket
  onClick: () => void
}) {
  const latestMessage = ticket.messages[0]
  const hasUnread = latestMessage?.senderType === "CUSTOMER" && !latestMessage.isRead

  return (
    <Card
      className={`cursor-pointer hover:bg-gray-50 transition-colors ${
        hasUnread ? "border-l-4 border-l-purple-500" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium truncate">{ticket.subject}</span>
              <Badge className={getStatusColor(ticket.status)} variant="secondary">
                {getStatusLabel(ticket.status)}
              </Badge>
              {hasUnread && (
                <Badge className="bg-purple-500 text-white">New</Badge>
              )}
            </div>
            <div className="text-sm text-gray-500 mb-1">
              {ticket.ticketCode} • {getIssueTypeLabel(ticket.issueType)} •{" "}
              {ticket.user.email}
            </div>
            <div className="text-xs text-gray-400 mb-2">
              Channel: {ticket.workspace?.name || "No Channel"}
            </div>
            {latestMessage && (
              <p className="text-sm text-gray-600 line-clamp-2">
                <span className="font-medium">
                  {latestMessage.senderType === "ADMIN" ? "You: " : ""}
                </span>
                <span
                  dangerouslySetInnerHTML={{
                    __html: latestMessage.content.replace(/<[^>]*>/g, " ").slice(0, 100),
                  }}
                />
              </p>
            )}
          </div>
          <div className="text-right text-sm text-gray-500 ml-4 flex-shrink-0">
            <div>{formatDistanceToNow(new Date(ticket.updatedAt))} ago</div>
            <div className="flex items-center justify-end gap-1 mt-1">
              <MessageSquare className="w-3 h-3" />
              {ticket._count.messages}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface AdminUserOption {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  ownedWorkspaces: Array<{ id: string; name: string }>
}

// Main Page Component
export default function SupportTicketsAdminPage() {
  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<SupportTicketStatus | "" | "ALL">("ALL")
  const [issueTypeFilter, setIssueTypeFilter] = useState<SupportIssueType | "" | "ALL">("ALL")
  const [deletingTicket, setDeletingTicket] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [usersLoading, setUsersLoading] = useState(false)
  const [users, setUsers] = useState<AdminUserOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("")
  const [newSubject, setNewSubject] = useState("")
  const [newMessage, setNewMessage] = useState("")
  const [creating, setCreating] = useState(false)

  // WebSocket for real-time updates
  useAdminWebSocket({
    onNewSupportTicket: (data) => {
      console.log("[SupportTickets] New ticket notification:", data)
      // Reload tickets when new one arrives
      loadTickets()
    },
  })

  const selectedUser = users.find((user) => user.id === selectedUserId) || null
  const workspaceOptions = selectedUser?.ownedWorkspaces || []

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const result = await api.users.getAll()
      console.log("📋 [Support] Users loaded:", result)
      if (result.success && result.data) {
        // Transform to AdminUserOption format
        const transformed: AdminUserOption[] = result.data.map((user) => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          ownedWorkspaces: user.ownedWorkspaces.map((ws) => ({
            id: ws.id,
            name: ws.name,
          })),
        }))
        console.log("✅ [Support] Transformed users:", transformed)
        setUsers(transformed)
      } else {
        toast.error(result.error || "Failed to load users")
      }
    } catch (error) {
      console.error("Failed to load users:", error)
      toast.error("Failed to load users")
    } finally {
      setUsersLoading(false)
    }
  }, []) // ✅ NO dependencies - stable reference

  useEffect(() => {
    if (createOpen) {
      loadUsers()
    }
  }, [createOpen, loadUsers])

  useEffect(() => {
    if (!selectedUser) {
      setSelectedWorkspaceId("")
      return
    }
    console.log("🏢 [Support] Selected user workspaces:", selectedUser.ownedWorkspaces)
    // Only auto-select if current selection is invalid, don't force selection
    if (selectedWorkspaceId && !selectedUser.ownedWorkspaces.some((ws) => ws.id === selectedWorkspaceId)) {
      console.log("⚠️ [Support] Invalid workspace selection, resetting to 'none'")
      setSelectedWorkspaceId("")
    }
  }, [selectedUser, selectedWorkspaceId])

  const loadTickets = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getAllTickets(
        page,
        20,
        statusFilter === "ALL" ? undefined : statusFilter,
        issueTypeFilter === "ALL" ? undefined : issueTypeFilter
      )
      setTickets(result.data.tickets)
      setTotalPages(result.data.totalPages)
    } catch (error) {
      console.error("Failed to load tickets:", error)
      toast.error("Failed to load support tickets")
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, issueTypeFilter])

  const loadTicketDetail = useCallback(async (id: string) => {
    try {
      const result = await getTicket(id)
      setSelectedTicket(result.data)
    } catch (error) {
      console.error("Failed to load ticket:", error)
      toast.error("Failed to load ticket details")
    }
  }, [])

  useEffect(() => {
    if (!selectedTicket) {
      loadTickets()
    }
  }, [loadTickets, selectedTicket])

  const handleTicketClick = (ticket: SupportTicket) => {
    loadTicketDetail(ticket.id)
  }

  const handleBack = () => {
    setSelectedTicket(null)
  }

  const handleStatusChange = (status: SupportTicketStatus) => {
    if (selectedTicket) {
      setSelectedTicket({ ...selectedTicket, status })
    }
  }

  const handleMessageSent = (message: SupportMessage) => {
    if (selectedTicket) {
      setSelectedTicket({
        ...selectedTicket,
        messages: [...selectedTicket.messages, message],
      })
    }
  }

  const handleDeleteTicket = useCallback(async () => {
    if (!selectedTicket || deletingTicket) return
    const confirmed = window.confirm(
      `Delete ticket ${selectedTicket.ticketCode}? This will remove all messages and attachments.`
    )
    if (!confirmed) return

    setDeletingTicket(true)
    try {
      await deleteTicket(selectedTicket.id)
      toast.success("Ticket deleted")
      setSelectedTicket(null)
      await loadTickets()
    } catch (error) {
      console.error("Failed to delete ticket:", error)
      toast.error("Failed to delete ticket")
    } finally {
      setDeletingTicket(false)
    }
  }, [selectedTicket, deletingTicket, loadTickets])

  const handleCreateTicket = async () => {
    if (!selectedUserId) {
      toast.error("Select a user")
      return
    }
    if (!newSubject.trim()) {
      toast.error("Subject is required")
      return
    }
    if (!newMessage.trim()) {
      toast.error("Message is required")
      return
    }

    setCreating(true)
    try {
      const result = await createAdminTicket({
        userId: selectedUserId,
        workspaceId: selectedWorkspaceId || undefined,
        subject: newSubject.trim(),
        message: newMessage,
      })
      toast.success("Support message sent")
      setCreateOpen(false)
      setSelectedUserId("")
      setSelectedWorkspaceId("")
      setNewSubject("")
      setNewMessage("")
      setSelectedTicket(result.data)
    } catch (error) {
      console.error("Failed to create ticket:", error)
      toast.error("Failed to send support message")
    } finally {
      setCreating(false)
    }
  }

  // Detail View
  if (selectedTicket) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-6">
            <TicketDetailView
              ticket={selectedTicket}
              onBack={handleBack}
              onStatusChange={handleStatusChange}
              onMessageSent={handleMessageSent}
              onDelete={handleDeleteTicket}
              deleting={deletingTicket}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  // List View
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Support Tickets
              </CardTitle>
              <CardDescription>
                Manage and respond to customer support requests
              </CardDescription>
            </div>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Support Message
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Dialog open={createOpen} onOpenChange={(open) => {
            setCreateOpen(open)
            if (!open) {
              // Reset form when closing modal
              setSelectedUserId("")
              setSelectedWorkspaceId("")
              setNewSubject("")
              setNewMessage("")
            }
          }}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>New Support Message</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>Recipient</Label>
                  <Select
                    value={selectedUserId}
                    onValueChange={(value) => {
                      console.log("👤 [Support] User changed:", value)
                      setSelectedUserId(value)
                      setSelectedWorkspaceId("") // Reset workspace when user changes
                    }}
                    disabled={usersLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={usersLoading ? "Loading users..." : "Select a user"} />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName || user.lastName
                            ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                            : user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Workspace (optional)</Label>
                  <Select
                    value={selectedWorkspaceId || "none"}
                    onValueChange={(value) => {
                      console.log("🔄 [Support] Workspace changed:", value)
                      setSelectedWorkspaceId(value === "none" ? "" : value)
                    }}
                    disabled={!selectedUser || workspaceOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        !selectedUser 
                          ? "Select a user first" 
                          : workspaceOptions.length === 0 
                            ? "User has no workspaces" 
                            : "Select a workspace"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No workspace</SelectItem>
                      {workspaceOptions.map((ws) => (
                        <SelectItem key={ws.id} value={ws.id}>
                          {ws.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedUser && (
                    <p className="text-xs text-gray-500">
                      {workspaceOptions.length} workspace{workspaceOptions.length !== 1 ? 's' : ''} available
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="support-subject">Subject</Label>
                  <Input
                    id="support-subject"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="Support message subject"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Message</Label>
                  <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="w-full min-h-[150px] p-2 border rounded" />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={handleCreateTicket}
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Message"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <Select
              value={statusFilter || "ALL"}
              onValueChange={(v: string) => {
                setStatusFilter(v as SupportTicketStatus | "ALL")
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={issueTypeFilter || "ALL"}
              onValueChange={(v: string) => {
                setIssueTypeFilter(v as SupportIssueType | "ALL")
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All issue types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All issue types</SelectItem>
                <SelectItem value="ACCOUNT_ISSUE">Account Issue</SelectItem>
                <SelectItem value="PLAN_AND_BILLING">Plan & Billing</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="WIDGET">Widget</SelectItem>
                <SelectItem value="SALES_AGENT">Sales Agent</SelectItem>
                <SelectItem value="SUPPORT">Support Message</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">No support tickets</p>
              <p className="text-sm">
                Support tickets from customers will appear here
              </p>
            </div>
          ) : (
            <>
              {/* Open Tickets Section */}
              {(() => {
                const openTickets = tickets.filter(
                  (t) => t.status === "PENDING" || t.status === "IN_PROGRESS"
                )
                return openTickets.length > 0 ? (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Open Tickets ({openTickets.length})
                    </h3>
                    <div className="space-y-3">
                      {openTickets.map((ticket) => (
                        <TicketListItem
                          key={ticket.id}
                          ticket={ticket}
                          onClick={() => handleTicketClick(ticket)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null
              })()}

              {/* Closed Tickets Section */}
              {(() => {
                const closedTickets = tickets.filter((t) => t.status === "CLOSED")
                return closedTickets.length > 0 ? (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-600">
                      <CheckCircle className="w-5 h-5 text-gray-400" />
                      Closed Tickets ({closedTickets.length})
                    </h3>
                    <div className="space-y-3 opacity-75">
                      {closedTickets.map((ticket) => (
                        <TicketListItem
                          key={ticket.id}
                          ticket={ticket}
                          onClick={() => handleTicketClick(ticket)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null
              })()}
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
