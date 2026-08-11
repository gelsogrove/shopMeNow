/**
 * Unit tests for PayPalInvoiceChargeService (month-end invoice collection).
 *
 * WHAT: verifies the ONLY component allowed to collect a MonthlyInvoice via
 * PayPal — guards, atomic attempt claiming, and the success/failure paths.
 *
 * WHY (Andrea's contract, 2026-08-11):
 *  - ONE automatic PayPal transaction per invoice (subscription + recharges).
 *  - If it fails, the invoice STAYS (status FAILED) and surfaces in the
 *    backoffice Collections page — soft block, the operator decides.
 *  - Attempt cap: 1 scheduler attempt + 3 operator retries = 4 total.
 *    A double-clicked Retry or a double-fired cron must NEVER charge twice —
 *    that is what the atomic claim (updateMany on status+retryCount) pins.
 */

// === MOCKS MUST BE DECLARED BEFORE ANY IMPORTS ===

const mockPrisma = {
  monthlyInvoice: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  payPalTransaction: { create: jest.fn() },
  billingTransaction: { create: jest.fn() },
}

jest.mock("@echatbot/database", () => ({
  prisma: mockPrisma,
}))

const mockMarkInvoicePaid = jest.fn()
jest.mock("../../src/application/services/invoice.service", () => ({
  InvoiceService: jest.fn().mockImplementation(() => ({
    markInvoicePaid: mockMarkInvoicePaid,
  })),
}))

const mockGetToken = jest.fn()
jest.mock("../../src/utils/paypal-config", () => ({
  getPayPalAccessToken: (...args: unknown[]) => mockGetToken(...args),
  loadPayPalConfigForEnv: jest.fn().mockReturnValue({
    configured: true,
    environment: "sandbox",
    apiBaseUrl: "https://api-m.sandbox.paypal.com",
  }),
  resolvePayPalEnvironment: jest.fn().mockReturnValue("sandbox"),
}))

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import {
  PayPalInvoiceChargeService,
  MAX_PAYMENT_ATTEMPTS,
} from "../../src/services/paypal-invoice-charge.service"

const service = new PayPalInvoiceChargeService()

/** A chargeable invoice fixture: PENDING, €90 total, owner has a mandate. */
const baseInvoice = (overrides: Record<string, unknown> = {}) => ({
  id: "inv-1",
  userId: "user-1",
  status: "PENDING",
  paymentRetryCount: 0,
  totalAmount: 90,
  periodMonth: 7,
  periodYear: 2026,
  user: {
    id: "user-1",
    email: "owner@test.com",
    creditBalance: 30,
    paypalSubscriptionId: "I-SUB123",
    paypalEnvironment: "sandbox",
    isPlatformAdmin: false,
    isDeveloperUser: false,
  },
  ...overrides,
})

const mockFetchSequence = (...responses: Array<{ ok: boolean; json?: unknown; text?: string }>) => {
  const fn = jest.fn()
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.ok,
      json: async () => r.json ?? {},
      text: async () => r.text ?? "",
    })
  }
  global.fetch = fn as unknown as typeof fetch
  return fn
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetToken.mockResolvedValue("app-token")
  mockPrisma.monthlyInvoice.updateMany.mockResolvedValue({ count: 1 })
  mockPrisma.monthlyInvoice.update.mockResolvedValue({})
  mockPrisma.payPalTransaction.create.mockResolvedValue({})
  mockPrisma.billingTransaction.create.mockResolvedValue({})
})

describe("PayPalInvoiceChargeService — guards", () => {
  it("SKIPs when the invoice does not exist", async () => {
    mockPrisma.monthlyInvoice.findUnique.mockResolvedValue(null)
    const result = await service.chargeInvoice("missing", "SCHEDULER")
    expect(result.status).toBe("SKIPPED")
  })

  it("SKIPs PAID invoices — a paid invoice must never be charged again", async () => {
    mockPrisma.monthlyInvoice.findUnique.mockResolvedValue(baseInvoice({ status: "PAID" }))
    const result = await service.chargeInvoice("inv-1", "ADMIN_RETRY")
    expect(result.status).toBe("SKIPPED")
    expect(mockPrisma.monthlyInvoice.updateMany).not.toHaveBeenCalled()
  })

  it(`SKIPs after ${MAX_PAYMENT_ATTEMPTS} attempts — then the OPERATOR decides (soft block)`, async () => {
    mockPrisma.monthlyInvoice.findUnique.mockResolvedValue(
      baseInvoice({ status: "FAILED", paymentRetryCount: MAX_PAYMENT_ATTEMPTS })
    )
    const result = await service.chargeInvoice("inv-1", "ADMIN_RETRY")
    expect(result.status).toBe("SKIPPED")
    expect(result.reason).toContain("Attempt limit reached")
  })

  it("marks a zero-total invoice PAID without ever calling PayPal", async () => {
    const fetchSpy = mockFetchSequence()
    mockPrisma.monthlyInvoice.findUnique.mockResolvedValue(baseInvoice({ totalAmount: 0 }))
    const result = await service.chargeInvoice("inv-1", "SCHEDULER")
    expect(result.status).toBe("PAID")
    expect(mockMarkInvoicePaid).toHaveBeenCalledWith("inv-1")
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("FAILs (without consuming retry budget) when the owner has no PayPal mandate", async () => {
    // Connecting PayPal later must leave the full retry budget available,
    // so a no-mandate failure happens BEFORE the attempt claim.
    mockPrisma.monthlyInvoice.findUnique.mockResolvedValue(
      baseInvoice({ user: { ...baseInvoice().user, paypalSubscriptionId: null } })
    )
    const result = await service.chargeInvoice("inv-1", "SCHEDULER")
    expect(result.status).toBe("FAILED")
    expect(result.reason).toContain("mandate")
    expect(mockPrisma.monthlyInvoice.updateMany).not.toHaveBeenCalled() // no claim
    // …but the failure IS recorded for the Collections page:
    expect(mockPrisma.payPalTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) })
    )
  })

  it("SKIPs when another caller already claimed the attempt (double-click / double cron)", async () => {
    mockPrisma.monthlyInvoice.findUnique.mockResolvedValue(baseInvoice())
    mockPrisma.monthlyInvoice.updateMany.mockResolvedValue({ count: 0 }) // lost the race
    const fetchSpy = mockFetchSequence()
    const result = await service.chargeInvoice("inv-1", "ADMIN_RETRY")
    expect(result.status).toBe("SKIPPED")
    expect(fetchSpy).not.toHaveBeenCalled() // no PayPal call without the claim
  })
})

describe("PayPalInvoiceChargeService — charge outcomes", () => {
  it("PAID path: sets outstanding balance, captures, records transaction + INVOICE_PAID", async () => {
    mockPrisma.monthlyInvoice.findUnique.mockResolvedValue(baseInvoice())
    const fetchSpy = mockFetchSequence(
      { ok: true }, // PATCH outstanding_balance
      { ok: true, json: { status: "COMPLETED", id: "CAP-1" } } // capture
    )

    const result = await service.chargeInvoice("inv-1", "SCHEDULER")

    expect(result).toMatchObject({ success: true, status: "PAID", transactionId: "CAP-1" })
    // PayPal-side idempotency key: one per attempt
    const captureCall = fetchSpy.mock.calls[1]
    expect(captureCall[1].headers["PayPal-Request-Id"]).toBe("inv-1:attempt-1")
    expect(mockMarkInvoicePaid).toHaveBeenCalledWith("inv-1", "CAP-1")
    expect(mockPrisma.payPalTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SUCCESS", invoiceId: "inv-1" }) })
    )
    expect(mockPrisma.billingTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "INVOICE_PAID", amount: 90 }) })
    )
  })

  it("FAILED path: capture rejected → invoice FAILED with reason, retry budget consumed", async () => {
    mockPrisma.monthlyInvoice.findUnique.mockResolvedValue(baseInvoice())
    mockFetchSequence(
      { ok: true }, // PATCH ok
      { ok: false, text: "INSTRUMENT_DECLINED" } // capture fails
    )

    const result = await service.chargeInvoice("inv-1", "ADMIN_RETRY", "admin-9")

    expect(result.status).toBe("FAILED")
    expect(result.attempt).toBe(1)
    // The claim incremented the counter BEFORE the PayPal call
    expect(mockPrisma.monthlyInvoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { paymentRetryCount: { increment: 1 } } })
    )
    // Invoice stays visible in Collections as FAILED, reason in adminNotes
    expect(mockPrisma.monthlyInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      })
    )
    expect(mockMarkInvoicePaid).not.toHaveBeenCalled()
  })
})
