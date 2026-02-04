/**
 * Integration Tests: Welcome Message Language Selection
 * 
 * CRITICAL BUSINESS RULE:
 * Welcome message MUST use explicit customer language if set,
 * fallback to phone prefix detection ONLY if language not set.
 * 
 * Scenarios:
 * 1. Customer with explicit language "en" + Italian phone (+39) → Welcome in ENGLISH
 * 2. Customer with explicit language "es" + Italian phone (+39) → Welcome in SPANISH
 * 3. Customer without language + Italian phone (+39) → Welcome in ITALIAN (fallback)
 * 4. Customer without language + Spanish phone (+34) → Welcome in SPANISH (fallback)
 */

import { prisma } from '@echatbot/database'
import request from 'supertest'
import app from '../../apps/backend/src/app'
import { LLMService } from '../../apps/backend/src/services/llm.service'

describe('Welcome Message Language Selection (Integration)', () => {
  let testWorkspaceId: string
  let testCustomerId: string
  let adminToken: string
  let llmService: LLMService

  beforeAll(async () => {
    llmService = new LLMService()

    // Create test workspace
    const workspace = await prisma.workspace.create({
      data: {
        id: 'test-welcome-lang-workspace',
        name: 'Welcome Language Test',
        slug: 'welcome-lang-test',
        whatsappPhoneNumber: '+39999000111',
        language: 'ENG',
        currency: 'EUR',
        channelStatus: true,
        debugMode: false,
        welcomeMessage: 'Welcome {{customerName}}! I am {{chatbotName}}, your assistant. How can I help you today?',
        sellsProductsAndServices: true,
        hasHumanSupport: true,
        planType: 'FREE_TRIAL',
      },
    })
    testWorkspaceId = workspace.id

    // Create WhatsappSettings
    await prisma.whatsappSettings.create({
      data: {
        workspaceId: testWorkspaceId,
        phoneNumber: '+39999000111',
        apiKey: 'test-key',
        gdpr: 'Test GDPR',
      },
    })

    // Create admin user and get token
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin-welcome-lang@test.com',
        password: 'password123',
        name: 'Admin',
        planType: 'FREE_TRIAL',
      },
    })

    await prisma.userWorkspace.create({
      data: {
        userId: adminUser.id,
        workspaceId: testWorkspaceId,
        role: 'SUPER_ADMIN',
      },
    })

    // Get admin token
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin-welcome-lang@test.com',
        password: 'password123',
      })

    adminToken = loginRes.body.token
  })

  afterAll(async () => {
    // Cleanup
    await prisma.userWorkspace.deleteMany({
      where: { workspaceId: testWorkspaceId },
    })
    await prisma.user.deleteMany({
      where: { email: 'admin-welcome-lang@test.com' },
    })
    await prisma.customers.deleteMany({
      where: { workspaceId: testWorkspaceId },
    })
    await prisma.whatsappSettings.deleteMany({
      where: { workspaceId: testWorkspaceId },
    })
    await prisma.workspace.delete({
      where: { id: testWorkspaceId },
    })
  })

  afterEach(async () => {
    // Clean up customers after each test
    await prisma.customers.deleteMany({
      where: { workspaceId: testWorkspaceId },
    })
  })

  describe('SCENARIO 1: Explicit Language WINS over Phone Prefix', () => {
    it('should use ENGLISH for customer with language="en" and Italian phone (+39)', async () => {
      // GIVEN: Customer with explicit English language but Italian phone number
      const customer = await prisma.customers.create({
        data: {
          workspaceId: testWorkspaceId,
          phone: '+39123456789', // Italian prefix
          name: 'Marco Rossi',
          language: 'en', // ✅ EXPLICIT ENGLISH
          email: 'marco@test.it',
          status: 'ACTIVE',
        },
      })

      // WHEN: handleNewUserWelcome is called
      const result = await llmService.handleNewUserWelcome(
        '+39123456789',
        testWorkspaceId,
        'Ciao'
      )

      // THEN: Welcome message should be in ENGLISH (not Italian from prefix)
      expect(result.success).toBe(true)
      expect(result.debugInfo.detectedLanguage).toBe('en') // ✅ English used
      
      // Message should contain English welcome (not Italian "Benvenuto")
      // Note: Actual translation depends on SafetyTranslationAgent
      expect(result.message).toBeTruthy()
      console.log(`✅ SCENARIO 1 PASSED: English used for +39 customer with language="en"`)
    })

    it('should use SPANISH for customer with language="es" and Italian phone (+39)', async () => {
      // GIVEN: Customer with explicit Spanish language but Italian phone number
      const customer = await prisma.customers.create({
        data: {
          workspaceId: testWorkspaceId,
          phone: '+39987654321', // Italian prefix
          name: 'Giuseppe Verdi',
          language: 'es', // ✅ EXPLICIT SPANISH
          email: 'giuseppe@test.it',
          status: 'ACTIVE',
        },
      })

      // WHEN: handleNewUserWelcome is called
      const result = await llmService.handleNewUserWelcome(
        '+39987654321',
        testWorkspaceId,
        'Ciao'
      )

      // THEN: Welcome message should be in SPANISH (not Italian from prefix)
      expect(result.success).toBe(true)
      expect(result.debugInfo.detectedLanguage).toBe('es') // ✅ Spanish used
      expect(result.message).toBeTruthy()
      console.log(`✅ SCENARIO 2 PASSED: Spanish used for +39 customer with language="es"`)
    })
  })

  describe('SCENARIO 2: Fallback to Phone Prefix when Language NOT Set', () => {
    it('should use ITALIAN for customer WITHOUT language and Italian phone (+39)', async () => {
      // GIVEN: Customer WITHOUT explicit language, Italian phone number
      const customer = await prisma.customers.create({
        data: {
          workspaceId: testWorkspaceId,
          phone: '+39111222333', // Italian prefix
          name: 'Luigi Bianchi',
          language: null, // ❌ NO EXPLICIT LANGUAGE
          email: 'luigi@test.it',
          status: 'ACTIVE',
        },
      })

      // WHEN: handleNewUserWelcome is called
      const result = await llmService.handleNewUserWelcome(
        '+39111222333',
        testWorkspaceId,
        'Ciao'
      )

      // THEN: Should fallback to ITALIAN from phone prefix
      expect(result.success).toBe(true)
      expect(result.debugInfo.detectedLanguage).toBe('it') // ✅ Italian from prefix
      expect(result.message).toBeTruthy()
      console.log(`✅ SCENARIO 3 PASSED: Italian used (fallback from +39 prefix)`)
    })

    it('should use SPANISH for customer WITHOUT language and Spanish phone (+34)', async () => {
      // GIVEN: Customer WITHOUT explicit language, Spanish phone number
      const customer = await prisma.customers.create({
        data: {
          workspaceId: testWorkspaceId,
          phone: '+34666777888', // Spanish prefix
          name: 'Pablo García',
          language: null, // ❌ NO EXPLICIT LANGUAGE
          email: 'pablo@test.es',
          status: 'ACTIVE',
        },
      })

      // WHEN: handleNewUserWelcome is called
      const result = await llmService.handleNewUserWelcome(
        '+34666777888',
        testWorkspaceId,
        'Hola'
      )

      // THEN: Should fallback to SPANISH from phone prefix
      expect(result.success).toBe(true)
      expect(result.debugInfo.detectedLanguage).toBe('es') // ✅ Spanish from prefix
      expect(result.message).toBeTruthy()
      console.log(`✅ SCENARIO 4 PASSED: Spanish used (fallback from +34 prefix)`)
    })
  })

  describe('SCENARIO 3: Edge Cases', () => {
    it('should handle customer with Portuguese language and Italian phone', async () => {
      // GIVEN: Customer with Portuguese language, Italian phone
      const customer = await prisma.customers.create({
        data: {
          workspaceId: testWorkspaceId,
          phone: '+39444555666',
          name: 'Antonio Costa',
          language: 'pt', // ✅ EXPLICIT PORTUGUESE
          email: 'antonio@test.pt',
          status: 'ACTIVE',
        },
      })

      // WHEN: handleNewUserWelcome is called
      const result = await llmService.handleNewUserWelcome(
        '+39444555666',
        testWorkspaceId,
        'Olá'
      )

      // THEN: Should use PORTUGUESE (not Italian)
      expect(result.success).toBe(true)
      expect(result.debugInfo.detectedLanguage).toBe('pt')
      console.log(`✅ EDGE CASE PASSED: Portuguese used for +39 customer with language="pt"`)
    })

    it('should handle unknown phone prefix with explicit language', async () => {
      // GIVEN: Customer with weird phone prefix but explicit English
      const customer = await prisma.customers.create({
        data: {
          workspaceId: testWorkspaceId,
          phone: '+999123456789', // Unknown prefix
          name: 'Unknown User',
          language: 'en', // ✅ EXPLICIT ENGLISH
          email: 'unknown@test.com',
          status: 'ACTIVE',
        },
      })

      // WHEN: handleNewUserWelcome is called
      const result = await llmService.handleNewUserWelcome(
        '+999123456789',
        testWorkspaceId,
        'Hello'
      )

      // THEN: Should use ENGLISH (explicit language wins)
      expect(result.success).toBe(true)
      expect(result.debugInfo.detectedLanguage).toBe('en')
      console.log(`✅ EDGE CASE PASSED: Explicit language used even with unknown phone prefix`)
    })
  })

  describe('SCENARIO 4: Verify Translation Layer Integration', () => {
    it('should pass through SafetyTranslationAgent with correct language', async () => {
      // GIVEN: Customer with explicit language
      const customer = await prisma.customers.create({
        data: {
          workspaceId: testWorkspaceId,
          phone: '+39555666777',
          name: 'Test Customer',
          language: 'en',
          email: 'test@example.com',
          status: 'ACTIVE',
        },
      })

      // WHEN: handleNewUserWelcome is called
      const result = await llmService.handleNewUserWelcome(
        '+39555666777',
        testWorkspaceId,
        'Hello'
      )

      // THEN: Verify translation layer was used
      expect(result.success).toBe(true)
      expect(result.debugInfo.translationLayerPassed).toBe(true)
      expect(result.debugInfo.detectedLanguage).toBe('en')
      
      // Verify message contains registration link
      expect(result.message).toContain('http')
      expect(result.message).toContain('/s/') // Short URL pattern
      
      console.log(`✅ TRANSLATION LAYER VERIFIED: SafetyTranslationAgent processed message correctly`)
    })
  })
})
