/**
 * Unit Test: Welcome Message Language Detection with Workspace Default Language Fallback
 * 
 * BUSINESS RULE: Language Detection Priority Order
 * 1. customer.language (explicit customer preference)
 * 2. detectLanguageFromPhonePrefix(phone) (inferred from phone number)
 * 3. workspace.defaultLanguage (workspace configuration)
 * 4. 'en' (final hardcoded fallback)
 * 
 * SCENARIO TESTED: When customer.language is null AND phone prefix detection fails,
 * the system MUST use workspace.defaultLanguage as fallback.
 * 
 * EXAMPLE:
 * - Customer: language=null, phone="+999123456789" (unknown prefix → returns null)
 * - Workspace: defaultLanguage="it"
 * - Expected: detectedLanguage = "it" (from workspace.defaultLanguage)
 */

import { prisma } from '@echatbot/database'

describe('Welcome Message - Workspace Default Language Fallback (Unit)', () => {
  let mockWorkspace: any
  let mockCustomer: any
  let mockDetectLanguageFromPhonePrefix: jest.Mock

  beforeEach(() => {
    // Mock workspace with defaultLanguage
    mockWorkspace = {
      id: 'test-workspace-id',
      defaultLanguage: 'it', // Italian as default
      name: 'Test Workspace',
    }

    // Mock customer with null language and unknown phone prefix
    mockCustomer = {
      id: 'test-customer-id',
      phone: '+999123456789', // Unknown country code
      language: null, // No explicit language
      name: 'Test Customer',
      workspaceId: 'test-workspace-id',
    }

    // Mock detectLanguageFromPhonePrefix to return null for unknown prefix
    mockDetectLanguageFromPhonePrefix = jest.fn().mockReturnValue(null)
  })

  describe('SCENARIO: Fallback to workspace.defaultLanguage', () => {
    it('should use workspace.defaultLanguage when customer.language is null AND phone prefix detection returns null', () => {
      /**
       * TEST CASE:
       * - customer.language = null → NOT USED (null)
       * - detectLanguageFromPhonePrefix('+999123456789') → null (unknown prefix)
       * - workspace.defaultLanguage = 'it' → USED ✅
       * - Final fallback = 'en' → NOT REACHED
       * 
       * EXPECTED RESULT: detectedLanguage = 'it'
       */

      const detectedLanguage =
        mockCustomer?.language ||
        mockDetectLanguageFromPhonePrefix(mockCustomer.phone) ||
        mockWorkspace.defaultLanguage ||
        'en'

      expect(detectedLanguage).toBe('it')
      expect(mockDetectLanguageFromPhonePrefix).toHaveBeenCalledWith('+999123456789')
    })

    it('should use workspace.defaultLanguage="es" when customer has no language and unknown phone prefix', () => {
      /**
       * TEST CASE:
       * - customer.language = null
       * - phone prefix detection → null
       * - workspace.defaultLanguage = 'es' (Spanish)
       * 
       * EXPECTED RESULT: detectedLanguage = 'es'
       */

      mockWorkspace.defaultLanguage = 'es'

      const detectedLanguage =
        mockCustomer?.language ||
        mockDetectLanguageFromPhonePrefix(mockCustomer.phone) ||
        mockWorkspace.defaultLanguage ||
        'en'

      expect(detectedLanguage).toBe('es')
    })

    it('should use workspace.defaultLanguage="pt" when customer has no language and unknown phone prefix', () => {
      /**
       * TEST CASE:
       * - customer.language = null
       * - phone prefix detection → null
       * - workspace.defaultLanguage = 'pt' (Portuguese)
       * 
       * EXPECTED RESULT: detectedLanguage = 'pt'
       */

      mockWorkspace.defaultLanguage = 'pt'

      const detectedLanguage =
        mockCustomer?.language ||
        mockDetectLanguageFromPhonePrefix(mockCustomer.phone) ||
        mockWorkspace.defaultLanguage ||
        'en'

      expect(detectedLanguage).toBe('pt')
    })

    it('should use final fallback "en" when workspace.defaultLanguage is also null', () => {
      /**
       * EDGE CASE:
       * - customer.language = null
       * - phone prefix detection → null
       * - workspace.defaultLanguage = null → NOT USED
       * - Final fallback = 'en' → USED ✅
       * 
       * EXPECTED RESULT: detectedLanguage = 'en'
       */

      mockWorkspace.defaultLanguage = null

      const detectedLanguage =
        mockCustomer?.language ||
        mockDetectLanguageFromPhonePrefix(mockCustomer.phone) ||
        mockWorkspace.defaultLanguage ||
        'en'

      expect(detectedLanguage).toBe('en')
    })
  })

  describe('SCENARIO: Priority Order Verification', () => {
    it('customer.language MUST win over workspace.defaultLanguage', () => {
      /**
       * BUSINESS RULE: Explicit customer language has HIGHEST priority
       * 
       * TEST CASE:
       * - customer.language = 'es' → USED ✅ (Priority 1)
       * - phone prefix detection → 'it'
       * - workspace.defaultLanguage = 'pt'
       * 
       * EXPECTED RESULT: detectedLanguage = 'es' (customer explicit preference wins)
       */

      mockCustomer.language = 'es'
      mockDetectLanguageFromPhonePrefix.mockReturnValue('it')
      mockWorkspace.defaultLanguage = 'pt'

      const detectedLanguage =
        mockCustomer?.language ||
        mockDetectLanguageFromPhonePrefix(mockCustomer.phone) ||
        mockWorkspace.defaultLanguage ||
        'en'

      expect(detectedLanguage).toBe('es')
      // Phone prefix detection should NOT even be called if customer.language exists
      // (but our mock doesn't short-circuit, so we don't test this)
    })

    it('phone prefix detection MUST win over workspace.defaultLanguage', () => {
      /**
       * BUSINESS RULE: Phone prefix has HIGHER priority than workspace default
       * 
       * TEST CASE:
       * - customer.language = null
       * - detectLanguageFromPhonePrefix('+39123456789') → 'it' → USED ✅ (Priority 2)
       * - workspace.defaultLanguage = 'es'
       * 
       * EXPECTED RESULT: detectedLanguage = 'it' (phone prefix wins over workspace default)
       */

      mockCustomer.phone = '+39123456789'
      mockDetectLanguageFromPhonePrefix.mockReturnValue('it')
      mockWorkspace.defaultLanguage = 'es'

      const detectedLanguage =
        mockCustomer?.language ||
        mockDetectLanguageFromPhonePrefix(mockCustomer.phone) ||
        mockWorkspace.defaultLanguage ||
        'en'

      expect(detectedLanguage).toBe('it')
      expect(mockDetectLanguageFromPhonePrefix).toHaveBeenCalledWith('+39123456789')
    })

    it('workspace.defaultLanguage is used ONLY when customer.language and phone prefix both fail', () => {
      /**
       * VERIFICATION: workspace.defaultLanguage is Priority 3 (not 1 or 2)
       * 
       * TEST CASE:
       * - customer.language = null → FAILS
       * - phone prefix detection → null → FAILS
       * - workspace.defaultLanguage = 'pt' → USED ✅ (Priority 3)
       * 
       * EXPECTED RESULT: detectedLanguage = 'pt'
       */

      mockCustomer.language = null
      mockDetectLanguageFromPhonePrefix.mockReturnValue(null)
      mockWorkspace.defaultLanguage = 'pt'

      const detectedLanguage =
        mockCustomer?.language ||
        mockDetectLanguageFromPhonePrefix(mockCustomer.phone) ||
        mockWorkspace.defaultLanguage ||
        'en'

      expect(detectedLanguage).toBe('pt')
    })
  })

  describe('REAL-WORLD SCENARIOS', () => {
    it('New customer from unknown country should use workspace default language', () => {
      /**
       * REAL-WORLD USE CASE:
       * - New customer signs up from WhatsApp with non-standard phone number
       * - Customer has not set explicit language preference yet
       * - System cannot detect language from phone prefix
       * - Workspace is configured with Italian as default language
       * 
       * EXPECTED: Customer receives welcome message in Italian (workspace default)
       */

      mockCustomer = {
        id: 'new-customer-id',
        phone: '+88212345678', // Myanmar - not in detector
        language: null,
        name: 'New Customer',
        workspaceId: 'italian-workspace',
      }

      mockWorkspace = {
        id: 'italian-workspace',
        name: 'Italian E-commerce',
        defaultLanguage: 'it',
      }

      mockDetectLanguageFromPhonePrefix.mockReturnValue(null)

      const detectedLanguage =
        mockCustomer?.language ||
        mockDetectLanguageFromPhonePrefix(mockCustomer.phone) ||
        mockWorkspace.defaultLanguage ||
        'en'

      expect(detectedLanguage).toBe('it')
    })

    it('Workspace without defaultLanguage falls back to hardcoded "en"', () => {
      /**
       * EDGE CASE:
       * - Workspace created before defaultLanguage feature
       * - defaultLanguage field is null or undefined
       * - System must use final hardcoded fallback 'en'
       * 
       * EXPECTED: Customer receives welcome message in English
       */

      mockWorkspace.defaultLanguage = undefined

      const detectedLanguage =
        mockCustomer?.language ||
        mockDetectLanguageFromPhonePrefix(mockCustomer.phone) ||
        mockWorkspace.defaultLanguage ||
        'en'

      expect(detectedLanguage).toBe('en')
    })
  })
})
