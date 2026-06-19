import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"
import { api } from "@/services/api"
import { Chat } from "@/types/chat"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react"

type ChatListContextType = {
  chats: Chat[]
  updateChat: (chatId: string, updates: Partial<Chat>) => void
  updateActiveChatbot: (chatId: string, isActive: boolean) => void
  refetch: () => Promise<void>
  isLoading: boolean
  isError: boolean
  error: Error | null
  isChatbotActive: boolean
  setIsChatbotActive: (isActive: boolean) => void
  enableFetching: () => void  // 🆕 Call this to start fetching chats
}

const ChatListContext = createContext<ChatListContextType | undefined>(
  undefined
)

export function ChatListProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<Error | null>(null)
  const [isChatbotActive, setIsChatbotActive] = useState<boolean>(true)
  const [fetchEnabled, setFetchEnabled] = useState<boolean>(false) // 🆕 Lazy loading
  const queryClient = useQueryClient()

  // Get current workspace ID from local storage (shared across tabs)
  const workspaceData = storage.getWorkspace<{ id?: string }>()
  const workspaceId = workspaceData?.id ?? null

  // Get sessionId from sessionStorage (unique per browser session)
  const sessionId = storage.getSessionId()

  // 🔍 DEBUG: Log query conditions
  logger.info("[ChatListContext] Query conditions:", {
    workspaceId,
    sessionId,
    fetchEnabled,
    queryEnabled: !!(workspaceId && fetchEnabled), // 🔥 FIX: Removed sessionId from condition
  })

  // Use React Query to handle chat list fetching
  // 🚀 WEBSOCKET: No polling - updates via WebSocket events
  // 🔑 KEY FIX: Include sessionId in query key to isolate cache per login session!
  // 🆕 LAZY: Only fetch when enableFetching() is called (e.g., in ChatPage)
  const {
    data: chats = [],
    isLoading,
    refetch: queryRefetch,
  } = useQuery({
    queryKey: ["chats", sessionId], // 🚨 FIX: sessionId nella key per cache isolation!
    enabled: !!(workspaceId && fetchEnabled), // 🔥 FIX: Removed sessionId - only need workspace + enable
    queryFn: async () => {
      try {
        if (!workspaceId) {
          throw new Error("No workspace ID available")
        }

        // Make API request with explicit header
        const response = await api.get("/chat/recent?limit=200", {
          headers: {
            "x-workspace-id": workspaceId,
          },
        })

        if (response.data.success) {
          // Transform the backend data to match frontend expectations
          const transformedChats = response.data.data.map((chat: any) => ({
            id: chat.id,
            sessionId: chat.id, // Map id to sessionId for frontend compatibility
            customerId: chat.customerId,
            customerName: chat.customer?.name || "Unknown Customer",
            customerPhone: chat.customer?.phone || "",
            // Keep language from backend if present; avoid browser fallback so we can infer country from phone
            language: chat.customer?.language || undefined,
            companyName: chat.customer?.company || null,
            lastMessage: chat.lastMessage || "",
            // Prefer the real last-message time (from ConversationMessage) so the
            // time filter and ordering reflect actual activity, not the (often
            // stale) session.updatedAt. Fall back for any legacy payloads.
            lastMessageTime:
              chat.lastMessageTime || chat.updatedAt || chat.createdAt,
            unreadCount: chat.unreadCount || 0,
            isActive: true,
            isFavorite: false,
            activeChatbot: chat.customer?.activeChatbot ?? true,
            isBlacklisted: chat.customer?.isBlacklisted ?? false, // Include blacklist status
            channel: chat.channel || "whatsapp", // 🆕 Include channel (widget or whatsapp)
            isPlayground: (chat as any).isPlayground ?? false,
            tags: chat.customer?.tags || [],
          }))

          return transformedChats
        } else {
          throw new Error(response.data.error || "Failed to fetch chats")
        }
      } catch (err) {
        const error = err as Error
        setError(error)
        throw error
      }
    },
    retry: false, // 🔥 FIX: Don't retry on session errors (axios interceptor handles redirect)
    staleTime: 0,
    gcTime: 300000, // Keep in cache for 5 minutes
    refetchInterval: 15000, // Fallback polling every 15s when WebSocket misses events
    refetchOnWindowFocus: true, // Refetch when tab becomes active
  })

  const updateChat = useCallback(
    (chatId: string, updates: Partial<Chat>) => {
      // 🔥 FIX: Use same query key as the query (with sessionId)
      const currentChats =
        queryClient.getQueryData<Chat[]>(["chats", sessionId]) || []
      const newChats = currentChats.map((chat) => {
        if (chat.id === chatId || chat.sessionId === chatId) {
          return { ...chat, ...updates }
        }
        return chat
      })

      // Update React Query cache with correct key
      queryClient.setQueryData(["chats", sessionId], newChats)

      // Log per debug
      logger.info(`📝 Chat ${chatId} updated:`, updates)
    },
    [queryClient, sessionId]
  )

  const updateActiveChatbot = useCallback(
    (chatId: string, isActive: boolean) => {
      updateChat(chatId, { activeChatbot: isActive })
      logger.info(`🤖 Chatbot status for ${chatId} set to: ${isActive}`)
    },
    [updateChat]
  )

  // 🆕 Enable fetching - call this when entering ChatPage
  const enableFetching = useCallback(() => {
    if (!fetchEnabled) {
      logger.info("[ChatListContext] 🚀 Enabling chat list fetching")
      setFetchEnabled(true)
    }
  }, [fetchEnabled])

  // Wrapper for refetch that returns Promise<void>
  const refetch = useCallback(async () => {
    logger.info("[ChatListContext] 🔄 Manual refetch triggered")
    await queryRefetch()
  }, [queryRefetch])

  return (
    <ChatListContext.Provider
      value={{
        chats: chats || [],
        updateChat,
        updateActiveChatbot,
        refetch,
        isLoading,
        isError: !!error,
        error,
        isChatbotActive,
        setIsChatbotActive,
        enableFetching,
      }}
    >
      {children}
    </ChatListContext.Provider>
  )
}

export function useChatList() {
  const context = useContext(ChatListContext)
  if (!context) {
    throw new Error("useChatList must be used within a ChatListProvider")
  }
  return context
}
