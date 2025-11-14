import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { io, Socket } from "socket.io-client"

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
    // Don't connect if no workspace
    if (!workspaceId) {
      if (socketRef.current) {
        logger.info("[WebSocket] Disconnecting - no workspace")
        socketRef.current.disconnect()
        socketRef.current = null
        setIsConnected(false)
      }
      return
    }

    // 🚨 FIX: Don't create new socket if already connected to same workspace
    if (socketRef.current?.connected) {
      logger.info("[WebSocket] Already connected, reusing existing socket")
      return
    }

    logger.info("[WebSocket] Creating new socket connection")
    // Create socket connection
    const socket = io(import.meta.env.VITE_API_URL || "http://localhost:3001", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    socketRef.current = socket

    // Connection handlers
    socket.on("connect", () => {
      logger.info("[WebSocket] Connected:", socket.id)
      setIsConnected(true)

      // Join workspace room
      socket.emit("join-workspace", { workspaceId, userId })

      onConnectRef.current?.()
    })

    socket.on("disconnect", (reason) => {
      logger.info("[WebSocket] Disconnected:", reason)
      setIsConnected(false)
      onDisconnectRef.current?.()
    })

    socket.on("connect_error", (error) => {
      logger.error("[WebSocket] Connection error:", error)
      onErrorRef.current?.(error)
    })

    // Workspace joined confirmation
    socket.on("workspace-joined", (data: { workspaceId: string }) => {
      logger.info("[WebSocket] Joined workspace:", data.workspaceId)
    })

    // New message received - invalidate message queries
    socket.on("new-message", (message: WebSocketMessage) => {
      logger.info("[WebSocket] New message:", message)
      // Get sessionId from sessionStorage
      const sessionId = sessionStorage.getItem("sessionId")

      // Invalidate messages for this chat
      queryClient.invalidateQueries({
        queryKey: ["chat-messages", message.sessionId],
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
      const currentChatSessionId = sessionStorage.getItem(
        "currentChatSessionId"
      )
      if (
        message.sessionId !== currentChatSessionId &&
        message.sender === "customer"
      ) {
        // New message from customer in different chat
        toast.info("New message received", { duration: 2000 })
      }
    })

    // Chat list updated (new chat, status change, etc.)
    socket.on("chat-updated", (chat: WebSocketChat) => {
      logger.info("[WebSocket] Chat updated:", chat)
      // Get sessionId from sessionStorage
      const sessionId = sessionStorage.getItem("sessionId")

      // Invalidate chat list
      queryClient.invalidateQueries({
        queryKey: ["chats", sessionId],
      })

      // Invalidate recent chats
      queryClient.invalidateQueries({
        queryKey: ["recent-chats", sessionId],
      })
    })

    // User blocked event
    socket.on(
      "user-blocked",
      (data: {
        customerId: string
        customerName: string
        customerPhone: string
        timestamp: string
      }) => {
        logger.info("[WebSocket] User blocked:", data)
        const sessionId = sessionStorage.getItem("sessionId")

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
    )

    // User unblocked event
    socket.on(
      "user-unblocked",
      (data: {
        customerId: string
        customerName: string
        customerPhone: string
        timestamp: string
      }) => {
        logger.info("[WebSocket] User unblocked:", data)
        const sessionId = sessionStorage.getItem("sessionId")

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
    )

    // New customer event
    socket.on(
      "new-customer",
      (data: {
        customerId: string
        sessionId: string
        customerName: string
        customerPhone: string
        language?: string
        timestamp: string
      }) => {
        logger.info("[WebSocket] New customer:", data)
        const sessionId = sessionStorage.getItem("sessionId")

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
    )

    // Workspace changed - invalidate ALL cached data
    socket.on("workspace-changed", (data: { workspaceId: string }) => {
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
    })

    // Cleanup on unmount or workspace change
    return () => {
      logger.info("[WebSocket] Cleaning up connection")
      socket.off("connect")
      socket.off("disconnect")
      socket.off("connect_error")
      socket.off("workspace-joined")
      socket.off("new-message")
      socket.off("chat-updated")
      socket.off("user-blocked")
      socket.off("user-unblocked")
      socket.off("new-customer")
      socket.off("workspace-changed")
      socket.disconnect()
      socketRef.current = null
      setIsConnected(false)
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
