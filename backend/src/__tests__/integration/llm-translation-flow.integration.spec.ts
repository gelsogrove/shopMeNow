/**
 * 🔒 LLM → TRANSLATION & SECURITY LAYER - End-to-End Integration Test
 *
 * Questo test verifica il flusso COMPLETO:
 * 1. Database seeded con workspace, customer, products
 * 2. LLM Service genera risposta (simulata)
 * 3. Translation & Security Layer filtra la risposta
 * 4. Verifica che contenuti inappropriati vengono BLOCCATI
 * 5. Verifica che contenuti legittimi passano
 *
 * Questo è il test più importante per dimostrare che il sistema è sicuro.
 *
 * @author Andrea Gelso
 * @date 2025-10-24
 */

import { PrismaClient } from "@prisma/client"
import { MessageSendingService } from "../../services/message-sending.service"
import { TranslationSecurityService } from "../../services/translation-security.service"

const prisma = new PrismaClient()

describe("🔒 LLM → Translation & Security Layer - End-to-End Flow", () => {
  let translationService: TranslationSecurityService
  let messageSendingService: MessageSendingService
  let testWorkspace: any
  let testCustomer: any

  beforeAll(async () => {
    // 1. Initialize services
    translationService = new TranslationSecurityService()
    messageSendingService = new MessageSendingService(prisma)

    // 2. Get test workspace and customer from seed
    testWorkspace = await prisma.workspace.findFirst({
      where: { slug: "altro-gusto" },
    })

    testCustomer = await prisma.customers.findFirst({
      where: {
        workspaceId: testWorkspace?.id,
        language: "IT",
      },
    })

    expect(testWorkspace).toBeDefined()
    expect(testCustomer).toBeDefined()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe("🚫 Scenario 1: LLM genera contenuto con PAROLACCE", () => {
    it("should BLOCK profanity from being sent to customer", async () => {
      // Simula risposta LLM con parolaccia
      const llmResponse =
        "Cazzo, questo prodotto è rotto! Ti rimborsiamo subito."

      // 🔒 Apply Translation & Security Layer
      const workspaceUrl = testWorkspace.url || "http://localhost:3000"
      const allowedLinks = [
        workspaceUrl,
        `${workspaceUrl}/s/`,
        `${workspaceUrl}/orders-public`,
        "https://wa.me/",
      ]

      const result = await translationService.processResponse(
        llmResponse,
        testCustomer.language.toLowerCase(),
        allowedLinks
      )

      // ✅ Verifica che la parolaccia viene BLOCCATA
      expect(result.blocked).toBe(true)
      expect(result.reason).toBe("profanity")
      expect(result.translatedText).toContain("non posso aiutarti")
      expect(result.translatedText).not.toContain("Cazzo")

      console.log("🚨 PROFANITY BLOCKED:", {
        original: llmResponse,
        blocked: result.blocked,
        reason: result.reason,
        replaced: result.translatedText.substring(0, 80),
      })
    }, 30000)

    it("should NOT send message to WhatsApp if blocked by security layer", async () => {
      // Tenta di inviare messaggio con parolaccia via MessageSendingService
      const result = await messageSendingService.sendMessage({
        phoneNumber: testCustomer.phone,
        message: "Cazzo, questo è un test!",
        workspaceId: testWorkspace.id,
        customerId: testCustomer.id,
        sendType: "CHATBOT", // CHATBOT → Security layer applies
        userLanguage: "it",
        chatSessionId: "test-session-123",
      })

      // ✅ Verifica che il messaggio viene BLOCCATO (NON inviato a WhatsApp)
      expect(result.success).toBe(false)
      expect(result.blocked).toBe(true)
      expect(result.blockReason).toBe("profanity")
      expect(result.error).toContain("blocked by security layer")

      console.log("🚨 MESSAGE SEND BLOCKED:", {
        success: result.success,
        blocked: result.blocked,
        reason: result.blockReason,
        error: result.error,
      })
    }, 30000)
  })

  describe("🔗 Scenario 2: LLM genera link ESTERNI non autorizzati", () => {
    it("should BLOCK external links from being sent", async () => {
      // Simula risposta LLM con link esterno
      const llmResponse =
        "Vai su https://google.com per più informazioni sui nostri prodotti!"

      const workspaceUrl = testWorkspace.url || "http://localhost:3000"
      const allowedLinks = [
        workspaceUrl,
        `${workspaceUrl}/s/`,
        "https://wa.me/",
      ]

      const result = await translationService.processResponse(
        llmResponse,
        testCustomer.language.toLowerCase(),
        allowedLinks
      )

      // ✅ Verifica che il link esterno viene BLOCCATO
      expect(result.blocked).toBe(true)
      expect(result.reason).toMatch(/phishing|spam/)
      expect(result.translatedText).not.toContain("google.com")

      console.log("🔗 EXTERNAL LINK BLOCKED:", {
        original: llmResponse,
        blocked: result.blocked,
        reason: result.reason,
      })
    }, 30000)

    it("should ALLOW workspace links to pass through", async () => {
      const workspaceUrl = testWorkspace.url || "http://localhost:3000"
      const shortUrl = `${workspaceUrl}/s/abc123`

      // Simula risposta LLM con link del workspace
      const llmResponse = `Ecco il tuo ordine: ${shortUrl}`

      const allowedLinks = [
        workspaceUrl,
        `${workspaceUrl}/s/`,
        "https://wa.me/",
      ]

      const result = await translationService.processResponse(
        llmResponse,
        testCustomer.language.toLowerCase(),
        allowedLinks
      )

      // ✅ Verifica che il link del workspace PASSA
      expect(result.blocked).toBe(false)
      expect(result.reason).toBeNull()
      expect(result.translatedText).toContain(shortUrl)

      console.log("✅ WORKSPACE LINK ALLOWED:", {
        original: llmResponse,
        blocked: result.blocked,
        translatedText: result.translatedText,
      })
    }, 30000)
  })

  describe("✅ Scenario 3: LLM genera contenuto LEGITTIMO", () => {
    it("should allow legitimate product description to pass", async () => {
      // Simula risposta LLM normale
      const llmResponse =
        "Il Parmigiano Reggiano 24 mesi è un formaggio stagionato eccellente. Costa €45.00 al kg."

      const workspaceUrl = testWorkspace.url || "http://localhost:3000"
      const allowedLinks = [workspaceUrl]

      const result = await translationService.processResponse(
        llmResponse,
        testCustomer.language.toLowerCase(),
        allowedLinks
      )

      // ✅ Verifica che il contenuto PASSA
      expect(result.blocked).toBe(false)
      expect(result.reason).toBeNull()
      expect(result.translatedText).toContain("Parmigiano Reggiano")
      expect(result.translatedText).toContain("€45.00")

      console.log("✅ LEGITIMATE CONTENT PASSED:", {
        original: llmResponse.substring(0, 80),
        blocked: result.blocked,
        translatedLength: result.translatedText.length,
      })
    }, 30000)

    it("should translate content to customer's language", async () => {
      // Simula risposta in italiano per cliente inglese
      const llmResponse = "Grazie per il tuo ordine! Spediremo domani."

      // Get English customer
      const englishCustomer = await prisma.customers.findFirst({
        where: {
          workspaceId: testWorkspace.id,
          language: "ENG",
        },
      })

      if (englishCustomer) {
        const workspaceUrl = testWorkspace.url || "http://localhost:3000"
        const result = await translationService.processResponse(
          llmResponse,
          "en", // Target language: English
          [workspaceUrl]
        )

        // ✅ Verifica traduzione
        expect(result.blocked).toBe(false)
        expect(result.translatedText).toBeDefined()
        // Should contain English words
        expect(
          result.translatedText.toLowerCase().includes("thank") ||
            result.translatedText.toLowerCase().includes("order") ||
            result.translatedText.toLowerCase().includes("ship")
        ).toBe(true)

        console.log("🌐 TRANSLATION APPLIED:", {
          original: llmResponse,
          targetLanguage: "en",
          translated: result.translatedText,
        })
      } else {
        console.log("⚠️  No English customer found, skipping translation test")
      }
    }, 30000)
  })

  describe("🎯 Scenario 4: Decision Matrix - Quando Security Layer si applica", () => {
    it("should apply security layer for CHATBOT messages", async () => {
      const result = await messageSendingService.sendMessage({
        phoneNumber: testCustomer.phone,
        message: "Test message with word: cazzo",
        workspaceId: testWorkspace.id,
        customerId: testCustomer.id,
        sendType: "CHATBOT", // ← Security applies
        userLanguage: "it",
        chatSessionId: "test-123",
      })

      // Should be blocked
      expect(result.blocked).toBe(true)
      expect(result.securityChecked).toBe(true)
    }, 30000)

    it("should apply security layer for CAMPAIGN messages", async () => {
      const result = await messageSendingService.sendMessage({
        phoneNumber: testCustomer.phone,
        message: "Campaign: Cazzo, offerta speciale!",
        workspaceId: testWorkspace.id,
        customerId: testCustomer.id,
        sendType: "CAMPAIGN", // ← Security applies
        userLanguage: "it",
        chatSessionId: "test-456",
      })

      // Should be blocked
      expect(result.blocked).toBe(true)
      expect(result.securityChecked).toBe(true)
    }, 30000)

    it("should SKIP security layer for ADMIN_MANUAL messages", async () => {
      const result = await messageSendingService.sendMessage({
        phoneNumber: testCustomer.phone,
        message: "Admin message: order confirmed", // No profanity
        workspaceId: testWorkspace.id,
        customerId: testCustomer.id,
        sendType: "ADMIN_MANUAL", // ← Security SKIPPED
        userLanguage: "it",
        skipSecurityLayer: true,
      })

      // Should NOT be checked by security layer
      expect(result.securityChecked).toBe(false)
      // Note: Will fail if WhatsApp API not configured, but that's expected
    }, 10000)
  })

  describe("📊 Scenario 5: Database Integration", () => {
    it("should have workspace with agent config for LLM", async () => {
      const agentConfig = await prisma.agentConfig.findFirst({
        where: { workspaceId: testWorkspace.id },
      })

      expect(agentConfig).toBeDefined()
      expect(agentConfig?.isActive).toBe(true)
      expect(agentConfig?.model).toBeDefined()
      expect(agentConfig?.prompt).toBeDefined()

      console.log("🤖 Agent Config:", {
        model: agentConfig?.model,
        promptLength: agentConfig?.prompt?.length,
        isActive: agentConfig?.isActive,
      })
    })

    it("should have test customers with different languages", async () => {
      const customers = await prisma.customers.findMany({
        where: { workspaceId: testWorkspace.id },
      })

      const languages = customers.map((c) => c.language)
      expect(languages).toContain("IT")
      expect(languages).toContain("ENG")
      expect(languages).toContain("ESP")
      expect(languages).toContain("PRT")

      console.log("👥 Test Customers:", {
        total: customers.length,
        languages: languages,
      })
    })

    it("should have products for testing product queries", async () => {
      const products = await prisma.products.findMany({
        where: { workspaceId: testWorkspace.id },
        take: 5,
      })

      expect(products.length).toBeGreaterThan(0)

      console.log("📦 Test Products:", {
        total: products.length,
        examples: products.map((p) => ({
          name: p.name,
          price: p.price,
          stock: p.stock,
        })),
      })
    })
  })
})
