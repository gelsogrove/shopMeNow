/**
 * demosappada — step 1 of the turn: UNDERSTAND (understand.ts)
 *
 * WHAT: the code's own capture (numbers, named people, weekdays, yes/no),
 * the guards on what the model returns from the forced `understand` call
 * (provenance for numbers and dates, enums, consent only when asked), and
 * the merge that never lets a weaker source overwrite a filled slot.
 *
 * WHY: docs/turn-design.md — "the model understands, the code decides".
 * Every rule here existed in the old save_preferences handler, scattered
 * across 3,000 lines and reachable only through a live model. Here they are
 * pure and tested. Cases are the live bugs of 2026-08-28.
 */
import { applyUnderstanding, deterministicSlots, mergeSlots } from "../../custom-demosappada/understand"

const NOW = new Date("2026-08-28T12:00:00+02:00") // a Friday
const ctx = (message: string, questionKey: string | null = null, profile: any = {}) => ({
  message, profile, questionKey, now: NOW, enabledLanguages: ["it", "en", "es", "de"], defaultLanguage: "it",
})

describe("deterministicSlots — the net under the model", () => {
  it("🚨 'io e mio marito' on the opening turn → 2 adults, 0 children, 0 seniors", () => {
    expect(deterministicSlots(ctx("io e mio marito vogliamo vedere sappada", "location"))).toMatchObject({
      adults: 2, children: 0, seniors: 0,
    })
  })

  it("'fino a domenica' → next Sunday, on the stay turn", () => {
    expect(deterministicSlots(ctx("fino a domenica", "stay"))).toMatchObject({ departureDate: "2026-08-30" })
  })

  it("'no nessuna' to the constraints question → constraints + no children/seniors", () => {
    expect(deterministicSlots(ctx("no nessuna", "constraints"))).toMatchObject({ children: 0, seniors: 0 })
  })

  it("a bare 'si' answers location / consent / itinerary — and nothing else", () => {
    expect(deterministicSlots(ctx("si", "location"))).toMatchObject({ presence: "in_loco" })
    expect(deterministicSlots(ctx("si", "consent"))).toMatchObject({ consentAsked: true, consent: "granted" })
    expect(deterministicSlots(ctx("no", "itinerary"))).toMatchObject({ itinerary: "no" })
    expect(deterministicSlots(ctx("si", "stay"))).toEqual({})
  })

  it("a question is never an answer", () => {
    expect(deterministicSlots(ctx("hola que tal?", "location"))).toEqual({})
  })

  it("never overwrites a party already on file", () => {
    expect(deterministicSlots(ctx("io e mio marito", "stay", { adults: 3 }))).not.toHaveProperty("adults")
  })
})

describe("applyUnderstanding — guards on the model's call", () => {
  it("🚨 'siamo un gruppo di persone' → adults 5 refused: no number, no enumerated members", () => {
    const u = applyUnderstanding(
      { intent: "answer", slots: { adults: 5, partySaidAs: "siamo un gruppo di persone" } },
      ctx("siamo un gruppo di persone e siamo in pulman", "headcount"),
    )
    expect(u.slots).not.toHaveProperty("adults")
    expect(u.refused).toContain("party")
  })

  it("'io e mio marito' with members enumerated → accepted", () => {
    const u = applyUnderstanding(
      { intent: "answer", slots: { adults: 2, children: 0, partySaidAs: "io e mio marito", partyMembers: ["io", "mio marito"] } },
      ctx("io e mio marito siamo a sappada", "location"),
    )
    expect(u.slots).toMatchObject({ adults: 2, children: 0 })
  })

  it("a date needs the guest's words, unless we asked for the dates", () => {
    const invented = applyUnderstanding(
      { intent: "answer", slots: { departureDate: "2026-08-30" } }, ctx("siamo due adulti", "headcount"))
    expect(invented.refused).toContain("dates")
    const quoted = applyUnderstanding(
      { intent: "answer", slots: { departureDate: "2026-08-30", dateSaidAs: "fino a domenica" } },
      ctx("io e mio marito siamo qui fino a domenica", "location"))
    expect(quoted.slots.departureDate).toBe("2026-08-30")
    const asked = applyUnderstanding(
      { intent: "answer", slots: { departureDate: "2026-08-30" } }, ctx("fino a domenica", "stay"))
    expect(asked.slots.departureDate).toBe("2026-08-30")
  })

  it("🚨 consent from a bare 'si' to ANOTHER question is refused", () => {
    const u = applyUnderstanding({ intent: "answer", slots: { consent: "granted" } }, ctx("si", "location"))
    expect(u.consent).toBeUndefined()
    expect(u.refused).toContain("consent")
    const ok = applyUnderstanding({ intent: "answer", slots: { consent: "granted" } }, ctx("si", "consent"))
    expect(ok.consent).toBe("granted")
    expect(ok.slots.consentAsked).toBe(true)
  })

  it("intent and request: a request carries the guest's words; chitchat carries nothing", () => {
    const r = applyUnderstanding({ intent: "request", request: "un albergo economico", slots: {} }, ctx("cerchiamo un albergo e vogliamo spendere poco"))
    expect(r.intent).toBe("request")
    expect(r.request).toBe("un albergo economico")
    const c = applyUnderstanding({ intent: "chitchat", slots: {} }, ctx("hola que tal?"))
    expect(c.intent).toBe("chitchat")
    expect(c.request).toBe("")
    const garbage = applyUnderstanding({ intent: "banana", slots: {} }, ctx("ciao a tutti"))
    expect(garbage.intent).toBe("answer")
  })

  it("language: only what the tenant enabled, else the default", () => {
    expect(applyUnderstanding({ intent: "chitchat", language: "es", slots: {} }, ctx("hola")).language).toBe("es")
    expect(applyUnderstanding({ intent: "chitchat", language: "ru", slots: {} }, ctx("привет")).language).toBe("it")
  })

  it("a one-word message states no facts: free text and numbers are dropped", () => {
    const u = applyUnderstanding({ intent: "answer", slots: { adults: 1, interests: "montagna" } }, ctx("ciao"))
    expect(u.slots).toEqual({})
  })
})

describe("mergeSlots — code first, model fills, filled slots stay", () => {
  it("the code's count wins over the model's; the model fills what the code could not read", () => {
    const out = mergeSlots({}, { adults: 2, children: 0 }, { adults: 3, interests: "camminare" }, false)
    expect(out).toEqual({ adults: 2, children: 0, interests: "camminare" })
  })

  it("a filled slot is not overwritten without strong provenance; free text is appended", () => {
    const out = mergeSlots({ adults: 2, constraints: "senza auto" }, {}, { adults: 4, constraints: "celiaca" }, false)
    expect(out).toEqual({ constraints: "senza auto; celiaca" })
  })

  it("with strong provenance (a number in the message) a count IS corrected", () => {
    expect(mergeSlots({ adults: 2 }, {}, { adults: 3 }, true)).toEqual({ adults: 3 })
  })
})

describe("applyUnderstanding — answers exist only for questions that were put", () => {
  it("🚨 'no grazie' to the consent question is not an itinerary answer", () => {
    const u = applyUnderstanding({ intent: "answer", slots: { itinerary: "no" } }, ctx("no grazie", "consent"))
    expect(u.slots).not.toHaveProperty("itinerary")
    expect(u.refused).toContain("itinerary")
  })

  it("the same 'no' on the itinerary turn is the answer", () => {
    const u = applyUnderstanding({ intent: "answer", slots: { itinerary: "no" } }, ctx("no grazie", "itinerary"))
    expect(u.slots.itinerary).toBe("no")
  })

  it("deterministic: 'no grazie' declines the consent; 'si' accepts the itinerary offer already put", () => {
    expect(deterministicSlots(ctx("no grazie", "consent"))).toMatchObject({ consentAsked: true, consent: "declined" })
    expect(deterministicSlots(ctx("si", "itinerary", { itinerary: "asked" }))).toMatchObject({ itinerary: "yes" })
  })
})

describe("mergeSlots — the itinerary offer placeholder gives way to the answer", () => {
  it("🚨 'si' to the offer turns 'asked' into 'yes'", () => {
    expect(mergeSlots({ itinerary: "asked" }, { itinerary: "yes" }, {}, false)).toEqual({ itinerary: "yes" })
  })
})

describe("applyUnderstanding — a number anchors only its own category", () => {
  it("🚨 'siamo a Sappada con due bambini': children 2 accepted, adults 2 refused", () => {
    const u = applyUnderstanding(
      { intent: "answer", slots: { adults: 2, children: 2, partySaidAs: "con due bambini", partyMembers: ["noi", "due bambini"] } },
      ctx("siamo a sappada con due bambini", "location"))
    expect(u.slots).toEqual({ children: 2 })
    expect(u.refused).toContain("adults")
  })

  it("'siamo in 3 con 2 bambini': both accepted (a loose number anchors everything)", () => {
    const u = applyUnderstanding({ intent: "answer", slots: { adults: 3, children: 2 } }, ctx("siamo in 3 con 2 bambini", "party"))
    expect(u.slots).toMatchObject({ adults: 3, children: 2 })
  })
})

describe("deterministicSlots — a bare answer to a free-text question still answers it", () => {
  it("🚨 'no' to the constraints question closes the step (no third repeat)", () => {
    expect(deterministicSlots(ctx("no", "constraints"))).toMatchObject({ constraints: "no" })
    expect(deterministicSlots(ctx("si", "interests"))).toMatchObject({ interests: "si" })
  })
})
