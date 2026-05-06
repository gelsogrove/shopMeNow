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
