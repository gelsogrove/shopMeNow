"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.websocketService = exports.WebSocketService = void 0;
const socket_io_1 = require("socket.io");
const logger_1 = __importDefault(require("../utils/logger"));
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
class WebSocketService {
    constructor() {
        this.io = null;
        this.clientMetadata = new Map();
    }
    /**
     * Initialize Socket.io server attached to Express HTTP server
     */
    initialize(httpServer) {
        this.io = new socket_io_1.Server(httpServer, {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:3000",
                methods: ["GET", "POST"],
                credentials: true,
            },
            // Ping every 25s, timeout after 20s
            pingInterval: 25000,
            pingTimeout: 20000,
        });
        this.io.on("connection", (socket) => {
            logger_1.default.info(`[WebSocket] Client connected: ${socket.id}`);
            // Client joins workspace room
            socket.on("join-workspace", (data) => {
                const { workspaceId, userId } = data;
                // Leave previous rooms
                const rooms = Array.from(socket.rooms).filter((room) => room !== socket.id);
                rooms.forEach((room) => socket.leave(room));
                // Join new workspace room
                const roomName = `workspace:${workspaceId}`;
                socket.join(roomName);
                // Store metadata
                this.clientMetadata.set(socket.id, { workspaceId, userId });
                logger_1.default.info(`[WebSocket] Client ${socket.id} joined ${roomName}`);
                socket.emit("workspace-joined", { workspaceId });
            });
            // Client disconnects
            socket.on("disconnect", () => {
                this.clientMetadata.delete(socket.id);
                logger_1.default.info(`[WebSocket] Client disconnected: ${socket.id}`);
            });
            // Ping/pong for connection health
            socket.on("ping", () => {
                socket.emit("pong");
            });
        });
        logger_1.default.info("[WebSocket] Server initialized");
    }
    /**
     * Broadcast new message event to workspace
     */
    notifyNewMessage(workspaceId, message) {
        if (!this.io) {
            logger_1.default.warn("[WebSocket] Cannot notify, server not initialized");
            return;
        }
        const roomName = `workspace:${workspaceId}`;
        this.io.to(roomName).emit("new-message", message);
        logger_1.default.info(`[WebSocket] Broadcasted new-message to ${roomName}`, {
            sessionId: message.sessionId,
            messageId: message.id,
        });
    }
    /**
     * Broadcast chat list update (new chat, status change, etc.)
     */
    notifyChatUpdated(workspaceId, chat) {
        if (!this.io) {
            logger_1.default.warn("[WebSocket] Cannot notify, server not initialized");
            return;
        }
        const roomName = `workspace:${workspaceId}`;
        this.io.to(roomName).emit("chat-updated", chat);
        logger_1.default.info(`[WebSocket] Broadcasted chat-updated to ${roomName}`, {
            sessionId: chat.sessionId,
        });
    }
    /**
     * Broadcast customer blocked/unblocked event to workspace
     */
    notifyUserBlocked(workspaceId, data) {
        if (!this.io) {
            logger_1.default.warn("[WebSocket] Cannot notify, server not initialized");
            return;
        }
        const roomName = `workspace:${workspaceId}`;
        const eventName = data.isBlacklisted ? "user-blocked" : "user-unblocked";
        this.io.to(roomName).emit(eventName, data);
        logger_1.default.info(`[WebSocket] Broadcasted ${eventName} to ${roomName}`, {
            customerId: data.customerId,
            customerName: data.customerName,
        });
    }
    /**
     * Broadcast new customer event to workspace
     */
    notifyNewCustomer(workspaceId, data) {
        if (!this.io) {
            logger_1.default.warn("[WebSocket] Cannot notify, server not initialized");
            return;
        }
        const roomName = `workspace:${workspaceId}`;
        this.io.to(roomName).emit("new-customer", data);
        logger_1.default.info(`[WebSocket] Broadcasted new-customer to ${roomName}`, {
            customerId: data.customerId,
            sessionId: data.sessionId,
        });
    }
    /**
     * Notify specific client about workspace change
     * This triggers frontend to invalidate all cached data
     */
    notifyWorkspaceChanged(socketId, workspaceId) {
        if (!this.io) {
            logger_1.default.warn("[WebSocket] Cannot notify, server not initialized");
            return;
        }
        this.io.to(socketId).emit("workspace-changed", { workspaceId });
        logger_1.default.info(`[WebSocket] Notified ${socketId} of workspace change to ${workspaceId}`);
    }
    /**
     * Get connected clients count for workspace
     */
    getWorkspaceClientsCount(workspaceId) {
        if (!this.io)
            return 0;
        const roomName = `workspace:${workspaceId}`;
        const room = this.io.sockets.adapter.rooms.get(roomName);
        return room ? room.size : 0;
    }
    /**
     * Get all connected clients metadata
     */
    getConnectedClients() {
        return Array.from(this.clientMetadata.values());
    }
    /**
     * Shutdown WebSocket server gracefully
     */
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.io)
                return;
            return new Promise((resolve) => {
                this.io.close(() => {
                    logger_1.default.info("[WebSocket] Server closed");
                    resolve();
                });
            });
        });
    }
}
exports.WebSocketService = WebSocketService;
// Singleton instance
exports.websocketService = new WebSocketService();
//# sourceMappingURL=websocket.service.js.map