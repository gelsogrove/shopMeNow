import { Check, CheckCheck, Clock, X } from "lucide-react"

/**
 * MessageTicks — WhatsApp-style delivery ticks for OUTBOUND messages.
 *
 * Maps a message's deliveryStatus to a tick glyph:
 *   - pending    → ⏱ clock (queued / not yet sent)
 *   - sent       → ✓  single tick (provider accepted)
 *   - delivered  → ✓✓ grey double tick (arrived on the customer's device)
 *   - read       → ✓✓ blue double tick (customer opened the message)
 *   - error      → ✕  red (send failed)
 *   - blocked    → render nothing (a dedicated red badge already covers it)
 *
 * Render this only for outbound (operator/bot) bubbles.
 */
export type DeliveryStatus =
  | "not_queued"
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "error"
  | "blocked"

export function MessageTicks({
  status,
  className = "",
}: {
  status?: DeliveryStatus | null
  className?: string
}) {
  if (!status || status === "blocked" || status === "not_queued") return null

  const base = `inline-flex items-center ${className}`

  switch (status) {
    case "pending":
      return (
        <span className={`${base} text-gray-400`} title="Queued" aria-label="Queued">
          <Clock className="w-3.5 h-3.5" />
        </span>
      )
    case "sent":
      return (
        <span className={`${base} text-gray-400`} title="Sent" aria-label="Sent">
          <Check className="w-3.5 h-3.5" />
        </span>
      )
    case "delivered":
      return (
        <span className={`${base} text-gray-500`} title="Delivered" aria-label="Delivered">
          <CheckCheck className="w-3.5 h-3.5" />
        </span>
      )
    case "read":
      return (
        <span className={`${base} text-blue-500`} title="Read" aria-label="Read">
          <CheckCheck className="w-3.5 h-3.5" />
        </span>
      )
    case "error":
      return (
        <span className={`${base} text-red-500`} title="Failed to send" aria-label="Failed to send">
          <X className="w-3.5 h-3.5" />
        </span>
      )
    default:
      return null
  }
}
