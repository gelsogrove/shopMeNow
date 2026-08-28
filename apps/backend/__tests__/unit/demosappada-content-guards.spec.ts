/**
 * demosappada — the contact guard (content-guards.ts)
 *
 * WHAT: contratto.md, verbatim: "non inventare risposte! le risposte devono
 * arrivare dal db". Every URL the reply cites must appear in the approved
 * content (the FAQ block) or it is removed — and a markdown link is removed
 * WHOLE, label included, never hollowed out to `[label]()`.
 *
 * WHY: a guest asking for photos of Sappada was sent
 * "Ecco il link: [Sappada - Galleria Fotografica]()" — the model invented a
 * gallery URL, the guard stripped the URL out of the parentheses and shipped
 * the dead label as if it were a link (Andrea, live, 2026-08-27). The same
 * husk arrives straight from the model too: told never to invent URLs, it
 * writes `[label]()` with the parens already empty. A label without a
 * destination is a promise the reply cannot keep, so the whole construct
 * goes, and the tidy pass then sweeps the line it sat on if nothing else was
 * there (CLAUDE.md §16 iron rule 1: deterministic code, not another prompt
 * sentence).
 */
import { stripUnverifiableContacts } from "../../custom-demosappada/content-guards"

// The FAQ block the reply must draw from: one real page, nothing about photos.
const APPROVED =
  "Q: C'è una webcam per vedere Sappada in diretta?\n" +
  "A: Sì, sul sito ufficiale: https://www.visitsappada.it/webcam-sappada.php"

describe("demosappada content guard — markdown links are stripped whole", () => {
  it("removes an invented markdown link entirely, label included", () => {
    // The live bug's shape: a plausible label around a URL the FAQ block
    // never stated. Stripping only the URL is what produced `[label]()`.
    const reply =
      "Ecco il link per vedere le immagini: [Sappada - Galleria Fotografica](https://www.visitsappada.it/galleria.php)"
    const { text, removed } = stripUnverifiableContacts(reply, APPROVED)
    expect(text).not.toContain("[")
    expect(text).not.toContain("]()")
    expect(text).not.toContain("galleria.php")
    expect(removed).toHaveLength(1)
  })

  it("removes a markdown link the model already emitted with empty parens", () => {
    // The model self-censors into `[label]()` when it has no URL to cite.
    // That husk must never reach the guest, even though no URL was stripped.
    const reply = "Puoi guardare qui: [Sappada - Galleria Fotografica]()"
    const { text, removed } = stripUnverifiableContacts(reply, APPROVED)
    expect(text).not.toContain("Galleria Fotografica]")
    expect(removed).toEqual(["[Sappada - Galleria Fotografica]()"])
  })

  it("keeps a markdown link whose URL the approved content states", () => {
    // Removal is for INVENTED links only: a real page cited in markdown form
    // must pass untouched, or the guard eats correct answers.
    const reply = "Guarda le webcam: [Webcam Sappada](https://www.visitsappada.it/webcam-sappada.php)"
    const { text, removed } = stripUnverifiableContacts(reply, APPROVED)
    expect(text).toBe(reply)
    expect(removed).toHaveLength(0)
  })

  it("still strips a bare invented URL and keeps a bare approved one", () => {
    // Regression for the pre-existing behaviour: the markdown pass runs
    // first and must not change what happens to plain URLs.
    const reply =
      "Webcam: https://www.visitsappada.it/webcam-sappada.php e foto su https://www.visitsappada.it/foto.php"
    const { text, removed } = stripUnverifiableContacts(reply, APPROVED)
    expect(text).toContain("webcam-sappada.php")
    expect(text).not.toContain("foto.php")
    expect(removed).toEqual(["https://www.visitsappada.it/foto.php"])
  })

  it("sweeps away a line that held nothing but the invented link", () => {
    // The tidy pass exists so a strip never leaves a visibly amputated
    // message: a line that only carried the link disappears with it.
    const reply =
      "Sappada è bellissima in ogni stagione.\n\n[Galleria](https://www.visitsappada.it/galleria.php)\n\nSe hai bisogno di altro, chiedi pure!"
    const { text } = stripUnverifiableContacts(reply, APPROVED)
    expect(text).toBe("Sappada è bellissima in ogni stagione.\n\nSe hai bisogno di altro, chiedi pure!")
  })

  // 🚨 regression 2026-08-28 live: "Hotel La Baita ... Tel.. " — the model
  // invented a phone number, the guard stripped it, and the "Tel." label it
  // introduced stayed behind as a visibly amputated line. The husk goes with
  // the value.
  it("drops the contact label left orphaned by a stripped invented phone", () => {
    const reply =
      "Hotel La Baita — €€\nOffre camere confortevoli.\nTel. 0435 123999.\nDettagli: https://www.visitsappada.it/webcam-sappada.php"
    const { text } = stripUnverifiableContacts(reply, APPROVED)
    expect(text).not.toMatch(/Tel\W*$/m)
    expect(text).toContain("camere confortevoli")
    // The Dettagli line keeps its approved URL — a label WITH its value stays.
    expect(text).toContain("Dettagli: https://www.visitsappada.it/webcam-sappada.php")
  })
})

/**
 * WHAT: price BANDS ("€€") are verified like prices: a band stays only when
 * the approved content states one for that venue.
 *
 * WHY: the model decorated every venue with a band — "Rifugio Sorgenti del
 * Piave — €€" in one run, "— €" in the next — from a FAQ entry carrying none
 * (sim, 2026-08-28; Andrea, live: "rifugio togli il simbolo del dollaro"). A
 * band is a claim about cost; an invented one misleads exactly like an
 * invented price.
 */
import { stripInventedPriceBands, stripUnverifiableContacts as strip } from "../../custom-demosappada/content-guards"

describe("demosappada content guard — invented price bands", () => {
  const FAQ =
    "Q: Dove mangiare tipico?\nA: Latteria Plodarkelder — € — prodotti locali, tel 0435 469833.\n" +
    "Q: Rifugio Sorgenti del Piave\nA: In Val Sesis, cucina alpina semplice. Tel. 334 7799175."

  it("🚨 removes the band from a venue the source describes without one", () => {
    const removed: string[] = []
    const out = stripInventedPriceBands("**Rifugio Sorgenti del Piave — €€**\nCucina alpina semplice.", FAQ, removed)
    expect(out).toBe("**Rifugio Sorgenti del Piave**\nCucina alpina semplice.")
    expect(removed).toEqual(["€€"])
  })

  it("keeps the band the source states for that venue", () => {
    const removed: string[] = []
    const out = stripInventedPriceBands("**Latteria Plodarkelder — €**\nProdotti locali.", FAQ, removed)
    expect(out).toContain("— €")
    expect(removed).toEqual([])
  })

  it("leaves real prices to the price check — a band with digits is not a band", () => {
    const removed: string[] = []
    expect(stripInventedPriceBands("Ingresso €5", FAQ, removed)).toBe("Ingresso €5")
  })

  it("runs inside stripUnverifiableContacts", () => {
    const { text } = strip("**Rifugio Sorgenti del Piave (€€)**\nTel. 334 7799175.", FAQ)
    expect(text).not.toContain("€")
    expect(text).toContain("334 7799175")
  })
})

/**
 * WHAT: a venue named in bold that the approved content does not know is an
 * invented venue: its paragraph is dropped whole.
 *
 * WHY: "Rifugio Fedare — raggiungibile con la funivia, vista panoramica,
 * cucina tipica" (sim, 2026-08-28): no such entry anywhere in the FAQ block
 * or the catalogue. Bold is reserved for place names (contratto.md), which
 * makes the check deterministic: bold name not in the source → gone.
 */
import { stripUnknownVenues } from "../../custom-demosappada/content-guards"

describe("demosappada content guard — invented venues in bold", () => {
  const SOURCE = "Q: Rifugio Piani del Cristo\nA: Cucina tipica, aperto luglio-settembre. Tel. 0435 469120."

  it("🚨 drops the invented rifugio, keeps the real one", () => {
    const reply =
      "A Sappada abbiamo due rifugi:\n\n**Rifugio Fedare**\nRaggiungibile con la funivia, vista panoramica.\n\n" +
      "**Rifugio Piani del Cristo**\nCucina tipica.\nTel. 0435 469120."
    const { text, removed } = stripUnknownVenues(reply, SOURCE)
    expect(removed).toEqual(["Rifugio Fedare"])
    expect(text).not.toContain("Fedare")
    expect(text).toContain("**Rifugio Piani del Cristo**")
  })

  it("accents and shortened names still match the source", () => {
    const { removed } = stripUnknownVenues("**Rifugio Piani Del Cristo**\nok", SOURCE)
    expect(removed).toEqual([])
  })

  it("bold that is not a paragraph head is left alone", () => {
    const reply = "Chiamate il **Rifugio Piani del Cristo** oggi."
    expect(stripUnknownVenues(reply, SOURCE).text).toBe(reply)
  })
})

describe("demosappada content guard — a lead-in left with nothing under it goes too", () => {
  it("drops 'vi consiglio:' when every venue it introduced was removed", () => {
    const SOURCE = "Q: Latteria Plodarkelder\nA: prodotti locali"
    const reply = "Con i bambini vi consiglio:\n\n**Rifugio Fedare**\nInventato.\n\nDomani piove ancora."
    const { text } = stripUnknownVenues(reply, SOURCE)
    expect(text).toBe("Domani piove ancora.")
  })
})

describe("demosappada content guard — a bold heading that is no venue is demoted, not removed", () => {
  it("🚨 '**Per stasera**' keeps its paragraph (sim 2026-08-28 dropped the evening advice)", () => {
    const SOURCE = "Q: Latteria Plodarkelder\nA: prodotti locali"
    const reply = "**Per stasera**\nRestate al coperto, piove.\n\n**Rifugio Fedare**\nInventato."
    const { text, removed } = stripUnknownVenues(reply, SOURCE)
    expect(text).toBe("Per stasera\nRestate al coperto, piove.")
    expect(removed).toEqual(["Rifugio Fedare"])
  })
})
