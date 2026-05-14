// Single source of truth for the 6 Ecolaundry laundromats.
//
// Why this file exists: location resolution used to live as a flat string
// array (`KNOWN_LOCATIONS`) in message-parsing.ts. That worked when the only
// thing the bot needed to know was the canonical name, but it couldn't model:
//   - aliases (customers say "Granollers" or "Plaça Hortes" instead of "Hortes")
//   - ambiguous puebloes ("Mataró" hosts both Goya AND Alemanya)
// Centralising the data here keeps the resolver and the guards aligned, and
// makes it cheap to add a 7th laundromat without hunting through the codebase.

export type LaundromatLocation = {
  /** Canonical key stored in `state.location`. NEVER change once shipped. */
  canonical: string
  /** Pueblo (town) where this laundromat sits. */
  pueblo: string
  /** Street/address shown to operators on escalation. */
  address: string
  /**
   * Other strings customers may type to refer to this laundromat. Match is
   * case-insensitive and accent-insensitive. Multi-word aliases are matched
   * as whole phrases ("Pineda de Mar"), single-word aliases as whole words
   * ("Granollers").
   */
  aliases: string[]
}

/**
 * The 6 laundromats. Order is irrelevant for resolution but kept stable for
 * UI listings (the unknown-location reply enumerates them in this order).
 *
 * Note about Mataró: the pueblo is intentionally NOT a canonical here.
 * "Mataró" is ambiguous (two laundromats), so we don't resolve it to a
 * single location — instead `isAmbiguousPueblo` flags it and the guard
 * asks the customer which street they're on.
 */
export const LAUNDROMATS: LaundromatLocation[] = [
  {
    canonical: 'Hortes',
    pueblo: 'Granollers',
    address: 'Plaça de les Hortes 4',
    aliases: ['Granollers', 'Plaça de les Hortes', 'Plaza de les Hortes', 'Plaça Hortes', 'Plaza Hortes'],
  },
  {
    canonical: 'Goya',
    pueblo: 'Mataró',
    address: 'C/ Francisco de Goya 117',
    aliases: ['Francisco de Goya', 'C/ Goya', 'Calle Goya', 'Goya 117'],
  },
  {
    canonical: 'Alemanya',
    pueblo: 'Mataró',
    address: 'C/ Alemanya 17',
    aliases: ['C/ Alemanya', 'Calle Alemanya', 'Alemanya 17'],
  },
  {
    canonical: 'Pineda',
    pueblo: 'Pineda de Mar',
    address: 'Crta. N-II 1, Centro Carrefour',
    aliases: ['Pineda de Mar', 'Carrefour Pineda'],
  },
  {
    canonical: "L'Escala",
    pueblo: "L'Escala",
    address: 'Av. Girona, Carrefour',
    aliases: ['Escala', 'Carrefour Escala'],
  },
  {
    canonical: "Platja d'Aro",
    pueblo: "Platja d'Aro",
    address: "Av. Castell d'Aro 37",
    aliases: ['Platja Aro', 'Castell d\'Aro', 'Castell de Aro', 'Platja', "Platja d Aro", "Playa d'Aro", 'Playa Aro', 'Playa', "Playa d aro", "Playa d'aro"],
  },
]

/**
 * Puebloes that map to MORE THAN ONE laundromat. When the customer says one
 * of these without a clarifying alias, the bot must ask which street they're
 * on rather than assuming.
 */
// Single accented form. Lookups via resolveKnownLocation strip accents so
// "Mataro" / "mataró" / "MATARÓ" all match. Adding the unaccented form
// here used to break the fuzzy resolver: two equidistant candidates →
// ambiguous → returned null (Andrea, 2026-05-10 regression F14: "Mtaró"
// typo dropped to unknown-location list because fuzzy couldn't pick one).
export const AMBIGUOUS_PUEBLOES: ReadonlySet<string> = new Set(['Mataró'])

/** Reply shown when the customer mentions an ambiguous pueblo. */
export function buildAmbiguousPuebloReply(pueblo: string): string {
  const inPueblo = LAUNDROMATS.filter(
    (l) => l.pueblo.toLowerCase() === pueblo.toLowerCase(),
  )
  if (inPueblo.length < 2) {
    // Defensive: shouldn't happen because AMBIGUOUS_PUEBLOES gates the call,
    // but if it does we degrade gracefully to the generic ask.
    return '¿En qué lavandería estás?'
  }
  const list = inPueblo.map((l) => l.address).join(' y ')
  return `En ${pueblo} tenemos dos lavanderías: ${list}. ¿En cuál estás?`
}

/** Human-readable list used in the "unknown location" fallback reply. */
export function listLaundromatsForReply(): string {
  // Use canonical names; the customer probably typed something we couldn't
  // recognise, so showing the names they might recognise from signage is the
  // most helpful thing.
  return LAUNDROMATS.map((l) => l.canonical).join(', ')
}
