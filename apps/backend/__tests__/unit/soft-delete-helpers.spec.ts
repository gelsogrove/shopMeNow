/**
 * Unit Test: Soft Delete Helper Functions
 * Tests helper utilities for soft-delete filtering
 */

import {
  buildSoftDeleteFilter,
  buildTrashFilter,
  buildRetentionExpiredFilter,
  buildRetentionActiveFilter,
} from "../../src/utils/soft-delete.helper"

describe("Soft Delete Helper Functions", () => {
  // ======================================
  // Test buildSoftDeleteFilter
  // ======================================
  describe("buildSoftDeleteFilter()", () => {
    it("should return filter for non-deleted records", () => {
      const filter = buildSoftDeleteFilter()

      expect(filter).toEqual({
        deletedAt: null,
      })
    })

    it("should be usable in queries", () => {
      const filter = buildSoftDeleteFilter()
      const query = {
        workspaceId: "ws-123",
        ...filter,
      }

      expect(query).toEqual({
        workspaceId: "ws-123",
        deletedAt: null,
      })
    })
  })

  // ======================================
  // Test buildTrashFilter
  // ======================================
  describe("buildTrashFilter()", () => {
    it("should return filter for soft-deleted records", () => {
      const filter = buildTrashFilter()

      expect(filter).toEqual({
        deletedAt: {
          not: null,
        },
      })
    })

    it("should be usable in queries", () => {
      const filter = buildTrashFilter()
      const query = {
        workspaceId: "ws-123",
        ...filter,
      }

      expect(query.deletedAt).toEqual({
        not: null,
      })
    })
  })

  // ======================================
  // Test buildRetentionExpiredFilter
  // ======================================
  describe("buildRetentionExpiredFilter()", () => {
    it("should return filter for expired records (90 days)", () => {
      const filter = buildRetentionExpiredFilter(90)

      expect(filter).toHaveProperty("deletedAt")
      expect(filter.deletedAt).toHaveProperty("lt")
      expect(filter.deletedAt.lt).toBeInstanceOf(Date)
    })

    it("should calculate correct expiry date", () => {
      const now = new Date()
      const filter = buildRetentionExpiredFilter(90)
      const expiryDate = filter.deletedAt.lt

      // Should be approximately 90 days ago
      const expectedDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      const daysDiff = Math.abs(
        (expiryDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      expect(daysDiff).toBeLessThan(1) // Allow 1 day margin
    })

    it("should work with different retention windows", () => {
      const filter30 = buildRetentionExpiredFilter(30)
      const filter180 = buildRetentionExpiredFilter(180)

      // 180-day expiry should be OLDER (lower date) than 30-day
      // because it expires 180 days ago, which is earlier than 30 days ago
      expect(filter180.deletedAt.lt.getTime()).toBeLessThan(
        filter30.deletedAt.lt.getTime()
      )
    })
  })

  // ======================================
  // Test buildRetentionActiveFilter
  // ======================================
  describe("buildRetentionActiveFilter()", () => {
    it("should return filter for records within retention window", () => {
      const filter = buildRetentionActiveFilter(90)

      expect(filter).toHaveProperty("AND")
      expect(filter.AND).toBeInstanceOf(Array)
      expect(filter.AND).toHaveLength(2)
    })

    it("should include condition for non-null deletedAt", () => {
      const filter = buildRetentionActiveFilter(90)

      expect(filter.AND).toContainEqual({
        deletedAt: { not: null },
      })
    })

    it("should include condition for recent deletion", () => {
      const filter = buildRetentionActiveFilter(90)
      const gteCondition = filter.AND.find(
        (c) => c.deletedAt && c.deletedAt.gte
      )

      // The AND filter should have a gte condition for dates >= 90 days ago
      expect(gteCondition).toBeDefined()
      expect(gteCondition?.deletedAt.gte).toBeInstanceOf(Date)
    })

    it("should calculate correct retention start date", () => {
      const now = new Date()
      const filter = buildRetentionActiveFilter(90)
      const retentionStart = filter.AND.find(
        (c) => c.deletedAt && c.deletedAt.gte
      )?.deletedAt.gte

      const expectedDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      const daysDiff = Math.abs(
        (retentionStart.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      expect(daysDiff).toBeLessThan(1) // Allow 1 day margin
    })
  })

  // ======================================
  // Integration Tests
  // ======================================
  describe("Integration: Filter Usage", () => {
    it("should combine soft-delete filter with workspace filter", () => {
      const filter = buildSoftDeleteFilter()
      const query = {
        workspaceId: "ws-123",
        isActive: true,
        ...filter,
      }

      expect(query).toEqual({
        workspaceId: "ws-123",
        isActive: true,
        deletedAt: null,
      })
    })

    it("should combine trash filter with workspace filter", () => {
      const filter = buildTrashFilter()
      const query = {
        workspaceId: "ws-123",
        ...filter,
      }

      expect(query.deletedAt).toEqual({
        not: null,
      })
    })

    it("should build query for retention-expired hard delete", () => {
      const filter = buildRetentionExpiredFilter(90)
      const query = {
        workspaceId: "ws-123",
        ...filter,
      }

      expect(query.workspaceId).toBe("ws-123")
      expect(query.deletedAt.lt).toBeInstanceOf(Date)
    })

    it("should build query for retention-active records", () => {
      const filter = buildRetentionActiveFilter(90)
      const query = {
        workspaceId: "ws-123",
        ...filter,
      }

      expect(query.workspaceId).toBe("ws-123")
      expect(query.AND).toBeDefined()
    })
  })

  // ======================================
  // Test getDaysUntilPermanentDelete
  // ======================================
  describe("getDaysUntilPermanentDelete()", () => {
    // Dynamically import to test
    let getDaysUntilPermanentDelete: typeof import("../../src/utils/soft-delete.helper").getDaysUntilPermanentDelete

    beforeAll(async () => {
      const helpers = await import("../../src/utils/soft-delete.helper")
      getDaysUntilPermanentDelete = helpers.getDaysUntilPermanentDelete
    })

    it("should return positive days for recent deletion", () => {
      const deletedYesterday = new Date()
      deletedYesterday.setDate(deletedYesterday.getDate() - 1)

      const days = getDaysUntilPermanentDelete(deletedYesterday, 90)
      expect(days).toBeGreaterThan(85)
      expect(days).toBeLessThanOrEqual(89)
    })

    it("should return 0 for expired records", () => {
      const deleted100DaysAgo = new Date()
      deleted100DaysAgo.setDate(deleted100DaysAgo.getDate() - 100)

      const days = getDaysUntilPermanentDelete(deleted100DaysAgo, 90)
      expect(days).toBe(0)
    })

    it("should return 0 for records exactly at retention limit", () => {
      const deletedExactly90DaysAgo = new Date()
      deletedExactly90DaysAgo.setDate(deletedExactly90DaysAgo.getDate() - 90)

      const days = getDaysUntilPermanentDelete(deletedExactly90DaysAgo, 90)
      expect(days).toBeLessThanOrEqual(1) // Allow for time of day variance
    })

    it("should use default 90 days retention", () => {
      const deletedRecently = new Date()

      const days = getDaysUntilPermanentDelete(deletedRecently)
      expect(days).toBeGreaterThanOrEqual(89)
      expect(days).toBeLessThanOrEqual(90)
    })

    it("should respect custom retention days", () => {
      const deleted = new Date()
      deleted.setDate(deleted.getDate() - 20)

      const days30 = getDaysUntilPermanentDelete(deleted, 30)
      const days60 = getDaysUntilPermanentDelete(deleted, 60)

      expect(days30).toBeLessThan(days60)
    })
  })

  // ======================================
  // Test isWithinRetentionWindow
  // ======================================
  describe("isWithinRetentionWindow()", () => {
    let isWithinRetentionWindow: typeof import("../../src/utils/soft-delete.helper").isWithinRetentionWindow

    beforeAll(async () => {
      const helpers = await import("../../src/utils/soft-delete.helper")
      isWithinRetentionWindow = helpers.isWithinRetentionWindow
    })

    it("should return true for recent deletion", () => {
      const deletedYesterday = new Date()
      deletedYesterday.setDate(deletedYesterday.getDate() - 1)

      expect(isWithinRetentionWindow(deletedYesterday)).toBe(true)
    })

    it("should return false for expired deletion", () => {
      const deleted100DaysAgo = new Date()
      deleted100DaysAgo.setDate(deleted100DaysAgo.getDate() - 100)

      expect(isWithinRetentionWindow(deleted100DaysAgo)).toBe(false)
    })

    it("should respect custom retention days", () => {
      const deleted45DaysAgo = new Date()
      deleted45DaysAgo.setDate(deleted45DaysAgo.getDate() - 45)

      // Within 90-day window
      expect(isWithinRetentionWindow(deleted45DaysAgo, 90)).toBe(true)
      // Outside 30-day window
      expect(isWithinRetentionWindow(deleted45DaysAgo, 30)).toBe(false)
    })
  })

  // ======================================
  // Test getRetentionDaysConfig
  // ======================================
  describe("getRetentionDaysConfig()", () => {
    let getRetentionDaysConfig: typeof import("../../src/utils/soft-delete.helper").getRetentionDaysConfig
    const originalEnv = process.env.SOFT_DELETE_RETENTION_DAYS

    beforeAll(async () => {
      const helpers = await import("../../src/utils/soft-delete.helper")
      getRetentionDaysConfig = helpers.getRetentionDaysConfig
    })

    afterEach(() => {
      // Restore original env
      if (originalEnv !== undefined) {
        process.env.SOFT_DELETE_RETENTION_DAYS = originalEnv
      } else {
        delete process.env.SOFT_DELETE_RETENTION_DAYS
      }
    })

    it("should return 90 as default when env not set", () => {
      delete process.env.SOFT_DELETE_RETENTION_DAYS
      expect(getRetentionDaysConfig()).toBe(90)
    })

    it("should return custom value from env", () => {
      process.env.SOFT_DELETE_RETENTION_DAYS = "30"
      expect(getRetentionDaysConfig()).toBe(30)
    })

    it("should return 90 for invalid env value", () => {
      process.env.SOFT_DELETE_RETENTION_DAYS = "invalid"
      expect(getRetentionDaysConfig()).toBe(90)
    })

    it("should return 90 for negative env value", () => {
      process.env.SOFT_DELETE_RETENTION_DAYS = "-5"
      expect(getRetentionDaysConfig()).toBe(90)
    })

    it("should return 90 for zero env value", () => {
      process.env.SOFT_DELETE_RETENTION_DAYS = "0"
      expect(getRetentionDaysConfig()).toBe(90)
    })

    it("should return 90 for empty string env value", () => {
      process.env.SOFT_DELETE_RETENTION_DAYS = ""
      expect(getRetentionDaysConfig()).toBe(90)
    })
  })
})
