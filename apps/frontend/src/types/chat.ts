export interface MessageAttachment {
  id: string
  url: string
  kind: "IMAGE" | "DOCUMENT" | "AUDIO"
  mimeType: string
  filename?: string | null
  sizeBytes?: number
}

export interface Message {
  id: string
  content: string
  sender: "user" | "customer"
  timestamp: string
  agentName?: string
  reaction?: string | null // 😀 server-synced reaction emoji on this message
  attachments?: MessageAttachment[]
  deliveryStatus?: "not_queued" | "pending" | "sent" | "delivered" | "read" | "error" | "blocked"
  functionCalls?: Array<{
    functionName: string
    toolCall?: {
      function?: {
        name: string
        arguments: string
      }
    }
    result: any
    type?: string
    source?: string
    data?: any
  }>
  metadata?: {
    isOperatorMessage?: boolean
    isOperatorControl?: boolean
    agentSelected?: string
    sentBy?: string
    operatorId?: string
    debugInfo?: string // 🆕 JSON string with debug information
    functionCalls?: Array<{
      functionName: string
      arguments: Record<string, any>
      result: any
    }>
  }
}

export interface ShippingAddress {
  street?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

export interface Customer {
  id: string
  name: string
  email: string
  phone: string
  company?: string
  discount?: number
  language?: string
  notes?: string
  shippingAddress?: ShippingAddress
  activeChatbot?: boolean
}

export interface Chat {
  id: string
  sessionId: string
  customerId: string
  customerName: string
  customerPhone: string
  companyName?: string
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
  isActive: boolean
  isFavorite: boolean
  isBlacklisted?: boolean
  messages?: Message[]
  activeChatbot?: boolean
  language?: string
  channel?: "whatsapp" | "widget" // 🆕 Channel source (widget or whatsapp)
  isPlayground?: boolean
  tags?: string[] // Customer tags (e.g. vip, critical) shown as chips on the card
}
