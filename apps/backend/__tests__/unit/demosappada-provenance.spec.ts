/**
 * demosappada — party provenance (provenance.ts + the party guard in agent.ts)
 *
 * WHAT: the numbers the model saves via save_preferences (adults/children/
 * seniors) need PROVENANCE: either a digit / number-word in the guest's
 * message (parseParty), or `partySaidAs` — the guest's exact words naming
 * the party, verified by code to exist in the message. `quoteAnchoredIn` is
 * that verification, shared in spirit with `dateSaidAs`.
 *
 * WHY: "io e mio marito siamo a sappada" carries no number. The model read
 * it right (adults 2, children 0), the guard refused it for lack of a digit,
 * and after "Domenica" the intake asked "E in quanti siete?" at a guest who
 * had already said (Andrea, 2026-08-28: "se ho già detto qualcosa non devi
 * farmi domande... devi capire che sono 2 persone e non ci sono bambini").
 * The guard itself was born of a real invention — adults 1 out of "VOGLIAMO
 * VEDERE I RIFUGI" (2026-08-27) — so it must stay: what changes is that a
 * quote naming the people now anchors the numbers, exactly as a quote
 * naming the dates anchors those. Code reads no meaning (CLAUDE.md §14): it
 * only checks the quoted words were typed.
 */
import { quoteAnchoredIn } from "../../custom-demosappada/provenance"

describe("demosappada quoteAnchoredIn — the model's quote must exist in the message", () => {
  it("🚨 regression 2026-08-28: 'io e mio marito' anchors the party numbers", () => {
    // The live message, verbatim. The model quotes the people it counted;
    // "marito" is a real word of the message → the numbers survive the guard.
    expect(quoteAnchoredIn("io e mio marito", "io e mio marito siamo a sappada")).toBe(true)
  })

  it("survives a typo: the guest wrote 'marit', the model quoted 'marito'", () => {
    // Prefix match on 4 chars, the same tolerance dateSaidAs learned on
    // "fino a domenic" (2026-08-25).
    expect(quoteAnchoredIn("io e mio marito", "io e mio marit siamo qui")).toBe(true)
  })

  it("rejects a quote the guest never wrote — an invented party has no words", () => {
    // The 2026-08-27 invention: adults 1 out of a sentence that names nobody.
    // A model that quotes people it did not read has nothing to anchor to.
    expect(quoteAnchoredIn("siamo una famiglia", "VOGLIAMO VEDERE I RIFUGI")).toBe(false)
  })

  it("rejects a missing or empty quote — numbers without provenance are refused", () => {
    expect(quoteAnchoredIn(undefined, "io e mio marito siamo a sappada")).toBe(false)
    expect(quoteAnchoredIn("   ", "io e mio marito siamo a sappada")).toBe(false)
  })

  it("ignores short function words: 'io e' alone cannot anchor anything", () => {
    // Only words of ≥4 letters count, so a quote of glue words matches
    // nothing even when the glue words are in the message.
    expect(quoteAnchoredIn("io e", "io e mio marito")).toBe(false)
  })

  it("works in other languages — the check is on words, not on meaning", () => {
    expect(quoteAnchoredIn("my husband and I", "My husband and I are in Sappada until Sunday")).toBe(true)
    expect(quoteAnchoredIn("mein Mann und ich", "Mein Mann und ich sind bis Sonntag hier")).toBe(true)
  })
})
