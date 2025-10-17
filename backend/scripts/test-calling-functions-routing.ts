/**
 * 🧪 Manual Integration Test - Calling Functions Routing
 * 
 * Script standalone per testare il routing delle calling functions
 * senza dipendenze da Jest. Esegue chiamate reali a OpenRouter API.
 * 
 * Uso: npx ts-node scripts/test-calling-functions-routing.ts
 * 
 * ⚠️ ATTENZIONE: Chiama OpenRouter API reale (costo ~$0.05-0.10)
 */

import { PrismaClient } from "@prisma/client"
import { LLMService } from "../src/services/llm.service"
import * as dotenv from "dotenv"

// Load environment variables
dotenv.config()

const prisma = new PrismaClient()
const llmService = new LLMService()

interface TestCase {
  id: number
  name: string
  query: string
  expectedFunction: string | null
  priority: number | null
  notes: string
}

const testCases: TestCase[] = [
  {
    id: 1,
    name: "searchProduct (BACKGROUND)",
    query: "avete la mozzarella di bufala?",
    expectedFunction: "searchProduct",
    priority: 5,
    notes: "BACKGROUND function, non-blocking",
  },
  {
    id: 2,
    name: "Token Return - Lista Ordini",
    query: "dammi la lista degli ordini",
    expectedFunction: null,
    priority: null,
    notes: "Should return [LINK_ORDERS_WITH_TOKEN]",
  },
  {
    id: 3,
    name: "GetLinkOrderByCode",
    query: "dammi ultimo ordine",
    expectedFunction: "GetLinkOrderByCode",
    priority: 2,
    notes: "Show specific order",
  },
  {
    id: 4,
    name: "ContactOperator",
    query: "voglio parlare con un operatore",
    expectedFunction: "ContactOperator",
    priority: 1,
    notes: "Highest priority - human assistance",
  },
  {
    id: 5,
    name: "Token Return - Mostra Carrello",
    query: "mostra carrello",
    expectedFunction: null,
    priority: null,
    notes: "Should return [LINK_CHECKOUT_WITH_TOKEN]",
  },
  {
    id: 6,
    name: "Token Return - Cambia Indirizzo",
    query: "voglio cambiare indirizzo di spedizione",
    expectedFunction: null,
    priority: null,
    notes: "Should return [LINK_PROFILE_WITH_TOKEN]",
  },
  {
    id: 7,
    name: "repeatOrder",
    query: "voglio rifare l'ultimo ordine",
    expectedFunction: "repeatOrder",
    priority: 3,
    notes: "Repeat previous order (with confirmation)",
  },
  {
    id: 8,
    name: "addProduct",
    query: "voglio aggiungere il panettone nel carrello",
    expectedFunction: null,
    priority: 4,
    notes: "Should ask confirmation first, NOT call addProduct yet",
  },
  {
    id: 9,
    name: "No Function Call",
    query: "chi sei?",
    expectedFunction: null,
    priority: null,
    notes: "Conversational query, no function call",
  },
  {
    id: 10,
    name: "Ambiguity - Priority 1 Wins",
    query: "sono stufo, dammi ultimo ordine",
    expectedFunction: "ContactOperator",
    priority: 1,
    notes: "CRITICAL: Priority 1 (frustration) should win over Priority 2",
  },
]

interface TestResult {
  testCase: TestCase
  functionCalled: string | null
  functionArgs: any
  response: string
  passed: boolean
  reason?: string
}

async function callLLMAndGetFunctionInfo(
  userQuery: string,
  workspaceId: string,
  customerId: string,
  customerPhone: string
): Promise<{
  response: string
  functionCalled: string | null
  functionArgs: any
  fullResult: any
}> {
  const result = await llmService.handleMessage({
    chatInput: userQuery,
    phone: customerPhone,
    workspaceId: workspaceId,
    customerid: customerId,
    language: "it",
    sessionId: `test-session-${Date.now()}`,
    maxTokens: 5000,
    model: "openai/gpt-4o-mini",
    messages: [],
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

async function runTests() {
  console.log("\n" + "=".repeat(80))
  console.log("🧪 LLM CALLING FUNCTIONS ROUTING - INTEGRATION TEST")
  console.log("=".repeat(80) + "\n")

  // Setup: Find workspace and customer
  console.log("📋 Test Setup...")

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
    console.error("❌ Test workspace not found. Run seed first: npm run seed")
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
    testCustomer = await prisma.customers.create({
      data: {
        phone: testCustomerPhone,
        name: "Test Customer",
        email: "test@integration.com",
        workspaceId: testWorkspaceId,
        language: "it",
      },
    })
  }

  const testCustomerId = testCustomer.id

  console.log(`✅ Workspace ID: ${testWorkspaceId}`)
  console.log(`✅ Customer ID: ${testCustomerId}`)
  console.log(`✅ Customer Phone: ${testCustomerPhone}\n`)

  // Run tests
  const results: TestResult[] = []

  for (const testCase of testCases) {
    console.log(`\n${"─".repeat(80)}`)
    console.log(`🔍 Test ${testCase.id}/10: ${testCase.name}`)
    console.log(`Query: "${testCase.query}"`)
    console.log(
      `Expected: ${testCase.expectedFunction || "No function call (token/conversational)"}`
    )
    if (testCase.priority) console.log(`Priority: ${testCase.priority}`)
    console.log(`${"─".repeat(80)}`)

    try {
      const { response, functionCalled, functionArgs } =
        await callLLMAndGetFunctionInfo(
          testCase.query,
          testWorkspaceId,
          testCustomerId,
          testCustomerPhone
        )

      console.log(`\n📞 Function Called: ${functionCalled || "null"}`)
      if (functionArgs) {
        console.log(`📦 Function Args:`, JSON.stringify(functionArgs, null, 2))
      }
      console.log(`💬 Response: ${response.substring(0, 200)}...`)

      // Verify result
      let passed = false
      let reason = ""

      if (testCase.expectedFunction === null) {
        // No function call expected
        if (functionCalled === null) {
          passed = true
          reason = "✅ Correctly did NOT call any function"
        } else {
          passed = false
          reason = `❌ Unexpected function call: ${functionCalled}`
        }
      } else {
        // Function call expected
        if (functionCalled === testCase.expectedFunction) {
          passed = true
          reason = `✅ Correctly called ${testCase.expectedFunction}`
        } else {
          passed = false
          reason = `❌ Expected ${testCase.expectedFunction}, got ${functionCalled || "null"}`
        }
      }

      console.log(`\n${reason}`)

      results.push({
        testCase,
        functionCalled,
        functionArgs,
        response,
        passed,
        reason,
      })
    } catch (error: any) {
      console.error(`\n❌ Test failed with error:`, error.message)
      results.push({
        testCase,
        functionCalled: null,
        functionArgs: null,
        response: "",
        passed: false,
        reason: `Error: ${error.message}`,
      })
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  // Print summary
  console.log("\n" + "=".repeat(80))
  console.log("📊 TEST SUMMARY")
  console.log("=".repeat(80) + "\n")

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length

  console.log(`Total Tests: ${results.length}`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%\n`)

  if (failed > 0) {
    console.log("❌ FAILED TESTS:\n")
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  ${r.testCase.id}. ${r.testCase.name}`)
        console.log(`     Query: "${r.testCase.query}"`)
        console.log(`     ${r.reason}`)
        console.log()
      })
  }

  console.log("\n" + "=".repeat(80))
  console.log("🎯 KEY INSIGHTS")
  console.log("=".repeat(80) + "\n")

  // Priority system verification
  const contactOperatorTest = results.find((r) => r.testCase.id === 4)
  const ambiguityTest = results.find((r) => r.testCase.id === 10)

  if (contactOperatorTest?.passed && ambiguityTest?.passed) {
    console.log("✅ Priority System: WORKING CORRECTLY")
    console.log("   - ContactOperator (Priority 1) correctly triggered")
    console.log("   - Ambiguity resolution works (Priority 1 > Priority 2)")
  } else {
    console.log("⚠️  Priority System: NEEDS ATTENTION")
    if (!contactOperatorTest?.passed) {
      console.log("   - ContactOperator test failed")
    }
    if (!ambiguityTest?.passed) {
      console.log("   - Ambiguity resolution test failed")
    }
  }

  // BACKGROUND function verification
  const searchProductTest = results.find((r) => r.testCase.id === 1)
  if (searchProductTest?.passed) {
    console.log("\n✅ BACKGROUND Function: WORKING")
    console.log("   - searchProduct correctly called in background")
  } else {
    console.log("\n⚠️  BACKGROUND Function: NEEDS ATTENTION")
  }

  // Token returns verification
  const tokenTests = results.filter((r) =>
    r.testCase.name.includes("Token Return")
  )
  const tokenTestsPassed = tokenTests.filter((r) => r.passed).length
  console.log(`\n✅ Token Returns: ${tokenTestsPassed}/${tokenTests.length} working`)

  console.log("\n" + "=".repeat(80))

  // Disconnect
  await prisma.$disconnect()

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0)
}

// Run tests
runTests().catch((error) => {
  console.error("\n❌ Fatal error:", error)
  prisma.$disconnect()
  process.exit(1)
})
