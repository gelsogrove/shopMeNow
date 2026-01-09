/**
 * API Interceptors Tests
 *
 * Tests for axios request/response interceptors:
 * - Authorization header injection (JWT token)
 * - x-workspace-id header injection
 * - x-session-id header injection
 * - 401 error handling and redirect
 * - 2FA page exception handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import axios from "axios"
import MockAdapter from "axios-mock-adapter"

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock toast
vi.mock("../../src/lib/toast", () => ({
  toast: {
    error: vi.fn(),
  },
}))

describe("API Interceptors", () => {
  let mockAxios: MockAdapter
  let api: typeof import("../../src/services/api").api

  beforeEach(async () => {
    // Clear localStorage and sessionStorage
    localStorage.clear()
    sessionStorage.clear()

    // Reset modules to get fresh interceptors
    vi.resetModules()

    // Import fresh api instance
    const module = await import("../../src/services/api")
    api = module.api

    // Setup mock adapter
    mockAxios = new MockAdapter(api)
  })

  afterEach(() => {
    mockAxios.restore()
    vi.clearAllMocks()
  })

  describe("Request Interceptor - Authorization Header", () => {
    it("should add Authorization header when token exists in localStorage", async () => {
      // Setup
      const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMifQ.test"
      localStorage.setItem("token", testToken)
      mockAxios.onGet("/test").reply(200, { success: true })

      // Act
      const response = await api.get("/test")

      // Assert
      const requestHeaders = mockAxios.history.get[0]?.headers
      expect(requestHeaders?.Authorization).toBe(`Bearer ${testToken}`)
    })

    it("should NOT add Authorization header when no token in localStorage", async () => {
      // Setup - no token
      mockAxios.onGet("/test").reply(200, { success: true })

      // Act
      await api.get("/test")

      // Assert
      const requestHeaders = mockAxios.history.get[0]?.headers
      // Authorization header should not be set (or be undefined)
      expect(requestHeaders?.Authorization).toBeUndefined()
    })
  })

  describe("Request Interceptor - Workspace ID Header", () => {
    it("should add x-workspace-id header from localStorage currentWorkspace", async () => {
      // Setup
      const workspaceId = "ws-123-test"
      localStorage.setItem("currentWorkspace", JSON.stringify({ id: workspaceId }))
      mockAxios.onGet("/test").reply(200, { success: true })

      // Act
      await api.get("/test")

      // Assert
      const requestHeaders = mockAxios.history.get[0]?.headers
      expect(requestHeaders?.["x-workspace-id"]).toBe(workspaceId)
    })

    it("should NOT overwrite x-workspace-id if already set in config", async () => {
      // Setup
      localStorage.setItem("currentWorkspace", JSON.stringify({ id: "ws-from-storage" }))
      mockAxios.onGet("/test").reply(200, { success: true })

      // Act
      await api.get("/test", {
        headers: { "x-workspace-id": "ws-explicit" },
      })

      // Assert
      const requestHeaders = mockAxios.history.get[0]?.headers
      expect(requestHeaders?.["x-workspace-id"]).toBe("ws-explicit")
    })
  })

  // NOTE: x-session-id header removed as per Feature #183 (JWT-only authentication)
  // The session ID is no longer required for API requests since auth is handled
  // entirely through JWT tokens in the Authorization header

  describe("Response Interceptor - 401 Handling", () => {
    it("should clear auth data and redirect on 401 error", async () => {
      // Setup
      localStorage.setItem("token", "old-token")
      localStorage.setItem("user", JSON.stringify({ id: "user-1" }))
      localStorage.setItem("currentWorkspace", JSON.stringify({ id: "ws-1" }))

      // Mock window.location
      const originalLocation = window.location
      delete (window as any).location
      window.location = { ...originalLocation, pathname: "/dashboard", href: "" } as any

      mockAxios.onGet("/test").reply(401, { error: "Unauthorized" })

      // Act & Assert
      await expect(api.get("/test")).rejects.toThrow()

      // Verify localStorage was cleared
      expect(localStorage.getItem("token")).toBeNull()
      expect(localStorage.getItem("user")).toBeNull()
      expect(localStorage.getItem("currentWorkspace")).toBeNull()

      // Restore window.location
      window.location = originalLocation
    })

    it("should NOT redirect on 401 if already on login page", async () => {
      // Setup
      const originalLocation = window.location
      delete (window as any).location
      window.location = { ...originalLocation, pathname: "/", href: "/" } as any

      mockAxios.onGet("/test").reply(401, { error: "Unauthorized" })

      // Act & Assert
      await expect(api.get("/test")).rejects.toThrow()

      // Should not have changed href (no redirect)
      expect(window.location.href).toBe("/")

      // Restore window.location
      window.location = originalLocation
    })

    it("should NOT redirect on 401 if on 2FA verification page", async () => {
      // Setup
      const originalLocation = window.location
      delete (window as any).location
      window.location = { ...originalLocation, pathname: "/auth/verify-2fa", href: "" } as any

      mockAxios.onGet("/test").reply(401, { error: "Invalid 2FA code" })

      // Act & Assert
      await expect(api.get("/test")).rejects.toThrow()

      // Should not have changed href (no redirect)
      expect(window.location.href).toBe("")

      // Restore window.location
      window.location = originalLocation
    })
  })

  describe("Full Request Flow", () => {
    it("should send all required headers in a single request", async () => {
      // Setup - all auth data present
      const token = "jwt-token-123"
      const workspaceId = "ws-full-test"
      // NOTE: sessionId removed as per Feature #183 (JWT-only auth)

      localStorage.setItem("token", token)
      localStorage.setItem("currentWorkspace", JSON.stringify({ id: workspaceId }))

      mockAxios.onPost("/workspaces/ws-full-test/products").reply(201, { id: "prod-1" })

      // Act
      await api.post("/workspaces/ws-full-test/products", { name: "Test Product" })

      // Assert all headers (no x-session-id since Feature #183)
      const requestHeaders = mockAxios.history.post[0]?.headers
      expect(requestHeaders?.Authorization).toBe(`Bearer ${token}`)
      expect(requestHeaders?.["x-workspace-id"]).toBe(workspaceId)
    })
  })
})
