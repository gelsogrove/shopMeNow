import { useChatList } from "@/contexts/ChatListContext"
import { logger } from "@/lib/logger"
import { api } from "@/services/api"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { pollingCoordinator } from "./usePollingCoordinator"

export function useRecentChats(
  isExternallyBlocked: boolean = false,
  onNewMessage?: (sessionId: string) => void,
  selectedChatId?: string | null
) {
  // SIMPLIFIED: No tab blocking, always poll
  const hasPollingLock = !isExternallyBlocked // Can poll if not externally blocked
  const queryClient = useQueryClient()
  const { setChats } = useChatList()

  // Listen for updates from other tabs via localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "chat-list-updated" && e.newValue) {
        logger.info("📥 Received chat list update from another tab")
        queryClient.invalidateQueries({ queryKey: ["chats"] })
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [queryClient])

  return useQuery({
    queryKey: ["chats"],
    queryFn: async () => {
      try {
        // First check if we have cached data
        const cachedData = pollingCoordinator.getCachedData()
        if (cachedData) {
          logger.info("📦 useRecentChats: Using cached data")
          return cachedData
        }

        // Check if we can make the API call
        if (!pollingCoordinator.canMakeCall("useRecentChats")) {
          logger.info("🚫 useRecentChats: API call blocked by coordinator")
          throw new Error("API call blocked by coordinator")
        }

        // Get current workspace ID from local storage
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

        if (!workspaceId) {
          pollingCoordinator.markCallCompleted("recent-chats")
          throw new Error("No workspace ID available")
        }

        logger.info("📡 useRecentChats: Making API call to /chat/recent")

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

          // Mark call as completed and cache the data
          pollingCoordinator.markCallCompleted("recent-chats", transformedChats)

          // Note: Global toast notifications are now handled by useGlobalNewMessageNotifier
          // in PageLayout - no need to duplicate here

          // Aggiorna immediatamente il context con i nuovi dati
          setChats(transformedChats)

          // Notify other tabs if this tab has the lock
          if (hasPollingLock) {
            localStorage.setItem("chat-list-updated", Date.now().toString())
            logger.info("📤 Notified other tabs about chat list update")
          }

          return transformedChats
        }

        throw new Error("Error loading chats - API response not successful")
      } catch (error) {
        // Make sure to mark call as completed even on error
        pollingCoordinator.markCallCompleted("recent-chats")
        logger.error("Error in useRecentChats:", error)
        throw error
      }
    },
    enabled: true, // Always enabled - polling is controlled by refetchInterval
    refetchInterval: hasPollingLock ? 15000 : false, // Poll every 15 seconds if we have the lock (increased from 10)
    refetchIntervalInBackground: true, // Allow background polling
    staleTime: 5000, // Data is fresh for 5 seconds (increased from 2)
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: hasPollingLock, // Refetch on focus if we have lock
  })
}
