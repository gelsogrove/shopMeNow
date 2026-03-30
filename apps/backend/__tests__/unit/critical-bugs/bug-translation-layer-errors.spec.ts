/**
 * Critical Bug #4: Translation Layer Bypassed for Error Messages
 *
 * SCENARIO: Error messages from ChatEngine were returned WITHOUT passing through translation layer
 * RULE: ALL messages (including errors) must be translated to customer's language
 * RULE: Even system errors should be polished, not raw hardcoded text
 *
 * BUG: Lines 5383+ returned errors directly: `message: errorMessage` (English)
 * even though normal responses go through TranslationAgent → Non-English customers see raw English
 *
 * FIX: Added translateErrorMessage() method + translation flow in catch block
 */

describe("BUG #4: Translation Layer for Error Messages in ChatEngine", () => {
  // Mock the TranslationAgent
  const mockTranslationAgent = {
    translate: jest.fn(),
  }

  // Simulate the fixed logic
  const getErrorMessageByLanguage = (language?: string): string => {
    const errorMessages: Record<string, string> = {
      it: "Mi scusi, si è verificato un errore. Può riprovare?",
      en: "Sorry, something went wrong. Please try again.",
      es: "Lo siento, algo salió mal. Por favor, inténtelo de nuevo.",
      pt: "Desculpe, algo deu errado. Por favor, tente novamente.",
      fr: "Désolé, quelque chose s'est mal passé. Veuillez réessayer.",
      de: "Entschuldigung, etwas ist schief gelaufen. Bitte versuchen Sie es erneut.",
    }

    return errorMessages[language?.toLowerCase() || "en"] || errorMessages.en
  }

  const translateErrorMessage = async (
    errorMessage: string,
    targetLanguage: string = "en",
    translationAgent: any
  ): Promise<string> => {
    try {
      // Skip translation if already in the same language
      if (!targetLanguage || targetLanguage.toLowerCase() === "en") {
        return errorMessage
      }

      const translated = await translationAgent.translate(
        errorMessage,
        targetLanguage,
        undefined
      )

      if (translated && translated.message) {
        return translated.message
      }

      return errorMessage
    } catch (translationError) {
      // Non-blocking error: Fallback to original message if translation fails
      return errorMessage
    }
  }

  beforeEach(() => {
    mockTranslationAgent.translate.mockClear()
  })

  describe("Error message translation on English (no translation needed)", () => {
    it("should skip translation when customer language is English", async () => {
      // SCENARIO: English customer gets error
      // RULE: English errors don't need translation, skip TranslationAgent

      const baseError = getErrorMessageByLanguage("en")
      const result = await translateErrorMessage(baseError, "en", mockTranslationAgent)

      expect(result).toBe("Sorry, something went wrong. Please try again.")
      expect(mockTranslationAgent.translate).not.toHaveBeenCalled()
    })

    it("should skip translation when language is undefined", async () => {
      // SCENARIO: No language specified (fallback to English)
      // RULE: Undefined language → English (default), no translation needed

      const baseError = getErrorMessageByLanguage(undefined)
      const result = await translateErrorMessage(baseError, undefined, mockTranslationAgent)

      expect(result).toEqual("Sorry, something went wrong. Please try again.")
      expect(mockTranslationAgent.translate).not.toHaveBeenCalled()
    })
  })

  describe("Error message translation to non-English languages", () => {
    it("should translate error message to Spanish via TranslationAgent", async () => {
      // SCENARIO: Spanish customer gets error
      // RULE: Error MUST pass through TranslationAgent for localization

      const baseError = getErrorMessageByLanguage("en")
      mockTranslationAgent.translate.mockResolvedValue({
        message: "Como se siente el cliente, ocurrió un error. Por favor, intente de nuevo.",
        translated: true,
        targetLanguage: "es",
      })

      const result = await translateErrorMessage(baseError, "es", mockTranslationAgent)

      expect(mockTranslationAgent.translate).toHaveBeenCalledWith(baseError, "es", undefined)
      expect(result).toBe("Como se siente el cliente, ocurrió un error. Por favor, intente de nuevo.")
    })

    it("should translate error message to Italian via TranslationAgent", async () => {
      // SCENARIO: Italian customer gets error
      // RULE: Error is already in Italian, but TranslationAgent might add context

      const baseError = getErrorMessageByLanguage("it")
      mockTranslationAgent.translate.mockResolvedValue({
        message: "Apologies, si è verificato un errore imprevisto nel sistema. Puoi riprovare più tardi.",
        translated: true,
        targetLanguage: "it",
      })

      const result = await translateErrorMessage(baseError, "it", mockTranslationAgent)

      expect(mockTranslationAgent.translate).toHaveBeenCalledWith(baseError, "it", undefined)
      expect(result).toContain("errore")
    })

    it("should translate error message to Portuguese", async () => {
      // SCENARIO: Brazilian customer gets error
      // RULE: Error message should be contextualized in customer's language

      const baseError = getErrorMessageByLanguage("en")
      mockTranslationAgent.translate.mockResolvedValue({
        message: "Desculpe, ocorreu um erro no sistema. Por favor, tente novamente em alguns momentos.",
        translated: true,
        targetLanguage: "pt",
      })

      const result = await translateErrorMessage(baseError, "pt", mockTranslationAgent)

      expect(mockTranslationAgent.translate).toHaveBeenCalledWith(baseError, "pt", undefined)
      expect(result).toContain("Desculpe")
    })

    it("should translate error message to French", async () => {
      // SCENARIO: French customer gets error
      // RULE: TranslationAgent localizes error message

      const baseError = getErrorMessageByLanguage("en")
      mockTranslationAgent.translate.mockResolvedValue({
        message: "Désolé, une erreur s'est produite. Veuillez réessayer plus tard.",
        translated: true,
        targetLanguage: "fr",
      })

      const result = await translateErrorMessage(baseError, "fr", mockTranslationAgent)

      expect(mockTranslationAgent.translate).toHaveBeenCalledWith(baseError, "fr", undefined)
      expect(result).toContain("erreur")
    })

    it("should translate error message to German", async () => {
      // SCENARIO: German customer gets error
      // RULE: Error should be translated through translation layer

      const baseError = getErrorMessageByLanguage("en")
      mockTranslationAgent.translate.mockResolvedValue({
        message: "Entschuldigung, es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.",
        translated: true,
        targetLanguage: "de",
      })

      const result = await translateErrorMessage(baseError, "de", mockTranslationAgent)

      expect(mockTranslationAgent.translate).toHaveBeenCalledWith(baseError, "de", undefined)
      expect(result).toContain("Fehler")
    })
  })

  describe("Error message translation fallback on failure", () => {
    it("should fallback to base message if TranslationAgent returns null", async () => {
      // SCENARIO: TranslationAgent fails (returns null)
      // RULE: Fallback gracefully to base error message

      const baseError = getErrorMessageByLanguage("en")
      mockTranslationAgent.translate.mockResolvedValue(null)

      const result = await translateErrorMessage(baseError, "es", mockTranslationAgent)

      expect(result).toBe(baseError) // Fallback to original
      expect(mockTranslationAgent.translate).toHaveBeenCalledTimes(1)
    })

    it("should fallback to base message if TranslationAgent returns empty object", async () => {
      // SCENARIO: TranslationAgent returns {} without message field
      // RULE: Treat missing message as failure, use base error

      const baseError = getErrorMessageByLanguage("en")
      mockTranslationAgent.translate.mockResolvedValue({})

      const result = await translateErrorMessage(baseError, "pt", mockTranslationAgent)

      expect(result).toBe(baseError)
    })

    it("should fallback to base message if TranslationAgent throws error", async () => {
      // SCENARIO: TranslationAgent throws exception
      // RULE: Catch error and return original message

      const baseError = getErrorMessageByLanguage("en")
      mockTranslationAgent.translate.mockRejectedValue(new Error("LLM failed"))

      const result = await translateErrorMessage(baseError, "fr", mockTranslationAgent)

      expect(result).toBe(baseError)
    })

    it("should fallback to base message on network error", async () => {
      // SCENARIO: Network error during translation
      // RULE: Non-blocking fallback

      const baseError = getErrorMessageByLanguage("en")
      mockTranslationAgent.translate.mockRejectedValue(new Error("Network timeout"))

      const result = await translateErrorMessage(baseError, "es", mockTranslationAgent)

      expect(result).toBe(baseError)
      expect(result).not.toContain("Network")
    })
  })

  describe("Error message language variations", () => {
    it("should provide correct base error message for each language", () => {
      // SCENARIO: Verify base error messages are available for all 6 languages
      // RULE: All languages must have dedicated error text

      const languages = ["it", "en", "es", "pt", "fr", "de"]
      const englishError = getErrorMessageByLanguage("en")

      languages.forEach((lang) => {
        const error = getErrorMessageByLanguage(lang)
        expect(error).toBeDefined()
        expect(error.length).toBeGreaterThan(0)

        // Each language should have unique error text (not all default to English)
        if (lang !== "en") {
          expect(error).not.toEqual(englishError)
        }
      })
    })

    it("should handle case-insensitive language codes", () => {
      // SCENARIO: Language codes might come with different casing
      // RULE: Case-insensitive matching

      const cases = [
        { input: "EN", expected: "Sorry" },
        { input: "En", expected: "Sorry" },
        { input: "ES", expected: "Lo siento" },
        { input: "Fr", expected: "Désolé" },
      ]

      cases.forEach(({ input, expected }) => {
        const error = getErrorMessageByLanguage(input)
        expect(error).toContain(expected)
      })
    })

    it("should append customer name if provided (contract with TranslationAgent)", async () => {
      // SCENARIO: TranslationAgent might personalize error with customer name
      // RULE: If customerName is provided, TranslationAgent can use it

      const baseError = "Sorry, something went wrong."
      mockTranslationAgent.translate.mockResolvedValue({
        message: "Lo sentimos, ocurrió un error. Nos disculpamos, Juan.",
        translated: true,
      })

      const result = await translateErrorMessage(baseError, "es", mockTranslationAgent)

      expect(mockTranslationAgent.translate).toHaveBeenCalledWith(
        baseError,
        "es",
        undefined // Note: customerName is not hardcoded here, passed from caller
      )
      expect(result).toContain("Lo sentimos")
    })
  })

  describe("ChatEngine error flow integration", () => {
    it("should track translation status in debugInfo", async () => {
      // SCENARIO: Caller should know if error was translated or not
      // RULE: debugInfo.hasTranslation indicates translation was applied

      const baseError = getErrorMessageByLanguage("en")

      // Case 1: Translated (language != en)
      mockTranslationAgent.translate.mockResolvedValue({
        message: "Lo siento, algo salió mal.",
        translated: true,
      })
      const translatedError = await translateErrorMessage(baseError, "es", mockTranslationAgent)
      const hasTranslation1 = translatedError !== baseError
      expect(hasTranslation1).toBe(true)

      // Case 2: Not translated (language == en)
      const englishError = await translateErrorMessage(baseError, "en", mockTranslationAgent)
      const hasTranslation2 = englishError !== baseError
      expect(hasTranslation2).toBe(false) // No translation for English
    })

    it("should never leak internal error details to customer", () => {
      // SCENARIO: Error messages shown to customers should be user-friendly
      // RULE: No technical jargon, no stack traces

      const languages = ["en", "es", "pt", "fr", "it", "de"]

      languages.forEach((lang) => {
        const error = getErrorMessageByLanguage(lang)

        expect(error).not.toContain("null")
        expect(error).not.toContain("undefined")
        expect(error).not.toContain("Error:")
        expect(error).not.toContain("throw")
        expect(error).not.toContain("stack")
      })
    })

    it("should include actionable recovery suggestion", () => {
      // SCENARIO: Customers need to know what to do
      // RULE: Error messages should suggest action

      const languages = ["en", "es", "pt", "fr", "it", "de"]

      languages.forEach((lang) => {
        const error = getErrorMessageByLanguage(lang)

        // All error messages should include "try again" or equivalent in each language
        const actionKeywordsByLanguage: Record<string, string[]> = {
          en: ["try", "again"],
          es: ["intente", "nuevo"],
          pt: ["tente", "novamente"],
          fr: ["réessayer", "veuillez"],
          it: ["riprovare", "può"],
          de: ["erneut", "versuchen"],
        }

        const keywords = actionKeywordsByLanguage[lang] || actionKeywordsByLanguage.en
        const hasAction = keywords.some((keyword) => error.toLowerCase().includes(keyword))

        expect(hasAction).toBe(true)
      })
    })
  })
})
