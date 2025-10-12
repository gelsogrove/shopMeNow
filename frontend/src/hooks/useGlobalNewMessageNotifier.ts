import { useChat } from "@/contexts/ChatContext"
import { logger } from "@/lib/logger"
import { api } from "@/services/api"
import { useQuery } from "@tanstack/react-query"
import { useRef } from "react"
import { useNavigate } from "react-router-dom"
import { toast as sonnerToast } from "sonner"
import { pollingCoordinator } from "./usePollingCoordinator"

/**
 * Global hook that runs in the background on every page
 * to detect new messages and show toast notifications
 */
export function useGlobalNewMessageNotifier() {
  const { selectedChat } = useChat() // Get selected chat from context
  const navigate = useNavigate()
  // Track previous chats to detect new messages
  const previousChatsRef = useRef<
    Map<string, { lastMessage: string; lastMessageTime: string }>
  >(new Map())

  // 🚀 WEBSOCKET: No more polling - WebSocket handles real-time updates
  // This query is now DISABLED because WebSocket provides instant notifications
  const { data: allChats = [] } = useQuery({
    queryKey: ["global-chats"],
    queryFn: async () => {
      // Query is disabled, return empty array
      return []
    },
    enabled: false, // 🚨 DISABLED: WebSocket replaces polling
    staleTime: Infinity,
    gcTime: 0,
  })

  return allChats
}
