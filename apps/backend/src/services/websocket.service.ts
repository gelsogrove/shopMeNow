import { Server as HTTPServer } from "http"
import { Server as SocketIOServer } from "socket.io"
import logger from "../utils/logger"

const normalizeOrigin = (value?: string | null): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    return url.origin.toLowerCase()
  } catch (error) {
    logger.warn("Invalid CORS origin in websocket allowlist", { value, error })
    return null
  }
}

const parseEnvOrigins = (value?: string): string[] => {
  if (!value) return []
  return value
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => Boolean(origin))
}

const getAllowedOrigins = (): string[] => {
  const envOrigins = parseEnvOrigins(
    process.env.CORS_ORIGINS || process.env.CORS_ORIGIN
  )

  const defaultOrigins =
    process.env.NODE_ENV === "production"
      ? [
          process.env.FRONTEND_URL || "https://echatbot.ai",
          "https://www.echatbot.ai",
          process.env.BACKOFFICE_URL || "https://backoffice.echatbot.ai",
          "https://echatbot-backoffice-3497e777ec08.herokuapp.com",
        ]
      : [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:3002",
          "http://localhost:5173",
        ]

  return Array.from(
    new Set(
      [...defaultOrigins, ...envOrigins]
        .map((value) => normalizeOrigin(value))
        .filter((value): value is string => Boolean(value))
    )
  )
}

interface ClientMetadata {
  workspaceId: string
  userId?: string
  sessionId?: string
}

/**
 * WebSocketService - Real-time communication for chat updates
 *
 * Replaces polling with instant push notifications for:
 * - New messages in chats
 * - Chat list updates (new chats, status changes)
 * - Workspace switches (invalidates old data)
 *
 * Architecture:
 * - Each workspace gets its own Socket.io room
 * - Clients join rooms on workspace selection
 * - Events broadcast only to users in same workspace
 */
export class WebSocketService {
  private io: SocketIOServer | null = null
  private clientMetadata = new Map<string, ClientMetadata>()

  /**
   * Initialize Socket.io server attached to Express HTTP server
   */
  initialize(httpServer: HTTPServer): void {
    const allowedOrigins = getAllowedOrigins()
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          if (!origin) {
            return callback(null, true)
          }

          const normalized = normalizeOrigin(origin)
          if (!normalized) {
            return callback(null, false)
          }

          if (allowedOrigins.includes(normalized)) {
            return callback(null, true)
          }

          return callback(null, false)
        },
        methods: ["GET", "POST"],
        credentials: true,
      },
      // Ping every 25s, timeout after 20s
      pingInterval: 25000,
      pingTimeout: 20000,
    })

    this.io.on("connection", (socket) => {
      logger.info(`[WebSocket] Client connected: ${socket.id}`)

      // Client joins workspace room
      socket.on(
        "join-workspace",
        (data: { workspaceId: string; userId?: string }) => {
          const { workspaceId, userId } = data

          // Leave previous rooms
          const rooms = Array.from(socket.rooms).filter(
            (room) => room !== socket.id
          )
          rooms.forEach((room) => socket.leave(room))

          // Join new workspace room
          const roomName = `workspace:${workspaceId}`
          socket.join(roomName)

          // Store metadata
          this.clientMetadata.set(socket.id, { workspaceId, userId })

          logger.info(`[WebSocket] Client ${socket.id} joined ${roomName}`)
          socket.emit("workspace-joined", { workspaceId })
        }
      )

      // Admin joins support room (for receiving all support ticket notifications)
      socket.on("join-admin-support", (data: { userId?: string }) => {
        socket.join("admin:support")
        logger.info(`[WebSocket] Client ${socket.id} joined admin:support room`)
        socket.emit("admin-support-joined", { success: true })
      })

      // Client disconnects
      socket.on("disconnect", () => {
        this.clientMetadata.delete(socket.id)
        logger.info(`[WebSocket] Client disconnected: ${socket.id}`)
      })

      // Ping/pong for connection health
      socket.on("ping", () => {
        socket.emit("pong")
      })
    })

    logger.info("[WebSocket] Server initialized")
  }

  /**
   * Broadcast new message event to workspace
   */
  notifyNewMessage(workspaceId: string, message: any): void {
    if (!this.io) {
      logger.warn("[WebSocket] Cannot notify, server not initialized")
      return
    }

    const roomName = `workspace:${workspaceId}`
    this.io.to(roomName).emit("new-message", message)

    logger.info(`[WebSocket] Broadcasted new-message to ${roomName}`, {
      sessionId: message.sessionId,
      messageId: message.id,
    })
  }

  /**
   * Broadcast chat list update (new chat, status change, etc.)
   */
  notifyChatUpdated(workspaceId: string, chat: any): void {
    if (!this.io) {
      logger.warn("[WebSocket] Cannot notify, server not initialized")
      return
    }

    const roomName = `workspace:${workspaceId}`
    this.io.to(roomName).emit("chat-updated", chat)

    logger.info(`[WebSocket] Broadcasted chat-updated to ${roomName}`, {
      sessionId: chat.sessionId,
    })
  }

  /**
   * Broadcast customer blocked/unblocked event to workspace
   */
  notifyUserBlocked(
    workspaceId: string,
    data: {
      customerId: string
      customerName: string
      customerPhone: string
      isBlacklisted: boolean
      timestamp: string
    }
  ): void {
    if (!this.io) {
      logger.warn("[WebSocket] Cannot notify, server not initialized")
      return
    }

    const roomName = `workspace:${workspaceId}`
    const eventName = data.isBlacklisted ? "user-blocked" : "user-unblocked"

    this.io.to(roomName).emit(eventName, data)

    logger.info(`[WebSocket] Broadcasted ${eventName} to ${roomName}`, {
      customerId: data.customerId,
      customerName: data.customerName,
    })
  }

  /**
   * Broadcast new customer event to workspace
   */
  notifyNewCustomer(
    workspaceId: string,
    data: {
      customerId: string
      sessionId: string
      customerName: string
      customerPhone: string
      language?: string
      timestamp: string
    }
  ): void {
    if (!this.io) {
      logger.warn("[WebSocket] Cannot notify, server not initialized")
      return
    }

    const roomName = `workspace:${workspaceId}`
    this.io.to(roomName).emit("new-customer", data)

    logger.info(`[WebSocket] Broadcasted new-customer to ${roomName}`, {
      customerId: data.customerId,
      sessionId: data.sessionId,
    })
  }

  /**
   * Notify specific client about workspace change
   * This triggers frontend to invalidate all cached data
   */
  notifyWorkspaceChanged(socketId: string, workspaceId: string): void {
    if (!this.io) {
      logger.warn("[WebSocket] Cannot notify, server not initialized")
      return
    }

    this.io.to(socketId).emit("workspace-changed", { workspaceId })

    logger.info(
      `[WebSocket] Notified ${socketId} of workspace change to ${workspaceId}`
    )
  }

  /**
   * Broadcast new support ticket message to user (owner)
   * Sends to all connected clients of the user across workspaces
   */
  notifySupportTicketMessage(
    userId: string,
    data: {
      ticketId: string
      ticketCode: string
      subject: string
      messagePreview: string
      senderType: "CUSTOMER" | "ADMIN"
      timestamp: string
    }
  ): void {
    if (!this.io) {
      logger.warn("[WebSocket] Cannot notify, server not initialized")
      return
    }

    // Find all sockets for this user
    const userSockets: string[] = []
    this.clientMetadata.forEach((metadata, socketId) => {
      if (metadata.userId === userId) {
        userSockets.push(socketId)
      }
    })

    // Send to all user sockets
    userSockets.forEach((socketId) => {
      this.io!.to(socketId).emit("support-ticket-message", data)
    })

    logger.info(
      `[WebSocket] Broadcasted support-ticket-message to user ${userId} (${userSockets.length} sockets)`,
      {
        ticketId: data.ticketId,
        ticketCode: data.ticketCode,
        senderType: data.senderType,
      }
    )
  }

  /**
   * Broadcast support ticket status change to user (owner)
   */
  notifySupportTicketStatusChange(
    userId: string,
    data: {
      ticketId: string
      ticketCode: string
      subject: string
      oldStatus: string
      newStatus: string
      timestamp: string
    }
  ): void {
    if (!this.io) {
      logger.warn("[WebSocket] Cannot notify, server not initialized")
      return
    }

    // Find all sockets for this user
    const userSockets: string[] = []
    this.clientMetadata.forEach((metadata, socketId) => {
      if (metadata.userId === userId) {
        userSockets.push(socketId)
      }
    })

    // Send to all user sockets
    userSockets.forEach((socketId) => {
      this.io!.to(socketId).emit("support-ticket-status", data)
    })

    logger.info(
      `[WebSocket] Broadcasted support-ticket-status to user ${userId} (${userSockets.length} sockets)`,
      {
        ticketId: data.ticketId,
        ticketCode: data.ticketCode,
        newStatus: data.newStatus,
      }
    )
  }

  /**
   * Broadcast to admin room for new support tickets (platform admins)
   */
  notifyAdminNewSupportTicket(data: {
    ticketId: string
    ticketCode: string
    subject: string
    issueType: string
    userEmail: string
    workspaceName: string
    timestamp: string
  }): void {
    if (!this.io) {
      logger.warn("[WebSocket] Cannot notify, server not initialized")
      return
    }

    // Broadcast to admin room (admins join this room on connect)
    this.io.to("admin:support").emit("support-ticket-new", data)

    logger.info(`[WebSocket] Broadcasted support-ticket-new to admin room`, {
      ticketId: data.ticketId,
      ticketCode: data.ticketCode,
    })
  }

  /**
   * Get connected clients count for workspace
   */
  getWorkspaceClientsCount(workspaceId: string): number {
    if (!this.io) return 0

    const roomName = `workspace:${workspaceId}`
    const room = this.io.sockets.adapter.rooms.get(roomName)
    return room ? room.size : 0
  }

  /**
   * Get all connected clients metadata
   */
  getConnectedClients(): ClientMetadata[] {
    return Array.from(this.clientMetadata.values())
  }

  /**
   * Shutdown WebSocket server gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.io) return

    return new Promise((resolve) => {
      this.io!.close(() => {
        logger.info("[WebSocket] Server closed")
        resolve()
      })
    })
  }
}

// Singleton instance
export const websocketService = new WebSocketService()
