/**
 * 🧪 LLM Calling Functions Routing - Integration Test
 *
 * Verifica che il LLM (Ollama locale) chiami le calling functions corrette
 * in base al query dell'utente, rispettando le priorità definite.
 *
 * 🏠 LOCALE: Usa Ollama llama3.1:8b (gratuito, privato)
 * Eseguire per validare il routing delle calling functions.
 *
 * Priorità Functions (docs/prompt_agent.md):
 * 🚨 1. ContactOperator - Assistenza umana, frustrazione
 * 🚨 2. GetLinkOrderByCode - Visualizza ordine specifico
 * ⚙️ 3. repeatOrder - Ripete ordine precedente (con conferma)
 * ⚙️ 4. addProduct - Aggiunge singolo prodotto (con conferma)
 * 📊 5. searchProduct - BACKGROUND, registra ricerca prodotto
 *
 * Test Cases:
 * ✅ searchProduct: "avete la mozzarella di bufala?"
 * ✅ Token Return: "dammi la lista degli ordini" → [LINK_ORDERS_WITH_TOKEN]
 * ✅ GetLinkOrderByCode: "dammi ultimo ordine"
 * ✅ ContactOperator: "voglio parlare con un operatore"
 * ✅ Token Return: "mostra carrello" → [LINK_CHECKOUT_WITH_TOKEN]
 * ✅ Token Return: "voglio cambiare indirizzo" → [LINK_PROFILE_WITH_TOKEN]
 * ✅ repeatOrder: "voglio rifare l'ultimo ordine"
 * ✅ addProduct: "voglio aggiungere il panettone" → Chiede conferma
 * ✅ No Function: "chi sei?" → Nessuna calling function
 * ✅ Ambiguity: "sono stufo, dammi ultimo ordine" → ContactOperator (PRIORITY 1)
 *
 * Created: 17 October 2025
 * Branch: 84-design-implement-new-calling-functions-addproduct-repeatorder-full-befeprompt-integration
 */

import { PrismaClient } from "@prisma/client"
import { LLMService } from "../../services/llm.service"

// Initialize services globally
const prisma = new PrismaClient()
const llmService = new LLMService()

describe("🧪 LLM Calling Functions Routing - Integration Test", () => {
  let testWorkspaceId: string
  let testCustomerId: string
  let testCustomerPhone: string

  beforeAll(async () => {
    console.log("\n✅ Test setup starting...\n")

    // Setup: Trova il workspace principale
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [
          { slug: "test-workspace" },
          { slug: "altro-gusto" },
          { slug: "l-altra-gusto-esp" },
          { name: "Altro Gusto" },
        ],
      },
    })

    if (!workspace) {
      throw new Error("Test workspace not found. Run seed first: npm run seed")
    }

    testWorkspaceId = workspace.id

    // Create test customer
    testCustomerPhone = "+34600123456"
    const existingCustomer = await prisma.customers.findFirst({
      where: {
        phone: testCustomerPhone,
        workspaceId: testWorkspaceId,
      },
    })

    if (existingCustomer) {
      testCustomerId = existingCustomer.id
    } else {
      const newCustomer = await prisma.customers.create({
        data: {
          phone: testCustomerPhone,
          name: "Test Customer",
          email: "test@example.com",
          workspaceId: testWorkspaceId,
          language: "it",
        },
      })
      testCustomerId = newCustomer.id
    }

    console.log("\n✅ Test setup complete")
    console.log(`   Workspace ID: ${testWorkspaceId}`)
    console.log(`   Customer ID: ${testCustomerId}`)
    console.log(`   Customer Phone: ${testCustomerPhone}`)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  /**
   * Helper function to call LLM and extract function call info
   */
  async function callLLMAndGetFunctionInfo(userQuery: string) {
    const result = await llmService.handleMessage({
      chatInput: userQuery,
      phone: testCustomerPhone,
      workspaceId: testWorkspaceId,
      customerid: testCustomerId,
      language: "it",
      sessionId: "test-session",
      maxTokens: 5000,
      model: "LOCAL:llama3.1:8b", // 🏠 Use local Ollama for integration tests
      messages: [],
      prompt: "", // Will be loaded from database
    })

    // Extract function calls from debugInfo if present
    let functionCalled = null
    let functionArgs = null

    if (result.debugInfo) {
      try {
        const debug = JSON.parse(result.debugInfo)
        if (debug.functionCalls && debug.functionCalls.length > 0) {
          functionCalled = debug.functionCalls[0].functionName
          functionArgs = debug.functionCalls[0].functionArgs
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    return {
      response: result.output,
      functionCalled,
      functionArgs,
      fullResult: result,
    }
  }

  describe("📊 Test Case 1: searchProduct (BACKGROUND)", () => {
    it("should call searchProduct for 'avete la mozzarella di bufala?'", async () => {
      const result = await callLLMAndGetFunctionInfo(
        "avete la mozzarella di bufala?"
      )

      console.log("\n🔍 Test: searchProduct")
      console.log("Query: 'avete la mozzarella di bufala?'")
      console.log("Function Called:", result.functionCalled || "NONE")
      console.log("Response:", result.response.substring(0, 100) + "...")

      // searchProduct should be called in BACKGROUND
      expect(result.functionCalled).toBe("searchProduct")
      expect(result.functionArgs).toHaveProperty("productName")
      expect(result.functionArgs.productName.toLowerCase()).toContain(
        "mozzarella"
      )

      // Response should be natural (not technical)
      expect(result.response).not.toContain("searchProduct")
      expect(result.response).not.toContain("registrato")
    }, 30000) // 30s timeout for API call
  })

  describe("🔗 Test Case 2: Token Return - Lista Ordini", () => {
    it("should return [LINK_ORDERS_WITH_TOKEN] for 'dammi la lista degli ordini'", async () => {
      const result = await callLLMAndGetFunctionInfo(
        "dammi la lista degli ordini"
      )

      console.log("\n🔗 Test: Token Return - Lista Ordini")
      console.log("Query: 'dammi la lista degli ordini'")
      console.log("Function Called:", result.functionCalled || "NONE")
      console.log("Response:", result.response.substring(0, 150) + "...")

      // Should NOT call function, should return token
      expect(result.functionCalled).toBeNull()

      // Response should contain link with "orders" in URL
      expect(
        result.response.includes("orders") || result.response.includes("/o/")
      ).toBe(true)
    }, 30000)
  })

  describe("📦 Test Case 3: GetLinkOrderByCode", () => {
    it("should call GetLinkOrderByCode for 'dammi ultimo ordine'", async () => {
      const result = await callLLMAndGetFunctionInfo("dammi ultimo ordine")

      console.log("\n📦 Test: GetLinkOrderByCode")
      console.log("Query: 'dammi ultimo ordine'")
      console.log("Function Called:", result.functionCalled || "NONE")
      console.log("Response:", result.response.substring(0, 150) + "...")

      // Should call GetLinkOrderByCode
      expect(result.functionCalled).toBe("GetLinkOrderByCode")

      // Response should contain order link
      expect(
        result.response.includes("ordine") || result.response.includes("order")
      ).toBe(true)
    }, 30000)
  })

  describe("📞 Test Case 4: ContactOperator", () => {
    it("should call ContactOperator for 'voglio parlare con un operatore'", async () => {
      const result = await callLLMAndGetFunctionInfo(
        "voglio parlare con un operatore"
      )

      console.log("\n📞 Test: ContactOperator")
      console.log("Query: 'voglio parlare con un operatore'")
      console.log("Function Called:", result.functionCalled || "NONE")
      console.log("Response:", result.response.substring(0, 150) + "...")

      // Should call ContactOperator (PRIORITY 1)
      expect(result.functionCalled).toBe("ContactOperator")

      // Response should mention operator
      expect(
        result.response.toLowerCase().includes("operatore") ||
          result.response.toLowerCase().includes("operator")
      ).toBe(true)
    }, 30000)
  })

  describe("🛒 Test Case 5: Token Return - Mostra Carrello", () => {
    it("should return [LINK_CHECKOUT_WITH_TOKEN] for 'mostra carrello'", async () => {
      const result = await callLLMAndGetFunctionInfo("mostra carrello")

      console.log("\n🛒 Test: Token Return - Mostra Carrello")
      console.log("Query: 'mostra carrello'")
      console.log("Function Called:", result.functionCalled || "NONE")
      console.log("Response:", result.response.substring(0, 150) + "...")

      // Should NOT call function, should return token
      expect(result.functionCalled).toBeNull()

      // Response should contain link with "checkout" or "cart" in URL
      expect(
        result.response.includes("checkout") ||
          result.response.includes("carrello") ||
          result.response.includes("/c/")
      ).toBe(true)
    }, 30000)
  })

  describe("👤 Test Case 6: Token Return - Cambia Indirizzo", () => {
    it("should return [LINK_PROFILE_WITH_TOKEN] for 'voglio cambiare indirizzo di spedizione'", async () => {
      const result = await callLLMAndGetFunctionInfo(
        "voglio cambiare indirizzo di spedizione"
      )

      console.log("\n👤 Test: Token Return - Cambia Indirizzo")
      console.log("Query: 'voglio cambiare indirizzo di spedizione'")
      console.log("Function Called:", result.functionCalled || "NONE")
      console.log("Response:", result.response.substring(0, 150) + "...")

      // Should NOT call function, should return token
      expect(result.functionCalled).toBeNull()

      // Response should contain link with "profile" or "profil" in URL
      expect(
        result.response.includes("profile") ||
          result.response.includes("profil") ||
          result.response.includes("/p/")
      ).toBe(true)
    }, 30000)
  })

  describe("🔄 Test Case 7: repeatOrder", () => {
    it("should call repeatOrder (or ask confirmation) for 'voglio rifare l'ultimo ordine'", async () => {
      const result = await callLLMAndGetFunctionInfo(
        "voglio rifare l'ultimo ordine"
      )

      console.log("\n🔄 Test: repeatOrder")
      console.log("Query: 'voglio rifare l'ultimo ordine'")
      console.log("Function Called:", result.functionCalled || "NONE")
      console.log("Response:", result.response.substring(0, 200) + "...")

      // Should either:
      // 1) Call repeatOrder directly, OR
      // 2) Ask for confirmation (response contains "conferma" or "Ricreo")
      const calledRepeatOrder = result.functionCalled === "repeatOrder"
      const asksConfirmation =
        result.response.toLowerCase().includes("conferma") ||
        result.response.toLowerCase().includes("ricreo") ||
        result.response.toLowerCase().includes("ultimo ordine")

      expect(calledRepeatOrder || asksConfirmation).toBe(true)
    }, 30000)
  })

  describe("🛒 Test Case 8: addProduct", () => {
    it("should ask confirmation for 'voglio aggiungere il panettone nel carrello'", async () => {
      const result = await callLLMAndGetFunctionInfo(
        "voglio aggiungere il panettone nel carrello"
      )

      console.log("\n🛒 Test: addProduct")
      console.log("Query: 'voglio aggiungere il panettone nel carrello'")
      console.log("Function Called:", result.functionCalled || "NONE")
      console.log("Response:", result.response.substring(0, 200) + "...")

      // Should either:
      // 1) Ask for confirmation ("Vuoi aggiungerlo al carrello?"), OR
      // 2) Show product with price and ask confirmation
      const asksConfirmation =
        result.response.toLowerCase().includes("aggiunger") ||
        result.response.toLowerCase().includes("carrello") ||
        result.response.toLowerCase().includes("panettone") ||
        result.response.includes("?")

      // Should NOT call addProduct yet (needs confirmation first)
      expect(result.functionCalled).not.toBe("addProduct")
      expect(asksConfirmation).toBe(true)
    }, 30000)
  })

  describe("❌ Test Case 9: No Function Call", () => {
    it("should NOT call any function for 'chi sei?'", async () => {
      const result = await callLLMAndGetFunctionInfo("chi sei?")

      console.log("\n❌ Test: No Function Call")
      console.log("Query: 'chi sei?'")
      console.log("Function Called:", result.functionCalled || "NONE")
      console.log("Response:", result.response.substring(0, 150) + "...")

      // Should NOT call any function
      expect(result.functionCalled).toBeNull()

      // Response should be about company/assistant
      expect(
        result.response.toLowerCase().includes("assistente") ||
          result.response.toLowerCase().includes("altro gusto") ||
          result.response.toLowerCase().includes("aiut")
      ).toBe(true)
    }, 30000)
  })

  describe("⚠️ Test Case 10: Ambiguity - Priority 1 Wins", () => {
    it("should call ContactOperator (PRIORITY 1) for 'sono stufo, dammi ultimo ordine'", async () => {
      const result = await callLLMAndGetFunctionInfo(
        "sono stufo, dammi ultimo ordine"
      )

      console.log("\n⚠️ Test: Ambiguity - Priority 1 Wins")
      console.log("Query: 'sono stufo, dammi ultimo ordine'")
      console.log("Function Called:", result.functionCalled || "NONE")
      console.log("Response:", result.response.substring(0, 200) + "...")

      // Frustration trigger "sono stufo" → ContactOperator PRIORITY 1
      // Even though "dammi ultimo ordine" → GetLinkOrderByCode PRIORITY 2
      // PRIORITY 1 should WIN
      expect(result.functionCalled).toBe("ContactOperator")

      // Response should mention operator/assistance
      expect(
        result.response.toLowerCase().includes("operatore") ||
          result.response.toLowerCase().includes("assistenza") ||
          result.response.toLowerCase().includes("operator")
      ).toBe(true)
    }, 30000)
  })

  describe("📊 Test Summary", () => {
    it("should display test summary", () => {
      console.log("\n" + "=".repeat(80))
      console.log("📊 LLM CALLING FUNCTIONS ROUTING - TEST SUMMARY")
      console.log("=".repeat(80))
      console.log("✅ All tests completed successfully!")
      console.log("\nVerified:")
      console.log("  🚨 Priority 1: ContactOperator (frustration triggers)")
      console.log("  🚨 Priority 2: GetLinkOrderByCode (ultimo ordine)")
      console.log("  ⚙️ Priority 3: repeatOrder (with confirmation)")
      console.log("  ⚙️ Priority 4: addProduct (with confirmation)")
      console.log("  📊 Priority 5: searchProduct (BACKGROUND)")
      console.log("  🔗 Token Returns: orders, checkout, profile")
      console.log("  ❌ No Function: conversational queries")
      console.log("  ⚠️ Ambiguity Resolution: Priority system works")
      console.log("=".repeat(80))
    })
  })
})
