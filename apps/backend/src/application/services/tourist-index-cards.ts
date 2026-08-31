/**
 * Tourist INDEX cards — one synthetic FAQ entry per catalogue category.
 *
 * WHAT: for each non-empty tourist table (events, restaurants, hotels,
 * excursions, refuges, sports facilities, ski facilities) this builds ONE
 * entry whose question is the bare category label and whose answer lists
 * every row with all of its short fields — every DB field except the long
 * `description` prose, which stays in the per-row detail card.
 *
 * WHY: custom-demosappada's retrieval (faq-media.ts selectRelevantFaqs) ranks
 * entries by IDF-weighted word overlap with the guest's message. On a generic
 * question — "che eventi ci sono?", "dammi ristoranti celicaci" (typo, live
 * 2026-09-01) — no DETAIL card can ever win a slot: the category word appears
 * in every card so its weight tends to zero, and the proper names that carry
 * the weight are not in the guest's message. The bot then answered "non ho i
 * dettagli" while the DB held the whole calendar (Andrea, 2026-09-01: "è
 * importante che leggi tutti i campi").
 *
 * The question is DELIBERATELY the bare category label, nothing more:
 * - all of its words are shared with the detail cards, so their weights are
 *   uniformly low and matching ANY of them scores near 1.0 — the index wins
 *   generic questions regardless of typos elsewhere in the message;
 * - adding synonyms or "elenco"-style words would hand the question a unique
 *   heavy term that DILUTES real matches (the 2026-08-31 Carnevale lesson,
 *   see getTouristContentAsFaqs' searchableQuestion note).
 * Specific questions ("quando è il carnevale?") keep landing on the detail
 * card through its proper-name terms — the index never competes there.
 *
 * `description` is the ONE field left out of the index lines: all 85+ full
 * cards on every turn is exactly what broke the provider ceiling and led to
 * FAQ_BUDGET (Andrea, 2026-08-25: "non va in locale"). Apartments are also
 * deliberately absent: generic lodging questions belong to the accommodation
 * tool (see the apartment-cards note in custom-client-chatbot.service.ts).
 *
 * Content stays Italian (DB base language, CLAUDE.md §1) and comes entirely
 * from the rows — no copy of its own beyond the category labels, which are
 * the same labels the detail cards already carry.
 */

type FaqEntry = { question: string; answer: string; keywords?: string[] }

const fact = (label: string, value: unknown): string | null => {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "boolean") return value ? label : null
  return `${label}: ${value}`
}
const joinFacts = (parts: Array<string | null>): string =>
  parts.filter(Boolean).join(". ")

const formatDate = (d: Date | null | undefined): string | null =>
  d
    ? d.toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null

/** One card listing every row, or none when the category is empty. */
function indexCard(
  label: string,
  lines: string[]
): FaqEntry[] {
  if (lines.length === 0) return []
  return [
    {
      question: label,
      answer: lines.map((l) => `• ${l}`).join("\n"),
    },
  ]
}

export interface TouristIndexInput {
  restaurants: Array<{
    name: string
    cuisineType?: string | null
    celiacFriendly?: boolean | null
    needsReservation?: boolean | null
    location?: string | null
    phone?: string | null
    link?: string | null
  }>
  hotels: Array<{
    name: string
    stars?: number | null
    location?: string | null
    phone?: string | null
    link?: string | null
  }>
  excursions: Array<{
    name: string
    difficulty?: string | null
    duration?: string | null
    season?: string | null
    location?: string | null
    link?: string | null
  }>
  refuges: Array<{
    name: string
    climbTime?: string | null
    difficulty?: string | null
    openFrom?: string | null
    openTo?: string | null
    location?: string | null
    phone?: string | null
    email?: string | null
    link?: string | null
  }>
  events: Array<{
    title: string
    location?: string | null
    startDate?: Date | null
    endDate?: Date | null
    price?: string | null
    ticketInfo?: string | null
    link?: string | null
    ticketLink?: string | null
  }>
  sportsFacilities: Array<{
    name: string
    sport?: string | null
    season?: string | null
    location?: string | null
    link?: string | null
  }>
  skiFacilities: Array<{
    name: string
    slopeType?: string | null
    location?: string | null
    link?: string | null
  }>
}

export function buildTouristIndexCards(content: TouristIndexInput): FaqEntry[] {
  return [
    ...indexCard(
      "Eventi",
      content.events.map((e) =>
        joinFacts([
          e.title,
          fact("Località", e.location),
          fact("Dal", formatDate(e.startDate)),
          fact("Al", formatDate(e.endDate)),
          fact("Prezzo", e.price),
          fact("Biglietti", e.ticketInfo),
          e.link ?? null,
          e.ticketLink ?? null,
        ])
      )
    ),
    ...indexCard(
      "Ristoranti",
      content.restaurants.map((r) =>
        joinFacts([
          r.name,
          fact("Cucina", r.cuisineType),
          fact("Adatto a celiaci, senza glutine", r.celiacFriendly),
          fact("Prenotazione consigliata", r.needsReservation),
          fact("Località", r.location),
          fact("Tel", r.phone),
          r.link ?? null,
        ])
      )
    ),
    ...indexCard(
      "Alberghi",
      content.hotels.map((h) =>
        joinFacts([
          h.name,
          fact("Categoria", h.stars ? `${h.stars} stelle` : null),
          fact("Località", h.location),
          fact("Tel", h.phone),
          h.link ?? null,
        ])
      )
    ),
    ...indexCard(
      "Escursioni",
      content.excursions.map((e) =>
        joinFacts([
          e.name,
          fact("Difficoltà", e.difficulty),
          fact("Durata", e.duration),
          fact("Stagione", e.season),
          fact("Località", e.location),
          e.link ?? null,
        ])
      )
    ),
    ...indexCard(
      "Rifugi",
      content.refuges.map((r) =>
        joinFacts([
          r.name,
          fact("Tempo di salita", r.climbTime),
          fact("Difficoltà", r.difficulty),
          fact("Aperto da", r.openFrom),
          fact("Aperto a", r.openTo),
          fact("Località", r.location),
          fact("Tel", r.phone),
          fact("Email", r.email),
          r.link ?? null,
        ])
      )
    ),
    ...indexCard(
      "Strutture sportive",
      content.sportsFacilities.map((s) =>
        joinFacts([
          s.name,
          fact("Sport", s.sport),
          fact("Stagione", s.season),
          fact("Località", s.location),
          s.link ?? null,
        ])
      )
    ),
    ...indexCard(
      "Impianti di sci",
      content.skiFacilities.map((s) =>
        joinFacts([
          s.name,
          fact("Tipo di pista", s.slopeType),
          fact("Località", s.location),
          s.link ?? null,
        ])
      )
    ),
  ]
}
