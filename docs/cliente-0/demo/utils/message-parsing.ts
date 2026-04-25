// Message parsing and content extraction
const KNOWN_LOCATIONS = ['Goya', 'Pineda', "L'Escala", 'Alemanya', 'Hortes'] as const

export function hasExtraButtonIssue(message: string): boolean {
  return /button|EXTRA|button with fixed light|pulsante|botton|bouton|pulsador/.test(message.toLowerCase())
}

export function hasStopIntent(message: string): boolean {
  return /STOP|stop button|pressed STOP|pulsé STOP|presse STOP|pulsat STOP/.test(message)
}

export function isBlankDisplayReply(message: string): boolean {
  const lower = message.toLowerCase().trim()
  return /^(blank|empty|nada|nothing|void|vide|buit|nulla|pantalla en blanco|écran vide|pantalla buida|schermo vuoto)$/i.test(lower)
}

export function normalizeLocationValue(value: string): string {
  return value.trim().split(/[,/]/).map((part) => part.trim()).filter(Boolean)[0] || ''
}

export function resolveKnownLocation(rawValue: string): string | null {
  const normalized = normalizeLocationValue(rawValue).toLowerCase()

  for (const known of KNOWN_LOCATIONS) {
    if (normalized.includes(known.toLowerCase())) {
      return known
    }
  }

  return null
}

export function parseExplicitPaymentSignal(message: string): boolean | null {
  const lower = message.toLowerCase()

  if (/\b(sì|si|yes|oui|sí|sim|so|ya|already|ja|ye)\b/.test(lower)) return true
  if (/\b(no|non|not|no|nao|niet|nein)\b/.test(lower)) return false

  return null
}

export function sanitizeCustomerReply(message: string): string {
  return message
    .replace(/^<[^>]+>/g, '')
    .replace(/<[^>]+>$/g, '')
    .trim()
}
