/**
 * demosappada — language decisions (language-guards.ts + state.ts)
 *
 * WHAT: how the conversation language is chosen and repaired. The LLM decides
 * and commits via the ⟦LANG:xx⟧ trailer (never a regex on user intent,
 * CLAUDE.md §14); code steps in only where the model or the seed demonstrably
 * failed live: the unmistakable opening greeting, and the reply written in the
 * wrong language.
 *
 * WHY: every case here reached a real guest first. The one that motivated the
 * newest rule: "CIAO PIACERE VOGLIAMO VEDERE SAPPADA" answered entirely in
 * Spanish because the browser seed was es and no function-word marker fired
 * (Andrea, live, 2026-08-27: "ASSURDO CHE SIA IN SPAGNOLO").
 */
import {
  greetingLanguage,
  looksLikeWrongLanguage,
  stripLeadingGreeting,
} from "../../custom-demosappada/language-guards"
import {
  commitLanguageFromReply,
  extractLanguage,
  getState,
  resetState,
  resolveGreeting,
  seedLanguageIfNeeded,
} from "../../custom-demosappada/state"

describe("demosappada greetingLanguage — the opening message decides, not the browser", () => {
  it("a short greeting settles the language outright", () => {
    // The original rule: ≤3 words, a word that belongs to ONE language only.
    expect(greetingLanguage("Ciao")).toBe("it")
    expect(greetingLanguage("hola!")).toBe("es")
    expect(greetingLanguage("Bonjour")).toBe("fr")
  })

  it("🚨 regression 2026-08-27: 'CIAO PIACERE VOGLIAMO VEDERE SAPPADA' is Italian", () => {
    // Five words, so the short-message rule never saw the "ciao"; none of the
    // other words was in the Italian function-word list, the marker scores
    // tied 0-0, and the Spanish browser seed won — the whole welcome went out
    // in Spanish. Now: a clear function-word winner still rules, but on a tie
    // an unmistakable greeting OPENING the message decides.
    expect(greetingLanguage("CIAO PIACERE VOGLIAMO VEDERE SAPPADA")).toBe("it")
  })

  it("a greeting must not override a clear function-word winner in another language", () => {
    // "Hallo" opening an English sentence: the guest is writing English and
    // borrowed a greeting. The markers win, the greeting is the fallback.
    expect(greetingLanguage("Hallo, can you tell me where we can eat today")).toBe("en")
  })

  it("first-person-plural forms count as Italian/Spanish markers now", () => {
    // "vogliamo vedere sappada" without a greeting used to score 0 — the same
    // silence that let the seed win.
    expect(greetingLanguage("vogliamo vedere sappada con i bambini")).toBe("it")
    expect(greetingLanguage("queremos ver sappada con los niños")).toBe("es")
  })

  it("returns null when the message truly carries no language signal", () => {
    // "ok" and a bare emoji belong to no language: the seed may stand.
    expect(greetingLanguage("ok")).toBeNull()
    expect(greetingLanguage("👍")).toBeNull()
  })
})

describe("demosappada ⟦LANG⟧ trailer — the model's declaration, parsed by code", () => {
  afterEach(() => resetState("lang-spec"))

  it("extracts the trailer and strips every occurrence from the reply", () => {
    const { reply, lang } = extractLanguage("Benvenuti a Sappada!\n⟦LANG:it⟧")
    expect(lang).toBe("it")
    expect(reply).toBe("Benvenuti a Sappada!")
  })

  it("commits only valid ISO codes — garbage never becomes the session language", () => {
    commitLanguageFromReply("lang-spec", "xx")
    expect(getState("lang-spec").language).toBeUndefined()
    commitLanguageFromReply("lang-spec", "de")
    expect(getState("lang-spec").language).toBe("de")
  })

  it("seeds from the host only within enabledLanguages, falling back to the default", () => {
    // steps.md Step 1.4: a browser language the workspace does not serve must
    // not become the conversation language.
    expect(seedLanguageIfNeeded("lang-spec", "da", ["it", "en", "de"], "it")).toBe("it")
    resetState("lang-spec")
    expect(seedLanguageIfNeeded("lang-spec", "de", ["it", "en", "de"], "it")).toBe("de")
  })
})

describe("demosappada looksLikeWrongLanguage — reply repair, conservative by design", () => {
  it("flags an Italian reply declared as Spanish", () => {
    const italian =
      "Oggi il tempo è bello e per la giornata vi consiglio una passeggiata: il sentiero parte " +
      "dal centro e arriva alle cascatelle, che sono adatte anche per i bambini."
    expect(looksLikeWrongLanguage(italian, "es")).toBe(true)
  })

  it("leaves a short or ambiguous reply alone — a wrong repair is worse than none", () => {
    expect(looksLikeWrongLanguage("Va bene!", "es")).toBe(false)
  })
})

describe("demosappada stripLeadingGreeting — the model's greeting goes, the answer stays", () => {
  it("drops an improvised multi-paragraph self-introduction", () => {
    // The configured welcome is prepended by CODE; whatever greeting the model
    // wrote on top of it must go, or the guest reads two welcomes in a row.
    const reply =
      "Ciao! Sono l'assistente della Pro Loco di Sappada.\n\n" +
      "Sono qui per aiutarti a scoprire il meglio della zona.\n\n" +
      "Le Cascatelle sono una passeggiata facile adatta ai bambini."
    expect(stripLeadingGreeting(reply)).toBe(
      "Le Cascatelle sono una passeggiata facile adatta ai bambini.",
    )
  })

  it("never cuts a paragraph carrying facts — numbers, hours, lists are the answer", () => {
    const reply = "Buongiorno! Il museo apre alle 10 e chiude alle 18."
    expect(stripLeadingGreeting(reply)).toBe(reply)
  })
})

describe("demosappada resolveGreeting — new vs returning is about having CONVERSED", () => {
  const nowMs = Date.parse("2026-08-27T10:00:00Z")
  const staleMs = 2 * 60 * 60 * 1000

  it("empty history means a brand-new conversation — even when the name is known", () => {
    // The widget guest typed their name into the form seconds before the first
    // message; keying on the name made them 'returning' and skipped the whole
    // welcome + presentation video (Andrea, 2026-08-23: "al welcome non lo vedo").
    expect(
      resolveGreeting({ historyLength: 0, hasKnownName: true, nowMs, staleMs }),
    ).toBe("new")
  })

  it("a last message older than the staleness threshold earns the welcome-back", () => {
    expect(
      resolveGreeting({
        historyLength: 5,
        lastMessageAtMs: nowMs - staleMs - 1000,
        hasKnownName: true,
        nowMs,
        staleMs,
      }),
    ).toBe("returning")
  })

  it("mid-conversation gets no greeting at all", () => {
    expect(
      resolveGreeting({
        historyLength: 5,
        lastMessageAtMs: nowMs - 60_000,
        hasKnownName: false,
        nowMs,
        staleMs,
      }),
    ).toBe("none")
  })
})
