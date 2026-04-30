export type ChatChannel = 'whatsapp' | 'widget' | 'playground'

export type ChatHistoryEntry = {
  role: 'user' | 'assistant'
  content: string
}

export type ChatbotInput = {
  userMessage: string
  userName: string
  channel: ChatChannel
  config: {
    workspaceId: string
    // channelActive, wipMessage, welcomeMessage are handled by the wrapper (invoke())
    // before chatbotFn is called — chatbotFn is pure LLM pipeline only.
    debugChannel: boolean
    isPlayground: boolean
    language?: 'it' | 'es' | 'pt' | 'en' | 'ca' | 'fr'
  }
  context: {
    sessionId: string
    customerId?: string
    phoneNumber?: string
    history: ChatHistoryEntry[]
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
