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
 *
 * MULTI-LANGUAGE (Andrea, 2026-09-01: "è dinamico, dentro la app si gestisce
 * tutto... il settings sono per i contenuti dinamici"): retrieval runs BEFORE
 * any LLM call, so a guest writing "what events are there?" never matches the
 * Italian label — and the LLM cannot help there. Translated labels are
 * CONTENT, so they live in configuration, never in code (CLAUDE.md §1A):
 * `touristIndexLabels` in the workspace's advanced settings
 * ({ lang: { categoryKey: label } }), managed from the app. For every enabled
 * language that carries a label, one EXTRA card is built with the translated
 * question and the same answer. Missing language or missing label → no extra
 * card, the default-language card (always built from the rows) is the
 * fallback. Separate cards per language, never one multilingual question:
 * unique foreign terms in a single question would dilute the default
 * language's IDF match to ~0 (the 2026-08-31 Carnevale lesson).
 */

type FaqEntry = { question: string; answer: string; keywords?: string[] }

/**
 * Per-language question labels from workspace configuration:
 * `{ "en": { "events": "Events", ... }, "de": { ... } }`.
 * Category keys match TouristIndexInput's property names.
 */
export interface TouristIndexI18n {
  enabledLanguages?: string[] | null
  defaultLanguage?: string | null
  labels?: unknown
}

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

/**
 * One card per label listing every row, or none when the category is empty.
 *
 * The base label (data language) always comes first; every configured
 * translation adds a card with the SAME answer. Labels are deduped
 * case-insensitively: es/pt sharing "Eventos", or a translation identical to
 * the base label, must not produce twin cards that would halve each other's
 * IDF weight.
 */
function indexCards(
  key: keyof TouristIndexInput,
  baseLabel: string,
  lines: string[],
  i18n?: TouristIndexI18n
): FaqEntry[] {
  if (lines.length === 0) return []
  const answer = lines.map((l) => `• ${l}`).join("\n")

  const labels = [baseLabel]
  const configured = i18n?.labels
  if (configured && typeof configured === "object") {
    const byLang = configured as Record<string, unknown>
    // Languages come from the workspace's enabledLanguages; when the list is
    // empty, every language the configuration carries labels for is offered.
    const languages =
      i18n?.enabledLanguages && i18n.enabledLanguages.length > 0
        ? i18n.enabledLanguages
        : Object.keys(byLang)
    for (const lang of languages) {
      if (lang === i18n?.defaultLanguage) continue // base card covers it
      const categoryLabels = byLang[lang]
      if (!categoryLabels || typeof categoryLabels !== "object") continue
      const label = (categoryLabels as Record<string, unknown>)[key]
      if (typeof label !== "string" || !label.trim()) continue
      if (labels.some((l) => l.toLowerCase() === label.trim().toLowerCase())) continue
      labels.push(label.trim())
    }
  }

  return labels.map((question) => ({ question, answer }))
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

export function buildTouristIndexCards(
  content: TouristIndexInput,
  i18n?: TouristIndexI18n
): FaqEntry[] {
  return [
    ...indexCards(
      "events",
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
      ),
      i18n
    ),
    ...indexCards(
      "restaurants",
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
      ),
      i18n
    ),
    ...indexCards(
      "hotels",
      "Alberghi",
      content.hotels.map((h) =>
        joinFacts([
          h.name,
          fact("Categoria", h.stars ? `${h.stars} stelle` : null),
          fact("Località", h.location),
          fact("Tel", h.phone),
          h.link ?? null,
        ])
      ),
      i18n
    ),
    ...indexCards(
      "excursions",
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
      ),
      i18n
    ),
    ...indexCards(
      "refuges",
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
      ),
      i18n
    ),
    ...indexCards(
      "sportsFacilities",
      "Strutture sportive",
      content.sportsFacilities.map((s) =>
        joinFacts([
          s.name,
          fact("Sport", s.sport),
          fact("Stagione", s.season),
          fact("Località", s.location),
          s.link ?? null,
        ])
      ),
      i18n
    ),
    ...indexCards(
      "skiFacilities",
      "Impianti di sci",
      content.skiFacilities.map((s) =>
        joinFacts([
          s.name,
          fact("Tipo di pista", s.slopeType),
          fact("Località", s.location),
          s.link ?? null,
        ])
      ),
      i18n
    ),
  ]
}
