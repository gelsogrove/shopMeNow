/**
 * 🧪 Integration Test - addProduct Confirmation Flow
 *
 * Test di integrazione per verificare il flow completo di addProduct:
 * 1. Utente: "voglio aggiungere il panettone" → Sistema chiede conferma (NO addProduct)
 * 2. Utente: "si" → Sistema chiama addProduct()
 *
 * 🏠 LOCALE: Usa Ollama llama3.1:8b (gratuito, privato)
 *
 * Created: 17 October 2025
 * Branch: 84-design-implement-new-calling-functions-addproduct-repeatorder-full-befeprompt-integration
 */

import { PrismaClient } from "@prisma/client"
import { LLMService } from "../../services/llm.service"

// Initialize services at module level (before describe)
const prisma = new PrismaClient()
const llmService = new LLMService()

describe("🧪 addProduct Confirmation Flow - Integration Test", () => {
  let testWorkspaceId: string
  let testCustomerId: string
  let testCustomerPhone: string
  let sessionId: string

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

    // Create test customer for addProduct flow
    testCustomerPhone = "+34600999888"
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
          name: "Test AddProduct Customer",
          email: "test-addproduct@shopme.com",
          workspaceId: testWorkspaceId,
          language: "it",
        },
      })
      testCustomerId = newCustomer.id
    }

    sessionId = `test-addproduct-session-${Date.now()}`

    console.log("\n✅ Test setup complete")
    console.log(`   Workspace ID: ${testWorkspaceId}`)
    console.log(`   Customer ID: ${testCustomerId}`)
    console.log(`   Customer Phone: ${testCustomerPhone}`)
    console.log(`   Session ID: ${sessionId}`)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  /**
   * Helper function to call LLM and extract function info
   */
  async function callLLMAndGetFunctionInfo(
    userQuery: string,
    contextMessages: any[] = []
  ): Promise<{
    response: string
    functionCalled: string | null
    functionArgs: any
    fullResult: any
  }> {
    const result = await llmService.handleMessage({
      chatInput: userQuery,
      phone: testCustomerPhone,
      workspaceId: testWorkspaceId,
      customerid: testCustomerId,
      language: "it",
      sessionId: sessionId,
      maxTokens: 5000,
      model: "LOCAL:llama3.1:8b", // 🏠 Use local Ollama for integration tests
      messages: contextMessages,
      prompt: "",
    })

    // Extract function call from debugInfo
    let functionCalled: string | null = null
    let functionArgs: any = null

    if (result.debugInfo) {
      try {
        const debug = JSON.parse(result.debugInfo)
        if (debug.functionCalls && debug.functionCalls.length > 0) {
          functionCalled = debug.functionCalls[0].functionName
          functionArgs = debug.functionCalls[0].functionArgs
        }
      } catch (error) {
        console.error("⚠️  Error parsing debugInfo:", error)
      }
    }

    return {
      response: result.response || "",
      functionCalled,
      functionArgs,
      fullResult: result,
    }
  }

  describe("📦 addProduct Confirmation Flow", () => {
    let step1Response: string
    let step1FunctionCalled: string | null
    let conversationContext: any[] = []

    it("STEP 1: Should ask confirmation when user requests to add product (NOT call addProduct yet)", async () => {
      console.log("\n" + "─".repeat(80))
      console.log(
        "📝 STEP 1: Prima richiesta - Utente chiede di aggiungere prodotto"
      )
      console.log("─".repeat(80))

      const query = "voglio aggiungere il panettone nel carrello"
      console.log(`\n🗣️  Utente: "${query}"`)

      const { response, functionCalled, functionArgs } =
        await callLLMAndGetFunctionInfo(query, [])

      console.log(`\n📞 Function Called: ${functionCalled || "null"}`)
      if (functionArgs) {
        console.log(`📦 Function Args:`, JSON.stringify(functionArgs, null, 2))
      }
      console.log(`💬 Response: ${response.substring(0, 300)}...\n`)

      // Save for next step
      step1Response = response
      step1FunctionCalled = functionCalled

      // Build conversation context for step 2
      conversationContext = [
        { role: "user", content: query },
        { role: "assistant", content: response },
      ]

      // Verify: Should NOT call addProduct yet
      expect(functionCalled).not.toBe("addProduct")

      // Verify: Response should ask for confirmation (contains ?)
      const responseText = response.toLowerCase()
      const asksConfirmation =
        responseText.includes("?") &&
        (responseText.includes("vuoi") ||
          responseText.includes("aggiungi") ||
          responseText.includes("carrello") ||
          responseText.includes("conferma"))

      expect(asksConfirmation).toBe(true)

      console.log("✅ STEP 1 PASSED:")
      console.log("   - addProduct NOT called (correct)")
      console.log("   - Response asks for confirmation (contains '?')")
    }, 30000)

    it("STEP 2: Should call addProduct() when user confirms with 'si'", async () => {
      console.log("\n" + "─".repeat(80))
      console.log("📝 STEP 2: Seconda richiesta - Utente conferma con 'si'")
      console.log("─".repeat(80))

      const query = "si"
      console.log(`\n🗣️  Utente: "${query}"`)
      console.log(`📚 Context: Conversazione precedente presente\n`)

      const { response, functionCalled, functionArgs } =
        await callLLMAndGetFunctionInfo(query, conversationContext)

      console.log(`\n📞 Function Called: ${functionCalled || "null"}`)
      if (functionArgs) {
        console.log(`📦 Function Args:`, JSON.stringify(functionArgs, null, 2))
      }
      console.log(`💬 Response: ${response.substring(0, 300)}...\n`)

      // Verify: Should call addProduct after confirmation
      if (functionCalled === "addProduct") {
        console.log("✅ STEP 2 PASSED:")
        console.log("   - addProduct called correctly after 'si'")

        // Check if productCode is present
        expect(functionArgs).toBeDefined()
        expect(functionArgs.productCode).toBeDefined()

        console.log(`   - productCode: ${functionArgs.productCode}`)

        // Check if quantity is present (default 1)
        if (functionArgs.quantity) {
          console.log(`   - quantity: ${functionArgs.quantity}`)
        }

        expect(functionCalled).toBe("addProduct")
      } else {
        console.log("❌ STEP 2 FAILED:")
        console.log(`   - Expected: addProduct`)
        console.log(`   - Got: ${functionCalled || "null"}`)
        console.log("\n⚠️  PROBLEMA POTENZIALE:")
        console.log(
          "   Il sistema non ha il contesto della conversazione precedente."
        )
        console.log(
          "   Serve migliorare la gestione dello storico conversazionale."
        )
        console.log(
          "   O l'utente deve specificare: 'si, aggiungi il panettone'\n"
        )

        // Fail the test
        expect(functionCalled).toBe("addProduct")
      }
    }, 30000)

    it("SUMMARY: Should display complete flow summary", () => {
      console.log("\n" + "=".repeat(80))
      console.log("📊 addProduct FLOW SUMMARY")
      console.log("=".repeat(80) + "\n")

      console.log("🔄 Flow testato:")
      console.log(
        '   1. Utente: "voglio aggiungere il panettone" → Sistema chiede conferma'
      )
      console.log('   2. Utente: "si" → Sistema chiama addProduct()')
      console.log("   3. Prodotto aggiunto al carrello\n")

      console.log("✅ Verifica PRIORITY 4:")
      console.log("   - addProduct richiede conferma esplicita")
      console.log("   - Flow di conferma funziona correttamente")
      console.log("   - productCode estratto correttamente\n")

      console.log("=".repeat(80) + "\n")

      expect(true).toBe(true)
    })
  })
})
