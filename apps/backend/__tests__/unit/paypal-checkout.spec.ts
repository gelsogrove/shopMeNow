/**
 * Unit tests for the PayPal recharge checkout helpers
 * (src/services/paypal-checkout.service.ts).
 *
 * WHAT: the three pure pieces the money flow hinges on:
 *   - isValidRechargeAmount: the €10–€1000 gate
 *   - buildRechargeOrderPayload: the exact order sent to PayPal
 *   - extractCaptureResult: how a capture response is judged before crediting
 *
 * WHY: this is the ONLY way money enters the platform (credit-wallet model).
 * The wallet must be credited exclusively when PayPal reports COMPLETED, for
 * the amount PAYPAL reports (never the client's input), and custom_id must
 * carry the userId so the capture can verify order ownership.
 */

jest.mock('@echatbot/database', () => ({
  prisma: {},
}))
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import {
  isValidRechargeAmount,
  buildRechargeOrderPayload,
  extractCaptureResult,
  RECHARGE_MIN_EUR,
  RECHARGE_MAX_EUR,
} from "../../src/services/paypal-checkout.service"

describe("isValidRechargeAmount", () => {
  it("accepts amounts within €10–€1000", () => {
    expect(isValidRechargeAmount(RECHARGE_MIN_EUR)).toBe(true)
    expect(isValidRechargeAmount(25)).toBe(true)
    expect(isValidRechargeAmount(RECHARGE_MAX_EUR)).toBe(true)
  })

  it("rejects out-of-range and non-numeric values", () => {
    expect(isValidRechargeAmount(9.99)).toBe(false)
    expect(isValidRechargeAmount(1000.01)).toBe(false)
    expect(isValidRechargeAmount(0)).toBe(false)
    expect(isValidRechargeAmount(-50)).toBe(false)
    expect(isValidRechargeAmount(NaN)).toBe(false)
    expect(isValidRechargeAmount("50")).toBe(false) // strings must not pass
    expect(isValidRechargeAmount(undefined)).toBe(false)
  })
})

describe("buildRechargeOrderPayload", () => {
  it("builds a CAPTURE order in EUR with the userId as custom_id", () => {
    const payload = buildRechargeOrderPayload("user-123", 50, "https://app.example")

    expect(payload.intent).toBe("CAPTURE")
    expect(payload.purchase_units).toHaveLength(1)
    // custom_id is the ownership proof checked at capture time
    expect(payload.purchase_units[0].custom_id).toBe("user-123")
    expect(payload.purchase_units[0].amount).toEqual({
      currency_code: "EUR",
      value: "50.00",
    })
  })

  it("formats the amount with two decimals as PayPal requires", () => {
    const payload = buildRechargeOrderPayload("u", 12.5, "https://app.example")
    expect(payload.purchase_units[0].amount.value).toBe("12.50")
  })

  it("points return and cancel URLs at the billing page", () => {
    const payload = buildRechargeOrderPayload("u", 10, "https://app.example")
    expect(payload.application_context.return_url).toBe("https://app.example/billing?recharge=return")
    expect(payload.application_context.cancel_url).toBe("https://app.example/billing?recharge=cancelled")
  })
})

describe("extractCaptureResult", () => {
  const completedResponse = {
    status: "COMPLETED",
    purchase_units: [
      {
        custom_id: "user-123",
        payments: {
          captures: [
            {
              id: "CAP-1",
              status: "COMPLETED",
              custom_id: "user-123",
              amount: { currency_code: "EUR", value: "50.00" },
            },
          ],
        },
      },
    ],
  }

  it("reads amount and customId from a COMPLETED capture", () => {
    const result = extractCaptureResult(completedResponse)
    expect(result).toEqual({
      completed: true,
      customId: "user-123",
      amount: 50, // the amount PAYPAL confirms — this is what gets credited
      captureId: "CAP-1",
    })
  })

  it("is not completed when the order status is not COMPLETED", () => {
    const result = extractCaptureResult({ ...completedResponse, status: "PENDING" })
    expect(result.completed).toBe(false)
  })

  it("is not completed when the capture itself is DECLINED", () => {
    const declined = JSON.parse(JSON.stringify(completedResponse))
    declined.purchase_units[0].payments.captures[0].status = "DECLINED"
    expect(extractCaptureResult(declined).completed).toBe(false)
  })

  it("handles malformed/empty responses without crashing", () => {
    expect(extractCaptureResult(null)).toEqual({
      completed: false,
      customId: null,
      amount: null,
      captureId: null,
    })
    expect(extractCaptureResult({}).completed).toBe(false)
  })
})
