import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { storage } from "@/lib/storage"
import { getSocket, disconnectSocket } from "@/services/socket"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { Socket } from "socket.io-client"

interface UseWebSocketOptions {
  workspaceId: string | null
  userId?: string
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Error) => void
}

interface WebSocketMessage {
  id: string
  sessionId: string
  content: string
  sender: "customer" | "agent"
  timestamp: string
  workspaceId: string
}

interface WebSocketChat {
  sessionId: string
  customerId: string
  status: string
  lastMessage?: string
  lastMessageAt?: string
  unreadCount?: number
}

interface SupportTicketMessage {
  ticketId: string
  ticketCode: string
  subject: string
  messagePreview: string
  senderType: "CUSTOMER" | "ADMIN"
  timestamp: string
}

interface SupportTicketStatus {
  ticketId: string
  ticketCode: string
  subject: string
  oldStatus: string
  newStatus: string
  timestamp: string
}

/**
 * useWebSocket - Real-time chat updates via Socket.io
 *
 * Replaces polling with instant push notifications.
 * Automatically joins workspace room and invalidates queries on updates.
 *
 * Usage:
 * ```tsx
 * const { isConnected } = useWebSocket({
 *   workspaceId: currentWorkspace.id,
 *   userId: user.id
 * });
 * ```
 */
export function useWebSocket(options: UseWebSocketOptions) {
  const { workspaceId, userId, onConnect, onDisconnect, onError } = options

  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const queryClient = useQueryClient()

  // 🚨 FIX: Store callbacks in refs to avoid reconnections
  const onConnectRef = useRef(onConnect)
  const onDisconnectRef = useRef(onDisconnect)
  const onErrorRef = useRef(onError)

  // Update refs when callbacks change
  onConnectRef.current = onConnect
  onDisconnectRef.current = onDisconnect
  onErrorRef.current = onError

  useEffect(() => {
    if (!workspaceId) {
      logger.info("[WebSocket] Disconnecting - no workspace")
      disconnectSocket()
      socketRef.current = null
      setIsConnected(false)
      return
    }

    const socket = getSocket(workspaceId)
    if (!socket) {
      return
    }

    socketRef.current = socket

    // Connection handlers
    const handleConnect = () => {
      logger.info("[WebSocket] Connected:", socket.id)
      setIsConnected(true)

      // Join workspace room
      socket.emit("join-workspace", { workspaceId, userId })

      onConnectRef.current?.()
    }

    const handleDisconnect = (reason: string) => {
      logger.info("[WebSocket] Disconnected:", reason)
      setIsConnected(false)
      onDisconnectRef.current?.()
    }

    const handleConnectError = (error: Error) => {
      logger.error("[WebSocket] Connection error:", error)
      onErrorRef.current?.(error)
    }

    // Workspace joined confirmation
    const handleWorkspaceJoined = (data: { workspaceId: string }) => {
      logger.info("[WebSocket] Joined workspace:", data.workspaceId)
    }

    // New message received - invalidate message queries
    const handleNewMessage = (message: WebSocketMessage) => {
      logger.info("[WebSocket] New message:", message)
      const sessionId = storage.getSessionId()

      // Invalidate messages for this chat
      queryClient.invalidateQueries({
        queryKey: ["chat-messages", message.sessionId],
      })

      // 🔧 ChatPage uses load-more pagination - invalidate that cache too
      queryClient.invalidateQueries({
        queryKey: ["load-more-messages", message.sessionId],
      })

      // Invalidate chat list (to update last message preview)
      queryClient.invalidateQueries({
        queryKey: ["chats", sessionId],
      })

      // Also invalidate recent chats
      queryClient.invalidateQueries({
        queryKey: ["recent-chats", sessionId],
      })

      // 🔔 Show toast for messages in non-active chats
      // Check if message is for currently selected chat
      const currentChatSessionId = storage.getCurrentChatSessionId()
      if (
        message.sessionId !== currentChatSessionId &&
        message.sender === "customer"
      ) {
        // New message from customer in different chat
        toast.info("New message received", { duration: 2000 })
      }

      // 🔔 Notify in-tab listeners (useLoadMoreMessages) to reset pagination
      try {
        window.dispatchEvent(
          new CustomEvent("chat-messages-updated", {
            detail: { sessionId: message.sessionId },
          })
        )
      } catch (error) {
        logger.warn("[WebSocket] Failed to dispatch chat-messages-updated event", {
          error,
        })
      }
    }

    // Chat list updated (new chat, status change, etc.)
    const handleChatUpdated = (chat: WebSocketChat) => {
      logger.info("[WebSocket] Chat updated:", chat)
      const sessionId = storage.getSessionId()

      // 🔥 Force immediate refetch by invalidating AND refetching
      queryClient.invalidateQueries({
        queryKey: ["chats", sessionId],
        refetchType: "active", // Only refetch active queries
      })

      queryClient.invalidateQueries({
        queryKey: ["recent-chats", sessionId],
        refetchType: "active",
      })

      // 🔥 FORCE refetch to ensure UI updates immediately
      queryClient.refetchQueries({
        queryKey: ["chats", sessionId],
      })

      logger.info("[WebSocket] Chat list refetched after update event")
    }

    // User blocked event
    const handleUserBlocked = (data: {
      customerId: string
      customerName: string
      customerPhone: string
      timestamp: string
    }) => {
      logger.info("[WebSocket] User blocked:", data)
      const sessionId = storage.getSessionId()

      // Invalidate customer-related queries
      queryClient.invalidateQueries({
        queryKey: ["customers"],
      })
      queryClient.invalidateQueries({
        queryKey: ["chats", sessionId],
      })

      // Show warning toast
      toast.warning(`Customer ${data.customerName} has been blocked`)
    }

    // User unblocked event
    const handleUserUnblocked = (data: {
      customerId: string
      customerName: string
      customerPhone: string
      timestamp: string
    }) => {
      logger.info("[WebSocket] User unblocked:", data)
      const sessionId = storage.getSessionId()

      // Invalidate customer-related queries
      queryClient.invalidateQueries({
        queryKey: ["customers"],
      })
      queryClient.invalidateQueries({
        queryKey: ["chats", sessionId],
      })

      // Show success toast
      toast.success(`Customer ${data.customerName} has been unblocked`)
    }

    // New customer event
    const handleNewCustomer = (data: {
      customerId: string
      sessionId: string
      customerName: string
      customerPhone: string
      language?: string
      timestamp: string
    }) => {
      logger.info("[WebSocket] New customer:", data)
      const sessionId = storage.getSessionId()

      // Invalidate chat list and customer queries
      queryClient.invalidateQueries({
        queryKey: ["chats", sessionId],
      })
      queryClient.invalidateQueries({
        queryKey: ["recent-chats", sessionId],
      })
      queryClient.invalidateQueries({
        queryKey: ["customers"],
      })

      // Show info toast
      toast.info(`New customer: ${data.customerName || data.customerPhone}`)
    }

    // Workspace changed - invalidate ALL cached data
    const handleWorkspaceChanged = (data: { workspaceId: string }) => {
      logger.info("[WebSocket] Workspace changed:", data.workspaceId)
      // Invalidate all chat-related queries
      queryClient.invalidateQueries({
        queryKey: ["chats"],
      })
      queryClient.invalidateQueries({
        queryKey: ["chat-messages"],
      })
      queryClient.invalidateQueries({
        queryKey: ["recent-chats"],
      })
    }

    // Support ticket message received
    const handleSupportTicketMessage = (data: SupportTicketMessage) => {
      logger.info("[WebSocket] Support ticket message:", data)

      // Invalidate support tickets queries
      queryClient.invalidateQueries({
        queryKey: ["support-tickets"],
      })
      queryClient.invalidateQueries({
        queryKey: ["support-ticket", data.ticketId],
      })
      queryClient.invalidateQueries({
        queryKey: ["support-unread-count"],
      })

      // Show toast notification for admin replies
      if (data.senderType === "ADMIN") {
        toast.info(`New reply on ticket ${data.ticketCode}: ${data.subject}`, {
          duration: 5000,
        })
      }
    }

    // Support ticket status changed
    const handleSupportTicketStatus = (data: SupportTicketStatus) => {
      logger.info("[WebSocket] Support ticket status changed:", data)

      // Invalidate support tickets queries
      queryClient.invalidateQueries({
        queryKey: ["support-tickets"],
      })
      queryClient.invalidateQueries({
        queryKey: ["support-ticket", data.ticketId],
      })

      // Show toast notification
      const statusLabels: Record<string, string> = {
        PENDING: "Pending",
        IN_PROGRESS: "In Progress",
        CLOSED: "Closed",
      }
      toast.info(
        `Ticket ${data.ticketCode} status changed to ${statusLabels[data.newStatus] || data.newStatus}`,
        { duration: 4000 }
      )
    }

    socket.off("connect", handleConnect)
    socket.off("disconnect", handleDisconnect)
    socket.off("connect_error", handleConnectError)
    socket.off("workspace-joined", handleWorkspaceJoined)
    socket.off("new-message", handleNewMessage)
    socket.off("chat-updated", handleChatUpdated)
    socket.off("user-blocked", handleUserBlocked)
    socket.off("user-unblocked", handleUserUnblocked)
    socket.off("new-customer", handleNewCustomer)
    socket.off("workspace-changed", handleWorkspaceChanged)
    socket.off("support-ticket-message", handleSupportTicketMessage)
    socket.off("support-ticket-status", handleSupportTicketStatus)

    socket.on("connect", handleConnect)
    socket.on("disconnect", handleDisconnect)
    socket.on("connect_error", handleConnectError)
    socket.on("workspace-joined", handleWorkspaceJoined)
    socket.on("new-message", handleNewMessage)
    socket.on("chat-updated", handleChatUpdated)
    socket.on("user-blocked", handleUserBlocked)
    socket.on("user-unblocked", handleUserUnblocked)
    socket.on("new-customer", handleNewCustomer)
    socket.on("workspace-changed", handleWorkspaceChanged)
    socket.on("support-ticket-message", handleSupportTicketMessage)
    socket.on("support-ticket-status", handleSupportTicketStatus)

    // Cleanup on unmount or workspace change
    return () => {
      logger.info("[WebSocket] Cleaning up connection")
      socket.off("connect", handleConnect)
      socket.off("disconnect", handleDisconnect)
      socket.off("connect_error", handleConnectError)
      socket.off("workspace-joined", handleWorkspaceJoined)
      socket.off("new-message", handleNewMessage)
      socket.off("chat-updated", handleChatUpdated)
      socket.off("user-blocked", handleUserBlocked)
      socket.off("user-unblocked", handleUserUnblocked)
      socket.off("new-customer", handleNewCustomer)
      socket.off("workspace-changed", handleWorkspaceChanged)
      socket.off("support-ticket-message", handleSupportTicketMessage)
      socket.off("support-ticket-status", handleSupportTicketStatus)
    }
  }, [workspaceId, userId, queryClient]) // 🚨 FIX: Removed callback dependencies to prevent reconnections

  // Ping helper for connection health check
  const ping = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("ping")
    }
  }

  return {
    socket: socketRef.current,
    isConnected,
    ping,
  }
}
