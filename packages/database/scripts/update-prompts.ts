/**
 * UPDATE PROMPTS ONLY
 *
 * This script updates ONLY the agent prompts from docs/prompts/ folder
 * WITHOUT touching other seed data (products, categories, customers, etc.)
 *
 * ⚠️  Updates prompts for the SEED workspace user only
 *
 * Usage: npm run update:prompts
 */

import { config } from "dotenv"
config() // Load environment variables from .env file

import { PrismaClient, AgentType } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

const prisma = new PrismaClient()

// Mapping: prompt filename → AgentType
const PROMPT_TO_AGENT_TYPE: Record<string, AgentType> = {
  "router-agent.md": "ROUTER",
  "product-search-agent.md": "PRODUCT_SEARCH",
  "cart-management-agent.md": "CART_MANAGEMENT",
  "order-tracking-agent.md": "ORDER_TRACKING",
  "customer-support-agent.md": "CUSTOMER_SUPPORT",
  "summary-agent.md": "SUMMARY_AGENT",
  "profile-management-agent.md": "PROFILE_MANAGEMENT",
  "translation-agent.md": "TRANSLATION",
  "security-agent.md": "SECURITY",
  "safety-translation-agent.md": "SAFETY_TRANSLATION",
}

/**
 * Load prompt from markdown file
 */
function loadPrompt(filename: string): string {
  const promptPath = path.join(__dirname, "../../../docs/prompts", filename)
  try {
    return fs.readFileSync(promptPath, "utf-8")
  } catch (error) {
    console.error(`❌ Failed to load prompt: ${filename}`, error)
    throw new Error(`Failed to load prompt file: ${filename}`)
  }
}

async function main() {
  console.log("🔄 Updating agent prompts...")
  console.log("")

  // Find the seed workspace (admin user's workspace)
  const adminEmail = process.env.ADMIN_EMAIL || "andrea_gelsomino@hotmail.com"
  
  const adminUser = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: {
      workspaces: {
        include: {
          workspace: true,
        },
      },
    },
  })

  if (!adminUser) {
    console.error(`❌ Admin user not found: ${adminEmail}`)
    console.error("   Run 'npm run prisma:seed' first to create the seed data.")
    process.exit(1)
  }

  const workspace = adminUser.workspaces[0]?.workspace
  if (!workspace) {
    console.error(`❌ No workspace found for admin user: ${adminEmail}`)
    process.exit(1)
  }

  console.log(`📦 Workspace: ${workspace.name} (${workspace.id})`)
  console.log(`👤 Admin: ${adminEmail}`)
  console.log("")

  // Update each prompt
  let updated = 0
  let skipped = 0

  for (const [filename, agentType] of Object.entries(PROMPT_TO_AGENT_TYPE)) {
    try {
      const promptContent = loadPrompt(filename)
      
      // Find existing agent config
      const existingAgent = await prisma.agentConfig.findFirst({
        where: {
          workspaceId: workspace.id,
          type: agentType,
        },
      })

      if (!existingAgent) {
        console.log(`⏭️  ${agentType}: Agent not found, skipping`)
        skipped++
        continue
      }

      // Update only the systemPrompt
      await prisma.agentConfig.update({
        where: { id: existingAgent.id },
        data: {
          systemPrompt: promptContent,
          updatedAt: new Date(),
        },
      })

      console.log(`✅ ${agentType}: Updated from ${filename}`)
      updated++
    } catch (error) {
      console.error(`❌ ${agentType}: Failed to update - ${error}`)
    }
  }

  console.log("")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`✅ Updated: ${updated} agents`)
  if (skipped > 0) {
    console.log(`⏭️  Skipped: ${skipped} agents (not found)`)
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
}

main()
  .catch((e) => {
    console.error("❌ Error updating prompts:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
