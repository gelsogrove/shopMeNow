/**
 * Unit Tests: Language Detector
 * T019 - detectLanguageFromPhonePrefix returns correct language for phone prefixes
 */

import { detectLanguageFromPhonePrefix } from "../../../src/utils/language-detector"

describe("Language Detector - detectLanguageFromPhonePrefix()", () => {
  describe("Italian prefix (+39)", () => {
    it("should detect Italian for +39 prefix", () => {
      expect(detectLanguageFromPhonePrefix("+39 333 1234567")).toBe("it")
      expect(detectLanguageFromPhonePrefix("+390212345678")).toBe("it")
      expect(detectLanguageFromPhonePrefix("+39 02 12345678")).toBe("it")
    })
  })

  describe("Spanish prefix (+34)", () => {
    it("should detect Spanish for +34 prefix", () => {
      expect(detectLanguageFromPhonePrefix("+34 611 223344")).toBe("es")
      expect(detectLanguageFromPhonePrefix("+34611223344")).toBe("es")
      expect(detectLanguageFromPhonePrefix("+34 91 1234567")).toBe("es")
    })

    it("should detect Spanish even with extra digits (malformed number)", () => {
      expect(detectLanguageFromPhonePrefix("+345445455433333")).toBe("es") // User wrote +345 instead of +34
    })
  })

  describe("Portuguese prefix (+351)", () => {
    it("should detect Portuguese for +351 prefix", () => {
      expect(detectLanguageFromPhonePrefix("+351 912 777777")).toBe("pt")
      expect(detectLanguageFromPhonePrefix("+351912777777")).toBe("pt")
      expect(detectLanguageFromPhonePrefix("+351 21 1234567")).toBe("pt")
    })
  })

  describe("English prefix (+1)", () => {
    it("should detect English for +1 prefix (USA/Canada)", () => {
      expect(detectLanguageFromPhonePrefix("+1 555 1234567")).toBe("en")
      expect(detectLanguageFromPhonePrefix("+15551234567")).toBe("en")
      expect(detectLanguageFromPhonePrefix("+1 212 5551234")).toBe("en")
    })
  })

  describe("English prefix (+44)", () => {
    it("should detect English for +44 prefix (UK)", () => {
      expect(detectLanguageFromPhonePrefix("+44 20 12345678")).toBe("en")
      expect(detectLanguageFromPhonePrefix("+442012345678")).toBe("en")
    })
  })

  describe("Default fallback (unknown prefixes)", () => {
    it("should default to English for unknown prefixes", () => {
      expect(detectLanguageFromPhonePrefix("+81 90 12345678")).toBe("en") // Japan
      expect(detectLanguageFromPhonePrefix("+86 138 12345678")).toBe("en") // China
      expect(detectLanguageFromPhonePrefix("+91 98765 43210")).toBe("en") // India
      expect(detectLanguageFromPhonePrefix("+55 11 98765 4321")).toBe("en") // Brazil
    })
  })

  describe("Edge cases", () => {
    it("should handle phone numbers without spaces", () => {
      expect(detectLanguageFromPhonePrefix("+393331234567")).toBe("it")
      expect(detectLanguageFromPhonePrefix("+34611223344")).toBe("es")
    })

    it("should handle phone numbers with various formatting", () => {
      expect(detectLanguageFromPhonePrefix("+39-333-1234567")).toBe("it")
      expect(detectLanguageFromPhonePrefix("+34 (611) 223344")).toBe("es")
    })

    it("should default to English if no prefix found", () => {
      expect(detectLanguageFromPhonePrefix("333 1234567")).toBe("en") // No + prefix
      expect(detectLanguageFromPhonePrefix("invalid")).toBe("en")
    })

    it("should handle empty or null inputs gracefully", () => {
      expect(detectLanguageFromPhonePrefix("")).toBe("en")
      expect(detectLanguageFromPhonePrefix(" ")).toBe("en")
    })
  })

  describe("Prefix matching logic", () => {
    it("should match longest prefix first", () => {
      // +351 (Portugal) should match before +35 (generic)
      expect(detectLanguageFromPhonePrefix("+351912777777")).toBe("pt")
    })

    it("should fallback to shorter prefix if exact match not found", () => {
      // This tests the prefix shortening logic in the detector
      expect(detectLanguageFromPhonePrefix("+39333")).toBe("it") // +39 exists
      expect(detectLanguageFromPhonePrefix("+34611")).toBe("es") // +34 exists
    })
  })
})
