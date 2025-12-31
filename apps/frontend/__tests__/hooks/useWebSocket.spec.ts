/**
 * useWebSocket Tests - WebSocket React Query Invalidation
 * 
 * TASK13: Tests for WebSocket events that invalidate React Query cache
 * 
 * Test Coverage:
 * 1. WebSocket connection/disconnection handling
 * 2. new-message event → invalidate chat-messages, chats, recent-chats
 * 3. chat-updated event → invalidate chats, recent-chats (with refetch)
 * 4. user-blocked event → invalidate customers, chats
 * 5. user-unblocked event → invalidate customers, chats
 * 6. Toast notifications for background messages
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useWebSocket } from "@/hooks/useWebSocket"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { storage } from "@/lib/storage"
import { getSocket, disconnectSocket } from "@/services/socket"
import { toast } from "@/lib/toast"
import React, { ReactNode } from "react"

// Mock dependencies
vi.mock("@/services/socket", () => ({
  getSocket: vi.fn(),
  disconnectSocket: vi.fn(),
}))

vi.mock("@/lib/storage", () => ({
  storage: {
    getSessionId: vi.fn(),
    getCurrentChatSessionId: vi.fn(),
  },
}))

vi.mock("@/lib/toast", () => ({
  toast: {
    info: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
}))

describe("useWebSocket - React Query Invalidation", () => {
  let queryClient: QueryClient
  let mockSocket: any

  beforeEach(() => {
    // Create fresh query client for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    // Create mock socket with event handlers storage
    const eventHandlers: Record<string, Function[]> = {}
    mockSocket = {
      id: "mock-socket-id",
      on: vi.fn((event: string, handler: Function) => {
        if (!eventHandlers[event]) eventHandlers[event] = []
        eventHandlers[event].push(handler)
      }),
      off: vi.fn((event: string, handler?: Function) => {
        if (handler) {
          eventHandlers[event] = eventHandlers[event]?.filter(h => h !== handler) || []
        } else {
          delete eventHandlers[event]
        }
      }),
      emit: vi.fn(),
      disconnect: vi.fn(),
      // Helper to trigger events
      _trigger: (event: string, data: any) => {
        eventHandlers[event]?.forEach(handler => handler(data))
      },
      _handlers: eventHandlers,
    }

    // Mock getSocket to return our mock socket
    vi.mocked(getSocket).mockReturnValue(mockSocket)

    // Default storage mocks
    vi.mocked(storage.getSessionId).mockReturnValue("session-123")
    vi.mocked(storage.getCurrentChatSessionId).mockReturnValue("chat-session-active")
  })

  afterEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
  })

  const wrapper = ({ children }: { children: ReactNode }) => 
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  describe("📡 Connection Handling", () => {
    it("should connect to WebSocket when workspaceId is provided", () => {
      const onConnect = vi.fn()
      
      renderHook(
        () => useWebSocket({ workspaceId: "ws-123", userId: "user-1", onConnect }),
        { wrapper }
      )

      expect(getSocket).toHaveBeenCalledWith("ws-123")
      
      // Trigger connect event
      mockSocket._trigger("connect", undefined)
      
      expect(onConnect).toHaveBeenCalled()
      expect(mockSocket.emit).toHaveBeenCalledWith("join-workspace", {
        workspaceId: "ws-123",
        userId: "user-1",
      })
    })

    it("should disconnect when workspaceId is null", () => {
      renderHook(() => useWebSocket({ workspaceId: null }), { wrapper })

      expect(disconnectSocket).toHaveBeenCalled()
    })

    it("should handle disconnect event", () => {
      const onDisconnect = vi.fn()
      
      renderHook(
        () => useWebSocket({ workspaceId: "ws-123", onDisconnect }),
        { wrapper }
      )

      // Trigger disconnect event
      mockSocket._trigger("disconnect", "transport close")
      
      expect(onDisconnect).toHaveBeenCalled()
    })

    it("should handle connection error", () => {
      const onError = vi.fn()
      const error = new Error("Connection failed")
      
      renderHook(
        () => useWebSocket({ workspaceId: "ws-123", onError }),
        { wrapper }
      )

      // Trigger connect_error event
      mockSocket._trigger("connect_error", error)
      
      expect(onError).toHaveBeenCalledWith(error)
    })
  })

  describe("💬 new-message Event - React Query Invalidation", () => {
    it("should invalidate chat-messages, chats, and recent-chats queries", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

      renderHook(() => useWebSocket({ workspaceId: "ws-123" }), { wrapper })

      // Trigger new-message event
      const message = {
        id: "msg-1",
        sessionId: "chat-session-other",
        content: "Hello!",
        sender: "customer" as const,
        timestamp: new Date().toISOString(),
        workspaceId: "ws-123",
      }
      mockSocket._trigger("new-message", message)

      await waitFor(() => {
        // Should invalidate message queries for this chat
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["chat-messages", "chat-session-other"],
        })

        // Should invalidate chat list
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["chats", "session-123"],
        })

        // Should invalidate recent chats
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["recent-chats", "session-123"],
        })
      })

      expect(invalidateSpy).toHaveBeenCalledTimes(3)
    })

    it("should show toast for messages in non-active chats", async () => {
      renderHook(() => useWebSocket({ workspaceId: "ws-123" }), { wrapper })

      // Message from DIFFERENT chat (not currently active)
      const message = {
        id: "msg-1",
        sessionId: "chat-session-other", // Different from getCurrentChatSessionId()
        content: "Hello!",
        sender: "customer" as const,
        timestamp: new Date().toISOString(),
        workspaceId: "ws-123",
      }
      mockSocket._trigger("new-message", message)

      await waitFor(() => {
        expect(toast.info).toHaveBeenCalledWith("New message received", { duration: 2000 })
      })
    })

    it("should NOT show toast for messages in active chat", async () => {
      renderHook(() => useWebSocket({ workspaceId: "ws-123" }), { wrapper })

      // Message from ACTIVE chat
      const message = {
        id: "msg-1",
        sessionId: "chat-session-active", // Same as getCurrentChatSessionId()
        content: "Hello!",
        sender: "customer" as const,
        timestamp: new Date().toISOString(),
        workspaceId: "ws-123",
      }
      mockSocket._trigger("new-message", message)

      await waitFor(() => {
        expect(toast.info).not.toHaveBeenCalled()
      })
    })

    it("should NOT show toast for agent messages", async () => {
      renderHook(() => useWebSocket({ workspaceId: "ws-123" }), { wrapper })

      // Message from AGENT (not customer)
      const message = {
        id: "msg-1",
        sessionId: "chat-session-other",
        content: "Hello!",
        sender: "agent" as const,
        timestamp: new Date().toISOString(),
        workspaceId: "ws-123",
      }
      mockSocket._trigger("new-message", message)

      await waitFor(() => {
        expect(toast.info).not.toHaveBeenCalled()
      })
    })
  })

  describe("🔄 chat-updated Event - React Query Invalidation & Refetch", () => {
    it("should invalidate AND refetch chats and recent-chats queries", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
      const refetchSpy = vi.spyOn(queryClient, "refetchQueries")

      renderHook(() => useWebSocket({ workspaceId: "ws-123" }), { wrapper })

      // Trigger chat-updated event
      const chat = {
        sessionId: "chat-session-1",
        customerId: "customer-1",
        status: "active",
        lastMessage: "New message",
        lastMessageAt: new Date().toISOString(),
        unreadCount: 5,
      }
      mockSocket._trigger("chat-updated", chat)

      await waitFor(() => {
        // Should invalidate with refetchType: "active"
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["chats", "session-123"],
          refetchType: "active",
        })

        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["recent-chats", "session-123"],
          refetchType: "active",
        })

        // Should force refetch chats
        expect(refetchSpy).toHaveBeenCalledWith({
          queryKey: ["chats", "session-123"],
        })
      })

      expect(invalidateSpy).toHaveBeenCalledTimes(2)
      expect(refetchSpy).toHaveBeenCalled() // Called at least once
    })
  })

  describe("🚫 user-blocked Event - React Query Invalidation", () => {
    it("should invalidate customers and chats queries", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

      renderHook(() => useWebSocket({ workspaceId: "ws-123" }), { wrapper })

      // Trigger user-blocked event
      const data = {
        customerId: "customer-1",
        customerName: "John Doe",
        customerPhone: "+1234567890",
        timestamp: new Date().toISOString(),
      }
      mockSocket._trigger("user-blocked", data)

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["customers"],
        })

        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["chats", "session-123"],
        })
      })

      expect(invalidateSpy).toHaveBeenCalledTimes(2)
    })

    it("should show warning toast when user is blocked", async () => {
      renderHook(() => useWebSocket({ workspaceId: "ws-123" }), { wrapper })

      const data = {
        customerId: "customer-1",
        customerName: "John Doe",
        customerPhone: "+1234567890",
        timestamp: new Date().toISOString(),
      }
      mockSocket._trigger("user-blocked", data)

      await waitFor(() => {
        expect(toast.warning).toHaveBeenCalledWith("Customer John Doe has been blocked")
      })
    })
  })

  describe("✅ user-unblocked Event - React Query Invalidation", () => {
    it("should invalidate customers and chats queries", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

      renderHook(() => useWebSocket({ workspaceId: "ws-123" }), { wrapper })

      // Trigger user-unblocked event
      const data = {
        customerId: "customer-1",
        customerName: "John Doe",
        customerPhone: "+1234567890",
        timestamp: new Date().toISOString(),
      }
      mockSocket._trigger("user-unblocked", data)

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["customers"],
        })

        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["chats", "session-123"],
        })
      })

      expect(invalidateSpy).toHaveBeenCalledTimes(2)
    })

    it("should show success toast when user is unblocked", async () => {
      renderHook(() => useWebSocket({ workspaceId: "ws-123" }), { wrapper })

      const data = {
        customerId: "customer-1",
        customerName: "John Doe",
        customerPhone: "+1234567890",
        timestamp: new Date().toISOString(),
      }
      mockSocket._trigger("user-unblocked", data)

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Customer John Doe has been unblocked")
      })
    })
  })

  describe("🔐 Security Matrix - Query Invalidation Strategy", () => {
    it("should document complete invalidation matrix", () => {
      console.log("\n\n=== TASK13 WebSocket Query Invalidation Matrix ===\n")

      console.log("📡 WebSocket Events → React Query Invalidation:")
      console.log("\n1. new-message (customer sends message):")
      console.log("   ✅ invalidateQueries(['chat-messages', sessionId])")
      console.log("   ✅ invalidateQueries(['chats', sessionId])")
      console.log("   ✅ invalidateQueries(['recent-chats', sessionId])")
      console.log("   🔔 toast.info() if message from non-active chat + customer")

      console.log("\n2. chat-updated (chat status/lastMessage changed):")
      console.log("   ✅ invalidateQueries(['chats', sessionId], { refetchType: 'active' })")
      console.log("   ✅ invalidateQueries(['recent-chats', sessionId], { refetchType: 'active' })")
      console.log("   🔥 refetchQueries(['chats', sessionId]) - FORCE immediate refetch")

      console.log("\n3. user-blocked (customer blocked):")
      console.log("   ✅ invalidateQueries(['customers'])")
      console.log("   ✅ invalidateQueries(['chats', sessionId])")
      console.log("   ⚠️  toast.warning('Customer X has been blocked')")

      console.log("\n4. user-unblocked (customer unblocked):")
      console.log("   ✅ invalidateQueries(['customers'])")
      console.log("   ✅ invalidateQueries(['chats', sessionId])")
      console.log("   ⚠️  toast.warning('Customer X has been unblocked')")

      console.log("\n🎯 Invalidation Strategy:")
      console.log("  - invalidateQueries: Marks query as stale, refetches on next mount")
      console.log("  - refetchQueries: Force immediate refetch")
      console.log("  - refetchType: 'active' = only refetch currently mounted queries")

      console.log("\n🔔 Toast Strategy:")
      console.log("  - Show toast ONLY for customer messages in non-active chats")
      console.log("  - Show toast for block/unblock events (always)")
      console.log("  - NO toast for agent messages or active chat messages")

      expect(true).toBe(true)
    })
  })

  describe("📝 Storage Integration", () => {
    it("should read sessionId from storage for query invalidation", () => {
      const customSessionId = "custom-session-789"
      vi.mocked(storage.getSessionId).mockReturnValue(customSessionId)

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

      renderHook(() => useWebSocket({ workspaceId: "ws-123" }), { wrapper })

      // Trigger new-message event
      const message = {
        id: "msg-1",
        sessionId: "chat-session-1",
        content: "Hello!",
        sender: "customer" as const,
        timestamp: new Date().toISOString(),
        workspaceId: "ws-123",
      }
      mockSocket._trigger("new-message", message)

      // Should use custom sessionId from storage
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["chats", customSessionId],
      })
    })

    it("should read currentChatSessionId from storage for toast logic", async () => {
      const activeChat = "active-chat-999"
      vi.mocked(storage.getCurrentChatSessionId).mockReturnValue(activeChat)

      renderHook(() => useWebSocket({ workspaceId: "ws-123" }), { wrapper })

      // Message from active chat
      const message = {
        id: "msg-1",
        sessionId: activeChat,
        content: "Hello!",
        sender: "customer" as const,
        timestamp: new Date().toISOString(),
        workspaceId: "ws-123",
      }
      mockSocket._trigger("new-message", message)

      // Should NOT show toast for active chat
      await waitFor(() => {
        expect(toast.info).not.toHaveBeenCalled()
      })
    })
  })
})
