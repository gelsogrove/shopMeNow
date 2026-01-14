import { useEffect, useRef, useState } from "react"
import { getAdminSocket } from "@/services/socket"
import { Socket } from "socket.io-client"

interface SupportTicketNew {
  ticketId: string
  ticketCode: string
  subject: string
  issueType: string
  userEmail: string
  workspaceName: string
  timestamp: string
}

interface UseAdminWebSocketOptions {
  onNewSupportTicket?: (data: SupportTicketNew) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

/**
 * useAdminWebSocket - WebSocket hook for backoffice admin features
 * 
 * Connects to admin:support room to receive:
 * - New support ticket notifications
 * - Customer replies on tickets
 */
export function useAdminWebSocket(options: UseAdminWebSocketOptions = {}) {
  const { onNewSupportTicket, onConnect, onDisconnect } = options
  
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // Store callbacks in refs to avoid reconnection on change
  const onNewSupportTicketRef = useRef(onNewSupportTicket)
  const onConnectRef = useRef(onConnect)
  const onDisconnectRef = useRef(onDisconnect)

  onNewSupportTicketRef.current = onNewSupportTicket
  onConnectRef.current = onConnect
  onDisconnectRef.current = onDisconnect

  useEffect(() => {
    const socket = getAdminSocket()
    if (!socket) {
      return
    }

    socketRef.current = socket

    const handleConnect = () => {
      console.log("[WebSocket] Admin connected:", socket.id)
      setIsConnected(true)
      
      // Join admin support room
      socket.emit("join-admin-support", {})
      onConnectRef.current?.()
    }

    const handleDisconnect = (reason: string) => {
      console.log("[WebSocket] Admin disconnected:", reason)
      setIsConnected(false)
      onDisconnectRef.current?.()
    }

    const handleAdminSupportJoined = (data: { success: boolean }) => {
      console.log("[WebSocket] Joined admin:support room:", data.success)
    }

    const handleNewSupportTicket = (data: SupportTicketNew) => {
      console.log("[WebSocket] New support ticket:", data)
      onNewSupportTicketRef.current?.(data)
    }

    // Remove old listeners
    socket.off("connect", handleConnect)
    socket.off("disconnect", handleDisconnect)
    socket.off("admin-support-joined", handleAdminSupportJoined)
    socket.off("support-ticket-new", handleNewSupportTicket)

    // Add new listeners
    socket.on("connect", handleConnect)
    socket.on("disconnect", handleDisconnect)
    socket.on("admin-support-joined", handleAdminSupportJoined)
    socket.on("support-ticket-new", handleNewSupportTicket)

    // If already connected, join room
    if (socket.connected) {
      handleConnect()
    }

    return () => {
      socket.off("connect", handleConnect)
      socket.off("disconnect", handleDisconnect)
      socket.off("admin-support-joined", handleAdminSupportJoined)
      socket.off("support-ticket-new", handleNewSupportTicket)
    }
  }, [])

  return {
    socket: socketRef.current,
    isConnected,
  }
}
