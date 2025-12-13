/**
 * Test Script for Code-First LLM Architecture
 * 
 * Run with: npx ts-node test-code-first.ts
 */

import { prisma } from "./src/lib/prisma"
import { CodeFirstLLMService } from "./src/application/code-first-llm"

const TEST_MESSAGES = [
  "mostrami le categorie",
  "ciao",
  "vedi carrello", 
  "chi sei?",
  "dove siete?",
]

async function runTests() {
  console.log("🧪 Code-First LLM Test Suite\n")
  console.log("=".repeat(60))

  // Get test data
  const workspace = await prisma.workspace.findFirst()
  const customer = await prisma.customers.findFirst({ 
    where: { workspaceId: workspace?.id } 
  })

  if (!workspace || !customer) {
    console.error("❌ No workspace or customer found")
    process.exit(1)
  }

  console.log(`📋 Workspace: ${workspace.name}`)
  console.log(`👤 Customer: ${customer.name}`)
  console.log("=".repeat(60))

  const service = new CodeFirstLLMService(prisma)

  for (let i = 0; i < TEST_MESSAGES.length; i++) {
    const msg = TEST_MESSAGES[i]
    console.log(`\n🧪 TEST ${i + 1}: "${msg}"`)
    console.log("-".repeat(40))

    try {
      const result = await service.routeMessage({
        message: msg,
        customerId: customer.id,
        workspaceId: workspace.id,
        customerLanguage: "it",
        customerName: customer.name || "Test User",
      })

      console.log(`✅ Intent: ${result.intent}`)
      console.log(`📊 Confidence: ${result.confidence}`)
      console.log(`🔍 Source: ${result.source}`)
      console.log(`⏱️ Time: ${result.processingTimeMs}ms`)
      console.log(`💬 Response: ${result.message.substring(0, 200)}...`)
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`)
    }
  }

  console.log("\n" + "=".repeat(60))
  console.log("✅ Tests completed")
  
  await prisma.$disconnect()
  process.exit(0)
}

runTests().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})
