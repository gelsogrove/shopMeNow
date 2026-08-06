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

/**
 * Guarantees the escalation turn carries a customer-facing sentence.
 *
 * Andrea 2026-08-06, seen live in the widget: on the escalation turn the
 * model wrote ONLY the operator briefing — the dictated hand-off sentence
 * never made it into the text. splitCustomChatbotReply then left
 * customerReply empty, so the customer answered the last gate question and
 * got nothing back before the chat switched to operator mode.
 *
 * When the customer-facing half is empty but an operator block exists, the
 * configured hand-off message (workspace.humanSupportMessage, already
 * {{customerName}}-substituted by the caller) is prepended. With nothing
 * configured the reply is returned unchanged — silence over hardcoded
 * English (CLAUDE.md §1A). Called once at the source
 * (CustomClientChatbotService.invoke) so every channel inherits it.
 */
export function ensureCustomerFacingReply(
  reply: string,
  handoffMessage?: string | null
): string {
  const { customerReply, operatorBlock } = splitCustomChatbotReply(reply)
  if (customerReply.trim() || !operatorBlock) return reply
  const handoff = handoffMessage?.trim()
  return handoff ? `${handoff}\n\n${operatorBlock}` : reply
}
