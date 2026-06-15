import React from "react"
import { MessageRenderer } from "@/components/shared/MessageRenderer"
import { cn } from "@/lib/utils"

type Alignment = "left" | "right"

export interface ChatSurfaceMessage {
  id?: string | number
  content: string
  role?: "user" | "bot"
  sender?: "customer" | "bot"
  metadata?: Record<string, unknown>
  agentName?: string
  deliveredAt?: string | null
  translatedQuery?: string | null
  processedPrompt?: string | null
}

interface ChatSurfaceProps<TMessage extends ChatSurfaceMessage = ChatSurfaceMessage> {
  messages: TMessage[]
  className?: string
  listClassName?: string
  emptyState?: React.ReactNode
  endRef?: React.RefObject<HTMLDivElement>
  getAlignment?: (message: TMessage) => Alignment
  getContainerClassName?: (message: TMessage) => string
  getBubbleClassName?: (message: TMessage) => string
  getBubbleStyle?: (message: TMessage) => React.CSSProperties | undefined
  renderBadge?: (message: TMessage) => React.ReactNode
  renderFooter?: (message: TMessage) => React.ReactNode
  renderDebug?: (message: TMessage) => React.ReactNode
  // Optional per-message content override. When it returns a non-null node, it
  // replaces the default <MessageRenderer> for that message (used for rich
  // cards like promo pushes). Returning null/undefined → default rendering.
  renderContent?: (message: TMessage) => React.ReactNode
}

const defaultAlignment = (message: ChatSurfaceMessage): Alignment => {
  const isAgent = message.role === "bot" || message.sender === "bot"
  return isAgent ? "right" : "left"
}

export function ChatSurface<TMessage extends ChatSurfaceMessage = ChatSurfaceMessage>({
  messages,
  className,
  listClassName,
  emptyState,
  endRef,
  getAlignment = defaultAlignment,
  getContainerClassName,
  getBubbleClassName,
  getBubbleStyle,
  renderBadge,
  renderFooter,
  renderDebug,
  renderContent,
}: ChatSurfaceProps<TMessage>) {
  if (!messages.length && emptyState) {
    return <div className={cn("flex items-center justify-center", className)}>{emptyState}</div>
  }

  return (
    <div className={cn("space-y-3", listClassName, className)}>
      {messages.map((message, index) => {
        const alignment = getAlignment(message)
        const containerClassName = getContainerClassName?.(message)
        const bubbleClassName = getBubbleClassName?.(message)
        const bubbleStyle = getBubbleStyle?.(message)
        const key = message.id ?? index

        return (
          <div
            key={key}
            className={cn(
              "flex mb-3",
              alignment === "right" ? "justify-end" : "justify-start",
              containerClassName
            )}
          >
            <div
              className={cn(
                "relative word-wrap break-words overflow-wrap-anywhere",
                bubbleClassName
              )}
              style={bubbleStyle}
            >
              {renderBadge?.(message)}
              {(() => {
                const custom = renderContent?.(message)
                if (custom != null && custom !== false) return custom
                return (
                  <div style={{ lineHeight: "1.7", fontSize: "0.95rem" }}>
                    <MessageRenderer content={message.content} variant="chat" />
                  </div>
                )
              })()}
              {renderFooter?.(message)}
              {renderDebug?.(message)}
            </div>
          </div>
        )
      })}
      {endRef && <div ref={endRef} />}
    </div>
  )
}

export default ChatSurface
