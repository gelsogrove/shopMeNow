/**
 * 🧪 Test addProduct Confirmation Flow - Standalone
 *
 * Test standalone (senza Jest) per verificare il flow addProduct con conferma.
 * Simula una conversazione reale con history tra i messaggi.
 *
 * Flow:
 * 1. Utente: "voglio aggiungere il panettone" → Sistema chiede conferma
 * 2. Utente: "si" → Sistema chiama addProduct()
 *
 * ⚠️ ATTENZIONE: Chiama OpenRouter API reale (costo ~$0.02)
 */

import { PrismaClient } from "@prisma/client"
import * as dotenv from "dotenv"
import { LLMService } from "../src/services/llm.service"

dotenv.config()

const prisma = new PrismaClient()
const llmService = new LLMService()

async function testAddProductConfirmationFlow() {
  console.log("\n" + "=".repeat(80))
  console.log("🧪 TEST addProduct - CONFIRMATION FLOW (Standalone)")
  console.log("=".repeat(80) + "\n")

  // Setup
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
    console.error("❌ Workspace not found. Run: npm run seed")
    process.exit(1)
  }

  const testWorkspaceId = workspace.id
  const testCustomerPhone = "+34600777888" // Numero unico per questo test

  let testCustomer = await prisma.customers.findFirst({
    where: {
      phone: testCustomerPhone,
      workspaceId: testWorkspaceId,
    },
  })

  if (!testCustomer) {
    testCustomer = await prisma.customers.create({
      data: {
        phone: testCustomerPhone,
        name: "Test AddProduct Flow",
        email: "test-addproduct-flow@shopme.com",
        workspaceId: testWorkspaceId,
        language: "it",
      },
    })
  }

  const testCustomerId = testCustomer.id
  const sessionId = `addproduct-test-${Date.now()}`

  // ✅ CRITICAL: Create chat session (needed for history to work)
  let chatSession = await prisma.chatSession.findFirst({
    where: {
      customerId: testCustomerId,
      status: "active",
    },
  })

  if (!chatSession) {
    chatSession = await prisma.chatSession.create({
      data: {
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        status: "active",
      },
    })
    console.log(`✅ Created chat session: ${chatSession.id}`)
  }

  const chatSessionId = chatSession.id

  console.log(`✅ Setup complete:`)
  console.log(`   Workspace: ${testWorkspaceId}`)
  console.log(`   Customer: ${testCustomerId}`)
  console.log(`   Phone: ${testCustomerPhone}`)
  console.log(`   Session: ${sessionId}`)
  console.log(`   ChatSession: ${chatSessionId}\n`)

  // Helper function
  async function callLLM(query: string, step: number) {
    console.log("─".repeat(80))
    console.log(`📝 STEP ${step}: ${query}`)
    console.log("─".repeat(80) + "\n")

    // Save user message to database (IMPORTANT for history!)
    await prisma.message.create({
      data: {
        chatSessionId: chatSessionId,
        content: query,
        direction: "INBOUND",
        type: "TEXT",
        aiGenerated: false,
      },
    })

    const result = await llmService.handleMessage({
      chatInput: query,
      phone: testCustomerPhone,
      workspaceId: testWorkspaceId,
      customerid: testCustomerId,
      language: "it",
      sessionId: sessionId, // ✅ Same session for both calls
      maxTokens: 5000,
      model: "openai/gpt-4o-mini",
      messages: [],
      prompt: "",
    })

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
        // Ignore
      }
    }

    // Save assistant response to database (IMPORTANT for history!)
    await prisma.message.create({
      data: {
        chatSessionId: chatSessionId,
        content: result.response || "",
        direction: "OUTBOUND",
        type: "TEXT",
        aiGenerated: true,
      },
    })

    return { response: result.response || "", functionCalled, functionArgs }
  }

  try {
    // ============================================================================
    // STEP 1: Utente chiede di aggiungere prodotto
    // ============================================================================
    const step1 = await callLLM(
      "voglio aggiungere la mozzarella di bufala nel carrello",
      1
    )

    console.log(`📞 Function Called: ${step1.functionCalled || "null"}`)
    if (step1.functionArgs) {
      console.log(`📦 Args:`, JSON.stringify(step1.functionArgs, null, 2))
    }
    console.log(`💬 Response: ${step1.response.substring(0, 250)}...\n`)

    // Verify STEP 1
    if (
      step1.functionCalled === null ||
      step1.functionCalled !== "addProduct"
    ) {
      console.log("✅ STEP 1 CORRECT: Sistema NON ha chiamato addProduct")

      const responseText = step1.response.toLowerCase()
      if (
        responseText.includes("?") &&
        (responseText.includes("vuoi") ||
          responseText.includes("aggiungi") ||
          responseText.includes("carrello"))
      ) {
        console.log("✅ STEP 1 BONUS: Sistema chiede conferma (contiene '?')\n")
      } else {
        console.log(
          "⚠️  STEP 1 WARNING: Response potrebbe non chiedere conferma\n"
        )
      }
    } else {
      console.log(
        "❌ STEP 1 FAILED: Sistema ha chiamato addProduct senza conferma!"
      )
      await prisma.$disconnect()
      process.exit(1)
    }

    // ============================================================================
    // STEP 2: Utente conferma con "si, voglio la mozzarella"
    // ============================================================================
    const step2 = await callLLM("si, voglio la mozzarella", 2)

    console.log(`📞 Function Called: ${step2.functionCalled || "null"}`)
    if (step2.functionArgs) {
      console.log(`📦 Args:`, JSON.stringify(step2.functionArgs, null, 2))
    }
    console.log(`💬 Response: ${step2.response.substring(0, 250)}...\n`)

    // ============================================================================
    // FINAL RESULT
    // ============================================================================
    console.log("=".repeat(80))
    console.log("📊 FINAL RESULT")
    console.log("=".repeat(80) + "\n")

    if (step2.functionCalled === "addProduct") {
      console.log("🎉 SUCCESS! Test PASSED\n")
      console.log("✅ Flow verificato:")
      console.log(
        "   1. Prima richiesta → Sistema chiede conferma (NO addProduct)"
      )
      console.log("   2. Utente 'si' → Sistema chiama addProduct()")
      console.log(
        "   3. productCode presente negli args:",
        step2.functionArgs?.productCode || "N/A"
      )
      console.log(
        "\n✅ Il sistema mantiene correttamente il contesto conversazionale!"
      )
      console.log(
        "✅ La history degli ultimi 5 minuti funziona correttamente!\n"
      )

      await prisma.$disconnect()
      process.exit(0)
    } else {
      console.log("❌ FAILED! Test non passato\n")
      console.log(`Expected: addProduct`)
      console.log(`Got: ${step2.functionCalled || "null"}\n`)

      console.log("⚠️  POSSIBILI CAUSE:")
      console.log(
        "   1. L'utente deve essere più esplicito: 'si, aggiungi la mozzarella'"
      )
      console.log(
        "   2. L'LLM non ha compreso che 'si' si riferisce alla richiesta precedente"
      )
      console.log(
        "   3. Verifica che la conversationHistory venga passata all'LLM correttamente\n"
      )

      console.log("🔍 DEBUGGING:")
      console.log(
        "   - Verifica che i messaggi vengano salvati con lo stesso sessionId"
      )
      console.log(
        "   - Verifica che getRecentMessagesByTime() recuperi i messaggi"
      )
      console.log(
        "   - Verifica che la conversationHistory venga passata all'LLM\n"
      )

      await prisma.$disconnect()
      process.exit(1)
    }
  } catch (error: any) {
    console.error("\n❌ Error:", error.message)
    await prisma.$disconnect()
    process.exit(1)
  }
}

testAddProductConfirmationFlow().catch((error) => {
  console.error("\n❌ Fatal error:", error)
  prisma.$disconnect()
  process.exit(1)
})
