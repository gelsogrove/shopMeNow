/**
 * Support Tickets API for Backoffice (Admin)
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1"

// Types
export type SupportIssueType =
  | "ACCOUNT_ISSUE"
  | "PLAN_AND_BILLING"
  | "WHATSAPP"
  | "WIDGET"
  | "SALES_AGENT"
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

// Helper to get token from localStorage
const getToken = (): string | null => {
  return localStorage.getItem("backoffice_token")
}

// API Functions

/**
 * Get all support tickets (admin)
 */
export const getAllTickets = async (
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

  const response = await fetch(
    `${API_BASE}/admin/support/tickets?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
      },
    }
  )

  if (!response.ok) {
    throw new Error("Failed to fetch tickets")
  }

  return response.json()
}

/**
 * Get a specific ticket by ID
 */
export const getTicket = async (
  ticketId: string
): Promise<{ success: boolean; data: SupportTicket }> => {
  const response = await fetch(`${API_BASE}/admin/support/tickets/${ticketId}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    throw new Error("Failed to fetch ticket")
  }

  return response.json()
}

/**
 * Add a message to a ticket (admin reply)
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

  const response = await fetch(
    `${API_BASE}/admin/support/tickets/${ticketId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
      body: formData,
    }
  )

  if (!response.ok) {
    throw new Error("Failed to send message")
  }

  return response.json()
}

/**
 * Update ticket status
 */
export const updateTicketStatus = async (
  ticketId: string,
  status: SupportTicketStatus
): Promise<{ success: boolean; data: SupportTicket }> => {
  const response = await fetch(
    `${API_BASE}/admin/support/tickets/${ticketId}/status`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    }
  )

  if (!response.ok) {
    throw new Error("Failed to update status")
  }

  return response.json()
}

/**
 * Get unread count for admin
 */
export const getUnreadCount = async (): Promise<{
  success: boolean
  data: { unreadCount: number }
}> => {
  const response = await fetch(
    `${API_BASE}/admin/support/tickets/unread-count`,
    {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
      },
    }
  )

  if (!response.ok) {
    throw new Error("Failed to get unread count")
  }

  return response.json()
}

// Helper functions

export const getIssueTypeLabel = (type: SupportIssueType): string => {
  const labels: Record<SupportIssueType, string> = {
    ACCOUNT_ISSUE: "Account Issue",
    PLAN_AND_BILLING: "Plan & Billing",
    WHATSAPP: "WhatsApp",
    WIDGET: "Widget",
    SALES_AGENT: "Sales Agent",
    OTHER: "Other",
  }
  return labels[type] || type
}

export const getStatusColor = (status: SupportTicketStatus): string => {
  const colors: Record<SupportTicketStatus, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    CLOSED: "bg-gray-100 text-gray-800",
  }
  return colors[status] || "bg-gray-100 text-gray-800"
}

export const getStatusLabel = (status: SupportTicketStatus): string => {
  const labels: Record<SupportTicketStatus, string> = {
    PENDING: "Pending",
    IN_PROGRESS: "In Progress",
    CLOSED: "Closed",
  }
  return labels[status] || status
}
