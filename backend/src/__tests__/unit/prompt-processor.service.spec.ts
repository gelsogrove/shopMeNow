import { PromptProcessorService } from "../../services/prompt-processor.service"

// Mock del MessageRepository
jest.mock("../../repositories/message.repository", () => {
  return {
    MessageRepository: jest.fn().mockImplementation(() => {
      return {}
    }),
  }
})

// Mock di fs per evitare scrittura reale di file durante i test
jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}))

describe("PromptProcessorService - Variable Replacement", () => {
  let promptProcessor: PromptProcessorService

  beforeEach(() => {
    promptProcessor = new PromptProcessorService()
  })

  describe("preProcessPrompt - Complete Variable Replacement Test", () => {
    it("should replace ALL dynamic variables in prompt correctly", async () => {
      // ARRANGE - Template prompt con TUTTE le variabili
      const templatePrompt = `
# ASSISTENTE L'ALTRA ITALIA 🇮🇹

## 👤 USER INFORMATION
- Nome utente: {{nameUser}}
- Sconto utente sui prodotti: {{discountUser}} %
- Società: {{companyName}}
- Ultimo ordine effettuato: {{lastordercode}}
- Lingua dell'utente: {{languageUser}}

## 📦 DATI DINAMICI

### LIST OFFERTE
{{OFFERS}}

### LISTA CATEGORIE
{{CATEGORIES}}

### LISTA PRODOTTI
{{PRODUCTS}}

### LISTA SERVIZI
{{SERVICES}}

### FAQ
{{FAQ}}

Rispondi SEMPRE in: **{{languageUser}}**
      `.trim()

      // Customer data
      const customerData = {
        nameUser: "Andrea Rossi",
        discountUser: "15",
        companyName: "L'Altra Italia",
        lastordercode: "ORD-123-2024",
        languageUser: "es",
      }

      // Dynamic content
      const dynamicContent = {
        faqs: "FAQ1: Come fare un ordine?\nFAQ2: Tempi di consegna?",
        products:
          "• Parmigiano Reggiano - €25.00\n• Prosciutto di Parma - €18.50",
        categories: "• Formaggi e Latticini\n• Salumi e Insaccati",
        services: "• Spedizione Express - €10\n• Imballaggio Regalo - €5",
        offers: "🎉 SCONTO 20% su Prodotti Surgelati fino al 31/12/2024",
      }

      // ACT
      const result = await promptProcessor.preProcessPrompt(
        templatePrompt,
        "test-workspace-id",
        customerData,
        dynamicContent
      )

      // ASSERT - Verifica che NESSUNA variabile {{xxx}} sia rimasta
      expect(result).not.toContain("{{nameUser}}")
      expect(result).not.toContain("{{discountUser}}")
      expect(result).not.toContain("{{companyName}}")
      expect(result).not.toContain("{{lastordercode}}")
      expect(result).not.toContain("{{languageUser}}")
      expect(result).not.toContain("{{OFFERS}}")
      expect(result).not.toContain("{{PRODUCTS}}")
      expect(result).not.toContain("{{CATEGORIES}}")
      expect(result).not.toContain("{{SERVICES}}")
      expect(result).not.toContain("{{FAQ}}")

      // ASSERT - Verifica che i valori siano stati sostituiti correttamente
      expect(result).toContain("Andrea Rossi")
      expect(result).toContain("15 %")
      expect(result).toContain("L'Altra Italia")
      expect(result).toContain("ORD-123-2024")
      expect(result).toContain("es")
      expect(result).toContain("SCONTO 20% su Prodotti Surgelati")
      expect(result).toContain("Parmigiano Reggiano")
      expect(result).toContain("Formaggi e Latticini")
      expect(result).toContain("Spedizione Express")
      expect(result).toContain("FAQ1: Come fare un ordine?")

      // ASSERT - Verifica che **{{languageUser}}** sia sostituito OVUNQUE appaia
      const languageMatches = result.match(/\*\*es\*\*/g)
      expect(languageMatches).not.toBeNull()
      expect(languageMatches!.length).toBeGreaterThan(0)
    })

    it("should handle missing customer data with default values", async () => {
      // ARRANGE
      const templatePrompt = `
Nome: {{nameUser}}
Sconto: {{discountUser}}
Company: {{companyName}}
Ultimo Ordine: {{lastordercode}}
Lingua: {{languageUser}}
      `.trim()

      const customerData = {} // Dati vuoti

      const dynamicContent = {
        faqs: "",
        products: "",
        categories: "",
        services: "",
        offers: "",
      }

      // ACT
      const result = await promptProcessor.preProcessPrompt(
        templatePrompt,
        "test-workspace-id",
        customerData,
        dynamicContent
      )

      // ASSERT - Verifica valori di default
      expect(result).toContain("Cliente") // default nameUser
      expect(result).toContain("Nessuno sconto attivo") // default discountUser
      expect(result).toContain("L'Altra Italia") // default companyName
      expect(result).toContain("N/A") // default lastordercode
      expect(result).toContain("it") // default languageUser

      // Verifica che non ci siano più placeholder
      expect(result).not.toContain("{{nameUser}}")
      expect(result).not.toContain("{{discountUser}}")
      expect(result).not.toContain("{{companyName}}")
      expect(result).not.toContain("{{lastordercode}}")
      expect(result).not.toContain("{{languageUser}}")
    })

    it("should replace multiple occurrences of the same variable", async () => {
      // ARRANGE - Template con variabili ripetute
      const templatePrompt = `
Ciao {{nameUser}}, benvenuto!
Il tuo sconto è: {{discountUser}}%
Promemoria: {{nameUser}}, hai uno sconto del {{discountUser}}%
Lingua preferita: {{languageUser}}
Rispondi sempre in: {{languageUser}}
      `.trim()

      const customerData = {
        nameUser: "Maria Garcia",
        discountUser: "10",
        languageUser: "pt",
      }

      const dynamicContent = {
        faqs: "",
        products: "",
        categories: "",
        services: "",
        offers: "",
      }

      // ACT
      const result = await promptProcessor.preProcessPrompt(
        templatePrompt,
        "test-workspace-id",
        customerData,
        dynamicContent
      )

      // ASSERT - Verifica che TUTTE le occorrenze siano sostituite
      const mariaCount = (result.match(/Maria Garcia/g) || []).length
      const discountCount = (result.match(/10%/g) || []).length
      const languageCount = (result.match(/pt/g) || []).length

      expect(mariaCount).toBe(2) // Due occorrenze di {{nameUser}}
      expect(discountCount).toBe(2) // Due occorrenze di {{discountUser}}
      expect(languageCount).toBe(2) // Due occorrenze di {{languageUser}}

      // Verifica che non rimangano placeholder
      expect(result).not.toContain("{{nameUser}}")
      expect(result).not.toContain("{{discountUser}}")
      expect(result).not.toContain("{{languageUser}}")
    })

    it("should handle empty dynamic content gracefully", async () => {
      // ARRANGE - Template con placeholder dinamici
      const templatePrompt = `
OFFERTE: {{OFFERS}}
PRODOTTI: {{PRODUCTS}}
FAQ: {{FAQ}}
CATEGORIE: {{CATEGORIES}}
SERVIZI: {{SERVICES}}
      `.trim()

      const customerData = {
        nameUser: "Test User",
        languageUser: "en",
      }

      const dynamicContent = {
        faqs: "",
        products: "",
        categories: "",
        services: "",
        offers: "",
      }

      // ACT
      const result = await promptProcessor.preProcessPrompt(
        templatePrompt,
        "test-workspace-id",
        customerData,
        dynamicContent
      )

      // ASSERT - Verifica che i placeholder siano sostituiti con stringhe vuote
      expect(result).not.toContain("{{OFFERS}}")
      expect(result).not.toContain("{{PRODUCTS}}")
      expect(result).not.toContain("{{FAQ}}")
      expect(result).not.toContain("{{CATEGORIES}}")
      expect(result).not.toContain("{{SERVICES}}")

      // Il risultato dovrebbe contenere solo le label senza contenuto
      expect(result).toContain("OFFERTE:")
      expect(result).toContain("PRODOTTI:")
      expect(result).toContain("FAQ:")
      expect(result).toContain("CATEGORIE:")
      expect(result).toContain("SERVIZI:")
    })

    it("should replace variables in real prompt_agent.md format", async () => {
      // ARRANGE - Simulazione del formato reale di prompt_agent.md
      const templatePrompt = `
# ASSISTENTE L'ALTRA ITALIA 🇮🇹

## 👤 USER INFORMATION
- Nome utente: {{nameUser}}
- Sconto utente sui prodotti: {{discountUser}} %
- Ultimo ordine effettuato: {{lastordercode}}
- Lingua dell'utente: {{languageUser}}

## 🌍 LINGUA OBBLIGATORIA
Rispondi SEMPRE in: **{{languageUser}}**

### LISTA PRODOTTI
{{PRODUCTS}}

### FAQ
{{FAQ}}

RISPONDI SEMPRE OVVIMANETE IN : **{{languageUser}}**
      `.trim()

      const customerData = {
        nameUser: "João Silva",
        discountUser: "25",
        lastordercode: "ORD-456-2024",
        languageUser: "pt",
      }

      const dynamicContent = {
        faqs: "1. Como fazer um pedido?\n2. Quais são os prazos de entrega?",
        products: "• Mozzarella di Bufala - €12.00\n• Burrata - €15.00",
        categories: "",
        services: "",
        offers: "",
      }

      // ACT
      const result = await promptProcessor.preProcessPrompt(
        templatePrompt,
        "test-workspace-id",
        customerData,
        dynamicContent
      )

      // ASSERT - Verifica sostituzione completa
      expect(result).toContain("João Silva")
      expect(result).toContain("25 %")
      expect(result).toContain("ORD-456-2024")
      expect(result).toContain("**pt**") // Formato markdown
      expect(result).toContain("Como fazer um pedido?")
      expect(result).toContain("Mozzarella di Bufala")

      // CRITICAL: Verifica che NON rimanga NESSUN placeholder
      expect(result).not.toMatch(/\{\{.*?\}\}/)

      // Verifica che {{languageUser}} sia sostituito in TUTTI i posti
      const ptMatches = result.match(/pt/g)
      expect(ptMatches).not.toBeNull()
      expect(ptMatches!.length).toBeGreaterThanOrEqual(3) // Almeno 3 occorrenze
    })
  })

  describe("Critical Edge Cases", () => {
    it("should NOT leave any {{variable}} placeholder in final output", async () => {
      // ARRANGE - Template complesso con tutte le variabili possibili
      const templatePrompt = `
USER: {{nameUser}} - {{discountUser}}% - {{companyName}}
ORDER: {{lastordercode}} - LANG: {{languageUser}}
DYNAMIC: {{OFFERS}} {{PRODUCTS}} {{CATEGORIES}} {{SERVICES}} {{FAQ}}
REPEAT: {{nameUser}} {{languageUser}} {{discountUser}}
      `.trim()

      const customerData = {
        nameUser: "Test",
        discountUser: "10",
        companyName: "Test Company",
        lastordercode: "TEST-001",
        languageUser: "en",
      }

      const dynamicContent = {
        faqs: "FAQ content",
        products: "Product list",
        categories: "Categories",
        services: "Services",
        offers: "Offers",
      }

      // ACT
      const result = await promptProcessor.preProcessPrompt(
        templatePrompt,
        "test-workspace-id",
        customerData,
        dynamicContent
      )

      // ASSERT CRITICO - Usa regex per trovare QUALSIASI placeholder rimasto
      const remainingPlaceholders = result.match(/\{\{[^}]+\}\}/g)

      expect(remainingPlaceholders).toBeNull() // DEVE essere null, nessun placeholder
      if (remainingPlaceholders) {
        console.error(
          "❌ PLACEHOLDER RIMASTI NEL PROMPT:",
          remainingPlaceholders
        )
        throw new Error(
          `Found unreplaced placeholders: ${remainingPlaceholders.join(", ")}`
        )
      }
    })

    it("should handle null/undefined customerData without crashing", async () => {
      // ARRANGE
      const templatePrompt =
        "Hello {{nameUser}}, discount: {{discountUser}}%, lang: {{languageUser}}"

      const dynamicContent = {
        faqs: "",
        products: "",
        categories: "",
        services: "",
        offers: "",
      }

      // ACT & ASSERT - Non deve crashare
      const result1 = await promptProcessor.preProcessPrompt(
        templatePrompt,
        "test-workspace-id",
        null as any,
        dynamicContent
      )

      const result2 = await promptProcessor.preProcessPrompt(
        templatePrompt,
        "test-workspace-id",
        undefined as any,
        dynamicContent
      )

      // Deve ritornare il template originale o con valori default
      expect(result1).toBeTruthy()
      expect(result2).toBeTruthy()
    })
  })
})
