import { io, Socket } from "socket.io-client"
import { storage } from "@/lib/storage"
import { logger } from "@/lib/logger"

let socket: Socket | null = null
let activeWorkspaceId: string | null = null

const resolveSocketUrl = () => {
  // Prefer explicit socket endpoint if provided
  const explicitSocket = import.meta.env.VITE_SOCKET_URL
  if (explicitSocket) return explicitSocket

  // If VITE_API_URL is set (often includes /api/v1), strip path to get origin
  const apiUrl = import.meta.env.VITE_API_URL
  if (apiUrl) {
    try {
      const parsed = new URL(apiUrl, window.location.origin)
      return parsed.origin
    } catch (err) {
      logger.warn("[WebSocket] Failed to parse VITE_API_URL for socket, falling back", { apiUrl, err })
    }
  }

  return window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : window.location.origin
}

export const getSocket = (workspaceId: string | null): Socket | null => {
  if (!workspaceId) {
    return null
  }

  if (socket && activeWorkspaceId === workspaceId) {
    return socket
  }

  if (socket) {
    socket.disconnect()
    socket = null
  }

  const socketUrl = resolveSocketUrl()
  logger.debug("[WebSocket] Connecting to:", socketUrl)

  socket = io(socketUrl, {
    auth: {
      token: storage.getToken(),
      sessionId: storage.getSessionId(),
    },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  })

  activeWorkspaceId = workspaceId
  return socket
}

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
    activeWorkspaceId = null
  }
}
