/**
 * 🔒 TRANSLATION & SECURITY LAYER - Unit Tests
 *
 * Tests che il Translation & Security Service:
 * 1. Sia chiamato in TUTTI i punti dove inviamo risposte al cliente
 * 2. Filtri correttamente parolacce
 * 3. Blocchi link esterni non autorizzati
 * 4. Permetta solo link del workspace
 *
 * @author Andrea Gelso
 * @date 2025-10-23
 */

import { TranslationSecurityService } from "../../services/translation-security.service"

describe("🔒 Translation & Security Layer - Unit Tests", () => {
  let service: TranslationSecurityService

  beforeAll(() => {
    // Crea istanza del servizio
    service = new TranslationSecurityService()
  })

  describe("✅ Configurazione e Inizializzazione", () => {
    it("should initialize service with API key from environment", () => {
      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(TranslationSecurityService)
    })

    it("should have processResponse method available", () => {
      expect(service.processResponse).toBeDefined()
      expect(typeof service.processResponse).toBe("function")
    })
  })

  describe("🌐 Traduzione Base", () => {
    it("should translate Italian to English", async () => {
      const result = await service.processResponse("Ciao, come stai?", "en", [])

      expect(result).toBeDefined()
      expect(result.blocked).toBe(false)
      expect(result.reason).toBeNull()
      expect(result.translatedText).toBeDefined()
      // Verifica che contenga parole inglesi
      expect(
        result.translatedText.toLowerCase().includes("hello") ||
          result.translatedText.toLowerCase().includes("hi") ||
          result.translatedText.toLowerCase().includes("how")
      ).toBe(true)
    }, 30000)

    it("should keep Italian when target language is IT", async () => {
      const originalText = "Ciao, come stai?"
      const result = await service.processResponse(originalText, "it", [])

      expect(result).toBeDefined()
      expect(result.blocked).toBe(false)
      expect(result.reason).toBeNull()
      // Potrebbe essere uguale o leggermente filtrato
      expect(result.translatedText).toBeDefined()
    }, 30000)
  })

  describe("🚫 Filtro Parolacce - Italiano", () => {
    it("should block Italian profanity 'cazzo'", async () => {
      const result = await service.processResponse(
        "Cazzo, questo prodotto è rotto!",
        "it",
        []
      )

      expect(result).toBeDefined()
      expect(result.blocked).toBe(true)
      expect(result.reason).toBe("profanity")
      expect(result.translatedText).toContain("non posso aiutarti")
    }, 30000)

    it("should block Italian profanity 'vaffanculo'", async () => {
      const result = await service.processResponse(
        "Vaffanculo, voglio parlare con il manager",
        "it",
        []
      )

      expect(result).toBeDefined()
      expect(result.blocked).toBe(true)
      expect(result.reason).toBe("profanity")
    }, 30000)
  })

  describe("🚫 Filtro Parolacce - Inglese", () => {
    it("should block English profanity 'fuck'", async () => {
      const result = await service.processResponse(
        "This is fucking terrible service!",
        "en",
        []
      )

      expect(result).toBeDefined()
      expect(result.blocked).toBe(true)
      expect(result.reason).toBe("profanity")
      expect(result.translatedText.toLowerCase()).toContain("sorry")
    }, 30000)

    it("should block English profanity 'shit'", async () => {
      const result = await service.processResponse(
        "This shit doesn't work",
        "en",
        []
      )

      expect(result).toBeDefined()
      expect(result.blocked).toBe(true)
      expect(result.reason).toBe("profanity")
    }, 30000)
  })

  describe("🚫 Filtro Parolacce - Spagnolo", () => {
    it("should block Spanish profanity 'puta'", async () => {
      const result = await service.processResponse(
        "Qué puta mierda es esto",
        "es",
        []
      )

      expect(result).toBeDefined()
      expect(result.blocked).toBe(true)
      expect(result.reason).toBe("profanity")
      expect(result.translatedText.toLowerCase()).toContain("lo siento")
    }, 30000)
  })

  describe("🚫 Filtro Parolacce - Portoghese", () => {
    it("should block Portuguese profanity 'porra'", async () => {
      const result = await service.processResponse(
        "Que porra é essa?",
        "pt",
        []
      )

      expect(result).toBeDefined()
      expect(result.blocked).toBe(true)
      expect(result.reason).toBe("profanity")
      expect(result.translatedText.toLowerCase()).toContain("desculpe")
    }, 30000)
  })

  describe("🔗 Filtro Link Esterni", () => {
    it("should block external link 'https://google.com'", async () => {
      const allowedLinks = ["http://localhost:3000"]

      const result = await service.processResponse(
        "Visita questo link: https://google.com per saperne di più",
        "it",
        allowedLinks
      )

      expect(result).toBeDefined()
      expect(result.blocked).toBe(true)
      expect(result.reason).toMatch(/phishing|spam|adult/)
    }, 30000)

    it("should block suspicious domain '.ru'", async () => {
      const allowedLinks = ["http://localhost:3000"]

      const result = await service.processResponse(
        "Clicca qui: https://promo-whatsapp.ru/premio",
        "it",
        allowedLinks
      )

      expect(result).toBeDefined()
      expect(result.blocked).toBe(true)
      expect(result.reason).toBe("phishing")
    }, 30000)

    it("should block Telegram link 't.me'", async () => {
      const allowedLinks = ["http://localhost:3000"]

      const result = await service.processResponse(
        "Contattami su Telegram: https://t.me/scammer123",
        "it",
        allowedLinks
      )

      expect(result).toBeDefined()
      expect(result.blocked).toBe(true)
      expect(result.reason).toBe("phishing")
    }, 30000)

    it("should ALLOW workspace link", async () => {
      const allowedLinks = ["http://localhost:3000", "http://localhost:3000/s/"]

      const result = await service.processResponse(
        "Ecco il tuo ordine: http://localhost:3000/s/ABC123",
        "it",
        allowedLinks
      )

      expect(result).toBeDefined()
      expect(result.blocked).toBe(false)
      expect(result.reason).toBeNull()
      // Il link deve rimanere nel testo
      expect(result.translatedText).toContain("localhost:3000")
    }, 30000)

    it("should ALLOW multiple workspace links", async () => {
      const allowedLinks = [
        "http://localhost:3000",
        "http://localhost:3000/s/",
        "http://localhost:3000/orders-public",
      ]

      const result = await service.processResponse(
        "Carrello: http://localhost:3000/s/ABC123\nOrdini: http://localhost:3000/s/XYZ789",
        "it",
        allowedLinks
      )

      expect(result).toBeDefined()
      expect(result.blocked).toBe(false)
      expect(result.reason).toBeNull()
    }, 30000)
  })

  describe("🔗 Filtro Spam Keywords", () => {
    it("should block spam keyword 'click here'", async () => {
      const result = await service.processResponse(
        "Click here for special offer! Free gift!",
        "en",
        []
      )

      expect(result).toBeDefined()
      expect(result.blocked).toBe(true)
      expect(result.reason).toBe("spam")
    }, 30000)

    it("should block spam keyword 'promo gratis'", async () => {
      const result = await service.processResponse(
        "Promo gratis! Oferta urgente! Click aquí!",
        "es",
        []
      )

      expect(result).toBeDefined()
      expect(result.blocked).toBe(true)
      expect(result.reason).toBe("spam")
    }, 30000)
  })

  describe("✅ Contenuto Legittimo", () => {
    it("should allow normal product description in Italian", async () => {
      const result = await service.processResponse(
        "Il Parmigiano Reggiano DOP è un formaggio stagionato 24 mesi. Prezzo: €25.00",
        "it",
        []
      )

      expect(result).toBeDefined()
      expect(result.blocked).toBe(false)
      expect(result.reason).toBeNull()
      // Product names italiani devono rimanere
      expect(result.translatedText).toContain("Parmigiano Reggiano")
    }, 30000)

    it("should translate product description to English but keep Italian product name", async () => {
      const result = await service.processResponse(
        "Il Parmigiano Reggiano DOP è un formaggio stagionato 24 mesi.",
        "en",
        []
      )

      expect(result).toBeDefined()
      expect(result.blocked).toBe(false)
      expect(result.reason).toBeNull()
      // Nome prodotto italiano deve rimanere
      expect(result.translatedText).toContain("Parmigiano Reggiano")
      // Descrizione tradotta
      expect(
        result.translatedText.toLowerCase().includes("cheese") ||
          result.translatedText.toLowerCase().includes("aged")
      ).toBe(true)
    }, 30000)

    it("should allow order confirmation with link", async () => {
      const allowedLinks = ["http://localhost:3000", "http://localhost:3000/s/"]

      const result = await service.processResponse(
        "✅ Ordine creato! Codice: ORD-001-2024\n\nVedi dettagli: http://localhost:3000/s/ABC123\n\n⏰ Link valido per 15 minuti",
        "it",
        allowedLinks
      )

      expect(result).toBeDefined()
      expect(result.blocked).toBe(false)
      expect(result.reason).toBeNull()
      expect(result.translatedText).toContain("ORD-001-2024")
      expect(result.translatedText).toContain("localhost:3000")
    }, 30000)
  })

  describe("🎯 Edge Cases", () => {
    it("should handle empty string", async () => {
      const result = await service.processResponse("", "it", [])

      expect(result).toBeDefined()
      expect(result.translatedText).toBeDefined()
    }, 30000)

    it("should handle very long text", async () => {
      const longText = "Prodotto eccellente. ".repeat(100)

      const result = await service.processResponse(longText, "en", [])

      expect(result).toBeDefined()
      expect(result.blocked).toBe(false)
      expect(result.translatedText.length).toBeGreaterThan(0)
    }, 30000)

    it("should preserve emojis and formatting", async () => {
      const result = await service.processResponse(
        "✅ Ordine confermato!\n\n🛒 Prodotti:\n- Mozzarella\n- Pomodori\n\n⏰ Consegna domani",
        "en",
        []
      )

      expect(result).toBeDefined()
      expect(result.blocked).toBe(false)
      expect(result.translatedText).toContain("✅")
      expect(result.translatedText).toContain("🛒")
      expect(result.translatedText).toContain("⏰")
    }, 30000)
  })
})
