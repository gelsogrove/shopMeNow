import { buildSubscriptionStatusUpdateData } from "../../../src/interfaces/http/routes/user-admin.routes"

describe("buildSubscriptionStatusUpdateData", () => {
  const now = new Date("2026-01-01T10:00:00.000Z")

  it("sets paused timestamps when PAUSED", () => {
    const result = buildSubscriptionStatusUpdateData("PAUSED", 0, now)

    expect(result).toEqual(
      expect.objectContaining({
        subscriptionStatus: "PAUSED",
        pausedAt: now,
        pauseRequestedAt: now,
        paymentFailureCount: 0,
        lastPaymentFailedAt: null,
      })
    )
  })

  // NOTE (2026-08-11, approved by Andrea): the PAYMENT_FAILED case was
  // REMOVED with the credit-wallet billing model — admins can only set
  // ACTIVE or PAUSED; legacy failure state is always cleared.

  it("resets failure count when ACTIVE", () => {
    const result = buildSubscriptionStatusUpdateData("ACTIVE", 5, now)

    expect(result).toEqual(
      expect.objectContaining({
        subscriptionStatus: "ACTIVE",
        pausedAt: null,
        pauseRequestedAt: null,
        paymentFailureCount: 0,
        lastPaymentFailedAt: null,
      })
    )
  })
})
