import { PrismaClient } from "@prisma/client"
import { ProductSearchAgentLLM } from "../src/application/agents/ProductSearchAgentLLM"

const prisma = new PrismaClient()

async function testDolciQuery() {
  const workspaceId = "cm9hjgq9v00014qk8fsdy4ujv"
  const customerId = "f6ee6033-465c-4342-98a2-f6ea5d674f71" // Mario Rossi
  const sessionId = "2a7de48a-abaa-437d-9e81-2322f242f165"

  console.log("🧪 TEST: Dolci Query (Temperature 0.3)\n")

  // Step 1: Verify dolci exist in database
  const dolci = await prisma.products.findMany({
    where: {
      workspaceId,
      isActive: true,
      category: {
        name: "Desserts",
      },
    },
    select: {
      productCode: true,
      name: true,
      category: { select: { name: true } },
    },
  })

  console.log(`📊 Database Reality: ${dolci.length} desserts`)
  dolci.forEach((p) => {
    console.log(`   - ${p.productCode} ${p.name}`)
  })

  // Step 2: Clear session memory
  await prisma.searchConversations.deleteMany({
    where: { sessionId },
  })
  console.log("\n✅ Session memory cleared\n")

  // Step 3: Query "avete dolci?"
  console.log('📝 User asks: "avete dolci?"\n')

  const agent = new ProductSearchAgentLLM(prisma)
  const result = await agent.handleQuery({
    workspaceId,
    customerId,
    sessionId,
    query: "avete dolci?",
  })

  console.log("🤖 LLM Response:")
  console.log("=".repeat(80))
  console.log(result.output)
  console.log("=".repeat(80))

  // Step 4: Analyze response
  const responseText = result.output.toLowerCase()

  // Check if LLM says "no dolci" or "non abbiamo"
  const saysDontHave =
    responseText.includes("non ho") ||
    responseText.includes("non abbiamo") ||
    responseText.includes("non trovato") ||
    responseText.includes("non disponibil")

  // Check if LLM shows products
  const showsPanettone = responseText.includes("panettone")
  const showsPandoro = responseText.includes("pandoro")
  const showsAmaretti = responseText.includes("amaretti")
  const productCount = [showsPanettone, showsPandoro, showsAmaretti].filter(
    Boolean
  ).length

  console.log("\n🔍 ANALYSIS:")
  console.log(`   📊 Database has: ${dolci.length} desserts`)
  console.log(
    `   🤖 LLM says "don't have": ${saysDontHave ? "YES ❌" : "NO ✅"}`
  )
  console.log(`   🍰 LLM shows products: ${productCount}/3`)
  console.log(`      - Panettone: ${showsPanettone ? "YES ✅" : "NO ❌"}`)
  console.log(`      - Pandoro: ${showsPandoro ? "YES ✅" : "NO ❌"}`)
  console.log(`      - Amaretti: ${showsAmaretti ? "YES ✅" : "NO ❌"}`)

  // Verdict
  if (saysDontHave) {
    console.log("\n❌ TEST FAILED:")
    console.log("   - LLM says 'non abbiamo dolci' but database has 5 desserts")
    console.log("   - Problem: LLM not reading DESSERTS section in prompt")
  } else if (productCount >= 3) {
    console.log("\n✅ TEST PASSED:")
    console.log(`   - LLM correctly found and showed ${productCount} desserts`)
    console.log(
      "   - Temperature 0.3 enables semantic matching (dolci=desserts)"
    )
  } else {
    console.log("\n⚠️ TEST PARTIAL:")
    console.log(
      `   - LLM found some desserts (${productCount}) but not all (${dolci.length})`
    )
  }

  await prisma.$disconnect()
}

testDolciQuery().catch((error) => {
  console.error("❌ Test failed:", error)
  process.exit(1)
})
