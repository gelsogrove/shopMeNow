/**
 * debugAdapter — maps raw debug API messages to the ChatSurface display format.
 *
 * Used by the Debug Panel in ChatWidget.tsx to render agent responses
 * with agentName, translatedQuery, processedPrompt, and other metadata.
 *
 * 🚨 ALIGNMENT RULE: The debug view must stay in sync with:
 * 1. docs/flow-engine-architecture.md         — written architecture spec (source of truth for pipeline)
 * 2. apps/frontend/src/components/shared/AgentFlowDiagram.tsx — visual diagram shown to admin
 * When you add/rename agents or change pipeline metadata fields, update ALL THREE in the same commit.
 */
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
