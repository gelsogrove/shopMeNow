import { logger } from "@/lib/logger"
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
  isLoading: boolean
  isError: boolean
  error: Error | null
  isChatbotActive: boolean
  setIsChatbotActive: (isActive: boolean) => void
}

const ChatListContext = createContext<ChatListContextType | undefined>(
  undefined
)

export function ChatListProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<Error | null>(null)
  const [isChatbotActive, setIsChatbotActive] = useState<boolean>(true)
  const queryClient = useQueryClient()

  // Get current workspace ID from local storage (shared across tabs)
  const workspaceData = localStorage.getItem("currentWorkspace")
  let workspaceId = null

  if (workspaceData) {
    try {
      const workspace = JSON.parse(workspaceData)
      workspaceId = workspace.id
    } catch (e) {
      logger.error("Error parsing workspace data:", e)
    }
  }

  // Use React Query to handle chat list fetching
  // 🚀 WEBSOCKET: No polling - updates via WebSocket events
  // 🔑 KEY FIX: Include workspaceId in query key to isolate cache per workspace!
  const { data: chats = [], isLoading } = useQuery({
    queryKey: ["chats", workspaceId], // 🚨 FIX: workspaceId nella key!
    queryFn: async () => {
      try {
        if (!workspaceId) {
          throw new Error("No workspace ID available")
        }

        // Make API request with explicit header
        const response = await api.get("/chat/recent", {
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
            language: chat.context?.language || chat.customer?.language || "en", // Map to 'language' field
            companyName: chat.customer?.company || null,
            lastMessage: chat.lastMessage || "",
            lastMessageTime: chat.updatedAt || chat.createdAt,
            unreadCount: chat.unreadCount || 0,
            isActive: true,
            isFavorite: false,
            activeChatbot: chat.customer?.activeChatbot ?? true,
            isBlacklisted: chat.customer?.isBlacklisted ?? false, // Include blacklist status
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
    // 🚀 REMOVED: refetchInterval - WebSocket handles real-time updates
    staleTime: 60000, // Consider data fresh for 1 minute
    gcTime: 300000, // Keep in cache for 5 minutes
  })

  const updateChat = useCallback(
    (chatId: string, updates: Partial<Chat>) => {
      const currentChats = queryClient.getQueryData<Chat[]>(["chats"]) || []
      const newChats = currentChats.map((chat) => {
        if (chat.id === chatId || chat.sessionId === chatId) {
          return { ...chat, ...updates }
        }
        return chat
      })

      // Update React Query cache
      queryClient.setQueryData(["chats"], newChats)

      // Log per debug
      logger.info(`📝 Chat ${chatId} updated:`, updates)
    },
    [queryClient]
  )

  const updateActiveChatbot = useCallback(
    (chatId: string, isActive: boolean) => {
      updateChat(chatId, { activeChatbot: isActive })
      logger.info(`🤖 Chatbot status for ${chatId} set to: ${isActive}`)
    },
    [updateChat]
  )

  return (
    <ChatListContext.Provider
      value={{
        chats: chats || [],
        updateChat,
        updateActiveChatbot,
        isLoading,
        isError: !!error,
        error,
        isChatbotActive,
        setIsChatbotActive,
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
