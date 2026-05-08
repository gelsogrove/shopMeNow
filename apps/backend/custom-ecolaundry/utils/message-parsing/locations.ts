// Location resolution from free-text customer replies.
//
// Two-stage resolver:
//   1. resolveKnownLocation — exact match against canonical names + aliases
//      (loaded from json/locations.json via utils/locations.ts).
//   2. resolveKnownLocationFuzzy — Damerau-Levenshtein fallback for typos
//      ("Pinneda" → "Pineda"). Conservative threshold + ambiguity guard so
//      we never pick a wrong laundromat when two are equally close.

import { LAUNDROMATS, AMBIGUOUS_PUEBLOES } from '../locations.js'

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Resolution targets: every canonical laundromat name PLUS the ambiguous
// pueblo "Mataró" (kept resolvable so that the Mataró-street guard still
// triggers when the customer names the pueblo without a specific street).
const KNOWN_LOCATIONS: readonly string[] = [
  ...LAUNDROMATS.map((l) => l.canonical),
  ...AMBIGUOUS_PUEBLOES,
]

// Alias → canonical map for direct lookup. Built once at module load. Both
// keys (alias) and lookup input are lowercased + accent-stripped.
const ALIAS_TO_CANONICAL: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>()
  for (const loc of LAUNDROMATS) {
    for (const alias of loc.aliases) {
      m.set(stripAccents(alias.toLowerCase()), loc.canonical)
    }
  }
  return m
})()

export function normalizeLocationValue(value: string): string {
  return value.trim().split(/[,/]/).map((part) => part.trim()).filter(Boolean)[0] || ''
}

export function resolveKnownLocation(rawValue: string): string | null {
  // Check the whole input (lowercased + accent-stripped) so "Mataro" / "mataró"
  // / "MATARÓ" all resolve. Compound replies like "Girona, calle Goya" or
  // "estoy en Goya" also work because we don't truncate to first segment.
  const normalized = stripAccents(rawValue.toLowerCase())

  // Pass 1: canonical names (+ ambiguous pueblo). These take priority because
  // a customer who explicitly types "Goya" should resolve to Goya regardless
  // of any alias overlap.
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

  // Pass 2: aliases. Same boundary rules so "Granollers" matches in
  // "estoy en Granollers" but not inside an unrelated word. We sort by
  // descending length first so multi-word aliases ("Pineda de Mar") win
  // over the substring match of a shorter overlapping canonical.
  const aliases = Array.from(ALIAS_TO_CANONICAL.keys()).sort(
    (a, b) => b.length - a.length,
  )
  for (const alias of aliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`(?:^|[^a-z0-9'])${escaped}(?:$|[^a-z0-9'])`, 'i')
    if (pattern.test(` ${normalized} `)) {
      return ALIAS_TO_CANONICAL.get(alias) ?? null
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
