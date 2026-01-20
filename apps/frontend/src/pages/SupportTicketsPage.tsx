import { useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Loader2,
  Plus,
  MessageSquare,
  ArrowLeft,
  Send,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  Trash2,
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { toast } from "@/lib/toast"
import { useWorkspace } from "@/hooks/use-workspace"
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole"
import { useNavigate, useParams } from "react-router-dom"
import { RichTextEditor, isRichTextEmpty } from "@/components/shared/RichTextEditor"
import {
  SupportTicket,
  SupportMessage,
  SupportIssueType,
  SupportTicketStatus,
  PaginatedTickets,
  getMyTickets,
  getTicket,
  createTicket,
  addMessage,
  deleteTicket,
  getIssueTypeLabel,
  getStatusColor,
  getStatusLabel,
} from "@/services/supportApi"

// Issue type options for dropdown
const ISSUE_TYPE_OPTIONS: { value: SupportIssueType; label: string }[] = [
  { value: "ACCOUNT_ISSUE", label: "Account Issue" },
  { value: "PLAN_AND_BILLING", label: "Plan & Billing" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "WIDGET", label: "Widget" },
  { value: "SALES_AGENT", label: "Sales Agent" },
  { value: "OTHER", label: "Other" },
]

// New Ticket Form Component
function NewTicketSheet({
  workspaceId,
  onCreated,
}: {
  workspaceId?: string // Optional - user may not have workspace selected
  onCreated: (ticket: SupportTicket) => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [issueType, setIssueType] = useState<SupportIssueType>("OTHER")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")

  const handleSubmit = async () => {
    if (!subject.trim() || isRichTextEmpty(message)) {
      toast.error("Please fill in all fields")
      return
    }

    setLoading(true)
    try {
      const result = await createTicket({
        workspaceId: workspaceId || undefined, // Optional
        issueType,
        subject: subject.trim(),
        message: message,
      })

      toast.success("Support ticket created successfully")
      onCreated(result.data)
      setOpen(false)
      setSubject("")
      setMessage("")
      setIssueType("OTHER")
    } catch (error) {
      console.error("Failed to create ticket:", error)
      toast.error("Failed to create support ticket")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" />
          New Ticket
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-slate-200 pb-4">
            <SheetTitle>Create Support Ticket</SheetTitle>
            <SheetDescription>
              Describe your issue and we&apos;ll get back to you as soon as possible.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto py-4 pr-1">
            <div className="space-y-2">
              <Label htmlFor="issueType">Issue Type</Label>
              <Select
                value={issueType}
                onValueChange={(v) => setIssueType(v as SupportIssueType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select issue type" />
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Brief description of your issue"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <RichTextEditor
                value={message}
                onChange={setMessage}
                placeholder="Describe your issue in detail..."
                minHeight="150px"
              />
            </div>
          </div>

          <SheetFooter className="border-t border-slate-200 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !subject.trim() || isRichTextEmpty(message)}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Submit Ticket
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  )
}

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
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const isCustomer = message.senderType === "CUSTOMER"
  const senderLabel = isCustomer ? customerLabel : adminLabel

  return (
    <div className={`flex ${isCustomer ? "justify-end" : "justify-start"} mb-4`}>
      <div className="max-w-[80%]">
        <div
          className={`mb-1 flex items-center gap-2 text-xs ${
            isCustomer ? "justify-end text-green-200" : "justify-start text-gray-500"
          }`}
        >
          <span className="font-medium">{senderLabel}</span>
          <span className="text-[10px] opacity-70">•</span>
          <span>{format(new Date(message.createdAt), "MMM d, yyyy h:mm a")}</span>
        </div>
        <div
          className={`rounded-2xl px-5 py-4 shadow-sm ${
            isCustomer
              ? "bg-green-500 text-white rounded-br-sm"
              : "bg-gray-100 border border-gray-200 text-gray-900 rounded-bl-sm"
          }`}
        >
          <div
            className={`prose prose-sm max-w-none ${isCustomer ? "prose-invert [&_*]:text-white" : "[&_*]:text-gray-900"}`}
            style={{ fontSize: "0.95rem", lineHeight: "1.6" }}
            dangerouslySetInnerHTML={{ __html: message.content }}
          />

          {/* Attachments */}
          {message.attachments.length > 0 && (
            <div className={`mt-3 pt-3 border-t ${isCustomer ? "border-green-400" : "border-gray-300"} space-y-2`}>
              {message.attachments.map((att) => (
                att.mimeType.startsWith("image/") ? (
                  <div key={att.id} className="mt-2">
                    <img
                      src={att.url}
                      alt={att.filename}
                      className="max-w-full max-h-60 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setImagePreview(att.url)}
                    />
                    <p className={`text-xs mt-1 ${isCustomer ? "text-green-200" : "text-gray-500"}`}>
                      {att.filename}
                    </p>
                  </div>
                ) : (
                  <a
                    key={att.id}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 text-sm font-medium ${
                      isCustomer
                        ? "text-green-100 hover:text-white"
                        : "text-blue-600 hover:text-blue-800"
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    {att.filename}
                  </a>
                )
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Image Preview Modal */}
      <Dialog open={!!imagePreview} onOpenChange={() => setImagePreview(null)}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center">
            <img
              src={imagePreview || ""}
              alt="Preview"
              className="max-w-full max-h-[70vh] object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Ticket Detail View Component
function TicketDetailView({
  ticket,
  onBack,
  onMessageSent,
  onDelete,
  deleting,
  isSuperAdmin = false,
}: {
  ticket: SupportTicket
  onBack: () => void
  onMessageSent: (message: SupportMessage) => void
  onDelete: () => void
  deleting: boolean
  isSuperAdmin?: boolean
}) {
  const [newMessage, setNewMessage] = useState("")
  const [attachments, setAttachments] = useState<File[]>([])
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (isRichTextEmpty(newMessage) && attachments.length === 0) return

    setSending(true)
    try {
      const result = await addMessage(ticket.id, newMessage, attachments)
      onMessageSent(result.data)
      setNewMessage("")
      setAttachments([])
      toast.success("Message sent")
    } catch (error) {
      console.error("Failed to send message:", error)
      toast.error("Failed to send message")
    } finally {
      setSending(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter((f) => f.size <= 10 * 1024 * 1024) // 10MB max

    if (validFiles.length !== files.length) {
      toast.error("Some files were too large (max 10MB)")
    }

    setAttachments((prev) => [...prev, ...validFiles].slice(0, 5)) // Max 5 files
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{ticket.subject}</h2>
            <Badge className={getStatusColor(ticket.status)}>
              {getStatusLabel(ticket.status)}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            {ticket.ticketCode} • {getIssueTypeLabel(ticket.issueType)} •
            Created {formatDistanceToNow(new Date(ticket.createdAt))} ago
            {ticket.user && (ticket.user.firstName || ticket.user.lastName) && (
              <> • Created by {[ticket.user.firstName, ticket.user.lastName].filter(Boolean).join(" ")}</>
            )}
          </p>
        </div>
        {isSuperAdmin && (
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
        )}
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

      {/* Reply Box (only if not closed) */}
      {ticket.status !== "CLOSED" && (
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
              <RichTextEditor
                value={newMessage}
                onChange={setNewMessage}
                placeholder="Type your reply..."
                minHeight="100px"
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
                disabled={
                  sending || (isRichTextEmpty(newMessage) && attachments.length === 0)
                }
                className="bg-green-600 hover:bg-green-700"
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
      )}

      {ticket.status === "CLOSED" && (
        <div className="border-t pt-4">
          <div className="text-center text-gray-500 py-4">
            This ticket has been closed. Create a new ticket if you need further assistance.
          </div>
        </div>
      )}
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
  const hasUnread = (ticket as any).hasUnreadMessages

  return (
    <Card
      className={`cursor-pointer transition-colors ${
        hasUnread 
          ? "bg-blue-50 hover:bg-blue-100 border-l-4 border-l-blue-500" 
          : "hover:bg-gray-50"
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`truncate ${hasUnread ? "font-bold" : "font-medium"}`}>
                {ticket.subject}
              </span>
              <Badge className={getStatusColor(ticket.status)} variant="secondary">
                {getStatusLabel(ticket.status)}
              </Badge>
            </div>
            <div className="text-sm text-gray-500 mb-2">
              {ticket.ticketCode} • {getIssueTypeLabel(ticket.issueType)}
            </div>
            {latestMessage && (
              <p className="text-sm text-gray-600 line-clamp-2">
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

// Main Page Component
export default function SupportTicketsPage() {
  const navigate = useNavigate()
  const { ticketId } = useParams<{ ticketId?: string }>()
  const { workspace } = useWorkspace()
  const { isSuperAdmin } = useWorkspaceRole(workspace?.id)

  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<SupportTicketStatus | "ALL">("ALL")
  const [deletingTicket, setDeletingTicket] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
  }, [ticketId])

  // Get workspace ID from current workspace
  const workspaceId = workspace?.id

  const loadTickets = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getMyTickets(
        page,
        20,
        statusFilter === "ALL" ? undefined : statusFilter
      )
      setTickets(result.data.tickets)
      setTotalPages(result.data.totalPages)
    } catch (error) {
      console.error("Failed to load tickets:", error)
      toast.error("Failed to load support tickets")
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  const loadTicketDetail = useCallback(async (id: string) => {
    try {
      const result = await getTicket(id)
      setSelectedTicket(result.data)
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === id
            ? { ...ticket, hasUnreadMessages: false }
            : ticket
        )
      )
      // Notify Header to refresh unread count (messages marked as read)
      window.dispatchEvent(new CustomEvent("support-ticket-viewed"))
    } catch (error) {
      console.error("Failed to load ticket:", error)
      toast.error("Failed to load ticket details")
    }
  }, [])

  useEffect(() => {
    if (ticketId) {
      loadTicketDetail(ticketId)
    } else {
      loadTickets()
      setSelectedTicket(null)
    }
  }, [ticketId, loadTickets, loadTicketDetail])

  const handleTicketClick = (ticket: SupportTicket) => {
    navigate(`/support/tickets/${ticket.id}`)
  }

  const handleBack = () => {
    navigate("/support/tickets")
  }

  const handleTicketCreated = (ticket: SupportTicket) => {
    navigate(`/support/tickets/${ticket.id}`)
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
      navigate("/support/tickets")
    } catch (error) {
      console.error("Failed to delete ticket:", error)
      toast.error("Failed to delete ticket")
    } finally {
      setDeletingTicket(false)
    }
  }, [selectedTicket, deletingTicket, navigate])

  // Detail View
  if (selectedTicket) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Support Tickets</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Track replies and stay updated on your requests
                </p>
              </div>
              <NewTicketSheet
                workspaceId={workspaceId}
                onCreated={handleTicketCreated}
              />
            </div>
          </div>
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardContent className="p-8">
              <TicketDetailView
                ticket={selectedTicket}
                onBack={handleBack}
                onMessageSent={handleMessageSent}
                onDelete={handleDeleteTicket}
                deleting={deletingTicket}
                isSuperAdmin={isSuperAdmin}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // List View
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Support Tickets</h1>
              <p className="mt-1 text-sm text-gray-500">
                Get help with your account, billing, or technical issues
              </p>
            </div>
            <NewTicketSheet
              workspaceId={workspaceId}
              onCreated={handleTicketCreated}
            />
          </div>
        </div>
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-6">
            {/* Filters */}
            {tickets.length > 0 && (
              <div className="flex items-center gap-4 mb-6">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
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
              </div>
            )}

            {/* Loading State */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">No support tickets yet</p>
                <p className="text-sm">
                  Create a new ticket to get help with any issues
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <TicketListItem
                    key={ticket.id}
                    ticket={ticket}
                    onClick={() => handleTicketClick(ticket)}
                  />
                ))}
              </div>
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
    </div>
  )
}
