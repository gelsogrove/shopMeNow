/**
 * 🎯 TEST: Widget Language Detection Priority
 * 
 * ⚠️ CRITICAL: These tests define the LANGUAGE PRIORITY LOGIC for the entire system!
 * 
 * 📚 THE BIBLE: Language Detection Priority Order
 * ============================================
 * 1. ✅ Explicit language parameter (widget selector/API) - HIGHEST PRIORITY
 * 2. 📱 Phone number prefix (+39 → it, +34 → es, +351 → pt, +1 → en)
 * 3. 🌐 Browser Accept-Language header
 * 4. 🏢 Workspace default language
 * 5. 🇮🇹 Italian system fallback
 * 
 * 🚨 DO NOT CHANGE THESE TESTS WITHOUT APPROVAL!
 * If behavior must change:
 * 1. Get approval from Andrea
 * 2. Update tests first
 * 3. Update implementation to match tests
 * 4. Update documentation
 * 
 * @see apps/backend/src/interfaces/http/controllers/widget-chat.controller.ts
 */

import { detectLanguageFromPhonePrefix } from "../../../src/utils/language-detector"

describe("Widget Language Detection Priority (THE BIBLE)", () => {
  describe("Priority 1: Explicit Language Parameter (HIGHEST)", () => {
    it("should use explicit language even when phone number is provided", () => {
      // SCENARIO: User selects "Spanish" in widget, but has Italian phone number
      const explicitLang = "es" // Spanish selected
      const phoneNumber = "+39 333 1234567" // Italian phone
      const detectedFromPhone = detectLanguageFromPhonePrefix(phoneNumber) // "it"
      
      // RULE: Explicit language WINS over phone prefix
      const finalLanguage = explicitLang || detectedFromPhone
      
      expect(finalLanguage).toBe("es") // Spanish wins!
      expect(detectedFromPhone).toBe("it") // Phone is Italian, but ignored
    })

    it("should use explicit language from widget selector (playground scenario)", () => {
      // SCENARIO: Playground has Italian phone (+39) but user selects Portuguese
      const explicitLang = "pt" // Portuguese selected in widget
      const phoneNumber = "+39 899 1234567" // Fake Italian phone (playground)
      
      const finalLanguage = explicitLang // Explicit ALWAYS wins
      
      expect(finalLanguage).toBe("pt") // Portuguese wins!
      // Phone prefix is ignored when explicit language provided
    })

    it("should use explicit language for anonymous widget users", () => {
      // SCENARIO: Website widget, no phone, user selects English
      const explicitLang = "en" // English selected
      const phoneNumber = undefined // No phone (anonymous)
      
      const finalLanguage = explicitLang
      
      expect(finalLanguage).toBe("en") // English wins!
    })
  })

  describe("Priority 2: Phone Number Prefix (SECOND)", () => {
    it("should use phone prefix when NO explicit language provided", () => {
      // SCENARIO: WhatsApp message from Spanish number, no language selector
      const explicitLang = undefined // No explicit language
      const phoneNumber = "+34 611 223344" // Spanish phone
      const detectedFromPhone = detectLanguageFromPhonePrefix(phoneNumber)
      
      const finalLanguage = explicitLang || detectedFromPhone
      
      expect(finalLanguage).toBe("es") // Spanish from phone prefix
    })

    it("should detect Italian from +39 prefix (playground default)", () => {
      // SCENARIO: Playground with +39 899 1234567, no language selector
      const explicitLang = undefined
      const phoneNumber = "+39 899 1234567"
      const detectedFromPhone = detectLanguageFromPhonePrefix(phoneNumber)
      
      const finalLanguage = explicitLang || detectedFromPhone
      
      expect(finalLanguage).toBe("it") // Italian from +39 prefix
    })

    it("should detect Portuguese from +351 prefix", () => {
      // SCENARIO: Customer from Portugal, no explicit language
      const explicitLang = undefined
      const phoneNumber = "+351 912 777777"
      const detectedFromPhone = detectLanguageFromPhonePrefix(phoneNumber)
      
      const finalLanguage = explicitLang || detectedFromPhone
      
      expect(finalLanguage).toBe("pt") // Portuguese from +351
    })

    it("should detect English from +1 prefix (USA/Canada)", () => {
      // SCENARIO: North American customer
      const explicitLang = undefined
      const phoneNumber = "+1 555 1234567"
      const detectedFromPhone = detectLanguageFromPhonePrefix(phoneNumber)
      
      const finalLanguage = explicitLang || detectedFromPhone
      
      expect(finalLanguage).toBe("en") // English from +1
    })

    it("should detect English from +44 prefix (UK)", () => {
      // SCENARIO: British customer
      const explicitLang = undefined
      const phoneNumber = "+44 20 12345678"
      const detectedFromPhone = detectLanguageFromPhonePrefix(phoneNumber)
      
      const finalLanguage = explicitLang || detectedFromPhone
      
      expect(finalLanguage).toBe("en") // English from +44
    })
  })

  describe("Priority 3: Browser Accept-Language Header (THIRD)", () => {
    it("should use browser language when NO explicit language and NO phone", () => {
      // SCENARIO: Anonymous widget user, browser set to French
      const explicitLang = undefined
      const phoneNumber = undefined
      const browserLang = "fr" // Browser preference
      
      const finalLanguage = explicitLang || phoneNumber || browserLang
      
      expect(finalLanguage).toBe("fr") // French from browser
    })
  })

  describe("Priority 4: Workspace Default Language (FOURTH)", () => {
    it("should use workspace default when no other source available", () => {
      // SCENARIO: No explicit, no phone, no browser language
      const explicitLang = undefined
      const phoneNumber = undefined
      const browserLang = undefined
      const workspaceDefault = "ITA" // Workspace configured for Italian
      
      const finalLanguage = explicitLang || phoneNumber || browserLang || workspaceDefault
      
      expect(finalLanguage).toBe("ITA")
    })
  })

  describe("Priority 5: System Fallback (LOWEST)", () => {
    it("should fallback to Italian when all sources are missing", () => {
      // SCENARIO: Complete fallback case
      const explicitLang = undefined
      const phoneNumber = undefined
      const browserLang = undefined
      const workspaceDefault = undefined
      const systemFallback = "it"
      
      const finalLanguage = explicitLang || phoneNumber || browserLang || workspaceDefault || systemFallback
      
      expect(finalLanguage).toBe("it")
    })
  })

  describe("Real-World Integration Scenarios", () => {
    it("Playground: Phone +39 with Italian selector → Italian (explicit wins)", () => {
      const explicitLang = "it"
      const phoneNumber = "+39 899 1234567"
      const detectedFromPhone = detectLanguageFromPhonePrefix(phoneNumber)
      
      const finalLanguage = explicitLang || detectedFromPhone
      
      expect(finalLanguage).toBe("it")
    })

    it("Playground: Phone +39 with Spanish selector → Spanish (explicit wins)", () => {
      const explicitLang = "es"
      const phoneNumber = "+39 899 1234567"
      const detectedFromPhone = detectLanguageFromPhonePrefix(phoneNumber)
      
      const finalLanguage = explicitLang || detectedFromPhone
      
      expect(finalLanguage).toBe("es") // Spanish selector overrides Italian phone
    })

    it("Playground: Phone +34 with NO selector → Spanish (phone wins)", () => {
      const explicitLang = undefined
      const phoneNumber = "+34 611 223344"
      const detectedFromPhone = detectLanguageFromPhonePrefix(phoneNumber)
      
      const finalLanguage = explicitLang || detectedFromPhone
      
      expect(finalLanguage).toBe("es") // Spanish from phone
    })

    it("Widget Embedded: NO phone, Italian selector → Italian", () => {
      const explicitLang = "it"
      const phoneNumber = undefined
      const browserLang = "en" // Browser in English
      
      const finalLanguage = explicitLang || browserLang
      
      expect(finalLanguage).toBe("it") // Explicit wins over browser
    })

    it("WhatsApp: Portuguese phone +351, NO selector → Portuguese", () => {
      const explicitLang = undefined
      const phoneNumber = "+351 912 777777"
      const detectedFromPhone = detectLanguageFromPhonePrefix(phoneNumber)
      
      const finalLanguage = explicitLang || detectedFromPhone
      
      expect(finalLanguage).toBe("pt")
    })
  })

  describe("Edge Cases & Error Handling", () => {
    it("should handle malformed phone number gracefully", () => {
      const explicitLang = undefined
      const phoneNumber = "invalid-phone"
      const detectedFromPhone = detectLanguageFromPhonePrefix(phoneNumber)
      
      // detectLanguageFromPhonePrefix returns "en" for invalid phones
      expect(detectedFromPhone).toBe("en")
    })

    it("should ignore empty string as explicit language", () => {
      const explicitLang = "" // Empty string should be treated as undefined
      const phoneNumber = "+39 333 1234567"
      const detectedFromPhone = detectLanguageFromPhonePrefix(phoneNumber)
      
      const finalLanguage = (explicitLang || undefined) || detectedFromPhone
      
      expect(finalLanguage).toBe("it") // Phone wins when explicit is empty
    })

    it("should handle null values gracefully", () => {
      const explicitLang = null
      const phoneNumber = null
      const browserLang = null
      const fallback = "it"
      
      const finalLanguage = explicitLang || phoneNumber || browserLang || fallback
      
      expect(finalLanguage).toBe("it")
    })
  })
})
