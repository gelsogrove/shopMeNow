/**
 * Unit tests for the ON-ACCOUNT recharge endpoint
 * (SubscriptionBillingController.rechargeOnAccount).
 *
 * WHAT: POST /subscription-billing/recharge credits the owner's wallet
 * immediately WITHOUT collecting money. The amount enters the month-end
 * invoice (subscription fee + recharges of the period, billing-math.ts) and
 * is collected in ONE PayPal capture on the 1st.
 *
 * WHY (Andrea's decision, 2026-08-12): this replaces the pay-now PayPal
 * checkout, which DOUBLE-CHARGED — the owner paid the checkout order AND the
 * same recharge re-entered the month-end invoice total that the scheduler
 * captures via outstanding balance.
 *
 * Key guarantees locked by these tests:
 *  - No payment step: the endpoint never talks to PayPal.
 *  - Deterministic guard: without an approved PayPal mandate the recharge is
 *    refused (402) — on-account credit would otherwise be uncollectable.
 *  - Amount validation errors from the service surface as 400, not 500.
 */

// === MOCKS MUST BE DECLARED BEFORE ANY IMPORTS ===

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock("@echatbot/database", () => ({
  PayPalStatus: {},
  TransactionType: { RECHARGE: "RECHARGE" },
  PrismaClient: jest.fn(),
}))

const mockRechargeOwnerCredit = jest.fn()
jest.mock("../../src/application/services/subscription-billing.service", () => ({
  SubscriptionBillingService: jest.fn().mockImplementation(() => ({
    rechargeOwnerCredit: mockRechargeOwnerCredit,
  })),
}))

import { SubscriptionBillingController } from "../../src/interfaces/http/controllers/subscription-billing.controller"

const mockFindUnique = jest.fn()
const prismaMock = { user: { findUnique: mockFindUnique } } as any

const buildRes = () => {
  const res: any = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

const buildReq = (userId: string | null, amount: unknown) =>
  ({ user: userId ? { id: userId } : undefined, body: { amount } }) as any

describe("SubscriptionBillingController.rechargeOnAccount", () => {
  let controller: SubscriptionBillingController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new SubscriptionBillingController(prismaMock)
    // fetch as sentinel: on-account means NO payment call of any kind
    global.fetch = jest.fn()
  })

  it("rejects unauthenticated calls with 401", async () => {
    const res = buildRes()
    await controller.rechargeOnAccount(buildReq(null, 50), res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(mockRechargeOwnerCredit).not.toHaveBeenCalled()
  })

  it("rejects a non-numeric or non-positive amount with 400", async () => {
    // The controller validates the TYPE of the input before touching the DB;
    // range validation (€10–€1000) stays in the service (single source).
    for (const bad of ["abc", -5, 0, null, undefined]) {
      const res = buildRes()
      await controller.rechargeOnAccount(buildReq("user-1", bad), res)
      expect(res.status).toHaveBeenCalledWith(400)
    }
    expect(mockRechargeOwnerCredit).not.toHaveBeenCalled()
  })

  it("refuses recharge without an approved PayPal mandate (402)", async () => {
    // Without a mandate the month-end capture has nothing to charge against:
    // granting credit here would be money we can never collect.
    mockFindUnique.mockResolvedValue({ paypalSubscriptionId: null })

    const res = buildRes()
    await controller.rechargeOnAccount(buildReq("user-1", 50), res)

    expect(res.status).toHaveBeenCalledWith(402)
    expect(mockRechargeOwnerCredit).not.toHaveBeenCalled()
  })

  it("credits the wallet WITHOUT any payment call when the mandate exists", async () => {
    mockFindUnique.mockResolvedValue({ paypalSubscriptionId: "I-TEST" })
    mockRechargeOwnerCredit.mockResolvedValue({
      success: true,
      newBalance: 90,
      upgradedToPlan: undefined,
    })

    const res = buildRes()
    await controller.rechargeOnAccount(buildReq("user-1", 50), res)

    expect(mockRechargeOwnerCredit).toHaveBeenCalledWith("user-1", 50)
    // THE core of the on-account model: money moves only on the 1st, through
    // the month-end scheduler — this endpoint must never call PayPal.
    expect(global.fetch).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { amount: 50, newBalance: 90, upgradedToPlan: undefined },
    })
  })

  it("reports the FREE_TRIAL → BASIC auto-upgrade triggered by the first recharge", async () => {
    // rechargeOwnerCredit upgrades trial owners on their first recharge;
    // the frontend needs the new plan name for its toast.
    mockFindUnique.mockResolvedValue({ paypalSubscriptionId: "I-TEST" })
    mockRechargeOwnerCredit.mockResolvedValue({
      success: true,
      newBalance: 25,
      upgradedToPlan: "BASIC",
    })

    const res = buildRes()
    await controller.rechargeOnAccount(buildReq("user-1", 25), res)

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { amount: 25, newBalance: 25, upgradedToPlan: "BASIC" },
    })
  })

  it("maps service validation errors (min/max amount) to 400, not 500", async () => {
    // The €10–€1000 range lives in rechargeOwnerCredit as the single source
    // of truth; its throw is a client error, not a server fault.
    mockFindUnique.mockResolvedValue({ paypalSubscriptionId: "I-TEST" })
    mockRechargeOwnerCredit.mockRejectedValue(new Error("Minimum recharge amount is €10"))

    const res = buildRes()
    await controller.rechargeOnAccount(buildReq("user-1", 5), res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: "Minimum recharge amount is €10" })
  })
})
