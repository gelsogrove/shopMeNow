/**
 * Simple in-memory rate limiter for API endpoints
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

class RateLimiter {
  private requests = new Map<string, RateLimitEntry>()
  private readonly windowMs: number
  private readonly maxRequests: number

  constructor(windowMs: number = 60000, maxRequests: number = 10) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests

    // Clean up old entries every minute
    const cleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.requests.entries()) {
        if (now > entry.resetTime) {
          this.requests.delete(key)
        }
      }
    }, 60000)
    cleanupInterval.unref?.()
  }

  /**
   * Check if request is allowed for a given identifier
   * @param identifier - Usually IP address or user ID
   * @returns true if request is allowed, false if rate limited
   */
  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const entry = this.requests.get(identifier)

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired entry
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      })
      return true
    }

    if (entry.count >= this.maxRequests) {
      return false // Rate limited
    }

    // Increment counter
    entry.count++
    return true
  }

  /**
   * Get time until rate limit resets for an identifier
   * @param identifier
   * @returns milliseconds until reset, or 0 if not rate limited
   */
  getTimeToReset(identifier: string): number {
    const entry = this.requests.get(identifier)
    if (!entry) return 0

    const now = Date.now()
    return Math.max(0, entry.resetTime - now)
  }

  /**
   * Get current request count for an identifier
   */
  getCurrentCount(identifier: string): number {
    const entry = this.requests.get(identifier)
    if (!entry || Date.now() > entry.resetTime) return 0
    return entry.count
  }
}

interface TokenBucketConfig {
  capacity: number
  refillPerMs: number
}

interface TokenBucketEntry extends TokenBucketConfig {
  tokens: number
  lastRefill: number
}

/**
 * Token bucket limiter (supports bursts while enforcing average rate).
 */
class TokenBucketRateLimiter {
  private buckets = new Map<string, TokenBucketEntry>()

  isAllowed(identifier: string, config: TokenBucketConfig): boolean {
    const now = Date.now()
    const entry = this.getOrCreateEntry(identifier, config, now)

    // Refill tokens based on elapsed time
    const elapsed = now - entry.lastRefill
    if (elapsed > 0) {
      const refill = elapsed * entry.refillPerMs
      entry.tokens = Math.min(entry.capacity, entry.tokens + refill)
      entry.lastRefill = now
    }

    if (entry.tokens < 1) {
      return false
    }

    entry.tokens -= 1
    return true
  }

  getTimeToReset(identifier: string, config: TokenBucketConfig): number {
    const now = Date.now()
    const entry = this.getOrCreateEntry(identifier, config, now)

    // Already has a token available
    if (entry.tokens >= 1) {
      return 0
    }

    if (entry.refillPerMs <= 0) {
      return 60000
    }

    const missing = 1 - entry.tokens
    return Math.ceil(missing / entry.refillPerMs)
  }

  private getOrCreateEntry(
    identifier: string,
    config: TokenBucketConfig,
    now: number
  ): TokenBucketEntry {
    const existing = this.buckets.get(identifier)

    if (!existing) {
      const entry: TokenBucketEntry = {
        capacity: config.capacity,
        refillPerMs: config.refillPerMs,
        tokens: config.capacity,
        lastRefill: now,
      }
      this.buckets.set(identifier, entry)
      return entry
    }

    // If config changed, reset the bucket to new limits
    if (
      existing.capacity !== config.capacity ||
      existing.refillPerMs !== config.refillPerMs
    ) {
      const entry: TokenBucketEntry = {
        capacity: config.capacity,
        refillPerMs: config.refillPerMs,
        tokens: Math.min(existing.tokens, config.capacity),
        lastRefill: now,
      }
      this.buckets.set(identifier, entry)
      return entry
    }

    return existing
  }
}

// Rate limiter for /chat/recent endpoint: max 50 requests per 10 seconds per IP
export const recentChatsRateLimiter = new RateLimiter(10000, 50)

// Token bucket limiters for WhatsApp inbound traffic (configurable via PlatformConfig)
export const whatsappMessageRateLimiter = new TokenBucketRateLimiter()
export const whatsappWorkspaceRateLimiter = new TokenBucketRateLimiter()
export const whatsappIpRateLimiter = new TokenBucketRateLimiter()
