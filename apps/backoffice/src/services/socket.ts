import { io, Socket } from "socket.io-client"

let socket: Socket | null = null

const resolveSocketUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL
  if (apiUrl) return apiUrl
  
  // Fallback to same origin in production
  return window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : window.location.origin
}

export const getAdminSocket = (): Socket | null => {
  if (socket?.connected) {
    return socket
  }

  if (socket) {
    socket.disconnect()
    socket = null
  }

  const token = localStorage.getItem("token")
  if (!token) {
    console.warn("[WebSocket] No auth token, cannot connect")
    return null
  }

  const socketUrl = resolveSocketUrl()
  console.debug("[WebSocket] Connecting to:", socketUrl)

  socket = io(socketUrl, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  })

  return socket
}

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
