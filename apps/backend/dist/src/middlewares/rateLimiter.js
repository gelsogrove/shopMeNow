"use strict";
/**
 * Simple in-memory rate limiter for API endpoints
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappWorkspaceRateLimiter = exports.whatsappMessageRateLimiter = exports.recentChatsRateLimiter = void 0;
class RateLimiter {
    constructor(windowMs = 60000, maxRequests = 10) {
        this.requests = new Map();
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
        // Clean up old entries every minute
        setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this.requests.entries()) {
                if (now > entry.resetTime) {
                    this.requests.delete(key);
                }
            }
        }, 60000);
    }
    /**
     * Check if request is allowed for a given identifier
     * @param identifier - Usually IP address or user ID
     * @returns true if request is allowed, false if rate limited
     */
    isAllowed(identifier) {
        const now = Date.now();
        const entry = this.requests.get(identifier);
        if (!entry || now > entry.resetTime) {
            // Create new entry or reset expired entry
            this.requests.set(identifier, {
                count: 1,
                resetTime: now + this.windowMs,
            });
            return true;
        }
        if (entry.count >= this.maxRequests) {
            return false; // Rate limited
        }
        // Increment counter
        entry.count++;
        return true;
    }
    /**
     * Get time until rate limit resets for an identifier
     * @param identifier
     * @returns milliseconds until reset, or 0 if not rate limited
     */
    getTimeToReset(identifier) {
        const entry = this.requests.get(identifier);
        if (!entry)
            return 0;
        const now = Date.now();
        return Math.max(0, entry.resetTime - now);
    }
    /**
     * Get current request count for an identifier
     */
    getCurrentCount(identifier) {
        const entry = this.requests.get(identifier);
        if (!entry || Date.now() > entry.resetTime)
            return 0;
        return entry.count;
    }
}
// Rate limiter for /chat/recent endpoint: max 50 requests per 10 seconds per IP
exports.recentChatsRateLimiter = new RateLimiter(10000, 50);
// Rate limiter for WhatsApp messages: max 15 messages per minute per customer
// This prevents abuse and protects the system from message flooding
exports.whatsappMessageRateLimiter = new RateLimiter(60000, 15);
// Rate limiter for WhatsApp messages per workspace: max 100 messages per minute
exports.whatsappWorkspaceRateLimiter = new RateLimiter(60000, 100);
//# sourceMappingURL=rateLimiter.js.map