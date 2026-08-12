/**
 * Unit tests for the PayPal anchor-price neutralizer
 * (src/services/paypal-anchor.service.ts).
 *
 * WHAT: verifies that after the owner approves the €1/month "anchor"
 * subscription (the mandate PayPal forces us to price — zero is refused at
 * signup), the service revises THAT subscription's price down to €0.00 so
 * the €1 never recurs.
 *
 * WHY (Andrea's decision, 2026-08-12): the owner pays the €1 ONCE, at
 * signature, never again. Real collections go through outstanding-balance
 * captures on the 1st of the month; a recurring €1 on the signature
 * anniversary is uninvoiced money and confuses the customer.
 *
 * Key guarantees locked by these tests:
 *  - Idempotent: a subscription already at €0 is NOT revised again (no
 *    second PayPal write, safe to re-run the admin zero-anchors backfill).
 *  - Best-effort surface: a PayPal refusal returns { ok: false, error }
 *    instead of throwing, so the approval callback can never be broken by
 *    the revision.
 *  - The revision body targets the REGULAR cycle with fixed_price 0.00 EUR —
 *    the shared anchor PLAN keeps its €1 (new signups still need it).
 */

// === MOCKS MUST BE DECLARED BEFORE ANY IMPORTS ===

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

const mockGetToken = jest.fn()
jest.mock("../../src/utils/paypal-config", () => {
  const actual = jest.requireActual("../../src/utils/paypal-config")
  return {
    ...actual,
    getPayPalAccessToken: (...args: unknown[]) => mockGetToken(...args),
  }
})

import {
  PayPalAnchorService,
  ANCHOR_ZERO_PRICE,
  buildZeroPricingRevision,
  extractRegularCyclePrice,
} from "../../src/services/paypal-anchor.service"

const service = new PayPalAnchorService()

const sandboxConfig = {
  configured: true,
  environment: "sandbox" as const,
  clientId: "id",
  clientSecret: "secret",
  connectBaseUrl: "https://www.sandbox.paypal.com",
  apiBaseUrl: "https://api.test",
  planId: "P-TEST",
}

const jsonResponse = (body: unknown, ok = true) =>
  ({
    ok,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response

describe("extractRegularCyclePrice", () => {
  it("reads the REGULAR cycle override price from the subscription JSON", () => {
    // PayPal exposes the per-subscription override under plan.billing_cycles;
    // TRIAL cycles must be ignored — only REGULAR carries the anchor price.
    const price = extractRegularCyclePrice({
      plan: {
        billing_cycles: [
          { tenure_type: "TRIAL", pricing_scheme: { fixed_price: { value: "9.99" } } },
          { tenure_type: "REGULAR", pricing_scheme: { fixed_price: { value: "1.00" } } },
        ],
      },
    })
    expect(price).toBe("1.00")
  })

  it("returns null when PayPal exposes no per-subscription override", () => {
    // No override = the subscription follows the shared plan (€1 anchor):
    // the service must then attempt the revision, not skip it.
    expect(extractRegularCyclePrice({})).toBeNull()
    expect(extractRegularCyclePrice({ plan: {} })).toBeNull()
  })
})

describe("buildZeroPricingRevision", () => {
  it("targets sequence 1 with a fixed price of €0.00", () => {
    // This exact shape is what stops the recurring €1: PayPal replaces the
    // REGULAR cycle price for THIS subscription only.
    expect(buildZeroPricingRevision()).toEqual({
      plan: {
        billing_cycles: [
          {
            sequence: 1,
            pricing_scheme: {
              fixed_price: { value: ANCHOR_ZERO_PRICE, currency_code: "EUR" },
            },
          },
        ],
      },
    })
  })
})

describe("PayPalAnchorService.zeroAnchorPricing", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetToken.mockResolvedValue("test-token")
    global.fetch = jest.fn()
  })

  it("refuses to run when PayPal is not configured for the environment", async () => {
    // Missing credentials must produce a diagnosable failure, never a crash
    // and never a blind fetch to PayPal.
    const result = await service.zeroAnchorPricing(
      { ...sandboxConfig, configured: false },
      "I-TEST"
    )

    expect(result.ok).toBe(false)
    expect(result.error).toContain("not configured")
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("is idempotent: a subscription already at €0 is not revised again", async () => {
    // The admin zero-anchors backfill can be re-launched at any time; a
    // second run must report alreadyZero and write NOTHING to PayPal.
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        plan: {
          billing_cycles: [
            { tenure_type: "REGULAR", pricing_scheme: { fixed_price: { value: "0.00" } } },
          ],
        },
      })
    )

    const result = await service.zeroAnchorPricing(sandboxConfig, "I-TEST")

    expect(result).toEqual({ ok: true, alreadyZero: true, approvalRequired: false })
    expect(global.fetch).toHaveBeenCalledTimes(1) // GET only, no revise POST
  })

  it("revises a €1 subscription down to €0.00", async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        jsonResponse({
          plan: {
            billing_cycles: [
              { tenure_type: "REGULAR", pricing_scheme: { fixed_price: { value: "1.00" } } },
            ],
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ links: [] }))

    const result = await service.zeroAnchorPricing(sandboxConfig, "I-TEST")

    expect(result).toEqual({ ok: true, alreadyZero: false, approvalRequired: false })

    // The second call must be the revise POST with the €0.00 body.
    const [url, init] = (global.fetch as jest.Mock).mock.calls[1]
    expect(url).toBe("https://api.test/v1/billing/subscriptions/I-TEST/revise")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual(buildZeroPricingRevision())
  })

  it("surfaces approvalRequired when PayPal answers with an approve link", async () => {
    // If PayPal ever demands subscriber consent for the price change, the
    // caller must know the €1 is STILL alive until the owner approves.
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse({ plan: { billing_cycles: [] } }))
      .mockResolvedValueOnce(
        jsonResponse({ links: [{ rel: "approve", href: "https://paypal/approve" }] })
      )

    const result = await service.zeroAnchorPricing(sandboxConfig, "I-TEST")

    expect(result.ok).toBe(true)
    expect(result.approvalRequired).toBe(true)
  })

  it("returns the PayPal error instead of throwing when the revision is refused", async () => {
    // Best-effort contract: the approval callback and the admin backfill
    // must keep working even when PayPal says no — the error is reported.
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse({ plan: { billing_cycles: [] } }))
      .mockResolvedValueOnce(jsonResponse({ name: "UNPROCESSABLE_ENTITY" }, false))

    const result = await service.zeroAnchorPricing(sandboxConfig, "I-TEST")

    expect(result.ok).toBe(false)
    expect(result.error).toContain("UNPROCESSABLE_ENTITY")
  })
})
