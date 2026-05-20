const HUMAN_SUPPORT_MARKER = '**👤 Human Support message**'

/**
 * Splits a custom-chatbot reply into the customer-facing part and the
 * internal operator briefing.  The operator block starts at the
 * HUMAN_SUPPORT_MARKER and must never be forwarded to the end-customer
 * (WhatsApp, widget, etc.).  The full content is stored in the DB so
 * the backoffice UI can render it as an internal (orange) balloon.
 */
export function splitCustomChatbotReply(reply: string): {
  customerReply: string
  operatorBlock: string | null
} {
  const idx = reply.indexOf(HUMAN_SUPPORT_MARKER)
  if (idx === -1) return { customerReply: reply, operatorBlock: null }
  return {
    customerReply: reply.slice(0, idx).trimEnd(),
    operatorBlock: reply.slice(idx),
  }
}
