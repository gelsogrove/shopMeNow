/**
 * 🧪 Quick Test - repeatOrder Fix Verification
 *
 * Test rapido per verificare che repeatOrder venga chiamata correttamente
 */

import { PrismaClient } from "@prisma/client"
import * as dotenv from "dotenv"
import { LLMService } from "../src/services/llm.service"

dotenv.config()

const prisma = new PrismaClient()
const llmService = new LLMService()

async function testRepeatOrder() {
  console.log("\n" + "=".repeat(80))
  console.log("🧪 QUICK TEST - repeatOrder Fix Verification")
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
  const testCustomerPhone = "+34600123456"

  let testCustomer = await prisma.customers.findFirst({
    where: {
      phone: testCustomerPhone,
      workspaceId: testWorkspaceId,
    },
  })

  if (!testCustomer) {
    console.error("❌ Customer not found")
    process.exit(1)
  }

  const testCustomerId = testCustomer.id

  console.log(`✅ Workspace ID: ${testWorkspaceId}`)
  console.log(`✅ Customer ID: ${testCustomerId}\n`)

  // Test query
  const query = "voglio rifare l'ultimo ordine"

  console.log(`📝 Testing query: "${query}"`)
  console.log(`Expected: repeatOrder should be called\n`)

  try {
    const result = await llmService.handleMessage({
      chatInput: query,
      phone: testCustomerPhone,
      workspaceId: testWorkspaceId,
      customerid: testCustomerId,
      language: "it",
      sessionId: `test-session-${Date.now()}`,
      maxTokens: 5000,
      model: "openai/gpt-4o-mini",
      messages: [],
      prompt: "",
    })

    let functionCalled: string | null = null

    if (result.debugInfo) {
      try {
        const debug = JSON.parse(result.debugInfo)
        if (debug.functionCalls && debug.functionCalls.length > 0) {
          functionCalled = debug.functionCalls[0].functionName
        }
      } catch (error) {
        console.error("⚠️  Error parsing debugInfo")
      }
    }

    console.log(`\n📞 Function Called: ${functionCalled || "null"}`)
    console.log(`💬 Response: ${result.response?.substring(0, 200)}...`)

    if (functionCalled === "repeatOrder") {
      console.log("\n✅ SUCCESS! repeatOrder called correctly")
      await prisma.$disconnect()
      process.exit(0)
    } else {
      console.log(
        `\n❌ FAILED! Expected repeatOrder, got ${functionCalled || "null"}`
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

testRepeatOrder().catch((error) => {
  console.error("\n❌ Fatal error:", error)
  prisma.$disconnect()
  process.exit(1)
})
