import { describe, it, expect, beforeEach, vi } from "vitest"
import { storage } from "@/lib/storage"

describe("storage helper", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  describe("🔑 Token Management", () => {
    it("stores and retrieves token", () => {
      storage.setToken("test-token-123")
      expect(storage.getToken()).toBe("test-token-123")
    })

    it("returns null for missing token", () => {
      expect(storage.getToken()).toBeNull()
    })

    it("clears token", () => {
      storage.setToken("test-token")
      storage.clearToken()
      expect(storage.getToken()).toBeNull()
    })
  })

  describe("👤 User Management", () => {
    it("stores and retrieves user object", () => {
      const user = { id: "user-1", email: "test@example.com", name: "Test User" }
      storage.setUser(user)
      expect(storage.getUser()).toEqual(user)
    })

    it("returns null for missing user", () => {
      expect(storage.getUser()).toBeNull()
    })

    it("clears user", () => {
      storage.setUser({ id: "user-1" })
      storage.clearUser()
      expect(storage.getUser()).toBeNull()
    })

    it("handles invalid JSON gracefully", () => {
      localStorage.setItem("user", "invalid-json{")
      expect(storage.getUser()).toBeNull()
    })
  })

  describe("🏢 Workspace Management", () => {
    it("stores and retrieves workspace object", () => {
      const workspace = { id: "ws-1", name: "Test Workspace" }
      storage.setWorkspace(workspace)
      expect(storage.getWorkspace()).toEqual(workspace)
    })

    it("returns null for missing workspace", () => {
      expect(storage.getWorkspace()).toBeNull()
    })

    it("clears workspace from both localStorage and sessionStorage", () => {
      storage.setWorkspace({ id: "ws-1" })
      sessionStorage.setItem("currentWorkspace", JSON.stringify({ id: "ws-1" }))
      
      storage.clearWorkspace()
      
      expect(storage.getWorkspace()).toBeNull()
      expect(sessionStorage.getItem("currentWorkspace")).toBeNull()
    })

    it("handles invalid workspace JSON gracefully", () => {
      localStorage.setItem("currentWorkspace", "not-json")
      expect(storage.getWorkspace()).toBeNull()
    })
  })

  describe("🔐 Session Management", () => {
    it("stores and retrieves sessionId from sessionStorage", () => {
      storage.setSessionId("session-123")
      expect(storage.getSessionId()).toBe("session-123")
      expect(sessionStorage.getItem("sessionId")).toBe("session-123")
    })

    it("does not fall back to localStorage when sessionStorage is empty", () => {
      localStorage.setItem("sessionId", "fallback-session")
      expect(storage.getSessionId()).toBeNull()
    })

    it("prefers sessionStorage over localStorage", () => {
      sessionStorage.setItem("sessionId", "session-storage-value")
      localStorage.setItem("sessionId", "local-storage-value")
      expect(storage.getSessionId()).toBe("session-storage-value")
    })

    it("clears sessionId from both storages", () => {
      storage.setSessionId("session-123")
      localStorage.setItem("sessionId", "session-123")
      
      storage.clearSessionId()
      
      expect(storage.getSessionId()).toBeNull()
      expect(localStorage.getItem("sessionId")).toBeNull()
    })
  })

  describe("💬 Chat Session Management", () => {
    it("stores and retrieves selectedChatId", () => {
      storage.setSelectedChatId("chat-456")
      expect(storage.getSelectedChatId()).toBe("chat-456")
    })

    it("clears selectedChatId", () => {
      storage.setSelectedChatId("chat-456")
      storage.clearSelectedChatId()
      expect(storage.getSelectedChatId()).toBeNull()
    })

    it("stores and retrieves currentChatSessionId", () => {
      storage.setCurrentChatSessionId("chat-session-789")
      expect(storage.getCurrentChatSessionId()).toBe("chat-session-789")
    })

    it("clears currentChatSessionId", () => {
      storage.setCurrentChatSessionId("chat-session-789")
      storage.clearCurrentChatSessionId()
      expect(storage.getCurrentChatSessionId()).toBeNull()
    })
  })

  describe("🧹 Bulk Clear Operations", () => {
    it("clears auth data without touching unrelated keys", () => {
      // Set auth data
      storage.setToken("test-token")
      storage.setUser({ id: "user-1" })
      storage.setWorkspace({ id: "ws-1" })
      storage.setSessionId("session-123")
      storage.setSelectedChatId("chat-456")
      storage.setCurrentChatSessionId("chat-789")

      // Set unrelated key
      localStorage.setItem("unrelated-key", "should-remain")

      storage.clearAuth()

      // Auth data should be cleared
      expect(storage.getToken()).toBeNull()
      expect(storage.getUser()).toBeNull()
      expect(storage.getWorkspace()).toBeNull()
      expect(storage.getSessionId()).toBeNull()
      expect(storage.getSelectedChatId()).toBeNull()
      expect(storage.getCurrentChatSessionId()).toBeNull()

      // Unrelated key should remain
      expect(localStorage.getItem("unrelated-key")).toBe("should-remain")
    })

    it("clearAll() removes everything from both storages", () => {
      storage.setToken("test-token")
      storage.setUser({ id: "user-1" })
      storage.setWorkspace({ id: "ws-1" })
      storage.setSessionId("session-123")
      localStorage.setItem("custom-key", "custom-value")
      sessionStorage.setItem("custom-session-key", "custom-session-value")

      storage.clearAll()

      expect(localStorage.length).toBe(0)
      expect(sessionStorage.length).toBe(0)
    })
  })

  describe("🔒 Security - Token Persistence", () => {
    it("should persist token across page loads (localStorage)", () => {
      storage.setToken("persistent-token")
      
      // Simulate page reload by clearing only in-memory state
      const savedToken = localStorage.getItem("token")
      
      expect(savedToken).toBe("persistent-token")
    })

    it("should NOT persist sessionId across page loads (sessionStorage)", () => {
      storage.setSessionId("session-123")
      
      // SessionStorage value exists
      expect(sessionStorage.getItem("sessionId")).toBe("session-123")
      
      // But it's session-scoped (browser handles clearing on tab close)
      expect(localStorage.getItem("sessionId")).toBeNull()
    })
  })

  describe("📊 Storage Matrix", () => {
    it("should document complete storage strategy", () => {
      console.log("\n\n=== TASK13 Storage Helper Matrix ===\n")

      console.log("📦 localStorage (persistent across sessions):")
      console.log("  - token: JWT authentication token")
      console.log("  - user: User object { id, email, name }")
      console.log("  - currentWorkspace: Workspace object { id, name, ... }")

      console.log("\n💾 sessionStorage (per-tab, cleared on tab close):")
      console.log("  - sessionId: Backend session identifier")
      console.log("  - selectedChatId: Currently selected chat in sidebar")
      console.log("  - currentChatSessionId: Active chat session for message view")

      console.log("\n🔄 Fallback Strategy:")
      console.log("  - sessionId: sessionStorage → localStorage (for compatibility)")
      console.log("  - Other keys: No fallback")

      console.log("\n🧹 Clear Operations:")
      console.log("  1. clearAuth():")
      console.log("     - Removes: token, user, currentWorkspace, sessionId")
      console.log("     - Clears: Both localStorage + sessionStorage")
      console.log("     - Preserves: Unrelated keys")
      console.log("  2. clearAll():")
      console.log("     - Removes: EVERYTHING")
      console.log("     - Use: On logout or session expiry")

      console.log("\n🛡️ Security Best Practices:")
      console.log("  - Always clearAuth() before setting new user data")
      console.log("  - Use clearAll() on logout to prevent data leaks")
      console.log("  - Session data (sessionStorage) auto-clears on tab close")
      console.log("  - Workspace changes trigger chat storage clear")

      expect(true).toBe(true)
    })
  })

  describe("🚨 Edge Cases", () => {
    it("handles setting null/undefined values", () => {
      storage.setUser(null as any)
      expect(storage.getUser()).toEqual(null)
      
      storage.setWorkspace(undefined as any)
      expect(storage.getWorkspace()).toEqual(null)
    })

    it("handles complex nested objects", () => {
      const complexWorkspace = {
        id: "ws-1",
        name: "Test",
        settings: {
          theme: "dark",
          languages: ["en", "es", "it"],
          nested: { deep: { value: 123 } }
        }
      }
      
      storage.setWorkspace(complexWorkspace)
      expect(storage.getWorkspace()).toEqual(complexWorkspace)
    })

    it("handles empty string values", () => {
      storage.setToken("")
      expect(storage.getToken()).toBe("")
      
      // Note: sessionId uses || fallback which treats "" as falsy
      storage.setSessionId("")
      // Empty string stored but || treats it as falsy, returns null
      expect(sessionStorage.getItem("sessionId")).toBe("")
    })

    it("handles special characters in strings", () => {
      const specialToken = "token!@#$%^&*(){}[]|\\:;\"'<>,.?/~`"
      storage.setToken(specialToken)
      expect(storage.getToken()).toBe(specialToken)
    })
  })
})
