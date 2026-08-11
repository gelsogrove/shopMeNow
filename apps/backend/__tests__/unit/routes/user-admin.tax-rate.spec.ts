/**
 * Unit tests for the admin VAT rate endpoint (PATCH /api/users/admin/:userId/tax-rate).
 *
 * WHAT: verifies isValidTaxRate, the request guard of admin-user-plan.routes.ts.
 *
 * WHY: users.taxRate feeds EVERY invoice calculation (live draft, month-end
 * charge, PDF). A malformed value stored once would corrupt every invoice of
 * that user from then on — the guard is the only gate, so it gets full
 * edge-case coverage. The rate is a fraction (0.22 = 22%), never a percent.
 */
import { isValidTaxRate } from "../../../src/interfaces/http/routes/admin/admin-user-plan.routes"

describe("isValidTaxRate", () => {
  it("accepts common European VAT fractions", () => {
    expect(isValidTaxRate(0.22)).toBe(true) // Italy
    expect(isValidTaxRate(0.21)).toBe(true) // Spain
    expect(isValidTaxRate(0.19)).toBe(true) // Germany
    expect(isValidTaxRate(0)).toBe(true) // VAT-exempt
  })

  it("rejects percent-style numbers (22 instead of 0.22)", () => {
    // The most likely admin mistake: typing the percentage as a number
    expect(isValidTaxRate(22)).toBe(false)
    expect(isValidTaxRate(21)).toBe(false)
    expect(isValidTaxRate(1)).toBe(false) // 100% VAT is not a thing
  })

  it("rejects negatives, non-finite and non-numeric values", () => {
    expect(isValidTaxRate(-0.1)).toBe(false)
    expect(isValidTaxRate(NaN)).toBe(false)
    expect(isValidTaxRate(Infinity)).toBe(false)
    expect(isValidTaxRate("0.22")).toBe(false) // strings must not pass
    expect(isValidTaxRate(null)).toBe(false)
    expect(isValidTaxRate(undefined)).toBe(false)
  })
})
