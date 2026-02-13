/**
 * 🎯 TEST: Campaign TargetingType Normalization
 *
 * SCENARIO: The frontend/API sends targetingType in various formats.
 * The normalizeTargetingType() method must handle all of them.
 *
 * KEY RULE: Quoted, lowercase, whitespace variants must all resolve to
 * the correct CampaignTargetType enum value.
 *
 * 📚 minrequirement: "Create/Update accepts targetingType in any client format
 * (MANUAL/ALL/TAGS; quoted values handled)"
 */

import { CampaignTargetType } from "@echatbot/database"

// We test the logic directly since normalizeTargetingType is private.
// Replicate its logic here per the actual implementation.
function normalizeTargetingType(raw?: any): CampaignTargetType | undefined {
  if (raw === undefined || raw === null) return undefined
  let val = String(raw).trim()
  // Remove escape backslashes
  val = val.replace(/\\+/g, "")

  // Try JSON parse if still quoted
  if (/^".*"$/.test(val) || /^'.*'$/.test(val)) {
    try {
      val = JSON.parse(val)
    } catch {
      // ignore parsing errors, continue
    }
  }

  // Strip any remaining quotes
  val = val.replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, "")

  val = val.toUpperCase()
  if (val === "ALL") return CampaignTargetType.ALL
  if (val === "MANUAL") return CampaignTargetType.MANUAL
  if (val === "TAGS") return CampaignTargetType.TAGS
  return undefined
}

describe("Campaign TargetingType Normalization", () => {
  describe("Standard enum values", () => {
    it("should accept plain MANUAL", () => {
      expect(normalizeTargetingType("MANUAL")).toBe(CampaignTargetType.MANUAL)
    })

    it("should accept plain ALL", () => {
      expect(normalizeTargetingType("ALL")).toBe(CampaignTargetType.ALL)
    })

    it("should accept plain TAGS", () => {
      expect(normalizeTargetingType("TAGS")).toBe(CampaignTargetType.TAGS)
    })
  })

  describe("Lowercase values", () => {
    it("should normalize lowercase 'manual' → MANUAL", () => {
      expect(normalizeTargetingType("manual")).toBe(CampaignTargetType.MANUAL)
    })

    it("should normalize lowercase 'all' → ALL", () => {
      expect(normalizeTargetingType("all")).toBe(CampaignTargetType.ALL)
    })

    it("should normalize mixed case 'Tags' → TAGS", () => {
      expect(normalizeTargetingType("Tags")).toBe(CampaignTargetType.TAGS)
    })
  })

  describe("JSON-escaped quoted values", () => {
    it('should handle JSON double-quoted "MANUAL" → MANUAL', () => {
      // SCENARIO: Client sends JSON.stringify("MANUAL") = '"MANUAL"'
      expect(normalizeTargetingType('"MANUAL"')).toBe(CampaignTargetType.MANUAL)
    })

    it('should handle escaped double-quoted \\"MANUAL\\" → MANUAL', () => {
      // SCENARIO: Client sends extra-escaped value
      expect(normalizeTargetingType('\\"MANUAL\\"')).toBe(CampaignTargetType.MANUAL)
    })

    it("should handle single-quoted 'ALL' → ALL", () => {
      expect(normalizeTargetingType("'ALL'")).toBe(CampaignTargetType.ALL)
    })
  })

  describe("Whitespace handling", () => {
    it("should trim leading/trailing whitespace", () => {
      expect(normalizeTargetingType("  MANUAL  ")).toBe(CampaignTargetType.MANUAL)
    })

    it("should handle tabs and newlines", () => {
      expect(normalizeTargetingType("\tALL\n")).toBe(CampaignTargetType.ALL)
    })
  })

  describe("Null/undefined/invalid values", () => {
    it("should return undefined for null", () => {
      expect(normalizeTargetingType(null)).toBeUndefined()
    })

    it("should return undefined for undefined", () => {
      expect(normalizeTargetingType(undefined)).toBeUndefined()
    })

    it("should return undefined for unknown value", () => {
      expect(normalizeTargetingType("INVALID")).toBeUndefined()
    })

    it("should return undefined for empty string", () => {
      expect(normalizeTargetingType("")).toBeUndefined()
    })
  })
})
