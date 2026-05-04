// Public contract between the cliente-0 chatbot and the host app
// (chat-engine, widget, playground, WhatsApp webhook). Anything in this
// file is part of the boundary — changing it will require updating the
// caller in apps/backend/src/.

export type ChatChannel = string

export type HistoryEntry = {
  role: 'user' | 'assistant'
  content: string
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

export type ChatbotOutput = {
  reply: string | null
  wipMessage?: string
  shouldEscalate: boolean
  escalationSummary?: string
  error?: string
  meta: {
    tokensUsed: number
    agentChain: string[]
    debug?: unknown
  }
}
