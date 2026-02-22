import { ChatSurfaceMessage } from "@/components/chat/ChatSurface"

export type WidgetStoredMessage = {
  role: "user" | "bot"
  content: string
  timestamp?: string
  suggestions?: string[]
}

type WidgetSendInput = {
  apiUrl: string
  workspaceId: string
  visitorId: string
  message: string
  language?: string
  sessionId?: string | null
  customerId?: string | null
}

export type WidgetRegisterInput = {
  apiUrl: string
  workspaceId: string
  visitorId: string
  name: string
  phone: string
  email?: string
  language: string
  firstMessage: string
  pushNotificationsConsent?: boolean
}

const STORAGE_PREFIX = {
  visitorId: "echatbot-visitor-id",
  sessionId: "echatbot-session-id",
  messages: "echatbot-messages",
  customerId: "echatbot-customer-id", // Persists across visitorId expiry
}

export const buildWidgetStorageKeys = (workspaceId: string) => ({
  visitorId: `${STORAGE_PREFIX.visitorId}:${workspaceId}`,
  sessionId: `${STORAGE_PREFIX.sessionId}:${workspaceId}`,
  messages: `${STORAGE_PREFIX.messages}:${workspaceId}`,
  customerId: `${STORAGE_PREFIX.customerId}:${workspaceId}`, // No expiry - identifies returning users
})

export const mapWidgetMessages = (
  messages: WidgetStoredMessage[]
): ChatSurfaceMessage[] =>
  messages.map((message) => ({
    role: message.role,
    content: message.content,
    meta: message.suggestions ? { suggestions: message.suggestions } : undefined,
  }))

export const loadWidgetMessages = (
  storage: Storage,
  workspaceId: string
): WidgetStoredMessage[] => {
  const keys = buildWidgetStorageKeys(workspaceId)
  const stored = storage.getItem(keys.messages)
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const saveWidgetMessages = (
  storage: Storage,
  workspaceId: string,
  messages: WidgetStoredMessage[]
) => {
  const keys = buildWidgetStorageKeys(workspaceId)
  storage.setItem(keys.messages, JSON.stringify(messages))
}

export const loadCustomerId = (
  storage: Storage,
  workspaceId: string
): string | null => {
  const keys = buildWidgetStorageKeys(workspaceId)
  return storage.getItem(keys.customerId)
}

export const saveCustomerId = (
  storage: Storage,
  workspaceId: string,
  customerId: string
) => {
  const keys = buildWidgetStorageKeys(workspaceId)
  storage.setItem(keys.customerId, customerId)
}

export const getOrCreateVisitorId = (
  storage: Storage,
  workspaceId: string,
  now: () => number = Date.now,
  random: () => number = Math.random
) => {
  const keys = buildWidgetStorageKeys(workspaceId)
  const existing = storage.getItem(keys.visitorId)

  // Check if existing visitor ID is expired (older than 24 hours)
  if (existing) {
    const parts = existing.split("_")
    if (parts.length === 3) {
      const timestamp = parseInt(parts[1], 10)
      if (!isNaN(timestamp)) {
        const ageMs = now() - timestamp
        const ageHours = ageMs / (1000 * 60 * 60)

        // If less than 24 hours old, reuse it
        if (ageHours < 24) {
          return existing
        }

        // If expired, clear session data but NOT customerId
        // Registered users remain recognized across visitorId refresh cycles
        console.log("🧹 Visitor ID expired, generating new one (keeping customerId)")
        storage.removeItem(keys.visitorId)
        storage.removeItem(keys.sessionId)
        storage.removeItem(keys.messages)
        // keys.customerId intentionally kept → returning registered user is still recognized
      }
    }
  }

  // Generate new visitor ID
  const hash = random().toString(36).slice(2, 10)
  const visitorId = `visitor_${now()}_${hash}`
  storage.setItem(keys.visitorId, visitorId)
  return visitorId
}

export const loadWidgetSessionId = (
  storage: Storage,
  workspaceId: string
) => {
  const keys = buildWidgetStorageKeys(workspaceId)
  return storage.getItem(keys.sessionId)
}

export const saveWidgetSessionId = (
  storage: Storage,
  workspaceId: string,
  sessionId: string
) => {
  const keys = buildWidgetStorageKeys(workspaceId)
  storage.setItem(keys.sessionId, sessionId)
}

export const sendWidgetMessage = async ({
  apiUrl,
  workspaceId,
  visitorId,
  message,
  language,
  sessionId,
  customerId,
}: WidgetSendInput) => {
  const payload: Record<string, unknown> = {
    visitorId,
    message,
  }
  if (language) {
    payload.language = language
  }
  if (typeof sessionId === "string" && sessionId.length > 0) {
    payload.sessionId = sessionId
  }
  if (customerId) {
    payload.customerId = customerId
  }

  const response = await fetch(`${apiUrl}/widget/chat/${workspaceId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const messageText = data?.message || "Widget request failed"
    throw new Error(messageText)
  }

  if (!data?.response) {
    throw new Error("Widget response missing")
  }

  return {
    response: data.response as string,
    sessionId: data.sessionId as string | undefined,
    messageId: data.messageId as string | undefined,
    suggestions: Array.isArray(data.suggestions)
      ? (data.suggestions as string[]).slice(0, 4)
      : undefined,
  }
}

export const registerAndStartChat = async (input: WidgetRegisterInput) => {
  const { apiUrl, workspaceId, visitorId, name, phone, email, language, firstMessage, pushNotificationsConsent } = input

  const payload: Record<string, unknown> = {
    visitorId,
    name,
    phone,
    language,
    firstMessage,
  }
  if (email && email.length > 0) {
    payload.email = email
  }
  if (typeof pushNotificationsConsent === "boolean") {
    payload.pushNotificationsConsent = pushNotificationsConsent
  }

  const response = await fetch(`${apiUrl}/widget/register/${workspaceId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const messageText = data?.message || "Registration failed"
    throw new Error(messageText)
  }

  if (!data?.customerId || !data?.sessionId) {
    throw new Error("Registration response missing customerId or sessionId")
  }

  return {
    customerId: data.customerId as string,
    sessionId: data.sessionId as string,
    response: data.response as string,
    isNewCustomer: data.isNewCustomer as boolean,
    suggestions: Array.isArray(data.suggestions)
      ? (data.suggestions as string[]).slice(0, 4)
      : undefined,
  }
}

export const getWidgetStatus = async (input: {
  apiUrl: string
  workspaceId: string
  visitorId: string
  language?: string
}) => {
  const { apiUrl, workspaceId, visitorId, language } = input
  const query = new URLSearchParams({ visitorId })
  if (language) query.append("language", language)

  const response = await fetch(`${apiUrl}/widget/status/${workspaceId}?${query.toString()}`)
  if (!response.ok) throw new Error("Failed to fetch widget status")
  
  return await response.json()
}
