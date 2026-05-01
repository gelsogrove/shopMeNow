// Message parsing and content extraction
const KNOWN_LOCATIONS = ['Goya', 'Pineda', "L'Escala", 'Alemanya', 'Hortes'] as const

export function hasExtraButtonIssue(message: string): boolean {
  return /button|EXTRA|button with fixed light|pulsante|botton|bouton|pulsador/.test(message.toLowerCase())
}

export function hasStopIntent(message: string): boolean {
  const lower = message.toLowerCase().trim()
  return /\b(stop|stop button|pressed stop|i pressed stop|bot[oó]n stop|he pulsado stop|pulsante stop|tasto stop|ho premuto stop|premuto stop|bot[oó] stop|he premut stop|pulsat stop|j'ai appuy[eé] sur stop|presse stop)\b/i.test(lower)
}

export function isBlankDisplayReply(message: string): boolean {
  const lower = message.toLowerCase().trim()
  return /^(blank|empty|nothing|blank screen|screen is blank|empty screen|no display|nada|pantalla en blanco|pantalla en blanc|pantalla buida|void|vide|ecran vide|buit|nulla|schermo vuoto|schermo in bianco|schermo bianco|display vuoto)$/i.test(lower)
}

export function normalizeLocationValue(value: string): string {
  return value.trim().split(/[,/]/).map((part) => part.trim()).filter(Boolean)[0] || ''
}

export function resolveKnownLocation(rawValue: string): string | null {
  // Check the whole input (lowercased) so that compound replies like
  // "Girona, calle Goya" or "estoy en Goya" still resolve to the known location.
  // Normalizing to the first comma-separated segment would drop the actual match.
  const normalized = rawValue.toLowerCase()

  for (const known of KNOWN_LOCATIONS) {
    const knownLower = known.toLowerCase()
    // Word-boundary match where possible so "Goya" doesn't match inside an unrelated word.
    const pattern = new RegExp(`\\b${knownLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (pattern.test(normalized)) {
      return known
    }
  }

  return null
}

export function parseExplicitPaymentSignal(message: string): boolean | null {
  const lower = message.toLowerCase()

  // Avoid false negatives from generic troubleshooting phrases such as
  // "no arranca" or "non funziona": only parse yes/no when payment context exists.
  const hasPaymentContext = /\b(pag|payment|paid|coins?|monedas?|card|tarjeta|carta|unidad central|central unit|pagamento)\b/.test(lower)
  if (!hasPaymentContext) return null

  if (/\b(no he pagado|no pagué|no pague|no he pagat|not paid|non ho pagato|nao paguei|sin pagar)\b/.test(lower)) return false
  if (/\b(pagado|pagato|pagat|pagué|pague|paid|payé|paye|pago hecho|pago realizado|payment completed)\b/.test(lower)) return true
  if (/\b(sì|si|yes|oui|sí|sim|so|ya|already|ja|ye)\b/.test(lower)) return true
  if (/\b(no|non|not|nao|niet|nein)\b/.test(lower)) return false

  return null
}

export function sanitizeCustomerReply(message: string): string {
  return message
    .replace(/^<[^>]+>/g, '')
    .replace(/<[^>]+>$/g, '')
    .trim()
}
