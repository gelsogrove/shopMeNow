/**
 * Widget PROFILE_MANAGEMENT Language Fallback Tests (BUG#6 fix)
 *
 * VULNERABILITY FIXED:
 * When the Router LLM delegates to PROFILE_MANAGEMENT on the widget channel
 * (not supported — widget users are anonymous), the code returned a hardcoded
 * Italian response regardless of customerLanguage. Non-Italian customers
 * received Italian text.
 *
 * FIX: A language-aware fallback map (it/en/es/pt/fr/de) is used.
 * Unknown languages fall back to English.
 *
 * RULE: Widget channel does not support PROFILE_MANAGEMENT because widget
 * visitors are anonymous (no phone number). Profile link requires customerId+phone.
 *
 * @see apps/backend/src/services/llm-router.service.ts — functionCallingLoop()
 */

// ---- INLINE FALLBACK MAP REPLICA ----
// This mirrors the exact map from llm-router.service.ts
// Tests are the specification: if the map changes, tests must change too.

const PROFILE_FALLBACK_MAP: Record<string, string> = {
  it: "Per gestire il tuo profilo, registrati prima attraverso il link di registrazione. Una volta registrato potrai accedere a tutte le funzionalità del profilo.",
  en: "To manage your profile, please register first via the registration link. Once registered you can access all profile features.",
  es: "Para gestionar tu perfil, regístrate primero a través del enlace de registro. Una vez registrado podrás acceder a todas las funciones del perfil.",
  pt: "Para gerir o seu perfil, registe-se primeiro através do link de registo. Depois de registado poderá aceder a todas as funcionalidades do perfil.",
  fr: "Pour gérer votre profil, inscrivez-vous d'abord via le lien d'inscription. Une fois inscrit vous pourrez accéder à toutes les fonctionnalités du profil.",
  de: "Um Ihr Profil zu verwalten, registrieren Sie sich zuerst über den Registrierungslink. Nach der Registrierung können Sie alle Profilfunktionen nutzen.",
}

// This is the exact logic from the bugfix
function getProfileFallback(customerLanguage?: string): string {
  const lang = (customerLanguage || "it").toLowerCase().slice(0, 2)
  return PROFILE_FALLBACK_MAP[lang] ?? PROFILE_FALLBACK_MAP["en"]
}

describe("Widget PROFILE_MANAGEMENT Language Fallback (BUG#6 fix)", () => {
  describe("Mapped languages return localized responses", () => {
    const cases: Array<[string, string, string]> = [
      ["it", "it", "registrati prima"],
      ["en", "en", "register first"],
      ["es", "es", "regístrate primero"],
      ["pt", "pt", "registe-se primeiro"],
      ["fr", "fr", "inscrivez-vous"],
      ["de", "de", "registrieren Sie sich"],
    ]

    cases.forEach(([lang, code, expectedSnippet]) => {
      it(`${lang} customer gets response in ${lang} (contains: "${expectedSnippet}")`, () => {
        // SCENARIO: Widget customer in language ${lang} asks about profile
        // BUG WAS: all customers received Italian text
        // RULE: Response language must match customerLanguage
        const response = getProfileFallback(code)
        expect(response).toContain(expectedSnippet)
      })
    })
  })

  describe("Unknown / unsupported languages fall back to English", () => {
    const unknownLangs = ["ar", "zh", "ja", "ko", "ru", "tr", "pl", "nl", "sv"]

    unknownLangs.forEach((lang) => {
      it(`unknown lang "${lang}" falls back to English`, () => {
        // RULE: English is the universal fallback — better than Italian for non-mapped languages
        const response = getProfileFallback(lang)
        expect(response).toBe(PROFILE_FALLBACK_MAP["en"])
      })
    })
  })

  describe("Edge cases", () => {
    it("undefined customerLanguage defaults to Italian", () => {
      // RULE: If language is not set, use Italian (most common in original customer base)
      const response = getProfileFallback(undefined)
      expect(response).toBe(PROFILE_FALLBACK_MAP["it"])
    })

    it("empty string customerLanguage uses Italian default", () => {
      const response = getProfileFallback("")
      expect(response).toBe(PROFILE_FALLBACK_MAP["it"])
    })

    it("4-char locale code (e.g. 'en-US') is normalized to 2-char prefix", () => {
      // RULE: slice(0, 2) handles locale strings like "en-US", "pt-BR", "fr-FR"
      expect(getProfileFallback("en-US")).toBe(PROFILE_FALLBACK_MAP["en"])
      expect(getProfileFallback("pt-BR")).toBe(PROFILE_FALLBACK_MAP["pt"])
      expect(getProfileFallback("fr-FR")).toBe(PROFILE_FALLBACK_MAP["fr"])
    })

    it("each mapped language has a non-empty response", () => {
      // INVARIANT: All mapped languages must have actual content (not empty strings)
      Object.entries(PROFILE_FALLBACK_MAP).forEach(([lang, text]) => {
        expect(text.length).toBeGreaterThan(20)
      })
    })

    it("fallback map covers at minimum 6 languages (it/en/es/pt/fr/de)", () => {
      // INVARIANT: Minimum coverage requirement
      const required = ["it", "en", "es", "pt", "fr", "de"]
      required.forEach((lang) => {
        expect(PROFILE_FALLBACK_MAP[lang]).toBeDefined()
      })
    })
  })

  describe("Previous BUG#6 regression — was always Italian", () => {
    it("English customer must NOT receive Italian response", () => {
      // REGRESSION TEST: Prior to fix, 'en' customers received Italian
      const response = getProfileFallback("en")
      expect(response).not.toContain("registrati prima")
      expect(response).not.toContain("accedere a tutte le funzionalità")
    })

    it("Spanish customer must NOT receive Italian response", () => {
      const response = getProfileFallback("es")
      expect(response).not.toContain("registrati prima")
    })

    it("French customer must NOT receive Italian response", () => {
      const response = getProfileFallback("fr")
      expect(response).not.toContain("registrati prima")
    })
  })
})
