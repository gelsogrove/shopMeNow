// Public contract between the ecolaundry chatbot and the host app
// (chat-engine, widget, playground, WhatsApp webhook). Anything in this
// file is part of the boundary — changing it will require updating the
// caller in apps/backend/src/.

export type ChatChannel = string

export type HistoryEntry = {
  role: 'user' | 'assistant'
  content: string
  /**
   * ISO timestamp of when this message was created. Optional for backward
   * compatibility — callers that don't provide it still work, but the agent
   * cannot apply time-based heuristics (e.g. "reuse location only if last
   * mention was within the last hour"). Always send it when available.
   */
  timestamp?: string
}

export type ChatbotInput = {
  userMessage: string
  userName: string
  channel: ChatChannel
  config: {
    workspaceId: string
    debugChannel: boolean
    isPlayground: boolean
    language?: 'it' | 'es' | 'pt' | 'en' | 'ca' | 'fr'
  }
  context: {
    sessionId: string
    customerId?: string
    phoneNumber?: string
    history: HistoryEntry[]
  }
}

/**
 * A single customer-profile field that changed during this turn.
 * The app uses these to update the customer record without polling.
 */
export type StatePatch = {
  key: 'name' | 'language' | 'phone' | 'company' | 'address' | 'notes'
  value: string
}

export type ChatbotOutput = {
  reply: string | null
  wipMessage?: string
  shouldEscalate: boolean
  escalationSummary?: string
  /** Comma-separated email list from settings.notificationEmails. Populated by the chatbot module so the host app can send the escalation email without reading settings itself. */
  notificationEmails?: string
  /** Notification channel from settings.operatorContactMethod ('email' or 'whatsapp'). Populated so the host app does not need to read settings or DB for custom chatbot tenants. */
  operatorContactMethod?: 'email' | 'whatsapp'
  /** Operator WhatsApp number from settings.operatorWhatsappNumber. Used when operatorContactMethod='whatsapp'. */
  operatorWhatsappNumber?: string
  error?: string
  /**
   * Customer-profile fields captured or updated during this turn.
   * Empty array when nothing changed. The app should upsert these
   * into the customer record on every response.
   */
  patches: StatePatch[]
  meta: {
    tokensUsed: number
    agentChain: string[]
    debug?: unknown
  }
}
