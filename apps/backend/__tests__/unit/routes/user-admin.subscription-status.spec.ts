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

  it("sets payment failure count and timestamp when PAYMENT_FAILED", () => {
    const result = buildSubscriptionStatusUpdateData("PAYMENT_FAILED", 1, now)

    expect(result).toEqual(
      expect.objectContaining({
        subscriptionStatus: "PAYMENT_FAILED",
        pausedAt: null,
        pauseRequestedAt: null,
        paymentFailureCount: 3,
        lastPaymentFailedAt: now,
      })
    )
  })

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
