/**
 * demosappada — parseParty (party-parse.ts), the code's own reading of who
 * is in the party.
 *
 * WHAT: digits, number-words, category words (bambini/adulti/anziani),
 * "coppia", and — new — the nouns a guest uses to NAME the people with them
 * ("io e mio marito", "my wife and I", "con la nonna"). Closed vocabularies
 * only (§14); pure; no model involved.
 *
 * WHY: the 15:44 live turn of 2026-08-28. "io e mip marito vogliamo visitare
 * sappada" — the production model understood ("siete in due") and saved
 * adults 2, but WITHOUT the provenance fields the guard asks for, so the
 * numbers were refused and "E in quanti siete?" went out. Trusting the model
 * to send the right fields is exactly the probabilistic dependency Andrea
 * rejects ("se ho già detto qualcosa non devi farmi domande"): the code now
 * counts the named people itself, whatever the model sends.
 */
import { parseParty } from "../../custom-demosappada/party-parse"

describe("demosappada parseParty — named people are a headcount", () => {
  it("🚨 live 15:44: 'io e mip marito' → 2 adults, 0 children, 0 seniors, enumerated", () => {
    expect(parseParty("io e mip marito vogliamo visitare sappada e non abbiamo la macchina")).toEqual({
      adults: 2, children: 0, seniors: 0, enumerated: true,
    })
  })

  it("mixed party: 'io, mia moglie, mio figlio e la nonna'", () => {
    expect(parseParty("io, mia moglie, mio figlio e la nonna")).toMatchObject({
      adults: 2, children: 1, seniors: 1, enumerated: true,
    })
  })

  it("other languages, same mechanism", () => {
    expect(parseParty("my wife and I are here until Sunday")).toMatchObject({ adults: 2, children: 0 })
    expect(parseParty("ich und meine Frau sind bis Sonntag hier")).toMatchObject({ adults: 2 })
    expect(parseParty("je suis avec ma femme et mon fils")).toMatchObject({ adults: 2, children: 1 })
    expect(parseParty("mi marido y yo")).toMatchObject({ adults: 2 })
  })

  it("a number wins over names: 'siamo in 4, io e mio marito con due bimbi'", () => {
    // Digits/number-words are exact; the noun count is only used when no
    // number was read at all.
    const p = parseParty("siamo in 4, io e mio marito con due bimbi")
    expect(p.children).toBe(2)
    expect(p.enumerated).toBeUndefined()
  })

  it("a lone 'io' is grammar, not a party; plurals without a number say nothing", () => {
    expect(parseParty("io vorrei sapere dove mangiare")).toEqual({})
    expect(parseParty("siamo con i figli")).toEqual({})
    expect(parseParty("siamo un gruppo di persone e siamo in pulman")).toEqual({})
  })

  it("'coppia' and the category words keep working as before", () => {
    expect(parseParty("siamo una coppia di 50enni")).toMatchObject({ adults: 2 })
    expect(parseParty("siamo due adulti e due bambini")).toMatchObject({ adults: 2, children: 2 })
    expect(parseParty("3 giorni")).toMatchObject({ days: 3 })
  })
})
