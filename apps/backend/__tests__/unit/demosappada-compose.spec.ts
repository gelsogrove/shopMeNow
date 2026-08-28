/**
 * demosappada — how a turn is SHAPED (intake-compose.ts)
 *
 * WHAT: the deterministic composition that runs after the model has written:
 * one question per message and it is OURS, the guest's own question answered
 * first, a sidestepped question held for one turn, and the itinerary-delivery
 * message stripped of helper-offer filler.
 *
 * WHY: iron rule 1 — when the model misbehaves, the fix is code that removes
 * its freedom. Each rule here replaced a prompt sentence the model ignored
 * live; the test states the guarantee the code now owns.
 */
import {
  classifyTurn,
  composeIntakeTurn,
  guestAskedSomething,
  holdRepeatedQuestion,
  isBareIntakeQuestion,
  replyLacksSubstance,
  stripTrailingOffers,
} from "../../custom-demosappada/intake-compose"
import { getState, resetState, updateState } from "../../custom-demosappada/state"

describe("demosappada composeIntakeTurn — one question, ours, in its place", () => {
  const QUESTION = "In quanti siete e fino a quando vi fermate?"

  it("a turn where the guest asked nothing IS the question — nothing else", () => {
    // The model wrote three museums and a link before the question; the guest
    // had only said "ok". The question is the whole message (Andrea,
    // 2026-08-25: "devono essere domande secche una dopo l'altra").
    const turn = composeIntakeTurn({
      reply: "Ecco tre musei interessanti...\n\n" + QUESTION,
      key: "party",
      question: QUESTION,
      questionTranslated: QUESTION,
      guestAsked: false,
    })
    expect(turn.text).toBe(QUESTION)
    expect(turn.asked).toBe(true)
    expect(turn.dropped.length).toBeGreaterThan(0)
  })

  it("when the guest asked something, their answer stays and our question closes the message", () => {
    const turn = composeIntakeTurn({
      reply: "La funivia costa 12 euro andata e ritorno.",
      key: "party",
      question: QUESTION,
      questionTranslated: QUESTION,
      guestAsked: true,
    })
    expect(turn.text.startsWith("La funivia costa 12 euro")).toBe(true)
    expect(turn.text.endsWith(QUESTION)).toBe(true)
  })

  it("questions the MODEL invented are stripped; ours survives exactly once", () => {
    const turn = composeIntakeTurn({
      reply:
        "La funivia costa 12 euro. Volete che vi consigli anche un ristorante?\n\n" + QUESTION,
      key: "party",
      question: QUESTION,
      questionTranslated: QUESTION,
      guestAsked: true,
    })
    expect(turn.text).not.toContain("ristorante?")
    expect(turn.text.match(/fino a quando vi fermate\?/g)).toHaveLength(1)
  })

  it("with no question due but the intake still open, the model may not invent one", () => {
    // One turn after the guest answered, the model asked "ci sono altre
    // esigenze da considerare?" — a question nobody dictated (Andrea,
    // 2026-08-25: "ma lo abbiamo già chiesto no?").
    const turn = composeIntakeTurn({
      reply: "Perfetto. Ci sono altre esigenze o preferenze da considerare?",
      key: null,
      question: null,
      questionTranslated: null,
      guestAsked: false,
      intakeOpen: true,
    })
    expect(turn.text).not.toContain("?")
  })

  it("the closing turn keeps the model's prose and signs off with the configured line", () => {
    const closing = "Vi auguriamo una splendida permanenza!"
    const ask = "Vuoi che ti prepari un itinerario per i giorni che restate?"
    const turn = composeIntakeTurn({
      reply: "Perfetto Andrea! Oggi c'è il sole: vi consiglio le Cascatelle.",
      key: "itinerary",
      question: ask,
      questionTranslated: ask,
      guestAsked: false,
      closingLine: closing,
    })
    expect(turn.text).toContain("Cascatelle")
    expect(turn.text).toContain(ask)
    expect(turn.text.trim().endsWith(closing)).toBe(true)
  })
})

describe("demosappada holdRepeatedQuestion — a sidestepped question waits one turn", () => {
  const SID = "hold-spec"
  afterEach(() => resetState(SID))

  it("holds the repeat when the guest engaged with something else, then lets it out next turn", () => {
    // Live 2026-08-27 ("me la chiedi 2 volte?"): the guest met the question
    // with a question of their own, and the same sentence came back stapled
    // under the answer. Held turns and asked turns must alternate.
    updateState(SID, { lastAskedKey: "constraints" }, { mirror: false })
    expect(holdRepeatedQuestion(SID, "constraints", true)).toBe(true) // held
    expect(holdRepeatedQuestion(SID, "constraints", true)).toBe(false) // goes out
    expect(getState(SID).repeatCooldownKey).toBeUndefined()
  })

  it("after a bare 'ok' the re-ask IS the reply — nothing is held", () => {
    updateState(SID, { lastAskedKey: "constraints" }, { mirror: false })
    expect(holdRepeatedQuestion(SID, "constraints", false)).toBe(false)
  })

  it("a DIFFERENT question is never held — only the exact repeat the guest just saw", () => {
    updateState(SID, { lastAskedKey: "party" }, { mirror: false })
    expect(holdRepeatedQuestion(SID, "constraints", true)).toBe(false)
  })
})

describe("demosappada stripTrailingOffers — the itinerary ends on the plan, not on filler", () => {
  // The exact endings Andrea saw live (2026-08-27): filler where the
  // configured closing question belongs.
  const PLAN =
    "**Giovedì** — Cascatelle al mattino: l'unico giorno sereno.\n\n" +
    "**Venerdì** — Piccolo Museo della Grande Guerra, perché è prevista pioggia."
  const FILLER_CONTACT =
    "Se avete bisogno di ulteriori dettagli su orari o disponibilità, potete contattare " +
    "l'InfoPoint al numero 0435 469131."
  const FILLER_OFFER = "Se avete domande o volete modificare qualcosa, fatemelo sapere!"

  it("🚨 regression 2026-08-27: both live filler paragraphs are dropped, the plan survives", () => {
    const { text, removed } = stripTrailingOffers(
      `${PLAN}\n\n${FILLER_CONTACT}\n\n${FILLER_OFFER}`,
      true,
    )
    expect(text).toBe(PLAN)
    expect(removed).toHaveLength(2)
  })

  it("plan content is never cut, whatever its sentence says", () => {
    // A day line mentioning the InfoPoint is content, not an offer: the bold
    // heading stops the scan.
    const { text } = stripTrailingOffers(PLAN, true)
    expect(text).toBe(PLAN)
  })

  it("a trailing question is cut only on the first delivery, when ours replaces it", () => {
    const withQuestion = `${PLAN}\n\nVolete che vi consigli anche un ristorante?`
    expect(stripTrailingOffers(withQuestion, true).text).toBe(PLAN)
    // On a plan UPDATE the trailing question may be the legitimate
    // "com'è andata ieri?" follow-up — it stays.
    expect(stripTrailingOffers(withQuestion, false).text).toBe(withQuestion)
  })
})

describe("demosappada guest-input shape checks (never intent, CLAUDE.md §14)", () => {
  it("guestAskedSomething is the question mark and nothing else", () => {
    // The keyword list this replaced matched "ci sono 2 bambini" — a statement
    // — and the guest got playgrounds mid-intake (2026-08-25).
    expect(guestAskedSomething("quanto costa la funivia?")).toBe(true)
    expect(guestAskedSomething("ci sono 2 bambini")).toBe(false)
  })

  it("isBareIntakeQuestion: short, question-shaped, no facts", () => {
    expect(isBareIntakeQuestion("Fino a quando vi fermate?")).toBe(true)
    // A reply carrying a number or a list is doing real work — not bare.
    expect(isBareIntakeQuestion("La funivia costa 12 euro, vi fermate fino a domenica?")).toBe(false)
  })
})

describe("demosappada replyLacksSubstance — the general form of 'reply is bookkeeping only'", () => {
  const STAY_QUESTION = "Fino a quando vi fermate?"

  // 🚨 regression 2026-08-28 live: "Arriviamo domani mattina, com'è il
  // tempo?" got "Ho registrato il vostro arrivo per domani e il soggiorno
  // fino al 31 agosto. Se hai bisogno di suggerimenti per attività o luoghi
  // da visitare, fammelo sapere!" — no "?", not short, so isBareIntakeQuestion
  // missed it entirely while the weather question went unanswered.
  it("a save-ack + trailing offer, with no real content, lacks substance", () => {
    const reply =
      "Ho registrato il vostro arrivo per domani e il soggiorno fino al 31 agosto.\n\n" +
      "Se hai bisogno di suggerimenti per attività o luoghi da visitare, fammelo sapere!"
    expect(replyLacksSubstance(reply, null)).toBe(true)
  })

  it("a reply that is only the dictated question lacks substance", () => {
    expect(replyLacksSubstance(STAY_QUESTION, STAY_QUESTION)).toBe(true)
  })

  it("a reply with a real forecast or recommendation has substance", () => {
    const reply =
      "Domani a Sappada è previsto sole con 22°C, condizioni ideali per una passeggiata.\n\n" +
      STAY_QUESTION
    expect(replyLacksSubstance(reply, STAY_QUESTION)).toBe(false)
  })

  // 🚨 regression 2026-08-28 live (third form): "Suggeriscimi un paio di
  // escursioni..." was met with "Perfetto. E fino a quando vi fermate?" —
  // the model saved presence mid-turn, the machine advanced, and the
  // OUTGOING question differed from the one dictated at turn start, so a
  // strip keyed on `ours` alone let it count as substance. A reply made of
  // nothing but questions carries no facts, whichever question it is.
  it("a reply that is only a DIFFERENT question from the dictated one still lacks substance", () => {
    const dictated = "Siete già a Sappada?"
    expect(replyLacksSubstance("Perfetto. E fino a quando vi fermate?", dictated)).toBe(true)
  })
})

describe("demosappada classifyTurn — ONE authority on the turn's kind", () => {
  // Every consumer (retry guard, composer, fallback) reads this predicate,
  // so they can never disagree about "did the guest bring content to serve".
  // Each case below is one of the 2026-08-28 live bugs, where two consumers
  // deciding independently is exactly what broke.

  it("a long request with no question mark is an ANSWER turn", () => {
    // Live, three times: "Suggeriscimi un paio di escursioni di massimo 4
    // ore..." — no "?", never declared by the model, first turn (nothing
    // pending). It must still be served before our question goes out.
    const msg =
      "prossimo weekend a Sappada. Suggeriscimi per favore un paio di escursioni di massimo 4 ore"
    expect(classifyTurn(msg, { machineAdvanced: true, hasPendingRequest: false })).toBe("answer")
  })

  it("a bare yes/no or a sub-3-word message is an ADVANCE turn", () => {
    expect(classifyTurn("si", { machineAdvanced: true, hasPendingRequest: false })).toBe("advance")
    expect(classifyTurn("niente", { machineAdvanced: true, hasPendingRequest: false })).toBe("advance")
  })

  it("a short answer that moved the machine forward is an ADVANCE turn", () => {
    // "nessun bambino 3 adulti" answers composition+headcount: the next
    // question IS the whole reply, no retry, no scolding the model.
    expect(
      classifyTurn("nessun bambino 3 adulti", { machineAdvanced: true, hasPendingRequest: false }),
    ).toBe("advance")
    expect(
      classifyTurn("fino a domenica prossima", { machineAdvanced: true, hasPendingRequest: false }),
    ).toBe("advance")
  })

  it("a short sentence that advanced NOTHING is an ANSWER turn", () => {
    // "cerchiamo un albergo" (2026-08-28 live): filed under constraints by
    // mistake, but as a turn it carries a request, not an answer.
    expect(
      classifyTurn("cerchiamo un albergo", { machineAdvanced: false, hasPendingRequest: false }),
    ).toBe("answer")
  })

  it("an open pendingRequest forces ANSWER whatever the message shape", () => {
    // The guest is owed a reply from an earlier turn: a bare "sì" to our
    // consent question must not bury the excursion they asked about.
    expect(classifyTurn("si", { machineAdvanced: true, hasPendingRequest: true })).toBe("answer")
  })
})

/**
 * WHAT: two more signals for the turn composer, both observed from the
 * bot's side and never read from the guest's words (§14).
 *
 * WHY (sim, 2026-08-28, the four "can you handle these?" requests):
 *  - "cerchiamo un rifugio con funivia": five words, no "?", the machine had
 *    advanced (presence saved) — the six-word rule classed it as a plain
 *    intake answer and the accommodation list the model had FETCHED was
 *    thrown away for "E fino a quando vi fermate?". A turn in which the
 *    model fetched content is an answer turn: `contentFetched`.
 *  - "cerchiamo un albergo e vogliamo spendere poco": the model wrote only
 *    "Se hai bisogno di ulteriori informazioni, fammi sapere!" and that
 *    filler went out as the answer, above our question. Offer-only
 *    paragraphs are stripped from every intake turn.
 */
import { stripOfferParagraphs } from "../../custom-demosappada/intake-compose"

describe("demosappada classifyTurn — a fetched result makes an ANSWER turn", () => {
  it("🚨 sim 2026-08-28: 'cerchiamo un rifugio con funivia' with check_accommodation called", () => {
    expect(
      classifyTurn("cerchiamo un rifugio con funivia", {
        machineAdvanced: true,
        hasPendingRequest: false,
        contentFetched: true,
      }),
    ).toBe("answer")
  })

  it("without a fetch the six-word rule still applies — existing behaviour unchanged", () => {
    expect(
      classifyTurn("cerchiamo un rifugio con funivia", {
        machineAdvanced: true,
        hasPendingRequest: false,
        contentFetched: false,
      }),
    ).toBe("advance")
  })
})

describe("demosappada stripOfferParagraphs — filler is never an answer", () => {
  it("🚨 sim 2026-08-28: an offer-only reply is emptied, so our question goes out alone", () => {
    const dropped: string[] = []
    const out = stripOfferParagraphs("Se hai bisogno di ulteriori informazioni o di altri consigli, fammi sapere!", dropped)
    expect(out).toBe("")
    expect(dropped).toHaveLength(1)
  })

  it("keeps content paragraphs and drops only the offer between them", () => {
    const dropped: string[] = []
    const reply =
      "**Latteria Plodarkelder — €**\nProdotti locali, Tel. 0435 469833.\n\n" +
      "Se hai bisogno di altro, fammi sapere!\n\n" +
      "E fino a quando vi fermate?"
    const out = stripOfferParagraphs(reply, dropped)
    expect(out).toContain("Plodarkelder")
    expect(out).toContain("E fino a quando vi fermate?")
    expect(out).not.toContain("fammi sapere")
  })

  it("never cuts a paragraph carrying plan content, even if it mentions an offer", () => {
    const dropped: string[] = []
    const reply = "- Cascatelle al mattino\n- Se avete domande fatemelo sapere, poi Sorgenti del Piave"
    expect(stripOfferParagraphs(reply, dropped)).toBe(reply)
  })
})

/**
 * WHAT: the plan-confirmation question the model appends to an itinerary is
 * stripped like any other helper-offer.
 *
 * WHY: "Vi va così per sabato, o volete aggiungere/cambiare qualcosa?" —
 * Andrea, 2026-08-28: "non la voglio questa frase... non c'è bisogno di
 * dirla come non c'è bisogno di dire ho salvato le preferenze". The plan is
 * the guest's; a change is theirs to ask for (mainPrompt). Bot output only.
 */
import { stripTrailingOffers } from "../../custom-demosappada/intake-compose"

describe("demosappada — the plan confirmation question is stripped", () => {
  const PLAN = "**Sabato**\n- Mattina: Cascatelle\n- Pomeriggio: Museo Etnografico"

  it("🚨 'Vi va così per sabato, o volete aggiungere/cambiare qualcosa?' goes, the plan stays", () => {
    const { text, removed } = stripTrailingOffers(
      PLAN + "\n\nVi va così per sabato, o volete aggiungere/cambiare qualcosa?", false)
    expect(text).toBe(PLAN)
    expect(removed).toHaveLength(1)
  })

  it("other languages, same class", () => {
    expect(stripTrailingOffers(PLAN + "\n\nDoes that work for you, or would you like to change anything?", false).text).toBe(PLAN)
    expect(stripTrailingOffers(PLAN + "\n\nÇa vous va, ou voulez-vous changer quelque chose ?", false).text).toBe(PLAN)
    expect(stripTrailingOffers(PLAN + "\n\n¿Os parece bien, o queréis cambiar algo?", false).text).toBe(PLAN)
  })

  it("a follow-up about yesterday is NOT a confirmation and stays", () => {
    const followUp = PLAN + "\n\nCom'è andata ieri alle Cascatelle?"
    expect(stripTrailingOffers(followUp, false).text).toBe(followUp)
  })
})
