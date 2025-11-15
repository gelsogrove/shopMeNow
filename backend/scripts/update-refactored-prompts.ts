/**
 * Update Agent Prompts - PHASE 4: Prompt Architecture Refactoring
 * 
 * Updates database with new refactored prompts:
 * 1. ROUTER: router-agent.md → router-agent-REFACTORED.md
 * 2. PRODUCT_SEARCH: product-search-agent.md → product-services-search-agent.md
 * 
 * Other agents remain unchanged.
 */

import { PrismaClient } from "@prisma/client"
import fs from "fs"
import path from "path"

const prisma = new PrismaClient()

// Load prompts from files
const loadPrompt = (filename: string): string => {
  const filePath = path.join(__dirname, "../../docs/prompts", filename)
  if (!fs.existsSync(filePath)) {
    throw new Error(`❌ File not found: ${filePath}`)
  }
  return fs.readFileSync(filePath, "utf-8")
}

const NEW_PROMPTS = {
  ROUTER: loadPrompt("router-agent-REFACTORED.md"),
  PRODUCT_SEARCH: loadPrompt("product-services-search-agent.md"),
}

async function updateRefactoredPrompts() {
  try {
    console.log("🔄 PHASE 4: Database Update - Applying Refactored Prompts\n")

    await prisma.$connect()
    console.log("✅ Connected to database\n")

    let totalUpdated = 0

    // Update ROUTER agents
    console.log("🔄 Updating ROUTER agents...")
    const routerAgents = await prisma.agentConfig.findMany({
      where: { type: "ROUTER" },
      select: { id: true, name: true, workspaceId: true },
    })

    if (routerAgents.length === 0) {
      console.log("⚠️  No ROUTER agents found")
    } else {
      console.log(`   Found ${routerAgents.length} ROUTER agents:`)
      routerAgents.forEach((a) => console.log(`   - ${a.name} (workspace: ${a.workspaceId})`))

      const routerResult = await prisma.agentConfig.updateMany({
        where: { type: "ROUTER" },
        data: { systemPrompt: NEW_PROMPTS.ROUTER },
      })

      console.log(`   ✅ Updated ${routerResult.count} ROUTER agents`)
      console.log(`   📊 New size: ${NEW_PROMPTS.ROUTER.length} chars (~2,294 words)\n`)
      totalUpdated += routerResult.count
    }

    // Update PRODUCT_SEARCH agents
    console.log("🔄 Updating PRODUCT_SEARCH agents...")
    const productAgents = await prisma.agentConfig.findMany({
      where: { type: "PRODUCT_SEARCH" },
      select: { id: true, name: true, workspaceId: true },
    })

    if (productAgents.length === 0) {
      console.log("⚠️  No PRODUCT_SEARCH agents found")
    } else {
      console.log(`   Found ${productAgents.length} PRODUCT_SEARCH agents:`)
      productAgents.forEach((a) => console.log(`   - ${a.name} (workspace: ${a.workspaceId})`))

      const productResult = await prisma.agentConfig.updateMany({
        where: { type: "PRODUCT_SEARCH" },
        data: { systemPrompt: NEW_PROMPTS.PRODUCT_SEARCH },
      })

      console.log(`   ✅ Updated ${productResult.count} PRODUCT_SEARCH agents`)
      console.log(`   📊 New size: ${NEW_PROMPTS.PRODUCT_SEARCH.length} chars (~1,948 words)`)
      console.log(`   🆕 Now includes: Product & Services unified agent\n`)
      totalUpdated += productResult.count
    }

    console.log("─".repeat(60))
    console.log(`🎉 PHASE 4 COMPLETE! Updated ${totalUpdated} agents total\n`)
    console.log("📝 Changes Applied:")
    console.log("   ✅ ROUTER: Simplified, {{SERVICES}} removed, pure orchestration")
    console.log("   ✅ PRODUCT_SEARCH: Renamed to 'Product & Services Search'")
    console.log("   ✅ SERVICE SELECTION FLOW: Moved from Router to Product agent")
    console.log("   ✅ Constitution Principle XIII: Rules 6, 7, 8 implemented")
    console.log("\n💾 Database updated successfully!")
  } catch (error) {
    console.error("\n❌ Error during update:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Execute
updateRefactoredPrompts()
  .then(() => {
    console.log("\n✅ Script completed successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error)
    process.exit(1)
  })
