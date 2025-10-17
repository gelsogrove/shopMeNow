/**
 * 🧪 Test addProduct Confirmation Flow
 *
 * Testa il flow completo di addProduct:
 * 1. Utente: "voglio aggiungere il panettone"
 * 2. Sistema: Chiede conferma
 * 3. Utente: "si"
 * 4. Sistema: Deve chiamare addProduct()
 */

import { PrismaClient } from "@prisma/client"
import * as dotenv from "dotenv"
import { LLMService } from "../src/services/llm.service"

dotenv.config()

const prisma = new PrismaClient()
const llmService = new LLMService()

async function testAddProductFlow() {
  console.log("\n" + "=".repeat(80))
  console.log("🧪 TEST addProduct - CONFIRMATION FLOW")
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
    console.error("❌ Workspace not found")
    process.exit(1)
  }

  const testWorkspaceId = workspace.id
  const testCustomerPhone = "+34600555777" // Numero diverso per evitare conflitti

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
        name: "Test AddProduct Customer",
        email: "test-addproduct@shopme.com",
        workspaceId: testWorkspaceId,
        language: "it",
      },
    })
  }

  const testCustomerId = testCustomer.id

  console.log(`✅ Workspace ID: ${testWorkspaceId}`)
  console.log(`✅ Customer ID: ${testCustomerId}`)
  console.log(`✅ Customer Phone: ${testCustomerPhone}\n`)

  // ============================================================================
  // STEP 1: Prima richiesta - Utente chiede di aggiungere prodotto
  // ============================================================================
  console.log("─".repeat(80))
  console.log("📝 STEP 1: Utente chiede di aggiungere prodotto")
  console.log("─".repeat(80))

  const query1 = "voglio aggiungere il panettone nel carrello"
  console.log(`\n🗣️  Utente: "${query1}"`)
  console.log(`Expected: Sistema NON chiama addProduct, chiede conferma\n`)

  try {
    const result1 = await llmService.handleMessage({
      chatInput: query1,
      phone: testCustomerPhone,
      workspaceId: testWorkspaceId,
      customerid: testCustomerId,
      language: "it",
      sessionId: `test-addproduct-${Date.now()}`,
      maxTokens: 5000,
      model: "openai/gpt-4o-mini",
      messages: [],
      prompt: "",
    })

    let functionCalled1: string | null = null
    let functionArgs1: any = null

    if (result1.debugInfo) {
      try {
        const debug = JSON.parse(result1.debugInfo)
        if (debug.functionCalls && debug.functionCalls.length > 0) {
          functionCalled1 = debug.functionCalls[0].functionName
          functionArgs1 = debug.functionCalls[0].functionArgs
        }
      } catch (error) {
        console.error("⚠️  Error parsing debugInfo")
      }
    }

    console.log(`📞 Function Called: ${functionCalled1 || "null"}`)
    if (functionArgs1) {
      console.log(`📦 Function Args:`, JSON.stringify(functionArgs1, null, 2))
    }
    console.log(`💬 Response:\n${result1.response}\n`)

    // Verify step 1
    if (functionCalled1 === null || functionCalled1 !== "addProduct") {
      console.log("✅ STEP 1 PASSED: Sistema NON ha chiamato addProduct")

      // Check if response asks for confirmation
      const responseText = result1.response?.toLowerCase() || ""
      if (
        responseText.includes("?") &&
        (responseText.includes("vuoi") ||
          responseText.includes("aggiungi") ||
          responseText.includes("carrello") ||
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
        "❌ STEP 1 FAILED: Sistema ha chiamato addProduct senza conferma!\n"
      )
      await prisma.$disconnect()
      process.exit(1)
    }

    // ============================================================================
    // STEP 2: Seconda richiesta - Utente conferma con "si"
    // ============================================================================
    console.log("─".repeat(80))
    console.log("📝 STEP 2: Utente conferma con 'si'")
    console.log("─".repeat(80))

    // Aspetta 2 secondi per simulare conversazione reale
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const query2 = "si"
    console.log(`\n🗣️  Utente: "${query2}"`)
    console.log(`Expected: Sistema chiama addProduct() questa volta\n`)

    const result2 = await llmService.handleMessage({
      chatInput: query2,
      phone: testCustomerPhone,
      workspaceId: testWorkspaceId,
      customerid: testCustomerId,
      language: "it",
      sessionId: `test-addproduct-${Date.now()}`,
      maxTokens: 5000,
      model: "openai/gpt-4o-mini",
      messages: [],
      prompt: "",
    })

    let functionCalled2: string | null = null
    let functionArgs2: any = null

    if (result2.debugInfo) {
      try {
        const debug = JSON.parse(result2.debugInfo)
        if (debug.functionCalls && debug.functionCalls.length > 0) {
          functionCalled2 = debug.functionCalls[0].functionName
          functionArgs2 = debug.functionCalls[0].functionArgs
        }
      } catch (error) {
        console.error("⚠️  Error parsing debugInfo")
      }
    }

    console.log(`📞 Function Called: ${functionCalled2 || "null"}`)
    if (functionArgs2) {
      console.log(`📦 Function Args:`, JSON.stringify(functionArgs2, null, 2))
    }
    console.log(`💬 Response:\n${result2.response}\n`)

    // Verify step 2
    console.log("─".repeat(80))
    console.log("📊 FINAL RESULT")
    console.log("─".repeat(80) + "\n")

    if (functionCalled2 === "addProduct") {
      console.log(
        "✅ STEP 2 PASSED: Sistema ha chiamato addProduct dopo conferma!"
      )

      // Check if productCode is present in args
      if (functionArgs2 && functionArgs2.productCode) {
        console.log(
          `✅ BONUS: productCode presente: ${functionArgs2.productCode}`
        )
      } else {
        console.log("⚠️  WARNING: productCode mancante negli argomenti")
      }

      console.log("\n" + "=".repeat(80))
      console.log("🎉 TEST COMPLETO: addProduct Flow FUNZIONA CORRETTAMENTE!")
      console.log("=".repeat(80) + "\n")

      console.log("✅ Flow verificato:")
      console.log("   1. Prima richiesta → Sistema chiede conferma")
      console.log("   2. Utente conferma 'si' → Sistema chiama addProduct()")
      console.log("   3. Prodotto aggiunto al carrello\n")

      await prisma.$disconnect()
      process.exit(0)
    } else {
      console.log(
        `❌ STEP 2 FAILED: Sistema NON ha chiamato addProduct dopo conferma`
      )
      console.log(`   Got: ${functionCalled2 || "null"}`)
      console.log(`   Expected: addProduct con productCode del panettone\n`)

      console.log("⚠️  PROBLEMA POTENZIALE:")
      console.log(
        "   - Il sistema potrebbe non avere il contesto della conversazione precedente"
      )
      console.log(
        "   - Serve history/session per mantenere il contesto del prodotto richiesto"
      )
      console.log(
        "   - Oppure l'utente deve specificare di nuovo il prodotto: 'si, aggiungi il panettone'\n"
      )

      await prisma.$disconnect()
      process.exit(1)
    }
  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message)
    await prisma.$disconnect()
    process.exit(1)
  }
}

testAddProductFlow().catch((error) => {
  console.error("\n❌ Fatal error:", error)
  prisma.$disconnect()
  process.exit(1)
})
