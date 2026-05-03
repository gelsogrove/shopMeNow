// Message parsing and content extraction
const KNOWN_LOCATIONS = ['Goya', 'Pineda', "L'Escala", 'Alemanya', 'Hortes', 'Mataró'] as const

export function hasExtraButtonIssue(message: string): boolean {
  // RULE: Only trigger when "extra" is explicitly mentioned.
  // Generic button words alone (pulsante, pulsador, button, botton, bouton) are not enough:
  // they appear in LLM-extracted issueSummary whenever the user presses ANY button (e.g. "l'ho schiacchiato"
  // → issueSummary = "user pressed the button/pulsante"). That caused false-positive routing to case_extra_button.
  // The EXTRA button is a specific machine option — only trigger when "extra" itself is present.
  return /\bextra\b/i.test(message)
}

export function hasStopIntent(message: string): boolean {
  const lower = message.toLowerCase().trim()
  return /\b(stop|stop button|pressed stop|i pressed stop|bot[oó]n stop|he pulsado stop|pulsante stop|tasto stop|ho premuto stop|premuto stop|bot[oó] stop|he premut stop|pulsat stop|j'ai appuy[eé] sur stop|presse stop)\b/i.test(lower)
}

export function isBlankDisplayReply(message: string): boolean {
  const lower = message.toLowerCase().trim()
  // Whole-message match (customer answered just "blanco", "vuoto", etc.)
  if (/^(blank|empty|nothing|blank screen|screen is blank|empty screen|no display|nada|pantalla en blanco|pantalla blanca|pantalla en blanc|pantalla buida|void|vide|ecran vide|buit|nulla|schermo vuoto|schermo in bianco|schermo bianco|display vuoto)$/i.test(lower)) return true
  // Inline mention inside a longer sentence — covers "ahora la pantalla es blanca"
  // / "lo schermo è bianco" / "the screen is blank".
  if (/\b(pantalla\s+(?:es\s+)?blanc[ao]|pantalla\s+en\s+blanco|schermo\s+bianco|schermo\s+vuoto|screen\s+(?:is\s+)?(?:blank|empty)|no\s+(?:hay\s+)?nada\s+en\s+(?:la\s+)?pantalla)\b/i.test(lower)) return true
  return false
}

export function normalizeLocationValue(value: string): string {
  return value.trim().split(/[,/]/).map((part) => part.trim()).filter(Boolean)[0] || ''
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function resolveKnownLocation(rawValue: string): string | null {
  // Check the whole input (lowercased + accent-stripped) so "Mataro" / "mataró"
  // / "MATARÓ" all resolve. Compound replies like "Girona, calle Goya" or
  // "estoy en Goya" also work because we don't truncate to first segment.
  const normalized = stripAccents(rawValue.toLowerCase())

  for (const known of KNOWN_LOCATIONS) {
    const knownNormalized = stripAccents(known.toLowerCase())
    const escaped = knownNormalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Accent-stripped boundaries — pure ASCII alphanumerics + apostrophe
    // (for "L'Escala") count as "word", everything else is a boundary.
    const pattern = new RegExp(`(?:^|[^a-z0-9'])${escaped}(?:$|[^a-z0-9'])`, 'i')
    if (pattern.test(` ${normalized} `)) {
      return known
    }
  }

  return null
}

// Damerau-Levenshtein distance (counts adjacent transpositions as 1 edit).
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1)
      }
    }
  }
  return dp[m][n]
}

// Fuzzy resolver: try exact match first, then accept the closest known location
// within a small edit distance. Keeps results conservative (only one candidate
// within threshold) to avoid wrong matches between similar names.
export function resolveKnownLocationFuzzy(rawValue: string): string | null {
  const exact = resolveKnownLocation(rawValue)
  if (exact) return exact

  const normalized = stripAccents(rawValue.toLowerCase()).trim()
  if (!normalized) return null

  const tokens = normalized.split(/[^a-z0-9']+/).filter((tok) => tok.length >= 3)
  if (tokens.length === 0) return null

  let best: { name: string; distance: number } | null = null
  let secondBest: number = Infinity

  for (const known of KNOWN_LOCATIONS) {
    const knownNormalized = stripAccents(known.toLowerCase())
    let minDistance = Infinity
    for (const tok of tokens) {
      const len = Math.max(tok.length, knownNormalized.length)
      // Threshold scales with length: 4-5 chars → 1 edit, 6+ chars → 2 edits.
      const threshold = len <= 5 ? 1 : 2
      const dist = editDistance(tok, knownNormalized)
      if (dist <= threshold && dist < minDistance) minDistance = dist
    }
    if (minDistance < Infinity) {
      if (!best || minDistance < best.distance) {
        secondBest = best ? best.distance : secondBest
        best = { name: known, distance: minDistance }
      } else if (minDistance < secondBest) {
        secondBest = minDistance
      }
    }
  }

  // Require the best candidate to be strictly better than any other to avoid
  // ambiguous matches (e.g. two locations equally close to the typo).
  if (best && best.distance < secondBest) return best.name
  return null
}

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

export function sanitizeCustomerReply(message: string): string {
  return message
    .replace(/^<[^>]+>/g, '')
    .replace(/<[^>]+>$/g, '')
    .trim()
}
