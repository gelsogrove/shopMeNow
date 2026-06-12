/**
 * Webhook delivery-status extraction (✓✓ delivered / ✓✓ blue read)
 *
 * Normalises the provider-specific "message status / ack" webhook payloads into
 * a single shape the delivery-status updater understands. Pure + testable — no
 * I/O. Each provider reports delivery differently:
 *
 *   - Meta:     value.statuses[] = [{ id, status: sent|delivered|read|failed }]
 *   - UltraMsg: { event_type: "message_ack", data: { id, ack } } where ack is
 *               "pending"|"server"|"device"|"read"|"played" (or numeric 1..5)
 *   - Wasender: { event: "messages.update", data: { ...key.id, status } } where
 *               status is "delivered"|"read" (or Baileys numeric 3=DELIVERY_ACK,
 *               4=READ, 5=PLAYED)
 *
 * We surface TWO levels: "delivered" (✓✓ grey) and "read" (✓✓ blue). "sent"
 * stays a single ✓ and is not reported here. Each extractor returns the list of
 * { providerMessageId, status } entries found in the payload (empty when none /
 * not a status event), so the caller simply continues with the normal path.
 */

export type DeliveryLevel = "delivered" | "read"

export interface StatusUpdate {
  providerMessageId: string
  status: DeliveryLevel
}

/**
 * Map a provider ack/status (string or number) to our delivery level, or null
 * when it is below "delivered" (e.g. sent/server/pending).
 *
 * The numeric scale differs by provider, so the caller passes the minimum
 * numeric ack that counts as delivered:
 *   - UltraMsg (whatsapp-web.js): 2=device(delivered), 3=read, 4=played → minDelivered 2
 *   - Wasender (Baileys): 3=delivery_ack(delivered), 4=read, 5=played → minDelivered 3
 * "read"/"played" (and numeric minDelivered+2 and above) map to "read".
 */
function statusLevel(raw: unknown, minDelivered: number): DeliveryLevel | null {
  const readThreshold = minDelivered + 1 // read sits one step above delivered

  if (typeof raw === "number") {
    if (raw >= readThreshold) return "read"
    if (raw >= minDelivered) return "delivered"
    return null
  }
  if (typeof raw === "string") {
    const v = raw.trim().toLowerCase()
    const n = Number(v)
    if (v !== "" && !Number.isNaN(n)) {
      if (n >= readThreshold) return "read"
      if (n >= minDelivered) return "delivered"
      return null
    }
    if (v === "read" || v === "played") return "read"
    if (v === "device" || v === "delivered" || v === "delivery_ack") return "delivered"
    return null
  }
  return null
}

/** Meta Cloud API status webhook → { id, status } entries (delivered/read). */
export function extractMetaStatusUpdates(value: any): StatusUpdate[] {
  const statuses = value?.statuses
  if (!Array.isArray(statuses)) return []
  const out: StatusUpdate[] = []
  for (const s of statuses) {
    const id = s?.id
    if (!id || typeof id !== "string") continue
    if (s?.status === "read") out.push({ providerMessageId: id, status: "read" })
    else if (s?.status === "delivered") out.push({ providerMessageId: id, status: "delivered" })
  }
  return out
}

/** UltraMsg `message_ack` webhook → { id, status } entries (delivered/read). */
export function extractUltramsgStatusUpdates(payload: any): StatusUpdate[] {
  if (payload?.event_type !== "message_ack") return []
  const data = payload?.data
  const id = data?.id
  if (!id || typeof id !== "string") return []
  const level = statusLevel(data?.ack, 2) // UltraMsg: device=2 delivered, read=3
  return level ? [{ providerMessageId: id, status: level }] : []
}

/** Wasender `messages.update` webhook → { id, status } entries (delivered/read). */
export function extractWasenderStatusUpdates(payload: any): StatusUpdate[] {
  if (payload?.event !== "messages.update") return []
  const data = payload?.data
  const updates = Array.isArray(data) ? data : data ? [data] : []
  const out: StatusUpdate[] = []
  for (const u of updates) {
    const id = u?.key?.id || u?.id || u?.messageId
    if (!id || typeof id !== "string") continue
    const level = statusLevel(u?.update?.status ?? u?.status, 3) // Baileys: delivery_ack=3, read=4
    if (level) out.push({ providerMessageId: id, status: level })
  }
  return out
}
