import { io, Socket } from "socket.io-client"
import { storage } from "@/lib/storage"
import { logger } from "@/lib/logger"

let socket: Socket | null = null
let activeWorkspaceId: string | null = null

const resolveSocketUrl = () =>
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : window.location.origin)

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
