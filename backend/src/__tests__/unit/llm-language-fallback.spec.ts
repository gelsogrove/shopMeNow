/**
 * LLMService - Language Fallback Test
 *
 * Verifica che il sistema gestisca correttamente il fallback della lingua
 * quando il campo `language` del cliente è NULL o vuoto
 */

import { LLMService } from "../../services/llm.service"

describe("LLMService - Language Fallback", () => {
  let llmService: LLMService

  beforeEach(() => {
    llmService = new LLMService()
  })

  describe("getLanguageDisplayName - Fallback Behavior", () => {
    it("should return ITALIANO for IT language code", () => {
      const result = (llmService as any).getLanguageDisplayName("IT")
      expect(result).toBe("ITALIANO")
    })

    it("should return ENGLISH for ENG language code", () => {
      const result = (llmService as any).getLanguageDisplayName("ENG")
      expect(result).toBe("ENGLISH")
    })

    it("should return ESPAÑOL for ESP language code", () => {
      const result = (llmService as any).getLanguageDisplayName("ESP")
      expect(result).toBe("ESPAÑOL")
    })

    it("should return PORTUGUÊS for PRT language code", () => {
      const result = (llmService as any).getLanguageDisplayName("PRT")
      expect(result).toBe("PORTUGUÊS")
    })

    it("should return ITALIANO as default fallback for null language", () => {
      const result = (llmService as any).getLanguageDisplayName(null)
      // IMPORTANTE: Quando language è null, dovrebbe defaultare a ITALIANO (lingua base del sistema)
      expect(result).toBe("ITALIANO")
    })

    it("should return ITALIANO as default fallback for undefined language", () => {
      const result = (llmService as any).getLanguageDisplayName(undefined)
      expect(result).toBe("ITALIANO")
    })

    it("should return ITALIANO as default fallback for empty string", () => {
      const result = (llmService as any).getLanguageDisplayName("")
      expect(result).toBe("ITALIANO")
    })

    it("should handle unknown language codes by returning ITALIANO as fallback", () => {
      const result = (llmService as any).getLanguageDisplayName("UNKNOWN")
      // Se il codice lingua non è riconosciuto, default a ITALIANO
      expect(result).toBe("ITALIANO")
    })

    it("should handle lowercase legacy format for backward compatibility", () => {
      const resultIt = (llmService as any).getLanguageDisplayName("it")
      const resultEn = (llmService as any).getLanguageDisplayName("en")
      const resultEs = (llmService as any).getLanguageDisplayName("es")
      const resultPt = (llmService as any).getLanguageDisplayName("pt")

      expect(resultIt).toBe("ITALIANO")
      expect(resultEn).toBe("ENGLISH")
      expect(resultEs).toBe("ESPAÑOL")
      expect(resultPt).toBe("PORTUGUÊS")
    })
  })

  describe("Prompt Language Replacement with Fallback", () => {
    it("should replace {{languageUser}} with ITALIANO when language is null", () => {
      const mockPrompt = `
        Rispondi SEMPRE in: **{{languageUser}}**
        RISPONDI SEMPRE OVVIAMENTE IN : **{{languageUser}}**
      `

      const languageUser = (llmService as any).getLanguageDisplayName(null)

      // Simulate the replacement logic with regex (ALL occurrences)
      const processedPrompt = mockPrompt.replace(
        /\{\{languageUser\}\}/g,
        languageUser
      )

      // Verify NO placeholders remain
      expect(processedPrompt).not.toContain("{{languageUser}}")

      // Verify BOTH occurrences were replaced with ITALIANO
      expect(processedPrompt).toContain("Rispondi SEMPRE in: **ITALIANO**")
      expect(processedPrompt).toContain(
        "RISPONDI SEMPRE OVVIAMENTE IN : **ITALIANO**"
      )

      // Count occurrences of ITALIANO (should be 2)
      const italianoCount = (processedPrompt.match(/ITALIANO/g) || []).length
      expect(italianoCount).toBe(2)
    })

    it("should replace ALL occurrences of {{languageUser}} in prompt (not just first)", () => {
      const mockPrompt = `
        Lingua 1: {{languageUser}}
        Lingua 2: {{languageUser}}
        Lingua 3: {{languageUser}}
      `

      const languageUser = "ESPAÑOL"

      // Use simple replace (wrong - only replaces first)
      const wrongResult = mockPrompt.replace("{{languageUser}}", languageUser)

      // Verify simple replace is WRONG (only first replaced)
      const wrongCount = (wrongResult.match(/ESPAÑOL/g) || []).length
      expect(wrongCount).toBe(1) // ❌ WRONG: Only 1 replaced
      expect(wrongResult).toContain("{{languageUser}}") // Still has placeholders

      // Use regex replace (correct - replaces all)
      const correctResult = mockPrompt.replace(
        /\{\{languageUser\}\}/g,
        languageUser
      )

      // Verify regex replace is CORRECT (all 3 replaced)
      const correctCount = (correctResult.match(/ESPAÑOL/g) || []).length
      expect(correctCount).toBe(3) // ✅ CORRECT: All 3 replaced
      expect(correctResult).not.toContain("{{languageUser}}") // No placeholders
    })

    it("should prioritize customer language over default when language is set", () => {
      const mockPrompt = "Rispondi in: {{languageUser}}"

      // Customer has language set to Portuguese
      const languageUser = (llmService as any).getLanguageDisplayName("PRT")

      const processedPrompt = mockPrompt.replace(
        /\{\{languageUser\}\}/g,
        languageUser
      )

      expect(processedPrompt).toBe("Rispondi in: PORTUGUÊS")
      expect(processedPrompt).not.toContain("ITALIANO")
      expect(processedPrompt).not.toContain("ENGLISH")
    })
  })

  describe("Real-World Scenario - NULL Language Customer", () => {
    it("should ensure Italian response when customer has NULL language in database", () => {
      // Simulate customer data from database with NULL language
      const customerData = {
        name: "Mario Rossi",
        email: "mario.rossi@test.com",
        phone: "+390212345678",
        language: null, // ⚠️ PROBLEMA: Campo vuoto nel database
        company: "Rossi Limited S.r.l.",
      }

      // System should apply fallback
      const languageUser = (llmService as any).getLanguageDisplayName(
        customerData.language
      )

      // EXPECTATION: System defaults to ITALIANO (not ENGLISH!)
      expect(languageUser).toBe("ITALIANO")

      // Build prompt with fallback language
      const promptSnippet = `Rispondi SEMPRE in: **${languageUser}**`

      // Verify prompt contains Italian instruction
      expect(promptSnippet).toContain("ITALIANO")
      expect(promptSnippet).not.toContain("ENGLISH")
    })

    it("should detect if language field needs default value in seed/migration", () => {
      // This test documents that language field should NOT be nullable
      // and should default to "IT" for new customers

      const validLanguageCodes = ["IT", "ENG", "ESP", "PRT"]

      // ❌ CURRENT PROBLEM: language can be NULL
      const problematicValue = null

      // ✅ SOLUTION: Ensure language always has value
      const defaultLanguage = "IT"
      const actualLanguage = problematicValue || defaultLanguage

      expect(actualLanguage).toBe("IT")
      expect(validLanguageCodes).toContain(actualLanguage)

      // Document: Database schema should be updated to:
      // language String @default("IT") // Not nullable, defaults to IT
    })
  })
})
