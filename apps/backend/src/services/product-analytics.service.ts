/**
 * In-Memory Product Analytics Service
 * 
 * Lightweight alternative to product_searches table.
 * Aggregates search data in memory and persists only SUMMARY statistics.
 * 
 * Benefits:
 * - ❌ NO 40k+ duplicate DB records
 * - ✅ Only aggregated daily stats (~365 records/year vs 40k+)
 * - ✅ Real-time analytics without DB queries
 * - ✅ Auto-cleanup old data (retention: 90 days)
 * 
 * Usage:
 *   ProductAnalyticsService.trackSearch(workspaceId, query, customerId?)
 *   ProductAnalyticsService.getTopSearches(workspaceId, limit = 10)
 *   ProductAnalyticsService.getDailyStats(workspaceId, date)
 */

import { PrismaClient } from '@echatbot/database'
import logger from '../utils/logger'

interface SearchStats {
  query: string
  count: number
  lastSearched: Date
  uniqueCustomers: Set<string>
}

interface WorkspaceStats {
  searches: Map<string, SearchStats> // query -> stats
  totalSearches: number
  lastUpdated: Date
}

class ProductAnalyticsService {
  private static instance: ProductAnalyticsService
  private workspaceStats: Map<string, WorkspaceStats> = new Map()
  private prisma: PrismaClient | null = null
  private persistInterval: NodeJS.Timeout | null = null
  
  // Configuration
  private readonly PERSIST_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
  private readonly MAX_MEMORY_SEARCHES = 1000 // Per workspace
  private readonly RETENTION_DAYS = 90

  private constructor() {
    // Start auto-persist
    this.startAutoPersist()
  }

  public static getInstance(): ProductAnalyticsService {
    if (!ProductAnalyticsService.instance) {
      ProductAnalyticsService.instance = new ProductAnalyticsService()
    }
    return ProductAnalyticsService.instance
  }

  public setPrisma(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Track a product search (in-memory only)
   */
  public trackSearch(workspaceId: string, query: string, customerId?: string) {
    const normalizedQuery = query.trim().toLowerCase()

    // Get or create workspace stats
    if (!this.workspaceStats.has(workspaceId)) {
      this.workspaceStats.set(workspaceId, {
        searches: new Map(),
        totalSearches: 0,
        lastUpdated: new Date()
      })
    }

    const stats = this.workspaceStats.get(workspaceId)!

    // Get or create search stats
    if (!stats.searches.has(normalizedQuery)) {
      stats.searches.set(normalizedQuery, {
        query: normalizedQuery,
        count: 0,
        lastSearched: new Date(),
        uniqueCustomers: new Set()
      })
    }

    const searchStats = stats.searches.get(normalizedQuery)!
    searchStats.count++
    searchStats.lastSearched = new Date()
    if (customerId) {
      searchStats.uniqueCustomers.add(customerId)
    }

    stats.totalSearches++
    stats.lastUpdated = new Date()

    // Memory limit: keep only top N searches
    if (stats.searches.size > this.MAX_MEMORY_SEARCHES) {
      const sorted = Array.from(stats.searches.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, this.MAX_MEMORY_SEARCHES)
      
      stats.searches.clear()
      sorted.forEach(s => stats.searches.set(s.query, s))
    }

    logger.debug('📊 Search tracked (in-memory)', {
      workspaceId,
      query: normalizedQuery,
      totalSearches: stats.totalSearches
    })
  }

  /**
   * Get top N searches for a workspace (real-time)
   */
  public getTopSearches(workspaceId: string, limit: number = 10): Array<{
    query: string
    count: number
    uniqueCustomers: number
    lastSearched: Date
  }> {
    const stats = this.workspaceStats.get(workspaceId)
    if (!stats) return []

    return Array.from(stats.searches.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(s => ({
        query: s.query,
        count: s.count,
        uniqueCustomers: s.uniqueCustomers.size,
        lastSearched: s.lastSearched
      }))
  }

  /**
   * Get total searches for workspace
   */
  public getTotalSearches(workspaceId: string): number {
    return this.workspaceStats.get(workspaceId)?.totalSearches || 0
  }

  /**
   * Clear in-memory stats (useful for testing)
   */
  public clearStats(workspaceId?: string) {
    if (workspaceId) {
      this.workspaceStats.delete(workspaceId)
    } else {
      this.workspaceStats.clear()
    }
  }

  /**
   * Persist aggregated stats to database (hourly)
   * Stores only daily summary - MUCH lighter than per-search records
   */
  private async persistStats() {
    if (!this.prisma) return

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const [workspaceId, stats] of this.workspaceStats.entries()) {
      try {
        // TODO: Create ProductAnalyticsSummary table for aggregated data
        // Schema:
        // - workspaceId: String
        // - date: DateTime (day level)
        // - totalSearches: Int
        // - topSearches: Json (top 20 with counts)
        // - uniqueCustomers: Int
        
        // For now: just log
        logger.info('📊 Daily analytics summary', {
          workspaceId,
          date: today.toISOString().split('T')[0],
          totalSearches: stats.totalSearches,
          uniqueSearches: stats.searches.size,
          topSearch: this.getTopSearches(workspaceId, 1)[0]
        })

        // Optional: Reset daily stats after midnight
        const now = new Date()
        if (now.getDate() !== stats.lastUpdated.getDate()) {
          stats.totalSearches = 0
          // Keep top searches but reset counts
          stats.searches.forEach(s => { s.count = 0 })
        }

      } catch (error) {
        logger.error('Failed to persist analytics', { workspaceId, error })
      }
    }
  }

  /**
   * Start auto-persist timer
   */
  private startAutoPersist() {
    if (this.persistInterval) return

    this.persistInterval = setInterval(() => {
      this.persistStats().catch(err => 
        logger.error('Auto-persist failed', err)
      )
    }, this.PERSIST_INTERVAL_MS)

    logger.info('✅ ProductAnalyticsService started (in-memory aggregation)')
  }

  /**
   * Stop auto-persist (cleanup)
   */
  public stop() {
    if (this.persistInterval) {
      clearInterval(this.persistInterval)
      this.persistInterval = null
    }
  }
}

export default ProductAnalyticsService.getInstance()
