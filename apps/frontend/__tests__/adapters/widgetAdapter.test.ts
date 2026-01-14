/**
 * Widget Adapter Tests
 * Tests for visitor ID generation and expiry logic
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { getOrCreateVisitorId } from "@/components/chat/adapters/widgetAdapter"

describe("widgetAdapter - getOrCreateVisitorId", () => {
  let mockStorage: Map<string, string>
  let storage: Storage

  beforeEach(() => {
    // Mock localStorage
    mockStorage = new Map<string, string>()
    storage = {
      getItem: (key: string) => mockStorage.get(key) || null,
      setItem: (key: string, value: string) => {
        mockStorage.set(key, value)
      },
      removeItem: (key: string) => {
        mockStorage.delete(key)
      },
      clear: () => mockStorage.clear(),
      length: mockStorage.size,
      key: (index: number) => Array.from(mockStorage.keys())[index] || null,
    } as Storage
  })

  it("should generate new visitor ID if none exists", () => {
    const now = vi.fn(() => 1700000000000)
    const random = vi.fn(() => 0.123456789)

    const visitorId = getOrCreateVisitorId(storage, "test-workspace", now, random)

    expect(visitorId).toMatch(/^visitor_1700000000000_[a-z0-9]{6,10}$/)
    expect(storage.getItem("echatbot-visitor-id:test-workspace")).toBe(visitorId)
  })

  it("should reuse existing visitor ID if still valid (<24h)", () => {
    const baseTime = 1700000000000
    const existingId = "visitor_1700000000000_abc123"

    // Store existing visitor ID
    storage.setItem("echatbot-visitor-id:test-workspace", existingId)

    // Check after 12 hours (still valid)
    const now = vi.fn(() => baseTime + 12 * 60 * 60 * 1000)
    const random = vi.fn(() => 0.987654321)

    const visitorId = getOrCreateVisitorId(storage, "test-workspace", now, random)

    expect(visitorId).toBe(existingId) // Should reuse the same ID
    expect(random).not.toHaveBeenCalled() // Should not generate new ID
  })

  it("should regenerate visitor ID if expired (>24h)", () => {
    const baseTime = 1700000000000
    const expiredId = "visitor_1700000000000_old123"

    // Store expired visitor ID
    storage.setItem("echatbot-visitor-id:test-workspace", expiredId)
    storage.setItem("echatbot-session-id:test-workspace", "old-session-id")
    storage.setItem("echatbot-messages:test-workspace", JSON.stringify([]))

    // Check after 25 hours (expired)
    const now = vi.fn(() => baseTime + 25 * 60 * 60 * 1000)
    const random = vi.fn(() => 0.555555555)

    const visitorId = getOrCreateVisitorId(storage, "test-workspace", now, random)

    // Should generate new visitor ID
    expect(visitorId).not.toBe(expiredId)
    expect(visitorId).toMatch(/^visitor_\d{13}_[a-z0-9]{6,10}$/)

    // Should clean up old data
    expect(storage.getItem("echatbot-session-id:test-workspace")).toBeNull()
    expect(storage.getItem("echatbot-messages:test-workspace")).toBeNull()

    // Should store new visitor ID
    expect(storage.getItem("echatbot-visitor-id:test-workspace")).toBe(visitorId)
  })

  it("should handle exactly 24h boundary (should regenerate)", () => {
    const baseTime = 1700000000000
    const boundaryId = "visitor_1700000000000_boundary"

    storage.setItem("echatbot-visitor-id:test-workspace", boundaryId)

    // Exactly 24 hours later
    const now = vi.fn(() => baseTime + 24 * 60 * 60 * 1000)
    const random = vi.fn(() => 0.333333333)

    const visitorId = getOrCreateVisitorId(storage, "test-workspace", now, random)

    // Should regenerate (>= 24h is expired)
    expect(visitorId).not.toBe(boundaryId)
  })

  it("should handle malformed visitor ID by regenerating", () => {
    // Store malformed visitor ID
    storage.setItem("echatbot-visitor-id:test-workspace", "invalid-format")

    const now = vi.fn(() => 1700000000000)
    const random = vi.fn(() => 0.777777777)

    const visitorId = getOrCreateVisitorId(storage, "test-workspace", now, random)

    // Should regenerate
    expect(visitorId).toMatch(/^visitor_1700000000000_[a-z0-9]{6,10}$/)
  })

  it("should use different visitor IDs for different workspaces", () => {
    const now = vi.fn(() => 1700000000000)
    let callCount = 0
    const random = vi.fn(() => {
      callCount++
      return callCount === 1 ? 0.111111111 : 0.999999999
    })

    const id1 = getOrCreateVisitorId(storage, "workspace-1", now, random)
    const id2 = getOrCreateVisitorId(storage, "workspace-2", now, random)

    // Both should be stored separately
    expect(storage.getItem("echatbot-visitor-id:workspace-1")).toBeTruthy()
    expect(storage.getItem("echatbot-visitor-id:workspace-2")).toBeTruthy()

    // They should have different hashes
    expect(id1).not.toBe(id2)
  })
})
