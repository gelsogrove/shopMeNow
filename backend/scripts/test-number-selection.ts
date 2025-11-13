/**
 * Test: Customer selects number from list
 * Expected: LLM shows Format C (8 fields) BEFORE asking cart confirmation
 */

import { PrismaClient } from "@prisma/client"
import { ProductSearchAgentLLM } from "../src/application/agents/ProductSearchAgentLLM"

const prisma = new PrismaClient()

async function main() {
  console.log("🧪 TEST: Customer selects product by number\n")

  // 1. Find customer
  const customer = await prisma.customers.findFirst({
    where: { name: "Mario Rossi" },
  })

  if (!customer) {
    throw new Error("Customer Mario Rossi not found")
  }

  console.log(`✅ Customer: ${customer.name}\n`)

  // 2. Create or find session
  let session = await prisma.chatSession.findFirst({
    where: {
      customerId: customer.id,
      status: "active",
    },
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

  // 3. First query: "che salame avete?"
  console.log("📝 Step 1: User asks 'che salame avete?'\n")
  const response1 = await agent.handleQuery({
    workspaceId: customer.workspaceId,
    customerId: customer.id,
    sessionId: session.id,
    query: "che salame avete?",
  })

  console.log("🤖 LLM Response (Step 1):")
  console.log("=".repeat(80))
  console.log(response1.output)
  console.log("=".repeat(80))
  console.log()

  // 4. Second query: User picks "4"
  console.log("📝 Step 2: User selects '4' from list\n")
  const response2 = await agent.handleQuery({
    workspaceId: customer.workspaceId,
    customerId: customer.id,
    sessionId: session.id,
    query: "4",
  })

  console.log("🤖 LLM Response (Step 2):")
  console.log("=".repeat(80))
  console.log(response2.output)
  console.log("=".repeat(80))
  console.log()

  // 5. Analysis
  console.log("🔍 ANALYSIS:")
  const hasFormatC = /📝.*📦.*🏷️.*🌍/s.test(response2.output)
  const hasAllFields =
    response2.output.includes("📝") &&
    response2.output.includes("💰 Prezzo:") &&
    response2.output.includes("📦 Stock:") &&
    response2.output.includes("🏷️ Fornitore:") &&
    response2.output.includes("🌍 Regione:")

  if (hasFormatC && hasAllFields) {
    console.log("   ✅ Format C (8 fields) shown correctly!")
  } else {
    console.log("   ❌ Format C missing or incomplete!")
    console.log(
      `      - Has 📝 Description: ${response2.output.includes("📝")}`
    )
    console.log(
      `      - Has 💰 Prezzo: ${response2.output.includes("💰 Prezzo:")}`
    )
    console.log(
      `      - Has 📦 Stock: ${response2.output.includes("📦 Stock:")}`
    )
    console.log(
      `      - Has 🏷️ Fornitore: ${response2.output.includes("🏷️ Fornitore:")}`
    )
    console.log(
      `      - Has 🌍 Regione: ${response2.output.includes("🌍 Regione:")}`
    )
  }

  console.log()
  console.log(hasFormatC && hasAllFields ? "✅ TEST PASSED" : "❌ TEST FAILED")
}

main()
  .catch((error) => {
    console.error("❌ Test failed:", error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
