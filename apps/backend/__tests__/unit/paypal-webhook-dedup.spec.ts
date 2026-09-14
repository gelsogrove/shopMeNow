/**
 * PayPal webhook de-duplication.
 *
 * WHY (Andrea, 2026-09-14): PayPal retries a webhook delivery until it gets
 * a 200, and a replayed delivery carries a signature that is still valid —
 * so signature verification alone does NOT make the handler idempotent.
 * Before the dedup guard, a redelivered BILLING.SUBSCRIPTION.PAYMENT.SUCCESS
 * incremented paypalCyclesCompleted a second time, and a redelivered
 * PAYMENT.FAILED inflated paypalFailedPaymentsCount — both of which feed
 * billing decisions.
 *
 * The guard is an insert against a UNIQUE column (paypal_webhook_events
 * .eventId): the database, not application logic, decides who is first.
 * These tests pin that contract, mirroring the WhatsApp inbound webhooks.
 */

import * as fs from "fs"
import * as path from "path"

describe("PayPal webhook de-duplication", () => {
  // The behavioural tests below model the guard's shape. This one ties that
  // model to the REAL handler, so the suite cannot keep passing if someone
  // deletes the guard from paypal.routes.ts.
  it("is actually wired into the webhook handler", () => {
    const routes = fs.readFileSync(
      path.resolve(__dirname, "../../src/interfaces/http/routes/paypal.routes.ts"),
      "utf8"
    )

    expect(routes).toContain("payPalWebhookEvent.create")
    expect(routes).toContain('error?.code === "P2002"')
    // The dedup key must be PayPal's own event id, not the subscription id:
    // every event on one subscription shares the latter.
    expect(routes).toMatch(/eventId:\s*paypalEventId/)
  })

  /**
   * The handler's guard, extracted verbatim in shape from paypal.routes.ts:
   * insert the event id; treat P2002 (unique violation) as "already seen"
   * and stop. Anything else propagates — a DB outage must not be silently
   * read as a duplicate.
   */
  const dedupe = async (
    create: (data: { eventId: string; eventType: string | null }) => Promise<unknown>,
    eventId: string | undefined,
    eventType: string | null
  ): Promise<"processed" | "duplicate"> => {
    if (!eventId) return "processed"
    try {
      await create({ eventId, eventType })
      return "processed"
    } catch (error: any) {
      if (error?.code === "P2002") return "duplicate"
      throw error
    }
  }

  it("processes an event the first time it arrives", async () => {
    const create = jest.fn().mockResolvedValue({})

    const result = await dedupe(create, "WH-FIRST-DELIVERY", "BILLING.SUBSCRIPTION.PAYMENT.SUCCESS")

    expect(result).toBe("processed")
    expect(create).toHaveBeenCalledWith({
      eventId: "WH-FIRST-DELIVERY",
      eventType: "BILLING.SUBSCRIPTION.PAYMENT.SUCCESS",
    })
  })

  it("reports a redelivery of the same event id as duplicate", async () => {
    // Second delivery: the unique index rejects the insert with P2002, which
    // is exactly the signal that this event was already handled.
    const create = jest.fn().mockRejectedValue({ code: "P2002" })

    const result = await dedupe(create, "WH-REPLAYED", "BILLING.SUBSCRIPTION.PAYMENT.SUCCESS")

    expect(result).toBe("duplicate")
  })

  it("does not treat an unrelated database error as a duplicate", async () => {
    // A connection failure must surface, not be mistaken for "already seen" —
    // silently swallowing it would drop a real payment event on the floor.
    const create = jest.fn().mockRejectedValue({ code: "P1001", message: "Cannot reach database" })

    await expect(
      dedupe(create, "WH-DB-DOWN", "BILLING.SUBSCRIPTION.CANCELLED")
    ).rejects.toMatchObject({ code: "P1001" })
  })

  it("still processes a webhook that carries no event id", async () => {
    // Missing id: nothing to dedupe on. Processing is the safe direction —
    // dropping the event would lose a real billing signal.
    const create = jest.fn()

    const result = await dedupe(create, undefined, "BILLING.SUBSCRIPTION.ACTIVATED")

    expect(result).toBe("processed")
    expect(create).not.toHaveBeenCalled()
  })

  it("counts a successful payment exactly once across a retry storm", async () => {
    // End-to-end shape of the bug: PayPal delivers the same event 3 times.
    // Only the first may advance paypalCyclesCompleted.
    const seen = new Set<string>()
    const create = jest.fn().mockImplementation(async ({ eventId }: { eventId: string }) => {
      if (seen.has(eventId)) throw { code: "P2002" }
      seen.add(eventId)
    })

    let cyclesCompleted = 0
    for (let i = 0; i < 3; i++) {
      const outcome = await dedupe(create, "WH-SAME-EVENT", "BILLING.SUBSCRIPTION.PAYMENT.SUCCESS")
      if (outcome === "processed") cyclesCompleted++
    }

    expect(cyclesCompleted).toBe(1)
    expect(create).toHaveBeenCalledTimes(3)
  })
})
