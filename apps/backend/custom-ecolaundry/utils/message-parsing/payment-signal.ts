// Explicit payment yes/no detector. Returns:
//   - true   if the customer states they paid (multilingual)
//   - false  if the customer states they did not pay
//   - null   if no payment signal is present (avoid false negatives from
//            generic troubleshooting phrases like "no arranca")
//
// Rule #6: this is a boundary signal — explicit yes/no in payment context
// only. Intent classification of vague phrases is delegated to the LLM.

export function parseExplicitPaymentSignal(message: string): boolean | null {
  const lower = message.toLowerCase()

  // Avoid false negatives from generic troubleshooting phrases such as
  // "no arranca" or "non funziona": only parse yes/no when payment context exists.
  const hasPaymentContext = /\b(pag\w*|payment|paid|pay|coins?|monedas?|card|tarjeta|carta|unidad central|central unit)\b/.test(lower)
  if (!hasPaymentContext) return null

  if (/\b(no he pagado|no pagué|no pague|no he pagat|not paid|non ho pagato|nao paguei|sin pagar)\b/.test(lower)) return false
  if (/\b(pagado|pagato|pagat|pagué|pague|paid|payé|paye|pago hecho|pago realizado|payment completed)\b/.test(lower)) return true
  if (/\b(sì|si|yes|oui|sí|sim|so|ya|already|ja|ye)\b/.test(lower)) return true
  if (/\b(no|non|not|nao|niet|nein)\b/.test(lower)) return false

  return null
}
