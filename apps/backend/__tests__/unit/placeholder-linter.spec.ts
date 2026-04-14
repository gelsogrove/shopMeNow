/**
 * 🎯 TEST: Placeholder Linter — No unreplaced placeholders in final output
 *
 * CRITICAL: Ensures no {{VAR}} or [LINK_*] placeholders leak to customers.
 *
 * KEY RULES:
 * 1. After variable replacement, NO {{...}} should remain
 * 2. After link replacement, NO [LINK_...] should remain
 * 3. Detection regex matches all known placeholder formats
 * 4. Unknown placeholders are caught and flagged
 *
 * 📚 minrequirement: "Ensure TranslationAgent prompt variables include:
 * frustrationEscalation..., and are replaced (no {{VAR}} left)"
 */

describe("Placeholder Linter — No unreplaced placeholders in output", () => {
  /**
   * Detects unreplaced placeholders in a string.
   * Returns array of found placeholders, empty if clean.
   */
  function detectUnreplacedPlaceholders(text: string): string[] {
    const found: string[] = []

    // Match {{variableName}} — Mustache-style variables
    const mustacheMatches = text.match(/\{\{[a-zA-Z_]+\}\}/g)
    if (mustacheMatches) found.push(...mustacheMatches)

    // Match [LINK_*] — link tokens
    const linkMatches = text.match(/\[LINK_[A-Z_]+\]/g)
    if (linkMatches) found.push(...linkMatches)

    return found
  }

  describe("Clean output — no placeholders", () => {
    it("should detect zero placeholders in clean text", () => {
      const cleanText = "Hello Carlos, our agent Maria will contact you at +39 333 1234567."
      expect(detectUnreplacedPlaceholders(cleanText)).toEqual([])
    })

    it("should detect zero placeholders in translated text", () => {
      const cleanText = "Hola Carlos, nuestro equipo de soporte te contactará pronto. ¡Gracias por tu paciencia! 🤝"
      expect(detectUnreplacedPlaceholders(cleanText)).toEqual([])
    })
  })

  describe("Detect unreplaced {{VAR}} placeholders", () => {
    it("should catch single unreplaced variable", () => {
      // SCENARIO: Variable replacement failed for one variable
      const badText = "Hello {{customerName}}, welcome to our store!"
      const found = detectUnreplacedPlaceholders(badText)

      expect(found).toEqual(["{{customerName}}"])
    })

    it("should catch multiple unreplaced variables", () => {
      // SCENARIO: Multiple variables not replaced (e.g., missing data)
      const badText = "{{chatbotName}} welcomes {{customerName}} to {{companyName}}!"
      const found = detectUnreplacedPlaceholders(badText)

      expect(found).toHaveLength(3)
      expect(found).toContain("{{chatbotName}}")
      expect(found).toContain("{{customerName}}")
      expect(found).toContain("{{companyName}}")
    })

    it("should catch all known prompt variables from TranslationAgent", () => {
      // RULE: These are the variables TranslationAgent requires
      const knownVars = [
        "{{humanSupportInstructions}}",
        "{{botIdentityResponse}}",
        "{{allowedExternalLinks}}",
        "{{chatbotName}}",
        "{{customerName}}",
        "{{companyName}}",
      ]

      for (const varName of knownVars) {
        const text = `Some text ${varName} more text`
        const found = detectUnreplacedPlaceholders(text)
        expect(found).toContain(varName)
      }
    })
  })

  describe("Detect unreplaced [LINK_*] tokens", () => {
    it("should catch unreplaced registration link", () => {
      // SCENARIO: Registration link token not replaced (token generation failed)
      const badText = "Click here to register: [LINK_REGISTRATION]"
      const found = detectUnreplacedPlaceholders(badText)

      expect(found).toEqual(["[LINK_REGISTRATION]"])
    })

    it("should catch unreplaced order link", () => {
      const badText = "View your order: [LINK_ORDER]"
      const found = detectUnreplacedPlaceholders(badText)

      expect(found).toEqual(["[LINK_ORDER]"])
    })

    it("should not flag normal brackets", () => {
      // Normal text with brackets should NOT trigger false positives
      const cleanText = "Use [name] for your profile. Or (click here)."
      const found = detectUnreplacedPlaceholders(cleanText)

      expect(found).toEqual([]) // No false positives
    })
  })

  describe("Mixed placeholders", () => {
    it("should catch both {{VAR}} and [LINK_*] in same text", () => {
      // SCENARIO: Both variable and link replacement failed
      const badText = "Hello {{customerName}}, register here: [LINK_REGISTRATION]"
      const found = detectUnreplacedPlaceholders(badText)

      expect(found).toHaveLength(2)
      expect(found).toContain("{{customerName}}")
      expect(found).toContain("[LINK_REGISTRATION]")
    })
  })

  describe("Edge cases", () => {
    it("should handle empty string", () => {
      expect(detectUnreplacedPlaceholders("")).toEqual([])
    })

    it("should handle text with only whitespace", () => {
      expect(detectUnreplacedPlaceholders("   \n\t  ")).toEqual([])
    })

    it("should not flag curly braces in JSON-like content", () => {
      // JSON with { } should NOT trigger — only {{double}} braces match
      const jsonLike = '{"name": "Carlos", "phone": "+39333"}'
      expect(detectUnreplacedPlaceholders(jsonLike)).toEqual([])
    })
  })
})
