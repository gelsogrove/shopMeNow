/**
 * Test Script: Product Search Agent - Hallucination Prevention
 *
 * Tests that LLM shows ONLY real products from database, never invents fake ones.
 *
 * Test case: "avete il salame?"
 * Expected: Show ONLY "Salame Milano" (and possibly Nduja) - NEVER "Salame Napoli"
 */

import { PrismaClient } from "@prisma/client"
import { ProductSearchAgentLLM } from "../src/application/agents/ProductSearchAgentLLM"

const prisma = new PrismaClient()

async function testProductSearch() {
  console.log("\n" + "=".repeat(80))
  console.log("🧪 TEST: Product Search Agent - Hallucination Prevention")
  console.log("=".repeat(80))

  const workspaceId = "cm9hjgq9v00014qk8fsdy4ujv" // Bell'Italia

  // Get test customer
  const customer = await prisma.customers.findFirst({
    where: { workspaceId, isActive: true },
  })

  if (!customer) {
    console.error("❌ No customer found for testing")
    return
  }

  console.log("\n📊 Test Setup:")
  console.log(`   Workspace: ${workspaceId}`)
  console.log(
    `   Customer: ${customer.name} (${customer.phone || customer.email})`
  )
  console.log(`   Query: "avete il salame?"`)

  // Get real products from DB
  const realProducts = await prisma.products.findMany({
    where: {
      workspaceId,
      isActive: true,
      OR: [
        { name: { contains: "salam", mode: "insensitive" } },
        { description: { contains: "salam", mode: "insensitive" } },
      ],
    },
    select: { productCode: true, name: true },
  })

  console.log("\n✅ Real products in database:")
  realProducts.forEach((p) => console.log(`   - ${p.productCode}: ${p.name}`))

  // Create agent
  const agent = new ProductSearchAgentLLM(prisma)

  // Get or create chat session
  let session = await prisma.chatSession.findFirst({
    where: {
      customerId: customer.id,
      status: "active",
    },
  })

  if (!session) {
    session = await prisma.chatSession.create({
      data: {
        workspaceId,
        customerId: customer.id,
        status: "active",
      },
    })
  }

  console.log("\n🚀 Running LLM query...\n")

  try {
    const response = await agent.handleQuery({
      workspaceId,
      customerId: customer.id,
      sessionId: session.id,
      customerName: customer.name,
      customerLanguage: customer.language || "ITA",
      query: "avete il salame?",
    })

    console.log("\n📋 LLM Response:")
    console.log("=".repeat(80))
    console.log(response.output)
    console.log("=".repeat(80))

    console.log("\n📊 Response Analysis:")
    console.log(`   Tokens used: ${response.tokensUsed}`)
    console.log(`   Execution time: ${response.executionTimeMs}ms`)
    console.log(`   Function calls: ${response.functionCalls.length}`)

    // Check for hallucination
    const hasSalameNapoli = /Salame Napoli/i.test(response.output)
    const hasSalameMilano = /Salame Milano/i.test(response.output)
    const hasNduja = /Nduja/i.test(response.output)

    console.log("\n🔍 Hallucination Check:")
    console.log(
      `   ❌ Contains "Salame Napoli" (fake): ${hasSalameNapoli ? "YES (FAIL!)" : "NO (PASS)"}`
    )
    console.log(
      `   ✅ Contains "Salame Milano" (real): ${hasSalameMilano ? "YES" : "NO"}`
    )
    console.log(`   ✅ Contains "Nduja" (real): ${hasNduja ? "YES" : "NO"}`)

    // Check product count
    const productListMatch = response.output.match(/^\d+\.\s/gm)
    const productCount = productListMatch ? productListMatch.length : 0

    console.log(`   📦 Products shown: ${productCount}`)
    console.log(`   📦 Expected: ${realProducts.length} (from database)`)

    // Final verdict
    console.log("\n" + "=".repeat(80))
    if (hasSalameNapoli) {
      console.log("❌ TEST FAILED: LLM invented fake product 'Salame Napoli'!")
    } else if (productCount > realProducts.length) {
      console.log("⚠️ TEST WARNING: LLM showed more products than exist in DB!")
    } else if (!hasSalameMilano && productCount > 0) {
      console.log(
        "⚠️ TEST WARNING: LLM didn't show real product 'Salame Milano'!"
      )
    } else {
      console.log("✅ TEST PASSED: LLM used only real products from database!")
    }
    console.log("=".repeat(80) + "\n")
  } catch (error: any) {
    console.error("\n❌ Error during test:", error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

// Run test
testProductSearch().catch(console.error)
