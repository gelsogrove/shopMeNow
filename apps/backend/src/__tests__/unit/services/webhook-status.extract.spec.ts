/**
 * Unit tests — webhook delivery-status extraction (✓✓ delivered / ✓✓ blue read).
 *
 * WHAT: each provider reports message delivery differently; these extractors
 * normalise the webhook payload into { providerMessageId, status } entries where
 * status is "delivered" or "read".
 * WHY: the double-tick (and blue read tick) must work identically across
 * Meta / UltraMsg / Wasender, and we must NOT mistake a "sent"-only ack or an
 * inbound message for a delivery.
 */

import {
  extractMetaStatusUpdates,
  extractUltramsgStatusUpdates,
  extractWasenderStatusUpdates,
} from "../../../services/webhook-status.extract"

describe("extractMetaStatusUpdates", () => {
  it("maps delivered → delivered and read → read", () => {
    const value = {
      statuses: [
        { id: "wamid.A", status: "delivered" },
        { id: "wamid.B", status: "read" },
      ],
    }
    expect(extractMetaStatusUpdates(value)).toEqual([
      { providerMessageId: "wamid.A", status: "delivered" },
      { providerMessageId: "wamid.B", status: "read" },
    ])
  })

  it("ignores sent and failed statuses (only ✓, not ✓✓)", () => {
    const value = { statuses: [{ id: "a", status: "sent" }, { id: "b", status: "failed" }] }
    expect(extractMetaStatusUpdates(value)).toEqual([])
  })

  it("returns empty for a non-status payload", () => {
    expect(extractMetaStatusUpdates({ messages: [{ id: "x" }] })).toEqual([])
    expect(extractMetaStatusUpdates(undefined)).toEqual([])
  })
})

describe("extractUltramsgStatusUpdates", () => {
  // UltraMsg ack: pending < server < device(=delivered,2) < read(3) < played.
  it("maps device → delivered, read/played → read", () => {
    expect(
      extractUltramsgStatusUpdates({ event_type: "message_ack", data: { id: "d", ack: "device" } })
    ).toEqual([{ providerMessageId: "d", status: "delivered" }])
    expect(
      extractUltramsgStatusUpdates({ event_type: "message_ack", data: { id: "r", ack: "read" } })
    ).toEqual([{ providerMessageId: "r", status: "read" }])
    expect(
      extractUltramsgStatusUpdates({ event_type: "message_ack", data: { id: "p", ack: "played" } })
    ).toEqual([{ providerMessageId: "p", status: "read" }])
  })

  it("supports numeric ack (2=delivered, 3=read)", () => {
    expect(
      extractUltramsgStatusUpdates({ event_type: "message_ack", data: { id: "n2", ack: 2 } })
    ).toEqual([{ providerMessageId: "n2", status: "delivered" }])
    expect(
      extractUltramsgStatusUpdates({ event_type: "message_ack", data: { id: "n3", ack: 3 } })
    ).toEqual([{ providerMessageId: "n3", status: "read" }])
  })

  it("ignores 'server'/'pending' acks and non-ack events", () => {
    expect(
      extractUltramsgStatusUpdates({ event_type: "message_ack", data: { id: "s", ack: "server" } })
    ).toEqual([])
    expect(
      extractUltramsgStatusUpdates({ event_type: "message_received", data: { id: "x" } })
    ).toEqual([])
  })
})

describe("extractWasenderStatusUpdates", () => {
  // Baileys: server_ack=2 < delivery_ack=3(delivered) < read=4 < played=5.
  it("maps delivered/read strings and raw enum names", () => {
    expect(
      extractWasenderStatusUpdates({
        event: "messages.update",
        data: { key: { id: "wa-1" }, update: { status: "DELIVERY_ACK" } },
      })
    ).toEqual([{ providerMessageId: "wa-1", status: "delivered" }])
    expect(
      extractWasenderStatusUpdates({
        event: "messages.update",
        data: { key: { id: "wa-2" }, update: { status: "read" } },
      })
    ).toEqual([{ providerMessageId: "wa-2", status: "read" }])
  })

  it("supports numeric Baileys status (3=delivered, 4=read, 2 ignored)", () => {
    expect(
      extractWasenderStatusUpdates({
        event: "messages.update",
        data: [
          { key: { id: "a" }, update: { status: 3 } },
          { key: { id: "b" }, update: { status: 4 } },
          { key: { id: "c" }, update: { status: 2 } }, // server ack only → ignored
        ],
      })
    ).toEqual([
      { providerMessageId: "a", status: "delivered" },
      { providerMessageId: "b", status: "read" },
    ])
  })

  it("returns empty for non-update events", () => {
    expect(extractWasenderStatusUpdates({ event: "messages.received", data: {} })).toEqual([])
  })
})
