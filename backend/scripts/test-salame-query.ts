/**
 * Quick Test: "avete il salame?" - Hallucination Check
 *
 * Simulates customer "Mario Rossi" asking for salami.
 * Expected: Show ONLY real products from DB (Salame Milano), never invent fake ones (Salame Napoli)
 */

import { PrismaClient } from "@prisma/client"
import { ProductSearchAgentLLM } from "../src/application/agents/ProductSearchAgentLLM"

const prisma = new PrismaClient()

async function quickTest() {
  console.log("\n🧪 TEST: avete il salame? (Mario Rossi)\n")

  const workspaceId = "cm9hjgq9v00014qk8fsdy4ujv"

  // Find or create Mario Rossi
  let customer = await prisma.customers.findFirst({
    where: {
      workspaceId,
      name: { contains: "Mario", mode: "insensitive" },
    },
  })

  if (!customer) {
    console.log("❌ Mario Rossi not found in database")
    await prisma.$disconnect()
    return
  }

  console.log(`✅ Customer: ${customer.name}\n`)

  // Get or create session
  let session = await prisma.chatSession.findFirst({
    where: { customerId: customer.id, status: "active" },
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

  // Real products in DB
  const realProducts = await prisma.products.findMany({
    where: {
      workspaceId,
      isActive: true,
      OR: [
        { name: { contains: "salam", mode: "insensitive" } },
        { description: { contains: "salam", mode: "insensitive" } },
      ],
    },
    select: { name: true },
  })

  console.log("📦 Real products in DB:")
  realProducts.forEach((p) => console.log(`   - ${p.name}`))
  console.log()

  // Call ProductSearchAgent
  const agent = new ProductSearchAgentLLM(prisma)

  console.log("🚀 Calling LLM with: 'avete il salame?'\n")
  console.log("⏳ Please wait...\n")

  try {
    const response = await agent.handleQuery({
      workspaceId,
      customerId: customer.id,
      sessionId: session.id,
      customerName: customer.name,
      customerLanguage: "ITA",
      query: "avete il salame?",
    })

    console.log("=".repeat(80))
    console.log("📋 LLM RESPONSE:")
    console.log("=".repeat(80))
    console.log(response.output)
    console.log("=".repeat(80))

    // Analysis
    const hasFakeSalameNapoli = /Salame Napoli/i.test(response.output)
    const hasRealSalameMilano = /Salame Milano/i.test(response.output)
    const hasRealNduja = /Nduja/i.test(response.output)

    console.log("\n🔍 ANALYSIS:")
    console.log(
      `   ❌ Contains "Salame Napoli" (FAKE): ${hasFakeSalameNapoli ? "YES - FAIL!" : "NO - PASS"}`
    )
    console.log(
      `   ✅ Contains "Salame Milano" (REAL): ${hasRealSalameMilano ? "YES" : "NO"}`
    )
    console.log(`   ✅ Contains "Nduja" (REAL): ${hasRealNduja ? "YES" : "NO"}`)
    console.log(`   📊 Tokens used: ${response.tokensUsed}`)
    console.log(`   ⏱️  Time: ${response.executionTimeMs}ms`)

    // Final verdict
    console.log("\n" + "=".repeat(80))
    if (hasFakeSalameNapoli) {
      console.log("❌ FAILED: LLM invented fake product!")
    } else if (!hasRealSalameMilano && !hasRealNduja) {
      console.log("⚠️  WARNING: LLM didn't show any real products!")
    } else {
      console.log("✅ PASSED: LLM used only real products from database!")
    }
    console.log("=".repeat(80) + "\n")
  } catch (error: any) {
    console.error("\n❌ ERROR:", error.message)
    if (error.response?.data) {
      console.error("API Error:", JSON.stringify(error.response.data, null, 2))
    }
  } finally {
    await prisma.$disconnect()
  }
}

quickTest().catch(console.error)
