/**
 * Widget API Service
 * Client-side API calls for chat widget functionality
 */

import { api } from "./api"

const WIDGET_API_URL = "/api/v1/widget"
const STORAGE_PREFIX = {
  visitorId: "echatbot-visitor-id",
  sessionId: "echatbot-session-id",
  messages: "echatbot-messages",
  lastWorkspace: "echatbot-last-workspace-id",
}

const getWorkspaceKey = (base: string, workspaceId?: string) =>
  workspaceId ? `${base}:${workspaceId}` : base

const getStoredWorkspaceId = () =>
  localStorage.getItem(STORAGE_PREFIX.lastWorkspace) ||
  (window as any)?.eChatbotConfig?.workspaceId ||
  null

export interface WidgetMessage {
  role: "user" | "bot"
  content: string
  timestamp?: Date
}

export interface SendMessageRequest {
  workspaceId: string
  visitorId: string
  message: string
  language?: string
}

export interface SendMessageResponse {
  success: boolean
  response: string
  customerId?: string
  sessionId?: string
  error?: string
}

export interface ConvertVisitorRequest {
  workspaceId: string
  visitorId: string
  phone: string
  firstName: string
  lastName: string
  email?: string
  language?: string
}

export interface ConvertVisitorResponse {
  success: boolean
  customerId?: string
  message?: string
  error?: string
}

export interface ChatHistory {
  messages: WidgetMessage[]
  visitorId: string
  customerId?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Widget API Service
 */
export const widgetApi = {
  /**
   * Send message from widget
   * POST /api/v1/widget/message
   */
  async sendMessage(
    request: SendMessageRequest
  ): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${WIDGET_API_URL}/chat/${request.workspaceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          visitorId: request.visitorId,
          message: request.message,
          language: request.language || navigator.language || "en",
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(
          error.message || `Failed to send message (${response.status})`
        )
      }

      return await response.json()
    } catch (error) {
      console.error("Widget sendMessage error:", error)
      return {
        success: false,
        response: "",
        error:
          error instanceof Error ? error.message : "Failed to send message",
      }
    }
  },

  /**
   * Convert web visitor to registered customer
   * POST /api/v1/widget/convert-visitor
   */
  async convertVisitor(
    request: ConvertVisitorRequest
  ): Promise<ConvertVisitorResponse> {
    try {
      const response = await fetch(`${WIDGET_API_URL}/convert-visitor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: request.workspaceId,
          visitorId: request.visitorId,
          phone: request.phone,
          firstName: request.firstName,
          lastName: request.lastName,
          email: request.email || "",
          language: request.language || navigator.language || "en",
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(
          error.message || `Failed to convert visitor (${response.status})`
        )
      }

      return await response.json()
    } catch (error) {
      console.error("Widget convertVisitor error:", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to convert visitor",
      }
    }
  },

  /**
   * Get chat history (if authenticated)
   * GET /api/v1/widget/history/:customerId
   */
  async getChatHistory(customerId: string): Promise<ChatHistory | null> {
    try {
      const response = await api.get(
        `/widget/history/${customerId}`
      )
      return response.data as ChatHistory
    } catch (error) {
      console.error("Widget getChatHistory error:", error)
      return null
    }
  },

  /**
   * Get embed code snippet for website
   * GET /api/v1/workspaces/:workspaceId/widget/embed-code
   * Requires authentication
   */
  async getEmbedCode(
    workspaceId: string
  ): Promise<{ embedCode: string; workspaceId: string } | null> {
    try {
      const response = await api.get(
        `/workspaces/${workspaceId}/widget/embed-code`
      )
      return response.data
    } catch (error) {
      console.error("Widget getEmbedCode error:", error)
      return null
    }
  },

  /**
   * Get embed code as plain text file
   * GET /api/v1/workspaces/:workspaceId/widget/embed-code/text
   * Requires authentication
   */
  async downloadEmbedCode(workspaceId: string): Promise<void> {
    try {
      const response = await fetch(
        `/api/v1/workspaces/${workspaceId}/widget/embed-code/text`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to download embed code (${response.status})`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `echatbot-widget-${workspaceId}.js`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Widget downloadEmbedCode error:", error)
      throw error
    }
  },

  /**
   * Get visitor ID from localStorage
   */
  getVisitorId(workspaceId?: string): string | null {
    const resolvedWorkspaceId = workspaceId || getStoredWorkspaceId()
    return localStorage.getItem(
      getWorkspaceKey(STORAGE_PREFIX.visitorId, resolvedWorkspaceId || undefined)
    )
  },

  /**
   * Get stored chat messages from localStorage
   */
  getStoredMessages(workspaceId?: string): WidgetMessage[] {
    try {
      const resolvedWorkspaceId = workspaceId || getStoredWorkspaceId()
      const stored = localStorage.getItem(
        getWorkspaceKey(STORAGE_PREFIX.messages, resolvedWorkspaceId || undefined)
      )
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  },

  /**
   * Clear stored chat messages
   */
  clearStoredMessages(workspaceId?: string): void {
    const resolvedWorkspaceId = workspaceId || getStoredWorkspaceId()
    localStorage.removeItem(
      getWorkspaceKey(STORAGE_PREFIX.messages, resolvedWorkspaceId || undefined)
    )
    localStorage.removeItem(
      getWorkspaceKey(STORAGE_PREFIX.sessionId, resolvedWorkspaceId || undefined)
    )
  },

  /**
   * Check rate limit status
   * Returns retry-after seconds if rate limited, null if OK
   */
  isRateLimited(): number | null {
    const rateLimitKey = "echatbot-rate-limit"
    const stored = localStorage.getItem(rateLimitKey)

    if (stored) {
      const { retryAfter } = JSON.parse(stored)
      const now = Date.now()

      if (now < retryAfter) {
        return Math.ceil((retryAfter - now) / 1000)
      } else {
        localStorage.removeItem(rateLimitKey)
      }
    }

    return null
  },

  /**
   * Set rate limit (called when API returns 429)
   */
  setRateLimit(retryAfterSeconds: number): void {
    const rateLimitKey = "echatbot-rate-limit"
    const retryAfter = Date.now() + retryAfterSeconds * 1000
    localStorage.setItem(rateLimitKey, JSON.stringify({ retryAfter }))
  },
}

export default widgetApi
