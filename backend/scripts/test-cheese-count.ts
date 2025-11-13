/**
 * Test: DOP Cheese Count Accuracy
 * Expected: LLM says "5 prodotti" → shows ALL 5 products in list
 */

import { PrismaClient } from "@prisma/client"
import { ProductSearchAgentLLM } from "../src/application/agents/ProductSearchAgentLLM"

const prisma = new PrismaClient()

async function main() {
  console.log("🧪 TEST: DOP Cheese Count Accuracy\n")

  // 1. Verify database has 5 DOP cheeses
  const dopCheeses = await prisma.products.findMany({
    where: {
      workspaceId: "cm9hjgq9v00014qk8fsdy4ujv",
      isActive: true,
      certifications: { has: "DOP" },
    },
    include: { category: true },
  })

  const cheeseCategory = dopCheeses.filter(
    (p) => p.category && p.category.name.toLowerCase().includes("cheese")
  )

  console.log(`📊 Database Reality: ${cheeseCategory.length} DOP cheeses`)
  cheeseCategory.forEach((p) => {
    console.log(`   - ${p.productCode} ${p.name}`)
  })
  console.log()

  // 2. Find customer
  const customer = await prisma.customers.findFirst({
    where: { name: "Mario Rossi" },
  })

  if (!customer) {
    throw new Error("Customer not found")
  }

  // 3. Create session
  let session = await prisma.chatSession.findFirst({
    where: { customerId: customer.id, status: "active" },
  })

  if (!session) {
    session = await prisma.chatSession.create({
      data: {
        workspaceId: customer.workspaceId,
        customerId: customer.id,
        status: "active",
      },
    })
  }

  const agent = new ProductSearchAgentLLM(prisma)

  // 4. Query: "avete i formaggi?"
  console.log('📝 Step 1: User asks "avete i formaggi?"\n')
  const response1 = await agent.handleQuery({
    workspaceId: customer.workspaceId,
    customerId: customer.id,
    sessionId: session.id,
    query: "avete i formaggi?",
  })

  console.log("🤖 LLM Response (Step 1):")
  console.log("=".repeat(80))
  console.log(response1.output)
  console.log("=".repeat(80))
  console.log()

  // 5. Query: User picks "1" (DOP group)
  console.log('📝 Step 2: User selects "1" (Formaggi DOP)\n')
  const response2 = await agent.handleQuery({
    workspaceId: customer.workspaceId,
    customerId: customer.id,
    sessionId: session.id,
    query: "1",
  })

  console.log("🤖 LLM Response (Step 2):")
  console.log("=".repeat(80))
  console.log(response2.output)
  console.log("=".repeat(80))
  console.log()

  // 6. Analysis
  console.log("🔍 ANALYSIS:")

  // Extract count from header
  const countMatch = response2.output.match(/\((\d+)\s+prodotti?\)/)
  const claimedCount = countMatch ? parseInt(countMatch[1]) : 0

  // Count numbered items in list
  const numberedItems = response2.output.match(/^\d+\.\s+/gm)
  const actualCount = numberedItems ? numberedItems.length : 0

  console.log(`   📊 LLM claimed: "${claimedCount} prodotti"`)
  console.log(`   📝 LLM showed: ${actualCount} products in list`)
  console.log(`   ✅ Database has: ${cheeseCategory.length} DOP cheeses`)
  console.log()

  // Check for Taleggio specifically
  const hasTaleggio = response2.output.includes("Taleggio")
  console.log(
    `   🔍 Contains Taleggio DOP: ${hasTaleggio ? "YES ✅" : "NO ❌"}`
  )
  console.log()

  // Verdict
  if (claimedCount === actualCount && actualCount === cheeseCategory.length) {
    console.log("✅ TEST PASSED: Count accurate, all products shown!")
  } else {
    console.log("❌ TEST FAILED:")
    if (claimedCount !== actualCount) {
      console.log(`   - Claimed ${claimedCount} but showed ${actualCount}`)
    }
    if (actualCount !== cheeseCategory.length) {
      console.log(
        `   - Showed ${actualCount} but database has ${cheeseCategory.length}`
      )
    }
    if (!hasTaleggio) {
      console.log(`   - Missing Taleggio DOP!`)
    }
  }
}

main()
  .catch((error) => {
    console.error("❌ Test failed:", error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
