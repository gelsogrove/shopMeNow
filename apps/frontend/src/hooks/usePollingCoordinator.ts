/**
 * Global polling coordinator to prevent multiple hooks from making redundant API calls
 */

class PollingCoordinator {
  private lastRecentChatsCall = 0
  private pendingCalls = new Set<string>()
  private subscribers = new Map<string, () => void>()
  private cachedData: any = null
  private cacheExpiry = 0

  // Minimum interval between API calls (in ms)
  private readonly MIN_INTERVAL = 4000 // 4 seconds (more lenient)
  private readonly CACHE_DURATION = 3000 // Cache data for 3 seconds

  /**
   * Check if we can make a call to the recent chats endpoint
   */
  canMakeCall(hookId: string): boolean {
    const now = Date.now()
    const timeSinceLastCall = now - this.lastRecentChatsCall

    // If we have fresh cached data, don't make a call
    if (this.cachedData && now < this.cacheExpiry) {
      return false
    }

    // If enough time has passed and no call is pending
    if (
      timeSinceLastCall >= this.MIN_INTERVAL &&
      !this.pendingCalls.has("recent-chats")
    ) {
      this.lastRecentChatsCall = now
      this.pendingCalls.add("recent-chats")

      return true
    }

    return false
  }

  /**
   * Mark a call as completed and cache the data
   */
  markCallCompleted(callType: string, data?: any) {
    this.pendingCalls.delete(callType)

    // Cache the data if provided
    if (data) {
      this.cachedData = data
      this.cacheExpiry = Date.now() + this.CACHE_DURATION
    }

    // Notify all subscribers that data might be available
    this.subscribers.forEach((callback) => callback())
  }

  /**
   * Get cached data if available and fresh
   */
  getCachedData(): any | null {
    if (this.cachedData && Date.now() < this.cacheExpiry) {
      return this.cachedData
    }
    return null
  }

  /**
   * Subscribe to call completion notifications
   */
  subscribe(hookId: string, callback: () => void) {
    this.subscribers.set(hookId, callback)
    return () => this.subscribers.delete(hookId)
  }

  /**
   * Get time until next allowed call
   */
  getTimeToNextCall(): number {
    const now = Date.now()
    const timeSinceLastCall = now - this.lastRecentChatsCall
    return Math.max(0, this.MIN_INTERVAL - timeSinceLastCall)
  }

  /**
   * Force clear cache (for testing)
   */
  clearCache() {
    this.cachedData = null
    this.cacheExpiry = 0
  }
}

export const pollingCoordinator = new PollingCoordinator()
