/**
 * Unit tests for the SHARED billing math (packages/database/src/billing-math.ts).
 *
 * WHAT: verifies the single source of truth used by BOTH the backend
 * (live DRAFT invoice) and the scheduler (month-end charge):
 *   - computeInvoiceTotals: subtotal composition + VAT + total
 *   - computeMonthlyCharge: what gets deducted from the owner's credit
 *   - roundMoney: cent rounding
 *
 * WHY: Andrea's rule — ONE formula everywhere. These tests pin the formula
 * itself; if backend and scheduler both import it (they do), they cannot
 * diverge. The rate is always an argument (users.taxRate), never a constant.
 */
import {
  roundMoney,
  computeInvoiceTotals,
  computeMonthlyCharge,
} from "../../../../packages/database/src/billing-math"

describe("roundMoney", () => {
  it("rounds to cents", () => {
    expect(roundMoney(13.199999)).toBe(13.2)
    expect(roundMoney(0.105)).toBe(0.11)
    expect(roundMoney(60)).toBe(60)
  })
})

describe("computeInvoiceTotals", () => {
  it("computes subtotal + VAT + total for a plain subscription (60 @ 22%)", () => {
    // The Enterprise case Andrea configured: €60 + 22% = €73.20
    const result = computeInvoiceTotals(60, 0, 0, 0.22)
    expect(result).toEqual({
      subtotalAmount: 60,
      taxAmount: 13.2,
      totalAmount: 73.2,
    })
  })

  it("supports per-user rates (same fee, 21% for a Spanish customer)", () => {
    const result = computeInvoiceTotals(60, 0, 0, 0.21)
    expect(result).toEqual({
      subtotalAmount: 60,
      taxAmount: 12.6,
      totalAmount: 72.6,
    })
  })

  it("includes adjustments and recharges in the subtotal", () => {
    // subscription 60 + adjustment 10 + recharges 50 = 120; VAT 22% = 26.40
    const result = computeInvoiceTotals(60, 10, 50, 0.22)
    expect(result).toEqual({
      subtotalAmount: 120,
      taxAmount: 26.4,
      totalAmount: 146.4,
    })
  })

  it("never produces negative VAT when credit notes push subtotal below zero", () => {
    // Negative adjustment larger than the fee: tax base is clamped to 0
    const result = computeInvoiceTotals(20, -50, 0, 0.22)
    expect(result.subtotalAmount).toBe(-30)
    expect(result.taxAmount).toBe(0)
    expect(result.totalAmount).toBe(-30)
  })
})

describe("computeMonthlyCharge", () => {
  it("charges fee + VAT on the fee (what the scheduler deducts from credit)", () => {
    // Consumption is NOT here: it is deducted live during the month.
    // Recharges are NOT here: they were paid when made.
    const result = computeMonthlyCharge(60, 0.22)
    expect(result).toEqual({
      fee: 60,
      taxAmount: 13.2,
      chargeAmount: 73.2,
    })
  })

  it("charges zero for a zero fee (e.g. FREE plan rows)", () => {
    expect(computeMonthlyCharge(0, 0.22)).toEqual({
      fee: 0,
      taxAmount: 0,
      chargeAmount: 0,
    })
  })

  it("respects a zero tax rate (VAT-exempt customer)", () => {
    expect(computeMonthlyCharge(60, 0)).toEqual({
      fee: 60,
      taxAmount: 0,
      chargeAmount: 60,
    })
  })
})
