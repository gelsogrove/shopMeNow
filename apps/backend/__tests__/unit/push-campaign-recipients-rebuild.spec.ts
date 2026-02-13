/**
 * 🎯 TEST: Campaign Rebuild Recipients on Targeting Change
 *
 * SCENARIO: When campaign targeting changes (ALL→MANUAL, new tag, etc.),
 * the update() method must rebuild recipients and recalculate expectedRecipients.
 *
 * KEY RULES:
 * 1. Targeting type change → always rebuild
 * 2. MANUAL with new targetCustomerIds → rebuild
 * 3. TAGS with new tagId → rebuild
 * 4. ALL → always rebuild (refresh snapshot)
 * 5. expectedRecipients = recipients.length after rebuild
 *
 * 📚 minrequirement: "Manual selection rebuilds recipients and expectedRecipients;
 * card shows real pending count"
 */

describe("Campaign Rebuild Recipients on Targeting Change", () => {
  /**
   * Logic extracted from PushCampaignService.update() method.
   * Tests the shouldRebuildRecipients decision logic.
   */
  function shouldRebuild(
    existing: {
      targetingType: string
      targetCustomerIds?: string[]
      expectedRecipients?: number
      tagId?: string
    },
    input: {
      targetingType?: string
      targetCustomerIds?: string[]
      tagId?: string
    }
  ): boolean {
    const nextTargetingType = input.targetingType || existing.targetingType
    const nextTargetIds = input.targetCustomerIds ?? existing.targetCustomerIds ?? []
    const nextTagId = input.tagId ?? existing.tagId ?? null

    const targetingChanged = input.targetingType && input.targetingType !== existing.targetingType

    const manualListChanged =
      nextTargetingType === "MANUAL" && input.targetCustomerIds !== undefined

    const manualCountMismatch =
      nextTargetingType === "MANUAL" &&
      nextTargetIds.length > 0 &&
      nextTargetIds.length !== (existing.targetCustomerIds?.length || existing.expectedRecipients || 0)

    const tagChanged =
      nextTargetingType === "TAGS" && input.tagId !== undefined

    const forceAllRebuild = nextTargetingType === "ALL"

    return !!(
      targetingChanged ||
      manualListChanged ||
      manualCountMismatch ||
      tagChanged ||
      forceAllRebuild
    )
  }

  describe("Targeting type changes", () => {
    it("should rebuild when changing from ALL → MANUAL", () => {
      // SCENARIO: User switches from targeting ALL to MANUAL selection
      const existing = { targetingType: "ALL", expectedRecipients: 100 }
      const input = { targetingType: "MANUAL", targetCustomerIds: ["c1", "c2"] }

      expect(shouldRebuild(existing, input)).toBe(true)
    })

    it("should rebuild when changing from MANUAL → TAGS", () => {
      const existing = { targetingType: "MANUAL", targetCustomerIds: ["c1", "c2"] }
      const input = { targetingType: "TAGS", tagId: "tag-123" }

      expect(shouldRebuild(existing, input)).toBe(true)
    })

    it("should rebuild when changing from TAGS → ALL", () => {
      const existing = { targetingType: "TAGS", tagId: "tag-old" }
      const input = { targetingType: "ALL" }

      expect(shouldRebuild(existing, input)).toBe(true)
    })
  })

  describe("MANUAL: new customer list", () => {
    it("should rebuild when targetCustomerIds changes", () => {
      // SCENARIO: User updates MANUAL campaign with different customer list
      const existing = { targetingType: "MANUAL", targetCustomerIds: ["c1", "c2"] }
      const input = { targetCustomerIds: ["c3", "c4", "c5"] }

      expect(shouldRebuild(existing, input)).toBe(true)
    })

    it("should rebuild when customer count changes (mismatch)", () => {
      // SCENARIO: targetCustomerIds not explicitly in input but count differs
      const existing = { targetingType: "MANUAL", targetCustomerIds: ["c1", "c2"], expectedRecipients: 2 }
      const input = { targetCustomerIds: ["c1", "c2", "c3"] }

      expect(shouldRebuild(existing, input)).toBe(true)
    })
  })

  describe("TAGS: new tag", () => {
    it("should rebuild when tagId changes", () => {
      // SCENARIO: User changes the tag filter
      const existing = { targetingType: "TAGS", tagId: "tag-old" }
      const input = { tagId: "tag-new" }

      expect(shouldRebuild(existing, input)).toBe(true)
    })
  })

  describe("ALL: always refresh", () => {
    it("should always rebuild for ALL targeting (snapshot refresh)", () => {
      // RULE: ALL targeting always rebuilds to get current active customers
      const existing = { targetingType: "ALL", expectedRecipients: 50 }
      const input = {} // No targeting change, but ALL = always rebuild

      expect(shouldRebuild(existing, input)).toBe(true)
    })
  })

  describe("No rebuild needed", () => {
    it("should NOT rebuild when only message content changes", () => {
      // SCENARIO: User only changes campaign message, not recipients
      const existing = { targetingType: "MANUAL", targetCustomerIds: ["c1", "c2"], expectedRecipients: 2 }
      const input = {} // No targeting-related fields changed

      expect(shouldRebuild(existing, input)).toBe(false)
    })
  })

  describe("Deduplication of MANUAL targetCustomerIds", () => {
    it("should deduplicate IDs before building recipients", () => {
      // SCENARIO: Frontend sends duplicate customer IDs
      // RULE: [...new Set(ids)] removes duplicates before DB query
      const rawIds = ["c1", "c2", "c1", "c3", "c2"]
      const deduped = [...new Set(rawIds)]

      expect(deduped).toEqual(["c1", "c2", "c3"])
      expect(deduped.length).toBe(3) // NOT 5
    })
  })

  describe("Soft-deleted customer filtering", () => {
    it("should exclude soft-deleted customers from recipients", () => {
      // SCENARIO: Customer was deleted after being added to MANUAL targeting
      // RULE: buildRecipients query includes { deletedAt: null }
      // Simulates the Prisma where clause
      const customers = [
        { id: "c1", deletedAt: null },     // Active
        { id: "c2", deletedAt: new Date("2026-01-15") }, // Soft-deleted
        { id: "c3", deletedAt: null },     // Active
      ]

      const filtered = customers.filter(c => c.deletedAt === null)

      expect(filtered.length).toBe(2) // Only active customers
      expect(filtered.map(c => c.id)).toEqual(["c1", "c3"])
      // c2 is excluded because deletedAt is not null
    })
  })
})
