/**
 * demosappada — the media rule (faq-media.ts)
 *
 * WHAT: contratto.md, verbatim: "le liste non hanno mai video link o foto" and
 * "quando parliamo di un singolo caso mostra il video se ce l'hai". At most
 * ONE link is ever appended, to the ONE place the reply is about, and only
 * when the reply actually names it.
 *
 * WHY: every threshold in withFaqMedia was tuned against a live failure — the
 * waterfall video under a list of playgrounds, the Gnomi video under three
 * restaurants, the video suppressed on the very turn the guest asked for the
 * waterfall. The scoring is topic overlap on OUR output (IDF-weighted words),
 * never phrasing or intent (CLAUDE.md §14) — so these fixtures exercise the
 * measurement, not keywords.
 */
import { replyIsDetailAnswer, withFaqMedia } from "../../custom-demosappada/faq-media"

// A small tenant-like FAQ set: distinctive names, one entry with a video.
const FAQS = [
  {
    question: "Cosa sono le Cascatelle di Sappada?",
    answer:
      "Le Cascatelle sono cascate raggiungibili con una passeggiata facile dal ponte di legno, " +
      "adatta ai bambini. Video: https://youtube.com/watch?v=cascatelle",
  },
  {
    question: "Cosa è il Villaggio degli Gnomi?",
    answer:
      "Il Villaggio degli Gnomi è un percorso nel bosco pensato per i bambini, con casette " +
      "scolpite nel legno. Foto: https://example.com/gnomi.jpg",
  },
  {
    question: "Dove si trova il Piccolo Museo della Grande Guerra?",
    answer: "Il Piccolo Museo della Grande Guerra raccoglie reperti del fronte alpino.",
  },
  {
    question: "Quali ristoranti ci sono a Sappada?",
    answer: "Keisn Osteria e La Rustica, entrambi in centro. Tel. 0435 469265.",
  },
]

describe("demosappada withFaqMedia — one place, one link, never on a list", () => {
  it("a detail answer about ONE place gets that place's video appended", () => {
    // "me lo devi dare subito, non se lo chiedo" (Andrea, 2026-08-23): the
    // guest asked for the waterfall, the reply is about the waterfall, the
    // video belongs in the same message.
    const reply =
      "Le **Cascatelle** sono una passeggiata facile che parte dal ponte di legno: si arriva " +
      "alle cascate in mezz'ora, ed è adatta anche ai bambini."
    const out = withFaqMedia(reply, FAQS, "cosa sono le cascatelle?", [])
    expect(out).toContain("https://youtube.com/watch?v=cascatelle")
    // Exactly one link — never a gallery.
    expect(out.match(/https?:\/\//g)).toHaveLength(1)
  })

  it("a LIST naming several places gets no media at all — even when only one has a video", () => {
    // The waterfall video was attached to a playground list precisely because
    // it was the only video in the set and won by having no rival (Andrea,
    // 2026-08-23). A list is a list: text only.
    const reply =
      "Con i bambini avete diverse opzioni:\n\n" +
      "**Villaggio degli Gnomi**\nPercorso nel bosco con casette scolpite nel legno.\n\n" +
      "**Cascatelle**\nPasseggiata facile alle cascate dal ponte di legno.\n\n" +
      "**Piccolo Museo della Grande Guerra**\nReperti del fronte alpino per un pomeriggio di pioggia."
    const out = withFaqMedia(reply, FAQS, "cosa facciamo con i bambini?", [])
    expect(out).not.toContain("http")
  })

  it("the winning entry must be NAMED in the reply — topic overlap alone is not enough", () => {
    // The Gnomi video landed under three restaurants: it won on shared words
    // ("bambini", "Sappada") without being mentioned once (Andrea, 2026-08-25:
    // "villaggio gnomi qui non ha senso").
    const reply = "Per cena vi consiglio la Keisn Osteria, in centro, adatta ai bambini."
    const out = withFaqMedia(reply, FAQS, "dove mangiamo con i bambini?", [])
    expect(out).not.toContain("gnomi.jpg")
  })

  it("the excluded list keeps the presentation video from coming back as content", () => {
    const reply =
      "Le **Cascatelle** sono una passeggiata facile che parte dal ponte di legno, adatta ai bambini."
    const out = withFaqMedia(reply, FAQS, "le cascatelle", [
      "https://youtube.com/watch?v=cascatelle",
    ])
    expect(out).toBe(reply)
  })
})

describe("demosappada replyIsDetailAnswer — mid-intake, a picked place earns its detail", () => {
  it("recognises the guest picking ONE offered place", () => {
    // "se ti dico cascatelle è il punto che devi espandere" (2026-08-25): the
    // reply about it IS the answer, and must not be bulldozed by the intake.
    const reply =
      "Le **Cascatelle** sono cascate raggiungibili con una passeggiata facile dal ponte di " +
      "legno, adatta ai bambini: si arriva in mezz'ora."
    expect(replyIsDetailAnswer(reply, "si le cascatelle", FAQS)).toBe(true)
  })

  it("a reply the guest's message never pointed at is not a detail answer", () => {
    // Reply-only scoring fired on the model's own tangents; the guest has to
    // have named the place.
    const reply =
      "Le **Cascatelle** sono cascate raggiungibili con una passeggiata facile dal ponte di legno."
    expect(replyIsDetailAnswer(reply, "fino a domenica", FAQS)).toBe(false)
  })
})
