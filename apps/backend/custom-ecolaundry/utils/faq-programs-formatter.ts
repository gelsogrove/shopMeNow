// Pure formatters for Caso 12.4 — Programas de lavadora y secadora por location (F81).
// Iron rule #7: data from json/locations.json:metadata.programs, never hardcoded.
// Missing data → null, caller falls back to a generic i18n message.
//
// Split from faq-location-formatter.ts (iron rule #3: file ≤ 150 lines,
// one responsibility = price formatters there, program formatters here).

import type { Runtime } from '../models/runtime.js'

// ── Program types ─────────────────────────────────────────────────────────────
// A translate function maps an i18n nameKey to the localised program name.
export type ProgramTranslateFn = (key: string) => string

type WasherProgram = {
  number: number | null
  nameKey: string
  temp: string | null
}

type DryerProgram = {
  nameKey: string
}

type ProgramsPayload = {
  washers?: WasherProgram[]
  dryers?: DryerProgram[]
}

// ── Location key resolver (local copy — identical to faq-location-formatter.ts) ─
// Resolves state.location (canonical key, displayName, or pueblo) → locations.json key.
// Duplication is intentional: keeps each formatter self-contained under rule #3.
function resolveLocationKey(runtime: Runtime, locationKey: string): string | null {
  const entries = runtime.locations?.locations
  if (!entries) return null
  if (entries[locationKey]) return locationKey
  const needle = locationKey.toLowerCase().replace(/[\s'']/g, '')
  for (const [key, loc] of Object.entries(entries)) {
    const candidates = [key, loc.displayName, loc.pueblo].filter(Boolean) as string[]
    if (candidates.some((c) => c.toLowerCase().replace(/[\s'']/g, '') === needle)) {
      return key
    }
  }
  return null
}

// ── Programs reader ───────────────────────────────────────────────────────────
function readPrograms(runtime: Runtime, locationKey: string): ProgramsPayload | null {
  const key = resolveLocationKey(runtime, locationKey)
  if (!key) return null
  const loc = runtime.locations?.locations[key]
  if (!loc?.metadata) return null
  const programs = (loc.metadata as { programs?: ProgramsPayload }).programs
  return programs ?? null
}

// ── Washer programs formatter (Caso 12.4 + PUSH PROG dynamic) ────────────────
// Returns a markdown bullet list of washer programs localised via translateFn.
// number: null locations (Hortes/Alemanya) → show name+temp only, no number prefix.
export function formatWasherPrograms(
  locationKey: string,
  runtime: Runtime,
  translateFn: ProgramTranslateFn
): string | null {
  const programs = readPrograms(runtime, locationKey)
  if (!programs?.washers || programs.washers.length === 0) return null
  const lines = programs.washers.map((p) => {
    const name = translateFn(p.nameKey)
    if (p.number !== null && p.number !== undefined) {
      const temp = p.temp ? ` (${p.temp})` : ''
      return `- **${p.number}** — ${name}${temp}`
    }
    const temp = p.temp ? ` (${p.temp})` : ''
    return `- **${name}**${temp}`
  })
  return lines.join('\n')
}

// ── Dryer programs formatter (Caso 12.4) ──────────────────────────────────────
// All locations share the same 3 dryer programs (Alta/Media/Baja temperatura).
// No numbers for dryers.
export function formatDryerPrograms(
  locationKey: string,
  runtime: Runtime,
  translateFn: ProgramTranslateFn
): string | null {
  const programs = readPrograms(runtime, locationKey)
  if (!programs?.dryers || programs.dryers.length === 0) return null
  const lines = programs.dryers.map((p) => {
    const name = translateFn(p.nameKey)
    return `- **${name}**`
  })
  return lines.join('\n')
}

// ── Helper: build full program list for PUSH PROG flow injection ──────────────
// Returns the localised washer program bullet list for case_push prompt injection.
// Returns null if no programs data → caller falls back to hardcoded list.
export function buildPushProgList(
  locationKey: string,
  runtime: Runtime,
  translateFn: ProgramTranslateFn
): string | null {
  return formatWasherPrograms(locationKey, runtime, translateFn)
}
