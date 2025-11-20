import { logger } from "@/lib/logger"
import { api } from "@/services/api"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

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
  enabled: boolean = true
) {
  const [page, setPage] = useState(1)
  const [allMessages, setAllMessages] = useState<Message[]>([])
  const queryClient = useQueryClient()

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
          // Reset to page 1 when new message arrives
          setPage(1)
          setAllMessages([])
          queryClient.invalidateQueries({
            queryKey: ["load-more-messages", sessionId],
          })
        }
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [queryClient, sessionId])

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
    staleTime: 60000, // Consider data fresh for 1 minute
    gcTime: 300000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
  })

  // Update allMessages when currentPageData changes
  useEffect(() => {
    if (currentPageData?.messages) {
      // When loading a new page, prepend the new messages to maintain chronological order
      setAllMessages((prev) => [
        ...currentPageData.messages,
        ...prev,
      ])
    }
  }, [currentPageData?.messages])

  // Function to load more (previous) messages
  const loadMore = () => {
    logger.info(`Loading more messages - moving to page ${page + 1}`)
    setPage((p) => p + 1)
  }

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
