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

describe("buildTouristIndexCards — languages from workspace configuration", () => {
  // WHAT: retrieval runs BEFORE any LLM call, so "what events are there?"
  // can never match the Italian label. Translated labels are CONTENT and come
  // from configuration (`touristIndexLabels` in the workspace's advanced
  // settings), never from code (Andrea, 2026-09-01: "è dinamico, dentro la
  // app si gestisce tutto... il settings sono per i contenuti dinamici").
  const oneEvent = () => ({
    ...emptyContent(),
    events: [{ title: "Carnevale di Sappada" }],
  })

  it("builds one EXTRA card per enabled language that has a configured label", () => {
    const cards = buildTouristIndexCards(oneEvent(), {
      enabledLanguages: ["it", "en", "de"],
      defaultLanguage: "it",
      labels: { en: { events: "Events" }, de: { events: "Veranstaltungen" } },
    })
    // Same answer, three questions: the base label + the two translations.
    expect(cards.map((c) => c.question)).toEqual(["Eventi", "Events", "Veranstaltungen"])
    expect(new Set(cards.map((c) => c.answer)).size).toBe(1)
  })

  it("no configured label → only the default-language card (the fallback Andrea asked for)", () => {
    const cards = buildTouristIndexCards(oneEvent(), {
      enabledLanguages: ["it", "en", "fr"],
      defaultLanguage: "it",
      labels: { en: { events: "Events" } }, // fr has no labels
    })
    expect(cards.map((c) => c.question)).toEqual(["Eventi", "Events"])
  })

  it("ignores labels for languages NOT in enabledLanguages (settings govern, not the label file)", () => {
    const cards = buildTouristIndexCards(oneEvent(), {
      enabledLanguages: ["it", "en"],
      defaultLanguage: "it",
      labels: { en: { events: "Events" }, de: { events: "Veranstaltungen" } },
    })
    expect(cards.map((c) => c.question)).toEqual(["Eventi", "Events"])
  })

  it("dedupes identical labels — es/pt sharing 'Eventos' must not produce twin cards", () => {
    // Twin cards would share every question term and halve each other's IDF
    // weight, weakening the very match they exist for.
    const cards = buildTouristIndexCards(oneEvent(), {
      enabledLanguages: ["it", "es", "pt"],
      defaultLanguage: "it",
      labels: { es: { events: "Eventos" }, pt: { events: "Eventos" } },
    })
    expect(cards.map((c) => c.question)).toEqual(["Eventi", "Eventos"])
  })

  it("the default language never adds a translated card (the base card IS that card)", () => {
    const cards = buildTouristIndexCards(oneEvent(), {
      enabledLanguages: ["it", "en"],
      defaultLanguage: "it",
      labels: { it: { events: "Eventi in paese" }, en: { events: "Events" } },
    })
    expect(cards.map((c) => c.question)).toEqual(["Eventi", "Events"])
  })

  it("malformed configuration degrades to the base card, never a broken turn", () => {
    for (const labels of [null, "not-an-object", 42, { en: "not-an-object" }]) {
      const cards = buildTouristIndexCards(oneEvent(), {
        enabledLanguages: ["it", "en"],
        defaultLanguage: "it",
        labels,
      })
      expect(cards.map((c) => c.question)).toEqual(["Eventi"])
    }
  })
})

/**
 * WHAT: selection no longer drops anything - every active entry reaches the
 * model, index cards and detail cards alike.
 *
 * WHY the old "index cards win a budget slot" tests are gone: they locked a
 * ranker that has been removed. It scored the guest's words against each
 * entry's QUESTION, and on 2026-09-01 a guest wrote that their little girl had
 * a fever: "febbre" appears in no question and no answer of all 82 entries, so
 * every entry scored 0.000, the top 24 were simply the first 24 in list order,
 * and the health entry carrying 116117 finished 27th. The model never saw it
 * and offered "Guardia medica - 118" - the ambulance - to a parent with a sick
 * child.
 *
 * The index cards themselves remain valuable: they are how a generic question
 * gets a COMPACT list of catalogue rows instead of prose scattered across
 * detail cards. What is no longer needed is their fight for a slot.
 */
describe("every entry reaches the model - nothing is dropped", () => {
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
  const indexCards = buildTouristIndexCards(
    {
      ...emptyContent(),
      events: [{ title: "Carnevale di Sappada (Plodar Vosenòcht)" }],
      restaurants: [{ name: "Locanda Numero 1", celiacFriendly: true }],
    },
    {
      enabledLanguages: ["it", "en"],
      defaultLanguage: "it",
      labels: { en: { events: "Events", restaurants: "Restaurants" } },
    }
  )
  const catalogue = [...indexCards, ...detailCards]

  it("sanity: the fixture is larger than the old 24-entry budget", () => {
    expect(catalogue.length).toBeGreaterThan(24)
  })

  it("🚨 a catalogue over the old budget passes through COMPLETE", () => {
    // The regression that matters: under the old ranker this returned 24 of
    // ~31 entries and the ones dropped were chosen by an arbitrary tie.
    const chosen = selectRelevantFaqs(catalogue)
    expect(chosen).toHaveLength(catalogue.length)
    expect(chosen).toEqual(catalogue)
  })

  it("🚨 wording that matches NO entry still gets everything", () => {
    // The live bug, generalised: the guest's words need not appear anywhere in
    // the catalogue. Under the old ranker every score was 0.000 and list order
    // silently decided what the model saw.
    const chosen = selectRelevantFaqs(catalogue)
    for (const card of indexCards) expect(chosen).toContain(card)
    expect(chosen).toContainEqual(
      expect.objectContaining({ question: "Eventi: Carnevale di Sappada (Plodar Vosenòcht)" })
    )
  })

  it("an empty catalogue stays empty", () => {
    expect(selectRelevantFaqs([])).toEqual([])
  })
})
