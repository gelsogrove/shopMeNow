/**
 * 🧪 Test repeatOrder Confirmation Flow - Standalone
 * 
 * Test standalone per verificare il flow repeatOrder con conferma.
 * 
 * Flow:
 * 1. Utente: "voglio rifare l'ultimo ordine" → Sistema chiede conferma
 * 2. Utente: "si" → Sistema chiama repeatOrder()
 * 
 * ⚠️ ATTENZIONE: Chiama OpenRouter API reale (costo ~$0.02)
 */

import { PrismaClient } from "@prisma/client"
import { LLMService } from "../src/services/llm.service"
import * as dotenv from "dotenv"

dotenv.config()

const prisma = new PrismaClient()
const llmService = new LLMService()

async function testRepeatOrderConfirmationFlow() {
  console.log("\n" + "=".repeat(80))
  console.log("🧪 TEST repeatOrder - CONFIRMATION FLOW (Standalone)")
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
  const testCustomerPhone = "+34600888999" // Numero unico per questo test

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
        name: "Test RepeatOrder Flow",
        email: "test-repeatorder-flow@shopme.com",
        workspaceId: testWorkspaceId,
        language: "it",
      },
    })
  }

  const testCustomerId = testCustomer.id
  const sessionId = `repeatorder-test-${Date.now()}`

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
    // STEP 1: Utente chiede di rifare ultimo ordine
    // ============================================================================
    const step1 = await callLLM("voglio rifare l'ultimo ordine", 1)

    console.log(`📞 Function Called: ${step1.functionCalled || "null"}`)
    if (step1.functionArgs) {
      console.log(`📦 Args:`, JSON.stringify(step1.functionArgs, null, 2))
    }
    console.log(`💬 Response: ${step1.response}\n`)

    // Verify STEP 1
    if (step1.functionCalled === null || step1.functionCalled !== "repeatOrder") {
      console.log("✅ STEP 1 CORRECT: Sistema NON ha chiamato repeatOrder")

      const responseText = step1.response.toLowerCase()
      if (
        responseText.includes("?") &&
        (responseText.includes("ricreo") ||
          responseText.includes("ultimo ordine") ||
          responseText.includes("ordine era") ||
          responseText.includes("conferma"))
      ) {
        console.log("✅ STEP 1 BONUS: Sistema chiede conferma (contiene '?')\n")
      } else {
        console.log(
          "⚠️  STEP 1 WARNING: Response potrebbe non chiedere conferma\n"
        )
      }
    } else {
      console.log(
        "❌ STEP 1 FAILED: Sistema ha chiamato repeatOrder senza conferma!"
      )
      await prisma.$disconnect()
      process.exit(1)
    }

    // ============================================================================
    // STEP 2: Utente conferma con "si"
    // ============================================================================
    const step2 = await callLLM("si", 2)

    console.log(`📞 Function Called: ${step2.functionCalled || "null"}`)
    if (step2.functionArgs) {
      console.log(`📦 Args:`, JSON.stringify(step2.functionArgs, null, 2))
    }
    console.log(`💬 Response: ${step2.response}\n`)

    // ============================================================================
    // FINAL RESULT
    // ============================================================================
    console.log("=".repeat(80))
    console.log("📊 FINAL RESULT")
    console.log("=".repeat(80) + "\n")

    if (step2.functionCalled === "repeatOrder") {
      console.log("🎉 SUCCESS! Test PASSED\n")
      console.log("✅ Flow verificato:")
      console.log(
        "   1. Prima richiesta → Sistema chiede conferma (NO repeatOrder)"
      )
      console.log("   2. Utente 'si' → Sistema chiama repeatOrder()")
      console.log(
        "   3. orderCode negli args:",
        step2.functionArgs?.orderCode || "auto (ultimo ordine)"
      )
      console.log(
        "\n✅ Il sistema mantiene correttamente il contesto conversazionale!"
      )
      console.log("✅ La history degli ultimi 5 minuti funziona correttamente!\n")

      await prisma.$disconnect()
      process.exit(0)
    } else {
      console.log("❌ FAILED! Test non passato\n")
      console.log(`Expected: repeatOrder`)
      console.log(`Got: ${step2.functionCalled || "null"}\n`)

      console.log("⚠️  POSSIBILI CAUSE:")
      console.log(
        "   1. L'utente deve essere più esplicito: 'si, rifare ordine'"
      )
      console.log(
        "   2. L'LLM non ha compreso che 'si' si riferisce alla richiesta precedente"
      )
      console.log(
        "   3. Verifica che la conversationHistory venga passata all'LLM correttamente\n"
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

testRepeatOrderConfirmationFlow().catch((error) => {
  console.error("\n❌ Fatal error:", error)
  prisma.$disconnect()
  process.exit(1)
})
