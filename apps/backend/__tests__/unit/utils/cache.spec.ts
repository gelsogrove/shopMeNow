/**
 * Unit tests for cache utility
 * 
 * Tests the SimpleCache class for correctness.
 */

import { SimpleCache } from "../../../src/utils/cache"

describe("SimpleCache", () => {
  let cache: SimpleCache<string>

  beforeEach(() => {
    cache = new SimpleCache<string>({ defaultTTL: 1 }) // 1 second for fast tests
  })

  afterEach(() => {
    cache.clear()
  })

  describe("basic operations", () => {
    it("should store and retrieve values", () => {
      cache.set("key1", "value1")
      expect(cache.get("key1")).toBe("value1")
    })

    it("should return undefined for missing keys", () => {
      expect(cache.get("nonexistent")).toBeUndefined()
    })

    it("should check if key exists", () => {
      cache.set("key1", "value1")
      expect(cache.has("key1")).toBe(true)
      expect(cache.has("nonexistent")).toBe(false)
    })

    it("should delete specific keys", () => {
      cache.set("key1", "value1")
      cache.set("key2", "value2")
      
      cache.delete("key1")
      
      expect(cache.has("key1")).toBe(false)
      expect(cache.has("key2")).toBe(true)
    })

    it("should clear all entries", () => {
      cache.set("key1", "value1")
      cache.set("key2", "value2")
      
      cache.clear()
      
      expect(cache.has("key1")).toBe(false)
      expect(cache.has("key2")).toBe(false)
    })
  })

  describe("TTL expiration", () => {
    it("should expire entries after TTL", async () => {
      cache.set("key1", "value1", 0.1) // 100ms TTL
      
      expect(cache.get("key1")).toBe("value1")
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150))
      
      expect(cache.get("key1")).toBeUndefined()
    })

    it("should use default TTL when not specified", () => {
      // Default is 1 second in test setup
      cache.set("key1", "value1")
      expect(cache.get("key1")).toBe("value1")
    })
  })

  describe("pattern deletion", () => {
    it("should delete keys matching prefix pattern", () => {
      cache.set("workspace:123:agent:ROUTER", "value1")
      cache.set("workspace:123:agent:PRODUCT", "value2")
      cache.set("workspace:456:agent:ROUTER", "value3")
      
      const deleted = cache.deletePattern("workspace:123:")
      
      expect(deleted).toBe(2)
      expect(cache.has("workspace:123:agent:ROUTER")).toBe(false)
      expect(cache.has("workspace:123:agent:PRODUCT")).toBe(false)
      expect(cache.has("workspace:456:agent:ROUTER")).toBe(true)
    })
  })

  describe("statistics", () => {
    it("should track hits and misses", () => {
      cache.set("key1", "value1")
      
      cache.get("key1") // hit
      cache.get("key1") // hit
      cache.get("nonexistent") // miss
      
      const stats = cache.stats()
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBe("66.7%")
    })
  })
})
