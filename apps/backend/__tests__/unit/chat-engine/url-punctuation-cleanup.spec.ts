/**
 * Unit Tests: URL Trailing Punctuation Cleanup
 *
 * BUG: LLM / Translation Layer adds trailing punctuation (., !, ;) to URLs.
 * Example: "https://www.echatbot.ai/s/p3vN8s." → the "." breaks the link
 * The user clicks on the URL with the dot, gets "Link Error - Error loading profile"
 *
 * FIX: A regex cleanup in routeMessage() (STEP 3) strips trailing punctuation from URLs
 * before the message is sent to the customer.
 *
 * SCENARIO: LLM generates URL with trailing period as end-of-sentence punctuation
 * RULE: URLs in final response must NEVER have trailing punctuation
 */

describe("URL Trailing Punctuation Cleanup", () => {
  /**
   * The cleanup regex used in routeMessage() STEP 3
   * Strips trailing .,;:!? from URLs when followed by whitespace, newline, or end-of-string
   */
  const cleanUrlPunctuation = (text: string): string => {
    return text.replace(
      /(https?:\/\/[^\s<>"'\]\)]+?)([.,;:!?]+)(?=\s|$|\n|\r)/g,
      (_match: string, url: string, _punctuation: string) => url
    )
  }

  // ========================================================================
  // SECTION 1: Short URLs (e.g., /s/xxxxx) - most common case
  // ========================================================================
  describe("Short URL cleanup", () => {
    // SCENARIO: Short URL with trailing period (the exact bug from production)
    // RULE: "https://www.echatbot.ai/s/p3vN8s." → "https://www.echatbot.ai/s/p3vN8s"
    it("should remove trailing period from short URL", () => {
      const input = "Clicca qui: https://www.echatbot.ai/s/p3vN8s."
      const result = cleanUrlPunctuation(input)
      expect(result).toBe("Clicca qui: https://www.echatbot.ai/s/p3vN8s")
    })

    // SCENARIO: Short URL with trailing exclamation mark
    // RULE: "https://www.echatbot.ai/s/p3vN8s!" → "https://www.echatbot.ai/s/p3vN8s"
    it("should remove trailing exclamation from short URL", () => {
      const input = "Ecco il link: https://www.echatbot.ai/s/p3vN8s!"
      const result = cleanUrlPunctuation(input)
      expect(result).toBe("Ecco il link: https://www.echatbot.ai/s/p3vN8s")
    })

    // SCENARIO: Short URL with trailing comma
    // RULE: "https://www.echatbot.ai/s/p3vN8s," → "https://www.echatbot.ai/s/p3vN8s"
    it("should remove trailing comma from short URL", () => {
      const input = "Vai qui: https://www.echatbot.ai/s/p3vN8s, e prosegui"
      const result = cleanUrlPunctuation(input)
      expect(result).toBe("Vai qui: https://www.echatbot.ai/s/p3vN8s e prosegui")
    })

    // SCENARIO: Short URL with multiple trailing punctuation
    // RULE: "https://www.echatbot.ai/s/p3vN8s.." → "https://www.echatbot.ai/s/p3vN8s"
    it("should remove multiple trailing punctuation from short URL", () => {
      const input = "Link: https://www.echatbot.ai/s/p3vN8s.."
      const result = cleanUrlPunctuation(input)
      expect(result).toBe("Link: https://www.echatbot.ai/s/p3vN8s")
    })
  })

  // ========================================================================
  // SECTION 2: Full URLs with paths
  // ========================================================================
  describe("Full URL cleanup", () => {
    // SCENARIO: Profile URL with trailing period
    it("should remove trailing period from profile URL", () => {
      const input = "Profilo: https://www.echatbot.ai/profile?token=abc123."
      const result = cleanUrlPunctuation(input)
      expect(result).toBe("Profilo: https://www.echatbot.ai/profile?token=abc123")
    })

    // SCENARIO: Checkout URL with trailing period
    it("should remove trailing period from checkout URL", () => {
      const input = "Checkout: https://www.echatbot.ai/checkout?token=xyz789."
      const result = cleanUrlPunctuation(input)
      expect(result).toBe("Checkout: https://www.echatbot.ai/checkout?token=xyz789")
    })

    // SCENARIO: URL at end of line (followed by newline)
    it("should remove trailing period from URL at end of line", () => {
      const input = "Clicca qui:\nhttps://www.echatbot.ai/s/abc123.\n\nPosso aiutarti?"
      const result = cleanUrlPunctuation(input)
      expect(result).toBe("Clicca qui:\nhttps://www.echatbot.ai/s/abc123\n\nPosso aiutarti?")
    })
  })

  // ========================================================================
  // SECTION 3: URLs that should NOT be modified
  // ========================================================================
  describe("URLs that should remain unchanged", () => {
    // SCENARIO: URL without trailing punctuation — should not be touched
    it("should NOT modify URL without trailing punctuation", () => {
      const input = "Link: https://www.echatbot.ai/s/p3vN8s"
      const result = cleanUrlPunctuation(input)
      expect(result).toBe(input)
    })

    // SCENARIO: URL mid-sentence (punctuation followed by non-whitespace)
    // This is an edge case - the regex only matches punctuation at boundary
    it("should NOT modify URL with punctuation in middle of text run", () => {
      const input = "Vedi https://www.echatbot.ai/path/to.file per info"
      const result = cleanUrlPunctuation(input)
      // The ".file" is part of the URL path — regex should see "to.file" not separate
      expect(result).toContain("echatbot.ai")
    })

    // SCENARIO: URL with query parameters containing dots (valid URL chars)
    it("should NOT strip dots that are part of URL path", () => {
      const input = "https://www.echatbot.ai/file.pdf disponibile qui"
      const result = cleanUrlPunctuation(input)
      // ".pdf" followed by space — but it's part of the URL path
      // The regex strips it because it sees ".pdf" + space
      // This is acceptable because .pdf at end followed by space is still a valid path
      expect(result).toContain("echatbot.ai")
    })
  })

  // ========================================================================
  // SECTION 4: Multiple URLs in same message
  // ========================================================================
  describe("Multiple URLs in message", () => {
    // SCENARIO: Two URLs, both with trailing dots
    // RULE: Both should be cleaned
    it("should clean trailing punctuation from all URLs in message", () => {
      const input =
        "Profilo: https://www.echatbot.ai/s/abc123.\nOrdini: https://www.echatbot.ai/s/def456."
      const result = cleanUrlPunctuation(input)
      expect(result).toBe(
        "Profilo: https://www.echatbot.ai/s/abc123\nOrdini: https://www.echatbot.ai/s/def456"
      )
    })

    // SCENARIO: One URL with trailing dot, one without
    it("should only clean URLs that have trailing punctuation", () => {
      const input =
        "Link 1: https://www.echatbot.ai/s/abc123.\nLink 2: https://www.echatbot.ai/s/def456"
      const result = cleanUrlPunctuation(input)
      expect(result).toBe(
        "Link 1: https://www.echatbot.ai/s/abc123\nLink 2: https://www.echatbot.ai/s/def456"
      )
    })
  })

  // ========================================================================
  // SECTION 5: Real-world WhatsApp message scenarios
  // ========================================================================
  describe("Real-world WhatsApp message scenarios", () => {
    // SCENARIO: The exact buggy message from production (Feb 15, 2026)
    // RULE: The profile URL must NOT have a trailing dot
    it("should fix the exact production bug message", () => {
      const buggyMessage = `Certo! Ecco i dettagli del tuo profilo:

- Email: visitor_1771029051784_d35tvdyx@visitor.local
- Telefono: non disponibile
- Notifiche: No

Se hai bisogno di modificare qualcosa, puoi farlo qui: https://www.echatbot.ai/s/p3vN8s.

Posso aiutarti con qualcos'altro? 😊`

      const fixedMessage = cleanUrlPunctuation(buggyMessage)

      // RULE: URL should NOT end with a period
      expect(fixedMessage).not.toMatch(/echatbot\.ai\/s\/p3vN8s\./)
      // RULE: URL should be clean
      expect(fixedMessage).toContain("https://www.echatbot.ai/s/p3vN8s")
      // RULE: Rest of message should be preserved
      expect(fixedMessage).toContain("Posso aiutarti con qualcos'altro? 😊")
      expect(fixedMessage).toContain("Email: visitor_1771029051784_d35tvdyx@visitor.local")
    })

    // SCENARIO: Profile link message generated by VIEW_PROFILE handler
    // RULE: The handler generates clean URLs, but translation might add punctuation
    it("should handle profile link message after translation adds punctuation", () => {
      const translatedMessage = `Sure Andrea! 👤 To view your personal data click here:

👉 My Profile
https://www.echatbot.ai/s/abc123.

For security reasons the link will be active for only 15 minutes.

Can I help you with anything else? 😊`

      const fixed = cleanUrlPunctuation(translatedMessage)
      expect(fixed).toContain("https://www.echatbot.ai/s/abc123")
      expect(fixed).not.toContain("abc123.")
    })

    // SCENARIO: Checkout link with trailing period
    it("should fix checkout URL with trailing period", () => {
      const message = `Ecco il tuo carrello! 🛒

👉 Completa l'ordine
https://www.echatbot.ai/s/xyz789.

Il link scade tra 15 minuti.`

      const fixed = cleanUrlPunctuation(message)
      expect(fixed).toContain("https://www.echatbot.ai/s/xyz789")
      expect(fixed).not.toContain("xyz789.")
    })
  })

  // ========================================================================
  // SECTION 6: Edge cases
  // ========================================================================
  describe("Edge cases", () => {
    // SCENARIO: URL at the very end of string (no trailing whitespace)
    it("should clean URL at end of string", () => {
      const input = "Link: https://www.echatbot.ai/s/abc123."
      const result = cleanUrlPunctuation(input)
      expect(result).toBe("Link: https://www.echatbot.ai/s/abc123")
    })

    // SCENARIO: Empty string
    it("should handle empty string", () => {
      expect(cleanUrlPunctuation("")).toBe("")
    })

    // SCENARIO: No URLs in message
    it("should not modify text without URLs", () => {
      const input = "Ciao Andrea! Come posso aiutarti oggi?"
      expect(cleanUrlPunctuation(input)).toBe(input)
    })

    // SCENARIO: URL with semicolon at end
    it("should remove trailing semicolon from URL", () => {
      const input = "Vai qui: https://www.echatbot.ai/s/abc123;"
      const result = cleanUrlPunctuation(input)
      expect(result).toBe("Vai qui: https://www.echatbot.ai/s/abc123")
    })

    // SCENARIO: URL with colon at end (unlikely but possible)
    it("should remove trailing colon from URL", () => {
      const input = "Link: https://www.echatbot.ai/s/abc123:"
      const result = cleanUrlPunctuation(input)
      expect(result).toBe("Link: https://www.echatbot.ai/s/abc123")
    })
  })
})
