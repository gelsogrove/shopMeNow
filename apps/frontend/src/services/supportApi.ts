import { api } from "./api"

// Types for Support Tickets
export type SupportIssueType =
  | "ACCOUNT_ISSUE"
  | "PLAN_AND_BILLING"
  | "WHATSAPP"
  | "WIDGET"
  | "SALES_AGENT"
  | "SUPPORT"
  | "OTHER"

export type SupportTicketStatus = "PENDING" | "IN_PROGRESS" | "CLOSED"

export type SupportSenderType = "CUSTOMER" | "ADMIN"

export interface SupportAttachment {
  id: string
  messageId: string
  filename: string
  url: string
  mimeType: string
  size: number
  createdAt: string
}

export interface SupportMessage {
  id: string
  ticketId: string
  senderId: string
  senderType: SupportSenderType
  content: string
  isRead: boolean
  createdAt: string
  attachments: SupportAttachment[]
}

export interface SupportTicket {
  id: string
  ticketCode: string
  userId: string
  workspaceId: string | null // Optional - user may not have workspace
  issueType: SupportIssueType
  subject: string
  status: SupportTicketStatus
  createdAt: string
  updatedAt: string
  closedAt: string | null
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  }
  workspace: {
    id: string
    name: string
  } | null // Optional workspace
  messages: SupportMessage[]
  hasUnreadMessages?: boolean
  _count: {
    messages: number
  }
}

export interface PaginatedTickets {
  tickets: SupportTicket[]
  total: number
  page: number
  totalPages: number
}

export interface CreateTicketInput {
  workspaceId?: string // Optional - ticket can be created without workspace
  issueType: SupportIssueType
  subject: string
  message: string
}

// API Functions

/**
 * Create a new support ticket
 */
export const createTicket = async (
  input: CreateTicketInput
): Promise<{ success: boolean; data: SupportTicket }> => {
  const response = await api.post("/support/tickets", input)
  return response.data
}

/**
 * Get all tickets for current user
 */
export const getMyTickets = async (
  page: number = 1,
  limit: number = 20,
  status?: SupportTicketStatus,
  issueType?: SupportIssueType
): Promise<{ success: boolean; data: PaginatedTickets }> => {
  const params = new URLSearchParams()
  params.append("page", page.toString())
  params.append("limit", limit.toString())
  if (status) params.append("status", status)
  if (issueType) params.append("issueType", issueType)

  const response = await api.get(`/support/tickets?${params.toString()}`)
  return response.data
}

/**
 * Get a specific ticket by ID
 */
export const getTicket = async (
  ticketId: string
): Promise<{ success: boolean; data: SupportTicket }> => {
  const response = await api.get(`/support/tickets/${ticketId}`)
  return response.data
}

/**
 * Delete a ticket (owner only)
 */
export const deleteTicket = async (
  ticketId: string
): Promise<{ success: boolean; data: { id: string; ticketCode: string } }> => {
  const response = await api.delete(`/support/tickets/${ticketId}`)
  return response.data
}

/**
 * Add a message to a ticket
 */
export const addMessage = async (
  ticketId: string,
  message: string,
  attachments?: File[]
): Promise<{ success: boolean; data: SupportMessage }> => {
  const formData = new FormData()
  formData.append("message", message)

  if (attachments) {
    attachments.forEach((file) => {
      formData.append("attachments", file)
    })
  }

  const response = await api.post(
    `/support/tickets/${ticketId}/messages`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  )
  return response.data
}

/**
 * Get unread message count
 */
export const getUnreadCount = async (): Promise<{
  success: boolean
  data: { unreadCount: number }
}> => {
  const response = await api.get("/support/tickets/unread-count")
  return response.data
}

// Helper functions

/**
 * Get human-readable issue type label
 */
export const getIssueTypeLabel = (type: SupportIssueType): string => {
  const labels: Record<SupportIssueType, string> = {
    ACCOUNT_ISSUE: "Account Issue",
    PLAN_AND_BILLING: "Plan & Billing",
    WHATSAPP: "WhatsApp",
    WIDGET: "Widget",
    SALES_AGENT: "Sales Agent",
    SUPPORT: "Support Message",
    OTHER: "Other",
  }
  return labels[type] || type
}

/**
 * Get status badge color
 */
export const getStatusColor = (status: SupportTicketStatus): string => {
  const colors: Record<SupportTicketStatus, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    CLOSED: "bg-gray-100 text-gray-800",
  }
  return colors[status] || "bg-gray-100 text-gray-800"
}

/**
 * Get status label
 */
export const getStatusLabel = (status: SupportTicketStatus): string => {
  const labels: Record<SupportTicketStatus, string> = {
    PENDING: "Pending",
    IN_PROGRESS: "In Progress",
    CLOSED: "Closed",
  }
  return labels[status] || status
}
