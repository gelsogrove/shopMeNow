import { logger } from "@/lib/logger"
import { api } from "@/services/api"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"

interface Message {
  id: string
  content: string
  sender: "user" | "customer"
  timestamp: string
  agentName?: string
  metadata?: {
    isOperatorMessage?: boolean
    isOperatorControl?: boolean
    agentSelected?: string
  }
}

interface LoadMoreMessagesResponse {
  data: Message[]
  hasMore: boolean
  total: number
  page: number
  limit: number
}

/**
 * Hook to fetch messages with manual pagination via "Load" button
 * Shows 50 messages per page with ability to load previous messages
 */
export function useLoadMoreMessages(
  sessionId: string | null,
  enabled: boolean = true,
  scrollContainerRef?: React.RefObject<HTMLDivElement>
) {
  const [page, setPage] = useState(1)
  const [allMessages, setAllMessages] = useState<Message[]>([])
  const queryClient = useQueryClient()
  const firstMessageIdRef = useRef<string | null>(null)
  const prevSessionIdRef = useRef<string | null>(null)

  const refreshMessages = useCallback(() => {
    if (!sessionId) return
    logger.info(`🔄 Refreshing messages for session ${sessionId} (reset to page 1)`)
    setPage(1)
    setAllMessages([])
    firstMessageIdRef.current = null
    queryClient.invalidateQueries({
      queryKey: ["load-more-messages", sessionId],
    })
  }, [queryClient, sessionId])

  // 🔧 FIX: Reset state when sessionId changes (customer switched)
  useEffect(() => {
    if (sessionId !== prevSessionIdRef.current) {
      logger.info(`🔄 Session changed from ${prevSessionIdRef.current} to ${sessionId}, resetting messages`)
      setPage(1)
      setAllMessages([])
      firstMessageIdRef.current = null
      prevSessionIdRef.current = sessionId
    }
  }, [sessionId])

  // Listen for updates from other tabs via localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "chat-messages-updated" && e.newValue) {
        const data = JSON.parse(e.newValue)
        if (data.sessionId === sessionId) {
          logger.info(
            "📥 Received chat messages update from another tab for session",
            sessionId
          )
          refreshMessages()
        }
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [refreshMessages, sessionId])

  // Listen for in-tab refresh events (triggered by WebSocket handler)
  useEffect(() => {
    const handleChatRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: string }>).detail
      if (!detail?.sessionId || detail.sessionId !== sessionId) return
      logger.info(
        "📥 Received in-tab chat refresh event for session",
        sessionId
      )
      refreshMessages()
    }

    window.addEventListener("chat-messages-updated", handleChatRefresh as EventListener)
    return () => {
      window.removeEventListener(
        "chat-messages-updated",
        handleChatRefresh as EventListener
      )
    }
  }, [refreshMessages, sessionId])

  // Fetch messages for current page
  const {
    data: currentPageData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["load-more-messages", sessionId, page],
    queryFn: async () => {
      if (!sessionId) {
        return null
      }

      try {
        logger.info(
          `Fetching messages for session: ${sessionId}, page: ${page}`
        )

        // API endpoint with pagination params
        const response = await api.get(`/chat/${sessionId}/messages`, {
          params: {
            page,
            limit: 50,
          },
        })

        if (response.data.success) {
          const messages: Message[] = response.data.data.map(
            (message: any) => ({
              id: message.id,
              content: message.content,
              sender: message.direction === "INBOUND" ? "customer" : "user",
              timestamp: message.createdAt || new Date().toISOString(),
              agentName: message.metadata?.agentName,
              metadata: message.metadata,
            })
          )

          logger.info(
            `Loaded ${messages.length} messages for session ${sessionId}, page ${page}. HasMore: ${response.data.hasMore}`
          )

          return {
            messages,
            hasMore: response.data.hasMore,
            total: response.data.total,
            page: response.data.page,
            limit: response.data.limit,
          }
        }

        return null
      } catch (error) {
        logger.error("Error fetching messages:", error)
        throw error
      }
    },
    enabled: !!sessionId && enabled,
    staleTime: 0,
    gcTime: 300000, // Keep in cache for 5 minutes
    refetchInterval: 10000, // Fallback polling every 10s when WebSocket misses events
    refetchOnWindowFocus: false,
  })

  // Update allMessages when currentPageData changes
  useEffect(() => {
    if (currentPageData?.messages) {
      // When loading a new page, prepend the new messages to maintain chronological order
      setAllMessages((prev) => {
        // Save the ID of the first existing message before adding new ones
        if (prev.length > 0 && page > 1) {
          firstMessageIdRef.current = prev[0].id
        }

        // 🔧 FIX: Merge new messages with existing ones, avoiding duplicates
        const newMessages = currentPageData.messages
        const existingIds = new Set(prev.map(m => m.id))
        const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id))
        
        // Combine: new unique messages + existing messages (maintaining chronological order)
        const combined = [...uniqueNewMessages, ...prev]
        
        // Final deduplication pass (safety net)
        const seen = new Set<string>()
        return combined.filter(m => {
          if (seen.has(m.id)) return false
          seen.add(m.id)
          return true
        })
      })
    }
  }, [currentPageData?.messages, page])

  // Scroll to preserve position after new messages are loaded
  useEffect(() => {
    if (scrollContainerRef?.current && page > 1) {
      // When loading more messages (page > 1), scroll to the first message that was visible before
      // This prevents the chat from jumping to the bottom
      
      setTimeout(() => {
        if (!scrollContainerRef.current) return

        if (firstMessageIdRef.current) {
          // Find the element of the first old message
          const element = scrollContainerRef.current.querySelector(
            `[data-message-id="${firstMessageIdRef.current}"]`
          )

          if (element) {
            // Scroll to that element so user stays in context
            element.scrollIntoView({ behavior: "auto", block: "start" })
            logger.info(
              `📍 Scrolled to first old message: ${firstMessageIdRef.current}`
            )
          }
        } else if (allMessages.length > 0) {
          // If we don't have firstMessageIdRef (first load), scroll to the top boundary
          // so user can see where the older messages start
          scrollContainerRef.current.scrollTop = 0
          logger.info("📍 Scrolled to top after loading older messages")
        }
      }, 50) // Reduced delay for faster UI response
    }
  }, [allMessages, page, scrollContainerRef])

  // Function to load more (previous) messages
  const loadMore = useCallback(() => {
    logger.info(`Loading more messages - moving to page ${page + 1}`)
    setPage((p) => p + 1)
  }, [page])

  return {
    messages: allMessages,
    hasMore: currentPageData?.hasMore || false,
    total: currentPageData?.total || 0,
    page,
    limit: currentPageData?.limit || 50,
    isLoading: isLoading && page === 1, // Only show loading on first page
    isFetching,
    error,
    loadMore,
    refetch,
  }
}
