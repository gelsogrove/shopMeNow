/**
 * demosappada — tourist INDEX cards (tourist-index-cards.ts)
 *
 * WHAT: for every non-empty tourist category the host service now generates
 * ONE synthetic FAQ entry — question = the bare category label ("Eventi",
 * "Ristoranti", …), answer = every DB row with ALL of its short fields (only
 * the long `description` prose stays in the detail card). These specs lock
 * both the card's content and, end-to-end against the module's REAL
 * selectRelevantFaqs, that the card actually wins a FAQ_BUDGET slot on the
 * generic questions the detail cards mathematically cannot win.
 *
 * WHY: live failures, 2026-09-01. (1) "che eventi ci sono a carnevale?" — the
 * bot pointed the guest to the InfoPoint while touristEvent held the whole
 * calendar: the word "eventi" appears in EVERY detail question, so its IDF
 * weight tends to zero and no event card entered the 24-entry budget.
 * (2) "dammi ristoranti celicaci" (typo) — matching is whole-word, so the
 * misspelled "celicaci" hit nothing and "ristoranti" alone weighed ~0 on
 * every detail card. The index card fixes both by construction: its question
 * is ONLY the shared category word, so subjectScore normalizes to ~1.0 the
 * moment the guest's message contains it, typos elsewhere notwithstanding.
 * Andrea: "è importante che leggi tutti i campi" — hence the all-fields
 * assertions.
 */
import { selectRelevantFaqs } from "../../custom-demosappada/faq-media"
import { buildTouristIndexCards } from "../../src/application/services/tourist-index-cards"

// Empty catalogue helper — each test overrides only the categories it uses.
const emptyContent = () => ({
  restaurants: [],
  hotels: [],
  excursions: [],
  refuges: [],
  events: [],
  sportsFacilities: [],
  skiFacilities: [],
})

describe("buildTouristIndexCards — card content", () => {
  it("builds no card for an empty category (an empty list is not a fact)", () => {
    expect(buildTouristIndexCards(emptyContent())).toEqual([])
  })

  it("question is the BARE category label — no synonyms, no 'elenco'", () => {
    // The bare label is load-bearing: every extra unique word would carry
    // IDF weight 1 and dilute the match (the 2026-08-31 Carnevale lesson).
    const cards = buildTouristIndexCards({
      ...emptyContent(),
      events: [{ title: "Carnevale di Sappada (Plodar Vosenòcht)" }],
      restaurants: [{ name: "Baita Mondschein" }],
    })
    expect(cards.map((c) => c.question)).toEqual(["Eventi", "Ristoranti"])
  })

  it("an event line carries ALL its short fields, formatted like the detail card", () => {
    const cards = buildTouristIndexCards({
      ...emptyContent(),
      events: [
        {
          title: "Festa dei Krapfen",
          location: "Borgata Cottern",
          startDate: new Date("2026-09-20T00:00:00Z"),
          endDate: new Date("2026-09-21T00:00:00Z"),
          price: "Gratuito",
          ticketInfo: "Ingresso libero",
          link: "https://www.plodn.info/krapfen",
          ticketLink: "https://tickets.example.com/krapfen",
        },
      ],
    })
    const answer = cards[0].answer
    expect(answer).toContain("Festa dei Krapfen")
    expect(answer).toContain("Località: Borgata Cottern")
    expect(answer).toContain("Dal: 20/09/2026")
    expect(answer).toContain("Al: 21/09/2026")
    expect(answer).toContain("Prezzo: Gratuito")
    expect(answer).toContain("Biglietti: Ingresso libero")
    expect(answer).toContain("https://www.plodn.info/krapfen")
    expect(answer).toContain("https://tickets.example.com/krapfen")
  })

  it("empty fields are omitted, never rendered as 'null'/'undefined' (the Carnevale has no fixed dates)", () => {
    const cards = buildTouristIndexCards({
      ...emptyContent(),
      events: [{ title: "Carnevale di Sappada", startDate: null, endDate: null }],
    })
    expect(cards[0].answer).toContain("Carnevale di Sappada")
    expect(cards[0].answer).not.toMatch(/null|undefined|Dal:|Al:/)
  })

  it("a restaurant line carries the celiac flag as searchable words", () => {
    // The flag is the fact the 2026-09-01 guest needed; booleans render as
    // their label so the model can quote it, and only when true.
    const cards = buildTouristIndexCards({
      ...emptyContent(),
      restaurants: [
        {
          name: "Baita Mondschein",
          cuisineType: "tipica sappadina",
          celiacFriendly: true,
          needsReservation: true,
          location: "Borgata Mühlbach",
          phone: "0435 000000",
          link: "https://example.com/mondschein",
        },
        { name: "Pizzeria Ai Larici", celiacFriendly: false },
      ],
    })
    const answer = cards[0].answer
    expect(answer).toContain("Baita Mondschein")
    expect(answer).toContain("Adatto a celiaci, senza glutine")
    expect(answer).toContain("Cucina: tipica sappadina")
    expect(answer).toContain("Prenotazione consigliata")
    expect(answer).toContain("Località: Borgata Mühlbach")
    expect(answer).toContain("Tel: 0435 000000")
    expect(answer).toContain("https://example.com/mondschein")
    // The false flag must NOT mark Ai Larici as celiac-friendly.
    const lariciLine = answer.split("\n").find((l) => l.includes("Ai Larici"))!
    expect(lariciLine).not.toContain("celiaci")
  })
})

describe("index cards win the FAQ budget on generic questions (real selectRelevantFaqs)", () => {
  // A tenant-shaped catalogue LARGER than FAQ_BUDGET (24), so selection
  // actually ranks instead of passing everything through. Detail questions
  // use the exact prefixes the service builds ("Eventi: X", "Ristoranti: Y"),
  // which is what floors the category word's IDF weight.
  const detailCards = [
    ...Array.from({ length: 12 }, (_, i) => ({
      question: `Ristoranti: Locanda Numero ${i} — adatto a celiaci, senza glutine`,
      answer: `Dettagli del ristorante ${i}`,
    })),
    ...Array.from({ length: 10 }, (_, i) => ({
      question: `Eventi: Sagra Numero ${i}`,
      answer: `Dettagli della sagra ${i}`,
    })),
    {
      question: "Eventi: Carnevale di Sappada (Plodar Vosenòcht)",
      answer: "Rito collettivo nelle tre domeniche prima della Quaresima.",
    },
    ...Array.from({ length: 8 }, (_, i) => ({
      question: `Escursioni: Sentiero Numero ${i}`,
      answer: `Dettagli del sentiero ${i}`,
    })),
  ]
  const indexCards = buildTouristIndexCards({
    ...emptyContent(),
    events: [{ title: "Carnevale di Sappada (Plodar Vosenòcht)" }],
    restaurants: [{ name: "Locanda Numero 1", celiacFriendly: true }],
  })
  const catalogue = [...indexCards, ...detailCards]
  const eventsIndex = indexCards.find((c) => c.question === "Eventi")!
  const restaurantsIndex = indexCards.find((c) => c.question === "Ristoranti")!

  it("sanity: the fixture is over budget, so ranking is actually exercised", () => {
    expect(catalogue.length).toBeGreaterThan(24)
  })

  it('generic "che eventi ci sono?" selects the Eventi index (no detail card can win this)', () => {
    const chosen = selectRelevantFaqs(catalogue, "che eventi ci sono questa settimana?")
    expect(chosen).toContain(eventsIndex)
  })

  it('typo "dammi ristoranti celicaci" still selects the Ristoranti index (live miss, 2026-09-01)', () => {
    // "celicaci" matches nothing (whole-word matching, by design against the
    // FONDO substring bug of 2026-08-23) — the category word alone must be
    // enough to bring the list, celiac flags included, to the model.
    const chosen = selectRelevantFaqs(catalogue, "dammi ristoranti celicaci")
    expect(chosen).toContain(restaurantsIndex)
  })

  it('specific "quando è il carnevale?" still selects the DETAIL card (index never competes on names)', () => {
    const chosen = selectRelevantFaqs(catalogue, "quando è il carnevale?")
    expect(chosen).toContainEqual(
      expect.objectContaining({
        question: "Eventi: Carnevale di Sappada (Plodar Vosenòcht)",
      })
    )
  })
})
