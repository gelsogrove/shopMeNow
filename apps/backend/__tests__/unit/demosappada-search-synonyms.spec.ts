/**
 * demosappada — searchSynonyms: the word-equivalence table (faq-media.ts)
 *
 * WHAT: `selectRelevantFaqs` accepts the tenant's `searchSynonyms` groups
 * (advanced settings → settings.json → agent). Every word in a group counts
 * as the group's first word during selection, so plural/gender/language
 * variants land on the right card. The groups are CONTENT: they live in
 * configuration, these tests pass them explicitly.
 *
 * WHY (Andrea, 2026-09-01): matching is whole-word by design (the FONDO
 * substring bug), so "dammi le piste nere" found nothing although a "pista
 * nera" card existed — piste≠pista, nere≠nera. Enumerable rules can't cover
 * every case ("è impossibile calcolare tutti i casi") and embeddings were
 * ruled out for now ("tira fuori cose che non c'entrano nulla"), so the fix
 * is a curated multilingual table: deterministic, extendable from the app,
 * and incapable of surfacing an unrelated card — matching stays exact, only
 * the alphabet of "equal" widens.
 *
 * Guard invariant: synonyms apply to SELECTION ONLY. The media guards
 * (withFaqMedia & co.) keep the identity alphabet — their thresholds were
 * tuned against live failures and must not move.
 */
import { selectRelevantFaqs } from "../../custom-demosappada/faq-media"

// Tenant-shaped groups, as they would sit in advanced settings.
const GROUPS = [
  ["pista", "piste", "pisten", "slope", "slopes"],
  ["nera", "nere", "nero", "neri"],
  ["celiaci", "celiaco", "celiaca", "celiache", "celiachia", "glutine", "gluten"],
  ["eventi", "evento", "events", "veranstaltungen", "feste", "festa", "sagre", "sagra"],
]

// Over-budget catalogue (>24) so ranking actually runs: filler cards score 0
// on every query below, the interesting cards must beat them via synonyms.
const filler = Array.from({ length: 26 }, (_, i) => ({
  question: `Escursioni: Sentiero Numero ${i}`,
  answer: `Dettagli del sentiero ${i}`,
}))
const skiCard = {
  question: "Impianti di sci: Pista Nera Sappada 2000 — pista nera",
  answer: "La nera più ripida del comprensorio.",
}
const celiacCard = {
  question: "Ristoranti: Baita Mondschein — adatto a celiaci, senza glutine",
  answer: "Cucina tipica, opzioni senza glutine.",
}
const eventsIndex = { question: "Eventi", answer: "• Sagra X\n• Festa Y" }
// Fillers FIRST: at score 0 the sort is stable, so cards placed early win tie
// slots by position. The interesting cards sit past the budget — they can
// only enter by actually scoring, which is what these tests measure.
const catalogue = [...filler, skiCard, celiacCard, eventsIndex]

describe("selectRelevantFaqs with searchSynonyms", () => {
  it('plural "dammi le piste nere" selects the "pista nera" card (the live miss)', () => {
    const chosen = selectRelevantFaqs(catalogue, "dammi le piste nere", GROUPS)
    expect(chosen).toContain(skiCard)
  })

  it('gender/number "sono celiaca" selects the celiac-friendly restaurant', () => {
    const chosen = selectRelevantFaqs(catalogue, "sono celiaca, dove mangio?", GROUPS)
    expect(chosen).toContain(celiacCard)
  })

  it('cross-language "welche Pisten gibt es?" selects the ski card', () => {
    const chosen = selectRelevantFaqs(catalogue, "welche Pisten gibt es?", GROUPS)
    expect(chosen).toContain(skiCard)
  })

  it('synonym "che sagre ci sono?" selects the Eventi index card', () => {
    const chosen = selectRelevantFaqs(catalogue, "che sagre ci sono in paese?", GROUPS)
    expect(chosen).toContain(eventsIndex)
  })

  it("without groups the plural query still misses — locks that the table is what fixes it", () => {
    // Documents the base behavior the table exists to correct: if this ever
    // starts passing without groups, the matching mechanics changed and the
    // synonym layer should be re-examined.
    const chosen = selectRelevantFaqs(catalogue, "dammi le piste nere")
    expect(chosen).not.toContain(skiCard)
  })

  it("malformed configuration degrades to identity matching, never a broken turn", () => {
    for (const bad of [null, "x", 42, [["solo-una"]], [[1, 2]], {}]) {
      const chosen = selectRelevantFaqs(catalogue, "dammi le piste nere", bad)
      expect(chosen).toHaveLength(24)
      expect(chosen).not.toContain(skiCard)
    }
  })

  it("a synonym can never pull in an unrelated card (exact matching, wider alphabet)", () => {
    // "piste nere" shares no group and no word with the celiac card or the
    // fillers — none of them may outrank on the synonym's account.
    const chosen = selectRelevantFaqs(catalogue, "dammi le piste nere", GROUPS)
    const top = chosen[0]
    expect(top).toBe(skiCard)
  })
})
