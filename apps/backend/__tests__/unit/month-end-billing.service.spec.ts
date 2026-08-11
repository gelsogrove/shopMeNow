/**
 * Unit tests for the month-end billing run (runMonthEndBilling).
 *
 * WHAT: verifies the scheduler-side orchestration that, on the 1st of every
 * month at 23:30 (Europe/Rome), bills the month that just ENDED:
 * one invoice per owner (subscription + recharges), issued REGARDLESS of the
 * payment outcome, then a single PayPal charge attempt.
 *
 * WHY (Andrea's contract, 2026-08-11):
 *  - "fa sempre il mese passato"       → resolvePreviousPeriod, incl. the
 *    January → December year rollover that off-by-one bugs love.
 *  - "se la transazione non va la fattura si genera lo stesso con un fails"
 *    → ensureInvoiceNumber runs BEFORE the charge; a FAILED charge leaves an
 *    issued invoice for the Collections page.
 *  - Re-runnable: PAID/CANCELLED invoices are skipped, so re-launching after
 *    a crash can never double-bill.
 */

// === MOCKS MUST BE DECLARED BEFORE ANY IMPORTS ===

const mockPrisma = {
  user: {
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  monthlyInvoice: { findMany: jest.fn() },
}

jest.mock("@echatbot/database", () => ({
  prisma: mockPrisma,
}))

const mockGetOrCreate = jest.fn()
const mockFinalize = jest.fn()
const mockEnsureNumber = jest.fn()
jest.mock("../../src/application/services/invoice.service", () => ({
  InvoiceService: jest.fn().mockImplementation(() => ({
    getOrCreateInvoiceForPeriod: mockGetOrCreate,
    finalizeInvoice: mockFinalize,
    ensureInvoiceNumber: mockEnsureNumber,
  })),
}))

const mockCharge = jest.fn()
jest.mock("../../src/services/paypal-invoice-charge.service", () => ({
  MAX_PAYMENT_ATTEMPTS: 4,
  paypalInvoiceChargeService: { chargeInvoice: (...args: unknown[]) => mockCharge(...args) },
}))

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import {
  runMonthEndBilling,
  resolvePreviousPeriod,
} from "../../src/services/month-end-billing.service"

beforeEach(() => {
  jest.clearAllMocks()
  mockPrisma.user.findMany.mockResolvedValue([])
  mockPrisma.user.updateMany.mockResolvedValue({ count: 0 })
  mockPrisma.monthlyInvoice.findMany.mockResolvedValue([])
})

describe("resolvePreviousPeriod — 'fa sempre il mese passato'", () => {
  it("on August 1st bills July", () => {
    expect(resolvePreviousPeriod(new Date(2026, 7, 1, 23, 30))).toEqual({
      periodYear: 2026,
      periodMonth: 7,
    })
  })

  it("on January 1st bills DECEMBER of the PREVIOUS year (rollover)", () => {
    expect(resolvePreviousPeriod(new Date(2027, 0, 1, 23, 30))).toEqual({
      periodYear: 2026,
      periodMonth: 12,
    })
  })
})

describe("runMonthEndBilling", () => {
  const owner = { id: "user-1", email: "owner@test.com" }

  const primeOneOwner = (invoiceStatus = "DRAFT") => {
    // First user.findMany call = paying owners; second (inside
    // applyPendingPlansAndExpireTrials) = pending-plan owners.
    mockPrisma.user.findMany
      .mockResolvedValueOnce([]) // pending-plan owners (maintenance step)
      .mockResolvedValueOnce([owner]) // paying owners
    mockPrisma.monthlyInvoice.findMany.mockResolvedValue([])
    mockGetOrCreate.mockResolvedValue({ id: "inv-1", status: invoiceStatus })
  }

  it("issues the invoice BEFORE charging, so a FAILED charge still leaves an issued invoice", async () => {
    primeOneOwner()
    mockCharge.mockResolvedValue({ success: false, status: "FAILED", reason: "INSTRUMENT_DECLINED" })

    const summary = await runMonthEndBilling(new Date(2026, 7, 1, 23, 30))

    // The exact order Andrea dictated: finalize → number → charge
    expect(mockFinalize).toHaveBeenCalledWith("inv-1")
    expect(mockEnsureNumber).toHaveBeenCalledWith("inv-1", expect.any(Date))
    const numberOrder = mockEnsureNumber.mock.invocationCallOrder[0]
    const chargeOrder = mockCharge.mock.invocationCallOrder[0]
    expect(numberOrder).toBeLessThan(chargeOrder)

    expect(summary.invoicesFailed).toBe(1)
    expect(summary.invoicesPaid).toBe(0)
  })

  it("counts a successful charge as paid", async () => {
    primeOneOwner()
    mockCharge.mockResolvedValue({ success: true, status: "PAID", transactionId: "CAP-1" })

    const summary = await runMonthEndBilling(new Date(2026, 7, 1, 23, 30))

    expect(mockCharge).toHaveBeenCalledWith("inv-1", "SCHEDULER")
    expect(summary.invoicesPaid).toBe(1)
    expect(summary.invoicesFailed).toBe(0)
  })

  it("skips PAID invoices — a re-run after a crash can never double-bill", async () => {
    primeOneOwner("PAID")

    const summary = await runMonthEndBilling(new Date(2026, 7, 1, 23, 30))

    expect(mockFinalize).not.toHaveBeenCalled()
    expect(mockCharge).not.toHaveBeenCalled()
    expect(summary.invoicesSkipped).toBe(1)
  })

  it("pauses owners whose FREE_TRIAL expired before the month started", async () => {
    mockPrisma.user.findMany
      .mockResolvedValueOnce([]) // pending-plan owners
      .mockResolvedValueOnce([]) // paying owners
    mockPrisma.user.updateMany.mockResolvedValue({ count: 2 })

    await runMonthEndBilling(new Date(2026, 7, 1, 23, 30))

    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ planType: "FREE_TRIAL" }),
        data: expect.objectContaining({ subscriptionStatus: "PAUSED" }),
      })
    )
  })

  it("one owner erroring does not stop the others (isolation per owner)", async () => {
    const owner2 = { id: "user-2", email: "second@test.com" }
    mockPrisma.user.findMany
      .mockResolvedValueOnce([]) // pending-plan owners
      .mockResolvedValueOnce([owner, owner2]) // paying owners
    mockGetOrCreate
      .mockRejectedValueOnce(new Error("db down")) // owner 1 explodes
      .mockResolvedValueOnce({ id: "inv-2", status: "DRAFT" })
    mockCharge.mockResolvedValue({ success: true, status: "PAID" })

    const summary = await runMonthEndBilling(new Date(2026, 7, 1, 23, 30))

    expect(summary.errors).toBe(1)
    expect(summary.invoicesPaid).toBe(1) // owner 2 still billed
  })
})
