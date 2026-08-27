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
