/**
 * Cache Service (T006)
 * Simple in-memory cache for workspace and product data
 * Avoids duplicate queries within message lifetime
 */

import logger from "../../utils/logger"

interface CacheEntry {
  value: any
  expiresAt: number
}

export class CacheService {
  private cache: Map<string, CacheEntry> = new Map()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Set a key-value pair with optional TTL
   */
  set(key: string, value: any, ttl: number = this.DEFAULT_TTL): void {
    const expiresAt = Date.now() + ttl
    this.cache.set(key, { value, expiresAt })
    logger.debug("[Cache] Set", { key, ttlMs: ttl })
  }

  /**
   * Get a value if it exists and hasn't expired
   */
  get(key: string): any | null {
    const entry = this.cache.get(key)

    if (!entry) {
      logger.debug("[Cache] Miss", { key })
      return null
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      logger.debug("[Cache] Expired", { key })
      return null
    }

    logger.debug("[Cache] Hit", { key })
    return entry.value
  }

  /**
   * Invalidate all cache entries for a workspace
   */
  invalidate(workspaceId: string): void {
    const prefix = `workspace:${workspaceId}`
    let count = 0

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
        count++
      }
    }

    logger.info("[Cache] Invalidated", { workspaceId, count })
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
    logger.info("[Cache] Cleared all")
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    }
  }
}
