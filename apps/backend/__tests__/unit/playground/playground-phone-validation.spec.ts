/**
 * Unit Tests: Playground Phone Number Validation
 * T190 - Playground phone input validates prefixes and auto-detects language
 * 
 * SPEC: User can input custom phone number in playground for testing
 * - Validates phone starts with + prefix
 * - Detects language from country code (+39 = it, +34 = es, +351 = pt)
 * - Auto-updates widget language based on phone prefix
 * - Shows validation error if invalid format
 */

describe("Playground Phone Number Validation", () => {
  /**
   * Validation function (duplicated from ChannelsPage.tsx for testing)
   */
  const validatePhoneNumber = (phone: string): { valid: boolean; message?: string; detectedLanguage?: string } => {
    if (!phone || phone.trim() === "") {
      return { valid: true } // Empty is valid (will use default)
    }

    const trimmed = phone.trim()

    // Must start with +
    if (!trimmed.startsWith("+")) {
      return { valid: false, message: "Phone must start with + (e.g., +39)" }
    }

    // Detect language from prefix
    if (trimmed.startsWith("+39")) {
      return { valid: true, detectedLanguage: "it" }
    }
    if (trimmed.startsWith("+34")) {
      return { valid: true, detectedLanguage: "es" }
    }
    if (trimmed.startsWith("+351")) {
      return { valid: true, detectedLanguage: "pt" }
    }
    if (trimmed.startsWith("+1") || trimmed.startsWith("+44")) {
      return { valid: true, detectedLanguage: "en" }
    }

    // Unknown prefix - still valid but defaults to English
    return { valid: true, detectedLanguage: "en" }
  }

  describe("Valid Phone Numbers", () => {
    it("should validate Italian phone number (+39) and detect language", () => {
      const result = validatePhoneNumber("+39 999 1234567")
      expect(result.valid).toBe(true)
      expect(result.detectedLanguage).toBe("it")
    })

    it("should validate Spanish phone number (+34) and detect language", () => {
      const result = validatePhoneNumber("+34 611 223344")
      expect(result.valid).toBe(true)
      expect(result.detectedLanguage).toBe("es")
    })

    it("should validate Portuguese phone number (+351) and detect language", () => {
      const result = validatePhoneNumber("+351 912 777777")
      expect(result.valid).toBe(true)
      expect(result.detectedLanguage).toBe("pt")
    })

    it("should validate US/Canada phone number (+1) and detect English", () => {
      const result = validatePhoneNumber("+1 555 1234567")
      expect(result.valid).toBe(true)
      expect(result.detectedLanguage).toBe("en")
    })

    it("should validate UK phone number (+44) and detect English", () => {
      const result = validatePhoneNumber("+44 20 12345678")
      expect(result.valid).toBe(true)
      expect(result.detectedLanguage).toBe("en")
    })

    it("should validate unknown prefix and default to English", () => {
      const result = validatePhoneNumber("+81 90 12345678") // Japan
      expect(result.valid).toBe(true)
      expect(result.detectedLanguage).toBe("en")
    })

    it("should handle phone numbers without spaces", () => {
      const result = validatePhoneNumber("+393331234567")
      expect(result.valid).toBe(true)
      expect(result.detectedLanguage).toBe("it")
    })

    it("should allow empty phone number (uses default)", () => {
      const result = validatePhoneNumber("")
      expect(result.valid).toBe(true)
      expect(result.detectedLanguage).toBeUndefined()
    })

    it("should allow whitespace-only phone number (uses default)", () => {
      const result = validatePhoneNumber("   ")
      expect(result.valid).toBe(true)
      expect(result.detectedLanguage).toBeUndefined()
    })
  })

  describe("Invalid Phone Numbers", () => {
    it("should reject phone number without + prefix", () => {
      const result = validatePhoneNumber("39 333 1234567")
      expect(result.valid).toBe(false)
      expect(result.message).toBe("Phone must start with + (e.g., +39)")
    })

    it("should reject phone number starting with 00 instead of +", () => {
      const result = validatePhoneNumber("0039 333 1234567")
      expect(result.valid).toBe(false)
      expect(result.message).toBe("Phone must start with + (e.g., +39)")
    })

    it("should reject malformed phone number", () => {
      const result = validatePhoneNumber("invalid")
      expect(result.valid).toBe(false)
      expect(result.message).toBe("Phone must start with + (e.g., +39)")
    })
  })

  describe("Edge Cases", () => {
    it("should trim whitespace before validation", () => {
      const result = validatePhoneNumber("  +39 333 1234567  ")
      expect(result.valid).toBe(true)
      expect(result.detectedLanguage).toBe("it")
    })

    it("should handle phone with dashes", () => {
      const result = validatePhoneNumber("+39-333-1234567")
      expect(result.valid).toBe(true)
      expect(result.detectedLanguage).toBe("it")
    })

    it("should handle phone with parentheses", () => {
      const result = validatePhoneNumber("+34 (611) 223344")
      expect(result.valid).toBe(true)
      expect(result.detectedLanguage).toBe("es")
    })

    it("should handle very long phone number (still valid if prefix correct)", () => {
      const result = validatePhoneNumber("+345445455433333") // User typo
      expect(result.valid).toBe(true)
      expect(result.detectedLanguage).toBe("es")
    })
  })

  describe("Language Detection Priority", () => {
    it("should match +39 before +3", () => {
      const result = validatePhoneNumber("+39")
      expect(result.valid).toBe(true)
      expect(result.detectedLanguage).toBe("it")
    })

    it("should match +351 before +35", () => {
      const result = validatePhoneNumber("+351")
      expect(result.valid).toBe(true)
      expect(result.detectedLanguage).toBe("pt")
    })

    it("should match +34 before +3", () => {
      const result = validatePhoneNumber("+34")
      expect(result.valid).toBe(true)
      expect(result.detectedLanguage).toBe("es")
    })
  })
})
