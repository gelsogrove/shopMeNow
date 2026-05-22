// F79 — Landmark-based location resolution
//
// Customers often identify their laundromat by a nearby reference point
// ("estoy cerca del Mercadona", "vicino al Carrefour", "junto al Aldi")
// rather than by the canonical key. The landmark list lives in
// json/locations.json:metadata.landmarks (single source of truth) so adding
// or revising a landmark is a data-only change. The resolver is a pure L3
// helper: input message + runtime locations → resolution outcome.
//
// Expandability:
//   - Add a landmark to an existing location → edit landmarks[] in JSON.
//   - Add a new location (e.g. 7th laundromat) → add its entry to JSON
//     with its own landmarks[]. The resolver picks it up automatically.
//   - Cross-language: landmarks are proper nouns (Mercadona, Carrefour, …)
//     so case/accent-insensitive matching works the same across all 6
//     supported languages without per-language keyword lists.

import type { LocationsConfig } from '../models/runtime.js'

/**
 * Outcome of landmark-based resolution.
 * - `canonical`: location key (e.g. "Goya") when exactly one location matches.
 * - `candidates`: all canonical keys whose landmarks were mentioned. Empty
 *   array when nothing matched. Multiple entries means ambiguous — the
 *   caller should ask the customer which pueblo they're in.
 * - `hits`: the landmark strings actually found in the message (for
 *   observability and enumeration replies).
 */
export type LandmarkResolution = {
  canonical: string | null
  candidates: string[]
  hits: string[]
}

/** Strip diacritics + lowercase. Robust against "Mercadòna" / "MERCADONA" / "mercadona". */
function normaliseForLandmarkMatch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * Extract `landmarks: string[]` from a LocationOverride.metadata in a
 * type-safe way. metadata is `Record<string, unknown>` so we narrow here.
 */
function readLandmarks(metadata: Record<string, unknown> | undefined): string[] {
  if (!metadata) return []
  const v = metadata['landmarks']
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

/**
 * Returns the deduplicated, ordered list of every landmark across all
 * locations. Used to build the "enumerate landmarks" fallback reply when
 * the customer doesn't know where they are. Sorting is alphabetical so the
 * output is stable across runs.
 */
export function listAllLandmarks(locations: LocationsConfig): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const override of Object.values(locations.locations)) {
    for (const landmark of readLandmarks(override.metadata)) {
      const key = normaliseForLandmarkMatch(landmark)
      if (!seen.has(key)) {
        seen.add(key)
        result.push(landmark)
      }
    }
  }
  return result.sort((a, b) => a.localeCompare(b))
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Scan `message` for any landmark mentioned across all locations.
 * Returns the canonical landmark strings (as stored in JSON) that the
 * message contains. Multi-word landmarks ("Plaça de les Hortes") are
 * matched as a substring (after normalisation), single-word landmarks
 * ("Mercadona") as a whole word so "policía" doesn't accidentally fire
 * on "police".
 *
 * Pure helper — no state, no I/O.
 */
export function findLandmarksInMessage(
  message: string,
  locations: LocationsConfig,
): string[] {
  const normalisedMsg = normaliseForLandmarkMatch(message)
  if (!normalisedMsg) return []

  const allLandmarks = listAllLandmarks(locations)
  const found: string[] = []
  for (const landmark of allLandmarks) {
    const normalisedLandmark = normaliseForLandmarkMatch(landmark)
    if (!normalisedLandmark) continue
    const isMultiWord = normalisedLandmark.includes(' ')
    if (isMultiWord) {
      if (normalisedMsg.includes(normalisedLandmark)) found.push(landmark)
    } else {
      const re = new RegExp(`\\b${escapeRegex(normalisedLandmark)}\\b`)
      if (re.test(normalisedMsg)) found.push(landmark)
    }
  }
  return found
}

/**
 * Resolve a customer message to a canonical location via landmark mentions.
 *
 * Behaviour:
 * - 0 landmarks found → { canonical: null, candidates: [], hits: [] }
 * - 1 location uniquely identified by the found landmark(s) → canonical set
 * - 2+ locations share the mentioned landmark(s) → canonical: null,
 *   candidates filled (caller asks which pueblo)
 *
 * Example: "estoy cerca del Mercadona" → { canonical: 'Goya', ... }
 *          "estoy cerca del Carrefour" → { canonical: null,
 *                                          candidates: ['Pineda', "L'Escala", "Platja d'Aro"] }
 */
export function resolveLocationByLandmarks(
  message: string,
  locations: LocationsConfig,
): LandmarkResolution {
  const hits = findLandmarksInMessage(message, locations)
  if (hits.length === 0) {
    return { canonical: null, candidates: [], hits: [] }
  }

  const hitSet = new Set(hits.map(normaliseForLandmarkMatch))

  const candidates: string[] = []
  for (const [canonical, override] of Object.entries(locations.locations)) {
    const locLandmarks = readLandmarks(override.metadata).map(normaliseForLandmarkMatch)
    if (locLandmarks.some((l) => hitSet.has(l))) {
      candidates.push(canonical)
    }
  }

  if (candidates.length === 1) {
    return { canonical: candidates[0], candidates, hits }
  }
  return { canonical: null, candidates, hits }
}
