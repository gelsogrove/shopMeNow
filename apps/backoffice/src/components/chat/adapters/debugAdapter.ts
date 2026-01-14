import { ChatSurfaceMessage } from "@/components/chat/ChatSurface"

export type DebugSourceMessage = {
  id: string
  content: string
  sender: "user" | "customer" | "bot"
  timestamp?: string | Date
  agentName?: string
  translatedQuery?: string
  processedPrompt?: string
  deliveredAt?: string | null
  metadata?: Record<string, unknown>
}

export const mapDebugMessage = (
  message: DebugSourceMessage
): ChatSurfaceMessage => {
  const isCustomer = message.sender === "customer"
  return {
    id: message.id,
    content: message.content,
    role: isCustomer ? "user" : "bot",
    sender: isCustomer ? "customer" : "bot",
    agentName: message.agentName,
    translatedQuery: message.translatedQuery,
    processedPrompt: message.processedPrompt,
    deliveredAt: message.deliveredAt ?? null,
    metadata: message.metadata,
  }
}

export const mapDebugMessages = (
  messages: DebugSourceMessage[]
): ChatSurfaceMessage[] => messages.map(mapDebugMessage)
