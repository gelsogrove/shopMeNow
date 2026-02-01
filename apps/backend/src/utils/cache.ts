/**
 * Simple In-Memory Cache Utility
 * 
 * Lightweight cache for reducing database queries.
 * Used for data that doesn't change frequently (agent configs, workspace settings).
 * 
 * Features:
 * - TTL (Time To Live) per entry
 * - Automatic cleanup of expired entries
 * - Namespace support for isolation
 * - Zero external dependencies
 * 
 * @example
 * const cache = new SimpleCache({ defaultTTL: 300 }) // 5 minutes
 * cache.set('user:123', userData)
 * const user = cache.get('user:123')
 * 
 * @architecture Utility - No business logic, pure caching
 */

import logger from "./logger"

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

interface CacheOptions {
  /** Default TTL in seconds (default: 300 = 5 minutes) */
  defaultTTL?: number
  /** Maximum entries before cleanup (default: 1000) */
  maxEntries?: number
  /** Enable debug logging (default: false) */
  debug?: boolean
}

export class SimpleCache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map()
  private defaultTTL: number
  private maxEntries: number
  private debug: boolean
  private hits: number = 0
  private misses: number = 0

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = options.defaultTTL ?? 300 // 5 minutes default
    this.maxEntries = options.maxEntries ?? 1000
    this.debug = options.debug ?? false

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000)
  }

  /**
   * Get value from cache
   * @returns Value or undefined if not found/expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.misses++
      if (this.debug) {
        logger.debug(`🔴 Cache MISS: ${key}`)
      }
      return undefined
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.misses++
      if (this.debug) {
        logger.debug(`🟡 Cache EXPIRED: ${key}`)
      }
      return undefined
    }

    this.hits++
    if (this.debug) {
      logger.debug(`🟢 Cache HIT: ${key}`)
    }
    return entry.value
  }

  /**
   * Set value in cache
   * @param ttl - Optional TTL in seconds (overrides default)
   */
  set(key: string, value: T, ttl?: number): void {
    // Cleanup if at max capacity
    if (this.cache.size >= this.maxEntries) {
      this.cleanup()
      // If still at capacity after cleanup, remove oldest entries
      if (this.cache.size >= this.maxEntries) {
        const keysToDelete = Array.from(this.cache.keys()).slice(0, 100)
        keysToDelete.forEach(k => this.cache.delete(k))
      }
    }

    const expiresAt = Date.now() + (ttl ?? this.defaultTTL) * 1000
    this.cache.set(key, { value, expiresAt })

    if (this.debug) {
      logger.debug(`📥 Cache SET: ${key} (TTL: ${ttl ?? this.defaultTTL}s)`)
    }
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const value = this.get(key) // This handles expiration check
    return value !== undefined
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Delete all keys matching a pattern (prefix)
   * @example cache.deletePattern('workspace:123:') // Clears all workspace:123:* keys
   */
  deletePattern(prefix: string): number {
    let deleted = 0
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
        deleted++
      }
    }
    if (this.debug && deleted > 0) {
      logger.debug(`🗑️ Cache DELETE pattern '${prefix}': ${deleted} entries`)
    }
    return deleted
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; hits: number; misses: number; hitRate: string } {
    const total = this.hits + this.misses
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : 'N/A'
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
    }
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    let cleaned = 0
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (this.debug && cleaned > 0) {
      logger.debug(`🧹 Cache cleanup: removed ${cleaned} expired entries`)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCES FOR COMMON USE CASES
// ═══════════════════════════════════════════════════════════════════════

/**
 * Cache for Agent Configurations (5 minute TTL)
 * Key format: `{workspaceId}:{agentType}`
 */
export const agentConfigCache = new SimpleCache({
  defaultTTL: 300, // 5 minutes
  maxEntries: 500,
  debug: process.env.CACHE_DEBUG === 'true',
})

/**
 * Cache for Workspace Settings (5 minute TTL)
 * Key format: `{workspaceId}`
 */
export const workspaceCache = new SimpleCache({
  defaultTTL: 300, // 5 minutes
  maxEntries: 200,
  debug: process.env.CACHE_DEBUG === 'true',
})

/**
 * Cache for FAQ lookups (10 minute TTL)
 * Key format: `{workspaceId}:faq:{hash}`
 */
export const faqCache = new SimpleCache({
  defaultTTL: 600, // 10 minutes
  maxEntries: 1000,
  debug: process.env.CACHE_DEBUG === 'true',
})
