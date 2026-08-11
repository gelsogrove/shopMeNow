/**
 * Unit tests for the manual admin plan change (POST /api/users/admin/:userId/change-plan).
 *
 * WHAT: verifies the two exported pure helpers of admin-user-plan.routes.ts:
 *   - isValidPlanType: request validation against the Prisma PlanType enum
 *   - buildPlanChangeUpdateData: the exact Prisma update payload
 *
 * WHY: the route's correctness hinges on these two pieces —
 *   1. only real PlanType values may reach the DB (no free-text plans);
 *   2. a manual change must reset planStartedAt (fresh trial/billing window)
 *      AND clear pendingPlanType/pendingPlanEffectiveDate, otherwise a
 *      previously scheduled downgrade would silently override the admin's
 *      manual choice when the scheduler next runs.
 */
import {
  buildPlanChangeUpdateData,
  isValidPlanType,
} from "../../../src/interfaces/http/routes/admin/admin-user-plan.routes"

describe("isValidPlanType", () => {
  it("accepts every real PlanType enum value", () => {
    // These are the 4 plans defined in packages/database/prisma/schema.prisma
    expect(isValidPlanType("FREE_TRIAL")).toBe(true)
    expect(isValidPlanType("BASIC")).toBe(true)
    expect(isValidPlanType("PREMIUM")).toBe(true)
    expect(isValidPlanType("ENTERPRISE")).toBe(true)
  })

  it("rejects unknown strings and non-string values", () => {
    // Free-text or malformed plan names must never reach prisma.user.update
    expect(isValidPlanType("GOLD")).toBe(false)
    expect(isValidPlanType("free_trial")).toBe(false) // case-sensitive
    expect(isValidPlanType("")).toBe(false)
    expect(isValidPlanType(undefined)).toBe(false)
    expect(isValidPlanType(null)).toBe(false)
    expect(isValidPlanType(42)).toBe(false)
  })
})

describe("buildPlanChangeUpdateData", () => {
  const now = new Date("2026-01-01T10:00:00.000Z")

  it("sets the new plan and resets planStartedAt to now", () => {
    // planStartedAt = now gives FREE_TRIAL a fresh 14-day window and
    // BASIC/PREMIUM a fresh 30-day billing window from the moment of change
    const result = buildPlanChangeUpdateData("ENTERPRISE", now)

    expect(result).toEqual(
      expect.objectContaining({
        planType: "ENTERPRISE",
        planStartedAt: now,
      })
    )
  })

  it("clears any pending scheduled plan change", () => {
    // A scheduled downgrade (pendingPlanType) must not survive a manual
    // admin change, or the scheduler would revert the admin's decision
    const result = buildPlanChangeUpdateData("BASIC", now)

    expect(result.pendingPlanType).toBeNull()
    expect(result.pendingPlanEffectiveDate).toBeNull()
  })
})
